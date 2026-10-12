/**
 * lib/roi-model.ts — GateGuard partnership ROI / deal-profitability engine (SERVER-ONLY).
 *
 * A faithful port of the "Vinnings at Laurel Creek - ROI.xlsx" model. Given a
 * site's scope + the partnership terms (set-up fee, monthly P&A), it returns:
 *   - startupProfit  = set-up fee − one-time install COGS         (Work Sheet D6)
 *   - monthlyProfit  = monthly revenue − payroll − monthly COGS   (Work Sheet E6)
 *   - annualProfit   = monthlyProfit × 12
 *   - roiMonths      = −startupProfit / monthlyProfit             (months to recover)
 *   - pass           = roiMonths ≤ passThresholdMonths (default 4)
 *
 * Verified against the sheet (Vinnings): startup −$460, monthly $975.57,
 * annual $11,707, ROI 0.47 months, PASS.
 *
 * COST CONSTANTS ARE INTERNAL — never expose the breakdown to non-corporate users.
 */

export interface RoiInputs {
  units: number
  termMonths: number          // default 60
  setupFee: number            // one-time, paid by the property
  monthlyPA: number           // resident parking & amenity, per unit (default 125)
  monthlyBulkFee?: number     // bulk fee per unit / month — billed at 100% penetration
  paOffset?: number           // added to monthlyPA in the revenue calc (default 0)
  dealerPerPoint?: number     // legacy flat per-point dealer pay (kept for back-compat)
  dealerPerGate?: number      // servicing dealer, per vehicle/exit gate (default 150)
  dealerPerDoor?: number      // servicing dealer, per pedestrian gate / amenity door (default 50)
  salesRepPerUnit?: number    // sales rep pay, $/unit/month (×12 → added to P&A)
  msoPerUnit?: number         // MSO pay, $/unit/month (×12 → added to P&A)
  packagePerUnit?: number     // package-room solution, $/unit/month (×12 → added to P&A)
  // Scope — gates & doors split working / non-working
  workingVehGates?: number
  nonWorkingVehGates?: number
  workingPedGates?: number
  nonWorkingPedGates?: number
  workingAccessDoors?: number
  nonWorkingAccessDoors?: number
  exitGates?: number
  // Cameras
  existingCameras?: number
  newCameras?: number
  conversionCameras?: number
  monitoredCameras?: number
  recorders?: number
  // Security
  securityPanel?: number
  securityDoors?: number
  additionalDoors?: number
  additionalMotions?: number
  cell?: number
  // Policy
  revenueDivisor?: number     // units ÷ this = billable units / month (default 14)
  passThresholdMonths?: number // default 4
}

export interface LineItem { label: string; amount: number }
export interface RoiResult {
  units: number
  points: number              // access points (gates + doors, working + non-working)
  openings: number            // points + exit gates (total physical openings)
  setupFee: number
  monthlyPA: number
  // Per-unit/month payouts, annualized (×12) and added onto the resident P&A fee.
  salesAnnualPerUnit: number
  msoAnnualPerUnit: number
  packageAnnualPerUnit: number
  paAdditionsPerUnitYr: number
  residentPaTotal: number     // base P&A + all additions, $/unit/year
  // Corporate-only figures:
  startupCogs: number
  startupProfit: number       // set-up fee − startup COGS (can be negative)
  monthlyRevenue: number
  bulkRevenue: number         // units × bulk fee, billed at 100% penetration
  paRevenue: number           // P&A @ 75% penetration × 80% pay ÷ 12
  dealerFee: number           // servicing fee (= parts) paid to the dealer, $/mo
  payroll: number
  monthlyCogs: number
  monthlyProfit: number
  annualProfit: number
  roiMonths: number           // 0 when already profitable at signing
  pass: boolean
  startupBreakdown: LineItem[]
  monthlyBreakdown: LineItem[]
  payrollBreakdown: LineItem[]
  revenueBreakdown: LineItem[]
  // Dealer-safe figures:
  annualResidentRevenue: number // units × monthlyPA (full-turnover P&A collected / yr)
}

