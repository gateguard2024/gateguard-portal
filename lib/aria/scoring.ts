/**
 * lib/aria/scoring.ts
 *
 * Deterministic Provenance Scoring for ARIA v9
 *
 * Formula:
 *   rawScore = BaseAuthority × FrequencyMultiplier × DirectnessPenalty
 *   finalScore = min(100, round(rawScore / 10 × 100))
 *
 * Where:
 *   BaseAuthority        — 1–10 from SOURCE_AUTHORITY_WEIGHTS (FCC=10, apartments.com=7, etc.)
 *   FrequencyMultiplier  — 1.0 + 0.1 × min(5, extraConfirmations)  → max 1.5
 *   DirectnessPenalty    — 1.0 (direct) | 0.7 (inferred) | 0.5 (hearsay/social)
 *
 * Max possible raw: 10 × 1.5 × 1.0 = 15 → normalized to 100 ✓
 * Min possible:      1 × 1.0 × 0.5 = 0.5 → normalized to 5
 *
 * Usage:
 *   const score = calculateProvenanceScore({ url, factType, confirmationCount, isDirectEvidence })
 *   const authority = sourceAuthority(url)
 */

export interface ProvenanceInput {
  /** Source URL of the evidence (used for authority lookup) */
  url: string
  /** Fact type from evidence packet (units | phone | isp | contact | etc.) */
  factType?: string
  /** How many OTHER sources confirmed the same value (0 = only this source) */
  confirmationCount?: number
  /** True = directly stated in source. False = inferred from context. */
  isDirectEvidence?: boolean
  /** True = hearsay (review complaint, social media rumor). Lowest confidence tier. */
  isHearsay?: boolean
}

export interface ProvenanceBreakdown {
  /** Final normalized score 0–100 */
  score: number
  /** 1–10 source authority weight */
  authority: number
  /** 1.0–1.5 frequency multiplier */
  frequency_mult: number
  /** 0.5 | 0.7 | 1.0 directness penalty */
  directness_penalty: number
  /** Raw (pre-normalization) score */
  raw_score: number
}

// ─── SOURCE_AUTHORITY_WEIGHTS ─────────────────────────────────────────────────
// Weights are assigned by domain. Subdomains inherit parent's weight.
// New domains default to 5 (neutral).
const SOURCE_AUTHORITY_WEIGHTS: Record<string, number> = {
  // Government / Regulatory (highest)
  'fcc.gov': 10,
  'sec.gov': 10,
  'edgar.online': 9,
  'opencorporates.com': 9,
  'county.gov': 9,
  'assessor.gov': 9,

  // Authoritative listing / financial sites
  'costar.com': 9,
  'loopnet.com': 8,
  'realpage.com': 8,
  'yardi.com': 8,
  'multihousingnews.com': 8,
  'nmhc.org': 8,
  'apartments.com': 7,
  'apartmentlist.com': 7,
  'rentcafe.com': 7,
  'zillow.com': 7,
  'trulia.com': 6,
  'rent.com': 6,
  'forrent.com': 6,
  'apartmentguide.com': 6,
  'zumper.com': 6,

  // Company / Property official sites (high confidence when found)
  'greystar.com': 8,
  'lincolnapts.com': 8,
  'camdenlivng.com': 8,
  'bozzuto.com': 8,
  'cortland.com': 8,
  'equityapartments.com': 8,
  'udr.com': 8,
  'maac.com': 8,
  'naiop.org': 7,

  // ISP / Tech vendor official (direct confirmation)
  'att.com': 7,
  'spectrum.com': 7,
  'comcast.com': 7,
  'verizon.com': 7,
  'brivo.com': 7,
  'liftmaster.com': 7,
  'butterfly.mx': 7,
  'dormakaba.com': 7,

  // News / Press
  'businesswire.com': 7,
  'prnewswire.com': 7,
  'businessjournals.com': 6,
  'multifamilydive.com': 7,
  'globest.com': 7,
  'bisnow.com': 7,
  'nrei.com': 7,

  // Professional network / data enrichment
  'linkedin.com': 6,
  'apollo.io': 6,
  'nubela.co': 6,         // NinjaPear

  // Google / Bing Knowledge Graph
  'google.com': 6,

  // General review / social (lower confidence)
  'yelp.com': 4,
  'google.maps': 4,
  'facebook.com': 3,
  'reddit.com': 3,
  'twitter.com': 3,
  'x.com': 3,
  'nextdoor.com': 3,
  'apartmentratings.com': 4,

  // DB (our own verified data — treated as authoritative for what we store)
  'db.internal': 9,
}

/**
 * Look up the authority weight for a URL.
 * Strips protocol and www, matches on domain or subdomain suffix.
 * Returns 5 (neutral) for unknown domains.
 */
export function sourceAuthority(url: string): number {
  if (!url) return 5
  // Handle internal DB marker
  if (url === 'db' || url === 'db.internal') return 9

  let domain = url.toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0]

  // Direct match
  if (SOURCE_AUTHORITY_WEIGHTS[domain]) return SOURCE_AUTHORITY_WEIGHTS[domain]

  // Subdomain match — walk up to root
  const parts = domain.split('.')
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.')
    if (SOURCE_AUTHORITY_WEIGHTS[parent]) return SOURCE_AUTHORITY_WEIGHTS[parent]
  }

  // TLD-based fallback
  if (domain.endsWith('.gov')) return 9
  if (domain.endsWith('.edu')) return 7

  return 5 // neutral default
}

/**
 * Calculate the deterministic provenance score for a single evidence packet.
 * Returns both the final normalized score (0–100) and the full breakdown.
 */
export function calculateProvenanceScore(input: ProvenanceInput): ProvenanceBreakdown {
  const authority = sourceAuthority(input.url)

  // Frequency multiplier: each additional confirmation adds 0.1, capped at 5 extra
  const confirmations = Math.min(5, input.confirmationCount ?? 0)
  const frequency_mult = 1.0 + (confirmations * 0.1)

  // Directness penalty
  let directness_penalty: number
  if (input.isHearsay) {
    directness_penalty = 0.5
  } else if (input.isDirectEvidence === false) {
    directness_penalty = 0.7
  } else {
    directness_penalty = 1.0
  }

  const raw_score = authority * frequency_mult * directness_penalty
  // Normalize: max raw is 10×1.5×1.0=15 → maps to 100
  const score = Math.min(100, Math.round((raw_score / 10) * 100))

  return { score, authority, frequency_mult, directness_penalty, raw_score }
}

/**
 * Batch-score a set of evidence packets and return the highest provenance score
 * for a specific fact type (e.g., "isp" — returns the best-sourced ISP evidence).
 */
export function topScoreForFactType(
  packets: Array<{ source_url: string; fact_type: string; confidence?: number; source_authority?: number }>,
  factType: string
): number {
  const relevant = packets.filter(p => p.fact_type === factType)
  if (!relevant.length) return 0
  return Math.max(...relevant.map(p => {
    const { score } = calculateProvenanceScore({ url: p.source_url ?? '' })
    return score
  }))
}
