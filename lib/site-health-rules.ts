/**
 * Property health — the rules (shared by server + screens). Tune the numbers here.
 * Decided Nov 19 2026: start at 100, lose points for what's actually wrong right now,
 * always show the reasons. 85+ Good · 60–84 Watch · under 60 Needs attention.
 * Engine: lib/site-health.ts.
 */
export const HEALTH_POINTS = {
  gateLeftOpen: 20,     // Gate Watch: gate left open past its limit
  faultOpen: 20,        // an open Fault (incident) not already counted as a gate
  gateBlind: 10,        // Gate Watch can't see a gate
  camerasMax: 30,       // all cameras offline = −30 (scaled by share offline)
  jobUrgent: 10,        // open job, high / urgent / critical
  jobOther: 3,          // any other open job
  jobOverdue: 5,        // extra, scheduled date has passed
  requestHigh: 10,      // open service request, high / urgent
  requestOther: 5,      // any other open request
  repeatVisit: 5,       // a return trip in the last 90 days (same gate/door within 30 days)
  repeatMax: 15,
} as const

export type HealthBand = 'good' | 'watch' | 'bad'
export type HealthReason = { kind: string; text: string; points: number }
export type SiteHealth = { score: number; band: HealthBand; reasons: HealthReason[] }

export const bandOf = (score: number): HealthBand => (score >= 85 ? 'good' : score >= 60 ? 'watch' : 'bad')
export const BAND_LABEL: Record<HealthBand, string> = { good: 'Good', watch: 'Keep an eye on it', bad: 'Needs attention' }

/** Build a score from reasons (biggest first). */
export function scoreOf(reasons: HealthReason[]): SiteHealth {
  const r = reasons.filter((x) => x.points > 0).sort((a, b) => b.points - a.points)
  const score = Math.max(0, 100 - r.reduce((s, x) => s + x.points, 0))
  return { score, band: bandOf(score), reasons: r }
}

/** Add live camera status (known on the property page) to a server score. */
export function withCameras(h: SiteHealth, online: number, total: number): SiteHealth {
  if (!total || online >= total) return h
  const off = total - online
  const pts = Math.round(HEALTH_POINTS.camerasMax * (off / total))
  return scoreOf([...h.reasons.filter((x) => x.kind !== 'cameras'), { kind: 'cameras', text: `${off} of ${total} camera${total === 1 ? '' : 's'} offline`, points: pts }])
}

/** One short line: the top reasons. */
export function healthLine(h: SiteHealth, max = 2): string {
  if (!h.reasons.length) return 'Nothing open'
  const top = h.reasons.slice(0, max).map((r) => r.text).join(' · ')
  return h.reasons.length > max ? `${top} · +${h.reasons.length - max} more` : top
}
