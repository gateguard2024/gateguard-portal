import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const dynamic = 'force-dynamic'

const FIELDS = [
  'name', 'camera_id', 'camera_name', 'power_device_id', 'power_channel', 'power_relay_name',
  'wait_seconds', 'actuation_type', 'actuation_door_id', 'actuation_door_name',
  'actuation_device_id', 'actuation_channel', 'actuation_pulse_seconds', 'actuation_relay_name',
]

// PATCH — edit a reboot recipe (corporate-only).
export async function PATCH(req: NextRequest, { params }: { params: { id: string; rebootId: string } }) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Corporate only.' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const f of FIELDS) if (f in b) update[f] = b[f]

  const { data, error } = await supabase
    .from('gate_reboots')
    .update(update)
    .eq('id', params.rebootId)
    .eq('site_id', params.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reboot: data })
}

// DELETE — remove a reboot recipe (corporate-only).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string; rebootId: string } }) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Corporate only.' }, { status: 403 })

  const { error } = await supabase.from('gate_reboots').delete().eq('id', params.rebootId).eq('site_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
