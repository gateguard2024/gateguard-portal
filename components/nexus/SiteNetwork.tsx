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
  const upt = (s: number | null) => s == null ? null : s >= 86400 ? `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h` : s >= 3600 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 60)}m`;
  const Spark = ({ data, color }: { data: number[]; color: string }) => {
    if (!data || data.length < 2) return null;
    const w = 130, h = 36, max = Math.max(...data), min = Math.min(...data), rng = max - min || 1;
    const pts = data.map((v, idx) => `${(idx / (data.length - 1)) * w},${h - ((v - min) / rng) * (h - 5) - 3}`);
    return (
      <svg width={w} height={h} style={{ display: "block" }} viewBox={`0 0 ${w} ${h}`}>
        <polygon points={`0,${h} ${pts.join(" ")} ${w},${h}`} fill={color} opacity={0.12} />
        <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  };
  const Tile = ({ label, value, unit, accent }: { label: string; value: string | number; unit?: string; accent: string }) => (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderTop: `2px solid ${accent}`, borderRadius: 10, padding: "9px 11px", minWidth: 0 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.92)", lineHeight: 1.1, whiteSpace: "nowrap" }}>{value}{unit ? <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.45)", marginLeft: 2 }}>{unit}</span> : null}</div>
      <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginTop: 3 }}>{label}</div>
    </div>
  );
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Internet / Network dashboard (UniFi cloud, read-only) */}
      {ov && (() => {
        const i = ov.internet || {}; const cns = ov.console || {}; const cl = ov.clients || {}; const hl = ov.health || {};
        const color = i.status === "up" ? "#34d399" : i.status === "down" ? "#f87171" : "#fbbf24";
        const round = (n: number) => n >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
        const tiles = [
          i.download_mbps != null && { label: "Download", value: round(i.download_mbps), unit: "Mbps", accent: "#34d399" },
          i.upload_mbps != null && { label: "Upload", value: round(i.upload_mbps), unit: "Mbps", accent: "#60a5fa" },
          i.latency_ms != null && { label: "Latency", value: Math.round(i.latency_ms), unit: "ms", accent: "#a78bfa" },
          i.packet_loss_pct != null && { label: "Pkt Loss", value: round(i.packet_loss_pct), unit: "%", accent: i.packet_loss_pct > 1 ? "#f87171" : "#34d399" },
          i.uptime_pct != null && { label: "Uptime", value: round(i.uptime_pct), unit: "%", accent: "#34d399" },
          { label: "Clients", value: cl.total ?? 0, unit: "", accent: "#7DE5FF" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ].filter(Boolean) as any[];
        const mix = [{ k: "WiFi", v: cl.wifi ?? 0, c: "#7DE5FF" }, { k: "Wired", v: cl.wired ?? 0, c: "#60a5fa" }, { k: "Guest", v: cl.guest ?? 0, c: "#fbbf24" }];
        const mixTotal = mix.reduce((a, b) => a + b.v, 0) || 1;
        const onlinePct = hl.total ? Math.round((hl.online / hl.total) * 100) : 0;
        const consoleLine = [cns.model, cns.version ? `v${cns.version}` : null, upt(cns.uptime_s) ? `up ${upt(cns.uptime_s)}` : null].filter(Boolean);
        return (
          <div style={{ display: "grid", gap: 12 }}>
            {/* Hero: status + ISP + public IP + throughput sparkline */}
            <div style={{ background: `linear-gradient(135deg, ${color}14, rgba(0,0,0,0.25))`, border: `1px solid ${color}33`, borderRadius: 14, padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: `0 0 10px ${color}` }} />
                  <span style={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,0.95)", letterSpacing: "-0.01em" }}>Internet {i.status === "up" ? "Online" : i.status === "down" ? "Offline" : "Unknown"}</span>
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>{[i.isp, i.public_ip || cns.public_ip, ...consoleLine].filter(Boolean).join("  ·  ")}</div>
              </div>
              {i.trend && i.trend.length > 1 && (
                <div style={{ textAlign: "right" }}>
                  <Spark data={i.trend} color={color} />
                  <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em", textTransform: "uppercase", marginTop: 2 }}>Download · last hour</div>
                </div>
              )}
            </div>

            {/* Metric tiles */}
            {tiles.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(86px, 1fr))", gap: 8 }}>
                {tiles.map((t, n) => <Tile key={n} label={t.label} value={t.value} unit={t.unit} accent={t.accent} />)}
              </div>
            )}

            {/* Client mix + gear health bars */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 11 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 7 }}>Client mix</div>
                <div style={{ display: "flex", height: 8, borderRadius: 5, overflow: "hidden", background: "rgba(255,255,255,0.05)" }}>
                  {mix.map(m => m.v > 0 && <div key={m.k} style={{ width: `${(m.v / mixTotal) * 100}%`, background: m.c }} />)}
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 7, fontSize: 11, color: "rgba(255,255,255,0.6)", flexWrap: "wrap" }}>
                  {mix.map(m => <span key={m.k} style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: m.c }} />{m.k} {m.v}</span>)}
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 7 }}><span>Gear health</span><span style={{ color: hl.offline ? "#fca5a5" : "#6ee7b7" }}>{hl.online ?? 0}/{hl.total ?? 0}</span></div>
                <div style={{ height: 8, borderRadius: 5, overflow: "hidden", background: "rgba(255,255,255,0.05)" }}>
                  <div style={{ width: `${onlinePct}%`, height: "100%", background: onlinePct === 100 ? "#34d399" : "#fbbf24" }} />
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 7 }}>{onlinePct}% of devices online{hl.offline ? ` · ${hl.offline} offline` : ""}</div>
              </div>
            </div>

            {/* Device list */}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {Array.isArray(ov.devices) && ov.devices.length > 0 && (
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>Devices ({ov.devices.length})</div>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {ov.devices.slice(0, 12).map((d: any, n: number) => (
                  <div key={n} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12, padding: "5px 10px", background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8 }}>
                    <span style={{ color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: d.online ? "#34d399" : "#f87171", flexShrink: 0 }} />{d.name}{d.model ? <span style={{ color: "rgba(255,255,255,0.35)" }}> · {d.model}</span> : null}</span>
                    <span style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0, fontSize: 10.5, color: "rgba(255,255,255,0.4)" }}>
                      {[d.ip, d.clients != null ? `${d.clients} clients` : null, upt(d.uptime_s) ? `up ${upt(d.uptime_s)}` : null].filter(Boolean).map((x: string, k: number) => <span key={k}>{x}</span>)}
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
