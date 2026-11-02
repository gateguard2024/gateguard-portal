/**
 * Lexi — nightly "Close out today, plan tomorrow" (opt-in).
 *
 *   buildEveningReview(u)   everything for the review screen:
 *                             • how today went (last night's top 3, finished, left over)
 *                             • tomorrow by area: Sales, Operations, Customers, Dealers, Admin, Money
 *                             • tomorrow's calendar
 *                             • a "bring tomorrow" list (parts on tomorrow's jobs, papers for
 *                               tomorrow's meetings, the person's own "always bring" list)
 *                             • Lexi's suggested top 3 for tomorrow
 *   sendEveningNudge(u)     the text (and optional email) that links to the review.
 *   settings                user_settings columns from migration 211.
 *
 * Every read is scoped to what the person may see (company scope, Sales rules,
 * their own mailbox/calendar) — same rules as Lexi's read tools. Money from
 * QuickBooks is Gate Guard corporate only. Task changes happen through the
 * normal /api/todos routes (their own permission checks), not here.
 */
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { PortalUser } from '@/lib/current-user'
import { applyOrgScope } from '@/lib/org-scope'
import { scopeDeals } from '@/lib/sales-deals'
import { lexiCtx, runReadTool, type LexiCtx } from '@/lib/lexi/tools'
import { overview as qboOverview } from '@/lib/qbo-reports'
import { addDaysISO, etMidnight, etTimeOf, todayET, TZ } from '@/lib/tz'
import { sendEmail } from '@/lib/email-sender'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const FAST_MODEL = process.env.LEXI_FAST_MODEL || 'claude-haiku-4-5-20251001'
const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://portal.gateguard.co').replace(/\/+$/, '')
const NO_MATCH = '00000000-0000-0000-0000-000000000000'
const OPEN_WO = ['open', 'scheduled', 'in_progress', 'procurement', 'stuck', 'on_hold']
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

export type Tone = 'red' | 'orange' | 'green' | 'blue' | 'gray'
export type ReviewItem = { title: string; detail?: string; href?: string; tone?: Tone }
export type ReviewArea = { key: 'sales' | 'ops' | 'customers' | 'dealers' | 'admin' | 'money'; title: string; summary: string; items: ReviewItem[]; note?: string }
export type BringItem = { key: string; text: string; detail?: string; source: 'job' | 'meeting' | 'always'; warn?: string }
export type LeftoverTask = { id: string; title: string; due: string | null; linked: string | null; overdue: boolean }
export type EveningReview = {
  today: string
  tomorrow: string
  tomorrowLabel: string
  name: string
  top3: { for: string; items: { title: string; task_id: string | null; done: boolean | null }[] } | null
  doneToday: { tasks: { id: string; title: string }[]; jobs: { id: string; title: string }[] }
  leftover: LeftoverTask[]
  areas: ReviewArea[]
  calendar: { title: string; time: string; where?: string | null }[]
  bring: BringItem[]
  suggestTop3: string[]
  summary: string
}

export type EveningSettings = { on: boolean; time: string; days: number[]; phone: string | null; email: boolean; lastSent: string | null; top3: Row | null; bringAlways: string[]; error?: string }

const money = (n: unknown) => `$${Math.round(Number(n) || 0).toLocaleString()}`
const niceDay = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
const notReady = (m: string) => (/lexi_(evening|top3|bring)/.test(m) && /does not exist|schema cache|column/i.test(m) ? 'The nightly review isn’t set up yet — run migration 211.' : m)

