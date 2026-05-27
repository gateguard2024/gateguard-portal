import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import { createClient } from "@supabase/supabase-js";
import {
  AlertTriangle, Users,
  Eye, Settings, TrendingUp, DollarSign,
  ExternalLink, Network, Radio, Layers, ChevronRight,
  Plus, Activity, Zap,
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ShieldCheck, Target, Trophy } = require("lucide-react") as any;

// ─── Supabase admin client (service role, server-only) ───────────────────────
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─── Tier display helpers ─────────────────────────────────────────────────────
const TIER_LABEL: Record<string, string> = {
  corporate:          "Corporate",
  master_agent:       "Master Agent",
  master_dealer:      "MSO",
  full_dealer:        "Dealer",
  service_dealer:     "Service Partner",
  install_contractor: "Install Partner",
  sales_partner:      "Sales Partner",
  client:             "Client",
};

const TIER_COLOR: Record<string, string> = {
  corporate:          "bg-brand-400/10 text-brand-400",
  master_agent:       "bg-violet-400/10 text-violet-400",
  master_dealer:      "bg-violet-400/10 text-violet-400",
  full_dealer:        "bg-sky-400/10 text-sky-400",
  service_dealer:     "bg-emerald-400/10 text-emerald-400",
  install_contractor: "bg-emerald-400/10 text-emerald-400",
  sales_partner:      "bg-emerald-400/10 text-emerald-400",
  client:             "bg-amber-400/10 text-amber-400",
  partner:            "bg-emerald-400/10 text-emerald-400",
  mso:                "bg-violet-400/10 text-violet-400",
};

// ─── EOS static data ──────────────────────────────────────────────────────────
const q2Rocks = [
  { name: "Portal go-live (beta → prod)",    status: "On Track"  },
  { name: "CRM Phase 2 — no dead UI",        status: "On Track"  },
  { name: "GateCard v2 at 10 properties",    status: "At Risk"   },
  { name: "DirecTV: first 5 dealer signups", status: "On Track"  },
  { name: "PE investor materials finalized", status: "Off Track" },
  { name: "Hire first FT developer",         status: "Off Track" },
];

const rockStatus: Record<string, { bg: string; text: string; dot: string }> = {
  "On Track":  { bg: "bg-emerald-50",   text: "text-emerald-700", dot: "bg-emerald-500"  },
  "At Risk":   { bg: "bg-amber-50",     text: "text-amber-700",   dot: "bg-amber-500"    },
  "Off Track": { bg: "bg-red-50",       text: "text-red-700",     dot: "bg-red-500"      },
  "Complete":  { bg: "bg-[#6B7EFF]/10", text: "text-[#6B7EFF]",  dot: "bg-[#6B7EFF]"   },
};

const scorecardPulse = [
  { name: "New Opportunities",  value: "2",     goal: "3/wk",  on: false },
  { name: "Proposals Sent",     value: "1",     goal: "2/wk",  on: false },
  { name: "Active Dealers",     value: "12",    goal: "50",    on: false },
  { name: "Installed Props",    value: "8",     goal: "50",    on: false },
  { name: "Portal Uptime",      value: "99.9%", goal: "99.9%", on: true  },
];

// ─── Team performance static data ─────────────────────────────────────────────
const teamLeaderboard = [
  { initials: "RF", name: "Russel F.",  xp: 2380, color: "bg-[#6B7EFF]/15 text-[#6B7EFF]" },
  { initials: "NG", name: "Nicole G.",  xp: 1940, color: "bg-emerald-400/15 text-emerald-700" },
  { initials: "JT", name: "Jake T.",    xp: 1210, color: "bg-amber-400/15 text-amber-700" },
];

const activeChallenges = [
  { title: "Close 3 quotes this week",  progress: 1,   total: 3,  xp: 500, daysLeft: 5,  done: false, accent: "bg-[#6B7EFF]" },
  { title: "Add 2 new accounts",        progress: 2,   total: 2,  xp: 300, daysLeft: 0,  done: true,  accent: "bg-emerald-500" },
  { title: "Log 5 field notes",         progress: 3,   total: 5,  xp: 200, daysLeft: 5,  done: false, accent: "bg-amber-400" },
];

