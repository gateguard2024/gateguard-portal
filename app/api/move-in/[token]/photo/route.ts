/**
 * POST /api/move-in/{token}/photo — resident's photo during move-in setup (multipart, field "photo").
 * Public, token-based. Stored in the private "resident-photos" bucket; only staff see it (signed URLs).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getInvite, updateInvite, PHOTO_BUCKET } from '@/lib/move-in'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_BYTES = 8 * 1024 * 1024
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' }

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const r = await getInvite(params.token)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.error === 'not_found' ? 404 : 410 })
  const { invite } = r
  if (!invite.details_confirmed_at) return NextResponse.json({ error: 'Confirm your details first.' }, { status: 400 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('photo')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No photo received.' }, { status: 400 })
  const ext = TYPES[file.type]
  if (!ext) return NextResponse.json({ error: 'Please use a JPG, PNG or HEIC photo.' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'That photo is too large (8 MB max).' }, { status: 400 })

  const path = `${invite.site_id}/${invite.id}.${ext}`
  const db = createServiceClient()
  if (invite.photo_path && invite.photo_path !== path) {
    // Keep only the current photo for an in-progress setup.
    await db.storage.from(PHOTO_BUCKET).remove([invite.photo_path])
  }
  const bytes = Buffer.from(await file.arrayBuffer())
  const { error } = await db.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: file.type, upsert: true })
  if (error) return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })

  await updateInvite(invite.id, { photo_path: path, photo_skipped: false, step: 'access', status: 'in_progress' })
  return NextResponse.json({ ok: true })
}
