'use client';

// Site Security console — the "never open Eagle Eye" view. Each door shows its
// mapped camera's live preview, an Unlock button (confirm + logged), and a
// "Recording" button that plays the last minute of footage. Cameras without a
// door show as live tiles too. All gated by the user's granted capabilities.
import React, { useEffect, useRef, useState } from "react";

type Door = { id: string; name: string };
type CamMap = { door_id: string; camera_id: string | null; camera_name: string; tags?: string[] | null };

// Live camera frame with double-buffering: the new snapshot is preloaded off-screen
// and only swapped in once it's fully decoded, so the tile never blanks/flickers
// between refreshes. (Serverless can't hold an open MJPEG stream, so we refresh frames.)
function LiveCam({ src, alt, onError }: { src: string; alt: string; onError?: () => void }) {
  const [shown, setShown] = useState(src);
  useEffect(() => {
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => { if (!cancelled) setShown(src); };
    img.onerror = () => { if (!cancelled) onError?.(); };
    img.src = src;
    return () => { cancelled = true; };
    // Only re-run when the frame URL changes (tick). onError is stable enough via closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} src={shown} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
}

export function SiteSecurity({ siteId }: { siteId: string }) {
  const [doors, setDoors] = useState<Door[]>([]);
  const [cams, setCams] = useState<Record<string, CamMap>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(0);                 // drives preview refresh
  const [clip, setClip] = useState<{ camId: string; name: string; ts: string } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [events, setEvents] = useState<any[]>([]);     // recent door_unlock site events
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [allCams, setAllCams] = useState<any[]>([]);   // every Eagle Eye camera on this site
  const [camPage, setCamPage] = useState(0);           // 9-per-page grid pagination
  const [camErr, setCamErr] = useState<string | null>(null); // why cameras didn't load
  const noPreview = useRef<Set<string>>(new Set());

  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/brivo/doors?site_id=${siteId}`).then(r => r.ok ? r.json() : { doors: [] }).catch(() => ({ doors: [] })),
      fetch(`/api/sites/${siteId}/door-cameras`).then(r => r.json()).catch(() => ({ mappings: [] })),
      fetch(`/api/sites/${siteId}`).then(r => r.json()).catch(() => ({ events: [] })),
      fetch(`/api/eagle-eye/cameras?site_id=${siteId}`).then(async r => ({ ok: r.ok, body: await r.json().catch(() => ({})) })).catch(() => ({ ok: false, body: { error: "Couldn't reach the camera service." } })),
    ]).then(([d, c, s, cm]) => {
      setDoors(d.doors ?? []);
      const m: Record<string, CamMap> = {};
      (c.mappings ?? []).forEach((x: CamMap) => { m[x.door_id] = x; });
      setCams(m);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setEvents((s.events ?? []).filter((e: any) => e.event_type === "door_unlock"));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const camRes = cm as { ok: boolean; body: any };
      setAllCams(Array.isArray(camRes.body?.cameras) ? camRes.body.cameras : []);
      setCamErr(camRes.ok ? null : (camRes.body?.error ?? "Cameras unavailable."));
    }).finally(() => setLoading(false));
  }, [siteId]);
  useEffect(() => { load(); }, [load]);
  // Refresh live previews every 5s.
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 5000); return () => clearInterval(t); }, []);

  async function unlock(d: Door) {
    if (!window.confirm(`Unlock "${d.name}" now? This physically unlocks the door.`)) return;
    setBusy(d.id); setMsg(null);
    const r = await fetch(`/api/brivo/doors/${d.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site_id: siteId, door_name: d.name, confirm: true }) }).then(x => x.json()).catch(() => null);
    setBusy(null);
    setMsg(r?.ok ? `Unlocked "${d.name}" ✓ — logged.` : (r?.error || "Couldn't unlock."));
  }

  const card = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 18 } as const;

  function Tile({ door }: { door: Door }) {
    const cam = cams[door.id];
    const camId = cam?.camera_id || "";
    const showPreview = !!camId && !noPreview.current.has(camId);
    return (
      <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ position: "relative", aspectRatio: "16/9", background: "#05080f", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {showPreview ? (
            <LiveCam alt={cam?.camera_name || door.name} src={`/api/eagle-eye/preview?site_id=${siteId}&camera_id=${encodeURIComponent(camId)}&t=${tick}`} onError={() => { noPreview.current.add(camId); setTick(n => n + 1); }} />
          ) : (
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 12, padding: 10 }}>{cam?.camera_name ? `📹 ${cam.camera_name}` : "No camera linked"}<div style={{ fontSize: 10, marginTop: 4 }}>{camId ? "live preview unavailable" : "link a camera in the Doors card"}</div></div>
          )}
          <span style={{ position: "absolute", top: 6, left: 6, fontSize: 10, fontWeight: 700, color: "#fff", background: "rgba(0,0,0,0.55)", borderRadius: 6, padding: "2px 7px" }}>{door.name}</span>
          {showPreview && <span style={{ position: "absolute", top: 6, right: 6, fontSize: 9, fontWeight: 700, color: "#fca5a5" }}>● LIVE</span>}
        </div>
        <div style={{ display: "flex", gap: 6, padding: 8 }}>
          <button onClick={() => unlock(door)} disabled={busy === door.id} style={{ flex: 1, fontSize: 12, fontWeight: 600, background: "rgba(251,191,36,0.16)", border: "1px solid rgba(251,191,36,0.45)", color: "#fde68a", borderRadius: 9, padding: "7px 0", cursor: "pointer", opacity: busy === door.id ? 0.5 : 1 }}>{busy === door.id ? "…" : "Unlock"}</button>
          {camId && <button onClick={() => setClip({ camId, name: cam!.camera_name, ts: new Date(Date.now() - 120000).toISOString() })} style={{ fontSize: 12, fontWeight: 600, background: "rgba(0,200,255,0.14)", border: "1px solid rgba(0,200,255,0.4)", color: "#7DE5FF", borderRadius: 9, padding: "7px 12px", cursor: "pointer" }}>Live recording</button>}
        </div>
        {/* Recent unlocks — click to jump the player to that exact moment */}
        {camId && (() => {
          const recent = events.filter(e => e.metadata?.door_id === door.id).slice(0, 3);
          if (recent.length === 0) return null;
          return (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "6px 8px" }}>
              {recent.map((e, i) => (
                <button key={i} onClick={() => setClip({ camId, name: cam!.camera_name, ts: new Date(new Date(e.created_at).getTime() - 8000).toISOString() })} style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 11, padding: "3px 0", cursor: "pointer" }}>
                  <span>🔓 unlocked {new Date(e.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  <span style={{ color: "#7DE5FF" }}>▶ clip</span>
                </button>
              ))}
            </div>
          );
        })()}
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.95)", marginBottom: 4 }}>Site Security</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>Watch each door, unlock, and pull recent footage — all here, no Eagle Eye needed.</div>

      {/* All cameras — 9-up grid, paginated. Shows everything Eagle Eye sees at this site. */}
      {allCams.length > 0 && (() => {
        const pages = Math.ceil(allCams.length / 9);
        const pageCams = allCams.slice(camPage * 9, camPage * 9 + 9);
        return (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>📹 Cameras ({allCams.length})</div>
              {pages > 1 && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => setCamPage(p => Math.max(0, p - 1))} disabled={camPage === 0} style={{ fontSize: 12, fontWeight: 600, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "white", borderRadius: 8, padding: "4px 10px", cursor: camPage === 0 ? "default" : "pointer", opacity: camPage === 0 ? 0.4 : 1 }}>‹ Prev</button>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>Pg {camPage + 1} / {pages}</span>
                <button onClick={() => setCamPage(p => Math.min(pages - 1, p + 1))} disabled={camPage >= pages - 1} style={{ fontSize: 12, fontWeight: 600, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "white", borderRadius: 8, padding: "4px 10px", cursor: camPage >= pages - 1 ? "default" : "pointer", opacity: camPage >= pages - 1 ? 0.4 : 1 }}>Next ›</button>
              </div>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
              {pageCams.map((c, i) => {
                const camId = String(c.id ?? c.camera_id ?? c.esn ?? "");
                const name = c.name ?? c.camera_name ?? `Camera ${camPage * 9 + i + 1}`;
                const ok = camId && !noPreview.current.has(camId);
                return (
                  <button key={camId || i} onClick={() => camId && setClip({ camId, name, ts: new Date(Date.now() - 120000).toISOString() })} style={{ padding: 0, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden", background: "#05080f", cursor: camId ? "pointer" : "default", textAlign: "left" }}>
                    <div style={{ position: "relative", aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {ok ? (
                        <LiveCam alt={name} src={`/api/eagle-eye/preview?site_id=${siteId}&camera_id=${encodeURIComponent(camId)}&t=${tick}`} onError={() => { noPreview.current.add(camId); setTick(n => n + 1); }} />
                      ) : <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>preview unavailable</div>}
                      {ok && <span style={{ position: "absolute", top: 5, right: 6, fontSize: 8.5, fontWeight: 700, color: "#fca5a5" }}>● LIVE</span>}
                      <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, fontSize: 10.5, color: "#fff", background: "rgba(0,0,0,0.55)", padding: "3px 7px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>Tap any camera to watch its recent recording. Doors with a linked camera show below.</div>
          </div>
        );
      })()}

      {!loading && allCams.length === 0 && (() => {
        const notConnected = !camErr || /not connected|client id|secret|connect eagle/i.test(camErr);
        return (
          <div style={{ marginBottom: 14, padding: 12, borderRadius: 12, background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.3)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fcd34d", marginBottom: 4 }}>📹 No cameras showing yet</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
              {notConnected
                ? "Eagle Eye isn’t connected for this site yet. Enter the client ID/secret in the 🔑 Setup tab, then click “Connect Eagle Eye →” and approve."
                : `Connected, but couldn’t load cameras: ${camErr}`}
            </div>
            <button onClick={() => { window.location.href = `/api/eagle-eye/connect?site_id=${siteId}`; }} style={{ marginTop: 9, fontSize: 12, fontWeight: 600, background: "rgba(52,211,153,0.16)", border: "1px solid rgba(52,211,153,0.4)", color: "#6ee7b7", borderRadius: 9, padding: "7px 14px", cursor: "pointer" }}>Connect Eagle Eye →</button>
          </div>
        );
      })()}

      <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)", marginBottom: 8 }}>Doors</div>
      {loading ? <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Loading…</div>
        : doors.length === 0 ? <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>No doors for this site (connect Brivo + link cameras in the Doors card).</div>
        : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 12 }}>{doors.map(d => <Tile key={d.id} door={d} />)}</div>}
      {msg && <div style={{ fontSize: 12, color: msg.includes("✓") ? "#6ee7b7" : "#fca5a5", marginTop: 10 }}>{msg}</div>}

      {clip && (
        <div onClick={() => setClip(null)} style={{ position: "fixed", inset: 0, zIndex: 140, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "min(720px,100%)", background: "#0a1426", border: "1px solid rgba(0,200,255,0.3)", borderRadius: 16, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <b style={{ color: "#fff", fontSize: 14 }}>{clip.name} — recent recording</b>
              <button onClick={() => setClip(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video controls autoPlay src={`/api/eagle-eye/clip?site_id=${siteId}&camera_id=${encodeURIComponent(clip.camId)}&ts=${encodeURIComponent(clip.ts)}`} style={{ width: "100%", borderRadius: 10, background: "#000" }} />
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 8 }}>Showing the last couple of minutes. If it doesn&apos;t load, recording may not be available for this camera/time.</div>
          </div>
        </div>
      )}
    </div>
  );
}
