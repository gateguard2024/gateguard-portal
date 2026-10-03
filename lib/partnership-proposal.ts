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
  // Optional programs — each shown only if elected on the proposal/agreement.
  offer_smart_locks?: boolean
  smart_lock_resident_fee?: number      // resident P&A/unit/yr once smart locks elected (default 150)
  smart_lock_install_per_unit?: number  // property pays at each unit flip (default 375)
  offer_package_room?: boolean          // parcel/package room access on the same credential
  package_rooms?: number                // count of package/parcel rooms (informational)
  offer_lpr?: boolean                   // license-plate recognition cameras
  lpr_note?: string
  offer_bollards?: boolean              // bollard protection at operators
  bollards?: number                     // count installed (covered in the set-up fee)
  offer_concession_block?: boolean      // concession block add-on
  offer_resident_services?: boolean     // optional TV / internet / security / doorbell, resident-billed
  // Cap-rate value-creation panel — eliminated costs → NOI → property-value uplift.
  show_value_panel?: boolean            // default true when annual_savings > 0
  cap_rate?: number                     // percent, default 6
  annual_savings?: number               // estimated annual operating savings; default gates × 5000
  // Early-termination buyout (depreciation). Base = 1 yr P&A at 100% of units,
  // straight-line over buyout_months, $0 after. Protects GateGuard. Default 12 months.
  buyout_months?: number                // default 12
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
  // Optional programs
  offerSmartLocks: boolean
  smartLockResidentFee: number
  smartLockInstallPerUnit: number
  offerPackageRoom: boolean
  packageRooms: number
  offerLpr: boolean
  lprNote: string
  offerBollards: boolean
  bollards: number
  offerConcessionBlock: boolean
  offerResidentServices: boolean
  // Cap-rate value panel
  showValuePanel: boolean
  capRate: number
  annualSavings: number
  valueUplift: number
  // Early-termination buyout (depreciation)
  buyoutMonths: number
  buyoutBase: number
  buyoutMonthly: number
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

  // Optional programs
  const smartLockResidentFee = n(cfg.smart_lock_resident_fee, 150)
  const smartLockInstallPerUnit = n(cfg.smart_lock_install_per_unit, 375)

  // Cap-rate value creation: annual operating savings → property value at a cap rate.
  const capRate = n(cfg.cap_rate, 6)
  const annualSavings = cfg.annual_savings != null ? n(cfg.annual_savings) : gates * 5000
  const valueUplift = capRate > 0 ? Math.round(annualSavings / (capRate / 100)) : 0

  // Early-termination buyout (depreciation): base = one year of P&A at 100% of units,
  // depreciated straight-line over buyout_months (default 12), $0 owed thereafter.
  const buyoutMonths = n(cfg.buyout_months, 12)
  const buyoutBase = units * residentFee
  const buyoutMonthly = buyoutMonths > 0 ? Math.round(buyoutBase / buyoutMonths) : 0

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
    // Optional programs
    offerSmartLocks: !!cfg.offer_smart_locks,
    smartLockResidentFee, smartLockInstallPerUnit,
    offerPackageRoom: !!cfg.offer_package_room,
    packageRooms: n(cfg.package_rooms),
    offerLpr: !!cfg.offer_lpr,
    lprNote: String(cfg.lpr_note || ''),
    offerBollards: !!cfg.offer_bollards,
    bollards: n(cfg.bollards),
    offerConcessionBlock: !!cfg.offer_concession_block,
    offerResidentServices: !!cfg.offer_resident_services,
    // Cap-rate value panel
    showValuePanel: cfg.show_value_panel != null ? !!cfg.show_value_panel : annualSavings > 0,
    capRate, annualSavings, valueUplift,
    // Early-termination buyout (depreciation)
    buyoutMonths, buyoutBase, buyoutMonthly,
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

/**
 * Builds the email the rep sends to the client: the subject in the house format,
 * and an HTML + text body that IS the proposal (so nothing is copy-pasted). The
 * agreement is attached separately by the send route.
 */
