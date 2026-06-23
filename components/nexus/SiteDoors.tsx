'use client';

// Per-site Brivo doors — list a property's doors, attach the camera that watches
// each one, and remotely unlock (with a confirm). Every unlock is logged as a
// site event (with the linked camera) so the activity timeline shows who/when
// and lets you pull the footage.
import React, { useEffect, useState } from "react";
import { Key } from "lucide-react";
import { useUser } from "@clerk/nextjs";

type Door = { id: string; name: string };
type CamMap = { door_id: string; door_name: string | null; camera_id: string | null; camera_name: string; stream_url: string | null; tags?: string[] | null };

export function SiteDoors({ siteId }: { siteId: string }) {
  const { user } = useUser();
  const isCorporate = ((user?.publicMetadata as Record<string, unknown> | undefined)?.org_tier) === "corporate";
  const [doors, setDoors] = useState<Door[]>([]);
  const [cams, setCams] = useState<Record<string, CamMap>>({});
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [camForm, setCamForm] = useState({ camera_name: "", stream_url: "", tags: "", camera_id: "" });
  const [eeCams, setEeCams] = useState<{ id: string; name: string; tags: string[] }[]>([]);

  const load = React.useCallback(() => {
    setLoading(true); setNote(null);
    Promise.all([
      fetch(`/api/brivo/doors?site_id=${siteId}`).then(async r => ({ ok: r.ok, d: await r.json().catch(() => ({})) })),
      fetch(`/api/sites/${siteId}/door-cameras`).then(r => r.json()).catch(() => ({ mappings: [] })),
    ]).then(([doorsRes, camRes]) => {
      if (!doorsRes.ok) { setNote(doorsRes.d.error || "Couldn't load doors."); setDoors([]); }
      else setDoors(doorsRes.d.doors ?? []);
      const map: Record<string, CamMap> = {};
      (camRes.mappings ?? []).forEach((m: CamMap) => { map[m.door_id] = m; });
      setCams(map);
    }).catch(() => setNote("Couldn't load doors.")).finally(() => setLoading(false));
  }, [siteId]);
  useEffect(() => { load(); }, [load]);
  // Live Eagle Eye cameras for the picker (best-effort; manual entry if absent).
  useEffect(() => {
    fetch(`/api/eagle-eye/cameras?site_id=${siteId}`).then(r => r.ok ? r.json() : { cameras: [] }).then(d => setEeCams(d.cameras ?? [])).catch(() => {});
  }, [siteId]);

  async function unlock(d: Door) {
    if (!window.confirm(`Unlock "${d.name}" now? This physically unlocks the door.`)) return;
    setBusyId(d.id); setMsg(null);
    const r = await fetch(`/api/brivo/doors/${d.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site_id: siteId, door_name: d.name, confirm: true }) }).then(x => x.json()).catch(() => null);
    setBusyId(null);
    const cam = cams[d.id]?.camera_name;
    setMsg(r?.ok ? `Unlocked "${d.name}" ✓ — logged${cam ? ` (camera: ${cam})` : ""}.` : (r?.error || "Couldn't unlock."));
  }

  function startEdit(d: Door) {
    const existing = cams[d.id];
    setEditId(d.id);
    setCamForm({ camera_name: existing?.camera_name ?? "", stream_url: existing?.stream_url ?? "", tags: (existing?.tags ?? []).join(", "), camera_id: existing?.camera_id ?? "" });
  }
  function pickCamera(id: string) {
    const c = eeCams.find(x => x.id === id);
    if (!c) { setCamForm(f => ({ ...f, camera_id: "" })); return; }
    setCamForm(f => ({ ...f, camera_id: c.id, camera_name: c.name, tags: c.tags.join(", ") }));
  }
  async function saveCam(d: Door) {
    if (!camForm.camera_name.trim()) return;
    setBusyId(d.id);
    const tags = camForm.tags.split(",").map(t => t.trim()).filter(Boolean);
    await fetch(`/api/sites/${siteId}/door-cameras`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ door_id: d.id, door_name: d.name, camera_name: camForm.camera_name.trim(), camera_id: camForm.camera_id || null, stream_url: camForm.stream_url.trim() || null, tags }) }).catch(() => {});
    setBusyId(null); setEditId(null); load();
  }
  // Auto-match: suggest the Eagle Eye camera whose name/tags overlap the door name.
  function suggestCam(doorName: string) {
    const words = doorName.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);
    return eeCams.find(c => {
      const hay = `${c.name} ${(c.tags || []).join(" ")}`.toLowerCase();
      return words.some(w => hay.includes(w));
    }) || null;
  }
  async function linkSuggested(d: Door, c: { id: string; name: string; tags: string[] }) {
    setBusyId(d.id);
    await fetch(`/api/sites/${siteId}/door-cameras`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ door_id: d.id, door_name: d.name, camera_id: c.id, camera_name: c.name, tags: c.tags }) }).catch(() => {});
    setBusyId(null); load();
  }
  async function unlinkCam(d: Door) {
    setBusyId(d.id);
    await fetch(`/api/sites/${siteId}/door-cameras?door_id=${d.id}`, { method: "DELETE" }).catch(() => {});
    setBusyId(null); setEditId(null); load();
  }

  const card = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 18 } as const;
  const input = { background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.92)", borderRadius: 8, padding: "7px 9px", width: "100%", fontSize: 12.5 } as const;
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.95)", marginBottom: 4 }}><Key size={16} color="#7DE5FF" /> Doors (Brivo)</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>Live from this site&apos;s Brivo account. Link the camera that watches each door, then unlocking is logged with the camera so you can pull footage.</div>
      {loading ? <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Loading doors…</div>
        : note ? <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)", background: "rgba(0,200,255,0.07)", border: "1px solid rgba(0,200,255,0.18)", borderRadius: 10, padding: "10px 12px" }}>
            Brivo isn&apos;t connected for this site yet.{" "}
            {isCorporate ? "Add it in Connections above, then Test." : "Contact Gate Guard to set it up for this property."}
          </div>
        : doors.length === 0 ? <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>No doors found for this site.</div>
        : (
          <div style={{ display: "grid", gap: 8 }}>
            {doors.map(d => {
              const cam = cams[d.id];
              const editing = editId === d.id;
              return (
                <div key={d.id} style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.9)" }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                        {cam ? <>📹 {cam.stream_url ? <a href={cam.stream_url} target="_blank" rel="noreferrer" style={{ color: "#7DE5FF" }}>{cam.camera_name}</a> : cam.camera_name}</> : "No camera linked"}
                      </div>
                      {cam?.tags && cam.tags.length > 0 && <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 5 }}>
                        {cam.tags.map(t => <span key={t} style={{ fontSize: 10, fontWeight: 600, background: "rgba(124,58,237,0.16)", border: "1px solid rgba(124,58,237,0.4)", color: "#c4b5fd", borderRadius: 999, padding: "2px 8px" }}>{t}</span>)}
                      </div>}
                      {!cam && !editing && (() => { const s = suggestCam(d.name); return s ? <button onClick={() => linkSuggested(d, s)} disabled={busyId === d.id} style={{ marginTop: 5, fontSize: 11, fontWeight: 600, background: "rgba(52,211,153,0.14)", border: "1px solid rgba(52,211,153,0.4)", color: "#6ee7b7", borderRadius: 8, padding: "3px 9px", cursor: "pointer" }}>💡 Link “{s.name}”?</button> : null; })()}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => editing ? setEditId(null) : startEdit(d)} style={{ fontSize: 11.5, fontWeight: 600, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.75)", borderRadius: 9, padding: "6px 10px", cursor: "pointer" }}>{cam ? "Camera" : "+ Camera"}</button>
                      <button onClick={() => unlock(d)} disabled={busyId === d.id} style={{ fontSize: 11.5, fontWeight: 600, background: "rgba(251,191,36,0.16)", border: "1px solid rgba(251,191,36,0.45)", color: "#fde68a", borderRadius: 9, padding: "6px 12px", cursor: "pointer", opacity: busyId === d.id ? 0.5 : 1 }}>{busyId === d.id ? "…" : "Unlock"}</button>
                    </div>
                  </div>
                  {editing && (
                    <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                      {eeCams.length > 0 && (
                        <select value={camForm.camera_id} onChange={e => pickCamera(e.target.value)} style={{ ...input, cursor: "pointer" }}>
                          <option value="">Pick an Eagle Eye camera… (or type below)</option>
                          {eeCams.map(c => <option key={c.id} value={c.id} style={{ background: "#0b1424" }}>{c.name}</option>)}
                        </select>
                      )}
                      <input placeholder="Camera name (e.g. Front Gate Cam)" value={camForm.camera_name} onChange={e => setCamForm({ ...camForm, camera_name: e.target.value })} style={input} />
                      <input placeholder="Live view URL (optional)" value={camForm.stream_url} onChange={e => setCamForm({ ...camForm, stream_url: e.target.value })} style={input} />
                      <input placeholder="Tags (comma-separated, e.g. entrance, LPR)" value={camForm.tags} onChange={e => setCamForm({ ...camForm, tags: e.target.value })} style={input} />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => saveCam(d)} disabled={!camForm.camera_name.trim()} style={{ fontSize: 12, fontWeight: 600, background: "rgba(0,200,255,0.18)", border: "1px solid rgba(0,200,255,0.45)", color: "#7DE5FF", borderRadius: 9, padding: "6px 12px", cursor: "pointer", opacity: camForm.camera_name.trim() ? 1 : 0.5 }}>Save camera</button>
                        {cam && <button onClick={() => unlinkCam(d)} style={{ fontSize: 12, fontWeight: 600, background: "rgba(248,113,113,0.14)", border: "1px solid rgba(248,113,113,0.4)", color: "#fca5a5", borderRadius: 9, padding: "6px 12px", cursor: "pointer" }}>Unlink</button>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      {msg && <div style={{ fontSize: 12, color: msg.includes("✓") ? "#6ee7b7" : "#fca5a5", marginTop: 10 }}>{msg}</div>}
    </div>
  );
}
