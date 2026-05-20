/**
 * POST /api/permits/[id]/upload
 * Step 1: Returns a signed Supabase Storage URL for direct browser-to-storage upload.
 * Step 2: After upload, call PATCH /api/permits/[id] with the updated documents array.
 *
 * Body: { filename: string, contentType: string }
 * Returns: { uploadUrl: string, publicUrl: string, path: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

const BUCKET = 'permit-docs'

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets()
  const exists = (buckets ?? []).some(b => b.name === BUCKET)
  if (!exists) {
    await supabase.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 20971520 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await getCurrentUser()
  await ensureBucket()

  const { filename, contentType } = await req.json()
  if (!filename) return NextResponse.json({ error: 'filename required' }, { status: 400 })

  const ext = filename.split('.').pop() ?? 'bin'
  const path = `${params.id}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create upload URL' }, { status: 500 })
  }

  // Also build a signed download URL (1 year TTL) — store this in documents jsonb
  const { data: dlData } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365)

  return NextResponse.json({
    uploadUrl: data.signedUrl,
    token: data.token,
    path,
    downloadUrl: dlData?.signedUrl ?? null,
    ext,
  })
}
