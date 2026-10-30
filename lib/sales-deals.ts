/**
 * Sales board — shared server helpers (scope, money, shaping).
 *
 * Who sees what (Russel, Oct 2026):
 *   Gate Guard admins → every deal          (corporate + admin/supervisor)
 *   Gate Guard reps   → their own deals     (corporate + rep role)
 *   Dealer admins     → all their dealership's deals (+ child dealerships)
 *   Dealer reps       → only their own deals inside that dealership
 * = org subtree (resolveOrgScope) AND, for plain "user" roles, rep_id = me.
 */
import { createClient } from '@supabase/supabase-js'
import type { PortalUser } from '@/lib/current-user'
import { resolveOrgScope, isInScope, getProfileId, type OrgScope } from '@/lib/org-scope'
import { normalizeRole } from '@/lib/permissions'
import { normalizeStage, STAGE_LABELS, STAGE_PROB } from '@/lib/pipeline'

export const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const OPEN_STAGES = ['meet_present', 'survey', 'propose', 'negotiate', 'contract', 'deposit'] as const
export const STALLED_DAYS = 15
export const DEFAULT_TERM = 36 // months, when a deal has no term yet

export type DealCtx = { user: PortalUser; scope: OrgScope; profileId: string | null; repOnly: boolean }

export async function dealCtx(user: PortalUser): Promise<DealCtx> {
  const [scope, profileId] = await Promise.all([resolveOrgScope(user), getProfileId(user.id, user.email)])
  return { user, scope, profileId, repOnly: normalizeRole(user.role) === 'user' }
}

const NO_MATCH = '00000000-0000-0000-0000-000000000000'

/** Apply the visibility rules to an opportunities query. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scopeDeals<Q extends { or: (f: string) => any; eq: (c: string, v: string) => any }>(q: Q, ctx: DealCtx): Q {
  let out: Q = q
  if (!ctx.scope.all) {
    const parts: string[] = []
    if (ctx.scope.ids.length) parts.push(`dealer_org_id.in.(${ctx.scope.ids.join(',')})`)
    if (ctx.profileId) parts.push(`rep_id.eq.${ctx.profileId}`) // cross-org deal assigned to me
    out = parts.length ? out.or(parts.join(',')) : out.eq('id', NO_MATCH)
  }
  if (ctx.repOnly) out = out.eq('rep_id', ctx.profileId ?? NO_MATCH)
  return out
}

/** Can this user see (and so work) this deal? */
export function dealVisible(row: { dealer_org_id?: string | null; rep_id?: string | null }, ctx: DealCtx): boolean {
  const mine = !!ctx.profileId && row.rep_id === ctx.profileId
  if (ctx.repOnly) return mine
  return ctx.scope.all || mine || isInScope(ctx.scope, row.dealer_org_id)
}

export async function loadVisibleDeal(id: string, ctx: DealCtx) {
  const { data, error } = await sb.from('opportunities').select('*').eq('id', id).is('deleted_at', null).maybeSingle()
  if (error) return { error: error.message, status: 500 as const }
  if (!data || !dealVisible(data, ctx)) return { error: 'Not found', status: 404 as const }
  return { deal: data as Row }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))

export function dealMoney(d: Row) {
  const mrr = num(d.est_mrr) ?? num(d.monthly_total)
  const install = num(d.install_fee) ?? num(d.est_setup)
  const term = num(d.contract_term)
  const tcv = mrr != null ? mrr * (term ?? DEFAULT_TERM) + (install ?? 0) : (num(d.amount) ?? install)
  return { mrr, install, term, tcv, termAssumed: mrr != null && term == null }
}

export function dealTab(d: Row): 'open' | 'won' | 'lost' | 'archived' {
  const s = normalizeStage(d.stage)
  if (s === 'won') return 'won'
  if (s === 'lost' || s === 'dead') return 'lost'
  if (d.archived_at) return 'archived'
  return 'open'
}