// ─── Alerts static data ───────────────────────────────────────────────────────
const notifications = [
  { msg: "Camera offline: Main Gate — Flint River",        time: "14 min ago", type: "error"   },
  { msg: "Forced entry event — Stonegate Townhomes",       time: "1 hr ago",   type: "warning" },
  { msg: "Bridge reconnected — Midwood Gardens",           time: "3 hr ago",   type: "success" },
  { msg: "New quote accepted — Pegasus Properties $7,200", time: "5 hr ago",   type: "success" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const supabase = getSupabase();

  // ── 1. Active Accounts count ───────────────────────────────────────────────
  let activeAccountsCount = 0;
  let isActiveAccountsLive = false;
  try {
    const { count, error } = await supabase
      .from("organizations")
      .select("*", { count: "exact", head: true })
      .neq("org_tier", "corporate")
      .eq("is_active", true);
    if (error) {
      const { count: fallbackCount } = await supabase
        .from("organizations")
        .select("*", { count: "exact", head: true })
        .neq("org_tier", "corporate");
      activeAccountsCount = fallbackCount ?? 0;
    } else {
      activeAccountsCount = count ?? 0;
      isActiveAccountsLive = true;
    }
  } catch (_) {}

  // ── 2. Quote pipeline ──────────────────────────────────────────────────────
  let quoteCount     = 0;
  let quotePipeline  = "$0";
  let isQuoteLive    = false;
  try {
    const { data, error } = await supabase
      .from("quotes")
      .select("total_one_time, total_mrr")
      .in("status", ["draft", "sent"]);
    if (!error && data) {
      quoteCount = data.length;
      const total = data.reduce(
        (sum, q) => sum + (q.total_one_time ?? 0) + (q.total_mrr ?? 0),
        0
      );
      const fmt = (n: number) =>
        n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toLocaleString()}`;
      quotePipeline = fmt(total);
      isQuoteLive = true;
    }
  } catch (_) {}

  // ── 3. Open Work Orders ────────────────────────────────────────────────────
  let openWOCount = 0;
  let isWOLive    = false;
  try {
    const { count, error } = await supabase
      .from("work_orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "in_progress", "scheduled"]);
    if (!error) {
      openWOCount = count ?? 0;
      isWOLive = true;
    }
  } catch (_) {}

  // ── 4. Accounts table rows ────────────────────────────────────────────────
  type OrgRow = { id: string; name: string; org_tier: string; created_at: string };
  let liveAccounts: OrgRow[] = [];
  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, org_tier, created_at")
      .not("org_tier", "eq", "corporate")
      .order("created_at", { ascending: false })
      .limit(12);
    if (!error && data) liveAccounts = data as OrgRow[];
  } catch (_) {}

  const staticAccounts: OrgRow[] = [
    { id: "s1",  name: "Angel Oak - Properties",  org_tier: "client",       created_at: "" },
    { id: "s2",  name: "Pegasus Properties",       org_tier: "client",       created_at: "" },
    { id: "s3",  name: "Stonegate Townhomes",       org_tier: "client",       created_at: "" },
    { id: "s4",  name: "3888 Peachtree",            org_tier: "client",       created_at: "" },
    { id: "s5",  name: "Elevate Eagles Landing",    org_tier: "client",       created_at: "" },
    { id: "s6",  name: "Elevate Greene",            org_tier: "client",       created_at: "" },
    { id: "s7",  name: "Midwood Gardens",           org_tier: "client",       created_at: "" },
    { id: "s8",  name: "Mitul Patel",               org_tier: "client",       created_at: "" },
    { id: "s9",  name: "Flint River",               org_tier: "client",       created_at: "" },
    { id: "s10", name: "Monitoring View",           org_tier: "client",       created_at: "" },
    { id: "s11", name: "Columbia Residential",      org_tier: "sales_partner",created_at: "" },
    { id: "s12", name: "Southeast Security Group",  org_tier: "master_dealer",created_at: "" },
  ];
  const accountRows   = liveAccounts.length > 0 ? liveAccounts : staticAccounts;
  const isLiveAccounts = liveAccounts.length > 0;

  // ── Derived counts ─────────────────────────────────────────────────────────
  const rocksOnTrack = q2Rocks.filter(r => r.status === "On Track" || r.status === "Complete").length;
  const myXP = teamLeaderboard[0].xp;
  const xpNext = 3500;
  const xpPct = Math.round((myXP / xpNext) * 100);

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Nexus Dashboard"
        subtitle="GateGuard — Gate Guard, LLC · System Operator"
      />
      <div className="flex-1 p-6 space-y-5">

        {/* AI Search + Post Update */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <AISearch placeholder='Try "show accounts with offline cameras" · "recent forced entry events" · "MRR this month"' />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#6B7EFF] text-[#6B7EFF] text-sm font-medium hover:bg-[#6B7EFF]/10 transition-colors shrink-0">
            <Plus size={15} />
            Post Update
          </button>
        </div>

        {/* ── 4 Grouped KPI Cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

          {/* Revenue & Pipeline */}
          <div className="bg-card border border-border rounded-xl p-3 lg:p-4 hover:border-brand-400/20 transition-colors">
            <div className="flex items-center justify-between mb-2 lg:mb-3">
              <div className="flex items-center gap-1.5">
                <div className="p-1.5 lg:p-2 rounded-lg bg-[#6B7EFF]/10 shrink-0">
                  <TrendingUp size={12} className="text-[#6B7EFF]" />
                </div>
                <p className="text-[10px] font-semibold text-muted-foreground leading-tight">Revenue</p>
              </div>
              <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-400/10 text-emerald-600 font-semibold uppercase tracking-wide hidden lg:inline">demo</span>
            </div>
            <p className="text-lg lg:text-xl font-bold text-foreground leading-tight">$94.2k</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Monthly MRR</p>
            {/* Desktop: show pipeline metric */}
            <div className="hidden lg:flex items-center gap-3 mt-2 pt-2 border-t border-border/50">
              <div>
                <p className="text-sm font-bold text-foreground">{isQuoteLive ? quotePipeline : "$51.4k"}</p>
                <p className="text-[10px] text-muted-foreground">{isQuoteLive ? `${quoteCount} open quotes` : "Pipeline"}</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-1.5 lg:hidden">+12% vs last mo</p>
          </div>

          {/* Assets & Ops Health */}
          <div className="bg-card border border-border rounded-xl p-3 lg:p-4 hover:border-brand-400/20 transition-colors">
            <div className="flex items-center justify-between mb-2 lg:mb-3">
              <div className="flex items-center gap-1.5">
                <div className="p-1.5 lg:p-2 rounded-lg bg-emerald-400/10 shrink-0">
                  <ShieldCheck size={12} className="text-emerald-500" />
                </div>
                <p className="text-[10px] font-semibold text-muted-foreground leading-tight">Ops Health</p>
              </div>
              <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground/60 font-semibold uppercase tracking-wide hidden lg:inline">demo</span>
            </div>
            <p className="text-lg lg:text-xl font-bold text-foreground leading-tight">115/138</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Cameras online</p>
            {/* Desktop: show doors + WOs */}
            <div className="hidden lg:flex gap-3 mt-2 pt-2 border-t border-border/50">
              <div>
                <p className="text-sm font-bold text-foreground">All on</p>
                <p className="text-[10px] text-muted-foreground">Doors / Gates</p>
              </div>
              <div className="w-px bg-border" />
              <div>
                <p className="text-sm font-bold text-foreground">{isWOLive ? String(openWOCount) : "6"}</p>
                <p className="text-[10px] text-muted-foreground">Open WOs</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-1.5 lg:hidden">23 offline · {isWOLive ? String(openWOCount) : "6"} WOs</p>
          </div>

          {/* Account Growth */}
          <div className="bg-card border border-border rounded-xl p-3 lg:p-4 hover:border-brand-400/20 transition-colors">
            <div className="flex items-center justify-between mb-2 lg:mb-3">
              <div className="flex items-center gap-1.5">
                <div className="p-1.5 lg:p-2 rounded-lg bg-[#6B7EFF]/10 shrink-0">
                  <Users size={12} className="text-[#6B7EFF]" />
                </div>
                <p className="text-[10px] font-semibold text-muted-foreground leading-tight">Accounts</p>
              </div>
              {isActiveAccountsLive ? (
                <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-400/10 text-emerald-600 font-semibold uppercase tracking-wide hidden lg:inline">live</span>
              ) : (
                <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground/60 font-semibold uppercase tracking-wide hidden lg:inline">demo</span>
              )}
            </div>
            <p className="text-lg lg:text-xl font-bold text-foreground leading-tight">
              {isActiveAccountsLive && activeAccountsCount > 0 ? String(activeAccountsCount) : "37"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Active accounts</p>
            {/* Desktop: show DTV */}
            <div className="hidden lg:flex items-center gap-3 mt-2 pt-2 border-t border-border/50">
              <div>
                <p className="text-sm font-bold text-foreground">1,284</p>
                <p className="text-[10px] text-muted-foreground">DTV Activations</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-1.5 lg:hidden">1,284 DTV · 91.4% ARS</p>
          </div>

          {/* Critical Alerts */}
          <div className="bg-card border border-border rounded-xl p-3 lg:p-4 hover:border-red-400/20 transition-colors">
            <div className="flex items-center justify-between mb-2 lg:mb-3">
              <div className="flex items-center gap-1.5">
                <div className="p-1.5 lg:p-2 rounded-lg bg-red-400/10 shrink-0">
                  <AlertTriangle size={12} className="text-red-400" />
                </div>
                <p className="text-[10px] font-semibold text-muted-foreground leading-tight">Alerts</p>
              </div>
              <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground/60 font-semibold uppercase tracking-wide hidden lg:inline">demo</span>
            </div>
            <p className="text-2xl lg:text-3xl font-bold text-red-400 leading-tight">3</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Active alerts</p>
            <Link href="/alerts" className="text-[10px] text-[#6B7EFF] mt-1.5 block">View all →</Link>
          </div>
        </div>

        {/* ── EOS Heartbeat + Team Performance ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

          {/* Q2 Rocks */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Layers size={13} className="text-[#6B7EFF]" />
                <span className="text-sm font-semibold text-foreground">Q2 2026 Rocks</span>
              </div>
              <Link href="/eos" className="text-[11px] text-[#6B7EFF] hover:underline flex items-center gap-0.5 font-medium">
                {rocksOnTrack}/{q2Rocks.length} on track <ChevronRight size={11} />
              </Link>
            </div>
            <div className="px-4 py-3 space-y-2">
              {q2Rocks.map(rock => {
                const s = rockStatus[rock.status];
                return (
                  <Link
                    key={rock.name}
                    href="/eos"
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                    <span className="text-[11px] text-foreground flex-1 truncate">{rock.name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${s.bg} ${s.text}`}>{rock.status}</span>
                  </Link>
                );
              })}
              <div className="pt-2 border-t border-border">
                <Link href="/eos?tab=L10+Meeting" className="text-[11px] text-[#6B7EFF] font-medium hover:underline flex items-center gap-1">
                  Next L10: Fri May 30 at 6:00 AM <ChevronRight size={11} />
                </Link>
              </div>
            </div>
          </div>

          {/* Team Performance */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Trophy size={13} className="text-amber-400" />
                <span className="text-sm font-semibold text-foreground">Team Performance</span>
              </div>
              <span className="text-[11px] text-muted-foreground">June 2026</span>
            </div>
            <div className="px-4 py-3 space-y-4">
              {/* My XP */}
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-7 h-7 rounded-full bg-[#6B7EFF]/15 text-[#6B7EFF] text-[11px] font-semibold flex items-center justify-center shrink-0">RF</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">Russel F.</p>
                    <p className="text-[10px] text-muted-foreground">🔥 12-day streak · Level 8</p>
                  </div>
                  <span className="text-xs font-bold text-[#6B7EFF]">{myXP.toLocaleString()} XP</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-[#6B7EFF] rounded-full transition-all" style={{ width: `${xpPct}%` }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-muted-foreground">0</span>
                  <span className="text-[9px] text-muted-foreground">{myXP.toLocaleString()} / {xpNext.toLocaleString()} to L9</span>
                  <span className="text-[9px] text-muted-foreground">{xpNext.toLocaleString()}</span>
                </div>
              </div>
              {/* Leaderboard */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">June Leaderboard</p>
                <div className="space-y-1.5">
                  {teamLeaderboard.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-3 text-right shrink-0">{i + 1}</span>
                      <div className={`w-5 h-5 rounded-full text-[9px] font-semibold flex items-center justify-center shrink-0 ${p.color}`}>{p.initials}</div>
                      <span className="text-[11px] text-foreground flex-1">{p.name}</span>
                      <span className="text-[11px] font-semibold text-foreground">{p.xp.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Active Challenges + Scorecard */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Target size={13} className="text-[#6B7EFF]" />
                <span className="text-sm font-semibold text-foreground">Active Challenges</span>
              </div>
              <Link href="/eos" className="text-[11px] text-[#6B7EFF] hover:underline font-medium">View all</Link>
            </div>
            <div className="px-4 py-3 space-y-3">
              {activeChallenges.map(c => (
                <div key={c.title}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-foreground">{c.title}</span>
                    <span className={`text-[11px] font-semibold ${c.done ? "text-emerald-500" : "text-foreground"}`}>
                      {c.progress}/{c.total}
                    </span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${c.accent}`}
                      style={{ width: `${Math.round((c.progress / c.total) * 100)}%` }}
                    />
                  </div>
                  <p className={`text-[9px] mt-0.5 ${c.done ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {c.done ? `Completed! +${c.xp} XP earned` : `+${c.xp} XP on completion · ${c.daysLeft} days left`}
                  </p>
                </div>
              ))}
              {/* Scorecard mini */}
              <div className="pt-2 border-t border-border">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Scorecard Pulse</p>
                <div className="space-y-1">
                  {scorecardPulse.map(m => (
                    <div key={m.name} className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.on ? "bg-emerald-500" : "bg-red-400"}`} />
                      <span className="text-[10px] text-foreground flex-1 truncate">{m.name}</span>
                      <span className="text-[10px] font-semibold text-foreground">{m.value}</span>
                      <span className="text-[9px] text-muted-foreground w-11 text-right">/{m.goal}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom Row: Accounts + System & Alerts ──────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

          {/* All Accounts — 2/3 */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Network size={13} className="text-[#6B7EFF]" />
                <span className="text-sm font-semibold text-foreground">All Accounts</span>
                <span className="text-[11px] text-muted-foreground">({accountRows.length})</span>
                {isLiveAccounts && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-400/10 text-emerald-600 font-semibold uppercase tracking-wide">live</span>
                )}
              </div>
              <Link href="/customers" className="text-[11px] text-[#6B7EFF] hover:underline flex items-center gap-1 font-medium">
                View all <ExternalLink size={11} />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-background/20">
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Account</th>
                    <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Tier</th>
                    <th className="text-left px-3 py-2.5 text-muted-foreground font-medium hidden lg:table-cell">Added</th>
                    <th className="px-3 py-2.5 hidden lg:table-cell" />
                  </tr>
                </thead>
                <tbody>
                  {accountRows.map((a) => {
                    const tierLabel = TIER_LABEL[a.org_tier] ?? a.org_tier;
                    const tierCls   = TIER_COLOR[a.org_tier] ?? "bg-muted text-muted-foreground";
                    const addedStr  = a.created_at
                      ? new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "—";
                    return (
                      <tr key={a.id} className="border-b border-border/40 hover:bg-accent/20 transition-colors cursor-pointer group">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0 status-online" />
                            <span className="font-medium text-foreground group-hover:text-[#6B7EFF] transition-colors">{a.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${tierCls}`}>{tierLabel}</span>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell">{addedStr}</td>
                        <td className="px-3 py-2.5 hidden lg:table-cell">
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="text-[9px] px-2 py-1 rounded border border-[#6B7EFF]/40 text-[#6B7EFF] bg-[#6B7EFF]/5 hover:bg-[#6B7EFF]/10 transition-colors font-medium">
                              + Add to L10
                            </button>
                            <Link href={`/customers/${a.id}`} className="p-1 hover:bg-[#6B7EFF]/10 rounded text-[#6B7EFF]">
                              <Eye size={12} />
                            </Link>
                            <button className="p-1 hover:bg-accent rounded text-muted-foreground">
                              <Settings size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* System & Alerts Operations — 1/3 */}
          <div className="flex flex-col gap-3">

            {/* Alerts */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Activity size={13} className="text-amber-400" />
                  <span className="text-sm font-semibold text-foreground">Alerts</span>
                </div>
                <span className="text-[10px] text-muted-foreground">24 hrs</span>
              </div>
              <div className="p-3 space-y-1.5">
                {notifications.map((n, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-background/40 border border-border/40">
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                      n.type === "error"   ? "bg-red-400" :
                      n.type === "success" ? "bg-emerald-400" : "bg-amber-400"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-foreground leading-snug">{n.msg}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-card border border-border rounded-xl p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Quick Actions</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "New Quote",   Icon: DollarSign, href: "/quotes/new"  },
                  { label: "Work Order",  Icon: Zap,        href: "/maintenance" },
                  { label: "Add Account", Icon: Users,      href: "/customers"  },
                  { label: "View SOC",    Icon: Radio,      href: "/soc"        },
                ].map(({ label, Icon, href }) => (
                  <Link key={label} href={href}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border hover:border-[#6B7EFF]/30 hover:bg-[#6B7EFF]/5 transition-all group">
                    <Icon size={12} className="text-muted-foreground group-hover:text-[#6B7EFF] transition-colors shrink-0" />
                    <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Platform Status */}
            <div className="bg-card border border-border rounded-xl p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Platform Status</p>
              <div className="space-y-1.5">
                {[
                  "EagleEye API",
                  "Brivo API",
                  "DirecTV ATLAS",
                  "Supabase",
                  "Vercel Edge",
                ].map((s) => (
                  <div key={s} className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">{s}</span>
                    <span className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full status-online" /> operational
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
