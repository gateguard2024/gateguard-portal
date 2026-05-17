'use client';

import { useState, useEffect } from "react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Building2, Camera, Shield, Calendar, Settings,
  CheckCircle2, AlertTriangle, XCircle, Map, Loader2,
} from "lucide-react";
import Link from "next/link";

type HealthStatus = "healthy" | "attention" | "at-risk";
type FilterType = "ALL" | "HEALTHY" | "NEEDS ATTENTION" | "AT RISK";

interface Property {
  id: string;
  name: string;
  city: string;
  state: string;
  health: HealthStatus;
  cameras: number;
  doors: number;
  lastService: string;
  top: string;
  left: string;
}

// Deterministic position assignment for map pins based on city/state
function getPinPosition(city: string, state: string, index: number): { top: string; left: string } {
  // Spread pins across the mock map area with some variance by index
  const basePositions: Record<string, { top: number; left: number }> = {
    "Atlanta,GA":    { top: 35, left: 44 },
    "Augusta,GA":    { top: 38, left: 65 },
    "Savannah,GA":   { top: 55, left: 72 },
    "Canton,GA":     { top: 22, left: 42 },
    "Gainesville,GA":{ top: 25, left: 50 },
    "Decatur,GA":    { top: 37, left: 47 },
    "Griffin,GA":    { top: 48, left: 43 },
    "Norcross,GA":   { top: 28, left: 48 },
    "Alpharetta,GA": { top: 27, left: 44 },
    "Macon,GA":      { top: 52, left: 50 },
    "Columbus,GA":   { top: 54, left: 36 },
    "Columbia,SC":   { top: 30, left: 75 },
    "Charlotte,NC":  { top: 20, left: 68 },
  }
  const key = `${city},${state}`
  const base = basePositions[key] ?? { top: 35 + (index * 7) % 40, left: 35 + (index * 11) % 40 }
  // Slight jitter per index so same-city properties don't overlap exactly
  return {
    top:  `${Math.min(85, Math.max(15, base.top  + (index % 3) * 2 - 2))}%`,
    left: `${Math.min(90, Math.max(10, base.left + (index % 3) * 2 - 1))}%`,
  }
}

const healthColors: Record<HealthStatus, { dot: string; ring: string; text: string; bg: string }> = {
  healthy:   { dot: "bg-emerald-400", ring: "ring-emerald-400/40", text: "text-emerald-400", bg: "bg-emerald-400/10" },
  attention: { dot: "bg-amber-400",   ring: "ring-amber-400/40",   text: "text-amber-400",   bg: "bg-amber-400/10"   },
  "at-risk": { dot: "bg-red-400",     ring: "ring-red-400/40",     text: "text-red-400",     bg: "bg-red-400/10"     },
};

const filterToHealth: Record<FilterType, HealthStatus | null> = {
  "ALL": null,
  "HEALTHY": "healthy",
  "NEEDS ATTENTION": "attention",
  "AT RISK": "at-risk",
};