export const dealKey = (n: unknown) => (n ? `D-${n}` : '')

/** Shape a row for the board (money hidden for roles without financial access). */
export function shapeDeal(d: Row, ctx: DealCtx, extra: { next?: Row | null; overdue?: number; ownerName?: string | null; hasJob?: boolean; dealerName?: string | null } = {}) {
  const stage = normalizeStage(d.stage)
  const m = dealMoney(d)
  const fin = ctx.user.canViewFinancials
  // Win % comes from the stage (the stored column is often a stale default of 20).
  const prob = STAGE_PROB[stage] ?? 0
  const changed = d.stage_changed_at ?? d.updated_at ?? d.created_at
  const days = changed ? Math.max(0, Math.floor((Date.now() - new Date(changed).getTime()) / 86400000)) : 0
  return {
    id: d.id as string,
    key: dealKey(d.deal_number),
    name: (d.name as string) || 'Untitled deal',
    account: (d.account_name as string) || (d.management_co as string) || null,
    management_co: d.management_co ?? null,
    units: num(d.units),
    city: [d.property_city, d.property_state].filter(Boolean).join(', ') || null,
    stage, stage_label: STAGE_LABELS[stage] ?? stage, probability: prob,
    tab: dealTab(d),
    close_date: d.close_date ?? null,
    mrr: fin ? m.mrr : null, tcv: fin ? m.tcv : null, weighted: fin && m.tcv != null ? Math.round(m.tcv * prob / 100) : null,
    term_assumed: m.termAssumed,
    owner_id: d.rep_id ?? null,
    owner_name: extra.ownerName ?? null,
    dealer_id: (d.dealer_org_id as string | null) ?? null,
    dealer_name: extra.dealerName ?? null,
    days_in_stage: days, stalled: days >= STALLED_DAYS,
    next: extra.next ? { id: extra.next.id, type: extra.next.type, subject: extra.next.subject, due_at: extra.next.due_at } : null,
    overdue: extra.overdue ?? 0,
    type: d.opp_type ?? null, source: d.source ?? null, tags: d.tags ?? [],
    created_at: d.created_at ?? null, won_at: d.won_at ?? null, lost_at: d.lost_at ?? null,
    lost_reason: d.lost_reason ?? null, lost_competitor: d.lost_competitor ?? null, lost_note: d.lost_note ?? null,
    has_job: !!extra.hasJob,
  }
}

/** profiles.id → display name. */
export async function profileNames(ids: string[]): Promise<Record<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean))]
  if (!uniq.length) return {}
  const { data } = await sb.from('profiles').select('id, first_name, last_name, email').in('id', uniq)
  const out: Record<string, string> = {}
  for (const p of (data ?? []) as Row[]) out[p.id] = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Unknown'
  return out
}

/** Board card for one deal, with its live next step / overdue count / job flag. */
export async function cardFor(deal: Row, ctx: DealCtx) {
  const [acts, wo, names] = await Promise.all([
    sb.from('crm_activities').select('id, type, subject, due_at').eq('opportunity_id', deal.id).is('completed_at', null).not('due_at', 'is', null).order('due_at', { ascending: true }),
    sb.from('work_orders').select('id').eq('opportunity_id', deal.id).limit(1),
    profileNames([deal.rep_id]),
  ])
  const list = (acts.data ?? []) as Row[]
  const now = Date.now()
  return shapeDeal(deal, ctx, {
    next: list[0] ?? null, overdue: list.filter(a => new Date(a.due_at).getTime() < now).length,
    ownerName: ownerFor(deal, names), hasJob: !wo.error && (wo.data ?? []).length > 0,
    dealerName: await orgName(deal.dealer_org_id),
  })
}


export type Risk = { key: string; level: 'red' | 'orange'; text: string; fix: string }
const STAGE_RANK: Record<string, number> = { meet_present: 0, survey: 1, propose: 2, negotiate: 3, contract: 4, deposit: 5 }

