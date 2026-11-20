/**
 * GET /api/sites/[id]/spending — what this property costs us to service vs what its
 * plan brings in (lib/plan-spending.ts). GATE GUARD ONLY: dealers get 403 — they never
 * see plan margin or Gate Guard cost.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { planSpending } from '@/lib/plan-spending'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Gate Guard only' }, { status: 403 })
  try {
    const out = await planSpending(params.id)
    if (!out) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(out)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Couldn’t load spending' }, { status: 500 })
  }
}