const n = (v: unknown, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d }
const r2 = (v: number) => Math.round(v * 100) / 100

export function computeRoi(input: RoiInputs): RoiResult {
  const units = n(input.units)
  const setupFee = n(input.setupFee)
  const monthlyPA = n(input.monthlyPA, 125)
  const paOffset = n(input.paOffset)
  const dealerPerGate = n(input.dealerPerGate, 150) // vehicle + exit gates
  const dealerPerDoor = n(input.dealerPerDoor, 50)  // pedestrian gates + amenity doors
  const salesRepPerUnit = n(input.salesRepPerUnit)
  const msoPerUnit = n(input.msoPerUnit)
  const packagePerUnit = n(input.packagePerUnit)
  const divisor = n(input.revenueDivisor, 14) || 14
  const passThreshold = n(input.passThresholdMonths, 4)

  const wVeh = n(input.workingVehGates), nwVeh = n(input.nonWorkingVehGates)
  const wPed = n(input.workingPedGates), nwPed = n(input.nonWorkingPedGates)
  const wDoor = n(input.workingAccessDoors), nwDoor = n(input.nonWorkingAccessDoors)
  const exit = n(input.exitGates)
  const existCam = n(input.existingCameras), newCam = n(input.newCameras)
  const convCam = n(input.conversionCameras), monCam = n(input.monitoredCameras)
  const rec = n(input.recorders)
  const secPanel = n(input.securityPanel), secDoors = n(input.securityDoors)
  const addlDoors = n(input.additionalDoors), addlMotions = n(input.additionalMotions)
  const cell = n(input.cell)

  const vehGates = wVeh + nwVeh
  const points = wVeh + nwVeh + wPed + nwPed + wDoor + nwDoor
  const openings = points + exit

  // ── One-time install COGS (Work Sheet "Set Up" column) ──────────────────────
  const startupBreakdown: LineItem[] = [
    { label: 'Door controllers', amount: 450 * (points - exit) },
    { label: 'Readers', amount: 250 * (points - exit) },
    { label: 'Remote openers', amount: 150 * (vehGates - exit) },
    { label: 'Shelly kits', amount: 75 * vehGates },
    { label: 'Recorder', amount: 60 * rec },
    { label: 'New cameras', amount: 20 * newCam },
    { label: 'Analog / conversion cameras', amount: 100 * convCam },
    { label: 'Security base unit', amount: 350 * secPanel },
    { label: 'Security doors', amount: 45 * (secDoors + addlDoors) },
    { label: 'Security motions', amount: 65 * addlMotions },
    { label: 'Security cell radio', amount: 75 * cell },
  ].map(l => ({ ...l, amount: Math.max(0, r2(l.amount)) })).filter(l => l.amount > 0)
  const startupCogs = r2(startupBreakdown.reduce((s, l) => s + l.amount, 0))
  const startupProfit = r2(setupFee - startupCogs)

  // ── Monthly recurring revenue ───────────────────────────────────────────────
  // Bulk fee: every unit pays (100% penetration).
  const bulkPerUnit = n(input.monthlyBulkFee)
  const bulkRevenue = r2(units * bulkPerUnit)
  // P&A: assume 75% penetration; of those, 20% never pay (→ 80% pay); of the
  // payers, 1/12 pay in any given month. Net monthly factor = .75 × .80 ÷ 12.
  const PA_PENETRATION = 0.75
  const PA_PAY_RATE = 0.80
  const paMonthlyUnits = (units * PA_PENETRATION * PA_PAY_RATE) / 12
  const paRevenue = r2(paMonthlyUnits * (monthlyPA + paOffset))
  const monthlyRevenue = r2(bulkRevenue + paRevenue)
  const revenueBreakdown: LineItem[] = [
    { label: `Bulk fee (100% × ${units} units)`, amount: bulkRevenue },
    { label: 'P&A (75% pen. × 80% pay ÷ 12)', amount: paRevenue },
  ].map(l => ({ ...l, amount: r2(l.amount) })).filter(l => l.amount > 0)

  // Dealer pay — Servicing Fee AND Parts each = greater of $1.50/unit/mo
  // or ($150 per gate + $25 per additional door), where:
  //   gate           = vehicle entry + exit gates  (payGates)
  //   additional door = other gates/doors (ped + amenity)  (payDoors)
  // Both lines are paid to the servicing dealer. Package room costs $2/unit/mo.
  const payGates = vehGates + exit
  const payDoors = wPed + nwPed + wDoor + nwDoor
  const servicingPerUnit = 1.5 * units
  const servicingPerOpening = 150 * payGates + 25 * payDoors
  const dealerFee = r2(Math.max(servicingPerUnit, servicingPerOpening))
  const packageRoomCost = packagePerUnit > 0 ? 2 * units : 0
  const payrollBreakdown: LineItem[] = [
    { label: `Dealer servicing fee (max $1.50×${units} units vs $150×${payGates} gates + $25×${payDoors} doors)`, amount: dealerFee },
    { label: 'Parts — to dealer (same basis)', amount: dealerFee },
    { label: 'Sales rep', amount: salesRepPerUnit * units },
    { label: 'MSO', amount: msoPerUnit * units },
    { label: 'Package room ($2/unit)', amount: packageRoomCost },
  ].map(l => ({ ...l, amount: r2(l.amount) })).filter(l => l.amount > 0)
  const payroll = r2(payrollBreakdown.reduce((s, l) => s + l.amount, 0))

  const monthlyBreakdown: LineItem[] = [
    { label: 'Brivo site fee', amount: 180 },
    { label: 'Entry-point fee', amount: 8 * points },
    { label: 'Recorder', amount: 60 * rec },
    { label: 'Existing cameras', amount: 10 * (existCam + convCam) },
    { label: 'New cameras', amount: 18 * newCam },
    { label: 'Active review', amount: 25 * monCam },
    { label: 'Security cell', amount: 7 * cell },
    { label: 'Security monitoring', amount: 6 * rec },
  ].map(l => ({ ...l, amount: r2(l.amount) })).filter(l => l.amount > 0)
  const monthlyCogs = r2(monthlyBreakdown.reduce((s, l) => s + l.amount, 0))

  const monthlyProfit = r2(monthlyRevenue - payroll - monthlyCogs)
  const annualProfit = r2(monthlyProfit * 12)

  // ROI months to recover a start-up deficit. If start-up is already positive,
  // the deal is profitable at signing → 0 months. If monthly ≤ 0 it never pays back.
  let roiMonths: number
  if (startupProfit >= 0) roiMonths = 0
  else if (monthlyProfit <= 0) roiMonths = Infinity
  else roiMonths = r2(-startupProfit / monthlyProfit)
  const pass = roiMonths <= passThreshold

  // Per-unit/month payouts annualize (×12) and stack onto the resident P&A fee.
  const salesAnnualPerUnit = r2(salesRepPerUnit * 12)
  const msoAnnualPerUnit = r2(msoPerUnit * 12)
  const packageAnnualPerUnit = r2(packagePerUnit * 12)
  const paAdditionsPerUnitYr = r2(salesAnnualPerUnit + msoAnnualPerUnit + packageAnnualPerUnit)
  const residentPaTotal = r2(monthlyPA + paAdditionsPerUnitYr)

  return {
    units, points, openings, setupFee, monthlyPA,
    salesAnnualPerUnit, msoAnnualPerUnit, packageAnnualPerUnit, paAdditionsPerUnitYr, residentPaTotal,
    startupCogs, startupProfit,
    monthlyRevenue, bulkRevenue, paRevenue, dealerFee, payroll, monthlyCogs, monthlyProfit, annualProfit,
    roiMonths, pass,
    startupBreakdown, monthlyBreakdown, payrollBreakdown, revenueBreakdown,
    annualResidentRevenue: r2(units * residentPaTotal),
  }
}
