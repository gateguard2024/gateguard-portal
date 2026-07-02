/**
 * POST /api/design/plans/[id]/background  (multipart/form-data, field: "file")
 *
 * Reliable one-shot background upload for a design (floor-plan image or a
 * PDF page-1 rasterized to an image on the client). The browser sends the file
 * straight here; the server uploads it with the service-role client's .upload()
 * (no fragile signed-URL + client-PUT dance) and writes floor_plans.file_url.
 * Returns the public URL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, isInScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = 'design-plans'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Scope check on the plan.
    const { data: plan } = await supabase
      .from('floor_plans')
      .select('id, org_id')
      .eq('id', params.id)
      .single()
    if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const scope = await resolveOrgScope(user)
    if (!isInScope(scope, plan.org_id)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    const fileType = (form.get('file_type') as string) || 'image'

    const safeName = file.name.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9._-]/g, '')
    const storagePath = `${params.id}/${Date.now()}_${safeName || 'background'}`
    const bytes = Buffer.from(await file.arrayBuffer())

    await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {
      /* already exists */
    })
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      })
    if (upErr) {
      return NextResponse.json({ error: `Storage: ${upErr.message}` }, { status: 500 })
    }

    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl

    await supabase
      .from('floor_plans')
      .update({ file_url: publicUrl, file_type: fileType, updated_at: new Date().toISOString() })
      .eq('id', params.id)

    return NextResponse.json({ ok: true, url: publicUrl }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed'
    console.error('[design background upload]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
