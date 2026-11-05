/**
 * Executive Lexi — standing workstreams (Nov 4 2026).
 *
 * Lexi works these every day, like another Russel running in parallel:
 *   sales        pipeline, stalled deals, win rate            (companyPulse in exec.ts)
 *   upsell       money from customers we already have: sites missing Gate Watch,
 *                a property portal, a service plan, monitoring; big sites with little on them
 *   collections  who owes us, how late, who to call first (Nexus invoices + QuickBooks aging)
 *   dealers      who's active, stuck in onboarding, quoting but not closing, gone quiet
 *   nexus        what's used in Nexus and what isn't (nexus_usage, migration 219) + her product notes
 *   fleet        Gate Watch + Edge: gates down, uptime, AI accuracy, cameras offline, sites with Edge
 *
 * digest(name) returns compact facts for one workstream (for the chat tool and the
 * daily strategist). Her own running work list lives in lexi_work_items (219).
 * Read-only except the work list. Never reads vendor credentials (only whether a site has Edge).
 */
import { createClient } from '@supabase/supabase-js'
import type { PortalUser } from '@/lib/current-user'
import type { LexiCtx } from '@/lib/lexi/tools'
import { getReport } from '@/lib/qbo-reports'
import { todayET } from '@/lib/tz'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

export const WORKSTREAMS = ['sales', 'upsell', 'collections', 'dealers', 'nexus', 'fleet'] as const
export type Workstream = (typeof WORKSTREAMS)[number]
export const WORKSTREAM_LABEL: Record<Workstream, string> = { sales: 'Sales', upsell: 'Customer upsell', collections: 'Collections', dealers: 'Dealers', nexus: 'Nexus product', fleet: 'Gate Watch & Edge' }
const notReady = (m: string) => (/nexus_usage|lexi_work_items|workstream/.test(m) && /does not exist|schema cache|column/i.test(m) ? 'Run migration 219 first.' : m)
const money = (n: unknown) => (n == null || !Number.isFinite(Number(n)) ? null : `$${Math.round(Number(n)).toLocaleString()}`)
const days = (iso?: string | null) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : null)
const within = <T,>(p: Promise<T>, ms: number, fallback: T) => Promise.race([p, new Promise<T>(res => setTimeout(() => res(fallback), ms))])
const ago = (d: number) => new Date(Date.now() - d * 86400000).toISOString()
const DEALER_TIERS = ['master_dealer', 'full_dealer', 'service_dealer', 'install_contractor', 'sales_partner', 'master_agent']

