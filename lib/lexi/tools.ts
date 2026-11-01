/**
 * Lexi — read tools.
 *
 * Lexi answers from real data by calling these tools (instead of the old
 * assistant's keyword guessing). Every read is limited to what the caller can
 * see: company scope for jobs / sites / tasks / leads, the Sales visibility
 * rules for deals, and the caller's own mailbox + calendar.
 *
 * Writes are NOT here — they go through lib/assistant-executor.ts (the 17
 * undoable action tools), which has its own scope checks.
 */
import type Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { PortalUser } from '@/lib/current-user'
import { applyOrgScope, type OrgScope } from '@/lib/org-scope'
import { dealCtx, scopeDeals, STALLED_DAYS, type DealCtx } from '@/lib/sales-deals'
import { searchKnowledge } from '@/lib/vectorize'
import { searchGuide } from '@/lib/lexi/nexus-guide'
import { getSiteBrivoToken, listBrivoDoors, listSiteBrivoEvents } from '@/lib/brivo'
import { getSiteEagleEyeAccess, listEagleEyeCameras } from '@/lib/eagle-eye'
import { listSiteShellyRelays } from '@/lib/shelly'
import { addDaysISO, etMidnight, todayET } from '@/lib/tz'
import { canOperate } from '@/lib/system-access'
import { getReport, overview } from '@/lib/qbo-reports'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
export type LexiCard = { kind: 'deal' | 'work_order' | 'site' | 'task' | 'lead' | 'customer' | 'thread' | 'event' | 'manual' | 'product'; id: string; title: string; sub?: string; href?: string; tone?: 'red' | 'orange' | 'green' | 'blue' }
export type ToolOut = { data: unknown; cards?: LexiCard[] }
export type LexiCtx = { user: PortalUser; scope: OrgScope; deals: DealCtx }

export async function lexiCtx(user: PortalUser): Promise<LexiCtx> {
  const deals = await dealCtx(user)
  return { user, scope: deals.scope, deals }
}

const NO_MATCH = '00000000-0000-0000-0000-000000000000'
const today = () => todayET()
const daysAgo = (iso?: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null)
const clamp = (n: unknown, d: number, max = 25) => Math.max(1, Math.min(max, Number(n) || d))
const like = (q: unknown) => `%${String(q ?? '').replace(/[%_,()]/g, ' ').trim()}%`
const has = (q: unknown) => typeof q === 'string' && q.trim().length > 0
const money = (n: unknown) => (n == null || n === '' ? null : `$${Math.round(Number(n)).toLocaleString()}`)

// Company-scoped select. Non-corporate users with no company see nothing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scoped(table: string, cols: string, ctx: LexiCtx, col = 'org_id'): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = sb.from(table).select(cols)
  if (!ctx.scope.all && !ctx.scope.ids.length) return q.eq('id', NO_MATCH)
  q = applyOrgScope(q, ctx.scope, col)
  return q
}

