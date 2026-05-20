import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'
// Allow large image uploads — Vercel max is 4.5MB on hobby, 50MB on pro
export const maxDuration = 30

const BUCKET = 'survey-images'

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.find(b => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, {
      public:               true,
      fileSizeLimit:        20971520, // 20 MB
      allowedMimeTypes:     ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
    })
  }
}

// POST /api/surveys/[id]/upload-image
// Accepts multipart/form-data with:
//   file       — the image file (required)
//   device_id  — optional UUID to tag the image as belonging to a specific device
// Returns { url, device_id? }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  // Verify survey access
  const { data: survey } = await supabase
    .from('surveys')
    .select('org_id')
    .eq('id', params.id)
    .single()

  if (!survey) return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
  if (!user.isCorporate && !scope.ids.includes(survey.org_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await req.formData()
  const file     = formData.get('file') as File | null
  const deviceId = formData.get('device_id') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // Validate mime type
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif']
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type}. Use JPG, PNG, or WEBP.` }, { status: 400 })
  }

  await ensureBucket()

  // Build a clean path: survey_id / device_id (optional) / timestamp-random.ext
  const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const slug = deviceId ? `${params.id}/${deviceId}` : params.id
  const path = `${slug}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert:      false,
    })

  if (uploadErr) {
    console.error('[survey-upload]', uploadErr.message)
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

  return NextResponse.json({
    url:       publicUrl,
    device_id: deviceId ?? null,
    path,
  })
}
