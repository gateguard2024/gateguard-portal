"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock, RefreshCw, Plus, Search } from "lucide-react";

type MyDayEvent = {
  id: string;
  type: string;
  title: string;
  starts_at?: string | null;
  date?: string | null;
  time?: string | null;
  duration_minutes?: number | null;
};

type MyDaySummary = {
  success: boolean;
  google_calendar?: {
    connected: boolean;
    last_synced_at?: string | null;
    connect_url: string;
    sync_url: string;
  };
  counts?: {
    today_total: number;
    week_total: number;
  };
  next_four_hour_appointment?: MyDayEvent | null;
};

function formatAppointment(event?: MyDayEvent | null): string {
  if (!event) return "No 4h block found";
  const label = event.time || (event.starts_at ? event.starts_at.split("T")[1]?.slice(0, 5) : "");
  return `${event.title}${label ? ` · ${label}` : ""}`;
}

export function MyDayTopBarActions() {
  const [summary, setSummary] = useState<MyDaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  async function loadSummary() {
    setLoading(true);
    try {
      const res = await fetch("/api/calendar/my-day");
      const data = await res.json().catch(() => null) as MyDaySummary | null;
      if (res.ok && data?.success) setSummary(data);
    } catch {
      // Quiet failure — the calendar page itself still works.
    } finally {
      setLoading(false);
    }
  }

  async function syncGoogle() {
    setSyncing(true);
    try {
      await fetch("/api/calendar/google/sync", { method: "POST" });
      await loadSummary();
    } catch {
      // Quiet failure — detailed sync errors are handled on the calendar page.
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, []);

  const connected = summary?.google_calendar?.connected === true;
  const todayTotal = summary?.counts?.today_total ?? 0;
  const weekTotal = summary?.counts?.week_total ?? 0;

  return (
    <div className="hidden xl:flex items-center gap-2">
      <div
        className="flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs shadow-sm"
        style={{
          background: "rgba(255,255,255,0.06)",
          borderColor: "rgba(255,255,255,0.12)",
          color: "#e5e7eb",
        }}
      >
        <CalendarDays size={13} style={{ color: "#93c5fd" }} />
        <span className="font-bold">My Day</span>
        <span style={{ color: "#a8a29e" }}>{loading ? "…" : `${todayTotal} today`}</span>
        <span style={{ color: "#57534e" }}>·</span>
        <span style={{ color: "#a8a29e" }}>{weekTotal} week</span>
      </div>

      <div
        className="max-w-[260px] truncate rounded-xl border px-3 py-1.5 text-xs shadow-sm"
        style={{
          background: "rgba(255,255,255,0.04)",
          borderColor: "rgba(255,255,255,0.10)",
          color: "#d6d3d1",
        }}
        title={formatAppointment(summary?.next_four_hour_appointment)}
      >
        <span className="inline-flex items-center gap-1.5">
          <Clock size={12} style={{ color: "#93c5fd" }} />
          <span className="truncate">{formatAppointment(summary?.next_four_hour_appointment)}</span>
        </span>
      </div>

      {connected ? (
        <button
          type="button"
          onClick={() => void syncGoogle()}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold shadow-sm transition-opacity hover:opacity-85 disabled:opacity-50"
          style={{
            background: "rgba(16,185,129,0.12)",
            borderColor: "rgba(16,185,129,0.28)",
            color: "#bbf7d0",
          }}
          title="Sync Google Calendar"
        >
          <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
          Sync
        </button>
      ) : (
        <a
          href="/api/calendar/google/connect"
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold shadow-sm transition-opacity hover:opacity-85"
          style={{
            background: "rgba(37,99,235,0.22)",
            borderColor: "rgba(147,197,253,0.32)",
            color: "#dbeafe",
          }}
        >
          Connect Google
        </a>
      )}

      <button
        type="button"
        title="Stage 2: Add Event"
        className="inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold opacity-70 shadow-sm"
        style={{
          background: "rgba(255,255,255,0.04)",
          borderColor: "rgba(255,255,255,0.10)",
          color: "#d6d3d1",
        }}
      >
        <Plus size={12} />
        Add Event
      </button>

      <button
        type="button"
        title="Stage 2: Find Time"
        className="inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold opacity-70 shadow-sm"
        style={{
          background: "rgba(255,255,255,0.04)",
          borderColor: "rgba(255,255,255,0.10)",
          color: "#d6d3d1",
        }}
      >
        <Search size={12} />
        Find Time
      </button>
    </div>
  );
}