/** Deal health (0–100) from real gaps only. Each risk names the field / place that fixes it. */
export function dealHealth(deal: Row, card: ReturnType<typeof shapeDeal>, extra: { hasDecisionMaker: boolean; primaryQuote: Row | null }) {
  if (card.tab !== 'open') return null
  const risks: Risk[] = []
  const ok: string[] = []
  const rank = STAGE_RANK[card.stage] ?? 0
  const today = new Date().toISOString().slice(0, 10)
  if (card.overdue > 0) risks.push({ key: 'overdue', level: 'red', text: `${card.overdue} overdue step${card.overdue === 1 ? '' : 's'}${card.next?.subject ? `: ${card.next.subject}` : ''}`, fix: 'steps' })
  else if (!card.next) risks.push({ key: 'no_next', level: 'orange', text: 'No next step planned', fix: 'steps' })
  else ok.push('next step planned')
  if (card.close_date && card.close_date < today) {
    const n = Math.round((Date.parse(today) - Date.parse(card.close_date)) / 86400000)
    risks.push({ key: 'close_passed', level: 'red', text: `Expected close date passed ${n} day${n === 1 ? '' : 's'} ago`, fix: 'close_date' })
  } else if (!card.close_date) risks.push({ key: 'no_close', level: 'orange', text: 'No expected close date', fix: 'close_date' })
  if (card.stalled) risks.push({ key: 'stalled', level: 'orange', text: `Stuck in ${card.stage_label} for ${card.days_in_stage} days`, fix: 'stage' })
  if (deal.budget_status === 'confirmed') ok.push('budget confirmed')
  else risks.push({ key: 'budget', level: 'orange', text: deal.budget_status === 'not_confirmed' ? 'Budget not confirmed' : 'Budget unknown', fix: 'budget_status' })
  if (extra.hasDecisionMaker) ok.push('decision maker known')
  else risks.push({ key: 'dm', level: 'orange', text: 'No decision maker among the contacts', fix: 'contacts' })
  const qs = extra.primaryQuote?.status as string | undefined
  if (rank >= 2 && (!qs || qs === 'draft')) risks.push({ key: 'quote_unsent', level: 'orange', text: qs ? 'Proposal not sent yet' : 'No proposal on this deal', fix: 'quote' })
  else if (rank >= 4 && qs !== 'accepted') risks.push({ key: 'quote_unaccepted', level: 'orange', text: 'Proposal not accepted yet', fix: 'quote' })
  else if (qs === 'accepted') ok.push('proposal accepted')
  if (rank >= 4 && !deal.target_install_date) risks.push({ key: 'install', level: 'orange', text: "No install date — Operations can't plan", fix: 'target_install_date' })
  const weight: Record<string, number> = { overdue: 15, no_next: 15, close_passed: 15, no_close: 5, stalled: 10, budget: 10, dm: 10, quote_unsent: 10, quote_unaccepted: 10, install: 10 }
  const score = Math.max(0, 100 - risks.reduce((n, r) => n + (weight[r.key] ?? 5), 0))
  return { score, label: score >= 80 ? 'Healthy' : score >= 60 ? 'Needs work' : 'At risk', risks, ok }
}

/**
 * Who owns a deal = its rep (rep_id → profile). The old owner_name column defaulted to
 * "Russel Feldman" on every row (migration 008), so it is only trusted when rep_id is set.
 */
export function ownerFor(d: Row, names: Record<string, string>): string | null {
  if (!d.rep_id) return null
  return names[d.rep_id] || d.owner_name || null
}

export async function orgNames(ids: string[]): Promise<Record<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean))]
  if (!uniq.length) return {}
  const { data } = await sb.from('organizations').select('id, name').in('id', uniq)
  return Object.fromEntries(((data ?? []) as Row[]).map(o => [o.id as string, (o.name as string) || 'Unnamed company']))
}
async function orgName(id: string | null | undefined) { return id ? (await orgNames([id]))[id] ?? null : null }
