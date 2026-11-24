import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { matchManagerPin, logManagerSession, MANAGER_COOKIE } from '@/lib/portal-manager'
import { pinLocked, recordPinFail, LOCKED_MSG, clientIp } from '@/lib/portal-lockout'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const dynamic = 'force-dynamic'

// SHA-256 of the passcode. Slug-independent so renaming a portal keeps its PIN.
// NOTE: not exported — Next.js route files may only export HTTP handlers + config.
function hashPortalPin(pin: string): string {
  return createHash('sha256').update(`gg-portal:${pin.trim()}`).digest('hex')
}

// The shared look-only code is remembered on this computer for 30 days.
// Managers: their personal PIN signs them in until they press Sign out (MANAGER_COOKIE).
const VIEW_COOKIE = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 30 }

// POST /api/portal/[slug]/verify  { pin } — the portal's entry screen. Takes EITHER
// the shared view code (look only) OR a manager's personal PIN — one PIN gets a
// manager in AND signs them in to control (Nov 24 2026) — no expiry; Sign out ends it.
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

  // The portal's own code = the Gate Guard PIN, or a manager's personal PIN: both let
  // you in AND sign you in (Gate Guard signs in as "Gate Guard"). matchManagerPin checks both.
  const h = hashPortalPin(String(pin))
  const manager = await matchManagerPin(params.slug, String(pin))
  if (!manager) {
    await recordPinFail(portal.site_id, clientIp(req.headers))
    return NextResponse.json({ error: 'That PIN isn’t right.' }, { status: 401 })
  }
  await logManagerSession(portal.site_id, 'in', manager, 'pin')
  // Signed in on this device until they press Sign out (signed session — see lib/portal-manager).
  const res = NextResponse.json({ ok: true, manager: manager.name })
  res.cookies.set(`pm_${params.slug}`, (manager as typeof manager & { session: string }).session, MANAGER_COOKIE)
  if (h === portal.access_pin) res.cookies.set(`pp_${params.slug}`, h, VIEW_COOKIE)
  return res
}
