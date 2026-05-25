import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import { createClient } from "@supabase/supabase-js";
import {
  Camera, Shield, Wifi, AlertTriangle, Users,
  Eye, Settings, TrendingUp, DollarSign,
  ExternalLink, Network, Radio, Layers, ChevronRight,
} from "lucide-react";

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
  // legacy aliases kept for static rows
  partner:            "bg-emerald-400/10 text-emerald-400",
  mso:                "bg-violet-400/10 text-violet-400",
};

// ─── EOS / static data (not yet in Supabase) ─────────────────────────────────
const q2Rocks = [
  { name: "Portal go-live (beta → prod)",    status: "On Track"  },
  { name: "CRM Phase 2 — no dead UI",        status: "On Track"  },
  { name: "GateCard v2 at 10 properties",    status: "At Risk"   },
  { name: "DirecTV: first 5 dealer signups", status: "On Track"  },
  { name: "PE investor materials finalized", status: "Off Track" },
  { name: "Hire first FT developer",         status: "Off Track" },
];

const scorecardPulse = [
  { name: "New Opportunities",  value: "2",     goal: "3/wk",  on: false },
  { name: "Proposals Sent",     value: "1",     goal: "2/wk",  on: false },
  { name: "Active Dealers",     value: "12",    goal: "50",    on: false },
  { name: "Installed Props",    value: "8",     goal: "50",    on: false },
  { name: "Portal Uptime",      value: "99.9%", goal: "99.9%", on: true  },
];

