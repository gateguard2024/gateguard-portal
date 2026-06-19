/**
 * POST /api/kb/part-image — find a picture of a device/part from the web,
 * with provenance, when we have no manual figure or catalog photo.
 * Body: { query: string }  ->  { image_url, source_url } | { image_url: null }
 * Uses Brave Image Search (BRAVE_API_KEY). Returns null gracefully if no key.
 * Auth: x-tech-code (field tool) OR Clerk.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth }         from '@clerk/nextjs/server'
import { isTechAuthed } from '@/lib/tech-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!(await isTechAuthed(req))) {
    let userId: string | null = null
    try { const s = await auth(); userId = s.userId } catch { /* no clerk */ }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const key = process.env.BRAVE_API_KEY
  if (!key) return NextResponse.json({ image_url: null, note: 'no BRAVE_API_KEY configured' })

  try {
    const { query } = await req.json()
    if (!query || !String(query).trim()) return NextResponse.json({ image_url: null })
    const url = `https://api.search.brave.com/res/v1/images/search?q=${encodeURIComponent(String(query).trim())}&count=3&safesearch=strict`
    const r = await fetch(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': key } })
    if (!r.ok) return NextResponse.json({ image_url: null })
    const d = await r.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = (d.results ?? []).find((x: any) => x?.properties?.url) ?? (d.results ?? [])[0]
    const image_url = first?.properties?.url ?? first?.thumbnail?.src ?? null
    const source_url = first?.url ?? null
    return NextResponse.json({ image_url, source_url })
  } catch {
    return NextResponse.json({ image_url: null })
  }
}
