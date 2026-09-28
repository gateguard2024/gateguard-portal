/**
 * POST /api/roi/compute — partnership ROI / deal-profitability (server-side).
 *
 * The install COGS, profit, and ROI live in lib/roi-model.ts and are returned
 * ONLY to corporate. Everyone else gets the dealer-safe deal-sizing subset
 * (units, openings, set-up fee, P&A, annual resident revenue) — never GateGuard's
 * cost or margin. Same gate pattern as /api/pricing/compute.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCurrentUser } from '@/lib/current-user'
import { computeRoi, type RoiInputs } from '@/lib/roi-model'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: RoiInputs
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const user = await getCurrentUser()
  const full = computeRoi(body)

  if (user.isCorporate) {
    return NextResponse.json({ result: full, corporate: true })
  }

  // Dealer-safe subset — no COGS, profit, ROI, or cost breakdowns. Resident-facing
  // P&A figures are fine to show (they're what the resident pays).
  const { units, points, openings, setupFee, monthlyPA, annualResidentRevenue, residentPaTotal, paAdditionsPerUnitYr } = full
  return NextResponse.json({
    result: { units, points, openings, setupFee, monthlyPA, annualResidentRevenue, residentPaTotal, paAdditionsPerUnitYr },
    corporate: false,
  })
}
