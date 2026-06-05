"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, RefreshCw, Plus, Search, X } from "lucide-react";

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

type EventDraft = {
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  notes: string;
};

function todayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EMPTY_DRAFT: EventDraft = {
  title: "",
  date: todayDate(),
  start_time: "09:00",
  end_time: "10:00",
  location: "",
  notes: "",
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
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<EventDraft>(EMPTY_DRAFT);

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

  async function saveEvent() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/calendar/events/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => ({})) as { success?: boolean; message?: string };
      if (!res.ok || data.success === false) throw new Error(data.message || "Could not add event.");
      setModalOpen(false);
      setDraft({ ...EMPTY_DRAFT, date: todayDate() });
      await loadSummary();
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add event.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, []);

  const connected = summary?.google_calendar?.connected === true;
  const todayTotal = summary?.counts?.today_total ?? 0;
  const weekTotal = summary?.counts?.week_total ?? 0;

  return (
    <>
      <div className="hidden lg:flex items-center gap-2">
        <div
          className="flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs shadow-sm"
          style={{
            background: "rgba(255,255,255,0.06)",
            borderColor: "rgba(255,255,255,0.12)",
            color: "#e5e7eb",
          }}
        >
          <Calendar size={13} style={{ color: "#93c5fd" }} />
          <span className="font-bold">My Day</span>
          <span style={{ color: "#a8a29e" }}>{loading ? "…" : `${todayTotal} today`}</span>
          <span className="hidden 2xl:inline" style={{ color: "#57534e" }}>·</span>
          <span className="hidden 2xl:inline" style={{ color: "#a8a29e" }}>{weekTotal} week</span>
        </div>

        <div
          className="hidden xl:block max-w-[240px] truncate rounded-xl border px-3 py-1.5 text-xs shadow-sm"
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
            <span className="hidden xl:inline">Sync</span>
          </button>
        ) : (
          <a
            href="/api/calendar/google/connect"
            className="hidden xl:inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold shadow-sm transition-opacity hover:opacity-85"
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
          onClick={() => {
            setError(null);
            setDraft({ ...EMPTY_DRAFT, date: todayDate() });
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold shadow-sm transition-opacity hover:opacity-85"
          style={{
            background: "rgba(0,200,255,0.12)",
            borderColor: "rgba(0,200,255,0.28)",
            color: "#bfdbfe",
          }}
        >
          <Plus size={12} />
          Add Event
        </button>

        <button
          type="button"
          title="Stage 3: Find Time"
          className="hidden xl:inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold opacity-70 shadow-sm"
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

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0C111D] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-300">Nexus Calendar</div>
                <h2 className="mt-1 text-lg font-semibold text-white">Add Event</h2>
                <p className="mt-1 text-xs text-white/45">Save it here first. Google sync can come later.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full border border-white/10 p-2 text-white/60 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-white/70">Title</span>
                <input
                  value={draft.title}
                  onChange={e => setDraft(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Example: Site walk at Marbella"
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-sky-400/50"
                  autoFocus
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-xs font-semibold text-white/70">Date</span>
                  <input
                    type="date"
                    value={draft.date}
                    onChange={e => setDraft(prev => ({ ...prev, date: e.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/50"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-white/70">Start</span>
                  <input
                    type="time"
                    value={draft.start_time}
                    onChange={e => setDraft(prev => ({ ...prev, start_time: e.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/50"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-white/70">End</span>
                  <input
                    type="time"
                    value={draft.end_time}
                    onChange={e => setDraft(prev => ({ ...prev, end_time: e.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/50"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-white/70">Location</span>
                <input
                  value={draft.location}
                  onChange={e => setDraft(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Optional"
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-sky-400/50"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-white/70">Notes</span>
                <textarea
                  value={draft.notes}
                  onChange={e => setDraft(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional"
                  rows={3}
                  className="mt-1 w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-sky-400/50"
                />
              </label>
            </div>

            {error && <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-white/60 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveEvent()}
                disabled={saving || !draft.title.trim() || !draft.date || !draft.start_time || !draft.end_time}
                className="rounded-full px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #00C8FF, #007CFF)" }}
              >
                {saving ? "Saving..." : "Save Event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
