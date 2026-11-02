/**
 * /api/maintenance/[id]/removal — the equipment list on a Removal job (taking a property offline).
 * The tech marks where each device went. Anyone who can work the job (guardWorkOrder) can use it;
 * only works on jobs whose type is 'Removal', and only for devices at that job's property.
 *
 *   GET                         { installed, removed }
 *   POST { asset_id, to }       to = 'stock' | 'disposed' | 'left_on_site' | null (undo)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardWorkOrder } from '@/lib/ops-scope'
import { getCurrentUser } from '@/lib/current-user'
import { isRemovedTo, recordRemoval } from '@/lib/decommission'

export const dynamic = 'force-dynamic'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function removalJob(req: NextRequest, id: string) {
  if (!(await guardWorkOrder(req, id))) return { error: 'Not found', status: 404 }
  const { data, error } = await sb.from('work_orders').select('id, site_id, job_type').eq('id', id).maybeSingle()
  if (error) return { error: error.message, status: 500 }
  if (!data) return { error: 'Not found', status: 404 }
  if (String(data.job_type ?? '').toLowerCase() !== 'removal' || !data.site_id) return { error: 'This isn’t an equipment-removal job.', status: 400 }
  return { job: data as { id: string; site_id: string } }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const j = await removalJob(req, params.id)
  if (!j.job) return NextResponse.json({ error: j.error }, { status: j.status })
  const { data, error } = await sb.from('site_assets').select('id, product_name, product_category, serial_number, location_note, status, removed_to, removed_by, removed_at').eq('site_id', j.job.site_id).order('product_name')
  if (error) return NextResponse.json({ error: /removed_/.test(error.message) ? 'This needs migration 213.' : error.message }, { status: 500 })
  const list = data ?? []
  return NextResponse.json({ installed: list.filter(a => a.status !== 'removed'), removed: list.filter(a => a.status === 'removed') })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const j = await removalJob(req, params.id)
  if (!j.job) return NextResponse.json({ error: j.error }, { status: j.status })
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const assetId = String(body.asset_id ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) return NextResponse.json({ error: 'Pick a device.' }, { status: 400 })
  if (body.to !== null && !isRemovedTo(body.to)) return NextResponse.json({ error: 'Pick where it went.' }, { status: 400 })
  const user = await getCurrentUser()
  const who = { name: user.id && user.id !== 'anonymous' ? user.name : 'Technician' }
  const r = await recordRemoval(j.job.site_id, assetId, (body.to as never) ?? null, who, { woId: j.job.id })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
