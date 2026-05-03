/**
 * POST /api/kb/process
 *
 * Upload a PDF manual, store it in Supabase Storage, chunk + embed it.
 * Accepts multipart/form-data:
 *   product_id   string  — UUID from products table
 *   file         File    — PDF binary
 *
 * OR JSON body with a pre-uploaded URL:
 *   product_id   string
 *   manual_url   string
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth }                       from '@clerk/nextjs/server'
import { processManual, serviceDb }   from '@/lib/vectorize'

// Allow 60 s execution for PDF chunking + embedding
export const maxDuration = 60
export const dynamic     = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const ct = req.headers.get('content-type') ?? ''

    let productId: string
    let pdfBuffer: Buffer
    let manualUrl: string

    if (ct.includes('multipart/form-data')) {
      const form      = await req.formData()
      productId       = form.get('product_id') as string
      const file      = form.get('file') as File | null

      if (!productId || !file) {
        return NextResponse.json({ error: 'product_id and file required' }, { status: 400 })
      }

      pdfBuffer = Buffer.from(await file.arrayBuffer())

      // Upload to Supabase Storage bucket "manuals"
      const db          = serviceDb()
      const storagePath = `${productId}/${file.name.replace(/\s+/g, '-').toLowerCase()}`

      const { error: uploadErr } = await db.storage
        .from('manuals')
        .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })
      if (uploadErr) throw new Error(`Storage: ${uploadErr.message}`)

      manualUrl = db.storage.from('manuals').getPublicUrl(storagePath).data.publicUrl

    } else {
      const body   = await req.json()
      productId    = body.product_id
      manualUrl    = body.manual_url
      if (!productId || !manualUrl) {
        return NextResponse.json({ error: 'product_id and manual_url required' }, { status: 400 })
      }

      // If it's a Supabase Storage URL, download directly via service role —
      // avoids HTTP 400/403 that a plain fetch() can hit on bucket policy.
      const STORAGE_PREFIX = '/storage/v1/object/public/manuals/'
      if (manualUrl.includes(STORAGE_PREFIX)) {
        const storagePath = manualUrl.split(STORAGE_PREFIX)[1]?.split('?')[0]
        const db          = serviceDb()
        const { data: fileBlob, error: dlErr } = await db.storage
          .from('manuals')
          .download(storagePath)
        if (dlErr || !fileBlob) throw new Error(`Storage download failed: ${dlErr?.message ?? 'no data'}`)
        pdfBuffer = Buffer.from(await fileBlob.arrayBuffer())
      } else {
        // External URL (e.g. manufacturer PDF link)
        const res = await fetch(manualUrl)
        if (!res.ok) throw new Error(`Fetch PDF failed: ${res.status}`)
        pdfBuffer = Buffer.from(await res.arrayBuffer())
      }
    }

    const result = await processManual({ productId, pdfBuffer, manualUrl })
    return NextResponse.json({ success: true, ...result })

  } catch (err: any) {
    console.error('[kb/process]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
