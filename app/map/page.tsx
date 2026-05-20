'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Building2, Camera, Shield, Calendar,
  CheckCircle2, AlertTriangle, XCircle,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { MapPin: MapPinIcon } = require("lucide-react") as any;
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type HealthStatus = "healthy" | "attention" | "at-risk";
type FilterType   = "ALL" | "HEALTHY" | "NEEDS ATTENTION" | "AT RISK";

interface SiteEntry {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  units: number | null;
  open_wo_count: number;
  offline_asset_count: number;
  asset_count: number;
  health: HealthStatus;
  lat?: number;
  lng?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeHealth(openWOs: number, offlineAssets: number): HealthStatus {
  if (openWOs >= 3 || offlineAssets >= 2) return "at-risk";
  if (openWOs >= 1 || offlineAssets >= 1) return "attention";
  return "healthy";
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const healthColors: Record<HealthStatus, { dot: string; text: string; bg: string; hex: string }> = {
  healthy:   { dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-400/10", hex: "#34d399" },
  attention: { dot: "bg-amber-400",   text: "text-amber-400",   bg: "bg-amber-400/10",   hex: "#fbbf24" },
  "at-risk": { dot: "bg-red-400",     text: "text-red-400",     bg: "bg-red-400/10",     hex: "#f87171" },
};

const filterToHealth: Record<FilterType, HealthStatus | null> = {
  "ALL":             null,
  "HEALTHY":         "healthy",
  "NEEDS ATTENTION": "attention",
  "AT RISK":         "at-risk",
};

// Geocode an address using Mapbox geocoding API
async function geocode(address: string, city: string | null, state: string | null, token: string): Promise<[number, number] | null> {
  const query = [address, city, state].filter(Boolean).join(", ");
  try {
    const res  = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=1&country=us`
    );
    const json = await res.json() as { features?: Array<{ center: [number, number] }> };
    const center = json.features?.[0]?.center;
    return center ?? null;
  } catch {
    return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MapPage() {
  const [sites,        setSites]       = useState<SiteEntry[]>([]);
  const [loading,      setLoading]     = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>("ALL");
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [mapReady,     setMapReady]    = useState(false);
  const [mapError,     setMapError]    = useState<string | null>(null);
  const [geocoding,    setGeocoding]   = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef          = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef      = useRef<Map<string, any>>(new Map());

  const filters: FilterType[] = ["ALL", "HEALTHY", "NEEDS ATTENTION", "AT RISK"];

  // ── Load sites ──────────────────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const res  = await fetch("/api/sites?limit=100");
        const data = await res.json() as { sites?: Array<{
          id: string; name: string; city: string | null; state: string | null;
          address: string | null; units: number | null;
          open_wo_count: number; offline_asset_count: number; asset_count: number;
        }> };
        const raw = data.sites ?? [];
        const enriched: SiteEntry[] = raw.map(s => ({
          id:                  s.id,
          name:                s.name,
          city:                s.city,
          state:               s.state,
          units:               s.units,
          open_wo_count:       s.open_wo_count ?? 0,
          offline_asset_count: s.offline_asset_count ?? 0,
          asset_count:         s.asset_count ?? 0,
          health:              computeHealth(s.open_wo_count ?? 0, s.offline_asset_count ?? 0),
        }));
        setSites(enriched);
        setLoading(false);

        // Geocode if token present
        if (!MAPBOX_TOKEN) return;
        setGeocoding(true);
        const geocoded: SiteEntry[] = await Promise.all(
          enriched.map(async (s) => {
            const coords = await geocode(
              raw.find(r => r.id === s.id)?.address ?? "",
              s.city,
              s.state,
              MAPBOX_TOKEN
            );
            return coords ? { ...s, lat: coords[1], lng: coords[0] } : s;
          })
        );
        setSites(geocoded);
        setGeocoding(false);
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    })();
  }, []);

  // ── Init Mapbox ─────────────────────────────────────────────────────────────
  const initMap = useCallback(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapboxgl = (window as any).mapboxgl;
    if (!mapboxgl) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style:     "mapbox://styles/mapbox/light-v11",
      center:    [-83.5, 32.5], // Georgia center
      zoom:      6.5,
    });

    map.on("load", () => setMapReady(true));
    map.on("error", () => setMapError("Map failed to load. Check your Mapbox token."));
    mapRef.current = map;
  }, []);

  useEffect(() => {
    if (!MAPBOX_TOKEN) return;
    if (typeof window !== "undefined" && (window as any).mapboxgl) { // eslint-disable-line @typescript-eslint/no-explicit-any
      initMap();
      return;
    }
    const link = document.createElement("link");
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css";
    link.rel  = "stylesheet";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js";
    script.onload = () => initMap();
    script.onerror = () => setMapError("Failed to load Mapbox GL JS");
    document.head.appendChild(script);
  }, [initMap]);

  // ── Place/update markers whenever sites or mapReady changes ─────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapboxgl = (window as any).mapboxgl;
    if (!mapboxgl) return;

    const map = mapRef.current;

    // Remove old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current.clear();

    // Add markers for sites with coordinates
    sites.forEach(site => {
      if (site.lat == null || site.lng == null) return;
      const hc = healthColors[site.health];

      const el = document.createElement("div");
      el.style.cssText = `
        width:16px; height:16px; border-radius:50%;
        background:${hc.hex}; border:2px solid white;
        box-shadow:0 1px 4px rgba(0,0,0,.3);
        cursor:pointer; transition:transform 0.15s;
      `;
      el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.4)"; });
      el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });

      const popup = new mapboxgl.Popup({ offset: 20, closeButton: false, maxWidth: "220px" })
        .setHTML(`
          <div style="font-family:Inter,sans-serif;padding:4px 2px">
            <p style="font-weight:600;font-size:13px;margin:0 0 4px">${site.name}</p>
            <p style="color:#888;font-size:11px;margin:0 0 6px">${[site.city, site.state].filter(Boolean).join(", ") || "—"}</p>
            <div style="display:flex;gap:8px;font-size:11px;color:#555;margin-bottom:6px">
              ${site.units ? `<span>${site.units} units</span>` : ""}
              ${site.open_wo_count > 0 ? `<span style="color:#f87171">${site.open_wo_count} open WO${site.open_wo_count > 1 ? "s" : ""}</span>` : ""}
            </div>
            <a href="/sites/${site.id}" style="color:#6B7EFF;font-size:11px;font-weight:600;text-decoration:none">View Site →</a>
          </div>
        `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([site.lng, site.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.set(site.id, marker);
    });
  }, [sites, mapReady]);

  // ── Fly to site when clicking left sidebar ───────────────────────────────────
  function flyToSite(site: SiteEntry) {
    setActiveSiteId(site.id);
    if (!mapRef.current || site.lat == null || site.lng == null) return;
    mapRef.current.flyTo({ center: [site.lng, site.lat], zoom: 13, duration: 1200 });
    const marker = markersRef.current.get(site.id);
    if (marker) marker.togglePopup();
  }

  const filtered = activeFilter === "ALL"
    ? sites
    : sites.filter(s => s.health === filterToHealth[activeFilter]);

  const healthyCt   = sites.filter(s => s.health === "healthy").length;
  const attentionCt = sites.filter(s => s.health === "attention").length;
  const atRiskCt    = sites.filter(s => s.health === "at-risk").length;

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
            { label: "Total Properties", value: loading ? "—" : String(sites.length), icon: Building2,    color: "text-brand-400",   bg: "bg-brand-400/10"   },
            { label: "Healthy",          value: loading ? "—" : String(healthyCt),    icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400/10" },
            { label: "Needs Attention",  value: loading ? "—" : String(attentionCt),  icon: AlertTriangle,color: "text-amber-400",   bg: "bg-amber-400/10"   },
            { label: "At Risk",          value: loading ? "—" : String(atRiskCt),     icon: XCircle,      color: "text-red-400",     bg: "bg-red-400/10"     },
          ].map(s => {
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
              {filters.map(f => (
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
                {loading ? "Loading…" : `${filtered.length} ${filtered.length === 1 ? "property" : "properties"}`}
                {geocoding && " · geocoding…"}
              </p>
            </div>

            {/* Property list */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
                  <MapPinIcon size={24} className="opacity-30" />
                  <p className="text-xs">No properties in this filter</p>
                </div>
              ) : (
                filtered.map(s => {
                  const hc      = healthColors[s.health];
                  const isActive = activeSiteId === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => flyToSite(s)}
                      className={`w-full text-left px-4 py-3 border-b border-border/50 transition-colors hover:bg-accent/20 ${
                        isActive ? "bg-brand-400/5 border-l-2 border-l-brand-400" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${hc.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {[s.city, s.state].filter(Boolean).join(", ") || "—"}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5">
                            {s.units != null && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Building2 size={9} /> {s.units}u
                              </span>
                            )}
                            {s.asset_count > 0 && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Shield size={9} /> {s.asset_count}
                              </span>
                            )}
                            {s.open_wo_count > 0 && (
                              <span className="flex items-center gap-1 text-[10px] text-amber-400">
                                <Calendar size={9} /> {s.open_wo_count} WO
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Map Area */}
          <div className="flex-1 relative rounded-xl overflow-hidden border border-border bg-slate-100">

            {/* No token fallback */}
            {!MAPBOX_TOKEN && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-20 gap-4 text-center px-8">
                <div className="p-4 rounded-full bg-brand-400/10">
                  <MapPinIcon size={32} className="text-brand-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-1">Mapbox token not configured</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Add <code className="bg-muted px-1 rounded text-[11px]">NEXT_PUBLIC_MAPBOX_TOKEN</code> to your environment variables to enable the live map.
                  </p>
                </div>
                <Link
                  href="/settings"
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-400 text-white rounded-lg text-sm font-medium hover:bg-brand-500 transition-colors"
                >
                  Configure in Settings →
                </Link>
              </div>
            )}

            {/* Map error */}
            {mapError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-20 gap-3 text-center px-8">
                <XCircle size={32} className="text-red-400" />
                <p className="text-sm text-red-400 font-medium">{mapError}</p>
              </div>
            )}

            {/* Mapbox container — fills the whole right panel */}
            {MAPBOX_TOKEN && (
              <div ref={mapContainerRef} className="absolute inset-0" />
            )}

            {/* Legend */}
            {MAPBOX_TOKEN && (
              <div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">Legend</p>
                {[
                  { label: "Healthy",         hex: "#34d399" },
                  { label: "Needs Attention", hex: "#fbbf24" },
                  { label: "At Risk",         hex: "#f87171" },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-2 mb-1 last:mb-0">
                    <span className="w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm inline-block" style={{ background: l.hex }} />
                    <span className="text-[11px] text-slate-600">{l.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Geocoding indicator */}
            {geocoding && MAPBOX_TOKEN && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-full px-4 py-1.5 text-[11px] text-slate-500 shadow-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
                Placing pins…
              </div>
            )}

            {/* No-coords notice */}
            {!geocoding && MAPBOX_TOKEN && sites.filter(s => s.lat != null).length === 0 && !loading && (
              <div className="absolute top-3 right-3 z-10 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-[11px] text-amber-700 shadow-sm max-w-[200px]">
                No properties have geocodable addresses yet.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
