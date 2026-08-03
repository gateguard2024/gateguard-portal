'use client'

/**
 * ARIA Explore — rebuilt property finder (Zillow / apartments.com model).
 *
 * The whole flow, 5th-grade simple:
 *   1. Pick ONE word (Properties · Listings · Contacts), type an area, Find.
 *   2. Results are lightweight: name · units · location · matched keywords.
 *   3. Toggle Map / List before choosing.
 *   4. After search there is ONE clear set of actions: tick cards → "Add to
 *      Leads / Research", or click a card → View report · Research · Add to Lead.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, MapPin, Building2, Wifi, Loader2, Check, Zap, X, Plus, Clock, Users, Star, Settings, Globe } from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowLeft, LayoutGrid, Map: MapIcon, Cpu } = require('lucide-react') as any
import { SearchHistoryPanel } from '@/components/aria/SearchHistoryPanel'
import { NEXUS_BG, NexusBackdropLayers } from '@/components/nexus/NexusBackdrop'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

// ── Steel design tokens — identical to the Nexus dashboard / Opportunity Hub so
// the ARIA detail popup reads as the same product (brushed light-steel frame,
// dark steel tiles inside, one blue accent). Fortune-500 clean, no glass. ──
const STEEL_FRAME = {
  background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.05) 0 1px,transparent 1px 4px), linear-gradient(180deg,#5a6c84,#45556a)',
  border: '1px solid rgba(10,16,24,0.45)',
  boxShadow: '0 30px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -2px 2px rgba(0,0,0,0.40)',
} as const
const STEEL_TILE = {
  background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#2b3c52,#1e2a3a)',
  border: '1px solid rgba(140,170,200,0.22)',
} as const
const STEEL_HEADER = 'linear-gradient(180deg,#33465e,#1e2a3a)'
const STEEL_ACCENT = '#5FB8E0'

type Category = 'properties' | 'listings' | 'contacts'
type ViewMode = 'list' | 'map'

// The base find answers "does this exist?" — presence only, never a brand.
interface BaseSystems {
  internet: boolean
  video: boolean
  bulk: boolean
  gates: boolean
  cameras: boolean
  smart_lockers: boolean
  smart_rent: boolean
  ev_chargers: boolean
}

interface PropItem {
  id: string
  name: string
  address: string
  city: string
  state: string
  units?: number
  management_company?: string
  website?: string | null
  isp_signal?: string
  bulk_detected?: boolean
  gate_signal?: boolean
  pain_brief?: string
  buy_score?: number
  lead_score?: number           // first-find rank score (0–100): buy intent + size + pro-tech fit
  researched?: boolean          // = already in the Intel DB (the ✓ Saved badge)
  contract_expiry_year?: number
  lat?: number
  lng?: number
  systems?: BaseSystems         // from the base find
  saved_id?: string | null      // aria_properties.id when already saved
  photo_url?: string | null     // the community's real hero shot (og:image)
  name_aliases?: string[]       // rebrands — reviews often live under the old name
}

// The proptech we actually sell against, broken out by category. A flat merged
// list of brand names is useless — you need to know WHICH system each brand is.
// `key` = the array on facts.proptech_found; `presenceKey` = the base-find flag
// that proves it exists even when no brand was identified.
const PROPTECH_CATEGORIES: { key: string; presenceKey: string; label: string }[] = [
  { key: 'gate_operators',    presenceKey: 'gates',         label: 'Gates' },
  { key: 'access_control',    presenceKey: 'gates',         label: 'Access control' },
  { key: 'intercoms',         presenceKey: 'gates',         label: 'Intercom' },
  { key: 'cameras',           presenceKey: 'cameras',       label: 'Cameras' },
  { key: 'smart_locks',       presenceKey: 'smart_rent',    label: 'Smart locks' },
  { key: 'package_solutions', presenceKey: 'smart_lockers', label: 'Package lockers' },
  { key: 'ev_chargers',       presenceKey: 'ev_chargers',   label: 'EV chargers' },
  { key: 'resident_apps',     presenceKey: 'smart_rent',    label: 'Resident app' },
]

const SYSTEM_LABELS: { key: keyof BaseSystems; short: string; label: string }[] = [
  { key: 'internet',      short: 'INT',  label: 'Internet' },
  { key: 'video',         short: 'TV',   label: 'Video / TV' },
  { key: 'bulk',          short: 'BULK', label: 'Bulk deal' },
  { key: 'gates',         short: 'GATE', label: 'Gates / access' },
  { key: 'cameras',       short: 'CAM',  label: 'Cameras' },
  { key: 'smart_lockers', short: 'PKG',  label: 'Package lockers' },
  { key: 'smart_rent',    short: 'SMRT', label: 'Smart rent' },
  { key: 'ev_chargers',   short: 'EV',   label: 'EV chargers' },
]

/** The 7 base signals as compact chips — green = found, grey = not found. */
function SystemChips({ systems }: { systems?: BaseSystems }) {
  if (!systems) return null
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1.5">
      {SYSTEM_LABELS.map(s => {
        const on = !!systems[s.key]
        return (
          <span key={s.key} title={`${s.label}: ${on ? 'found' : 'not found'}`}
            className={`text-[8.5px] font-extrabold px-1.5 py-0.5 rounded border tracking-wide ${
              on ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                 : 'bg-white/[0.03] text-slate-600 border-white/10'}`}>
            {s.short}
          </span>
        )
      })}
    </div>
  )
}

type Source = 'discover' | 'saved'

const CATEGORIES: { key: Category; label: string; hint: string }[] = [
  { key: 'properties', label: 'Properties', hint: 'e.g. apartment complexes in Dallas, TX' },
  { key: 'listings',   label: 'Listings',   hint: 'e.g. 300+ unit listings in Atlanta with gates' },
  { key: 'contacts',   label: 'Contacts',   hint: 'e.g. property managers at Greystar Dallas' },
]

function scoreColor(s: number): string {
  if (s >= 8) return '#ef4444'
  if (s >= 6) return '#f59e0b'
  if (s >= 4) return '#5FB8E0'
  return '#64748b'
}

// The gauge ramp — a TRUE gradient across the whole arc, not a per-band colour.
// Red at 0, quickly into orange so the cold end doesn't drag, amber through the
// middle, light green from ~65% (the first genuinely positive signal), and a
// rich, deep green at 100%.
const GAUGE_STOPS: { at: number; c: [number, number, number] }[] = [
  { at: 0.00, c: [234, 88, 12] },   // #ea580c orange (no deep red — it read too harsh)
  { at: 0.22, c: [245, 158, 11] },  // #f59e0b amber
  { at: 0.45, c: [250, 204, 21] },  // #facc15 yellow
  { at: 0.65, c: [74, 222, 128] },  // #4ade80 light green — first positive signal
  { at: 0.85, c: [34, 160, 84] },   // #22a054 green
  { at: 1.00, c: [17, 110, 51] },   // #116e33 rich deep green
]

/** Colour at a 0–10 value, interpolated along the same ramp the arc paints. */
function gaugeColorAt(val: number): string {
  const t = Math.max(0, Math.min(10, val)) / 10
  let a = GAUGE_STOPS[0], b = GAUGE_STOPS[GAUGE_STOPS.length - 1]
  for (let i = 0; i < GAUGE_STOPS.length - 1; i++) {
    if (t >= GAUGE_STOPS[i].at && t <= GAUGE_STOPS[i + 1].at) { a = GAUGE_STOPS[i]; b = GAUGE_STOPS[i + 1]; break }
  }
  const span = b.at - a.at || 1
  const k = (t - a.at) / span
  const ch = (i: number) => Math.round(a.c[i] + (b.c[i] - a.c[i]) * k)
  return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`
}

// Proptech fit — how replaceable/underserved the site looks (0–10).
// No gate/access hardware found = wide-open greenfield = high fit.
function proptechFit(it: PropItem): number {
  let s = 5
  if (it.gate_signal) s += 2            // there IS a gate → we have something to sell
  if (!it.bulk_detected) s += 1.5       // no incumbent bulk deal → easier entry
  if ((it.units ?? 0) >= 200) s += 1.5  // bigger site → bigger job
  else if ((it.units ?? 0) >= 100) s += 0.75
  return Math.max(0, Math.min(10, Math.round(s * 10) / 10))
}

// Network/internet opportunity — a locked bulk deal that's expiring is the prize.
function netScore(it: PropItem): number {
  let s = 5
  if (it.bulk_detected) s += 1          // a bulk deal exists → displaceable
  if (it.contract_expiry_year != null) {
    const yrs = it.contract_expiry_year - new Date().getFullYear()
    if (yrs <= 0) s += 3                // already expired → act now
    else if (yrs <= 1) s += 2.5
    else if (yrs <= 2) s += 1.5
  }
  if (!it.isp_signal) s += 0.5          // no ISP found → likely underserved
  return Math.max(0, Math.min(10, Math.round(s * 10) / 10))
}

// Compact arc for the results list — same ramp as the big gauges.
function MiniGauge({ label, val }: { label: string; val: number }) {
  const v = Math.max(0, Math.min(10, val))
  const f = v / 10, AL = Math.PI * 20
  const gid = `mg-${label}`
  return (
    <div className="flex flex-col items-center" title={`${label}: ${v.toFixed(1)}/10`}>
      <svg width="38" height="23" viewBox="0 0 46 27">
        <defs>
          <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="3" y1="0" x2="43" y2="0">
            {GAUGE_STOPS.map(s => <stop key={s.at} offset={`${s.at * 100}%`} stopColor={`rgb(${s.c[0]},${s.c[1]},${s.c[2]})`} />)}
          </linearGradient>
        </defs>
        <path d="M 3 24 A 20 20 0 0 1 43 24" fill="none" stroke="#22303F" strokeWidth="5" strokeLinecap="round" />
        <path d="M 3 24 A 20 20 0 0 1 43 24" fill="none" stroke={`url(#${gid})`} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={AL} strokeDashoffset={AL * (1 - f)} />
        <text x="23" y="22" textAnchor="middle" fontSize="10" fontWeight="800" fill="#e2e8f0">{v.toFixed(1)}</text>
      </svg>
      <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wide -mt-0.5">{label}</span>
    </div>
  )
}

// Gong-style "why now" trigger flags, computed from our fixed multifamily fields.
function triggerFlags(it: PropItem): { label: string; tone: 'red' | 'amber' | 'blue' }[] {
  const f: { label: string; tone: 'red' | 'amber' | 'blue' }[] = []
  if (it.gate_signal || (it.pain_brief && /gate|access|call ?box|intercom/i.test(it.pain_brief))) f.push({ label: 'Gate complaints', tone: 'red' })
  if (it.bulk_detected) f.push({ label: 'Bulk — needs expiry', tone: 'amber' })
  if ((it.buy_score ?? 0) >= 8) f.push({ label: 'High intent', tone: 'red' })
  else if (it.pain_brief) f.push({ label: 'Resident issues', tone: 'amber' })
  if (it.isp_signal) f.push({ label: 'ISP known', tone: 'blue' })
  return f
}
const toneClass = (t: 'red' | 'amber' | 'blue') =>
  t === 'red' ? 'bg-rose-400/10 text-rose-300 border-rose-400/30'
  : t === 'amber' ? 'bg-amber-400/10 text-amber-200 border-amber-400/30'
  : 'bg-[#5FB8E0]/10 text-[#9FD8EC] border-[#5FB8E0]/25'