// ── Settings ─────────────────────────────────────────────────────────────────
export async function getEveningSettings(userId: string): Promise<EveningSettings> {
  const { data, error } = await sb.from('user_settings')
    .select('lexi_evening_on, lexi_evening_time, lexi_evening_days, lexi_evening_phone, lexi_evening_email, lexi_evening_last_sent, lexi_top3, lexi_bring_always')
    .eq('user_id', userId).maybeSingle()
  if (error) return { on: false, time: '18:00', days: [0, 1, 2, 3, 4], phone: null, email: false, lastSent: null, top3: null, bringAlways: [], error: notReady(error.message) }
  return {
    on: !!data?.lexi_evening_on, time: data?.lexi_evening_time ?? '18:00', days: Array.isArray(data?.lexi_evening_days) ? data!.lexi_evening_days : [0, 1, 2, 3, 4],
    phone: data?.lexi_evening_phone ?? null, email: !!data?.lexi_evening_email, lastSent: data?.lexi_evening_last_sent ?? null,
    top3: (data?.lexi_top3 as Row) ?? null, bringAlways: Array.isArray(data?.lexi_bring_always) ? data!.lexi_bring_always : [],
  }
}

export function cleanPhone(raw: unknown): string | null {
  const d = String(raw ?? '').replace(/\D/g, '')
  return d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith('1') ? `+${d}` : null
}

/** Validate + save. Returns an error message or null. */
export async function saveEveningSettings(u: PortalUser, body: Row): Promise<string | null> {
  const patch: Row = {}
  if (typeof body.on === 'boolean') patch.lexi_evening_on = body.on
  if (body.time !== undefined) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(body.time))) return 'Pick a time like 18:00.'
    patch.lexi_evening_time = String(body.time)
  }
  if (body.days !== undefined) {
    const days = Array.isArray(body.days) ? [...new Set(body.days.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].sort() : null
    if (!days?.length) return 'Pick at least one evening.'
    patch.lexi_evening_days = days
  }
  if (body.phone !== undefined) {
    if (body.phone === '' || body.phone === null) patch.lexi_evening_phone = null
    else { const p = cleanPhone(body.phone); if (!p) return 'That phone number doesn’t look right — use 10 digits.'; patch.lexi_evening_phone = p }
  }
  if (typeof body.email === 'boolean') patch.lexi_evening_email = body.email
  if (body.bringAlways !== undefined) {
    if (!Array.isArray(body.bringAlways)) return 'Bad list.'
    patch.lexi_bring_always = [...new Set(body.bringAlways.map((s: unknown) => String(s ?? '').trim().slice(0, 80)).filter(Boolean))].slice(0, 40)
  }
  if (body.top3 !== undefined) {
    const items = Array.isArray(body.top3?.items) ? body.top3.items.slice(0, 3).map((i: Row) => ({ title: String(i.title ?? '').trim().slice(0, 200), task_id: typeof i.task_id === 'string' && /^[0-9a-f-]{36}$/i.test(i.task_id) ? i.task_id : null })).filter((i: Row) => i.title) : []
    const forDay = String(body.top3?.for ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(forDay)) return 'Bad date.'
    patch.lexi_top3 = { for: forDay, items }
  }
  if (!Object.keys(patch).length) return 'Nothing to save.'
  // Turning it on needs somewhere to send it.
  if (patch.lexi_evening_on === true) {
    const cur = await getEveningSettings(u.id)
    if (cur.error) return cur.error
    const phone = patch.lexi_evening_phone !== undefined ? patch.lexi_evening_phone : cur.phone
    const email = patch.lexi_evening_email !== undefined ? patch.lexi_evening_email : cur.email
    if (!phone && !(email && u.email)) return 'Add your cell number (or turn on email) so Lexi can reach you.'
  }
  const { error } = await sb.from('user_settings').upsert({ user_id: u.id, ...patch }, { onConflict: 'user_id' })
  return error ? notReady(error.message) : null
}

// ── Building the review ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scoped(table: string, cols: string, ctx: LexiCtx): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = sb.from(table).select(cols)
  if (!ctx.scope.all && !ctx.scope.ids.length) return q.eq('id', NO_MATCH)
  return applyOrgScope(q, ctx.scope, 'org_id')
}
const woTitle = (w: Row) => [w.wo_number, w.title].filter(Boolean).join(' · ') || 'Work order'
const safe = async <T,>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>, fallback: T): Promise<T> => {
  try { const r = await p; return (r.error ? fallback : (r.data ?? fallback)) as T } catch { return fallback }
}

