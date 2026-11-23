/**
 * Vendor job link — PUBLIC (middleware bypass). The secret in the URL is the only access,
 * and it opens one job. Rules in lib/vendor-jobs.ts (migration 239).
 *   GET  /api/v/<secret> → what the vendor needs for this job (never prices / billing)
 *   POST /api/v/<secret> { action: accept | decline | request_date | on_the_way | arrived |
 *        note | photo_upload_url | photo | done | invoice_upload_url | invoice, … }
 */
import { NextRequest, NextResponse } from 'next/server'
import { resolveToken, vdb, vendorAct, vendorView } from '@/lib/vendor-jobs'

export const dynamic = 'force-dynamic'
const nostore = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const r = await resolveToken(params.token)
  if (!r) return NextResponse.json({ error: 'This link isn’t valid. Check you have the whole link, or ask Gate Guard to send it again.' }, { status: 404, headers: nostore })
  if ('gone' in r) return NextResponse.json({ error: r.gone, gone: true }, { status: 410, headers: nostore })
  const now = new Date().toISOString()
  const { error } = await vdb().from('work_order_subcontractors').update({ last_viewed_at: now, ...(r.link.first_viewed_at ? {} : { first_viewed_at: now }) }).eq('id', r.link.id)
  if (error) console.error('[vendor link] view stamp failed', error.message)
  return NextResponse.json(await vendorView(r), { headers: nostore })
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const r = await resolveToken(params.token)
  if (!r) return NextResponse.json({ error: 'This link isn’t valid.' }, { status: 404, headers: nostore })
  if ('gone' in r) return NextResponse.json({ error: r.gone, gone: true }, { status: 410, headers: nostore })
  const body = await req.json().catch(() => ({}))
  try {
    const out = await vendorAct(r, body, process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || req.nextUrl.origin)
    const fresh = await resolveToken(params.token)
    return NextResponse.json({ ok: true, ...out, view: fresh && !('gone' in fresh) ? await vendorView(fresh) : null }, { headers: nostore })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'That didn’t save — try again.' }, { status: 400, headers: nostore })
  }
}
