// POST /api/gmail/send — dedicated Gmail reply / forward sender.
//
// Additive to /api/nexus/messages/send (which stays as-is). Builds a proper
// RFC 2822 MIME reply/forward (In-Reply-To + threadId), appends the user's saved
// HTML signature, and sends via the Gmail REST API using the OAuth refresh token
// already stored on the user's `message_channels` Gmail connector. No googleapis
// dependency, no request-body tokens, no Prisma — pure Nexus/Supabase stack.
//
// Body: { channel_id?, to, subject, messageBody, isForward?, gmailThreadId?,
//         inReplyTo?, thread_id? }
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { getGmailAccessToken } from '@/lib/mail-send'
import { createMimeMessage, wrapHtmlBody } from '@/lib/gmail'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const to = String(body.to ?? '').trim()
  const messageBody = String(body.messageBody ?? body.text ?? '')
  const rawSubject = String(body.subject ?? '(no subject)')
  const isForward = body.isForward === true
  const channelId = body.channel_id ? String(body.channel_id) : undefined
  const gmailThreadId = body.gmailThreadId ? String(body.gmailThreadId) : undefined
  const inReplyTo = body.inReplyTo ? String(body.inReplyTo) : undefined
  const internalThreadId = body.thread_id ? String(body.thread_id) : undefined
  if (!to) return NextResponse.json({ error: 'A recipient (to) is required.' }, { status: 400 })

  // Resolve the Gmail connector: explicit channel_id, else the user's active one.
  let channel: Record<string, unknown> | null = null
  if (channelId) {
    const { data } = await supabase.from('message_channels').select('*').eq('id', channelId).maybeSingle()
    channel = data
  } else {
    const { data } = await supabase.from('message_channels').select('*')
      .eq('user_id', user.id).eq('channel_type', 'gmail').eq('is_active', true)
      .order('created_at', { ascending: true }).limit(1).maybeSingle()
    channel = data
  }
  if (!channel) return NextResponse.json({ error: 'No Gmail connector found. Connect Gmail in Messages settings.' }, { status: 404 })
  if (channel.channel_type !== 'gmail' || !channel.oauth_refresh_token) {
    return NextResponse.json({ error: 'Gmail connector is not authorized.' }, { status: 409 })
  }

  const cfg = (channel.config as Record<string, unknown>) ?? {}
  const fromAddress = String(cfg.from_address ?? cfg.user ?? user.email ?? '')
  const from = user.name ? `${user.name} <${fromAddress}>` : fromAddress

  // Signature — same source the existing send route uses.
  const { data: sigRow } = await supabase.from('user_settings').select('email_signature').eq('user_id', user.id).maybeSingle()
  const signature = String(sigRow?.email_signature ?? '').trim()

  const subject = isForward
    ? (rawSubject.toLowerCase().startsWith('fwd:') ? rawSubject : `Fwd: ${rawSubject}`)
    : (rawSubject.toLowerCase().startsWith('re:') ? rawSubject : `Re: ${rawSubject}`)

  const { token, error: tokErr } = await getGmailAccessToken(String(channel.oauth_refresh_token))
  if (!token) return NextResponse.json({ error: tokErr ?? 'Could not authorize Gmail.' }, { status: 502 })

  const raw = createMimeMessage({ from, to, subject, bodyHtml: wrapHtmlBody(messageBody, signature), inReplyTo })

  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw, ...(gmailThreadId ? { threadId: gmailThreadId } : {}) }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json({ error: data?.error?.message ?? 'Gmail send failed.' }, { status: 502 })
    }
    // Best-effort: reflect the reply on the internal thread.
    if (internalThreadId) {
      await supabase.from('message_threads').update({ last_message_at: new Date().toISOString() }).eq('id', internalThreadId)
    }
    return NextResponse.json({ success: true, messageId: data.id, threadId: data.threadId })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gmail send error.' }, { status: 500 })
  }
}
