"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Search, ChevronDown, X, Settings, User, AlertTriangle, Clock } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { HelpCircle, LogOut, CalendarDays, AlertOctagon } = require("lucide-react") as any;

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
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
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
  const [acking, setAcking] = useState<Record<string, boolean>>({});
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

  // Quick-acknowledge from bell dropdown
  const acknowledgeIncident = useCallback(async (incId: string) => {
    setAcking(p => ({ ...p, [incId]: true }));
    try {
      const res = await fetch(`/api/incidents/${incId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const d = await res.json() as { incident: { acknowledged_at: string; acknowledged_by: string } };
        setIncidents(prev =>
          prev.map(i =>
            i.id === incId
              ? { ...i, acknowledged_at: d.incident.acknowledged_at, acknowledged_by: d.incident.acknowledged_by }
              : i
          )
        );
      }
    } catch { /* non-critical */ } finally {
      setAcking(p => ({ ...p, [incId]: false }));
    }
  }, []);

  // Fetch open incidents for bell badge — poll every 60s
  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch("/api/incidents?severity=high,critical&status=open,investigating&limit=10");
      if (res.ok) {
        const data = await res.json() as { incidents?: Incident[] };
        setIncidents(data.incidents ?? []);
      }
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    void fetchIncidents();
    const timer = setInterval(() => void fetchIncidents(), 60_000);
    return () => clearInterval(timer);
  }, [fetchIncidents]);

  // Quick search destinations
  const SEARCH_SHORTCUTS = [
    { label: "Opportunities", href: "/crm/opportunities" },
    { label: "Leads", href: "/crm/leads" },
    { label: "Work Orders", href: "/maintenance" },
    { label: "Sites", href: "/sites" },
    { label: "Products / KB", href: "/products" },
  ];

  return (
    <header className="h-16 border-b border-white/[0.07] flex items-center px-6 gap-4 sticky top-0 z-30" style={{ background: '#1c1917' }}>
      {/* Title */}
      {!searchOpen && (
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold truncate" style={{ color: '#fafaf9' }}>{title}</h1>
          {subtitle && <p className="text-xs" style={{ color: '#78716c' }}>{subtitle}</p>}
        </div>
      )}

      {/* Expanding search bar */}
      {searchOpen && (
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#78716c' }} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search opportunities, leads, sites, work orders…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Escape") { setSearchOpen(false); setSearchQuery(""); }}}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(37,99,235,0.5)', color: '#fafaf9' }}
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
            className="p-2 rounded-lg transition-colors"
            style={{ color: '#a8a29e' }}
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
          className="p-2 rounded-lg transition-colors"
          style={{ color: '#a8a29e' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#fafaf9'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#a8a29e'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          title="Search"
        >
          <Search size={17} />
        </button>

        {/* Calendar */}
        <button
          onClick={() => router.push("/calendar")}
          className="p-2 rounded-lg transition-colors relative"
          style={{ color: '#a8a29e' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#fafaf9'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#a8a29e'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          title="Calendar"
        >
          <CalendarDays size={17} />
          {todayCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[14px] h-[14px] flex items-center justify-center bg-[#2563eb] text-white text-[8px] font-bold rounded-full px-0.5 leading-none">
              {todayCount > 9 ? "9+" : todayCount}
            </span>
          )}
        </button>

        {/* Bell — open incidents */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => setBellOpen(v => !v)}
            className="p-2 rounded-lg transition-colors relative"
            style={{ color: incidents.length > 0 ? '#f87171' : '#a8a29e' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            title={incidents.length > 0 ? `${incidents.length} open incident${incidents.length !== 1 ? 's' : ''}` : 'No open incidents'}
          >
            <Bell size={17} />
            {incidents.length > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-[16px] flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-0.5 leading-none animate-pulse">
                {incidents.length > 9 ? "9+" : incidents.length}
              </span>
            )}
          </button>
          {bellOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-88 bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden" style={{ width: '340px' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">Open Incidents</p>
                  {incidents.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full">{incidents.length}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/incidents" onClick={() => setBellOpen(false)}
                    className="text-xs text-[#6B7EFF] hover:underline font-medium">View all</Link>
                  <button onClick={() => setBellOpen(false)} className="text-muted-foreground hover:text-foreground ml-1"><X size={14} /></button>
                </div>
              </div>
              {incidents.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                    <Bell size={18} className="text-emerald-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">All clear</p>
                  <p className="text-xs text-muted-foreground mt-1">No open critical or high incidents</p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto divide-y divide-border">
                  {incidents.map(inc => {
                    const isCritical = inc.severity === 'critical';
                    const Icon = isCritical ? AlertOctagon : AlertTriangle;
                    const isAcked = !!inc.acknowledged_at;
                    return (
                      <div key={inc.id} className={`flex items-start gap-3 px-4 py-3 ${isAcked ? 'opacity-60' : ''}`}>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isCritical ? 'bg-red-50' : 'bg-amber-50'}`}>
                          <Icon size={13} className={isCritical ? 'text-red-500' : 'text-amber-500'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link href="/incidents" onClick={() => setBellOpen(false)}>
                            <p className="text-xs font-medium text-slate-800 leading-snug truncate hover:underline">{inc.title}</p>
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] font-semibold capitalize ${isCritical ? 'text-red-500' : 'text-amber-500'}`}>{inc.severity}</span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Clock size={9} />{timeAgo(inc.created_at)}
                            </span>
                            {isAcked && (
                              <span className="text-[10px] text-emerald-500 font-medium">✓ Acked by {inc.acknowledged_by}</span>
                            )}
                          </div>
                        </div>
                        {!isAcked && (
                          <button
                            onClick={() => void acknowledgeIncident(inc.id)}
                            disabled={acking[inc.id]}
                            title="Acknowledge this incident"
                            className="shrink-0 mt-0.5 px-2 py-1 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
                          >
                            {acking[inc.id] ? '…' : 'Ack'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {incidents.length > 0 && (
                <div className="px-4 py-2.5 border-t border-border bg-slate-50">
                  <Link href="/incidents" onClick={() => setBellOpen(false)}
                    className="text-xs text-[#6B7EFF] font-medium hover:underline">
                    View all incidents →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Help — links to KB */}
        <Link href="/kb" title="Knowledge Base & Help">
          <button
            className="p-2 rounded-lg transition-colors"
            style={{ color: '#a8a29e' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#fafaf9'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#a8a29e'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            <HelpCircle size={17} />
          </button>
        </Link>

        <div className="w-px h-5 mx-1" style={{ background: 'rgba(255,255,255,0.12)' }} />

        {/* Profile dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(v => !v)}
            className="flex items-center gap-2 pl-1 rounded-lg px-2 py-1.5 transition-colors"
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: 'rgba(37,99,235,0.25)', border: '1px solid rgba(37,99,235,0.4)', color: '#93c5fd' }}>RF</div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold leading-tight" style={{ color: '#fafaf9' }}>Russel Feldman</p>
              <p className="text-[10px] leading-tight" style={{ color: '#78716c' }}>GateGuard Corporate</p>
            </div>
            <ChevronDown size={12} style={{ color: '#78716c' }} className={`transition-transform ${profileOpen ? "rotate-180" : ""}`} />
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
