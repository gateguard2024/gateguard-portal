/**
 * GateGuard MONTHLY RECURRING pricing model — SERVER ONLY. Model "v16".
 *
 * Revenue (customer bill) = graduated per-unit tiers + an included gate/camera
 * allotment + per-item add-ons, floored to a whole-deal Gate Guard minimum and
 * rounded down to the dollar.
 *
 * Distribution = FLAT PER-UNIT commissions, capped: dealer $3/unit, sales
 * $1/unit, distribution $1/unit. Gate Guard keeps everything left after cost.
 *
 * Cost = the real recurring cost sheet (Brivo site + tiered entry-point licenses
 * + smart locks + Eagle Eye NVR + per-camera stack + cellular).
 *
 * GG cost + net are proprietary — returned only when `internal` (corporate).
 * A one-time / install-fee section is intentionally NOT here yet (coming next).
 * Imported only by /api/pricing/compute.
 */

// ── Revenue (v14 engine, locked) ─────────────────────────────────────────────
const TIERS: Array<[number, number]> = [[100, 10], [300, 7], [600, 5], [Infinity, 3]]
const INCL_GATES_PER_100 = 1.5
const INCL_CAMS_PER_100 = 1
const ADDON_GATE = 155
const ADDON_CAM_NEW = 91
const ADDON_CAM_EXISTING = 85

// ── Distribution — flat per-unit caps ────────────────────────────────────────
const DEALER_PER_UNIT = 3
const SALES_PER_UNIT = 1
const DIST_PER_UNIT = 1

// ── Real recurring cost sheet ────────────────────────────────────────────────
const COST_BRIVO_SITE = 90
const COST_ENTRY_TIER = { t1: 10, t2: 7, t3: 5 }   // 1st–2nd, 3rd–8th, 9+
const COST_SMART_LOCK = 3                            // per unit
const COST_NVR = 25                                  // Eagle Eye, per site
const COST_CAM_MONTHLY = 10                          // camera
const COST_CLOUD = 9                                 // cloud storage / camera
const COST_CALL_CENTER = 25                          // call center / camera
const COST_CELLULAR = 10                             // IOT ea
const COST_PER_CAMERA = COST_CAM_MONTHLY + COST_CLOUD + COST_CALL_CENTER   // $44

const GG_MIN_NET = 350

const round2 = (n: number) => Math.round(n * 100) / 100

function graduatedRevenue(units: number): number {
  let prev = 0, rev = 0
  for (const [cap, rate] of TIERS) {
    const upto = Math.min(units, cap)
    rev += Math.max(0, upto - prev) * rate
    prev = upto
    if (prev >= units) break
  }
  return rev
}

function tieredEntryCost(entryPoints: number): number {
  let c = 0
  for (let i = 1; i <= entryPoints; i++) c += i <= 2 ? COST_ENTRY_TIER.t1 : i <= 8 ? COST_ENTRY_TIER.t2 : COST_ENTRY_TIER.t3
  return c
}

export interface PricingInputs {
  livingUnits?: number | string
  entryPoints?: number | string
  cameras?: number | string
  cameraType?: 'new' | 'existing' | string
  smartLockUnits?: number | string
  cellular?: number | string
  // Legacy field names still accepted.
  doors?: number | string
  camMon?: number | string
  commonLocks?: number | string
}

export interface PricingResult {
  empty: boolean
  noUnits: boolean
  units: number
  entryPoints: number
  cameras: number
  cameraType: 'new' | 'existing'
  smartLockUnits: number
  cellular: number
  includedGates: number
  includedCameras: number
  extraGates: number
  extraCameras: number
  // customer-facing
  customerMonthly: number
  perUnit: number
  atFloor: boolean
  // distribution (dealer sees their own + channel)
  dealerCut: number
  salesCut: number
  distCut: number
  dealerPerUnit: number
  salesPerUnit: number
  distPerUnit: number
  // legacy callback fields
  ggFee: number                // GG net (internal) — 0 for dealers
  suggestedRetail: number      // = customerMonthly
  commission: number           // = sales + dist
  dealerProfit: number         // = dealerCut
  dealerMonthlyNet: number     // = dealerCut
  // internal-only
  ggCost?: number
  ggNet?: number
  margin?: number
  marginPerUnit?: number
  costBrivo?: number
  costEntry?: number
  costSmartLock?: number
  costNvr?: number
  costCameras?: number
  costCellular?: number
  perCameraCost?: number
}

