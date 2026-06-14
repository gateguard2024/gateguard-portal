import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { sendViaSmtp, sendViaGmail, type OutboundEmail } from '@/lib/mail-send'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// POST /api/nexus/messages/send
// Body: { channel_id, to, subject, text?, html?, thread_id?, linked_wo_id?, linked_quote_id? }
// Sends through the chosen connector (SMTP or Gmail), then records the outbound
// message in message_threads / messages so it appears in the Messages shell.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { channel_id, to, subject, text, html, thread_id, linked_wo_id, linked_quote_id } = body ?? {}
  if (!channel_id || !to) {
    return NextResponse.json({ error: 'channel_id and to are required' }, { status: 400 })
  }

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
  const email: OutboundEmail = {
    to,
    subject: subject ?? '(no subject)',
    text,
    html,
    fromName: user.name,
    fromAddress,
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

  // Find or create the thread.
  let threadId: string | null = thread_id ?? null
  if (!threadId) {
    const { data: thread, error: thErr } = await supabase
      .from('message_threads')
      .insert({
        user_id: user.id,
        org_id: channel.org_id ?? user.org_id,
        channel_id: channel.id,
        subject: email.subject,
        participants: [{ name: '', address: to }],
        linked_wo_id: linked_wo_id ?? null,
        linked_quote_id: linked_quote_id ?? null,
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (thErr) return NextResponse.json({ error: thErr.message }, { status: 500 })
    threadId = thread.id
  }

  // Record the outbound message (status reflects send outcome).
  const now = new Date().toISOString()
  const { data: msg, error: msgErr } = await supabase
    .from('messages')
    .insert({
      thread_id: threadId,
      channel_id: channel.id,
      external_message_id: result.externalId ?? null,
      direction: 'outbound',
      source_type: sourceType,
      from_address: fromAddress,
      from_name: user.name,
      to_addresses: [{ name: '', address: to }],
      subject: email.subject,
      body: text ?? '',
      body_html: html ?? null,
      status: result.ok ? 'sent' : 'failed',
      sent_at: result.ok ? now : null,
      error_message: result.ok ? null : result.error,
    })
    .select('id')
    .single()
  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 })

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, thread_id: threadId, message_id: msg.id },
      { status: 502 },
    )
  }
  return NextResponse.json({ ok: true, thread_id: threadId, message_id: msg.id, external_id: result.externalId })
}
