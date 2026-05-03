/**
 * POST /api/kb/upload-url
 *
 * Returns a Supabase Storage signed upload URL so the browser can PUT
 * the PDF directly — no binary data ever passes through Vercel.
 *
 * Body (JSON):
 *   product_id  string  — UUID from products table
 *   filename    string  — original filename (used to build storage path)
 *
 * Response:
 *   signedUrl   string  — PUT to this URL with the raw PDF bytes
 *   publicUrl   string  — permanent public URL once upload is complete
 *   storagePath string  — path inside the "manuals" bucket
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth }                       from '@clerk/nextjs/server'
import { serviceDb }                  from '@/lib/vectorize'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { product_id, filename } = await req.json()

    if (!product_id || !filename) {
      return NextResponse.json(
        { error: 'product_id and filename are required' },
        { status: 400 },
      )
    }

    const safeName    = filename.replace(/\s+/g, '-').toLowerCase()
    const storagePath = `${product_id}/${safeName}`
    const db          = serviceDb()

    // Create a signed URL valid for 10 minutes.
    // upsert: true allows re-uploading a revised manual for the same product.
    const { data, error } = await db.storage
      .from('manuals')
      .createSignedUploadUrl(storagePath, { upsert: true })

    if (error) throw new Error(`Signed URL: ${error.message}`)

    const publicUrl = db.storage.from('manuals').getPublicUrl(storagePath).data.publicUrl

    return NextResponse.json({
      signedUrl:   data.signedUrl,
      token:       data.token,
      publicUrl,
      storagePath,
    })
  } catch (err: any) {
    console.error('[kb/upload-url]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
