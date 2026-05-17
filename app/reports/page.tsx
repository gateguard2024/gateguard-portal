'use client';

import { useState, useEffect } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import {
  Building2, Wrench, CheckCircle2, AlertTriangle, XCircle, Download, TrendingUp, Loader2,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DollarSign, Camera, Clock, BarChart3 } = require('lucide-react') as any;

const orgTiers = ["ALL ORGS", "CORPORATE", "MASTER_AGENT", "MASTER_DEALER", "FULL_DEALER", "SERVICE_DEALER", "CLIENT"] as const;
type OrgTier = typeof orgTiers[number];

interface Summary {
  total_sites:         number;
  total_wos_month:     number;
  open_wos:            number;
  completed_wos_month: number;
}

interface OrgRow {
  org_id:     string;
  name:       string;
  tier:       string;
  tier_label: string;
  site_count: number;
  wo_count:   number;
  open_wos:   number;
}

const tierColor: Record<string, string> = {
  corporate:          "bg-brand-400/10 text-brand-400",
  master_agent:       "bg-violet-400/10 text-violet-400",
  master_dealer:      "bg-sky-400/10 text-sky-400",
  full_dealer:        "bg-emerald-400/10 text-emerald-400",
  service_dealer:     "bg-teal-400/10 text-teal-400",
  install_contractor: "bg-orange-400/10 text-orange-400",
  sales_partner:      "bg-pink-400/10 text-pink-400",
  client:             "bg-amber-400/10 text-amber-400",
};

export default function ReportsPage() {
  const [activeTier, setActiveTier] = useState<OrgTier>("ALL ORGS");
  const [summary, setSummary]       = useState<Summary | null>(null);
  const [orgRows, setOrgRows]       = useState<OrgRow[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    fetch('/api/reports')
      .then(r => r.json())
      .then(data => {
        setSummary(data.summary ?? null)
        setOrgRows(data.orgs ?? [])
      })
      .catch(err => console.error('[reports] fetch error:', err))
      .finally(() => setLoading(false))
  }, [])

  const filteredRows = activeTier === "ALL ORGS"
    ? orgRows
    : orgRows.filter(r => r.tier.toUpperCase() === activeTier.replace(' ', '_'));

  const activeSites   = summary?.total_sites ?? 0;
  const wosMtd        = summary?.total_wos_month ?? 0;
  const openWos       = summary?.open_wos ?? 0;
  const completedMtd  = summary?.completed_wos_month ?? 0;

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <TopBar title="Reports" subtitle="Multi-site roll-up analytics across all properties and org tiers" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-brand-400" />
        </div>
      </div>
    )
  }

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
            placeholder='Try "WOs this month" or "properties by tier"'
            className="flex-1"
          />
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border hover:border-brand-400/40 text-sm font-medium text-foreground transition-colors">
            <Download size={15} className="text-brand-400" /> Download Report
          </button>
        </div>

        {/* Org Tier Selector */}
        <div className="flex items-center flex-wrap gap-2">
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
              label: "Total Properties",
              value: String(activeSites),
              sub:   "All installed sites",
              icon:  Building2,
              color: "text-violet-400",
              bg:    "bg-violet-400/10",
            },
            {
              label: "Work Orders MTD",
              value: String(wosMtd),
              sub:   "Month to date",
              icon:  Wrench,
              color: "text-amber-400",
              bg:    "bg-amber-400/10",
            },
            {
              label: "Completed MTD",
              value: String(completedMtd),
              sub:   "Resolved this month",
              icon:  CheckCircle2,
              color: "text-emerald-400",
              bg:    "bg-emerald-400/10",
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
              label: "Open Work Orders",
              value: String(openWos),
              sub:   "Across all sites",
              icon:  AlertTriangle,
              color: "text-amber-400",
              bg:    "bg-amber-400/10",
            },
            {
              label: "Total Orgs",
              value: String(orgRows.length),
              sub:   "Dealer network",
              icon:  DollarSign,
              color: "text-brand-400",
              bg:    "bg-brand-400/10",
            },
            {
              label: "Network Growth",
              value: `+${orgRows.length}`,
              sub:   "Active organizations",
              icon:  TrendingUp,
              color: "text-brand-400",
              bg:    "bg-brand-400/10",
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

        {/* WO Status Breakdown */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <BarChart3 size={15} className="text-brand-400" />
            Work Orders This Month
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border border-emerald-500/20 rounded-xl p-5 flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-emerald-500/10">
                <CheckCircle2 size={18} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-emerald-400">{completedMtd}</p>
                <p className="text-sm font-medium text-foreground mt-0.5">Completed</p>
                <p className="text-xs text-muted-foreground mt-1">Resolved this period</p>
              </div>
            </div>
            <div className="bg-card border border-amber-500/20 rounded-xl p-5 flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-amber-500/10">
                <AlertTriangle size={18} className="text-amber-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-amber-400">{openWos}</p>
                <p className="text-sm font-medium text-foreground mt-0.5">Open</p>
                <p className="text-xs text-muted-foreground mt-1">Across all sites</p>
              </div>
            </div>
            <div className="bg-card border border-brand-400/20 rounded-xl p-5 flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-brand-400/10">
                <Wrench size={18} className="text-brand-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-brand-400">{wosMtd}</p>
                <p className="text-sm font-medium text-foreground mt-0.5">Total MTD</p>
                <p className="text-xs text-muted-foreground mt-1">Month to date</p>
              </div>
            </div>
          </div>
        </div>

        {/* Org Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
            <BarChart3 size={15} className="text-brand-400" />
            <h2 className="text-sm font-semibold text-foreground">Organizations</h2>
            <span className="text-xs text-muted-foreground ml-1">({filteredRows.length} orgs)</span>
          </div>
          {filteredRows.length === 0 ? (
            <div className="px-5 py-8 text-center text-muted-foreground text-sm">
              No organizations found for this tier.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-background/30">
                    {["Org Name", "Tier", "Properties", "Work Orders", "Open WOs"].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-muted-foreground font-medium whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.org_id} className="border-b border-border/50 hover:bg-accent/20 transition-colors cursor-pointer">
                      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{row.name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${tierColor[row.tier] ?? "bg-muted text-muted-foreground"}`}>
                          {row.tier_label || row.tier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-center">{row.site_count}</td>
                      <td className="px-4 py-3 text-muted-foreground text-center">{row.wo_count}</td>
                      <td className="px-4 py-3 text-center">
                        {row.open_wos > 0 ? (
                          <span className="text-amber-400 font-medium">{row.open_wos}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
