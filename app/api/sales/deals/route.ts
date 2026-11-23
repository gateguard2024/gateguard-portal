/**
 * GET /api/sales/deals — every deal the caller may see, shaped for the Sales board.
 * One call feeds all three tabs (Open / Won / Lost): each deal carries `tab`.
 * Open deals also carry their next planned step and overdue-step count.
 * Visibility rules live in lib/sales-deals.ts.
 */
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { dealCtx, nextSteps, orgNames, ownerFor, profileNames, scopeDeals, sb, shapeDeal, type Row } from '@/lib/sales-deals'

export const dynamic = 'force-dynamic'

function chunks<T>(a: T[], n = 150): T[][] { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o }

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user.id || user.id === 'anonymous') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const ctx = await dealCtx(user)

    const q = scopeDeals(sb.from('opportunities').select('*').is('deleted_at', null), ctx)
    const { data, error } = await q.order('created_at', { ascending: false }).limit(2000)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const rows = (data ?? []) as Row[]
    const ids = rows.map(r => r.id as string)

    // Open next steps (earliest first — dated activities + open tasks) + won deals that already have a job.
    const jobs = new Set<string>()
    const [steps, ...woParts] = await Promise.all([nextSteps(ids), ...chunks(ids).map(part => sb.from('work_orders').select('opportunity_id').in('opportunity_id', part))])
    if (steps.error) return NextResponse.json({ error: steps.error }, { status: 500 })
    for (const w of woParts) if (!w.error) for (const r of (w.data ?? []) as Row[]) if (r.opportunity_id) jobs.add(r.opportunity_id)
    const nextBy = steps.next
    const overdueBy = steps.overdue

    const repIds = [...new Set(rows.map(r => r.rep_id as string).filter(Boolean))]
    const [names, reps] = await Promise.all([
      profileNames(repIds),
      repIds.length ? sb.from('profiles').select('id, org_id').in('id', repIds) : Promise.resolve({ data: [] as Row[] }),
    ])
    const repOrg: Record<string, string | null> = Object.fromEntries(((reps.data ?? []) as Row[]).map(p => [p.id, p.org_id ?? null]))
    const orgs = await orgNames([...rows.map(r => r.dealer_org_id as string), ...Object.values(repOrg).filter(Boolean) as string[]])
    // Company = the deal's dealer; if the deal has none, the rep's company (e.g. Gate Guard's own deals).
    const deals = rows.map(r => {
      const co = (r.dealer_org_id as string | null) ?? (r.rep_id ? repOrg[r.rep_id as string] ?? null : null)
      const d = shapeDeal(r, ctx, {
        next: nextBy[r.id] ?? null, overdue: overdueBy[r.id] ?? 0,
        ownerName: ownerFor(r, names), hasJob: jobs.has(r.id),
        dealerName: co ? orgs[co] ?? null : null,
      })
      return { ...d, dealer_id: co }
    })
    // Reps grouped under their company (for the Team filter: company → rep).
    const owners = Object.entries(names).map(([id, name]) => ({ id, name, company_id: repOrg[id] ?? null, company: repOrg[id] ? orgs[repOrg[id] as string] ?? null : null }))
      .sort((a, b) => (a.company ?? '~').localeCompare(b.company ?? '~') || a.name.localeCompare(b.name))
    const companies = [...new Map(deals.filter(d => d.dealer_id).map(d => [d.dealer_id as string, d.dealer_name ?? 'Unnamed company'])).entries()]
      .map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({
      deals, owners, companies, me: ctx.profileId,
      canSeeTeam: !ctx.repOnly, canViewFinancials: user.canViewFinancials,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load deals' }, { status: 500 })
  }
}
