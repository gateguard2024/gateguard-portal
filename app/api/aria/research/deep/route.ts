/**
 * POST /api/aria/research/deep
 *
 * ARIA Sales Intelligence Engine v7.0 — Sequential Informed Phase Architecture
 *
 * Phase 0  — Query Classification (~0.5s)        | 1 Haiku call
 * Phase 1A — Specific Property: Listing Sites    | 2 parallel searches + 1 Haiku
 * Phase 1B — Prospecting Candidate List          | 2-3 parallel searches + 1 Haiku
 * Phase 2  — Enrichment (~5s, parallel)          | FCC + 2 targeted searches + 1 Haiku
 * Phase 3  — Intelligence (~7s, parallel)        | 3 searches + Apollo + NinjaPear + emailFormat
 * Phase 4  — Synthesis (~9s)                     | Claude Sonnet tool-use
 *
 * Total: ~26-30s for specific_property | ~7-10s for candidate list
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabaseDeep = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const maxDuration = 120
export const dynamic = 'force-dynamic'

const ARIA_ENGINE_VERSION = 'v9.0'

// ─── v9: CostTracker ──────────────────────────────────────────────────────────
// Tracks API spend in-pipeline. Gates supervisor loop and Sonnet call.
// Hard cap: ARIA_COST_CAP_CENTS env var (default 50 = $0.50)
const COST_CAP_CENTS = parseInt(process.env.ARIA_COST_CAP_CENTS ?? '50', 10)
const CREDITS_PER_SEARCH = 100  // atomic deduction from credit_balances

class CostTracker {
  private items: { label: string; cents: number }[] = []
  get totalCents() { return this.items.reduce((s, i) => s + i.cents, 0) }
  add(label: string, cents: number) { this.items.push({ label, cents }) }
  isOverCap() { return this.totalCents >= COST_CAP_CENTS }
  // ~$0.001 per Haiku output token; Serper = 0.1¢ per call; Tavily = ~0.3¢
  addHaiku(outputTokens: number) { this.add('haiku', Math.ceil(outputTokens * 0.001)) }
  addSerper() { this.add('serper', 1) }
  addTavily() { this.add('tavily', 3) }
  addSonnet(inputTokens: number, outputTokens: number) {
    this.add('sonnet_in', Math.ceil(inputTokens * 0.003))
    this.add('sonnet_out', Math.ceil(outputTokens * 0.015))
  }
  summary() { return `$${(this.totalCents / 100).toFixed(3)} (${this.items.map(i => i.label).join('+')})` }
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── v8: Case file persistence ────────────────────────────────────────────────
// Rule: No synthesis without ledger. No deletion without human action.
// Every ARIA search creates a durable case file:
//   aria_search_runs   → one record per pipeline execution
//   aria_candidates    → ALL discovered properties, never deleted
//   aria_evidence_packets → every found fact with source + confidence

async function createSearchRun(
  userId: string,
  orgId: string | null,
  rawQuery: string,
  intentType: string,
  rewrittenQuery: Record<string, unknown> | null
): Promise<string | null> {
  try {
    const { data } = await supabaseDeep
      .from('aria_search_runs')
      .insert({
        user_id: userId,
        org_id: orgId,
        raw_query: rawQuery,
        intent_type: intentType,
        rewritten_query: rewrittenQuery ?? null,
        status: 'running',
        engine_version: 'v8.0',
      })
      .select('id')
      .single()
    return data?.id ?? null
  } catch { return null }
}

async function completeSearchRun(
  runId: string,
  status: 'complete' | 'failed',
  extra: {
    candidate_count?: number
    evidence_count?: number
    quality_gates_passed?: Record<string, boolean>
    selected_candidate_id?: string | null
    duration_ms?: number
  } = {}
): Promise<void> {
  if (!runId) return
  try {
    await supabaseDeep
      .from('aria_search_runs')
      .update({ status, completed_at: new Date().toISOString(), ...extra })
      .eq('id', runId)
  } catch { /* non-blocking */ }
}

async function saveCandidatesToDB(
  runId: string,
  candidates: Array<{
    name: string; address?: string; city?: string; state?: string
    units?: number; year_built?: number; management_company?: string
    isp_signal?: string; bulk_detected?: boolean; pain_brief?: string
    buy_score_estimate?: number; gate_signal?: boolean
  }>
): Promise<string[]> {
  if (!runId || !candidates.length) return []
  try {
    const rows = candidates.map((c, i) => ({
      search_run_id: runId,
      rank_position: i + 1,
      confidence_score: c.buy_score_estimate != null ? Math.min(100, c.buy_score_estimate * 10) : 50,
      property_name: c.name ?? null,
      address:        c.address ?? null,
      city:           c.city ?? null,
      state:          c.state ?? null,
      units:          c.units ?? null,
      year_built:     c.year_built ?? null,
      property_type:  'multifamily',
      management_company: c.management_company ?? null,
      isp_providers:  c.isp_signal ? [c.isp_signal] : [],
      bulk_agreement_hint: c.bulk_detected ?? false,
      pain_signals:   c.pain_brief ? [c.pain_brief] : [],
      gate_issue_detected: c.gate_signal ?? !!(c.pain_brief?.toLowerCase().includes('gate')),
      top_evidence_snippet: c.pain_brief ?? null,
      status: 'pending',
    }))
    const { data } = await supabaseDeep.from('aria_candidates').insert(rows).select('id')
    await supabaseDeep.from('aria_search_runs').update({ candidate_count: candidates.length }).eq('id', runId)
    return (data ?? []).map((r: any) => r.id as string)
  } catch { return [] }
}

function saveEvidencePackets(
  runId: string,
  candidateId: string | null,
  facts: Array<{
    fact_type: string
    extracted_value: string
    source_url?: string
    source_type: string
    source_authority?: number
    confidence?: number
    raw_snippet?: string
    phase_found?: number
  }>
): void {
  if (!runId || !facts.length) return
  void (async () => {
    try {
      await supabaseDeep.from('aria_evidence_packets').insert(
        facts.map((f, i) => ({
          search_run_id:    runId,
          candidate_id:     candidateId,
          source_url:       f.source_url ?? null,
          source_type:      f.source_type,
          source_authority: f.source_authority ?? 5,
          fact_type:        f.fact_type,
          extracted_value:  f.extracted_value,
          confidence:       f.confidence ?? 50,
          raw_snippet:      f.raw_snippet?.slice(0, 600) ?? null,
          phase_found:      f.phase_found ?? 0,
          arrival_order:    i,
        }))
      )
    } catch { /* non-blocking */ }
  })()
}

// ─── v9: Supervisor loop ─────────────────────────────────────────────────────
// Runs after Phase 3 when: time budget remains + cost budget remains.
// Finds gaps in Phase 2/3 data and fires 2-3 targeted Serper searches.
// Returns THREE-TUPLE: [p2Updated, p3Updated, supervisorEvidence[]]
// CRITICAL (Catch 3): supervisor-discovered facts get full evidence packets
// with calculated provenance scores — they MUST NOT be orphaned at score=0.

type SupervisorEvidence = {
  fact_type: string
  extracted_value: string
  source_url?: string
  source_type: string
  source_authority: number
  confidence: number
  raw_snippet?: string
  phase_found: number
}

async function runSupervisorCheck(
  property_name: string,
  city: string,
  state: string,
  p2: Phase2Result,
  p3: Phase3Result,
  costTracker: CostTracker,
  runStart: number,
  anthr: Anthropic
): Promise<[Phase2Result, Phase3Result, SupervisorEvidence[]]> {
  const evidence: SupervisorEvidence[] = []
  const elapsed = Date.now() - runStart
  // Safety gates: only run if < 55s elapsed AND under cost cap
  if (elapsed > 55000 || costTracker.isOverCap()) {
    console.log(`[aria] supervisor skipped: elapsed=${elapsed}ms overCap=${costTracker.isOverCap()}`)
    return [p2, p3, evidence]
  }

  const gaps: string[] = []
  if (!p2.isp_providers.length) gaps.push('isp')
  if (!p2.owner_entity) gaps.push('owner')
  if (!p3.contacts.length) gaps.push('contact')
  if (p3.pain_signals.length < 2) gaps.push('pain')

  if (!gaps.length) return [p2, p3, evidence]
  console.log(`[aria] supervisor running for gaps: ${gaps.join(', ')}`)

  const searches: Promise<void>[] = []
  let p2copy = { ...p2 }
  let p3copy = { ...p3 }

  if (gaps.includes('isp') && !costTracker.isOverCap()) {
    searches.push((async () => {
      costTracker.addSerper()
      const results = await serperSearch(
        `"${property_name}" ${city} internet provider bulk agreement MDU`,
        4, 'supervisor_isp'
      )
      for (const r of results) {
        const snippet = (r.content ?? '').toLowerCase()
        for (const isp of ['spectrum', 'att', 'comcast', 'verizon', 'xfinity', 'gigsstreem', 'hotwire', 'smartaira', 'dojonetworks', 'frontier', 'google fiber']) {
          if (snippet.includes(isp)) {
            const provenance = sourceAuthority(r.url ?? '')
            p2copy = { ...p2copy, isp_providers: [...new Set([...p2copy.isp_providers, isp])] }
            evidence.push({
              fact_type: 'isp',
              extracted_value: isp,
              source_url: r.url || undefined,
              source_type: 'supervisor',
              source_authority: provenance,
              confidence: Math.round((provenance / 10) * 70),
              raw_snippet: (r.content ?? '').slice(0, 600),
              phase_found: 3,
            })
          }
        }
      }
    })())
  }

  if (gaps.includes('owner') && !costTracker.isOverCap()) {
    searches.push((async () => {
      costTracker.addSerper()
      const results = await serperSearch(
        `"${property_name}" ${city} ${state} owner LLC management company`,
        3, 'supervisor_owner'
      )
      for (const r of results) {
        const auth = sourceAuthority(r.url ?? '')
        evidence.push({
          fact_type: 'owner',
          extracted_value: (r.title ?? '').slice(0, 120),
          source_url: r.url || undefined,
          source_type: 'supervisor',
          source_authority: auth,
          confidence: Math.round((auth / 10) * 60),
          raw_snippet: (r.content ?? '').slice(0, 600),
          phase_found: 3,
        })
      }
    })())
  }

  if (gaps.includes('pain') && !costTracker.isOverCap()) {
    searches.push((async () => {
      costTracker.addSerper()
      const results = await serperSearch(
        `"${property_name}" ${city} reviews gate internet complaints`,
        4, 'supervisor_pain'
      )
      const newSignals: typeof p3.pain_signals = []
      for (const r of results) {
        const content = (r.content ?? '').toLowerCase()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let type: any = null
        if (content.includes('gate') || content.includes('entry')) type = 'gate'
        else if (content.includes('internet') || content.includes('wifi') || content.includes('slow')) type = 'internet'
        else if (content.includes('security') || content.includes('camera')) type = 'camera'
        if (type) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          newSignals.push({ type: type as any, quote: (r.content ?? '').slice(0, 200), source: 'reviews', date: '', severity: 'medium' as any })
          const auth = sourceAuthority(r.url ?? '')
          evidence.push({
            fact_type: 'pain_signal',
            extracted_value: type,
            source_url: r.url || undefined,
            source_type: 'supervisor',
            source_authority: auth,
            confidence: Math.round((auth / 10) * 55),
            raw_snippet: (r.content ?? '').slice(0, 600),
            phase_found: 3,
          })
        }
      }
      if (newSignals.length) {
        p3copy = { ...p3copy, pain_signals: [...p3copy.pain_signals, ...newSignals] }
      }
    })())
  }

  await Promise.allSettled(searches)
  return [p2copy, p3copy, evidence]
}

function checkQualityGates(
  p1: Phase1Result,
  p2: Phase2Result,
  p3: Phase3Result
): Record<string, boolean> {
  return {
    units_attempted:      p1.confirmed_units != null,
    phone_attempted:      !!(p1.confirmed_phone || p3.contacts.length > 0),
    address_attempted:    !!(p1.confirmed_address),
    management_attempted: !!(p1.confirmed_management || p2.owner_entity),
    gate_issue_attempted: p3.pain_signals.length > 0 || p3.proptech.gate_operators.length > 0,
    contacts_attempted:   p3.contacts.length > 0,
    isp_attempted:        true, // Phase 2 always runs ISP searches
    candidates_preserved: true, // v8: always true — we never drop candidates
  }
}

// ─── Normalization helpers ────────────────────────────────────────────────────

const SENTINEL_STRINGS = new Set(['null','undefined','unknown','n/a','na','none','not found','not available','','—','–','-','0','tbd','?'])

// ─── ISP / Video service-description blocklists ───────────────────────────────
// These are SERVICE DESCRIPTIONS, not company names. Never store them as providers.
const ISP_SERVICE_DESCRIPTIONS = new Set([
  'wireless high speed internet', 'high-speed internet', 'high speed internet',
  'internet included', 'fiber internet', 'gigabit internet', 'broadband',
  'internet access', 'wi-fi', 'wifi', 'high speed internet service',
  'internet service', 'internet', 'cable internet', 'fiber optic internet',
  'fast internet', 'included internet', 'complimentary internet', 'free internet',
  'high speed wireless', 'wireless internet', 'gigabit fiber', 'fiber optic',
  'fiber-optic', 'high-speed', 'highspeed', 'ultra-fast internet',
  'gigabit service', 'high speed access', 'internet access included',
  'fiber optic service', 'gig internet', 'gigabit broadband',
])

const VIDEO_SERVICE_DESCRIPTIONS = new Set([
  'cable tv', 'cable included', 'satellite tv', 'tv service', 'streaming',
  'cable service', 'satellite television', 'cable television', 'tv included',
  'basic cable', 'premium cable', 'digital cable', 'cable and internet',
  'cable', 'television', 'tv', 'satellite', 'streaming service',
  'cable access', 'satellite access', 'video service',
])

function filterProviderNames(values: string[], blocklist: Set<string>): string[] {
  return values.filter(v => {
    if (!v || v.length < 2) return false
    return !blocklist.has(v.toLowerCase().trim())
  })
}

function normStr(val: unknown): string | null {
  if (val === null || val === undefined) return null
  const s = String(val).trim()
  if (/^<[^>]{0,30}>$/.test(s)) return null
  return SENTINEL_STRINGS.has(s.toLowerCase()) ? null : s
}
function normInt(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === 'number') return val > 0 ? val : null
  const n = parseInt(String(val).replace(/[^0-9]/g, ''), 10)
  return isNaN(n) || n <= 0 ? null : n
}
function normStrArr(arr: unknown): string[] {
  if (!Array.isArray(arr)) return []
  return arr.map(v => normStr(v)).filter((v): v is string => v !== null)
}

// ─── IMP-1: Tavily Score Filtering ───────────────────────────────────────────
// Filter low-relevance Tavily results before passing to Haiku.
// Keeps at least 3 results so we never starve the extraction prompt.

function filterByScore<T extends { score?: number }>(results: T[], minScore = 0.4): T[] {
  const filtered = results.filter(r => (r.score ?? 1) >= minScore)
  return filtered.length >= 3 ? filtered : results.slice(0, 3)
}

// ─── IMP-2: Snippet Deduplication by URL ─────────────────────────────────────
// Removes duplicate search results (same URL) before building Haiku prompts.
// Strips query-string variants so ?utm_source=google doesn't bypass dedup.

