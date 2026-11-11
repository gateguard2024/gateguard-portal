/**
 * POST /api/maintenance/[id]/photo-upload-url
 *
 * Returns a Supabase Storage signed upload URL so the browser can PUT
 * the image directly — no binary data passes through Vercel.
 *
 * Body: { filename: string }
 * Response: { signedUrl, publicUrl, storagePath }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardWorkOrder } from '@/lib/ops-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await guardWorkOrder(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    const { filename } = await req.json()
    if (!filename) {
      return NextResponse.json({ error: 'filename is required' }, { status: 400 })
    }

    // Storage only takes plain names: accents → plain letters, anything else (#, &, (), ',
    // emoji, the odd spaces Macs/phones put in names) → "-". Keep the extension.
    const raw         = String(filename).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const dot         = raw.lastIndexOf('.')
    const ext         = (dot > 0 ? raw.slice(dot + 1) : 'jpg').replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg'
    const base        = (dot > 0 ? raw.slice(0, dot) : raw).replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'photo'
    const safeName    = `${base}.${ext}`
    const timestamp   = Date.now()
    const storagePath = `${params.id}/${timestamp}_${safeName}`
    const BUCKET      = 'work-order-photos'

    // Ensure bucket exists (idempotent)
    await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {/* already exists */})

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: true })

    if (error) throw new Error(`Signed URL: ${error.message}`)

    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl

    return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, publicUrl, storagePath })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[photo-upload-url]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
