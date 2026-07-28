import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const dynamic = 'force-dynamic'

// GET — list a site's gate-reboot recipes (operators who can run relays, or corporate).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  const siteId = params.id
  if (!user.isCorporate && !(await canOperate(user, siteId, 'relays'))) {
    return NextResponse.json({ error: 'No relay access for this site.' }, { status: 403 })
  }
  const { data, error } = await supabase
    .from('gate_reboots')
    .select('*')
    .eq('site_id', siteId)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reboots: data ?? [] })
}

// POST — create a reboot recipe (corporate-only setup).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Corporate only.' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  if (!b.name || !b.power_device_id) {
    return NextResponse.json({ error: 'name and power_device_id are required' }, { status: 400 })
  }
  const row = {
    site_id: params.id,
    name: String(b.name),
    camera_id: b.camera_id ?? null,
    camera_name: b.camera_name ?? null,
    power_device_id: String(b.power_device_id),
    power_channel: Number.isFinite(b.power_channel) ? Number(b.power_channel) : 0,
    power_relay_name: b.power_relay_name ?? null,
    wait_seconds: Number.isFinite(b.wait_seconds) ? Number(b.wait_seconds) : 30,
    actuation_type: ['brivo', 'shelly', 'none'].includes(b.actuation_type) ? b.actuation_type : 'brivo',
    actuation_door_id: b.actuation_door_id ?? null,
    actuation_door_name: b.actuation_door_name ?? null,
    actuation_device_id: b.actuation_device_id ?? null,
    actuation_channel: Number.isFinite(b.actuation_channel) ? Number(b.actuation_channel) : null,
    actuation_pulse_seconds: Number.isFinite(b.actuation_pulse_seconds) ? Number(b.actuation_pulse_seconds) : 1,
    actuation_relay_name: b.actuation_relay_name ?? null,
    created_by: user.id,
  }
  const { data, error } = await supabase.from('gate_reboots').insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reboot: data }, { status: 201 })
}
