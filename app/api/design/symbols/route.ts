/**
 * Device symbol image library (global, shared across all designs).
 *
 * GET  /api/design/symbols            → { symbols: { [deviceKey]: url } }
 * POST /api/design/symbols            (multipart/form-data: file, key)
 *      → uploads a product image for one device type to the public
 *        `design-plans` bucket at symbols/<key>.<ext>, returns { key, url }.
 *
 * These images are how a placed device is drawn on the canvas so the plan looks
 * like a real product drawing (dome cam looks like a dome cam, etc). No new
 * table — the bucket path IS the mapping (filename = device key).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = 'design-plans'
const PREFIX = 'symbols'

// key → filename stem is 1:1; store the ext so we can build the public URL.
function extFor(file: File): string {
  const t = (file.type || '').toLowerCase()
  if (t.includes('svg')) return 'svg'
  if (t.includes('png')) return 'png'
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg'
  if (t.includes('webp')) return 'webp'
  const m = file.name.toLowerCase().match(/\.(svg|png|jpg|jpeg|webp)$/)
  return m ? m[1].replace('jpeg', 'jpg') : 'png'
}

export async function GET() {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).list(PREFIX, { limit: 500 })
    if (error) return NextResponse.json({ symbols: {} })
    const symbols: Record<string, string> = {}
    for (const obj of data ?? []) {
      const stem = obj.name.replace(/\.(svg|png|jpg|jpeg|webp)$/i, '')
      const url = supabase.storage.from(BUCKET).getPublicUrl(`${PREFIX}/${obj.name}`).data.publicUrl
      // cache-bust with the updated timestamp so re-uploads refresh.
      const ts = obj.updated_at ? new Date(obj.updated_at).getTime() : 0
      symbols[stem] = ts ? `${url}?v=${ts}` : url
    }
    return NextResponse.json({ symbols })
  } catch {
    return NextResponse.json({ symbols: {} })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file')
    const rawKey = (form.get('key') as string) || ''
    const key = rawKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (!key) return NextResponse.json({ error: 'Missing device key' }, { status: 400 })
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const ext = extFor(file)
    const bytes = Buffer.from(await file.arrayBuffer())

    await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => { /* exists */ })

    // Remove any prior image for this key with a different extension so there's
    // exactly one file per device (list-based GET stays 1:1).
    for (const e of ['svg', 'png', 'jpg', 'webp']) {
      if (e !== ext) await supabase.storage.from(BUCKET).remove([`${PREFIX}/${key}.${e}`]).catch(() => {})
    }

    const path = `${PREFIX}/${key}.${ext}`
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type || 'image/png',
      upsert: true,
    })
    if (upErr) return NextResponse.json({ error: `Storage: ${upErr.message}` }, { status: 500 })

    const base = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    const url = `${base}?v=${Date.now()}`
    return NextResponse.json({ ok: true, key, url }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed'
    console.error('[design symbols upload]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