// ── Upsell: what each active property has, and what it's missing ─────────────
async function upsell(): Promise<Row> {
  const { data: sites, error } = await sb.from('sites').select('id, name, city, state, units, org_id').eq('status', 'active').limit(2000)
  if (error) return { error: error.message }
  const S = (sites ?? []) as Row[]
  if (!S.length) return { active_sites: 0 }
  const ids = S.map(s => s.id)
  const [assets, gw, portals, pm, edge] = await Promise.all([
    sb.from('site_assets').select('site_id, product_category, status').in('site_id', ids).limit(20000),
    sb.from('gate_watches').select('site_id, enabled').in('site_id', ids).limit(5000),
    sb.from('client_portals').select('site_id, status').in('site_id', ids).limit(5000),
    sb.from('pm_schedules').select('site_id').in('site_id', ids).limit(5000),
    sb.from('site_integrations').select('site_id, vendor').in('site_id', ids).in('vendor', ['edge', 'eagle_eye', 'brivo']).limit(10000),
  ])
  const by = <T extends Row>(rows: T[] | null) => { const m = new Map<string, T[]>(); for (const r of rows ?? []) { const k = String(r.site_id); m.set(k, [...(m.get(k) ?? []), r]) } return m }
  const A = by(assets.data as Row[]), G = by(gw.data as Row[]), P = by(portals.data as Row[]), M = by(pm.data as Row[]), I = by(edge.data as Row[])
  const has = (id: string, re: RegExp) => (A.get(id) ?? []).some(a => re.test(String(a.product_category ?? '')) && a.status !== 'removed')
  const rows = S.map(s => {
    const id = String(s.id)
    const vendors = new Set((I.get(id) ?? []).map(x => x.vendor))
    const cams = has(id, /camera/i) || vendors.has('eagle_eye') || vendors.has('edge')
    const gate = has(id, /gate|operator/i) || vendors.has('brivo')
    const missing: string[] = []
    if (cams && gate && !(G.get(id) ?? []).some(g => g.enabled)) missing.push('Gate Watch (has gate + cameras)')
    if (!(P.get(id) ?? []).some(p => p.status !== 'disabled')) missing.push('property portal')
    if (!(M.get(id) ?? []).length) missing.push('service plan (no scheduled PM)')
    if (!cams) missing.push('cameras / video')
    if (!has(id, /package/i)) missing.push('package room')
    return { site: s.name, city: [s.city, s.state].filter(Boolean).join(', '), units: s.units ?? null, has: { cameras: cams, gate, edge: vendors.has('edge') }, missing }
  })
  const count = (label: RegExp) => rows.filter(r => r.missing.some(m => label.test(m))).length
  return {
    active_sites: S.length,
    missing_counts: { gate_watch: count(/Gate Watch/), portal: count(/portal/), service_plan: count(/service plan/), cameras: count(/cameras/), package_room: count(/package/) },
    // Biggest properties first — most units = most money per add-on.
    best_candidates: rows.filter(r => r.missing.length).sort((a, b) => (Number(b.units) || 0) - (Number(a.units) || 0)).slice(0, 15),
    prices_to_use: 'Use catalog prices (find_products) and the ROI model: Package room $2/unit/mo; Bulk $10/unit/mo.',
  }
}

// ── Collections ──────────────────────────────────────────────────────────────
async function collections(u: PortalUser): Promise<Row> {
  const t = todayET()
  const { data, error } = await sb.from('invoices').select('id, invoice_number, org_id, client_org_id, site_id, status, due_date, total, amount_paid, balance_due, sent_at').not('status', 'in', '(paid,void,draft)').gt('balance_due', 0).order('due_date', { ascending: true }).limit(1000)
  if (error) return { error: error.message }
  const I = (data ?? []) as Row[]
  const orgIds = [...new Set(I.map(i => i.client_org_id ?? i.org_id).filter(Boolean))]
  const siteIds = [...new Set(I.map(i => i.site_id).filter(Boolean))]
  const [orgs, sites] = await Promise.all([
    orgIds.length ? sb.from('organizations').select('id, name').in('id', orgIds) : Promise.resolve({ data: [] as Row[] }),
    siteIds.length ? sb.from('sites').select('id, name').in('id', siteIds) : Promise.resolve({ data: [] as Row[] }),
  ])
  const on = new Map(((orgs.data ?? []) as Row[]).map(o => [o.id, o.name])), sn = new Map(((sites.data ?? []) as Row[]).map(s => [s.id, s.name]))
  const late = I.filter(i => String(i.due_date) < t)
  const bucket = (d: number) => (d > 90 ? '90+' : d > 60 ? '61-90' : d > 30 ? '31-60' : '1-30')
  const buckets: Record<string, number> = { '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
  const who = new Map<string, { customer: string; owed: number; oldest_days: number; invoices: number }>()
  for (const i of late) {
    const d = Math.floor((Date.parse(`${t}T12:00:00Z`) - Date.parse(`${i.due_date}T12:00:00Z`)) / 86400000)
    buckets[bucket(d)] += Number(i.balance_due) || 0
    const name = sn.get(i.site_id) ?? on.get(i.client_org_id ?? i.org_id) ?? 'Unknown customer'
    const w = who.get(name) ?? { customer: name, owed: 0, oldest_days: 0, invoices: 0 }
    w.owed += Number(i.balance_due) || 0; w.oldest_days = Math.max(w.oldest_days, d); w.invoices++
    who.set(name, w)
  }
  let qbo: Row | string = 'not checked'
  if (u.isCorporate) {
    const r = await within(getReport('AgedReceivables', { report_date: t }).catch(() => null), 8000, null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    qbo = r && (r as any).ok ? { quickbooks_aging_rows: ((r as any).report?.rows ?? []).slice(0, 40) } : 'QuickBooks not connected or unavailable'
  }
  return {
    open_invoices: I.length, open_total: money(I.reduce((a, i) => a + (Number(i.balance_due) || 0), 0)),
    late_invoices: late.length, late_by_age: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, money(v)])),
    call_first: [...who.values()].sort((a, b) => b.oldest_days * 10 + b.owed / 100 - (a.oldest_days * 10 + a.owed / 100)).slice(0, 12).map(w => ({ ...w, owed: money(w.owed) })),
    quickbooks: qbo,
  }
}

