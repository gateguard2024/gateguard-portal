/**
 * POST /api/portal/[slug]/manager/verify — personal manager sign-in.
 * Body { pin }. Matches an active portal_managers row by personal-PIN hash and sets
 * the pm_<slug> cookie (signed session, no expiry) so control actions can name the person.
 * DELETE = Sign out: logged, clears the session and the look-only code → PIN screen.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { matchManagerPin, portalRowForSlug, getPortalManager, logManagerSession, MANAGER_COOKIE } from '@/lib/portal-manager'
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

  await logManagerSession(portal?.site_id, 'in', manager, 'pin')
  const res = NextResponse.json({ ok: true, name: manager.name })
  res.cookies.set(`pm_${params.slug}`, (manager as typeof manager & { session: string }).session, MANAGER_COOKIE)
  return res
}

// DELETE = Sign out: logged, and the portal locks on this device (next person uses their own PIN).
export async function DELETE(req: NextRequest, { params }: { params: { slug: string } }) {
  const m = await getPortalManager(req, params.slug)
  if (m) {
    const portal = await portalRowForSlug(params.slug) as { site_id: string | null } | null
    await logManagerSession(portal?.site_id, 'out', m, 'button')
  }
  const res = NextResponse.json({ ok: true })
  const gone = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 0 }
  res.cookies.set(`pm_${params.slug}`, '', gone)
  res.cookies.set(`pp_${params.slug}`, '', gone)
  return res
}
