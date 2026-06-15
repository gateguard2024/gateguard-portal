import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Public-safe shape — never leak tokens or SMTP passwords to the client.
function sanitize(row: any) {
  const cfg = row.config ?? {}
  return {
    id: row.id,
    channel_type: row.channel_type,
    display_name: row.display_name,
    is_active: row.is_active,
    email: cfg.from_address ?? cfg.email ?? cfg.user ?? null,
    smtp_host: cfg.host ?? null,
    smtp_port: cfg.port ?? null,
    connected: row.channel_type === 'gmail' ? !!row.oauth_refresh_token : !!cfg.host,
    last_synced_at: row.last_synced_at,
    created_at: row.created_at,
  }
}

// GET /api/nexus/messages/channels — list the current user's connectors
export async function GET() {
  const user = await getCurrentUser()
  const { data, error } = await supabase
    .from('message_channels')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ channels: (data ?? []).map(sanitize) })
}

// POST /api/nexus/messages/channels — add an SMTP connector
// Body: { display_name, host, port, secure?, user, pass, from_address }
// NOTE: SMTP password is stored in config (server-side, service-role only).
// Follow-up hardening: encrypt config at rest (pgsodium / app-level KMS) before GA.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { display_name, host, port, secure, user: smtpUser, pass, from_address } = body ?? {}
  if (!host || !port || !smtpUser || !pass) {
    return NextResponse.json(
      { error: 'host, port, user, and pass are required for an SMTP connector' },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from('message_channels')
    .insert({
      user_id: user.id,
      org_id: user.org_id,
      channel_type: 'smtp',
      display_name: display_name || from_address || smtpUser,
      is_active: true,
      config: {
        host,
        port: Number(port),
        secure: secure ?? Number(port) === 465,
        user: smtpUser,
        pass,
        from_address: from_address || smtpUser,
      },
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ channel: sanitize(data) })
}

// DELETE /api/nexus/messages/channels?id=... — remove a connector (own only)
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase
    .from('message_channels')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
