/**
 * POST /api/shelly/relays/[id]  { site_id, channel, on, confirm, name? }
 * Turn a Shelly relay on/off. Physical action — requires confirm:true. Logged
 * as a site event so the activity timeline shows who toggled what + when.
 * [id] = Shelly device id.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { controlSiteShellyRelay } from '@/lib/shelly'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  const body = await req.json().catch(() => ({}))
  const siteId = String(body.site_id ?? '')
  if (!siteId) return NextResponse.json({ error: 'site_id required' }, { status: 400 })
  if (!(await canOperate(user, siteId, 'relays'))) return NextResponse.json({ error: 'You don’t have relay access for this site.' }, { status: 403 })
  if (body.confirm !== true) return NextResponse.json({ error: 'Toggling a relay needs confirmation.' }, { status: 400 })

  const channel = Number(body.channel) || 0
  const on = body.on === true
  try {
    await controlSiteShellyRelay(siteId, params.id, channel, on)
    const name = String(body.name ?? 'Relay')
    try {
      await supabase.from('site_events').insert({
        site_id: siteId, event_type: 'relay_toggle', event_source: 'shelly',
        title: `Relay ${on ? 'ON' : 'OFF'}: ${name}`,
        description: `${name} turned ${on ? 'on' : 'off'} by ${user.name} via Nexus`,
        summary: `${name} ${on ? 'on' : 'off'} by ${user.name}`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: { device_id: params.id, channel, on, by_user_id: user.id, by_name: user.name } as any,
      })
    } catch { /* audit best-effort */ }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Relay control failed' }, { status: 502 })
  }
}