// ── Tool definitions (what Lexi sees) ────────────────────────────────────────
export const READ_TOOLS: Anthropic.Tool[] = [
  {
    name: 'daily_brief',
    description: 'Everything that needs the user today: their overdue and due-today tasks, today\'s scheduled jobs, open jobs with no tech, overdue jobs, sales deals stalled 15+ days, open system incidents, proposals expiring this week. Use for "brief me", "what\'s on today", "what needs me".',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'find_deals',
    description: 'Search sales deals (opportunities). Filter by text (deal or property name), stage (meet_present, survey, propose, negotiate, contract, deposit, won, lost), stalled (no update in 15+ days) or mine (assigned to the user).',
    input_schema: { type: 'object', properties: { query: { type: 'string' }, stage: { type: 'string' }, stalled: { type: 'boolean' }, mine: { type: 'boolean' }, limit: { type: 'number' } } },
  },
  {
    name: 'get_deal',
    description: 'Full detail for one deal by id: stage, value, dates, notes, open next steps, proposals, linked jobs.',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'find_work_orders',
    description: 'Search jobs / work orders. filter: open (default), unassigned, overdue (scheduled date passed), urgent (high/critical), stuck, today (scheduled today), done, all. Optional text query (WO number, title, site/customer, tech).',
    input_schema: { type: 'object', properties: { query: { type: 'string' }, filter: { type: 'string', enum: ['open', 'unassigned', 'overdue', 'urgent', 'stuck', 'today', 'done', 'all'] }, limit: { type: 'number' } } },
  },
  {
    name: 'get_work_order',
    description: 'Full detail for one work order by id: status, priority, site, tech, schedule, description, checklist progress, latest notes.',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'find_sites',
    description: 'Search properties / sites by name or city.',
    input_schema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } } },
  },
  {
    name: 'site_status',
    description: 'Health of one site\'s systems (gates, cameras, doors, network): devices online / offline, open incidents, open work orders. Pass site_id, or a name to look up.',
    input_schema: { type: 'object', properties: { site_id: { type: 'string' }, name: { type: 'string' } } },
  },
  {
    name: 'live_systems',
    description: 'LIVE status of a property\'s equipment right now, straight from the systems: Brivo doors/gates (with ids) and the latest access events, Eagle Eye cameras online/offline, Shelly relays (with device ids and on/off), and saved gate-reboot recipes. Use for "is the gate working", "which cameras are down at X", before opening a gate or power-cycling a relay, and to suggest a work order when something is offline. Give a site name or site_id.',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, site_id: { type: 'string' } } },
  },
  {
    name: 'find_tasks',
    description: 'Search to-dos / tasks. scope: mine (default) or team. due: overdue, today, week, any. Optional text query.',
    input_schema: { type: 'object', properties: { query: { type: 'string' }, scope: { type: 'string', enum: ['mine', 'team'] }, due: { type: 'string', enum: ['overdue', 'today', 'week', 'any'] }, limit: { type: 'number' } } },
  },
  {
    name: 'find_leads',
    description: 'Search sales leads by company or contact name. Only open (not lost) leads unless include_lost.',
    input_schema: { type: 'object', properties: { query: { type: 'string' }, include_lost: { type: 'boolean' }, limit: { type: 'number' } } },
  },
  {
    name: 'find_customers',
    description: 'Search customer accounts (companies) by name.',
    input_schema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } } },
  },
  {
    name: 'find_messages',
    description: 'Search the user\'s synced email threads by subject or person. unread: only threads with unread mail ("who\'s waiting on me").',
    input_schema: { type: 'object', properties: { query: { type: 'string' }, unread: { type: 'boolean' }, limit: { type: 'number' } } },
  },
  {
    name: 'find_products',
    description: 'Search the product catalog (cameras, gate operators, access control, intercoms, network, wire, labor) by name, model/SKU, brand or category. Returns sell price, dealer cost, margin, install labor hours, unit, warranty and accessories count. Use for "how much is…", "what do we sell for…", "find a camera that…", pricing a quote.',
    input_schema: { type: 'object', properties: { query: { type: 'string' }, category: { type: 'string' }, limit: { type: 'number' } } },
  },
  {
    name: 'waiting_on_me',
    description: 'Who is waiting on the user: email threads in their synced inbox where the LAST message came from someone else (they owe a reply), oldest wait first, with the linked deal if any. Skips automated senders. Use for "who\'s waiting on me", "what emails do I owe", "inbox", "follow-ups".',
    input_schema: { type: 'object', properties: { days: { type: 'number', description: 'Look back this many days (default 14).' }, limit: { type: 'number' } } },
  },
  {
    name: 'get_thread',
    description: 'Read one email thread from the user\'s own inbox by id: the last few messages (who said what), the linked deal, plus a few of the user\'s own recent sent emails as style samples. Use before drafting a reply so it sounds like the user. Lexi cannot send email yet — write the draft in the reply for the user to copy.',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'my_calendar',
    description: 'The user\'s calendar for the next N days (default 1 = today): Google Calendar events plus jobs scheduled to them.',
    input_schema: { type: 'object', properties: { days: { type: 'number' } } },
  },
  {
    name: 'nexus_help',
    description: 'How Nexus itself works: where things are and how to do something in the software (create a proposal, move a deal, assign a tech, add a site, set a tech\'s app code, use the Operations Hub, etc.). Use for any "how do I", "where is", "what does X do" question about Nexus.',
    input_schema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] },
  },
  {
    name: 'quickbooks_money',
    description: 'Gate Guard corporate only — the company books from QuickBooks: cash in the bank, money customers owe (aging buckets + the most-late customers), bills we owe, and profit & loss (this month, last month, year to date). view="overview" (default) for the picture; view="pnl" | "ar" | "ap" | "balance" for that full report (pnl takes optional start/end YYYY-MM-DD). Numbers are cached up to 30 minutes. Use for "how much cash do we have", "who owes us", "are we profitable this month".',
    input_schema: { type: 'object', properties: { view: { type: 'string', enum: ['overview', 'pnl', 'ar', 'ap', 'balance'] }, start: { type: 'string' }, end: { type: 'string' } } },
  },
  {
    name: 'search_manuals',
    description: 'Search equipment manuals and knowledge articles (gate operators, access control, cameras, wiring). Use for how-to, troubleshooting and spec questions.',
    input_schema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] },
  },
]
export const READ_TOOL_NAMES = new Set(READ_TOOLS.map(t => t.name))

// Friendly progress label for the UI while a tool runs.
export const TOOL_LABEL: Record<string, string> = {
  daily_brief: 'Pulling your day together', find_deals: 'Looking through deals', get_deal: 'Opening the deal',
  find_work_orders: 'Checking jobs', get_work_order: 'Opening the job', find_sites: 'Finding the property',
  site_status: 'Checking the systems', live_systems: 'Checking the live systems', find_tasks: 'Checking tasks', find_leads: 'Looking through leads',
  find_customers: 'Finding the customer', find_messages: 'Checking your inbox', waiting_on_me: 'Checking who’s waiting on you', find_products: 'Looking in the catalog', get_thread: 'Reading the email', my_calendar: 'Checking your calendar',
  search_manuals: 'Searching the manuals', quickbooks_money: 'Reading QuickBooks', nexus_help: 'Checking the Nexus guide',
}

