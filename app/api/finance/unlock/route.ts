/**
 * POST /api/finance/unlock { code } — enter your 6-digit Finance code.
 * Corporate admins with a code only. 5 wrong tries → locked out 30 minutes (logged).
 * On success sets the gg_fin session cookie (httpOnly, sameSite strict).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { clientIp, setSessionCookie, unlock } from '@/lib/finance-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  const body = await req.json().catch(() => ({}))
  try {
    const r = await unlock(user, (body as { code?: unknown }).code, clientIp(req))
    if (!r.ok) return NextResponse.json({ error: r.error, locked_until: r.locked_until, tries_left: r.tries_left }, { status: r.status })
    const res = NextResponse.json({ ok: true, idle_minutes: r.idle })
    setSessionCookie(res, r.token, r.idle)
    return res
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Couldn’t unlock Finance.' }, { status: 500 })
  }
}