// ── Dealers ──────────────────────────────────────────────────────────────────
async function dealers(): Promise<Row> {
  const { data, error } = await sb.from('organizations').select('id, name, org_tier, onboarding_complete, created_at, status').in('org_tier', DEALER_TIERS).limit(1000)
  if (error) return { error: error.message }
  const D = ((data ?? []) as Row[]).filter(d => d.status !== 'inactive')
  if (!D.length) return { dealers: 0 }
  const ids = D.map(d => d.id), since = ago(30)
  const [quotes, opps, won, wos, usage] = await Promise.all([
    sb.from('quotes').select('org_id').in('org_id', ids).gte('created_at', since).limit(5000),
    sb.from('opportunities').select('dealer_org_id').in('dealer_org_id', ids).gte('created_at', since).is('deleted_at', null).limit(5000),
    sb.from('opportunities').select('dealer_org_id').in('dealer_org_id', ids).eq('stage', 'won').gte('updated_at', ago(90)).limit(5000),
    sb.from('work_orders').select('org_id').in('org_id', ids).gte('created_at', since).limit(5000),
    sb.from('nexus_usage').select('org_id, created_at').in('org_id', ids).gte('created_at', since).limit(20000),
  ])
  const n = (rows: Row[] | null | undefined, col: string) => { const m = new Map<string, number>(); for (const r of rows ?? []) m.set(String(r[col]), (m.get(String(r[col])) ?? 0) + 1); return m }
  const Q = n(quotes.data as Row[], 'org_id'), O = n(opps.data as Row[], 'dealer_org_id'), W = n(won.data as Row[], 'dealer_org_id'), J = n(wos.data as Row[], 'org_id'), U = n(usage.error ? [] : (usage.data as Row[]), 'org_id')
  const list = D.map(d => ({ dealer: d.name, tier: d.org_tier, onboarded: !!d.onboarding_complete, joined_days_ago: days(d.created_at), quotes_30d: Q.get(d.id) ?? 0, new_deals_30d: O.get(d.id) ?? 0, won_90d: W.get(d.id) ?? 0, jobs_30d: J.get(d.id) ?? 0, nexus_visits_30d: usage.error ? 'needs migration 219' : (U.get(d.id) ?? 0) }))
  return {
    dealers: D.length,
    stuck_in_onboarding: list.filter(d => !d.onboarded).sort((a, b) => (b.joined_days_ago ?? 0) - (a.joined_days_ago ?? 0)).slice(0, 10),
    quoting_not_closing: list.filter(d => d.quotes_30d >= 2 && d.won_90d === 0).slice(0, 10),
    quiet_30_days: list.filter(d => d.onboarded && !d.quotes_30d && !d.new_deals_30d && !d.jobs_30d).slice(0, 12),
    most_active: [...list].sort((a, b) => (b.quotes_30d + b.new_deals_30d + b.jobs_30d) - (a.quotes_30d + a.new_deals_30d + a.jobs_30d)).slice(0, 8),
  }
}

