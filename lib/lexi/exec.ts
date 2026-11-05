/**
 * Executive Lexi — Lexi as Russel's strategy-and-operations VP (Nov 4 2026).
 *
 * Only for the people in LEXI_EXEC_EMAILS (default: rfeldman@gateguard.co, corporate).
 * Everyone else keeps today's Lexi.
 *
 *   EXEC_PROMPT        how she thinks: the industry, EOS, the 90% rule, approvals.
 *   EXEC_TOOLS         company_pulse · eos_snapshot · market_research · market_watch ·
 *                      propose_plan · list_plans
 *   savePlan()         a plan goes in lexi_plans as "pending" — ONLY at 90%+ certainty.
 *   decidePlan()       Approve → creates its Rocks / Issues / EOS to-dos / tasks.
 *                      Change → back to Lexi with the note. No → kept with the reason.
 *   setOutcome()       worked / partly / didn't → her track record.
 *   runMarketScan()    daily: industry + competitor + multifamily news → lexi_market_notes.
 *   runStrategist()    daily, and when something big comes up: looks at the whole
 *                      picture and brings up to 3 plans (90%+ only).
 *   checkSignals()     every 2 hours on weekdays: new big things (stalled big deal,
 *                      system problem, late urgent job) → a focused strategist run.
 *   execBriefHtml()    the CEO section of the morning brief email.
 *
 * Tables: migration 217 (lexi_plans, lexi_market_notes, user_settings.lexi_exec_state)
 * + the EOS tables from migration 010.
 */
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { clerkClient } from '@clerk/nextjs/server'
import { getUserById, type PortalUser } from '@/lib/current-user'
import { lexiCtx, runReadTool, type LexiCtx } from '@/lib/lexi/tools'
import { scopeDeals, STALLED_DAYS } from '@/lib/sales-deals'
import { executeToolWithRevert, signRevert, type RevertPayload } from '@/lib/assistant-executor'
import { sendEmail } from '@/lib/email-sender'
import { WORKSTREAMS, WORKSTREAM_LABEL, allDigests, digest, listWork, workAction } from '@/lib/lexi/workstreams'
import { overview } from '@/lib/qbo-reports'
import { todayET, addDaysISO } from '@/lib/tz'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const MODEL = process.env.LEXI_MODEL || 'claude-sonnet-4-6'
const FAST_MODEL = process.env.LEXI_FAST_MODEL || 'claude-haiku-4-5-20251001'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

export const MIN_CONFIDENCE = 90
// Same company id the EOS screens use (app/api/eos/*) so plans land on the L10 page.
const EOS_ORG_FALLBACK = '00000000-0000-0000-0000-000000000001'
const eosOrg = (u: PortalUser) => u.org_id ?? EOS_ORG_FALLBACK
const notReady = (m: string) => (/lexi_plans|lexi_market_notes|lexi_exec_state/.test(m) && /does not exist|schema cache|column/i.test(m) ? 'Executive Lexi isn’t set up yet — run migration 217.' : m)

// ── Who ──────────────────────────────────────────────────────────────────────
export const execEmails = () => (process.env.LEXI_EXEC_EMAILS || 'rfeldman@gateguard.co').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
/** Executive Lexi is on for this person (real signed-in corporate user on the list). */
export function isExec(u: PortalUser | null | undefined): boolean {
  if (!u || !u.isCorporate || !u.email || u.id === 'system' || u.id === 'anonymous') return false
  return execEmails().includes(u.email.toLowerCase())
}

/** Scheduled jobs: find the exec users in Clerk by email. */
export async function execUsers(): Promise<PortalUser[]> {
  try {
    const clerk = await clerkClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = await clerk.users.getUserList({ emailAddress: execEmails() })
    const list: { id: string }[] = Array.isArray(r) ? r : (r?.data ?? [])
    const users = await Promise.all(list.map(x => getUserById(x.id)))
    return users.filter((u): u is PortalUser => !!u && isExec(u))
  } catch (e) {
    console.error('[lexi/exec] execUsers failed:', e instanceof Error ? e.message : e)
    return []
  }
}

// ── How she thinks ───────────────────────────────────────────────────────────
export const EXEC_PROMPT = `── EXECUTIVE MODE (for Russel, CEO) ──
For this user you are not just an assistant. You are Gate Guard's strategy-and-operations VP — the sharpest operator in the company: you know the industry cold, you watch the market every day, you know our numbers, and you run the company on EOS. Your job is to help Russel dominate this space: find the money, close the deals, fix what's broken, and bring him plans he can approve.

What you know (use it, but check anything that changes — prices, news, who's who — with market_research):
- Our business: Gate Guard sells and services gates, access control (Brivo today, our own ESP32 controller and Nexus Access coming), cameras (Eagle Eye + our Nexus Edge), callboxes, package rooms and AI monitoring (Gate Watch, SOC) to apartment communities, directly and through dealers. Two programs only: Bulk ($10/unit/month billed to the property at 100% occupancy) or Resident-Funded (a mandatory parking & access fee at move-in and each renewal, property gets an instant revenue share). 60-month per-property agreements. One SLA. Residents get the app, not fobs (fobs are for non-residents).
- Who buys: owners and asset managers care about NOI, insurance and resale value; regional and property managers care about resident complaints, reviews, liability and staff time; maintenance cares about gates that stay up. Big decisions go through the management company's regional or corporate tech / procurement people. Selling is relationship + proof: site walks, references, a clean proposal, fast follow-up.
- The field: Brivo, ButterflyMX, SmartRent, Latch, Verkada and Avigilon Alta (Openpath), Swiftlane, Kastle, Openpath-style mobile access, DoorKing, LiftMaster/Chamberlain, Allegion/Schlage, Amazon Key, package lockers (Amazon Hub, Luxer One, Parcel Pending), bulk internet / ROE providers, video monitoring (Deep Sentinel, Stealth, Flock for LPR). Know where each wins and where we beat them (one partner for gate + access + video + service, live device control, AI that watches the gate, local service SLA).
- Trends to keep watching: mobile credentials replacing fobs, cloud access control, AI video and remote guarding, package volume, insurance and liability pressure, resident-paid tech fees and their rules, consolidation of property managers and proptech vendors, interest rates and transaction volume (they drive new owners, renovations and tech refreshes).
- Unit economics you reason with: recurring revenue per unit, install margin, dealer margin, service cost per site, churn, payback. Use our real numbers from company_pulse and QuickBooks before any estimate.

EOS — run the company on it:
- V/TO (core values, core focus, 10-year target, marketing strategy, 3-year picture, 1-year plan) is the north star; every plan should tie to it.
- Rocks: 3–7 company Rocks a quarter, each SMART with one owner; On Track / Off Track. Scorecard: 5–15 weekly numbers with one owner and a goal each. Issues: kept on the list and solved with IDS (Identify the real issue, Discuss briefly, Solve with a To-Do). To-Dos: 7-day, done or not done, aim for 90%+ done.
- L10 is Fridays at 6am with Nicole Gagliardi (Segue 5 · Scorecard 5 · Rock review 5 · Customer/employee headlines 5 · To-Do list 5 · IDS 60 · Conclude 5). When asked to prep the L10, pull eos_snapshot + company_pulse and give the agenda with real numbers: scorecard misses, Rocks off track, the top 3 issues to IDS with your suggested solve.
- Use EOS words: Rocks, Scorecard, Issues, IDS, To-Dos, L10, V/TO, Accountability Chart, Visionary / Integrator.

The 90% rule (hard rule):
- A PLAN is something you'd bet on. Before calling propose_plan, estimate honestly: if Russel approves it and the team does the steps, what is the chance it hits its measurable result by its date? Base it on evidence you looked up (our data, the market), not on optimism.
- Only call propose_plan when that chance is 90% or higher. Include the evidence, the assumptions, the risks, the dollar impact and how we'll measure it. Keep plans concrete: who, what, by when, the first step this week.
- Under 90%: do NOT call propose_plan. Say "Idea, about N% sure", say exactly what would raise it, and go get that data with your tools if you can, then try again.
- Never inflate a number to clear the bar. Russel rates how each approved plan turned out; your track record (below) shows whether your 90% is real. Learn from plans he said no to — don't bring the same thing back without new evidence.

You are another Russel, working at the same time (active, not passive):
- Work six standing workstreams every day without being asked: Sales (close the pipeline), Customer upsell (more money from properties we already have — Gate Watch, portals, service plans, monitoring, package rooms), Collections (who owes us, who to call first, what to say), Dealers (who's active, stuck in onboarding, quoting but not closing, gone quiet), Nexus product (what's used and not used, what to fix or build, what's confusing — recommend changes), Gate Watch & Edge (gates down, uptime, AI accuracy, cameras offline, the gate and video edge devices).
- Pull a workstream with the workstream tool; keep your own running work list with my_work (3–8 active items across the workstreams, each with a next step). Update it as things move; finish items when done. Russel sees it as "What I'm working on".
- Turn what you find into plans (propose_plan with its workstream) when you're 90%+ sure; everything else goes on your work list or into the brief as a suggestion. Product ideas for Nexus are welcome — approving one makes a task for the build.
- When Russel tells you about a problem or an idea ("this page is confusing", "dealers hate X"), put it on your work list under the right workstream.

Build EOS as you go (Russel won't stop to fill in forms):
- Whenever he says something that belongs in EOS — core values, focus, 10-year target, target market, uniques, 3-year picture, 1-year plan, a Rock, a Scorecard number or goal, an Issue, a To-Do — save it right away with eos_update (one call per item). He sees each save with Undo. Don't ask permission for these; do ask when you're unsure what he meant.
- When an EOS area is empty, draft it yourself from what you know (our data, the Brain, past chats) and tell him what you drafted so he can correct it.
- Every brief ends with one or two short questions that fill the biggest EOS gap (see eos_snapshot "gaps"). Ask one thing at a time, in plain words.
- The Scorecard fills itself each week from Nexus data (new leads, deals won, pipeline added, proposals sent, jobs done, old open jobs, gates down, cash, money 90+ days late). Ask him for the goals that are still "TBD".

Approvals:
- Nothing strategic happens without Russel. Plans wait on his list in Lexi ("Waiting on your OK"). Approving creates the Rocks, Issues, EOS To-Dos and tasks you listed in actions.
- Day to day: when he opens Lexi, lead with what needs his decision. When something big comes up mid-conversation, say so and offer a plan.
- Be direct, like a great VP talking to the CEO: the answer first, then the reasoning, the numbers, and the decision you need from him. No fluff. Push back when the data says he's wrong.`

