/**
 * Parking & access (P&A) fee math — one place, used by the move-in page, the Stripe
 * checkout and staff screens. Rules come from site_access_fees (per property) and are
 * snapshotted onto each move_in_invites row when it's created.
 */
import { createServiceClient } from '@/lib/supabase'

/**
 * resident          → resident pays GateGuard online at move-in
 * property          → property pays GateGuard; resident pays nothing
 * property_collects → property charges the resident (rent ledger) and remits to GateGuard
 * partial           → property covers part; resident pays the rest online
 */
export type PaidBy = 'resident' | 'property' | 'property_collects' | 'partial'

export interface FeeRules {
  enabled: boolean
  amountCents: number
  chargePer: 'lease' | 'person'
  paidBy: PaidBy
  propertyCoversCents: number // per lease, or per person when chargePer = 'person'
  termMonths: number
}

export const DEFAULT_FEE_RULES: FeeRules = { enabled: true, amountCents: 15000, chargePer: 'lease', paidBy: 'resident', propertyCoversCents: 0, termMonths: 12 }

export interface FeeCode { id: string; covers: 'full' | 'amount'; amountOffCents: number | null; code: string }

export interface FeeQuote {
  people: number
  units: number                 // 1 per lease, or number of people
  grossCents: number
  propertyCoversCents: number   // part GateGuard bills the property for
  codeOffCents: number
  dueCents: number              // what the resident pays now
  lines: Array<{ label: string; cents: number }>
}

export function quoteFee(rules: FeeRules, people: number, code?: FeeCode | null): FeeQuote {
  const units = rules.chargePer === 'person' ? Math.max(1, people) : 1
  const gross = rules.enabled ? rules.amountCents * units : 0
  const covered =
    !rules.enabled ? 0
    : rules.paidBy === 'property' || rules.paidBy === 'property_collects' ? gross
    : rules.paidBy === 'partial' ? Math.min(gross, rules.propertyCoversCents * units)
    : 0
  const afterProperty = gross - covered
  const off = !code || afterProperty === 0 ? 0 : code.covers === 'full' ? afterProperty : Math.min(afterProperty, code.amountOffCents ?? 0)
  const due = Math.max(0, afterProperty - off)

  const term = `${rules.termMonths} months`
  const lines: FeeQuote['lines'] = []
  if (gross > 0) {
    lines.push({
      label: rules.chargePer === 'person'
        ? `Parking & access · ${units} ${units === 1 ? 'person' : 'people'} × ${money(rules.amountCents)} · ${term}`
        : `Parking & access · ${term}`,
      cents: gross,
    })
  }
  if (covered > 0) {
    lines.push({
      label: rules.paidBy === 'property' ? 'Paid by your community'
        : rules.paidBy === 'property_collects' ? 'Billed by your community (on your lease)'
        : 'Your community pays part',
      cents: -covered,
    })
  }
  if (off > 0 && code) lines.push({ label: `Code ${code.code}`, cents: -off })
  return { people, units, grossCents: gross, propertyCoversCents: covered, codeOffCents: off, dueCents: due, lines }
}

export function money(cents: number) {
  const neg = cents < 0
  const v = Math.abs(cents) / 100
  return `${neg ? '−' : ''}$${v.toFixed(v % 1 === 0 ? 0 : 2)}`
}

/** Property rules, or the GateGuard default if the property has none yet. */
export async function getSiteFeeRules(siteId: string): Promise<FeeRules> {
  const db = createServiceClient()
  const { data } = await db.from('site_access_fees').select('*').eq('site_id', siteId).maybeSingle()
  if (!data) return DEFAULT_FEE_RULES
  return {
    enabled: data.enabled,
    amountCents: data.amount_cents,
    chargePer: data.charge_per,
    paidBy: data.paid_by,
    propertyCoversCents: data.property_covers_cents,
    termMonths: data.term_months,
  }
}

export type CodeCheck = { ok: true; code: FeeCode } | { ok: false; error: string }

/** Check a redemption code for a property (does NOT use it up). */
export async function checkFeeCode(siteId: string, raw: string): Promise<CodeCheck> {
  const code = raw.trim().toUpperCase().replace(/\s+/g, '')
  if (!code) return { ok: false, error: 'Enter a code.' }
  const db = createServiceClient()
  const { data } = await db.from('access_fee_codes').select('*').eq('site_id', siteId).eq('code', code).maybeSingle()
  if (!data) return { ok: false, error: 'That code isn’t valid for this community. Check it and try again.' }
  if (data.status === 'cancelled') return { ok: false, error: 'That code has been cancelled. Contact the leasing office.' }
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return { ok: false, error: 'That code has expired. Contact the leasing office.' }
  if (data.used_count >= data.max_uses) return { ok: false, error: 'That code has already been used.' }
  return { ok: true, code: { id: data.id, covers: data.covers, amountOffCents: data.amount_off_cents, code: data.code } }
}
