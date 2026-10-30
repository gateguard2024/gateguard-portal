/**
 * GET /api/sales/deals — every deal the caller may see, shaped for the Sales board.
 * One call feeds all three tabs (Open / Won / Lost): each deal carries `tab`.
 * Open deals also carry their next planned step and overdue-step count.
 * Visibility rules live in lib/sales-deals.ts.
 */
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { dealCtx, profileNames, scopeDeals, sb, shapeDeal, type Row } from '@/lib/sales-deals'

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

    // Open next steps (earliest first) + won deals that already have a job.
    const acts: Row[] = []
    const jobs = new Set<string>()
    for (const part of chunks(ids)) {
      const [a, w] = await Promise.all([
        sb.from('crm_activities').select('id, opportunity_id, type, subject, due_at').in('opportunity_id', part).is('completed_at', null).not('due_at', 'is', null).order('due_at', { ascending: true }),
        sb.from('work_orders').select('opportunity_id').in('opportunity_id', part),
      ])
      if (a.error) return NextResponse.json({ error: a.error.message }, { status: 500 })
      acts.push(...((a.data ?? []) as Row[]))
      if (!w.error) for (const r of (w.data ?? []) as Row[]) if (r.opportunity_id) jobs.add(r.opportunity_id)
    }
    const now = Date.now()
    const nextBy: Record<string, Row> = {}
    const overdueBy: Record<string, number> = {}
    for (const a of acts) {
      const id = a.opportunity_id as string
      if (!nextBy[id]) nextBy[id] = a
      if (new Date(a.due_at).getTime() < now) overdueBy[id] = (overdueBy[id] ?? 0) + 1
    }

    const names = await profileNames(rows.map(r => r.rep_id as string))
    const deals = rows.map(r => shapeDeal(r, ctx, {
      next: nextBy[r.id] ?? null, overdue: overdueBy[r.id] ?? 0,
      ownerName: (r.rep_id && names[r.rep_id]) || r.owner_name || null, hasJob: jobs.has(r.id),
    }))
    const owners = Object.entries(names).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({
      deals, owners, me: ctx.profileId,
      canSeeTeam: !ctx.repOnly, canViewFinancials: user.canViewFinancials,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load deals' }, { status: 500 })
  }
}
