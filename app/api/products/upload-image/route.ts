/**
 * POST /api/products/upload-image   (multipart/form-data: file, kind?, id?)
 *
 * Uploads a product image directly (no Serper) into the public `design-plans`
 * bucket under product-images/, so the canvas + PDF export can read it without
 * CORS/taint issues. `kind` is one of:
 *   general   → products.image_url                    (icon: catalog / invoice / proposal)
 *   placement → products.design_meta.placementImageUrl (symbol for basic drawings)
 *   wiring    → products.design_meta.wiringImageUrl     (line drawing: device + terminals)
 * If `id` is given, the URL is saved onto the product so the one catalog record
 * carries all three images.
 *
 * Returns { ok, url, kind } or { error }.
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

function extFor(file: File): string {
  const t = (file.type || '').toLowerCase()
  if (t.includes('svg')) return 'svg'
  if (t.includes('png')) return 'png'
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg'
  if (t.includes('webp')) return 'webp'
  const m = file.name.toLowerCase().match(/\.(svg|png|jpg|jpeg|webp)$/)
  return m ? m[1].replace('jpeg', 'jpg') : 'png'
}

function slugify(s: string): string {
  return (s || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 50) || 'product'
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file')
    const rawKind = ((form.get('kind') as string) || 'general').toLowerCase()
    const kind: 'general' | 'placement' | 'wiring' =
      rawKind === 'wiring' ? 'wiring' : rawKind === 'placement' ? 'placement' : 'general'
    const id = ((form.get('id') as string) || '').trim()
    const stem = slugify((form.get('name') as string) || id || 'product')
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const bytes = Buffer.from(await file.arrayBuffer())
    if (bytes.byteLength > 12_000_000) return NextResponse.json({ error: 'Image too large (max 12 MB)' }, { status: 413 })

    const supabase = serviceDb()
    await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => { /* exists */ })

    const ext = extFor(file)
    const path = `${PREFIX}/${stem}-${kind}-${Date.now().toString().slice(-6)}.${ext}`
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type || 'image/png',
      upsert: true,
    })
    if (upErr) return NextResponse.json({ error: `Storage: ${upErr.message}` }, { status: 500 })

    const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

    // Best-effort save onto the product record so the one catalog record carries
    // all three images (icon + placement + line drawing).
    if (id) {
      try {
        if (kind === 'general') {
          await supabase.from('products').update({ image_url: url }).eq('id', id)
        } else {
          const { data: cur } = await supabase.from('products').select('design_meta').eq('id', id).single()
          const meta = (cur?.design_meta && typeof cur.design_meta === 'object') ? cur.design_meta : {}
          const key = kind === 'wiring' ? 'wiringImageUrl' : 'placementImageUrl'
          await supabase.from('products').update({ design_meta: { ...meta, [key]: url } }).eq('id', id)
        }
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({ ok: true, url, kind }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed'
    console.error('[products upload-image]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