export default function MapPage() {
  const [activeFilter, setActiveFilter] = useState<FilterType>("ALL");
  const [activePin, setActivePin] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const filters: FilterType[] = ["ALL", "HEALTHY", "NEEDS ATTENTION", "AT RISK"];

  useEffect(() => {
    fetch('/api/map')
      .then(r => r.json())
      .then(data => {
        const mapped: Property[] = (data.sites ?? []).map((s: any, idx: number) => {
          const pos = getPinPosition(s.city, s.state, idx)
          return {
            id:          s.id,
            name:        s.name,
            city:        s.city,
            state:       s.state,
            health:      s.health as HealthStatus,
            cameras:     0,
            doors:       0,
            lastService: '—',
            top:         pos.top,
            left:        pos.left,
          }
        })
        setProperties(mapped)
      })
      .catch(err => console.error('[map] fetch error:', err))
      .finally(() => setLoading(false))
  }, [])

  const filtered = activeFilter === "ALL"
    ? properties
    : properties.filter((p) => p.health === filterToHealth[activeFilter]);

  const activeProperty = activePin ? properties.find((p) => p.name === activePin) : null;

  const healthCounts = {
    total:     properties.length,
    healthy:   properties.filter(p => p.health === 'healthy').length,
    attention: properties.filter(p => p.health === 'attention').length,
    atRisk:    properties.filter(p => p.health === 'at-risk').length,
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <TopBar title="Territory Map" subtitle="Property locations, health status, and coverage by territory" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-brand-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Territory Map"
        subtitle="Property locations, health status, and coverage by territory"
      />
      <div className="flex-1 p-6 flex flex-col gap-5 min-h-0">

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Properties", value: String(healthCounts.total),     icon: Building2,    color: "text-brand-400",   bg: "bg-brand-400/10"   },
            { label: "Healthy",          value: String(healthCounts.healthy),   icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400/10" },
            { label: "Needs Attention",  value: String(healthCounts.attention), icon: AlertTriangle,color: "text-amber-400",   bg: "bg-amber-400/10"   },
            { label: "At Risk",          value: String(healthCounts.atRisk),    icon: XCircle,      color: "text-red-400",     bg: "bg-red-400/10"     },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${s.bg}`}><Icon size={16} className={s.color} /></div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Map + Sidebar Layout */}
        <div className="flex gap-4 flex-1 min-h-0" style={{ height: "calc(100vh - 320px)", minHeight: "500px" }}>

          {/* Left Sidebar */}
          <div className="w-80 shrink-0 flex flex-col bg-card border border-border rounded-xl overflow-hidden">
            {/* Filter chips */}
            <div className="p-3 border-b border-border flex flex-wrap gap-1.5">
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-all border ${
                    activeFilter === f
                      ? "bg-brand-400/10 text-brand-400 border-brand-400/30"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Count */}
            <div className="px-4 py-2 border-b border-border">
              <p className="text-[11px] text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "property" : "properties"}
              </p>
            </div>

            {/* Property list */}
            <div className="flex-1 overflow-y-auto">
              {filtered.map((p) => {
                const hc = healthColors[p.health];
                const isActive = activePin === p.name;
                return (
                  <button
                    key={p.name}
                    onClick={() => setActivePin(isActive ? null : p.name)}
                    className={`w-full text-left px-4 py-3 border-b border-border/50 transition-colors hover:bg-accent/20 ${
                      isActive ? "bg-brand-400/5 border-l-2 border-l-brand-400" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${hc.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{p.city}, {p.state}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Camera size={9} /> {p.cameras}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Shield size={9} /> {p.doors}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Calendar size={9} /> {p.lastService}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Map Area */}
          <div className="flex-1 relative rounded-xl overflow-hidden border border-border" style={{ background: "#1e293b" }}>

            {/* Mapbox banner */}
            <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2 bg-slate-900/90 backdrop-blur-sm border-b border-dashed border-slate-600">
              <div className="flex items-center gap-2">
                <Map size={13} className="text-brand-400" />
                <span className="text-[11px] text-slate-300">
                  Territory map requires Mapbox API key — configure in{" "}
                  <Link href="/settings" className="text-brand-400 hover:text-brand-300 underline underline-offset-2">
                    Settings → Integrations
                  </Link>
                </span>
              </div>
              <span className="text-[10px] text-slate-500">Preview mode</span>
            </div>

            {/* Grid road lines */}
            <div className="absolute inset-0" style={{ paddingTop: "36px" }}>
              {/* Horizontal roads */}
              {[20, 33, 45, 57, 70, 82].map((pct) => (
                <div
                  key={`h${pct}`}
                  className="absolute left-0 right-0"
                  style={{
                    top: `${pct}%`,
                    height: "1px",
                    background: "rgba(255,255,255,0.06)",
                  }}
                />
              ))}
              {/* Vertical roads */}
              {[15, 28, 40, 52, 63, 75, 87].map((pct) => (
                <div
                  key={`v${pct}`}
                  className="absolute top-0 bottom-0"
                  style={{
                    left: `${pct}%`,
                    width: "1px",
                    background: "rgba(255,255,255,0.06)",
                  }}
                />
              ))}
              {/* Major roads — slightly brighter */}
              {[38, 60].map((pct) => (
                <div
                  key={`mh${pct}`}
                  className="absolute left-0 right-0"
                  style={{ top: `${pct}%`, height: "1px", background: "rgba(255,255,255,0.12)" }}
                />
              ))}
              {[44, 68].map((pct) => (
                <div
                  key={`mv${pct}`}
                  className="absolute top-0 bottom-0"
                  style={{ left: `${pct}%`, width: "1px", background: "rgba(255,255,255,0.12)" }}
                />
              ))}

              {/* State label */}
              <div className="absolute" style={{ top: "50%", left: "48%", transform: "translate(-50%,-50%)" }}>
                <p className="text-slate-700 text-4xl font-bold tracking-widest select-none">GEORGIA</p>
              </div>
              <div className="absolute" style={{ top: "32%", left: "78%", transform: "translate(-50%,-50%)" }}>
                <p className="text-slate-700 text-xl font-bold tracking-widest select-none">SC</p>
              </div>

              {/* Property pins */}
              {properties.map((p) => {
                const hc = healthColors[p.health];
                const isActive = activePin === p.name;
                const isFiltered = activeFilter === "ALL" || p.health === filterToHealth[activeFilter];
                return (
                  <button
                    key={p.name}
                    onClick={() => setActivePin(isActive ? null : p.name)}
                    className={`absolute transition-all duration-150 group ${!isFiltered ? "opacity-20" : "opacity-100"}`}
                    style={{ top: p.top, left: p.left, transform: "translate(-50%, -50%)" }}
                    title={p.name}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full ${hc.dot} ring-2 ${hc.ring} ring-offset-1 ring-offset-slate-900 ${isActive ? "scale-150" : "hover:scale-125"} transition-transform`} />
                    <div className={`absolute left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-900/90 text-slate-200 border border-slate-700 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity pointer-events-none`}
                      style={{ top: "100%" }}>
                      {p.name}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Tooltip / popup for active property */}
            {activeProperty && (
              <div className="absolute z-30 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 w-56"
                style={{ bottom: "24px", right: "24px" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white">{activeProperty.name}</span>
                  <button onClick={() => setActivePin(null)} className="text-slate-500 hover:text-slate-300 text-lg leading-none">&times;</button>
                </div>
                <p className="text-[11px] text-slate-400 mb-3">{activeProperty.city}, {activeProperty.state}</p>
                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${healthColors[activeProperty.health].bg} ${healthColors[activeProperty.health].text} mb-3`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${healthColors[activeProperty.health].dot}`} />
                  {activeProperty.health === "healthy" ? "Healthy" : activeProperty.health === "attention" ? "Needs Attention" : "At Risk"}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-800 rounded-lg p-2">
                    <p className="text-xs font-bold text-white">{activeProperty.cameras}</p>
                    <p className="text-[10px] text-slate-500">Cameras</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-2">
                    <p className="text-xs font-bold text-white">{activeProperty.doors}</p>
                    <p className="text-[10px] text-slate-500">Doors</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <Calendar size={10} className="text-slate-500" />
                  <p className="text-[10px] text-slate-400">Last service: {activeProperty.lastService}</p>
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-4 left-4 z-20 bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-xl px-4 py-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">Legend</p>
              {[
                { label: "Healthy",        color: "bg-emerald-400" },
                { label: "Needs Attention",color: "bg-amber-400" },
                { label: "At Risk",        color: "bg-red-400" },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-2 mb-1 last:mb-0">
                  <span className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
                  <span className="text-[11px] text-slate-300">{l.label}</span>
                </div>
              ))}
            </div>

            {/* Settings hint */}
            <div className="absolute top-10 right-4 z-20">
              <Link href="/settings"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-lg text-[11px] text-slate-300 transition-colors">
                <Settings size={11} /> Configure Mapbox
              </Link>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
