/**
 * GET /api/finance/session — is Finance locked for me? (Admin → Finance)
 * Corporate admins only; returns { state, owner, expires_at?, until? }.
 * Never refreshes the session — only real Finance use keeps it alive.
 */
import { NextRequest, NextResponse } from 'next/server'
import { financeStatus } from '@/lib/finance-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { status } = await financeStatus(req)
    if (status.state === 'not_allowed') return NextResponse.json({ error: 'Finance is for Gate Guard senior admins only.', state: status.state }, { status: 403 })
    return NextResponse.json(status)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Couldn’t check Finance.' }, { status: 500 })
  }
}
