/**
 * Site lifecycle + activation rule (#60).
 *
 * A site only becomes ACTIVE when the contract is signed AND the deposit is
 * paid. Until both are true it sits in prospect/onboarding. This is the single
 * source of truth for that rule — used by the deposit→job automation (to stamp
 * a site active) and by the UI (to show status + what's blocking activation).
 *
 * Drift-tolerant: reads timestamp columns (contract_signed_at / deposit_paid_at)
 * if present, or boolean flags (contract_signed / deposit_paid) as a fallback,
 * so it works before AND after migration 126 runs.
 *
 * No secrets — safe to import from server routes and client code.
 */

export type SiteStatus = 'prospect' | 'onboarding' | 'active' | 'inactive' | 'churned'

export const SITE_STATUS_LABELS: Record<SiteStatus, string> = {
  prospect:   'Prospect',
  onboarding: 'Onboarding',
  active:     'Active',
  inactive:   'Inactive',
  churned:    'Churned',
}

export const SITE_STATUS_COLORS: Record<SiteStatus, string> = {
  prospect:   '#94a3b8',
  onboarding: '#f59e0b',
  active:     '#34d399',
  inactive:   '#64748b',
  churned:    '#fca5a5',
}

export interface SiteActivation {
  contractSigned: boolean
  depositPaid: boolean
  canActivate: boolean      // both prerequisites met
  status: SiteStatus        // effective lifecycle status
  active: boolean
  blockers: string[]        // what's still needed to activate
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function siteActivation(site: Record<string, any> | null | undefined): SiteActivation {
  const s = site ?? {}
  const contractSigned = !!(s.contract_signed_at || s.contract_signed)
  const depositPaid    = !!(s.deposit_paid_at || s.deposit_paid)
  const canActivate    = contractSigned && depositPaid

  const blockers: string[] = []
  if (!contractSigned) blockers.push('Contract not signed')
  if (!depositPaid)    blockers.push('Deposit not collected')

  // Explicit lifecycle_status wins if set to a terminal/manual state; otherwise
  // derive from the activation rule.
  const explicit = (s.lifecycle_status || s.status) as SiteStatus | undefined
  let status: SiteStatus
  if (explicit === 'inactive' || explicit === 'churned') {
    status = explicit
  } else if (canActivate) {
    status = 'active'
  } else if (contractSigned || depositPaid) {
    status = 'onboarding'
  } else {
    status = explicit && SITE_STATUS_LABELS[explicit] ? explicit : 'prospect'
  }

  return { contractSigned, depositPaid, canActivate, status, active: status === 'active', blockers }
}
