/**
 * POST /api/sites/[id]/photo-upload-url
 *
 * Returns a Supabase Storage signed upload URL so the browser can PUT a site
 * photo / as-built drawing directly — no binary passes through Vercel.
 *
 * Body: { filename: string }
 * Response: { signedUrl, token, publicUrl, storagePath }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { filename } = await req.json()
    if (!filename) {
      return NextResponse.json({ error: 'filename is required' }, { status: 400 })
    }

    const safeName    = String(filename).replace(/\s+/g, '-').toLowerCase()
    const timestamp   = Date.now()
    const storagePath = `${params.id}/${timestamp}_${safeName}`
    const BUCKET      = 'site-photos'

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
    console.error('[site photo-upload-url]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
