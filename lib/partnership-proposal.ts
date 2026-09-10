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

/** One column in the "Scope at …" grid. num may be a number or short string. */
export interface ScopeStat { num?: number | string; label?: string; sub?: string }

export interface PartnershipConfig {
  contact_name?: string
  contact_title?: string
  management_co?: string
  property_short?: string   // short name for headers + "walking me through X" ("The Halston", "Bridgewater")
  // Scope
  entry_gates?: number
  exit_gates?: number
  amenity_doors?: number
  cameras?: number
  cameras_included?: boolean // cameras part of the BASE program (vs add-on only). Default: cameras > 0
  gate_note?: string        // "2 entry, 1 exit" | "damaged, repaired and brought online"
  camera_note?: string      // "gate, dumpster, pool" | "pool, front gate, and rear gate"
  openings_breakdown?: string // intro prose: "five vehicle gates, the pedestrian gate, and five amenity doors"
  scope_stats?: ScopeStat[] // override the scope grid entirely (up to 4). If absent, derived from counts.
  // Money
  setup_fee?: number        // total; if absent, computed = setup_per_point × access points
  setup_per_point?: number  // default 500
  setup_note?: string       // structure-paragraph detail, e.g. "$500 per access point across eight points"
  setup_cell_note?: string  // TERMS set-up cell description, e.g. "$500 per opening across all eleven, plus 3 cameras"
  resident_fee?: number     // default 100 (per unit, at each lease signing & renewal)
  resident_fee_label?: string // TERMS 3rd-column header. Default "Resident fee — billed by us"
  billing_mode?: BillingMode
  property_monthly?: number // property_monthly mode: bulk monthly the property pays
  // Optional competitor-takeover section (e.g. "Gatewise")
  takeover_competitor?: string
  takeover_note?: string    // override paragraph; else built from the competitor name
  // Term + add-ons
  term_months?: number      // default 60
  addon_gate_hinge_rate?: number // default 150 /gate/mo
  addon_camera_rate?: number     // default 100 /camera/mo
  valid_days?: number       // default 30
}

export interface ResolvedPartnership {
  property: string
  propertyShort: string
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
  camerasIncluded: boolean
  accessPoints: number
  gateNote: string
  cameraNote: string
  openingsBreakdown: string
  scopeStats: ScopeStat[]
  setupPerPoint: number
  setupFee: number
  setupNote: string
  setupCellNote: string
  deposit: number
  goLive: number
  billingMode: BillingMode
  residentFee: number
  residentFeeLabel: string
  propertyMonthly: number
  takeoverCompetitor: string
  takeoverNote: string
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
  const property = String(quote?.property_name || quote?.client_name || 'the Property')
  const cameraNote = String(cfg.camera_note || '')
  const camerasIncluded = cfg.cameras_included != null ? !!cfg.cameras_included : cameras > 0

  const plural = (nn: number, word: string) => `${word}${nn === 1 ? '' : 's'}`

  // Openings breakdown for the intro ("five vehicle gates, the pedestrian gate, and five amenity doors").
  // Prefer the explicit override; otherwise assemble a plain-number phrase from the counts.
  const bdParts: string[] = []
  if (entryGates) bdParts.push(`${entryGates} ${plural(entryGates, 'entry gate')}`)
  if (exitGates) bdParts.push(`${exitGates} ${plural(exitGates, 'exit gate')}`)
  if (!entryGates && !exitGates && gates) bdParts.push(`${gates} ${plural(gates, 'vehicle gate')}`)
  if (amenityDoors) bdParts.push(`${amenityDoors} ${plural(amenityDoors, 'amenity door')}`)
  const openingsBreakdown = String(
    cfg.openings_breakdown ||
    (bdParts.length > 1 ? bdParts.slice(0, -1).join(', ') + ' and ' + bdParts[bdParts.length - 1] : bdParts.join(''))
  )

  // Scope grid — explicit override wins; otherwise derive up to 3 scope columns + units.
  // Only rows with a value count as an override (the editor holds 4 possibly-blank rows).
  const providedStats = (Array.isArray(cfg.scope_stats) ? cfg.scope_stats : [])
    .filter(s => (s?.num != null && s.num !== '') || (s?.label != null && String(s.label).trim() !== ''))
  let scopeStats: ScopeStat[]
  if (providedStats.length > 0) {
    scopeStats = providedStats.slice(0, 4)
  } else {
    const derived: ScopeStat[] = []
    if (entryGates && exitGates) {
      derived.push({ num: entryGates, label: plural(entryGates, 'entry gate') })
      derived.push({ num: exitGates, label: plural(exitGates, 'exit gate') })
    } else if (gates) {
      derived.push({ num: gates, label: plural(gates, 'vehicle gate') })
    }
    if (amenityDoors) derived.push({ num: amenityDoors, label: plural(amenityDoors, 'amenity door') })
    if (camerasIncluded && cameras) derived.push({ num: cameras, label: plural(cameras, 'monitored camera'), sub: cameraNote })
    scopeStats = [...derived.slice(0, 3), { num: units, label: 'residential units' }]
  }

  return {
    property,
    propertyShort: String(cfg.property_short || property),
    address: String(quote?.property_address || ''),
    contactName,
    contactFirst: contactName ? contactName.split(' ')[0] : 'there',
    contactTitle: String(cfg.contact_title || ''),
    managementCo: String(cfg.management_co || ''),
    units,
    entryGates, exitGates, gates, amenityDoors, cameras, camerasIncluded, accessPoints,
    gateNote: String(cfg.gate_note || [entryGates ? `${entryGates} entry` : '', exitGates ? `${exitGates} exit` : ''].filter(Boolean).join(', ')),
    cameraNote,
    openingsBreakdown,
    scopeStats,
    setupPerPoint, setupFee,
    setupNote: String(cfg.setup_note || (accessPoints ? `$${setupPerPoint} per access point across ${accessPoints} point${accessPoints === 1 ? '' : 's'}` : '')),
    setupCellNote: String(cfg.setup_cell_note || (accessPoints ? `$${setupPerPoint} per opening across all ${accessPoints} opening${accessPoints === 1 ? '' : 's'}.` : '')),
    deposit, goLive,
    billingMode: cfg.billing_mode === 'property_monthly' ? 'property_monthly' : 'resident',
    residentFee,
    residentFeeLabel: String(cfg.resident_fee_label || 'Resident fee — billed by us'),
    propertyMonthly: n(cfg.property_monthly),
    takeoverCompetitor: String(cfg.takeover_competitor || ''),
    takeoverNote: String(cfg.takeover_note || ''),
    termMonths, termYears: Math.max(1, Math.round(termMonths / 12)),
    addonGateRate, addonCameraRate, addonGateTotal: addonGateRate * gates,
    validDays: n(cfg.valid_days, 30),
    preparedBy: String(quote?.created_by_name || 'Russel Feldman'),
  }
}

export const money = (v: number) => '$' + Math.round(Number(v) || 0).toLocaleString()
