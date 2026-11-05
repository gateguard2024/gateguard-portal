import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { sendViaSmtp, sendViaGmail, type OutboundEmail, type MailAttachment } from '@/lib/mail-send'
import { recomputeThread, writeSafe, parseAddressList } from '@/lib/mail-fetch'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const MAX_ATTACH_B64 = 3_400_000 // ~2.5 MB of files — Vercel caps a request at 4.5 MB

// "a@x.com, Bob <b@y.com>" or ["a@x.com"] → clean list of addresses.
function addrList(v: unknown): string[] {
  const raw = Array.isArray(v) ? v.join(',') : typeof v === 'string' ? v : ''
  return parseAddressList(raw.replace(/;/g, ',')).map((p) => (p.name ? `${p.name.replace(/[",<>]/g, '')} <${p.address}>` : p.address))
}
const bare = (s: string) => (s.match(/<([^>]+)>/)?.[1] ?? s).trim().toLowerCase()
const reSubject = (s: string) => (/^\s*re:/i.test(s) ? s : `Re: ${s}`)

// POST /api/nexus/messages/send
// Body: { channel_id, to, cc?, bcc?, subject?, text?, html?, thread_id?, attachments?: [{ filename, content (base64), contentType }],
//         forward?: boolean, linked_wo_id?, linked_quote_id? }
// A reply (thread_id, not forward) stays in the same Gmail conversation for us and the customer.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { channel_id, text, html, thread_id, linked_wo_id, linked_quote_id } = body ?? {}
  const to = addrList(body?.to)
  const cc = addrList(body?.cc)
  const bcc = addrList(body?.bcc)
  const isForward = body?.forward === true
  if (!channel_id || !to.length) {
    return NextResponse.json({ error: 'Add at least one person to send to.' }, { status: 400 })
  }
  if (to.length + cc.length + bcc.length > 50) return NextResponse.json({ error: 'Too many people on one email (50 max).' }, { status: 400 })

  // Files.
  const attachments: MailAttachment[] = []
  let attBytes = 0
  for (const a of Array.isArray(body?.attachments) ? body.attachments : []) {
    if (!a?.filename || typeof a?.content !== 'string') continue
    attBytes += a.content.length
    attachments.push({ filename: String(a.filename).slice(0, 150), content: a.content.replace(/^data:[^,]*,/, ''), contentType: a.contentType || 'application/octet-stream', isBase64: true })
  }
  if (attBytes > MAX_ATTACH_B64) return NextResponse.json({ error: 'Files are too big — keep attachments under 2.5 MB total.' }, { status: 413 })

  // Load + ownership-check the connector.
  const { data: channel, error: chErr } = await supabase
    .from('message_channels')
    .select('*')
    .eq('id', channel_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (chErr) return NextResponse.json({ error: chErr.message }, { status: 500 })
  if (!channel) return NextResponse.json({ error: 'Connector not found' }, { status: 404 })
  if (!channel.is_active) return NextResponse.json({ error: 'Connector is disabled' }, { status: 409 })

  const cfg = channel.config ?? {}
  const fromAddress: string = cfg.from_address ?? cfg.user ?? user.email

  // Replying? Load the conversation (must be yours) so the reply threads properly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let thread: any = null
  let inReplyTo: string | undefined
  let references: string | undefined
  if (thread_id) {
    const { data: t } = await supabase.from('message_threads').select('*').eq('id', thread_id).maybeSingle()
    if (!t || t.user_id !== user.id) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
    thread = t
    if (!isForward) {
      let r = await supabase.from('messages').select('rfc_message_id, created_at').eq('thread_id', t.id).order('created_at', { ascending: true }).limit(60)
      if (r.error) r = { data: [], error: null } as unknown as typeof r // before migration 222
      const ids = (r.data ?? []).map((m: { rfc_message_id?: string | null }) => m.rfc_message_id).filter(Boolean) as string[]
      if (ids.length) { inReplyTo = ids[ids.length - 1]; references = ids.slice(-20).join(' ') }
    }
  }
  const subject = String(body?.subject ?? '').trim()
    || (thread ? (isForward ? `Fwd: ${String(thread.subject ?? '').replace(/^\s*(fwd?|re):\s*/i, '')}` : reSubject(thread.subject ?? '')) : '(no subject)')

  // Append the user's saved signature (if any) to the outgoing message.
  const { data: sig } = await supabase.from('user_settings').select('email_signature').eq('user_id', user.id).maybeSingle()
  const signature = (sig?.email_signature ?? '').trim()
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const textWithSig = signature ? `${text ?? ''}\n\n${signature}` : text
  const htmlWithSig = html
    ? (signature ? `${html}<br><br><div style="color:#555">${esc(signature).replace(/\n/g, '<br>')}</div>` : html)
    : undefined

  const email: OutboundEmail = {
    to: to.join(', '),
    cc: cc.length ? cc : undefined,
    bcc: bcc.length ? bcc : undefined,
    subject,
    text: textWithSig,
    html: htmlWithSig,
    fromName: user.name,
    fromAddress,
    attachments: attachments.length ? attachments : undefined,
    gmailThreadId: thread && !isForward ? thread.external_thread_id ?? undefined : undefined,
    inReplyTo,
    references,
  }

  // Route by connector type.
  let result
  let sourceType: 'smtp' | 'gmail'
  if (channel.channel_type === 'gmail') {
    sourceType = 'gmail'
    if (!channel.oauth_refresh_token) {
      return NextResponse.json({ error: 'Gmail connector not authorized' }, { status: 409 })
    }
    result = await sendViaGmail(channel.oauth_refresh_token, fromAddress, email)
  } else if (channel.channel_type === 'smtp') {
    sourceType = 'smtp'
    if (!cfg.host || !cfg.user || !cfg.pass) {
      return NextResponse.json({ error: 'SMTP connector is misconfigured' }, { status: 409 })
    }
    result = await sendViaSmtp(
      { host: cfg.host, port: Number(cfg.port), secure: cfg.secure, user: cfg.user, pass: cfg.pass },
      email,
    )
  } else {
    return NextResponse.json({ error: `Unsupported connector type: ${channel.channel_type}` }, { status: 400 })
  }

  // The thread this lives in: the one replied to, the Gmail thread Google put it in, or a new one.
  let threadId: string | null = thread && !isForward ? thread.id : null
  if (!threadId && result.ok && result.threadId) {
    const { data: g } = await supabase.from('message_threads').select('id').eq('channel_id', channel.id).eq('external_thread_id', result.threadId).maybeSingle()
    threadId = g?.id ?? null
  }
  const toObjs = to.map((a) => ({ name: (a.match(/^(.*)<[^>]+>$/)?.[1] ?? '').trim(), address: bare(a) }))
  const ccObjs = cc.map((a) => ({ name: (a.match(/^(.*)<[^>]+>$/)?.[1] ?? '').trim(), address: bare(a) }))
  if (!threadId) {
    const { data: created, error: thErr } = await writeSafe((row) => supabase.from('message_threads').insert(row).select('id').single(), {
      user_id: user.id,
      org_id: channel.org_id ?? user.org_id,
      channel_id: channel.id,
      external_thread_id: result.ok ? result.threadId ?? null : null,
      subject,
      participants: [...toObjs, ...ccObjs],
      linked_wo_id: linked_wo_id ?? (isForward ? null : thread?.linked_wo_id ?? null),
      linked_quote_id: linked_quote_id ?? null,
      last_message_at: new Date().toISOString(),
      last_direction: 'outbound',
    })
    if (thErr) return NextResponse.json({ error: thErr.message }, { status: 500 })
    threadId = created.id
  } else if (thread && !thread.external_thread_id && result.ok && result.threadId) {
    await supabase.from('message_threads').update({ external_thread_id: result.threadId }).eq('id', threadId)
  }

  // Record the outbound message (status reflects send outcome).
  const now = new Date().toISOString()
  const { data: msg, error: msgErr } = await writeSafe((row) => supabase.from('messages').insert(row).select('id').single(), {
    thread_id: threadId,
    channel_id: channel.id,
    external_message_id: result.externalId ?? null,
    direction: 'outbound',
    source_type: sourceType,
    from_address: fromAddress,
    from_name: user.name,
    to_addresses: toObjs,
    cc_addresses: ccObjs,
    subject,
    body: textWithSig ?? '',
    body_html: htmlWithSig ?? null,
    snippet: String(textWithSig ?? '').replace(/\s+/g, ' ').trim().slice(0, 240) || null,
    labels: result.ok ? ['SENT'] : [],
    attachments: attachments.map((a) => ({ name: a.filename, mime_type: a.contentType, size: Math.round(String(a.content).length * 0.75), attachment_id: '', sent: true })),
    status: result.ok ? 'sent' : 'failed',
    sent_at: result.ok ? now : null,
    read_at: now,
    created_at: now,
    error_message: result.ok ? null : result.error,
  })
  if (msgErr) {
    // The email went out but our copy didn't save (e.g. the live sync stored it first).
    if (result.ok) return NextResponse.json({ ok: true, thread_id: threadId, warning: msgErr.message })
    return NextResponse.json({ error: msgErr.message }, { status: 500 })
  }
  await recomputeThread(supabase, threadId!)

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, thread_id: threadId, message_id: msg.id },
      { status: 502 },
    )
  }
  return NextResponse.json({ ok: true, thread_id: threadId, message_id: msg.id, external_id: result.externalId })
}
