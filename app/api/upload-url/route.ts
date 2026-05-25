/**
 * POST /api/upload-url
 *
 * Generic signed upload URL for any file type.
 * The browser PUTs the file directly to Supabase Storage.
 *
 * Body:
 *   filename     string  — full storage path (e.g. "org-attachments/uuid/timestamp_file.pdf")
 *   content_type string  — MIME type
 *   bucket       string? — bucket name (defaults to "attachments")
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { filename, content_type, bucket: bucketName = 'attachments' } = await req.json() as {
      filename: string
      content_type: string
      bucket?: string
    }

    if (!filename) return NextResponse.json({ error: 'filename is required' }, { status: 400 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Ensure bucket exists (idempotent)
    await supabase.storage
      .createBucket(bucketName, { public: true })
      .catch(() => { /* already exists */ })

    // Create signed upload URL (valid 10 minutes)
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUploadUrl(filename, { upsert: true })

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'Could not create upload URL' }, { status: 500 })
    }

    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucketName}/${filename}`

    return NextResponse.json({
      upload_url: data.signedUrl,
      public_url: publicUrl,
      token: data.token,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
