import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope, applyAssignedScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const DAY = 86400_000
type Bucket = 'identified' | 'contacted' | 'sent_info'
function bucketOf(stage: string | null | undefined): Bucket {
  const s = String(stage ?? '').toLowerCase()
  if (/proposal|propose|sent|negoti/.test(s)) return 'sent_info'
  if (/contact|qualif/.test(s)) return 'contacted'
  return 'identified'
}
// Gate Guard's quick sizing: MRR = units × $10 + cameras × $100.
const estMrr = (units: number | null, cams: number | null, mrr: number | null) =>
  mrr != null && mrr > 0 ? mrr : (units != null || cams != null) ? (units ?? 0) * 10 + (cams ?? 0) * 100 : null

// 0–100: how worth working this lead is right now, with the reasons.
function scoreLead(l: {
  units: number | null; cams: number | null; entry: number | null; phone: boolean; email: boolean; contact: boolean
  bucket: Bucket; visited: boolean; lastTouchDays: number | null; mrr: number | null; ageDays: number
}): { score: number; why: string[] } {
  let s = 0
  const why: string[] = []
  const u = l.units ?? 0
  if (u >= 300) { s += 25; why.push(`${u} units`) } else if (u >= 150) { s += 18; why.push(`${u} units`) } else if (u >= 50) { s += 10; why.push(`${u} units`) } else if (u > 0) s += 4
  if ((l.cams ?? 0) > 0 || (l.entry ?? 0) > 0) s += 5
  if (l.phone) s += 10; else why.push('no phone')
  if (l.email) s += 8; else why.push('no email')
  if (l.contact) s += 4
  if (l.bucket === 'sent_info') { s += 20; why.push('info sent') } else if (l.bucket === 'contacted') { s += 10; why.push('talking') }
  if (l.visited) { s += 10; why.push('site visited') }
  if ((l.mrr ?? 0) >= 3000) { s += 10; why.push(`~$${Math.round((l.mrr ?? 0) / 100) / 10}k/mo`) } else if ((l.mrr ?? 0) >= 1000) s += 5
  if (l.lastTouchDays == null) { if (l.ageDays > 7) { s -= 8; why.push('never touched') } }
  else if (l.lastTouchDays <= 3) { s += 12; why.push('touched this week') }
  else if (l.lastTouchDays <= 7) s += 8
  else if (l.lastTouchDays <= 14) s += 3
  else { s -= 10; why.push(`quiet ${l.lastTouchDays} days`) }
  return { score: Math.max(0, Math.min(100, s)), why: why.slice(0, 4) }
}