const rockStatus: Record<string, { bg: string; text: string; dot: string }> = {
  "On Track":  { bg: "bg-emerald-50",   text: "text-emerald-700", dot: "bg-emerald-500"  },
  "At Risk":   { bg: "bg-amber-50",     text: "text-amber-700",   dot: "bg-amber-500"    },
  "Off Track": { bg: "bg-red-50",       text: "text-red-700",     dot: "bg-red-500"      },
  "Complete":  { bg: "bg-[#6B7EFF]/10", text: "text-[#6B7EFF]",  dot: "bg-[#6B7EFF]"   },
};

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
  let activeAccountsSub   = "— connecting";
  try {
    // Try with is_active column first (migration 017+)
    const { count, error } = await supabase
      .from("organizations")
      .select("*", { count: "exact", head: true })
      .neq("org_tier", "corporate")
      .eq("is_active", true);

    if (error) {
      // Fallback: just count all non-corporate
      const { count: fallbackCount } = await supabase
        .from("organizations")
        .select("*", { count: "exact", head: true })
        .neq("org_tier", "corporate");
      activeAccountsCount = fallbackCount ?? 0;
      activeAccountsSub   = `${activeAccountsCount} total orgs`;
    } else {
      activeAccountsCount = count ?? 0;
      activeAccountsSub   = `${activeAccountsCount} active org${activeAccountsCount !== 1 ? "s" : ""}`;
    }
  } catch (_) {
    activeAccountsSub = "— connecting";
  }

  // ── 2. Quote pipeline ──────────────────────────────────────────────────────
  let quoteCount    = 0;
  let quotePipeline = "—";
  let quoteSub      = "— connecting";
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
        n >= 1000
          ? `$${(n / 1000).toFixed(1)}k`
          : `$${n.toLocaleString()}`;
      quotePipeline = fmt(total);
      quoteSub      = `${quoteCount} open quote${quoteCount !== 1 ? "s" : ""}`;
    }
  } catch (_) {
    quoteSub = "— connecting";
  }

  // ── 3. Open Work Orders ────────────────────────────────────────────────────
  let openWOCount = 0;
  let openWOSub   = "— connecting";
  try {
    const { count, error } = await supabase
      .from("work_orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "in_progress", "scheduled"]);

    if (!error) {
      openWOCount = count ?? 0;
      openWOSub   = `${openWOCount} active job${openWOCount !== 1 ? "s" : ""}`;
    }
  } catch (_) {
    openWOSub = "— connecting";
  }

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
  } catch (_) {
    // fall through — liveAccounts stays empty, we'll show static fallback
  }

  // ── 5. Monthly MRR (paid invoices this calendar month) ───────────────────────
  let mrrValue = "—";
  let mrrSub   = "No paid invoices yet";
  try {
    const now   = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const { data: invData, error: invErr } = await supabase
      .from("invoices")
      .select("total, paid_at")
      .eq("status", "paid")
      .gte("paid_at", `${month}-01`)
      .lt("paid_at", `${month}-32`);
    if (!invErr && invData) {
      const mrr = invData.reduce((s, i) => s + (i.total ?? 0), 0);
      const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toLocaleString()}`;
      if (mrr > 0) {
        mrrValue = fmt(mrr);
        mrrSub   = `${invData.length} invoice${invData.length !== 1 ? "s" : ""} paid this month`;
      }
    }
  } catch (_) { /* non-critical */ }

  // ── 6. Open incidents count ────────────────────────────────────────────────
  let openIncidents    = 0;
  let incidentsSub     = "No open incidents";
  let incidentsLive    = false;
  try {
    const { count, error } = await supabase
      .from("incidents")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "investigating"]);
    if (!error) {
      openIncidents = count ?? 0;
      incidentsSub  = openIncidents > 0
        ? `${openIncidents} need attention`
        : "All clear";
      incidentsLive = true;
    }
  } catch (_) { /* non-critical */ }

  // If Supabase returned rows, use them; otherwise keep static fallback
  const staticAccounts = [
    { id: "s1",  name: "Angel Oak - Properties",   org_tier: "client",       created_at: "" },
    { id: "s2",  name: "Pegasus Properties",        org_tier: "client",       created_at: "" },
    { id: "s3",  name: "Stonegate Townhomes",        org_tier: "client",       created_at: "" },
    { id: "s4",  name: "3888 Peachtree",             org_tier: "client",       created_at: "" },
    { id: "s5",  name: "Elevate Eagles Landing",     org_tier: "client",       created_at: "" },
    { id: "s6",  name: "Elevate Greene",             org_tier: "client",       created_at: "" },
    { id: "s7",  name: "Midwood Gardens",            org_tier: "client",       created_at: "" },
    { id: "s8",  name: "Mitul Patel",                org_tier: "client",       created_at: "" },
    { id: "s9",  name: "Flint River",                org_tier: "client",       created_at: "" },
    { id: "s10", name: "Monitoring View",            org_tier: "client",       created_at: "" },
    { id: "s11", name: "Columbia Residential",       org_tier: "sales_partner",created_at: "" },
    { id: "s12", name: "Southeast Security Group",   org_tier: "master_dealer",created_at: "" },
  ];
  const accountRows = liveAccounts.length > 0 ? liveAccounts : staticAccounts;
  const isLiveAccounts = liveAccounts.length > 0;

  // ─────────────────────────────────────────────────────────────────────────────
  // Build KPI array — all live data or honest "—" placeholders, no demo badges
  const kpis = [
    {
      label: "Active Accounts",
      value: activeAccountsCount > 0 ? String(activeAccountsCount) : "—",
      sub:   activeAccountsSub,
      icon:  Users,
      color: "text-brand-400",
      bg:    "bg-brand-400/10",
    },
    {
      label: "Quote Pipeline",
      value: quotePipeline,
      sub:   quoteSub,
      icon:  TrendingUp,
      color: "text-brand-400",
      bg:    "bg-brand-400/10",
    },
    {
      label: "Open Work Orders",
      value: openWOCount > 0 ? String(openWOCount) : "—",
      sub:   openWOSub,
      icon:  Shield,
      color: "text-blue-400",
      bg:    "bg-blue-400/10",
    },
    {
      label: "Open Incidents",
      value: incidentsLive ? (openIncidents > 0 ? String(openIncidents) : "0") : "—",
      sub:   incidentsSub,
      icon:  AlertTriangle,
      color: openIncidents > 0 ? "text-red-400" : "text-emerald-400",
      bg:    openIncidents > 0 ? "bg-red-400/10" : "bg-emerald-400/10",
    },
    {
      label: "Cameras Online",
      value: "—",
      sub:   "Connect Eagle Eye to enable",
      icon:  Camera,
      color: "text-muted-foreground",
      bg:    "bg-muted/50",
    },
    {
      label: "Doors / Gates",
      value: "—",
      sub:   "Connect Brivo to enable",
      icon:  Shield,
      color: "text-muted-foreground",
      bg:    "bg-muted/50",
    },
    {
      label: "Monthly MRR",
      value: mrrValue,
      sub:   mrrSub,
      icon:  DollarSign,
      color: "text-emerald-400",
      bg:    "bg-emerald-400/10",
    },
    {
      label: "DTV Activations",
      value: "—",
      sub:   "Link DirecTV channel to enable",
      icon:  Radio,
      color: "text-muted-foreground",
      bg:    "bg-muted/50",
    },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Dashboard"
        subtitle="GateGuard Nexus — Gate Guard, LLC · System Operator"
      />
      <div className="flex-1 p-6 space-y-5">

        {/* AI Search */}
        <AISearch placeholder='Try "show accounts with offline cameras" · "recent forced entry events" · "MRR this month"' />

        {/* KPI Grid */}
        <div className="grid grid-cols-4 gap-3">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3 hover:border-brand-400/20 transition-colors">
                <div className={`p-2.5 rounded-lg shrink-0 ${k.bg}`}>
                  <Icon size={16} className={k.color} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-bold text-foreground leading-tight">{k.value}</p>
                  <p className="text-[11px] font-medium text-muted-foreground mt-0.5">{k.label}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{k.sub}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── EOS Heartbeat — Q2 pulse ──────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-[#6B7EFF]" />
              <span className="text-sm font-semibold text-foreground">Q2 2026 EOS Heartbeat</span>
              <span className="text-[10px] text-muted-foreground">· Due Jun 30</span>
            </div>
            <Link
              href="/eos"
              className="ml-auto flex items-center gap-1 text-xs text-[#6B7EFF] hover:text-[#5B6EEF] transition-colors font-medium"
            >
              Full EOS <ChevronRight size={12} />
            </Link>
          </div>
          <div className="px-5 py-4 grid grid-cols-2 gap-5">
            {/* Rocks */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Quarterly Rocks — {q2Rocks.filter(r => r.status === "On Track" || r.status === "Complete").length}/{q2Rocks.length} on track
              </p>
              <div className="flex flex-wrap gap-1.5">
                {q2Rocks.map(rock => {
                  const s = rockStatus[rock.status];
                  return (
                    <Link
                      key={rock.name}
                      href="/eos"
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors hover:opacity-80 ${s.bg} ${s.text} border-current/20`}
                      title={rock.name}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                      <span className="truncate max-w-[160px]">{rock.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            {/* Scorecard pulse */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Scorecard Pulse — week of May 19
              </p>
              <div className="space-y-2">
                {scorecardPulse.map(m => (
                  <div key={m.name} className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${m.on ? "bg-emerald-500" : "bg-red-400"}`} />
                    <span className="text-xs text-foreground flex-1 truncate">{m.name}</span>
                    <span className="text-xs font-semibold text-foreground">{m.value}</span>
                    <span className="text-[10px] text-muted-foreground w-12 text-right">goal: {m.goal}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <Link
                  href="/eos?tab=L10+Meeting"
                  className="text-[11px] text-[#6B7EFF] font-medium hover:underline flex items-center gap-1"
                >
                  Next L10: Fri May 23 at 6:00 AM <ChevronRight size={11} />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-3 gap-5">
          {/* Accounts table */}
          <div className="col-span-2 bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Network size={14} className="text-brand-400" />
                <span className="text-sm font-semibold text-foreground">All Accounts</span>
                <span className="text-[11px] text-muted-foreground">({accountRows.length} total)</span>
                {isLiveAccounts && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-400/10 text-emerald-500 font-medium uppercase tracking-wide">live</span>
                )}
              </div>
              <a href="/customers" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors">
                View All <ExternalLink size={11} />
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-background/20">
                    <th className="text-left px-5 py-2.5 text-muted-foreground font-medium">Account</th>
                    <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Tier</th>
                    <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Added</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {accountRows.map((a) => {
                    const tierLabel = TIER_LABEL[a.org_tier] ?? a.org_tier;
                    const tierCls   = TIER_COLOR[a.org_tier] ?? "bg-muted text-muted-foreground";
                    const addedStr  = a.created_at
                      ? new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "—";
                    const href = `/customers/${a.id}`;
                    return (
                      <tr key={a.id} className="border-b border-border/40 hover:bg-accent/20 transition-colors cursor-pointer group">
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0 status-online" />
                            <span className="font-medium text-foreground group-hover:text-brand-400 transition-colors">{a.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${tierCls}`}>{tierLabel}</span>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{addedStr}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a href={href} className="p-1 hover:bg-brand-400/10 rounded text-brand-400"><Eye size={12} /></a>
                            <button className="p-1 hover:bg-accent rounded text-muted-foreground"><Settings size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            {/* Notifications */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <AlertTriangle size={13} className="text-amber-400" />
                <span className="text-sm font-semibold text-foreground">Alerts</span>
                <span className="ml-auto text-[10px] text-muted-foreground">24 hrs</span>
              </div>
              <div className="p-3 space-y-2">
                {notifications.map((n, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-background/40 border border-border/40">
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                      n.type === "error"   ? "bg-red-400" :
                      n.type === "success" ? "bg-emerald-400" : "bg-amber-400"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-snug">{n.msg}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide">Quick Actions</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "New Quote",  icon: "📄", href: "/quotes"      },
                  { label: "Work Order", icon: "🔧", href: "/maintenance" },
                  { label: "Add Account",icon: "➕", href: "/customers"  },
                  { label: "View SOC",   icon: "📡", href: "/soc"        },
                ].map((a) => (
                  <a key={a.label} href={a.href}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border hover:border-brand-400/30 hover:bg-brand-400/5 transition-all text-center group">
                    <span className="text-xl">{a.icon}</span>
                    <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">{a.label}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Platform status */}
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide">Platform Status</p>
              {[
                { label: "EagleEye API",  status: "operational" },
                { label: "Brivo API",     status: "operational" },
                { label: "DirecTV ATLAS", status: "operational" },
                { label: "Supabase",      status: "operational" },
                { label: "Vercel Edge",   status: "operational" },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full status-online" /> {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