// Normalize either a live prospect OR a saved aria_properties row (facts/deductions)
// into one report shape the tabbed panel renders. This is what makes a Saved
// property show the full rich report instantly, no re-search.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Pick the first source that actually HAS data. `??` is wrong for arrays here:
// the canonical `facts.*` bundles are always written as [] (never null), so `??`
// would lock onto an empty array and never fall back to the flat column that
// holds the real data (this is why Community was always blank).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickArr(...cands: any[]): any[] {
  for (const c of cands) if (Array.isArray(c) && c.length > 0) return c
  return []
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeReport(raw: any): any {
  if (!raw) return null
  // Any aria_properties row (with or without the new facts/deductions columns).
  if (raw.facts || raw.deductions || raw.property_name) {
    const f = raw.facts || {}, d = raw.deductions || {}
    const pt = f.proptech_found ?? {
      gate_operators: raw.gate_operators, access_control: raw.access_control, intercoms: raw.intercoms,
      cameras: raw.cameras, smart_locks: raw.smart_locks, resident_apps: raw.resident_apps, package_solutions: raw.package_solutions,
    }
    return {
      property: {
        photo_url: f.property?.photo_url ?? raw.photo_url ?? raw.image_url,
        phone: f.property?.phone ?? raw.property_phone ?? raw.dm_phone,
        units: f.property?.units ?? raw.units, year_built: f.property?.year_built ?? raw.year_built,
        occupancy: f.property?.occupancy ?? raw.occupancy, management_company: f.property?.management_company ?? raw.management_company,
        owner_entity: f.property?.owner_entity ?? raw.owner_entity,
        isp_providers: pickArr(f.connectivity?.isp_providers, raw.isp_providers),
        video_providers: pickArr(f.connectivity?.video_providers, raw.video_providers),
        bulk_agreements: pickArr(f.connectivity?.bulk_agreements, raw.bulk_agreements),
        roe_expiry_year: f.connectivity?.roe_expiry_year ?? raw.roe_expiry_year ?? raw.contract_expiry_year,
        proptech: pt,
        inferred_proptech: pickArr(d.proptech_inferred),
      },
      field_confidence: (f.field_confidence ?? {}) as Record<string, { source: string; pct: number }>,
      // What the base find proved EXISTS, even when deep hasn't named the brand.
      // "Present, brand unknown" and "no data found" are completely different
      // facts and must never be shown as the same thing.
      presence: {
        internet:      !!f.connectivity?.internet_present,
        video:         !!f.connectivity?.video_present,
        bulk:          !!f.connectivity?.bulk_present || !!raw.roe_detected,
        gates:         !!f.proptech_found?.gates_present,
        cameras:       !!f.proptech_found?.cameras_present,
        smart_lockers: !!f.proptech_found?.smart_lockers_present,
        smart_rent:    !!f.proptech_found?.smart_rent_present,
        ev_chargers:   !!f.proptech_found?.ev_chargers_present,
      },
      contacts: pickArr(f.decision_makers, raw.dm_chain),
      // Community lives in the `social_posts` column (written by /api/aria/social);
      // facts.community_posts is often an empty placeholder — take whichever has data.
      community: pickArr(f.community_posts, raw.social_posts),
      ai_intel: {
        key_finding: d.ai_intel?.key_finding ?? raw.primary_concern,
        buying_trends: d.ai_intel?.buying_trends,
        pitch_hook: d.scout?.pitch_strategy?.primary_hook ?? raw.pitch_strategy?.primary_hook,
      },
      scout: { outreach_plan: d.scout?.outreach_plan, outreach_sequence: d.scout?.outreach_sequence, scout_brief: d.scout?.scout_brief ?? raw.scout_brief },
      buy_score: d.ai_intel?.buy_score ?? raw.buy_score,
    }
  }
  const p = raw
  return {
    property: {
      photo_url: p.property?.photo_url ?? p.property?.image_url,
      phone: p.property?.phone, units: p.property?.units, year_built: p.property?.year_built,
      occupancy: p.property?.occupancy, management_company: p.property?.management_company,
      owner_entity: p.ownership?.owner_entity ?? p.property?.owner_entity,
      isp_providers: p.property?.isp_providers ?? [], video_providers: p.property?.video_providers ?? [],
      bulk_agreements: p.property?.bulk_agreements ?? [], roe_expiry_year: p.property?.roe_expiry_year,
      proptech: p.property?.proptech ?? {}, inferred_proptech: p.property?.inferred_proptech ?? [],
    },
    field_confidence: (p.property?.field_confidence ?? {}) as Record<string, { source: string; pct: number }>,
    // Fresh deep result (raw payload, not yet re-read from DB): use the engine's
    // presence object if present, else derive from the brand arrays so unbranded-
    // but-present systems don't read as "No data found".
    presence: {
      internet:      !!p.property?.presence?.internet      || (p.property?.isp_providers?.length ?? 0) > 0,
      video:         !!p.property?.presence?.video         || (p.property?.video_providers?.length ?? 0) > 0,
      bulk:          !!p.property?.presence?.bulk          || (p.property?.bulk_agreements?.length ?? 0) > 0 || !!p.property?.roe_detected,
      gates:         !!p.property?.presence?.gates         || ((p.property?.proptech?.gate_operators?.length ?? 0) + (p.property?.proptech?.access_control?.length ?? 0)) > 0,
      cameras:       !!p.property?.presence?.cameras       || (p.property?.proptech?.cameras?.length ?? 0) > 0,
      smart_lockers: !!p.property?.presence?.smart_lockers || (p.property?.proptech?.package_solutions?.length ?? 0) > 0,
      smart_rent:    !!p.property?.presence?.smart_rent    || (p.property?.proptech?.smart_locks?.length ?? 0) > 0,
      ev_chargers:   !!p.property?.presence?.ev_chargers   || (p.property?.proptech?.ev_chargers?.length ?? 0) > 0,
    },
    contacts: (p.decision_maker_chain?.length ? p.decision_maker_chain : (p.decision_maker ? [p.decision_maker] : [])),
    community: p.social_posts ?? [],
    ai_intel: { key_finding: p.profile?.primary_concern ?? p.key_finding, buying_trends: p.buying_trends, pitch_hook: p.pitch_strategy?.primary_hook },
    scout: { outreach_plan: p.scout_queue?.outreach_plan, outreach_sequence: p.scout_queue?.outreach_sequence, scout_brief: p.scout_brief },
    buy_score: p.profile?.buy_score,
  }
}
// DM/contactability score (1–10) from a normalized report.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dmScoreN(rep: any): number {
  if (!rep) return 0
  let s = 0
  const ph = rep.property?.phone
  if (ph && ph !== 'No data found' && String(ph).length > 5) s += 3
  const c: any[] = rep.contacts ?? [] // eslint-disable-line @typescript-eslint/no-explicit-any
  if (c.some(x => /manager/i.test(`${x.role_type || ''} ${x.title || ''}`))) s += 2
  if (c.some(x => /regional|asset|vp|director|owner|principal/i.test(`${x.role_type || ''} ${x.title || ''}`))) s += 2
  const oe = rep.property?.owner_entity
  if (oe && oe !== 'Unknown' && oe !== 'No data found') s += 2
  if (c[0]?.name && c[0].name !== 'No data found') s += 1
  return Math.min(10, s)
}

async function geocode(it: PropItem): Promise<{ lat: number; lng: number; address?: string } | null> {
  if (!MAPBOX_TOKEN) return null
  // When we have no street address yet, search by NAME first so Mapbox returns the
  // property's real POI address (not just the city centroid) — that address is what
  // reps need to paste. Fall back to whatever address/city we do have.
  const q = it.address
    ? [it.address, it.city, it.state].filter(Boolean).join(', ')
    : `${it.name} ${[it.city, it.state].filter(Boolean).join(', ')}`.trim()
  try {
    const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&limit=1&country=us`)
    const d = await r.json()
    const feat = d?.features?.[0]
    const c = feat?.center
    if (!Array.isArray(c)) return null
    const out: { lat: number; lng: number; address?: string } = { lng: c[0], lat: c[1] }
    // Fill in a real street address when the base find didn't capture one, but only
    // from a specific POI/address match (never a city-level guess).
    if (!it.address && typeof feat?.place_name === 'string' && Array.isArray(feat?.place_type)
        && (feat.place_type.includes('poi') || feat.place_type.includes('address'))) {
      out.address = feat.place_name.replace(/,?\s*United States$/i, '').trim()
    }
    return out
  } catch { return null }
}

// Zillow-style aerial thumbnail of the property from its coordinates (free with
// the Mapbox token — a real satellite image, no photo storage needed).
function staticThumb(lat?: number, lng?: number, w = 240, h = 150): string | null {
  if (lat == null || lng == null || !MAPBOX_TOKEN) return null
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lng},${lat},16.5,0/${w}x${h}@2x?access_token=${MAPBOX_TOKEN}&attribution=false&logo=false`
}

// "123 Main St, Dallas, TX 75201" → { city: 'Dallas', state: 'TX' }
// Legacy rows have city/state NULL (they were never written) and facts NULL
// (migration 148 didn't backfill), but `address` has always been populated.
function cityStateFromAddress(address?: string): { city: string; state: string } {
  const parts = (address ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length < 3) return { city: '', state: '' }
  return { city: parts[1] ?? '', state: (parts[2] ?? '').split(/\s+/)[0] ?? '' }
}

// Map a saved aria_properties row → a list card. The row's real UUID id is kept,
// so opening it loads the canonical record instantly (no re-search, no spend).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function savedRowToItem(row: any): PropItem {
  const addr = row.facts?.property?.address ?? row.address ?? ''
  const fromAddr = cityStateFromAddress(addr)
  return {
    id: row.id,
    name: row.property_name ?? row.facts?.property?.name ?? 'Unknown Property',
    address: addr,
    // Community/social needs a city — fall back to parsing the address so saved
    // rows aren't silently skipped.
    city: row.facts?.property?.city ?? row.city ?? fromAddr.city,
    state: row.facts?.property?.state ?? row.state ?? fromAddr.state,
    units: row.units ?? row.facts?.property?.units,
    management_company: row.management_company ?? row.facts?.property?.management_company,
    isp_signal: (row.isp_providers ?? row.facts?.connectivity?.isp_providers ?? [])[0],
    bulk_detected: (row.bulk_agreements?.length ?? 0) > 0 || !!row.roe_detected,
    gate_signal: (row.gate_operators?.length ?? 0) > 0 || (row.facts?.proptech_found?.gate_operators?.length ?? 0) > 0,
    buy_score: row.buy_score ?? row.deductions?.ai_intel?.buy_score,
    researched: true,
    contract_expiry_year: row.contract_expiry_year ?? undefined,
    lat: row.facts?.property?.lat ?? undefined,
    lng: row.facts?.property?.lng ?? undefined,
    website: row.facts?.property?.website ?? row.website ?? null,
    photo_url: row.facts?.property?.photo_url ?? row.photo_url ?? null,
  }
}

