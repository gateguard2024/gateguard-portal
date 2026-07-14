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
}

export interface BaseProperty {
  name: string
  address: string
  city: string
  state: string
  units: number | null
  lat?: number | null
  lng?: number | null
  website?: string | null
  management_company?: string | null
  photo_url?: string | null   // the community's own hero shot (og:image)
  systems: BaseSystems
  already_saved?: boolean
  saved_id?: string | null
}

const EMPTY_SYSTEMS: BaseSystems = {
  internet: false, video: false, bulk: false, gates: false,
  cameras: false, smart_lockers: false, smart_rent: false,
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

// ─── Is this one named property, or an area/cluster hunt? ────────────────────
// Cheap heuristic first — no model call for the obvious cases.
function looksLikeArea(q: string): boolean {
  const ql = q.toLowerCase()
  if (/\b(in|near|around|within)\b/.test(ql)) return true
  if (/\d{2,}\s*\+?\s*(unit|units)/.test(ql)) return true
  if (/\b(apartments|properties|complexes|communities|listings)\b\s*$/.test(ql.trim())) return true
  return false
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

    // Two cheap searches: identity/listing + amenities (where systems show up).
    const [identity, amenities] = await Promise.all([
      serper(
        isArea
          ? `${query} apartments site:apartments.com OR site:rentcafe.com OR site:loopnet.com`
          : `"${query}" apartments address units site:apartments.com OR site:rentcafe.com OR site:zillow.com`,
        isArea ? 10 : 6
      ),
      serper(
        isArea
          ? `${query} apartments amenities internet wifi cable gated "controlled access" cameras package lockers`
          : `"${query}" amenities internet wifi cable TV gated "controlled access" cameras "package lockers" SmartRent`,
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
  : 'This is a SINGLE PROPERTY search: return ONLY the one property that best matches. Do not invent others.'}

For each property return:
- name: official community name (NOT the listing site name)
- address: full street address if found, else ""
- city, state: 2-letter state
- units: integer unit count, or null if not stated
- website: official property URL (never apartments.com/zillow), or ""
- management_company: or ""
- systems: presence flags. TRUE only if the text gives real evidence. Never guess:
    internet      -> an ISP / wifi / "high-speed internet" is offered or mentioned
    video         -> cable / TV / streaming service mentioned
    bulk          -> a bulk / included / "internet included in rent" arrangement
    gates         -> gated community / gated entry / controlled access gate
    cameras       -> security cameras / CCTV / video surveillance
    smart_lockers -> package lockers / Amazon Hub / parcel room
    smart_rent    -> SmartRent / smart home / smart apartment / keyless / smart lock

Rules:
- Use ONLY the snippets. If a system isn't evidenced, it is false.
- units must be a number or null — never a guess, never a range.

JSON shape:
{"query_interpretation":"one short line on what you searched for","properties":[{"name":"","address":"","city":"","state":"","units":null,"website":"","management_company":"","systems":{"internet":false,"video":false,"bulk":false,"gates":false,"cameras":false,"smart_lockers":false,"smart_rent":false}}]}

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
      .filter(p => (p?.name ?? '').trim().length > 1)
      .slice(0, wanted)
      .map(p => ({
        name: String(p.name).trim(),
        address: String(p.address ?? '').trim(),
        city: String(p.city ?? '').trim(),
        state: String(p.state ?? '').trim(),
        units: typeof p.units === 'number' ? p.units : null,
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

    return NextResponse.json({
      type: isArea ? 'multi' : 'single',
      query_interpretation: parsed?.query_interpretation ?? query,
      properties,
      count: properties.length,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Base search failed'
    console.error('[aria/base]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
