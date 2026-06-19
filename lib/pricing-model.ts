/**
 * GateGuard pricing model — SERVER ONLY.
 *
 * The Gate Guard COST constants (what GG pays Brivo / Eagle Eye) and the margin
 * model are proprietary. They must NEVER ship in the client bundle, so this file
 * is imported only by the /api/pricing/compute route — never by a 'use client'
 * component. See docs/nexus/PRICING_MODEL.md.
 */

const PASS_INCLUDED   = 500
const MARGIN_MIN      = 2.25
const MARGIN_TARGET   = 3.0
const UNIT_PRICE      = 5
const FLOOR_LIMIT     = 500
const OVERAGE_MARKUP  = 2
const ADDON_MARGIN    = 2     // unit door locks: GG cost + $2
const MSO_AGENT_PER_UNIT = 1  // commission carved from the retail markup → MSO + agent

const COST = {
  base: 89.25,
  doorS1: 11.10, doorS2: 9.0, doorS3: 3.72,
  commonLock: 2.25,
  unitPassApp: 2.25, unitGateway: 4.5,
  camera: 15,
  passBlock: 30,
}

function doorCost(doors: number): number {
  let c = 0
  for (let i = 1; i <= doors; i++) c += i <= 2 ? COST.doorS1 : i <= 12 ? COST.doorS2 : COST.doorS3
  return c
}

export interface PricingInputs {
  livingUnits?: number | string
  doors?: number | string
  commonLocks?: number | string
  unitsApp?: number | string
  unitsGw?: number | string
  camMon?: number | string
  camBackup?: number | string
  passesPerUnit?: number | string
}

// Dealer-safe fields are always returned. Cost/margin fields are returned only
// when `internal` is true (corporate admins).
export interface PricingResult {
  empty: boolean
  noUnits: boolean
  units: number
  sliding: boolean
  doors: number
  pricePerUnit: number
  equipFee: number
  perDoorFee: number
  appUnits: number
  gwUnits: number
  appPrice: number
  gwPrice: number
  appAddon: number
  gwAddon: number
  dealerPrice: number          // = ggFee (what the dealer pays GG)
  ggFee: number
  suggestedRetail: number
  commission: number
  dealerProfit: number         // suggestedRetail − ggFee − commission
  dealerMonthlyNet: number     // same as dealerProfit; kept for the Financials card
  msoAgentPerUnit: number
  // internal-only (undefined for dealers)
  ggCost?: number
  accessCost?: number
  unitLockCost?: number
  margin?: number
  marginPerUnit?: number
}

export function computePricing(input: PricingInputs, internal: boolean): PricingResult {
  const n = (s: number | string | undefined) => Number(s) || 0
  const appUnits = n(input.unitsApp), gwUnits = n(input.unitsGw)
  const doorsN   = n(input.doors)
  const cameras  = n(input.camMon) + n(input.camBackup)
  const commonLocks = n(input.commonLocks)
  const hasBrivo = doorsN > 0 || commonLocks > 0 || appUnits > 0 || gwUnits > 0
  const units    = n(input.livingUnits) || (appUnits + gwUnits)
  const passesPerUnit = input.passesPerUnit != null && input.passesPerUnit !== '' ? n(input.passesPerUnit) : 1.5
  const passes   = hasBrivo ? units * passesPerUnit : 0
  const passBlocks = Math.ceil(Math.max(0, passes - PASS_INCLUDED) / 100)

  // ── Access bucket ($5/unit model) ──────────────────────────────────────────
  const accessCost =
    (hasBrivo ? COST.base : 0) +
    doorCost(doorsN) +
    commonLocks * COST.commonLock +
    cameras * COST.camera +
    passBlocks * COST.passBlock
  const accessCostPerUnit = units > 0 ? accessCost / units : 0
  let pricePerUnit = 0
  if (units > 0) {
    pricePerUnit = units <= FLOOR_LIMIT
      ? UNIT_PRICE
      : Math.max(accessCostPerUnit + MARGIN_MIN, Math.min(UNIT_PRICE, accessCostPerUnit + MARGIN_TARGET))
  }
  const budget   = units * Math.max(0, pricePerUnit - MARGIN_MIN)
  const overage  = Math.max(0, accessCost - budget)
  const equipFee = overage * OVERAGE_MARKUP
  const overModel = equipFee > 0
  const perDoorFee = overModel && doorsN > 0 ? equipFee / doorsN : 0
  const accessRevenue = pricePerUnit * units + equipFee

  // ── Unit-lock add-ons (always cost + $2) ───────────────────────────────────
  const appPrice = COST.unitPassApp + ADDON_MARGIN   // $4.25
  const gwPrice  = COST.unitGateway + ADDON_MARGIN   // $6.50
  const appAddon = appUnits * appPrice
  const gwAddon  = gwUnits * gwPrice
  const addonCost = appUnits * COST.unitPassApp + gwUnits * COST.unitGateway
  const addonRevenue = appAddon + gwAddon

  const ggCost      = accessCost + addonCost
  const dealerPrice = accessRevenue + addonRevenue
  const margin      = dealerPrice - ggCost
  const marginPerUnit = units > 0 ? margin / units : 0

  const ggFee = dealerPrice
  const suggestedRetail = ggFee * 2
  const commission = units * MSO_AGENT_PER_UNIT
  const dealerProfit = suggestedRetail - ggFee - commission

  const result: PricingResult = {
    empty: ggCost === 0,
    noUnits: units === 0,
    units,
    sliding: units > FLOOR_LIMIT,
    doors: doorsN,
    pricePerUnit,
    equipFee,
    perDoorFee,
    appUnits, gwUnits, appPrice, gwPrice, appAddon, gwAddon,
    dealerPrice,
    ggFee,
    suggestedRetail,
    commission,
    dealerProfit,
    dealerMonthlyNet: dealerProfit,
    msoAgentPerUnit: MSO_AGENT_PER_UNIT,
  }
  if (internal) {
    result.ggCost = ggCost
    result.accessCost = accessCost
    result.unitLockCost = addonCost
    result.margin = margin
    result.marginPerUnit = marginPerUnit
  }
  return result
}

// Constants the dealer view legitimately needs to render label text.
export const PRICING_PUBLIC = { OVERAGE_MARKUP, ADDON_MARGIN, MSO_AGENT_PER_UNIT }
