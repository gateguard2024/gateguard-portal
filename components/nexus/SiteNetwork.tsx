'use client';

// Per-site UniFi — Network (connected clients, read-only) + Access doors
// (list + unlock). Gated by 'network' / 'doors' capabilities.
import React, { useEffect, useState } from "react";

type Client = { mac: string; name: string; ip: string | null; wired: boolean };
type Door = { id: string; name: string };

export function SiteNetwork({ siteId }: { siteId: string }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [doors, setDoors] = useState<Door[]>([]);
  const [netNote, setNetNote] = useState<string | null>(null);
  const [doorNote, setDoorNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ov, setOv] = useState<any>(null);   // UniFi cloud overview (internet/WAN + device health)

  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/unifi/clients?site_id=${siteId}`).then(async r => ({ ok: r.ok, d: await r.json().catch(() => ({})) })),
      fetch(`/api/unifi/access/doors?site_id=${siteId}`).then(async r => ({ ok: r.ok, d: await r.json().catch(() => ({})) })),
      fetch(`/api/unifi/cloud/overview?site_id=${siteId}`).then(async r => ({ ok: r.ok, d: await r.json().catch(() => ({})) })),
    ]).then(([c, dr, o]) => {
      if (c.ok) setClients(c.d.clients ?? []); else { setNetNote(c.d.error || "Network not connected."); setClients([]); }
      if (dr.ok) setDoors(dr.d.doors ?? []); else { setDoorNote(dr.d.error || "UniFi Access not connected."); setDoors([]); }
      setOv(o.ok && o.d?.connected ? o.d : null);
    }).finally(() => setLoading(false));
  }, [siteId]);
  useEffect(() => { load(); }, [load]);

  async function unlock(d: Door) {
    if (!window.confirm(`Unlock "${d.name}" now? This physically unlocks the door.`)) return;
    setBusy(d.id); setMsg(null);
    const r = await fetch(`/api/unifi/access/doors/${d.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site_id: siteId, door_name: d.name, confirm: true }) }).then(x => x.json()).catch(() => null);
    setBusy(null);
    setMsg(r?.ok ? `Unlocked "${d.name}" ✓ — logged.` : (r?.error || "Couldn't unlock."));
  }

  const sub = { fontSize: 12, color: "rgba(255,255,255,0.5)" } as const;
  if (loading) return <div style={sub}>Loading network…</div>;
  const fmt = (n: number | null, unit: string) => n == null ? null : `${n % 1 === 0 ? n : n.toFixed(1)}${unit}`;
  const upt = (s: number | null) => s == null ? null : s >= 86400 ? `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h` : s >= 3600 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 60)}m`;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Internet / WAN status (UniFi cloud) */}
      {ov && (() => {
        const i = ov.internet || {};
        const cns = ov.console || {};
        const color = i.status === "up" ? "#34d399" : i.status === "down" ? "#f87171" : "#fbbf24";
        const stats = [fmt(i.download_mbps, "↓ Mbps"), fmt(i.upload_mbps, "↑ Mbps"), fmt(i.latency_ms, " ms"), fmt(i.packet_loss_pct, "% loss"), fmt(i.uptime_pct, "% up")].filter(Boolean);
        const consoleLine = [cns.model, i.public_ip || cns.public_ip, cns.version ? `v${cns.version}` : null, upt(cns.uptime_s) ? `up ${upt(cns.uptime_s)}` : null].filter(Boolean);
        return (
          <div style={{ background: "rgba(0,0,0,0.22)", border: `1px solid ${color}33`, borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}` }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.92)" }}>Internet {i.status === "up" ? "Online" : i.status === "down" ? "Offline" : "Status unknown"}</span>
                {i.isp && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>· {i.isp}</span>}
              </div>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{ov.clients?.total ?? 0} clients</span>
            </div>
            {consoleLine.length > 0 && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 5 }}>{consoleLine.join(" · ")}</div>}
            {stats.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{stats.map((s, n) => <span key={n}>{s}</span>)}</div>}
            <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11.5, color: "rgba(255,255,255,0.5)" }}>
              <span>WiFi {ov.clients?.wifi ?? 0}</span><span>Wired {ov.clients?.wired ?? 0}</span>
              {(ov.clients?.guest ?? 0) > 0 && <span>Guest {ov.clients.guest}</span>}
              <span style={{ marginLeft: "auto", color: ov.health?.offline ? "#fca5a5" : "#6ee7b7" }}>Gear: {ov.health?.online ?? 0}/{ov.health?.total ?? 0} online</span>
            </div>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {Array.isArray(ov.devices) && ov.devices.length > 0 && (
              <div style={{ display: "grid", gap: 4, marginTop: 10 }}>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {ov.devices.slice(0, 8).map((d: any, n: number) => (
                  <div key={n} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12, padding: "4px 9px", background: "rgba(0,0,0,0.18)", borderRadius: 8 }}>
                    <span style={{ color: "rgba(255,255,255,0.82)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}{d.model ? <span style={{ color: "rgba(255,255,255,0.35)" }}> · {d.model}</span> : null}</span>
                    <span style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0, fontSize: 10.5 }}>
                      {[d.ip, d.clients != null ? `${d.clients} clients` : null, upt(d.uptime_s) ? `up ${upt(d.uptime_s)}` : null].filter(Boolean).map((x: string, k: number) => <span key={k} style={{ color: "rgba(255,255,255,0.4)" }}>{x}</span>)}
                      <span style={{ color: d.online ? "#6ee7b7" : "#fca5a5" }}>{d.online ? "● online" : "○ offline"}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* UniFi Access doors */}
      {doors.length > 0 && (
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginBottom: 8 }}>UniFi Access doors</div>
          <div style={{ display: "grid", gap: 8 }}>
            {doors.map(d => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "10px 12px" }}>
                <span style={{ fontSize: 13.5, color: "rgba(255,255,255,0.9)" }}>{d.name}</span>
                <button onClick={() => unlock(d)} disabled={busy === d.id} style={{ fontSize: 11.5, fontWeight: 600, background: "rgba(251,191,36,0.16)", border: "1px solid rgba(251,191,36,0.45)", color: "#fde68a", borderRadius: 9, padding: "6px 12px", cursor: "pointer", opacity: busy === d.id ? 0.5 : 1 }}>{busy === d.id ? "…" : "Unlock"}</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {doorNote && doors.length === 0 && <div style={sub}>UniFi Access: {doorNote}</div>}

      {/* Network clients */}
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginBottom: 8 }}>Connected devices {clients.length > 0 && <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>· {clients.length}</span>}</div>
        {netNote && clients.length === 0 ? <div style={sub}>{netNote}</div>
          : clients.length === 0 ? <div style={sub}>No connected devices.</div>
          : <div style={{ display: "grid", gap: 5, maxHeight: 280, overflowY: "auto" }}>
              {clients.map(c => (
                <div key={c.mac} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12.5, padding: "6px 10px", background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 9 }}>
                  <span style={{ color: "rgba(255,255,255,0.85)" }}>{c.name}</span>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{c.ip || c.mac} · {c.wired ? "wired" : "wifi"}</span>
                </div>
              ))}
            </div>}
      </div>
      {msg && <div style={{ fontSize: 12, color: msg.includes("✓") ? "#6ee7b7" : "#fca5a5" }}>{msg}</div>}
    </div>
  );
}