// ── Tools ────────────────────────────────────────────────────────────────────
export const PROPOSE_PLAN_TOOL: Anthropic.Tool = {
  name: 'propose_plan',
  description: 'Bring Russel a plan to approve. ONLY when you are 90%+ sure it will hit its measurable result if approved and executed. It is saved to his "Waiting on your OK" list; approving creates the listed actions (EOS Rocks, Issues, EOS To-Dos, tasks). Under 90%, do not call this — say it is an idea, give the percentage and what would raise it.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short, outcome-first, e.g. "Close the 6 stalled Proposal deals over $20K by Dec 15".' },
      problem: { type: 'string', description: 'The problem or opportunity, in one or two sentences, with the numbers.' },
      plan_steps: { type: 'array', items: { type: 'string' }, description: '3–7 concrete steps: who does what, by when. First step happens this week.' },
      confidence: { type: 'number', description: 'Honest % chance (0–100) it hits the measure by the date. Must be 90+.' },
      evidence: { type: 'array', items: { type: 'string' }, description: 'What this is based on — our data and market facts you looked up (with sources).' },
      assumptions: { type: 'array', items: { type: 'string' } },
      risks: { type: 'array', items: { type: 'string' }, description: 'What could make it fail, and how we handle it.' },
      impact_usd: { type: 'number', description: 'Expected dollars (new revenue, recurring revenue for a year, or cost saved). Omit if not about money.' },
      impact_note: { type: 'string', description: 'How the dollars were figured, e.g. "6 deals × $28K avg × 75% close".' },
      measure: { type: 'string', description: 'How we will know it worked, e.g. "4 of the 6 deals signed by Dec 15".' },
      due_date: { type: 'string', description: 'YYYY-MM-DD the measure is due.' },
      owner: { type: 'string', description: 'Who owns it (one person).' },
      actions: {
        type: 'array',
        description: 'What approving should create.',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['rock', 'issue', 'eos_todo', 'task'] },
            text: { type: 'string' },
            owner: { type: 'string' },
            due_date: { type: 'string', description: 'YYYY-MM-DD' },
          },
          required: ['type', 'text'],
        },
      },
      workstream: { type: 'string', enum: [...WORKSTREAMS], description: 'Which workstream this plan belongs to.' },
      reasoning: { type: 'string', description: 'One sentence: why this, why now.' },
    },
    required: ['title', 'problem', 'plan_steps', 'confidence', 'evidence', 'measure', 'reasoning'],
  },
}

export const EXEC_TOOLS: Anthropic.Tool[] = [
  {
    name: 'company_pulse',
    description: 'Gate Guard\'s business numbers right now: pipeline by stage (count + value), stalled deals, won / lost and win rate (last 90 days), average won deal, new leads (30 days) by source, open and completed jobs, active sites, and QuickBooks cash / money owed to us when connected. Use before any plan or strategy answer.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'eos_snapshot',
    description: 'The company\'s EOS: V/TO, this quarter\'s Rocks (status, progress, owner), the Scorecard with the last 6 weeks of numbers vs goal, open Issues, and open EOS To-Dos. Use for L10 prep, "how are our Rocks", "what should we IDS", and before plans.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'eos_update',
    description: 'Save something to the company EOS right away (Russel can Undo). kind + action: vto/set (field + value) · rock/add (text, owner, due_date) · rock/update (id + status On Track|Off Track|Complete, progress 0-100, text, owner) · scorecard/add (text = measurable name, owner, goal, unit) · scorecard/update (id + goal / owner / text) · scorecard/record (id + value, week_of YYYY-MM-DD Monday, default this week) · issue/add (text, owner, priority Critical|High|Normal) · issue/update (id + status Open|In Progress|Parking Lot|Resolved, note) · todo/add (text, owner, due_date) · todo/done (id). Get ids from eos_snapshot. One item per call.',
    input_schema: { type: 'object', properties: {
      kind: { type: 'string', enum: ['vto', 'rock', 'scorecard', 'issue', 'todo'] },
      action: { type: 'string', enum: ['set', 'add', 'update', 'record', 'done'] },
      id: { type: 'string' },
      field: { type: 'string', enum: ['core_values', 'purpose', 'niche', 'ten_year_target', 'target_market', 'three_uniques', 'proven_process', 'guarantee', 'picture_3yr', 'plan_1yr'], description: 'vto only' },
      value: { description: 'vto: text, a list (core_values as [{title, desc}], three_uniques / proven_process as [text]), or an object (picture_3yr {revenue, profit, employees, looks_like}, plan_1yr {revenue, profit, goals: [text]}). scorecard/record: the number as text.' },
      text: { type: 'string' }, owner: { type: 'string' }, goal: { type: 'string' }, unit: { type: 'string' },
      status: { type: 'string' }, progress: { type: 'number' }, priority: { type: 'string' }, note: { type: 'string' },
      due_date: { type: 'string' }, week_of: { type: 'string' },
    }, required: ['kind', 'action'] },
  },
  {
    name: 'market_research',
    description: 'Search the web and news right now: competitors (Brivo, ButterflyMX, SmartRent, Latch, Verkada…), multifamily and property-management news, access-control / video / proptech trends, a company or person, pricing in the market. recent: day | week | month | year | any (default month). Cite the sources you use.',
    input_schema: { type: 'object', properties: { query: { type: 'string' }, recent: { type: 'string', enum: ['day', 'week', 'month', 'year', 'any'] }, news: { type: 'boolean', description: 'true = news articles (default true)' } }, required: ['query'] },
  },
  {
    name: 'market_watch',
    description: 'What the daily market watch saved (industry, competitor and multifamily news with why it matters to us), newest first. Use for "what\'s happening in the market", morning catch-up, and as evidence.',
    input_schema: { type: 'object', properties: { days: { type: 'number', description: 'Look back this many days (default 14).' } } },
  },
  {
    name: 'workstream',
    description: 'Facts for one of your standing workstreams: sales (pipeline), upsell (each active property and what it\'s missing — Gate Watch, portal, service plan, cameras, package room; biggest sites first), collections (late invoices by age, who to call first, QuickBooks aging), dealers (stuck in onboarding, quoting but not closing, quiet, most active), nexus (what screens are used / never opened in 30 days, by corporate vs dealers, plus product notes), fleet (Gate Watch gates down / blind / not checked, uptime periods, AI accuracy, low-confidence gates, cameras offline, sites with Edge).',
    input_schema: { type: 'object', properties: { name: { type: 'string', enum: [...WORKSTREAMS] } }, required: ['name'] },
  },
  {
    name: 'my_work',
    description: 'Your own running work list (what you are working on for Russel). action: list · add (workstream, title, next_step, note) · update (id + next_step / note / status active|waiting|done) · done (id). Keep 3–8 active items; one per real project, not per task.',
    input_schema: { type: 'object', properties: { action: { type: 'string', enum: ['list', 'add', 'update', 'done'] }, id: { type: 'string' }, workstream: { type: 'string', enum: [...WORKSTREAMS] }, title: { type: 'string' }, next_step: { type: 'string' }, note: { type: 'string' }, status: { type: 'string', enum: ['active', 'waiting', 'done'] } }, required: ['action'] },
  },
  PROPOSE_PLAN_TOOL,
  {
    name: 'list_plans',
    description: 'Plans brought to Russel: waiting for his OK, approved, sent back for changes, said no to — with his notes — plus the track record (how approved plans turned out). Use for "what\'s waiting on me", before proposing (don\'t duplicate), and when he asks about a plan.',
    input_schema: { type: 'object', properties: { status: { type: 'string', enum: ['pending', 'approved', 'changes', 'rejected', 'all'] } } },
  },
]
export const EXEC_TOOL_NAMES = new Set(EXEC_TOOLS.map(t => t.name))
export const EXEC_TOOL_LABEL: Record<string, string> = {
  company_pulse: 'Reading the numbers', eos_snapshot: 'Checking our Rocks and Scorecard', eos_update: 'Saving to our EOS', market_research: 'Researching the market',
  market_watch: 'Checking the market watch', workstream: 'Working the numbers', my_work: 'Updating my work list', propose_plan: 'Writing up the plan', list_plans: 'Checking your plans',
}

// ── Data ─────────────────────────────────────────────────────────────────────
const money = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? null : `$${Math.round(n).toLocaleString()}`)
const dealValue = (d: Row) => Number(d.amount ?? d.tcv ?? d.est_setup ?? 0) || 0
const STAGES = ['meet_present', 'survey', 'propose', 'negotiate', 'contract', 'deposit']
const STAGE_LABEL: Record<string, string> = { meet_present: 'Meet & Present', survey: 'Site Survey', propose: 'Proposal', negotiate: 'Negotiate', contract: 'Contract & Sign', deposit: 'Deposit', won: 'Won', lost: 'Lost' }
const within = <T,>(p: Promise<T>, ms: number, fallback: T) => Promise.race([p, new Promise<T>(res => setTimeout(() => res(fallback), ms))])

