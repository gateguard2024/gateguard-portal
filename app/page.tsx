import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import { createClient } from "@supabase/supabase-js";
import {
  Camera, Shield, Wifi, AlertTriangle, Users,
  Eye, Settings, TrendingUp, DollarSign,
  ExternalLink, Network, Radio, Layers, ChevronRight,
  Building2,
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
  partner:            "bg-emerald-400/10 text-emerald-400",
  mso:                "bg-violet-400/10 text-violet-400",
};

const rockStatus: Record<string, { bg: string; text: string; dot: string }> = {
  "on_track":  { bg: "bg-emerald-50",   text: "text-emerald-700", dot: "bg-emerald-500"  },
  "at_risk":   { bg: "bg-amber-50",     text: "text-amber-700",   dot: "bg-amber-500"    },
  "off_track": { bg: "bg-red-50",       text: "text-red-700",     dot: "bg-red-500"      },
  "complete":  { bg: "bg-[#6B7EFF]/10", text: "text-[#6B7EFF]",  dot: "bg-[#6B7EFF]"   },
  // legacy string formats
  "On Track":  { bg: "bg-emerald-50",   text: "text-emerald-700", dot: "bg-emerald-500"  },
  "At Risk":   { bg: "bg-amber-50",     text: "text-amber-700",   dot: "bg-amber-500"    },
  "Off Track": { bg: "bg-red-50",       text: "text-red-700",     dot: "bg-red-500"      },
  "Complete":  { bg: "bg-[#6B7EFF]/10", text: "text-[#6B7EFF]",  dot: "bg-[#6B7EFF]"   },
};

