'use client';

// Controllers (control panels) for a site — the hybrid hardware registry.
// Corporate adds/programs serials + door names. A field tech/dealer can scan a
// replacement serial (no Brivo); corporate then confirms the swap in one click
// with the door mapping preserved.
import React, { useEffect, useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Panel = { id: string; model: string | null; serial: string | null; pending_serial: string | null; status: string; doors: any[]; source?: string; dealer_confirmed?: boolean };

const doorNames = (doors: unknown[]): string[] => (Array.isArray(doors) ? doors : []).map((d: unknown) => typeof d === "string" ? d : (d as { name?: string })?.name).filter(Boolean) as string[];

const STATUS = (s: string) => s === "live" ? { t: "Live", c: "#34d399" } : s === "programmed" ? { t: "Programmed", c: "#7DE5FF" } : s === "replace_pending" ? { t: "Replace pending", c: "#fbbf24" } : { t: "Requested", c: "#94a3b8" };

export function SitePanels({ siteId, isCorporate }: { siteId: string; isCorporate: boolean }) {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ model: "", serial: "", doors: "" });
  const [editDoors, setEditDoors] = useState<string | null>(null); // panel id being edited
  const [doorDraft, setDoorDraft] = useState("");

  const load = React.useCallback(() => {
    setLoading(true);
    fetch(`/api/sites/${siteId}/panels`).then(r => r.json()).then(d => setPanels(d.panels ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, [siteId]);
  useEffect(() => { load(); }, [load]);

  async function addPanel() {
    if (busy) return; setBusy("add"); setMsg(null);
    const doors = form.doors.split(",").map(s => s.trim()).filter(Boolean);
    const r = await fetch(`/api/sites/${siteId}/panels`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: form.model.trim() || null, serial: form.serial.trim() || null, doors }) }).then(x => x.json()).catch(() => null);
    setBusy(null);
    if (r?.ok) { setForm({ model: "", serial: "", doors: "" }); setShowAdd(false); load(); } else setMsg(r?.error || "Couldn't add.");
  }
  async function requestReplace(p: Panel) {
    const ns = window.prompt(`New controller serial for "${p.model || "panel"}" (scan or type):`);
    if (!ns || !ns.trim()) return;
    setBusy(p.id); setMsg(null);
    const r = await fetch(`/api/sites/${siteId}/panels`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "request_replace", panel_id: p.id, new_serial: ns.trim() }) }).then(x => x.json()).catch(() => null);
    setBusy(null);
    setMsg(r?.ok ? "New serial sent — corporate will confirm the swap. Doors keep working once swapped." : (r?.error || "Couldn't submit."));
    if (r?.ok) load();
  }
  async function saveDoors(p: Panel) {
    setBusy(p.id); setMsg(null);
    const doors = doorDraft.split(",").map(s => s.trim()).filter(Boolean);
    const r = await fetch(`/api/sites/${siteId}/panels`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set_doors", panel_id: p.id, doors }) }).then(x => x.json()).catch(() => null);
    setBusy(null);
    if (r?.ok) { setEditDoors(null); load(); } else setMsg(r?.error || "Couldn't save doors.");
  }
  async function confirmDoors(p: Panel) {
    setBusy(p.id); setMsg(null);
    const r = await fetch(`/api/sites/${siteId}/panels`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm_doors", panel_id: p.id }) }).then(x => x.json()).catch(() => null);
    setBusy(null);
    if (r?.ok) { setMsg("Door list confirmed ✓ — Gate Guard will program the controller."); load(); } else setMsg(r?.error || "Couldn't confirm.");
  }
  async function confirmSwap(p: Panel) {
    setBusy(p.id); setMsg(null);
    const r = await fetch(`/api/sites/${siteId}/panels`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm_swap", panel_id: p.id }) }).then(x => x.json()).catch(() => null);
    setBusy(null);
    if (r?.ok) { setMsg("Swap confirmed ✓"); load(); } else setMsg(r?.error || "Couldn't confirm.");
  }

  const input = { background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.92)", borderRadius: 8, padding: "8px 10px", width: "100%", fontSize: 12.5 } as const;
  const btn = { fontSize: 12, fontWeight: 600, borderRadius: 9, padding: "6px 12px", cursor: "pointer" } as const;

  if (loading) return <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Loading controllers…</div>;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {isCorporate && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Corporate programs serials + door names. Dealers/techs scan replacement serials.</div>
          <button onClick={() => setShowAdd(s => !s)} style={{ ...btn, background: "rgba(0,200,255,0.18)", border: "1px solid rgba(0,200,255,0.45)", color: "#7DE5FF" }}>{showAdd ? "Cancel" : "+ Add controller"}</button>
        </div>
      )}
      {isCorporate && showAdd && (
        <div style={{ display: "grid", gap: 7, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12 }}>
          <input placeholder="Model (e.g. 2-door controller)" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} style={input} />
          <input placeholder="Serial number" value={form.serial} onChange={e => setForm({ ...form, serial: e.target.value })} style={input} />
          <input placeholder="Door names (comma-separated: Front Gate, Pool, Lobby)" value={form.doors} onChange={e => setForm({ ...form, doors: e.target.value })} style={input} />
          <button onClick={addPanel} disabled={busy === "add"} style={{ ...btn, background: "rgba(0,200,255,0.18)", border: "1px solid rgba(0,200,255,0.45)", color: "#7DE5FF", opacity: busy === "add" ? 0.5 : 1 }}>{busy === "add" ? "Adding…" : "Add controller"}</button>
        </div>
      )}
      {panels.length === 0 ? <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>No controllers logged yet.{isCorporate ? "" : " Corporate adds these during setup."}</div>
        : panels.map(p => { const st = STATUS(p.status); return (
          <div key={p.id} style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{p.model || "Controller"}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Serial: {p.serial || "—"}{p.pending_serial ? ` · new: ${p.pending_serial}` : ""}</div>
                {doorNames(p.doors).length > 0 && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>Doors: {doorNames(p.doors).join(", ")}</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: st.c, whiteSpace: "nowrap" }}>{st.t}</span>
                {p.dealer_confirmed && <span style={{ fontSize: 9.5, fontWeight: 700, color: "#6ee7b7", whiteSpace: "nowrap" }}>Doors confirmed ✓</span>}
              </div>
            </div>

            {/* Win → kickoff: a new "requested" panel waiting for the dealer to confirm the door list. */}
            {p.source === "kickoff" && p.status === "requested" && !p.dealer_confirmed && (
              <div style={{ marginTop: 9, background: "rgba(0,200,255,0.08)", border: "1px solid rgba(0,200,255,0.25)", borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 11.5, color: "#7DE5FF", fontWeight: 600 }}>🎉 Deal won — check the door list</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 3 }}>We pre-filled these doors from the survey. Fix anything that&apos;s wrong, then confirm. Gate Guard programs the controller after you confirm.</div>
                {editDoors === p.id ? (
                  <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                    <input value={doorDraft} onChange={e => setDoorDraft(e.target.value)} placeholder="Door names (comma-separated)" style={input} />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => saveDoors(p)} disabled={busy === p.id} style={{ ...btn, background: "rgba(0,200,255,0.18)", border: "1px solid rgba(0,200,255,0.45)", color: "#7DE5FF" }}>{busy === p.id ? "Saving…" : "Save doors"}</button>
                      <button onClick={() => setEditDoors(null)} style={{ ...btn, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.65)" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <button onClick={() => { setEditDoors(p.id); setDoorDraft(doorNames(p.doors).join(", ")); }} style={{ ...btn, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.78)" }}>Edit door list</button>
                    <button onClick={() => confirmDoors(p)} disabled={busy === p.id} style={{ ...btn, background: "rgba(52,211,153,0.16)", border: "1px solid rgba(52,211,153,0.45)", color: "#6ee7b7" }}>{busy === p.id ? "…" : "Confirm door list ✓"}</button>
                  </div>
                )}
              </div>
            )}
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {p.serial && p.status !== "replace_pending" && <button onClick={() => requestReplace(p)} disabled={busy === p.id} style={{ ...btn, background: "rgba(251,191,36,0.14)", border: "1px solid rgba(251,191,36,0.4)", color: "#fde68a", opacity: busy === p.id ? 0.5 : 1 }}>{busy === p.id ? "…" : "Replace controller"}</button>}
              {isCorporate && p.status === "replace_pending" && <button onClick={() => confirmSwap(p)} disabled={busy === p.id} style={{ ...btn, background: "rgba(52,211,153,0.16)", border: "1px solid rgba(52,211,153,0.45)", color: "#6ee7b7" }}>Confirm swap in Brivo</button>}
            </div>
          </div>
        ); })}
      {msg && <div style={{ fontSize: 12, color: msg.includes("✓") || msg.includes("sent") ? "#6ee7b7" : "#fca5a5" }}>{msg}</div>}
    </div>
  );
}
