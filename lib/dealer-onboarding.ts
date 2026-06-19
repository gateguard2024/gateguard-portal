/**
 * Dealer onboarding — canonical 8-stage workflow (#48).
 * Source spec: docs/nexus/DEALER_ONBOARDING_WORKFLOW.md.
 *
 * The onboarding BOARD derives fine-grained "buckets" from document state
 * (needs_nda → nda_sent → … → live). This file maps those buckets onto the 8
 * business stages the spec defines, and adds the pieces the doc-flow can't
 * derive: vetting (stage 1), channel manager (stage 2), and the 30/60/90-day
 * reviews (stage 8). No secrets — safe to import anywhere.
 */

export interface OnboardingStage { n: number; key: string; label: string; desc: string }

export const ONBOARDING_STAGES: OnboardingStage[] = [
  { n: 1, key: 'vetting',       label: 'Vetting',            desc: 'Application, background/credit check, entity + territory verification.' },
  { n: 2, key: 'hierarchy',     label: 'Hierarchy & Team',   desc: 'Set tier/parent org and assign a Channel Manager.' },
  { n: 3, key: 'contracting',   label: 'Contracting',        desc: 'NDA + Dealer Agreement (and W-9 / ACH) signed.' },
  { n: 4, key: 'provisioning',  label: 'Provisioning',       desc: 'Portal account, users, and access controls created.' },
  { n: 5, key: 'welcome',       label: 'Welcome & Assets',   desc: 'Welcome letter, credentials, and marketing toolkit sent.' },
  { n: 6, key: 'training',      label: 'Training & Cert',    desc: 'Platform, sales, and field certification.' },
  { n: 7, key: 'go_live',       label: 'First Sale / Go-Live', desc: 'Shadowed first sale, then unrestricted go-live.' },
  { n: 8, key: 'reviews',       label: '30/60/90 Reviews',   desc: 'Ongoing check-ins on volume, quality, compliance.' },
]

// Map the board's document-derived bucket → the spec stage number it sits in.
export const BUCKET_TO_STAGE: Record<string, number> = {
  draft: 1,
  needs_nda: 3, nda_sent: 3, nda_signed: 3, needs_agreement: 3, agreement_signed: 3, needs_compliance: 3,
  ready_to_approve: 4,
  live: 8,
}
export function stageForBucket(bucket: string): OnboardingStage {
  const n = BUCKET_TO_STAGE[bucket] ?? 1
  return ONBOARDING_STAGES[n - 1]
}

// ── Vetting (stage 1) ────────────────────────────────────────────────────────
export type VettingStatus = 'not_started' | 'in_progress' | 'cleared' | 'flagged'
export const VETTING_OPTIONS: { value: VettingStatus; label: string; color: string }[] = [
  { value: 'not_started', label: 'Not started', color: '#64748B' },
  { value: 'in_progress', label: 'In progress', color: '#FBBF24' },
  { value: 'cleared',     label: 'Cleared',     color: '#34D399' },
  { value: 'flagged',     label: 'Flagged',     color: '#F87171' },
]
export function vettingMeta(v: string | null | undefined) {
  return VETTING_OPTIONS.find(o => o.value === v) ?? VETTING_OPTIONS[0]
}

// ── 30/60/90-day reviews (stage 8) ───────────────────────────────────────────
export type ReviewState = 'upcoming' | 'due' | 'overdue'
export interface ReviewPoint { day: number; dueAt: string; state: ReviewState }

const DAY_MS = 24 * 60 * 60 * 1000
const GRACE_DAYS = 7

/** From a go-live / onboarded date, return the 30/60/90 review points + state. */
export function reviewSchedule(onboardedAt: string | null | undefined): ReviewPoint[] {
  if (!onboardedAt) return []
  const start = new Date(onboardedAt).getTime()
  if (isNaN(start)) return []
  const now = Date.now()
  return [30, 60, 90].map(day => {
    const due = start + day * DAY_MS
    let state: ReviewState = 'upcoming'
    if (now > due + GRACE_DAYS * DAY_MS) state = 'overdue'
    else if (now >= due) state = 'due'
    return { day, dueAt: new Date(due).toISOString(), state }
  })
}
