/**
 * GET /api/nexus/admin/rollup — Admin Report Console feed.
 *
 * Rolls up the admin's ENTIRE org subtree (hierarchy) from EXISTING tables:
 *   leads · opportunities · work_orders · profiles · organizations
 * Returns org-wide totals, a per-team-member breakdown, a pipeline funnel,
 * an 8-week leads trend, and a jobs-by-status split. 100% real data, org-scoped.
 *
 * Operations fleet/service data is served separately by
 * /api/nexus/operations/dashboard — the console fetches both in parallel.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'
import { PIPELINE_STAGES, normalizeStage } from '@/lib/pipeline'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const DONE_WO = new Set(['completed', 'cancelled', 'canceled', 'closed', 'done'])
const WEEK = 7 * 864e5

const EMPTY = {
  leads: { total: 0, newThisWeek: 0, trend: [0, 0, 0, 0, 0, 0, 0, 0] },
  opps: { open: 0, openPipeline: 0, wonThisMonth: 0, wonThisMonthValue: 0, funnel: [] as { key: string; label: string; count: number; value: number }[] },
  jobs: { open: 0, completedThisWeek: 0, byStatus: [] as { status: string; count: number }[] },
  team: { members: 0, orgs: 0 },
  people: [] as { name: string; org: string; leads: number; pipeline: number; jobs: number }[],
  canViewFinancials: false,
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user || (!user.canViewCRM && !user.canViewWOs && !user.isCorporate)) {
    return NextResponse.json(EMPTY)
  }
  const scope = await resolveOrgScope(user)
  if (!scope.all && scope.ids.length === 0) return NextResponse.json(EMPTY)
  const canFin = !!user.canViewFinancials

  const inScope = <T>(q: T, col: string): T => (scope.all ? q : (q as any).in(col, scope.ids)) as T

  // ---- Parallel reads ----
  const [leadsRes, oppsRes, wosRes, profRes] = await Promise.all([
    inScope(
      supabase.from('leads')
        .select('id, stage, mrr, assigned_to_user_id, assigned_to_name, created_at, org_id')
        .is('opportunity_id', null).is('lost_at', null).is('deleted_at', null)
        .limit(5000),
      'org_id',
    ),
    inScope(
      supabase.from('opportunities')
        .select('id, stage, amount, rep_id, created_at, won_at, lost_at, dealer_org_id')
        .is('deleted_at', null)
        .limit(5000),
      'dealer_org_id',
    ),
    inScope(
      supabase.from('work_orders')
        .select('id, status, assigned_to, assignee_name, created_at, completed_at, org_id')
        .order('created_at', { ascending: false })
        .limit(5000),
      'org_id',
    ),
    inScope(
      supabase.from('profiles')
        .select('id, clerk_user_id, first_name, last_name, email, org_id')
        .limit(2000),
      'org_id',
    ),
  ])

  const leads = leadsRes.data ?? []
  const opps = oppsRes.data ?? []
  const wos = wosRes.data ?? []
  const profiles = profRes.data ?? []

  // ---- Org name map (for the per-person "org" column) ----
  const orgIds = Array.from(new Set(profiles.map((p) => p.org_id).filter(Boolean))) as string[]
  const orgName = new Map<string, string>()
  if (orgIds.length) {
    const { data: orgs } = await supabase.from('organizations').select('id, name').in('id', orgIds)
    for (const o of orgs ?? []) orgName.set(o.id as string, (o.name as string) ?? 'Org')
  }

  // ---- Identity maps ----
  const profById = new Map<string, { name: string; orgId: string | null }>()
  const clerkToProf = new Map<string, string>()
  for (const p of profiles) {
    const nm = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || (p.email as string) || 'Team member'
    profById.set(p.id as string, { name: nm, orgId: (p.org_id as string) ?? null })
    if (p.clerk_user_id) clerkToProf.set(p.clerk_user_id as string, p.id as string)
  }

  type Person = { name: string; orgId: string | null; leads: number; pipeline: number; jobs: number }
  const people = new Map<string, Person>()
  const ensure = (key: string, name: string, orgId: string | null): Person => {
    let p = people.get(key)
    if (!p) { p = { name, orgId, leads: 0, pipeline: 0, jobs: 0 }; people.set(key, p) }
    return p
  }

  const now = Date.now()
  const monthStart = (() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime() })()

  // ---- Leads: totals, weekly trend, per-person ----
  let leadsNewWeek = 0
  const trend = [0, 0, 0, 0, 0, 0, 0, 0] // index 0 = this week … 7 = 7 weeks ago
  for (const l of leads) {
    const created = l.created_at ? Date.parse(l.created_at as string) : NaN
    if (!Number.isNaN(created)) {
      const wksAgo = Math.floor((now - created) / WEEK)
      if (wksAgo >= 0 && wksAgo < 8) trend[wksAgo]++
      if (now - created < WEEK) leadsNewWeek++
    }
    const pid = l.assigned_to_user_id ? clerkToProf.get(l.assigned_to_user_id as string) : undefined
    if (pid) { const info = profById.get(pid)!; ensure(pid, info.name, info.orgId).leads++ }
    else if (l.assigned_to_name) ensure(`n:${l.assigned_to_name}`, l.assigned_to_name as string, null).leads++
  }

  // ---- Opportunities: open pipeline, won-this-month, funnel, per-person ----
  const funnelMap = new Map<string, { count: number; value: number }>()
  for (const s of PIPELINE_STAGES) funnelMap.set(s.key, { count: 0, value: 0 })
  let oppOpen = 0, openPipeline = 0, wonMonth = 0, wonMonthVal = 0
  for (const o of opps) {
    const stage = normalizeStage(o.stage as string | null)
    const amt = Number(o.amount) || 0
    const isTerminal = stage === 'lost' || stage === 'dead'
    if (stage === 'won') {
      const won = o.won_at ? Date.parse(o.won_at as string) : NaN
      if (!Number.isNaN(won) && won >= monthStart) { wonMonth++; wonMonthVal += amt }
    } else if (!isTerminal) {
      oppOpen++
      openPipeline += amt
      const f = funnelMap.get(stage); if (f) { f.count++; f.value += amt }
      const pid = o.rep_id as string | null
      if (pid && profById.has(pid)) { const info = profById.get(pid)!; ensure(pid, info.name, info.orgId).pipeline += amt }
      else if (pid) ensure(pid, 'Rep', null).pipeline += amt
    }
  }
  const funnel = PIPELINE_STAGES.map((s) => ({ key: s.key, label: s.label, count: funnelMap.get(s.key)!.count, value: funnelMap.get(s.key)!.value }))

  // ---- Work orders: open, completed-this-week, by-status, per-person ----
  let jobsOpen = 0, jobsDoneWeek = 0
  const statusMap = new Map<string, number>()
  for (const w of wos) {
    const st = String(w.status ?? 'open').toLowerCase()
    if (!DONE_WO.has(st)) {
      jobsOpen++
      statusMap.set(st, (statusMap.get(st) ?? 0) + 1)
      const pid = w.assigned_to as string | null
      if (pid && profById.has(pid)) { const info = profById.get(pid)!; ensure(pid, info.name, info.orgId).jobs++ }
      else if (w.assignee_name) ensure(`n:${w.assignee_name}`, w.assignee_name as string, null).jobs++
    }
    const done = w.completed_at ? Date.parse(w.completed_at as string) : NaN
    if (!Number.isNaN(done) && now - done < WEEK) jobsDoneWeek++
  }
  const byStatus = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count)

  const peopleArr = Array.from(people.values())
    .map((p) => ({ name: p.name, org: p.orgId ? (orgName.get(p.orgId) ?? '—') : '—', leads: p.leads, pipeline: canFin ? Math.round(p.pipeline) : 0, jobs: p.jobs }))
    .sort((a, b) => (b.pipeline - a.pipeline) || (b.leads - a.leads) || (b.jobs - a.jobs))
    .slice(0, 40)

  return NextResponse.json({
    leads: { total: leads.length, newThisWeek: leadsNewWeek, trend },
    opps: {
      open: oppOpen,
      openPipeline: canFin ? Math.round(openPipeline) : 0,
      wonThisMonth: wonMonth,
      wonThisMonthValue: canFin ? Math.round(wonMonthVal) : 0,
      funnel: funnel.map((f) => ({ ...f, value: canFin ? Math.round(f.value) : 0 })),
    },
    jobs: { open: jobsOpen, completedThisWeek: jobsDoneWeek, byStatus },
    team: { members: profiles.length, orgs: orgIds.length },
    people: peopleArr,
    canViewFinancials: canFin,
  })
}
