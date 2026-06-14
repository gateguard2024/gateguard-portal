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

// POST /api/nexus/messages/channels/test  { channel_id, to? }
// Sends a test email through the connector to the user's own address (or `to`),
// so the setup pane can confirm the mailbox is configured correctly. Does NOT
// record a thread/message — it is a connectivity check only.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const channelId = body?.channel_id
  if (!channelId) return NextResponse.json({ error: 'channel_id is required' }, { status: 400 })

  const { data: channel, error } = await supabase
    .from('message_channels')
    .select('*')
    .eq('id', channelId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!channel) return NextResponse.json({ error: 'Connector not found' }, { status: 404 })

  const cfg = channel.config ?? {}
  const fromAddress: string = cfg.from_address ?? cfg.user ?? user.email
  const to: string = body?.to || user.email
  if (!to) return NextResponse.json({ error: 'No destination address available for test' }, { status: 400 })

  const email: OutboundEmail = {
    to,
    subject: 'GateGuard Nexus — test email',
    text: `This is a test message confirming your "${channel.display_name}" connector can send email through Nexus.`,
    fromName: 'GateGuard Nexus',
    fromAddress,
  }

  let result
  if (channel.channel_type === 'gmail') {
    if (!channel.oauth_refresh_token) {
      return NextResponse.json({ ok: false, error: 'Gmail connector not authorized' }, { status: 409 })
    }
    result = await sendViaGmail(channel.oauth_refresh_token, fromAddress, email)
  } else if (channel.channel_type === 'smtp') {
    if (!cfg.host || !cfg.user || !cfg.pass) {
      return NextResponse.json({ ok: false, error: 'SMTP connector is misconfigured' }, { status: 409 })
    }
    result = await sendViaSmtp(
      { host: cfg.host, port: Number(cfg.port), secure: cfg.secure, user: cfg.user, pass: cfg.pass },
      email,
    )
  } else {
    return NextResponse.json({ ok: false, error: `Unsupported connector type: ${channel.channel_type}` }, { status: 400 })
  }

  // Stamp last_synced_at on success so the pane can show "verified".
  if (result.ok) {
    await supabase
      .from('message_channels')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', channel.id)
  }

  return NextResponse.json(
    result.ok ? { ok: true, sent_to: to } : { ok: false, error: result.error },
    { status: result.ok ? 200 : 502 },
  )
}
