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

  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/unifi/clients?site_id=${siteId}`).then(async r => ({ ok: r.ok, d: await r.json().catch(() => ({})) })),
      fetch(`/api/unifi/access/doors?site_id=${siteId}`).then(async r => ({ ok: r.ok, d: await r.json().catch(() => ({})) })),
    ]).then(([c, dr]) => {
      if (c.ok) setClients(c.d.clients ?? []); else { setNetNote(c.d.error || "Network not connected."); setClients([]); }
      if (dr.ok) setDoors(dr.d.doors ?? []); else { setDoorNote(dr.d.error || "UniFi Access not connected."); setDoors([]); }
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
  return (
    <div style={{ display: "grid", gap: 16 }}>
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
