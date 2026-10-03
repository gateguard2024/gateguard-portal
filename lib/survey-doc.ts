/**
 * lib/survey-doc.ts — the GateGuard Pre-Proposal Survey record model.
 *
 * A survey captures a flat list of `devices` (name, brand, model, location,
 * condition, action, notes, photos). This resolves a survey + its stored
 * `survey_doc` overrides into the full designed document the renderer and PDF
 * need: cover, findings, openings, per-area records, scope schedule, open items,
 * recommendations, and a photo index — deriving everything it can from the
 * captured devices so the rep fills in only narrative + a few header fields.
 *
 * Shared by components/public/SurveyRecord.tsx and lib/survey-doc-pdf.ts.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRec = Record<string, any>

export interface SurveyDevice {
  id?: string
  name?: string
  brand?: string
  model?: string
  location?: string
  condition?: 'Good' | 'Fair' | 'Poor' | ''
  action?: 'Keep' | 'Service' | 'Replace' | 'New Install' | ''
  notes?: string
  photos?: string[]
}

export type FindingPriority = 'HIGH' | 'MEDIUM' | 'LOW'

export interface SurveyStat { num?: string | number; label?: string; sub?: string }
export interface PriorityFinding { ref?: string; title?: string; detail?: string; priority?: FindingPriority }
export interface OpeningRow { type?: string; opening?: string; pin?: string; photos?: string; status?: string; notes?: string }
export interface EquipChip { tag?: string; label?: string; sub?: string }
export interface AreaPhoto { code?: string; url?: string; caption?: string; sub?: string; time?: string }
export interface SurveyArea { no?: string; title?: string; pin?: string; subtitle?: string; statusTags?: string[]; narrative?: string; equipment?: EquipChip[]; observations?: string[]; photos?: AreaPhoto[] }
export interface ScheduleRow { group?: string; device?: string; qty?: string | number; make?: string; condition?: string; disposition?: string }
export interface OpenItem { ref?: string; item?: string; why?: string; owner?: string }
export interface Recommendation { ref?: string; title?: string; detail?: string; owner?: string; priority?: FindingPriority }
export interface Fact { label: string; value: string }
export interface Pin { pin?: string; area?: string; kind?: 'vehicle' | 'amenity' }

export interface SurveyDocConfig {
  record_no?: string
  version?: string
  issued_date?: string
  prepared_for_name?: string
  prepared_for_contact?: string
  contact_title?: string
  surveyed_by?: string
  surveyor_role?: string
  walk_start?: string
  walk_end?: string
  hero_url?: string
  hero_caption?: string
  aerial_url?: string
  scope_note?: string
  method_note?: string
  record_summary?: string
  exec_summary?: string
  direction_note?: string
  facts?: Fact[]            // overrides the derived property facts grid
  findings_intro?: string
  stats?: SurveyStat[]      // overrides the derived stat cards
  priority_findings?: PriorityFinding[]
  pins?: Pin[]
  openings?: OpeningRow[]   // overrides the derived openings table
  hardware_note?: string
  headend_note?: string
  video_note?: string
  areas?: SurveyArea[]      // overrides the derived per-area records
  schedule?: ScheduleRow[]  // overrides the derived scope schedule
  schedule_note?: string
  open_items?: OpenItem[]
  recommendations?: Recommendation[]
}

export interface ResolvedSurvey {
  property: string
  address: string
  recordNo: string
  version: string
  issuedDate: string
  preparedForName: string
  preparedForContact: string
  contactTitle: string
  surveyedBy: string
  surveyorRole: string
  surveyDate: string
  walkStart: string
  walkEnd: string
  walkWindow: string
  heroUrl: string
  heroCaption: string
  aerialUrl: string
  scopeNote: string
  methodNote: string
  recordSummary: string
  execSummary: string
  directionNote: string
  findingsIntro: string
  facts: Fact[]
  stats: SurveyStat[]
  priorityFindings: PriorityFinding[]
  pins: Pin[]
  openings: OpeningRow[]
  hardwareNote: string
  headendNote: string
  videoNote: string
  areas: SurveyArea[]
  schedule: ScheduleRow[]
  scheduleNote: string
  openItems: OpenItem[]
  recommendations: Recommendation[]
  photoIndex: AreaPhoto[]
  totalPhotos: number
  preparedBy: string
}

const s = (v: unknown, d = '') => (v == null ? d : String(v))
const isWorking = (d: SurveyDevice) => d.condition === 'Good' || d.condition === 'Fair'
const needsRepair = (d: SurveyDevice) => d.condition === 'Poor' || d.action === 'Replace' || d.action === 'New Install'
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Map a device name to a short openings "type" word. */
function deviceType(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('gate') && (n.includes('ped') || n.includes('walk'))) return 'Pedestrian gate'
  if (n.includes('gate') || n.includes('operator') || n.includes('arm')) return 'Vehicle gate'
  if (n.includes('callbox') || n.includes('call box') || n.includes('intercom')) return 'Callbox'
  if (n.includes('reader') || n.includes('keypad')) return 'Reader'
  if (n.includes('camera') || n.includes('lpr')) return 'Camera'
  if (n.includes('door') || n.includes('pool') || n.includes('gym') || n.includes('amenity')) return 'Amenity'
  return 'Device'
}

