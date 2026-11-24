/**
 * POST /api/portal/[slug]/manager/verify — personal manager sign-in.
 * Body { pin }. Matches an active portal_managers row by personal-PIN hash and sets
 * the pm_<slug> cookie (manager id) so control actions can name the person.
 * DELETE clears it (sign out).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { matchManagerPin, portalRowForSlug } from '@/lib/portal-manager'
import { pinLocked, recordPinFail, LOCKED_MSG, clientIp } from '@/lib/portal-lockout'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const body = await req.json().catch(() => ({}))
  const pin = String(body.pin || '').trim()
  if (!pin) return NextResponse.json({ error: 'Enter your personal PIN.' }, { status: 400 })

  const portal = await portalRowForSlug(params.slug) as { site_id: string | null } | null
  if (await pinLocked(portal?.site_id)) return NextResponse.json({ error: LOCKED_MSG }, { status: 429 })
  const manager = await matchManagerPin(params.slug, pin)
  if (!manager) {
    await recordPinFail(portal?.site_id, clientIp(req.headers))
    return NextResponse.json({ error: 'That PIN was not recognized.' }, { status: 401 })
  }

  // Log the sign-in (Settings → Managers shows "Last signed in" from these).
  if (portal?.site_id) {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { error } = await sb.from('site_events').insert({ site_id: portal.site_id, event_type: 'portal_sign_in', title: `${manager.name} signed in to the property portal`, metadata: { manager_id: manager.id, by: manager.name } })
    if (error) console.error('[portal sign-in] log failed:', error.message)
  }
  const res = NextResponse.json({ ok: true, name: manager.name })
  res.cookies.set(`pm_${params.slug}`, manager.id, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12,
  })
  return res
}

export async function DELETE(_req: NextRequest, { params }: { params: { slug: string } }) {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(`pm_${params.slug}`, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
  return res
}
