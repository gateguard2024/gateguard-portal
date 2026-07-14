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
import { Search, MapPin, Building2, Wifi, Loader2, Check, Zap, X, Plus, Clock, Users, Star, Settings } from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowLeft, LayoutGrid, Map: MapIcon, Cpu } = require('lucide-react') as any
import { SearchHistoryPanel } from '@/components/aria/SearchHistoryPanel'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

type Category = 'properties' | 'listings' | 'contacts'
type ViewMode = 'list' | 'map'

interface PropItem {
  id: string
  name: string
  address: string
  city: string
  state: string
  units?: number
  management_company?: string
  isp_signal?: string
  bulk_detected?: boolean
  gate_signal?: boolean
  pain_brief?: string
  buy_score?: number
  researched?: boolean
  contract_expiry_year?: number
  lat?: number
  lng?: number
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
  if (s >= 4) return '#6B7EFF'
  return '#64748b'
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
  : 'bg-[#6B7EFF]/10 text-[#9AA8FF] border-[#6B7EFF]/25'

// Normalize either a live prospect OR a saved aria_properties row (facts/deductions)
// into one report shape the tabbed panel renders. This is what makes a Saved
// property show the full rich report instantly, no re-search.
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
        phone: f.property?.phone ?? raw.property_phone ?? raw.dm_phone,
        units: f.property?.units ?? raw.units, year_built: f.property?.year_built ?? raw.year_built,
        occupancy: f.property?.occupancy ?? raw.occupancy, management_company: f.property?.management_company ?? raw.management_company,
        owner_entity: f.property?.owner_entity ?? raw.owner_entity,
        isp_providers: f.connectivity?.isp_providers ?? raw.isp_providers ?? [],
        video_providers: f.connectivity?.video_providers ?? raw.video_providers ?? [],
        bulk_agreements: f.connectivity?.bulk_agreements ?? raw.bulk_agreements ?? [],
        roe_expiry_year: f.connectivity?.roe_expiry_year ?? raw.roe_expiry_year ?? raw.contract_expiry_year,
        proptech: pt,
        inferred_proptech: d.proptech_inferred ?? [],
      },
      contacts: f.decision_makers ?? raw.dm_chain ?? [],
      community: f.community_posts ?? raw.social_posts ?? [],
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
      phone: p.property?.phone, units: p.property?.units, year_built: p.property?.year_built,
      occupancy: p.property?.occupancy, management_company: p.property?.management_company,
      owner_entity: p.ownership?.owner_entity ?? p.property?.owner_entity,
      isp_providers: p.property?.isp_providers ?? [], video_providers: p.property?.video_providers ?? [],
      bulk_agreements: p.property?.bulk_agreements ?? [], roe_expiry_year: p.property?.roe_expiry_year,
      proptech: p.property?.proptech ?? {}, inferred_proptech: p.property?.inferred_proptech ?? [],
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

async function geocode(it: PropItem): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_TOKEN) return null
  const q = [it.address, it.city, it.state].filter(Boolean).join(', ') || `${it.name} ${it.city} ${it.state}`
  try {
    const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&limit=1&country=us`)
    const d = await r.json()
    const c = d?.features?.[0]?.center
    return Array.isArray(c) ? { lng: c[0], lat: c[1] } : null
  } catch { return null }
}

// Zillow-style aerial thumbnail of the property from its coordinates (free with
// the Mapbox token — a real satellite image, no photo storage needed).
function staticThumb(lat?: number, lng?: number, w = 240, h = 150): string | null {
  if (lat == null || lng == null || !MAPBOX_TOKEN) return null
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lng},${lat},16.5,0/${w}x${h}@2x?access_token=${MAPBOX_TOKEN}&attribution=false&logo=false`
}

