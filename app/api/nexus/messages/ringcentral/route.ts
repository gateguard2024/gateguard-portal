import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { encryptJson, credsKeyConfigured } from '@/lib/crypto-creds'
import { rcConfigured, rcToken, rcWhoAmI, syncRingCentral, isRingCentral, e164 } from '@/lib/ringcentral'
import { writeSafe } from '@/lib/mail-fetch'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// GET → is RingCentral set up for Gate Guard, and is it connected for me?
export async function GET() {
  const user = await getCurrentUser()
  const { data } = await supabase.from('message_channels').select('*').eq('user_id', user.id).eq('channel_type', 'phone')
  const ch = (data ?? []).find(isRingCentral)
  return NextResponse.json({
    app_ready: rcConfigured() && credsKeyConfigured(),
    connected: !!ch,
    channel: ch ? {
      id: ch.id, name: ch.config?.rc_name ?? null, extension: ch.config?.rc_extension ?? null,
      numbers: ch.config?.numbers ?? [], sms_from: ch.config?.sms_from ?? null,
      last_synced_at: ch.last_synced_at ?? null, last_error: ch.last_error ?? null,
    } : null,
  })
}

// POST { jwt } → connect (checks it works, saves it encrypted, first sync)
// POST { sms_from } → choose which number texts go out from
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  const body = await req.json().catch(() => ({}))
  const { data: rows } = await supabase.from('message_channels').select('*').eq('user_id', user.id).eq('channel_type', 'phone')
  const existing = (rows ?? []).find(isRingCentral)

  if (typeof body?.sms_from === 'string') {
    if (!existing) return NextResponse.json({ error: 'Connect RingCentral first.' }, { status: 400 })
    const n = e164(body.sms_from)
    const mine = (existing.config?.numbers ?? []) as { number: string; sms: boolean }[]
    if (!n || !mine.some((x) => e164(x.number) === n && x.sms)) return NextResponse.json({ error: 'That number can’t send texts.' }, { status: 400 })
    const { error } = await supabase.from('message_channels').update({ config: { ...existing.config, sms_from: n } }).eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const jwt = typeof body?.jwt === 'string' ? body.jwt.trim() : ''
  if (!rcConfigured()) return NextResponse.json({ error: 'RingCentral isn’t set up yet — add RINGCENTRAL_CLIENT_ID and RINGCENTRAL_CLIENT_SECRET in Vercel.' }, { status: 503 })
  if (!credsKeyConfigured()) return NextResponse.json({ error: 'CREDENTIALS_ENC_KEY is not set in Vercel.' }, { status: 503 })
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(jwt)) return NextResponse.json({ error: 'That doesn’t look like a RingCentral JWT (three parts with dots).' }, { status: 400 })

  const { token, error } = await rcToken(jwt)
  if (!token) return NextResponse.json({ error }, { status: 400 })
  const who = await rcWhoAmI(token)
  if ('error' in who) return NextResponse.json({ error: who.error }, { status: 400 })
  const smsFrom = e164(who.numbers.find((n) => n.sms && /direct/.test(n.label))?.number ?? who.numbers.find((n) => n.sms)?.number ?? '')

  const config = {
    provider: 'ringcentral', jwt_enc: encryptJson({ jwt }),
    rc_name: who.name, rc_extension: who.extension, rc_email: who.email,
    numbers: who.numbers, sms_from: existing?.config?.sms_from ?? smsFrom,
    // a new login starts the sync over
    rc_msg_sync: null, rc_call_sync: null,
  }
  const row = { user_id: user.id, org_id: user.org_id, channel_type: 'phone', display_name: `RingCentral · ${who.name}${who.extension ? ` (ext ${who.extension})` : ''}`, is_active: true, config, last_error: null, last_error_at: null }
  const r = existing
    ? await writeSafe((x) => supabase.from('message_channels').update(x).eq('id', existing.id).select('*').single(), row)
    : await writeSafe((x) => supabase.from('message_channels').insert(x).select('*').single(), row)
  if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 })

  const first = await syncRingCentral(supabase, r.data)
  return NextResponse.json({ ok: true, name: who.name, numbers: who.numbers, sms_from: config.sms_from, fetched: first.fetched, warning: first.error ?? null })
}