function deduplicateByUrl<T extends { url?: string }>(results: T[]): T[] {
  const seen = new Set<string>()
  return results.filter(r => {
    if (!r.url) return true
    const key = r.url.split('?')[0]  // normalize: strip query string
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─── IMP-3: Source Authority Ranking ─────────────────────────────────────────
// Domain-level authority score (1-10). Higher-authority sources win when data
// conflicts. Haiku is instructed to prefer higher-authority facts.

const SOURCE_AUTHORITY: Record<string, number> = {
  'fcc.gov': 10, 'sec.gov': 10, 'census.gov': 9,
  'loopnet.com': 8, 'costar.com': 8, 'multifamilyexecutive.com': 8,
  'nmhc.org': 8, 'apartmentlist.com': 7, 'apartments.com': 7,
  'rentcafe.com': 7, 'zillow.com': 6, 'redfin.com': 6,
  'apartmentratings.com': 6, 'google.com': 5,
  'yelp.com': 4, 'reddit.com': 3, 'facebook.com': 3,
}

function sourceAuthority(url: string): number {
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    for (const [domain, weight] of Object.entries(SOURCE_AUTHORITY)) {
      if (hostname === domain || hostname.endsWith('.' + domain)) return weight
    }
  } catch { /* invalid URL */ }
  return 5
}

function tagSnippetWithAuthority(r: { url?: string; content?: string; title?: string; source?: string }): string {
  const auth = sourceAuthority(r.url ?? '')
  let domain = 'unknown'
  try { domain = new URL(r.url ?? '').hostname.replace('www.', '') } catch { /* skip */ }
  const sourceTag = r.source ? `[${r.source}]` : ''
  return `[AUTH:${auth}]${sourceTag}[${domain}] ${r.content ?? r.title ?? ''}`
}

// ─── Tavily ───────────────────────────────────────────────────────────────────

interface TavilyResult { title: string; url: string; content: string; raw_content?: string; score: number; source?: string }

async function tavilySearch(
  query: string,
  maxResults = 4,
  source = 'web',
  depth: 'basic' | 'advanced' = 'basic',
  rawContent = false
): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY) return []
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.TAVILY_API_KEY}` },
      body: JSON.stringify({
        query, search_depth: depth, max_results: maxResults,
        include_answer: false, include_raw_content: rawContent, include_images: false,
      }),
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? []).map((r: TavilyResult) => ({ ...r, source }))
  } catch { return [] }
}

// ─── Serper (Google Search API) ──────────────────────────────────────────────

async function serperSearch(
  query: string,
  maxResults = 5,
  source = 'serper',
  type: 'search' | 'news' = 'search',
  tbs?: string  // time-based filter: 'qdr:m6' = last 6 months, 'qdr:y' = last year
): Promise<TavilyResult[]> {
  if (!process.env.SERPER_API_KEY) return []
  try {
    const endpoint = type === 'news' ? 'https://google.serper.dev/news' : 'https://google.serper.dev/search'
    const body: Record<string, unknown> = { q: query, num: maxResults, gl: 'us', hl: 'en' }
    if (tbs) body.tbs = tbs
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': process.env.SERPER_API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return []
    const data = await res.json()
    const items = type === 'news' ? (data.news ?? []) : (data.organic ?? [])
    return items.slice(0, maxResults).map((r: any) => ({
      title: r.title ?? '',
      url: r.link ?? '',
      content: [r.snippet, r.date].filter(Boolean).join(' — '),
      score: 0.8,
      source,
    }))
  } catch { return [] }
}

// ─── Serper with Knowledge Graph extraction ──────────────────────────────────
// Like serperSearch but also reads Google's Knowledge Panel for phone/address.
// Returns a synthetic "[KG]" result prepended if the KG has a phone number.

async function serperSearchKG(query: string, maxResults = 5, source = 'serper'): Promise<TavilyResult[]> {
  if (!process.env.SERPER_API_KEY) return []
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': process.env.SERPER_API_KEY },
      body: JSON.stringify({ q: query, num: maxResults, gl: 'us', hl: 'en' }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return []
    const data = await res.json()
    const results: TavilyResult[] = []

    // Knowledge Graph — Google's business card (has phone, address, website for known entities)
    const kg = data.knowledgeGraph as Record<string, any> | undefined
    if (kg) {
      const phone = kg.attributes?.Phone || kg.attributes?.['Phone number'] || kg.phone || ''
      const addr  = kg.attributes?.Address || kg.address || ''
      const site  = kg.website || kg.siteLinks?.[0]?.link || ''
      if (phone || addr) {
        results.push({
          title: `[KG] ${kg.title || query}`,
          url: site,
          content: [
            phone ? `Phone: ${phone}` : '',
            addr  ? `Address: ${addr}` : '',
            kg.description ? kg.description.slice(0, 200) : '',
          ].filter(Boolean).join(' | '),
          score: 1.0,
          source,
        })
      }
    }

    // Organic results
    const organicResults = (data.organic ?? []).slice(0, maxResults).map((r: any) => ({
      title: r.title ?? '',
      url: r.link ?? '',
      content: [r.snippet].filter(Boolean).join(' — '),
      score: 0.8,
      source,
    }))
    return [...results, ...organicResults]
  } catch { return [] }
}

// ─── Haiku JSON extraction helper ─────────────────────────────────────────────

async function haikusExtract<T>(prompt: string, snippets: string, maxTokens: number, client: Anthropic): Promise<T | null> {
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: `${prompt}\n\nSEARCH RESULTS:\n${snippets}` }],
    })
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '{}'
    const match = text.match(/\{[\s\S]+\}/)
    if (match) return JSON.parse(match[0]) as T
  } catch { }
  return null
}

// ─── Nominatim geocoding (free) ───────────────────────────────────────────────

async function geocodeAddress(address: string, city: string, state: string): Promise<{ lat: number; lng: number } | null> {
  const query = [address, city, state].filter(Boolean).join(', ')
  if (!query) return null
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'GateGuard-ARIA/7.0 (rfeldman@gateguard.co)' }, signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.[0]) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch { return null }
}

// ─── FCC Broadband Map API (free) ─────────────────────────────────────────────

async function fccBroadbandLookup(lat: number, lng: number): Promise<string[]> {
  try {
    const res = await fetch(
      'https://broadbandmap.fcc.gov/api/public/map/listAvailability',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'GateGuard-ARIA/7.0' },
        body: JSON.stringify({
          latitude: parseFloat(lat.toFixed(6)),
          longitude: parseFloat(lng.toFixed(6)),
          unit: 'location',
          limit_to_isp: 'N',
        }),
        signal: AbortSignal.timeout(6000),
      }
    )
    if (!res.ok) return []
    const data = await res.json()
    const providers: Array<{ brand_name: string; technology: string }> = data?.results ?? data?.availability ?? data?.data ?? []
    return [...new Set(
      providers
        .filter(p => p.technology && !['60','70','300','400'].includes(String(p.technology)))
        .map(p => p.brand_name)
        .filter(Boolean)
    )]
  } catch { return [] }
}

// ─── Apollo People Enrichment ─────────────────────────────────────────────────

interface ApolloEnrichment {
  name?: string; title?: string; email?: string;
  phone_numbers?: string[]; linkedin_url?: string;
  organization?: { name?: string }
}

async function apolloEnrichPerson(name: string, domain: string): Promise<ApolloEnrichment | null> {
  if (!process.env.APOLLO_API_KEY) return null
  try {
    const res = await fetch('https://api.apollo.io/api/v1/people/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.APOLLO_API_KEY}` },
      body: JSON.stringify({ name, domain, reveal_personal_emails: true }),
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const p = data?.person
    if (!p) return null
    return { name: p.name, title: p.title, email: p.email, phone_numbers: p.phone_numbers, linkedin_url: p.linkedin_url, organization: p.organization }
  } catch { return null }
}

// ─── NinjaPear Employee API ───────────────────────────────────────────────────

interface NinjaPearProfile {
  full_name?: string
  first_name?: string
  last_name?: string
  work_experience?: Array<{ role?: string; company_name?: string; company_website?: string; start_date?: string; end_date?: string | null }>
}

async function ninjapearValidatePerson(firstName: string, lastName: string, employerWebsite: string): Promise<NinjaPearProfile | null> {
  if (!process.env.NINJAPEAR_API_KEY) return null
  try {
    const params = new URLSearchParams({ first_name: firstName, last_name: lastName, employer_website: employerWebsite })
    const res = await fetch(`https://nubela.co/api/v1/employee/profile?${params}`, {
      headers: { Authorization: `Bearer ${process.env.NINJAPEAR_API_KEY}` },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

// ─── Management company domain lookup ────────────────────────────────────────

const MGMT_DOMAIN_MAP: Record<string, string> = {
  'greystar': 'greystar.com',
  'lincoln property': 'lincolnapts.com',
  'cushman': 'cushwake.com',
  'equity residential': 'equityapartments.com',
  'camden': 'camdenliving.com',
  'aimco': 'aimco.com',
  'udr': 'udr.com',
  'essex': 'essexapartmenthomes.com',
  'avalonbay': 'avalonbay.com',
  'bozzuto': 'bozzuto.com',
  'morgan properties': 'morganproperties.com',
  'cortland': 'cortland.com',
  'northland': 'northlandco.com',
  'alliance residential': 'allresco.com',
  'bell partners': 'bellpartnersinc.com',
  'fairfield': 'fairfieldresidential.com',
  'weidner': 'weidner.com',
  'related': 'related.com',
  'bridge property': 'bridgepm.com',
  'peak living': 'peakliving.com',
  'cardinal group': 'cardinalgroup.com',
  'harbor group': 'harborgroupintl.com',
  'maa': 'maac.com',
  'mid-america': 'maac.com',
  'village green': 'villagegreen.com',
  'kettler': 'kettler.net',
}

function deriveMgmtDomain(name: string): string {
  if (!name) return ''
  const lower = name.toLowerCase()
  for (const [key, domain] of Object.entries(MGMT_DOMAIN_MAP)) {
    if (lower.includes(key)) return domain
  }
  return ''
}

// ─── Email construction helper ───────────────────────────────────────────────

function constructEmail(firstName: string, lastName: string, domain: string, format: string): string {
  if (!firstName || !lastName || !domain) return ''
  const f = firstName.toLowerCase().trim()
  const l = lastName.toLowerCase().trim()
  const fi = f[0]
  if (!format) return `${f}.${l}@${domain}`
  if (format.includes('first.last') || format.includes('firstname.lastname')) return `${f}.${l}@${domain}`
  if (format.includes('flastname') || format.includes('firstlast') || format.includes('f.last')) return `${fi}${l}@${domain}`
  if (format.includes('firstname') && !format.includes('.')) return `${f}@${domain}`
  if (format.includes('first_last')) return `${f}_${l}@${domain}`
  return `${f}.${l}@${domain}`
}

// ─── DB lookback: pre-seed from existing intel ───────────────────────────────

interface AriaDbRecord {
  id?: string
  property_name?: string; address?: string; units?: number; year_built?: number
  management_company?: string; owner_entity?: string; website?: string; phone?: string
  isp_providers?: string[]; video_providers?: string[]
  bulk_agreements?: any[]; roe_detected?: boolean; roe_providers?: string[]; roe_expiry_year?: number
  isp_providers_user_verified?: boolean; video_providers_user_verified?: boolean
  roe_expiry_user_verified?: boolean; dm_name_user_verified?: boolean
  dm_email_user_verified?: boolean; dm_phone_user_verified?: boolean
  dm_name?: string; dm_email?: string; dm_phone?: string; dm_title?: string
  dm_linkedin_slug?: string; dm_chain?: any[]
  times_researched?: number
}

async function lookupExistingProperty(query: string, cityHint: string | null): Promise<AriaDbRecord | null> {
  try {
    // Build multiple search patterns to handle "northland warf 7" → DB "Wharf 7"
    // The AI-confirmed name (stored in DB) may differ from the search query
    const COMMON_MGMT_WORDS = new Set(['investment','corporation','corp','inc','llc','management','property','properties','residential','realty','greystar','northland','cortland','lincoln','bozzuto','camden'])
    const words = query.trim().split(/\s+/)

    // Pattern 1: last 2 words — often the actual property name ("warf 7", "wharf 7")
    const lastTwo = words.slice(-2).join(' ')
    // Pattern 2: skip first word if it looks like a mgmt company keyword
    const skipFirst = COMMON_MGMT_WORDS.has(words[0]?.toLowerCase()) ? words.slice(1).join(' ') : query
    // Pattern 3: full query stripped of state/city suffixes
    const fullNorm = query.replace(/,?\s+(atlanta|austin|dallas|houston|chicago|phoenix|denver|nashville|miami|charlotte|raleigh|seattle|boston|NYC|new york|los angeles|san francisco|[A-Z]{2})$/i, '').trim()

    const patterns = [...new Set([lastTwo, skipFirst, fullNorm].filter(p => p.length >= 3))]

    const cols = 'id,property_name,address,units,year_built,management_company,owner_entity,isp_providers,video_providers,bulk_agreements,roe_detected,roe_providers,roe_expiry_year,isp_providers_user_verified,video_providers_user_verified,roe_expiry_user_verified,dm_name,dm_email,dm_phone,dm_title,dm_linkedin_slug,dm_chain,dm_name_user_verified,dm_email_user_verified,dm_phone_user_verified,times_researched'

    for (const pattern of patterns) {
      let q = supabaseDeep
        .from('aria_properties')
        .select(cols)
        .ilike('property_name', `%${pattern}%`)
      if (cityHint) q = q.ilike('address', `%${cityHint}%`)
      const { data } = await q.limit(1).maybeSingle()
      if (data) return data as AriaDbRecord
    }

    // Fallback: city-only search if city hint provided
    if (cityHint && words.length >= 2) {
      const { data } = await supabaseDeep
        .from('aria_properties')
        .select(cols)
        .ilike('address', `%${cityHint}%`)
        .ilike('property_name', `%${words[words.length - 1]}%`)
        .limit(1)
        .maybeSingle()
      if (data) return data as AriaDbRecord
    }

    return null
  } catch { return null }
}

// ─── IMP-4: Query Rewriting ───────────────────────────────────────────────────
// Expands the raw user query into intent-specific sub-queries before any search.
// Runs in parallel with the DB cache lookup at the start of specific_property flow.
// Inspired by Perplexity's query rewriting approach.

interface RewrittenQuery {
  property_name: string
  address_variations: string[]
  city_state: string
  owner_search: string
  isp_search: string
  proptech_search: string
  review_search: string
  contact_search: string
}

async function rewriteQuery(rawQuery: string, client: Anthropic): Promise<RewrittenQuery> {
  const fallback: RewrittenQuery = {
    property_name: rawQuery,
    address_variations: [rawQuery],
    city_state: '',
    owner_search: `${rawQuery} property owner management company`,
    isp_search: `${rawQuery} internet provider`,
    proptech_search: `${rawQuery} security access control gate`,
    review_search: `${rawQuery} reviews`,
    contact_search: `${rawQuery} property manager`,
  }
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: 'You are a query expansion engine for a property intelligence system. Generate targeted sub-queries from the user query. Return ONLY valid JSON, no other text.',
      messages: [{
        role: 'user',
        content: `Property search query: "${rawQuery}"

Return JSON:
{
  "property_name": "clean property name without city/state",
  "address_variations": ["full address variation 1", "full address variation 2"],
  "city_state": "City ST",
  "owner_search": "query to find owner/management company",
  "isp_search": "query to find internet/ISP at this property",
  "proptech_search": "query to find security/access/cameras/gates at property",
  "review_search": "query to find resident reviews and complaints",
  "contact_search": "query to find property manager or DM contact info"
}`,
      }],
    })
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '{}'
    const match = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match?.[0] ?? '{}') as Partial<RewrittenQuery>
    return {
      property_name: parsed.property_name ?? rawQuery,
      address_variations: parsed.address_variations ?? [rawQuery],
      city_state: parsed.city_state ?? '',
      owner_search: parsed.owner_search ?? `${rawQuery} property owner management company`,
      isp_search: parsed.isp_search ?? `${rawQuery} internet service provider`,
      proptech_search: parsed.proptech_search ?? `${rawQuery} security cameras access control gate`,
      review_search: parsed.review_search ?? `${rawQuery} resident reviews complaints`,
      contact_search: parsed.contact_search ?? `${rawQuery} property manager contact`,
    }
  } catch {
    return fallback
  }
}

// ─── PHASE 0: Query Classification ────────────────────────────────────────────

type QueryType = 'specific_property' | 'city_prospect' | 'criteria_prospect' | 'contract_prospect'

interface QueryClassification {
  type: QueryType
  normalized_query: string
  city_hint: string | null
  state_hint: string | null
  mgmt_hint: string | null
  size_hint: string | null
}

async function classifyQuery(query: string, client: Anthropic): Promise<QueryClassification> {
  const fallback: QueryClassification = {
    type: 'specific_property',
    normalized_query: query,
    city_hint: null, state_hint: null, mgmt_hint: null, size_hint: null,
  }

  const extracted = await haikusExtract<QueryClassification>(
    `Classify this real estate sales intelligence query. Return ONLY valid JSON:
{"type":"specific_property","normalized_query":"","city_hint":null,"state_hint":null,"mgmt_hint":null,"size_hint":null}

QUERY: "${query}"

CLASSIFICATION RULES:
- "specific_property" → user named a specific property/community (e.g. "Northland Wharf 7", "The Flats at Midtown", "1234 Main St Atlanta")
- "city_prospect" → looking for properties in a city/area (e.g. "multifamily in Atlanta with gate complaints", "Phoenix apartments")
- "criteria_prospect" → property type/size criteria (e.g. "HOA 500+ units with gates in Ohio", "Class A multifamily")
- "contract_prospect" → bulk agreement timing focus (e.g. "bulk agreements expiring 2026", "MDU contracts ending soon")

Extract any hints:
- normalized_query: cleaned version of the query (strip filler words)
- city_hint: city name if mentioned, else null
- state_hint: 2-letter state code if mentioned, else null
- mgmt_hint: management company name if mentioned (Greystar, Lincoln, etc.), else null
- size_hint: unit count threshold if mentioned (e.g. "500+", "300-500"), else null`,
    '', 300, client
  )

  if (!extracted) return fallback
  return {
    type: (['specific_property', 'city_prospect', 'criteria_prospect', 'contract_prospect'].includes(extracted.type) ? extracted.type : 'specific_property') as QueryType,
    normalized_query: normStr(extracted.normalized_query) || query,
    city_hint: normStr(extracted.city_hint),
    state_hint: normStr(extracted.state_hint),
    mgmt_hint: normStr(extracted.mgmt_hint),
    size_hint: normStr(extracted.size_hint),
  }
}

// ─── PHASE 1A: Specific Property — Listing Sites First ──────────────────────

interface Phase1Result {
  confirmed_name: string | null
  confirmed_address: string | null
  confirmed_city: string | null
  confirmed_state: string | null
  confirmed_units: number | null
  confirmed_year_built: number | null
  confirmed_management: string | null
  confirmed_owner: string | null
  confirmed_website: string | null
  confirmed_phone: string | null
  is_specific_property: boolean
  // Amenity-sourced fields — directly from listing page full content
  listing_url: string | null
  listing_isp: string | null           // e.g. "GIGstreem" — from amenities section
  listing_cable: string | null         // e.g. "DirecTV" — from amenities section
  listing_proptech: string[]           // e.g. ["ButterflyMX","Brivo"] — from amenities
  listing_bulk_detected: boolean       // "internet included" or "tech fee" on listing
}

