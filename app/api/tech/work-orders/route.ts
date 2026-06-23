/**
 * GET /api/tech/work-orders — work orders assigned to the signed-in tech.
 *
 * Auth: x-tech-code header (global TECH_ACCESS_CODE or a per-tech code).
 * Tech resolution:
 *   - per-tech code → that technician
 *   - global code   → pass ?tech_id=<id> (the /tech identity picker supplies it)
 *
 * Returns each WO enriched with site name/address + checklist progress so the
 * tech sees the full job on their mobile instance.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isTechAuthed } from '@/lib/tech-auth'

function serviceDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!(await isTechAuthed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceDb()
  const code = req.headers.get('x-tech-code') ?? ''
  const qpTechId = new URL(req.url).searchParams.get('tech_id')

  // Resolve which technician this is (id + name; name is a fallback match).
  // A PER-TECH code is authoritative — it wins over any tech_id the client passes,
  // which may be stale (left by a previous tech on a shared device). Only fall back
  // to ?tech_id= for the shared global code (which maps to no specific technician).
  let techId: string | null = null
  let techName: string | null = null
  if (code) {
    const { data: t } = await db.from('technicians').select('id, name').eq('tech_code', code).maybeSingle()
    techId = (t as { id?: string } | null)?.id ?? null
    techName = (t as { name?: string } | null)?.name ?? null
  }
  if (!techId && qpTechId) {
    techId = qpTechId
    const { data: t } = await db.from('technicians').select('name').eq('id', techId).maybeSingle()
    techName = (t as { name?: string } | null)?.name ?? null
  }
  if (!techId) return NextResponse.json({ work_orders: [], note: 'No tech_id — pass ?tech_id= or use a per-tech code' })

  // WOs assigned to this tech. Run two SIMPLE queries and merge — avoids putting a
  // name (which can contain spaces) inside the same .or() as the ids, which broke
  // PostgREST's filter parsing and returned nothing.
  const SEL = 'id, wo_number, title, description, status, priority, scheduled_date, scheduled_time, site_id, customer_name, assignee_id, assignee_name, assigned_to'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const merged: Record<string, any> = {}
  let queryErr: string | null = null

  const byId = await db.from('work_orders').select(SEL).or(`assignee_id.eq.${techId},assigned_to.eq.${techId}`).order('scheduled_date', { ascending: true })
  if (byId.error) queryErr = byId.error.message
  for (const w of byId.data ?? []) merged[w.id] = w

  if (techName) {
    const byName = await db.from('work_orders').select(SEL).ilike('assignee_name', techName).order('scheduled_date', { ascending: true })
    if (!byName.error) for (const w of byName.data ?? []) merged[w.id] = w
  }

  const list = Object.values(merged)
  if (queryErr && list.length === 0) return NextResponse.json({ error: queryErr }, { status: 500 })

  // ?debug=1 → see exactly who we resolved + what matched, to diagnose "no jobs".
  if (new URL(req.url).searchParams.get('debug') === '1') {
    return NextResponse.json({ resolved_tech_id: techId, resolved_tech_name: techName, matched_count: list.length, by_id_count: (byId.data ?? []).length, sample: list.slice(0, 5).map(w => ({ wo: w.wo_number, assignee_id: w.assignee_id, assignee_name: w.assignee_name, status: w.status })) })
  }
  const siteIds = [...new Set(list.map(w => w.site_id).filter(Boolean))] as string[]
  const woIds = list.map(w => w.id)

  // Site enrichment
  const siteMap: Record<string, Record<string, unknown>> = {}
  if (siteIds.length) {
    const { data: sites } = await db.from('sites').select('id, name, address, city, state, access_notes, primary_contact_name, primary_contact_phone').in('id', siteIds)
    for (const s of sites ?? []) siteMap[s.id] = s
  }
  // Checklist progress
  const progress: Record<string, { total: number; done: number }> = {}
  if (woIds.length) {
    const { data: items } = await db.from('wo_checklist_items').select('work_order_id, is_complete').in('work_order_id', woIds)
    for (const it of items ?? []) {
      const p = progress[it.work_order_id] ?? { total: 0, done: 0 }
      p.total += 1; if (it.is_complete) p.done += 1; progress[it.work_order_id] = p
    }
  }

  const enriched = list.map(w => {
    const s = w.site_id ? siteMap[w.site_id] : null
    return {
      ...w,
      site_name: s?.name ?? w.customer_name ?? null,
      site_address: s ? [s.address, s.city, s.state].filter(Boolean).join(', ') : null,
      site_access_notes: s?.access_notes ?? null,
      site_contact_name: s?.primary_contact_name ?? null,
      site_contact_phone: s?.primary_contact_phone ?? null,
      checklist_total: progress[w.id]?.total ?? 0,
      checklist_done: progress[w.id]?.done ?? 0,
    }
  })

  return NextResponse.json({ work_orders: enriched, tech_id: techId })
}