export function computePricing(input: PricingInputs, internal: boolean): PricingResult {
  const n = (s: number | string | undefined) => Number(s) || 0
  const units = Math.max(0, n(input.livingUnits))
  const entryPoints = Math.max(0, n(input.entryPoints ?? input.doors))
  const cameras = Math.max(0, n(input.cameras ?? input.camMon))
  const smartLockUnits = Math.max(0, n(input.smartLockUnits ?? input.commonLocks))
  const cellular = Math.max(0, n(input.cellular))
  const cameraType: 'new' | 'existing' = input.cameraType === 'existing' ? 'existing' : 'new'
  const addonCamPrice = cameraType === 'existing' ? ADDON_CAM_EXISTING : ADDON_CAM_NEW

  // Revenue
  const gradRev = graduatedRevenue(units)
  const includedGates = units > 0 ? Math.max(1, (units * INCL_GATES_PER_100) / 100) : 0
  const includedCameras = units > 0 ? Math.max(1, (units * INCL_CAMS_PER_100) / 100) : 0
  const extraGates = Math.max(0, entryPoints - includedGates)
  const extraCameras = Math.max(0, cameras - includedCameras)
  const growth = gradRev + extraGates * ADDON_GATE + extraCameras * addonCamPrice

  // Cost (real sheet)
  const costBrivo = (entryPoints > 0 || smartLockUnits > 0) ? COST_BRIVO_SITE : 0
  const costEntry = tieredEntryCost(entryPoints)
  const costSmartLock = smartLockUnits * COST_SMART_LOCK
  const costNvr = cameras > 0 ? COST_NVR : 0
  const costCameras = cameras * COST_PER_CAMERA
  const costCellular = cellular * COST_CELLULAR
  const ggCost = costBrivo + costEntry + costSmartLock + costNvr + costCameras + costCellular

  // Distribution — flat per-unit caps
  const dealer = DEALER_PER_UNIT * units
  const sales = SALES_PER_UNIT * units
  const dist = DIST_PER_UNIT * units

  const floorBill = ggCost + dealer + sales + dist + GG_MIN_NET
  const atFloor = floorBill > growth
  const bill = Math.floor(Math.max(growth, floorBill))
  const ggNet = bill - dealer - sales - dist - ggCost
  const perUnit = units > 0 ? Math.floor(bill / units) : 0

  const result: PricingResult = {
    empty: units <= 0 && entryPoints <= 0 && cameras <= 0 && smartLockUnits <= 0,
    noUnits: units <= 0,
    units, entryPoints, cameras, cameraType, smartLockUnits, cellular,
    includedGates: Math.round(includedGates * 10) / 10,
    includedCameras: Math.round(includedCameras * 10) / 10,
    extraGates: Math.round(extraGates * 10) / 10,
    extraCameras: Math.round(extraCameras * 10) / 10,
    customerMonthly: bill,
    perUnit,
    atFloor,
    dealerCut: round2(dealer),
    salesCut: round2(sales),
    distCut: round2(dist),
    dealerPerUnit: DEALER_PER_UNIT,
    salesPerUnit: SALES_PER_UNIT,
    distPerUnit: DIST_PER_UNIT,
    ggFee: internal ? round2(ggNet) : 0,
    suggestedRetail: bill,
    commission: round2(sales + dist),
    dealerProfit: round2(dealer),
    dealerMonthlyNet: round2(dealer),
  }
  if (internal) {
    result.ggCost = round2(ggCost)
    result.ggNet = round2(ggNet)
    result.margin = round2(ggNet)
    result.marginPerUnit = units > 0 ? round2(ggNet / units) : 0
    result.costBrivo = costBrivo
    result.costEntry = round2(costEntry)
    result.costSmartLock = round2(costSmartLock)
    result.costNvr = costNvr
    result.costCameras = round2(costCameras)
    result.costCellular = round2(costCellular)
    result.perCameraCost = COST_PER_CAMERA
  }
  return result
}

export const PRICING_PUBLIC = {
  DEALER_PER_UNIT, SALES_PER_UNIT, DIST_PER_UNIT,
  ADDON_GATE, ADDON_CAM_NEW, ADDON_CAM_EXISTING,
  INCL_GATES_PER_100, INCL_CAMS_PER_100,
}
