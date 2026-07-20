/**
 * GateGuard pricing model — SERVER ONLY. Locked model "v14".
 *
 * This is an EXACT port of the pricing calculator locked with Russel:
 * graduated per-unit tiers, an included gate/camera allotment, per-item add-ons,
 * a proportional channel split, a stepped platform cost, a whole-deal GateGuard
 * net floor, and whole-dollar customer rounding.
 *
 * GG cost + GG net are proprietary and are returned ONLY when `internal` is true
 * (corporate admins). Dealers get the customer price, per-unit, and their own /
 * the channel cut — never GateGuard's cost or margin. Imported only by
 * /api/pricing/compute (never a 'use client' component).
 */

// ── Locked v14 constants ─────────────────────────────────────────────────────
// Graduated base per-unit rate: [up-to-units, $/unit]. The last band covers the rest.
const TIERS: Array<[number, number]> = [[100, 10], [300, 7], [600, 5], [Infinity, 3]]
// Free with the base subscription, per 100 units.
const INCL_GATES_PER_100 = 1.5
const INCL_CAMS_PER_100 = 1
// Add-on entry point ($155): GG take $25 (of which $10 cost) · dist $1 · sales $4 · dealer $125.
const GATE = { gg: 25, cost: 10, dist: 1, sales: 4, dealer: 125 }
// Add-on camera — new, hardware included ($91): GG $85 ($55 cost) · dist $1 · sales $4 · dealer $1.
const CAM_NEW = { gg: 85, cost: 55, dist: 1, sales: 4, dealer: 1 }
// Add-on camera — monitor existing ($85): GG $70 ($45 cost) · dist $1 · sales $4 · dealer $10.
const CAM_EXIST = { gg: 70, cost: 45, dist: 1, sales: 4, dealer: 10 }
// Proportional split of the base graduated revenue.
const SPLIT = { gg: 0.50, dealer: 0.30, sales: 0.10, dist: 0.10 }
// GateGuard platform cost: base + a step per 100 units over the threshold.
const PLATFORM_BASE = 90, PLATFORM_THRESHOLD = 350, PLATFORM_STEP = 30, PLATFORM_BLOCK = 100
const COST_PER_GATE = 10          // GG cost per entry point
const GG_MIN_NET = 350            // whole-deal GateGuard net floor / month

const round2 = (n: number) => Math.round(n * 100) / 100

function graduatedRevenue(units: number): number {
  let prev = 0, rev = 0
  for (const [cap, rate] of TIERS) {
    const upto = Math.min(units, cap)
    const q = Math.max(0, upto - prev)
    rev += q * rate
    prev = upto
    if (prev >= units) break
  }
  return rev
}

export interface PricingInputs {
  livingUnits?: number | string
  entryPoints?: number | string
  cameras?: number | string
  cameraType?: 'new' | 'existing' | string
  // Legacy field names still accepted so old callers/persisted values map cleanly.
  doors?: number | string
  camMon?: number | string
}

// Dealer-safe fields always return. GG cost / net only when `internal`.
export interface PricingResult {
  empty: boolean
  noUnits: boolean
  units: number
  entryPoints: number
  cameras: number
  cameraType: 'new' | 'existing'
  includedGates: number
  includedCameras: number
  extraGates: number
  extraCameras: number
  gatePrice: number
  cameraPrice: number
  // customer-facing
  customerMonthly: number      // whole-dollar billed total
  perUnit: number              // floor(bill / units)
  atFloor: boolean             // the $350 whole-deal GG floor set the price
  // distribution (dealer sees their own + the channel; GG net is gated below)
  dealerCut: number
  salesCut: number
  distCut: number
  // legacy callback fields consumed by the opportunity Financials card
  ggFee: number                // GG net (internal) — 0 for dealers
  suggestedRetail: number      // = customerMonthly
  commission: number           // = sales + dist
  dealerProfit: number         // = dealerCut
  dealerMonthlyNet: number     // = dealerCut
  // internal-only (undefined for dealers)
  ggCost?: number
  ggNet?: number
  platformCost?: number
  margin?: number
  marginPerUnit?: number
}

