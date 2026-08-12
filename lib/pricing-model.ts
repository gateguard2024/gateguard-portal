/**
 * lib/pricing-model.ts — Gate Guard pricing engine v2 (SERVER ONLY).
 *
 * Corporate sees the full breakdown (cost sheet + dealer/sales/distributor/GG net).
 * Master-dealer-and-below see only Dealer, Sales rep, and ONE combined Gate Guard
 * line (cost + net + distribution folded in) — never our cost or the distributor cut.
 *
 * Locked production GG-net model = "min2" ($2/unit floor). Corporate may pass 'double'.
 * Corporate may pass ggNetModel:'min2' to model the $2/unit floor instead.
 */
export type SmartPackage = 'none' | 'lock' | 'full'
export type Cellular = 'none' | 'relay' | 'full'
export type GgNetModel = 'double' | 'min2'

export interface PricingInputs {
  livingUnits: number
  entryPoints: number
  camerasMonitored: number
  camerasNonMonitored: number
  smartPackage: SmartPackage
  cellular: Cellular
  dealerMaintainsEntry: boolean
  ggNetModel?: GgNetModel        // corporate-only; dealers are always 'double'
}

// ── Cost sheet (v2) ──────────────────────────────────────────────────────────
const BRIVO_SITE = 90                               // flat per site
const ENTRY_T1 = 10, ENTRY_T2 = 8, ENTRY_T3 = 5     // entry points 1–2, 3–6, 7+
const CAM_BASE = 60, CAM_BASE_CAP = 20, CAM_EACH = 20, CAM_CALL = 25, CAM_SMALL = 50
const CELL_RELAY = 6, CELL_FULL = 60
const SMART_COST = 2.5                              // per unit × multiplier
// ── Distribution ─────────────────────────────────────────────────────────────
const DEALER_PER_UNIT = 3, SALES_PER_UNIT = 1, DIST_PER_UNIT = 1
const DEALER_MIN_PER_ENTRY = 150                    // dealer floor when maintaining
const GG_MIN_NET_PER_UNIT = 2
const SMART_DEALER_ADD = 0.25, SMART_PARTY_ADD = 0.10  // per unit × multiplier
// Small-property floor: the customer bill never drops below this. Dealer, sales,
// and distribution keep their computed minimums; the shortfall to reach the floor
// falls to Gate Guard (added to GG net).
const PROPERTY_MIN_MONTHLY = 1500

const round2 = (n: number) => Math.round(n * 100) / 100
const smartMult = (p: SmartPackage) => p === 'full' ? 2 : p === 'lock' ? 1 : 0

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function computePricing(input: PricingInputs, internal: boolean): Record<string, any> {
  const u   = Math.max(0, Math.round(input.livingUnits || 0))
  const ep  = Math.max(0, Math.round(input.entryPoints || 0))
  const mon = Math.max(0, Math.round(input.camerasMonitored || 0))
  const non = Math.max(0, Math.round(input.camerasNonMonitored || 0))
  const mult = smartMult(input.smartPackage)
  const su  = mult > 0 ? u : 0                       // smart units = living units

  // Gate Guard cost
  const costBrivo = (ep > 0 || su > 0) ? BRIVO_SITE : 0
  let costEntry = 0
  for (let i = 1; i <= ep; i++) costEntry += i <= 2 ? ENTRY_T1 : i <= 6 ? ENTRY_T2 : ENTRY_T3
  const totCam = mon + non
  let costCameras = 0
  if (totCam > 0 && totCam <= 2) costCameras = mon * CAM_SMALL + non * CAM_EACH
  else if (totCam > 0) costCameras = Math.ceil(totCam / CAM_BASE_CAP) * CAM_BASE + totCam * CAM_EACH + mon * CAM_CALL
  const costCellular = input.cellular === 'relay' ? CELL_RELAY : input.cellular === 'full' ? CELL_FULL : 0
  const costSmart = SMART_COST * mult * su
  const ggCost = round2(costBrivo + costEntry + costCameras + costCellular + costSmart)

  // Distribution — dealer is the anchor, everyone else scales to hold 3:1:1:2
  const dealerMin = DEALER_PER_UNIT * u
  const dealerFloor = input.dealerMaintainsEntry ? DEALER_MIN_PER_ENTRY * ep : 0
  const dealerBase = Math.max(dealerMin, dealerFloor)
  const scale = dealerMin > 0 ? dealerBase / dealerMin : 1
  const dealerAdd = SMART_DEALER_ADD * mult * su    // flat smart add-ons
  const partyAdd  = SMART_PARTY_ADD * mult * su
  const dealer = round2(dealerBase + dealerAdd)
  const sales  = round2(SALES_PER_UNIT * u * scale + partyAdd)
  const dist   = round2(DIST_PER_UNIT * u * scale + partyAdd)

  // GG net: locked 'double' for dealers; corporate may model 'min2'
  const model: GgNetModel = internal && input.ggNetModel === 'double' ? 'double' : 'min2'
  let ggNet = model === 'double'
    ? round2(2 * ggCost)                             // net = 2× cost → GG take = 3× cost
    : round2(GG_MIN_NET_PER_UNIT * u * scale + partyAdd)

  const empty = u === 0 && ep === 0 && totCam === 0
  // Small-property floor — dealer/sales/dist hold their minimums; the shortfall
  // needed to reach PROPERTY_MIN_MONTHLY falls to Gate Guard (its net).
  let bill = round2(ggCost + dealer + sales + dist + ggNet)
  const propertyMinBinds = !empty && bill < PROPERTY_MIN_MONTHLY
  if (propertyMinBinds) {
    ggNet = round2(ggNet + (PROPERTY_MIN_MONTHLY - bill))
    bill = PROPERTY_MIN_MONTHLY
  }
  // Round the per-unit fee UP to the nearest whole dollar; the rounding uplift
  // falls to Gate Guard (its net), same as the floor.
  if (u > 0) {
    const roundedBill = Math.ceil(bill / u) * u
    if (roundedBill > bill) { ggNet = round2(ggNet + (roundedBill - bill)); bill = roundedBill }
  }
  const gateGuardCombined = round2(bill - dealer - sales)   // the single dealer-facing GG line
  const perUnit = u > 0 ? round2(bill / u) : 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: Record<string, any> = {
    livingUnits: u, entryPoints: ep, empty,
    customerMonthly: bill, perUnit,
    dealerCut: dealer, salesCut: sales,
    gateGuardCombined,                              // dealers see this ONE Gate Guard number
    scale: round2(scale),
    dealerFloorBinds: dealerFloor > dealerMin,
    dealerPerUnit: DEALER_PER_UNIT, salesPerUnit: SALES_PER_UNIT,
    dealerEntryFloorRate: DEALER_MIN_PER_ENTRY,
    dealerMonthlyNet: dealer,
    propertyMin: PROPERTY_MIN_MONTHLY, propertyMinBinds,
  }
  if (internal) {
    result.ggCost = ggCost
    result.ggNet = ggNet
    result.ggNetModel = model
    result.distCut = dist
    result.distPerUnit = DIST_PER_UNIT
    result.smartMult = mult
    result.costBrivo = costBrivo
    result.costEntry = round2(costEntry)
    result.costCameras = round2(costCameras)
    result.costCellular = costCellular
    result.costSmart = round2(costSmart)
    result.camerasMonitored = mon
    result.camerasNonMonitored = non
  }
  return result
}