export async function companyPulse(ctx: LexiCtx): Promise<Row> {
  const now = Date.now()
  const d90 = new Date(now - 90 * 86400000).toISOString()
  const d30 = new Date(now - 30 * 86400000).toISOString()
  const stalledCut = now - STALLED_DAYS * 86400000
  const [deals, leads, openWos, doneWos, sites, qbo] = await Promise.all([
    scopeDeals(sb.from('opportunities').select('*').is('deleted_at', null), ctx.deals).limit(3000),
    sb.from('leads').select('id, source, created_at, stage').is('deleted_at', null).gte('created_at', d30).limit(3000),
    sb.from('work_orders').select('id', { count: 'exact', head: true }).in('status', ['open', 'scheduled', 'in_progress', 'procurement', 'stuck', 'on_hold']),
    sb.from('work_orders').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('updated_at', d30),
    sb.from('sites').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    ctx.user.isCorporate ? within(overview().catch(() => null), 8000, null) : Promise.resolve(null),
  ])
  const D = ((deals.data ?? []) as Row[])
  const open = D.filter(d => STAGES.includes(d.stage))
  const byStage = STAGES.map(s => { const r = open.filter(d => d.stage === s); return { stage: STAGE_LABEL[s], count: r.length, value: money(r.reduce((a, d) => a + dealValue(d), 0)) } })
  const recent = (d: Row) => Date.parse(d.closed_at ?? d.close_date ?? d.updated_at ?? 0) >= Date.parse(d90)
  const won = D.filter(d => d.stage === 'won' && recent(d)), lost = D.filter(d => d.stage === 'lost' && recent(d))
  const stalled = open.filter(d => Date.parse(d.updated_at ?? d.created_at ?? 0) < stalledCut)
  const L = ((leads.data ?? []) as Row[])
  const bySource: Record<string, number> = {}
  for (const l of L) { const k = String(l.source || 'unknown'); bySource[k] = (bySource[k] ?? 0) + 1 }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = qbo && (qbo as Row).ok ? (qbo as Row).data : null
  return {
    as_of: new Date().toISOString(),
    pipeline: { open_deals: open.length, open_value: money(open.reduce((a, d) => a + dealValue(d), 0)), by_stage: byStage },
    stalled: { count: stalled.length, value: money(stalled.reduce((a, d) => a + dealValue(d), 0)), top: stalled.sort((a, b) => dealValue(b) - dealValue(a)).slice(0, 8).map(d => ({ id: d.id, name: d.name || d.account_name, stage: STAGE_LABEL[d.stage] ?? d.stage, value: money(dealValue(d)), quiet_days: Math.floor((now - Date.parse(d.updated_at ?? d.created_at)) / 86400000) })) },
    last_90_days: { won: won.length, won_value: money(won.reduce((a, d) => a + dealValue(d), 0)), lost: lost.length, win_rate_pct: won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : null, avg_won_deal: won.length ? money(won.reduce((a, d) => a + dealValue(d), 0) / won.length) : null },
    leads_30_days: { count: L.length, by_source: bySource },
    jobs: { open: openWos.count ?? null, completed_30_days: doneWos.count ?? null },
    active_sites: sites.count ?? null,
    quickbooks: q ? { cash: money(q.cash?.total), owed_to_us: money(q.receivable?.total), owed_over_90_days: money(q.receivable?.over90), bills_we_owe: money(q.payable?.total) } : 'not connected or unavailable',
    errors: [deals.error?.message, leads.error?.message].filter(Boolean),
  }
}

const quarterOf = (d = new Date()) => { const et = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' })); return { label: `Q${Math.floor(et.getMonth() / 3) + 1}-${et.getFullYear()}`, endMonth: Math.floor(et.getMonth() / 3) * 3 + 2, year: et.getFullYear() } }

export async function eosSnapshot(u: PortalUser): Promise<Row> {
  const org = eosOrg(u)
  const [vto, rocks, cards, issues, todos] = await Promise.all([
    sb.from('eos_vto').select('*').eq('org_id', org).maybeSingle(),
    sb.from('eos_rocks').select('id, quarter, name, owner, status, progress, due_date, is_company_rock').eq('org_id', org).order('quarter', { ascending: false }).limit(40),
    sb.from('eos_scorecard').select('*').eq('org_id', org).order('sort_order').limit(30),
    sb.from('eos_issues').select('id, description, type, owner, priority, status, created_at').eq('org_id', org).neq('status', 'Resolved').order('created_at', { ascending: false }).limit(30),
    sb.from('eos_todos').select('id, text, owner, due_date, meeting, done').eq('org_id', org).eq('done', false).order('due_date', { ascending: true }).limit(40),
  ])
  const cardRows = (cards.data ?? []) as Row[]
  let entries: Row[] = []
  if (cardRows.length) {
    const since = addDaysISO(todayET(), -42)
    const { data } = await sb.from('eos_scorecard_entries').select('scorecard_id, week_of, value').in('scorecard_id', cardRows.map(c => c.id)).gte('week_of', since).order('week_of')
    entries = (data ?? []) as Row[]
  }
  const q = quarterOf()
  const allRocks = (rocks.data ?? []) as Row[]
  const thisQ = allRocks.filter(r => String(r.quarter).replace(/\s+/g, '-') === q.label)
  const missing = [vto.error, rocks.error, cards.error, issues.error, todos.error].filter(Boolean).map(e => e!.message)
  return {
    quarter: q.label,
    vto: vto.data ? { core_values: vto.data.core_values, purpose: vto.data.purpose, niche: vto.data.niche, ten_year_target: vto.data.ten_year_target, target_market: vto.data.target_market, three_uniques: vto.data.three_uniques, three_year_picture: vto.data.picture_3yr, one_year_plan: vto.data.plan_1yr } : 'No V/TO saved yet — offer to draft one with Russel.',
    rocks_this_quarter: thisQ.length ? thisQ : (allRocks.length ? { note: `No Rocks for ${q.label} yet — these are the latest saved.`, latest: allRocks.slice(0, 10) } : 'No Rocks saved yet.'),
    scorecard: cardRows.length ? cardRows.map(c => ({ id: c.id, name: c.name, owner: c.owner, goal: c.goal, auto: c.auto_key ?? null, last_6_weeks: entries.filter(e => e.scorecard_id === c.id).map(e => ({ week: e.week_of, value: e.value })) })) : 'No Scorecard numbers saved yet — offer to set one up (5–15 weekly numbers).',
    open_issues: issues.data ?? [],
    open_todos: (todos.data ?? []).map((t: Row) => ({ ...t, overdue: !!t.due_date && t.due_date < todayET() })),
    l10: 'Fridays 6am with Nicole Gagliardi',
    gaps: eosGaps(vto.data as Row | null, thisQ, cardRows),
    ...(missing.length ? { errors: missing } : {}),
  }
}

// Market search through Serper (same key ARIA uses). Tavily as a fallback.
async function webSearch(query: string, opts: { recent?: string; news?: boolean; num?: number } = {}): Promise<{ title: string; url: string; snippet: string; source?: string; date?: string }[]> {
  const tbs: Record<string, string> = { day: 'qdr:d', week: 'qdr:w', month: 'qdr:m', year: 'qdr:y' }
  const num = Math.max(3, Math.min(10, opts.num ?? 8))
  if (process.env.SERPER_API_KEY) {
    try {
      const body: Row = { q: query, num, gl: 'us', hl: 'en' }
      const t = tbs[opts.recent ?? 'month']; if (t) body.tbs = t
      const res = await fetch(opts.news === false ? 'https://google.serper.dev/search' : 'https://google.serper.dev/news', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': process.env.SERPER_API_KEY.trim() }, body: JSON.stringify(body), signal: AbortSignal.timeout(7000),
      })
      if (res.ok) {
        const d = await res.json()
        const items = (opts.news === false ? d.organic : d.news) ?? []
        return (items as Row[]).slice(0, num).map(r => ({ title: String(r.title ?? ''), url: String(r.link ?? ''), snippet: String(r.snippet ?? '').slice(0, 400), source: r.source ?? undefined, date: r.date ?? undefined })).filter(r => r.url)
      }
    } catch { /* fall through */ }
  }
  if (process.env.TAVILY_API_KEY) {
    try {
      const days: Record<string, number> = { day: 1, week: 7, month: 31, year: 365 }
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, max_results: num, topic: opts.news === false ? 'general' : 'news', ...(days[opts.recent ?? 'month'] ? { days: days[opts.recent ?? 'month'] } : {}) }),
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const d = await res.json()
        return ((d.results ?? []) as Row[]).map(r => ({ title: String(r.title ?? ''), url: String(r.url ?? ''), snippet: String(r.content ?? '').slice(0, 400), date: r.published_date ?? undefined })).filter(r => r.url)
      }
    } catch { /* nothing */ }
  }
  return []
}

// ── Plans ────────────────────────────────────────────────────────────────────
const strList = (v: unknown, max = 12) => (Array.isArray(v) ? v.map(x => String(x ?? '').trim()).filter(Boolean).slice(0, max).map(s => s.slice(0, 600)) : [])
const ymd = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9$]+/).filter(w => w.length > 3))
function similar(a: string, b: string) { const A = words(a), B = words(b); if (!A.size || !B.size) return false; let n = 0; A.forEach(w => { if (B.has(w)) n++ }); return n / Math.min(A.size, B.size) >= 0.6 }

export type PlanAction = { type: 'rock' | 'issue' | 'eos_todo' | 'task'; text: string; owner?: string; due_date?: string | null }
function cleanActions(v: unknown): PlanAction[] {
  if (!Array.isArray(v)) return []
  const out: PlanAction[] = []
  for (const a of v as Row[]) {
    const type = ['rock', 'issue', 'eos_todo', 'task'].includes(a?.type) ? a.type : null
    const text = String(a?.text ?? '').trim().slice(0, 300)
    if (type && text) out.push({ type, text, owner: a.owner ? String(a.owner).slice(0, 80) : undefined, due_date: ymd(a.due_date) })
  }
  return out.slice(0, 10)
}

