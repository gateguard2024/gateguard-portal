'use client';

// Per-site Brivo doors — list a property's doors and remotely unlock (with a
// confirm). Each unlock is recorded as a site event, so the activity timeline
// shows who unlocked what + when (foundation for camera-on-door later).
import React, { useEffect, useState } from "react";

type Door = { id: string; name: string };

export function SiteDoors({ siteId }: { siteId: string }) {
  const [doors, setDoors] = useState<Door[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true); setNote(null);
    fetch(`/api/brivo/doors?site_id=${siteId}`).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setNote(d.error || "Couldn't load doors."); setDoors([]); }
      else setDoors(d.doors ?? []);
    }).catch(() => setNote("Couldn't load doors.")).finally(() => setLoading(false));
  }, [siteId]);
  useEffect(() => { load(); }, [load]);

  async function unlock(d: Door) {
    if (!window.confirm(`Unlock "${d.name}" now? This physically unlocks the door.`)) return;
    setBusyId(d.id); setMsg(null);
    const r = await fetch(`/api/brivo/doors/${d.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site_id: siteId, door_name: d.name, confirm: true }) }).then(x => x.json()).catch(() => null);
    setBusyId(null);
    setMsg(r?.ok ? `Unlocked "${d.name}" ✓ — logged to this site's activity.` : (r?.error || "Couldn't unlock."));
  }

  const card = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 18 } as const;
  return (
    <div style={card}>
      <div style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.95)", marginBottom: 4 }}>Doors (Brivo)</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>Live from this site&apos;s Brivo account. Unlocking is logged with who &amp; when.</div>
      {loading ? <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Loading doors…</div>
        : note ? <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)" }}>{note} <span style={{ color: "rgba(255,255,255,0.4)" }}>(Set up Brivo in Connections above to manage doors.)</span></div>
        : doors.length === 0 ? <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>No doors found for this site.</div>
        : (
          <div style={{ display: "grid", gap: 8 }}>
            {doors.map(d => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "10px 12px" }}>
                <span style={{ fontSize: 13.5, color: "rgba(255,255,255,0.9)" }}>{d.name}</span>
                <button onClick={() => unlock(d)} disabled={busyId === d.id} style={{ fontSize: 12, fontWeight: 600, background: "rgba(251,191,36,0.16)", border: "1px solid rgba(251,191,36,0.45)", color: "#fde68a", borderRadius: 10, padding: "7px 14px", cursor: "pointer", opacity: busyId === d.id ? 0.5 : 1 }}>{busyId === d.id ? "Unlocking…" : "Unlock"}</button>
              </div>
            ))}
          </div>
        )}
      {msg && <div style={{ fontSize: 12, color: msg.includes("✓") ? "#6ee7b7" : "#fca5a5", marginTop: 10 }}>{msg}</div>}
    </div>
  );
}
