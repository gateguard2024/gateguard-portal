/**
 * GET /api/finance/outlook[?refresh=1] — the cash outlook (13 weeks + 12 months) and
 * the open-bill pay plan. Senior admins with Finance unlocked only (lib/finance-auth).
 * QuickBooks reads are cached 30 minutes; refresh=1 skips the cache.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireFinance, setSessionCookie } from '@/lib/finance-auth'
import { buildOutlook } from '@/lib/finance-outlook'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const gate = await requireFinance(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error, state: gate.state }, { status: gate.status })
  try {
    const r = await buildOutlook(req.nextUrl.searchParams.get('refresh') === '1')
    const res = r.ok ? NextResponse.json(r.data) : NextResponse.json({ error: r.error }, { status: 502 })
    setSessionCookie(res, gate.token, gate.idle)
    return res
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Couldn’t build the outlook.' }, { status: 500 })
  }
}