// GET /api/nexus/leads → every open lead you can see, already scored, with its next
// step, last touch and est. MRR, plus the counts for each view and the top numbers.
// The screen filters / sorts on the client (it's at most a few thousand rows).
export async function GET() {
  const user = await getCurrentUser()
  if (!user.canViewCRM) return NextResponse.json({ error: 'CRM access denied.' }, { status: 403 })
  const scope = await resolveOrgScope(user)

  let q = supabase.from('leads').select('*').is('deleted_at', null).is('lost_at', null).is('opportunity_id', null)
  q = applyOrgScope(q, scope)
  q = applyAssignedScope(q, user.role, { clerkUserId: user.id, profileId: null }, 'leads')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await (q as any).order('updated_at', { ascending: false }).limit(3000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leads = (rows ?? []) as any[]
  const ids = leads.map((l) => l.id)
  const now = Date.now()
  const todayIso = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })).toISOString().slice(0, 10)

  // Next step (earliest open follow-up) + last touch (newest activity) per lead.
  const nextStep = new Map<string, { title: string; due: string; kind: string }>()
  const lastTouch = new Map<string, string>()
  const touches = new Map<string, number>()
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300)
    const [acts, todos] = await Promise.all([
      supabase.from('crm_activities').select('lead_id, type, subject, due_at, completed_at, created_at').in('lead_id', chunk).order('created_at', { ascending: false }).limit(4000),
      supabase.from('todos').select('linked_id, title, due_date, status').eq('linked_type', 'lead').in('linked_id', chunk).neq('status', 'done').limit(4000),
    ])
    for (const a of acts.data ?? []) {
      const at = a.completed_at ?? a.created_at
      if (at && !(a.due_at && !a.completed_at)) {
        if (!lastTouch.has(a.lead_id) || lastTouch.get(a.lead_id)! < at) lastTouch.set(a.lead_id, at)
        touches.set(a.lead_id, (touches.get(a.lead_id) ?? 0) + 1)
      }
      if (a.due_at && !a.completed_at) {
        const due = String(a.due_at).slice(0, 10)
        const cur = nextStep.get(a.lead_id)
        if (!cur || due < cur.due) nextStep.set(a.lead_id, { title: a.subject ?? 'Follow up', due, kind: a.type ?? 'task' })
      }
    }
    for (const t of todos.data ?? []) {
      if (!t.due_date) continue
      const cur = nextStep.get(t.linked_id)
      if (!cur || t.due_date < cur.due) nextStep.set(t.linked_id, { title: t.title ?? 'Follow up', due: t.due_date, kind: /call|phone/i.test(t.title ?? '') ? 'call' : /email|send/i.test(t.title ?? '') ? 'email' : /visit|walk|tour/i.test(t.title ?? '') ? 'meeting' : 'task' })
    }
  }

  const out = leads.map((l) => {
    const units = l.unit_count ?? null
    const cams = l.cameras ?? null
    const bucket = bucketOf(l.stage)
    const stamps = [lastTouch.get(l.id), l.contacted_at, l.sent_info_at, l.visited_at].filter(Boolean) as string[]
    const last = stamps.sort().pop() ?? null
    const lastTouchDays = last ? Math.floor((now - Date.parse(last)) / DAY) : null
    const ageDays = Math.floor((now - Date.parse(l.created_at ?? new Date().toISOString())) / DAY)
    const mrr = estMrr(units, cams, l.mrr ?? null)
    const { score, why } = scoreLead({
      units, cams, entry: l.entry_points ?? null, phone: !!l.phone, email: !!l.email, contact: !!l.contact_name,
      bucket, visited: !!l.visited_at, lastTouchDays, mrr, ageDays,
    })
    const ns = nextStep.get(l.id) ?? null
    return {
      id: l.id,
      name: l.property_name || l.company_name || l.contact_name || 'Unnamed lead',
      company: l.company_name ?? null,
      property: l.property_name ?? null,
      contact: l.contact_name ?? null,
      title: l.contact_title ?? null,
      email: l.email ?? null,
      phone: l.phone ?? null,
      location: l.location || [l.city, l.state].filter(Boolean).join(', ') || null,
      stage: l.stage ?? null,
      bucket,
      source: l.source ?? null,
      lead_type: l.lead_type ?? null,
      units, cameras: cams, entry_points: l.entry_points ?? null,
      mrr,
      owner_id: l.assigned_to_user_id ?? null,
      owner: l.assigned_to_name ?? null,
      created_at: l.created_at,
      last_touch: last,
      touches: touches.get(l.id) ?? 0,
      next_step: ns,
      overdue: !!ns && ns.due < todayIso,
      score, why,
      researched: !!l.property_intel,
    }
  })

  const mine = (l: { owner_id: string | null }) => l.owner_id === user.id
  const counts = {
    all: out.length,
    mine: out.filter(mine).length,
    new: out.filter((l) => now - Date.parse(l.created_at) <= 14 * DAY).length,
    hot: out.filter((l) => l.score >= 70).length,
    no_next: out.filter((l) => !l.next_step).length,
    overdue: out.filter((l) => l.overdue).length,
    identified: out.filter((l) => l.bucket === 'identified').length,
    contacted: out.filter((l) => l.bucket === 'contacted').length,
    sent_info: out.filter((l) => l.bucket === 'sent_info').length,
    stale: out.filter((l) => (l.last_touch ? now - Date.parse(l.last_touch) > 14 * DAY : now - Date.parse(l.created_at) > 14 * DAY)).length,
  }

  // Speed to lead: median hours from created → first contact, leads from the last 60 days.
  const recent = leads.filter((l) => l.contacted_at && now - Date.parse(l.created_at) <= 60 * DAY)
    .map((l) => Math.max(0, (Date.parse(l.contacted_at) - Date.parse(l.created_at)) / 3600_000)).sort((a, b) => a - b)
  const median = recent.length ? recent[Math.floor(recent.length / 2)] : null

  // Conversion: converted ÷ (converted + open), last 90 days.
  let convQ = supabase.from('leads').select('id', { count: 'exact', head: true }).is('deleted_at', null).not('opportunity_id', 'is', null)
    .gte('created_at', new Date(now - 90 * DAY).toISOString())
  convQ = applyOrgScope(convQ, scope)
  convQ = applyAssignedScope(convQ, user.role, { clerkUserId: user.id, profileId: null }, 'leads')
  const { count: converted } = await convQ
  const open90 = out.filter((l) => now - Date.parse(l.created_at) <= 90 * DAY).length
  const conv = (converted ?? 0) + open90 > 0 ? Math.round(((converted ?? 0) / ((converted ?? 0) + open90)) * 100) : 0

  const kpis = {
    open: out.length,
    new_week: out.filter((l) => now - Date.parse(l.created_at) <= 7 * DAY).length,
    speed_hours: median == null ? null : Math.round(median * 10) / 10,
    due_today: out.filter((l) => l.next_step && l.next_step.due <= todayIso).length,
    pipeline_mrr: out.reduce((a, l) => a + (l.mrr ?? 0), 0),
    conversion_pct: conv,
    converted_90: converted ?? 0,
  }
  return NextResponse.json({ leads: out, counts, kpis, me: user.id, can_reassign: user.role === 'admin' || user.isCorporate })
}
