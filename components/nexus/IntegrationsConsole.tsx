'use client';

// Corporate Integrations console — every site + its per-vendor connection status
// in one place, so corporate sets up dealer sites at scale. Click a site to open
// its full panel (with the Connections card). Corporate only.
import React, { useEffect, useState } from "react";
import { SiteDetailDrawer } from "@/components/nexus/OperationsHub";

type VStatus = { configured: boolean; status: string | null };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SiteRow = { id: string; name: string; city: string | null; state: string | null; vendors: Record<string, VStatus>; connected: number; total: number };

const VENDOR_LABEL: Record<string, string> = { brivo: "Brivo", eagle_eye: "Eagle Eye", shelly: "Shelly", unifi: "UniFi", edge: "Edge" };

function chipColor(v?: VStatus) {
  if (!v || !v.configured) return { bg: "#F2F2F7", bd: "rgba(0,0,0,0.12)", fg: "#6E6E73", txt: "—" };
  if (v.status === "verified") return { bg: "rgba(52,199,89,0.16)", bd: "rgba(52,199,89,0.45)", fg: "#1A7F37", txt: "✓" };
  if (v.status === "error") return { bg: "rgba(215,0,21,0.08)", bd: "rgba(215,0,21,0.3)", fg: "#D70015", txt: "!" };
  return { bg: "#FFF4E5", bd: "rgba(178,80,0,0.25)", fg: "#B25000", txt: "•" };
}

export function IntegrationsConsole() {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "unconnected">("all");
  const [openSite, setOpenSite] = useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/integrations?filter=${filter}&q=${encodeURIComponent(q)}`).then(r => r.json()).then(d => {
      setSites(d.sites ?? []); setVendors(d.vendors ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [filter, q]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  const pill = (active: boolean) => ({ fontSize: 12, fontWeight: 600, borderRadius: 999, padding: "6px 12px", cursor: "pointer", background: active ? "rgba(0,113,227,0.18)" : "#F5F5F7", border: `1px solid ${active ? "rgba(0,113,227,0.45)" : "rgba(0,0,0,0.08)"}`, color: active ? "#0071E3" : "#6E6E73" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search sites…" className="flex-1 min-w-[160px] rounded-xl px-3 py-2 text-sm outline-none" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", color: "#1D1D1F" }} />
        <button onClick={() => setFilter("all")} style={pill(filter === "all")}>All sites</button>
        <button onClick={() => setFilter("unconnected")} style={pill(filter === "unconnected")}>Not connected</button>
      </div>

      {loading ? <div className="text-xs" style={{ color: "#6E6E73" }}>Loading sites…</div>
        : sites.length === 0 ? <div className="text-xs" style={{ color: "#6E6E73" }}>No sites{filter === "unconnected" ? " need setup — all connected 🎉" : " found."}</div>
        : (
          <div className="space-y-2">
            {sites.map(s => (
              <button key={s.id} onClick={() => setOpenSite(s.id)} className="w-full rounded-2xl px-3 py-3 text-left transition-all hover:-translate-y-0.5" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)" }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold" style={{ color: "#1D1D1F" }}>{s.name}</div>
                    <div className="text-[11px]" style={{ color: "#6E6E73" }}>{[s.city, s.state].filter(Boolean).join(", ") || "—"} · {s.connected}/{s.total} connected</div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {vendors.map(v => { const c = chipColor(s.vendors[v]); return (
                      <span key={v} title={`${VENDOR_LABEL[v] ?? v}: ${s.vendors[v]?.configured ? (s.vendors[v]?.status ?? "configured") : "not set"}`} style={{ fontSize: 10, fontWeight: 700, borderRadius: 8, padding: "3px 7px", background: c.bg, border: `1px solid ${c.bd}`, color: c.fg }}>{(VENDOR_LABEL[v] ?? v).slice(0, 2)} {c.txt}</span>
                    ); })}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

      {openSite && <SiteDetailDrawer id={openSite} systemsTab="setup" onClose={() => { setOpenSite(null); load(); }} />}
    </div>
  );
}