// ── Shapers ──────────────────────────────────────────────────────────────────
const STAGE_LABEL: Record<string, string> = { meet_present: 'Meet', survey: 'Survey', propose: 'Proposal', negotiate: 'Negotiate', contract: 'Contract', deposit: 'Deposit', won: 'Won', lost: 'Lost' }
const OPEN_WO = ['open', 'scheduled', 'in_progress', 'procurement', 'stuck', 'on_hold']
const isUrgentWO = (w: Row) => ['critical', 'urgent', 'high'].includes(String(w.priority ?? '').toLowerCase())
function dealOut(d: Row) {
  const idle = daysAgo(d.updated_at)
  return { id: d.id, name: d.name, account: d.account_name ?? null, stage: STAGE_LABEL[d.stage] ?? d.stage, value: money(d.amount ?? d.tcv ?? d.est_setup), monthly: money(d.est_mrr ?? d.mrr), close_date: d.close_date ?? null, days_since_update: idle, stalled: idle != null && idle >= STALLED_DAYS && !['won', 'lost'].includes(d.stage) }
}
const dealCard = (d: Row): LexiCard => { const o = dealOut(d); return { kind: 'deal', id: d.id, title: o.name || o.account || 'Deal', sub: [o.stage, o.value, o.stalled ? `quiet ${o.days_since_update}d` : null].filter(Boolean).join(' · '), href: `/?tab=opps&deal=${d.id}`, tone: o.stalled ? 'orange' : 'blue' } }
function woOut(w: Row) {
  const sched = w.scheduled_date ? String(w.scheduled_date).slice(0, 10) : null
  const open = OPEN_WO.includes(String(w.status))
  return { id: w.id, number: w.wo_number ?? null, title: w.title ?? null, site: w.customer_name ?? w.property_name ?? null, status: w.status, priority: w.priority ?? null, tech: w.assignee_name ?? null, scheduled: sched, overdue: open && !!sched && sched < today(), age_days: daysAgo(w.created_at) }
}
const woCard = (w: Row): LexiCard => { const o = woOut(w); return { kind: 'work_order', id: w.id, title: [o.number, o.title].filter(Boolean).join(' · ') || 'Work order', sub: [o.site, o.tech ?? 'No tech', o.overdue ? `late (was ${o.scheduled})` : o.scheduled].filter(Boolean).join(' · '), href: `/maintenance/${w.id}`, tone: o.overdue || isUrgentWO(w) ? 'red' : 'blue' } }
const taskCard = (t: Row): LexiCard => ({ kind: 'task', id: t.id, title: t.title, sub: [t.due_date ? `due ${t.due_date}` : null, t.assigned_to_name, t.linked_label].filter(Boolean).join(' · '), href: `/?task=${t.id}`, tone: t.due_date && t.due_date < today() ? 'red' : 'blue' })

