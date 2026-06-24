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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Internal site_events + live Brivo access events, merged newest-first.
    Promise.all([
      fetch(`/api/sites/${siteId}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/brivo/events?site_id=${siteId}`).then(r => r.json()).catch(() => ({})),
    ]).then(([s, b]) => {
      if (cancelled) return;
      const internal: Ev[] = Array.isArray(s.events) ? s.events : [];
      const brivo: Ev[] = Array.isArray(b.events) ? b.events : [];
      const merged = [...internal, ...brivo].sort((a, x) => new Date(x.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setEvents(merged);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [siteId]);

  const card = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 16 } as const;

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.95)", marginBottom: 10 }}><Activity size={16} color="#7DE5FF" /> Activity</div>
      {loading ? <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Loading…</div>
        : events.length === 0 ? <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>No activity yet. Door unlocks, installs, and alerts will show here.</div>
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
    </div>
  );
}
