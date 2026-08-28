/**
 * lib/partnership-proposal.ts — the GateGuard Property Partnership proposal model.
 *
 * The real proposal is a parameterized letter (see the Birch Landing / Laurel Hill
 * samples): one-time set-up fee, $0 ongoing to the property, and the program funded
 * by residents through a parking & amenity fee — OR, optionally, the property pays
 * those fees in bulk on a monthly basis instead of billing residents.
 *
 * This resolves a quote + its stored partnership config into every derived number
 * and label the renderer (and a PDF export) needs, so both share one source of truth.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Quote = Record<string, any>

export type BillingMode = 'resident' | 'property_monthly'

export interface PartnershipConfig {
  contact_name?: string
  contact_title?: string
  management_co?: string
  // Scope
  entry_gates?: number
  exit_gates?: number
  amenity_doors?: number
  cameras?: number
  gate_note?: string        // "2 entry, 1 exit" | "damaged, repaired and brought online"
  camera_note?: string      // "gate, dumpster, pool"
  // Money
  setup_fee?: number        // total; if absent, computed = setup_per_point × access points
  setup_per_point?: number  // default 500
  setup_note?: string       // structure-paragraph detail, e.g. "$500 per access point across eight points"
  resident_fee?: number     // default 100 (per unit, at each lease signing & renewal)
  billing_mode?: BillingMode
  property_monthly?: number // property_monthly mode: bulk monthly the property pays
  // Term + add-ons
  term_months?: number      // default 60
  addon_gate_hinge_rate?: number // default 150 /gate/mo
  addon_camera_rate?: number     // default 100 /camera/mo
  valid_days?: number       // default 30
}

export interface ResolvedPartnership {
  property: string
  address: string
  contactName: string
  contactFirst: string
  contactTitle: string
  managementCo: string
  units: number
  entryGates: number
  exitGates: number
  gates: number
  amenityDoors: number
  cameras: number
  accessPoints: number
  gateNote: string
  cameraNote: string
  setupPerPoint: number
  setupFee: number
  setupNote: string
  deposit: number
  goLive: number
  billingMode: BillingMode
  residentFee: number
  propertyMonthly: number
  termMonths: number
  termYears: number
  addonGateRate: number
  addonCameraRate: number
  addonGateTotal: number
  validDays: number
  preparedBy: string
}

const n = (v: unknown, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d }

export function resolvePartnership(quote: Quote, cfg: PartnershipConfig = {}): ResolvedPartnership {
  const entryGates = n(cfg.entry_gates)
  const exitGates = n(cfg.exit_gates)
  const gates = entryGates + exitGates
  const amenityDoors = n(cfg.amenity_doors)
  const cameras = n(cfg.cameras)
  const accessPoints = gates + amenityDoors
  const units = n(quote?.units)

  const setupPerPoint = n(cfg.setup_per_point, 500)
  const setupFee = cfg.setup_fee != null ? n(cfg.setup_fee) : setupPerPoint * accessPoints
  const deposit = Math.round(setupFee / 2)
  const goLive = setupFee - deposit

  const termMonths = n(cfg.term_months, 60)
  const residentFee = cfg.resident_fee != null ? n(cfg.resident_fee) : 100
  const addonGateRate = n(cfg.addon_gate_hinge_rate, 150)
  const addonCameraRate = n(cfg.addon_camera_rate, 100)

  const contactName = String(cfg.contact_name || quote?.client_name || '').trim()

  return {
    property: String(quote?.property_name || quote?.client_name || 'the Property'),
    address: String(quote?.property_address || ''),
    contactName,
    contactFirst: contactName ? contactName.split(' ')[0] : 'there',
    contactTitle: String(cfg.contact_title || ''),
    managementCo: String(cfg.management_co || ''),
    units,
    entryGates, exitGates, gates, amenityDoors, cameras, accessPoints,
    gateNote: String(cfg.gate_note || [entryGates ? `${entryGates} entry` : '', exitGates ? `${exitGates} exit` : ''].filter(Boolean).join(', ')),
    cameraNote: String(cfg.camera_note || ''),
    setupPerPoint, setupFee,
    setupNote: String(cfg.setup_note || (accessPoints ? `$${setupPerPoint} per access point across ${accessPoints} point${accessPoints === 1 ? '' : 's'}` : '')),
    deposit, goLive,
    billingMode: cfg.billing_mode === 'property_monthly' ? 'property_monthly' : 'resident',
    residentFee,
    propertyMonthly: n(cfg.property_monthly),
    termMonths, termYears: Math.max(1, Math.round(termMonths / 12)),
    addonGateRate, addonCameraRate, addonGateTotal: addonGateRate * gates,
    validDays: n(cfg.valid_days, 30),
    preparedBy: String(quote?.created_by_name || 'Russel Feldman'),
  }
}

export const money = (v: number) => '$' + Math.round(Number(v) || 0).toLocaleString()