export default function AriaExplorePage() {
  const [category, setCategory] = useState<Category>('properties')
  const [query, setQuery]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [items, setItems]       = useState<PropItem[]>([])
  // Default = the split Find screen: map in the centre, results in the right third.
  const [view, setView]         = useState<ViewMode>('map')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detail, setDetail]     = useState<PropItem | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [interp, setInterp]     = useState('')
  const [msg, setMsg]           = useState<string | null>(null)
  const [busy, setBusy]         = useState(false)
  // Per-property research state shown in the detail panel
  const [detailBusy, setDetailBusy]   = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detailReport, setDetailReport] = useState<any | null>(null)
  const [openCard, setOpenCard]       = useState<null | 'network' | 'community' | 'proptech' | 'ai'>(null)
  const [communityBusy, setCommunityBusy] = useState(false)
  const [communityErr, setCommunityErr]   = useState<string | null>(null)
  // Deep research queue — runs ONE property at a time so nothing times out, and
  // shows plainly what's waiting, what's running, and what's finished.
  type QueueItem = { id: string; name: string; status: 'queued' | 'running' | 'done' | 'failed'; note?: string }
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [queueRunning, setQueueRunning] = useState(false)
  // Base find: was this one named property, or a cluster?
  const [resultKind, setResultKind] = useState<'single' | 'multi'>('multi')
  // Include previously-searched properties, or only new ones?
  const [savedFilter, setSavedFilter] = useState<'all' | 'new' | 'saved'>('all')
  const [saveBusy, setSaveBusy] = useState(false)
  // Apollo-grade segmentation on multifamily fields
  const [fMinUnits, setFMinUnits] = useState(0)
  const [fGate, setFGate]         = useState(false)
  const [fBulk, setFBulk]         = useState(false)
  const [fNew, setFNew]           = useState(false) // not-yet-researched only
  const [fExpBefore, setFExpBefore] = useState(0)   // contract expiry before year (0 = any)
  const [source, setSource]       = useState<Source>('discover')
  const [scoutLeadIds, setScoutLeadIds] = useState<string[]>([])
  const [scoutMsg, setScoutMsg]   = useState<string | null>(null)
  const [panel, setPanel] = useState<null | 'leads' | 'contacts' | 'settings' | 'history'>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [panelItems, setPanelItems] = useState<any[]>([])
  const [panelLoading, setPanelLoading] = useState(false)

  const mapRef     = useRef<any>(null)               // eslint-disable-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Record<string, any>>({}) // eslint-disable-line @typescript-eslint/no-explicit-any
  const cssReadyRef = useRef(false)                  // Mapbox CSS must apply before the map is created
  const [mapTick, setMapTick] = useState(0) // forces the map effect to retry until Mapbox GL loads
  const [mapErr, setMapErr]   = useState<string | null>(
    MAPBOX_TOKEN ? null : 'Map is not configured (NEXT_PUBLIC_MAPBOX_TOKEN is missing on this deployment).'
  )

  // Load Mapbox GL once. v3.26.0 to match Mapbox's own working example. The CSS
  // MUST be applied before the map is created — creating it first paints a black
  // canvas with no error (that was the ARIA "no map" bug).
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== 'undefined' && (window as any).mapboxgl) { cssReadyRef.current = true; return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.26.0/mapbox-gl.css'
    link.onload = () => { cssReadyRef.current = true; setMapTick(x => x + 1) }
    document.head.appendChild(link)
    const s = document.createElement('script')
    s.src = 'https://api.mapbox.com/mapbox-gl-js/v3.26.0/mapbox-gl.js'
    // Kick the map effect the instant the library lands. Relying only on the
    // poll meant the map could sit blank if a retry landed in a gap.
    s.onload = () => setMapTick(x => x + 1)
    s.onerror = () => setMapErr('Map library failed to load.')
    document.body.appendChild(s)
    // Strip Mapbox's default white popup chrome so our dark tooltip shows clean.
    const st = document.createElement('style')
    st.textContent = '.mapboxgl-popup-content{background:transparent!important;padding:0!important;box-shadow:none!important}.mapboxgl-popup-tip{display:none!important}'
    document.head.appendChild(st)
  }, [])

  const initMap = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapboxgl = (window as any).mapboxgl
    if (!mapboxgl || !MAPBOX_TOKEN || mapRef.current) return

    // The Mapbox stylesheet must be applied before we create the map, or the
    // canvas sizes to 0 and paints black with no error. A stylesheet only appears
    // in document.styleSheets once it has loaded, so this is a reliable gate.
    const cssLoaded = cssReadyRef.current ||
      Array.from(document.styleSheets).some(ss => (ss.href || '').includes('mapbox-gl'))
    if (!cssLoaded) { setTimeout(() => setMapTick(x => x + 1), 150); return }
    cssReadyRef.current = true

    // Cause #1 of "static images work but GL is black": WebGL is off. GL needs a
    // WebGL context; the static image API doesn't. Say so plainly rather than
    // painting black.
    if (typeof mapboxgl.supported === 'function' && !mapboxgl.supported()) {
      setMapErr('This browser has WebGL turned off, so the live map can’t draw (the property photos still use static images). Turn on hardware acceleration / WebGL, or update the browser.')
      return
    }

    mapboxgl.accessToken = MAPBOX_TOKEN
    // Don't create the map into a 0-size container — it paints black. Wait for layout.
    const el0 = document.getElementById('aria-explore-map')
    if (!el0 || el0.clientWidth === 0 || el0.clientHeight === 0) { setTimeout(() => setMapTick(x => x + 1), 150); return }
    try {
      const map = new mapboxgl.Map({
        container: 'aria-explore-map',
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [-96.8, 32.8], zoom: 9,
      })
      // Style/tiles loaded = everything's fine; clear any diagnostic and re-measure
      // (covers the case where the canvas was sized before layout settled).
      map.on('load', () => { setMapErr(null); try { map.resize() } catch { /* noop */ } })
      map.on('style.load', () => { try { map.resize() } catch { /* noop */ } })
      // Surface Mapbox's real failure instead of a silent black pane. A token that
      // 401s on the style/tiles (URL restrictions or missing scopes) is the usual
      // cause — the style never loads, so there are no controls, just black.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on('error', (e: any) => {
        const msg = String(e?.error?.message || e?.error || 'Map failed to load')
        setMapErr(/401|403|unauthorized|forbidden|not authorized|access token|invalid/i.test(msg)
          ? 'Mapbox rejected the token — remove URL restrictions (or add this domain) and confirm public scopes on NEXT_PUBLIC_MAPBOX_TOKEN.'
          : `Map error: ${msg}`)
      })
      mapRef.current = map
      // Re-measure whenever the container resizes (view toggles, window, layout).
      try { const ro = new ResizeObserver(() => { try { map.resize() } catch { /* noop */ } }); const c = document.getElementById('aria-explore-map'); if (c) ro.observe(c) } catch { /* noop */ }

      // If the style still hasn't loaded after 7s with NO error event, the usual
      // culprit is a zero-size container (hidden/unlaid-out) or silently blocked
      // tiles. Report the real container size so the cause is obvious.
      setTimeout(() => {
        try {
          const m = mapRef.current
          if (!m || (m.isStyleLoaded && m.isStyleLoaded())) return
          const el = document.getElementById('aria-explore-map')
          const w = el?.clientWidth ?? 0, h = el?.clientHeight ?? 0
          if (w === 0 || h === 0) {
            setMapErr(`Map area has no size yet (${w}×${h}) — it loaded while hidden. Switching to the map view should fix it; tell me if it stays blank.`)
          } else {
            setMapErr(`Map tiles didn’t load (map area is ${w}×${h}, so it’s visible). Likely blocked map tiles or the token is missing tiles/styles scope on this domain.`)
          }
        } catch { /* noop */ }
      }, 7000)
    } catch (err) {
      setMapErr(err instanceof Error ? err.message : 'Map failed to initialize')
    }
  }, [])

  // (Re)draw markers when items change. The map is the centre of the Find screen
  // (split layout: map centre + results list on the right), so it stays mounted
  // in every view except the full-width grid.
  useEffect(() => {
    if (view === 'list') return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapboxgl = (window as any).mapboxgl
    // Mapbox GL may not have finished loading yet — retry until it has.
    if (!mapboxgl) { const t = setTimeout(() => setMapTick(x => x + 1), 350); return () => clearTimeout(t) }
    initMap()
    if (!mapRef.current) { const t = setTimeout(() => setMapTick(x => x + 1), 200); return () => clearTimeout(t) }
    const map = mapRef.current
    // Mapbox measures its container on create. If it was 0×0 (hidden, or the
    // flex row hadn't laid out yet) it renders blank until told to re-measure.
    // Resize on the next frame AND after layout settles.
    requestAnimationFrame(() => { try { map.resize() } catch { /* noop */ } })
    setTimeout(() => { try { map.resize() } catch { /* noop */ } }, 120)
    setTimeout(() => { try { map.resize() } catch { /* noop */ } }, 400)
    Object.values(markersRef.current).forEach((m: any) => m.remove()) // eslint-disable-line @typescript-eslint/no-explicit-any
    markersRef.current = {}
    // Same predicate AND same lead-score order as the right-hand list, so pin
    // number N is always the same property as list row N (highest score = #1).
    const filtered = items.filter(i =>
      (!fMinUnits || (i.units ?? 0) >= fMinUnits) && (!fGate || i.gate_signal) && (!fBulk || i.bulk_detected) && (!fNew || !i.researched)
      && (!fExpBefore || (i.contract_expiry_year != null && i.contract_expiry_year <= fExpBefore))
      && (source !== 'saved' || !query.trim() || i.name.toLowerCase().includes(query.trim().toLowerCase())))
      .sort((a, b) => ((b.lead_score ?? 0) - (a.lead_score ?? 0)) || ((b.units ?? 0) - (a.units ?? 0)))
    const withCoords = filtered.filter(i => i.lat != null && i.lng != null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bounds = withCoords.length ? new mapboxgl.LngLatBounds() : null
    for (const it of withCoords) {
      const el = document.createElement('div')
      const s = it.buy_score ?? 5
      const n = filtered.indexOf(it) + 1   // matches the list number on the right
      el.style.cssText = `width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${scoreColor(s)};border:2px solid #141E29;box-shadow:0 2px 8px rgba(0,0,0,.5);cursor:pointer;display:flex;align-items:center;justify-content:center`
      const inner = document.createElement('span')
      inner.textContent = String(n)
      inner.style.cssText = 'transform:rotate(45deg);color:#fff;font-size:12px;font-weight:800'
      el.appendChild(inner)
      el.onclick = () => openDetail(it)
      // Hover tooltip (dark) — property name, location, units, top flag.
      const flag = triggerFlags(it)[0]?.label
      const popup = new mapboxgl.Popup({ offset: 22, closeButton: false, closeOnClick: false })
        .setHTML(`<div style="font-family:Inter,sans-serif;background:#141E29;color:#f1f5f9;border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:8px 10px;min-width:150px"><div style="font-weight:700;font-size:12px">${it.name}</div><div style="font-size:10px;color:#94a3b8;margin-top:2px">${[it.city, it.state].filter(Boolean).join(', ')}${it.units ? ` · ${it.units} units` : ''}</div>${flag ? `<div style="font-size:9px;font-weight:700;color:#fca5a5;margin-top:4px">${flag}</div>` : ''}</div>`)
      el.addEventListener('mouseenter', () => popup.setLngLat([it.lng!, it.lat!]).addTo(map))
      el.addEventListener('mouseleave', () => popup.remove())
      const marker = new mapboxgl.Marker(el).setLngLat([it.lng!, it.lat!]).addTo(map)
      markersRef.current[it.id] = marker
      bounds?.extend([it.lng!, it.lat!])
    }
    if (bounds && withCoords.length) { try { map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 500 }) } catch { /* noop */ } }
  }, [items, view, initMap, fMinUnits, fGate, fBulk, fNew, fExpBefore, source, query, mapTick])

  // Community/social posts are fetched + saved by their own route, separate from
  // the main engine. A saved property that was researched before that route ran
  // has none — so fetch them on open and persist. Without this, Community stays
  // blank forever on every known site.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hydrateCommunity = useCallback(async (rep: any, it: { name: string; city?: string; state?: string; address?: string; id?: string; name_aliases?: string[] }) => {
    if (!rep || (rep.community?.length ?? 0) > 0) return
    // The social route needs a city. Saved rows often have none (the column was
    // never written), so derive it from the address rather than silently giving
    // up — that guard is exactly what made Community return zero on every
    // saved property.
    const city = it.city || cityStateFromAddress(it.address ?? rep.property?.address).city
    const state = it.state || cityStateFromAddress(it.address ?? rep.property?.address).state
    if (!it.name || !city) { setCommunityErr('No city on this property, so resident posts can’t be searched.'); return }
    setCommunityBusy(true); setCommunityErr(null)
    try {
      const r = await fetch('/api/aria/social', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_name: it.name, city, state,
          // Rebrands: reviews live under whatever name the site trades as now.
          aliases: it.name_aliases ?? [],
          address: it.address ?? rep.property?.address,
          // Exact row match — survives the engine renaming a property.
          property_id: (it.id && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(it.id)) ? it.id : undefined,
          management_company: rep.property?.management_company,
          isp_providers: rep.property?.isp_providers,
          video_providers: rep.property?.video_providers,
          bulk_agreements: rep.property?.bulk_agreements,
          gate_operators: rep.property?.proptech?.gate_operators,
          access_control: rep.property?.proptech?.access_control,
        }),
      })
      // Never fail silently — "no posts exist" and "we never asked" must look different.
      if (!r.ok) {
        const t = await r.text().catch(() => '')
        setCommunityErr(r.status === 401 ? 'Sign-in expired — reload the page.' : `Couldn’t search posts (${r.status}). ${t.slice(0, 80)}`)
        return
      }
      const sd = await r.json()
      if (sd?.social_posts?.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setDetailReport((prev: any) => prev ? { ...prev, community: sd.social_posts } : prev)
      }
    } catch (e) {
      setCommunityErr(e instanceof Error ? e.message : 'Couldn’t search resident posts.')
    }
    finally { setCommunityBusy(false) }
  }, [])

  // opts.force = the user explicitly asked for fresh data (the ↻ button), so skip
  // the database short-circuit and go straight to the engine.
  const runSearch = useCallback(async (qArg?: string, opts?: { force?: boolean }) => {
    const q = (qArg ?? query).trim()
    if (!q || loading) return
    if (qArg && qArg !== query) setQuery(qArg)
    setLoading(true); setError(null); setItems([]); setSelected(new Set()); setInterp(''); setMsg(null); setDetail(null)
    try {
      // DB-FIRST for a typed property NAME. If what you typed clearly names one
      // property (not a broad area query like "apartments in Dallas"), and we
      // already have it saved, open it instantly from Supabase — no re-search,
      // no spend. Broad/discovery queries skip this and go straight to live.
      const ql = q.toLowerCase()
      const isDiscovery = /\b(in|near|around|within|with|under|over|below|above)\b/.test(ql) || /\d{2,}\s*\+?\s*(unit|units|door|doors)/.test(ql)
      const sig = ql.replace(/[.,]/g, ' ').split(/\s+/).filter(w => w.length > 2)
      if (!opts?.force && !isDiscovery && sig.length >= 1) {
        try {
          const term = [...sig].sort((a, b) => b.length - a.length)[0]
          const mr = await fetch(`/api/aria/properties?search=${encodeURIComponent(term)}&limit=50`)
          if (mr.ok) {
            const md = await mr.json()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mrows: any[] = md.properties ?? []
            // Strong match = a saved property whose NAME contains every
            // significant word you typed (conservative — avoids false hits).
            const strong = mrows.find(row => {
              const name = String(row.property_name ?? '').toLowerCase()
              return sig.every(t => name.includes(t))
            })
            if (strong) {
              const it = savedRowToItem(strong)
              const rep = normalizeReport(strong)
              setItems([it])
              setMsg('Found in your database — loaded instantly, no new search.')
              setDetail(it); setDetailReport(rep); setOpenCard(null); setScoutMsg(null)
              void hydrateCommunity(rep, it)
              setItems([it.lat != null ? it : { ...it, ...(await geocode(it)) }])
              return
            }
          }
        } catch { /* fall through to live search */ }
      }

      // ── THE INITIAL FIND ────────────────────────────────────────────────
      // Base data only: name, address, units, and which systems exist. This is
      // deliberately cheap — no deep engine, no contacts, no scoring. Deep
      // research is a separate, explicit step on a property you choose.
      const res = await fetch('/api/aria/research/base', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `Search failed (${res.status})`)

      setInterp(data.query_interpretation ?? '')
      setResultKind(data.type === 'multi' ? 'multi' : 'single')
      setSavedFilter('all')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list: PropItem[] = (data.properties ?? []).map((p: any, i: number) => ({
        id: p.saved_id || `base-${(p.name ?? 'prop').toLowerCase().replace(/\s+/g, '-')}-${i}`,
        name: p.name ?? 'Unknown Property',
        address: p.address ?? '', city: p.city ?? '', state: p.state ?? '',
        units: p.units ?? undefined,
        management_company: p.management_company ?? undefined,
        website: p.website ?? null,
        photo_url: p.photo_url ?? null,
        name_aliases: Array.isArray(p.name_aliases) ? p.name_aliases : [],
        systems: p.systems,
        // Area/criteria hunts return the review-evidence for the pain the rep asked
        // for — surface it as the pain_brief that drives the "Gate complaints" flag.
        pain_brief: p.pain_note ?? undefined,
        lead_score: typeof p.lead_score === 'number' ? p.lead_score : undefined,
        // Mirror the base flags onto the legacy signals the filters/pins read.
        bulk_detected: !!p.systems?.bulk,
        gate_signal: !!p.systems?.gates,
        researched: !!p.already_saved,   // ✓ Saved = genuinely in the Intel DB
        saved_id: p.saved_id ?? null,
      }))

      if (!list.length) {
        setError(data.type === 'multi'
          ? 'No matching properties found. Try a broader area, a lower unit count, or fewer filters.'
          : 'No properties matched that. Try the full name, or add a city.')
      }
      setItems(list)
      const geo = await Promise.all(list.map(async it => ({ ...it, ...(await geocode(it)) })))
      setItems(geo)
      // A single named property → open it straight away on the right.
      if (data.type !== 'multi' && geo.length === 1) setDetail(geo[0])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally { setLoading(false) }
  }, [query, loading, hydrateCommunity])

  // Browse the Intel DB — everything already researched, instant, no spend.
  const loadSaved = useCallback(async () => {
    setLoading(true); setError(null); setItems([]); setSelected(new Set()); setInterp(''); setMsg(null); setDetail(null)
    try {
      const params = new URLSearchParams({ limit: '200', order_by: 'last_researched_at' })
      if (fExpBefore) { params.set('expiry_before', String(fExpBefore)); params.set('expiry_after', String(new Date().getFullYear())) }
      const r = await fetch(`/api/aria/properties?${params}`)
      const d = await r.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = d.properties ?? []
      const list: PropItem[] = rows.map(savedRowToItem)
      setItems(list)
      const geo = await Promise.all(list.map(async it => (it.lat != null ? it : { ...it, ...(await geocode(it)) })))
      setItems(geo)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load saved') }
    finally { setLoading(false) }
  }, [fExpBefore])

  const onFind = source === 'saved' ? loadSaved : () => runSearch()

  // Load data for the Leads / Contacts nav panels (both derived from searches).
  useEffect(() => {
    if (!panel || panel === 'settings' || panel === 'history') return
    setPanelLoading(true); setPanelItems([])
    void (async () => {
      try {
        if (panel === 'leads') {
          const r = await fetch('/api/crm/leads?limit=200')
          const d = await r.json()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rows: any[] = d.records ?? d.leads ?? d.data ?? []
          setPanelItems(rows.filter(l => ['aria', 'aria_pool'].includes(String(l.source))))
        } else if (panel === 'contacts') {
          const r = await fetch('/api/aria/properties?limit=200')
          const d = await r.json()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const out: any[] = []
          for (const p of (d.properties ?? [])) {
            const dms = p.facts?.decision_makers ?? p.dm_chain ?? []
            for (const c of dms) if (c?.name && c.name !== 'No data found') out.push({ ...c, _property: p.property_name })
          }
          const seen = new Set<string>()
          setPanelItems(out.filter(c => { const k = `${(c.name || '').toLowerCase()}|${(c.company || '').toLowerCase()}`; if (seen.has(k)) return false; seen.add(k); return true }))
        }
      } catch { /* ignore */ } finally { setPanelLoading(false) }
    })()
  }, [panel])

  const toggle = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectedItems = items.filter(i => selected.has(i.id))
  const matchesFilters = (it: PropItem) =>
    (!fMinUnits || (it.units ?? 0) >= fMinUnits) &&
    (!fGate || it.gate_signal) &&
    (!fBulk || it.bulk_detected) &&
    (!fNew || !it.researched) &&
    // All / New only / Already searched
    (savedFilter === 'all' || (savedFilter === 'new' ? !it.researched : !!it.researched)) &&
    (!fExpBefore || (it.contract_expiry_year != null && it.contract_expiry_year <= fExpBefore)) &&
    (source !== 'saved' || !query.trim() || it.name.toLowerCase().includes(query.trim().toLowerCase()))
  const visible = items.filter(matchesFilters)
    // Order by lead score (highest first); fall back to unit size when tied/absent.
    .sort((a, b) => ((b.lead_score ?? 0) - (a.lead_score ?? 0)) || ((b.units ?? 0) - (a.units ?? 0)))
  const alreadyCount = items.filter(i => i.researched).length

  // Save the selected base findings into the Intel DB. Base data only — name,
  // address, units and the system flags. Deep research enriches the same row later.
  const saveToDb = useCallback(async (list: PropItem[]) => {
    if (!list.length) return
    setSaveBusy(true); setMsg(null); setError(null)
    try {
      const r = await fetch('/api/aria/properties/save-base', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          properties: list.map(it => ({
            name: it.name, address: it.address, city: it.city, state: it.state,
            units: it.units ?? null, website: it.website ?? null,
            management_company: it.management_company ?? null,
            lat: it.lat ?? null, lng: it.lng ?? null,
            photo_url: it.photo_url ?? null,
            systems: it.systems,
          })),
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Save failed')
      // Only mark ✓ Saved on what genuinely landed.
      if (d.saved > 0) {
        const savedNames = new Set(list.map(x => x.name))
        setItems(prev => prev.map(x => savedNames.has(x.name) ? { ...x, researched: true } : x))
      }
      setSelected(new Set())
      setMsg(`Saved ${d.saved} to your database${d.failed ? ` · ${d.failed} failed` : ''}.`)
      if (d.failed) setError(`${d.failed} did not save: ${(d.errors ?? [])[0] ?? 'unknown error'}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save to the database.')
    } finally { setSaveBusy(false) }
  }, [])

  const addToLeads = useCallback(async (list: PropItem[]) => {
    if (!list.length) return
    setBusy(true); setMsg(null)
    try {
      const r = await fetch('/api/aria/candidates/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidates: list }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed')
      setMsg(`Added ${d.created ?? 0} to Leads${d.skipped ? ` · ${d.skipped} already there` : ''}.`)
      setScoutLeadIds(Array.isArray(d.lead_ids) ? d.lead_ids : [])
      setScoutMsg(null)
      setSelected(new Set())
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not add to Leads.') }
    finally { setBusy(false) }
  }, [])

  // Start the SCOUT outreach cadence on the leads we just created.
  const launchScout = useCallback(async () => {
    if (!scoutLeadIds.length) return
    setBusy(true); setScoutMsg(null)
    try {
      const r = await fetch('/api/aria/scout/launch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_ids: scoutLeadIds }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed')
      setScoutMsg(`SCOUT: ${d.sent ?? 0} sent${d.skipped ? ` · ${d.skipped} skipped` : ''}${d.errors ? ` · ${d.errors} errors` : ''}.`)
      setScoutLeadIds([])
    } catch (e) { setScoutMsg(e instanceof Error ? e.message : 'SCOUT failed') }
    finally { setBusy(false) }
  }, [scoutLeadIds])

  // View/Research a single property in the detail panel (view-first: cache-hits
  // instantly if already researched, else runs the full search once).
  const researchDetail = useCallback(async (it: PropItem) => {
    setDetailBusy(true); setDetailReport(null)
    try {
      const r = await fetch('/api/aria/research/deep', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `${it.name} ${it.city} ${it.state}`.trim() }),
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      const rep = d?.prospects?.[0] ? normalizeReport(d.prospects[0]) : null
      setDetailReport(rep)
      setItems(prev => prev.map(x => x.id === it.id ? { ...x, researched: true } : x))
      // GUARANTEE all data (facts + inferred) is saved to Supabase — post the full
      // prospect to the canonical upsert (builds facts + deductions incl. inferred).
      if (d?.prospects?.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p0: any = d.prospects[0]
        // Save FIRST so the row exists — the social route finds the property by
        // name and can only write its posts onto an existing row.
        await fetch('/api/aria/properties', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prospects: d.prospects }),
        }).catch(() => {})
        // Then fetch + save Community posts (same helper the saved path uses).
        void hydrateCommunity(rep, {
          name: p0.property?.name ?? it.name,
          city: p0.property?.city ?? it.city,
          state: p0.property?.state ?? it.state,
        })
      }
    } catch { setDetailReport({ _error: true }) }
    finally { setDetailBusy(false) }
  }, [hydrateCommunity])

  // Open a property: for Saved rows (real id) load the canonical record instantly
  // (no re-search); for discover cards, just open — Research fills it in.
  const openDetail = useCallback(async (it: PropItem) => {
    setDetail(it); setDetailReport(null); setOpenCard(null); setScoutMsg(null)
    setDetailBusy(true)
    // Make sure the popup can draw its satellite map: geocode in the background
    // if we don't already have coordinates, then patch them onto the open detail.
    if ((it.lat == null || it.lng == null) && MAPBOX_TOKEN) {
      void geocode(it).then(g => {
        if (g) setDetail(prev => (prev && prev.id === it.id ? { ...prev, lat: g.lat, lng: g.lng } : prev))
      }).catch(() => {})
    }
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(it.id)
      // Saved rows carry the real id → load by id (fastest path).
      if (isUuid) {
        const r = await fetch(`/api/aria/properties/${it.id}`)
        if (r.ok) {
          const row = await r.json()
          const rep = normalizeReport(row)
          setDetailReport(rep)
          void hydrateCommunity(rep, it)   // backfill Community if this row has none yet
          return
        }
      }
      // ALWAYS check the database first — research often RENAMES a property
      // ("Avana on Main" → "Avana Uptown Apartments"), so match on a keyword +
      // city, not the exact name. A paid search only happens when it's truly
      // not found in Supabase.
      const nm = it.name.toLowerCase().trim()
      const tokens = nm.split(/\s+/).filter(w => w.length > 3)
      const term = tokens[0] || it.name
      const city = (it.city || '').toLowerCase()
      const r = await fetch(`/api/aria/properties?search=${encodeURIComponent(term)}&limit=30`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let matched: any = null
      if (r.ok) {
        const d = await r.json()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: any[] = d.properties ?? []
        matched = rows.find(p => (p.property_name ?? '').toLowerCase() === nm)
          ?? rows.find(p => {
            const pn = (p.property_name ?? '').toLowerCase()
            const pc = (p.facts?.property?.city ?? p.city ?? '').toLowerCase()
            const shares = tokens.some(t => pn.includes(t))
            return shares && (!city || !pc || pc === city)
          })
      }
      if (matched) {
        const rep = normalizeReport(matched)
        setDetailReport(rep)
        void hydrateCommunity(rep, it)
      } else {
        // Not in the Intel DB yet — a fresh base/area find. Build a lightweight
        // base report straight from the row so the panel renders AND community
        // insights (resident posts) load right now, without a full deep run.
        // `_base` marks it so the "Deep research" CTA still shows.
        const baseRep = {
          _base: true,
          property: {
            name: it.name, address: it.address, city: it.city, state: it.state,
            units: it.units ?? null, management_company: it.management_company ?? null,
            website: it.website ?? null, photo_url: it.photo_url ?? null,
            isp_providers: [], video_providers: [], bulk_agreements: [],
            proptech: { gate_operators: [], access_control: [], intercoms: [], cameras: [], smart_locks: [], resident_apps: [], package_solutions: [] },
            inferred_proptech: [],
          },
          contacts: [],
          community: [],
        }
        setDetailReport(baseRep)
        void hydrateCommunity(baseRep, it)
      }
    } catch { /* ignore */ } finally { setDetailBusy(false) }
  }, [hydrateCommunity])

  // Deep research on the selected properties. Deliberately SEQUENTIAL — one at a
  // time. Running them in parallel blows the serverless timeout and the engine's
  // rate limits. Each one reports its own status so it's obvious what's happening.
  const runDeepQueue = useCallback(async (list: PropItem[]) => {
    if (!list.length || queueRunning) return
    setQueueRunning(true)
    setError(null); setMsg(null)
    setQueue(list.map(it => ({ id: it.id, name: it.name, status: 'queued' as const })))

    for (const it of list) {
      setQueue(q => q.map(x => x.id === it.id ? { ...x, status: 'running' } : x))
      try {
        const r = await fetch('/api/aria/research/deep', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `${it.name} ${it.city} ${it.state}`.trim(),
            // Start from what we already saved instead of rediscovering it.
            property_id: (it.saved_id && /^[0-9a-f]{8}-/i.test(it.saved_id)) ? it.saved_id
              : (/^[0-9a-f]{8}-/i.test(it.id) ? it.id : undefined),
          }),
        })
        const d = await r.json().catch(() => ({}))
        if (!r.ok || d.error) throw new Error(d.error || `Search failed (${r.status})`)
        // Only call it done if it genuinely persisted.
        if (d.saved_to_intel_db === false) throw new Error(d.save_error || 'found, but did not save')
        setQueue(q => q.map(x => x.id === it.id ? { ...x, status: 'done' } : x))
        setItems(prev => prev.map(x => x.id === it.id ? { ...x, researched: true } : x))
      } catch (e) {
        const note = e instanceof Error ? e.message : 'failed'
        setQueue(q => q.map(x => x.id === it.id ? { ...x, status: 'failed', note } : x))
      }
    }

    setQueueRunning(false)
    setSelected(new Set())
  }, [queueRunning])

  // History pick / known search → ALWAYS pull from Supabase first. Every full
  // search is auto-saved, so re-running a past search must be an instant DB read
  // (no re-search, no spend). Only falls back to a live search if nothing at all
  // is found in the database for that query.
  // View = read the database only. It must NEVER fall through to a paid search;
  // if there's nothing saved we say so and let the user press ↻ deliberately.
  const openFromSaved = useCallback(async (q: string, opts?: { allowLive?: boolean }) => {
    const raw = (q ?? '').trim()
    if (!raw) return
    setPanel(null); setSource('discover'); setQuery(raw)
    setLoading(true); setError(null); setItems([]); setSelected(new Set()); setInterp(''); setMsg(null); setDetail(null); setDetailReport(null)
    try {
      const tokens = raw.toLowerCase().split(/\s+/).filter(w => w.length > 3)
      const term = tokens[0] || raw
      const r = await fetch(`/api/aria/properties?search=${encodeURIComponent(term)}&limit=50`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let rows: any[] = []
      if (r.ok) { const d = await r.json(); rows = d.properties ?? [] }
      // Keep rows that actually relate to the query (share a token in name/mgmt/address/city).
      const rel = rows.filter(row => {
        const hay = `${row.property_name ?? ''} ${row.management_company ?? ''} ${row.address ?? ''} ${row.facts?.property?.city ?? row.city ?? ''}`.toLowerCase()
        return tokens.length === 0 || tokens.some(t => hay.includes(t))
      })
      const use = rel.length ? rel : rows
      if (use.length) {
        const list = use.map(savedRowToItem)
        setItems(list)
        setMsg(`Loaded ${list.length} saved ${list.length === 1 ? 'property' : 'properties'} from your database — no new search.`)
        // Exactly one match → open its full canonical report instantly.
        if (list.length === 1) openDetail(list[0])
        const geo = await Promise.all(list.map(async it => (it.lat != null ? it : { ...it, ...(await geocode(it)) })))
        setItems(geo)
        return
      }
      // Nothing saved for this one. Don't silently spend — tell the user and let
      // them choose to search again.
      if (!opts?.allowLive) {
        setMsg('Not saved yet — press ↻ Search again to pull fresh data for this one.')
        return
      }
      await runSearch(raw, { force: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load from database')
    } finally { setLoading(false) }
  }, [runSearch, openDetail, hydrateCommunity])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const NAV: { href?: string; onClick?: () => void; active?: boolean; Icon: any; label: string }[] = [
    { href: '/', Icon: LayoutGrid, label: 'Home' },
    { onClick: () => { setPanel(null); setSource('discover') }, active: !panel && source === 'discover', Icon: MapPin, label: 'Discover' },
    { onClick: () => setPanel('history'), active: panel === 'history', Icon: Clock, label: 'History' },
    { onClick: () => setPanel('leads'), active: panel === 'leads', Icon: Star, label: 'Leads' },
    { onClick: () => { setPanel(null); setSource('saved'); loadSaved() }, active: !panel && source === 'saved', Icon: Building2, label: 'Portfolio' },
    { onClick: () => setPanel('contacts'), active: panel === 'contacts', Icon: Users, label: 'Contacts' },
  ]

  return (
    // Shared Nexus backdrop instead of a flat one-off #141E29, so ARIA reads as
    // the same app as the dashboard. Panels below still paint their own darker
    // surfaces on top; only the page base changed.
    <div className="relative flex h-full" style={{ background: NEXUS_BG, height: '100dvh', minHeight: '100vh' }}>
      <NexusBackdropLayers variant="page" />
      {/* Left icon nav */}
      <aside className="w-14 shrink-0 flex flex-col items-center py-3 border-r border-white/[0.07]" style={{ background: '#10161F' }}>
        {NAV.map((n, i) => n.href ? (
          <a key={i} href={n.href} title={n.label}
            className={`w-full flex flex-col items-center gap-0.5 py-2.5 transition-colors ${n.active ? 'text-[#5FB8E0]' : 'text-slate-500 hover:text-slate-200'}`}>
            <n.Icon size={18} /><span className="text-[8px] font-bold">{n.label}</span>
          </a>
        ) : (
          <button key={i} onClick={n.onClick} title={n.label}
            className={`w-full flex flex-col items-center gap-0.5 py-2.5 transition-colors ${n.active ? 'text-[#5FB8E0]' : 'text-slate-500 hover:text-slate-200'}`}>
            <n.Icon size={18} /><span className="text-[8px] font-bold">{n.label}</span>
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => setPanel('settings')} title="Settings"
          className={`w-full flex flex-col items-center gap-0.5 py-2.5 transition-colors ${panel === 'settings' ? 'text-[#5FB8E0]' : 'text-slate-500 hover:text-slate-200'}`}>
          <Settings size={18} /><span className="text-[8px] font-bold">Settings</span>
        </button>
      </aside>

      {/* Main column */}
      <div className="flex flex-col flex-1 min-w-0 h-full" style={{ height: '100dvh' }}>
      {/* Header */}
      <header className="h-16 shrink-0 flex items-center px-5 gap-4 border-b border-white/[0.07]">
        <a href="/" className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-white/10 text-slate-200 hover:bg-[#1E2A3A] transition-all">
          <ArrowLeft size={13} /> Back to Dashboard
        </a>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-slate-100 leading-tight">ARIA</h1>
          <p className="text-[11px] text-slate-400 leading-tight hidden sm:block">Find properties</p>
        </div>
        <div className="flex-1" />
      </header>

      {/* Nav panels — History / Leads / Contacts / Settings (all derived from searches) */}
      {panel && (
        <div className="fixed inset-y-0 right-0 z-40 flex" style={{ left: 56 }} onClick={() => setPanel(null)}>
          <div className="relative w-full max-w-md h-full overflow-y-auto shadow-2xl" style={{ background: '#141E29', borderRight: '1px solid rgba(255,255,255,0.08)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10 sticky top-0 z-10" style={{ background: '#141E29' }}>
              {panel === 'leads' ? <Star size={15} className="text-[#5FB8E0]" /> : panel === 'contacts' ? <Users size={15} className="text-[#5FB8E0]" /> : panel === 'history' ? <Clock size={15} className="text-[#5FB8E0]" /> : <Settings size={15} className="text-[#5FB8E0]" />}
              <span className="text-base font-bold text-slate-100">{panel === 'leads' ? 'Leads from ARIA' : panel === 'contacts' ? 'Contacts found' : panel === 'history' ? 'Search history' : 'Search settings'}</span>
              {(panel === 'leads' || panel === 'contacts') && <span className="text-[11px] font-semibold text-slate-500">{panelItems.length}</span>}
              <button onClick={() => setPanel(null)} className="ml-auto text-slate-500 hover:text-slate-200"><X size={17} /></button>
            </div>

            {panelLoading && <div className="flex items-center gap-2 px-5 py-6 text-slate-400 text-xs"><Loader2 size={14} className="animate-spin" /> Loading…</div>}

            {/* HISTORY */}
            {panel === 'history' && (
              <div className="p-4 h-[calc(100%-4.5rem)]">
                <SearchHistoryPanel
                  onPick={(qq) => openFromSaved(qq)}
                  onResearch={(qq) => { setPanel(null); setSource('discover'); setQuery(qq); runSearch(qq, { force: true }) }}
                />
              </div>
            )}

            {/* LEADS */}
            {panel === 'leads' && !panelLoading && (
              <div className="p-4 space-y-2">
                {panelItems.length === 0 && <p className="text-[12px] text-slate-500 px-1 py-6 text-center">No ARIA leads yet. Add properties to Leads from a search.</p>}
                {panelItems.map((l, i) => (
                  <button key={i} onClick={() => { setPanel(null); openDetail({ id: l.property_name || l.id, name: l.property_name || l.contact_name || 'Property', address: l.location ?? '', city: l.city ?? '', state: l.state ?? '' }) }}
                    className="w-full text-left rounded-xl border border-white/10 bg-[#1E2A3A]/70 hover:border-[#5FB8E0]/50 p-3 transition-all">
                    <p className="text-[13px] font-bold text-slate-100 truncate">{l.property_name || l.contact_name || 'Untitled'}</p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{[l.city, l.state].filter(Boolean).join(', ') || '—'}{l.unit_count ? ` · ${l.unit_count} units` : ''}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {l.stage && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#5FB8E0]/10 text-[#9FD8EC] border border-[#5FB8E0]/25 capitalize">{l.stage}</span>}
                      {l.scout_status && l.scout_status !== 'queued' && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-400/10 text-emerald-300 border border-emerald-400/30">SCOUT {l.scout_status}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* CONTACTS */}
            {panel === 'contacts' && !panelLoading && (
              <div className="p-4 space-y-2">
                {panelItems.length === 0 && <p className="text-[12px] text-slate-500 px-1 py-6 text-center">No contacts yet. Research properties and their decision-makers show up here.</p>}
                {panelItems.map((c, i) => (
                  <button key={i} onClick={() => { setPanel(null); openDetail({ id: c._property || '', name: c._property || '', address: '', city: '', state: '' }) }}
                    className="w-full text-left rounded-xl border border-white/10 bg-[#1E2A3A]/70 hover:border-[#5FB8E0]/50 p-3 transition-all">
                    <p className="text-[13px] font-bold text-slate-100 truncate">{c.name} <span className="text-slate-500 font-normal text-[11px]">· {c.title || c.role_type || '—'}</span>{c.role_type === 'owner' && <span className="ml-1.5 rounded px-1 py-0.5 text-[8px] font-bold" style={{ background: 'rgba(251,191,36,0.16)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)' }}>OWNER</span>}</p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{[c.email, c.phone].filter((x: string) => x && x !== 'No data found').join('  ·  ') || 'No email / phone'}</p>
                    {c.address && c.address !== 'No data found' && <p className="text-[10px] text-slate-500 truncate mt-0.5">📍 {c.address}</p>}
                    {c._property && <p className="text-[10px] text-slate-500 truncate mt-0.5 flex items-center gap-1"><Building2 size={9} /> {c._property}</p>}
                  </button>
                ))}
              </div>
            )}

            {/* SETTINGS */}
            {panel === 'settings' && (
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Default search type</p>
                  <div className="flex gap-1.5">
                    {CATEGORIES.map(c => (
                      <button key={c.key} onClick={() => { setCategory(c.key); try { localStorage.setItem('aria_def_cat', c.key) } catch { /* */ } }}
                        className={`text-[11px] font-bold px-3 py-1.5 rounded-full border ${category === c.key ? 'bg-[#5FB8E0] text-white border-[#5FB8E0]' : 'text-slate-300 border-white/10'}`}>{c.label}</button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#1E2A3A] p-3.5">
                  <div>
                    <p className="text-[13px] font-bold text-slate-100">Skip already-found</p>
                    <p className="text-[11px] text-slate-400">Hide properties already in your database from results.</p>
                  </div>
                  <button onClick={() => { const nv = !fNew; setFNew(nv); try { localStorage.setItem('aria_skip_found', String(nv)) } catch { /* */ } }}
                    className={`w-11 h-6 rounded-full transition-colors relative ${fNew ? 'bg-[#5FB8E0]' : 'bg-white/15'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${fNew ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">More search controls (data sources, refresh cadence) coming here.</p>
              </div>
            )}
          </div>
          <div className="flex-1 bg-black/40" />
        </div>
      )}

      {/* Search: one word + area */}
      <div className="shrink-0 px-5 py-3 border-b border-white/[0.07]">
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          {/* Source: live discovery vs the saved Intel DB */}
          <div className="flex items-center rounded-full border border-white/10 overflow-hidden mr-2">
            <button onClick={() => { setSource('discover'); setItems([]); setDetail(null) }}
              className={`text-[11px] font-bold px-3 py-1.5 ${source === 'discover' ? 'bg-[#5FB8E0] text-white' : 'text-slate-300 hover:bg-[#1E2A3A]'}`}>Discover</button>
            <button onClick={() => { setSource('saved'); loadSaved() }}
              className={`text-[11px] font-bold px-3 py-1.5 ${source === 'saved' ? 'bg-[#5FB8E0] text-white' : 'text-slate-300 hover:bg-[#1E2A3A]'}`}>Saved</button>
          </div>
          {source === 'discover' && CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCategory(c.key)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all ${category === c.key ? 'bg-[#5FB8E0] text-white border-[#5FB8E0]' : 'text-slate-300 border-white/10 hover:border-[#5FB8E0]/50'}`}>
              {c.label}
            </button>
          ))}
          {source === 'saved' && <span className="text-[11px] text-slate-500 font-medium">Everything you&apos;ve already researched — instant, no spend.</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2.5 max-w-2xl" style={{ background: 'rgba(15,24,48,0.9)', border: '1px solid rgba(95,184,224,0.2)' }}>
            <Search size={15} className="text-slate-400 shrink-0" />
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && onFind()}
              placeholder={source === 'saved' ? 'Filter saved properties by name…' : CATEGORIES.find(c => c.key === category)?.hint}
              className="flex-1 bg-transparent text-sm font-medium text-slate-100 placeholder:text-slate-500 outline-none" disabled={loading} />
          </div>
          <button onClick={onFind} disabled={loading || (source === 'discover' && !query.trim())}
            className="flex items-center gap-1.5 text-sm font-bold px-5 py-2.5 rounded-xl text-white disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg,#22303F,#2B3C52 45%,#5FB8E0)' }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}{loading ? 'Loading…' : source === 'saved' ? 'Reload' : 'Find'}
          </button>
          {/* List / Map toggle */}
          {items.length > 0 && (
            <div className="flex items-center rounded-lg border border-white/10 overflow-hidden ml-1">
              <button onClick={() => setView('map')} className={`flex items-center gap-1 text-[11px] font-bold px-3 py-2 ${view === 'map' ? 'bg-[#5FB8E0] text-white' : 'text-slate-300 hover:bg-[#1E2A3A]'}`}><MapIcon size={12} /> Map</button>
              <button onClick={() => setView('list')} className={`flex items-center gap-1 text-[11px] font-bold px-3 py-2 ${view === 'list' ? 'bg-[#5FB8E0] text-white' : 'text-slate-300 hover:bg-[#1E2A3A]'}`}><LayoutGrid size={12} /> Big cards</button>
            </div>
          )}
        </div>
        {interp && <p className="text-[11px] text-slate-400 mt-2">{interp}</p>}
        {error && <p className="text-[11px] text-rose-300 mt-2">{error}</p>}
        {msg && <p className="text-[11px] text-emerald-300 mt-2 font-semibold">{msg}</p>}
      </div>

      {/* Filters */}
      {items.length > 0 && (
        <div className="shrink-0 px-5 py-2 border-b border-white/[0.07] flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mr-1">Filter</span>
          {([['Has gate', fGate, setFGate], ['Bulk', fBulk, setFBulk], [`Skip already-found${alreadyCount ? ` (${alreadyCount})` : ''}`, fNew, setFNew]] as const).map(([label, val, set]) => (
            <button key={label} onClick={() => set(v => !v)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all ${val ? 'bg-[#5FB8E0] text-white border-[#5FB8E0]' : 'text-slate-300 border-white/10 hover:border-[#5FB8E0]/50'}`}>
              {label}
            </button>
          ))}
          <select value={fMinUnits} onChange={e => setFMinUnits(Number(e.target.value))}
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-full bg-[#1A2532] text-slate-300 border border-white/10 outline-none">
            <option value={0}>Any units</option>
            <option value={100}>100+ units</option>
            <option value={200}>200+ units</option>
            <option value={300}>300+ units</option>
          </select>
          {source === 'saved' && (
            <select value={fExpBefore} onChange={e => setFExpBefore(Number(e.target.value))}
              className="text-[11px] font-bold px-2.5 py-1.5 rounded-full bg-[#1A2532] text-slate-300 border border-white/10 outline-none">
              <option value={0}>Any contract</option>
              <option value={new Date().getFullYear() + 1}>Expiring ≤ {new Date().getFullYear() + 1}</option>
              <option value={new Date().getFullYear() + 2}>Expiring ≤ {new Date().getFullYear() + 2}</option>
              <option value={new Date().getFullYear() + 3}>Expiring ≤ {new Date().getFullYear() + 3}</option>
            </select>
          )}
          <span className="ml-auto text-[10px] font-semibold text-slate-500">{visible.length} of {items.length}</span>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-hidden relative" style={{ minHeight: 0 }}>
        {/* NOTE: the empty/loading states must NOT cover the map.
            They used to render here as h-full siblings ABOVE the map container,
            so with zero results they blanketed the whole centre — the map was
            mounted underneath, measuring 0 usable space, and never painted.
            That, not the Mapbox token, is why the centre was empty. They live
            inside the results panel now; the map owns the centre unconditionally. */}
        {items.length === 0 && !loading && view === 'list' && (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 gap-3 px-6">
            <MapPin size={30} className="opacity-25" />
            <p className="text-sm font-bold text-slate-400">Pick a word, type an area, hit Find</p>
            <p className="text-[11px]">Properties show up here as a list or on the map.</p>
          </div>
        )}
        {loading && items.length === 0 && view === 'list' && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
            <Loader2 size={22} className="animate-spin text-[#5FB8E0]" /><p className="text-xs font-semibold">Finding properties…</p>
          </div>
        )}

        {/* LIST VIEW */}
        {items.length > 0 && view === 'list' && (
          <div className="h-full overflow-y-auto p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-w-5xl mx-auto pb-20">
              {visible.map(it => {
                const s = it.buy_score ?? 5
                const isSel = selected.has(it.id)
                // Hero = the property's OWN photo (website og:image) only. The map is
                // the map view — never a satellite tile masquerading as a hero shot.
                const thumb = it.photo_url ?? null
                return (
                  <div key={it.id} className={`relative rounded-xl border overflow-hidden transition-all bg-[#1E2A3A]/70 ${isSel ? 'border-[#5FB8E0] ring-1 ring-[#5FB8E0]/40' : 'border-white/10 hover:border-[#5FB8E0]/50'}`}>
                    {/* Aerial thumbnail */}
                    <button onClick={() => openDetail(it)} className="block w-full relative h-28 bg-[#1A2532]">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt={it.name} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><MapPin size={20} className="text-slate-600" /></div>
                      )}
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(11,23,40,0) 45%,rgba(11,23,40,0.85) 100%)' }} />
                      <div className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shadow-md" style={{ background: scoreColor(s) }}>{s}</div>
                      {it.researched && <span className="absolute top-2.5 left-9 text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/90 text-white">✓ Researched</span>}
                    </button>
                    {/* Select checkbox */}
                    <button onClick={() => toggle(it.id)} aria-label="Select"
                      className={`absolute top-2.5 left-2.5 z-10 w-7 h-7 rounded-lg border-2 flex items-center justify-center shadow-lg transition-all ${isSel ? 'bg-[#5FB8E0] border-white' : 'border-white bg-black/55 backdrop-blur-sm hover:bg-black/75'}`}>
                      {isSel && <Check size={16} className="text-white" strokeWidth={3} />}
                    </button>
                    {/* Content */}
                    <button onClick={() => openDetail(it)} className="block w-full text-left p-3">
                      <h3 className="text-sm font-bold text-slate-100 truncate">{it.name}</h3>
                      <p className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5"><MapPin size={10} className="opacity-70" /> {[it.city, it.state].filter(Boolean).join(', ') || '—'}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {typeof it.lead_score === 'number' && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded text-white" title="Lead score (0–100): buy intent + size + pro-tech fit"
                            style={{ background: it.lead_score >= 70 ? '#059669' : it.lead_score >= 40 ? '#D97706' : '#475569' }}>LEAD {it.lead_score}</span>
                        )}
                        {it.units ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#1A2532] text-slate-300 border border-white/10">{it.units} units</span> : null}
                        {triggerFlags(it).map(f => <span key={f.label} className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${toneClass(f.tone)}`}>{f.label}</span>)}
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* MAP + RESULTS — map fills the centre, results live in the right third.
            NOTE: this must NOT be hidden when items is empty. Mapbox initialises
            into a display:none container at 0×0 and paints nothing, which is why
            the centre came up blank. Keep it mounted whenever we're in map view. */}
        <div className={`absolute inset-0 flex ${view === 'map' ? '' : 'hidden'}`}>
          {/* Map (centre) */}
          <div className="relative flex-1 min-w-0">
            <div id="aria-explore-map" className="absolute inset-0" style={{ width: '100%', height: '100%' }} />
            {mapErr && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6 pointer-events-none" style={{ background: '#1A2532' }}>
                <MapIcon size={26} className="text-slate-600" />
                <p className="text-[12px] font-semibold text-slate-300">{mapErr}</p>
                <p className="text-[11px] text-slate-500">Results still work — you just won’t see pins.</p>
              </div>
            )}
          </div>

          {/* Results (right third) */}
          <aside className="w-[34%] min-w-[290px] max-w-[420px] shrink-0 flex flex-col border-l border-white/[0.08]" style={{ background: '#141E29' }}>
            {/* Plain-English instructions. If you have to explain the flow in a
                meeting, the screen isn't doing its job. */}
            {visible.length > 0 && (
              <div className="px-3 py-2 border-b border-white/[0.07]" style={{ background: 'rgba(95,184,224,0.06)' }}>
                <p className="text-[10.5px] text-slate-300 leading-relaxed">
                  <span className="font-bold text-[#9FD8EC]">Save</span> keeps a property (free, instant).{' '}
                  <span className="font-bold text-[#9FD8EC]">Deep research</span> then finds the contacts, internet &amp; TV deals, gate and camera brands, and what residents complain about.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.07]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">{visible.length} found</span>
              {alreadyCount > 0 && <span className="text-[10px] font-semibold text-emerald-400">{alreadyCount} saved</span>}
              <button onClick={() => setSelected(selected.size === visible.length ? new Set() : new Set(visible.map(v => v.id)))}
                className="ml-auto text-[10px] font-bold text-[#5FB8E0] hover:underline">
                {selected.size === visible.length && visible.length > 0 ? 'Clear all' : 'Select all'}
              </button>
            </div>

            {/* Include previously-searched properties, or only new ones? */}
            {resultKind === 'multi' && items.length > 0 && (
              <div className="flex items-center gap-1 px-3 py-2 border-b border-white/[0.07]">
                {([
                  { k: 'all',   label: 'All',            n: items.length },
                  { k: 'new',   label: 'New only',       n: items.filter(i => !i.researched).length },
                  { k: 'saved', label: 'Already searched', n: items.filter(i => i.researched).length },
                ] as const).map(c => (
                  <button key={c.k} onClick={() => setSavedFilter(c.k)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                      savedFilter === c.k
                        ? 'bg-[#5FB8E0] text-white border-[#5FB8E0]'
                        : 'text-slate-400 border-white/10 hover:border-[#5FB8E0]/50'}`}>
                    {c.label} <span className="opacity-70">{c.n}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Deep research queue — one at a time, and you can see exactly where it is. */}
            {queue.length > 0 && (
              <div className="px-3 py-2.5 border-b border-white/[0.07]" style={{ background: 'rgba(95,184,224,0.07)' }}>
                <div className="flex items-center gap-2 mb-2">
                  {queueRunning
                    ? <Loader2 size={12} className="animate-spin text-[#5FB8E0]" />
                    : <Check size={12} className="text-emerald-400" strokeWidth={3} />}
                  <span className="text-[11px] font-bold text-slate-200">
                    {queueRunning
                      ? `Researching ${queue.filter(q => q.status === 'done' || q.status === 'failed').length + 1} of ${queue.length}`
                      : `Finished — ${queue.filter(q => q.status === 'done').length} of ${queue.length} done`}
                  </span>
                  {!queueRunning && (
                    <button onClick={() => setQueue([])} className="ml-auto text-[10px] font-bold text-slate-400 hover:text-slate-200">Clear</button>
                  )}
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {queue.map(q => (
                    <div key={q.id} className="flex items-center gap-2 text-[10.5px]">
                      <span className="shrink-0 w-4 text-center">
                        {q.status === 'queued'  && <span className="text-slate-500">•</span>}
                        {q.status === 'running' && <Loader2 size={10} className="animate-spin text-[#5FB8E0] inline" />}
                        {q.status === 'done'    && <span className="text-emerald-400 font-bold">✓</span>}
                        {q.status === 'failed'  && <span className="text-rose-400 font-bold">✕</span>}
                      </span>
                      <span className={`truncate flex-1 ${q.status === 'done' ? 'text-slate-400' : 'text-slate-200'}`}>{q.name}</span>
                      <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wide ${
                        q.status === 'running' ? 'text-[#5FB8E0]'
                        : q.status === 'done'  ? 'text-emerald-400'
                        : q.status === 'failed' ? 'text-rose-400' : 'text-slate-500'}`}>
                        {q.status === 'queued' ? 'Waiting' : q.status === 'running' ? 'Working…' : q.status === 'done' ? 'Done' : 'Failed'}
                      </span>
                    </div>
                  ))}
                </div>
                {queue.some(q => q.status === 'failed') && (
                  <p className="text-[10px] text-rose-300 mt-1.5">{queue.find(q => q.status === 'failed')?.note}</p>
                )}
              </div>
            )}

            {/* Save what's selected into the Intel DB — base data only. */}
            {selected.size > 0 && (
              <div className="px-3 py-2 border-b border-white/[0.07]" style={{ background: 'rgba(95,184,224,0.08)' }}>
                <button onClick={() => saveToDb(selectedItems)} disabled={saveBusy}
                  className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-lg text-white disabled:opacity-50"
                  style={{ background: '#5FB8E0' }}>
                  {saveBusy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  {saveBusy ? 'Saving…' : `Save ${selected.size} to database`}
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {visible.map((it, i) => {
                const s = it.buy_score ?? 5
                const isSel = selected.has(it.id)
                return (
                  <div key={it.id}
                    className={`relative flex items-start gap-2.5 rounded-xl border p-2.5 transition-all cursor-pointer ${isSel ? 'border-[#5FB8E0] bg-[#5FB8E0]/10' : 'border-white/10 bg-[#1E2A3A]/70 hover:border-[#5FB8E0]/50'}`}
                    onClick={() => openDetail(it)}>
                    {/* Number — matches the pin on the map */}
                    <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-extrabold shadow" style={{ background: scoreColor(s) }}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      {/* Hero shot from the community's own website */}
                      {it.photo_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.photo_url} alt={it.name} loading="lazy"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                          className="w-full h-24 object-cover rounded-lg mb-2 border border-white/10" />
                      )}
                      <h3 className="text-[12.5px] font-bold text-slate-100 truncate leading-tight">{it.name}</h3>
                      <p className="text-[10.5px] text-slate-400 truncate mt-0.5">{it.address || [it.city, it.state].filter(Boolean).join(', ') || '—'}</p>
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        {typeof it.lead_score === 'number' && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded text-white" title="Lead score (0–100): buy intent + size + pro-tech fit"
                            style={{ background: it.lead_score >= 70 ? '#059669' : it.lead_score >= 40 ? '#D97706' : '#475569' }}>LEAD {it.lead_score}</span>
                        )}
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${it.units ? 'bg-[#1A2532] text-slate-300 border-white/10' : 'bg-white/[0.03] text-slate-600 border-white/10'}`}>
                          {it.units ? `${it.units} units` : 'Units: no data'}
                        </span>
                        {it.researched && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">✓ Saved</span>}
                      </div>
                      {/* The 7 base signals — does it exist, yes or no */}
                      <SystemChips systems={it.systems} />
                      {it.website && (
                        <a href={it.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[10px] text-[#5FB8E0] hover:underline mt-1.5 truncate max-w-full">
                          <Globe size={10} className="shrink-0" />
                          <span className="truncate">{it.website.replace(/^https?:\/\/(www\.)?/, '')}</span>
                        </a>
                      )}

                      {/* The next step, spelled out on the card. Deep Research was
                          buried inside the popup, so when a site came up there was
                          no visible way forward. Step 1 save (free), step 2 dig. */}
                      <div className="flex items-center gap-1.5 mt-2.5">
                        {!it.researched ? (
                          <button onClick={e => { e.stopPropagation(); saveToDb([it]) }} disabled={saveBusy}
                            className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg text-white disabled:opacity-50"
                            style={{ background: '#5FB8E0' }} title="Free. Keeps this property so you never search it again.">
                            <Plus size={11} /> 1. Save
                          </button>
                        ) : (
                          <span className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                            <Check size={11} strokeWidth={3} /> Saved
                          </span>
                        )}
                        <button onClick={e => { e.stopPropagation(); runDeepQueue([it]) }} disabled={queueRunning}
                          className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg text-white disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg,#22303F,#2B3C52 45%,#5FB8E0)' }}
                          title="Digs deep: contacts, internet & TV deals, gate/camera brands, resident complaints.">
                          <Zap size={11} /> 2. Deep research
                        </button>
                      </div>
                    </div>
                    {/* Select */}
                    <button onClick={e => { e.stopPropagation(); toggle(it.id) }} aria-label="Select"
                      className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${isSel ? 'bg-[#5FB8E0] border-white' : 'border-white/70 bg-black/40 hover:bg-black/70'}`}>
                      {isSel && <Check size={13} className="text-white" strokeWidth={3} />}
                    </button>
                  </div>
                )
              })}
              {/* Empty / loading now live HERE, beside the map — never on top of it. */}
              {loading && items.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
                  <Loader2 size={20} className="animate-spin text-[#5FB8E0]" />
                  <p className="text-[11px] font-semibold">Finding properties…</p>
                </div>
              )}
              {!loading && items.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-12 px-4 text-center text-slate-500">
                  <Search size={22} className="opacity-30" />
                  <p className="text-[12px] font-bold text-slate-400">Type a property or an area, hit Find</p>
                  <p className="text-[11px]">Results land here. The map shows where they are.</p>
                </div>
              )}
              {!loading && items.length > 0 && visible.length === 0 && (
                <p className="text-[11px] text-slate-500 text-center py-8">Nothing matches your filters.</p>
              )}
            </div>
          </aside>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/10 shadow-2xl" style={{ background: 'rgba(11,23,40,0.97)', backdropFilter: 'blur(12px)' }}>
            <span className="text-xs font-bold text-slate-200">{selected.size} selected</span>
            {/* Save is the primary action on a base find — keep what you found. */}
            <button onClick={() => saveToDb(selectedItems)} disabled={saveBusy}
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg text-white disabled:opacity-50" style={{ background: '#5FB8E0' }}>
              {saveBusy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {saveBusy ? 'Saving…' : 'Save to database'}
            </button>
            {/* Deep research — explicit, sequential, costs a search per property. */}
            <button onClick={() => runDeepQueue(selectedItems)} disabled={queueRunning}
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#22303F,#2B3C52 45%,#5FB8E0)' }}>
              <Zap size={13} /> {queueRunning ? 'Researching…' : `Deep research ${selected.size}`}
            </button>
            <button onClick={() => addToLeads(selectedItems)} disabled={busy}
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg border border-[#5FB8E0]/40 text-slate-200 hover:bg-[#5FB8E0]/10 disabled:opacity-50">
              <Star size={13} /> {busy ? 'Adding…' : 'Add to Leads'}
            </button>
            <button onClick={() => setSelected(new Set())} className="text-[11px] font-bold text-slate-400 hover:text-slate-200">Clear</button>
          </div>
        )}
      </div>

      {/* Detail — a big popup in the CENTRE of the screen so it's easy to read */}
      {detail && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-8" onClick={() => setDetail(null)}>
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
          <div className="relative w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-[1.75rem]" style={{ ...STEEL_FRAME, background: 'linear-gradient(180deg,#22303f 0%, #16232f 100%)' }} onClick={e => e.stopPropagation()}>
            {/* Close — always reachable, top-right of the whole popup. */}
            <button onClick={() => setDetail(null)} aria-label="Close"
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full flex items-center justify-center text-white transition-colors"
              style={{ background: 'rgba(8,14,22,0.55)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.18)' }}>
              <X size={17} />
            </button>

            {/* Hero band — the community's own photo AND a live satellite map,
                side by side on wide screens so it feels rich and real. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0.5 rounded-t-[1.6rem] overflow-hidden" style={{ background: 'rgba(140,170,200,0.18)' }}>
              {(() => {
                const photo = detail.photo_url || detailReport?.property?.photo_url || staticThumb(detail.lat, detail.lng, 760, 380)
                const sat = staticThumb(detail.lat, detail.lng, 760, 380)
                return (
                  <>
                    <div className="relative h-52 sm:h-60 bg-[#16232f]">
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo} alt={detail.name}
                          onError={e => { const fb = sat; const el = e.currentTarget as HTMLImageElement; if (fb && el.src !== fb) el.src = fb }}
                          className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Building2 size={30} className="text-slate-600" /></div>
                      )}
                    </div>
                    <div className="relative h-52 sm:h-60 bg-[#16232f] hidden md:block">
                      {sat ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={sat} alt={`${detail.name} — satellite view`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-500"><MapPin size={26} /><span className="text-[11px]">Map loading…</span></div>
                      )}
                      <span className="absolute bottom-2.5 left-2.5 text-[10px] font-bold px-2 py-1 rounded-md text-slate-100 inline-flex items-center gap-1"
                        style={{ background: 'rgba(8,14,22,0.6)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.14)' }}>
                        <MapPin size={11} /> Satellite view
                      </span>
                    </div>
                  </>
                )
              })()}
            </div>

            {/* Header banner — big, warm, confident. Same steel as the dashboard. */}
            <div className="px-6 py-5" style={{ background: STEEL_HEADER, borderBottom: '1px solid rgba(140,170,200,0.20)' }}>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: STEEL_ACCENT }}>ARIA Property Brief</div>
              <h2 className="mt-1 text-2xl sm:text-[28px] font-extrabold leading-tight" style={{ color: '#f2f7fc' }}>{detail.name}</h2>
              <p className="text-sm flex items-center gap-1.5 mt-1" style={{ color: '#aebfd2' }}><MapPin size={14} /> {[detail.address, detail.city, detail.state].filter(Boolean).join(', ') || '—'}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {detail.units ? <span className="text-[12px] font-bold px-2.5 py-1 rounded-lg text-slate-100" style={STEEL_TILE}>{detail.units} units</span> : null}
                {detail.management_company && <span className="text-[12px] font-semibold px-2.5 py-1 rounded-lg text-slate-200 inline-flex items-center gap-1.5" style={STEEL_TILE}><Building2 size={13} />{detail.management_company}</span>}
                {triggerFlags(detail).map(f => <span key={f.label} className={`text-[12px] font-bold px-2.5 py-1 rounded-lg border ${toneClass(f.tone)}`}>{f.label}</span>)}
              </div>
            </div>

            {/* What the base find already told us — shown before any deep run. */}
            {detail.systems && (
              <div className="px-6 pt-5">
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-slate-300 mb-2">What we found so far</p>
                <div className="flex flex-wrap items-center gap-2">
                  {SYSTEM_LABELS.map(sl => {
                    const on = !!detail.systems?.[sl.key]
                    return (
                      <span key={sl.key}
                        className={`text-[12px] font-bold px-3 py-1.5 rounded-lg border ${
                          on ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                             : 'bg-white/[0.03] text-slate-500 border-white/10'}`}>
                        {on ? '✓' : '—'} {sl.label}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Clear, friendly actions */}
            <div className="p-6 space-y-3">
              {/* Save the base find first — cheap, instant, and it's what makes
                  this property viewable later without paying for a search. */}
              {!detail.researched && detail.systems && (
                <button onClick={() => saveToDb([detail])} disabled={saveBusy}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-[15px] font-bold disabled:opacity-60 transition-transform hover:brightness-110 active:scale-[0.99]" style={{ background: STEEL_ACCENT }}>
                  {saveBusy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {saveBusy ? 'Saving…' : 'Save to database'}
                </button>
              )}
              {detailBusy && !detailReport && (
                <div className="w-full flex items-center justify-center gap-2 py-3.5 text-slate-300 text-sm"><Loader2 size={16} className="animate-spin" /> Checking your database…</div>
              )}
              {/* Deep research is always an explicit, deliberate choice — never automatic.
                  A base report (community-only, not yet deep-researched) still offers it. */}
              {!detailBusy && (!detailReport || detailReport._base) && (
                <button onClick={() => researchDetail(detail)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-[15px] font-bold transition-transform hover:brightness-110 active:scale-[0.99]" style={{ background: 'linear-gradient(135deg,#22303F,#2B3C52 45%,#5FB8E0)' }}>
                  <Zap size={16} /> Deep research this property <span className="opacity-60 text-[12px]">· runs a full search</span>
                </button>
              )}
              <button onClick={() => addToLeads([detail])} disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-slate-100 text-[15px] font-bold disabled:opacity-60 transition-transform hover:brightness-110 active:scale-[0.99]" style={STEEL_TILE}>
                <Star size={16} /> Add to Leads
              </button>
              {detailReport && !detailReport._base && (
                <button onClick={() => researchDetail(detail)} disabled={detailBusy}
                  className="w-full text-center text-[12px] font-semibold text-slate-400 hover:text-slate-200 py-1 disabled:opacity-60">
                  {detailBusy ? 'Refreshing…' : '↻ Refresh data (runs a new search)'}
                </button>
              )}
              {scoutLeadIds.length > 0 && (
                <button onClick={launchScout} disabled={busy}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-[15px] font-bold disabled:opacity-60 transition-transform hover:brightness-110 active:scale-[0.99]" style={{ background: 'linear-gradient(to right,#10B981,#059669)' }}>
                  <Zap size={16} /> Start SCOUT outreach
                </button>
              )}
              {msg && <p className="text-[13px] text-emerald-300 font-semibold text-center">{msg}</p>}
              {scoutMsg && <p className="text-[13px] text-emerald-300 font-semibold text-center">{scoutMsg}</p>}
            </div>

            {/* Report */}
            {detailReport && !detailReport._error && (() => {
              const rep = detailReport
              const v = (x: unknown) => (x === null || x === undefined || x === '' || (Array.isArray(x) && !x.length)) ? 'No data found' : (Array.isArray(x) ? x.join(', ') : String(x))
              const pt = rep.property?.proptech ?? {}
              const found = [...(pt.gate_operators ?? []), ...(pt.access_control ?? []), ...(pt.intercoms ?? []), ...(pt.cameras ?? []), ...(pt.smart_locks ?? []), ...(pt.resident_apps ?? []), ...(pt.package_solutions ?? [])]
              const inferred: any[] = rep.property?.inferred_proptech ?? [] // eslint-disable-line @typescript-eslint/no-explicit-any
              const contacts: any[] = rep.contacts ?? [] // eslint-disable-line @typescript-eslint/no-explicit-any
              const community: any[] = rep.community ?? [] // eslint-disable-line @typescript-eslint/no-explicit-any
              const plan = rep.scout?.outreach_plan ?? null
              const dm = dmScoreN(rep)
              // G4 — found-vs-assumed accuracy badge next to a fact.
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const fieldConf = ((rep as any).field_confidence ?? {}) as Record<string, { source: string; pct: number }>
              const cfBadge = (key?: string) => {
                if (!key) return null
                const c = fieldConf[key]
                if (!c || c.source === 'none' || !c.pct) return null
                const color = c.source === 'found' ? (c.pct >= 90 ? '#34d399' : '#5FB8E0') : '#fbbf24'
                return <span title={c.source === 'found' ? 'Found in a source' : 'Assumed / inferred'} className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold align-middle" style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}>{c.source === 'found' ? '' : '~'}{c.pct}%</span>
              }
              const Row = ({ k, val, cf }: { k: string; val: string; cf?: string }) => (
                <div className="flex gap-3 py-2.5 border-b border-white/5 last:border-0">
                  <span className="text-[13px] text-slate-400 w-32 shrink-0">{k}</span>
                  <span className={`text-[13px] font-medium ${val === 'No data found' ? 'text-slate-500 italic' : 'text-slate-100'}`}>{val}{cfBadge(cf)}</span>
                </div>
              )
              // Normalize any 0-100 style score (e.g. buy_score from freshness) to 0-10.
              const norm10 = (x: unknown) => { const n = Number(x); if (!isFinite(n)) return 5; return n > 10 ? Math.round((n / 10) * 10) / 10 : n }
              const buy = norm10(rep.buy_score ?? 5)
              // Pro-Tech Fit: low modern saturation + displacement signals = high fit for us.
              const fit = Math.max(0, Math.min(10, 5 + (rep.property?.bulk_agreements?.length ? 2 : 0) + (detail?.gate_signal || /gate|access/i.test(String(rep.ai_intel?.key_finding || '')) ? 2 : 0) - Math.min(found.length, 4)))
              // Premium two-tone gradient speedometer — green→teal (strong),
              // amber→orange (mid), rose→red (weak). White numerals for contrast.
              const SemiGauge = ({ label, val, size = 96 }: { label: string; val: number; size?: number }) => {
                const v = Math.max(0, Math.min(10, val))
                const f = v / 10, AL = Math.PI * 44
                // One fixed ramp painted along the arc (red → orange → amber →
                // light green → rich green). The dash offset reveals it up to the
                // value, so the colour you land on IS the colour for that score.
                const gid = `gg-${label.replace(/\s+/g, '')}`
                const tip = gaugeColorAt(v)
                return (
                  <div className="flex flex-col items-center">
                    <svg width={size} height={size * 0.58} viewBox="0 0 100 58">
                      <defs>
                        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="6" y1="0" x2="94" y2="0">
                          {GAUGE_STOPS.map(s => (
                            <stop key={s.at} offset={`${s.at * 100}%`} stopColor={`rgb(${s.c[0]},${s.c[1]},${s.c[2]})`} />
                          ))}
                        </linearGradient>
                      </defs>
                      <path d="M 6 52 A 44 44 0 0 1 94 52" fill="none" stroke="#22303F" strokeWidth="9" strokeLinecap="round" />
                      <path d="M 6 52 A 44 44 0 0 1 94 52" fill="none" stroke={`url(#${gid})`} strokeWidth="9" strokeLinecap="round"
                        strokeDasharray={AL} strokeDashoffset={AL * (1 - f)}
                        style={{ filter: `drop-shadow(0 0 5px ${tip})`, transition: 'stroke-dashoffset 600ms ease-out' }} />
                      <text x="50" y="46" textAnchor="middle" fontSize="19" fontWeight="800" fill="#f8fafc">{v.toFixed(1)}</text>
                      <text x="50" y="56" textAnchor="middle" fontSize="7" fontWeight="700" fill="#64748b">/10</text>
                    </svg>
                    <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wide -mt-1 text-center leading-tight">{label}</span>
                  </div>
                )
              }
              const verdictLabel = buy >= 8 ? 'HOT LEAD' : buy >= 5 ? 'WARM LEAD' : 'COLD'
              const verdictColor = buy >= 8 ? '#34d399' : buy >= 5 ? '#fbbf24' : '#fb7185'
              const verdictText = (rep.ai_intel?.key_finding && rep.ai_intel.key_finding !== 'No data found')
                ? rep.ai_intel.key_finding
                : `${detail?.name} is a ${detail?.units ? `${detail.units}-unit ` : ''}property${rep.property?.bulk_agreements?.length ? ' with an existing bulk internet deal worth displacing' : ''}${found.length === 0 ? '. Low proptech saturation signals strong upgrade potential' : ''}. ${buy >= 8 ? 'Hot lead — prioritize.' : buy >= 5 ? 'Warm — worth a call.' : 'Cold for now.'}`
              const Card = ({ id, Icon, title, summary }: { id: typeof openCard; Icon: any; title: string; summary: string }) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                <button onClick={() => setOpenCard(openCard === id ? null : id)}
                  className="text-left rounded-2xl p-4 transition-all hover:brightness-110 active:scale-[0.99]"
                  style={{ ...STEEL_TILE, ...(openCard === id ? { borderColor: STEEL_ACCENT, boxShadow: '0 0 24px rgba(95,184,224,0.22)' } : {}) }}>
                  <Icon size={22} className="mb-2" style={{ color: STEEL_ACCENT }} />
                  <p className="text-[14px] font-bold text-slate-100 leading-tight">{title}</p>
                  <p className="text-[12px] text-slate-400 mt-1 leading-snug">{summary}</p>
                  <p className="text-[11px] font-bold mt-2.5" style={{ color: STEEL_ACCENT }}>View detailed report →</p>
                </button>
              )
              return (
                <div className="pb-10">
                  {/* Top speedometers */}
                  <div className="grid grid-cols-3 gap-1 px-5 pt-3 items-end">
                    <SemiGauge label="Buy score" val={buy} size={104} />
                    <SemiGauge label="Opportunity" val={Math.round((buy + fit) / 2)} size={122} />
                    <SemiGauge label="Contactability" val={dm} size={104} />
                  </div>
                  {/* ARIA's opportunity verdict */}
                  <div className="mx-6 mt-3 rounded-2xl px-5 py-4" style={STEEL_TILE}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 text-center">ARIA&apos;s opportunity verdict</p>
                    <p className="text-2xl font-extrabold text-center mt-1" style={{ color: verdictColor }}>{verdictLabel}</p>
                    <p className="text-[14px] text-slate-200 leading-relaxed mt-2.5 text-center">{verdictText}</p>
                  </div>
                  {/* Second gauge row */}
                  <div className="grid grid-cols-2 gap-3 px-6 pt-5">
                    <SemiGauge label="Pro-Tech fit" val={fit} size={112} />
                    <SemiGauge label="Team contactability" val={dm} size={112} />
                  </div>
                  {/* Insight cards */}
                  <div className="mt-2 mb-1 px-6 text-[12px] font-bold uppercase tracking-[0.14em] text-slate-400 pt-5">Dig deeper</div>
                  <div className="grid grid-cols-2 gap-3 px-6">
                    <Card id="network" Icon={Wifi} title="Network overview" summary="Wi-Fi, internet & TV audit." />
                    <Card id="community" Icon={Users} title="Community insights" summary="Resident feedback & reviews." />
                    <Card id="proptech" Icon={Cpu} title="Proptech stack" summary="Hardware & software in place." />
                    <Card id="ai" Icon={Zap} title="Deep AI audit" summary="Analysis & recommendations." />
                  </div>
                  {/* Detailed report — opens as its own POPUP on top, so nothing
                      gets appended to the bottom and nobody has to scroll to find it. */}
                  {openCard && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setOpenCard(null)}>
                      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
                      <div className="relative w-full max-w-2xl max-h-[82vh] flex flex-col rounded-[1.5rem]"
                        style={{ ...STEEL_FRAME, background: 'linear-gradient(180deg,#22303f 0%, #16232f 100%)' }} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 px-5 py-4 shrink-0 rounded-t-[1.5rem]" style={{ background: STEEL_HEADER, borderBottom: '1px solid rgba(140,170,200,0.20)' }}>
                          <h3 className="text-[16px] font-extrabold text-slate-100">
                            {openCard === 'network' ? 'Network overview' : openCard === 'community' ? 'Community insights' : openCard === 'proptech' ? 'Proptech stack' : 'Deep AI audit'}
                          </h3>
                          {openCard === 'community' && communityBusy && <Loader2 size={14} className="animate-spin" style={{ color: STEEL_ACCENT }} />}
                          <button onClick={() => setOpenCard(null)} aria-label="Close"
                            className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10">
                            <X size={17} />
                          </button>
                        </div>
                        <div className="overflow-y-auto p-5">
                      {openCard === 'network' && (() => {
                        // Three honest states, never conflated:
                        //   brand known → name it
                        //   present but unnamed → say so (that IS a finding)
                        //   nothing → "No data found"
                        const pz = rep.presence ?? {}
                        const vp = (arr: unknown, present: boolean) => {
                          if (Array.isArray(arr) && arr.length) return arr.join(', ')
                          if (arr && !Array.isArray(arr)) return String(arr)
                          return present ? 'Present — provider not identified yet' : 'No data found'
                        }
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const bulks = (rep.property?.bulk_agreements ?? []).map((b: any) => b?.provider).filter(Boolean)
                        return (
                          <div className="rounded-xl border border-white/10 bg-[#1E2A3A] p-4">
                            <Row k="Internet (ISP)" val={vp(rep.property?.isp_providers, !!pz.internet)} cf="isp" />
                            <Row k="TV / Video" val={vp(rep.property?.video_providers, !!pz.video)} cf="video" />
                            <Row k="Bulk deal" val={bulks.length ? `Yes — ${bulks.join(', ')}` : (pz.bulk ? 'Yes — provider not identified yet' : 'No data found')} cf="bulk" />
                            <Row k="Contract expiry" val={v(rep.property?.roe_expiry_year)} />
                            <Row k="Phone" val={v(rep.property?.phone)} cf="phone" />
                            <Row k="Units" val={v(rep.property?.units)} cf="units" />
                          </div>
                        )
                      })()}
                      {openCard === 'community' && (() => {
                        // Negative resident posts from the last 8 months, newest first,
                        // each linked to its source. Undated posts are kept (we can't
                        // date-exclude them); positives fall to a collapsed remainder.
                        const EIGHT_MO = 1000 * 60 * 60 * 24 * 30 * 8
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const isNeg = (c: any) => {
                          const sev = String(c?.severity || '').toLowerCase()
                          const sig = String(c?.signal_type || '').toLowerCase()
                          return sev === 'high' || sev === 'medium' || /complaint/.test(sig)
                        }
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const within8mo = (c: any) => {
                          const d = c?.date
                          if (!d || d === 'unknown') return true
                          const t = Date.parse(d)
                          return isNaN(t) ? true : t >= Date.now() - EIGHT_MO
                        }
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const ts = (c: any) => { const t = Date.parse(c?.date ?? ''); return isNaN(t) ? 0 : t }
                        const negRecent = (community as any[]).filter(c => isNeg(c) && within8mo(c)).sort((a, b) => ts(b) - ts(a)) // eslint-disable-line @typescript-eslint/no-explicit-any
                        const others = (community as any[]).filter(c => !negRecent.includes(c)) // eslint-disable-line @typescript-eslint/no-explicit-any
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const Card = (c: any, i: number) => (
                          <div key={i} className="rounded-xl border border-white/10 bg-[#1E2A3A] p-3">
                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                              <span className="text-[9px] font-bold text-slate-400">{c.platform || 'Review'}</span>
                              {c.date && c.date !== 'unknown' && <span className="text-[9px] text-slate-500">{c.date}</span>}
                              {c.signal_type && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-200 border border-amber-400/30">{String(c.signal_type).replace(/_/g, ' ')}</span>}
                              {c.severity === 'high' && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-400/30">high</span>}
                            </div>
                            <p className="text-[11px] text-slate-200 italic leading-relaxed">&ldquo;{c.quote}&rdquo;</p>
                            {c.url && (
                              <a href={c.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-[#9FD8EC] hover:underline">
                                View source ↗
                              </a>
                            )}
                          </div>
                        )
                        return (
                          <div className="space-y-2">
                            {community.length === 0 && (
                              communityErr ? (
                                <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-[11px] text-rose-200">{communityErr}</div>
                              ) : (
                                <div className="rounded-xl border border-white/10 bg-[#1E2A3A] p-4 text-[11px] text-slate-500 italic">
                                  {communityBusy ? 'Looking for resident posts…' : 'No resident posts found yet'}
                                </div>
                              )
                            )}
                            {negRecent.length > 0 && (
                              <>
                                <p className="px-0.5 text-[10px] font-bold uppercase tracking-widest text-rose-300/80">Negative reviews · last 8 months ({negRecent.length})</p>
                                {negRecent.map(Card)}
                              </>
                            )}
                            {others.length > 0 && (
                              <>
                                <p className="px-0.5 pt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Other posts ({others.length})</p>
                                {others.slice(0, 12).map(Card)}
                              </>
                            )}
                          </div>
                        )
                      })()}
                      {openCard === 'proptech' && (
                        <div className="rounded-xl border border-white/10 bg-[#1E2A3A] p-4">
                          {/* By CATEGORY — never a merged blob of brand names. Knowing
                              a gate operator is LiftMaster vs the intercom being
                              ButterflyMX is the entire point; a flat list destroys it. */}
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Systems on site</p>
                          <div className="space-y-0">
                            {PROPTECH_CATEGORIES.map(cat => {
                              const brands: string[] = (pt?.[cat.key] ?? []).filter(Boolean)
                              const present = !!(rep.presence ?? {})[cat.presenceKey as keyof BaseSystems]
                              return (
                                <div key={cat.key} className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
                                  <span className="text-[10.5px] font-bold text-slate-400 w-28 shrink-0 uppercase tracking-wide">{cat.label}</span>
                                  <span className={`text-[11.5px] flex-1 ${
                                    brands.length ? 'text-slate-100 font-medium'
                                    : present ? 'text-emerald-300' : 'text-slate-600 italic'}`}>
                                    {brands.length
                                      ? brands.join(', ')
                                      : present ? 'Present — brand not identified' : 'No data found'}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                          {/* Confirmed present by the base find, brand still unknown —
                              that's a finding in its own right, not an empty cell. */}
                          {(() => {
                            const pz = rep.presence ?? {}
                            const on = SYSTEM_LABELS.filter(sl => pz[sl.key])
                            if (!on.length) return null
                            return (
                              <div className="mt-3 pt-3 border-t border-white/5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Confirmed on site (brand TBD)</p>
                                <div className="flex flex-wrap gap-1">
                                  {on.map(sl => (
                                    <span key={sl.key} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">{sl.label}</span>
                                  ))}
                                </div>
                              </div>
                            )
                          })()}
                          {inferred.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Likely (AI-deduced)</p>
                              {inferred.map((x, i) => (
                                <div key={i} className="flex items-center gap-2 text-[11px]">
                                  <span className="text-slate-200 font-medium">{x.name}</span>
                                  <span className="text-[9px] text-slate-500">{x.category}</span>
                                  <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#5FB8E0]/10 text-[#9FD8EC] border border-[#5FB8E0]/25">~{x.confidence_pct}%</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {openCard === 'ai' && (
                        <div className="space-y-2.5">
                          <div className="rounded-xl border border-white/10 bg-[#1E2A3A] p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Contacts</p>
                            {contacts.length === 0 && <p className="text-[11px] text-slate-500 italic">No contacts found yet</p>}
                            {contacts.slice(0, 6).map((c, i) => (
                              <div key={i} className="py-2 border-b border-white/5 last:border-0">
                                <p className="text-[12px] font-semibold text-slate-100">{c.name || 'Unknown'} <span className="text-slate-500 font-normal text-[11px]">· {c.title || c.role_type || '—'}</span>{c.role_type === 'owner' && <span className="ml-1.5 rounded px-1 py-0.5 text-[8px] font-bold" style={{ background: 'rgba(251,191,36,0.16)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)' }}>OWNER</span>}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{[c.email, c.phone].filter(x => x && x !== 'No data found').join('  ·  ') || 'No email / phone found'}</p>
                                {c.address && c.address !== 'No data found' && <p className="text-[10px] text-slate-500 mt-0.5">📍 {c.address}</p>}
                              </div>
                            ))}
                          </div>
                          <div className="rounded-xl border border-white/10 bg-[#1E2A3A] p-4">
                            <Row k="Pitch hook" val={v(rep.ai_intel?.pitch_hook)} />
                            <Row k="Buying trends" val={v(rep.ai_intel?.buying_trends)} />
                            {plan && typeof plan === 'object' && (
                              <div className="pt-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">6-month outreach</p>
                                {Object.keys(plan).slice(0, 6).map((mk, i) => (
                                  <div key={mk} className="py-1.5 border-b border-white/5 last:border-0">
                                    <p className="text-[11px] font-semibold text-slate-200">Month {i + 1}: {plan[mk]?.theme || '—'}</p>
                                    {plan[mk]?.goal && <p className="text-[10px] text-slate-400">{plan[mk].goal}</p>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
            {detailReport?._error && <div className="px-5 pb-8 text-rose-300 text-xs">Could not pull the report — try again.</div>}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
