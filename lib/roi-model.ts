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
  paOffset?: number           // added to monthlyPA in the revenue calc (default 0)
  dealerPerPoint?: number     // dealer monthly payroll per access point (default 100)
  salesRepPerUnit?: number    // default 0
  msoPerUnit?: number         // default 0
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
  // Corporate-only figures:
  startupCogs: number
  startupProfit: number       // set-up fee − startup COGS (can be negative)
  monthlyRevenue: number
  payroll: number
  monthlyCogs: number
  monthlyProfit: number
  annualProfit: number
  roiMonths: number           // 0 when already profitable at signing
  pass: boolean
  startupBreakdown: LineItem[]
  monthlyBreakdown: LineItem[]
  payrollBreakdown: LineItem[]
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
  const dealerPerPoint = n(input.dealerPerPoint, 100)
  const salesRepPerUnit = n(input.salesRepPerUnit)
  const msoPerUnit = n(input.msoPerUnit)
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

  // ── Monthly recurring ───────────────────────────────────────────────────────
  const monthlyRevenue = r2((units / divisor) * (monthlyPA + paOffset))

  const payrollBreakdown: LineItem[] = [
    { label: 'Dealer', amount: dealerPerPoint * points },
    { label: 'Sales rep', amount: salesRepPerUnit * units },
    { label: 'MSO', amount: msoPerUnit * units },
  ].map(l => ({ ...l, amount: r2(l.amount) })).filter(l => l.amount > 0)
  const payroll = r2(payrollBreakdown.reduce((s, l) => s + l.amount, 0))

  const monthlyBreakdown: LineItem[] = [
    { label: 'Brivo site fee', amount: 100 },
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

  return {
    units, points, openings, setupFee, monthlyPA,
    startupCogs, startupProfit,
    monthlyRevenue, payroll, monthlyCogs, monthlyProfit, annualProfit,
    roiMonths, pass,
    startupBreakdown, monthlyBreakdown, payrollBreakdown,
    annualResidentRevenue: r2(units * monthlyPA),
  }
}
