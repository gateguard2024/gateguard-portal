/**
 * POST /api/nexus/opps/lead-window/[id]/attachment-url
 *
 * Returns a Supabase Storage signed upload URL so the browser uploads the file
 * directly (no binary through Vercel). After the PUT, the client calls the
 * lead-window POST with action 'add_attachment' to record it (scope-checked).
 *
 * Body: { filename }  →  { signedUrl, token, publicUrl, storagePath }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const BUCKET = 'lead-attachments'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user.canViewCRM) {
      return NextResponse.json({ error: 'CRM access denied.' }, { status: 403 })
    }

    const { filename } = await req.json()
    if (!filename) return NextResponse.json({ error: 'filename is required' }, { status: 400 })

    const safeName = String(filename).replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9._-]/g, '')
    const storagePath = `${params.id}/${Date.now()}_${safeName}`

    await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => { /* exists */ })

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath, { upsert: true })
    if (error) throw new Error(error.message)

    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl
    return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, publicUrl, storagePath })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Upload URL failed' }, { status: 500 })
  }
}
