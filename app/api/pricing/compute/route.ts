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
  // Three cost-visibility bands (server-side gate — omitted numbers never reach the client):
  //   corporate   → full sheet (cost, net, distribution, dealer, rep, customer)
  //   distributor → Master Agent / MSO: distribution + one "Gate Guard fee" (our cost + profit), no cost sheet
  //   dealer      → everyone below: one "Gate Guard fee" (our cost + profit + distribution)
  const naturalBand: 'corporate' | 'distributor' | 'dealer' =
    (user.isCorporate && user.role === 'admin') ? 'corporate'
      : (user.isMasterAgent || user.isMasterDealer) ? 'distributor'
        : 'dealer'
  const RANK: Record<string, number> = { corporate: 2, distributor: 1, dealer: 0 }
  const requested = typeof body.viewAs === 'string' ? String(body.viewAs) : (body.viewAsDealer === true ? 'dealer' : null)
  const band: 'corporate' | 'distributor' | 'dealer' =
    (requested && RANK[requested] != null && RANK[requested] <= RANK[naturalBand]) ? (requested as 'corporate' | 'distributor' | 'dealer') : naturalBand

  const smartPackage = SMART.includes(body.smartPackage as SmartPackage) ? body.smartPackage as SmartPackage : 'none'
  const cellular = CELL.includes(body.cellular as Cellular) ? body.cellular as Cellular : 'none'
  // GG-net model choice is corporate-only; everyone else is locked to 'min2' ($2/unit floor).
  const ggNetModel: GgNetModel = band === 'corporate' && body.ggNetModel === 'double' ? 'double' : 'min2'

  // Compute the full sheet server-side, then expose only what this band may see.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const full = computePricing({
    livingUnits: num(body.livingUnits),
    entryPoints: num(body.entryPoints),
    camerasMonitored: num(body.camerasMonitored),
    camerasNonMonitored: num(body.camerasNonMonitored),
    smartPackage,
    cellular,
    dealerMaintainsEntry: body.dealerMaintainsEntry === true,
    ggNetModel,
  }, true) as Record<string, any>

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base: Record<string, any> = {
    livingUnits: full.livingUnits, entryPoints: full.entryPoints, empty: full.empty,
    customerMonthly: full.customerMonthly, perUnit: full.perUnit,
    dealerCut: full.dealerCut, salesCut: full.salesCut, scale: full.scale,
    dealerFloorBinds: full.dealerFloorBinds, dealerPerUnit: full.dealerPerUnit,
    salesPerUnit: full.salesPerUnit, dealerEntryFloorRate: full.dealerEntryFloorRate,
    dealerMonthlyNet: full.dealerMonthlyNet,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: Record<string, any>
  if (band === 'corporate') result = full
  else if (band === 'distributor') result = { ...base, distCut: full.distCut, gateGuardFee: Math.round((Number(full.ggCost) + Number(full.ggNet)) * 100) / 100 }
  else result = { ...base, gateGuardCombined: full.gateGuardCombined }

  return NextResponse.json({ result, band, naturalBand, canPreviewLower: naturalBand !== 'dealer' })
}
