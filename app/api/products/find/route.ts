/**
 * POST /api/products/find — Part-Finder.
 * Look up a product from the web (part number / name) OR a pasted URL, and
 * return a PROPOSED product object (not saved) the user can confirm + edit.
 * On confirm the client posts it to /api/products, which auto-vectorizes the
 * manual. This route never writes anything.
 *
 * Body: { query?: string, url?: string }
 * ->   { proposed: {name, brand, model, sku, category, description,
 *          manual_url, image_url, spec_highlights[]}, sources: [{title,url}] }
 * Auth: Clerk session OR x-tech-code.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth }          from '@clerk/nextjs/server'
import Anthropic         from '@anthropic-ai/sdk'
import { isTechAuthed }  from '@/lib/tech-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

interface WebHit { title: string; url: string; snippet: string }

// Google Serper organic search. Returns [] if no key / on error.
async function serperSearch(query: string, count = 8): Promise<WebHit[]> {
  if (!process.env.SERPER_API_KEY) return []
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': process.env.SERPER_API_KEY },
      body: JSON.stringify({ q: query, num: count }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const d = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (d.organic ?? []).map((o: any) => ({ title: o.title ?? '', url: o.link ?? '', snippet: o.snippet ?? '' })).filter((h: WebHit) => h.url)
  } catch { return [] }
}

// Fetch a page and return readable-ish text (tags stripped), capped.
async function fetchPageText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GateGuardBot/1.0)' }, signal: AbortSignal.timeout(9000) })
    if (!res.ok) return ''
    const html = await res.text()
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000)
  } catch { return '' }
}

export async function POST(req: NextRequest) {
  if (!(await isTechAuthed(req))) {
    let userId: string | null = null
    try { const s = await auth(); userId = s.userId } catch { /* no clerk */ }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { query?: string; url?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const query = (body.query ?? '').trim()
  const url = (body.url ?? '').trim()
  if (!query && !url) return NextResponse.json({ error: 'Enter a part number / name, or paste a product URL.' }, { status: 400 })

  // Gather evidence: a pasted URL's page text, plus web search hits + a
  // manual-targeted search to surface install/PDF links.
  const hits: WebHit[] = []
  let pageText = ''
  const tasks: Promise<void>[] = []
  if (url) tasks.push(fetchPageText(url).then(t => { pageText = t; if (t) hits.push({ title: 'Pasted page', url, snippet: t.slice(0, 300) }) }))
  if (query) {
    tasks.push(serperSearch(`${query} access control OR gate OR camera OR intercom product`).then(h => { hits.push(...h) }))
    tasks.push(serperSearch(`${query} installation manual filetype:pdf`).then(h => { hits.push(...h) }))
  } else if (url) {
    tasks.push(serperSearch(`${url} installation manual`).then(h => { hits.push(...h) }))
  }
  await Promise.all(tasks)

  if (hits.length === 0 && !pageText) {
    return NextResponse.json({ error: 'No web results. Web search may be unconfigured — paste the product page URL, or add the product manually.', proposed: null, sources: [] })
  }

  // Candidate links: anything that looks like a manual PDF.
  const manualCandidates = hits.filter(h => /\.pdf($|\?)/i.test(h.url) || /(install|manual|guide|datasheet|spec)/i.test(`${h.title} ${h.url}`)).map(h => h.url).slice(0, 6)

  const evidence = [
    pageText ? `PASTED PAGE TEXT:\n${pageText}` : '',
    `SEARCH RESULTS:\n${hits.slice(0, 12).map(h => `- ${h.title}\n  ${h.url}\n  ${h.snippet}`).join('\n')}`,
    manualCandidates.length ? `LIKELY MANUAL/PDF LINKS:\n${manualCandidates.join('\n')}` : '',
  ].filter(Boolean).join('\n\n').slice(0, 12000)

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const m = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      system: `You identify a single security/access-control product (gate operator, camera, intercom, access reader, controller, lock, etc.) from web evidence, for a dealer catalog.
Respond ONLY with valid JSON, no prose:
{
  "name": "concise product name incl. brand + model",
  "brand": "manufacturer or null",
  "model": "model/part number or null",
  "sku": "part number if distinct from model, else null",
  "category": "Camera|Gate Operator|Intercom|Access Reader|Controller|Lock|Network|Other",
  "description": "one or two plain sentences",
  "manual_url": "best direct PDF/installation-manual URL from the evidence, or null — never invent one",
  "image_url": "a product image URL if present in evidence, else null — never invent one",
  "spec_highlights": ["short bullet", "short bullet"],
  "confidence": 0.0-1.0
}
Rules: Only use URLs that literally appear in the evidence. Prefer the manufacturer's own manual PDF for manual_url. If you cannot identify the product, set name to "" and confidence to 0.`,
      messages: [{ role: 'user', content: `Identify this product.\nQuery: ${query || '(none — use the pasted page)'}\nURL: ${url || '(none)'}\n\nEVIDENCE:\n${evidence}` }],
    })
    const raw = m.content[0]?.type === 'text' ? m.content[0].text : '{}'
    const jsonStart = raw.indexOf('{')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let proposed: any = null
    try { proposed = JSON.parse(jsonStart >= 0 ? raw.slice(jsonStart) : raw) } catch { proposed = null }
    if (!proposed || !proposed.name) {
      return NextResponse.json({ error: 'Could not confidently identify the product. Paste the product page URL or add it manually.', proposed: null, sources: hits.slice(0, 6).map(h => ({ title: h.title, url: h.url })) })
    }
    // Guard: only keep URLs that actually appeared in evidence.
    const allUrls = new Set([url, ...hits.map(h => h.url)].filter(Boolean))
    if (proposed.manual_url && !allUrls.has(proposed.manual_url) && !manualCandidates.includes(proposed.manual_url)) proposed.manual_url = null
    // image_url is left as-is — product images often live on CDNs not present in the result list.
    return NextResponse.json({ proposed, sources: hits.slice(0, 6).map(h => ({ title: h.title, url: h.url })) })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Lookup failed' }, { status: 500 })
  }
}