async function runPhase1A(query: string, client: Anthropic): Promise<Phase1Result> {
  const blank: Phase1Result = {
    confirmed_name: null, confirmed_address: null, confirmed_city: null, confirmed_state: null,
    confirmed_units: null, confirmed_year_built: null,
    confirmed_management: null, confirmed_owner: null,
    confirmed_website: null, confirmed_phone: null,
    is_specific_property: false,
    listing_url: null, listing_isp: null, listing_cable: null,
    listing_proptech: [], listing_bulk_detected: false,
  }

  // Five parallel searches:
  // 1. Listing sites — snippet only (fast identity confirmation)
  // 2. Press/news — unit count, year built
  // 3. Unit count web search — targets pages that explicitly mention total unit counts
  // 4. Amenities deep-read — raw full-page content to catch ISP/cable/gate in amenities section
  // 5. Phone/contact — Google Knowledge Graph + leasing office contact page (mandatory field)
  const [listingResults, pressResults, unitCountResults, amenityResults, phoneResults] = await Promise.all([
    tavilySearch(
      `"${query}" apartments site:apartments.com OR site:rentcafe.com OR site:zillow.com OR site:apartmentlist.com`,
      4, 'listing', 'advanced', false
    ),
    serperSearch(
      `"${query}" apartments "apartment homes" OR units completed OR opened OR built`,
      5, 'press', 'news'
    ),
    // Dedicated unit count web search — finds total unit count from property databases and real estate sites
    serperSearch(
      `"${query}" apartments "total units" OR "unit count" OR "floor plans" OR "apartment homes" -"available units"`,
      5, 'unit_count', 'search'
    ),
    // Raw content fetch — amenities sections explicitly list ISP/cable/gate providers
    tavilySearch(
      `"${query}" apartments amenities internet cable intercom gate access`,
      2, 'amenities', 'advanced', true  // rawContent = TRUE — reads the full page
    ),
    // Dedicated phone search — Google Knowledge Graph returns phone number directly for known properties
    serperSearchKG(
      `"${query}" apartments leasing office phone contact`,
      3, 'phone'
    ),
  ])

  // IMP-1: filter Tavily results by score; IMP-2: deduplicate by URL
  const filteredListing = filterByScore(listingResults, 0.4)
  const allResults = deduplicateByUrl([...filteredListing, ...pressResults, ...unitCountResults, ...phoneResults])
  if (allResults.length === 0 && amenityResults.length === 0) return blank

  // Standard identity snippets — 1200 chars; IMP-3: tag with source authority
  const snippets = allResults
    .filter(r => (r.content || '').length > 30)
    .slice(0, 12)
    .map((r, i) => `[${i + 1}] ${tagSnippetWithAuthority(r).slice(0, 1250)}`)
    .join('\n\n---\n\n')

  // Amenity raw content — first 4000 chars of each page (amenities usually near top)
  const amenitySnippets = amenityResults
    .filter(r => r.raw_content && r.raw_content.length > 100)
    .slice(0, 2)
    .map((r, i) => `[A${i + 1}] URL: ${r.url}\n${(r.raw_content ?? r.content).slice(0, 4000)}`)
    .join('\n\n---\n\n')

  const combinedSnippets = [snippets, amenitySnippets].filter(Boolean).join('\n\n===AMENITY PAGES===\n\n')
  if (!combinedSnippets) return blank

  const extracted = await haikusExtract<Phase1Result>(
    `Extract verified property facts AND amenity/technology data. Return ONLY valid JSON:
{"confirmed_name":null,"confirmed_address":null,"confirmed_city":null,"confirmed_state":null,"confirmed_units":null,"confirmed_year_built":null,"confirmed_management":null,"confirmed_owner":null,"confirmed_website":null,"confirmed_phone":null,"is_specific_property":false,"listing_url":null,"listing_isp":null,"listing_cable":null,"listing_proptech":[],"listing_bulk_detected":false}

SOURCE AUTHORITY: Each snippet starts with [AUTH:N] where N=1-10. Prefer higher-authority sources (8-10) when data conflicts. Auth 8-10 = government/industry/listing sites. Auth 3-5 = social/review sites.

IDENTITY RULES:
- confirmed_name: exact community name found in results (not the query — the real name)
- confirmed_address: full street address if found
- confirmed_city + confirmed_state: REQUIRED if any geo context exists
- confirmed_units: LOOK HARD in ALL sections including ===AMENITY PAGES=== — patterns: "312 units", "312-unit", "Total Units: 312", "312 Apartments for Rent", "312 apartment homes", "312 homes", "Showing X of 312", "312 floor plans", "312 residences", "N studio to", "View 312 floor plans", "312 available". Also scan amenity pages for "X units" near top of page or in page title. If you find the number anywhere, return it — do not return null just because the first snippet doesn't mention it.
- confirmed_year_built: from "built YYYY", "Year Built: YYYY", "opened YYYY", "completed YYYY", "constructed YYYY", "established YYYY"
- confirmed_management: company managing day-to-day operations
- confirmed_owner: investor/developer/owner entity
- confirmed_website: official property URL (NOT apartments.com/zillow)
- confirmed_phone: leasing office phone — PRIORITY: check [phone] source snippets FIRST — they contain "Phone: (xxx) xxx-xxxx" from Google's business listing. Also look for (xxx) xxx-xxxx or xxx-xxx-xxxx format in listings, contact sections, or footer anywhere in results. This is a MANDATORY field — search every snippet.
- is_specific_property: true if results clearly identify ONE specific named property

AMENITY/TECHNOLOGY RULES (look especially in ===AMENITY PAGES===):
- listing_url: apartments.com OR rentcafe.com URL for this property if found
- listing_isp: COMPANY NAME of the internet provider — e.g. "GIGstreem", "Hotwire", "Comcast", "AT&T Fiber", "Spectrum", "Cox", "Ziply Fiber". Return the COMPANY NAME only. NEVER return service descriptions: "Wireless High Speed Internet", "High-speed internet", "Fiber internet", "Gigabit internet", "Internet included", "Broadband", "Internet access", "Wi-Fi" — these describe WHAT the service is, not WHO provides it. If you only see a service description with no company name, return null.
- listing_cable: COMPANY NAME of the cable/satellite/TV provider — e.g. "DirecTV", "Dish Network", "Spectrum TV", "Xfinity". Return ONLY the company name. NEVER return: "Cable TV", "Cable included", "Satellite TV", "TV service", "Streaming", "Cable service" — these are service descriptions, not provider names. If you only see service descriptions, return null.
- listing_proptech: array of ALL named proptech brands — gate systems (DoorKing, LiftMaster, Viking, FAAC), intercoms (ButterflyMX, Aiphone, Viking, 2N), access (Brivo, HID, Openpath, Kisi), cameras (Verkada, Avigilon), smart locks (SmartRent, Latch), any brand name in amenities section
- listing_bulk_detected: true if amenities say "internet included", "fiber included", "tech fee", "technology fee", "cable included", OR any ISP/cable provider explicitly listed as an amenity
- null/[] if not found — never guess`,
    combinedSnippets, 1600, client
  )

  if (!extracted) return blank

  // Post-extraction guard: strip service descriptions masquerading as provider names
  const rawIsp = normStr(extracted.listing_isp)
  const rawCable = normStr(extracted.listing_cable)
  const cleanIsp = rawIsp && !ISP_SERVICE_DESCRIPTIONS.has(rawIsp.toLowerCase().trim()) ? rawIsp : null
  const cleanCable = rawCable && !VIDEO_SERVICE_DESCRIPTIONS.has(rawCable.toLowerCase().trim()) ? rawCable : null

  return {
    ...blank,
    ...extracted,
    listing_isp: cleanIsp,
    listing_cable: cleanCable,
    listing_proptech: normStrArr(extracted.listing_proptech),
    listing_bulk_detected: extracted.listing_bulk_detected ?? false,
  }
}

// ─── PHASE 1B: Prospecting Candidate List ────────────────────────────────────

interface Candidate {
  name: string
  address: string
  city: string
  state: string
  units?: number
  year_built?: number
  property_class?: string
  management_company?: string
  isp_signal?: string
  bulk_detected?: boolean
  pain_brief?: string
  buy_score_estimate?: number
  // v8 Ticket 4: lightweight enrichment fields (top-3 only)
  confirmed_phone?: string
  gate_signal?: boolean
  ownership_entity?: string
}

interface CandidateResponse {
  type: 'candidates'
  candidates: Candidate[]
  query_interpretation: string
  raw_results?: TavilyResult[]
}

