/**
 * POST /api/portal/[slug]/request-photo — photos on a service request made from the portal.
 *   { request_id, action: 'sign', file_name, content_type } → { signedUrl, url }   (browser uploads straight to storage)
 *   { request_id, action: 'attach', url }                    → adds "Photo: <url>" to the request
 * Same access as making the request (portal view). Only requests at THIS property made in the
 * last 2 hours, images only, up to 5 per request. Stored in the work-order-photos bucket under
 * requests/<request id>/ — staff see the links on the request in Operations → Requests.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { verifyPortal } from '@/lib/portal-auth'
import { photosOf } from '@/lib/portal-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const BUCKET = 'work-order-photos'

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
  const b = await req.json().catch(() => ({}))
  const id = String(b.request_id ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id) || !v.portal.site_id) return NextResponse.json({ error: 'request_id required' }, { status: 400 })
  const { data: r, error } = await db().from('wo_requests').select('id, site_id, description, created_at').eq('id', id).eq('site_id', v.portal.site_id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!r) return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
  if (Date.now() - Date.parse(r.created_at) > 2 * 3600_000) return NextResponse.json({ error: 'Photos can only be added right after making the request.' }, { status: 403 })
  const have = photosOf(r.description).length

  if (b.action === 'sign') {
    if (have >= 5) return NextResponse.json({ error: 'Up to 5 photos per request.' }, { status: 400 })
    const type = String(b.content_type ?? '')
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(type)) return NextResponse.json({ error: 'Photos only (JPG, PNG, WebP, HEIC).' }, { status: 400 })
    const ext = type.split('/')[1].replace('jpeg', 'jpg')
    const path = `requests/${id}/${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`
    const st = db().storage.from(BUCKET)
    const { data, error: sErr } = await st.createSignedUploadUrl(path, { upsert: false })
    if (sErr || !data) return NextResponse.json({ error: sErr?.message ?? 'Upload not available' }, { status: 500 })
    return NextResponse.json({ signedUrl: data.signedUrl, url: st.getPublicUrl(path).data.publicUrl })
  }
  if (b.action === 'attach') {
    const url = String(b.url ?? '')
    const base = db().storage.from(BUCKET).getPublicUrl(`requests/${id}/`).data.publicUrl
    if (!url.startsWith(base)) return NextResponse.json({ error: 'That photo isn’t for this request.' }, { status: 400 })
    if (have >= 5) return NextResponse.json({ error: 'Up to 5 photos per request.' }, { status: 400 })
    const description = `${(r.description ?? '').trim()}\nPhoto: ${url}`.trim()
    const { error: uErr } = await db().from('wo_requests').update({ description }).eq('id', id)
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
