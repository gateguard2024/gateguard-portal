/**
 * GET /api/admin/costs — Gate Guard's cost model. CORPORATE ONLY.
 *
 * The security boundary for cost: returns 403 to anyone who isn't corporate, so
 * our true Brivo / Eagle Eye / hardware costs never leave the server for a
 * dealer. The recurring + install cost sheets come from lib/cost-sheet.ts (the
 * single source of truth). Step 4 adds PATCH (edit) + the dealer waterfall.
 */
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { RECURRING_COST_SHEET, INSTALL_PARTS_COST, DEALER_COST_MARGIN } from '@/lib/cost-sheet'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  // Corporate only. Everyone else is refused before any cost value is serialized.
  if (!user.isCorporate) {
    return NextResponse.json({ error: 'Forbidden — corporate only' }, { status: 403 })
  }
  return NextResponse.json({
    recurring: RECURRING_COST_SHEET,
    parts: INSTALL_PARTS_COST,
    dealer_cost_margin: DEALER_COST_MARGIN,
  })
}
