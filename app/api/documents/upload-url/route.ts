/**
 * POST /api/documents/upload-url  { filename }
 * Returns a Supabase Storage signed upload URL in the "documents" bucket so the
 * browser PUTs the file directly (no binary through Vercel). Returns the public
 * URL + storage path to save on the org_documents row.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { filename } = await req.json().catch(() => ({}))
  if (!filename) return NextResponse.json({ error: 'filename is required' }, { status: 400 })

  const safe = String(filename).replace(/\s+/g, '-').replace(/[^\w.-]+/g, '').toLowerCase()
  const path = `${user.org_id ?? 'shared'}/${Date.now()}-${safe}`
  await db.storage.createBucket('documents', { public: true }).catch(() => {/* exists */})
  const { data, error } = await db.storage.from('documents').createSignedUploadUrl(path, { upsert: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { data: pub } = db.storage.from('documents').getPublicUrl(path)
  return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, storagePath: path, publicUrl: pub.publicUrl })
}
