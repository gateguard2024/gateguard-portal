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
import { Search, MapPin, Building2, Wifi, Loader2, Check, Zap, X, Plus } from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowLeft, LayoutGrid, Map: MapIcon } = require('lucide-react') as any

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

// DM / contactability score (1–10) from a researched prospect.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dmScore(p: any): number {
  if (!p) return 0
  let s = 0
  const phone = p.property?.phone
  if (phone && phone !== 'No data found' && String(phone).length > 5) s += 3
  const chain: any[] = p.decision_maker_chain ?? [] // eslint-disable-line @typescript-eslint/no-explicit-any
  if (chain.some(c => /manager/i.test(`${c.role_type || ''} ${c.title || ''}`))) s += 2
  if (chain.some(c => /regional|asset|vp|director|owner|principal/i.test(`${c.role_type || ''} ${c.title || ''}`))) s += 2
  if (p.ownership?.owner_entity && p.ownership.owner_entity !== 'Unknown' && p.ownership.owner_entity !== 'No data found') s += 2
  if (p.decision_maker?.name && p.decision_maker.name !== 'No data found') s += 1
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
  // Apollo-grade segmentation on multifamily fields
  const [fMinUnits, setFMinUnits] = useState(0)
  const [fGate, setFGate]         = useState(false)
  const [fBulk, setFBulk]         = useState(false)
  const [fNew, setFNew]           = useState(false) // not-yet-researched only
  const [fExpBefore, setFExpBefore] = useState(0)   // contract expiry before year (0 = any)
  const [source, setSource]       = useState<Source>('discover')
  const [scoutLeadIds, setScoutLeadIds] = useState<string[]>([])
  const [scoutMsg, setScoutMsg]   = useState<string | null>(null)

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
  }, [])

  const initMap = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapboxgl = (window as any).mapboxgl
    if (!mapboxgl || !MAPBOX_TOKEN || mapRef.current) return
    mapboxgl.accessToken = MAPBOX_TOKEN
    mapRef.current = new mapboxgl.Map({
      container: 'aria-explore-map',
      style: 'mapbox://styles/mapbox/dark-v11',
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
      el.onclick = () => setDetail(it)
      const marker = new mapboxgl.Marker(el).setLngLat([it.lng!, it.lat!]).addTo(map)
      markersRef.current[it.id] = marker
      bounds?.extend([it.lng!, it.lat!])
    }
    if (bounds && withCoords.length) { try { map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 500 }) } catch { /* noop */ } }
  }, [items, view, initMap, fMinUnits, fGate, fBulk, fNew, fExpBefore, source, query])

  const runSearch = useCallback(async () => {
    if (!query.trim() || loading) return
    setLoading(true); setError(null); setItems([]); setSelected(new Set()); setInterp(''); setMsg(null); setDetail(null)
    try {
      const knownNames = new Set<string>()
      try {
        const kr = await fetch('/api/aria/properties?limit=200')
        if (kr.ok) { const kd = await kr.json(); for (const p of (kd.properties ?? [])) knownNames.add(String(p.property_name ?? '').toLowerCase()) }
      } catch { /* non-blocking */ }

      const res = await fetch('/api/aria/research/deep', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
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

  const onFind = source === 'saved' ? loadSaved : runSearch

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
      setDetailReport(d?.prospects?.[0] ?? null)
      setItems(prev => prev.map(x => x.id === it.id ? { ...x, researched: true } : x))
    } catch { setDetailReport({ _error: true }) }
    finally { setDetailBusy(false) }
  }, [])

  return (
    <div className="flex flex-col h-full" style={{ background: '#0B1728', minHeight: '100vh' }}>
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
        <a href="/aria/classic" className="text-[11px] font-semibold text-slate-500 hover:text-slate-300 transition-colors">Classic view</a>
      </header>

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
          {([['Has gate', fGate, setFGate], ['Bulk', fBulk, setFBulk], ['New only', fNew, setFNew]] as const).map(([label, val, set]) => (
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
                return (
                  <div key={it.id} className={`relative rounded-xl border p-4 transition-all ${isSel ? 'border-[#6B7EFF] ring-1 ring-[#6B7EFF]/40 bg-[#131B2E]' : 'border-white/10 bg-[#131B2E]/70 hover:border-[#6B7EFF]/50'}`}>
                    <button onClick={() => toggle(it.id)} aria-label="Select"
                      className={`absolute top-3.5 left-3.5 w-5 h-5 rounded-md border flex items-center justify-center ${isSel ? 'bg-[#6B7EFF] border-[#6B7EFF]' : 'border-white/25 bg-[#0F1830]'}`}>
                      {isSel && <Check size={12} className="text-white" />}
                    </button>
                    <div className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ background: scoreColor(s) }}>{s}</div>
                    <button onClick={() => { setDetail(it); setDetailReport(null) }} className="w-full text-left pl-7 pr-10">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-slate-100 truncate">{it.name}</h3>
                        {it.researched && <span className="shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-400/10 text-emerald-300 border border-emerald-400/30">✓</span>}
                      </div>
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
              <button onClick={() => researchDetail(detail)} disabled={detailBusy}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-60" style={{ background: 'linear-gradient(135deg,#0d2150,#1a3a7c 45%,#6B7EFF)' }}>
                {detailBusy ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {detailBusy ? 'Researching…' : detail.researched ? 'View report' : 'Research this property'}
              </button>
              <button onClick={() => addToLeads([detail])} disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 text-slate-200 text-sm font-bold hover:bg-[#131B2E] disabled:opacity-60">
                <Plus size={14} /> Add to Leads
              </button>
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
            {detailBusy && <div className="px-5 pb-8 flex items-center gap-2 text-slate-400 text-xs"><Loader2 size={13} className="animate-spin" /> Pulling the report…</div>}
            {detailReport && !detailReport._error && (() => {
              const p = detailReport
              const v = (x: unknown) => (x === null || x === undefined || x === '' || (Array.isArray(x) && !x.length)) ? 'No data found' : (Array.isArray(x) ? x.join(', ') : String(x))
              const pt = p.property?.proptech ?? {}
              const found = [...(pt.gate_operators ?? []), ...(pt.access_control ?? []), ...(pt.intercoms ?? []), ...(pt.cameras ?? []), ...(pt.smart_locks ?? [])]
              const inferred: any[] = p.property?.inferred_proptech ?? [] // eslint-disable-line @typescript-eslint/no-explicit-any
              const chain: any[] = (p.decision_maker_chain?.length ? p.decision_maker_chain : (p.decision_maker ? [p.decision_maker] : [])) // eslint-disable-line @typescript-eslint/no-explicit-any
              const dm = dmScore(p)
              const Row = ({ k, val }: { k: string; val: string }) => (
                <div className="flex gap-2 py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-[11px] text-slate-500 w-28 shrink-0">{k}</span>
                  <span className={`text-[11px] font-medium ${val === 'No data found' ? 'text-slate-500 italic' : 'text-slate-200'}`}>{val}</span>
                </div>
              )
              const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
                <div className="rounded-xl border border-white/10 bg-[#131B2E] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{title}</p>
                  {children}
                </div>
              )
              return (
                <div className="px-5 pb-10 space-y-3">
                  {/* Scores */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-white" style={{ background: scoreColor(p.profile?.buy_score ?? 5) }}>Buy {p.profile?.buy_score ?? '—'}/10</span>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${dm >= 7 ? 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30' : dm >= 4 ? 'bg-amber-400/10 text-amber-200 border-amber-400/30' : 'bg-slate-500/10 text-slate-400 border-white/10'}`}>Contactability {dm}/10</span>
                  </div>
                  {/* Facts */}
                  <Section title="Property (facts)">
                    <Row k="Phone" val={v(p.property?.phone)} />
                    <Row k="Units" val={v(p.property?.units)} />
                    <Row k="Year built" val={v(p.property?.year_built)} />
                    <Row k="Occupancy" val={v(p.property?.occupancy)} />
                    <Row k="Management" val={v(p.property?.management_company)} />
                    <Row k="Owner" val={v(p.ownership?.owner_entity ?? p.property?.owner_entity)} />
                  </Section>
                  <Section title="Connectivity (facts)">
                    <Row k="ISP" val={v(p.property?.isp_providers)} />
                    <Row k="Video" val={v(p.property?.video_providers)} />
                    <Row k="Bulk deal" val={(p.property?.bulk_agreements?.length ? `Yes — ${p.property.bulk_agreements.map((b: any) => b.provider).filter(Boolean).join(', ')}` : 'No data found')} /> {/* eslint-disable-line @typescript-eslint/no-explicit-any */}
                    <Row k="ROE expiry" val={v(p.property?.roe_expiry_year)} />
                  </Section>
                  <Section title="Proptech">
                    <Row k="Found" val={v(found)} />
                    {inferred.length > 0 && (
                      <div className="pt-2 space-y-1">
                        <p className="text-[10px] text-slate-500 mb-1">Inferred (AI-deduced):</p>
                        {inferred.map((x, i) => (
                          <div key={i} className="flex items-center gap-2 text-[11px]">
                            <span className="text-slate-200 font-medium">{x.name}</span>
                            <span className="text-[9px] text-slate-500">{x.category}</span>
                            <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#6B7EFF]/10 text-[#9AA8FF] border border-[#6B7EFF]/25">~{x.confidence_pct}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Section>
                  <Section title="Decision makers (facts)">
                    {chain.length === 0 && <p className="text-[11px] text-slate-500 italic">No data found</p>}
                    {chain.slice(0, 5).map((c, i) => (
                      <div key={i} className="py-1.5 border-b border-white/5 last:border-0">
                        <p className="text-[11px] font-semibold text-slate-200">{c.name || 'Unknown'} <span className="text-slate-500 font-normal">· {c.title || c.role_type || '—'}</span></p>
                        <p className="text-[10px] text-slate-400">{[c.email, c.phone].filter(x => x && x !== 'No data found').join(' · ') || 'No email/phone found'}</p>
                      </div>
                    ))}
                  </Section>
                  <Section title="AI intel (deductions)">
                    <Row k="Key finding" val={v(p.profile?.primary_concern ?? p.key_finding)} />
                    <Row k="Buying trends" val={v(p.buying_trends)} />
                    <Row k="Pitch hook" val={v(p.pitch_strategy?.primary_hook)} />
                  </Section>
                </div>
              )
            })()}
            {detailReport?._error && <div className="px-5 pb-8 text-rose-300 text-xs">Could not pull the report — try again.</div>}
          </div>
        </div>
      )}
    </div>
  )
}