/** Short equipment tag for the per-area sidebar. */
function equipTag(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('operator')) return 'OPR'
  if (n.includes('arm')) return 'ARM'
  if (n.includes('callbox') || n.includes('intercom')) return 'CBX'
  if (n.includes('reader') || n.includes('keypad')) return 'RDR'
  if (n.includes('camera') || n.includes('lpr')) return 'CAM'
  if (n.includes('lock')) return 'LOCK'
  if (n.includes('gate')) return 'GATE'
  return 'DEV'
}

function deviceStatus(d: SurveyDevice): string {
  if (needsRepair(d)) return 'NON-WORKING'
  if (!d.condition) return 'NOT VERIFIED'
  return 'WORKING'
}

export function resolveSurvey(survey: AnyRec, cfg: SurveyDocConfig = {}): ResolvedSurvey {
  const devices: SurveyDevice[] = Array.isArray(survey?.devices) ? survey.devices : []
  const property = s(survey?.property_name, 'the Property')
  const address = s(survey?.property_address)
  const surveyDate = s(survey?.survey_date)

  // Pin letters per distinct location (in first-seen order).
  const locOrder: string[] = []
  for (const d of devices) {
    const loc = s(d.location).trim() || 'General'
    if (!locOrder.includes(loc)) locOrder.push(loc)
  }
  const pinForLoc = (loc: string) => LETTERS[Math.max(0, locOrder.indexOf(loc))] || '—'

  // Photo index — every device photo, coded E01.. in device order.
  const photoIndex: AreaPhoto[] = []
  let pc = 0
  const codeForPhotos = (d: SurveyDevice): string[] => {
    const urls = Array.isArray(d.photos) ? d.photos : []
    return urls.map((url) => {
      pc += 1
      const code = 'E' + String(pc).padStart(2, '0')
      photoIndex.push({ code, url, caption: s(d.name, 'Photo'), sub: s(d.location), time: '' })
      return code
    })
  }

  // Build areas grouped by location (unless overridden).
  const areas: SurveyArea[] = (cfg.areas && cfg.areas.length)
    ? cfg.areas
    : locOrder.map((loc, i) => {
        const inLoc = devices.filter(d => (s(d.location).trim() || 'General') === loc)
        const photos: AreaPhoto[] = []
        const equipment: EquipChip[] = inLoc.map(d => {
          const codes = codeForPhotos(d)
          codes.forEach((code, idx) => {
            const url = (d.photos || [])[idx]
            if (url) photos.push({ code, url, caption: s(d.name, 'Photo'), sub: s(d.notes) })
          })
          return { tag: equipTag(s(d.name)), label: s(d.name, 'Device'), sub: [d.brand, d.condition || d.action].filter(Boolean).join(' · ') }
        })
        const observations = inLoc.map(d => s(d.notes)).filter(Boolean)
        const anyBad = inLoc.some(needsRepair)
        return {
          no: String(i + 1).padStart(2, '0'),
          title: loc,
          pin: pinForLoc(loc),
          subtitle: address ? `PIN ${pinForLoc(loc)} · ${address}` : `PIN ${pinForLoc(loc)}`,
          statusTags: anyBad ? ['NON-WORKING'] : [],
          narrative: '',
          equipment,
          observations,
          photos,
        }
      })

  // Openings table (unless overridden).
  const openings: OpeningRow[] = (cfg.openings && cfg.openings.length)
    ? cfg.openings
    : devices.map(d => {
        const loc = s(d.location).trim() || 'General'
        const myCodes = photoIndex.filter(p => p.caption === s(d.name, 'Photo') && p.sub === loc).map(p => p.code)
        return {
          type: deviceType(s(d.name)),
          opening: s(d.name, 'Device'),
          pin: pinForLoc(loc),
          photos: myCodes.join(', '),
          status: deviceStatus(d),
          notes: s(d.notes),
        }
      })

  // Scope schedule — group devices by name (unless overridden).
  const schedule: ScheduleRow[] = (cfg.schedule && cfg.schedule.length)
    ? cfg.schedule
    : (() => {
        const groups = new Map<string, SurveyDevice[]>()
        for (const d of devices) {
          const key = s(d.name, 'Device')
          if (!groups.has(key)) groups.set(key, [])
          groups.get(key)!.push(d)
        }
        return Array.from(groups.entries()).map(([name, list]) => {
          const makes = Array.from(new Set(list.map(d => s(d.brand)).filter(Boolean)))
          const bad = list.filter(needsRepair).length
          const cond = bad > 0 ? `${bad} need${bad === 1 ? 's' : ''} repair` : 'Operational'
          const actions = Array.from(new Set(list.map(d => s(d.action)).filter(Boolean)))
          return {
            group: deviceType(name),
            device: name,
            qty: list.length,
            make: makes.join(', ') || '—',
            condition: cond,
            disposition: actions.join(' · ') || 'Inspect',
          }
        })
      })()

  // Property facts grid (derived) unless overridden.
  const vehicleOpenings = devices.filter(d => deviceType(s(d.name)) === 'Vehicle gate')
  const facts: Fact[] = (cfg.facts && cfg.facts.length) ? cfg.facts : [
    { label: 'Address', value: address || '—' },
    { label: 'Contact', value: s(cfg.prepared_for_contact) || '—' },
    { label: 'Openings surveyed', value: String(devices.length) },
    { label: 'Need repair', value: String(devices.filter(needsRepair).length) },
    { label: 'Working', value: String(devices.filter(isWorking).length) },
    { label: 'Units', value: s(survey?.units) || 'Not recorded' },
  ]

  // Stat cards (derived) unless overridden.
  const stats: SurveyStat[] = (cfg.stats && cfg.stats.length) ? cfg.stats : [
    { num: devices.length, label: 'Openings surveyed', sub: 'Devices documented on the walk.' },
    { num: devices.filter(needsRepair).length, label: 'Need repair', sub: 'Damaged, missing, or replace.' },
    { num: vehicleOpenings.length, label: 'Vehicle gates', sub: 'Entries and exits.' },
    { num: devices.filter(d => deviceType(s(d.name)) === 'Amenity').length, label: 'Amenity openings', sub: 'Pool, gym, clubhouse, package.' },
  ]

  const walkStart = s(cfg.walk_start)
  const walkEnd = s(cfg.walk_end)
  const walkWindow = walkStart && walkEnd ? `${walkStart} to ${walkEnd}` : (walkStart || '')

  return {
    property,
    address,
    recordNo: s(cfg.record_no, s(survey?.survey_number) || 'GG-SURVEY'),
    version: s(cfg.version, '1.0'),
    issuedDate: s(cfg.issued_date) || fmt(survey?.survey_date) || fmt(new Date().toISOString()),
    preparedForName: s(cfg.prepared_for_name, property),
    preparedForContact: s(cfg.prepared_for_contact),
    contactTitle: s(cfg.contact_title),
    surveyedBy: s(cfg.surveyed_by, s(survey?.surveyor_name) || 'GateGuard'),
    surveyorRole: s(cfg.surveyor_role, 'Field survey'),
    surveyDate: fmt(surveyDate),
    walkStart, walkEnd, walkWindow,
    heroUrl: s(cfg.hero_url),
    heroCaption: s(cfg.hero_caption),
    aerialUrl: s(cfg.aerial_url),
    scopeNote: s(cfg.scope_note, 'Vehicle gates, operators, callboxes, readers, amenity doors and cameras as found. Gate structures and electrical work are noted where they affect operation.'),
    methodNote: s(cfg.method_note, 'One on-site walk. Every photo taken appears in this document. Device status is from the field notes and photos.'),
    recordSummary: s(cfg.record_summary, `${photoIndex.length} photos · field notes`),
    execSummary: s(cfg.exec_summary),
    directionNote: s(cfg.direction_note, 'This document records conditions as found. The recommendations at the end are inputs to the GateGuard proposal.'),
    findingsIntro: s(cfg.findings_intro, 'Counts are from the site walk, the field notes and the photos.'),
    facts, stats,
    priorityFindings: Array.isArray(cfg.priority_findings) ? cfg.priority_findings : [],
    pins: Array.isArray(cfg.pins) ? cfg.pins : locOrder.map((loc) => ({ pin: pinForLoc(loc), area: loc, kind: /pool|gym|club|amenity|package|door/i.test(loc) ? 'amenity' : 'vehicle' })),
    openings,
    hardwareNote: s(cfg.hardware_note),
    headendNote: s(cfg.headend_note),
    videoNote: s(cfg.video_note),
    areas,
    schedule,
    scheduleNote: s(cfg.schedule_note, 'Quantities are from the walk. Makes are given only where a brand was legible.'),
    openItems: Array.isArray(cfg.open_items) ? cfg.open_items : [],
    recommendations: Array.isArray(cfg.recommendations) ? cfg.recommendations : [],
    photoIndex,
    totalPhotos: photoIndex.length,
    preparedBy: s(survey?.surveyor_name, 'GateGuard'),
  }
}

export function fmt(d?: string | null): string {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return String(d)
  return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
