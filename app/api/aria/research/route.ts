/**
 * POST /api/aria/research
 *
 * ARIA — Lead Intelligence Engine
 * Returns property intel, decision maker, intent signals, psychographic profile,
 * and hyper-personalized email variants with predicted reply rates.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Tavily OSINT helper ───────────────────────────────────────────────────

interface TavilyResult { title: string; url: string; content: string; score: number; source?: string }

async function tavilySearch(query: string, maxResults = 4, source = 'web', days?: number): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY) return []
  try {
    const body: Record<string, unknown> = {
      query, search_depth: 'basic', max_results: maxResults,
      include_answer: false, include_raw_content: false, include_images: false,
    }
    if (days) body.days = days
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.TAVILY_API_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? []).map((r: TavilyResult) => ({ ...r, source }))
  } catch { return [] }
}

// ─── FCC / Geocoding helpers ───────────────────────────────────────────────

interface GeoResult { lat: number; lng: number; display: string }
interface FCCProvider { brand_name: string; holding_company: string; technology: number; max_download_speed: number; max_upload_speed: number }

async function geocodeLocation(location: string): Promise<GeoResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1&addressdetails=0&countrycodes=us`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'GateGuard-ARIA/1.0 (rfeldman@gateguard.co)' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name }
  } catch { return null }
}

async function fetchFCCBroadband(lat: number, lng: number): Promise<FCCProvider[]> {
  try {
    const url = new URL('https://broadbandmap.fcc.gov/api/public/map/listAvailability')
    url.searchParams.set('latitude', lat.toFixed(6))
    url.searchParams.set('longitude', lng.toFixed(6))
    url.searchParams.set('unit', '')
    url.searchParams.set('category', 'Residential')
    url.searchParams.set('addr', '')
    url.searchParams.set('city', '')
    url.searchParams.set('state', '')
    url.searchParams.set('zip', '')
    url.searchParams.set('speed', '25')
    url.searchParams.set('tech', '300')
    url.searchParams.set('limit', '25')
    url.searchParams.set('offset', '0')

    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json', 'User-Agent': 'GateGuard-ARIA/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const json = await res.json()
    const providers: FCCProvider[] = json?.data ?? []
    const seen = new Set<string>()
    return providers.filter(p => {
      if (p.technology === 60) return false
      if (seen.has(p.brand_name)) return false
      seen.add(p.brand_name)
      return true
    })
  } catch { return [] }
}

function extractLocationHint(query: string): string | null {
  const cityStateRe = /(?:in|at|near|around|,)?\s*([A-Za-z][a-zA-Z\s]+(?:,\s*[A-Z]{2}|,\s*[A-Za-z]+|\s+[A-Z]{2}))/i
  const m = query.match(cityStateRe)
  if (m) {
    const candidate = m[1].trim()
    if (candidate.length <= 40 && !/\b(at|the|of|by|and|for)\b/i.test(candidate.split(',')[0]?.trim() || '')) {
      return candidate
    }
  }
  const zipRe = /\b(\d{5}(?:-\d{4})?)\b/
  const zm = query.match(zipRe)
  if (zm) return zm[1]

  const states = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware',
    'Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana',
    'Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana',
    'Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina',
    'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina',
    'South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
    'Wisconsin','Wyoming']
  for (const s of states) {
    if (query.toLowerCase().includes(s.toLowerCase())) return `${s}, USA`
  }
  return null
}

const KNOWN_MGMT_COS = ['greystar','lincoln property','bozzuto','maa','aimco','cortland','equity residential','avalon','avalonbay','camden','national','rpm living','cardinal group','grayco','windsor','amli','nrp group','alliance residential','morgan properties','essex property','udr','independence realty','nvr','invitation homes','progress residential','mynd','tricon']

function extractMgmtCoSlug(query: string): string | null {
  const q = query.toLowerCase()
  const slugMap: Record<string, string> = {
    'amli': 'amli', 'greystar': 'greystar', 'lincoln property': 'lincoln', 'bozzuto': 'bozzuto',
    'maa': 'maa', 'aimco': 'aimco', 'cortland': 'cortland', 'equity residential': 'equity-residential',
    'avalonbay': 'avalonbay', 'avalon': 'avalon', 'camden': 'camden', 'rpm living': 'rpm-living',
    'cardinal group': 'cardinal-group', 'udr': 'udr', 'essex property': 'essex', 'nrp group': 'nrp',
    'alliance residential': 'alliance', 'morgan properties': 'morgan', 'independence realty': 'independence-realty',
    'tricon': 'tricon',
  }
  for (const [name, slug] of Object.entries(slugMap)) {
    if (q.includes(name)) return slug
  }
  return null
}

function deriveDomain(p: { slug: string; property_page_pattern: string | null; operator_page_pattern: string | null }): string | null {
  const urlTemplate = p.property_page_pattern || p.operator_page_pattern
  if (urlTemplate) {
    return urlTemplate.replace(/\{.*?\}/g, '').replace(/\/$/, '').replace(/^https?:\/\//, '').split('/')[0]
  }
  if (!p.slug.includes('-') && p.slug.length > 3 && p.slug.length < 30) return `${p.slug}.com`
  return null
}

// ─── Contract date discovery helpers ─────────────────────────────────────────

interface WaybackResult { url: string; firstSeen: string; estimatedExpiry: string }

async function checkWaybackTimestamp(url: string): Promise<WaybackResult | null> {
  try {
    const normalized = url.replace(/\/$/, '') + '/'
    const cdxUrl = `http://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(normalized)}&output=json&limit=1&fl=timestamp&from=20100101&filter=statuscode:200`
    const res = await fetch(cdxUrl, { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'GateGuard-ARIA/1.0' } })
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length < 2) return null
    const ts = data[1]?.[0]
    if (!ts || ts.length < 8) return null
    const year  = parseInt(ts.slice(0, 4), 10)
    const month = ts.slice(4, 6)
    const day   = ts.slice(6, 8)
    const expiryYear = year + 8
    return {
      url: normalized,
      firstSeen: `${year}-${month}-${day}`,
      estimatedExpiry: `~${expiryYear} (est. from Wayback first-crawl ${year}-${month}-${day} + 8yr typical MDU term)`,
    }
  } catch { return null }
}

async function searchEdgarBulkAgreements(terms: string, mgmtCo: string): Promise<string> {
  try {
    const target = mgmtCo.length > 2 ? `"${mgmtCo}"` : `"${terms.slice(0, 40).replace(/"/g, '')}"`
    const telecomPhrases = `("bulk cable agreement" OR "bulk internet agreement" OR "telecommunications agreement" OR "bulk broadband" OR "managed wifi" OR "bulk cable" OR "exclusive internet" OR "bulk telecommunications" OR "bulk video agreement" OR "master telecommunications agreement" OR "MDU agreement" OR "right of entry agreement")`
    const ispNames = `(Charter OR Spectrum OR Comcast OR Xfinity OR Cox OR "AT&T" OR DirecTV OR Hotwire OR Gigstreem OR "Pavlov Media" OR "Spot On Networks" OR Wyyerd OR Boingo OR WideOpenWest OR Metronet OR Vyve OR Brightspeed OR Ting OR Consolidated OR Lumen)`
    const forms = '10-K,10-Q,8-K'
    const baseParams = `&forms=${forms}&dateRange=custom&startdt=2014-01-01`
    const q1 = `${target} AND ${telecomPhrases}`
    const q2 = `${target} AND ${ispNames} AND ${telecomPhrases}`
    const fetchOpts = { signal: AbortSignal.timeout(8000), headers: { 'Accept': 'application/json', 'User-Agent': 'GateGuard-ARIA/1.0' } }
    
    const [res1, res2] = await Promise.allSettled([
      fetch(`https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(q1)}${baseParams}`, fetchOpts),
      fetch(`https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(q2)}${baseParams}`, fetchOpts),
    ])
    
    const seenIds = new Set<string>()
    const lines: string[] = []
    
    for (const result of [res1, res2]) {
      if (result.status !== 'fulfilled' || !result.value.ok) continue
      const data = await result.value.json()
      const hits: any[] = data?.hits?.hits ?? []
      for (const h of hits.slice(0, 5)) {
        const id = h._id ?? ''
        if (seenIds.has(id)) continue
        seenIds.add(id)
        const entity   = (h._source?.entity_name ?? 'Unknown entity').replace(/\s+/g, ' ').trim()
        const fileDate = h._source?.file_date    ?? 'unknown date'
        const formType = h._source?.form_type    ?? 'SEC filing'
        const cik      = h._source?.entity_id    ?? ''
        const filingUrl = cik ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=${formType}&dateb=&owner=include&count=10` : ''
        const typeNote = formType === '8-K' ? ' [8-K: material agreement event]' : ' [annual/quarterly]'
        lines.push(`[SEC-EDGAR/${formType}] ${entity} | filed ${fileDate}${typeNote}${filingUrl ? ` | ${filingUrl}` : ''}`)
      }
    }
    if (lines.length === 0) return ''
    return `\n\nSEC EDGAR — REIT/PUBLIC FILINGS (10-K, 10-Q, 8-K) bulk telecom disclosures for "${mgmtCo || terms}":\n${lines.join('\n')}\n`
  } catch { return '' }
}

function extractSearchTerms(query: string): string {
  const q = query.toLowerCase().trim()
  const trimmed = query.trim()
  let matchedCo: string | null = null
  for (const co of KNOWN_MGMT_COS) {
    if (q.includes(co)) { matchedCo = co; break }
  }
  if (matchedCo) {
    const hasPropertyContext = (q.includes(' at ') || q.includes(' the ') || /\d/.test(q) || q.length > matchedCo.length + 12)
    if (hasPropertyContext) return trimmed.slice(0, 80)
    else return matchedCo.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
  }
  return trimmed.slice(0, 80)
}

function formatFCCDataForPrompt(providers: FCCProvider[], location: string): string {
  if (providers.length === 0) return ''
  const byTech: Record<string, string[]> = {}
  const techLabel: Record<number, string> = { 10: 'DSL', 11: 'DSL', 12: 'DSL', 20: 'DSL', 40: 'Cable', 41: 'Cable', 42: 'Cable', 50: 'Fiber', 300: 'Fixed Wireless', 70: 'Cable' }
  for (const p of providers) {
    const tech = techLabel[p.technology] ?? 'Other'
    if (!byTech[tech]) byTech[tech] = []
    const name = p.brand_name || p.holding_company
    if (!byTech[tech].includes(name)) byTech[tech].push(name)
  }
  const lines = [`FCC BROADBAND MAP DATA — ISPs licensed to serve the area near ${location}:`]
  for (const [tech, names] of Object.entries(byTech)) lines.push(`  ${tech}: ${names.join(', ')}`)
  return lines.join('\n')
}

async function persistContractFindings(prospects: any[], searchId: string | null): Promise<void> {
  try {
    const rows: Record<string, unknown>[] = []
    for (const prospect of prospects) {
      const prop  = prospect?.property ?? {}
      const own   = prospect?.ownership ?? {}
      const bulks: any[] = prop.bulk_agreements ?? []

      for (const b of bulks) {
        if (!b.provider || b.confidence === 'low') continue
        const expiryYearMatch = (b.expiry_estimate ?? '').match(/20\d{2}/)
        const expiryYear = expiryYearMatch ? parseInt(expiryYearMatch[0], 10) : null
        const effectiveDateStr = b.ucc_filing_date || b.wayback_first_seen || null
        const expiryDateStr = (expiryYear && !b.expiry_estimate?.includes('unknown')) ? `${expiryYear}-01-01` : null
        const addressState = (prop.address ?? '').match(/\b([A-Z]{2})\b\s*\d{0,5}$/)?.[1] ?? null

        rows.push({
          property_name:      prop.name || null,
          property_address:   prop.address || null,
          property_state:     addressState,
          management_company: prop.management_company || null,
          owner_entity:       prop.owner_entity || own.owner_entity || null,
          dnb_duns:           own.dnb_duns || null,
          provider_name:      b.provider,
          provider_type:      b.service_type === 'video' ? 'video' : 'isp',
          agreement_type:     b.agreement_type || 'unknown',
          service_type:       b.service_type || 'internet',
          effective_date:     effectiveDateStr || null,
          expiry_date:        expiryDateStr || null,
          expiry_year:        expiryYear,
          wayback_first_seen: b.wayback_first_seen || null,
          ucc_filing_date:    b.ucc_filing_date || null,
          source_url:         b.source_url || null,
          source_snippet:     b.source_snippet ? b.source_snippet.slice(0, 500) : null,
          source_type:        'aria',
          confidence:         b.confidence || 'medium',
          found_by_search_id: searchId || null,
          verified:           b.confidence === 'confirmed',
          verified_by:        b.confidence === 'confirmed' ? 'aria' : null,
        })
      }
    }
    if (rows.length > 0) {
      await supabase.from('aria_contract_findings').upsert(rows, { onConflict: 'provider_name,property_address', ignoreDuplicates: false })
    }
  } catch {}
}

async function queryContractFindings(terms: string): Promise<string> {
  try {
    if (terms.length < 4) return ''
    const { data } = await supabase
      .from('aria_contract_findings')
      .select('provider_name, agreement_type, service_type, expiry_year, expiry_date, confidence, source_type, wayback_first_seen, ucc_filing_date, management_company, owner_entity, dnb_duns')
      .or(`property_name.ilike.%${terms}%,property_address.ilike.%${terms}%,management_company.ilike.%${terms}%`)
      .in('confidence', ['confirmed', 'high', 'medium-high', 'medium'])
      .order('confidence', { ascending: false })
      .limit(12)

    if (!data || data.length === 0) return ''
    const lines = data.map((r: any) => `• ${r.provider_name} (${r.service_type}/${r.agreement_type}) — ${r.expiry_year ? `est. ~${r.expiry_year}` : 'unknown'} — ${r.confidence} confidence`)
    return `\n\nGATEGUARD CONTRACT FINDINGS DATABASE — Prior data for "${terms}":\n${lines.join('\n')}\n`
  } catch { return '' }
}

async function persistProviderDetections(prospects: any[], queryText: string): Promise<void> {
  try {
    const { data: allProviders } = await supabase.from('mdu_providers').select('id, name, slug, provider_type').eq('active', true)
    if (!allProviders || allProviders.length === 0) return

    const providerIndex = allProviders.map((p: any) => ({ id: p.id, name: p.name.toLowerCase(), slug: p.slug }))
    const detectionsToInsert: Record<string, unknown>[] = []

    for (const prospect of prospects) {
      const propertyName    = prospect?.property?.name ?? ''
      const propertyAddress = prospect?.property?.address ?? ''
      const bulkAgreements: any[] = prospect?.property?.bulk_agreements ?? []

      for (const agreement of bulkAgreements) {
        const rawConfidence = agreement.confidence ?? 'low'
        if (!['high', 'confirmed', 'medium-high'].includes(rawConfidence)) continue

        const agreementProvider = (agreement.provider ?? '').toLowerCase()
        if (!agreementProvider) continue

        const matchedProvider = providerIndex.find(p => p.name.includes(agreementProvider) || agreementProvider.includes(p.name))
        if (!matchedProvider) continue

        const dbConfidence = rawConfidence === 'confirmed' ? 'confirmed' : rawConfidence === 'medium-high' ? 'high' : rawConfidence
        detectionsToInsert.push({
          provider_id:      matchedProvider.id,
          property_name:    propertyName || null,
          property_address: propertyAddress || null,
          confidence:       dbConfidence,
          source_type:      'aria',
          source_snippet:   agreement.expiry_estimate ? `service_type=${agreement.service_type}; expiry=${agreement.expiry_estimate}` : `service_type=${agreement.service_type}`,
          contract_end_year: (agreement.expiry_estimate ?? '').match(/20\d{2}/) ? parseInt((agreement.expiry_estimate ?? '').match(/20\d{2}/)![0], 10) : null,
          verified_by: 'aria',
        })
      }
    }
    if (detectionsToInsert.length > 0) {
      await supabase.from('mdu_provider_detections').upsert(detectionsToInsert, { onConflict: 'provider_id,property_name', ignoreDuplicates: false })
    }
  } catch {}
}

// ─── Tool schema ──────────────────────────────────────────────────────────
const ariaResearchTool: Anthropic.Tool = {
  name: 'aria_research_result',
  description: 'Return the ARIA lead intelligence research result.',
  input_schema: {
    type: 'object' as const,
    required: ['mode', 'query_interpretation', 'prospects'],
    properties: {
      mode: { type: 'string', enum: ['target', 'prospect'] },
      query_interpretation: { type: 'string' },
      prospects: {
        type: 'array',
        items: {
          type: 'object',
          required: ['property', 'decision_maker', 'decision_maker_chain', 'pain_signals', 'profile', 'scout_brief'],
          properties: {
            property: {
              type: 'object',
              required: ['name', 'address', 'units', 'year_built', 'management_company', 'owner_entity', 'property_type', 'class', 'occupancy', 'isp_providers', 'video_providers', 'bulk_agreements', 'proptech'],
              properties: {
                name:               { type: 'string' },
                address:            { type: 'string' },
                units:              { type: 'number' },
                year_built:         { type: 'number' },
                management_company: { type: 'string' },
                owner_entity:       { type: 'string' },
                property_type:      { type: 'string' },
                class:              { type: 'string' },
                occupancy:          { type: 'string' },
                isp_providers:      { type: 'array', items: { type: 'string' } },
                video_providers:    { type: 'array', items: { type: 'string' } },
                bulk_agreements: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['provider', 'service_type', 'agreement_type', 'expiry_estimate', 'confidence'],
                    properties: {
                      provider:           { type: 'string' },
                      service_type:       { type: 'string', enum: ['internet', 'video', 'bundled'] },
                      agreement_type:     { type: 'string', enum: ['exclusive', 'bulk', 'preferred', 'unknown'] },
                      expiry_estimate:    { type: 'string' },
                      confidence:         { type: 'string', enum: ['confirmed', 'high', 'medium', 'low'] },
                      wayback_first_seen: { type: 'string' },
                      ucc_filing_date:    { type: 'string' },
                      source_url:         { type: 'string' },
                      source_snippet:     { type: 'string' },
                    },
                  },
                },
                proptech: {
                  type: 'object',
                  required: ['gate_operators','access_control','intercoms','cameras','smart_locks','resident_apps','package_solutions','tech_generation','sara_signals','displacement_targets'],
                  properties: {
                    gate_operators:       { type: 'array', items: { type: 'string' } },
                    access_control:       { type: 'array', items: { type: 'string' } },
                    intercoms:            { type: 'array', items: { type: 'string' } },
                    cameras:              { type: 'array', items: { type: 'string' } },
                    smart_locks:          { type: 'array', items: { type: 'string' } },
                    resident_apps:        { type: 'array', items: { type: 'string' } },
                    package_solutions:    { type: 'array', items: { type: 'string' } },
                    tech_generation:      { type: 'string', enum: ['legacy','modern','hybrid'] },
                    sara_signals:         { type: 'boolean' },
                    replacement_window:   { type: 'string' },
                    displacement_targets: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
            decision_maker: {
              type: 'object',
              required: ['name', 'title', 'company', 'role_type', 'linkedin_slug', 'email', 'top_email_format', 'phone', 'tenure_years'],
              properties: {
                name:             { type: 'string' },
                title:            { type: 'string' },
                company:          { type: 'string' },
                role_type:        { type: 'string', enum: ['asset_manager','regional_manager','property_manager','owner','unknown'] },
                linkedin_slug:    { type: 'string' },
                email:            { type: 'string' },
                top_email_format: { type: 'string' },
                phone:            { type: 'string' },
                tenure_years:     { type: 'number' },
              },
            },
            decision_maker_chain: {
              type: 'array',
              items: {
                type: 'object',
                required: ['name', 'title', 'company', 'role_type', 'email', 'top_email_format'],
                properties: {
                  name:             { type: 'string' },
                  title:            { type: 'string' },
                  company:          { type: 'string' },
                  role_type:        { type: 'string', enum: ['owner','asset_manager','regional_manager','property_manager','unknown'] },
                  linkedin_slug:    { type: 'string' },
                  email:            { type: 'string' },
                  top_email_format: { type: 'string' },
                  phone:            { type: 'string' },
                  notes:            { type: 'string' },
                  dm_hooks:         { type: 'array', items: { type: 'string' } },
                },
              },
            },
            ownership: {
              type: 'object',
              required: ['owner_entity', 'owner_type', 'portfolio_size', 'acquisition_year'],
              properties: {
                owner_entity:     { type: 'string' },
                owner_type:       { type: 'string', enum: ['private_equity', 'reit', 'family_office', 'individual', 'management_company_owned', 'unknown'] },
                portfolio_size:   { type: 'string' },
                acquisition_year: { type: 'string' },
                hold_period:      { type: 'string' },
                capex_signal:     { type: 'string' },
                dnb_duns:         { type: 'string' },
              },
            },
            pain_signals: {
              type: 'array',
              items: {
                type: 'object',
                required: ['source', 'date', 'signal_type', 'quote', 'severity'],
                properties: {
                  source:      { type: 'string' },
                  date:        { type: 'string' },
                  signal_type: { type: 'string' },
                  quote:       { type: 'string' },
                  severity:    { type: 'string', enum: ['high', 'medium', 'low'] },
                },
              },
            },
            profile: {
              type: 'object',
              required: ['buy_score', 'urgency', 'primary_concern', 'current_vendor', 'contract_window', 'communication_style'],
              properties: {
                buy_score:           { type: 'number' },
                urgency:             { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                primary_concern:     { type: 'string' },
                current_vendor:      { type: 'string' },
                contract_window:     { type: 'string' },
                communication_style: { type: 'string' },
              },
            },
            scout_brief: {
              type: 'object',
              required: ['primary_contact', 'outreach_angle', 'contract_window_urgency', 'key_data_points'],
              properties: {
                primary_contact:         { type: 'string' },
                outreach_angle:          { type: 'string', enum: ['contract_window', 'proptech_pain', 'acquisition', 'tech_displacement', 'sara_bridge', 'upgrade_path', 'lease_up', 'general'] },
                contract_window_urgency: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'none'] },
                key_data_points:         { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
    },
  },
}

// ─── Route handler ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { query } = await req.json()
    if (!query?.trim()) return NextResponse.json({ error: 'query required' }, { status: 400 })

    const locationHint = extractLocationHint(query) ?? ''
    const searchTerms = extractSearchTerms(query)

    let fccBlock = ''
    let fccProvidersForUI: string[] = []
    let existingOppNames: string[] = []
    let tavilyContextBlock = ''
    let mduProviderSlugs: Array<any> = []
    let cachedDetectionsBlock = ''
    let waybackBlock    = ''
    let edgarBlock      = ''
    let priorFindings   = ''

    const fccPromise = (async () => {
      if (!locationHint) return
      const geo = await geocodeLocation(locationHint)
      if (!geo) return
      const providers = await fetchFCCBroadband(geo.lat, geo.lng)
      if (providers.length === 0) return
      fccBlock = formatFCCDataForPrompt(providers, locationHint)
      fccProvidersForUI = [...new Set(providers.map(p => p.brand_name || p.holding_company))]
    })()

    const oppPromise = (async () => {
      try {
        const user  = await getCurrentUser()
        const scope = await resolveOrgScope(user)
        let oppQuery = supabase.from('opportunities').select('account_name').not('stage', 'in', '(lost,won)').not('account_name', 'is', null).limit(200)
        if (!scope.all && scope.ids.length > 0) oppQuery = oppQuery.in('dealer_org_id', scope.ids)
        const { data: opps } = await oppQuery
        existingOppNames = (opps ?? []).map((o: any) => o.account_name).filter(Boolean)
      } catch { }
    })()

    const mduProviderPromise = (async () => {
      try {
        const { data: providers } = await supabase.from('mdu_providers').select('name, slug, provider_type, property_page_pattern, operator_page_pattern, notes').eq('active', true)
        if (providers && providers.length > 0) mduProviderSlugs = providers

        if (searchTerms.length > 3) {
          const { data: detections } = await supabase.from('mdu_provider_detections').select('confidence, source_type, source_snippet, contract_end_year, verified_by, mdu_providers ( name, provider_type )').ilike('property_name', `%${searchTerms}%`).in('confidence', ['confirmed', 'high', 'medium']).limit(10)
          if (detections && detections.length > 0) {
            const detLines = detections.map((d: any) => `• ${d.mdu_providers?.name ?? 'Unknown'} (${d.mdu_providers?.provider_type ?? 'isp'}): ${d.confidence} [${d.source_type}]`)
            cachedDetectionsBlock = `\n\nGATEGUARD CACHED PROVIDER DETECTIONS:\n${detLines.join('\n')}\n`
          }
        }
      } catch { }
    })()

    const priorFindingsPromise = (async () => { priorFindings = await queryContractFindings(searchTerms) })()
    const edgarPromise = (async () => {
      const mgmtCo = extractMgmtCoSlug(query) ?? ''
      const result = await searchEdgarBulkAgreements(searchTerms, mgmtCo)
      if (result) edgarBlock = result
    })()

    // Run main Tavily searches
    const tavilyPromise = (async () => {
      if (!process.env.TAVILY_API_KEY) return
      const loc = locationHint || ''
      const terms = searchTerms
      const mgmtTarget = extractMgmtCoSlug(query) || terms

      // We preserve your exact 28 searches here
      const searchPromises = [
        tavilySearch(`"${terms}" ${loc} "internet included" site:apartments.com OR site:apartmentlist.com`, 4, 'listing-site'),
        tavilySearch(`"${terms}" ${loc} internet "only option" site:reddit.com OR site:apartmentratings.com`, 5, 'social', 365),
        tavilySearch(`"${terms}" ${loc} "memorandum of agreement" internet county deed recorder`, 3, 'county-deed'),
        tavilySearch(`"${terms}" ${loc} "exclusive agreement" "World Cinema" OR "Gigstreem"`, 3, 'isp-partnership'),
        tavilySearch(`"${terms}" ${loc} "offering memorandum" "bulk internet" provider expiration`, 3, 'commercial-re'),
        tavilySearch(`"${terms}" ${loc} "HOA minutes" "bulk internet" "expires"`, 3, 'hoa-rfp'),
        tavilySearch(`"MDU account executive" ${loc} "secured" apartment DirecTV OR Gigstreem site:linkedin.com`, 3, 'linkedin-mdu'),
        tavilySearch(`"${terms}" ${loc} "internet fee" apartment fees breakdown`, 4, 'locator-site'),
        tavilySearch(`"${terms}" ${loc} "forced to use" "internet" -site:apartments.com`, 4, 'forced-service', 365),
        tavilySearch(`"${terms}" ${loc} "community manager" "manage" "bulk internet" site:linkedin.com OR site:indeed.com`, 3, 'job-posting'),
        tavilySearch(`${loc} multifamily REIT "managed WiFi" "portfolio-wide"`, 3, 'reit-earnings'),
        tavilySearch(`"${terms}" ${loc} permit "low voltage" multifamily Comcast OR Spectrum Accela`, 3, 'city-permit'),
        tavilySearch(`"${terms}" ${loc} "new internet" site:facebook.com OR site:instagram.com`, 3, 'community-social', 365),
        tavilySearch(`"${terms}" ${loc} "agreement" "managed WiFi" Hotwire OR Spectrum site:prnewswire.com`, 3, 'isp-press-release'),
        tavilySearch(`"${terms}" ${loc} "internet included" -site:apartments.com`, 3, 'historical-listing'),
        tavilySearch(`"${mgmtTarget}" "regional manager" multifamily "${loc}" site:linkedin.com`, 4, 'dm-social', 365),
        tavilySearch(`"${mgmtTarget}" ${loc} "asset manager" multifamily site:linkedin.com`, 4, 'dm-social', 365),
        tavilySearch(`"${terms}" ${loc} "gate broken" OR "package stolen" site:reddit.com`, 5, 'proptech-pain', 365),
        tavilySearch(`"${terms}" ${loc} multifamily "acquired" site:bisnow.com OR site:costar.com`, 4, 'acquisition'),
        tavilySearch(`"${terms}" ${loc} ("Yardi" OR "SmartRent" OR "ButterflyMX")`, 4, 'tech-stack'),
        tavilySearch(`"${mgmtTarget}" ${loc} "UCC-1" "telecommunications" site:sos.state.tx.us`, 4, 'ucc-filing'),
        tavilySearch(`"${mgmtTarget}" multifamily "DUNS" site:opencorporates.com`, 3, 'dnb-lookup'),
        tavilySearch(`filetype:pdf "bulk services agreement" "${terms}" "expiration"`, 4, 'contract-pdf'),
        tavilySearch(`filetype:pdf "telecommunications easement" Comcast OR Spectrum "${loc}"`, 4, 'contract-pdf'),
        tavilySearch(`filetype:pdf "master communications agreement" MDU "expiration date" -template`, 4, 'contract-pdf'),
        tavilySearch(`filetype:pdf "bulk services agreement" Greystar OR "${mgmtTarget}" "expiration" -template`, 4, 'contract-pdf'),
        tavilySearch(`"telecommunications easement" "${terms}" ${loc} grantee site:gsccca.org`, 5, 'county-deed'),
        tavilySearch(`"${mgmtTarget}" "regional VP" "${loc}" site:linkedin.com`, 5, 'dm-hierarchy'),
      ]

      const results = await Promise.all(searchPromises)
      const allResults = results.flat().filter(r => r.score > 0.20).slice(0, 40)

      if (allResults.length === 0) return
      tavilyContextBlock = `\n\nWEB INTELLIGENCE — Live OSINT:\n${allResults.map((r, i) => `[Source ${i+1}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 500)}`).join('\n\n---\n\n')}`
    })()

    await Promise.allSettled([fccPromise, oppPromise, tavilyPromise, mduProviderPromise, edgarPromise, priorFindingsPromise])

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 6000,
      tools: [ariaResearchTool],
      tool_choice: { type: 'tool', name: 'aria_research_result' },
      system: `You are ARIA, GateGuard's AI marketing intelligence engine. Extract the data cleanly and output it via the tool.`,
      messages: [{
        role: 'user',
        content: `ARIA query: "${query.trim()}"\n${fccBlock}${edgarBlock}${tavilyContextBlock}`
      }]
    })

    const toolBlock = message.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
    if (!toolBlock) throw new Error('Claude did not call the aria_research_result tool')

    // ── THE CRITICAL SANITIZATION LAYER ──────────────────────────────────────
    const rawData = toolBlock.input as any;
    
    // Force the payload into the exact shape the UI and deep route expect,
    // protecting against hallucinations where Claude skips an array.
    const sanitizedProspects = (rawData.prospects || []).map((p: any) => ({
      property: {
        name: p.property?.name ?? 'Unknown Property',
        address: p.property?.address ?? '',
        units: p.property?.units ?? null,
        year_built: p.property?.year_built ?? null,
        management_company: p.property?.management_company ?? 'Unknown',
        owner_entity: p.property?.owner_entity ?? 'Unknown',
        property_type: p.property?.property_type ?? 'Multifamily',
        class: p.property?.class ?? null,
        occupancy: p.property?.occupancy ?? null,
        isp_providers: p.property?.isp_providers ?? [],
        video_providers: p.property?.video_providers ?? [],
        bulk_agreements: p.property?.bulk_agreements ?? [],
        proptech: {
          gate_operators: p.property?.proptech?.gate_operators ?? [],
          access_control: p.property?.proptech?.access_control ?? [],
          intercoms: p.property?.proptech?.intercoms ?? [],
          cameras: p.property?.proptech?.cameras ?? [],
          smart_locks: p.property?.proptech?.smart_locks ?? [],
          resident_apps: p.property?.proptech?.resident_apps ?? [],
          package_solutions: p.property?.proptech?.package_solutions ?? [],
          tech_generation: p.property?.proptech?.tech_generation ?? 'legacy',
          sara_signals: p.property?.proptech?.sara_signals ?? false,
          replacement_window: p.property?.proptech?.replacement_window ?? null,
          displacement_targets: p.property?.proptech?.displacement_targets ?? []
        }
      },
      decision_maker: {
        name: p.decision_maker?.name ?? 'Executive',
        title: p.decision_maker?.title ?? '',
        company: p.decision_maker?.company ?? '',
        role_type: p.decision_maker?.role_type ?? 'unknown',
        linkedin_slug: p.decision_maker?.linkedin_slug ?? '',
        email: p.decision_maker?.email ?? '',
        top_email_format: p.decision_maker?.top_email_format ?? '',
        phone: p.decision_maker?.phone ?? '',
        tenure_years: p.decision_maker?.tenure_years ?? 0
      },
      decision_maker_chain: p.decision_maker_chain ?? [],
      ownership: p.ownership ?? null,
      pain_signals: p.pain_signals ?? [],
      profile: {
        buy_score: p.profile?.buy_score ?? 5,
        urgency: p.profile?.urgency ?? 'low',
        primary_concern: p.profile?.primary_concern ?? 'None detected',
        current_vendor: p.profile?.current_vendor ?? 'Unknown',
        contract_window: p.profile?.contract_window ?? 'Unknown',
        communication_style: p.profile?.communication_style ?? 'email'
      },
      scout_brief: p.scout_brief ?? null
    }));

    if (sanitizedProspects.length === 0) {
      throw new Error('No prospects in response — try rephrasing your query')
    }

    if (fccProvidersForUI.length > 0) {
      sanitizedProspects.forEach((p: any) => {
        p.property._fcc_verified = true
        p.property._fcc_providers = fccProvidersForUI
      })
    }

    // Save search to DB (non-blocking)
    let savedSearchId: string | null = null
    try {
      const user  = await getCurrentUser()
      const scope = await resolveOrgScope(user)
      const { data: saved } = await supabase.from('aria_searches').insert({
        org_id: scope.own_id ?? null,
        user_id: user?.id ?? null,
        search_type: 'base',
        query: query.trim(),
        query_interpretation: rawData.query_interpretation ?? null,
        results: { ...rawData, prospects: sanitizedProspects },
      }).select('id').single()
      savedSearchId = saved?.id ?? null
    } catch { }

    void persistProviderDetections(sanitizedProspects, query.trim())
    void persistContractFindings(sanitizedProspects, savedSearchId)

    return NextResponse.json({ 
      mode: rawData.mode, 
      query_interpretation: rawData.query_interpretation, 
      prospects: sanitizedProspects, 
      savedSearchId, 
      fccVerified: fccProvidersForUI.length > 0, 
      webIntelligence: tavilyContextBlock.length > 100 
    })

  } catch (err: any) {
    console.error('[aria/research]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}