// ── Runners ──────────────────────────────────────────────────────────────────
export async function runReadTool(name: string, input: Row, ctx: LexiCtx): Promise<ToolOut> {
  switch (name) {
    case 'find_deals': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = scopeDeals(sb.from('opportunities').select('*').is('deleted_at', null), ctx.deals)
      if (has(input.query)) q = q.or(`name.ilike.${like(input.query)},account_name.ilike.${like(input.query)}`)
      if (has(input.stage)) q = q.eq('stage', input.stage)
      else q = q.not('stage', 'in', '(won,lost)')
      if (input.mine) q = q.eq('rep_id', ctx.deals.profileId ?? NO_MATCH)
      if (input.stalled) q = q.lt('updated_at', new Date(Date.now() - STALLED_DAYS * 86400000).toISOString())
      const { data, error } = await q.order('updated_at', { ascending: false }).limit(clamp(input.limit, 10))
      if (error) return { data: { error: error.message } }
      const rows = (data ?? []) as Row[]
      return { data: rows.map(dealOut), cards: rows.slice(0, 6).map(dealCard) }
    }
    case 'get_deal': {
      const { data: d } = await scopeDeals(sb.from('opportunities').select('*').eq('id', String(input.id)).is('deleted_at', null), ctx.deals).maybeSingle()
      if (!d) return { data: { error: 'Deal not found or not visible to you.' } }
      const [acts, quotes, jobs] = await Promise.all([
        sb.from('crm_activities').select('type, subject, due_at, completed_at').eq('opportunity_id', d.id).order('due_at', { ascending: true }).limit(8),
        sb.from('quotes').select('id, title, status, total_one_time, total_mrr, quote_mode, created_at').eq('opportunity_id', d.id).order('created_at', { ascending: false }).limit(5),
        sb.from('work_orders').select('id, wo_number, title, status').eq('opportunity_id', d.id).limit(5),
      ])
      return {
        data: { ...dealOut(d), notes: d.notes ?? null, next_steps: (acts.data ?? []).filter((a: Row) => !a.completed_at), proposals: quotes.data ?? [], jobs: jobs.data ?? [] },
        cards: [dealCard(d)],
      }
    }
    case 'find_work_orders': {
      const f = String(input.filter ?? 'open')
      let q = scoped('work_orders', '*', ctx)
      if (f === 'done') q = q.eq('status', 'completed')
      else if (f !== 'all') q = q.in('status', OPEN_WO)
      if (f === 'unassigned') q = q.is('assignee_id', null)
      if (f === 'overdue') q = q.lt('scheduled_date', today())
      if (f === 'stuck') q = q.in('status', ['stuck', 'on_hold'])
      if (f === 'today') q = q.gte('scheduled_date', today()).lt('scheduled_date', `${today()}T23:59:59`)
      if (f === 'urgent') q = q.in('priority', ['critical', 'urgent', 'high'])
      if (has(input.query)) q = q.or(`wo_number.ilike.${like(input.query)},title.ilike.${like(input.query)},customer_name.ilike.${like(input.query)},assignee_name.ilike.${like(input.query)}`)
      const { data, error } = await q.order('created_at', { ascending: false }).limit(clamp(input.limit, 12))
      if (error) return { data: { error: error.message } }
      const rows = (data ?? []) as Row[]
      return { data: rows.map(woOut), cards: rows.slice(0, 6).map(woCard) }
    }
    case 'get_work_order': {
      const { data: w } = await scoped('work_orders', '*', ctx).eq('id', String(input.id)).maybeSingle()
      if (!w) return { data: { error: 'Work order not found or not visible to you.' } }
      const [cl, cm] = await Promise.all([
        sb.from('wo_checklist_items').select('title, completed').eq('work_order_id', w.id).limit(40),
        sb.from('wo_comments').select('content, author_name, created_at').eq('work_order_id', w.id).order('created_at', { ascending: false }).limit(5),
      ])
      const items = (cl.data ?? []) as Row[]
      const done = items.filter(i => i.completed).length
      return { data: { ...woOut(w), description: w.description ?? w.notes ?? null, checklist: `${done}/${items.length} done`, latest_notes: cm.data ?? [] }, cards: [woCard(w)] }
    }
    case 'find_sites': {
      let q = scoped('sites', 'id, name, city, state, status, units', ctx, 'site')
      if (has(input.query)) q = q.or(`name.ilike.${like(input.query)},city.ilike.${like(input.query)}`)
      const { data, error } = await q.order('name').limit(clamp(input.limit, 10))
      if (error) return { data: { error: error.message } }
      const rows = (data ?? []) as Row[]
      return { data: rows, cards: rows.slice(0, 6).map(s => ({ kind: 'site', id: s.id, title: s.name, sub: [s.city, s.state].filter(Boolean).join(', ') + (s.units ? ` · ${s.units} units` : ''), href: `/sites/${s.id}` })) }
    }
    case 'site_status': {
      let site: Row | null = null
      if (has(input.site_id)) site = (await scoped('sites', 'id, name, city, state, status, units', ctx, 'site').eq('id', String(input.site_id)).maybeSingle()).data
      else if (has(input.name)) site = ((await scoped('sites', 'id, name, city, state, status, units', ctx, 'site').ilike('name', like(input.name)).limit(1)).data ?? [])[0] ?? null
      if (!site) return { data: { error: 'Site not found or not visible to you.' } }
      const [assets, inc, wos] = await Promise.all([
        sb.from('site_assets').select('product_category, product_name, status, last_seen_at, offline_since').eq('site_id', site.id).limit(400),
        sb.from('incidents').select('title, severity, status, created_at').eq('site_id', site.id).neq('status', 'resolved').order('created_at', { ascending: false }).limit(10),
        sb.from('work_orders').select('id, wo_number, title, status, priority, assignee_name, scheduled_date, customer_name, created_at').eq('site_id', site.id).in('status', OPEN_WO).limit(10),
      ])
      const a = (assets.data ?? []) as Row[]
      const byStatus: Record<string, number> = {}
      for (const x of a) byStatus[String(x.status ?? 'unknown')] = (byStatus[String(x.status ?? 'unknown')] ?? 0) + 1
      const offline = a.filter(x => /offline|down|fault/i.test(String(x.status))).slice(0, 10).map(x => ({ device: x.product_name, category: x.product_category, offline_since: x.offline_since ?? x.last_seen_at }))
      return {
        data: { site: site.name, devices: a.length, by_status: byStatus, offline, open_incidents: inc.data ?? [], open_work_orders: ((wos.data ?? []) as Row[]).map(woOut) },
        cards: [{ kind: 'site', id: site.id, title: site.name, sub: `${a.length} devices · ${offline.length} offline · ${(inc.data ?? []).length} open incidents`, href: `/sites/${site.id}`, tone: offline.length || (inc.data ?? []).length ? 'red' : 'green' }],
      }
    }
    case 'live_systems': {
      let site: Row | null = null
      if (has(input.site_id)) site = (await scoped('sites', 'id, name, city, state', ctx, 'site').eq('id', String(input.site_id)).maybeSingle()).data
      else if (has(input.name)) site = ((await scoped('sites', 'id, name, city, state', ctx, 'site').ilike('name', like(input.name)).limit(1)).data ?? [])[0] ?? null
      if (!site) return { data: { error: 'Site not found or not visible to you.' } }
      const sid = String(site.id)
      // Each system on its own, with a time limit — one slow vendor never blocks the answer.
      const within = <T,>(p: Promise<T>, ms = 7000) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timed out')), ms))])
      const tryIt = async <T,>(f: () => Promise<T>): Promise<{ ok: true; v: T } | { ok: false; err: string }> => { try { return { ok: true, v: await within(f()) } } catch (e) { return { ok: false, err: e instanceof Error ? e.message : 'unavailable' } } }
      // Each system only for people allowed to operate it (dealer techs may have some, not all).
      const [canDoors, canCams, canRelays] = await Promise.all([canOperate(ctx.user, sid, 'doors'), canOperate(ctx.user, sid, 'cameras'), canOperate(ctx.user, sid, 'relays')])
      const denied = async (): Promise<never> => { throw new Error('not allowed for your account') }
      const [doors, events, cams, relays, reboots] = await Promise.all([
        tryIt(async () => { if (!canDoors) return denied(); const { token, apiKey } = await getSiteBrivoToken(sid); return listBrivoDoors(token, apiKey) }),
        tryIt(() => (canDoors ? listSiteBrivoEvents(sid, 8) : denied())),
        tryIt(async () => { if (!canCams) return denied(); const { token, baseHost } = await getSiteEagleEyeAccess(sid); return listEagleEyeCameras(token, baseHost) }),
        tryIt(() => (canRelays ? listSiteShellyRelays(sid) : denied())),
        tryIt(async () => { const { data, error } = await sb.from('gate_reboots').select('id, name, wait_seconds').eq('site_id', sid).limit(20); if (error) throw new Error(error.message); return data ?? [] }),
      ])
      const notSet = (r: { ok: boolean; err?: string }) => (!r.ok && /not (set|configured|connected)|no .*(creds|credentials|connection)|missing/i.test(r.err ?? '') ? 'not connected' : !r.ok ? `unavailable (${r.err})` : null)
      const camList = cams.ok ? cams.v : []
      const offlineCams = camList.filter(c => c.online === false).map(c => c.name)
      const data = {
        site: site.name, site_id: sid, checked_at: new Date().toISOString(),
        doors: doors.ok ? doors.v : notSet(doors),
        recent_access_events: events.ok ? events.v : notSet(events),
        cameras: cams.ok ? { total: camList.length, online: camList.filter(c => c.online === true).length, offline: offlineCams } : notSet(cams),
        relays: relays.ok ? relays.v.map(r => ({ device_id: r.id, name: r.name, channel: r.channel, on: r.on })) : notSet(relays),
        gate_reboot_recipes: reboots.ok ? reboots.v : [],
        suggestion: offlineCams.length ? `${offlineCams.length} camera(s) offline — offer to create a work order if there isn't an open one.` : null,
      }
      const problems = offlineCams.length + (relays.ok ? relays.v.filter(r => r.on === null).length : 0)
      return { data, cards: [{ kind: 'site', id: sid, title: `${site.name} — live`, sub: [doors.ok ? `${doors.v.length} doors` : null, cams.ok ? `${camList.length - offlineCams.length}/${camList.length} cameras online` : null, relays.ok ? `${relays.v.length} relays` : null].filter(Boolean).join(' · ') || 'No systems connected', href: `/sites/${sid}`, tone: problems ? 'red' : 'green' }] }
    }
    case 'find_tasks': {
      let q = scoped('todos', 'id, title, status, priority, due_date, assigned_to, assigned_to_name, created_by, linked_label', ctx).not('status', 'in', '(done,completed,cancelled)')
      if ((input.scope ?? 'mine') === 'mine') q = q.or(`assigned_to.eq.${ctx.user.id},created_by.eq.${ctx.user.id}`)
      const due = String(input.due ?? 'any')
      if (due === 'overdue') q = q.lt('due_date', today())
      if (due === 'today') q = q.eq('due_date', today())
      if (due === 'week') q = q.lte('due_date', addDaysISO(today(), 7))
      if (has(input.query)) q = q.ilike('title', like(input.query))
      const { data, error } = await q.order('due_date', { ascending: true, nullsFirst: false }).limit(clamp(input.limit, 15))
      if (error) return { data: { error: error.message } }
      const rows = (data ?? []) as Row[]
      return { data: rows, cards: rows.slice(0, 6).map(taskCard) }
    }
    case 'find_leads': {
      let q = scoped('leads', 'id, company_name, contact_name, email, phone, stage, source, unit_count, location, created_at', ctx).is('deleted_at', null)
      if (!input.include_lost) q = q.not('stage', 'eq', 'lost')
      if (has(input.query)) q = q.or(`company_name.ilike.${like(input.query)},contact_name.ilike.${like(input.query)}`)
      const { data, error } = await q.order('created_at', { ascending: false }).limit(clamp(input.limit, 10))
      if (error) return { data: { error: error.message } }
      const rows = (data ?? []) as Row[]
      return { data: rows, cards: rows.slice(0, 6).map(l => ({ kind: 'lead', id: l.id, title: l.company_name || l.contact_name || 'Lead', sub: [l.contact_name, l.stage, l.location].filter(Boolean).join(' · '), href: `/crm/leads/${l.id}` })) }
    }
    case 'find_customers': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = sb.from('organizations').select('*')
      if (!ctx.scope.all) q = ctx.scope.ids.length ? q.in('id', ctx.scope.ids) : q.eq('id', NO_MATCH)
      if (has(input.query)) q = q.ilike('name', like(input.query))
      const { data, error } = await q.order('name').limit(clamp(input.limit, 10))
      if (error) return { data: { error: error.message } }
      const rows = (data ?? []) as Row[]
      return { data: rows, cards: rows.slice(0, 6).map(o => ({ kind: 'customer', id: o.id, title: o.name, sub: [o.org_tier ?? o.tier, o.city, o.state].filter(Boolean).join(' · '), href: `/customers/${o.id}` })) }
    }
    case 'find_messages': {
      // Own mailbox only.
      let q = sb.from('message_threads').select('id, subject, participants, last_message_at, unread_count, linked_opportunity_id').eq('user_id', ctx.user.id)
      if (input.unread) q = q.gt('unread_count', 0)
      if (has(input.query)) q = q.ilike('subject', like(input.query))
      const { data, error } = await q.order('last_message_at', { ascending: false }).limit(clamp(input.limit, 10))
      if (error) return { data: { error: error.message } }
      const rows = (data ?? []) as Row[]
      return { data: rows, cards: rows.slice(0, 6).map(t => ({ kind: 'thread', id: t.id, title: t.subject || '(no subject)', sub: [Array.isArray(t.participants) ? t.participants.slice(0, 2).join(', ') : null, t.unread_count ? `${t.unread_count} unread` : null].filter(Boolean).join(' · '), href: '/?tab=my-day', tone: t.unread_count ? 'orange' : 'blue' })) }
    }
    case 'find_products': {
      // Global catalog (org_id null) plus the caller's own companies' private items.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = sb.from('products').select('*').eq('active', true)
      if (!ctx.scope.all) q = ctx.scope.ids.length ? q.or(`org_id.is.null,org_id.in.(${ctx.scope.ids.join(',')})`) : q.is('org_id', null)
      if (has(input.query)) q = q.or(`name.ilike.${like(input.query)},sku.ilike.${like(input.query)},brand.ilike.${like(input.query)},subcategory.ilike.${like(input.query)}`)
      if (has(input.category)) q = q.ilike('category', like(input.category))
      const { data, error } = await q.order('name').limit(clamp(input.limit, 10))
      if (error) return { data: { error: error.message } }
      const rows = (data ?? []) as Row[]
      const out = rows.map(p => {
        const sell = Number(p.sell_price) || 0, cost = Number(p.dealer_cost) || 0
        return { id: p.id, name: p.name, sku: p.sku, brand: p.brand, category: p.category, sell_price: money(sell), dealer_cost: money(cost), margin_pct: sell > 0 && cost > 0 ? Math.round(((sell - cost) / sell) * 100) : null, msrp: money(p.msrp), labor_hours: p.labor_hours ?? null, unit: p.unit ?? 'each', warranty_months: p.warranty_months ?? null, accessories: Array.isArray(p.accessories) ? p.accessories.length : 0, has_manual: !!p.manual_url }
      })
      return { data: out, cards: out.slice(0, 6).map(p => ({ kind: 'product', id: p.id, title: p.name, sub: [p.brand, p.sku, p.sell_price].filter(Boolean).join(' · '), href: `/?tab=catalog&product=${p.id}` })) }
    }
    case 'waiting_on_me': {
      const days = clamp(input.days, 14, 60)
      const since = new Date(Date.now() - days * 86400000).toISOString()
      const { data: th, error } = await sb.from('message_threads').select('*').eq('user_id', ctx.user.id).gte('last_message_at', since).order('last_message_at', { ascending: false }).limit(80)
      if (error) return { data: { error: error.message } }
      const threads = (th ?? []) as Row[]
      if (!threads.length) return { data: { waiting: [], note: 'No email in the last ' + days + ' days. Is Gmail connected (Settings → Connections)?' } }
      const { data: ms, error: mErr } = await sb.from('messages').select('thread_id, direction, from_name, from_address, subject, body, created_at, sent_at').in('thread_id', threads.map(t => t.id)).order('created_at', { ascending: false }).limit(400)
      if (mErr) return { data: { error: mErr.message } }
      const last = new Map<string, Row>()
      for (const m of (ms ?? []) as Row[]) if (!last.has(m.thread_id)) last.set(m.thread_id, m)
      const BOT = /(no-?reply|do-?not-?reply|notifications?@|mailer-daemon|postmaster|bounce|newsletter|marketing@|@.*\.(hubspot|mailchimp|sendgrid)\.)/i
      const waiting = threads.map(t => ({ t, m: last.get(t.id) }))
        .filter(x => x.m && x.m.direction === 'inbound' && !BOT.test(String(x.m.from_address ?? '')))
        .map(({ t, m }) => ({ id: t.id, subject: t.subject || m!.subject || '(no subject)', from: m!.from_name || m!.from_address, from_address: m!.from_address, waiting_since: m!.sent_at ?? m!.created_at, waiting_days: daysAgo(m!.sent_at ?? m!.created_at), preview: String(m!.body ?? '').replace(/\s+/g, ' ').slice(0, 220), deal_id: t.linked_opportunity_id ?? (t.linked_type === 'opportunity' ? t.linked_id : null), linked: t.linked_label ?? null }))
        .sort((a, b) => String(a.waiting_since).localeCompare(String(b.waiting_since)))
        .slice(0, clamp(input.limit, 12))
      return { data: { waiting, count: waiting.length }, cards: waiting.slice(0, 6).map(w => ({ kind: 'thread', id: w.id, title: w.subject, sub: [w.from, w.waiting_days != null ? `waiting ${w.waiting_days === 0 ? 'since today' : `${w.waiting_days}d`}` : null].filter(Boolean).join(' · '), href: '/messages', tone: (w.waiting_days ?? 0) >= 2 ? 'orange' : 'blue' })) }
    }
    case 'get_thread': {
      if (!has(input.id)) return { data: { error: 'id is required' } }
      const { data: t, error } = await sb.from('message_threads').select('*').eq('id', input.id).eq('user_id', ctx.user.id).maybeSingle()
      if (error) return { data: { error: error.message } }
      if (!t) return { data: { error: 'That thread isn’t in your inbox.' } }
      const [msgs, sent] = await Promise.all([
        sb.from('messages').select('direction, from_name, from_address, subject, body, created_at, sent_at').eq('thread_id', t.id).order('created_at', { ascending: false }).limit(6),
        sb.from('messages').select('body, thread_id, message_threads!inner(user_id)').eq('direction', 'outbound').eq('message_threads.user_id', ctx.user.id).order('created_at', { ascending: false }).limit(4),
      ])
      const clean = (b: unknown) => String(b ?? '').split(/\n\s*(On .+wrote:|-----Original Message-----|From: )/)[0].replace(/\s+\n/g, '\n').trim().slice(0, 1800)
      return {
        data: {
          subject: t.subject, deal_id: t.linked_opportunity_id ?? (t.linked_type === 'opportunity' ? t.linked_id : null), linked: t.linked_label ?? null,
          messages: ((msgs.data ?? []) as Row[]).reverse().map(m => ({ from: m.direction === 'outbound' ? 'the user' : (m.from_name || m.from_address), from_address: m.direction === 'outbound' ? undefined : m.from_address, at: m.sent_at ?? m.created_at, text: clean(m.body) })),
          your_style_samples: sent.error ? [] : ((sent.data ?? []) as Row[]).map(m => clean(m.body).slice(0, 500)).filter(Boolean),
        },
        cards: [{ kind: 'thread', id: t.id, title: t.subject || '(no subject)', sub: t.linked_label ?? 'Email thread', href: '/messages', tone: 'blue' }],
      }
    }
    case 'my_calendar': {
      const days = clamp(input.days, 1, 14)
      // Days are Eastern-time days (the server runs in UTC).
      const startDay = today(), endDay = addDaysISO(startDay, days)
      const start = etMidnight(startDay), end = etMidnight(endDay)
      const [ev, wos] = await Promise.all([
        sb.from('gcal_events').select('id, title, start_time, end_time, is_all_day, location').eq('user_id', ctx.user.id).gte('start_time', start.toISOString()).lt('start_time', end.toISOString()).order('start_time').limit(40),
        scoped('work_orders', '*', ctx).gte('scheduled_date', startDay).lt('scheduled_date', endDay).in('status', OPEN_WO).limit(40),
      ])
      const events = (ev.data ?? []) as Row[]
      const jobs = ((wos.data ?? []) as Row[]).map(woOut)
      return { data: { events, scheduled_jobs: jobs }, cards: events.slice(0, 5).map(e => ({ kind: 'event', id: e.id, title: e.title || 'Event', sub: e.is_all_day ? 'All day' : new Date(e.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }), href: '/?tab=my-day' })) }
    }
    case 'nexus_help': {
      const q = String(input.question ?? '')
      const sections = searchGuide(q, 3)
      // Plus the Help tab's how-to articles (kb_articles, "Platform How-To").
      const words = q.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3).slice(0, 4)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let aq: any = sb.from('kb_articles').select('id, title, description, content').eq('category', 'Platform How-To').limit(3)
      if (words.length) aq = aq.or(words.map(w => `title.ilike.%${w}%,content.ilike.%${w}%`).join(','))
      const { data: arts } = await aq
      return {
        data: {
          guide: sections.map(x => ({ title: x.title, where: x.where, how: x.text })),
          help_articles: ((arts ?? []) as Row[]).map(a => ({ title: a.title, text: String(a.content ?? a.description ?? '').slice(0, 1500) })),
        },
      }
    }
    case 'quickbooks_money': {
      if (!ctx.user.isCorporate) return { data: { error: 'QuickBooks numbers are only for Gate Guard corporate.' } }
      const view = String(input.view ?? 'overview')
      if (view === 'overview') {
        const r = await overview()
        if (!r.ok) return { data: { error: r.error } }
        return { data: r.data, cards: [{ kind: 'customer', id: 'qbo', title: 'QuickBooks', sub: `Cash ${money(r.data.cash.total)} · Owed to us ${money(r.data.receivable.total)}`, href: '/?view=admin&qb=1', tone: r.data.receivable.over90 > 0 ? 'orange' : 'green' }] }
      }
      const t = today()
      const ymd = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
      const map = { pnl: ['ProfitAndLoss', { start_date: ymd(input.start) ?? `${t.slice(0, 7)}-01`, end_date: ymd(input.end) ?? t }], ar: ['AgedReceivables', { report_date: t }], ap: ['AgedPayables', { report_date: t }], balance: ['BalanceSheet', { end_date: t }] } as const
      const m = map[view as keyof typeof map]
      if (!m) return { data: { error: `Unknown view ${view}` } }
      const r = await getReport(m[0], { ...m[1] })
      if (!r.ok) return { data: { error: r.error } }
      return { data: { ...r.report, rows: r.report.rows.slice(0, 120) } }
    }
    case 'search_manuals': {
      try {
        const hits = await searchKnowledge(String(input.question ?? ''), undefined, 6)
        return { data: hits.map(h => ({ product: h.product_name, section: h.section_title, page: h.page_number, text: String(h.content).slice(0, 900), manual_url: h.manual_url })), cards: hits.slice(0, 3).map(h => ({ kind: 'manual', id: h.id, title: h.product_name || 'Manual', sub: [h.section_title, h.page_number ? `p. ${h.page_number}` : null].filter(Boolean).join(' · '), href: h.manual_url ?? undefined })) }
      } catch (e) {
        return { data: { error: e instanceof Error ? e.message : 'Manual search failed.' } }
      }
    }
    case 'daily_brief': {
      const t = today()
      const week = addDaysISO(today(), 7)
      const stalledCut = new Date(Date.now() - STALLED_DAYS * 86400000).toISOString()
      const [tasks, todayJobs, unassigned, overdue, stalled, incidents, quotes] = await Promise.all([
        scoped('todos', 'id, title, status, priority, due_date, assigned_to_name, linked_label', ctx).not('status', 'in', '(done,completed,cancelled)').or(`assigned_to.eq.${ctx.user.id},created_by.eq.${ctx.user.id}`).lte('due_date', t).order('due_date').limit(10),
        scoped('work_orders', '*', ctx).gte('scheduled_date', t).lt('scheduled_date', `${t}T23:59:59`).in('status', OPEN_WO).limit(10),
        scoped('work_orders', '*', ctx).in('status', OPEN_WO).is('assignee_id', null).order('created_at', { ascending: false }).limit(10),
        scoped('work_orders', '*', ctx).in('status', OPEN_WO).lt('scheduled_date', t).limit(10),
        scopeDeals(sb.from('opportunities').select('*').is('deleted_at', null), ctx.deals).not('stage', 'in', '(won,lost)').lt('updated_at', stalledCut).order('updated_at').limit(8),
        scoped('incidents', 'id, title, severity, status, site_id, created_at', ctx).neq('status', 'resolved').order('created_at', { ascending: false }).limit(8),
        scoped('quotes', 'id, title, status, valid_until, total_one_time, total_mrr', ctx).eq('status', 'sent').gte('valid_until', t).lte('valid_until', week).limit(8),
      ])
      const T = (tasks.data ?? []) as Row[], TJ = (todayJobs.data ?? []) as Row[], U = (unassigned.data ?? []) as Row[], O = (overdue.data ?? []) as Row[], S = (stalled.data ?? []) as Row[]
      return {
        data: {
          date: t,
          my_tasks_due_or_overdue: T.map(x => ({ id: x.id, title: x.title, due: x.due_date, linked: x.linked_label })),
          jobs_scheduled_today: TJ.map(woOut),
          jobs_needing_a_tech: U.map(woOut),
          jobs_overdue: O.map(woOut),
          deals_stalled: S.map(dealOut),
          open_incidents: incidents.data ?? [],
          proposals_expiring_this_week: quotes.data ?? [],
        },
        cards: [...O.slice(0, 2).map(woCard), ...U.slice(0, 2).map(woCard), ...S.slice(0, 2).map(dealCard), ...T.slice(0, 2).map(taskCard)],
      }
    }
    default:
      return { data: { error: `Unknown tool ${name}` } }
  }
}

/** Counts for the Lexi home cards (no AI). */
export async function briefCounts(ctx: LexiCtx) {
  const out = await runReadTool('daily_brief', {}, ctx)
  const d = out.data as Row
  return {
    tasks: d.my_tasks_due_or_overdue?.length ?? 0,
    today: d.jobs_scheduled_today?.length ?? 0,
    unassigned: d.jobs_needing_a_tech?.length ?? 0,
    overdue: d.jobs_overdue?.length ?? 0,
    stalled: d.deals_stalled?.length ?? 0,
    incidents: d.open_incidents?.length ?? 0,
    expiring: d.proposals_expiring_this_week?.length ?? 0,
    cards: out.cards ?? [],
  }
}