// ── Nexus usage ──────────────────────────────────────────────────────────────
export const NEXUS_AREAS = ['my-day', 'opps', 'jobs', 'lexi', 'catalog', 'systems', 'events', 'people', 'help', 'design', 'dispatch', 'field', 'recent']
async function nexusUsage(): Promise<Row> {
  const { data, error } = await sb.from('nexus_usage').select('user_id, org_id, org_tier, area, created_at').gte('created_at', ago(30)).limit(50000)
  if (error) return { error: notReady(error.message) }
  const R = (data ?? []) as Row[]
  const per = new Map<string, { visits: number; people: Set<string>; corporate: number; dealers: number; last: string }>()
  for (const r of R) {
    const a = per.get(r.area) ?? { visits: 0, people: new Set<string>(), corporate: 0, dealers: 0, last: '' }
    a.visits++; a.people.add(r.user_id); if (r.org_tier === 'corporate') a.corporate++; else a.dealers++
    if (r.created_at > a.last) a.last = r.created_at
    per.set(r.area, a)
  }
  const first = R.length ? R.reduce((m, r) => (r.created_at < m ? r.created_at : m), R[0].created_at) : null
  const { data: notes } = await sb.from('lexi_work_items').select('title, note, status, updated_at').eq('workstream', 'nexus').order('updated_at', { ascending: false }).limit(15)
  return {
    tracking_since: first, people_30d: new Set(R.map(r => r.user_id)).size,
    by_area: [...per.entries()].map(([area, a]) => ({ area, visits: a.visits, people: a.people.size, corporate_visits: a.corporate, dealer_visits: a.dealers, last_used: a.last })).sort((a, b) => b.visits - a.visits),
    never_opened_30d: NEXUS_AREAS.filter(a => !per.has(a)),
    product_notes: notes ?? [],
    note: first && days(first)! < 7 ? 'Usage tracking just started — wait a week before calling anything unused.' : undefined,
  }
}

// ── Gate Watch + Edge fleet ──────────────────────────────────────────────────
async function fleet(): Promise<Row> {
  const [gw, down, fb, cams, edge, inc] = await Promise.all([
    sb.from('gate_watches').select('id, site_id, label, enabled, state, last_checked_at, last_confidence, open_since').limit(2000),
    sb.from('gate_downtime').select('gate_id, kind, started_at, ended_at').gte('started_at', ago(30)).limit(5000),
    sb.from('site_events').select('metadata').eq('event_type', 'gate_ai_feedback').gte('created_at', ago(30)).limit(5000),
    sb.from('site_assets').select('site_id, product_name, status, offline_since').ilike('product_category', '%camera%').in('status', ['offline', 'down', 'fault']).limit(500),
    sb.from('site_integrations').select('site_id').eq('vendor', 'edge').limit(2000),
    sb.from('incidents').select('title, severity, status, category, created_at').neq('status', 'resolved').limit(200),
  ])
  const G = (gw.data ?? []) as Row[]
  const on = G.filter(g => g.enabled)
  const D = (down.data ?? []) as Row[]
  const F = ((fb.data ?? []) as Row[]).map(e => e.metadata ?? {})
  const right = F.filter(m => m.right === true).length, wrong = F.filter(m => m.right === false).length
  const stale = on.filter(g => !g.last_checked_at || Date.now() - Date.parse(g.last_checked_at) > 2 * 3600e3)
  return {
    gates_watched: on.length, gates_down_now: on.filter(g => g.state === 'left_open').map(g => ({ gate: g.label, open_days: days(g.open_since) })),
    gates_blind_now: on.filter(g => g.state === 'blind').length,
    not_checked_2h: stale.map(g => g.label).slice(0, 10),
    down_periods_30d: D.filter(d => d.kind === 'down').length, blind_periods_30d: D.filter(d => d.kind === 'blind').length,
    ai_accuracy_30d: right + wrong ? { right, wrong, pct: Math.round((right / (right + wrong)) * 100) } : 'no Right/Wrong answers yet',
    low_confidence_gates: on.filter(g => Number(g.last_confidence) > 0 && Number(g.last_confidence) < 70).map(g => g.label).slice(0, 10),
    cameras_offline: ((cams.data ?? []) as Row[]).slice(0, 15).map(c => ({ camera: c.product_name, offline_days: days(c.offline_since) })),
    sites_with_edge: new Set(((edge.data ?? []) as Row[]).map(e => e.site_id)).size,
    open_incidents_by_category: ((inc.data ?? []) as Row[]).reduce((m: Row, i) => { const k = i.category ?? 'other'; m[k] = (m[k] ?? 0) + 1; return m }, {}),
    errors: [gw.error?.message, down.error?.message].filter(Boolean),
  }
}