export async function buildEveningReview(u: PortalUser, opts: { now?: Date; withAI?: boolean } = {}): Promise<EveningReview> {
  const now = opts.now ?? new Date()
  const t = todayET(now), tm = addDaysISO(t, 1), after = addDaysISO(t, 2)
  const dayStart = etMidnight(t).toISOString(), tmStart = etMidnight(tm).toISOString(), tmEnd = etMidnight(after).toISOString()
  const ctx = await lexiCtx(u)
  const settings = await getEveningSettings(u.id)
  const mine = `assigned_to.eq.${u.id},created_by.eq.${u.id}`
  const firstName = u.name.split(' ')[0] || 'there'

  const [brief, inbox, cal, leftoverRows, doneTasks, doneJobs, tmTasks, tmJobs, visibleDeals] = await Promise.all([
    runReadTool('daily_brief', {}, ctx).then(r => r.data as Row).catch(() => ({} as Row)),
    runReadTool('waiting_on_me', { days: 21, limit: 10 }, ctx).then(r => ((r.data as Row)?.waiting ?? []) as Row[]).catch(() => [] as Row[]),
    safe(sb.from('gcal_events').select('title, start_time, is_all_day, location').eq('user_id', u.id).gte('start_time', tmStart).lt('start_time', tmEnd).order('start_time').limit(20), [] as Row[]),
    safe(scoped('todos', 'id, title, due_date, linked_label', ctx).in('status', ['open', 'in_progress', 'waiting']).or(mine).lte('due_date', t).order('due_date').limit(25), [] as Row[]),
    safe(scoped('todos', 'id, title', ctx).eq('status', 'done').or(mine).gte('completed_at', dayStart).limit(25), [] as Row[]),
    safe(scoped('work_orders', '*', ctx).eq('status', 'completed').gte('completed_at', dayStart).limit(25), [] as Row[]),
    safe(scoped('todos', 'id, title, linked_label', ctx).in('status', ['open', 'in_progress', 'waiting']).or(mine).eq('due_date', tm).limit(20), [] as Row[]),
    safe(scoped('work_orders', '*', ctx).gte('scheduled_date', tm).lt('scheduled_date', after).in('status', OPEN_WO).order('scheduled_date').limit(25), [] as Row[]),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    safe((scopeDeals(sb.from('opportunities').select('id, name, account_name, stage').is('deleted_at', null) as any, ctx.deals) as any).not('stage', 'in', '(won,lost)').limit(300), [] as Row[]),
  ])

  // Sales: follow-ups, calls and meetings due tomorrow on deals this person can see.
  const dealIds = (visibleDeals as Row[]).map(d => d.id)
  const dealById = new Map((visibleDeals as Row[]).map(d => [d.id, d]))
  const acts = dealIds.length ? await safe(sb.from('crm_activities').select('id, type, subject, due_at, opportunity_id, contact_name').in('opportunity_id', dealIds.slice(0, 300)).is('completed_at', null).gte('due_at', tmStart).lt('due_at', tmEnd).order('due_at').limit(20), [] as Row[]) : []
  // Parts on tomorrow's jobs (the bring list).
  const jobIds = (tmJobs as Row[]).map(w => w.id)
  const parts = jobIds.length ? await safe(sb.from('work_order_parts').select('work_order_id, name, sku, qty, supply_status, expected_at, action').in('work_order_id', jobIds).limit(200), [] as Row[]) : []
  // Proposals for tomorrow's meetings.
  const meetingDealIds = [...new Set((acts as Row[]).filter(a => ['meeting', 'demo', 'site_walk', 'call'].includes(String(a.type))).map(a => a.opportunity_id).filter(Boolean))]
  const meetingQuotes = meetingDealIds.length ? await safe(sb.from('quotes').select('id, title, status, opportunity_id').in('opportunity_id', meetingDealIds).neq('status', 'declined').order('created_at', { ascending: false }).limit(20), [] as Row[]) : []

  // ── Today ──
  let top3: EveningReview['top3'] = null
  const saved = settings.top3 as { for?: string; items?: Row[] } | null
  if (saved?.for === t && Array.isArray(saved.items) && saved.items.length) {
    const ids = saved.items.map(i => i.task_id).filter(Boolean) as string[]
    const st = ids.length ? await safe(sb.from('todos').select('id, status').in('id', ids), [] as Row[]) : []
    const status = new Map((st as Row[]).map(r => [r.id, r.status]))
    top3 = { for: t, items: saved.items.map(i => ({ title: String(i.title), task_id: i.task_id ?? null, done: i.task_id ? status.get(i.task_id) === 'done' : null })) }
  }
  const leftover: LeftoverTask[] = (leftoverRows as Row[]).map(r => ({ id: r.id, title: r.title, due: r.due_date ?? null, linked: r.linked_label ?? null, overdue: !!r.due_date && r.due_date < t }))

  // ── Tomorrow by area ──
  const areas: ReviewArea[] = []
  const stalled = (brief.deals_stalled ?? []) as Row[]
  const expiring = ((brief.proposals_expiring_this_week ?? []) as Row[]).filter(q => q.valid_until && q.valid_until <= addDaysISO(t, 3))
  areas.push({
    key: 'sales', title: 'Sales',
    summary: [acts.length ? plural(acts.length, 'follow-up') : null, expiring.length ? `${expiring.length} proposal${expiring.length === 1 ? '' : 's'} expiring` : null, stalled.length ? `${stalled.length} quiet deal${stalled.length === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ') || 'Nothing scheduled',
    items: [
      ...(acts as Row[]).map(a => { const d = dealById.get(a.opportunity_id) as Row | undefined; return { title: `${a.type ? `${String(a.type).replace('_', ' ')}: ` : ''}${a.subject}`, detail: [d?.name || d?.account_name, a.contact_name, a.due_at ? etTimeOf(a.due_at) : null].filter(Boolean).join(' · '), href: a.opportunity_id ? `/?tab=opps&deal=${a.opportunity_id}` : undefined, tone: 'blue' as Tone } }),
      ...expiring.map(q => ({ title: `Proposal expiring: ${q.title ?? 'Proposal'}`, detail: `expires ${niceDay(String(q.valid_until).slice(0, 10))}`, tone: 'orange' as Tone })),
      ...stalled.slice(0, 3).map(d => ({ title: `Quiet deal: ${d.name || d.account || 'Deal'}`, detail: `${d.stage} · no update in ${d.days_since_update} days`, href: `/?tab=opps&deal=${d.id}`, tone: 'orange' as Tone })),
    ],
  })
  const needTech = (tmJobs as Row[]).filter(w => !w.assignee_name)
  const late = (brief.jobs_overdue ?? []) as Row[]
  areas.push({
    key: 'ops', title: 'Operations',
    summary: [plural(tmJobs.length, 'job'), needTech.length ? `${needTech.length} with no tech` : null, late.length ? `${late.length} late` : null].filter(Boolean).join(' · '),
    items: [
      ...(tmJobs as Row[]).map(w => ({ title: woTitle(w), detail: [w.customer_name ?? w.property_name, w.assignee_name ?? 'No tech yet', String(w.scheduled_date ?? '').length > 10 ? etTimeOf(w.scheduled_date) : null].filter(Boolean).join(' · '), href: `/maintenance/${w.id}`, tone: (w.assignee_name ? 'blue' : 'red') as Tone })),
      ...late.slice(0, 5).map(w => ({ title: `Late: ${[w.number, w.title].filter(Boolean).join(' · ') || 'Work order'}`, detail: `${w.site ?? ''} · was due ${w.scheduled ?? ''}`, href: `/maintenance/${w.id}`, tone: 'red' as Tone })),
    ],
  })
  const incidents = (brief.open_incidents ?? []) as Row[]
  areas.push({
    key: 'customers', title: 'Customers',
    summary: [inbox.length ? `${plural(inbox.length, 'email')} you owe` : null, incidents.length ? `${plural(incidents.length, 'system problem')} open` : null].filter(Boolean).join(' · ') || 'Nobody waiting on you',
    items: [
      ...inbox.slice(0, 6).map(m => ({ title: m.subject ?? '(no subject)', detail: `${m.from} · waiting ${m.waiting_days} day${m.waiting_days === 1 ? '' : 's'}`, href: '/messages', tone: ((m.waiting_days ?? 0) >= 3 ? 'orange' : 'blue') as Tone })),
      ...incidents.slice(0, 4).map(i => ({ title: i.title ?? 'Open incident', detail: [i.severity, i.status].filter(Boolean).join(' · '), tone: 'red' as Tone })),
    ],
  })
  if (u.isCorporate) {
    const dealers = await safe(sb.from('organizations').select('id, name, created_at').eq('onboarding_complete', false).order('created_at', { ascending: false }).limit(10), [] as Row[])
    areas.push({
      key: 'dealers', title: 'Dealers',
      summary: dealers.length ? `${plural(dealers.length, 'dealer')} still onboarding` : 'No dealers waiting',
      items: (dealers as Row[]).map(o => ({ title: o.name ?? 'Dealer', detail: 'onboarding not finished', href: `/admin/dealers/new?resume=${o.id}`, tone: 'orange' as Tone })),
    })
  }
  areas.push({
    key: 'admin', title: 'Admin & tasks',
    summary: tmTasks.length ? `${plural(tmTasks.length, 'task')} due tomorrow` : 'No tasks due tomorrow',
    items: (tmTasks as Row[]).map(x => ({ title: x.title, detail: x.linked_label ?? undefined, href: `/?task=${x.id}`, tone: 'blue' as Tone })),
  })
  areas.push(await moneyArea(u, ctx, t, tm, dayStart))

  // ── Calendar ──
  const calendar = (cal as Row[]).map(e => ({ title: e.title || 'Event', time: e.is_all_day ? 'All day' : new Date(e.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }), where: e.location ?? null }))

  // ── Bring list ──
  const bring: BringItem[] = []
  const jobById = new Map((tmJobs as Row[]).map(w => [w.id, w]))
  const merged = new Map<string, { name: string; qty: number; jobs: Set<string>; warn?: string }>()
  for (const p of parts as Row[]) {
    if (['installed', 'returned'].includes(String(p.action)) || p.supply_status === 'installed') continue
    const k = String(p.sku || p.name).toLowerCase()
    const cur: { name: string; qty: number; jobs: Set<string>; warn?: string } = merged.get(k) ?? { name: String(p.name), qty: 0, jobs: new Set<string>() }
    cur.qty += Number(p.qty) || 1
    const w = jobById.get(p.work_order_id); if (w) cur.jobs.add(w.wo_number || w.title || 'a job')
    if (['not_ordered', 'ordered', 'shipped'].includes(String(p.supply_status))) cur.warn = p.supply_status === 'not_ordered' ? 'not ordered yet' : `${String(p.supply_status).replace('_', ' ')}${p.expected_at ? ` — expected ${p.expected_at}` : ''}`
    else if (p.supply_status === 'at_office') cur.warn = cur.warn ?? 'pick up at the office'
    merged.set(k, cur)
  }
  for (const [k, v] of merged) bring.push({ key: `part:${k}`, text: `${v.qty > 1 ? `${v.qty} × ` : ''}${v.name}`, detail: `for ${[...v.jobs].join(', ')}`, source: 'job', warn: v.warn })
  for (const id of meetingDealIds) {
    const d = dealById.get(id) as Row | undefined
    const q = (meetingQuotes as Row[]).find(x => x.opportunity_id === id)
    bring.push({ key: `meeting:${id}`, text: q ? `Proposal: ${q.title ?? 'proposal'} (printed or on your iPad)` : `Notes and a proposal draft for ${d?.name || d?.account_name || 'the meeting'}`, detail: d?.name || d?.account_name || undefined, source: 'meeting' })
  }
  for (const s of settings.bringAlways) bring.push({ key: `always:${s.toLowerCase()}`, text: s, source: 'always' })

  // ── Suggested top 3 ──
  const suggestTop3 = await suggestTop3For({ firstName, leftover, areas, withAI: opts.withAI !== false })
  const opsJobs = tmJobs.length
  const summary = [
    top3 ? `${top3.items.filter(i => i.done).length} of ${top3.items.length} of today’s top 3 done` : null,
    leftover.length ? `${plural(leftover.length, 'task')} left over` : 'nothing left over',
    `${plural(opsJobs, 'job')} tomorrow`,
    acts.length ? plural(acts.length, 'follow-up') : null,
  ].filter(Boolean).join(', ')

  return {
    today: t, tomorrow: tm, tomorrowLabel: niceDay(tm), name: firstName, top3,
    doneToday: { tasks: (doneTasks as Row[]).map(x => ({ id: x.id, title: x.title })), jobs: (doneJobs as Row[]).map(w => ({ id: w.id, title: woTitle(w) })) },
    leftover, areas, calendar, bring, suggestTop3, summary,
  }
}

async function moneyArea(u: PortalUser, ctx: LexiCtx, t: string, tm: string, dayStart: string): Promise<ReviewArea> {
  const items: ReviewItem[] = []
  const parts: string[] = []
  let note: string | undefined
  if (u.isCorporate) {
    try {
      const r = await qboOverview()
      if (r.ok) {
        const d = r.data
        parts.push(`cash ${money(d.cash.total)}`)
        items.push({ title: `Cash in the bank: ${money(d.cash.total)}`, href: '/?view=admin&qb=1', tone: 'green' })
        items.push({ title: `Customers owe us ${money(d.receivable.total)}`, detail: d.receivable.over90 ? `${money(d.receivable.over90)} is over 90 days late` : `${money(d.receivable.d1_30 + d.receivable.d31_60 + d.receivable.d61_90 + d.receivable.over90)} past due`, href: '/?view=admin&qb=1', tone: d.receivable.over90 ? 'orange' : 'blue' })
        items.push({ title: `Bills we owe: ${money(d.payable.total)}`, href: '/?view=admin&qb=1', tone: 'blue' })
        for (const c of d.receivable.late.slice(0, 3)) items.push({ title: `Call about payment: ${c.customer}`, detail: `${money(c.overdue)} overdue`, tone: 'orange' })
      } else note = `QuickBooks: ${r.error}`
    } catch (e) { note = `QuickBooks: ${e instanceof Error ? e.message : 'not available'}` }
  }
  // Nexus invoices (everyone, company-scoped): money in today, due tomorrow, late.
  const [paidToday, dueTm, lateInv] = await Promise.all([
    safe(scoped('invoices', 'id, invoice_number, amount_paid, total, paid_at', ctx).gte('paid_at', dayStart).limit(50), [] as Row[]),
    safe(scoped('invoices', 'id, invoice_number, balance_due, due_date', ctx).in('status', ['sent', 'viewed', 'overdue']).eq('due_date', tm).limit(20), [] as Row[]),
    safe(scoped('invoices', 'id, invoice_number, balance_due, due_date', ctx).in('status', ['sent', 'viewed', 'overdue']).lt('due_date', t).limit(100), [] as Row[]),
  ])
  const inToday = (paidToday as Row[]).reduce((s, i) => s + (Number(i.amount_paid) || Number(i.total) || 0), 0)
  const lateSum = (lateInv as Row[]).reduce((s, i) => s + (Number(i.balance_due) || 0), 0)
  const dueSum = (dueTm as Row[]).reduce((s, i) => s + (Number(i.balance_due) || 0), 0)
  if (paidToday.length) { parts.push(`${money(inToday)} in today`); items.push({ title: `Paid today: ${money(inToday)}`, detail: plural(paidToday.length, 'invoice'), tone: 'green' }) }
  if (dueTm.length) items.push({ title: `Due tomorrow: ${money(dueSum)}`, detail: plural(dueTm.length, 'invoice'), tone: 'blue' })
  if (lateInv.length) { parts.push(`${money(lateSum)} late`); items.push({ title: `Late invoices: ${money(lateSum)}`, detail: `${plural(lateInv.length, 'invoice')} past due — send reminders`, tone: 'orange' }) }
  return { key: 'money', title: 'Money in / money out', summary: parts.join(' · ') || 'No money moves today', items, note }
}

async function suggestTop3For(o: { firstName: string; leftover: LeftoverTask[]; areas: ReviewArea[]; withAI: boolean }): Promise<string[]> {
  // Plain fallback: most urgent things first.
  const pool: string[] = [
    ...o.leftover.filter(x => x.overdue).map(x => x.title),
    ...o.areas.flatMap(a => a.items.filter(i => i.tone === 'red').map(i => i.title)),
    ...o.leftover.filter(x => !x.overdue).map(x => x.title),
    ...o.areas.flatMap(a => a.items.filter(i => i.tone === 'orange').map(i => i.title)),
  ]
  const fallback = [...new Set(pool)].slice(0, 3)
  if (!o.withAI || !process.env.ANTHROPIC_API_KEY) return fallback
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const facts = { left_over_tasks: o.leftover.slice(0, 12).map(x => `${x.title}${x.overdue ? ' (overdue)' : ''}`), tomorrow: o.areas.map(a => ({ area: a.title, summary: a.summary, top: a.items.slice(0, 5).map(i => `${i.title}${i.detail ? ` — ${i.detail}` : ''}`) })) }
    const r = await Promise.race([
      anthropic.messages.create({
        model: FAST_MODEL, max_tokens: 220, temperature: 0.2,
        messages: [{ role: 'user', content: `You are Lexi, a professional executive assistant for ${o.firstName} at Gate Guard (gate and access-control company). From the facts below, pick the 3 most important things to get done tomorrow — the ones that move money, keep customers happy, or are already late. Each one short (under 12 words), starting with a verb, specific (names, numbers). Use only the facts. Reply with exactly 3 lines, no numbering, no extra text.\n${JSON.stringify(facts)}` }],
      }),
      new Promise<null>(res => setTimeout(() => res(null), 8000)),
    ])
    const text = r && 'content' in r ? r.content.map(b => (b.type === 'text' ? b.text : '')).join('') : ''
    const lines = text.split('\n').map(s => s.replace(/^[\s\-•*\d.)]+/, '').trim()).filter(Boolean).slice(0, 3)
    return lines.length === 3 ? lines.map(l => l.slice(0, 160)) : fallback
  } catch { return fallback }
}

// ── Sending the nudge ────────────────────────────────────────────────────────
async function sendText(to: string, body: string): Promise<string | null> {
  const SID = process.env.TWILIO_ACCOUNT_SID, TOKEN = process.env.TWILIO_AUTH_TOKEN, FROM = process.env.TWILIO_FROM_NUMBER
  if (!SID || !TOKEN || !FROM) return 'Texting isn’t set up (Twilio settings missing).'
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${SID}:${TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ From: FROM, To: to, Body: body }).toString(), signal: AbortSignal.timeout(10000) })
    return res.ok ? null : `Text failed (${res.status}): ${(await res.text()).slice(0, 160)}`
  } catch (e) { return `Text failed: ${e instanceof Error ? e.message : e}` }
}
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

/** Text (and optionally email) the link to tonight's review. */
export async function sendEveningNudge(u: PortalUser, s?: EveningSettings): Promise<{ ok: boolean; sent: string[]; error?: string }> {
  const settings = s ?? await getEveningSettings(u.id)
  if (settings.error) return { ok: false, sent: [], error: settings.error }
  const review = await buildEveningReview(u, { withAI: false })
  const link = `${APP_URL()}/?tab=lexi&review=evening`
  const sent: string[] = []
  const errors: string[] = []
  if (settings.phone) {
    const err = await sendText(settings.phone, `Lexi: time to close out today, ${review.name}. ${review.summary}. Plan ${review.tomorrowLabel.split(',')[0]}: ${link}`)
    if (err) errors.push(err); else sent.push('text')
  }
  if (settings.email && u.email) {
    const areaRows = review.areas.map(a => `<tr><td style="padding:8px 0;border-top:1px solid #EEF0F4"><div style="font-size:13px;font-weight:600;color:#1D1D1F">${esc(a.title)}</div><div style="font-size:13px;color:#6E6E73">${esc(a.summary)}</div></td></tr>`).join('')
    const html = `<!doctype html><html><body style="margin:0;background:#EEF2F7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',Inter,Segoe UI,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
      <tr><td style="background:#0E1726;border-radius:16px 16px 0 0;padding:22px 24px"><div style="color:#8EC1FF;font-size:13px">Tomorrow: ${esc(review.tomorrowLabel)}</div><div style="color:#fff;font-size:24px;font-weight:600;margin-top:4px">Close out today, ${esc(review.name)}</div></td></tr>
      <tr><td style="background:#fff;padding:20px 24px;border-radius:0 0 16px 16px"><p style="margin:0 0 12px;font-size:15px;color:#1D1D1F">${esc(review.summary)}.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${areaRows}</table>
      ${review.bring.length ? `<p style="margin:16px 0 4px;font-size:13px;font-weight:600;color:#6E6E73">Bring tomorrow</p><ul style="margin:0;padding-left:18px;font-size:14px;color:#1D1D1F">${review.bring.slice(0, 12).map(b => `<li>${esc(b.text)}${b.warn ? ` <span style="color:#B25000">(${esc(b.warn)})</span>` : ''}</li>`).join('')}</ul>` : ''}
      <div style="margin-top:20px"><a href="${esc(link)}" style="display:inline-block;background:#0071E3;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:12px">Plan tomorrow</a></div>
      <p style="margin:20px 0 0;font-size:12px;color:#8E8E93">You get this because you turned on the nightly review in Lexi. Turn it off there anytime.</p></td></tr></table></td></tr></table></body></html>`
    const r = await sendEmail({ to: u.email, subject: `Plan tomorrow: ${review.summary}`, html })
    if (!r.success) errors.push(r.error ?? 'Email didn’t send.'); else sent.push('email')
  }
  if (!sent.length) return { ok: false, sent, error: errors.join(' · ') || 'No way to reach you — add your cell number or turn on email.' }
  return { ok: true, sent, ...(errors.length ? { error: errors.join(' · ') } : {}) }
}

/** HH:MM and weekday (0 = Sunday) in Eastern time. */
export function etClock(now = new Date()): { hhmm: string; dow: number; day: string } {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', weekday: 'short', hour: '2-digit', minute: '2-digit' }).formatToParts(now).map(x => [x.type, x.value]))
  return { hhmm: `${p.hour}:${p.minute}`, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(String(p.weekday)), day: todayET(now) }
}

/** Is it time to send this person's review? (time reached, within 3 hours, chosen evening, not sent today). Pure. */
export function isDue(s: Pick<EveningSettings, 'on' | 'time' | 'days' | 'lastSent'>, now = new Date()): boolean {
  if (!s.on) return false
  const c = etClock(now)
  if (!s.days.includes(c.dow) || s.lastSent === c.day) return false
  const toMin = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m }
  const diff = toMin(c.hhmm) - toMin(s.time)
  return diff >= 0 && diff < 180
}

/** Claim tonight's send (so two runs never both send). True = this run owns it. */
export async function claimEveningSend(userId: string, day: string): Promise<boolean> {
  const { data, error } = await sb.from('user_settings').update({ lexi_evening_last_sent: day }).eq('user_id', userId).neq('lexi_evening_last_sent', day).select('user_id')
  if (error) throw new Error(error.message)
  return (data ?? []).length > 0
}

/** Give the claim back after a failed send so a retry can try again. */
export async function releaseEveningSend(userId: string, day: string): Promise<void> {
  const { error } = await sb.from('user_settings').update({ lexi_evening_last_sent: addDaysISO(day, -1) }).eq('user_id', userId).eq('lexi_evening_last_sent', day)
  if (error) console.error('[lexi/evening] release failed:', error.message)
}
