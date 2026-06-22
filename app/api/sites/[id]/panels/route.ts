/**
 * /api/sites/[id]/panels — control-panel (controller) registry for a site.
 * GET  → list panels (any user scoped to the site).
 * POST → add / program a panel (corporate). { model, serial, door_count, doors[] }
 * PUT  → actions:
 *    'request_replace' { panel_id, new_serial }  — dealer/field tech (doors cap);
 *        sets status=replace_pending + pending_serial. No Brivo access needed.
 *    'confirm_swap'    { panel_id }               — corporate; applies pending_serial.
 *    'update'          { panel_id, ...fields }    — corporate edits.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { resolveOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function siteInScope(siteId: string): Promise<boolean> {
  const user = await getCurrentUser()
  const scope = await resolveOrgScope(user)
  if (scope.all) return true
  const { data } = await supabase.from('sites').select('master_dealer_id, install_dealer_id, service_dealer_id, org_id').eq('id', siteId).maybeSingle()
  if (!data) return false
  return [data.master_dealer_id, data.install_dealer_id, data.service_dealer_id, data.org_id].some(o => o && scope.ids.includes(o))
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await siteInScope(params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data } = await supabase.from('site_panels').select('*').eq('site_id', params.id).order('created_at')
  return NextResponse.json({ panels: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Only Gate Guard corporate programs controllers.' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const doors = Array.isArray(b.doors) ? b.doors.map((d: unknown) => typeof d === 'string' ? { name: d } : d) : []
  const { error } = await supabase.from('site_panels').insert({
    site_id: params.id, model: b.model ?? null, serial: b.serial ?? null,
    door_count: b.door_count ?? doors.length ?? null, doors,
    status: b.serial ? 'programmed' : 'requested', source: 'manual',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  const b = await req.json().catch(() => ({}))
  const panelId = String(b.panel_id ?? '')
  if (!panelId) return NextResponse.json({ error: 'panel_id required' }, { status: 400 })

  // Replacement: a field tech / dealer scans the new serial. No Brivo access.
  if (b.action === 'request_replace') {
    if (!(await canOperate(user, params.id, 'doors'))) return NextResponse.json({ error: 'You don’t have door access for this site.' }, { status: 403 })
    const newSerial = String(b.new_serial ?? '').trim()
    if (!newSerial) return NextResponse.json({ error: 'new_serial required' }, { status: 400 })
    const { error } = await supabase.from('site_panels').update({ pending_serial: newSerial, status: 'replace_pending', updated_at: new Date().toISOString() }).eq('id', panelId).eq('site_id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Log so corporate's queue + the timeline shows it. (Live site_events shape:
    // event_source / summary / metadata — no title/description columns.)
    try {
      await supabase.from('site_events').insert({ site_id: params.id, event_type: 'panel_replace_requested', event_source: 'nexus', summary: `${user.name} scanned new controller serial ${newSerial} — awaiting corporate swap in Brivo`, severity: 'info', metadata: { panel_id: panelId, new_serial: newSerial, by_name: user.name } as Record<string, unknown> })
    } catch { /* non-fatal */ }
    return NextResponse.json({ ok: true })
  }

  // Dealer edits the auto-filled door list (names only — never serial/model/Brivo).
  if (b.action === 'set_doors') {
    if (!(await canOperate(user, params.id, 'doors'))) return NextResponse.json({ error: 'You don’t have door access for this site.' }, { status: 403 })
    const names: string[] = Array.isArray(b.doors) ? b.doors.map((d: unknown) => typeof d === 'string' ? d : (d as { name?: string })?.name).map((s: string) => String(s ?? '').trim()).filter(Boolean) : []
    const doors = names.map(name => ({ name }))
    const { error } = await supabase.from('site_panels').update({ doors, door_count: doors.length || null, updated_at: new Date().toISOString() }).eq('id', panelId).eq('site_id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Dealer confirms the door list is correct → corporate can program it.
  if (b.action === 'confirm_doors') {
    if (!(await canOperate(user, params.id, 'doors'))) return NextResponse.json({ error: 'You don’t have door access for this site.' }, { status: 403 })
    const { error } = await supabase.from('site_panels').update({ dealer_confirmed: true, dealer_confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', panelId).eq('site_id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    try {
      await supabase.from('site_events').insert({ site_id: params.id, event_type: 'provisioning_doors_confirmed', event_source: 'nexus', summary: `${user.name} confirmed the door list — ready for corporate to program the controller`, severity: 'info', metadata: { panel_id: panelId, by_name: user.name } as Record<string, unknown> })
    } catch { /* non-fatal */ }
    return NextResponse.json({ ok: true })
  }

  // Everything else is corporate (programming / swapping in Brivo).
  if (!user.isCorporate) return NextResponse.json({ error: 'Only Gate Guard corporate can do this.' }, { status: 403 })

  if (b.action === 'confirm_swap') {
    const { data: panel } = await supabase.from('site_panels').select('pending_serial').eq('id', panelId).maybeSingle()
    const pend = (panel as { pending_serial?: string } | null)?.pending_serial
    if (!pend) return NextResponse.json({ error: 'No pending serial to swap.' }, { status: 400 })
    const { error } = await supabase.from('site_panels').update({ serial: pend, pending_serial: null, status: 'live', updated_at: new Date().toISOString() }).eq('id', panelId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (b.action === 'update') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = { updated_at: new Date().toISOString() }
    if (b.serial != null) { patch.serial = b.serial; patch.status = 'live' }
    if (b.model != null) patch.model = b.model
    if (Array.isArray(b.doors)) patch.doors = b.doors.map((d: unknown) => typeof d === 'string' ? { name: d } : d)
    if (b.status != null) patch.status = b.status
    const { error } = await supabase.from('site_panels').update(patch).eq('id', panelId).eq('site_id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
