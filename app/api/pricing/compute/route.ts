/**
 * POST /api/pricing/compute — Gate Guard pricing v2, server-side.
 * The cost sheet + distributor cut + GG net live in lib/pricing-model.ts and are
 * returned ONLY to corporate admins. Master-dealer-and-below get Dealer, Sales rep,
 * and one combined Gate Guard line (cost + net + distribution folded in).
 *
 * Body: v2 PricingInputs + optional { viewAsDealer?: boolean } (corporate preview).
 * ->    { result, canViewInternal, internalView }
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth }           from '@clerk/nextjs/server'
import { getCurrentUser } from '@/lib/current-user'
import { computePricing, type SmartPackage, type Cellular, type GgNetModel } from '@/lib/pricing-model'

export const dynamic = 'force-dynamic'

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const SMART: SmartPackage[] = ['none', 'lock', 'full']
const CELL: Cellular[] = ['none', 'relay', 'full']

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const user = await getCurrentUser()
  const canViewInternal = user.isCorporate && user.role === 'admin'
  const internalView = canViewInternal && body.viewAsDealer !== true

  const smartPackage = SMART.includes(body.smartPackage as SmartPackage) ? body.smartPackage as SmartPackage : 'none'
  const cellular = CELL.includes(body.cellular as Cellular) ? body.cellular as Cellular : 'none'
  // GG-net model is corporate-only; dealers always get 'min2' ($2/unit floor).
  const ggNetModel: GgNetModel = internalView && body.ggNetModel === 'double' ? 'double' : 'min2'

  const result = computePricing({
    livingUnits: num(body.livingUnits),
    entryPoints: num(body.entryPoints),
    camerasMonitored: num(body.camerasMonitored),
    camerasNonMonitored: num(body.camerasNonMonitored),
    smartPackage,
    cellular,
    dealerMaintainsEntry: body.dealerMaintainsEntry === true,
    ggNetModel,
  }, internalView)

  return NextResponse.json({ result, canViewInternal, internalView })
}
