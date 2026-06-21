'use client';

// Corporate Integrations console — every site + its per-vendor connection status
// in one place, so corporate sets up dealer sites at scale. Click a site to open
// its full panel (with the Connections card). Corporate only.
import React, { useEffect, useState } from "react";
import { SiteDetailDrawer } from "@/components/nexus/OperationsHub";

type VStatus = { configured: boolean; status: string | null };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SiteRow = { id: string; name: string; city: string | null; state: string | null; vendors: Record<string, VStatus>; connected: number; total: number };

const VENDOR_LABEL: Record<string, string> = { brivo: "Brivo", eagle_eye: "Eagle Eye", shelly: "Shelly", unifi: "UniFi" };

function chipColor(v?: VStatus) {
  if (!v || !v.configured) return { bg: "rgba(100,116,139,0.15)", bd: "rgba(100,116,139,0.4)", fg: "#94a3b8", txt: "—" };
  if (v.status === "verified") return { bg: "rgba(52,211,153,0.16)", bd: "rgba(52,211,153,0.45)", fg: "#6ee7b7", txt: "✓" };
  if (v.status === "error") return { bg: "rgba(248,113,113,0.14)", bd: "rgba(248,113,113,0.4)", fg: "#fca5a5", txt: "!" };
  return { bg: "rgba(251,191,36,0.14)", bd: "rgba(251,191,36,0.4)", fg: "#fde68a", txt: "•" };
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

  const pill = (active: boolean) => ({ fontSize: 12, fontWeight: 600, borderRadius: 999, padding: "6px 12px", cursor: "pointer", background: active ? "rgba(0,200,255,0.18)" : "rgba(255,255,255,0.05)", border: `1px solid ${active ? "rgba(0,200,255,0.45)" : "rgba(255,255,255,0.12)"}`, color: active ? "#7DE5FF" : "rgba(255,255,255,0.6)" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search sites…" className="flex-1 min-w-[160px] rounded-xl px-3 py-2 text-sm outline-none" style={{ background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.9)" }} />
        <button onClick={() => setFilter("all")} style={pill(filter === "all")}>All sites</button>
        <button onClick={() => setFilter("unconnected")} style={pill(filter === "unconnected")}>Not connected</button>
      </div>

      {loading ? <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Loading sites…</div>
        : sites.length === 0 ? <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>No sites{filter === "unconnected" ? " need setup — all connected 🎉" : " found."}</div>
        : (
          <div className="space-y-2">
            {sites.map(s => (
              <button key={s.id} onClick={() => setOpenSite(s.id)} className="w-full rounded-2xl px-3 py-3 text-left transition-all hover:-translate-y-0.5" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.92)" }}>{s.name}</div>
                    <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>{[s.city, s.state].filter(Boolean).join(", ") || "—"} · {s.connected}/{s.total} connected</div>
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

      {openSite && <SiteDetailDrawer id={openSite} onClose={() => { setOpenSite(null); load(); }} />}
    </div>
  );
}
