'use client';

// Access & systems activity feed widget — the site's recent events (door unlocks,
// access, installs, alerts) like an Event Tracker. Pulls real site_events.
import React, { useEffect, useState } from "react";
import { Activity } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ev = Record<string, any>;

const ICON = (t: string) =>
  /unlock|access|door/i.test(t) ? "🔓"
  : /offline|fail|alert|fault/i.test(t) ? "⚠️"
  : /online|install|provision/i.test(t) ? "🔧"
  : /camera|video/i.test(t) ? "📹"
  : "•";

const tone = (sev: string) => sev === "critical" ? "#fca5a5" : sev === "warning" ? "#fcd34d" : "rgba(255,255,255,0.6)";

export function SiteActivity({ siteId }: { siteId: string }) {
  const [events, setEvents] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  // Honest Brivo status so an empty feed says WHY (not connected vs. no events yet).
  const [brivoNote, setBrivoNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setBrivoNote(null);
    // Internal site_events + live Brivo access events, merged newest-first.
    Promise.all([
      fetch(`/api/sites/${siteId}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/brivo/events?site_id=${siteId}`).then(async r => ({ ok: r.ok, body: await r.json().catch(() => ({})) })).catch(() => ({ ok: false, body: {} as Ev })),
    ]).then(([s, bRes]) => {
      if (cancelled) return;
      const internal: Ev[] = Array.isArray((s as Ev).events) ? (s as Ev).events : [];
      const b = bRes as { ok: boolean; body: Ev };
      const brivo: Ev[] = Array.isArray(b.body?.events) ? b.body.events : [];
      // If Brivo returned nothing AND reported an error/mis-configuration, tell the
      // user plainly instead of showing a silent blank. Never fabricate events.
      if (brivo.length === 0 && (!b.ok || b.body?.error)) {
        const err = String(b.body?.error ?? '');
        setBrivoNote(/no brivo login|outside your access/i.test(err)
          ? 'Brivo is not connected for this site yet — door events will appear once it is linked.'
          : /no door access/i.test(err)
          ? 'You do not have door access for this site, so Brivo events are hidden.'
          : 'Brivo door events are unavailable right now.');
      }
      const merged = [...internal, ...brivo].sort((a, x) => new Date(x.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setEvents(merged);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [siteId]);

  const card = { background: "repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#2b3c52,#1e2a3a)", border: "1px solid rgba(140,170,200,0.22)", borderRadius: 18, padding: 16 } as const;

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.95)", marginBottom: 10 }}><Activity size={16} color="#5FB8E0" /> Activity</div>
      {loading ? <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Loading…</div>
        : events.length === 0 ? <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{brivoNote ?? "No activity yet. Door unlocks, installs, and alerts will show here."}</div>
        : <div style={{ display: "grid", gap: 2 }}>
            {events.slice(0, 12).map((e, i) => (
              <div key={e.id || i} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "7px 0", borderBottom: i < Math.min(events.length, 12) - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <span style={{ fontSize: 13 }}>{ICON(String(e.event_type || ""))}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.88)", overflow: "hidden", textOverflow: "ellipsis" }}>{e.summary || e.title || e.event_type || "Event"}</div>
                  <div style={{ fontSize: 11, color: tone(String(e.severity || "info")) }}>{e.created_at ? new Date(e.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}{e.event_source ? ` · ${e.event_source}` : ""}</div>
                </div>
              </div>
            ))}
          </div>}
      {!loading && events.length > 0 && brivoNote && (
        <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.82)" }}>{brivoNote}</div>
      )}
    </div>
  );
}
