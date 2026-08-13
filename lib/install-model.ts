/**
 * lib/install-model.ts — one-time install / parts markup model.
 *
 * The chain (corporate-controlled, same for every dealer):
 *   base cost → +6% tax (corporate landed) → +10% override (dealer cost) → 2× base = full retail.
 * At 2× base cost the dealer sits at ~40% gross margin on parts.
 *
 * Labor is DEALER-controlled — Gate Guard only supplies defaults; each dealer sets
 * their own cost rate and bill/retail rate (varies by market).
 *
 * Numbers here are editable defaults. `verify: true` parts are placeholders pending
 * real corporate costs. Later these can move to the Pricing Console / DB.
 */
export const INSTALL_MARKUP = {
  tax: 0.06,          // corporate sales tax on parts
  override: 0.10,     // corporate's markup selling to the dealer
  retailMult: 2,      // recommended full retail = this × base cost
}

export interface InstallPart {
  key: string
  name: string
  baseCost: number
  optional?: boolean      // not required on every gate/door
  nonWorking?: boolean    // typically only for a non-working gate
  verify?: boolean        // placeholder cost — confirm with corporate
}

export const INSTALL_PARTS: InstallPart[] = [
  { key: 'controller', name: 'Door controller',       baseCost: 465 },
  { key: 'keypad',     name: 'Keypad',                baseCost: 321, optional: true },
  { key: 'cellular',   name: 'Cellular connectivity', baseCost: 200, optional: true, verify: true },
  { key: 'unifi',      name: 'UniFi connectivity',    baseCost: 180, optional: true, verify: true },
  { key: 'board',      name: 'Replacement board',     baseCost: 150, optional: true, nonWorking: true, verify: true },
  { key: 'entrapment', name: 'Entrapment device',     baseCost: 250, optional: true, nonWorking: true, verify: true },
  { key: 'welding',    name: 'Welding repair',        baseCost: 300, optional: true, nonWorking: true, verify: true },
]

// Dealer's default labor rates (they override these). $/hr.
export const DEFAULT_LABOR = { costRate: 45, retailRate: 125 }

// Standard recommended setup fee per gate/door (dealer may override). One source of
// truth shared by the proposal-builder install calc and the sales-tab install calc.
export const STANDARD_SETUP = { working: 500, nonWorking: 750 }

// Shared localStorage keys so a dealer's rates sync across BOTH install tools.
export const LS = {
  laborCost: 'gg_labor_cost_rate',
  laborRetail: 'gg_labor_retail_rate',
  setupWorking: 'gg_setup_working',
  setupNonWorking: 'gg_setup_nonworking',
} as const
export function loadRate(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback
  const v = Number(window.localStorage.getItem(key))
  return Number.isFinite(v) && v > 0 ? v : fallback
}
export function saveRate(key: string, value: number): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(key, String(value))
}

// Which parts the flat standard setup rate is assumed to already cover (controller
// + labor). Everything else is "additional equipment" itemized on top in the
// standard-plus mode.
export const BASE_PART_KEYS = ['controller']

export const corpCost   = (base: number) => round2(base * (1 + INSTALL_MARKUP.tax))
export const dealerCost = (base: number) => round2(base * (1 + INSTALL_MARKUP.tax) * (1 + INSTALL_MARKUP.override))
export const retailPrice = (base: number) => round2(base * INSTALL_MARKUP.retailMult)

export function round2(n: number): number { return Math.round((Number(n) || 0) * 100) / 100 }
