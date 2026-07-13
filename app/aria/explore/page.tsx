'use client'

/**
 * ARIA Explore — rebuilt, Zillow/apartments.com-style property finder.
 * Phase 1: dark-glass split — Mapbox pins + scrolling property cards.
 * Search an area or property → see it on the map and in the list → click to
 * select (card ↔ pin). "Research this property" (full report) is Phase 2.
 *
 * The current /aria page is untouched; this is the new experience in progress.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, MapPin, Building2, Wifi, Loader2, Check, Zap } from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowLeft } = require('lucide-react') as any

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

interface PropItem {
  id: string
  name: string
  address: string
  city: string
  state: string
  units?: number
  year_built?: number
  management_company?: string
  isp_signal?: string
  bulk_detected?: boolean
  pain_brief?: string
  buy_score?: number
  researched?: boolean
  lat?: number
  lng?: number
}

function scoreColor(s: number): string {
  if (s >= 8) return '#ef4444'
  if (s >= 6) return '#f59e0b'
  if (s >= 4) return '#6B7EFF'
  return '#64748b'
}

// Geocode via Mapbox (matches the existing /map pattern).
async function geocode(item: PropItem): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_TOKEN) return null
  const q = [item.address, item.city, item.state].filter(Boolean).join(', ') || `${item.name} ${item.city} ${item.state}`
  try {
    const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&limit=1&country=us`)
    const d = await r.json()
    const c = d?.features?.[0]?.center
    return Array.isArray(c) ? { lng: c[0], lat: c[1] } : null
  } catch { return null }
}

export default function AriaExplorePage() {
  const [query, setQuery]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [items, setItems]       = useState<PropItem[]>([])
  const [selectedId, setSel]    = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [interp, setInterp]     = useState('')

  const mapRef     = useRef<any>(null)          // eslint-disable-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Record<string, any>>({}) // eslint-disable-line @typescript-eslint/no-explicit-any
  const mapReady   = useRef(false)

  // ── Load Mapbox GL from CDN once ──────────────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== 'undefined' && (window as any).mapboxgl) { mapReady.current = true; return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js'
    script.onload = () => { mapReady.current = true }
    document.body.appendChild(script)
  }, [])

  // ── Init the map when we first have results ───────────────────────────────
  const initMap = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapboxgl = (window as any).mapboxgl
    if (!mapboxgl || !MAPBOX_TOKEN || mapRef.current) return
    mapboxgl.accessToken = MAPBOX_TOKEN
    mapRef.current = new mapboxgl.Map({
      container: 'aria-explore-map',
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-96.8, 32.8],
      zoom: 9,
    })
  }, [])

  // ── Render markers whenever items change ──────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapboxgl = (window as any).mapboxgl
    if (!mapboxgl || !mapRef.current) return
    const map = mapRef.current
    // Clear old markers
    Object.values(markersRef.current).forEach((m: any) => m.remove()) // eslint-disable-line @typescript-eslint/no-explicit-any
    markersRef.current = {}
    const withCoords = items.filter(i => i.lat != null && i.lng != null)
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
      el.onclick = () => setSel(it.id)
      const marker = new mapboxgl.Marker(el).setLngLat([it.lng, it.lat]).addTo(map)
      markersRef.current[it.id] = marker
      bounds?.extend([it.lng, it.lat])
    }
    if (bounds && withCoords.length) {
      try { map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 600 }) } catch { /* noop */ }
    }
  }, [items])

  // ── Fly to the selected pin ───────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId || !mapRef.current) return
    const it = items.find(i => i.id === selectedId)
    if (it?.lat != null && it?.lng != null) {
      mapRef.current.flyTo({ center: [it.lng, it.lat], zoom: 13, duration: 700 })
    }
  }, [selectedId, items])

  const runSearch = useCallback(async () => {
    if (!query.trim() || loading) return
    setLoading(true); setError(null); setItems([]); setSel(null); setInterp('')
    try {
      // Pull the researched set once so we can badge known properties.
      const knownNames = new Set<string>()
      try {
        const kr = await fetch('/api/aria/properties?limit=200')
        if (kr.ok) {
          const kd = await kr.json()
          for (const p of (kd.properties ?? [])) knownNames.add(String(p.property_name ?? '').toLowerCase())
        }
      } catch { /* non-blocking */ }

      const res = await fetch('/api/aria/research/deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      let list: PropItem[] = []
      if (data.type === 'candidates') {
        setInterp(data.query_interpretation ?? '')
        list = (data.candidates ?? []).map((c: any, i: number) => ({  // eslint-disable-line @typescript-eslint/no-explicit-any
          id: `${c.name ?? 'prop'}-${i}`,
          name: c.name ?? 'Unknown Property',
          address: c.address ?? '', city: c.city ?? '', state: c.state ?? '',
          units: c.units, year_built: c.year_built,
          management_company: c.management_company,
          isp_signal: c.isp_signal, bulk_detected: c.bulk_detected,
          pain_brief: c.pain_brief, buy_score: c.buy_score_estimate,
        }))
      } else if (Array.isArray(data.prospects)) {
        list = data.prospects.map((p: any, i: number) => ({  // eslint-disable-line @typescript-eslint/no-explicit-any
          id: `${p.property?.name ?? 'prop'}-${i}`,
          name: p.property?.name ?? 'Unknown Property',
          address: p.property?.address ?? '', city: p.property?.city ?? '', state: p.property?.state ?? '',
          units: p.property?.units, year_built: p.property?.year_built,
          management_company: p.property?.management_company,
          isp_signal: (p.property?.isp_providers ?? [])[0],
          buy_score: p.profile?.buy_score,
          researched: true,
        }))
      }

      list = list.map(it => ({ ...it, researched: it.researched || knownNames.has(it.name.toLowerCase()) }))
      setItems(list)

      // Ensure the map exists, then geocode for pins.
      initMap()
      const geocoded = await Promise.all(list.map(async it => ({ ...it, ...(await geocode(it)) })))
      setItems(geocoded)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }, [query, loading, initMap])

  return (
    <div className="flex flex-col h-full" style={{ background: '#0B1728', minHeight: '100vh' }}>
      {/* Header */}
      <header className="h-16 shrink-0 flex items-center px-5 gap-4 border-b border-white/[0.07]">
        <a href="/" className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-white/10 text-slate-200 hover:bg-[#131B2E] transition-all">
          <ArrowLeft size={13} /> Back to Dashboard
        </a>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-slate-100 leading-tight">ARIA · Explore</h1>
          <p className="text-[11px] text-slate-400 leading-tight hidden sm:block">Find properties on the map</p>
        </div>
      </header>

      {/* Search bar */}
      <div className="shrink-0 px-5 py-3 border-b border-white/[0.07]">
        <div className="flex items-center gap-2 max-w-2xl">
          <div className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(15,24,48,0.9)', border: '1px solid rgba(107,126,255,0.2)' }}>
            <Search size={15} className="text-slate-400 shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runSearch()}
              placeholder="Try: apartment complexes in Dallas, TX with gate issues"
              className="flex-1 bg-transparent text-sm font-medium text-slate-100 placeholder:text-slate-500 outline-none"
              disabled={loading}
            />
          </div>
          <button
            onClick={runSearch}
            disabled={loading || !query.trim()}
            className="flex items-center gap-1.5 text-sm font-bold px-5 py-2.5 rounded-xl text-white disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg,#0d2150,#1a3a7c 45%,#6B7EFF)' }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {loading ? 'Finding…' : 'Find'}
          </button>
        </div>
        {interp && <p className="text-[11px] text-slate-400 mt-2 max-w-2xl">{interp}</p>}
        {error && <p className="text-[11px] text-rose-300 mt-2">{error}</p>}
      </div>

      {/* Split: list + map */}
      <div className="flex-1 flex overflow-hidden">
        {/* List */}
        <div className="w-[380px] shrink-0 overflow-y-auto border-r border-white/[0.07] p-3">
          {items.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 gap-3 px-6">
              <MapPin size={30} className="opacity-25" />
              <p className="text-sm font-bold text-slate-400">Search an area to see properties</p>
              <p className="text-[11px]">They&apos;ll appear here and pinned on the map.</p>
            </div>
          )}
          {loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <Loader2 size={22} className="animate-spin text-[#6B7EFF]" />
              <p className="text-xs font-semibold">Finding properties…</p>
            </div>
          )}
          {items.map(it => {
            const s = it.buy_score ?? 5
            const active = selectedId === it.id
            return (
              <button
                key={it.id}
                onClick={() => setSel(it.id)}
                className={`w-full text-left rounded-xl border p-3.5 mb-2.5 transition-all ${active ? 'border-[#6B7EFF] ring-1 ring-[#6B7EFF]/40 bg-[#131B2E]' : 'border-white/10 bg-[#131B2E]/70 hover:border-[#6B7EFF]/50'}`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ background: scoreColor(s) }}>{s}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-slate-100 truncate flex-1">{it.name}</h3>
                      {it.researched && (
                        <span className="shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-400/10 text-emerald-300 border border-emerald-400/30 flex items-center gap-0.5">
                          <Check size={8} /> Researched
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                      <MapPin size={10} className="opacity-70" /> {[it.city, it.state].filter(Boolean).join(', ')}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {it.units && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#0F1830] text-slate-300 border border-white/10">{it.units} units</span>}
                      {it.management_company && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#0F1830] text-slate-400 border border-white/10 truncate max-w-[130px] inline-flex items-center gap-1"><Building2 size={9} />{it.management_company}</span>}
                      {it.bulk_detected && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-400/10 text-emerald-300 border border-emerald-400/30 inline-flex items-center gap-0.5"><Wifi size={9} />BULK</span>}
                    </div>
                    {it.pain_brief && (
                      <p className="text-[10px] text-amber-100/90 italic mt-2 line-clamp-2">&ldquo;{it.pain_brief}&rdquo;</p>
                    )}
                    <div className="mt-2.5">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#6B7EFF]">
                        <Zap size={10} /> {it.researched ? 'View report' : 'Research this property'} →
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          {!MAPBOX_TOKEN && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm px-8 text-center">
              Map needs NEXT_PUBLIC_MAPBOX_TOKEN configured.
            </div>
          )}
          <div id="aria-explore-map" className="absolute inset-0" />
        </div>
      </div>
    </div>
  )
}
