/**
 * POST /api/finance/lock — lock Finance now. Ends this session and any copy of it.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { clearSessionCookie, clientIp, isFinanceEligible, lock } from '@/lib/finance-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  const res = (body: object, status = 200) => { const r = NextResponse.json(body, { status }); clearSessionCookie(r); return r }
  if (!isFinanceEligible(user)) return res({ error: 'Finance is for Gate Guard senior admins only.' }, 403)
  try {
    const r = await lock(user, clientIp(req))
    return r.ok ? res({ ok: true }) : res({ error: r.error }, 500)
  } catch (e) {
    return res({ error: e instanceof Error ? e.message : 'Couldn’t lock Finance.' }, 500)
  }
}
