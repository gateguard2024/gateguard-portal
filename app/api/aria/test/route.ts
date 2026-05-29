/**
 * POST /api/aria/test
 *
 * ARIA Engine Diagnostic — runs raw search calls for each step and returns
 * the actual API responses BEFORE any Haiku extraction or normalization.
 * Use this to audit what each data source actually returns for a property,
 * then make targeted engine fixes based on ground truth.
 *
 * Usage (from browser console or Postman while logged in):
 *   POST /api/aria/test
 *   { "query": "Northland Wharf 7", "steps": ["all"] }
 *
 *   or specific steps:
 *   { "query": "Northland Wharf 7", "steps": ["s0","s1","s4","s6"] }
 *
 * Returns: { step_name: { queries: [...], raw_results: [...], summary: "..." } }
 * Protected: Clerk auth required (admin/corporate only in practice)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// ─── Raw search helpers (no processing — return exactly what the API returns) ─

async function rawTavily(query: string, maxResults = 5, depth = 'basic', rawContent = false) {
  if (!process.env.TAVILY_API_KEY) return { error: 'TAVILY_API_KEY not set', results: [] }
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.TAVILY_API_KEY}` },
      body: JSON.stringify({ query, search_depth: depth, max_results: maxResults, include_answer: false, include_raw_content: rawContent, include_images: false }),
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()
    return { ok: res.ok, status: res.status, result_count: data.results?.length ?? 0, results: (data.results ?? []).map((r: any) => ({ title: r.title, url: r.url, snippet: r.content?.slice(0, 300), score: r.score })) }
  } catch (e: any) { return { error: e.message, results: [] } }
}

async function rawSerper(query: string, maxResults = 5, type: 'search' | 'news' = 'search') {
  if (!process.env.SERPER_API_KEY) return { error: 'SERPER_API_KEY not set', results: [] }
  try {
    const endpoint = type === 'news' ? 'https://google.serper.dev/news' : 'https://google.serper.dev/search'
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': process.env.SERPER_API_KEY },
      body: JSON.stringify({ q: query, num: maxResults, gl: 'us', hl: 'en' }),
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json()
    const items = type === 'news' ? (data.news ?? []) : (data.organic ?? [])
    return { ok: res.ok, status: res.status, result_count: items.length, results: items.slice(0, maxResults).map((r: any) => ({ title: r.title, url: r.link, snippet: r.snippet?.slice(0, 300), date: r.date })) }
  } catch (e: any) { return { error: e.message, results: [] } }
}

async function rawGeocode(address: string) {
  const q = encodeURIComponent(address)
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=3`, {
      headers: { 'User-Agent': 'GateGuard-ARIA-Test/1.0 (rfeldman@gateguard.co)' },
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    return { ok: res.ok, results: data.map((r: any) => ({ display_name: r.display_name, lat: r.lat, lon: r.lon, type: r.type })) }
  } catch (e: any) { return { error: e.message, results: [] } }
}

async function rawFCC(lat: number, lng: number) {
  try {
    // FCC Broadband Map API now requires POST with JSON body (GET returns 405)
    const res = await fetch(
      'https://broadbandmap.fcc.gov/api/public/map/listAvailability',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'GateGuard-ARIA-Test/1.0' },
        body: JSON.stringify({ latitude: parseFloat(lat.toFixed(6)), longitude: parseFloat(lng.toFixed(6)), unit: 'location', limit_to_isp: 'N' }),
        signal: AbortSignal.timeout(8000),
      }
    )
    const data = await res.json()
    const providers = data?.results ?? data?.availability ?? data?.data ?? []
    return {
      ok: res.ok, status: res.status,
      provider_count: providers.length,
      providers: providers.slice(0, 20).map((p: any) => ({ brand_name: p.brand_name, technology: p.technology, max_down: p.max_advertised_download_speed, max_up: p.max_advertised_upload_speed })),
      raw_keys: data ? Object.keys(data) : [],
    }
  } catch (e: any) { return { error: e.message } }
}

// Apollo People Enrichment — new endpoint /api/v1/people/match (name + domain)
// Old /mixed_people/search endpoint is deprecated and returns 403
async function rawApollo(name: string, domain: string) {
  if (!process.env.APOLLO_API_KEY) return { error: 'APOLLO_API_KEY not set', person: null }
  try {
    const res = await fetch('https://api.apollo.io/api/v1/people/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.APOLLO_API_KEY}` },
      body: JSON.stringify({ name, domain, reveal_personal_emails: true }),
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()
    const p = data?.person
    return {
      ok: res.ok, status: res.status,
      found: !!p,
      person: p ? {
        name: p.name, title: p.title,
        company: p.organization?.name,
        email: p.email || null,
        phone: p.phone_numbers?.[0] || null,
        linkedin: p.linkedin_url,
      } : null,
      raw_keys: data ? Object.keys(data) : [],
    }
  } catch (e: any) { return { error: e.message, person: null } }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { query, steps = ['all'] } = await req.json()
  if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })

  const runAll = steps.includes('all')
  const run = (key: string) => runAll || steps.includes(key)

  const report: Record<string, any> = { query, timestamp: new Date().toISOString(), steps_run: [] }

  // ── STEP 0: Bootstrap — what does the broad web + news find? ────────────────
  if (run('s0')) {
    report.steps_run.push('s0')
    const [web, news] = await Promise.all([
      rawSerper(`${query} apartments units address "year built" ownership management contact phone`, 7),
      rawSerper(`"${query}" apartments "units" completed OR opened OR acquired OR developed OR "apartment homes"`, 4, 'news'),
    ])
    report.s0 = {
      description: 'Bootstrap: broad Serper web + news press release search',
      question: 'Does Serper find units, year_built, owner, confirmed city/state?',
      web_search: { query: `${query} apartments units address "year built" ownership management contact phone`, ...web },
      news_search: { query: `"${query}" apartments units completed OR opened`, ...news },
      key_check: 'Look for: unit count, year built, "Northland" as owner, city+state, phone number',
    }
  }

  // ── STEP 1: Listing sites — do apartments.com / rentcafe have unit counts? ──
  if (run('s1')) {
    report.steps_run.push('s1')
    const [listing, broad] = await Promise.all([
      rawTavily(`"${query}" apartments site:apartments.com OR site:rentcafe.com OR site:zillow.com`, 4, 'advanced', true),
      rawTavily(`"${query}" apartments "unit" OR "units" "year built" OR "built" floor plans occupancy`, 3, 'advanced', true),
    ])
    report.s1 = {
      description: 'Identity: listing site searches for units + year built',
      question: 'Do listing sites have structured unit count and year built data?',
      listing_sites: { query: `"${query}" site:apartments.com OR rentcafe.com OR zillow.com`, ...listing },
      broad_search: { query: `"${query}" apartments unit year built`, ...broad },
      key_check: 'Look for: units field (should be 312), year built field (should be 2017)',
    }
  }

  // ── STEP 2: Geocode the known address — what coords does Nominatim return? ──
  if (run('s2geo')) {
    report.steps_run.push('s2geo')
    const knownAddress = '515 Robert Daniel Dr, Daniel Island, Charleston, SC 29492'
    const geo = await rawGeocode(knownAddress)
    report.s2geo = {
      description: 'Geocoding: Nominatim for Wharf 7 known address',
      question: 'Does Nominatim return correct lat/lng for Daniel Island, SC?',
      address_tested: knownAddress,
      expected: { lat: '32.86xx', lng: '-79.94xx', note: 'Daniel Island is east of downtown Charleston' },
      ...geo,
    }
    // Also test FCC with whatever coords we got
    if (geo.results?.[0]) {
      const { lat, lon } = geo.results[0]
      const fcc = await rawFCC(parseFloat(lat), parseFloat(lon))
      report.s2geo.fcc_at_geocoded_coords = { lat, lon, ...fcc, key_check: 'Is GIGstreem in the provider list? If not, FCC lookup is failing for Daniel Island.' }
    }
    // Also hard-test with known Daniel Island coords
    const fccKnown = await rawFCC(32.8634, -79.9368)
    report.s2geo.fcc_at_hardcoded_daniel_island = { lat: 32.8634, lng: -79.9368, ...fccKnown }
  }

  // ── STEP 4B: ISP confirmation — what does Tavily find for bulk internet? ────
  if (run('s4b')) {
    report.steps_run.push('s4b')
    const [mgmt, direct] = await Promise.all([
      rawSerper(`"Northland" OR "Greystar" "Wharf 7" Charleston internet provider bulk GIGstreem Hotwire Spectrum`, 5),
      rawTavily(`"Wharf 7" Charleston SC internet provider "bulk" OR "included" OR "GIGstreem" OR "Hotwire" OR "mandatory"`, 4, 'advanced'),
    ])
    report.s4b = {
      description: 'ISP confirmation: can we name the bulk internet provider?',
      question: 'Does Serper/Tavily confirm GIGstreem (or another MDU ISP) for Wharf 7?',
      serper_isp: { query: 'Northland/Greystar Wharf 7 Charleston internet bulk GIGstreem', ...mgmt },
      tavily_isp: { query: 'Wharf 7 Charleston bulk internet included GIGstreem', ...direct },
      key_check: 'Look for GIGstreem, Hotwire, Pavlov Media, or any MDU-only ISP name',
    }
  }

  // ── STEP 3: Pain signals — what do review sites actually say? ────────────────
  if (run('s3')) {
    report.steps_run.push('s3')
    const [reviews, reddit] = await Promise.all([
      rawTavily(`"Wharf 7" OR "Wharf 7 Apartments" Charleston SC reviews complaints 2024 2025`, 5, 'advanced'),
      rawSerper(`"Wharf 7" Charleston reviews complaints gate internet crime 2024 2025`, 6),
    ])
    report.s3 = {
      description: 'Pain signals: resident reviews and Reddit',
      question: 'What specific pain do residents report? What dates do sources have?',
      tavily_reviews: { query: 'Wharf 7 Charleston reviews 2024 2025', ...reviews },
      serper_reviews: { query: 'Wharf 7 Charleston reviews gate internet crime 2024 2025', ...reddit },
      key_check: 'Check: date stamps on reviews. Are they 2024? Are they being filtered out as "old"?',
    }
  }

  // ── STEP 6: Contacts — LinkedIn finds names, Apollo enriches them ──────────────
  if (run('s6')) {
    report.steps_run.push('s6')
    const [linkedinPM, linkedinRegional] = await Promise.all([
      rawSerper(`"Wharf 7" Charleston "community manager" OR "property manager" site:linkedin.com`, 5),
      rawSerper(`"Greystar" "Charleston" "regional manager" OR "regional director" site:linkedin.com`, 5),
    ])
    // Enrich the two most likely contacts by name + domain (new /people/match endpoint)
    const [apolloKathlina, apolloKristen] = await Promise.all([
      rawApollo('Kathlina Sampson', 'greystar.com'),
      rawApollo('Kristen Gomez', 'greystar.com'),
    ])
    report.s6 = {
      description: 'People: LinkedIn finds names, Apollo /people/match enriches with email+phone',
      question: 'Does /people/match return emails? Are phone numbers present?',
      apollo_kathlina_sampson: { name: 'Kathlina Sampson', domain: 'greystar.com', ...apolloKathlina },
      apollo_kristen_gomez: { name: 'Kristen Gomez', domain: 'greystar.com', ...apolloKristen },
      linkedin_pm: { query: 'Wharf 7 Charleston community manager linkedin', ...linkedinPM },
      linkedin_regional: { query: 'Greystar Charleston regional manager linkedin', ...linkedinRegional },
      key_check: 'Does /people/match return email + phone for confirmed names? Compare with old /mixed_people/search (was 403).',
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  report.summary = {
    api_keys_configured: {
      tavily: !!process.env.TAVILY_API_KEY,
      serper: !!process.env.SERPER_API_KEY,
      apollo: !!process.env.APOLLO_API_KEY,
      ninjapear: !!process.env.NINJAPEAR_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
    },
    instructions: 'Review each step\'s key_check field. The gap between what the raw API returns and what ARIA displays is exactly what needs fixing in the engine prompts.',
  }

  return NextResponse.json(report, { status: 200 })
}