export function buildProposalEmail(
  quote: Quote,
  cfg: PartnershipConfig = {},
  opts: { proposalLink?: string; agreementLink?: string } = {},
): { subject: string; html: string; text: string } {
  const r = resolvePartnership(quote, cfg)
  const repFirst = (String(quote?.created_by_name || r.preparedBy || '').trim().split(/\s+/)[0]) || 'Gate Guard'
  const contact = r.contactName || r.property
  const subject = `${contact} - Your gate and camera repair and maintenance proposal from ${repFirst} at Gate Guard.`

  const resident = r.billingMode === 'resident'
  const li = (t: string) => `<li style="margin:0 0 6px">${t}</li>`
  const delivers: string[] = [
    `All ${r.accessPoints} access points brought online and kept that way — parts, welding, and operator repair at install, in the set-up fee with no change orders.`,
    `Every repair for the full ${r.termYears}-year term — parts, labor, trip charges, and monthly preventative maintenance.`,
    `Proactive monitoring and remote reset, so your team is not dispatched for every bump.`,
    `Mobile access with PMS integration — no fobs or cards; move-ins and move-outs sync with Yardi, Entrata, or RealPage.`,
  ]
  if (r.camerasIncluded && r.cameras > 0) delivers.push(`${r.cameras} monitored camera${r.cameras === 1 ? '' : 's'}${r.cameraNote ? ` — ${r.cameraNote}` : ''}, so a struck gate can be attributed and pursued as a chargeback.`)
  if (r.offerPackageRoom) delivers.push(`Package ${r.packageRooms > 1 ? 'rooms' : 'room'} on the same credential — package access never depends on a circulated code.`)
  if (r.offerBollards) delivers.push(`Bollard protection${r.bollards ? ` (${r.bollards})` : ''} at the operators, installed in the set-up fee.`)
  delivers.push(`Resident support handled by GateGuard directly, so your leasing office is not the help desk.`)

  const addonLines: string[] = []
  if (r.offerGateCoverage) addonLines.push(`Physical gate &amp; hinge coverage — ${money(r.addonGateRate)} / gate / mo (${r.gates} gate${r.gates === 1 ? '' : 's'} = ${money(r.addonGateTotal)} / mo).`)
  if (r.offerExtraCameras) addonLines.push(`Additional monitored cameras — ${money(r.addonCameraRate)} / camera / mo.`)
  if (r.offerSmartLocks) addonLines.push(`Smart locks at turn — ${money(r.smartLockResidentFee)}/unit resident fee, ${money(r.smartLockInstallPerUnit)}/unit install to the property.`)
  if (r.offerLpr) addonLines.push(`License-plate recognition${r.lprNote ? ` — ${r.lprNote}` : ''}.`)
  if (r.offerConcessionBlock) addonLines.push(`Concession block — parking &amp; amenity concessions the property may apply at its discretion.`)
  if (r.offerResidentServices) addonLines.push(`Optional resident TV / internet / security / doorbell — billed and supported by us, never the property's budget.`)

  const valuePanel = (r.showValuePanel && r.valueUplift > 0)
    ? `<div style="background:#eef6f1;border:1px solid #bfe3d0;border-radius:10px;padding:12px 14px;margin:14px 0">
        <div style="font-weight:700;color:#12855f;margin-bottom:4px">What this adds to the property's value</div>
        <div>Eliminated repair, capital, fobs, and staff time are net operating income. At a ${r.capRate}% cap rate, ${money(r.annualSavings)} of annual savings is worth about <b>${money(r.valueUplift)}</b> in property value.</div>
       </div>`
    : ''

  const fundingLine = resident
    ? `After that, GateGuard does not invoice the property again. The program is funded by residents through a parking &amp; amenity fee of ${money(r.residentFee)} per unit, billed and collected by us at each lease signing and renewal — never through your office.`
    : `After that, the property covers the program at a flat ${money(r.propertyMonthly)} per month, billed in bulk — residents are never billed individually.`

  const proposalLink = opts.proposalLink || ''
  const signBtn = proposalLink
    ? `<p style="margin:18px 0"><a href="${proposalLink}" style="display:inline-block;background:#2f7fb8;color:#fff;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:10px">View &amp; sign online ↗</a></p>`
    : ''

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;color:#17293e;line-height:1.6;max-width:640px">
    <p>Dear ${r.contactFirst},</p>
    <p>Thank you for your time and for walking me through ${r.propertyShort}. This is our proposal to take over ${r.accessPoints ? `all ${r.accessPoints} openings` : 'the gates'}${r.openingsBreakdown ? ` — ${r.openingsBreakdown} —` : ' '} together with the access control${r.camerasIncluded ? ', cameras,' : ','} monitoring, and resident support behind them, under our Property Partnership model.</p>
    <p>The structure is different from every gate quote you've received. The property pays a single, one-time set-up fee of <b>${money(r.setupFee)}</b>${r.setupNote ? ` — ${r.setupNote}` : ''}, half at signing and half at Go-Live. ${fundingLine}</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:14px 0">
      <tr>
        <td style="padding:10px;border:1px solid #e5ebf1;border-radius:8px;vertical-align:top"><div style="font-size:11px;color:#5a708c;text-transform:uppercase;font-weight:700">One-time set-up</div><div style="font-size:20px;font-weight:800;color:#16283d">${money(r.setupFee)}</div><div style="font-size:12px;color:#5a708c">${money(r.deposit)} at signing · ${money(r.goLive)} at Go-Live</div></td>
        <td style="padding:10px;border:1px solid #e5ebf1;vertical-align:top"><div style="font-size:11px;color:#5a708c;text-transform:uppercase;font-weight:700">Ongoing to property</div><div style="font-size:20px;font-weight:800;color:#16283d">${resident ? '$0' : money(r.propertyMonthly) + ' /mo'}</div></td>
        <td style="padding:10px;border:1px solid #e5ebf1;vertical-align:top"><div style="font-size:11px;color:#5a708c;text-transform:uppercase;font-weight:700">${r.residentFeeLabel}</div><div style="font-size:20px;font-weight:800;color:#16283d">${resident ? money(r.residentFee) : '$0'}</div></td>
      </tr>
    </table>
    <div style="font-weight:700;color:#16283d;margin:14px 0 4px">What GateGuard delivers</div>
    <ul style="margin:0 0 10px;padding-left:20px">${delivers.map(li).join('')}</ul>
    ${valuePanel}
    ${addonLines.length ? `<div style="font-weight:700;color:#16283d;margin:14px 0 4px">Optional add-ons (none required)</div><ul style="margin:0 0 10px;padding-left:20px">${addonLines.map(li).join('')}</ul>` : ''}
    <div style="font-weight:700;color:#16283d;margin:14px 0 4px">Term</div>
    <p style="margin:0 0 10px">${r.termYears}-year term from Go-Live, renewing in one-year terms unless either party gives 60 days' notice. The matching service agreement is attached.</p>
    ${signBtn}
    <p style="margin-top:20px">Respectfully,<br><b>${quote?.created_by_name || 'Gate Guard'}</b><br><span style="color:#5a708c">Gate Guard, LLC · (770) 776-8095 · rfeldman@gateguard.co</span></p>
  </div>`

  const textLines = [
    `Dear ${r.contactFirst},`, '',
    `Thank you for your time and for walking me through ${r.propertyShort}. This is our proposal to take over ${r.accessPoints ? `all ${r.accessPoints} openings` : 'the gates'}, with the access control, monitoring, and resident support behind them, under our Property Partnership model.`, '',
    `One-time set-up: ${money(r.setupFee)} (${money(r.deposit)} at signing, ${money(r.goLive)} at Go-Live).`,
    `Ongoing to property: ${resident ? '$0' : money(r.propertyMonthly) + '/mo'}.`,
    `${r.residentFeeLabel}: ${resident ? money(r.residentFee) : '$0'}.`, '',
    'What GateGuard delivers:', ...delivers.map(d => `• ${d.replace(/&amp;/g, '&')}`), '',
    ...(addonLines.length ? ['Optional add-ons (none required):', ...addonLines.map(a => `• ${a.replace(/&amp;/g, '&')}`), ''] : []),
    `${r.termYears}-year term from Go-Live. The matching service agreement is attached.`,
    ...(proposalLink ? ['', `View & sign online: ${proposalLink}`] : []),
    '', 'Respectfully,', `${quote?.created_by_name || 'Gate Guard'} — Gate Guard, LLC`,
  ]
  return { subject, html, text: textLines.join('\n') }
}