async function runPhase1B(query: string, classification: QueryClassification, client: Anthropic): Promise<CandidateResponse> {
  const cityHint = classification.city_hint ?? ''
  const stateHint = classification.state_hint ?? ''
  const mgmtHint = classification.mgmt_hint ?? ''
  const sizeHint = classification.size_hint ?? ''
  const geo = [cityHint, stateHint].filter(Boolean).join(', ')

  // Build 2-3 candidate-finding queries based on query type
  const searches: Promise<TavilyResult[]>[] = []

  if (classification.type === 'city_prospect') {
    searches.push(
      tavilySearch(`${query} multifamily apartments "${cityHint || ''}" "${stateHint || ''}" community list`, 5, 'candidates-1', 'advanced', false),
      serperSearch(`largest apartment communities ${geo} multifamily ${sizeHint ? sizeHint + ' units' : ''}`, 5, 'candidates-2'),
      serperSearch(`${geo} apartments site:apartments.com OR site:rentcafe.com`, 5, 'candidates-3'),
    )
  } else if (classification.type === 'criteria_prospect') {
    searches.push(
      serperSearch(`${query} apartments multifamily ${geo}`, 6, 'candidates-1'),
      tavilySearch(`largest multifamily ${geo} ${mgmtHint} ${sizeHint} units`, 5, 'candidates-2', 'advanced', false),
      serperSearch(`${mgmtHint} ${geo} apartments portfolio properties`, 5, 'candidates-3'),
    )
  } else {
    // contract_prospect
    searches.push(
      serperSearch(`${query} multifamily bulk internet OR "MDU agreement" OR "contract expiring"`, 6, 'candidates-1', 'news'),
      tavilySearch(`apartment ${geo} "bulk agreement" OR "MDU" OR "internet included" expiring`, 5, 'candidates-2', 'advanced', false),
      serperSearch(`${geo} apartments bulk internet OR "internet included" Class A`, 5, 'candidates-3'),
    )
  }

  const results = await Promise.all(searches)
  const allResults = results.flat().filter(r => (r.content || '').length > 30).slice(0, 18)

  if (allResults.length === 0) {
    return { type: 'candidates', candidates: [], query_interpretation: `No properties found for "${query}"` }
  }

  const snippets = allResults
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`)
    .join('\n\n---\n\n')

  const extracted = await haikusExtract<{ candidates: Candidate[]; query_interpretation: string }>(
    `Extract 6-8 candidate properties matching the user's search criteria. Return ONLY valid JSON:
{"candidates":[{"name":"","address":"","city":"","state":"","units":null,"year_built":null,"property_class":null,"management_company":null,"isp_signal":null,"bulk_detected":false,"pain_brief":null,"buy_score_estimate":null}],"query_interpretation":""}

USER QUERY: "${query}"

RULES:
- candidates: 6-8 distinct properties that match the search intent
- name: exact property/community name
- address: street address if available, else null
- city + state: REQUIRED — never null if any location data exists
- units: integer if found in text, else null
- year_built: 4-digit year if found, else null
- property_class: "A", "B", or "C" if mentioned, else null
- management_company: who manages (Greystar, Lincoln, etc.), else null
- isp_signal: ISP name if mentioned (e.g. "GIGstreem", "Comcast"), else null
- bulk_detected: true if internet included / bulk agreement mentioned
- pain_brief: short verbatim resident pain quote if found (e.g. "Internet is terrible, no other options"), else null
- buy_score_estimate: 1-10 — score higher for: pain signals present, bulk detected, large unit count (300+), recent acquisition. Default 5 if uncertain.
- query_interpretation: 1-sentence summary of how you understood the search (e.g. "Multifamily properties in Atlanta with bulk internet agreements and resident pain")

Empty array if no real properties found.`,
    snippets, 2500, client
  )

  if (!extracted) {
    return { type: 'candidates', candidates: [], query_interpretation: `Search completed but extraction failed for "${query}"` }
  }

  const candidates = (extracted.candidates || []).filter(c => normStr(c.name) && (normStr(c.city) || normStr(c.address)))

  return {
    type: 'candidates',
    candidates,
    query_interpretation: normStr(extracted.query_interpretation) || `Properties matching: ${query}`,
    raw_results: allResults,
  }
}

// ─── TOP-3 LIGHTWEIGHT ENRICHMENT (Phase 1B only) ───────────────────────────
// For prospecting queries: run 1 Serper search per top-3 candidate and extract
// units, phone, management co., ownership, gate signal, and pain signal.
// All 3 searches + 3 Haiku extractions run in parallel — adds ~2-4s to Phase 1B.

async function enrichTopCandidates(candidates: Candidate[], client: Anthropic): Promise<Candidate[]> {
  const top3 = candidates.slice(0, 3)
  if (top3.length === 0) return candidates

  // 3 parallel Serper searches — 1 per top candidate
  const searchResultSets = await Promise.all(
    top3.map(c => {
      const geo = [c.city, c.state].filter(Boolean).join(', ')
      return serperSearch(
        `"${c.name}" ${geo} units phone management ownership gate access control internet`,
        5, 'enrich'
      )
    })
  )

  // 3 parallel Haiku extractions — one per candidate
  const enrichedTop3 = await Promise.all(
    top3.map(async (c, i) => {
      const results = searchResultSets[i]
      if (!results.length) return c
      const snippets = results.slice(0, 5)
        .map((r, j) => `[${j + 1}] ${r.title}\nURL: ${r.url}\n${(r.content ?? '').slice(0, 400)}`)
        .join('\n\n---\n\n')
      const extracted = await haikusExtract<{
        units: number | null
        phone: string | null
        management_company: string | null
        ownership_entity: string | null
        gate_signal: boolean
        pain_signal: string | null
      }>(
        `Extract facts about "${c.name}" in ${c.city ?? ''}, ${c.state ?? ''}. Return ONLY valid JSON:
{"units":null,"phone":null,"management_company":null,"ownership_entity":null,"gate_signal":false,"pain_signal":null}

RULES:
- units: total residential unit count as integer, else null
- phone: property office/leasing phone in US format e.g. "(404) 555-1234", else null
- management_company: who manages this property (company name like Greystar, Lincoln, etc.), else null
- ownership_entity: who owns this property (LLC, REIT, investor name), else null
- gate_signal: true if ANY result mentions gated, gate, access control, security entry, key fob
- pain_signal: short verbatim resident complaint (max 120 chars), prioritize gate/internet/security, else null`,
        snippets, 700, client
      )
      if (!extracted) return c
      return {
        ...c,
        units:            extracted.units ?? c.units,
        management_company: normStr(extracted.management_company) || c.management_company,
        confirmed_phone:    normStr(extracted.phone) || c.confirmed_phone,
        ownership_entity:   normStr(extracted.ownership_entity) || c.ownership_entity,
        gate_signal:        extracted.gate_signal || c.gate_signal || false,
        pain_brief:         normStr(extracted.pain_signal) || c.pain_brief,
      } as Candidate
    })
  )

  return [...enrichedTop3, ...candidates.slice(3)]
}

// ─── PHASE 2: Enrichment (parallel) ─────────────────────────────────────────

interface Phase2Result {
  owner_entity: string
  owner_type: string
  acquisition_year: string
  isp_providers: string[]
  video_providers: string[]
  bulk_detected: boolean
  bulk_agreements: Array<{ provider: string; service_type: string; agreement_type: string; confidence: string; evidence: string; expiry_estimate?: string }>
  fcc_providers: string[]
  roe_detected: boolean
  roe_providers: string[]
  roe_expiry_year: number | null
  // IMP-6: EDGAR + last sale fields
  edgar_signal: boolean
  last_sale_price: string
  last_sale_date: string
}

const KNOWN_MDU_BULK_ISPS = new Set([
  // National incumbents / telcos
  'spectrum', 'spectrum community solutions', 'charter communications',
  'at&t', 'at&t connected communities', 'att fiber',
  'comcast', 'xfinity', 'xfinity communities',
  'cox', 'cox communities',
  'quantum fiber', 'lumen', 'centurylink',
  'verizon', 'verizon fios', 'fios',
  'google fiber', 'webpass', 'google fiber webpass',
  'frontier', 'frontier communications',
  'optimum', 'altice', 'altice usa', 'suddenlink',
  'breezeline', 'atlantic broadband',
  'windstream', 'kinetic', 'kinetic communities',
  'astound broadband', 'rcn', 'grande communications', 'wave broadband',
  'brightspeed',
  'mediacom', 'tds telecom', 'consolidated communications',
  // MDU-focused managed Wi-Fi integrators
  'gigstreem', 'gigstreem managed wifi',
  'hotwire', 'hotwire communications', 'fision',
  'pavlov media',
  'smartaira', 'consolidated smart systems',
  'dojonetworks', 'dojo networks',
  'starry', 'starry internet',
  'white sky',
  'boingo', 'boingo wireless',
  'nextlink', 'nextlink internet',
  'midco',
  'single digits',
  'gonetspeed',
  'spot on networks',
  'mdu communications', 'mdu datacom',
  'wired broadband', 'all west', 'broadstripe', 'sonic mdu',
  'xenon networks', 'apogee', 'limecom', 'pocketinet', 'skybridge',
  'bulk solutions', 'enterprise network services',
  'onestop communications',
  'lux speed', 'giggle fiber', 'resound networks', 'aeronet',
])

const KNOWN_VIDEO_PROVIDERS = new Set([
  'directv', 'directv for business', 'directv stream', 'directv mdu',
  'dish network', 'dish tv', 'dish fiber', 'dish satellite',
  'comcast', 'xfinity', 'spectrum tv', 'spectrum',
  'cox', 'cox tv', 'mediacom', 'optimum', 'altice',
  'breezeline', 'brightspeed', 'frontier', 'centurylink', 'lumen',
  'tds telecom', 'consolidated communications', 'sling tv', 'sling',
  'philo', 'fubo', 'fubo tv',
  // DirectTV dealers / hybrid integrators
  'commercial satellite sales', 'css', 'restech services',
  'usa wireless satellite', 'total media concepts', 'touchstone 1',
  'smartaira',  // also does bulk DirecTV
])

// ─── Fetch live mdu_providers from DB ────────────────────────────────────────

interface MduProvider { id: string; name: string; provider_type?: string; is_video?: boolean }

async function fetchMduProviders(): Promise<MduProvider[]> {
  try {
    const { data } = await supabaseDeep
      .from('mdu_providers')
      .select('id, name, provider_type, is_video')
      .eq('active', true)
      .limit(80)
    return (data ?? []) as MduProvider[]
  } catch { return [] }
}

async function runPhase2(
  confirmedName: string,
  confirmedAddress: string,
  confirmedCity: string,
  confirmedState: string,
  confirmedMgmt: string,
  coords: { lat: number; lng: number } | null,
  client: Anthropic,
  dbProviders: MduProvider[] = [],
  rewritten: RewrittenQuery | null = null
): Promise<Phase2Result> {
  const blank: Phase2Result = {
    owner_entity: '', owner_type: '', acquisition_year: '',
    isp_providers: [], video_providers: [],
    bulk_detected: false, bulk_agreements: [], fcc_providers: [],
    roe_detected: false, roe_providers: [], roe_expiry_year: null,
    edgar_signal: false, last_sale_price: '', last_sale_date: '',
  }

  const geo = [confirmedCity, confirmedState].filter(Boolean).join(', ')

  // Build live keyword lists from DB + known sets
  const dbIspNames = dbProviders
    .filter(p => !p.is_video && p.provider_type !== 'video')
    .map(p => p.name).slice(0, 12)
  const dbVideoNames = dbProviders
    .filter(p => p.is_video || p.provider_type === 'video' || [...KNOWN_VIDEO_PROVIDERS].some(v => p.name.toLowerCase().includes(v)))
    .map(p => p.name).slice(0, 10)

  // Merge DB video names with known set — always include the major players
  const videoKeywords = [...new Set([
    'DirecTV', 'Dish Network', 'Xfinity', 'Comcast', 'Spectrum TV', 'Spectrum',
    'Dish Fiber', 'Sling TV', 'Philo', 'FuboTV',
    ...dbVideoNames,
  ])].slice(0, 12).join(' OR ')

  // MDU ISP keywords from DB + known hardcoded list
  const ispKeywords = [...new Set([
    'GIGstreem', 'Hotwire', '"Pavlov Media"', '"Wired Broadband"', '"MDU Communications"',
    '"DojoNetworks"', '"Smartaira"', '"Single Digits"', '"White Sky"', 'Boingo',
    '"Starry Internet"', '"GoNetspeed"', '"Midco"', '"Nextlink"', '"MDU Datacom"',
    ...dbIspNames.map(n => `"${n}"`),
  ])].slice(0, 15).join(' OR ')

  // Build all DB provider names for Haiku context
  const allDbProviderNames = dbProviders.map(p => p.name).join(', ')

  // Extract brand-name keyword from full management company name
  // "Northland Investment Corporation" → "Northland"
  // Using the full quoted name in Tavily is too restrictive — it requires exact phrase match
  const MGMT_GENERIC_WORDS = new Set(['investment','corporation','corp','inc','llc','management','property','properties','residential','realty','group','real','estate','company','co','partners','fund','capital','asset','homes','apartments','living','communities','associates','equity','ventures','holdings'])
  const mgmtBrandName = confirmedMgmt
    ? (confirmedMgmt.split(/\s+/).find(w => w.length > 2 && !MGMT_GENERIC_WORDS.has(w.toLowerCase())) || confirmedMgmt.split(' ')[0])
    : ''

  const propTarget = mgmtBrandName ? `"${mgmtBrandName}"` : `"${confirmedName}"`
  const geoTarget = `"${confirmedCity}"`

  // IMP-6: also run EDGAR signal search + last-sale transaction search in parallel
  const [fccProviders, bulkResults, ispCityResults, ownerResults, videoResults, roeResults, edgarResults, transactionResults] = await Promise.all([
    coords ? fccBroadbandLookup(coords.lat, coords.lng) : Promise.resolve([] as string[]),
    // IMP-1: filter by Tavily score (min 0.5 for Phase 2 — precision over recall here)
    tavilySearch(
      // Use brand-name shortening — "Northland" not "Northland Investment Corporation"
      `"${confirmedName}" "${confirmedCity}" ${mgmtBrandName ? `"${mgmtBrandName}"` : ''} bulk internet OR "internet included" OR MDU OR "exclusive provider" OR ${ispKeywords}`,
      5, 'bulk', 'advanced', false
    ).then(r => filterByScore(r, 0.5)),
    // City-level ISP fallback — catches MDU deals that mention the city but not the property name
    serperSearch(
      `"${confirmedCity}" apartments OR "apartment homes" "internet included" OR GIGstreem OR Hotwire OR "bulk internet" OR "MDU internet" OR "exclusive internet" ${mgmtBrandName ? `OR "${mgmtBrandName}"` : ''}`,
      4, 'isp-city'
    ),
    serperSearch(
      `"${confirmedAddress || confirmedName}" ownership OR owner OR acquired OR sold OR purchased "private equity" OR REIT OR LLC OR "real estate" OR "investment" OR "capital" OR "fund"`,
      5, 'owner', 'news'
    ),
    // Dedicated video provider search — cable/satellite/IPTV agreements
    // REQUIRE property name (not OR city alone) to avoid city-level noise
    serperSearch(
      `"${confirmedName}" ${confirmedCity} ${videoKeywords} OR "cable included" OR "satellite included" OR "bulk video" OR "cable agreement" OR "TV included"`,
      5, 'video', 'news'
    ),
    // ROE / bulk telecom agreement search — contract terms + expiry signals
    serperSearch(
      `${propTarget} ${confirmedCity} "right of entry" OR "ROE agreement" OR "bulk agreement" OR "exclusive service agreement" OR "telecom agreement" expire OR expiring OR renew OR term OR "contract end"`,
      5, 'roe'
    ),
    // IMP-6: EDGAR/SEC filing search — fund/REIT-owned properties file 8-K/10-K with acquisition price + unit count
    tavilySearch(
      rewritten?.owner_search
        ? `${rewritten.owner_search} SEC EDGAR annual report 10-K multifamily acquisition REIT`
        : `"${confirmedName}" "${confirmedCity}" SEC EDGAR annual report 10-K multifamily acquisition REIT`,
      3, 'edgar', 'basic', false
    ).then(r => filterByScore(r, 0.4)),
    // IMP-6: Last sale / transaction search — property sale price and date
    serperSearch(
      rewritten?.owner_search
        ? `${rewritten.owner_search} sold acquisition purchase price "multifamily"`
        : `"${confirmedName}" "${confirmedCity}" sold acquisition purchase price`,
      3, 'sale', 'news'
    ),
  ])

  const fccLower = fccProviders.map(p => p.toLowerCase())
  const knownMduInFcc = fccLower.some(p => [...KNOWN_MDU_BULK_ISPS].some(mdu => p.includes(mdu)))

  // IMP-2: deduplicate by URL; IMP-3: tag with source authority; IMP-6: include edgar + sale results
  const allResults = deduplicateByUrl([...bulkResults, ...ispCityResults, ...ownerResults, ...videoResults, ...roeResults, ...edgarResults, ...transactionResults])
  const usable = allResults.filter(r => (r.content || '').length > 40).slice(0, 20)

  const snippets = usable
    .map((r, i) => `[${i + 1}] ${tagSnippetWithAuthority(r).slice(0, 450)}`)
    .join('\n\n---\n\n')

  const fccCtx = fccProviders.length > 0
    ? `\n\nFCC BROADBAND MAP (confirmed at coordinates):\n${fccProviders.map(p => `• ${p}`).join('\n')}`
    : ''

  // Check city-level ISP results for known MDU providers — they may confirm bulk deal
  const cityIspLower = ispCityResults.flatMap(r => [r.title, r.content].join(' ').toLowerCase())
  const cityConfirmedIsps = [...KNOWN_MDU_BULK_ISPS].filter(isp => cityIspLower.some(t => t.includes(isp)))

  // Separate video snippets for dedicated extraction
  const videoSnippets = videoResults.filter(r => (r.content || '').length > 30)
    .map((r, i) => `[V${i + 1}] ${r.title}\n${r.content.slice(0, 350)}`).join('\n\n---\n\n')

  // Separate ROE snippets for dedicated extraction
  const roeSnippets = roeResults.filter(r => (r.content || '').length > 30)
    .map((r, i) => `[R${i + 1}] ${r.title}\n${r.content.slice(0, 350)}`).join('\n\n---\n\n')

  const dbProviderCtx = allDbProviderNames
    ? `\n\nKNOWN PROVIDER REFERENCE LIST (from our database — flag any of these if mentioned):\n${allDbProviderNames}`
    : ''

  const extracted = snippets.length > 80
    ? await haikusExtract<Omit<Phase2Result, 'fcc_providers'>>(
        `Extract ownership, connectivity, video service, ROE agreement, and financial transaction data. Return ONLY valid JSON:
{"owner_entity":"","owner_type":"","acquisition_year":"","isp_providers":[],"video_providers":[],"bulk_detected":false,"bulk_agreements":[],"roe_detected":false,"roe_providers":[],"roe_expiry_year":null,"edgar_signal":false,"last_sale_price":"","last_sale_date":""}

RULES:
- owner_entity: investor/REIT/PE firm/LLC that owns the property
- owner_type: "private_equity","reit","family_office","institutional","local" or ""
- acquisition_year: 4-digit year of last sale/acquisition, or ""
- isp_providers: COMPANY NAMES ONLY of actual ISPs serving this property (e.g. GIGstreem, Hotwire, Comcast, AT&T Fiber, Spectrum, Cox, Ziply Fiber, Pavlov Media). NEVER include management company names. NEVER include service descriptions — "Wireless High Speed Internet", "High-speed internet", "Fiber internet", "Gigabit internet", "Internet included", "Broadband", "Internet access", "Wi-Fi", "High Speed Internet Service" are what the service IS, not WHO provides it. If you only see service descriptions with no company name, leave this array empty. Cross-reference the known provider list. DEDUCTIVE INFERENCE: resident/review language like "only one internet option", "no choice for internet", "forced to use [Company]", "stuck with [Company]", "[Company] has a monopoly here", "only internet is [Company]", "[Company] is included with rent" — extract the company name. Exclusivity language is strong evidence of a bulk/MDU deal even without a contract document.
- video_providers: COMPANY NAMES ONLY of cable/satellite/IPTV providers (e.g. DirecTV, Dish Network, Xfinity, Spectrum TV, Cox TV, Optimum, Mediacom). Look in [video] source snippets especially. NEVER include service descriptions — "Cable TV", "Cable included", "Satellite TV", "TV service", "Streaming", "Cable service" are service descriptions, not company names. Empty array if only service descriptions found. Cross-reference the known provider list. DEDUCTIVE INFERENCE: "DirecTV is our only choice for TV", "forced to use Dish", "only cable option is [Company]", "satellite TV included ([Company])", "stuck with Spectrum for cable" — extract the company name. Resident exclusivity complaints are strong evidence of a bulk cable/satellite agreement.
- bulk_detected: true if internet is included in rent, OR bulk/exclusive deal exists, OR "technology fee" / "tech fee" mentioned, OR MDU-only ISP present, OR any telecom agreement found, OR residents report having no choice / only one option for internet or cable — exclusivity language in reviews is a bulk deal indicator
- bulk_agreements: MAXIMUM 2 total — at most 1 with service_type "internet" AND at most 1 with service_type "video". ONLY include a provider if there is DIRECT EVIDENCE it has an exclusive/bulk/ROE agreement with THIS SPECIFIC PROPERTY (not just the city). Do NOT add providers just because they operate in the metro area or appear in FCC coverage data. The bulk internet provider is typically a single MDU-specialist ISP (e.g. GIGstreem, Hotwire, Pavlov, Bsquared). Return [] if no direct property-level evidence exists. Format:
  [{"provider":"GIGstreem","service_type":"internet","agreement_type":"bulk","confidence":"high","evidence":"internet included in rent","expiry_estimate":"Est. 2027-2029"}]
  service_type: "internet","video","bundled"
  agreement_type: "exclusive","bulk","preferred","unknown"
  expiry_estimate: specific year if mentioned, else estimate from evidence (e.g. "Est. 2027-2029")
- roe_detected: true if any right-of-entry, ROE, exclusive provider, or telecom service agreement language found in [roe] or any snippets
- roe_providers: ALL ISP/cable companies named in ROE, bulk, or exclusive agreements
- roe_expiry_year: 4-digit year when ROE/agreement expires or renews. Extract from: "expires YYYY", "contract ends YYYY", "agreement through YYYY", "renews in YYYY", "term ends YYYY". null if not found
- edgar_signal: true if [edgar] source snippets contain SEC filing references (10-K, 8-K, REIT, public company, annual report) for this property or its owner
- last_sale_price: dollar amount of most recent sale if found in [sale] or [edgar] snippets (e.g. "$24.5M", "$145,000,000"). "" if not found.
- last_sale_date: year or "Month YYYY" of most recent sale/acquisition. Extract from [sale] or [owner] snippets. "" if not found.${fccCtx}${dbProviderCtx}

SOURCE AUTHORITY + TAGS: Each snippet starts with [AUTH:N][source-tag][domain]. Prefer auth 8-10 (government/industry) over auth 3-5 (social/reviews) when data conflicts.
- [bulk]: internet/MDU agreement search results — primary ISP source
- [video]: cable/satellite/IPTV search results — primary video source
- [roe]: right-of-entry and contract term search results — primary ROE source
- [owner]: ownership/acquisition news`,
        snippets, 1400, client
      )
    : null

  const result: Phase2Result = { ...blank, ...(extracted || {}), fcc_providers: fccProviders }

  if (knownMduInFcc) {
    result.bulk_detected = true
    const knownFccProviders = fccProviders.filter(p => [...KNOWN_MDU_BULK_ISPS].some(mdu => p.toLowerCase().includes(mdu)))
    for (const kp of knownFccProviders.reverse()) {
      if (!result.isp_providers.includes(kp)) result.isp_providers.unshift(kp)
      if (result.bulk_agreements.length === 0) {
        result.bulk_agreements.push({
          provider: kp,
          service_type: 'internet',
          agreement_type: 'bulk',
          confidence: 'high',
          evidence: `FCC map shows ${kp} — MDU-only ISP, exclusive bulk model`,
        })
      }
    }
  }

  // City-level ISP confirmation — adds to isp_providers as a possible signal only.
  // NEVER creates a bulk_agreement from city-level evidence — that requires property-specific evidence.
  // bulk_detected is NOT set here; only set if Haiku finds direct property evidence above.
  for (const isp of cityConfirmedIsps) {
    const displayName = fccProviders.find(p => p.toLowerCase().includes(isp)) || isp
    if (!result.isp_providers.some(p => p.toLowerCase().includes(isp))) {
      result.isp_providers.push(displayName)
      // Do NOT push to bulk_agreements — no direct property-level evidence
    }
  }

  // ── Enforce max 1 bulk agreement per service_type ────────────────────────
  // (guards against Haiku or city-search adding multiple internet/video entries)
  const CONF_RANK: Record<string, number> = { confirmed: 4, high: 3, medium: 2, low: 1 }
  const deduped: typeof result.bulk_agreements = []
  for (const svcType of ['internet', 'video', 'bundled'] as const) {
    const matching = result.bulk_agreements.filter(a => a.service_type === svcType)
    if (!matching.length) continue
    const best = matching.reduce((a, b) =>
      (CONF_RANK[a.confidence ?? 'low'] ?? 1) >= (CONF_RANK[b.confidence ?? 'low'] ?? 1) ? a : b
    )
    deduped.push(best)
  }
  result.bulk_agreements = deduped

  // Post-extraction guard: strip service descriptions masquerading as ISP/video provider names
  result.isp_providers = filterProviderNames(result.isp_providers, ISP_SERVICE_DESCRIPTIONS)
  result.video_providers = filterProviderNames(result.video_providers, VIDEO_SERVICE_DESCRIPTIONS)

  return result
}

// ─── PHASE 3: Intelligence (parallel) ───────────────────────────────────────

interface StepContact {
  name: string; title: string; company: string;
  role_type: string; email: string; phone: string;
  linkedin: string; verified?: boolean
}

interface PainSignal {
  type: 'gate' | 'internet' | 'video_service' | 'access_control' | 'camera' | 'security' | 'package_locker' | 'smart_lock' | 'automation' | 'water_sensor' | 'intercom' | 'crime' | 'management' | 'general'
  quote: string; source: string; date: string; severity: 'high' | 'medium' | 'low'
}

// v8 Ticket 5: PropTech Scout — confidence-scored proptech findings
interface ProptechFinding {
  category: 'gate_operator' | 'access_control' | 'intercom' | 'camera' | 'smart_lock' | 'resident_app' | 'package_solution'
  brand: string
  confidence: number       // 0–100; <60 = inferred, 60–79 = likely, 80+ = confirmed
  evidence: string         // why we believe this (verbatim snippet or market inference note)
  source_url: string | null
  inferred: boolean        // true if inferred from market share, not directly found
}

interface Phase3Result {
  pain_signals: PainSignal[]
  proptech: {
    gate_operators: string[]
    access_control: string[]
    intercoms: string[]
    cameras: string[]
    smart_locks: string[]
    resident_apps: string[]
    package_solutions: string[]
    tech_generation: 'legacy' | 'modern' | 'hybrid'
  }
  proptech_findings: ProptechFinding[]   // v8: confidence-scored + sourced proptech
  contacts: StepContact[]
  email_format: string
  raw_excerpts: TavilyResult[]
}

async function runPhase3(
  confirmedName: string,
  confirmedCity: string,
  confirmedState: string,
  confirmedMgmt: string,
  confirmedOwner: string,
  confirmedWebsite: string,
  client: Anthropic,
  listingProptech: string[] = [],
  rewritten: RewrittenQuery | null = null
): Promise<Phase3Result> {
  const blank: Phase3Result = {
    pain_signals: [],
    proptech: { gate_operators: [], access_control: [], intercoms: [], cameras: [], smart_locks: [], resident_apps: [], package_solutions: [], tech_generation: 'legacy' },
    proptech_findings: [],
    contacts: [],
    email_format: '',
    raw_excerpts: [],
  }

  const geo = [confirmedCity, confirmedState].filter(Boolean).join(', ')
  const entity = confirmedMgmt || confirmedOwner

  const mgmtDomain = deriveMgmtDomain(confirmedMgmt) || deriveMgmtDomain(confirmedOwner)
  const websiteDomain = confirmedWebsite
    ? confirmedWebsite.replace(/^https?:\/\//, '').replace(/\/.*/, '').replace(/^www\./, '')
    : ''
  const domainForEmail = mgmtDomain || websiteDomain

  // 8 parallel searches — 3 social + 1 mgmt website for broader contact + ownership coverage
  // NOTE: Facebook/Instagram/Twitter are NOT indexed by Google — never use as site: targets
  // IMP-4: use rewritten query sub-queries for better intent alignment
  const p3ContactQuery = rewritten?.contact_search
    ?? `"${entity ?? confirmedName}" ${confirmedCity} "community manager" OR "regional manager" OR "property manager" OR "asset manager" OR "leasing manager" OR "onsite manager" OR "portfolio manager" OR "director of operations" site:linkedin.com`
  const p3ProptechQuery = rewritten?.proptech_search
    ? `${rewritten.proptech_search} ButterflyMX OR DoorKing OR Brivo OR Openpath OR Verkada OR SmartRent OR Latch OR LiftMaster OR HID OR SALTO OR Swiftlane OR Kastle OR Flock OR "Eagle Eye" OR "Rhombus" OR CellGate OR "access control" OR intercom OR "gate system"`
    : `"${confirmedName}" ButterflyMX OR DoorKing OR Brivo OR Openpath OR Verkada OR Avigilon OR SmartRent OR Latch OR LiftMaster OR HID OR SALTO OR Viking OR Linear OR PDK OR Swiftlane OR Kastle OR Flock OR "Eagle Eye" OR "Rhombus" OR "Deep Sentinel" OR CellGate OR "access control" OR intercom OR "gate system"`
  const p3ReviewQuery = rewritten?.review_search
    ?? `"${confirmedName}" ${confirmedCity} site:apartmentratings.com OR site:yelp.com OR site:apartments.com internet OR wifi OR gate OR security OR package OR locker OR intercom OR cameras OR "smart lock" OR cable OR streaming`
  const p3PainQuery = rewritten?.review_search
    ?? `"${confirmedName}" ${confirmedCity} reviews complaints internet gate crime`

  const [painResults, proptechResults, contactResults, mgmtWebResults, redditResults, reviewResults, proptechReviewResults, websiteResults] = await Promise.all([
    // Pain signals — IMP-4: use rewritten review query for better targeting
    serperSearch(p3PainQuery, 5, 'pain'),
    // PropTech: raw content fetch — IMP-1: filter by Tavily score before Haiku
    tavilySearch(p3ProptechQuery, 3, 'proptech', 'advanced', true).then(r => filterByScore(r, 0.4)),
    // Contacts: LinkedIn — IMP-4: use rewritten contact_search query
    serperSearch(p3ContactQuery, 8, 'contacts'),
    // Management company / ownership web presence — staff page, about page, ownership news
    serperSearch(
      entity
        ? `"${entity}" ${confirmedCity} "property manager" OR "regional manager" OR "team" OR "leadership" OR "contact us" OR "about us" -site:linkedin.com`
        : `"${confirmedName}" ${confirmedCity} "managed by" OR "management company" OR "owned by" OR "ownership" OR "developer"`,
      5, 'mgmt-web'
    ),
    // Reddit — last 6 months, expanded proptech keywords
    serperSearch(
      `"${confirmedName}" site:reddit.com internet OR wifi OR fiber OR gate OR "access control" OR intercom OR package OR locker OR "smart lock" OR cameras OR security OR management OR lease OR maintenance`,
      8, 'reddit', 'search', 'qdr:m6'
    ),
    // Review sites — last 6 months — IMP-4: use rewritten review query
    serperSearch(p3ReviewQuery, 8, 'reviews', 'search', 'qdr:m6'),
    // Proptech brand mentions in resident reviews
    serperSearch(
      `"${confirmedName}" ButterflyMX OR SmartRent OR Latch OR Verkada OR "Flock Safety" OR "package locker" OR "package room" OR "Amazon Hub" OR "gate code" OR "key fob" OR "water damage" OR "water sensor" OR thermostat OR "smart home" OR automation reviews OR residents`,
      8, 'proptech_reviews', 'search', 'qdr:m6'
    ),
    // Property website raw content — IMP-1: filter low-score Tavily results
    confirmedWebsite
      ? tavilySearch(confirmedWebsite, 1, 'website', 'advanced', true).then(r => filterByScore(r, 0.3))
      : Promise.resolve([] as TavilyResult[]),
  ])

  // Merge all three social result sets
  const socialResults = [...redditResults, ...reviewResults, ...proptechReviewResults]

  const allResults = [...painResults, ...proptechResults, ...contactResults, ...mgmtWebResults, ...socialResults, ...websiteResults]

  // Pain signal extraction — includes all social posts (Reddit, ApartmentRatings, Yelp, proptech reviews)
  // IMP-2: deduplicate by URL before assembling Haiku context
  // IMP-3: tag each snippet with source authority so Haiku can weight higher-authority facts
  const painAllSources = deduplicateByUrl([...painResults, ...socialResults])
  const painSnippets = painAllSources.filter(r => (r.content || '').length > 40).slice(0, 24)
    .map((r, i) => `[${i + 1}] ${tagSnippetWithAuthority(r)}`)
    .join('\n\n---\n\n')

  const painExtracted = painSnippets.length > 80
    ? await haikusExtract<{ signals: PainSignal[] }>(
        `Extract resident pain signals AND positive mentions from reviews, Reddit posts, ApartmentRatings, Yelp, and Google reviews. Return ONLY valid JSON:
{"signals":[{"type":"gate","quote":"","source":"","date":"","severity":"high"}]}
type: "gate","internet","video_service","access_control","camera","security","package_locker","smart_lock","automation","water_sensor","intercom","management","crime","general"
- gate: gate not working, gate always open, gate broken, piggybacking, gate code issues
- internet: wifi slow, internet outage, ISP problems, fiber issues, included internet quality
- video_service: cable included, DirecTV, streaming box, TV package, channel issues
- access_control: key fob, fob not working, door not locking, entry system, building access
- camera: cameras broken, no cameras, cameras added, surveillance improvement
- security: safety concerns, break-ins, lighting, patrol, no security guard
- package_locker: package room, Amazon Hub, package stolen, locker broken, delivery issues
- smart_lock: SmartRent, Latch, keyless entry, app-controlled lock, lock malfunction
- automation: smart thermostat, Nest, app-controlled, smart home features, automation issues
- water_sensor: flooding, leak, water damage, sensor alert, pipe burst
- intercom: ButterflyMX, visitor access, buzzer not working, guest entry
SOURCE AUTHORITY: Each snippet starts with [AUTH:N] where N=1-10. Higher authority = more trustworthy. Prefer auth 6-10 for facts; auth 3-4 (reddit/yelp) good for sentiment/quotes.
quote: verbatim resident or user quote (max 180 chars) — ALWAYS include exact words when available, good OR bad
source: "Google Reviews","Reddit","Yelp","ApartmentRatings","Apartments.com","Nextdoor" etc.
date: any date signal found ("2024","Jan 2025","3 months ago" → approximate year)
severity: high=safety/major failure/no working gate/internet outage, medium=recurring issue, low=minor complaint or positive mention
Up to 20 signals. Include BOTH complaints and positive mentions. Prefer last 12 months. Do not skip positive reviews.`,
        painSnippets, 1200, client)
    : null

  // PropTech extraction — uses raw content so full page text is available
  // Also pre-seed from Phase 1A listing page findings
  const listingProptechCtx = listingProptech.length > 0
    ? `\n\nALREADY CONFIRMED FROM LISTING PAGE (treat as verified): ${listingProptech.join(', ')}`
    : ''

  // Build proptech snippets: use raw_content if available, else content
  // Build source index → URL map so PropTech Scout can cite sources
  const filteredProptech = proptechResults.filter(r => (r.raw_content || r.content || '').length > 40).slice(0, 3)
  const filteredWebsite = websiteResults.filter(r => r.raw_content && r.raw_content.length > 100)
  const proptechSourceMap: Record<string, string> = {}
  filteredProptech.forEach((r, i) => { proptechSourceMap[`P${i + 1}`] = r.url })
  filteredWebsite.forEach((r, i) => { proptechSourceMap[`W${i + 1}`] = r.url })
  // Add listing proptech sources to the map
  if (listingProptech.length > 0) proptechSourceMap['listing'] = 'listing-page-verified'

  const websiteRaw = filteredWebsite
    .map((r, i) => `[W${i + 1}] ${r.url}\n${r.raw_content!.slice(0, 3000)}`).join('\n\n---\n\n')
  const proptechRaw = filteredProptech
    .map((r, i) => {
      const body = r.raw_content ? r.raw_content.slice(0, 2500) : r.content.slice(0, 500)
      return `[P${i + 1}] ${r.title}\n${body}`
    }).join('\n\n---\n\n')

  const proptechSnippets = [proptechRaw, websiteRaw].filter(Boolean).join('\n\n===WEBSITE===\n\n')

  // v8 Ticket 5: Run PropTech Scout (confidence-scored) in parallel with existing extraction
  const [proptechExtracted, proptechFindings] = await Promise.all([
    proptechSnippets.length > 80
      ? haikusExtract<Phase3Result['proptech']>(
          `Extract ALL property technology brands mentioned. Return ONLY valid JSON:
{"gate_operators":[],"access_control":[],"intercoms":[],"cameras":[],"smart_locks":[],"resident_apps":[],"package_solutions":[],"tech_generation":"legacy"}
Known brands (extract company name exactly as written):
- gate_operators: DoorKing/DKS/LiftMaster/Viking/Linear/FAAC/PDK/Elite Gates/CellGate/Rently/Doorking
- access_control: Brivo/HID/SALTO/Openpath/Motorola/PDK/Kisi/Allegion/Schlage/Nexkey/Kastle/Swiftlane/Assa Abloy/Yale/August/Latch/Rently
- intercoms: ButterflyMX/Aiphone/Viking/2N/DoorBird/Doorbird/Verkada/CallBox/Swiftlane/CellGate
- cameras: Verkada/Avigilon/Eagle Eye Networks/Rhombus Systems/Hanwha/Axis/Hikvision/Dahua/Bosch/Pelco/Flock Safety/Deep Sentinel/Stealth Monitoring/Ring
- smart_locks: SmartRent/Latch/August/Yale/Schlage/Kwikset/Assa Abloy/igloohome/SALTO/Allegion
- resident_apps: SmartRent/Entrata/RealPage/Yardi/AppFolio/Rent Manager/BuildingLink/Rently
- package_solutions: "Parcel Pending"/"Amazon Hub"/"Package Concierge"/"Luxer One"/"Fetch"/"Butterfly Package"
tech_generation: "legacy"=pre-2018 brands dominant (DoorKing, Aiphone, analog cameras), "modern"=2018+ brands (ButterflyMX, Verkada, Brivo, SmartRent), "hybrid"=mix
IMPORTANT: scan full page text — proptech brands often appear in: "Community Features", "Building Features", "Amenities", "Technology", "Access" sections${listingProptechCtx}`,
          proptechSnippets, 900, client)
      : Promise.resolve(null),

    // PropTech Scout: structured findings with confidence + source citation
    proptechSnippets.length > 80
      ? haikusExtract<{ findings: Array<{ category: string; brand: string; confidence: number; evidence: string; source_key: string; inferred: boolean }> }>(
          `Extract every proptech brand with a confidence score. Return ONLY valid JSON:
{"findings":[{"category":"gate_operator","brand":"","confidence":85,"evidence":"verbatim snippet or reason","source_key":"P1","inferred":false}]}

category options: "gate_operator","access_control","intercom","camera","smart_lock","resident_app","package_solution"
confidence: 0-100
- 90-100: brand explicitly named in text (e.g., "ButterflyMX intercom system")
- 70-89: brand mentioned in review or context clue (e.g., "the ButterflyMX app doesn't work")
- 50-69: brand inferred from description (e.g., "video intercom" → likely ButterflyMX or Aiphone)
- 30-49: inferred from market share for unnamed category (e.g., "gate system" at unbranded community)
source_key: which source snippet this came from — e.g. "P1", "P2", "P3", "W1", "W2", or "listing" for listing-confirmed brands
inferred: true if NOT directly named (confidence < 60), false if named in text

For INFERRED brands with no name found:
- Unnamed gate system: LiftMaster (60% market share) → confidence 40, inferred true
- Unnamed intercom: ButterflyMX (most common modern) → confidence 35, inferred true
- Unnamed cameras: Avigilon or Verkada (Class A) → confidence 35, inferred true
Only infer ONE brand per unnamed category.${listingProptechCtx}`,
          proptechSnippets, 800, client)
      : Promise.resolve(null),
  ])

  // Resolve source_key → actual URL for each PropTech Scout finding
  const resolvedProptechFindings: ProptechFinding[] = (proptechFindings?.findings ?? [])
    .filter(f => normStr(f.brand) && f.category)
    .map(f => ({
      category: f.category as ProptechFinding['category'],
      brand: f.brand,
      confidence: Math.min(100, Math.max(0, f.confidence ?? 50)),
      evidence: f.evidence ?? '',
      source_url: proptechSourceMap[f.source_key ?? ''] ?? null,
      inferred: f.inferred ?? false,
    }))

  // Contact extraction — merge LinkedIn hits + management company web results
  const allContactSources = [...contactResults, ...mgmtWebResults]
  const contactSnippets = allContactSources.filter(r => (r.content || '').length > 30).slice(0, 12)
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 350)}`).join('\n\n---\n\n')

  const contactExtracted = contactSnippets.length > 60
    ? await haikusExtract<{ contacts: Array<StepContact & { linkedin_url?: string }> }>(
        `Extract every named individual at "${entity || confirmedName}" or "${confirmedName}". Return ONLY valid JSON:
{"contacts":[{"name":"","title":"","company":"","role_type":"property_manager","email":"","phone":"","linkedin":""}]}
role_type: "property_manager","regional_manager","asset_manager","corporate"
- email: any address found, even partial
- phone: any phone number
- linkedin: full LinkedIn URL if present
- Only real "First Last" names (no companies or titles as names)
- Include LinkedIn search hits even with brief snippets — URL alone proves existence
- If LinkedIn slug contains a name, infer it
- Also extract the management company name if it appears in snippets and is not already known ("${entity || 'unknown'}")
- Empty array if no names found`,
        contactSnippets, 800, client)
    : null

  const webContacts: StepContact[] = ((contactExtracted?.contacts ?? []) as StepContact[])
    .filter(c => normStr(c.name) !== null && c.name.includes(' '))

  // Apollo + NinjaPear + Email Format — all parallel
  // IMP-5: enrich top 3 contacts via Apollo (was top 1 only) — triples email coverage
  const topContact = webContacts[0]
  const topContactParts = topContact?.name?.trim().split(/\s+/) ?? []
  const contactCompany = topContact?.company || ''
  const apolloDomain =
    deriveMgmtDomain(contactCompany) ||
    deriveMgmtDomain(confirmedMgmt) ||
    deriveMgmtDomain(confirmedOwner) ||
    domainForEmail

  const emailFormatP: Promise<string> = (async () => {
    if (!domainForEmail) return ''
    const efResults = await serperSearch(
      `"${domainForEmail}" email format site:hunter.io OR site:emailformat.com`,
      3, 'email-format'
    )
    const efSnippets = efResults.filter(r => (r.content || '').length > 20).slice(0, 4).map(r => r.content.slice(0, 250)).join('\n')
    if (!efSnippets) return ''
    const efResult = await haikusExtract<{ format: string }>(
      `Find the standard email format for domain "${domainForEmail}". Return ONLY valid JSON: {"format":""}
Examples: "firstname.lastname@domain.com", "flastname@domain.com", "firstname@domain.com"`,
      efSnippets, 80, client)
    return normStr(efResult?.format) || ''
  })()

  // Enrich top 3 contacts via Apollo in parallel (IMP-5)
  const contactsToEnrich = webContacts.slice(0, 3).filter(c => c.name && c.name.includes(' '))
  const [emailFormat, apolloResults, ninjaProfile] = await Promise.all([
    emailFormatP,
    // IMP-5: batch Apollo enrichment for top 3 contacts
    process.env.APOLLO_API_KEY
      ? Promise.all(contactsToEnrich.map(async (contact) => {
          const cDomain =
            deriveMgmtDomain(contact.company || '') ||
            deriveMgmtDomain(confirmedMgmt) ||
            deriveMgmtDomain(confirmedOwner) ||
            domainForEmail
          if (!contact.name || !cDomain) return null
          return apolloEnrichPerson(contact.name, cDomain)
        }))
      : Promise.resolve(contactsToEnrich.map(() => null)),
    // NinjaPear validation for top contact only (employment check)
    (topContact?.name && topContact.name.includes(' ') && (apolloDomain || domainForEmail))
      ? ninjapearValidatePerson(topContactParts[0], topContactParts[topContactParts.length - 1], apolloDomain || domainForEmail)
      : Promise.resolve(null),
  ])

  // IMP-5: The legacy single-contact name for backwards compat
  const apolloTopResult = apolloResults?.[0] ?? null

  const allContacts: StepContact[] = [...webContacts]

  // IMP-5: Patch Apollo results onto all enriched contacts (top 3)
  contactsToEnrich.forEach((contact, i) => {
    const enriched = apolloResults?.[i]
    if (!enriched) return
    const idx = allContacts.findIndex(c => c.name.toLowerCase() === contact.name.toLowerCase())
    if (idx < 0) return
    if (enriched.email) allContacts[idx].email = enriched.email
    if (enriched.phone_numbers?.[0]) allContacts[idx].phone = enriched.phone_numbers[0]
    if (enriched.title) allContacts[idx].title = enriched.title
    if (enriched.linkedin_url) allContacts[idx].linkedin = enriched.linkedin_url
  })

  // Patch NinjaPear validation onto top contact
  if (ninjaProfile && topContact) {
    const currentExp = (ninjaProfile.work_experience ?? []).find(e => e.end_date === null)
    const idx = allContacts.findIndex(c => c.name.toLowerCase() === topContact.name.toLowerCase())
    if (idx >= 0) {
      if (currentExp?.role) allContacts[idx].title = currentExp.role
      if (currentExp) allContacts[idx].verified = true
    }
  }

  // Construct fallback emails for contacts missing one
  allContacts.forEach(c => {
    if (!c.email && c.name && c.name.includes(' ')) {
      const contactDomain =
        deriveMgmtDomain(c.company || '') ||
        deriveMgmtDomain(confirmedMgmt) ||
        deriveMgmtDomain(confirmedOwner) ||
        domainForEmail
      if (contactDomain) {
        const parts = c.name.trim().split(/\s+/)
        const first = parts[0], last = parts[parts.length - 1]
        c.email = constructEmail(first, last, contactDomain, emailFormat)
      }
    }
  })

  // Merge listing-verified proptech into extracted proptech
  // IMPORTANT: listing_proptech from Phase 1A is always applied regardless of whether
  // the Phase 3 proptech search found anything — never gate it on proptechExtracted != null
  const finalProptech: Phase3Result['proptech'] = {
    ...(proptechExtracted ?? blank.proptech),
  }
  if (listingProptech.length > 0) {
    // Distribute listing proptech brands into the right category arrays
    for (const brand of listingProptech) {
      const b = brand.toLowerCase()
      if (['butterflymx','aiphone','2n','doorbird','callbox'].some(i => b.includes(i))) {
        if (!finalProptech.intercoms.some(x => x.toLowerCase() === b)) finalProptech.intercoms.push(brand)
      } else if (['brivo','hid','openpath','kisi','salto','pdk','allegion'].some(i => b.includes(i))) {
        if (!finalProptech.access_control.some(x => x.toLowerCase() === b)) finalProptech.access_control.push(brand)
      } else if (['liftmaster','doorking','viking','linear','faac','elite'].some(i => b.includes(i))) {
        if (!finalProptech.gate_operators.some(x => x.toLowerCase() === b)) finalProptech.gate_operators.push(brand)
      } else if (['verkada','avigilon','eagle','hanwha','axis','hikvision','dahua'].some(i => b.includes(i))) {
        if (!finalProptech.cameras.some(x => x.toLowerCase() === b)) finalProptech.cameras.push(brand)
      } else if (['smartrent','latch','august','yale','schlage','kwikset','gatewise'].some(i => b.includes(i))) {
        if (!finalProptech.smart_locks.some(x => x.toLowerCase() === b)) finalProptech.smart_locks.push(brand)
      }
      // Unknown brand: Sonnet will categorize it during synthesis
    }
  }

  return {
    pain_signals: painExtracted?.signals ?? [],
    proptech: finalProptech,
    proptech_findings: resolvedProptechFindings,
    contacts: allContacts,
    email_format: emailFormat,
    raw_excerpts: allResults,
  }
}

