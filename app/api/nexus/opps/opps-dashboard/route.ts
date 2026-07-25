import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'
import { normalizeStage, STAGE_LABELS } from '@/lib/pipeline'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type FType = 'call' | 'email' | 'visit' | 'task'
function typeOf(title: string | null | undefined): FType {
  const t = String(title ?? '').toLowerCase()
  if (/\bcall\b|phone|dial/.test(t)) return 'call'
  if (/email|send info|\binfo\b|proposal|e-mail/.test(t)) return 'email'
  if (/visit|site|walk|tour/.test(t)) return 'visit'
  return 'task'
}

// GET /api/nexus/opps/opps-dashboard — the Opportunity Hub cockpit data.
export async function GET() {
  try {
    const user = await getCurrentUser()
    const scope = await resolveOrgScope(user)

    // Open deals (not won / lost / dead / deleted)
    let openQ = supabase
      .from('opportunities')
      .select('id, name, account_name, stage, units, est_mrr, amount, close_date, next_step')
      .is('deleted_at', null).is('won_at', null).is('lost_at', null)
    openQ = applyOrgScope(openQ, scope, 'dealer_org_id')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: openRows } = await (openQ as any).order('updated_at', { ascending: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const open: any[] = Array.isArray(openRows) ? openRows : []

    // Won (with dates for MTD) + lost counts → win rate
    let wonQ = supabase.from('opportunities').select('id, won_at').is('deleted_at', null).not('won_at', 'is', null)
    wonQ = applyOrgScope(wonQ, scope, 'dealer_org_id')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: wonRows } = await (wonQ as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wonArr: any[] = Array.isArray(wonRows) ? wonRows : []
    let lostQ = supabase.from('opportunities').select('id', { count: 'exact', head: true }).is('deleted_at', null).not('lost_at', 'is', null)
    lostQ = applyOrgScope(lostQ, scope, 'dealer_org_id')
    const { count: lostCount } = await lostQ
    const won = wonArr.length
    const lost = lostCount ?? 0

    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const wonMtd = wonArr.filter(o => o.won_at && new Date(o.won_at) >= monthStart).length

    const breakdown = { survey: 0, propose: 0, negotiate: 0, contract: 0 }
    let openPipeline = 0
    for (const o of open) {
      openPipeline += Number(o.amount || 0)
      const st = normalizeStage(o.stage)
      if (st === 'survey') breakdown.survey += 1
      else if (st === 'propose') breakdown.propose += 1
      else if (st === 'negotiate') breakdown.negotiate += 1
      else if (st === 'contract' || st === 'deposit') breakdown.contract += 1
    }

    const kpis = {
      openPipeline: user.canViewFinancials ? openPipeline : null,
      openDeals: open.length,
      winRate: (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : 0,
      wonMtd,
    }

    const analysis = open.map(o => {
      const mrr = o.est_mrr != null ? Number(o.est_mrr) : null
      return {
        id: o.id,
        name: o.name || o.account_name || 'Untitled deal',
        stage: STAGE_LABELS[normalizeStage(o.stage)] ?? 'Meet & Present',
        units: o.units ?? null,
        mrr,
        emc: mrr != null ? Math.round(mrr * 0.10 * 100) / 100 : null,
        close_date: o.close_date ?? null,
        next_step: o.next_step ?? null,
      }
    })

    // Follow-ups: opportunity-linked to-dos + CRM activities (calls/tasks/meetings)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayIso = today.toISOString().slice(0, 10)
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7)
    const weekIso = weekEnd.toISOString().slice(0, 10)

    let fuQ = supabase.from('todos').select('id, title, due_date, linked_label, status').eq('linked_type', 'opportunity').neq('status', 'done').not('due_date', 'is', null).lte('due_date', weekIso)
    if (!scope.all) fuQ = fuQ.or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fuRows } = await (fuQ as any).order('due_date', { ascending: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const todoFus = (Array.isArray(fuRows) ? fuRows : []).map((t: any) => ({ id: String(t.id), type: typeOf(t.title), title: t.title ?? 'Follow-up', lead: (t.linked_label as string) ?? null, due: (t.due_date as string) ?? null }))

    const { data: prof } = await supabase.from('profiles').select('id').eq('clerk_user_id', user.id).maybeSingle()
    const profileId = (prof as { id?: string } | null)?.id ?? null
    let actQ = supabase.from('crm_activities').select('id, type, subject, due_at, opportunity_id, opportunities(name)').not('opportunity_id', 'is', null).is('completed_at', null).not('due_at', 'is', null).lte('due_at', weekEnd.toISOString())
    if (!scope.all && profileId) actQ = actQ.eq('created_by', profileId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: actRows } = await (actQ as any).order('due_at', { ascending: true })
    const ACT_TYPE: Record<string, FType> = { call: 'call', email: 'email', meeting: 'visit', task: 'task', note: 'task' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actFus = (Array.isArray(actRows) ? actRows : []).map((a: any) => ({ id: `act-${a.id}`, type: ACT_TYPE[String(a.type)] ?? 'task', title: (a.subject as string) ?? 'Follow-up', lead: a.opportunities?.name ?? null, due: a.due_at ? String(a.due_at).slice(0, 10) : null }))

    const allFus = [...todoFus, ...actFus].filter(f => f.due).sort((a, b) => String(a.due).localeCompare(String(b.due)))
    const followupsToday = allFus.filter(f => (f.due as string) <= todayIso)
    const followupsWeek = allFus.filter(f => (f.due as string) > todayIso)

    return NextResponse.json({ success: true, kpis, breakdown, analysis, followupsToday, followupsWeek })
  } catch (e) {
    return NextResponse.json({ success: false, message: e instanceof Error ? e.message : 'Could not load the opportunity dashboard.' }, { status: 500 })
  }
}
