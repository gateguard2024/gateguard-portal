/**
 * POST /api/aria/research/base — the INITIAL FIND. Deliberately cheap and shallow.
 *
 * This answers one question: "what properties match, and which systems do they
 * appear to have?" It does NOT run the deep engine (no Sonnet, no Apollo, no
 * FCC, no contact chain). Deep research is a separate, explicit, on-demand step.
 *
 * Body:  { query: string }
 * Reply: {
 *   type: 'single' | 'multi',
 *   query_interpretation: string,
 *   properties: [{
 *     name, address, city, state, units, lat, lng, website, management_company,
 *     systems: { internet, video, bulk, gates, cameras, smart_lockers, smart_rent },
 *     already_saved: boolean, saved_id: string | null
 *   }]
 * }
 *
 * Every system flag is a presence signal only ("does this exist?"), never a brand.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const HAIKU = 'claude-haiku-4-5-20251001'

export interface BaseSystems {
  internet: boolean
  video: boolean
  bulk: boolean
  gates: boolean
  cameras: boolean
  smart_lockers: boolean
  smart_rent: boolean
  ev_chargers: boolean
}

export interface BaseProperty {
  name: string
  name_aliases?: string[]     // every other name this community trades under
  address: string
  city: string
  state: string
  units: number | null
  lat?: number | null
  lng?: number | null
  phone?: string | null       // the property's OWN line — never an 800 tracking number
  website?: string | null
  management_company?: string | null
  photo_url?: string | null   // the community's own hero shot (og:image)
  systems: BaseSystems
  already_saved?: boolean
  saved_id?: string | null
}

const EMPTY_SYSTEMS: BaseSystems = {
  internet: false, video: false, bulk: false, gates: false,
  cameras: false, smart_lockers: false, smart_rent: false, ev_chargers: false,
}

// ─── Serper (Google) — one helper, snippets only, no raw page reads ───────────
interface Snip { title: string; url: string; content: string }

async function serper(query: string, num = 8): Promise<Snip[]> {
  if (!process.env.SERPER_API_KEY) return []
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num }),
      signal: AbortSignal.timeout(7000),
    })
    if (!res.ok) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = await res.json()
    const out: Snip[] = []
    const kg = d.knowledgeGraph
    if (kg) {
      const addr = kg.attributes?.Address || kg.address || ''
      out.push({
        title: `[KG] ${kg.title ?? ''}`,
        url: kg.website ?? '',
        content: [addr && `Address: ${addr}`, kg.description].filter(Boolean).join(' | '),
      })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (d.organic ?? []).slice(0, num)) {
      out.push({ title: r.title ?? '', url: r.link ?? '', content: (r.snippet ?? '').slice(0, 300) })
    }
    return out
  } catch { return [] }
}

// ─── Hero image ──────────────────────────────────────────────────────────────
// Pull the property's own og:image off its website. This is the real photo of
// the community — not a satellite tile. We're already resolving the website, so
// this costs one cheap HEADless GET and nothing else.
async function heroImage(url: string): Promise<string | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4500),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GateGuardBot/1.0)' },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const html = (await res.text()).slice(0, 250_000)
    const pats = [
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
    ]
    let src: string | null = null
    for (const p of pats) { const m = html.match(p); if (m?.[1]) { src = m[1]; break } }
    if (!src) return null
    src = src.trim().replace(/&amp;/g, '&')
    if (src.startsWith('//')) src = 'https:' + src
    else if (src.startsWith('/')) src = new URL(url).origin + src
    return /^https?:\/\//i.test(src) ? src : null
  } catch { return null }
}

// ─── Phone hygiene ───────────────────────────────────────────────────────────
// Listing aggregators (apartments.com, rentdeals, forrent…) inject their own
// toll-free lead-capture numbers into every snippet — e.g. "(800) 644-5012".
// Those route to THEIR call centre, not the property. Returning one as the site
// phone is worse than returning nothing: a rep dials it in good faith.
const TOLLFREE = /^(800|833|844|855|866|877|888)$/
function cleanPhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const digits = raw.replace(/\D/g, '')
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (ten.length !== 10) return null
  if (TOLLFREE.test(ten.slice(0, 3))) return null       // aggregator tracking line
  if (/^(\d)\1{9}$/.test(ten)) return null              // 0000000000 etc.
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`
}

// ─── Unit-count verification ─────────────────────────────────────────────────
// A prompt saying "never add" is a request. This is the guarantee.
//
// The unit count must appear VERBATIM in the source text. If the model summed
// floor plans (60+60+104 = 224-ish) or added availability counts, the total it
// invented will NOT appear in the snippets — so we reject it and return null.
// A null unit count is honest; a computed one is a number a rep will quote to a
// property manager who knows their own building.
function unitsAppearVerbatim(units: number, sourceText: string): boolean {
  if (!Number.isFinite(units) || units <= 0) return false
  const n = Math.round(units)
  // Match the number as a standalone token: "224 units", "224-unit", "(224)".
  // Allow the thousands-separated form too ("1,200 units").
  const withCommas = n.toLocaleString('en-US')
  const variants = n >= 1000 ? [String(n), withCommas] : [String(n)]
  return variants.some(v => {
    const esc = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^\\d.,])${esc}([^\\d.,]|$)`).test(sourceText)
  })
}

// ─── Is this one named property, or an area/cluster hunt? ────────────────────
// Cheap heuristic first — no model call for the obvious cases.
function looksLikeArea(q: string): boolean {
  const ql = q.toLowerCase()
  // Location prepositions ("in/near/around Salt Lake City").
  if (/\b(in|near|around|within|throughout|across)\b/.test(ql)) return true
  // A unit/door count ("over 250 units", "300+ doors").
  if (/\d{2,}\s*\+?\s*(unit|units|doors)/.test(ql)) return true
  // Generic collective nouns anywhere — a rep hunting a SET, not one named
  // property. (Left out "apartments" on purpose: single properties are often
  // literally named "<Name> Apartments" and must stay on the single path.)
  if (/\b(properties|complexes|communities|listings|multifamily|buildings|mdus?)\b/.test(ql)) return true
  // Problem/criteria hunts ("... with gate issues", "broken gates", "old cameras").
  if (/\b(issues?|problems?|complaints?|broken|outdated|failing)\b/.test(ql)) return true
  return false
}

// ─── AREA / CRITERIA SEARCH ───────────────────────────────────────────────────
// A rep hunts by PROBLEM ("gate issues in SLC over 250 units"), not by name. The
// old area path stuffed that whole sentence into Google and swept only listing
// sites — so it found noise and returned nothing. This path instead: (1) parses
// the sentence into structured filters, (2) runs clean discovery for the big
// communities, (3) sweeps resident REVIEWS for the pain signal, (4) filters by
// unit count and ranks pain-first.

// Pain keyword → review-search expression. This is the signal listings don't carry.
const PAIN_EXPR: Record<string, string> = {
  gate: '"gate" (broken OR "always open" OR "won\'t close" OR "not working" OR "left open" OR tailgating)',
  security: '(security OR "not safe" OR "break-in" OR "car break-in" OR stolen OR crime)',
  camera: '(cameras OR CCTV OR surveillance) (broken OR "not working" OR "don\'t work")',
  access: '("access control" OR keypad OR callbox OR intercom OR "key fob") (broken OR "not working")',
}
function painToExpr(pains: string[]): string {
  const parts = pains.map(p => {
    if (/gate/.test(p)) return PAIN_EXPR.gate
    if (/secur|crime|break|steal|stolen|theft|safe/.test(p)) return PAIN_EXPR.security
    if (/camera|cctv|surveil/.test(p)) return PAIN_EXPR.camera
    if (/access|callbox|intercom|keypad|fob|entry/.test(p)) return PAIN_EXPR.access
    return `"${p}"`
  })
  return Array.from(new Set(parts)).join(' OR ')
}

interface AreaFilters { location: string; state: string; min_units: number | null; max_units: number | null; pains: string[] }

async function parseAreaQuery(anthropic: Anthropic, query: string): Promise<AreaFilters> {
  const fallback: AreaFilters = { location: '', state: '', min_units: null, max_units: null, pains: [] }
  try {
    const msg = await anthropic.messages.create({
      model: HAIKU, max_tokens: 400,
      messages: [{ role: 'user', content:
`Parse this multifamily prospecting query into search filters. Query: "${query}"
Return ONLY JSON, no prose:
{"location":"","state":"","min_units":null,"max_units":null,"pains":[]}
- location: city/metro name only (e.g. "Salt Lake City"). "" if none.
- state: 2-letter (e.g. "UT"). "" if none.
- min_units: number from "over 250 units","250+ units","at least 300 units","250 doors". null if none.
- max_units: number from "under 400 units". null if none.
- pains: short problem/system keywords the rep is hunting (e.g. "gate issues" -> ["gate"]; "no cameras and old gates" -> ["camera","gate"]). [] if the query names no problem.` }],
    })
    const t = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    const m = t.match(/\{[\s\S]*\}/); if (!m) return fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p: any = JSON.parse(m[0])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toU = (v: any) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : null }
    return {
      location: String(p.location || '').trim(),
      state: String(p.state || '').trim(),
      min_units: toU(p.min_units),
      max_units: toU(p.max_units),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pains: Array.isArray(p.pains) ? p.pains.filter((x: any) => typeof x === 'string' && x.trim()).map((x: string) => x.toLowerCase().trim()).slice(0, 4) : [],
    }
  } catch { return fallback }
}

type AreaProperty = BaseProperty & { pain_signal?: boolean; pain_note?: string | null; lead_score?: number }

// ─── Lead score (first-find ranking) ──────────────────────────────────────────
// 0–100 from the signals the cheap base pass reliably has: buy intent (pain),
// opportunity size (units), and a rough pro-tech fit (something to displace).
// Contractability + team-contractability need deep research, so they're not in
// this first-find score — they fill in once a property is deep-researched.
function baseLeadScore(p: AreaProperty): number {
  let s = 0
  if (p.pain_signal) s += 40                                   // Buy: an actual complaint about the system we sell
  const u = p.units ?? 0
  s += Math.min(u / 1000, 1) * 30                              // Opportunity: size (caps at 1000+ units)
  const sys = p.systems ?? EMPTY_SYSTEMS
  if (sys.gates || sys.cameras) s += 15                        // Pro-tech fit: gate/camera to integrate or displace
  if (sys.bulk) s += 5                                         // connectivity signal
  if (p.units != null) s += 10                                 // verified size (data completeness)
  return Math.round(Math.min(s, 100))
}

async function runAreaSearch(anthropic: Anthropic, query: string): Promise<NextResponse> {
  const f = await parseAreaQuery(anthropic, query)
  const loc = [f.location, f.state].filter(Boolean).join(' ').trim() || query
  const unitPhrase = f.min_units ? `${f.min_units}+ units ` : ''

  // 1) Discovery — the big communities in the area. Wide net across ranking lists,
  //    listing sites, new construction, and management portfolios so we surface 30+.
  const discovery = await Promise.all([
    serper(`largest apartment complexes ${loc} ${unitPhrase}`.trim(), 20),
    serper(`${loc} apartment communities ${unitPhrase}(site:apartments.com OR site:rentcafe.com OR site:loopnet.com OR site:yardimatrix.com)`, 20),
    serper(`biggest ${loc} apartment complexes list ${unitPhrase}`.trim(), 20),
    serper(`${loc} luxury AND affordable apartment communities ${unitPhrase}(site:zillow.com OR site:rent.com OR site:apartmentguide.com OR site:trulia.com)`, 20),
    serper(`new AND newest apartment developments ${loc} ${unitPhrase}`.trim(), 15),
    serper(`${loc} multifamily properties managed by (Greystar OR "Cushman" OR RPM OR Pinnacle OR "Asset Living" OR BH OR Willow)`, 15),
  ])

  // 2) Pain sweep — resident reviews reveal WHICH of them have the problem.
  let pain: Snip[][] = []
  if (f.pains.length) {
    const expr = painToExpr(f.pains)
    pain = await Promise.all([
      serper(`${loc} apartment ${expr} (site:apartmentratings.com OR site:reddit.com OR site:yelp.com)`, 20),
      serper(`${loc} apartment reviews ${expr}`, 15),
    ])
  }

  const all = [...discovery.flat(), ...pain.flat()]
  const snippets = all.map(s => `${s.title}\n${s.url}\n${s.content}`).join('\n---\n').slice(0, 34000)
  if (!snippets.trim()) {
    return NextResponse.json({ type: 'multi', properties: [], count: 0, query_interpretation: `No web results for ${loc}.`, filters: f })
  }

  const painLine = f.pains.length
    ? `The rep is hunting for properties with this PROBLEM: ${f.pains.join(', ')}. For each property set "pain_signal": true and a short "pain_note" ONLY when the snippets show real resident/review evidence of that problem AT THAT property (e.g. a review that the gate is broken or always open). No evidence -> pain_signal=false, pain_note="".`
    : 'No specific problem was requested; pain_signal=false and pain_note="" for all.'

  const prompt = `You are building a prospect list of US multifamily communities from web snippets. Return JSON only.

AREA / CRITERIA search${f.location ? ` in ${f.location}${f.state ? ', ' + f.state : ''}` : ''}${f.min_units ? `, target ${f.min_units}+ units` : ''}.
List up to 30 DISTINCT real apartment communities you can identify in the snippets. Prefer larger communities. Include every distinct real community you can find — do not stop early.

${painLine}

For each property return:
- name, address, city, state (2-letter)
- units: TOTAL unit count. *** COPY ONLY, NEVER CALCULATE, NEVER SUM. *** A number ONLY if it appears verbatim in the snippets as that property's total; else null.
- phone: property's own leasing line or "" (NEVER a toll-free 800/833/844/855/866/877/888 number).
- website, management_company: or ""
- systems: presence flags (internet, video, bulk, gates, cameras, smart_lockers, smart_rent, ev_chargers) — true only with real evidence.
- pain_signal: boolean, pain_note: short string (see above).

JSON shape:
{"query_interpretation":"one short line","properties":[{"name":"","address":"","city":"","state":"","units":null,"phone":"","website":"","management_company":"","systems":{"internet":false,"video":false,"bulk":false,"gates":false,"cameras":false,"smart_lockers":false,"smart_rent":false,"ev_chargers":false},"pain_signal":false,"pain_note":""}]}

SNIPPETS:
${snippets}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any = null
  try {
    const msg = await anthropic.messages.create({ model: HAIKU, max_tokens: 6000, messages: [{ role: 'user', content: prompt }] })
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    const m = text.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0])
  } catch (e) {
    console.error('[aria/base area] extraction failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Could not read the search results.' }, { status: 502 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawProps: any[] = Array.isArray(parsed?.properties) ? parsed.properties : []
  let properties: AreaProperty[] = rawProps
    .filter(p => (p?.name ?? '').trim().length > 1 || (p?.address ?? '').trim().length > 5)
    .map(p => {
      const u = typeof p.units === 'number' ? p.units : Number(p.units)
      const units = Number.isFinite(u) && u > 0 && unitsAppearVerbatim(u, snippets) ? Math.round(u) : null
      const systems = { ...EMPTY_SYSTEMS, ...(p.systems ?? {}) }
      // A confirmed gate pain implies a gate exists — light the gate signal so the
      // pin/filters read it, even if the amenity list didn't mention one.
      const gatePain = !!p.pain_signal && /gate/.test(`${p.pain_note ?? ''} ${f.pains.join(' ')}`)
      if (gatePain) systems.gates = true
      return {
        name: String(p.name ?? '').trim() || String(p.address ?? '').trim(),
        name_aliases: [],
        address: String(p.address ?? '').trim(),
        city: String(p.city ?? '').trim(),
        state: String(p.state ?? '').trim(),
        units,
        phone: cleanPhone(p.phone),
        website: p.website || null,
        management_company: p.management_company || null,
        systems,
        pain_signal: !!p.pain_signal,
        pain_note: (p.pain_note ?? '').toString().trim() || null,
      }
    })

  // Unit gate: drop only CONFIRMED-below-min. Null units stay (unverified),
  // ranked last — inventing a number to filter on would be worse than showing it.
  if (f.min_units != null) properties = properties.filter(p => p.units == null || p.units >= f.min_units!)
  if (f.max_units != null) properties = properties.filter(p => p.units == null || p.units <= f.max_units!)

  // Score every candidate, then rank by lead score (pain + size + fit).
  for (const p of properties) p.lead_score = baseLeadScore(p)
  properties.sort((a, b) => {
    const d = (b.lead_score ?? 0) - (a.lead_score ?? 0)
    return d !== 0 ? d : (b.units ?? 0) - (a.units ?? 0)
  })
  properties = properties.slice(0, 30)

  // Hero images — best-effort, parallel, never blocks.
  await Promise.all(properties.map(async p => { if (p.website) p.photo_url = await heroImage(p.website) }))

  // Which are already in the Intel DB? (drives the All / New / Saved chips)
  if (properties.length) {
    const { data: known } = await supabase
      .from('aria_properties').select('id, property_name')
      .or(properties.map(p => `property_name.ilike.%${p.name.replace(/[,()%]/g, '')}%`).join(','))
      .limit(200)
    for (const p of properties) {
      const hit = (known ?? []).find(k =>
        String(k.property_name ?? '').toLowerCase().trim() === p.name.toLowerCase().trim() ||
        String(k.property_name ?? '').toLowerCase().includes((p.name.toLowerCase().split(/\s+/)[0]) ?? '~'))
      p.already_saved = !!hit
      p.saved_id = hit?.id ?? null
    }
  }

  const interp = parsed?.query_interpretation
    || `${properties.length} communit${properties.length === 1 ? 'y' : 'ies'} in ${loc}${f.min_units ? `, ${f.min_units}+ units` : ''}${f.pains.length ? `, ${f.pains.join('/')} signal` : ''}`

  return NextResponse.json({ type: 'multi', query_interpretation: interp, properties, count: properties.length, filters: f, snippets_seen: all.length })
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user?.id || user.id === 'anonymous') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!process.env.SERPER_API_KEY) {
      return NextResponse.json({ error: 'Search is not configured (SERPER_API_KEY missing).' }, { status: 503 })
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI is not configured (ANTHROPIC_API_KEY missing).' }, { status: 503 })
    }

    const body = await req.json()
    const query: string = (body.query ?? '').trim()
    if (!query) return NextResponse.json({ error: 'A search is required.' }, { status: 400 })

    const isArea = looksLikeArea(query)
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Criteria/area hunt ("gate issues in SLC over 250 units") takes the dedicated
    // path: parse filters → discovery → review pain-sweep → unit filter → rank.
    if (isArea) return await runAreaSearch(anthropic, query)

    // Quote the NAME only — never the whole query. `"Aster Buckhead Atlanta GA"`
    // as one phrase matches nothing on the web, which is how a search for a real
    // property came back with unrelated "Buckhead Luxury Apartments" results.
    // Strip the trailing city/state so the name can be quoted on its own.
    const nameOnly = query
      .replace(/\b[A-Z]{2}\b\s*$/i, '')                 // trailing state
      .replace(/,\s*[^,]+\s*$/, '')                     // trailing ", City"
      .trim() || query
    const qName = `"${nameOnly}"`

    // Two cheap searches: identity/listing + amenities (where systems show up).
    const [identity, amenities] = await Promise.all([
      serper(
        isArea
          ? `${query} apartments site:apartments.com OR site:rentcafe.com OR site:loopnet.com`
          // yardimatrix/loopnet carry structured unit + year-built facts that the
          // consumer listing sites bury — they're the reason units go missing.
          : `${qName} apartments ${query} units "year built" address (site:yardimatrix.com OR site:loopnet.com OR site:apartments.com OR site:rentcafe.com OR site:apartmentlist.com OR site:zillow.com)`,
        isArea ? 10 : 8
      ),
      serper(
        isArea
          ? `${query} apartments amenities internet wifi cable gated "controlled access" cameras "package lockers" "EV charging"`
          : `${qName} ${query} amenities internet wifi cable TV gated "controlled access" intercom cameras "package lockers" SmartRent "EV charging" "electric vehicle"`,
        isArea ? 8 : 6
      ),
    ])

    const snippets = [...identity, ...amenities]
      .map(s => `${s.title}\n${s.url}\n${s.content}`)
      .join('\n---\n')
      .slice(0, 14000)

    if (!snippets.trim()) {
      return NextResponse.json({ type: isArea ? 'multi' : 'single', properties: [], query_interpretation: 'Nothing found on the web for that.' })
    }

    const wanted = isArea ? 10 : 1
    const prompt = `You are extracting BASE facts about US multifamily properties. Return JSON only.

Return AT MOST ${wanted} propert${wanted === 1 ? 'y' : 'ies'}.
${isArea
  ? 'This is an AREA search: list the distinct apartment communities you can identify.'
  : `This is a SINGLE PROPERTY search: return THE ONE property that best matches the query.

CRITICAL — you MUST return it if you can identify it at all:
- Apartment communities are REBRANDED constantly. The name in the query and the
  name on listing sites will often DIFFER for the SAME building (e.g. a property
  searched as "Aster Buckhead" may be listed as "LYV Buckhead" at the same
  address). This is expected, NOT a reason to reject the match.
- Match on ADDRESS + city first, name second. Same address = same property.
- If you can name the property or its address, you MUST return it in "properties".
  Returning an empty array while describing the property in query_interpretation
  is WRONG — if you identified it, hand it over.
- Only return an empty array when NOTHING in the snippets plausibly matches.
- Put the property's current/primary name in "name", and EVERY other name it
  appears under in "name_aliases" (this is how we find its reviews later).`}

For each property return:
- name: official community name (NOT the listing site name). If sources disagree
  (a site was renamed), prefer the name used by the property's OWN website and
  by data sources like yardimatrix/loopnet.
- address: full street address if found, else ""
- city, state: 2-letter state
- units: the property's TOTAL unit count, or null.
  *** NEVER CALCULATE. NEVER ADD. COPY ONLY. ***
  - Return a number ONLY if it appears VERBATIM in the snippets as that
    property's total, e.g. "the property features 224 units" -> 224.
  - Do NOT sum floor-plan counts ("One Bedroom, Two Bedroom/Two Bath…").
  - Do NOT sum or use availability counts ("20 Units Available", "3 Beds
    Available") — that is how many are listed for rent TODAY, not the total.
  - Do NOT add numbers from different sources together.
  - Do NOT combine buildings/phases into one total.
  - If two sources state DIFFERENT totals, prefer the data source
    (yardimatrix, loopnet) and use THAT number as-is. Never average them.
  - If no source plainly states a total, return null. null is CORRECT and
    expected — a wrong number is far worse than no number.
- phone: the property's OWN leasing office number, or "".
  NEVER return a toll-free aggregator/tracking number (800/833/844/855/866/877/888).
  Listing sites inject those to route calls to themselves — they are not the
  property. If the only number you can see is toll-free, return "".
- website: official property URL (never apartments.com/zillow/rentdeals), or ""
- management_company: or ""
- systems: presence flags. TRUE only if the text gives real evidence. Never guess:
    internet      -> an ISP / wifi / "high-speed internet" is offered or mentioned
    video         -> cable / TV / streaming service mentioned
    bulk          -> a bulk / included / "internet included in rent" arrangement
    gates         -> gated community / gated entry / controlled access / call box / intercom
    cameras       -> security cameras / CCTV / video surveillance
    smart_lockers -> package lockers / Amazon Hub / parcel room / package concierge
    smart_rent    -> SmartRent / smart home / smart apartment / keyless / smart lock
    ev_chargers   -> EV charging / electric vehicle charging / ChargePoint / Tesla charger

Rules:
- Use ONLY the snippets. If a system isn't evidenced, it is false.
- units must be a number or null — never a guess, never a range.

JSON shape:
{"query_interpretation":"one short line on what you searched for","properties":[{"name":"","name_aliases":[],"address":"","city":"","state":"","units":null,"phone":"","website":"","management_company":"","systems":{"internet":false,"video":false,"bulk":false,"gates":false,"cameras":false,"smart_lockers":false,"smart_rent":false,"ev_chargers":false}}]}

SNIPPETS:
${snippets}`

    let parsed: { query_interpretation?: string; properties?: BaseProperty[] } | null = null
    try {
      const msg = await anthropic.messages.create({
        model: HAIKU,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
      const m = text.match(/\{[\s\S]*\}/)
      if (m) parsed = JSON.parse(m[0])
    } catch (e) {
      console.error('[aria/base] extraction failed:', e instanceof Error ? e.message : e)
      return NextResponse.json({ error: 'Could not read the search results.' }, { status: 502 })
    }

    const raw = Array.isArray(parsed?.properties) ? parsed!.properties! : []
    const properties: BaseProperty[] = raw
      // Keep anything we can identify by EITHER name or address. Requiring a name
      // silently dropped real matches on rebranded properties.
      .filter(p => (p?.name ?? '').trim().length > 1 || (p?.address ?? '').trim().length > 5)
      .slice(0, wanted)
      .map(p => ({
        name: String(p.name ?? '').trim() || String(p.address ?? '').trim(),
        name_aliases: Array.isArray(p.name_aliases)
          ? p.name_aliases.filter((a: unknown) => typeof a === 'string' && a.trim()).slice(0, 4)
          : [],
        address: String(p.address ?? '').trim(),
        city: String(p.city ?? '').trim(),
        state: String(p.state ?? '').trim(),
        // Only accept a unit count that literally appears in the source text.
        // If the model summed floor plans or availability counts, its total
        // won't be in the snippets — so we drop it. "No data" beats a number a
        // rep would quote to a manager who knows their own building.
        units: (() => {
          const u = typeof p.units === 'number' ? p.units : Number(p.units)
          if (!Number.isFinite(u) || u <= 0) return null
          if (!unitsAppearVerbatim(u, snippets)) {
            console.warn(`[aria/base] rejected unit count ${u} for "${p.name}" — not stated verbatim in sources (likely calculated)`)
            return null
          }
          return Math.round(u)
        })(),
        // Enforce the toll-free rule in CODE, not just in the prompt. A model
        // instruction is a request; this is a guarantee. Handing a rep an
        // aggregator's lead-capture line is worse than handing them nothing.
        phone: cleanPhone(p.phone),
        website: p.website || null,
        management_company: p.management_company || null,
        systems: { ...EMPTY_SYSTEMS, ...(p.systems ?? {}) },
      }))

    // Hero images — all in parallel, best-effort, never blocks the result.
    await Promise.all(properties.map(async p => {
      if (p.website) p.photo_url = await heroImage(p.website)
    }))

    // Which of these do we already have? Drives the All / New / Already-searched chips.
    if (properties.length) {
      const { data: known } = await supabase
        .from('aria_properties')
        .select('id, property_name')
        .or(properties.map(p => `property_name.ilike.%${p.name.replace(/[,()]/g, '')}%`).join(','))
        .limit(200)
      for (const p of properties) {
        const hit = (known ?? []).find(k =>
          String(k.property_name ?? '').toLowerCase().trim() === p.name.toLowerCase().trim() ||
          String(k.property_name ?? '').toLowerCase().includes(p.name.toLowerCase().split(/\s+/)[0] ?? '~')
        )
        p.already_saved = !!hit
        p.saved_id = hit?.id ?? null
      }
    }

    // If the model described a property in query_interpretation but handed back
    // nothing, that is an extraction failure — NOT "this property doesn't exist".
    // Say so plainly instead of rendering an innocent empty state.
    const describedButEmpty =
      properties.length === 0 &&
      /\b(propert|apartment|multifamily|units|at\s+\d)/i.test(parsed?.query_interpretation ?? '')
    if (describedButEmpty) {
      console.error(`[aria/base] extraction returned 0 properties but described one: "${parsed?.query_interpretation}"`)
    }

    return NextResponse.json({
      type: isArea ? 'multi' : 'single',
      query_interpretation: parsed?.query_interpretation ?? query,
      properties,
      count: properties.length,
      ...(describedButEmpty
        ? { warning: 'We found this property in the search results but could not read it cleanly. Try the full name (e.g. "The Aster Buckhead Atlanta").' }
        : {}),
      // How much raw material we had — distinguishes "the web has nothing" from
      // "we had plenty and failed to read it".
      snippets_seen: identity.length + amenities.length,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Base search failed'
    console.error('[aria/base]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
