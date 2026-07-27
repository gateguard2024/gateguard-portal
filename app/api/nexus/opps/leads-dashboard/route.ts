import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type Bucket = 'identified' | 'contacted' | 'sentInfo'
function bucketOf(stage: string | null | undefined): Bucket {
  const s = String(stage ?? '').toLowerCase()
  if (/proposal|propose|sent|negoti/.test(s)) return 'sentInfo'
  if (/contact|qualif/.test(s)) return 'contacted'
  return 'identified'
}
type FType = 'call' | 'email' | 'visit' | 'task'
function typeOf(title: string | null | undefined): FType {
  const t = String(title ?? '').toLowerCase()
  if (/\bcall\b|phone|dial/.test(t)) return 'call'
  if (/email|send info|\binfo\b|proposal|e-mail/.test(t)) return 'email'
  if (/visit|site|walk|tour/.test(t)) return 'visit'
  return 'task'
}

// GET /api/nexus/opps/leads-dashboard — the Leads Hub cockpit data.
export async function GET() {
  try {
    const user = await getCurrentUser()
    const scope = await resolveOrgScope(user)

    // Open leads (not converted, not lost, not deleted)
    let openQ = supabase
      .from('leads')
      .select('id, company_name, contact_name, property_name, location, stage, unit_count, lead_type, entry_points, cameras, mrr, pcr, visited_at, created_at')
      .is('deleted_at', null)
      .is('lost_at', null)
      .is('opportunity_id', null)
    openQ = applyOrgScope(openQ, scope)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: openRows, error: openErr } = await (openQ as any).order('updated_at', { ascending: false })
    if (openErr) return NextResponse.json({ error: openErr.message }, { status: 500 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const open: any[] = Array.isArray(openRows) ? openRows : []

    // Converted count → conversion %
    let convQ = supabase.from('leads').select('id', { count: 'exact', head: true }).is('deleted_at', null).not('opportunity_id', 'is', null)
    convQ = applyOrgScope(convQ, scope)
    const { count: convertedCount } = await convQ
    const converted = convertedCount ?? 0

    const now = Date.now()
    const DAYS14 = 14 * 86400000
    const breakdown: Record<Bucket, number> = { identified: 0, contacted: 0, sentInfo: 0 }
    for (const l of open) breakdown[bucketOf(l.stage)] += 1

    const kpis = {
      newLeadIds: open.filter(l => l.created_at && (now - new Date(l.created_at).getTime()) <= DAYS14).length,
      leadsVisited: open.filter(l => l.visited_at).length,
      leadsCount: open.length,
      conversionPct: (converted + open.length) > 0 ? Math.round((converted / (converted + open.length)) * 100) : 0,
    }

    const analysis = open.map(l => ({
      id: l.id,
      name: l.company_name || l.property_name || l.contact_name || 'Unnamed lead',
      lead_type: l.lead_type ?? null,
      units: l.unit_count ?? null,
      entry_points: l.entry_points ?? null,
      cameras: l.cameras ?? null,
      mrr: l.mrr ?? null,
      pcr: l.pcr ?? null,
    }))

    // Lead-linked follow-ups (my todos), typed by title
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayIso = today.toISOString().slice(0, 10)
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7)
    const weekIso = weekEnd.toISOString().slice(0, 10)

    // (a) Lead-linked to-dos (these also appear on the calendar)
    let fuQ = supabase.from('todos').select('id, title, due_date, linked_label, status').eq('linked_type', 'lead').neq('status', 'done').not('due_date', 'is', null).lte('due_date', weekIso)
    if (!scope.all) fuQ = fuQ.or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fuRows } = await (fuQ as any).order('due_date', { ascending: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const todoFus = (Array.isArray(fuRows) ? fuRows : []).map((t: any) => ({ id: String(t.id), type: typeOf(t.title), title: t.title ?? 'Follow-up', lead: (t.linked_label as string) ?? null, due: (t.due_date as string) ?? null }))

    // (b) CRM activities with a due date on a lead — calls / tasks / meetings (also on the calendar)
    const { data: prof } = await supabase.from('profiles').select('id').eq('clerk_user_id', user.id).maybeSingle()
    const profileId = (prof as { id?: string } | null)?.id ?? null
    let actQ = supabase.from('crm_activities').select('id, type, subject, due_at, lead_id').not('lead_id', 'is', null).is('completed_at', null).not('due_at', 'is', null).lte('due_at', weekEnd.toISOString())
    if (!scope.all && profileId) actQ = actQ.eq('created_by', profileId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: actRows } = await (actQ as any).order('due_at', { ascending: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const acts: any[] = Array.isArray(actRows) ? actRows : []
    const leadIds = Array.from(new Set(acts.map(a => a.lead_id).filter(Boolean)))
    const nameMap: Record<string, string | null> = {}
    if (leadIds.length) {
      const { data: lns } = await supabase.from('leads').select('id, company_name, contact_name, property_name').in('id', leadIds)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const l of (lns ?? []) as any[]) nameMap[l.id] = l.company_name || l.property_name || l.contact_name || null
    }
    const ACT_TYPE: Record<string, FType> = { call: 'call', email: 'email', meeting: 'visit', task: 'task', note: 'task' }
    const actFus = acts.map(a => ({ id: `act-${a.id}`, type: ACT_TYPE[String(a.type)] ?? 'task', title: (a.subject as string) ?? 'Follow-up', lead: nameMap[a.lead_id] ?? null, due: a.due_at ? String(a.due_at).slice(0, 10) : null }))

    const allFus = [...todoFus, ...actFus].filter(f => f.due).sort((a, b) => String(a.due).localeCompare(String(b.due)))
    const followupsToday = allFus.filter(f => (f.due as string) <= todayIso)
    const followupsWeek = allFus.filter(f => (f.due as string) > todayIso)

    return NextResponse.json({ success: true, kpis, breakdown, analysis, followupsToday, followupsWeek })
  } catch (e) {
    return NextResponse.json({ success: false, message: e instanceof Error ? e.message : 'Could not load the leads dashboard.' }, { status: 500 })
  }
}
