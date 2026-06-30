/**
 * POST /api/aria/social
 *
 * ARIA Engine 2 — Independent Social Intelligence Search
 *
 * Runs AFTER the main deep engine completes. Takes property context from Engine 1
 * and fires 3 parallel Serper searches scoped to last 6 months, targeting social
 * media posts about gates, access, internet, smart locks, DirecTV, Dish, cameras,
 * and security at this specific property and management company.
 *
 * Then runs a Haiku cross-reference pass comparing Engine 1 tech stack findings
 * against the social posts — surfaces insight notes where the two sources agree,
 * contradict, or enhance each other.
 *
 * Engine 1 is NEVER modified. This route only appends.
 *
 * Input:
 *   { property_name, city, state, management_company?, isp_providers?, video_providers?, bulk_agreements?, gate_operators?, access_control? }
 *
 * Output:
 *   { social_posts: SocialPost[], cross_reference_notes: CrossRefNote[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const supaSocial = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// ─── Serper with time filter ──────────────────────────────────────────────────

interface SerperResult { title: string; url: string; content: string }

async function serperSocial(query: string, num = 6): Promise<SerperResult[]> {
  if (!process.env.SERPER_API_KEY) return []
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': process.env.SERPER_API_KEY },
      body: JSON.stringify({
        q: query,
        num,
        gl: 'us',
        hl: 'en',
        tbs: 'qdr:m6', // last 6 months
      }),
      signal: AbortSignal.timeout(7000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.organic ?? []).slice(0, num).map((r: any) => ({
      title: r.title ?? '',
      url:   r.link  ?? '',
      content: [r.snippet, r.date].filter(Boolean).join(' — '),
    }))
  } catch { return [] }
}

// Also search news tab for recent articles
async function serperNews(query: string, num = 4): Promise<SerperResult[]> {
  if (!process.env.SERPER_API_KEY) return []
  try {
    const res = await fetch('https://google.serper.dev/news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': process.env.SERPER_API_KEY },
      body: JSON.stringify({ q: query, num, gl: 'us', hl: 'en', tbs: 'qdr:m6' }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.news ?? []).slice(0, num).map((r: any) => ({
      title: r.title ?? '',
      url:   r.link  ?? '',
      content: [r.snippet, r.date].filter(Boolean).join(' — '),
    }))
  } catch { return [] }
}

// ─── Haiku helpers ────────────────────────────────────────────────────────────

function formatSnippets(results: SerperResult[], label: string): string {
  if (!results.length) return ''
  return `=== ${label} ===\n` + results.map((r, i) =>
    `[${i+1}] ${r.title}\nURL: ${r.url}\n${r.content}`
  ).join('\n\n')
}

async function haikusExtractArray<T>(prompt: string, content: string, maxTokens: number): Promise<T[]> {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: `${prompt}\n\n${content}` }],
    })
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '[]'
    const match = text.match(/\[[\s\S]*\]/)
    if (match) return JSON.parse(match[0]) as T[]
  } catch { }
  return []
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      property_name,
      city,
      state,
      management_company,
      isp_providers   = [] as string[],
      video_providers  = [] as string[],
      bulk_agreements  = [] as Array<{ provider: string; service_type: string; agreement_type?: string }>,
      gate_operators   = [] as string[],
      access_control   = [] as string[],
    } = body

    if (!property_name || !city) {
      return NextResponse.json({ social_posts: [], cross_reference_notes: [] })
    }

    const loc = [city, state].filter(Boolean).join(', ')

    // ── 3 parallel Serper searches ────────────────────────────────────────────

    const TECH_KEYWORDS = 'gate OR "gate access" OR "call box" OR intercom OR "access control" OR "smart lock" OR "fob" OR internet OR WiFi OR DirecTV OR "Dish Network" OR camera OR "security camera" OR "package locker" OR "Amazon Hub"'

    const [propertyResults, mgmtResults, bulkResults, phoneResults] = await Promise.all([

      // Search 1 — property-level social (Reddit, Google Reviews, Yelp, listing reviews) — up to 10
      serperSocial(
        `site:reddit.com OR site:google.com/maps OR site:yelp.com OR site:apartments.com "${property_name}" ${city} (${TECH_KEYWORDS}) review OR complaint OR resident`,
        10
      ),

      // Search 2 — management company social (catches complaints that name the mgmt co, not just the property)
      management_company
        ? serperSocial(
            `"${management_company}" "${city}" (${TECH_KEYWORDS}) resident review complaint 2024 OR 2025`,
            8
          )
        : Promise.resolve([]),

      // Search 3 — bulk/exclusive video/internet evidence
      serperSocial(
        `"${property_name}" ${loc} (DirecTV OR "Dish Network" OR "Comcast" OR "no choice" OR "only option" OR "bulk agreement" OR "technology fee" OR "internet included" OR "cable included") resident`,
        6
      ),

      // Search 4 — leasing office phone number
      serperSocial(
        `"${property_name}" ${loc} leasing phone contact site:apartments.com OR site:rentcafe.com OR site:zillow.com OR site:apartmentlist.com OR site:forrent.com`,
        4
      ),
    ])

    // Also grab recent news for this property (gate incidents, security events, etc.)
    const newsResults = await serperNews(
      `"${property_name}" ${loc} (gate OR access OR security OR internet OR DirecTV) 2024 OR 2025`,
      4
    )

    const allSnippets = [
      formatSnippets(propertyResults, 'PROPERTY SOCIAL (Reddit / Google Reviews / Yelp)'),
      formatSnippets(mgmtResults,     'MANAGEMENT CO SOCIAL'),
      formatSnippets(bulkResults,     'BULK / EXCLUSIVE SIGNAL SEARCH'),
      formatSnippets(newsResults,     'RECENT NEWS'),
    ].filter(Boolean).join('\n\n')

    if (!allSnippets) {
      return NextResponse.json({ social_posts: [], cross_reference_notes: [], property_phone: null })
    }

    // ── Haiku Pass 0: extract property phone ─────────────────────────────────

    const phoneSnippets = formatSnippets(phoneResults, 'PHONE LOOKUP')
    let property_phone: string | null = null
    if (phoneSnippets) {
      try {
        const phoneMsg = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 100,
          messages: [{
            role: 'user',
            content: `Extract the leasing office or main contact phone number for "${property_name}" in ${loc} from these search results. Return ONLY the phone number (format: (xxx) xxx-xxxx or xxx-xxx-xxxx). If multiple numbers found, return the most likely leasing/main office number. If none found, return null.\n\n${phoneSnippets}`,
          }],
        })
        const phoneText = (phoneMsg.content[0]?.type === 'text' ? phoneMsg.content[0].text : '').trim()
        const phoneMatch = phoneText.match(/\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/)
        property_phone = phoneMatch ? phoneMatch[0] : null
      } catch { /* fail silently */ }
    }

    // ── Haiku Pass 1: extract social posts (up to 10) ────────────────────────

    const extractionPrompt = `You are analyzing search results about a multifamily property. Extract individual resident reviews, social media posts, and community complaints. Extract up to 10 of the best, most specific posts.

Property: "${property_name}", ${loc}

Return ONLY a valid JSON array of social posts. Use this exact schema:
[{"platform":"Reddit","date":"2024-06-15","quote":"FULL exact resident quote — do not truncate, include the complete text","tech_mentioned":["DirecTV","gate"],"signal_type":"internet_complaint","severity":"high","url":"https://..."}]

Rules:
- platform: derive from URL — "Reddit", "Google Reviews", "Yelp", "Facebook", "Apartments.com", "News", or "Resident Review"
- date: ISO date if found, "unknown" if not
- quote: the COMPLETE verbatim words from the resident/reviewer — do NOT truncate or summarize. Include the full post text.
- tech_mentioned: array of tech/service brands or categories mentioned (gate, internet, DirecTV, Dish, smart lock, fob, intercom, camera, etc.)
- signal_type: one of gate_complaint | internet_complaint | access_complaint | video_complaint | security_complaint | lock_complaint | package_complaint | positive_review | general_complaint
- severity: "high" (major pain, blocking issue), "medium" (notable complaint), "low" (minor or positive)
- url: source URL

Only extract clear resident/community voices. Skip property marketing, press releases, and property website copy.
If no resident quotes found, return [].`

    // ── Haiku Pass 2: cross-reference notes ──────────────────────────────────

    const techStackSummary = JSON.stringify({
      isp_providers,
      video_providers,
      bulk_agreements,
      gate_operators,
      access_control,
    }, null, 2)

    const crossRefPrompt = `You are an intelligence analyst comparing two data sources about a multifamily property to find insights.

ENGINE 1 TECH STACK (found via web intelligence, SEC filings, FCC data, listing sites):
${techStackSummary}

ENGINE 2 SOCIAL POSTS (resident reviews and social media from last 6 months):
[SOCIAL_POSTS_PLACEHOLDER]

Generate insight notes ONLY where the social posts CONFIRM, CONTRADICT, or meaningfully ENHANCE what Engine 1 found.

Return ONLY a valid JSON array:
[{"provider":"DirecTV","note":"Two resident posts state DirecTV is the only TV option available, consistent with an exclusive bulk agreement.","confidence":"high","evidence_count":2,"type":"confirmation"}]

Fields:
- provider: the tech/service being discussed
- note: plain English insight (1-2 sentences max). Be specific and direct.
- confidence: "high" (2+ matching posts), "medium" (1 clear post), "low" (indirect inference)
- evidence_count: number of social posts supporting this note
- type: "confirmation" (social confirms tech stack) | "contradiction" (social contradicts) | "enhancement" (social adds detail not in tech stack) | "new_finding" (social found something Engine 1 missed)

Rules:
- Only generate notes with genuine analytical value
- Do NOT restate things already obvious from the tech stack alone
- If social posts mention a provider NOT in the tech stack, flag it as type "new_finding"
- Return [] if there are no meaningful cross-reference insights`

    // Run both Haiku passes in parallel (phone already done above)
    const [rawPosts] = await Promise.all([
      haikusExtractArray<{
        platform: string; date: string; quote: string; tech_mentioned: string[];
        signal_type: string; severity: string; url?: string;
      }>(extractionPrompt, `SEARCH RESULTS:\n${allSnippets}`, 2800),
    ])

    // Now run cross-ref with actual posts
    const postsForCrossRef = rawPosts.length > 0
      ? rawPosts.map(p => `- [${p.platform}] "${p.quote}" (mentions: ${p.tech_mentioned?.join(', ')})`).join('\n')
      : '(no social posts found)'

    const actualCrossRefNotes = await haikusExtractArray<{
      provider: string; note: string; confidence: string; evidence_count: number; type: string;
    }>(
      crossRefPrompt.replace('[SOCIAL_POSTS_PLACEHOLDER]', postsForCrossRef),
      '',
      1000
    )

    // Normalize output — keep up to 10 posts
    const social_posts = rawPosts
      .map(p => ({
        platform:      p.platform     || 'Resident Review',
        date:          p.date         || 'unknown',
        quote:         p.quote        || '',
        tech_mentioned: Array.isArray(p.tech_mentioned) ? p.tech_mentioned : [],
        signal_type:   p.signal_type  || 'general_complaint',
        severity:      (['high','medium','low'].includes(p.severity) ? p.severity : 'medium') as 'high' | 'medium' | 'low',
        url:           p.url,
        source:        'social_search' as const,
      }))
      .filter(p => p.quote.length > 10)
      .slice(0, 10)

    const cross_reference_notes = actualCrossRefNotes.map(n => ({
      provider:       n.provider      || '',
      note:           n.note          || '',
      confidence:     (['high','medium','low'].includes(n.confidence) ? n.confidence : 'medium') as 'high' | 'medium' | 'low',
      evidence_count: n.evidence_count || 1,
      type:           n.type          || 'confirmation',
    })).filter(n => n.note.length > 10)

    // v10: persist to the property so social/community survives reloads + accumulates
    // across runs (union — never drop previously-found posts). Return the merged set
    // so the rep always sees everything ever found, not just this run.
    let outPosts = social_posts
    try {
      const { data: rows } = await supaSocial.from('aria_properties')
        .select('id, social_posts').ilike('property_name', property_name).limit(1)
      const row = rows?.[0] as { id: string; social_posts?: unknown[] } | undefined
      if (row) {
        const prev = Array.isArray(row.social_posts) ? row.social_posts : []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const key = (p: any) => `${p?.quote ?? ''}|${p?.url ?? ''}`
        const seen = new Set(prev.map(key))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const merged = [...prev as any[], ...social_posts.filter(p => !seen.has(key(p)))]
        outPosts = merged as typeof social_posts
        await supaSocial.from('aria_properties').update({
          social_posts: merged,
          community_notes: cross_reference_notes,
          property_phone: property_phone || null,
          social_updated_at: new Date().toISOString(),
        }).eq('id', row.id)
      }
    } catch { /* best-effort — never block the response */ }

    return NextResponse.json({ social_posts: outPosts, cross_reference_notes, property_phone })

  } catch (err) {
    console.error('[ARIA Social]', err)
    return NextResponse.json({ social_posts: [], cross_reference_notes: [], property_phone: null })
  }
}
