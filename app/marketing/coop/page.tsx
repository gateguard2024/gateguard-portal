"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Download,
  Plus,
  Loader2,
  Users,
  TrendingUp,
  MapPin,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Edit2, ArrowUpRight, DollarSign, Target, BarChart3 } = require('lucide-react') as any;

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadStatus = "new" | "contacted" | "won" | "lost";
type LeadSource = "Google Ads" | "Meta Ads" | "Organic";
type PropertyType = "Multifamily" | "HOA" | "Commercial";

interface Lead {
  id: number;
  property: string;
  type: PropertyType;
  source: LeadSource;
  location: string;
  dealer: string | null;
  routedTime: string | null;
  routing: boolean;
  status: LeadStatus;
}

interface Dealer {
  name: string;
  monthly: string;
  ytd: string;
  leads: number;
  conversion: number;
  territory: string;
  barWidth: number;
}

interface Campaign {
  name: string;
  channel: string;
  budget: string;
  status: "active" | "paused";
  leads: number;
  cpl: string;
}

interface RoutingRule {
  title: string;
  detail: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const leads: Lead[] = [
  { id: 1,  property: "Peachtree Tower Apts", type: "Multifamily", source: "Google Ads", location: "Atlanta, GA",      dealer: null,                routedTime: null,    routing: true,  status: "new" },
  { id: 2,  property: "Maple Ridge HOA",       type: "HOA",         source: "Meta Ads",   location: "Alpharetta, GA",   dealer: "SecureATL",         routedTime: "5m ago",  routing: false, status: "new" },
  { id: 3,  property: "Northgate Plaza",       type: "Commercial",  source: "Google Ads", location: "Marietta, GA",     dealer: "Gate Masters LLC",  routedTime: "22m ago", routing: false, status: "contacted" },
  { id: 4,  property: "Sunrise Gardens",       type: "Multifamily", source: "Meta Ads",   location: "Smyrna, GA",       dealer: "SecureATL",         routedTime: "1h ago",  routing: false, status: "contacted" },
  { id: 5,  property: "Willow Creek HOA",      type: "HOA",         source: "Organic",    location: "Roswell, GA",      dealer: "Peach State Access",routedTime: "3h ago",  routing: false, status: "won" },
  { id: 6,  property: "Harbor View Apts",      type: "Multifamily", source: "Google Ads", location: "Decatur, GA",      dealer: "Premier Access",    routedTime: "1d ago",  routing: false, status: "contacted" },
  { id: 7,  property: "Lakewood Commons",      type: "HOA",         source: "Meta Ads",   location: "Kennesaw, GA",     dealer: "ClearView Security",routedTime: "1d ago",  routing: false, status: "new" },
  { id: 8,  property: "Riverside Plaza",       type: "Commercial",  source: "Google Ads", location: "Sandy Springs, GA",dealer: "Gate Masters LLC",  routedTime: "2d ago",  routing: false, status: "won" },
  { id: 9,  property: "Summit Ridge Apts",     type: "Multifamily", source: "Meta Ads",   location: "Duluth, GA",       dealer: "SecureATL",         routedTime: "3d ago",  routing: false, status: "lost" },
  { id: 10, property: "Cedar Park HOA",        type: "HOA",         source: "Organic",    location: "Cumming, GA",      dealer: "Peach State Access",routedTime: "4d ago",  routing: false, status: "won" },
];

const dealers: Dealer[] = [
  { name: "SecureATL",          monthly: "$800/mo", ytd: "$9,600", leads: 18, conversion: 33, territory: "Atlanta Metro",     barWidth: 100 },
  { name: "Gate Masters LLC",   monthly: "$600/mo", ytd: "$7,200", leads: 13, conversion: 23, territory: "North Atlanta",     barWidth: 75 },
  { name: "Peach State Access", monthly: "$500/mo", ytd: "$6,000", leads: 10, conversion: 40, territory: "Alpharetta/Roswell",barWidth: 62 },
  { name: "ClearView Security", monthly: "$400/mo", ytd: "$4,800", leads: 8,  conversion: 25, territory: "East Atlanta",      barWidth: 50 },
  { name: "Premier Access",     monthly: "$200/mo", ytd: "$2,400", leads: 4,  conversion: 25, territory: "South Atlanta",     barWidth: 25 },
  { name: "Southeast Security", monthly: "$150/mo", ytd: "$1,400", leads: 2,  conversion: 0,  territory: "Columbus, GA",      barWidth: 19 },
];

const campaigns: Campaign[] = [
  { name: "Atlanta Spring 2026",  channel: "Google Ads",   budget: "$1,200/mo", status: "active", leads: 28, cpl: "$43" },
  { name: "Metro Multifamily",    channel: "Meta Ads",     budget: "$800/mo",   status: "active", leads: 14, cpl: "$57" },
  { name: "HOA Decision Makers",  channel: "LinkedIn Ads", budget: "$600/mo",   status: "paused", leads: 5,  cpl: "$120" },
];

const routingRules: RoutingRule[] = [
  { title: "Distance-first routing",    detail: "Nearest dealer within 15 miles gets first right of refusal — 24h window" },
  { title: "Contribution weighting",    detail: "Higher contributors get priority on unmatched leads" },
  { title: "Capacity cap",              detail: "Max 10 active leads per dealer at once to ensure follow-up quality" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusConfig: Record<LeadStatus, { label: string; className: string; dot: string }> = {
  new:       { label: "New",       className: "bg-blue-50 text-blue-700 border border-blue-200",     dot: "bg-blue-500 animate-pulse" },
  contacted: { label: "Contacted", className: "bg-amber-50 text-amber-700 border border-amber-200",  dot: "bg-amber-500" },
  won:       { label: "Won",       className: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
  lost:      { label: "Lost",      className: "bg-red-50 text-red-600 border border-red-200",        dot: "bg-red-500" },
};

const typeConfig: Record<PropertyType, string> = {
  Multifamily: "bg-violet-50 text-violet-700",
  HOA:         "bg-sky-50 text-sky-700",
  Commercial:  "bg-orange-50 text-orange-700",
};

const sourceConfig: Record<LeadSource, string> = {
  "Google Ads": "text-blue-600",
  "Meta Ads":   "text-indigo-600",
  "Organic":    "text-emerald-600",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)] p-5 flex items-start gap-4">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: iconBg }}
      >
        <span style={{ color: iconColor }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide leading-none mb-1">
          {label}
        </p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  const sc = statusConfig[lead.status];
  const tc = typeConfig[lead.type];
  const srcColor = sourceConfig[lead.source];

  return (
    <div className="py-3 px-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white hover:border-gray-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-150 cursor-pointer">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-gray-900 truncate">{lead.property}</span>
          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0", tc)}>
            {lead.type}
          </span>
        </div>
        <span className={cn("flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0", sc.className)}>
          <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", sc.dot)} />
          {sc.label}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span className={cn("font-medium", srcColor)}>{lead.source}</span>
        <span className="flex items-center gap-0.5">
          <MapPin size={10} className="text-gray-400" />
          {lead.location}
        </span>
      </div>
      <div className="flex items-center gap-1.5 mt-1.5 text-xs">
        {lead.routing ? (
          <span className="flex items-center gap-1 text-blue-600 font-medium">
            <Loader2 size={11} className="animate-spin" />
            Routing...
          </span>
        ) : (
          <>
            <span className="text-gray-500 truncate">{lead.dealer}</span>
            <span className="text-gray-300">·</span>
            <span className="text-gray-400 flex-shrink-0">{lead.routedTime}</span>
          </>
        )}
      </div>
    </div>
  );
}

function DealerTable() {
  const maxYtdRaw = 9600;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide pb-2 pr-3">Dealer</th>
              <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wide pb-2 px-2">Monthly</th>
              <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wide pb-2 px-2">YTD</th>
              <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wide pb-2 px-2">Leads</th>
              <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wide pb-2 px-2">Conv</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide pb-2 pl-3">Territory</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {dealers.map((d) => (
              <tr key={d.name} className="hover:bg-gray-50 transition-colors duration-100">
                <td className="py-2.5 pr-3 font-medium text-gray-800 whitespace-nowrap">{d.name}</td>
                <td className="py-2.5 px-2 text-right text-gray-600 whitespace-nowrap">{d.monthly}</td>
                <td className="py-2.5 px-2 text-right text-gray-600 whitespace-nowrap">{d.ytd}</td>
                <td className="py-2.5 px-2 text-right text-gray-700 font-medium">{d.leads}</td>
                <td className="py-2.5 px-2 text-right">
                  <span className={cn(
                    "text-xs font-semibold px-1.5 py-0.5 rounded-md",
                    d.conversion >= 30 ? "bg-emerald-50 text-emerald-700"
                    : d.conversion >= 20 ? "bg-blue-50 text-blue-700"
                    : d.conversion === 0 ? "bg-gray-100 text-gray-500"
                    : "bg-amber-50 text-amber-700"
                  )}>
                    {d.conversion}%
                  </span>
                </td>
                <td className="py-2.5 pl-3 text-gray-500 text-xs whitespace-nowrap">{d.territory}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Contribution Bar Chart */}
      <div className="mt-5 space-y-2">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Relative Contributions</p>
        {dealers.map((d) => {
          const ytdNum = parseInt(d.ytd.replace(/[^0-9]/g, ""), 10);
          const pct = Math.round((ytdNum / maxYtdRaw) * 100);
          return (
            <div key={d.name} className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-36 flex-shrink-0 truncate">{d.name}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#2563EB] transition-all duration-500"
                  style={{ width: `${pct}%`, opacity: 0.5 + pct / 200 }}
                />
              </div>
              <span className="text-xs font-medium text-gray-600 w-14 text-right flex-shrink-0">{d.ytd}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoopPage() {
  const [_activeTab, setActiveTab] = useState<"all" | LeadStatus>("all");

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
              <span>Marketing</span>
              <ChevronRight size={12} />
              <span className="text-gray-600 font-medium">Co-Op</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Co-Op Lead Pool</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Pooled advertising drives qualified leads to your dealer network.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors duration-150 shadow-sm">
              <Download size={14} />
              Export Report
            </button>
            <button className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors duration-150 shadow-sm">
              <Plus size={14} />
              Run Campaign
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard label="Pool Balance"        value="$4,200"  sub="Available to allocate" icon={<DollarSign size={18} />} iconBg="#ECFDF5" iconColor="#059669" />
          <KpiCard label="Leads This Month"    value="47"      sub="+12 vs last month"     icon={<TrendingUp size={18} />} iconBg="#EFF6FF" iconColor="#2563EB" />
          <KpiCard label="Avg Cost Per Lead"   value="$89"     sub="Down from $104"        icon={<BarChart3 size={18} />}  iconBg="#FFFBEB" iconColor="#D97706" />
          <KpiCard label="Conversion Rate"     value="24%"     sub="Of routed leads"       icon={<Target size={18} />}    iconBg="#F0FDFA" iconColor="#0D9488" />
          <KpiCard label="Total Contributed YTD" value="$31,400" sub="Across 6 dealers"   icon={<Users size={18} />}     iconBg="#F5F3FF" iconColor="#7C3AED" />
        </div>

        {/* 3-column layout */}
        <div className="grid grid-cols-1 xl:grid-cols-[40%_35%_25%] gap-5 items-start">

          {/* Column 1 — Lead Feed */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-900">Incoming Leads</h2>
                <span className="flex items-center gap-1.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </div>
              <span className="text-xs text-gray-400 font-medium">{leads.length} leads</span>
            </div>
            <div className="p-3 space-y-2 max-h-[640px] overflow-y-auto">
              {leads.map((lead) => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
            </div>
          </div>

          {/* Column 2 — Dealer Contributions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Dealer Contributions</h2>
              <button className="flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors duration-150">
                <Plus size={12} />
                Add Dealer
              </button>
            </div>
            <div className="p-5">
              <DealerTable />
            </div>
          </div>

          {/* Column 3 — Active Campaigns + Routing Rules */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Active Campaigns</h2>
              </div>
              <div className="p-4 space-y-3">
                {campaigns.map((c) => (
                  <div
                    key={c.name}
                    className="rounded-xl border border-gray-100 bg-gray-50 p-4 hover:border-gray-200 hover:bg-white hover:shadow-[0_2px_6px_rgba(0,0,0,0.05)] transition-all duration-150"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 leading-tight">{c.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{c.channel}</p>
                      </div>
                      <span className={cn(
                        "text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 mt-0.5",
                        c.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {c.status === "active" ? "Active" : "Paused"}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium leading-none">Budget</p>
                        <p className="text-xs font-semibold text-gray-700 mt-0.5">{c.budget}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium leading-none">Leads</p>
                        <p className="text-xs font-semibold text-gray-700 mt-0.5">{c.leads}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium leading-none">CPL</p>
                        <p className="text-xs font-semibold text-gray-700 mt-0.5">{c.cpl}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Routing Rules */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Routing Rules</h2>
                <button className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-[#2563EB] hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors duration-150">
                  <Edit2 size={11} />
                  Edit Rules
                </button>
              </div>
              <div className="p-4 space-y-3">
                {routingRules.map((rule, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[9px] font-bold text-blue-600">{i + 1}</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{rule.title}</p>
                      <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{rule.detail}</p>
                    </div>
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