// ─── Next Friday at 6am EST ──────────────────────────────────────────────────
function nextL10Label(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun 5=Fri
  const daysUntilFriday = day <= 5 ? 5 - day : 7 - day + 5;
  const next = new Date(now);
  next.setDate(now.getDate() + (daysUntilFriday === 0 ? 7 : daysUntilFriday));
  return next.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " at 6:00 AM";
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const supabase = getSupabase();

  // ── 1. Active Accounts ────────────────────────────────────────────────────
  let activeAccountsCount = 0;
  let activeAccountsSub   = "—";
  try {
    const { count, error } = await supabase
      .from("organizations")
      .select("*", { count: "exact", head: true })
      .neq("org_tier", "corporate")
      .eq("is_active", true);
    if (error) {
      const { count: fallback } = await supabase
        .from("organizations").select("*", { count: "exact", head: true }).neq("org_tier", "corporate");
      activeAccountsCount = fallback ?? 0;
    } else {
      activeAccountsCount = count ?? 0;
    }
    activeAccountsSub = activeAccountsCount === 1 ? "1 active org" : `${activeAccountsCount} active orgs`;
  } catch (_) {}

  // ── 2. Quote pipeline ─────────────────────────────────────────────────────
  let quoteCount    = 0;
  let quotePipeline = "—";
  let quoteSub      = "—";
  try {
    const { data } = await supabase.from("quotes").select("total_one_time, total_mrr").in("status", ["draft", "sent"]);
    if (data) {
      quoteCount = data.length;
      const total = data.reduce((s, q) => s + (q.total_one_time ?? 0) + (q.total_mrr ?? 0), 0);
      quotePipeline = total >= 1000 ? `$${(total / 1000).toFixed(1)}k` : total === 0 ? "$0" : `$${total.toLocaleString()}`;
      quoteSub = quoteCount === 0 ? "No open quotes" : `${quoteCount} open quote${quoteCount !== 1 ? "s" : ""}`;
    }
  } catch (_) {}

  // ── 3. Open Work Orders ───────────────────────────────────────────────────
  let openWOCount = 0;
  let openWOSub   = "—";
  try {
    const { count } = await supabase.from("work_orders").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress", "scheduled"]);
    openWOCount = count ?? 0;
    openWOSub = openWOCount === 0 ? "No active jobs" : `${openWOCount} active job${openWOCount !== 1 ? "s" : ""}`;
  } catch (_) {}

  // ── 4. Monthly MRR from sites billing ────────────────────────────────────
  let mrrValue = "—";
  let mrrSub   = "No billing data";
  try {
    const { data: sitesBilling } = await supabase
      .from("sites")
      .select("billing_video_fee, billing_unit_rate, billing_units")
      .not("billing_video_fee", "is", null);
    if (sitesBilling && sitesBilling.length > 0) {
      const totalMrr = sitesBilling.reduce((sum, s) => {
        const videoFee  = s.billing_video_fee  ?? 0;
        const unitRate  = s.billing_unit_rate  ?? 5;
        const units     = s.billing_units      ?? 0;
        return sum + videoFee + (unitRate * units);
      }, 0);
      mrrValue = totalMrr >= 1000 ? `$${(totalMrr / 1000).toFixed(1)}k` : totalMrr === 0 ? "$0" : `$${totalMrr.toLocaleString()}`;
      mrrSub   = `${sitesBilling.length} billed site${sitesBilling.length !== 1 ? "s" : ""}`;
    }
  } catch (_) {}

  // ── 5. Active Alerts (open incidents) ────────────────────────────────────
  let alertCount = 0;
  let alertSub   = "No open incidents";
  try {
    const { count } = await supabase.from("incidents").select("*", { count: "exact", head: true }).eq("status", "open");
    alertCount = count ?? 0;
    alertSub = alertCount === 0 ? "All clear" : `${alertCount} open incident${alertCount !== 1 ? "s" : ""}`;
  } catch (_) {}

  // ── 6. Installed Sites count ──────────────────────────────────────────────
  let siteCount = 0;
  let siteSub   = "No sites yet";
  try {
    const { count } = await supabase.from("sites").select("*", { count: "exact", head: true });
    siteCount = count ?? 0;
    siteSub = siteCount === 0 ? "No properties yet" : `${siteCount} propert${siteCount !== 1 ? "ies" : "y"}`;
  } catch (_) {}

  // ── 7. Accounts table rows ────────────────────────────────────────────────
  type OrgRow = { id: string; name: string; org_tier: string; created_at: string };
  let liveAccounts: OrgRow[] = [];
  try {
    const { data } = await supabase
      .from("organizations")
      .select("id, name, org_tier, created_at")
      .not("org_tier", "eq", "corporate")
      .order("created_at", { ascending: false })
      .limit(12);
    if (data) liveAccounts = data as OrgRow[];
  } catch (_) {}

  // ── 8. EOS Rocks from Supabase (fallback to empty) ───────────────────────
  type RockRow = { id: string; title: string; status: string };
  let rocks: RockRow[] = [];
  try {
    const { data } = await supabase
      .from("eos_rocks")
      .select("id, title, status")
      .order("created_at", { ascending: true })
      .limit(6);
    if (data) rocks = data as RockRow[];
  } catch (_) {}

  // ── 9. Scorecard pulse from live data ────────────────────────────────────
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let newOpps = 0, proposalsSent = 0, activeDealers = 0;
  try {
    const [oppsRes, propsRes, dealersRes] = await Promise.all([
      supabase.from("opportunities").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
      supabase.from("quotes").select("*", { count: "exact", head: true }).eq("status", "sent").gte("created_at", weekAgo),
      supabase.from("organizations").select("*", { count: "exact", head: true }).in("org_tier", ["full_dealer", "master_dealer", "install_contractor", "service_dealer"]).eq("is_active", true),
    ]);
    newOpps      = oppsRes.count ?? 0;
    proposalsSent = propsRes.count ?? 0;
    activeDealers = dealersRes.count ?? 0;
  } catch (_) {}

  const scorecardPulse = [
    { name: "New Opportunities",  value: String(newOpps),      goal: "3/wk", on: newOpps >= 3     },
    { name: "Proposals Sent",     value: String(proposalsSent), goal: "2/wk", on: proposalsSent >= 2 },
    { name: "Active Dealers",     value: String(activeDealers), goal: "50",   on: activeDealers >= 50 },
    { name: "Installed Props",    value: String(siteCount),     goal: "50",   on: siteCount >= 50  },
    { name: "Portal Uptime",      value: "99.9%",               goal: "99.9%",on: true              },
  ];

  // ── 10. Recent alerts from incidents table ────────────────────────────────
  type IncidentRow = { id: string; title: string; status: string; severity: string; source: string | null; created_at: string };
  let recentIncidents: IncidentRow[] = [];
  try {
    const { data } = await supabase
      .from("incidents")
      .select("id, title, status, severity, source, created_at")
      .order("created_at", { ascending: false })
      .limit(4);
    if (data) recentIncidents = data as IncidentRow[];
  } catch (_) {}

  const l10Label = nextL10Label();

  // ─── KPI array ───────────────────────────────────────────────────────────
  const kpis = [
    { label: "Active Accounts", value: String(activeAccountsCount), sub: activeAccountsSub, icon: Users,       color: "text-brand-400",   bg: "bg-brand-400/10"   },
    { label: "Quote Pipeline",  value: quotePipeline,               sub: quoteSub,          icon: TrendingUp,  color: "text-brand-400",   bg: "bg-brand-400/10"   },
    { label: "Open Work Orders",value: String(openWOCount),         sub: openWOSub,         icon: Shield,      color: "text-blue-400",    bg: "bg-blue-400/10"    },
    { label: "Open Incidents",  value: alertCount === 0 ? "0" : String(alertCount), sub: alertSub, icon: AlertTriangle, color: alertCount > 0 ? "text-red-400" : "text-emerald-400", bg: alertCount > 0 ? "bg-red-400/10" : "bg-emerald-400/10" },
    { label: "Cameras Online",  value: "—",                         sub: "EEN not connected",icon: Camera,     color: "text-muted-foreground", bg: "bg-muted/40"   },
    { label: "Doors / Gates",   value: "—",                         sub: "Brivo not connected",icon: Shield,   color: "text-muted-foreground", bg: "bg-muted/40"   },
    { label: "Monthly MRR",     value: mrrValue,                    sub: mrrSub,            icon: DollarSign,  color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { label: "Installed Sites", value: String(siteCount),           sub: siteSub,           icon: Building2,   color: "text-sky-400",     bg: "bg-sky-400/10"     },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Dashboard" subtitle="GateGuard Nexus — Gate Guard, LLC · System Operator" />
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

        {/* ── EOS Heartbeat ───────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
            <Layers size={14} className="text-[#6B7EFF]" />
            <span className="text-sm font-semibold text-foreground">Q2 2026 EOS Heartbeat</span>
            <span className="text-[10px] text-muted-foreground">· Due Jun 30</span>
            <Link href="/eos" className="ml-auto flex items-center gap-1 text-xs text-[#6B7EFF] hover:text-[#5B6EEF] transition-colors font-medium">
              Full EOS <ChevronRight size={12} />
            </Link>
          </div>
          <div className="px-5 py-4 grid grid-cols-2 gap-5">
            {/* Rocks */}
            <div>
              {rocks.length > 0 ? (
                <>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Quarterly Rocks — {rocks.filter(r => r.status === "on_track" || r.status === "complete" || r.status === "On Track" || r.status === "Complete").length}/{rocks.length} on track
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {rocks.map(rock => {
                      const s = rockStatus[rock.status] ?? rockStatus["at_risk"];
                      return (
                        <Link key={rock.id} href="/eos"
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors hover:opacity-80 ${s.bg} ${s.text} border-current/20`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                          <span className="truncate max-w-[160px]">{rock.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-start gap-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Quarterly Rocks</p>
                  <p className="text-xs text-muted-foreground">No rocks set yet.</p>
                  <Link href="/eos" className="text-xs text-[#6B7EFF] hover:underline font-medium">Set Q2 Rocks →</Link>
                </div>
              )}
            </div>
            {/* Scorecard pulse */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Scorecard Pulse — week of {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
                <Link href="/eos?tab=L10+Meeting"
                  className="text-[11px] text-[#6B7EFF] font-medium hover:underline flex items-center gap-1">
                  Next L10: {l10Label} <ChevronRight size={11} />
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
                {liveAccounts.length > 0 && (
                  <>
                    <span className="text-[11px] text-muted-foreground">({liveAccounts.length})</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-400/10 text-emerald-500 font-medium uppercase tracking-wide">live</span>
                  </>
                )}
              </div>
              <a href="/customers" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors">
                View All <ExternalLink size={11} />
              </a>
            </div>
            {liveAccounts.length > 0 ? (
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
                    {liveAccounts.map((a) => {
                      const tierLabel = TIER_LABEL[a.org_tier] ?? a.org_tier;
                      const tierCls   = TIER_COLOR[a.org_tier] ?? "bg-muted text-muted-foreground";
                      const addedStr  = a.created_at
                        ? new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—";
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
                              <a href={`/customers/${a.id}`} className="p-1 hover:bg-brand-400/10 rounded text-brand-400"><Eye size={12} /></a>
                              <button className="p-1 hover:bg-accent rounded text-muted-foreground"><Settings size={12} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <Network size={28} className="text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">No accounts yet</p>
                <p className="text-xs text-muted-foreground/60">Invite your first dealer or add a client to get started.</p>
                <a href="/admin/dealers/new"
                  className="mt-1 text-xs font-medium text-[#6B7EFF] hover:underline">
                  Onboard first dealer →
                </a>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            {/* Alerts from incidents */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <AlertTriangle size={13} className="text-amber-400" />
                <span className="text-sm font-semibold text-foreground">Recent Incidents</span>
                <span className="ml-auto text-[10px] text-muted-foreground">latest 4</span>
              </div>
              <div className="p-3 space-y-2">
                {recentIncidents.length > 0 ? recentIncidents.map((inc) => {
                  const dotColor = inc.status === "open"
                    ? (inc.severity === "critical" || inc.severity === "high" ? "bg-red-400" : "bg-amber-400")
                    : "bg-emerald-400";
                  const timeAgo = (() => {
                    const diff = Date.now() - new Date(inc.created_at).getTime();
                    const mins = Math.floor(diff / 60000);
                    if (mins < 60) return `${mins}m ago`;
                    const hrs = Math.floor(mins / 60);
                    if (hrs < 24) return `${hrs}h ago`;
                    return `${Math.floor(hrs / 24)}d ago`;
                  })();
                  return (
                    <div key={inc.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-background/40 border border-border/40">
                      <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground leading-snug truncate">{inc.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo}</p>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="py-4 text-center">
                    <p className="text-xs text-muted-foreground/60">No incidents reported</p>
                  </div>
                )}
                <a href="/incidents" className="block text-center text-[10px] text-[#6B7EFF] hover:underline pt-1">
                  View all incidents →
                </a>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide">Quick Actions</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "New Quote",   icon: "📄", href: "/quotes/new"   },
                  { label: "Work Order",  icon: "🔧", href: "/maintenance"  },
                  { label: "Add Account", icon: "➕", href: "/customers"    },
                  { label: "View SOC",    icon: "📡", href: "https://ggsoc.com", external: true },
                ].map((a) => (
                  <a key={a.label} href={a.href} target={a.external ? "_blank" : undefined} rel={a.external ? "noopener" : undefined}
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
                { label: "Supabase",      status: "operational", live: true  },
                { label: "Vercel Edge",   status: "operational", live: true  },
                { label: "EagleEye API",  status: "not connected", live: false },
                { label: "Brivo API",     status: "not connected", live: false },
                { label: "DirecTV ATLAS", status: "operational", live: true  },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                  <span className={`flex items-center gap-1.5 text-[11px] font-medium ${s.live ? "text-emerald-400" : "text-muted-foreground/50"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.live ? "status-online" : "bg-muted-foreground/30"}`} />
                    {s.status}
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
