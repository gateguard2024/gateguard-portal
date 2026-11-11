/**
 * GET /api/todos/search-records?q=text&type=all|lead|opportunity|customer|property|dealer|work_order
 * Powers "Link to…" (Mail) and the linked-record picker on tasks.
 *
 * One relationship, one row: Lead → Deal → Customer (the customer IS the property).
 * With type=all a relationship shows only at its current stage —
 *   • a lead that became a deal is hidden (it lives inside the deal),
 *   • a deal that was won is hidden (it lives on as the customer),
 *   • a property and its customer record show as ONE "Customer" row,
 *   • and a lead/deal with the same name as a customer is treated as history.
 * Every type is limited to the caller's own company (corporate sees all).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

type Result = { id: string; label: string; sublabel?: string; type: string }
const norm = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const WON = /^(won|closed_won)$/i
const LOST = /^(lost|closed_lost|dead)$/i

export async function GET(req: NextRequest) {
  try {
    const caller = await getCurrentUser()
    const { searchParams } = new URL(req.url)
    const raw  = searchParams.get('q')?.trim() ?? ''
    const type = searchParams.get('type') ?? 'all'
    const all  = type === 'all'
    const q    = raw.replace(/[%,()*\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
    if (q.length < 1) return NextResponse.json({ results: [] })
    const like = `%${q}%`
    const scope = await resolveOrgScope(caller)
    const results: Result[] = []

    // ── Customers = properties ───────────────────────────────────────────────
    // Customer records (org_tier client) and properties (sites). A property whose
    // customer record is already listed is the same customer — one row.
    const customerNames = new Set<string>()
    if (type === 'customer' || type === 'property' || all) {
      let cq = supabase.from('organizations').select('id, name, city, state, org_tier').eq('org_tier', 'client').ilike('name', like).limit(8)
      cq = applyOrgScope(cq, scope, 'parent_org_id')
      let sq = supabase.from('sites').select('id, name, city, state, org_id').ilike('name', like).limit(8)
      sq = applyOrgScope(sq, scope, 'site')
      const [{ data: custs }, { data: sites }] = await Promise.all([
        type === 'property' ? Promise.resolve({ data: [] as Record<string, string | null>[] }) : cq,
        type === 'customer' ? Promise.resolve({ data: [] as Record<string, string | null>[] }) : sq,
      ])
      const custIds = new Set<string>()
      for (const c of custs ?? []) {
        custIds.add(String(c.id)); customerNames.add(norm(c.name))
        results.push({ id: String(c.id), type: 'customer', label: String(c.name), sublabel: [c.city, c.state].filter(Boolean).join(', ') || undefined })
      }
      // Properties whose customer record we don't already show (older properties set up
      // before customers existed, or a customer that didn't match the search text).
      const siteOrgIds = [...new Set((sites ?? []).map((s) => s.org_id).filter(Boolean) as string[])].filter((id) => !custIds.has(id))
      const clientOf = new Map<string, string>()
      if (siteOrgIds.length) {
        const { data: owners } = await supabase.from('organizations').select('id, name').eq('org_tier', 'client').in('id', siteOrgIds)
        for (const o of owners ?? []) clientOf.set(String(o.id), String(o.name))
      }
      for (const s of sites ?? []) {
        if (s.org_id && custIds.has(String(s.org_id))) continue
        if (all && customerNames.has(norm(s.name))) continue
        const owner = s.org_id ? clientOf.get(String(s.org_id)) : undefined
        if (all && owner) {
          // Link to the customer record (that's where emails, contacts, billing live).
          customerNames.add(norm(s.name))
          results.push({ id: String(s.org_id), type: 'customer', label: String(s.name), sublabel: [s.city, s.state].filter(Boolean).join(', ') || undefined })
        } else {
          customerNames.add(norm(s.name))
          results.push({ id: String(s.id), type: 'property', label: String(s.name), sublabel: [s.city, s.state].filter(Boolean).join(', ') || undefined })
        }
      }
    }

    // ── Deals ────────────────────────────────────────────────────────────────
    const dealNames = new Set<string>()
    const dealLeadIds = new Set<string>()
    if (type === 'opportunity' || all) {
      let oq = supabase.from('opportunities').select('id, name, account_name, stage, won_at, lost_at, related_org_id, site_id, lead_id, deleted_at')
        .or(`name.ilike.${like},account_name.ilike.${like}`).is('deleted_at', null).order('updated_at', { ascending: false }).limit(12)
      oq = applyOrgScope(oq, scope, 'dealer_org_id')
      const { data } = await oq
      for (const o of data ?? []) {
        if (o.lead_id) dealLeadIds.add(String(o.lead_id))
        const name = String(o.account_name || o.name || 'Unnamed deal').replace(/\s+—\s+GateGuard Opportunity$/i, '')
        const won = !!o.won_at || WON.test(String(o.stage ?? ''))
        if (all) {
          if (won && (o.related_org_id || o.site_id)) continue          // lives on as the customer
          if (o.lost_at || LOST.test(String(o.stage ?? ''))) continue  // closed — not a place to file things
          if (customerNames.has(norm(name))) continue                    // already a customer
        }
        dealNames.add(norm(name))
        results.push({ id: String(o.id), type: 'opportunity', label: name, sublabel: o.stage ?? undefined })
      }
    }

    // ── Leads ────────────────────────────────────────────────────────────────
    if (type === 'lead' || all) {
      const run = (fields: string[]) => {
        let lq = supabase.from('leads').select('*').is('deleted_at', null)
          .or(fields.map((f) => `${f}.ilike.${like}`).join(',')).order('updated_at', { ascending: false }).limit(12)
        lq = applyOrgScope(lq, scope, 'org_id')
        return lq
      }
      let { data, error } = await run(['property_name', 'company_name', 'contact_name'])
      if (error && /property_name/.test(error.message)) ({ data } = await run(['company_name', 'contact_name']))
      for (const l of (data ?? []) as Record<string, string | null>[]) {
        const name = l.property_name || l.company_name || l.contact_name || 'Unnamed lead'
        if (all) {
          if (l.opportunity_id || dealLeadIds.has(String(l.id))) continue          // became a deal
          if (l.lost_at || LOST.test(String(l.stage ?? ''))) continue
          if (dealNames.has(norm(name)) || customerNames.has(norm(name))) continue  // same relationship, later stage
        }
        results.push({ id: String(l.id), type: 'lead', label: name, sublabel: [l.contact_name && l.contact_name !== name ? l.contact_name : null, l.company_name && l.company_name !== name ? l.company_name : null].filter(Boolean).join(' · ') || undefined })
      }
    }

    // ── Dealers (partners, not customers) ────────────────────────────────────
    if (type === 'dealer' || all) {
      let dq = supabase.from('organizations').select('id, name, org_tier').ilike('name', like).in('org_tier', ['master_dealer', 'full_dealer']).limit(5)
      dq = applyOrgScope(dq, scope, 'id')
      const { data } = await dq
      for (const r of data ?? []) results.push({ id: r.id, type: 'dealer', label: r.name, sublabel: r.org_tier === 'master_dealer' ? 'MSO' : 'Dealer' })
    }

    // ── Jobs ─────────────────────────────────────────────────────────────────
    if (type === 'work_order' || all) {
      let woq = supabase
        .from('work_orders')
        .select('id, wo_number, title, status')
        .or(`title.ilike.${like},wo_number.ilike.${like}`)
        .order('created_at', { ascending: false })
        .limit(5)
      // work_orders.created_by is a profiles UUID, not a Clerk ID — so no-org users get no WO results.
      if (!caller.isCorporate) woq = woq.eq('org_id', caller.org_id ?? '00000000-0000-0000-0000-000000000000')
      const { data } = await woq
      ;(data ?? []).forEach(r => results.push({
        id: r.id, type: 'work_order',
        label: [r.wo_number, r.title].filter(Boolean).join(' · ') || 'Work order',
        sublabel: r.status ?? undefined,
      }))
    }

    // Order for "all": customers, then deals, then leads, then the rest — each group capped.
    if (all) {
      const rank: Record<string, number> = { customer: 0, property: 0, opportunity: 1, lead: 2, dealer: 3, work_order: 4 }
      const per: Record<string, number> = {}
      const ordered = results.sort((a, b) => (rank[a.type] ?? 9) - (rank[b.type] ?? 9))
        .filter((r) => { const k = String(rank[r.type] ?? 9); per[k] = (per[k] ?? 0) + 1; return per[k] <= 5 })
      return NextResponse.json({ results: ordered })
    }
    return NextResponse.json({ results })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