export async function savePlan(u: PortalUser, input: Row, source: 'chat' | 'daily' | 'signal' = 'chat', signalKey?: string): Promise<{ ok: boolean; id?: string; message: string }> {
  const confidence = Math.round(Number(input.confidence))
  const title = String(input.title ?? '').trim().slice(0, 200)
  if (!title) return { ok: false, message: 'A plan needs a title.' }
  if (!Number.isFinite(confidence) || confidence < MIN_CONFIDENCE || confidence > 100) {
    return { ok: false, message: `Not saved: plans need ${MIN_CONFIDENCE}%+ certainty (this one is ${Number.isFinite(confidence) ? confidence : '?'}%). Present it as an idea with the percentage and say what data would raise it — or go get that data and try again.` }
  }
  const evidence = strList(input.evidence)
  if (!evidence.length) return { ok: false, message: 'Not saved: a plan needs the evidence it is based on.' }
  const { data: open, error: oErr } = await sb.from('lexi_plans').select('id, title').eq('user_id', u.id).in('status', ['pending', 'changes']).limit(60)
  if (oErr) return { ok: false, message: notReady(oErr.message) }
  const dupe = ((open ?? []) as Row[]).find(p => similar(String(p.title), title))
  if (dupe) return { ok: false, message: `Not saved: it's already waiting on Russel as "${dupe.title}". Point him to that one instead.` }
  const row = {
    user_id: u.id, org_id: u.org_id, status: 'pending', source, title,
    problem: String(input.problem ?? '').slice(0, 1500) || null,
    plan_steps: strList(input.plan_steps, 10), confidence, evidence,
    assumptions: strList(input.assumptions), risks: strList(input.risks),
    impact_usd: Number.isFinite(Number(input.impact_usd)) && input.impact_usd !== null && input.impact_usd !== '' ? Math.round(Number(input.impact_usd)) : null,
    impact_note: input.impact_note ? String(input.impact_note).slice(0, 500) : null,
    measure: String(input.measure ?? '').slice(0, 500) || null,
    due_date: ymd(input.due_date), owner: input.owner ? String(input.owner).slice(0, 80) : null,
    actions: cleanActions(input.actions), signal_key: signalKey ?? null,
    ...((WORKSTREAMS as readonly string[]).includes(String(input.workstream)) ? { workstream: String(input.workstream) } : {}),
  }
  let { data, error } = await sb.from('lexi_plans').insert(row).select('id').single()
  if (error && /workstream/.test(error.message)) { const { workstream: _w, ...rest } = row as Row; ({ data, error } = await sb.from('lexi_plans').insert(rest).select('id').single()) } // before migration 219
  if (error || !data) return { ok: false, message: notReady(error?.message ?? 'not saved') }
  return { ok: true, id: data.id, message: 'Saved to Russel’s “Waiting on your OK” list in Lexi. Tell him in one sentence what you brought and the decision you need.' }
}

export async function listPlans(u: PortalUser, status: string = 'all', limit = 30): Promise<{ plans: Row[]; record: Row; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = sb.from('lexi_plans').select('*').eq('user_id', u.id)
  if (status !== 'all') q = q.eq('status', status)
  const [{ data, error }, rec] = await Promise.all([q.order('created_at', { ascending: false }).limit(limit), trackRecord(u)])
  if (error) return { plans: [], record: rec, error: notReady(error.message) }
  return { plans: (data ?? []) as Row[], record: rec }
}

export async function trackRecord(u: PortalUser): Promise<Row> {
  const { data, error } = await sb.from('lexi_plans').select('status, outcome, confidence').eq('user_id', u.id).limit(1000)
  if (error) return { error: notReady(error.message) }
  const R = (data ?? []) as Row[]
  const rated = R.filter(r => r.outcome)
  const worked = rated.filter(r => r.outcome === 'worked').length, partly = rated.filter(r => r.outcome === 'partly').length
  return {
    brought: R.length, approved: R.filter(r => r.status === 'approved').length, said_no: R.filter(r => r.status === 'rejected').length,
    waiting: R.filter(r => r.status === 'pending').length, rated: rated.length, worked, partly, did_not: rated.length - worked - partly,
    hit_rate_pct: rated.length ? Math.round(((worked + partly * 0.5) / rated.length) * 100) : null,
  }
}

/** Short text for Lexi's instructions: track record + recent decisions to learn from. */
export async function execContext(u: PortalUser): Promise<string> {
  const { plans, record, error } = await listPlans(u, 'all', 40)
  if (error) return `Plans: ${error}`
  const pending = plans.filter(p => p.status === 'pending')
  const decided = plans.filter(p => ['approved', 'rejected', 'changes'].includes(p.status)).slice(0, 8)
  const work = await listWork(u).catch(() => ({ items: [] as Row[] }))
  const lines = [
    work.items.length ? `Your work list (${work.items.length} active): ${work.items.slice(0, 10).map(i => `[${i.workstream}] ${i.title}${i.next_step ? ` → next: ${i.next_step}` : ''} (id ${i.id})`).join('; ')}.` : 'Your work list is empty — start one item per workstream that needs attention.',
    `Your track record: brought ${record.brought ?? 0} plans · approved ${record.approved ?? 0} · said no ${record.said_no ?? 0} · rated ${record.rated ?? 0}${record.hit_rate_pct != null ? ` · hit rate ${record.hit_rate_pct}%` : ''}.`,
    pending.length ? `Waiting on Russel now (${pending.length}): ${pending.slice(0, 6).map(p => `"${p.title}" (${p.confidence}%)`).join('; ')}.` : 'Nothing is waiting on Russel right now.',
    ...decided.map(p => `- ${p.status === 'approved' ? 'Approved' : p.status === 'rejected' ? 'Said no' : 'Sent back'}: "${p.title}"${p.decision_note ? ` — his note: ${String(p.decision_note).slice(0, 200)}` : ''}${p.outcome ? ` — turned out: ${p.outcome}` : ''}`),
  ]
  return lines.join('\n')
}