// ─── Synthesis tool schema ────────────────────────────────────────────────────

const deepIntelTool: Anthropic.Tool = {
  name: 'aria_deep_intel_result',
  description: 'Return the structured deep property intelligence report.',
  input_schema: {
    type: 'object' as const,
    required: ['property_details', 'isp_providers', 'video_providers', 'bulk_agreements', 'extracted_contacts', 'key_finding', 'confidence', 'proptech', 'pain_signals', 'property_phone', 'inferred_proptech'],
    properties: {
      property_details: {
        type: 'object',
        properties: {
          units:              { anyOf: [{ type: 'number' }, { type: 'string' }], description: 'Unit count as integer, or "No data found" if not found' },
          year_built:         { anyOf: [{ type: 'number' }, { type: 'string' }], description: 'Year built as integer, or "No data found" if not found' },
          management_company: { type: 'string' },
          property_type:      { type: 'string' },
          class:              { type: 'string' },
          occupancy:          { type: 'string', description: 'Occupancy rate e.g. "94%" or "No data found"' },
          last_sale_date:     { type: 'string', description: 'Most recent sale date e.g. "March 2021" or "No data found"' },
          last_sale_price:    { type: 'string', description: 'Most recent sale price e.g. "$24M" or "No data found"' },
          assessed_value:     { type: 'string', description: 'County assessed value or "No data found"' },
        },
      },
      isp_providers: { type: 'array', items: { type: 'string' } },
      video_providers: { type: 'array', items: { type: 'string' } },
      bulk_agreements: {
        type: 'array',
        items: {
          type: 'object',
          required: ['provider', 'service_type', 'agreement_type', 'expiry_estimate', 'confidence', 'evidence', 'evidence_source'],
          properties: {
            provider: { type: 'string' }, service_type: { type: 'string', enum: ['internet', 'video', 'bundled'] },
            agreement_type: { type: 'string', enum: ['exclusive', 'bulk', 'preferred', 'unknown'] },
            expiry_estimate: { type: 'string' }, confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            evidence: { type: 'string' }, evidence_source: { type: 'string' },
          },
        },
      },
      extracted_contacts: {
        type: 'array',
        description: 'Strict contact schema — every item must have all fields. phone: raw number OR "Apollo Missing – Defaulting to Office: {number}" if no direct line. phone_source: "direct" if Apollo returned a line, "office_main" if falling back to leasing office, null if neither.',
        items: {
          type: 'object',
          required: ['name', 'title', 'company', 'email', 'phone', 'phone_source', 'linkedin_slug'],
          properties: {
            name: { type: 'string' },
            title: { type: 'string' },
            company: { type: 'string' },
            email: { type: 'string', description: 'Email address or empty string — never null' },
            phone: { type: 'string', description: 'Direct number, "Apollo Missing – Defaulting to Office: XXX" if office fallback, or "" if none' },
            phone_source: { type: ['string', 'null'], enum: ['direct', 'office_main', null], description: '"direct" = Apollo returned a line; "office_main" = falling back to leasing office; null = no phone' },
            linkedin_slug: { type: 'string', description: 'LinkedIn path after /in/ — no full URL' },
          },
        },
      },
      key_finding: { type: 'string' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      units: { type: 'number' }, year_built: { type: 'number' },
      property_class: { type: 'string', enum: ['A', 'B', 'C'] },
      property_type: { type: 'string' },
      atlas_opportunity: { type: 'boolean' }, edgar_signal: { type: 'boolean' }, permit_signal: { type: 'boolean' },
      ownership: {
        type: 'object',
        properties: {
          owner_entity: { type: 'string' }, owner_type: { type: 'string' },
          portfolio_size: { type: 'string' }, acquisition_year: { type: 'string' },
          capex_signal: { type: 'string' }, sec_filing_ref: { type: 'string' },
        },
      },
      proptech: {
        type: 'object',
        properties: {
          gate_operators: { type: 'array', items: { type: 'string' } },
          access_control: { type: 'array', items: { type: 'string' } },
          intercoms: { type: 'array', items: { type: 'string' } },
          cameras: { type: 'array', items: { type: 'string' } },
          smart_locks: { type: 'array', items: { type: 'string' } },
          resident_apps: { type: 'array', items: { type: 'string' } },
          package_solutions: { type: 'array', items: { type: 'string' } },
          tech_generation: { type: 'string', enum: ['legacy', 'modern', 'hybrid'] },
          sara_signals: { type: 'boolean' },
          replacement_window: { type: 'string' },
          displacement_targets: { type: 'array', items: { type: 'string' } },
        },
      },
      pain_signals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            source: { type: 'string' }, date: { type: 'string' },
            signal_type: { type: 'string', enum: ['gate_access', 'internet', 'video_service', 'access_control', 'camera_security', 'package_theft', 'smart_lock', 'automation', 'water_sensor', 'intercom', 'crime', 'management', 'general'] },
            quote: { type: 'string' }, severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          },
        },
      },
      behavioral_profile: {
        type: 'object',
        properties: {
          personality_type: { type: 'string' }, decision_style: { type: 'string' },
          risk_tolerance: { type: 'string' }, communication_pref: { type: 'string' },
          budget_orientation: { type: 'string' },
        },
      },
      pitch_strategy: {
        type: 'object',
        properties: {
          primary_hook: { type: 'string' },
          secondary_hooks: { type: 'array', items: { type: 'string' } },
          avoid: { type: 'array', items: { type: 'string' } },
        },
      },
      freshness_score: { type: 'number' },
      buying_trends: { type: 'string' },
      property_phone: { type: 'string', description: 'Leasing office / main property phone number, or "No data found"' },
      inferred_proptech: {
        type: 'array',
        description: 'Proptech items inferred from context (reviews, pain signals, market) when no brand was explicitly found',
        items: {
          type: 'object',
          required: ['category', 'name', 'confidence_pct', 'reason'],
          properties: {
            category:       { type: 'string', enum: ['gate_operator', 'access_control', 'intercom', 'camera', 'smart_lock', 'resident_app', 'package'] },
            name:           { type: 'string', description: 'Brand name or "Unknown brand" if only category is known' },
            confidence_pct: { type: 'number', description: 'Confidence 0-100. 90+=explicitly mentioned, 70-89=strongly implied, 50-69=market inference' },
            reason:         { type: 'string', description: 'Why this was inferred' },
          },
        },
      },
    },
  },
}

