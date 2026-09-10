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
  // Scope — each opening type splits into WORKING and NEEDS-REPAIR counts.
  // Working openings price at setup_per_working; repair openings at setup_per_repair.
  entry_gates_working?: number
  entry_gates_repair?: number
  exit_gates_working?: number
  exit_gates_repair?: number
  amenity_doors_working?: number
  amenity_doors_repair?: number
  door_label?: string       // singular noun for the door column: "amenity door" | "club room door"
  // Legacy total counts (pre-split). Still honored if the split fields are unused.
  entry_gates?: number
  exit_gates?: number
  amenity_doors?: number
  cameras?: number
  cameras_included?: boolean // cameras part of the BASE program (vs add-on only). Default: cameras > 0
  gate_note?: string        // "2 entry, 1 exit" | "damaged, repaired and brought online"
  camera_note?: string      // "gate, dumpster, pool" | "pool, front gate, and rear gate"
  openings_breakdown?: string // intro prose: "five vehicle gates, the pedestrian gate, and five amenity doors"
  scope_stats?: ScopeStat[] // override the scope grid entirely (up to 4). If absent, derived from counts.
  // Money — set-up pricing. Two modes (either/or):
  //   'condition' → working openings @ setup_per_working, repair openings @ setup_per_repair
  //   'flat'      → every opening @ setup_flat_per_opening (one rate, ignores condition)
  pricing_mode?: 'condition' | 'flat' // default 'condition'
  setup_flat_per_opening?: number // default 500 — flat mode rate per opening
  setup_fee?: number        // total override; if absent, computed from the mode above
  setup_per_working?: number // default 500 — a working opening
  setup_per_repair?: number  // default 750 — an opening that needs repair
  setup_per_point?: number  // legacy flat per-opening rate (fallback)
  setup_note?: string       // structure-paragraph detail, e.g. "$500 per access point across eight points"
  setup_cell_note?: string  // TERMS set-up cell description, e.g. "$500 per opening across all eleven, plus 3 cameras"
  // Add-ons — dealer chooses whether to offer each (rates editable per deal)
  offer_gate_coverage?: boolean // default true — show the gate & hinge coverage row
  offer_extra_cameras?: boolean // default true — show the extra-cameras row
  resident_fee?: number     // default 100 (per unit, at each lease signing & renewal)
  resident_fee_auto?: boolean // default true — auto-derive from the rough calculator (see residentFeeFromMonthly)
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
  workingOpenings: number
  repairOpenings: number
  gateNote: string
  cameraNote: string
  openingsBreakdown: string
  scopeStats: ScopeStat[]
  setupPerPoint: number
  setupPerWorking: number
  setupPerRepair: number
  pricingMode: 'condition' | 'flat'
  setupFlatPerOpening: number
  setupFee: number
  setupNote: string
  setupCellNote: string
  deposit: number
  goLive: number
  offerGateCoverage: boolean
  offerExtraCameras: boolean
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
  // Working vs needs-repair counts. If any split field is set, the split defines
  // the counts; otherwise fall back to the legacy totals (treated as all working).
  const hasSplit = [cfg.entry_gates_working, cfg.entry_gates_repair, cfg.exit_gates_working, cfg.exit_gates_repair, cfg.amenity_doors_working, cfg.amenity_doors_repair].some(v => v != null)
  const entryW = hasSplit ? n(cfg.entry_gates_working) : n(cfg.entry_gates)
  const entryR = n(cfg.entry_gates_repair)
  const exitW  = hasSplit ? n(cfg.exit_gates_working) : n(cfg.exit_gates)
  const exitR  = n(cfg.exit_gates_repair)
  const doorsW = hasSplit ? n(cfg.amenity_doors_working) : n(cfg.amenity_doors)
  const doorsR = n(cfg.amenity_doors_repair)

  const entryGates = entryW + entryR
  const exitGates = exitW + exitR
  const gates = entryGates + exitGates
  const amenityDoors = doorsW + doorsR
  const cameras = n(cfg.cameras)
  const accessPoints = gates + amenityDoors
  const workingOpenings = entryW + exitW + doorsW
  const repairOpenings = entryR + exitR + doorsR
  const units = n(quote?.units)

  const setupPerPoint = n(cfg.setup_per_point, 500)
  const setupPerWorking = n(cfg.setup_per_working ?? cfg.setup_per_point, 500)
  const setupPerRepair = n(cfg.setup_per_repair, 750)
  const pricingMode: 'condition' | 'flat' = cfg.pricing_mode === 'flat' ? 'flat' : 'condition'
  const setupFlatPerOpening = n(cfg.setup_flat_per_opening ?? cfg.setup_per_point, 500)
  const setupFee = cfg.setup_fee != null
    ? n(cfg.setup_fee)
    : pricingMode === 'flat'
      ? setupFlatPerOpening * accessPoints
      : (workingOpenings * setupPerWorking + repairOpenings * setupPerRepair)
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
  const doorLabel = String(cfg.door_label || 'amenity door')

  const plural = (nn: number, word: string) => `${word}${nn === 1 ? '' : 's'}`
  // "3 exit gates — one down today" — appends the down-count when any need repair.
  const downSuffix = (repair: number) => repair > 0 ? ` — ${repair === 1 ? 'one' : repair} down today` : ''
  const openLabel = (total: number, base: string, repair: number) => `${plural(total, base)}${downSuffix(repair)}`

  // Openings breakdown for the intro ("five vehicle gates, the pedestrian gate, and five amenity doors").
  const bdParts: string[] = []
  if (entryGates) bdParts.push(`${entryGates} ${plural(entryGates, 'entry gate')}`)
  if (exitGates) bdParts.push(`${exitGates} ${plural(exitGates, 'exit gate')}`)
  if (!entryGates && !exitGates && gates) bdParts.push(`${gates} ${plural(gates, 'vehicle gate')}`)
  if (amenityDoors) bdParts.push(`${amenityDoors} ${plural(amenityDoors, doorLabel)}`)
  const openingsBreakdown = String(
    cfg.openings_breakdown ||
    (bdParts.length > 1 ? bdParts.slice(0, -1).join(', ') + ' and ' + bdParts[bdParts.length - 1] : bdParts.join(''))
  )

  // Scope grid — explicit override wins; otherwise derive up to 3 scope columns + units,
  // auto-appending "— N down today" from the repair counts.
  const providedStats = (Array.isArray(cfg.scope_stats) ? cfg.scope_stats : [])
    .filter(s => (s?.num != null && s.num !== '') || (s?.label != null && String(s.label).trim() !== ''))
  let scopeStats: ScopeStat[]
  if (providedStats.length > 0) {
    scopeStats = providedStats.slice(0, 4)
  } else {
    const derived: ScopeStat[] = []
    if (entryGates && exitGates) {
      derived.push({ num: entryGates, label: openLabel(entryGates, 'entry gate', entryR) })
      derived.push({ num: exitGates, label: openLabel(exitGates, 'exit gate', exitR) })
    } else if (gates) {
      derived.push({ num: gates, label: openLabel(gates, 'vehicle gate', entryR + exitR) })
    }
    if (amenityDoors) derived.push({ num: amenityDoors, label: openLabel(amenityDoors, doorLabel, doorsR) })
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
    workingOpenings, repairOpenings,
    gateNote: String(cfg.gate_note || [entryGates ? `${entryGates} entry` : '', exitGates ? `${exitGates} exit` : ''].filter(Boolean).join(', ')),
    cameraNote,
    openingsBreakdown,
    scopeStats,
    setupPerPoint, setupPerWorking, setupPerRepair, pricingMode, setupFlatPerOpening, setupFee,
    setupNote: String(cfg.setup_note || (
      pricingMode === 'flat'
        ? (accessPoints ? `$${setupFlatPerOpening} per opening across all ${accessPoints} opening${accessPoints === 1 ? '' : 's'}` : '')
        : repairOpenings > 0
          ? `$${setupPerWorking} per working opening and $${setupPerRepair} per opening needing repair`
          : (accessPoints ? `$${setupPerWorking} per opening across all ${accessPoints} opening${accessPoints === 1 ? '' : 's'}` : '')
    )),
    setupCellNote: String(cfg.setup_cell_note || (
      pricingMode === 'flat'
        ? (accessPoints ? `$${setupFlatPerOpening} per opening across all ${accessPoints} opening${accessPoints === 1 ? '' : 's'}.` : '')
        : repairOpenings > 0
          ? `$${setupPerWorking} per working opening · $${setupPerRepair} per opening needing repair.`
          : (accessPoints ? `$${setupPerWorking} per opening across all ${accessPoints} opening${accessPoints === 1 ? '' : 's'}.` : '')
    )),
    offerGateCoverage: cfg.offer_gate_coverage != null ? !!cfg.offer_gate_coverage : true,
    offerExtraCameras: cfg.offer_extra_cameras != null ? !!cfg.offer_extra_cameras : true,
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

/**
 * Resident parking & amenity fee per unit, derived from the rough calculator's
 * $/unit/MONTH: annualize (×12, the fee covers a 12-month term), add 20%, then
 * round UP to the nearest $5. e.g. $8.50/mo → 102 → 122.40 → $125.
 */
export const residentFeeFromMonthly = (perUnitMonthly: number) => {
  const annualPlus = (Number(perUnitMonthly) || 0) * 12 * 1.2
  return Math.ceil(annualPlus / 5) * 5
}
