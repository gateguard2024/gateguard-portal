/**
 * Canonical GateGuard sales pipeline — single source of truth.
 *
 * The opportunity LIFECYCLE (components/nexus/OpportunityLifecycle.tsx) writes
 * granular per-step keys (overview, survey, financials, proposal, negotiate,
 * contract_invoice, sign, payment) while the kanban BOARD groups by a smaller
 * set of columns. Historically these drifted, so lifecycle stages like
 * `contract_invoice` / `sign` / `payment` had no kanban column and the opp
 * silently vanished from the board. normalizeStage() folds every known variant
 * into one of the 7 canonical pipeline stages (+ terminal lost/dead) so an opp
 * is ALWAYS on the board no matter which key was written.
 *
 * No secrets here — safe to import from both server routes and client code.
 */

export interface PipelineStage { key: string; label: string; probability: number }

// The 7 open pipeline stages, in order.
export const PIPELINE_STAGES: PipelineStage[] = [
  { key: 'meet_present', label: 'Meet & Present',  probability: 20 },
  { key: 'survey',       label: 'Site Survey',      probability: 35 },
  { key: 'propose',      label: 'Proposal',         probability: 50 },
  { key: 'negotiate',    label: 'Negotiate',        probability: 70 },
  { key: 'contract',     label: 'Contract & Sign',  probability: 85 },
  { key: 'deposit',      label: 'Deposit',          probability: 95 },
  { key: 'won',          label: 'Closed Won',       probability: 100 },
]

// Terminal stages (shown as their own columns, excluded from open pipeline $).
export const TERMINAL_STAGES: PipelineStage[] = [
  { key: 'lost', label: 'Lost', probability: 0 },
  { key: 'dead', label: 'Dead', probability: 0 },
]

// Full column order for the board.
export const STAGE_ORDER: string[] = [...PIPELINE_STAGES, ...TERMINAL_STAGES].map(s => s.key)

const ALL_STAGES = [...PIPELINE_STAGES, ...TERMINAL_STAGES]
export const STAGE_LABELS: Record<string, string> = Object.fromEntries(ALL_STAGES.map(s => [s.key, s.label]))
export const STAGE_PROB: Record<string, number> = Object.fromEntries(ALL_STAGES.map(s => [s.key, s.probability]))

// Every variant key we've ever written → its canonical pipeline stage.
const STAGE_ALIASES: Record<string, string> = {
  // Meet & Present
  meet_present: 'meet_present', overview: 'meet_present', new: 'meet_present',
  lead: 'meet_present', info_request: 'meet_present', meeting: 'meet_present', present: 'meet_present',
  // Survey
  survey: 'survey', survey_request: 'survey', site_survey: 'survey',
  // Proposal
  propose: 'propose', proposal: 'propose', proposal_sent: 'propose',
  financials: 'propose', pre_approval: 'propose', quote: 'propose',
  // Negotiate
  negotiate: 'negotiate', negotiation: 'negotiate',
  // Contract & Sign
  contract: 'contract', contract_invoice: 'contract', agreement_deposit: 'contract',
  sign: 'contract', agreement_signed: 'contract', signed: 'contract',
  // Deposit
  deposit: 'deposit', payment: 'deposit', deposit_invoice: 'deposit', agreement_paid: 'deposit',
  // Won
  won: 'won', deposit_collected: 'won', closed_won: 'won', active: 'won',
  // Terminal
  lost: 'lost', closed_lost: 'lost', dead: 'dead', archived: 'dead',
}

/** Fold any raw stage value into one of the canonical pipeline keys. */
export function normalizeStage(raw: string | null | undefined): string {
  if (!raw) return 'meet_present'
  const k = String(raw).toLowerCase().trim()
  return STAGE_ALIASES[k] ?? 'meet_present'
}

export function stageLabel(raw: string | null | undefined): string {
  return STAGE_LABELS[normalizeStage(raw)] ?? 'Meet & Present'
}
export function stageProbability(raw: string | null | undefined): number {
  return STAGE_PROB[normalizeStage(raw)] ?? 20
}
