/**
 * POST /api/sites/[id]/asbuilt   (multipart/form-data, field: "file")
 *
 * Reliable one-shot as-built / site-photo upload. The browser sends the file
 * straight here; the server uploads it with the service-role client's .upload()
 * (no fragile signed-URL + client-PUT dance) and records the site_events row in
 * the same request. Returns the created event or a descriptive error.
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
const BUCKET = 'site-photos'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser().catch(() => null)

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const safeName    = file.name.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9._-]/g, '')
    const storagePath = `${params.id}/${Date.now()}_${safeName || 'as-built'}`
    const bytes       = Buffer.from(await file.arrayBuffer())

    // Ensure bucket (idempotent), then upload directly via service role.
    await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => { /* exists */ })
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: file.type || 'application/octet-stream', upsert: true })
    if (upErr) {
      return NextResponse.json({ error: `Storage: ${upErr.message}` }, { status: 500 })
    }

    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl

    const { data, error } = await supabase
      .from('site_events')
      .insert({
        site_id:      params.id,
        org_id:       user?.isCorporate ? null : (user?.org_id ?? null),
        event_type:   'as_built',
        title:        file.name,
        description:  publicUrl,
        event_source: 'manual',
        severity:     'info',
      })
      .select()
      .single()
    if (error) {
      return NextResponse.json({ error: `Save: ${error.message}`, url: publicUrl }, { status: 500 })
    }

    return NextResponse.json({ ok: true, event: data, url: publicUrl }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed'
    console.error('[site asbuilt upload]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