/** Approve / change / no. Approve creates the plan's actions. */
export async function decidePlan(u: PortalUser, id: string, decision: 'approve' | 'change' | 'reject', note?: string): Promise<{ ok: boolean; message: string; created?: Row[] }> {
  if (!isExec(u)) return { ok: false, message: 'Only for Executive Lexi.' }
  const { data: p, error } = await sb.from('lexi_plans').select('*').eq('id', id).eq('user_id', u.id).maybeSingle()
  if (error) return { ok: false, message: notReady(error.message) }
  if (!p) return { ok: false, message: 'Plan not found.' }
  if (p.status !== 'pending' && p.status !== 'changes') return { ok: false, message: `That plan was already ${p.status}.` }
  const cleanNote = note ? String(note).trim().slice(0, 1500) : null
  if (decision !== 'approve') {
    if (decision === 'change' && !cleanNote) return { ok: false, message: 'Say what to change.' }
    const { error: e } = await sb.from('lexi_plans').update({ status: decision === 'change' ? 'changes' : 'rejected', decision_note: cleanNote, decided_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', u.id)
    if (e) return { ok: false, message: e.message }
    return { ok: true, message: decision === 'change' ? 'Sent back to Lexi with your note.' : 'Got it — Lexi won’t bring this back without new evidence.' }
  }

  // Claim it first so a double tap can't create everything twice.
  const { data: claimed, error: cErr } = await sb.from('lexi_plans').update({ status: 'approved', decision_note: cleanNote, decided_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', u.id).in('status', ['pending', 'changes']).select('id')
  if (cErr) return { ok: false, message: cErr.message }
  if (!claimed?.length) return { ok: false, message: 'That plan was just decided.' }

  const org = eosOrg(u)
  const q = quarterOf()
  const qEnd = new Date(q.year, q.endMonth + 1, 0).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const owner = (a: PlanAction) => a.owner || p.owner || u.name
  const ctx = await lexiCtx(u)
  const created: Row[] = []
  for (const a of (p.actions ?? []) as PlanAction[]) {
    let r: { error?: { message: string } | null; data?: Row | null } = {}
    if (a.type === 'rock') r = await sb.from('eos_rocks').insert({ org_id: org, quarter: q.label, name: a.text, owner: owner(a), status: 'On Track', progress: 0, due_date: a.due_date ? new Date(`${a.due_date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : qEnd, is_company_rock: true }).select('id').single()
    else if (a.type === 'issue') r = await sb.from('eos_issues').insert({ org_id: org, description: a.text, type: 'Company', owner: owner(a), priority: 'High', status: 'Open' }).select('id').single()
    else if (a.type === 'eos_todo') r = await sb.from('eos_todos').insert({ org_id: org, text: a.text, owner: owner(a), due_date: a.due_date ?? addDaysISO(todayET(), 7), meeting: 'Lexi plan' }).select('id').single()
    else if (a.type === 'task') {
      const t = await executeToolWithRevert('create_todo', { title: a.text.slice(0, 200), due_date: a.due_date ?? addDaysISO(todayET(), 7), priority: 'high', notes: `From Lexi plan: ${p.title}`, reasoning: `Approved plan "${p.title}".` }, { user: u, scope: ctx.scope })
      r = t.success ? { data: { id: t.id ?? null } } : { error: { message: t.error ?? 'task not created' } }
    }
    created.push({ type: a.type, text: a.text, ok: !r.error, id: r.data?.id ?? null, error: r.error?.message ?? null })
  }
  const { error: uErr } = await sb.from('lexi_plans').update({ created_items: created, updated_at: new Date().toISOString() }).eq('id', id)
  if (uErr) console.error('[lexi/exec] save created items failed:', uErr.message)
  const bad = created.filter(c => !c.ok)
  const made = created.length - bad.length
  return {
    ok: true, created,
    message: created.length
      ? `Approved. Created ${made} of ${created.length}${bad.length ? ` — ${bad.length} didn’t go through (${bad[0].error})` : ''}.`
      : 'Approved.',
  }
}

export async function setOutcome(u: PortalUser, id: string, outcome: 'worked' | 'partly' | 'did_not', note?: string): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await sb.from('lexi_plans').update({ outcome, outcome_note: note ? String(note).slice(0, 1000) : null, outcome_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', u.id).eq('status', 'approved').select('id')
  if (error) return { ok: false, message: notReady(error.message) }
  if (!data?.length) return { ok: false, message: 'Only approved plans can be rated.' }
  return { ok: true, message: 'Thanks — that goes into Lexi’s track record.' }
}

// ── Tool runner ──────────────────────────────────────────────────────────────
export async function runExecTool(name: string, input: Row, ctx: LexiCtx): Promise<{ data: unknown; saved?: { ok: boolean; summary: string; message: string } }> {
  const u = ctx.user
  if (!isExec(u)) return { data: { error: 'Executive tools are only for Russel.' } }
  switch (name) {
    case 'company_pulse': return { data: await companyPulse(ctx) }
    case 'eos_snapshot': await ensureScorecard(u).catch(() => null); return { data: await eosSnapshot(u) }
    case 'eos_update': {
      const r = await eosUpdate(u, input)
      return { data: { ok: r.ok, message: r.message, id: r.id ?? null }, saved: { ok: r.ok, summary: r.summary, message: r.message, ...(r.revert ? { revertPayload: signRevert(r.revert, u.id) } : {}) } as { ok: boolean; summary: string; message: string } }
    }
    case 'workstream': return { data: await digest(String(input.name ?? ''), u, ctx, companyPulse) }
    case 'my_work': {
      if ((input.action ?? 'list') === 'list') { const r = await listWork(u); return { data: { items: r.items.map(i => ({ id: i.id, workstream: i.workstream, title: i.title, status: i.status, next_step: i.next_step, note: i.note, updated: i.updated_at })), ...(r.error ? { error: r.error } : {}) } } }
      const r = await workAction(u, input)
      return { data: r, saved: { ok: r.ok, summary: r.summary, message: r.message } }
    }
    case 'market_research': {
      const q = String(input.query ?? '').trim()
      if (!q) return { data: { error: 'query is required' } }
      const hits = await webSearch(q, { recent: typeof input.recent === 'string' ? input.recent : 'month', news: input.news !== false })
      if (!hits.length && !process.env.SERPER_API_KEY && !process.env.TAVILY_API_KEY) return { data: { error: 'Web search isn’t set up (SERPER_API_KEY / TAVILY_API_KEY missing).' } }
      return { data: { query: q, results: hits } }
    }
    case 'market_watch': {
      const days = Math.max(1, Math.min(60, Number(input.days) || 14))
      const { data, error } = await sb.from('lexi_market_notes').select('headline, why_it_matters, topic, source, published, url, created_at').gte('created_at', new Date(Date.now() - days * 86400000).toISOString()).order('created_at', { ascending: false }).limit(40)
      if (error) return { data: { error: notReady(error.message) } }
      return { data: { notes: data ?? [], note: (data ?? []).length ? undefined : 'Nothing saved yet — the market watch runs each weekday morning. Use market_research for a live look.' } }
    }
    case 'propose_plan': {
      const r = await savePlan(u, input, 'chat')
      return { data: r, saved: { ok: r.ok, summary: r.ok ? `Plan for your OK: "${String(input.title).slice(0, 90)}" (${Math.round(Number(input.confidence))}%)` : `Plan not saved: "${String(input.title ?? '').slice(0, 80)}"`, message: r.ok ? 'It’s on your “Waiting on your OK” list.' : r.message } }
    }
    case 'list_plans': {
      const r = await listPlans(u, typeof input.status === 'string' ? input.status : 'all', 25)
      return { data: { record: r.record, plans: r.plans.map(p => ({ id: p.id, title: p.title, status: p.status, confidence: p.confidence, impact: money(p.impact_usd), measure: p.measure, due: p.due_date, note: p.decision_note, outcome: p.outcome, created: p.created_at })), ...(r.error ? { error: r.error } : {}) } }
    }
    default: return { data: { error: `Unknown tool ${name}` } }
  }
}

// ── Market watch (daily) ─────────────────────────────────────────────────────
const MARKET_QUERIES = [
  'multifamily access control', 'apartment gate security', 'Brivo', 'ButterflyMX', 'SmartRent', 'Latch smart access',
  'Verkada OR "Avigilon Alta" access control', 'multifamily proptech', 'property management technology apartments',
  'apartment package lockers', 'NMHC apartment market', 'multifamily transactions acquisitions',
]

export async function runMarketScan(): Promise<{ found: number; saved: number; error?: string }> {
  const batches = await Promise.all(MARKET_QUERIES.map(q => webSearch(q, { recent: 'week', news: true, num: 6 }).catch(() => [])))
  const seen = new Set<string>()
  const items = batches.flat().filter(r => r.url && !seen.has(r.url) && (seen.add(r.url), true)).slice(0, 60)
  if (!items.length) return { found: 0, saved: 0, error: process.env.SERPER_API_KEY || process.env.TAVILY_API_KEY ? undefined : 'Web search isn’t set up (SERPER_API_KEY / TAVILY_API_KEY).' }
  const { data: known } = await sb.from('lexi_market_notes').select('url').in('url', items.map(i => i.url))
  const knownSet = new Set(((known ?? []) as Row[]).map(k => k.url))
  const fresh = items.filter(i => !knownSet.has(i.url))
  if (!fresh.length) return { found: items.length, saved: 0 }
  let picks: { i: number; headline: string; why: string; topic: string }[] = []
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const r = await anthropic.messages.create({
        model: FAST_MODEL, max_tokens: 2500, temperature: 0.2,
        messages: [{ role: 'user', content: `You screen news for Gate Guard (gates, access control, cameras, package rooms and AI monitoring for apartment communities, sold direct and through dealers). Keep only items that matter to its strategy, sales or competitors — drop fluff, consumer gadget reviews and unrelated stories. For each kept item write a plain headline and one sentence on why it matters to Gate Guard. topic is one of: competitor, multifamily, access_control, video, proptech, economy, other.\nReply with JSON only: [{"i":<index>,"headline":"...","why":"...","topic":"..."}]\nItems:\n${fresh.map((f, i) => `${i}. ${f.title} — ${f.snippet} (${f.source ?? ''} ${f.date ?? ''})`).join('\n')}` }],
      })
      const text = r.content.map(b => (b.type === 'text' ? b.text : '')).join('')
      const m = text.match(/\[[\s\S]*\]/)
      if (m) picks = (JSON.parse(m[0]) as Row[]).filter(p => Number.isInteger(p.i) && fresh[p.i] && p.headline).map(p => ({ i: p.i, headline: String(p.headline).slice(0, 240), why: String(p.why ?? '').slice(0, 400), topic: String(p.topic ?? 'other').slice(0, 30) }))
    } catch (e) { console.error('[lexi/exec] market screen failed:', e instanceof Error ? e.message : e) }
  }
  if (!picks.length) return { found: items.length, saved: 0 }
  const rows = picks.slice(0, 15).map(p => ({ url: fresh[p.i].url, headline: p.headline, why_it_matters: p.why, topic: p.topic, source: fresh[p.i].source ?? null, published: fresh[p.i].date ?? null }))
  const { error } = await sb.from('lexi_market_notes').upsert(rows, { onConflict: 'url', ignoreDuplicates: true })
  if (error) return { found: items.length, saved: 0, error: notReady(error.message) }
  return { found: items.length, saved: rows.length }
}

// ── The strategist (daily + when something comes up) ─────────────────────────
export async function runStrategist(u: PortalUser, opts: { source: 'daily' | 'signal'; focus?: string[]; signalKey?: string; maxPlans?: number } = { source: 'daily' }): Promise<{ saved: number; tried: number; notes: string[] }> {
  if (!isExec(u) || !process.env.ANTHROPIC_API_KEY) return { saved: 0, tried: 0, notes: ['not available'] }
  const ctx = await lexiCtx(u)
  const [pulse, eos, brief, market, mine, streams] = await Promise.all([
    companyPulse(ctx).catch(e => ({ error: String(e) })),
    eosSnapshot(u).catch(e => ({ error: String(e) })),
    runReadTool('daily_brief', {}, ctx).then(r => r.data).catch(() => null),
    sb.from('lexi_market_notes').select('headline, why_it_matters, topic, source, url').gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()).order('created_at', { ascending: false }).limit(20).then(r => r.data ?? []),
    execContext(u),
    opts.source === 'daily' ? allDigests(u, ctx, companyPulse).catch(e => ({ error: String(e) })) : Promise.resolve(null),
  ])
  const max = Math.max(1, Math.min(3, opts.maxPlans ?? 3))
  const myWorkTool = EXEC_TOOLS.find(t => t.name === 'my_work')!
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const ask = `${opts.source === 'signal' ? `Something just came up that may need Russel:\n${(opts.focus ?? []).join('\n')}\n\nLook at it against the whole picture below.` : 'It is the start of the day. Look at the whole picture below.'}
Bring up to ${max} plan(s) with propose_plan — ONLY ones you are ${MIN_CONFIDENCE}%+ sure of, with the evidence from the data below. Favor: closing deals in the pipeline, new revenue from existing customers (add-ons, upgrades, service agreements, resident-funded), fixing what loses money or customers, and EOS gaps (Rocks off track, Scorecard misses, Issues stuck). Don't repeat anything already waiting on Russel or that he said no to without new evidence. If nothing clears ${MIN_CONFIDENCE}%, bring nothing and reply with one line on what you'd need to know.

Numbers (company_pulse): ${JSON.stringify(pulse).slice(0, 7000)}
EOS (eos_snapshot): ${JSON.stringify(eos).slice(0, 6000)}
Today (daily_brief): ${JSON.stringify(brief).slice(0, 5000)}
Market watch, last 7 days: ${JSON.stringify(market).slice(0, 4000)}
${streams ? `Workstreams (upsell, collections, dealers, nexus usage, Gate Watch & Edge fleet): ${JSON.stringify(streams).slice(0, 14000)}
Also keep your work list current with my_work: add one item per workstream that needs attention (with the next step), update items that moved, finish ones that are done. Up to 6 work-list changes.` : ''}
Plans so far:
${mine}`
  const res = await anthropic.messages.create({
    model: MODEL, max_tokens: 4000,
    system: `You are Lexi, Gate Guard's strategy-and-operations VP, working for Russel Feldman (CEO). Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })}.\n\n${EXEC_PROMPT}`,
    tools: opts.source === 'daily' ? [PROPOSE_PLAN_TOOL, myWorkTool] : [PROPOSE_PLAN_TOOL],
    messages: [{ role: 'user', content: ask }],
  })
  let workChanges = 0
  const notes: string[] = []
  let saved = 0, tried = 0
  for (const b of res.content) {
    if (b.type === 'text' && b.text.trim()) notes.push(b.text.trim().slice(0, 500))
    if (b.type === 'tool_use' && b.name === 'my_work') { if (opts.source !== 'daily' || workChanges >= 6) continue; workChanges++; const w = await workAction(u, (b.input ?? {}) as Row); if (!w.ok) notes.push(w.message); continue }
    if (b.type !== 'tool_use' || b.name !== 'propose_plan') continue
    if (tried >= max) break
    tried++
    const r = await savePlan(u, (b.input ?? {}) as Row, opts.source, opts.signalKey)
    if (r.ok) saved++; else notes.push(r.message)
  }
  return { saved, tried, notes }
}

// ── Signals: "as things come up" ─────────────────────────────────────────────
const BIG_DEAL = Number(process.env.LEXI_EXEC_BIG_DEAL || 15000)
const parseMoney = (s: unknown) => Number(String(s ?? '').replace(/[^0-9.]/g, '')) || 0

async function getState(userId: string): Promise<Row> {
  const { data } = await sb.from('user_settings').select('lexi_exec_state').eq('user_id', userId).maybeSingle()
  return (data?.lexi_exec_state as Row) ?? {}
}
async function saveState(userId: string, state: Row) {
  const { error } = await sb.from('user_settings').upsert({ user_id: userId, lexi_exec_state: state }, { onConflict: 'user_id' })
  if (error) console.error('[lexi/exec] save state failed:', error.message)
}

export async function checkSignals(u: PortalUser): Promise<{ fresh: number; ran: boolean; saved: number }> {
  const ctx = await lexiCtx(u)
  const d = (await runReadTool('daily_brief', {}, ctx)).data as Row
  const signals: { key: string; text: string }[] = []
  for (const s of (d.deals_stalled ?? []) as Row[]) if (parseMoney(s.value) >= BIG_DEAL) signals.push({ key: `deal:${s.id}`, text: `Big deal gone quiet: "${s.name || s.account}" ${s.value} in ${s.stage}, no update for ${s.days_since_update} days.` })
  for (const i of (d.open_incidents ?? []) as Row[]) if (/critical|high/i.test(String(i.severity ?? ''))) signals.push({ key: `incident:${i.id}`, text: `System problem: "${i.title}" (${i.severity}).` })
  for (const w of (d.jobs_overdue ?? []) as Row[]) if (/critical|urgent|high/i.test(String(w.priority ?? ''))) signals.push({ key: `job:${w.id}`, text: `Urgent job late: ${w.number ?? ''} ${w.title ?? ''} at ${w.site ?? 'a site'} (was due ${w.scheduled}).` })
  const state = await getState(u.id)
  const seen: string[] = Array.isArray(state.seen) ? state.seen : []
  const fresh = signals.filter(s => !seen.includes(s.key))
  const today = todayET()
  const runsToday = state.signalDay === today ? Number(state.signalRuns) || 0 : 0
  let ran = false, saved = 0
  if (fresh.length && runsToday < 4) {
    const r = await runStrategist(u, { source: 'signal', focus: fresh.slice(0, 6).map(s => s.text), signalKey: fresh[0].key, maxPlans: 2 })
    ran = true; saved = r.saved
  }
  await saveState(u.id, { ...state, seen: [...fresh.map(s => s.key), ...seen].slice(0, 400), signalDay: today, signalRuns: runsToday + (ran ? 1 : 0), lastSignalCheck: new Date().toISOString() })
  return { fresh: fresh.length, ran, saved }
}

// ── Morning brief: the CEO section ───────────────────────────────────────────
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
export async function execBriefHtml(u: PortalUser, base: string): Promise<string> {
  if (!isExec(u)) return ''
  const [{ plans }, notes] = await Promise.all([
    listPlans(u, 'pending', 6),
    sb.from('lexi_market_notes').select('headline, why_it_matters, url, source').gte('created_at', new Date(Date.now() - 2 * 86400000).toISOString()).order('created_at', { ascending: false }).limit(4).then(r => (r.data ?? []) as Row[]),
  ])
  if (!plans.length && !notes.length) return ''
  const planRows = plans.map(p => `<tr><td style="padding:10px 0;border-top:1px solid #EEF0F4">
    <div style="font-size:15px;font-weight:600;color:#1D1D1F"><a href="${esc(base)}/?tab=lexi" style="color:#1D1D1F;text-decoration:none">${esc(p.title)}</a></div>
    <div style="font-size:13px;color:#6E6E73;margin-top:2px">${esc(p.confidence)}% sure${p.impact_usd != null ? ` · ${esc(money(Number(p.impact_usd)))}` : ''}${p.measure ? ` · ${esc(p.measure)}` : ''}</div></td></tr>`).join('')
  const noteRows = notes.map(n => `<tr><td style="padding:8px 0;border-top:1px solid #EEF0F4"><div style="font-size:14px;font-weight:600"><a href="${esc(n.url)}" style="color:#1D1D1F;text-decoration:none">${esc(n.headline)}</a></div><div style="font-size:13px;color:#6E6E73;margin-top:2px">${esc(n.why_it_matters)}${n.source ? ` — ${esc(n.source)}` : ''}</div></td></tr>`).join('')
  return `${plans.length ? `<div style="font-size:13px;font-weight:600;color:#6E6E73;margin:18px 0 0">Waiting on your OK (${plans.length})</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${planRows}</table>` : ''}
  ${notes.length ? `<div style="font-size:13px;font-weight:600;color:#6E6E73;margin:18px 0 0">In the market</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${noteRows}</table>` : ''}`
}

// ── EOS: build as we go ──────────────────────────────────────────────────────
const VTO_FIELDS = ['core_values', 'purpose', 'niche', 'ten_year_target', 'target_market', 'three_uniques', 'proven_process', 'guarantee', 'picture_3yr', 'plan_1yr'] as const
const VTO_LABEL: Record<string, string> = { core_values: 'Core values', purpose: 'Purpose (core focus)', niche: 'Niche (core focus)', ten_year_target: '10-year target', target_market: 'Target market', three_uniques: '3 uniques', proven_process: 'Proven process', guarantee: 'Guarantee', picture_3yr: '3-year picture', plan_1yr: '1-year plan' }
const empty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v as object).length)

export function eosGaps(vto: Row | null, rocksThisQ: Row[], cards: Row[]): string[] {
  const gaps: string[] = []
  for (const f of VTO_FIELDS) if (!vto || empty(vto[f])) gaps.push(`V/TO: ${VTO_LABEL[f]} not set`)
  if (!rocksThisQ.length) gaps.push('No Rocks for this quarter')
  const tbd = cards.filter(c => !c.goal || /^tbd$/i.test(String(c.goal)))
  if (tbd.length) gaps.push(`Scorecard goals still TBD: ${tbd.map(c => c.name).slice(0, 6).join(', ')}`)
  return gaps
}

// Weekly numbers Lexi fills herself (auto_key, migration 218).
const AUTO_CARDS: { key: string; name: string; unit?: string }[] = [
  { key: 'new_leads', name: 'New leads' },
  { key: 'deals_won', name: 'Deals won' },
  { key: 'won_value', name: 'Won value', unit: '$' },
  { key: 'pipeline_added', name: 'Pipeline added', unit: '$' },
  { key: 'proposals_sent', name: 'Proposals sent' },
  { key: 'jobs_done', name: 'Jobs completed' },
  { key: 'jobs_old', name: 'Open jobs over 7 days' },
  { key: 'gates_down', name: 'Gates down (stuck open)' },
  { key: 'cash', name: 'Cash in bank', unit: '$' },
  { key: 'ar_90', name: 'Owed to us 90+ days', unit: '$' },
]
const mondayOf = (ymdStr: string) => { const d = new Date(`${ymdStr}T12:00:00Z`); const dow = d.getUTCDay(); d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7)); return d.toISOString().slice(0, 10) }

/** First time only: give the company a Scorecard Lexi can fill. Goals start as TBD — she asks for them. */
export async function ensureScorecard(u: PortalUser): Promise<number> {
  const org = eosOrg(u)
  const { data, error } = await sb.from('eos_scorecard').select('id').eq('org_id', org).limit(1)
  if (error || (data ?? []).length) return 0
  const rows = AUTO_CARDS.map((c, i) => ({ org_id: org, name: c.name, owner: u.name, goal: 'TBD', unit: c.unit ?? null, sort_order: i, auto_key: c.key }))
  let { error: e } = await sb.from('eos_scorecard').insert(rows)
  if (e && /auto_key/.test(e.message)) ({ error: e } = await sb.from('eos_scorecard').insert(rows.map(({ auto_key: _a, ...r }) => r))) // before migration 218
  if (e) { console.error('[lexi/exec] seed scorecard failed:', e.message); return 0 }
  return rows.length
}

/** The auto numbers for one week (Mon..Sun, Eastern). "Now" numbers (cash, gates down, old jobs) are read as of now. */
export async function autoNumbers(u: PortalUser, weekOf: string): Promise<Record<string, string>> {
  const ctx = await lexiCtx(u)
  const start = `${weekOf}T00:00:00-05:00`, end = `${addDaysISO(weekOf, 7)}T00:00:00-05:00`
  const startISO = new Date(start).toISOString(), endISO = new Date(end).toISOString()
  const cnt = (r: { count: number | null }) => String(r.count ?? 0)
  const [leads, won, created, quotes, done, old, gates, qbo] = await Promise.all([
    sb.from('leads').select('id', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', startISO).lt('created_at', endISO),
    scopeDeals(sb.from('opportunities').select('*').is('deleted_at', null), ctx.deals).eq('stage', 'won').gte('updated_at', startISO).lt('updated_at', endISO).limit(500),
    scopeDeals(sb.from('opportunities').select('*').is('deleted_at', null), ctx.deals).gte('created_at', startISO).lt('created_at', endISO).limit(1000),
    sb.from('quotes').select('id', { count: 'exact', head: true }).in('status', ['sent', 'viewed', 'accepted']).gte('created_at', startISO).lt('created_at', endISO),
    sb.from('work_orders').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('updated_at', startISO).lt('updated_at', endISO),
    sb.from('work_orders').select('id', { count: 'exact', head: true }).in('status', ['open', 'scheduled', 'in_progress', 'procurement', 'stuck', 'on_hold']).lt('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    sb.from('gate_watches').select('id', { count: 'exact', head: true }).eq('enabled', true).eq('state', 'left_open'),
    within(overview().catch(() => null), 8000, null),
  ])
  const W = (won.data ?? []) as Row[], C = (created.data ?? []) as Row[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = qbo && (qbo as Row).ok ? (qbo as Row).data : null
  const out: Record<string, string> = {
    new_leads: cnt(leads), deals_won: String(W.length), won_value: String(Math.round(W.reduce((a, d) => a + dealValue(d), 0))),
    pipeline_added: String(Math.round(C.reduce((a, d) => a + dealValue(d), 0))), proposals_sent: cnt(quotes), jobs_done: cnt(done),
    jobs_old: cnt(old), gates_down: cnt(gates),
  }
  if (q?.cash?.total != null) out.cash = String(Math.round(Number(q.cash.total)))
  if (q?.receivable?.over90 != null) out.ar_90 = String(Math.round(Number(q.receivable.over90)))
  return out
}

/** Weekly: write last week's numbers for every auto measurable (Monday morning). */
export async function fillScorecard(u: PortalUser, weekOf?: string): Promise<{ written: number; week: string; error?: string }> {
  await ensureScorecard(u)
  const week = weekOf ?? mondayOf(addDaysISO(todayET(), -7))
  const { data, error } = await sb.from('eos_scorecard').select('*').eq('org_id', eosOrg(u))
  if (error) return { written: 0, week, error: error.message }
  const cards = ((data ?? []) as Row[]).filter(c => c.auto_key)
  if (!cards.length) return { written: 0, week }
  const nums = await autoNumbers(u, week)
  const rows = cards.filter(c => nums[c.auto_key] != null).map(c => ({ scorecard_id: c.id, week_of: week, value: nums[c.auto_key] }))
  if (!rows.length) return { written: 0, week }
  const { error: e } = await sb.from('eos_scorecard_entries').upsert(rows, { onConflict: 'scorecard_id,week_of' })
  if (e) return { written: 0, week, error: e.message }
  return { written: rows.length, week }
}

export async function eosUpdate(u: PortalUser, input: Row): Promise<{ ok: boolean; summary: string; message: string; id?: string; revert?: RevertPayload }> {
  const org = eosOrg(u)
  const kind = String(input.kind ?? ''), action = String(input.action ?? '')
  const text = String(input.text ?? '').trim().slice(0, 500)
  const owner = String(input.owner ?? '').trim().slice(0, 80) || u.name
  const id = typeof input.id === 'string' && /^[0-9a-f-]{36}$/i.test(input.id) ? input.id : null
  const bad = (m: string) => ({ ok: false, summary: `EOS: ${kind} ${action}`, message: m })
  const shortT = (t: string) => (t.length > 70 ? `${t.slice(0, 70)}…` : t)
  const now = new Date().toISOString()
  // A row we change must be this company's.
  const mine = async (table: string) => {
    if (!id) return null
    const { data } = await sb.from(table).select('*').eq('id', id).eq('org_id', org).maybeSingle()
    return (data as Row) ?? null
  }

  if (kind === 'vto' && action === 'set') {
    const field = String(input.field ?? '')
    if (!(VTO_FIELDS as readonly string[]).includes(field)) return bad('Pick a V/TO field.')
    const value = input.value
    if (empty(value)) return bad('Nothing to save.')
    const { data: row } = await sb.from('eos_vto').select('*').eq('org_id', org).maybeSingle()
    if (row) {
      const { error } = await sb.from('eos_vto').update({ [field]: value, updated_at: now }).eq('id', row.id)
      if (error) return bad(error.message)
      return { ok: true, id: row.id, summary: `V/TO — ${VTO_LABEL[field]} saved`, message: 'Saved to the V/TO.', revert: { operation: 'update', table: 'eos_vto', id: row.id, data: { [field]: row[field] ?? null } } }
    }
    const { data: ins, error } = await sb.from('eos_vto').insert({ org_id: org, [field]: value }).select('id').single()
    if (error) return bad(error.message)
    return { ok: true, id: ins.id, summary: `V/TO — ${VTO_LABEL[field]} saved`, message: 'Started the V/TO.', revert: { operation: 'delete', table: 'eos_vto', id: ins.id } }
  }

  if (kind === 'rock') {
    if (action === 'add') {
      if (!text) return bad('What is the Rock?')
      const q = quarterOf()
      const due = ymd(input.due_date) ? new Date(`${input.due_date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : new Date(q.year, q.endMonth + 1, 0).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const { data, error } = await sb.from('eos_rocks').insert({ org_id: org, quarter: q.label, name: text, owner, status: 'On Track', progress: 0, due_date: due, is_company_rock: true }).select('id').single()
      if (error) return bad(error.message)
      return { ok: true, id: data.id, summary: `Rock added: ${shortT(text)}`, message: `Added to ${q.label} Rocks.`, revert: { operation: 'delete', table: 'eos_rocks', id: data.id } }
    }
    if (action === 'update') {
      const r = await mine('eos_rocks'); if (!r) return bad('Rock not found — get the id from eos_snapshot.')
      const patch: Row = {}
      if (['On Track', 'Off Track', 'At Risk', 'Complete'].includes(String(input.status))) patch.status = input.status
      if (Number.isFinite(Number(input.progress)) && input.progress !== null && input.progress !== '') patch.progress = Math.max(0, Math.min(100, Math.round(Number(input.progress))))
      if (text) patch.name = text
      if (input.owner) patch.owner = owner
      if (!Object.keys(patch).length) return bad('Nothing to change.')
      const prev = Object.fromEntries(Object.keys(patch).map(k => [k, r[k] ?? null]))
      const { error } = await sb.from('eos_rocks').update({ ...patch, updated_at: now }).eq('id', r.id)
      if (error) return bad(error.message)
      return { ok: true, id: r.id, summary: `Rock updated: ${shortT(String(patch.name ?? r.name))}${patch.status ? ` → ${patch.status}` : ''}${patch.progress != null ? ` (${patch.progress}%)` : ''}`, message: 'Rock updated.', revert: { operation: 'update', table: 'eos_rocks', id: r.id, data: prev } }
    }
  }

  if (kind === 'scorecard') {
    if (action === 'add') {
      if (!text) return bad('What should we measure?')
      const { data, error } = await sb.from('eos_scorecard').insert({ org_id: org, name: text, owner, goal: String(input.goal ?? '').trim() || 'TBD', unit: input.unit ? String(input.unit).slice(0, 20) : null, sort_order: 100 }).select('id').single()
      if (error) return bad(error.message)
      return { ok: true, id: data.id, summary: `Scorecard: added "${shortT(text)}"${input.goal ? ` (goal ${input.goal})` : ''}`, message: 'Added to the Scorecard.', revert: { operation: 'delete', table: 'eos_scorecard', id: data.id } }
    }
    const c = await mine('eos_scorecard'); if (!c) return bad('Measurable not found — get the id from eos_snapshot.')
    if (action === 'update') {
      const patch: Row = {}
      if (input.goal) patch.goal = String(input.goal).slice(0, 60)
      if (input.owner) patch.owner = owner
      if (text) patch.name = text
      if (!Object.keys(patch).length) return bad('Nothing to change.')
      const prev = Object.fromEntries(Object.keys(patch).map(k => [k, c[k] ?? null]))
      const { error } = await sb.from('eos_scorecard').update(patch).eq('id', c.id)
      if (error) return bad(error.message)
      return { ok: true, id: c.id, summary: `Scorecard: ${c.name}${patch.goal ? ` goal → ${patch.goal}` : ' updated'}`, message: 'Scorecard updated.', revert: { operation: 'update', table: 'eos_scorecard', id: c.id, data: prev } }
    }
    if (action === 'record') {
      const value = String(input.value ?? '').trim().slice(0, 40)
      if (!value) return bad('What was the number?')
      const week = ymd(input.week_of) ? mondayOf(String(input.week_of)) : mondayOf(todayET())
      const { error } = await sb.from('eos_scorecard_entries').upsert({ scorecard_id: c.id, week_of: week, value }, { onConflict: 'scorecard_id,week_of' })
      if (error) return bad(error.message)
      return { ok: true, id: c.id, summary: `Scorecard: ${c.name} = ${value} (week of ${week})`, message: 'Recorded.' }
    }
  }

  if (kind === 'issue') {
    if (action === 'add') {
      if (!text) return bad('What is the issue?')
      const pr = ['Critical', 'High', 'Normal'].includes(String(input.priority)) ? input.priority : 'Normal'
      const { data, error } = await sb.from('eos_issues').insert({ org_id: org, description: text, type: 'Company', owner, priority: pr, status: 'Open' }).select('id').single()
      if (error) return bad(error.message)
      return { ok: true, id: data.id, summary: `Issue added: ${shortT(text)}`, message: 'On the Issues list for IDS.', revert: { operation: 'delete', table: 'eos_issues', id: data.id } }
    }
    if (action === 'update') {
      const r = await mine('eos_issues'); if (!r) return bad('Issue not found — get the id from eos_snapshot.')
      const st = ['Open', 'This Meeting', 'In Progress', 'Parking Lot', 'Resolved'].includes(String(input.status)) ? String(input.status) : null
      if (!st) return bad('Status must be Open, This Meeting, In Progress, Parking Lot or Resolved.')
      const patch: Row = { status: st, ...(st === 'Resolved' ? { resolved_at: now } : {}), ...(input.note ? { resolution_note: String(input.note).slice(0, 1000) } : {}) }
      const prev = Object.fromEntries(Object.keys(patch).map(k => [k, r[k] ?? null]))
      const { error } = await sb.from('eos_issues').update(patch).eq('id', r.id)
      if (error) return bad(error.message)
      return { ok: true, id: r.id, summary: `Issue → ${st}: ${shortT(String(r.description))}`, message: 'Issue updated.', revert: { operation: 'update', table: 'eos_issues', id: r.id, data: prev } }
    }
  }

  if (kind === 'todo') {
    if (action === 'add') {
      if (!text) return bad('What is the To-Do?')
      const { data, error } = await sb.from('eos_todos').insert({ org_id: org, text, owner, due_date: ymd(input.due_date) ?? addDaysISO(todayET(), 7), meeting: 'Lexi' }).select('id').single()
      if (error) return bad(error.message)
      return { ok: true, id: data.id, summary: `EOS To-Do: ${shortT(text)} (${owner})`, message: 'Added (7-day To-Do).', revert: { operation: 'delete', table: 'eos_todos', id: data.id } }
    }
    if (action === 'done') {
      const r = await mine('eos_todos'); if (!r) return bad('To-Do not found — get the id from eos_snapshot.')
      const { error } = await sb.from('eos_todos').update({ done: true, done_at: now }).eq('id', r.id)
      if (error) return bad(error.message)
      return { ok: true, id: r.id, summary: `To-Do done: ${shortT(String(r.text))}`, message: 'Marked done.', revert: { operation: 'update', table: 'eos_todos', id: r.id, data: { done: false, done_at: null } } }
    }
  }
  return bad(`I can't do "${kind} ${action}".`)
}

// ── Three briefs a day (8:00, 12:00, 5:00 Eastern) ───────────────────────────
export type BriefSlot = 'morning' | 'lunch' | 'evening'
const SLOT_TITLE: Record<BriefSlot, string> = { morning: 'Morning brief', lunch: 'Lunch brief', evening: 'End-of-day brief' }
const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://portal.gateguard.co').replace(/\/+$/, '')
export const slotForHour = (h: number): BriefSlot => (h < 11 ? 'morning' : h < 15 ? 'lunch' : 'evening')

/** What happened since the last brief — the "since this morning" part. */
async function changesSince(ctx: LexiCtx, sinceISO: string): Promise<Row> {
  const [leads, deals, done, incidents, quotes] = await Promise.all([
    sb.from('leads').select('company_name, contact_name, source, created_at').is('deleted_at', null).gte('created_at', sinceISO).order('created_at', { ascending: false }).limit(15),
    scopeDeals(sb.from('opportunities').select('*').is('deleted_at', null), ctx.deals).gte('updated_at', sinceISO).order('updated_at', { ascending: false }).limit(20),
    sb.from('work_orders').select('wo_number, title, customer_name, assignee_name').eq('status', 'completed').gte('updated_at', sinceISO).limit(20),
    sb.from('incidents').select('title, severity, status, created_at').gte('created_at', sinceISO).limit(15),
    sb.from('quotes').select('title, status, total_one_time, total_mrr, updated_at').gte('updated_at', sinceISO).in('status', ['sent', 'viewed', 'accepted', 'declined']).limit(15),
  ])
  const D = (deals.data ?? []) as Row[]
  return {
    since: sinceISO,
    new_leads: leads.data ?? [],
    deals_moved: D.map(d => ({ name: d.name || d.account_name, stage: STAGE_LABEL[d.stage] ?? d.stage, value: money(dealValue(d)), new: Date.parse(d.created_at) >= Date.parse(sinceISO) })),
    jobs_completed: done.data ?? [],
    new_system_problems: incidents.data ?? [],
    proposals: quotes.data ?? [],
  }
}

/** Build one brief, save it as a Lexi chat (so Russel can answer it), and email it. */
export async function runExecBrief(u: PortalUser, slot: BriefSlot, opts: { force?: boolean; email?: boolean } = {}): Promise<{ ok: boolean; conversationId?: string; skipped?: string; emailed?: boolean; error?: string }> {
  if (!isExec(u)) return { ok: false, error: 'Only for Executive Lexi.' }
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: 'Lexi isn’t set up yet (missing ANTHROPIC_API_KEY).' }
  const day = todayET()
  const state = await getState(u.id)
  const sent: Row = state.briefs && typeof state.briefs === 'object' ? state.briefs : {}
  if (!opts.force && sent[`${day}:${slot}`]) return { ok: true, skipped: 'already sent' }

  const ctx = await lexiCtx(u)
  await ensureScorecard(u).catch(() => 0)
  const since = typeof state.lastBriefAt === 'string' && Date.now() - Date.parse(state.lastBriefAt) < 36 * 3600e3 ? state.lastBriefAt : new Date(Date.now() - (slot === 'morning' ? 16 : 5) * 3600e3).toISOString()
  const [pulse, eos, today, changes, plans, market, weekNow, mine] = await Promise.all([
    companyPulse(ctx).catch(e => ({ error: String(e) })),
    eosSnapshot(u).catch(e => ({ error: String(e) })),
    runReadTool('daily_brief', {}, ctx).then(r => r.data).catch(() => null),
    changesSince(ctx, since).catch(e => ({ error: String(e) })),
    listPlans(u, 'pending', 8).then(r => r.plans.map(p => ({ title: p.title, confidence: p.confidence, impact: money(p.impact_usd), measure: p.measure }))).catch(() => []),
    sb.from('lexi_market_notes').select('headline, why_it_matters, source, url').gte('created_at', since).order('created_at', { ascending: false }).limit(6).then(r => r.data ?? []),
    autoNumbers(u, mondayOf(day)).catch(() => ({})),
    execContext(u).catch(() => ''),
  ])
  const streams = slot === 'lunch' ? null : await allDigests(u, ctx, companyPulse).catch(() => null)
  const focus: Record<BriefSlot, string> = {
    morning: 'Start of the day. Lead with the 1–3 things that matter most today and the decisions waiting on him. Then today (jobs, meetings, tasks), the numbers vs Scorecard goals (this week so far), what changed overnight, market news worth knowing.',
    lunch: 'Midday check. Lead with what changed since the morning brief (leads, deals moved, jobs done, problems) and whether today\'s priorities are on track. Flag anything that needs him this afternoon.',
    evening: 'End of day. Lead with how the day went — wins, misses, numbers vs Scorecard. Then what\'s still open, what to line up for tomorrow, and EOS To-Dos due. Suggest tomorrow\'s top 3.',
  }
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await anthropic.messages.create({
    model: MODEL, max_tokens: 1800,
    system: `You are Lexi, Gate Guard's strategy-and-operations VP, writing Russel's ${SLOT_TITLE[slot].toLowerCase()} for ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York' })}.\n\n${EXEC_PROMPT}`,
    messages: [{ role: 'user', content: `${focus[slot]}

Write it like a sharp VP briefing the CEO: plain words, specific names and numbers, no fluff, under 450 words. Format: short bold labels on their own line (like **Needs your call**), each followed by 1–4 short "- " bullets. No headings with #, no tables. Only use the data below — never invent. If a plan is waiting on him, name it and its certainty. Finish with **Help me build our EOS** and one or two short questions that fill the biggest gap in eos.gaps (one thing each, easy to answer in a sentence).

Since the last brief: ${JSON.stringify(changes).slice(0, 6000)}
Numbers (company_pulse): ${JSON.stringify(pulse).slice(0, 5000)}
This week so far (auto Scorecard): ${JSON.stringify(weekNow)}
EOS: ${JSON.stringify(eos).slice(0, 5000)}
Today: ${JSON.stringify(today).slice(0, 4000)}
Plans waiting on him: ${JSON.stringify(plans)}
Market since last brief: ${JSON.stringify(market).slice(0, 2500)}
${streams ? `Workstreams (${WORKSTREAMS.map(w => WORKSTREAM_LABEL[w]).join(', ')}): ${JSON.stringify(streams).slice(0, 9000)}
` : ''}Plans, your work list + track record:
${mine}

Include **What I'm working on** — 2–5 bullets from your work list with where each stands (and anything new you found in the workstreams worth a look).` }],
  })
  const text = res.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim()
  if (!text) return { ok: false, error: 'Lexi wrote an empty brief.' }

  // Save as a chat: a "user" line first (chat history must start with the user), then the brief.
  const title = `${SLOT_TITLE[slot]} · ${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' })}`
  const { data: conv, error: cErr } = await sb.from('lexi_conversations').insert({ user_id: u.id, org_id: u.org_id, title }).select('id').single()
  if (cErr) return { ok: false, error: cErr.message }
  const { error: mErr } = await sb.from('lexi_messages').insert([
    { conversation_id: conv.id, role: 'user', content: `${SLOT_TITLE[slot]}, please.` },
    { conversation_id: conv.id, role: 'assistant', content: text, cards: { cards: [], did: [], pending: null, charts: [] } },
  ])
  if (mErr) return { ok: false, error: mErr.message }

  let emailed = false
  if (opts.email !== false && u.email) {
    const link = `${APP_URL()}/?tab=lexi&conv=${conv.id}`
    const r = await sendEmail({ to: u.email, subject: `${SLOT_TITLE[slot]}: ${firstLine(text)}`, html: briefEmailHtml(SLOT_TITLE[slot], text, link) })
    emailed = r.success
    if (!r.success) console.error('[lexi/exec] brief email failed:', r.error)
  }
  const keep = Object.fromEntries(Object.entries(sent).filter(([k]) => k >= addDaysISO(day, -3)))
  await saveState(u.id, { ...(await getState(u.id)), lastBriefAt: new Date().toISOString(), lastBriefSlot: slot, briefs: { ...keep, [`${day}:${slot}`]: conv.id } })
  return { ok: true, conversationId: conv.id, emailed }
}

function firstLine(md: string) {
  const l = md.split('\n').map(x => x.replace(/\*\*/g, '').replace(/^[-*]\s+/, '').trim()).find(x => x && !/:$/.test(x)) ?? ''
  return l.length > 70 ? `${l.slice(0, 68)}…` : l
}
function briefEmailHtml(title: string, md: string, link: string) {
  const inline = (s: string) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  const body = md.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    if (/^[-*•]\s+/.test(l)) return `<div style="margin:3px 0 3px 14px;font-size:14px;line-height:1.5;color:#1D1D1F">• ${inline(l.replace(/^[-*•]\s+/, ''))}</div>`
    if (/^\*\*[^*]+\*\*:?$/.test(l)) return `<div style="margin:16px 0 4px;font-size:13px;font-weight:600;color:#6E6E73">${esc(l.replace(/\*\*/g, '').replace(/:$/, ''))}</div>`
    return `<p style="margin:8px 0;font-size:15px;line-height:1.55;color:#1D1D1F">${inline(l.replace(/^#+\s*/, ''))}</p>`
  }).join('')
  return `<!doctype html><html><body style="margin:0;background:#EEF2F7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',Inter,Segoe UI,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F7"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
    <tr><td style="background:#0E1726;border-radius:16px 16px 0 0;padding:20px 24px"><div style="color:#8EC1FF;font-size:13px">Lexi</div><div style="color:#fff;font-size:22px;font-weight:600;margin-top:4px">${esc(title)}</div></td></tr>
    <tr><td style="background:#fff;padding:16px 24px 22px;border-radius:0 0 16px 16px">${body}
      <div style="margin-top:20px"><a href="${esc(link)}" style="display:inline-block;background:#0071E3;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:12px">Answer Lexi</a></div>
      <p style="margin:16px 0 0;font-size:12px;color:#8E8E93">Opens this brief as a chat in Lexi — reply there and she saves what you tell her.</p>
    </td></tr></table></td></tr></table></body></html>`
}
