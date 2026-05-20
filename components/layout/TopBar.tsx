"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Search, ChevronDown, X, Settings, User } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { HelpCircle, LogOut, CalendarDays } = require("lucide-react") as any;

interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function TopBar({ title, subtitle, actions }: TopBarProps) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
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

  // Quick search destinations
  const SEARCH_SHORTCUTS = [
    { label: "Opportunities", href: "/crm/opportunities" },
    { label: "Leads", href: "/crm/leads" },
    { label: "Work Orders", href: "/maintenance" },
    { label: "Sites", href: "/sites" },
    { label: "Products / KB", href: "/products" },
  ];

  return (
    <header className="h-16 border-b border-border bg-white/80 backdrop-blur-sm flex items-center px-6 gap-4 sticky top-0 z-30">
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
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search opportunities, leads, sites, work orders…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Escape") { setSearchOpen(false); setSearchQuery(""); }}}
              className="w-full pl-9 pr-4 py-2 text-sm border border-[#6B7EFF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-white"
            />
            {/* Quick results */}
            {searchQuery.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg py-1.5 z-50">
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
          <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="p-2 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {actions && !searchOpen && <div className="flex items-center gap-2">{actions}</div>}

      <div className="flex items-center gap-1">
        {/* Search */}
        <button
          onClick={() => setSearchOpen(v => !v)}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Search"
        >
          <Search size={17} />
        </button>

        {/* Calendar */}
        <button
          onClick={() => router.push("/calendar")}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors relative"
          title="Calendar"
        >
          <CalendarDays size={17} />
          {todayCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[14px] h-[14px] flex items-center justify-center bg-[#6B7EFF] text-white text-[8px] font-bold rounded-full px-0.5 leading-none">
              {todayCount > 9 ? "9+" : todayCount}
            </span>
          )}
        </button>

        {/* Bell — notifications */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => setBellOpen(v => !v)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors relative"
            title="Notifications"
          >
            <Bell size={17} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-brand-400 rounded-full" />
          </button>
          {bellOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-80 bg-white border border-border rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <p className="text-sm font-semibold text-foreground">Notifications</p>
                <button onClick={() => setBellOpen(false)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
              </div>
              <div className="py-6 text-center">
                <p className="text-2xl mb-2">🔔</p>
                <p className="text-sm text-muted-foreground">No new notifications</p>
                <p className="text-xs text-muted-foreground mt-1">Renewal alerts, lead assignments, and WO updates will appear here</p>
              </div>
            </div>
          )}
        </div>

        {/* Help — links to KB */}
        <Link href="/kb" title="Knowledge Base & Help">
          <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <HelpCircle size={17} />
          </button>
        </Link>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Profile dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(v => !v)}
            className="flex items-center gap-2 pl-1 rounded-lg hover:bg-accent px-2 py-1.5 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-brand-400/20 border border-brand-400/30 flex items-center justify-center text-[11px] font-bold text-brand-400">RF</div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-foreground leading-tight">Russel Feldman</p>
              <p className="text-[10px] text-muted-foreground leading-tight">GateGuard Corporate</p>
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
