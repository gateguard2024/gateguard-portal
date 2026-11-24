import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { matchManagerPin } from '@/lib/portal-manager'
import { pinLocked, recordPinFail, LOCKED_MSG, clientIp } from '@/lib/portal-lockout'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const dynamic = 'force-dynamic'

// SHA-256 of the passcode. Slug-independent so renaming a portal keeps its PIN.
// NOTE: not exported — Next.js route files may only export HTTP handlers + config.
function hashPortalPin(pin: string): string {
  return createHash('sha256').update(`gg-portal:${pin.trim()}`).digest('hex')
}

// View access is remembered on this computer for 30 days (was 12 h — the portal locked
// overnight and pages half-loaded). Control (pm_ = signed-in manager) stays 12 h.
const VIEW_COOKIE = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 30 }
const COOKIE = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 12 }

// POST /api/portal/[slug]/verify  { pin } — the portal's entry screen. Takes EITHER
// the shared view code (look only) OR a manager's personal PIN — one PIN gets a
// manager in AND signs them in to control (Nov 24 2026). Sets 12 h cookies.
// 10 wrong tries in 15 min pauses sign-in for the portal (lib/portal-lockout.ts).
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const { pin } = await req.json().catch(() => ({}))
  if (!pin) return NextResponse.json({ error: 'Enter your PIN.' }, { status: 400 })

  const { data: portal } = await supabase
    .from('client_portals')
    .select('access_pin, status, site_id')
    .ilike('slug', params.slug)
    .maybeSingle()

  if (!portal || portal.status === 'disabled') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!portal.access_pin) return NextResponse.json({ ok: true }) // no gate configured
  if (await pinLocked(portal.site_id)) return NextResponse.json({ error: LOCKED_MSG }, { status: 429 })

  const h = hashPortalPin(String(pin))
  if (h === portal.access_pin) {
    const res = NextResponse.json({ ok: true })
    res.cookies.set(`pp_${params.slug}`, h, VIEW_COOKIE)
    return res
  }

  // A manager's personal PIN: let them in and sign them in.
  const manager = await matchManagerPin(params.slug, String(pin))
  if (!manager) {
    await recordPinFail(portal.site_id, clientIp(req.headers))
    return NextResponse.json({ error: 'That PIN isn’t right.' }, { status: 401 })
  }
  if (portal.site_id) {
    const { error } = await supabase.from('site_events').insert({ site_id: portal.site_id, event_type: 'portal_sign_in', title: `${manager.name} signed in to the property portal`, metadata: { manager_id: manager.id, by: manager.name } })
    if (error) console.error('[portal verify] sign-in log failed:', error.message)
  }
  const res = NextResponse.json({ ok: true, manager: manager.name })
  res.cookies.set(`pp_${params.slug}`, portal.access_pin, VIEW_COOKIE)
  res.cookies.set(`pm_${params.slug}`, manager.id, COOKIE)
  return res
}
