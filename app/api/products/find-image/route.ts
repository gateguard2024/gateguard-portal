/**
 * POST /api/products/find-image   { name, brand?, id? }
 *
 * Auto-finds a product photo via Serper (Google Images), downloads it
 * server-side, and re-hosts it in the public `design-plans` bucket under
 * product-images/ (so the canvas + PDF export can read it without CORS/taint
 * issues). If `id` is given, also saves the URL to products.image_url so the
 * whole catalog benefits next time.
 *
 * Returns { url } or { error }.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const BUCKET = 'design-plans'
const PREFIX = 'product-images'

function serviceDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function slugify(s: string): string {
  return (s || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'product'
}

// Ask Serper for image results; return candidate image URLs (best first).
async function serperImages(query: string): Promise<string[]> {
  const key = (process.env.SERPER_API_KEY || '').trim()
  if (!key) return []
  try {
    const res = await fetch('https://google.serper.dev/images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': key },
      body: JSON.stringify({ q: query, num: 10 }),
    })
    if (!res.ok) return []
    const json = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.images ?? []).map((im: any) => im.imageUrl).filter(Boolean)
  } catch {
    return []
  }
}

// Download an image and upload it to the bucket. Returns the public URL or null.
async function rehost(imageUrl: string, stem: string): Promise<string | null> {
  try {
    const r = await fetch(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!r.ok) return null
    const type = (r.headers.get('content-type') || '').toLowerCase()
    if (!type.startsWith('image/')) return null
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('svg') ? 'svg' : 'jpg'
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.byteLength < 500 || buf.byteLength > 8_000_000) return null // skip junk / huge
    const supabase = serviceDb()
    await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {})
    const path = `${PREFIX}/${stem}-${Date.now().toString().slice(-6)}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: type, upsert: true })
    if (error) return null
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const name = String((body as Record<string, unknown>).name ?? '').trim()
    const brand = String((body as Record<string, unknown>).brand ?? '').trim()
    const id = String((body as Record<string, unknown>).id ?? '').trim()
    if (!name && !brand) return NextResponse.json({ error: 'name or brand required' }, { status: 400 })

    if (!process.env.SERPER_API_KEY) {
      return NextResponse.json({ error: 'Image search is not enabled (missing SERPER_API_KEY).' }, { status: 503 })
    }

    const query = `${brand} ${name} product photo`.trim()
    const candidates = await serperImages(query)
    if (candidates.length === 0) return NextResponse.json({ error: 'No images found.' }, { status: 404 })

    // Try candidates until one re-hosts successfully.
    let url: string | null = null
    for (const c of candidates.slice(0, 5)) {
      url = await rehost(c, slugify(`${brand}-${name}`))
      if (url) break
    }
    if (!url) return NextResponse.json({ error: 'Could not retrieve a usable image.' }, { status: 502 })

    // Save to the product catalog too (best-effort).
    if (id) {
      try { await serviceDb().from('products').update({ image_url: url }).eq('id', id) } catch { /* non-fatal */ }
    }

    return NextResponse.json({ ok: true, url }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Find image failed'
    console.error('[products find-image]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
