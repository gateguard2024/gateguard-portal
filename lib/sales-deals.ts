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
export function shapeDeal(d: Row, ctx: DealCtx, extra: { next?: Row | null; overdue?: number; ownerName?: string | null; hasJob?: boolean } = {}) {
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