export function computePricing(input: PricingInputs, internal: boolean): PricingResult {
  const n = (s: number | string | undefined) => Number(s) || 0
  const units = Math.max(0, n(input.livingUnits))
  const entryPoints = Math.max(0, n(input.entryPoints ?? input.doors))
  const cameras = Math.max(0, n(input.cameras ?? input.camMon))
  const cameraType: 'new' | 'existing' = input.cameraType === 'existing' ? 'existing' : 'new'
  const cam = cameraType === 'existing' ? CAM_EXIST : CAM_NEW

  const gradRev = graduatedRevenue(units)
  const includedGates = units > 0 ? Math.max(1, (units * INCL_GATES_PER_100) / 100) : 0
  const includedCameras = units > 0 ? Math.max(1, (units * INCL_CAMS_PER_100) / 100) : 0
  const extraGates = Math.max(0, entryPoints - includedGates)
  const extraCameras = Math.max(0, cameras - includedCameras)

  const gatePrice = GATE.gg + GATE.dist + GATE.sales + GATE.dealer          // 155
  const cameraPrice = cam.gg + cam.dist + cam.sales + cam.dealer            // 91 / 85
  const addonRev = extraGates * gatePrice + extraCameras * cameraPrice

  const blocks = units > PLATFORM_THRESHOLD ? Math.ceil((units - PLATFORM_THRESHOLD) / PLATFORM_BLOCK) : 0
  const platformCost = PLATFORM_BASE + blocks * PLATFORM_STEP
  const ggCost = platformCost + entryPoints * COST_PER_GATE + cameras * cam.cost

  const dealer = SPLIT.dealer * gradRev + extraGates * GATE.dealer + extraCameras * cam.dealer
  const sales = SPLIT.sales * gradRev + extraGates * GATE.sales + extraCameras * cam.sales
  const dist = SPLIT.dist * gradRev + extraGates * GATE.dist + extraCameras * cam.dist

  const growth = gradRev + addonRev
  const floorBill = ggCost + dealer + sales + dist + GG_MIN_NET
  const atFloor = floorBill > growth
  const bill = Math.floor(Math.max(growth, floorBill))          // customer rounds DOWN to the dollar
  const ggNet = bill - dealer - sales - dist - ggCost           // GG absorbs the rounding residual
  const perUnit = units > 0 ? Math.floor(bill / units) : 0

  const result: PricingResult = {
    empty: units <= 0 && entryPoints <= 0 && cameras <= 0,
    noUnits: units <= 0,
    units, entryPoints, cameras, cameraType,
    includedGates: Math.round(includedGates * 10) / 10,
    includedCameras: Math.round(includedCameras * 10) / 10,
    extraGates: Math.round(extraGates * 10) / 10,
    extraCameras: Math.round(extraCameras * 10) / 10,
    gatePrice, cameraPrice,
    customerMonthly: bill,
    perUnit,
    atFloor,
    dealerCut: round2(dealer),
    salesCut: round2(sales),
    distCut: round2(dist),
    ggFee: internal ? round2(ggNet) : 0,
    suggestedRetail: bill,
    commission: round2(sales + dist),
    dealerProfit: round2(dealer),
    dealerMonthlyNet: round2(dealer),
  }
  if (internal) {
    result.ggCost = round2(ggCost)
    result.ggNet = round2(ggNet)
    result.platformCost = platformCost
    result.margin = round2(ggNet)
    result.marginPerUnit = units > 0 ? round2(ggNet / units) : 0
  }
  return result
}

// Constants the dealer view can safely render as label text.
export const PRICING_PUBLIC = {
  GATE_PRICE: 155,
  CAM_NEW_PRICE: 91,
  CAM_EXISTING_PRICE: 85,
  INCL_GATES_PER_100,
  INCL_CAMS_PER_100,
}
