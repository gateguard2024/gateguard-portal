/**
 * lib/cost-sheet.ts — Gate Guard's true cost model. CORPORATE ONLY.
 *
 * Single source of truth for what Gate Guard actually pays: monthly platform
 * cost and one-time install hardware. Only ever imported server-side (the
 * corporate-gated /api/admin/costs route) so these numbers never reach a
 * dealer's browser. The recurring and install calculators use these same figures
 * to compute margin.
 *
 * Step 4 makes these editable (DB-backed) and adds the dealer waterfall:
 * our cost + 10% margin = dealer cost, then suggested retail.
 */

export interface CostLine {
  /** What the line is. */
  name: string
  /** How it's counted, for display. */
  unit: string
  /** Gate Guard's monthly cost, USD. */
  cost: number
}

export interface PartCost {
  /** Hardware item. */
  name: string
  /** Gate Guard's part cost, USD. */
  cost: number
  /** Install labor hours (for the install profit check). */
  hours: number
}

// Monthly recurring cost sheet.
export const RECURRING_COST_SHEET: CostLine[] = [
  { name: 'Brivo site fee', unit: 'per site', cost: 90 },
  { name: 'Entry point — 1st & 2nd', unit: 'per entry point', cost: 10 },
  { name: 'Entry point — 3rd–8th', unit: 'per entry point', cost: 7 },
  { name: 'Entry point — 9 and up', unit: 'per entry point', cost: 5 },
  { name: 'Smart lock', unit: 'per unit', cost: 3 },
  { name: 'Smart unit', unit: 'per unit', cost: 3 },
  { name: 'Eagle Eye NVR', unit: 'per device', cost: 25 },
  { name: 'Cloud storage', unit: 'per camera', cost: 9 },
  { name: 'Camera', unit: 'per camera', cost: 10 },
  { name: 'Gate Guard call center', unit: 'per camera', cost: 25 },
  { name: 'Cellular connection (IOT)', unit: 'each', cost: 10 },
]

// One-time install hardware cost + install hours.
export const INSTALL_PARTS_COST: PartCost[] = [
  { name: 'Router', cost: 130, hours: 1 },
  { name: '4-Port Switch', cost: 100, hours: 0.5 },
  { name: '8-Port Switch', cost: 200, hours: 1 },
  { name: '24-Port Switch', cost: 800, hours: 2.5 },
  { name: 'PoE+ Inserter', cost: 15, hours: 0.25 },
  { name: 'PoE++ Inserter', cost: 30, hours: 0.25 },
  { name: 'PoE+++ Inserter', cost: 50, hours: 0.25 },
  { name: '24v Inserter', cost: 15, hours: 0.25 },
  { name: 'NSM5 Bridge', cost: 90, hours: 1 },
  { name: 'Wave AP', cost: 550, hours: 1.5 },
  { name: 'Cellular Radio', cost: 200, hours: 1 },
  { name: 'WiFi Radio', cost: 180, hours: 1 },
  { name: 'Power Relay', cost: 30, hours: 0.5 },
  { name: 'Gate Relay', cost: 30, hours: 0.5 },
  { name: 'Reflect Photobeam', cost: 140, hours: 1 },
  { name: 'Exit Photobeam', cost: 250, hours: 1.5 },
  { name: 'Wireless Loop', cost: 350, hours: 2 },
  { name: 'Worm Wheel', cost: 100, hours: 1 },
  { name: 'QR Sign', cost: 100, hours: 0.5 },
  { name: 'Callbox', cost: 900, hours: 2.5 },
  { name: 'Single Door Controller', cost: 450, hours: 0.5 },
  { name: 'Card Reader', cost: 310, hours: 0.5 },
]

/** Dealer-cost margin applied on top of Gate Guard's cost (step 4 waterfall). */
export const DEALER_COST_MARGIN = 0.10