export async function digest(name: string, u: PortalUser, ctx: LexiCtx, companyPulse: (c: LexiCtx) => Promise<Row>): Promise<Row> {
  switch (name) {
    case 'sales': return companyPulse(ctx)
    case 'upsell': return upsell()
    case 'collections': return collections(u)
    case 'dealers': return dealers()
    case 'nexus': return nexusUsage()
    case 'fleet': return fleet()
    default: return { error: `Unknown workstream ${name}. Use one of: ${WORKSTREAMS.join(', ')}` }
  }
}

/** All six, trimmed, for the daily strategist and briefs. One slow source never blocks the rest. */
export async function allDigests(u: PortalUser, ctx: LexiCtx, companyPulse: (c: LexiCtx) => Promise<Row>): Promise<Record<string, unknown>> {
  const out = await Promise.all(WORKSTREAMS.map(w => within(digest(w, u, ctx, companyPulse).catch(e => ({ error: String(e) })), 15000, { error: 'timed out' }).then(d => [w, d] as const)))
  return Object.fromEntries(out)
}

// ── Her work list ────────────────────────────────────────────────────────────
export async function listWork(u: PortalUser, includeDone = false): Promise<{ items: Row[]; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = sb.from('lexi_work_items').select('*').eq('user_id', u.id)
  if (!includeDone) q = q.neq('status', 'done')
  const { data, error } = await q.order('updated_at', { ascending: false }).limit(40)
  if (error) return { items: [], error: notReady(error.message) }
  return { items: (data ?? []) as Row[] }
}

export async function workAction(u: PortalUser, input: Row): Promise<{ ok: boolean; summary: string; message: string; id?: string }> {
  const action = String(input.action ?? 'list')
  const ws = (WORKSTREAMS as readonly string[]).includes(String(input.workstream)) ? String(input.workstream) : null
  const now = new Date().toISOString()
  if (action === 'add') {
    const title = String(input.title ?? '').trim().slice(0, 200)
    if (!title || !ws) return { ok: false, summary: 'Work list', message: 'Need a title and a workstream.' }
    const { data: open } = await sb.from('lexi_work_items').select('id, title').eq('user_id', u.id).neq('status', 'done').limit(60)
    const dupe = ((open ?? []) as Row[]).find(o => String(o.title).toLowerCase() === title.toLowerCase())
    if (dupe) return { ok: false, summary: 'Work list', message: `Already on the list: "${dupe.title}" — update that one.`, id: dupe.id }
    const { data, error } = await sb.from('lexi_work_items').insert({ user_id: u.id, workstream: ws, title, status: 'active', next_step: input.next_step ? String(input.next_step).slice(0, 500) : null, note: input.note ? String(input.note).slice(0, 2000) : null }).select('id').single()
    if (error) return { ok: false, summary: 'Work list', message: notReady(error.message) }
    return { ok: true, id: data.id, summary: `Working on: ${title}`, message: 'Added to Lexi’s work list.' }
  }
  if (action === 'update' || action === 'done') {
    const id = typeof input.id === 'string' && /^[0-9a-f-]{36}$/i.test(input.id) ? input.id : null
    if (!id) return { ok: false, summary: 'Work list', message: 'Need the item id (from my_work list).' }
    const patch: Row = { updated_at: now }
    if (action === 'done') patch.status = 'done'
    else if (['active', 'waiting', 'done'].includes(String(input.status))) patch.status = input.status
    if (input.next_step) patch.next_step = String(input.next_step).slice(0, 500)
    if (input.note) patch.note = String(input.note).slice(0, 2000)
    const { data, error } = await sb.from('lexi_work_items').update(patch).eq('id', id).eq('user_id', u.id).select('title')
    if (error) return { ok: false, summary: 'Work list', message: notReady(error.message) }
    if (!data?.length) return { ok: false, summary: 'Work list', message: 'Not found.' }
    return { ok: true, id, summary: `${patch.status === 'done' ? 'Finished' : 'Updated'}: ${data[0].title}`, message: 'Work list updated.' }
  }
  return { ok: false, summary: 'Work list', message: 'Unknown action.' }
}
