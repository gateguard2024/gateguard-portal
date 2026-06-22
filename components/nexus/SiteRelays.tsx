'use client';

// Per-site Shelly relays — list and turn on/off (with confirm). Each toggle is
// logged to the site activity timeline (who/when). Operate action; dealers at
// the site can use it. Setup (auth key) is corporate-only.
import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

type Relay = { id: string; name: string; channel: number; on: boolean | null };

export function SiteRelays({ siteId }: { siteId: string }) {
  const { user } = useUser();
  const isCorporate = ((user?.publicMetadata as Record<string, unknown> | undefined)?.org_tier) === "corporate";
  const [relays, setRelays] = useState<Relay[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true); setNote(null);
    fetch(`/api/shelly/relays?site_id=${siteId}`).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setNote(d.error || "Couldn't load relays."); setRelays([]); }
      else setRelays(d.relays ?? []);
    }).catch(() => setNote("Couldn't load relays.")).finally(() => setLoading(false));
  }, [siteId]);
  useEffect(() => { load(); }, [load]);

  async function toggle(r: Relay) {
    const next = !(r.on ?? false);
    if (!window.confirm(`Turn "${r.name}" ${next ? "ON" : "OFF"} now? This switches the physical relay.`)) return;
    const key = `${r.id}:${r.channel}`;
    setBusy(key); setMsg(null);
    const res = await fetch(`/api/shelly/relays/${r.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site_id: siteId, channel: r.channel, on: next, name: r.name, confirm: true }) }).then(x => x.json()).catch(() => null);
    setBusy(null);
    if (res?.ok) { setMsg(`Turned "${r.name}" ${next ? "ON" : "OFF"} ✓ — logged.`); setRelays(prev => prev.map(x => (x.id === r.id && x.channel === r.channel) ? { ...x, on: next } : x)); }
    else setMsg(res?.error || "Couldn't switch the relay.");
  }

  const card = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 18 } as const;
  return (
    <div style={card}>
      <div style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.95)", marginBottom: 4 }}>Relays / Power (Shelly)</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>Switch this site&apos;s Shelly relays. Every change is logged with who &amp; when.</div>
      {loading ? <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Loading relays…</div>
        : note ? <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)", background: "rgba(0,200,255,0.07)", border: "1px solid rgba(0,200,255,0.18)", borderRadius: 10, padding: "10px 12px" }}>Shelly isn&apos;t connected for this site yet. {isCorporate ? "Add the auth key + server in Connections above, then Test." : "Contact Gate Guard to set it up for this property."}</div>
        : relays.length === 0 ? <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>No Shelly relays found for this site.</div>
        : (
          <div style={{ display: "grid", gap: 8 }}>
            {relays.map(r => {
              const key = `${r.id}:${r.channel}`;
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "10px 12px" }}>
                  <div>
                    <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.9)" }}>{r.name}</div>
                    {r.on != null && <div style={{ fontSize: 11, color: r.on ? "#6ee7b7" : "rgba(255,255,255,0.45)", marginTop: 2 }}>{r.on ? "● ON" : "○ OFF"}</div>}
                  </div>
                  <button onClick={() => toggle(r)} disabled={busy === key} style={{ fontSize: 11.5, fontWeight: 600, background: r.on ? "rgba(248,113,113,0.14)" : "rgba(52,211,153,0.16)", border: `1px solid ${r.on ? "rgba(248,113,113,0.4)" : "rgba(52,211,153,0.45)"}`, color: r.on ? "#fca5a5" : "#6ee7b7", borderRadius: 9, padding: "6px 14px", cursor: "pointer", opacity: busy === key ? 0.5 : 1 }}>{busy === key ? "…" : r.on ? "Turn OFF" : "Turn ON"}</button>
                </div>
              );
            })}
          </div>
        )}
      {msg && <div style={{ fontSize: 12, color: msg.includes("✓") ? "#6ee7b7" : "#fca5a5", marginTop: 10 }}>{msg}</div>}
    </div>
  );
}