// ─── Parallel Haiku: 6-month outreach campaign generator ─────────────────────
// Runs alongside the Sonnet synthesis call — Haiku is ~5x faster so it finishes
// first and the result is ready when Promise.all([sonnet, outreachPlan]) resolves.

interface OutreachMonth {
  theme: string
  actions: string[]
  goal: string
}

interface OutreachPlan {
  month_1: OutreachMonth; month_2: OutreachMonth; month_3: OutreachMonth
  month_4: OutreachMonth; month_5: OutreachMonth; month_6: OutreachMonth
  total_touches: number
  primary_channel: string
  key_milestone: string
  expected_close_quarter: string
}

async function generateOutreachPlan(
  propertyName: string,
  city: string,
  units: number | null,
  ispProviders: string[],
  roeExpiry: number | null,
  bulkDetected: boolean,
  painSignals: PainSignal[],
  behavioralProfile: Record<string, string> | null,
  pitchStrategy: Record<string, unknown> | null,
  acquisitionYear: string,
  client: Anthropic
): Promise<OutreachPlan | null> {
  const topPain = painSignals.slice(0, 3).map(s => `"${s.quote}" (${s.type})`).join('; ')
  const isp = ispProviders[0] || 'unknown ISP'
  const contractCtx = roeExpiry
    ? `ROE/bulk agreement expires ${roeExpiry}`
    : bulkDetected ? 'Bulk agreement detected — expiry unknown'
    : 'No bulk agreement detected — displacement opportunity'
  const behCtx = behavioralProfile
    ? `Decision style: ${behavioralProfile.decision_style || 'unknown'}. Channel pref: ${behavioralProfile.communication_pref || 'email'}. Risk: ${behavioralProfile.risk_tolerance || 'medium'}.`
    : 'No behavioral data.'
  const pitchHook = (pitchStrategy as any)?.primary_hook || ''

  const prompt = `Build a 6-month sales outreach campaign for a GateGuard rep targeting this property.

PROPERTY: ${propertyName}, ${city}${units ? ` (${units} units)` : ''}
CONTRACT: ${contractCtx}
CURRENT ISP: ${isp}
PAIN SIGNALS: ${topPain || 'None found'}
BEHAVIORAL PROFILE: ${behCtx}
PITCH HOOK: ${pitchHook}
${acquisitionYear ? `NEW OWNERSHIP: Acquired ${acquisitionYear} — capex window likely open` : ''}

Return ONLY valid JSON — no text outside the JSON block:
{
  "month_1": {"theme": "First Touch — Awareness", "actions": ["Send intro email referencing [specific pain or ROE insight]", "Connect on LinkedIn with personalized note", "Research gate/access system details for site"], "goal": "Get on their radar with a relevant, specific opener"},
  "month_2": {"theme": "Education — Value Proof", "actions": [], "goal": ""},
  "month_3": {"theme": "Validation — Demo Request", "actions": [], "goal": ""},
  "month_4": {"theme": "Proposal Prep — Site Walk", "actions": [], "goal": ""},
  "month_5": {"theme": "Proposal Delivery", "actions": [], "goal": ""},
  "month_6": {"theme": "Close / Urgency", "actions": [], "goal": ""},
  "total_touches": 18,
  "primary_channel": "email",
  "key_milestone": "ROE expires [year] — proposal must land 90 days prior",
  "expected_close_quarter": "Q3 2026"
}

RULES:
- Each month: theme (short title), actions (3-4 specific tasks using THIS property's data), goal (1-sentence outcome)
- Actions must reference real details: the ISP name, the pain signal quotes, the contract window
- primary_channel: "email"/"phone"/"linkedin" based on behavioral profile
- key_milestone: most important event in window (ROE expiry, new ownership capex cycle, or biggest pain signal)
- expected_close_quarter: based on contract window + typical 6-month sales cycle
- total_touches: total action count across all 6 months`

  return await haikusExtract<OutreachPlan>(prompt, '', 1200, client)
}

// ─── Haiku: Gatekeeper navigation tip ────────────────────────────────────────
// Generates a 1-2 sentence cold-call script for reaching a property manager
// through a leasing office receptionist. Runs in parallel with Sonnet synthesis.

async function generateGatekeeperTip(
  contactName: string,
  contactTitle: string,
  propertyName: string,
  managementCompany: string,
  officePhone: string | null,
  ispProvider: string,
  client: Anthropic
): Promise<string | null> {
  if (!contactName) return null
  const phoneCtx = officePhone ? ` Call ${officePhone}.` : ''
  const result = await haikusExtract<{ tip: string }>(
    `Write a gatekeeper navigation script for a GateGuard sales rep trying to reach ${contactName} (${contactTitle || 'property decision-maker'}) at "${propertyName}"${managementCompany ? ` (${managementCompany})` : ''}.${phoneCtx}

GateGuard installs gate, access control, and intercom systems for multifamily properties. Current provider: ${ispProvider || 'unknown'}.

Return ONLY valid JSON: {"tip":""}

The script must:
- Be 1-2 sentences, conversational tone
- Tell the rep to ask for the contact by first name
- Give a professional non-sales-y reason: reference a "connectivity and access review" or the property's "upcoming gate system assessment"
- Include a brief objection-handler if blocked ("they were expecting my call regarding...")
Example output: "Ask for [First Name] by name. If blocked: 'I'm following up with [First Name] about the gate and access control assessment we have scheduled for the property — they're expecting my call.'"`,
    '', 250, client
  )
  return normStr(result?.tip) || null
}

