"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Search, ChevronDown, X, Settings, User } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { HelpCircle, LogOut, CalendarDays, AlertTriangle, ShieldAlert, Info } = require("lucide-react") as any;

interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

interface Incident {
  id: string;
  title: string;
  severity: string;
  status: string;
  source: string;
  occurred_at: string;
  acknowledged_at: string | null;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-red-600 bg-red-50",
  high:     "text-orange-600 bg-orange-50",
  medium:   "text-amber-600 bg-amber-50",
  low:      "text-blue-600 bg-blue-50",
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high:     "bg-orange-500",
  medium:   "bg-amber-400",
  low:      "bg-blue-400",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function TopBar({ title, subtitle, actions }: TopBarProps) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentsLoading, setIncidentsLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch today's calendar item count for badge
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/calendar/today-count");
        if (res.ok) {
          const data = await res.json() as { count?: number };
          setTodayCount(data.count ?? 0);
        }
      } catch {
        // Non-critical — badge just won't show
      }
    })();
  }, []);

  // Fetch open (unacknowledged) incidents for bell badge + dropdown
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/incidents");
        if (res.ok) {
          const data = await res.json() as { incidents?: Incident[] };
          // Show open incidents that haven't been acknowledged
          const open = (data.incidents ?? []).filter(
            i => i.status === "open" && !i.acknowledged_at
          ).slice(0, 20);
          setIncidents(open);
        }
      } catch {
        // Non-critical
      }
    })();
  }, []);

  // Refresh incidents when bell opens
  useEffect(() => {
    if (!bellOpen) return;
    setIncidentsLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/incidents");
        if (res.ok) {
          const data = await res.json() as { incidents?: Incident[] };
          const open = (data.incidents ?? []).filter(
            i => i.status === "open" && !i.acknowledged_at
          ).slice(0, 20);
          setIncidents(open);
        }
      } catch {
        // silently ignore
      } finally {
        setIncidentsLoading(false);
      }
    })();
  }, [bellOpen]);

  async function acknowledgeIncident(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await fetch(`/api/incidents/${id}/acknowledge`, { method: "POST" });
      setIncidents(prev => prev.filter(i => i.id !== id));
    } catch {
      // silently ignore
    }
  }

  // Quick search destinations
  const SEARCH_SHORTCUTS = [
    { label: "Opportunities", href: "/crm/opportunities" },
    { label: "Leads", href: "/crm/leads" },
    { label: "Work Orders", href: "/maintenance" },
    { label: "Sites", href: "/sites" },
    { label: "Products / KB", href: "/products" },
  ];

  return (
    <header className="h-16 border-b border-border flex items-center px-6 gap-4 sticky top-0 z-30 bg-white">
      {/* Title */}
      {!searchOpen && (
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-foreground truncate">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      )}

      {/* Expanding search bar */}
      {searchOpen && (
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search opportunities, leads, sites, work orders…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Escape") { setSearchOpen(false); setSearchQuery(""); }}}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl focus:outline-none bg-slate-50 border border-brand-400/40 text-foreground focus:border-brand-400"
            />
            {/* Quick results */}
            {searchQuery.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-xl py-1.5 z-50">
                <p className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Jump to</p>
                {SEARCH_SHORTCUTS.filter(s => s.label.toLowerCase().includes(searchQuery.toLowerCase())).map(s => (
                  <Link key={s.href} href={s.href} onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-slate-50 transition-colors">
                    <span className="text-muted-foreground">→</span> {s.label}
                  </Link>
                ))}
                {SEARCH_SHORTCUTS.filter(s => s.label.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">No quick matches — press Enter to search all</p>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
            className="p-2 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {actions && !searchOpen && <div className="flex items-center gap-2">{actions}</div>}

      <div className="flex items-center gap-1">
        {/* Search */}
        <button
          onClick={() => setSearchOpen(v => !v)}
          className="p-2 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-slate-100"
          title="Search"
        >
          <Search size={17} />
        </button>

        {/* Calendar */}
        <button
          onClick={() => router.push("/calendar")}
          className="p-2 rounded-lg transition-colors relative text-muted-foreground hover:text-foreground hover:bg-slate-100"
          title="Calendar"
        >
          <CalendarDays size={17} />
          {todayCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[14px] h-[14px] flex items-center justify-center bg-[#2563eb] text-white text-[8px] font-bold rounded-full px-0.5 leading-none">
              {todayCount > 9 ? "9+" : todayCount}
            </span>
          )}
        </button>

        {/* Bell — live incidents */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => setBellOpen(v => !v)}
            className="p-2 rounded-lg transition-colors relative text-muted-foreground hover:text-foreground hover:bg-slate-100"
            title="Incidents & Alerts"
          >
            <Bell size={17} />
            {incidents.length > 0 && (
              <span className="absolute top-1 right-1 min-w-[14px] h-[14px] flex items-center justify-center bg-red-500 text-white text-[8px] font-bold rounded-full px-0.5 leading-none">
                {incidents.length > 9 ? "9+" : incidents.length}
              </span>
            )}
            {incidents.length === 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-slate-300 rounded-full" />
            )}
          </button>
          {bellOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-96 bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">Incidents & Alerts</p>
                  {incidents.length > 0 && (
                    <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{incidents.length} open</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/incidents" onClick={() => setBellOpen(false)}
                    className="text-xs text-brand-400 hover:underline font-medium">View all</Link>
                  <button onClick={() => setBellOpen(false)} className="text-muted-foreground hover:text-foreground ml-1"><X size={14} /></button>
                </div>
              </div>

              {incidentsLoading ? (
                <div className="py-8 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-brand-400/30 border-t-brand-400 rounded-full animate-spin" />
                </div>
              ) : incidents.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-2xl mb-2">✅</p>
                  <p className="text-sm font-medium text-foreground">All clear</p>
                  <p className="text-xs text-muted-foreground mt-1">No open incidents right now</p>
                </div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto divide-y divide-border">
                  {incidents.map(incident => (
                    <Link
                      key={incident.id}
                      href="/incidents"
                      onClick={() => setBellOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group"
                    >
                      {/* severity dot */}
                      <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${SEVERITY_DOT[incident.severity] ?? "bg-slate-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{incident.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${SEVERITY_COLOR[incident.severity] ?? "text-slate-600 bg-slate-100"}`}>
                            {incident.severity}
                          </span>
                          {incident.source === "ggsoc" && (
                            <span className="text-[10px] text-muted-foreground">GGSOC</span>
                          )}
                          <span className="text-[10px] text-muted-foreground">{timeAgo(incident.occurred_at)}</span>
                        </div>
                      </div>
                      {/* Quick acknowledge */}
                      <button
                        onClick={e => acknowledgeIncident(incident.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-[10px] text-muted-foreground hover:text-green-600 border border-border hover:border-green-300 rounded px-1.5 py-0.5 bg-white"
                        title="Acknowledge"
                      >
                        ACK
                      </button>
                    </Link>
                  ))}
                </div>
              )}

              {incidents.length > 0 && (
                <div className="px-4 py-2.5 border-t border-border bg-slate-50">
                  <Link href="/incidents" onClick={() => setBellOpen(false)}
                    className="text-xs text-brand-400 hover:underline font-medium">
                    Open full incident tracker →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Help — links to KB */}
        <Link href="/kb" title="Knowledge Base & Help">
          <button className="p-2 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-slate-100">
            <HelpCircle size={17} />
          </button>
        </Link>

        <div className="w-px h-5 mx-1 bg-border" />

        {/* Profile dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(v => !v)}
            className="flex items-center gap-2 pl-1 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100"
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold bg-brand-400/10 border border-brand-400/30 text-brand-400">RF</div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold leading-tight text-foreground">Russel Feldman</p>
              <p className="text-[10px] leading-tight text-muted-foreground">GateGuard Corporate</p>
            </div>
            <ChevronDown size={12} className={`text-muted-foreground transition-transform ${profileOpen ? "rotate-180" : ""}`} />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-border rounded-xl shadow-lg z-50 py-1 overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-semibold text-foreground">Russel Feldman</p>
                <p className="text-xs text-muted-foreground">rfeldman@gateguard.co</p>
              </div>
              <Link href="/admin" onClick={() => setProfileOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-slate-50 transition-colors">
                <User size={14} className="text-muted-foreground" /> My Account
              </Link>
              <Link href="/admin/dealers" onClick={() => setProfileOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-slate-50 transition-colors">
                <Settings size={14} className="text-muted-foreground" /> Settings
              </Link>
              <div className="border-t border-border mt-1 pt-1">
                <Link href="/sign-in" onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                  <LogOut size={14} /> Sign out
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
