'use client';

import { useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import {
  DollarSign, Building2, Wrench, Camera, Clock, TrendingUp,
  CheckCircle2, AlertTriangle, XCircle, Download, BarChart3,
} from "lucide-react";

const orgTiers = ["ALL ORGS", "MSO", "DEALER", "PARTNER", "CLIENT"] as const;
type OrgTier = typeof orgTiers[number];

const mrrMonths = [
  { month: "Jan", value: 28 },
  { month: "Feb", value: 29.5 },
  { month: "Mar", value: 31 },
  { month: "Apr", value: 32 },
  { month: "May", value: 34 },
  { month: "Jun", value: 33.5 },
  { month: "Jul", value: 35 },
  { month: "Aug", value: 36 },
  { month: "Sep", value: 37 },
  { month: "Oct", value: 37.5 },
  { month: "Nov", value: 38 },
  { month: "Dec", value: 38.4 },
];
const maxMrr = Math.max(...mrrMonths.map((m) => m.value));

type HealthStatus = "Healthy" | "Attention" | "At Risk";

const orgRows: {
  name: string;
  tier: string;
  props: number;
  mrr: string;
  ytd: string;
  wos: number;
  uptime: string;
  health: HealthStatus;
}[] = [
  { name: "Southeast Security Group", tier: "MSO",     props: 8, mrr: "$12,400", ytd: "$148,800", wos: 18, uptime: "98.1%", health: "Healthy"   },
  { name: "Columbia Residential",     tier: "Partner", props: 5, mrr: "$7,200",  ytd: "$86,400",  wos: 9,  uptime: "97.4%", health: "Healthy"   },
  { name: "Angel Oak Properties",     tier: "Client",  props: 4, mrr: "$6,800",  ytd: "$81,600",  wos: 8,  uptime: "96.2%", health: "Healthy"   },
  { name: "Pegasus Properties",       tier: "Client",  props: 3, mrr: "$4,900",  ytd: "$58,800",  wos: 5,  uptime: "99.1%", health: "Healthy"   },
  { name: "Stonegate Townhomes",      tier: "Client",  props: 2, mrr: "$2,800",  ytd: "$33,600",  wos: 4,  uptime: "94.3%", health: "Attention" },
  { name: "3888 Peachtree",           tier: "Client",  props: 2, mrr: "$2,400",  ytd: "$28,800",  wos: 2,  uptime: "97.8%", health: "Healthy"   },
  { name: "Midwood Gardens",          tier: "Client",  props: 1, mrr: "$900",    ytd: "$10,800",  wos: 1,  uptime: "91.0%", health: "At Risk"   },
  { name: "Flint River",              tier: "Client",  props: 1, mrr: "$0",      ytd: "$0",       wos: 0,  uptime: "0%",    health: "At Risk"   },
];

const healthBadge: Record<HealthStatus, string> = {
  "Healthy":   "bg-emerald-500/10 text-emerald-400",
  "Attention": "bg-amber-500/10 text-amber-400",
  "At Risk":   "bg-red-500/10 text-red-400",
};

const tierColor: Record<string, string> = {
  MSO:     "bg-violet-400/10 text-violet-400",
  Partner: "bg-emerald-400/10 text-emerald-400",
  Client:  "bg-amber-400/10 text-amber-400",
  Dealer:  "bg-brand-400/10 text-brand-400",
};

export default function ReportsPage() {
  const [activeTier, setActiveTier] = useState<OrgTier>("ALL ORGS");

  const filteredRows =
    activeTier === "ALL ORGS"
      ? orgRows
      : orgRows.filter((r) => r.tier.toUpperCase() === activeTier);

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Reports"
        subtitle="Multi-site roll-up analytics across all properties and org tiers"
      />
      <div className="flex-1 p-6 space-y-5">

        {/* AI Search + Download */}
        <div className="flex items-center gap-3">
          <AISearch
            placeholder='Try "MRR trend last 6 months" or "properties at risk"'
            className="flex-1"
          />
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border hover:border-brand-400/40 text-sm font-medium text-foreground transition-colors">
            <Download size={15} className="text-brand-400" /> Download Report
          </button>
        </div>

        {/* Org Tier Selector */}
        <div className="flex items-center gap-2">
          {orgTiers.map((tier) => (
            <button
              key={tier}
              onClick={() => setActiveTier(tier)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                activeTier === tier
                  ? "bg-brand-400/10 text-brand-400 border-brand-400/30"
                  : "border-border text-muted-foreground hover:border-brand-400/20 hover:text-foreground"
              }`}
            >
              {tier}
            </button>
          ))}
        </div>

        {/* KPI Row 1 */}
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Total MRR",
              value: "$38,400",
              sub: "+4.1% vs last month",
              icon: DollarSign,
              color: "text-brand-400",
              bg: "bg-brand-400/10",
            },
            {
              label: "Total Properties",
              value: "31",
              sub: "Across all org tiers",
              icon: Building2,
              color: "text-violet-400",
              bg: "bg-violet-400/10",
            },
            {
              label: "Work Orders MTD",
              value: "47",
              sub: "Month to date",
              icon: Wrench,
              color: "text-amber-400",
              bg: "bg-amber-400/10",
            },
          ].map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${k.bg}`}>
                  <Icon size={16} className={k.color} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{k.value}</p>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{k.sub}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* KPI Row 2 */}
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Camera Uptime",
              value: "96.8%",
              sub: "Portfolio average",
              icon: Camera,
              color: "text-emerald-400",
              bg: "bg-emerald-400/10",
            },
            {
              label: "Avg Response Time",
              value: "2.4 hrs",
              sub: "Work order average",
              icon: Clock,
              color: "text-blue-400",
              bg: "bg-blue-400/10",
            },
            {
              label: "Net Revenue Retention",
              value: "94.5%",
              sub: "Trailing 12 months",
              icon: TrendingUp,
              color: "text-brand-400",
              bg: "bg-brand-400/10",
            },
          ].map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${k.bg}`}>
                  <Icon size={16} className={k.color} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{k.value}</p>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{k.sub}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Properties by Health */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <BarChart3 size={15} className="text-brand-400" />
            Properties by Health
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border border-emerald-500/20 rounded-xl p-5 flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-emerald-500/10">
                <CheckCircle2 size={18} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-emerald-400">24</p>
                <p className="text-sm font-medium text-foreground mt-0.5">Healthy</p>
                <p className="text-xs text-muted-foreground mt-1">All systems nominal</p>
              </div>
            </div>
            <div className="bg-card border border-amber-500/20 rounded-xl p-5 flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-amber-500/10">
                <AlertTriangle size={18} className="text-amber-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-amber-400">5</p>
                <p className="text-sm font-medium text-foreground mt-0.5">Needs Attention</p>
                <p className="text-xs text-muted-foreground mt-1">Service overdue or open WO</p>
              </div>
            </div>
            <div className="bg-card border border-red-500/20 rounded-xl p-5 flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-red-500/10">
                <XCircle size={18} className="text-red-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-red-400">2</p>
                <p className="text-sm font-medium text-foreground mt-0.5">At Risk</p>
                <p className="text-xs text-muted-foreground mt-1">Device offline or expired permit</p>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue by Org Tier Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
            <DollarSign size={15} className="text-brand-400" />
            <h2 className="text-sm font-semibold text-foreground">Revenue by Org Tier</h2>
            <span className="text-xs text-muted-foreground ml-1">({filteredRows.length} orgs)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-background/30">
                  {["Org Name", "Tier", "Properties", "Monthly MRR", "YTD Revenue", "WOs This Month", "Camera Uptime", "Health"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-muted-foreground font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.name} className="border-b border-border/50 hover:bg-accent/20 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{row.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${tierColor[row.tier] || "bg-muted text-muted-foreground"}`}>
                        {row.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-center">{row.props}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{row.mrr}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.ytd}</td>
                    <td className="px-4 py-3 text-muted-foreground text-center">{row.wos}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.uptime}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${healthBadge[row.health]}`}>
                        {row.health}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* MRR Trend Bar Chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={15} className="text-brand-400" />
            <h2 className="text-sm font-semibold text-foreground">MRR Trend — Last 12 Months</h2>
            <span className="text-xs text-muted-foreground ml-1">(in $K)</span>
          </div>
          <div className="flex items-end gap-2 h-40">
            {mrrMonths.map((m) => {
              const heightPct = (m.value / maxMrr) * 100;
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <span className="text-[10px] text-brand-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    ${m.value}k
                  </span>
                  <div className="w-full flex items-end justify-center" style={{ height: "120px" }}>
                    <div
                      className="w-full rounded-t-md bg-brand-400 hover:bg-brand-300 transition-colors cursor-default"
                      style={{ height: `${heightPct}%`, minHeight: "4px" }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{m.month}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <span className="text-xs text-muted-foreground">Jan 2025</span>
            <span className="text-xs font-semibold text-emerald-400">+37% YoY growth</span>
            <span className="text-xs text-muted-foreground">Dec 2025</span>
          </div>
        </div>

      </div>
    </div>
  );
}