export default function AriaExplorePage() {
  const [category, setCategory] = useState<Category>('properties')
  const [query, setQuery]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [items, setItems]       = useState<PropItem[]>([])
  const [view, setView]         = useState<ViewMode>('list')
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

  // Load Mapbox GL once
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== 'undefined' && (window as any).mapboxgl) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css'
    document.head.appendChild(link)
    const s = document.createElement('script')
    s.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js'
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
    mapboxgl.accessToken = MAPBOX_TOKEN
    mapRef.current = new mapboxgl.Map({
      container: 'aria-explore-map',
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-96.8, 32.8], zoom: 9,
    })
  }, [])

  // (Re)draw markers when items change or the map view is shown
  useEffect(() => {
    if (view !== 'map') return
    initMap()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapboxgl = (window as any).mapboxgl
    if (!mapboxgl || !mapRef.current) return
    const map = mapRef.current
    setTimeout(() => map.resize(), 60)
    Object.values(markersRef.current).forEach((m: any) => m.remove()) // eslint-disable-line @typescript-eslint/no-explicit-any
    markersRef.current = {}
    const withCoords = items.filter(i => i.lat != null && i.lng != null
      && (!fMinUnits || (i.units ?? 0) >= fMinUnits) && (!fGate || i.gate_signal) && (!fBulk || i.bulk_detected) && (!fNew || !i.researched)
      && (!fExpBefore || (i.contract_expiry_year != null && i.contract_expiry_year <= fExpBefore))
      && (source !== 'saved' || !query.trim() || i.name.toLowerCase().includes(query.trim().toLowerCase())))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bounds = withCoords.length ? new mapboxgl.LngLatBounds() : null
    for (const it of withCoords) {
      const el = document.createElement('div')
      const s = it.buy_score ?? 5
      el.style.cssText = `width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${scoreColor(s)};border:2px solid #0B1728;box-shadow:0 2px 6px rgba(0,0,0,.4);cursor:pointer;display:flex;align-items:center;justify-content:center`
      const inner = document.createElement('span')
      inner.textContent = String(s)
      inner.style.cssText = 'transform:rotate(45deg);color:#fff;font-size:10px;font-weight:700'
      el.appendChild(inner)
      el.onclick = () => openDetail(it)
      // Hover tooltip (dark) — property name, location, units, top flag.
      const flag = triggerFlags(it)[0]?.label
      const popup = new mapboxgl.Popup({ offset: 22, closeButton: false, closeOnClick: false })
        .setHTML(`<div style="font-family:Inter,sans-serif;background:#0B1728;color:#f1f5f9;border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:8px 10px;min-width:150px"><div style="font-weight:700;font-size:12px">${it.name}</div><div style="font-size:10px;color:#94a3b8;margin-top:2px">${[it.city, it.state].filter(Boolean).join(', ')}${it.units ? ` · ${it.units} units` : ''}</div>${flag ? `<div style="font-size:9px;font-weight:700;color:#fca5a5;margin-top:4px">${flag}</div>` : ''}</div>`)
      el.addEventListener('mouseenter', () => popup.setLngLat([it.lng!, it.lat!]).addTo(map))
      el.addEventListener('mouseleave', () => popup.remove())
      const marker = new mapboxgl.Marker(el).setLngLat([it.lng!, it.lat!]).addTo(map)
      markersRef.current[it.id] = marker
      bounds?.extend([it.lng!, it.lat!])
    }
    if (bounds && withCoords.length) { try { map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 500 }) } catch { /* noop */ } }
  }, [items, view, initMap, fMinUnits, fGate, fBulk, fNew, fExpBefore, source, query])

  const runSearch = useCallback(async (qArg?: string) => {
    const q = (qArg ?? query).trim()
    if (!q || loading) return
    if (qArg && qArg !== query) setQuery(qArg)
    setLoading(true); setError(null); setItems([]); setSelected(new Set()); setInterp(''); setMsg(null); setDetail(null)
    try {
      const knownNames = new Set<string>()
      try {
        const kr = await fetch('/api/aria/properties?limit=200')
        if (kr.ok) { const kd = await kr.json(); for (const p of (kd.properties ?? [])) knownNames.add(String(p.property_name ?? '').toLowerCase()) }
      } catch { /* non-blocking */ }

      const res = await fetch('/api/aria/research/deep', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      let list: PropItem[] = []
      if (data.type === 'candidates') {
        setInterp(data.query_interpretation ?? '')
        list = (data.candidates ?? []).map((c: any, i: number) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
          id: `${c.name ?? 'prop'}-${i}`, name: c.name ?? 'Unknown Property',
          address: c.address ?? '', city: c.city ?? '', state: c.state ?? '',
          units: c.units, management_company: c.management_company,
          isp_signal: c.isp_signal, bulk_detected: c.bulk_detected, gate_signal: c.gate_signal,
          pain_brief: c.pain_brief, buy_score: c.buy_score_estimate,
        }))
      } else if (Array.isArray(data.prospects)) {
        list = data.prospects.map((p: any, i: number) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
          id: `${p.property?.name ?? 'prop'}-${i}`, name: p.property?.name ?? 'Unknown Property',
          address: p.property?.address ?? '', city: p.property?.city ?? '', state: p.property?.state ?? '',
          units: p.property?.units, management_company: p.property?.management_company,
          isp_signal: (p.property?.isp_providers ?? [])[0], buy_score: p.profile?.buy_score, researched: true,
        }))
      }
      list = list.map(it => ({ ...it, researched: it.researched || knownNames.has(it.name.toLowerCase()) }))
      setItems(list)
      const geo = await Promise.all(list.map(async it => ({ ...it, ...(await geocode(it)) })))
      setItems(geo)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally { setLoading(false) }
  }, [query, loading])

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
      const list: PropItem[] = rows.map(row => ({
        id: row.id,
        name: row.property_name ?? 'Unknown Property',
        address: row.facts?.property?.address ?? row.address ?? '',
        city: row.facts?.property?.city ?? '', state: row.facts?.property?.state ?? '',
        units: row.units ?? row.facts?.property?.units,
        management_company: row.management_company,
        isp_signal: (row.isp_providers ?? [])[0],
        bulk_detected: (row.bulk_agreements?.length ?? 0) > 0 || !!row.roe_detected,
        gate_signal: (row.gate_operators?.length ?? 0) > 0,
        buy_score: row.buy_score,
        researched: true,
        contract_expiry_year: row.contract_expiry_year ?? undefined,
        lat: row.facts?.property?.lat ?? undefined,
        lng: row.facts?.property?.lng ?? undefined,
      }))
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
    (!fExpBefore || (it.contract_expiry_year != null && it.contract_expiry_year <= fExpBefore)) &&
    (source !== 'saved' || !query.trim() || it.name.toLowerCase().includes(query.trim().toLowerCase()))
  const visible = items.filter(matchesFilters)
  const alreadyCount = items.filter(i => i.researched).length

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
      setDetailReport(d?.prospects?.[0] ? normalizeReport(d.prospects[0]) : null)
      setItems(prev => prev.map(x => x.id === it.id ? { ...x, researched: true } : x))
      // GUARANTEE all data (facts + inferred) is saved to Supabase — post the full
      // prospect to the canonical upsert (builds facts + deductions incl. inferred).
      if (d?.prospects?.length) {
        void fetch('/api/aria/properties', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prospects: d.prospects }),
        }).catch(() => {})
      }
    } catch { setDetailReport({ _error: true }) }
    finally { setDetailBusy(false) }
  }, [])

  // Open a property: for Saved rows (real id) load the canonical record instantly
  // (no re-search); for discover cards, just open — Research fills it in.
  const openDetail = useCallback(async (it: PropItem) => {
    setDetail(it); setDetailReport(null); setOpenCard(null); setScoutMsg(null)
    setDetailBusy(true)
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(it.id)
      // Saved rows carry the real id → load by id (fastest path).
      if (isUuid) {
        const r = await fetch(`/api/aria/properties/${it.id}`)
        if (r.ok) { const row = await r.json(); setDetailReport(normalizeReport(row)); return }
      }
      // ALWAYS check the database by name — if we've researched this property
      // before, show the stored record. A paid search only happens when it's
      // genuinely not found in Supabase.
      const r = await fetch(`/api/aria/properties?search=${encodeURIComponent(it.name)}&limit=8`)
      if (r.ok) {
        const d = await r.json()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: any[] = d.properties ?? []
        const nm = it.name.toLowerCase()
        const row = rows.find(p => (p.property_name ?? '').toLowerCase() === nm)
          ?? rows.find(p => (p.property_name ?? '').toLowerCase().includes(nm) || nm.includes((p.property_name ?? '').toLowerCase()))
        if (row) setDetailReport(normalizeReport(row))
      }
    } catch { /* ignore */ } finally { setDetailBusy(false) }
  }, [])

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
    <div className="flex h-full" style={{ background: '#0B1728', minHeight: '100vh' }}>
      {/* Left icon nav */}
      <aside className="w-14 shrink-0 flex flex-col items-center py-3 border-r border-white/[0.07]" style={{ background: '#0A1220' }}>
        {NAV.map((n, i) => n.href ? (
          <a key={i} href={n.href} title={n.label}
            className={`w-full flex flex-col items-center gap-0.5 py-2.5 transition-colors ${n.active ? 'text-[#6B7EFF]' : 'text-slate-500 hover:text-slate-200'}`}>
            <n.Icon size={18} /><span className="text-[8px] font-bold">{n.label}</span>
          </a>
        ) : (
          <button key={i} onClick={n.onClick} title={n.label}
            className={`w-full flex flex-col items-center gap-0.5 py-2.5 transition-colors ${n.active ? 'text-[#6B7EFF]' : 'text-slate-500 hover:text-slate-200'}`}>
            <n.Icon size={18} /><span className="text-[8px] font-bold">{n.label}</span>
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => setPanel('settings')} title="Settings"
          className={`w-full flex flex-col items-center gap-0.5 py-2.5 transition-colors ${panel === 'settings' ? 'text-[#6B7EFF]' : 'text-slate-500 hover:text-slate-200'}`}>
          <Settings size={18} /><span className="text-[8px] font-bold">Settings</span>
        </button>
      </aside>

      {/* Main column */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
      {/* Header */}
      <header className="h-16 shrink-0 flex items-center px-5 gap-4 border-b border-white/[0.07]">
        <a href="/" className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-white/10 text-slate-200 hover:bg-[#131B2E] transition-all">
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
          <div className="relative w-full max-w-md h-full overflow-y-auto shadow-2xl" style={{ background: '#0B1728', borderRight: '1px solid rgba(255,255,255,0.08)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10 sticky top-0 z-10" style={{ background: '#0B1728' }}>
              {panel === 'leads' ? <Star size={15} className="text-[#6B7EFF]" /> : panel === 'contacts' ? <Users size={15} className="text-[#6B7EFF]" /> : panel === 'history' ? <Clock size={15} className="text-[#6B7EFF]" /> : <Settings size={15} className="text-[#6B7EFF]" />}
              <span className="text-base font-bold text-slate-100">{panel === 'leads' ? 'Leads from ARIA' : panel === 'contacts' ? 'Contacts found' : panel === 'history' ? 'Search history' : 'Search settings'}</span>
              {(panel === 'leads' || panel === 'contacts') && <span className="text-[11px] font-semibold text-slate-500">{panelItems.length}</span>}
              <button onClick={() => setPanel(null)} className="ml-auto text-slate-500 hover:text-slate-200"><X size={17} /></button>
            </div>

            {panelLoading && <div className="flex items-center gap-2 px-5 py-6 text-slate-400 text-xs"><Loader2 size={14} className="animate-spin" /> Loading…</div>}

            {/* HISTORY */}
            {panel === 'history' && (
              <div className="p-4 h-[calc(100%-4.5rem)]">
                <SearchHistoryPanel onPick={(qq) => { setPanel(null); setSource('discover'); runSearch(qq) }} />
              </div>
            )}

            {/* LEADS */}
            {panel === 'leads' && !panelLoading && (
              <div className="p-4 space-y-2">
                {panelItems.length === 0 && <p className="text-[12px] text-slate-500 px-1 py-6 text-center">No ARIA leads yet. Add properties to Leads from a search.</p>}
                {panelItems.map((l, i) => (
                  <button key={i} onClick={() => { setPanel(null); openDetail({ id: l.property_name || l.id, name: l.property_name || l.contact_name || 'Property', address: l.location ?? '', city: l.city ?? '', state: l.state ?? '' }) }}
                    className="w-full text-left rounded-xl border border-white/10 bg-[#131B2E]/70 hover:border-[#6B7EFF]/50 p-3 transition-all">
                    <p className="text-[13px] font-bold text-slate-100 truncate">{l.property_name || l.contact_name || 'Untitled'}</p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{[l.city, l.state].filter(Boolean).join(', ') || '—'}{l.unit_count ? ` · ${l.unit_count} units` : ''}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {l.stage && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#6B7EFF]/10 text-[#9AA8FF] border border-[#6B7EFF]/25 capitalize">{l.stage}</span>}
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
                    className="w-full text-left rounded-xl border border-white/10 bg-[#131B2E]/70 hover:border-[#6B7EFF]/50 p-3 transition-all">
                    <p className="text-[13px] font-bold text-slate-100 truncate">{c.name} <span className="text-slate-500 font-normal text-[11px]">· {c.title || c.role_type || '—'}</span></p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{[c.email, c.phone].filter((x: string) => x && x !== 'No data found').join('  ·  ') || 'No email / phone'}</p>
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
                        className={`text-[11px] font-bold px-3 py-1.5 rounded-full border ${category === c.key ? 'bg-[#6B7EFF] text-white border-[#6B7EFF]' : 'text-slate-300 border-white/10'}`}>{c.label}</button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#131B2E] p-3.5">
                  <div>
                    <p className="text-[13px] font-bold text-slate-100">Skip already-found</p>
                    <p className="text-[11px] text-slate-400">Hide properties already in your database from results.</p>
                  </div>
                  <button onClick={() => { const nv = !fNew; setFNew(nv); try { localStorage.setItem('aria_skip_found', String(nv)) } catch { /* */ } }}
                    className={`w-11 h-6 rounded-full transition-colors relative ${fNew ? 'bg-[#6B7EFF]' : 'bg-white/15'}`}>
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
              className={`text-[11px] font-bold px-3 py-1.5 ${source === 'discover' ? 'bg-[#6B7EFF] text-white' : 'text-slate-300 hover:bg-[#131B2E]'}`}>Discover</button>
            <button onClick={() => { setSource('saved'); loadSaved() }}
              className={`text-[11px] font-bold px-3 py-1.5 ${source === 'saved' ? 'bg-[#6B7EFF] text-white' : 'text-slate-300 hover:bg-[#131B2E]'}`}>Saved</button>
          </div>
          {source === 'discover' && CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCategory(c.key)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all ${category === c.key ? 'bg-[#6B7EFF] text-white border-[#6B7EFF]' : 'text-slate-300 border-white/10 hover:border-[#6B7EFF]/50'}`}>
              {c.label}
            </button>
          ))}
          {source === 'saved' && <span className="text-[11px] text-slate-500 font-medium">Everything you&apos;ve already researched — instant, no spend.</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2.5 max-w-2xl" style={{ background: 'rgba(15,24,48,0.9)', border: '1px solid rgba(107,126,255,0.2)' }}>
            <Search size={15} className="text-slate-400 shrink-0" />
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && onFind()}
              placeholder={source === 'saved' ? 'Filter saved properties by name…' : CATEGORIES.find(c => c.key === category)?.hint}
              className="flex-1 bg-transparent text-sm font-medium text-slate-100 placeholder:text-slate-500 outline-none" disabled={loading} />
          </div>
          <button onClick={onFind} disabled={loading || (source === 'discover' && !query.trim())}
            className="flex items-center gap-1.5 text-sm font-bold px-5 py-2.5 rounded-xl text-white disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg,#0d2150,#1a3a7c 45%,#6B7EFF)' }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}{loading ? 'Loading…' : source === 'saved' ? 'Reload' : 'Find'}
          </button>
          {/* List / Map toggle */}
          {items.length > 0 && (
            <div className="flex items-center rounded-lg border border-white/10 overflow-hidden ml-1">
              <button onClick={() => setView('list')} className={`flex items-center gap-1 text-[11px] font-bold px-3 py-2 ${view === 'list' ? 'bg-[#6B7EFF] text-white' : 'text-slate-300 hover:bg-[#131B2E]'}`}><LayoutGrid size={12} /> List</button>
              <button onClick={() => setView('map')} className={`flex items-center gap-1 text-[11px] font-bold px-3 py-2 ${view === 'map' ? 'bg-[#6B7EFF] text-white' : 'text-slate-300 hover:bg-[#131B2E]'}`}><MapIcon size={12} /> Map</button>
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
              className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all ${val ? 'bg-[#6B7EFF] text-white border-[#6B7EFF]' : 'text-slate-300 border-white/10 hover:border-[#6B7EFF]/50'}`}>
              {label}
            </button>
          ))}
          <select value={fMinUnits} onChange={e => setFMinUnits(Number(e.target.value))}
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-full bg-[#0F1830] text-slate-300 border border-white/10 outline-none">
            <option value={0}>Any units</option>
            <option value={100}>100+ units</option>
            <option value={200}>200+ units</option>
            <option value={300}>300+ units</option>
          </select>
          {source === 'saved' && (
            <select value={fExpBefore} onChange={e => setFExpBefore(Number(e.target.value))}
              className="text-[11px] font-bold px-2.5 py-1.5 rounded-full bg-[#0F1830] text-slate-300 border border-white/10 outline-none">
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
      <div className="flex-1 overflow-hidden relative">
        {items.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 gap-3 px-6">
            <MapPin size={30} className="opacity-25" />
            <p className="text-sm font-bold text-slate-400">Pick a word, type an area, hit Find</p>
            <p className="text-[11px]">Properties show up here as a list or on the map.</p>
          </div>
        )}
        {loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
            <Loader2 size={22} className="animate-spin text-[#6B7EFF]" /><p className="text-xs font-semibold">Finding properties…</p>
          </div>
        )}

        {/* LIST VIEW */}
        {items.length > 0 && view === 'list' && (
          <div className="h-full overflow-y-auto p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-w-5xl mx-auto pb-20">
              {visible.map(it => {
                const s = it.buy_score ?? 5
                const isSel = selected.has(it.id)
                const thumb = staticThumb(it.lat, it.lng, 320, 150)
                return (
                  <div key={it.id} className={`relative rounded-xl border overflow-hidden transition-all bg-[#131B2E]/70 ${isSel ? 'border-[#6B7EFF] ring-1 ring-[#6B7EFF]/40' : 'border-white/10 hover:border-[#6B7EFF]/50'}`}>
                    {/* Aerial thumbnail */}
                    <button onClick={() => openDetail(it)} className="block w-full relative h-28 bg-[#0F1830]">
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
                      className={`absolute top-2 left-2 z-10 w-5 h-5 rounded-md border flex items-center justify-center ${isSel ? 'bg-[#6B7EFF] border-[#6B7EFF]' : 'border-white/40 bg-black/40 backdrop-blur-sm'}`}>
                      {isSel && <Check size={12} className="text-white" />}
                    </button>
                    {/* Content */}
                    <button onClick={() => openDetail(it)} className="block w-full text-left p-3">
                      <h3 className="text-sm font-bold text-slate-100 truncate">{it.name}</h3>
                      <p className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5"><MapPin size={10} className="opacity-70" /> {[it.city, it.state].filter(Boolean).join(', ') || '—'}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {it.units ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#0F1830] text-slate-300 border border-white/10">{it.units} units</span> : null}
                        {triggerFlags(it).map(f => <span key={f.label} className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${toneClass(f.tone)}`}>{f.label}</span>)}
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* MAP VIEW */}
        <div className={`absolute inset-0 ${items.length > 0 && view === 'map' ? '' : 'hidden'}`}>
          {!MAPBOX_TOKEN && <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">Map needs NEXT_PUBLIC_MAPBOX_TOKEN.</div>}
          <div id="aria-explore-map" className="absolute inset-0" />
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/10 shadow-2xl" style={{ background: 'rgba(11,23,40,0.97)', backdropFilter: 'blur(12px)' }}>
            <span className="text-xs font-bold text-slate-200">{selected.size} selected</span>
            <button onClick={() => addToLeads(selectedItems)} disabled={busy}
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg text-white disabled:opacity-50" style={{ background: '#6B7EFF' }}>
              <Plus size={13} /> {busy ? 'Adding…' : 'Add to Leads'}
            </button>
            <button onClick={() => { const first = selectedItems[0]; if (first) { setDetail(first); setDetailReport(null); researchDetail(first) } }} disabled={busy}
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg border border-[#6B7EFF]/40 text-slate-200 hover:bg-[#6B7EFF]/10">
              <Zap size={13} /> Research
            </button>
            <button onClick={() => setSelected(new Set())} className="text-[11px] font-bold text-slate-400 hover:text-slate-200">Clear</button>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {detail && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setDetail(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-md h-full overflow-y-auto shadow-2xl" style={{ background: '#0B1728', borderLeft: '1px solid rgba(255,255,255,0.08)' }} onClick={e => e.stopPropagation()}>
            {/* Hero aerial photo */}
            {staticThumb(detail.lat, detail.lng) && (
              <div className="relative h-36 w-full bg-[#0F1830]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={staticThumb(detail.lat, detail.lng, 520, 220)!} alt={detail.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(11,23,40,0.1) 30%,rgba(11,23,40,0.95) 100%)' }} />
                <button onClick={() => setDetail(null)} className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70"><X size={15} /></button>
              </div>
            )}
            <div className="flex items-start gap-3 p-5 border-b border-white/10">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-slate-100">{detail.name}</h2>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><MapPin size={11} /> {[detail.address, detail.city, detail.state].filter(Boolean).join(', ') || '—'}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {detail.units ? <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#131B2E] text-slate-300 border border-white/10">{detail.units} units</span> : null}
                  {detail.management_company && <span className="text-[10px] px-2 py-0.5 rounded bg-[#131B2E] text-slate-400 border border-white/10 inline-flex items-center gap-1"><Building2 size={10} />{detail.management_company}</span>}
                  {triggerFlags(detail).map(f => <span key={f.label} className={`text-[10px] font-bold px-2 py-0.5 rounded border ${toneClass(f.tone)}`}>{f.label}</span>)}
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="text-slate-500 hover:text-slate-200"><X size={18} /></button>
            </div>

            {/* Three clear actions */}
            <div className="p-5 space-y-2.5">
              {/* Research (paid) ONLY for brand-new properties. Researched ones
                  load their stored report on open — no new search, no spend. */}
              {detailBusy && !detailReport && (
                <div className="w-full flex items-center justify-center gap-2 py-3 text-slate-400 text-xs"><Loader2 size={14} className="animate-spin" /> Checking your database…</div>
              )}
              {!detailBusy && !detailReport && (
                <button onClick={() => researchDetail(detail)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-bold" style={{ background: 'linear-gradient(135deg,#0d2150,#1a3a7c 45%,#6B7EFF)' }}>
                  <Zap size={14} /> Research this property <span className="opacity-60 text-[11px]">· not in database yet</span>
                </button>
              )}
              <button onClick={() => addToLeads([detail])} disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 text-slate-200 text-sm font-bold hover:bg-[#131B2E] disabled:opacity-60">
                <Plus size={14} /> Add to Leads
              </button>
              {detailReport && (
                <button onClick={() => researchDetail(detail)} disabled={detailBusy}
                  className="w-full text-center text-[11px] font-semibold text-slate-500 hover:text-slate-300 py-1 disabled:opacity-60">
                  {detailBusy ? 'Refreshing…' : '↻ Refresh data (runs a new search)'}
                </button>
              )}
              {scoutLeadIds.length > 0 && (
                <button onClick={launchScout} disabled={busy}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-60" style={{ background: 'linear-gradient(to right,#10B981,#059669)' }}>
                  <Zap size={14} /> Start SCOUT outreach
                </button>
              )}
              {msg && <p className="text-[11px] text-emerald-300 font-semibold text-center">{msg}</p>}
              {scoutMsg && <p className="text-[11px] text-emerald-300 font-semibold text-center">{scoutMsg}</p>}
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
              const Row = ({ k, val }: { k: string; val: string }) => (
                <div className="flex gap-2 py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-[11px] text-slate-500 w-28 shrink-0">{k}</span>
                  <span className={`text-[11px] font-medium ${val === 'No data found' ? 'text-slate-500 italic' : 'text-slate-200'}`}>{val}</span>
                </div>
              )
              const buy = Number(rep.buy_score ?? 5)
              // Pro-Tech Fit: low modern saturation + displacement signals = high fit for us.
              const fit = Math.max(0, Math.min(10, 5 + (rep.property?.bulk_agreements?.length ? 2 : 0) + (detail?.gate_signal || /gate|access/i.test(String(rep.ai_intel?.key_finding || '')) ? 2 : 0) - Math.min(found.length, 4)))
              const gcol = (n: number) => n >= 8 ? '#22c55e' : n >= 5 ? '#f59e0b' : '#ef4444'
              // Half-circle speedometer gauge (matches the mockup).
              const SemiGauge = ({ label, val, size = 96 }: { label: string; val: number; size?: number }) => {
                const f = Math.max(0, Math.min(10, val)) / 10, AL = Math.PI * 44
                return (
                  <div className="flex flex-col items-center">
                    <svg width={size} height={size * 0.58} viewBox="0 0 100 58">
                      <path d="M 6 52 A 44 44 0 0 1 94 52" fill="none" stroke="#1e293b" strokeWidth="9" strokeLinecap="round" />
                      <path d="M 6 52 A 44 44 0 0 1 94 52" fill="none" stroke={gcol(val)} strokeWidth="9" strokeLinecap="round" strokeDasharray={AL} strokeDashoffset={AL * (1 - f)} />
                      <text x="50" y="47" textAnchor="middle" fontSize="18" fontWeight="800" fill={gcol(val)}>{val.toFixed(1)}</text>
                      <text x="50" y="56" textAnchor="middle" fontSize="7" fontWeight="700" fill="#64748b">/10</text>
                    </svg>
                    <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wide -mt-1 text-center leading-tight">{label}</span>
                  </div>
                )
              }
              const verdictLabel = buy >= 8 ? 'HOT LEAD' : buy >= 5 ? 'WARM LEAD' : 'COLD'
              const verdictColor = buy >= 8 ? '#22c55e' : buy >= 5 ? '#f59e0b' : '#ef4444'
              const verdictText = (rep.ai_intel?.key_finding && rep.ai_intel.key_finding !== 'No data found')
                ? rep.ai_intel.key_finding
                : `${detail?.name} is a ${detail?.units ? `${detail.units}-unit ` : ''}property${rep.property?.bulk_agreements?.length ? ' with an existing bulk internet deal worth displacing' : ''}${found.length === 0 ? '. Low proptech saturation signals strong upgrade potential' : ''}. ${buy >= 8 ? 'Hot lead — prioritize.' : buy >= 5 ? 'Warm — worth a call.' : 'Cold for now.'}`
              const Card = ({ id, Icon, title, summary }: { id: typeof openCard; Icon: any; title: string; summary: string }) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                <button onClick={() => setOpenCard(openCard === id ? null : id)}
                  className={`text-left rounded-xl border p-3.5 transition-all ${openCard === id ? 'border-[#6B7EFF] bg-[#131B2E] shadow-[0_0_20px_rgba(107,126,255,0.15)]' : 'border-white/10 bg-[#131B2E]/70 hover:border-[#6B7EFF]/50'}`}>
                  <Icon size={20} className="text-[#6B7EFF] mb-2" />
                  <p className="text-[12px] font-bold text-slate-100 leading-tight uppercase tracking-wide">{title}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{summary}</p>
                  <p className="text-[9px] font-bold text-[#6B7EFF] mt-2 uppercase tracking-wide">{openCard === id ? 'Hide report' : 'Click for detailed report'}</p>
                </button>
              )
              return (
                <div className="pb-10">
                  {/* Top speedometers */}
                  <div className="grid grid-cols-3 gap-1 px-4 pt-2 items-end">
                    <SemiGauge label="Buy score" val={buy} size={92} />
                    <SemiGauge label="Opportunity" val={Math.round((buy + fit) / 2)} size={108} />
                    <SemiGauge label="Contactability" val={dm} size={92} />
                  </div>
                  {/* ARIA's opportunity verdict */}
                  <div className="px-5 pt-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">ARIA&apos;s opportunity verdict</p>
                    <p className="text-xl font-extrabold text-center mt-0.5" style={{ color: verdictColor }}>{verdictLabel}</p>
                    <p className="text-[12px] text-slate-300 leading-relaxed mt-2">{verdictText}</p>
                  </div>
                  {/* Second gauge row */}
                  <div className="grid grid-cols-2 gap-2 px-5 pt-4 border-t border-white/10 mt-4">
                    <SemiGauge label="Pro-Tech fit" val={fit} size={100} />
                    <SemiGauge label="Team contactability" val={dm} size={100} />
                  </div>
                  {/* Insight cards */}
                  <div className="grid grid-cols-2 gap-2.5 px-5 pt-4">
                    <Card id="network" Icon={Wifi} title="Network overview" summary="Comprehensive Wi-Fi & TV audit." />
                    <Card id="community" Icon={Users} title="Community insights" summary="Resident feedback & engagement." />
                    <Card id="proptech" Icon={Cpu} title="Proptech ops" summary="Hardware & software stack." />
                    <Card id="ai" Icon={Zap} title="Deep AI audit" summary="Analysis & recommendations." />
                  </div>
                  {/* Expanded card */}
                  {openCard && (
                    <div className="px-5 pt-4">
                      {openCard === 'network' && (
                        <div className="rounded-xl border border-white/10 bg-[#131B2E] p-4">
                          <Row k="Internet (ISP)" val={v(rep.property?.isp_providers)} />
                          <Row k="TV / Video" val={v(rep.property?.video_providers)} />
                          <Row k="Bulk deal" val={rep.property?.bulk_agreements?.length ? `Yes — ${rep.property.bulk_agreements.map((b: any) => b.provider).filter(Boolean).join(', ')}` : 'No data found'} /> {/* eslint-disable-line @typescript-eslint/no-explicit-any */}
                          <Row k="Contract expiry" val={v(rep.property?.roe_expiry_year)} />
                          <Row k="Phone" val={v(rep.property?.phone)} />
                          <Row k="Units" val={v(rep.property?.units)} />
                        </div>
                      )}
                      {openCard === 'community' && (
                        <div className="space-y-2">
                          {community.length === 0 && <div className="rounded-xl border border-white/10 bg-[#131B2E] p-4 text-[11px] text-slate-500 italic">No resident posts found yet</div>}
                          {community.slice(0, 12).map((c, i) => (
                            <div key={i} className="rounded-xl border border-white/10 bg-[#131B2E] p-3">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[9px] font-bold text-slate-400">{c.platform || 'Review'}</span>
                                {c.signal_type && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-200 border border-amber-400/30">{String(c.signal_type).replace(/_/g, ' ')}</span>}
                              </div>
                              <p className="text-[11px] text-slate-200 italic leading-relaxed">&ldquo;{c.quote}&rdquo;</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {openCard === 'proptech' && (
                        <div className="rounded-xl border border-white/10 bg-[#131B2E] p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Found on site</p>
                          <p className={`text-[11px] ${found.length ? 'text-slate-200' : 'text-slate-500 italic'}`}>{found.length ? found.join(', ') : 'No data found'}</p>
                          {inferred.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Likely (AI-deduced)</p>
                              {inferred.map((x, i) => (
                                <div key={i} className="flex items-center gap-2 text-[11px]">
                                  <span className="text-slate-200 font-medium">{x.name}</span>
                                  <span className="text-[9px] text-slate-500">{x.category}</span>
                                  <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#6B7EFF]/10 text-[#9AA8FF] border border-[#6B7EFF]/25">~{x.confidence_pct}%</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {openCard === 'ai' && (
                        <div className="space-y-2.5">
                          <div className="rounded-xl border border-white/10 bg-[#131B2E] p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Contacts</p>
                            {contacts.length === 0 && <p className="text-[11px] text-slate-500 italic">No contacts found yet</p>}
                            {contacts.slice(0, 6).map((c, i) => (
                              <div key={i} className="py-2 border-b border-white/5 last:border-0">
                                <p className="text-[12px] font-semibold text-slate-100">{c.name || 'Unknown'} <span className="text-slate-500 font-normal text-[11px]">· {c.title || c.role_type || '—'}</span></p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{[c.email, c.phone].filter(x => x && x !== 'No data found').join('  ·  ') || 'No email / phone found'}</p>
                              </div>
                            ))}
                          </div>
                          <div className="rounded-xl border border-white/10 bg-[#131B2E] p-4">
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