// ─── Phase 4 synthesis fallback ──────────────────────────────────────────────
// Builds rawData from deterministic phase results when Sonnet fails (504/overload).
// Guarantees the search always returns something — phase data is never lost.
function buildFallbackRawData(
  p1: Phase1Result,
  p2: Phase2Result,
  p3: Phase3Result,
  mgmt: string,
  finalOwner: string
): Record<string, any> {
  return {
    property_details: {
      units:              p1.confirmed_units ?? 'No data found',
      year_built:         (p1 as any).confirmed_year_built ?? 'No data found',
      management_company: mgmt || 'No data found',
      property_type:      'multifamily',
      class:              'B',
      occupancy:          'No data found',
      last_sale_date:     p2.last_sale_date || 'No data found',
      last_sale_price:    p2.last_sale_price || 'No data found',
      assessed_value:     'No data found',
    },
    isp_providers:     p2.isp_providers,
    video_providers:   p2.video_providers,
    bulk_agreements:   p2.bulk_agreements,
    extracted_contacts: p3.contacts,
    key_finding:       'ARIA completed search and returned deterministic phase data. AI synthesis timed out — re-run to get full analysis.',
    confidence:        'medium',
    proptech:          p3.proptech,
    pain_signals:      p3.pain_signals,
    property_phone:    p1.confirmed_phone || 'No data found',
    inferred_proptech: [],
    ownership: {
      owner_entity:     finalOwner,
      owner_type:       p2.owner_type,
      acquisition_year: p2.acquisition_year,
    },
    freshness_score:  5,
    buying_trends:    'Synthesis unavailable — phase data preserved above.',
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── Auth: Clerk session OR internal service key (from Inngest background jobs) ──
    let userId: string | null = null
    const serviceKey = req.headers.get('x-service-key')
    if (serviceKey && serviceKey === process.env.ARIA_SERVICE_KEY && serviceKey.length > 8) {
      // Trusted internal call from Inngest — skip Clerk session check
      userId = 'inngest-service'
    } else {
      const { userId: clerkId } = await auth()
      userId = clerkId
    }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!process.env.TAVILY_API_KEY) return NextResponse.json({ error: 'TAVILY_API_KEY not configured' }, { status: 503 })

    const raw = await req.json()
    const rawQuery: string = raw.property_name || raw.query || ''
    if (!rawQuery) return NextResponse.json({ error: 'property_name or query required' }, { status: 400 })

    // v10: the UI filter chips (All / ISP / Cable / Gate & Access / Cameras) — now
    // actually consumed to bias the searches instead of being silently ignored.
    const searchFocus = String(raw.search_focus ?? raw.searchFocus ?? 'all').toLowerCase()
    const focusEmphasis = (name: string) =>
      /isp|internet/.test(searchFocus) ? `${name} bulk internet ISP provider exclusive agreement`
      : /cable|video/.test(searchFocus) ? `${name} bulk TV cable video provider agreement`
      : /gate|access/.test(searchFocus) ? `${name} gate operator access control intercom system`
      : /camera/.test(searchFocus) ? `${name} security cameras surveillance system brand`
      : null

    // v9 — initialize in-pipeline cost tracker
    const costTracker = new CostTracker()

    // ── v9: Credit pre-gate (blocking, atomic) ───────────────────────────────
    // Deducts CREDITS_PER_SEARCH before any work begins. Returns 402 if insufficient.
    // Skipped for internal Inngest service calls.
    let userOrgId: string | null = null
    if (userId !== 'inngest-service') {
      try {
        const portalUser = await getCurrentUser()
        userOrgId = portalUser?.org_id ?? null
        if (userOrgId) {
          const { data: spendResult, error: spendError } = await supabaseDeep
            .rpc('spend_aria_credits', {
              p_org_id: userOrgId,
              p_user_id: userId,
              p_amount: CREDITS_PER_SEARCH,
              p_search_run_id: null,  // search_run_id not yet created — will link in completeSearchRun
            })
          if (spendError) {
            // RPC error (not insufficient) — allow search to proceed, log for audit
            console.warn('[aria] credit RPC error (proceeding anyway):', spendError.message)
          } else if (spendResult && !spendResult.success) {
            return NextResponse.json({
              error: 'Insufficient credits',
              reason: spendResult.reason,
              balance: spendResult.balance ?? 0,
              credits_required: CREDITS_PER_SEARCH,
            }, { status: 402 })
          }
        }
        // No org_id (personal account / dev) — skip credit gate
      } catch (err) {
        console.warn('[aria] credit check failed (proceeding):', (err as Error)?.message)
      }
    }

    // ── PHASE 0: Classification ───────────────────────────────────────────────
    const classification = await classifyQuery(rawQuery, anthropic)

    // v8: Track run duration + search run ID — set in each branch below
    let searchRunId: string | null = null
    const runStart = Date.now()

    // v10: Per-step persistence. Each phase saves what it found to Supabase
    // immediately (additive merge-upsert), so a later failure never drops the
    // earlier steps' data — and re-runs build on what's already saved.
    const checkpoint = (partial: Record<string, unknown>) => {
      void (async () => {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
          await fetch(`${baseUrl}/api/aria/properties`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-service-key': process.env.ARIA_SERVICE_KEY ?? '' },
            body: JSON.stringify({ prospects: [partial] }),
          })
        } catch { /* non-blocking — never let a checkpoint break the run */ }
      })()
    }

    // ── PHASE 1B: Prospecting (city/criteria/contract queries) ────────────────
    if (classification.type !== 'specific_property') {
      // v8: Every search is a durable case file — create the run record first
      searchRunId = await createSearchRun(userId, null, rawQuery, classification.type, null)

      // v10: bias criteria candidate discovery toward the selected focus chip.
      const focusedQuery = focusEmphasis('') ? `${rawQuery} — prioritize ${searchFocus}` : rawQuery
      const candidateResult = await runPhase1B(focusedQuery, classification, anthropic)

      // v8 Ticket 4: enrich top-3 candidates with lightweight Serper+Haiku pass
      // Runs in parallel (3 searches + 3 Haiku calls) — adds ~2-4s, zero blocking
      const enrichedCandidates = candidateResult.candidates.length > 0
        ? await enrichTopCandidates(candidateResult.candidates, anthropic)
        : candidateResult.candidates

      // v8: Persist ALL candidates before returning — none are dropped or discarded
      const candidateIds = (searchRunId && enrichedCandidates.length > 0)
        ? await saveCandidatesToDB(searchRunId, enrichedCandidates)
        : []

      // v10: Persist criteria-discovered properties durably to the intel DB too —
      // so selecting one later promotes a saved case file instead of re-searching.
      for (const c of enrichedCandidates) {
        const cc = c as unknown as Record<string, unknown>
        if (cc.name) checkpoint({ property: {
          name: cc.name, address: cc.address ?? '', city: cc.city ?? '', state: cc.state ?? '',
          units: cc.units ?? null, year_built: cc.year_built ?? null,
          class: cc.property_class ?? null, management_company: cc.management_company ?? null,
        } })
      }

      // v8: Save Phase 1B source evidence — raw search results with URLs (non-blocking)
      if (searchRunId && candidateResult.raw_results?.length) {
        const p1bEvidence = candidateResult.raw_results.slice(0, 18).map(r => ({
          fact_type: 'candidate_source',
          extracted_value: (r.title ?? '').slice(0, 200),
          source_url: r.url || undefined,
          source_type: r.source ?? 'web',
          source_authority: sourceAuthority(r.url ?? ''),
          confidence: Math.round(Math.min(1, r.score ?? 0.6) * 100),
          raw_snippet: (r.content ?? '').slice(0, 600),
          phase_found: 1,
        }))
        saveEvidencePackets(searchRunId, null, p1bEvidence)
      }

      // v8: Mark run complete with stats
      if (searchRunId) {
        void completeSearchRun(searchRunId, 'complete', {
          candidate_count: enrichedCandidates.length,
          duration_ms: Date.now() - runStart,
        })
      }

      return NextResponse.json({
        type: 'candidates',
        mode: 'candidates',
        engine_version: ARIA_ENGINE_VERSION,
        search_run_id: searchRunId,
        candidates: enrichedCandidates.map((c, i) => ({
          ...c,
          rank_position: i + 1,
          _candidate_id: candidateIds[i] ?? null,
        })),
        query_interpretation: candidateResult.query_interpretation,
        candidate_count: enrichedCandidates.length,
      })
    }

    // ── PHASE 1A + DB lookback + Query Rewriting in parallel ────────────────
    // IMP-4: rewriteQuery expands the raw query into intent-specific sub-queries.
    // Runs concurrently with DB lookup and Phase 1A — zero latency impact.
    const [p1, existingRecord, rewritten] = await Promise.all([
      runPhase1A(rawQuery, anthropic),
      lookupExistingProperty(rawQuery, classification.city_hint),
      rewriteQuery(rawQuery, anthropic),
    ])

    // v9: Create search run for specific_property branch (rewritten query now available)
    searchRunId = await createSearchRun(
      userId, userOrgId, rawQuery, 'specific_property',
      rewritten as unknown as Record<string, unknown>
    )

    // ── Merge Phase 1A with existing DB record (DB fills gaps, fresh wins) ───
    const property_name = p1.confirmed_name || existingRecord?.property_name || rawQuery
    const address = p1.confirmed_address || existingRecord?.address || ''
    const city = p1.confirmed_city || classification.city_hint || ''
    const state = p1.confirmed_state || classification.state_hint || ''
    const mgmt = p1.confirmed_management || existingRecord?.management_company || classification.mgmt_hint || ''
    const owner = p1.confirmed_owner || existingRecord?.owner_entity || ''
    const website = p1.confirmed_website || ''

    // v10: bias the named-property deep searches toward the selected focus chip.
    if (focusEmphasis(property_name)) {
      const emph = focusEmphasis(`${property_name} ${city} ${state}`.trim())!
      if (/isp|internet|cable|video/.test(searchFocus)) rewritten.isp_search = emph
      else rewritten.proptech_search = emph
    }

    // Log Phase 1A amenity findings — these are gold (listing page verified)
    if (p1.listing_isp) console.log(`[aria] Phase1A amenity ISP: ${p1.listing_isp}`)
    if (p1.listing_cable) console.log(`[aria] Phase1A amenity cable: ${p1.listing_cable}`)
    if (p1.listing_proptech.length) console.log(`[aria] Phase1A amenity proptech: ${p1.listing_proptech.join(', ')}`)

    // Pre-seed Phase 2: DB data + Phase 1A listing-verified amenity data
    // Priority: user-verified DB > listing-page verified > AI search results
    const listingVerifiedIsps = p1.listing_isp ? [p1.listing_isp] : []
    const listingVerifiedVideos = p1.listing_cable ? [p1.listing_cable] : []

    const dbPhase2Seed = {
      isp_providers:    [...new Set([...(existingRecord?.isp_providers ?? []), ...listingVerifiedIsps])],
      video_providers:  [...new Set([...(existingRecord?.video_providers ?? []), ...listingVerifiedVideos])],
      roe_expiry_year:  existingRecord?.roe_expiry_user_verified
        ? (existingRecord.roe_expiry_year ?? null) : null,
      roe_providers:    existingRecord?.roe_providers ?? [],
      roe_detected:     (existingRecord?.roe_detected ?? false) || p1.listing_bulk_detected,
      bulk_agreements:  existingRecord?.bulk_agreements ?? [],
      // Listing-page bulk detection: if ISP/cable listed as amenity, create a seed agreement
      listing_bulk_detected: p1.listing_bulk_detected,
    }

    // If listing page confirmed bulk, create a seed agreement entry
    if (p1.listing_bulk_detected && p1.listing_isp && dbPhase2Seed.bulk_agreements.length === 0) {
      dbPhase2Seed.bulk_agreements = [{
        provider: p1.listing_isp,
        service_type: 'internet',
        agreement_type: 'bulk',
        confidence: 'high',
        evidence: `Listed as amenity on property listing page (${p1.listing_url || 'listing site'})`,
      }]
    }

    // v10 CHECKPOINT 1 — persist property identity + listing-verified connectivity
    // the moment Phase 1A lands, before any further (failure-prone) steps run.
    checkpoint({ property: {
      name: property_name, address, city, state,
      units: p1.confirmed_units ?? null, year_built: p1.confirmed_year_built ?? null,
      management_company: mgmt || null, owner_entity: owner || null,
      isp_providers: listingVerifiedIsps, video_providers: listingVerifiedVideos,
    } })

    if (existingRecord?.times_researched) {
      console.log(`[aria] Re-searching known property: ${property_name} (researched ${existingRecord.times_researched}x)`)
    }

    // STOP: only if we have zero identity signal — confirmed_name alone is enough to proceed
    if (!city && !state && !p1.is_specific_property && !p1.confirmed_name && !property_name) {
      return NextResponse.json({ error: 'Property not found. Try a more specific query (include city/state).' }, { status: 404 })
    }

    // Geocode
    const coords = await geocodeAddress(address || property_name, city, state)

    // ── PHASES 2 + 3 in parallel (+ mdu_providers DB fetch) ──────────────────
    // IMP-4: pass rewritten queries to both Phase 2 and Phase 3 for intent-specific searches
    const [p2Raw, p3] = await Promise.all([
      fetchMduProviders().then(dbProviders =>
        runPhase2(property_name, address, city, state, mgmt, coords, anthropic, dbProviders, rewritten)
      ),
      // Pass Phase 1A listing data + rewritten queries into Phase 3
      runPhase3(property_name, city, state, mgmt, owner, website, anthropic, p1.listing_proptech, rewritten),
    ])

    // Merge Phase 2 with DB+listing seed — user-verified DB > listing-verified > AI
    const p2: typeof p2Raw = {
      ...p2Raw,
      isp_providers: [
        ...new Set([...(dbPhase2Seed.isp_providers), ...p2Raw.isp_providers])
      ],
      video_providers: [
        ...new Set([...(dbPhase2Seed.video_providers), ...p2Raw.video_providers])
      ],
      roe_expiry_year: dbPhase2Seed.roe_expiry_year ?? p2Raw.roe_expiry_year,
      roe_providers: [
        ...new Set([...(dbPhase2Seed.roe_providers), ...p2Raw.roe_providers])
      ],
      roe_detected: p2Raw.roe_detected || dbPhase2Seed.roe_detected || false,
      // Merge bulk agreements: DB+listing agreements merged with new findings
      bulk_agreements: (() => {
        const dbAgreements = dbPhase2Seed?.bulk_agreements ?? []
        const newAgreements = p2Raw.bulk_agreements
        if (!dbAgreements.length) return newAgreements
        if (!newAgreements.length) return dbAgreements
        // Union: prefer higher-confidence / user-verified
        const result = [...dbAgreements]
        for (const na of newAgreements) {
          const key = `${(na.provider ?? '').toLowerCase()}:${na.service_type ?? ''}`
          const exists = result.find(e => `${(e.provider ?? '').toLowerCase()}:${e.service_type ?? ''}` === key)
          if (!exists) result.push(na)
        }
        return result
      })(),
    }

    const finalOwner = p2.owner_entity || owner || ''

    // v9: Supervisor loop — fills gaps with targeted searches, returns evidence packets
    // Catch 3: supervisor evidence gets full provenance scores (not orphaned at 0)
    const [p2Supervised, p3Supervised, supervisorEvidence] = await runSupervisorCheck(
      property_name, city, state, p2, p3, costTracker, runStart, anthropic
    )
    // Use supervisor-enriched data for synthesis
    const p3Final = p3Supervised

    // ── Post-supervisor: deductive connectivity inference from pain signals ─────
    // Resident quotes like "only one internet option" or "forced to use DirecTV"
    // are strong evidence of bulk/exclusive arrangements. Phase 2 and Phase 3 ran
    // in parallel so Phase 2 couldn't see these signals. Fix that now deterministically
    // before sending to Sonnet.
    const EXCLUSIVITY_RE = /only\s+(?:option|choice|provider|internet|isp|cable|one)\b|(?:no|zero)\s+(?:choice|option|alternative)\b|forced\s+to\s+use\b|stuck\s+with\b|no\s+other\s+(?:choice|option|internet|cable)\b|(?:monopoly|exclusive)\s+(?:on|for|with)\b|only\s+(?:internet|cable|tv|isp)\b|required\s+to\s+use\b|only\s+one\s+(?:internet|cable|isp|option|provider)\b/i
    const p2FinalConnectivity = { ...p2Supervised }
    for (const signal of p3Final.pain_signals) {
      const text = (signal.quote + ' ' + (signal.source ?? '')).toLowerCase()
      const hasExclusivity = EXCLUSIVITY_RE.test(text)
      // Scan for known ISP names
      for (const ispName of KNOWN_MDU_BULK_ISPS) {
        if (!text.includes(ispName.toLowerCase())) continue
        if (!p2FinalConnectivity.isp_providers.some(p => p.toLowerCase().includes(ispName))) {
          p2FinalConnectivity.isp_providers = [...p2FinalConnectivity.isp_providers, ispName]
        }
        if (hasExclusivity) {
          p2FinalConnectivity.bulk_detected = true
          if (!p2FinalConnectivity.bulk_agreements.some(a => a.service_type === 'internet')) {
            p2FinalConnectivity.bulk_agreements = [...p2FinalConnectivity.bulk_agreements, {
              provider: ispName,
              service_type: 'internet',
              agreement_type: 'exclusive',
              confidence: 'medium',
              evidence: `Resident review exclusivity signal: "${signal.quote.slice(0, 150)}"`,
            }]
          }
        }
      }
      // Scan for known video provider names
      for (const vidName of KNOWN_VIDEO_PROVIDERS) {
        if (!text.includes(vidName.toLowerCase())) continue
        if (!p2FinalConnectivity.video_providers.some(p => p.toLowerCase().includes(vidName))) {
          p2FinalConnectivity.video_providers = [...p2FinalConnectivity.video_providers, vidName]
        }
        if (hasExclusivity) {
          p2FinalConnectivity.bulk_detected = true
          if (!p2FinalConnectivity.bulk_agreements.some(a => a.service_type === 'video')) {
            p2FinalConnectivity.bulk_agreements = [...p2FinalConnectivity.bulk_agreements, {
              provider: vidName,
              service_type: 'video',
              agreement_type: 'exclusive',
              confidence: 'medium',
              evidence: `Resident review exclusivity signal: "${signal.quote.slice(0, 150)}"`,
            }]
          }
        }
      }
    }
    const p2Final = p2FinalConnectivity

    // v10 CHECKPOINT 2 — persist connectivity + ownership before (failure-prone) synthesis.
    checkpoint({
      property: {
        name: property_name, address, city, state,
        isp_providers: p2Final.isp_providers, video_providers: p2Final.video_providers,
        bulk_agreements: p2Final.bulk_agreements, roe_detected: p2Final.roe_detected,
        roe_providers: p2Final.roe_providers, roe_expiry_year: p2Final.roe_expiry_year,
      },
      ownership: { owner_type: p2Final.owner_type, acquisition_year: p2Final.acquisition_year },
    })

    // v10 CHECKPOINT 3 — persist the full proptech stack + pain signals before synthesis.
    checkpoint({ property: {
      name: property_name, address, city, state,
      proptech: {
        gate_operators: p3Final.proptech.gate_operators,
        access_control: p3Final.proptech.access_control,
        intercoms: p3Final.proptech.intercoms,
        cameras: p3Final.proptech.cameras,
        smart_locks: p3Final.proptech.smart_locks,
        resident_apps: p3Final.proptech.resident_apps,
        package_solutions: p3Final.proptech.package_solutions,
        tech_generation: p3Final.proptech.tech_generation,
      },
      pain_signals: p3Final.pain_signals,
    } })

    // v9: Check quality gates — required field checklist before synthesis
    const qualityGates = checkQualityGates(p1, p2Final, p3Final)

    // v9: Save Phase 1A + Phase 2 + Phase 3 key evidence (non-blocking, best-effort)
    if (searchRunId) {
      const evidenceFacts: Parameters<typeof saveEvidencePackets>[2] = []
      // Phase 1A facts — include listing page URL as source
      const listingUrl = p1.listing_url ?? undefined
      if (p1.confirmed_phone)      evidenceFacts.push({ fact_type: 'phone',   extracted_value: p1.confirmed_phone,             source_url: listingUrl, source_type: 'listing', confidence: 90, phase_found: 1 })
      if (p1.confirmed_units)      evidenceFacts.push({ fact_type: 'units',   extracted_value: String(p1.confirmed_units),     source_url: listingUrl, source_type: 'listing', confidence: 85, phase_found: 1 })
      if (p1.confirmed_address)    evidenceFacts.push({ fact_type: 'address', extracted_value: p1.confirmed_address,           source_url: listingUrl, source_type: 'listing', confidence: 90, phase_found: 1 })
      if (p1.listing_isp)          evidenceFacts.push({ fact_type: 'isp',     extracted_value: p1.listing_isp,                 source_url: listingUrl, source_type: 'listing', confidence: 95, phase_found: 1 })
      if (p1.confirmed_management) evidenceFacts.push({ fact_type: 'owner',   extracted_value: p1.confirmed_management,        source_url: listingUrl, source_type: 'listing', confidence: 80, phase_found: 1 })
      // Phase 2 facts
      if (p2Final.owner_entity)    evidenceFacts.push({ fact_type: 'owner', extracted_value: p2Final.owner_entity,              source_type: 'owner', confidence: 75, phase_found: 2 })
      if (p2Final.roe_expiry_year) evidenceFacts.push({ fact_type: 'roe',   extracted_value: String(p2Final.roe_expiry_year),   source_type: 'roe',   confidence: 80, phase_found: 2 })
      p2Final.isp_providers.slice(0, 3).forEach(isp =>
        evidenceFacts.push({ fact_type: 'isp', extracted_value: isp, source_type: 'bulk', confidence: 70, phase_found: 2 })
      )
      // Phase 3 contacts — include LinkedIn URL as source
      p3Final.contacts.slice(0, 3).forEach(c =>
        evidenceFacts.push({ fact_type: 'contact', extracted_value: `${c.name} (${c.title})`, source_url: c.linkedin || undefined, source_type: 'contacts', confidence: 75, phase_found: 3 })
      )
      // Pain signals
      p3Final.pain_signals.slice(0, 5).forEach(s =>
        evidenceFacts.push({ fact_type: 'pain_signal', extracted_value: s.quote.slice(0, 200), source_type: s.source, confidence: 65, phase_found: 3 })
      )
      if (evidenceFacts.length > 0) saveEvidencePackets(searchRunId, null, evidenceFacts)

      // v9 Catch 3: Save supervisor evidence packets — these have provenance scores, not orphaned at 0
      if (supervisorEvidence.length > 0) {
        saveEvidencePackets(searchRunId, null, supervisorEvidence)
      }

      // v9: Save Phase 3 raw source excerpts as bulk evidence — each result gets source_url + raw_snippet
      if (p3Final.raw_excerpts.length > 0) {
        const p3BulkEvidence = p3Final.raw_excerpts.slice(0, 15).map(r => ({
          fact_type: 'source_excerpt',
          extracted_value: (r.title ?? '').slice(0, 200),
          source_url: r.url || undefined,
          source_type: r.source ?? 'web',
          source_authority: sourceAuthority(r.url ?? ''),
          confidence: Math.round(Math.min(1, r.score ?? 0.5) * 100),
          raw_snippet: (r.content ?? '').slice(0, 600),
          phase_found: 3,
        }))
        saveEvidencePackets(searchRunId, null, p3BulkEvidence)
      }

      // v9: Save PropTech Scout findings as proptech evidence packets
      if (p3Final.proptech_findings.length > 0) {
        const proptechEvidence = p3Final.proptech_findings.map(f => ({
          fact_type: 'proptech',
          extracted_value: `${f.brand} (${f.category})`,
          source_url: f.source_url || undefined,
          source_type: f.inferred ? 'inferred' : 'proptech',
          source_authority: f.inferred ? 3 : 7,
          confidence: f.confidence,
          raw_snippet: f.evidence.slice(0, 600),
          phase_found: 3,
        }))
        saveEvidencePackets(searchRunId, null, proptechEvidence)
      }
    }

    // ── Determine best contact early — needed for gatekeeper tip ─────────────
    const earlyBestContact = p3Final.contacts.find(c => c.role_type === 'property_manager')
      || p3Final.contacts.find(c => c.role_type === 'regional_manager')
      || p3Final.contacts.find(c => c.role_type === 'asset_manager')
      || p3Final.contacts[0]

    // Leasing office phone (Phase 1A — confirmed from listing page)
    const officePhone = normStr(p1.confirmed_phone)

    // ── PHASE 4: Synthesis ────────────────────────────────────────────────────
    // v9: Synthesis data caps — prevents Sonnet token overflow + keeps cost under cap
    // Pain signals: 12 max, each capped at 180 chars (was uncapped → could hit 4k+ tokens)
    // Contacts: 8 max, stripped to name/title/company/role_type for synthesis prompt
    const cappedPainSignals = p3Final.pain_signals
      .slice(0, 12)
      .map(s => ({ ...s, quote: s.quote.slice(0, 180) }))
    const cappedContacts = p3Final.contacts
      .slice(0, 8)
      .map(c => ({ name: c.name, title: c.title, company: c.company, role_type: c.role_type }))

    const synthesisData = `PHASE 1 — VERIFIED IDENTITY:
${JSON.stringify({ name: property_name, address, city, state, units: p1.confirmed_units, year_built: p1.confirmed_year_built, management_company: mgmt, website, phone: p1.confirmed_phone }, null, 2)}

PHASE 2 — ENRICHMENT:
${JSON.stringify({ owner_entity: finalOwner, owner_type: p2Final.owner_type, acquisition_year: p2Final.acquisition_year, fcc_providers: p2Final.fcc_providers, isp_providers: p2Final.isp_providers, video_providers: p2Final.video_providers, bulk_detected: p2Final.bulk_detected, bulk_agreements: p2Final.bulk_agreements, roe_detected: p2Final.roe_detected, roe_providers: p2Final.roe_providers, roe_expiry_year: p2Final.roe_expiry_year, edgar_signal: p2Final.edgar_signal, last_sale_price: p2Final.last_sale_price, last_sale_date: p2Final.last_sale_date }, null, 2)}

PHASE 3 — INTELLIGENCE:
${JSON.stringify({ pain_signals: cappedPainSignals, proptech: p3Final.proptech, contacts: cappedContacts, email_format: p3Final.email_format }, null, 2)}`

    // ── PHASE 4: Sonnet synthesis + Haiku outreach plan — run in PARALLEL ───────
    // Promise.allSettled: if Sonnet fails (504/overload), fall back to deterministic
    // phase data instead of throwing — search data is never lost.
    // NOTE: cost-cap circuit breaker removed — it was skipping Sonnet synthesis
    // entirely which caused units/ISP/ownership regressions on every search.
    const [messageResult, outreachResult, gatekeeperResult] = await Promise.allSettled([
      // v9: Prompt caching on system prompt — Anthropic caches large system prompts
      // for up to 5 minutes. During concurrent searches the same synthesis instructions
      // hit the cache, reducing Sonnet input token cost by ~90%.
      anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2800,
        tools: [deepIntelTool],
        tool_choice: { type: 'tool', name: 'aria_deep_intel_result' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        system: ([
          {
            type: 'text',
            text: `You assemble step-verified data into a final property intelligence report. Phases 1-3 are ground truth — copy directly. Use synthesis only to fill gaps and write the sales brief.`,
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'text',
            text: `CRITICAL RULES:
1. property_details.units: copy from Phase 1
2. property_details.management_company: copy from Phase 1 — NEVER overwrite with a person's name
3. isp_providers: copy from Phase 2 isp_providers. If fcc_providers has names not in isp_providers, add them.
4. video_providers: copy from Phase 2 video_providers. Look for DirecTV, Dish, Comcast, Xfinity, Spectrum, cable, satellite — populate this array, do NOT leave it empty if any evidence exists.
5. bulk_agreements: copy ALL from Phase 2. Include video agreements (DirecTV MDU, Spectrum TV bulk) separately from internet agreements. For each agreement:
   - If roe_expiry_year is set → use it as expiry_estimate
   - Else if year_built known: MDU fiber = year_built+7 to year_built+10; cable bulk = year_built+5 to year_built+8
   - Set expiry_estimate = "Est. [year]-[year+2]" or specific year if known
6. proptech: copy from Phase 3
7. extracted_contacts: copy from Phase 3 contacts. STRICT SCHEMA — every item must have: name (string), title (string), company (string), email (string or ""), phone (raw number OR "Apollo Missing – Defaulting to Office: {leasing_number}" OR ""), phone_source ("direct"|"office_main"|null), linkedin_slug (path after /in/ or ""). Never omit fields, never use null for string fields.
8. isp_providers enrichment from pain_signals: scan Phase 3 pain_signals for any known ISP name (Spectrum, Comcast, AT&T, GIGstreem, Hotwire, Cox, Verizon Fios, Google Fiber, Frontier, Optimum, Ziply, Pavlov Media, Starry, DojoNetworks, Smartaira, Boingo, Midco, Nextlink, MDU Communications, Single Digits, etc.) used alongside exclusivity language: "only option", "only internet", "no choice", "no other choice", "forced to use", "stuck with", "only one provider", "monopoly", "required to use", "only ISP", "no alternative". If found and NOT already in isp_providers[] from Phase 2 → ADD that company name. Example: "GIGstreem is our only internet option and it's terrible" → add GIGstreem to isp_providers.
9. video_providers enrichment from pain_signals: same rule for cable/satellite/IPTV. Scan pain_signals for DirecTV, Dish Network, Xfinity, Spectrum TV, Cox TV, Optimum, Mediacom, Sling, FuboTV with exclusivity language. "DirecTV is our only choice for cable" → add DirecTV. "forced to use Dish" → add Dish. "only cable company here is Spectrum" → add Spectrum TV. Also set bulk_detected = true in your output when exclusivity language appears in pain_signals for either internet or video.`,
          },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any),

        messages: [{ role: 'user', content: `Property: ${property_name}\nLocation: ${city}, ${state}\n\n${synthesisData}` }],
      }),
      // Haiku generates the 6-month outreach plan in parallel — adds zero latency
      generateOutreachPlan(
        property_name, city,
        p1.confirmed_units,
        p2Final.isp_providers,
        p2Final.roe_expiry_year,
        p2Final.bulk_detected,
        p3Final.pain_signals,
        null, // behavioral_profile not yet available (Sonnet hasn't finished)
        null, // pitch_strategy not yet available
        p2Final.acquisition_year,
        anthropic
      ),
      // Haiku generates a gatekeeper navigation script in parallel (fast, ~0.5s)
      generateGatekeeperTip(
        normStr(earlyBestContact?.name) ?? '',
        normStr(earlyBestContact?.title) ?? '',
        property_name,
        mgmt,
        officePhone,
        p2Final.isp_providers[0] || '',
        anthropic
      ),
    ])

    // Build rawData from Sonnet result — or fall back to deterministic phase data if Sonnet failed
    let rawData: Record<string, any>
    if (messageResult.status === 'fulfilled') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = messageResult.value as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolBlock = (msg.content as any[])?.find((b: any) => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
      if (toolBlock) {
        rawData = toolBlock.input as Record<string, any>
        costTracker.addSonnet(msg.usage?.input_tokens ?? 0, msg.usage?.output_tokens ?? 0)
      } else {
        // Sonnet responded but returned no tool_use block — treat as synthesis failure
        console.error('[aria] Phase 4 Sonnet returned no tool_use block')
        rawData = buildFallbackRawData(p1, p2Final, p3Final, mgmt, finalOwner)
      }
    } else {
      console.error('[aria] Phase 4 synthesis failed:', (messageResult as PromiseRejectedResult).reason)
      rawData = buildFallbackRawData(p1, p2Final, p3Final, mgmt, finalOwner)
    }

    console.log(`[aria] v9 cost: ${costTracker.summary()}`)

    // outreachPlan + gatekeeper ready — Haiku finished while Sonnet was synthesising
    const outreachPlan = outreachResult.status === 'fulfilled' ? outreachResult.value : null
    const gatekeeperTipResult = gatekeeperResult.status === 'fulfilled' ? gatekeeperResult.value : null

    // ── Build final payload ───────────────────────────────────────────────────
    const cleanIspProviders = normStrArr(p2Final.isp_providers.length ? p2Final.isp_providers : (rawData.isp_providers ?? []))
    const cleanVideoProviders = normStrArr(p2Final.video_providers.length ? p2Final.video_providers : (rawData.video_providers ?? []))
    const cleanBulkAgreements = p2Final.bulk_agreements.length ? p2Final.bulk_agreements : (rawData.bulk_agreements ?? [])

    const mergedDMChain = p3Final.contacts.filter(c => c.name).map(c => {
      const directPhone = normStr(c.phone)
      return {
        name: c.name, title: c.title, company: c.company || mgmt || finalOwner,
        role_type: c.role_type, email: c.email, top_email_format: p3Final.email_format,
        // Phone hierarchy: direct line first, then leasing office, then empty
        phone: directPhone ?? (officePhone ?? ''),
        phone_source: (directPhone ? 'direct' : (officePhone ? 'office_main' : null)) as 'direct' | 'office_main' | null,
        linkedin_slug: c.linkedin?.split('/in/')?.[1] || '',
        gatekeeper_tip: null as string | null, // patched onto primary DM below
      }
    })

    // Patch gatekeeper tip onto the primary DM in the chain
    if (mergedDMChain.length > 0 && gatekeeperTipResult) {
      mergedDMChain[0].gatekeeper_tip = gatekeeperTipResult
    }

    const bestContact = earlyBestContact

    const fallback = (rawData.extracted_contacts || [])[0] || {}

    // Extract contract expiry year for intel DB
    const contractExpiryYear = (() => {
      for (const a of cleanBulkAgreements) {
        const m = (a.expiry_estimate ?? '').match(/20\d{2}/)
        if (m) return parseInt(m[0], 10)
      }
      return null
    })()

    const scoutQueue = {
      property: {
        name: property_name, address, city, state,
        units: p1.confirmed_units, class: rawData.property_class || null,
        year_built: p1.confirmed_year_built || null,
        management_company: mgmt, owner_entity: finalOwner, old_name: null,
      },
      market_context: {
        property_class: rawData.property_class || null,
        year_built: p1.confirmed_year_built || null,
        tech_generation: p3Final.proptech.tech_generation,
        replacement_window: normStr(rawData.proptech?.replacement_window) || null,
        acquisition_year: normStr(p2Final.acquisition_year) || null,
        owner_type: normStr(p2Final.owner_type) || null,
        sara_signals: rawData.proptech?.sara_signals ?? false,
        buying_trends: normStr(rawData.buying_trends) || null,
      },
      pain_angles: p3Final.pain_signals.slice(0, 8).map(s => ({ type: s.type, quote: s.quote, severity: s.severity })),
      connectivity: {
        isp_providers: cleanIspProviders,
        video_providers: cleanVideoProviders,
        bulk_detected: p2Final.bulk_detected,
        provider_confirmed: cleanIspProviders.length > 0,
        bulk_agreements: cleanBulkAgreements,
        roe_detected: p2Final.roe_detected,
        roe_providers: p2Final.roe_providers,
        roe_expiry_year: p2Final.roe_expiry_year,
        contract_urgency: (p2Final.roe_detected || p2Final.bulk_detected) ? 'high' : 'medium',
        contract_window: p2Final.roe_expiry_year
          ? `ROE expires ${p2Final.roe_expiry_year}`
          : normStr((cleanBulkAgreements[0] as any)?.expiry_estimate) || null,
      },
      proptech: {
        gate_operators: p3Final.proptech.gate_operators,
        access_control: p3Final.proptech.access_control,
        intercoms: p3Final.proptech.intercoms,
        cameras: p3Final.proptech.cameras,
        smart_locks: p3Final.proptech.smart_locks,
        tech_generation: p3Final.proptech.tech_generation,
        displacement_targets: normStrArr(rawData.proptech?.displacement_targets),
        sara_signals: rawData.proptech?.sara_signals ?? false,
      },
      contact_chain: mergedDMChain.slice(0, 5),
      email_format: p3Final.email_format,
      behavioral_profile: rawData.behavioral_profile ?? null,
      pitch_strategy: rawData.pitch_strategy ?? null,
      key_finding: normStr(rawData.key_finding) ?? null,
      objection_flags: [
        ...(p2Final.bulk_detected && cleanIspProviders.length > 0 ? [`Existing bulk deal with ${cleanIspProviders[0]} — needs contract expiry`] : []),
        ...(p2Final.roe_detected && !p2Final.roe_expiry_year ? ['ROE detected — expiry date unknown, verify with property'] : []),
        ...(p2Final.roe_expiry_year ? [`ROE expires ${p2Final.roe_expiry_year} — contract window opens soon`] : []),
        ...(p2Final.acquisition_year && parseInt(p2Final.acquisition_year) >= new Date().getFullYear() - 1 ? ['Recent acquisition — capex window open'] : []),
      ],
      outreach_plan: outreachPlan,
      outreach_sequence: ['email_1', 'call_1', 'linkedin_touch', 'email_2', 'call_2', 'email_3'],
    }

    const prospectPayload = {
      property: {
        name: property_name,
        address: normStr(address) || property_name,
        city: city || null,
        state: state || null,
        units: normInt(p1.confirmed_units ?? rawData.property_details?.units ?? rawData.units),
        property_type: normStr(rawData.property_details?.property_type) ?? 'multifamily',
        class: normStr(rawData.property_details?.class ?? rawData.property_class),
        year_built: normInt(p1.confirmed_year_built ?? rawData.property_details?.year_built ?? rawData.year_built),
        occupancy: normStr(rawData.property_details?.occupancy),
        management_company: normStr(mgmt ?? rawData.property_details?.management_company) || normStr(finalOwner ?? rawData.ownership?.owner_entity) || null,
        owner_entity: normStr(finalOwner || rawData.ownership?.owner_entity),
        old_name: null,
        phone: normStr(p1.confirmed_phone) ?? normStr(rawData.property_phone) ?? null,
        website: normStr(website),
        isp_providers: cleanIspProviders,
        video_providers: cleanVideoProviders,
        bulk_agreements: cleanBulkAgreements,
        roe_detected: p2Final.roe_detected,
        roe_providers: p2Final.roe_providers,
        roe_expiry_year: p2Final.roe_expiry_year,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        _fcc_verified: p2Final.fcc_providers.length > 0,
        _fcc_providers: p2Final.fcc_providers,
        proptech: {
          gate_operators: normStrArr(p3Final.proptech.gate_operators.length ? p3Final.proptech.gate_operators : rawData.proptech?.gate_operators),
          access_control: normStrArr(p3Final.proptech.access_control.length ? p3Final.proptech.access_control : rawData.proptech?.access_control),
          intercoms: normStrArr(p3Final.proptech.intercoms.length ? p3Final.proptech.intercoms : rawData.proptech?.intercoms),
          cameras: normStrArr(p3Final.proptech.cameras.length ? p3Final.proptech.cameras : rawData.proptech?.cameras),
          smart_locks: normStrArr(p3Final.proptech.smart_locks.length ? p3Final.proptech.smart_locks : rawData.proptech?.smart_locks),
          resident_apps: normStrArr(p3Final.proptech.resident_apps.length ? p3Final.proptech.resident_apps : rawData.proptech?.resident_apps),
          package_solutions: normStrArr(p3Final.proptech.package_solutions.length ? p3Final.proptech.package_solutions : rawData.proptech?.package_solutions),
          tech_generation: normStr(p3Final.proptech.tech_generation ?? rawData.proptech?.tech_generation) ?? 'legacy',
          sara_signals: rawData.proptech?.sara_signals ?? false,
          replacement_window: normStr(rawData.proptech?.replacement_window),
          displacement_targets: normStrArr(rawData.proptech?.displacement_targets),
        },
        inferred_proptech: rawData.inferred_proptech ?? [],
      },
      decision_maker: {
        name: normStr(bestContact?.name || fallback.name) ?? null,
        title: normStr(bestContact?.title || fallback.title) ?? null,
        company: normStr(bestContact?.company || fallback.company) ?? mgmt ?? '',
        email: normStr(bestContact?.email || fallback.email) ?? '',
        // Phone hierarchy: Apollo direct line → leasing office (labelled) → empty
        phone: normStr(bestContact?.phone) ?? (officePhone ?? ''),
        phone_source: (normStr(bestContact?.phone) ? 'direct' : (officePhone ? 'office_main' : null)) as 'direct' | 'office_main' | null,
        gatekeeper_tip: gatekeeperTipResult ?? null,
        tenure_years: 0,
        top_email_format: p3Final.email_format || '',
        linkedin_slug: normStr(bestContact?.linkedin?.split('/in/')?.[1] || fallback.linkedin_slug) ?? '',
      },
      decision_maker_chain: mergedDMChain.length > 0 ? mergedDMChain
        : (rawData.extracted_contacts || []).filter((c: any) => normStr(c.name)).map((c: any) => {
            const directPhone = normStr(c.phone)
            return {
              name: normStr(c.name) ?? '', title: normStr(c.title) ?? '', company: normStr(c.company) ?? '',
              role_type: 'unknown', email: normStr(c.email) ?? '', top_email_format: '',
              phone: directPhone ?? (officePhone ?? ''),
              phone_source: (directPhone ? 'direct' : (officePhone ? 'office_main' : null)) as 'direct' | 'office_main' | null,
              gatekeeper_tip: null as string | null,
              linkedin_slug: normStr(c.linkedin_slug) ?? '',
            }
          }),
      ownership: {
        owner_entity: normStr(finalOwner || rawData.ownership?.owner_entity),
        owner_type: normStr(p2Final.owner_type || rawData.ownership?.owner_type),
        portfolio_size: normStr(rawData.ownership?.portfolio_size),
        acquisition_year: normStr(p2Final.acquisition_year || rawData.ownership?.acquisition_year),
        sale_price: null,
        capex_signal: normStr(rawData.ownership?.capex_signal),
      },
      pain_signals: p3Final.pain_signals.length > 0 ? p3Final.pain_signals : (rawData.pain_signals ?? []),
      profile: {
        buy_score: rawData.freshness_score ? Math.round(rawData.freshness_score * 1.0 + 0) : 5,
        urgency: p3Final.pain_signals.filter(s => s.type === 'gate').length > 2 || p2Final.bulk_detected ? 'high' : 'medium',
        primary_concern: normStr(rawData.key_finding?.slice(0, 300)) ?? 'No critical vulnerabilities detected',
        current_vendor: normStr((cleanBulkAgreements[0] as any)?.provider ?? cleanIspProviders[0] ?? p2Final.roe_providers[0]),
        contract_window: p2Final.roe_expiry_year
          ? `ROE expires ${p2Final.roe_expiry_year}`
          : normStr((cleanBulkAgreements[0] as any)?.expiry_estimate),
        communication_style: normStr(rawData.behavioral_profile?.communication_pref) ?? 'Email',
      },
      behavioral_profile: rawData.behavioral_profile ?? null,
      pitch_strategy: rawData.pitch_strategy ?? null,
      freshness_score: rawData.freshness_score ?? 5,
      buying_trends: normStr(rawData.buying_trends),
      scout_brief: {
        primary_contact: normStr(bestContact?.name) ?? mgmt ?? property_name,
        outreach_angle: p2Final.bulk_detected ? 'contract_window' : 'tech_displacement',
        contract_window_urgency: p2Final.bulk_detected ? 'high' : 'medium',
        key_data_points: rawData.key_finding ? [rawData.key_finding] : [],
      },
      scout_queue: scoutQueue,
    }

    // ── Save to aria_searches ─────────────────────────────────────────────────
    let savedSearchId: string | undefined
    try {
      const portalUser = await getCurrentUser()
      const originalQuery = raw.property_name || raw.query || rawQuery
      const { data: searchRow } = await supabaseDeep.from('aria_searches').insert({
        query: originalQuery,
        query_interpretation: `ARIA ${ARIA_ENGINE_VERSION} — ${property_name}`,
        results: { mode: 'deep', engine_version: ARIA_ENGINE_VERSION, prospects: [prospectPayload], fccVerified: p2Final.fcc_providers.length > 0, webIntelligence: true },
        search_type: 'deep', user_id: userId,
        user_name: portalUser.name, user_email: portalUser.email,
        org_id: portalUser.org_id ?? null,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }).select('id').single()
      if (searchRow?.id) savedSearchId = searchRow.id

      // v8: Complete the search run record with full stats + org_id
      if (searchRunId) {
        void completeSearchRun(searchRunId, 'complete', {
          candidate_count: 1,
          quality_gates_passed: qualityGates,
          duration_ms: Date.now() - runStart,
        })
        void supabaseDeep
          .from('aria_search_runs')
          .update({ org_id: portalUser.org_id ?? null })
          .eq('id', searchRunId)
      }
    } catch { }

    // ── Persist detections (non-blocking) ─────────────────────────────────────
    void (async () => {
      try {
        const { data: allProviders } = await supabaseDeep.from('mdu_providers').select('id, name').eq('active', true)
        if (!allProviders) return
        const rows = cleanBulkAgreements
          .filter((a: any) => ['high', 'confirmed', 'medium'].includes(a.confidence ?? ''))
          .map((a: any) => {
            const provName = (a.provider ?? '').toLowerCase()
            const matched = (allProviders as any[]).find(p => p.name.toLowerCase().includes(provName) || provName.includes(p.name.toLowerCase()))
            if (!matched) return null
            const yearMatch = (a.expiry_estimate ?? '').match(/20\d{2}/)
            return {
              provider_id: matched.id,
              property_name: property_name || null,
              property_address: address || null,
              confidence: a.confidence === 'high' ? 'high' : 'medium',
              source_type: 'aria',
              source_snippet: (a.evidence as string)?.slice(0, 250) ?? null,
              contract_end_year: yearMatch ? parseInt(yearMatch[0], 10) : null,
              verified_by: 'aria',
            }
          }).filter(Boolean)
        if (rows.length > 0) await supabaseDeep.from('mdu_provider_detections').upsert(rows, { onConflict: 'provider_id,property_name', ignoreDuplicates: false })
      } catch { }
    })()

    // ── Persist to Intel DB (non-blocking) ────────────────────────────────────
    // NOTE: Use the same baseUrl pattern as Inngest — NEXT_PUBLIC_APP_URL first,
    // then VERCEL_URL (deployment URL), then localhost. NEXT_PUBLIC_APP_URL alone
    // was falling back to localhost:3000 in production when the env var wasn't set.
    void (async () => {
      try {
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
        const upsertRes = await fetch(`${baseUrl}/api/aria/properties`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-service-key': process.env.ARIA_SERVICE_KEY ?? '',
          },
          body: JSON.stringify({ prospects: [prospectPayload] }),
        })
        if (!upsertRes.ok) {
          const errText = await upsertRes.text().catch(() => '')
          console.error(`[aria/deep] Intel DB upsert failed ${upsertRes.status}: ${errText.slice(0, 200)}`)
        }
      } catch (e) {
        console.error('[aria/deep] Intel DB upsert threw:', e instanceof Error ? e.message : e)
      }
    })()

    // Suppress unused warning for contractExpiryYear (used in non-blocking write)
    void contractExpiryYear

    return NextResponse.json({
      type: 'property',
      mode: 'deep',
      engine_version: ARIA_ENGINE_VERSION,
      query_interpretation: `ARIA ${ARIA_ENGINE_VERSION} — ${property_name}`,
      prospects: [prospectPayload],
      savedSearchId,
      search_run_id: searchRunId,
      quality_gates: qualityGates,
      // v8 Ticket 5: PropTech Scout findings with confidence scores + source URLs
      proptech_findings: p3Final.proptech_findings,
      sources: p3Final.raw_excerpts.filter(r => r.url && r.score > 0.3).slice(0, 8).map(r => ({
        title: r.title, url: r.url, excerpt: r.content.slice(0, 200), score: r.score, type: r.source ?? 'web',
      })),
      intelligence_sources: {
        fcc: p2Final.fcc_providers.length > 0,
        resident_reviews: p3Final.raw_excerpts.length > 0,
        apollo: p3Final.contacts.length > 0,
        ninjapear_verified: p3Final.contacts.some(c => c.verified),
        serper_active: !!process.env.SERPER_API_KEY,
      },
      fccVerified: p2Final.fcc_providers.length > 0,
      webIntelligence: true,
    })

  } catch (err: any) {
    console.error('[aria/research/deep]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
