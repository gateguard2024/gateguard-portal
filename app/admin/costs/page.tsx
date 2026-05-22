"use client";

/**
 * /admin/costs — GateGuard infrastructure cost dashboard (internal only)
 *
 * Two panels:
 *   1. GateGuard view — backend costs (Supabase, Claude, Vercel, Twilio, Tavily, etc.)
 *      broken down per dealer per month + gross margin per tier
 *
 *   2. Dealer P&L view — for each dealer: client MRR − rep commissions − GG subscription = net
 */

import { useState } from "react";
import {
  TrendingUp, Users, CreditCard, Settings, ChevronRight,
  AlertTriangle, Check, Activity, Server,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { BarChart3, DollarSign, Zap, Database, Globe, MessageSquare, Cpu, ShieldCheck, ArrowUpRight, ArrowDownRight } = require("lucide-react") as any;

// ─── Types ────────────────────────────────────────────────────────────────────

type View = "gg" | "dealer";

interface CostLine {
  name: string;
  icon: React.ElementType;
  iconColor: string;
  costPerDealer: number;   // $ per dealer per month (Professional tier)
  notes: string;
  warning?: boolean;
}

interface TierEcon {
  tier: string;
  price: number;
  dealers: number;
  costPerDealer: number;
  margin: number;
  marginPct: number;
  color: string;
}

interface DealerPL {
  name: string;
  org: string;
  tier: string;
  tierColor: string;
  clientMRR: number;       // Revenue dealer collects from their properties
  ggSubscription: number;  // What they pay GateGuard
  repCommissions: number;  // Rep payouts
  netMargin: number;       // clientMRR - ggSubscription - repCommissions
  properties: number;
  trend: "up" | "down" | "flat";
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const INFRA_COSTS: CostLine[] = [
  {
    name: "Anthropic Claude (Haiku)",
    icon: Cpu,
    iconColor: "text-[#6B7EFF]",
    costPerDealer: 2.63,
    notes: "~50 diagnostic sessions + 100 NEXUS messages + survey proposals/mo. Haiku pricing: $0.80/MTok in · $4/MTok out.",
  },
  {
    name: "Supabase (database + storage)",
    icon: Database,
    iconColor: "text-emerald-600",
    costPerDealer: 0.63,
    notes: "Pro plan $25/mo shared across 40 dealers. Scales to Team ($599) at ~200+ dealers. Storage: 100GB included.",
  },
  {
    name: "Vercel (compute + CDN)",
    icon: Globe,
    iconColor: "text-slate-600",
    costPerDealer: 0.50,
    notes: "Pro plan $20/mo. Unlimited serverless functions. 1TB bandwidth/mo included. Cost per dealer drops at scale.",
  },
  {
    name: "OpenAI (KB embeddings)",
    icon: Cpu,
    iconColor: "text-teal-600",
    costPerDealer: 0.01,
    notes: "text-embedding-3-small at $0.02/MTok. One-time cost per manual upload (~$0.005 per PDF). Negligible ongoing.",
  },
  {
    name: "Tavily (ARIA search)",
    icon: Zap,
    iconColor: "text-amber-600",
    costPerDealer: 0.64,
    notes: "ARIA add-on only. $0.008/search × 4 searches/run × 20 runs/mo. Revenue: $149/mo add-on → very profitable.",
  },
  {
    name: "Twilio (TRINITY voice)",
    icon: MessageSquare,
    iconColor: "text-teal-600",
    costPerDealer: 2.10,
    notes: "TRINITY add-on only. ~100 min/mo × $0.0085/min + $0.05/min transcription. Revenue: $99/mo add-on.",
  },
  {
    name: "Resend (transactional email)",
    icon: MessageSquare,
    iconColor: "text-purple-600",
    costPerDealer: 0.05,
    notes: "~50 emails/dealer/mo. Free tier covers first 3K/mo. Pro plan $20/mo triggers at ~40 dealers.",
  },
  {
    name: "Mapbox (territory maps)",
    icon: Globe,
    iconColor: "text-blue-600",
    costPerDealer: 0.10,
    notes: "Free tier: 50K map loads/mo. 40 dealers × ~10 map loads = 400/mo — well within free. Pro at ~500 dealers.",
  },
  {
    name: "Stripe processing",
    icon: CreditCard,
    iconColor: "text-violet-600",
    costPerDealer: 13.02,
    notes: "2.9% + $0.30 per credit card charge. ⚠ ACH is 0.8% capped at $5 → saves ~$8/dealer/mo. Encourage ACH.",
    warning: true,
  },
];

const TIER_ECONOMICS: TierEcon[] = [
  {
    tier: "Foundation",
    price: 199,
    dealers: 10,
    costPerDealer: 8.47,
    margin: 190.53,
    marginPct: 95.7,
    color: "bg-slate-100 text-slate-700",
  },
  {
    tier: "Professional",
    price: 449,
    dealers: 25,
    costPerDealer: 16.84,
    margin: 432.16,
    marginPct: 96.3,
    color: "bg-blue-100 text-blue-700",
  },
  {
    tier: "Enterprise",
    price: 899,
    dealers: 5,
    costPerDealer: 31.26,
    margin: 867.74,
    marginPct: 96.5,
    color: "bg-purple-100 text-purple-700",
  },
];

// All costs on credit card. ACH savings: ~$8/dealer/mo (Stripe 0.8% capped $5 vs 2.9%+$0.30)
const TOTAL_INFRA_PER_DEALER_PRO = INFRA_COSTS.reduce((s, c) => s + c.costPerDealer, 0);
const TOTAL_MRR = TIER_ECONOMICS.reduce((s, t) => s + t.price * t.dealers, 0);
const TOTAL_COST = TIER_ECONOMICS.reduce((s, t) => s + t.costPerDealer * t.dealers, 0);
const TOTAL_MARGIN = TOTAL_MRR - TOTAL_COST;

const DEALER_PL: DealerPL[] = [
  {
    name: "Marcus Webb", org: "GateForce Miami", tier: "Enterprise", tierColor: "bg-purple-100 text-purple-700",
    clientMRR: 18400, ggSubscription: 899, repCommissions: 1840, netMargin: 15661, properties: 100, trend: "up",
  },
  {
    name: "Danny Cruz", org: "SoCal Gate Pros", tier: "Professional", tierColor: "bg-blue-100 text-blue-700",
    clientMRR: 7200, ggSubscription: 449, repCommissions: 720, netMargin: 6031, properties: 36, trend: "up",
  },
  {
    name: "Sarah K.", org: "Pacific Access Co.", tier: "Professional", tierColor: "bg-blue-100 text-blue-700",
    clientMRR: 4800, ggSubscription: 449, repCommissions: 480, netMargin: 3871, properties: 22, trend: "flat",
  },
  {
    name: "James R.", org: "Coastal Gate Sys.", tier: "Foundation", tierColor: "bg-slate-100 text-slate-700",
    clientMRR: 1600, ggSubscription: 199, repCommissions: 160, netMargin: 1241, properties: 8, trend: "up",
  },
  {
    name: "Tamara S.", org: "Sunbelt Access LLC", tier: "Foundation", tierColor: "bg-slate-100 text-slate-700",
    clientMRR: 1200, ggSubscription: 199, repCommissions: 120, netMargin: 881, properties: 5, trend: "down",
  },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CostDashboardPage() {
  const [view, setView] = useState<View>("gg");

  const totalDealers    = TIER_ECONOMICS.reduce((s, t) => s + t.dealers, 0);
  const overallMarginPct = Math.round((TOTAL_MARGIN / TOTAL_MRR) * 100);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <DollarSign size={20} className="text-[#6B7EFF]" />
              Cost Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Infrastructure costs, gross margin, and dealer P&amp;L
            </p>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-white border border-border rounded-lg p-1">
            <button
              onClick={() => setView("gg")}
              className={`text-sm font-medium px-4 py-1.5 rounded-md transition-colors ${view === "gg" ? "bg-[#6B7EFF] text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              GateGuard costs
            </button>
            <button
              onClick={() => setView("dealer")}
              className={`text-sm font-medium px-4 py-1.5 rounded-md transition-colors ${view === "dealer" ? "bg-[#6B7EFF] text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              Dealer P&amp;L
            </button>
          </div>
        </div>

        {/* ═══ GATEGUARD VIEW ═══ */}
        {view === "gg" && (
          <div className="space-y-6">

            {/* Summary KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total MRR",        value: `$${TOTAL_MRR.toLocaleString()}`,    sub: "all tiers",         color: "text-[#6B7EFF]"   },
                { label: "Total infra cost", value: `$${Math.round(TOTAL_COST).toLocaleString()}`, sub: "per month", color: "text-red-500"    },
                { label: "Gross margin",     value: `$${Math.round(TOTAL_MARGIN).toLocaleString()}`, sub: `${overallMarginPct}% margin`, color: "text-emerald-600" },
                { label: "Active dealers",   value: totalDealers.toString(),             sub: "across 3 tiers",    color: "text-foreground"  },
              ].map(kpi => (
                <div key={kpi.label} className="bg-white border border-border rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
                  <p className={`text-2xl font-semibold ${kpi.color}`}>{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* Per-tier unit economics */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3">Unit economics by tier</h2>
              <div className="bg-white border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Tier</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Price</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Dealers</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Cost / dealer</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Margin / dealer</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Margin %</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Tier MRR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TIER_ECONOMICS.map((t, i) => (
                      <tr key={t.tier} className={i < TIER_ECONOMICS.length - 1 ? "border-b border-border" : ""}>
                        <td className="px-4 py-3">
                          <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded-full ${t.color}`}>{t.tier}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-foreground">${t.price}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{t.dealers}</td>
                        <td className="px-4 py-3 text-right text-red-500 font-medium">${t.costPerDealer.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-medium">${t.margin.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-mono text-xs font-bold text-emerald-600">{t.marginPct}%</span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">${(t.price * t.dealers).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-slate-50">
                      <td className="px-4 py-3 text-xs font-semibold text-muted-foreground" colSpan={6}>Total</td>
                      <td className="px-4 py-3 text-right font-bold text-[#6B7EFF]">${TOTAL_MRR.toLocaleString()}/mo</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Infrastructure line items */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3">Infrastructure cost breakdown (Professional tier baseline)</h2>
              <div className="bg-white border border-border rounded-xl overflow-hidden">
                {INFRA_COSTS.map((cost, i) => {
                  const CIcon = cost.icon
                  return (
                    <div key={cost.name} className={`flex items-start gap-4 p-4 ${i < INFRA_COSTS.length - 1 ? "border-b border-border" : ""}`}>
                      <div className={`w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <CIcon size={16} className={cost.iconColor} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-foreground">{cost.name}</span>
                          {cost.warning && (
                            <span className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                              <AlertTriangle size={10} /> optimize
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{cost.notes}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className={`text-base font-semibold ${cost.warning ? "text-amber-600" : "text-foreground"}`}>
                          ${cost.costPerDealer.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">per dealer/mo</div>
                      </div>
                    </div>
                  )
                })}
                <div className="flex items-center justify-between p-4 bg-slate-50 border-t-2 border-border">
                  <span className="text-sm font-semibold text-foreground">Total infra (credit card)</span>
                  <div className="text-right">
                    <span className="text-base font-bold text-red-500">${TOTAL_INFRA_PER_DEALER_PRO.toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground ml-1">/ dealer / mo</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-emerald-50 border-t border-emerald-200">
                  <span className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                    <Check size={14} /> Total infra (ACH preferred) — saves ~$8/dealer/mo
                  </span>
                  <div className="text-right">
                    <span className="text-base font-bold text-emerald-700">~$8.50</span>
                    <span className="text-xs text-emerald-600 ml-1">/ dealer / mo</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cost alert: encourage ACH */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Stripe processing is your largest variable cost</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Credit card charges cost 2.9% + $0.30. Switching dealers to ACH bank transfer drops this to 0.8% (capped at $5.00) — saving <strong>$8.02/dealer/mo</strong> on Professional tier.
                  At 40 dealers that's <strong>$320/mo saved</strong>. Make ACH the default on your billing page.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* ═══ DEALER P&L VIEW ═══ */}
        {view === "dealer" && (
          <div className="space-y-6">

            {/* Explanation */}
            <div className="bg-[#6B7EFF]/5 border border-[#6B7EFF]/20 rounded-xl p-4">
              <p className="text-sm text-foreground font-medium mb-1">What this shows</p>
              <p className="text-sm text-muted-foreground">
                Each dealer's <strong>client MRR</strong> (what they bill their properties) minus their <strong>GateGuard subscription</strong> and <strong>rep commissions</strong>.
                This is their take-home margin — and it&apos;s the number that sells the platform.
              </p>
            </div>

            {/* Dealer P&L table */}
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-slate-50">
                <h2 className="text-sm font-semibold text-foreground">Dealer P&amp;L — all dealers</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Dealer</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Props</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Client MRR</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">GG sub</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Rep commissions</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Net margin</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {DEALER_PL.map((d, i) => {
                    const marginPct = Math.round((d.netMargin / d.clientMRR) * 100)
                    return (
                      <tr key={d.name} className={i < DEALER_PL.length - 1 ? "border-b border-border hover:bg-slate-50" : "hover:bg-slate-50"}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-medium text-foreground">{d.name}</div>
                              <div className="text-xs text-muted-foreground">{d.org}</div>
                            </div>
                            <span className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${d.tierColor}`}>{d.tier}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{d.properties}</td>
                        <td className="px-4 py-3 text-right font-medium text-foreground">${d.clientMRR.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-red-500">−${d.ggSubscription.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-amber-600">−${d.repCommissions.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {d.trend === "up"   && <ArrowUpRight   size={12} className="text-emerald-500" />}
                            {d.trend === "down" && <ArrowDownRight  size={12} className="text-red-400" />}
                            <span className="font-semibold text-emerald-600">${d.netMargin.toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-mono text-xs font-bold text-emerald-600">{marginPct}%</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-slate-50">
                    <td className="px-4 py-3 text-xs font-semibold text-muted-foreground" colSpan={2}>Total</td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">${DEALER_PL.reduce((s, d) => s + d.clientMRR, 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-500">−${DEALER_PL.reduce((s, d) => s + d.ggSubscription, 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-amber-600">−${DEALER_PL.reduce((s, d) => s + d.repCommissions, 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">${DEALER_PL.reduce((s, d) => s + d.netMargin, 0).toLocaleString()}</td>
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Key insight */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
              <ArrowUpRight size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-800">The pitch is in these numbers</p>
                <p className="text-sm text-emerald-700 mt-0.5">
                  GateForce Miami at 100 properties earns <strong>$15,661/mo net</strong> after paying GateGuard $899.
                  Their GateGuard subscription costs them less than <strong>0.5% of what it generates for them</strong>.
                  This is the ROI story that sells the platform.
                </p>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
