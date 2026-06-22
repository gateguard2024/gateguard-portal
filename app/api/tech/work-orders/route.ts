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
  let techId = qpTechId
  let techName: string | null = null
  if (techId) {
    const { data: t } = await db.from('technicians').select('name').eq('id', techId).maybeSingle()
    techName = (t as { name?: string } | null)?.name ?? null
  } else if (code) {
    const { data: t } = await db.from('technicians').select('id, name').eq('tech_code', code).maybeSingle()
    techId = (t as { id?: string } | null)?.id ?? null
    techName = (t as { name?: string } | null)?.name ?? null
  }
  if (!techId) return NextResponse.json({ work_orders: [], note: 'No tech_id — pass ?tech_id= or use a per-tech code' })

  // WOs assigned to this tech. Match by assignee_id / assigned_to, and also by
  // assignee_name as a safety net (covers legacy/duplicate technician records where
  // the assigned id differs from the one the tech signs in as). open/scheduled first.
  const orParts = [`assignee_id.eq.${techId}`, `assigned_to.eq.${techId}`]
  if (techName) {
    const safeName = techName.replace(/[,()*\\]/g, ' ').trim()
    if (safeName) orParts.push(`assignee_name.ilike.${safeName}`)
  }
  const { data: wos, error } = await db
    .from('work_orders')
    .select('id, wo_number, title, description, status, priority, scheduled_date, scheduled_time, site_id, customer_name, assignee_id, assigned_to')
    .or(orParts.join(','))
    .order('scheduled_date', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const list = wos ?? []
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
