"use client";

import { useState } from "react";
import {
  Check, ChevronRight, CreditCard, TrendingUp,
  Users, Package, Zap, Settings, AlertTriangle, Plus,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { BadgeCheck, Edit2, BarChart3, Sparkles, Crown } = require("lucide-react") as any;

// ─── Types ────────────────────────────────────────────────────────────────────

interface PricingTier {
  id: "foundation" | "professional" | "enterprise";
  name: string;
  price: number;
  seats: string;
  description: string;
  features: string[];
  popular?: boolean;
  current?: boolean;
}

interface AddOn {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  active: boolean;
  icon: React.ElementType;
  iconColor: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const TIERS: PricingTier[] = [
  {
    id: "foundation",
    name: "Foundation",
    price: 199,
    seats: "Up to 5 users",
    description: "Everything a dealer needs to run field service and quoting.",
    features: [
      "Tech Tool (/tech) — AI diagnostic assistant",
      "Work orders + dispatch + scheduling",
      "Quote builder + client approval page",
      "Knowledge base + PDF manual library",
      "Customer accounts + contact management",
      "1 location / office",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    price: 449,
    seats: "Up to 15 users",
    description: "Full dealer OS — replaces your CRM, field service, and quoting tools.",
    popular: true,
    current: true,
    features: [
      "Everything in Foundation",
      "Full CRM pipeline with AI lead scoring",
      "NEXUS AI assistant on every page",
      "Training platform + dealer certifications",
      "Billing engine + Stripe payment links",
      "The Feed gamification + team challenges",
      "EOS operating system (Rocks, L10, Scorecard)",
      "Advanced analytics + reports",
      "1 location / office",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 899,
    seats: "Unlimited users",
    description: "Full AI army, multi-location, and white label for MSOs.",
    features: [
      "Everything in Professional",
      "ARIA — AI lead research + outreach",
      "TRINITY — voice AI inbound + outbound",
      "Multi-location (up to 10 branches)",
      "White label option (your brand)",
      "API access + webhooks",
      "Dealer network hub + sub-dealer mgmt",
      "Priority support + dedicated onboarding",
    ],
  },
];

const ADD_ONS: AddOn[] = [
  {
    id: "aria",
    name: "ARIA Deep Intel",
    description: "AI-powered lead research, property scoring, and outreach campaign generation.",
    price: 149,
    unit: "/mo",
    active: true,
    icon: Zap,
    iconColor: "text-[#6B7EFF]",
  },
  {
    id: "trinity",
    name: "TRINITY Voice AI",
    description: "Inbound + outbound voice AI with real-time sentiment scoring and transcripts.",
    price: 99,
    unit: "/mo",
    active: true,
    icon: Settings,
    iconColor: "text-teal-600",
  },
  {
    id: "client_portal",
    name: "Client Portals",
    description: "Property manager dashboards — one per installed property, branded to you.",
    price: 49,
    unit: "/property/mo",
    active: false,
    icon: Users,
    iconColor: "text-purple-600",
  },
  {
    id: "extra_location",
    name: "Additional Location",
    description: "Add a second branch, market, or office to your account.",
    price: 149,
    unit: "/location/mo",
    active: false,
    icon: Package,
    iconColor: "text-amber-600",
  },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const [selectedTier, setSelectedTier] = useState<"foundation" | "professional" | "enterprise">("professional");
  const [addOns, setAddOns]             = useState(ADD_ONS);
  const [saved, setSaved]               = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);

  const tier     = TIERS.find(t => t.id === selectedTier)!;
  const addOnMRR = addOns.filter(a => a.active).reduce((sum, a) => sum + a.price, 0);
  const totalMRR = tier.price + addOnMRR;

  function toggleAddOn(id: string) {
    setAddOns(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setChangingPlan(false);
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <CreditCard size={20} className="text-[#6B7EFF]" />
              Subscription
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage your Nexus plan and add-ons
            </p>
          </div>
          {saved && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
              <Check size={14} /> Changes saved
            </div>
          )}
        </div>

        {/* ── Current plan summary ── */}
        <div className="bg-white border border-border rounded-xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#6B7EFF]/10 border border-[#6B7EFF]/20 flex items-center justify-center">
                <Crown size={20} className="text-[#6B7EFF]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-foreground">Professional Plan</span>
                  <span className="text-xs bg-[#6B7EFF]/10 text-[#6B7EFF] border border-[#6B7EFF]/20 rounded-full px-2 py-0.5 font-medium">Active</span>
                </div>
                <p className="text-sm text-muted-foreground">Next billing date: July 1, 2026 · Up to 15 users</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-semibold text-foreground">${totalMRR}<span className="text-sm text-muted-foreground font-normal">/mo</span></div>
                <div className="text-xs text-muted-foreground">Base ${tier.price} + Add-ons ${addOnMRR}</div>
              </div>
              <button
                onClick={() => setChangingPlan(!changingPlan)}
                className="text-sm font-medium border border-border rounded-lg px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <Edit2 size={14} /> Change plan
              </button>
            </div>
          </div>
        </div>

        {/* ── Plan selector (only shown when changing) ── */}
        {changingPlan && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Select a plan</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TIERS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTier(t.id)}
                  className={`text-left rounded-xl border p-4 transition-all ${
                    selectedTier === t.id
                      ? "border-[#6B7EFF] ring-2 ring-[#6B7EFF]/20 bg-[#6B7EFF]/5"
                      : "border-border bg-white hover:border-[#6B7EFF]/40"
                  }`}
                >
                  {t.popular && (
                    <span className="inline-block text-[10px] font-semibold bg-[#6B7EFF] text-white rounded-full px-2 py-0.5 mb-2">
                      Most popular
                    </span>
                  )}
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-xl font-semibold text-foreground">${t.price}</span>
                    <span className="text-xs text-muted-foreground">/mo</span>
                  </div>
                  <div className="text-sm font-medium text-foreground mb-1">{t.name}</div>
                  <div className="text-xs text-muted-foreground mb-3">{t.seats}</div>
                  <div className="space-y-1.5">
                    {t.features.slice(0, 4).map(f => (
                      <div key={f} className="flex items-start gap-2">
                        <Check size={11} className="text-[#6B7EFF] flex-shrink-0 mt-0.5" />
                        <span className="text-xs text-muted-foreground leading-tight">{f}</span>
                      </div>
                    ))}
                    {t.features.length > 4 && (
                      <div className="text-xs text-[#6B7EFF]">+{t.features.length - 4} more features</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Add-ons ── */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Add-ons</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {addOns.map(addon => {
              const AIcon = addon.icon;
              return (
                <div
                  key={addon.id}
                  className={`bg-white border rounded-xl p-4 flex items-start gap-4 transition-colors ${
                    addon.active ? "border-[#6B7EFF]/30 bg-[#6B7EFF]/5" : "border-border"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0`}>
                    <AIcon size={16} className={addon.iconColor} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm font-medium text-foreground">{addon.name}</span>
                      <span className="text-sm font-semibold text-foreground flex-shrink-0">${addon.price}<span className="text-xs text-muted-foreground font-normal">{addon.unit}</span></span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{addon.description}</p>
                  </div>
                  <button
                    onClick={() => toggleAddOn(addon.id)}
                    className={`flex-shrink-0 w-10 h-6 rounded-full transition-colors relative ${addon.active ? "bg-[#6B7EFF]" : "bg-slate-200"}`}
                    role="switch"
                    aria-checked={addon.active}
                    aria-label={`Toggle ${addon.name}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${addon.active ? "left-4" : "left-0.5"}`} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── One-time services ── */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Professional services</h2>
          <div className="bg-white border border-border rounded-xl divide-y divide-border">
            {[
              { name: "White Glove Onboarding", desc: "Custom data migration, 3-session training, live setup support", price: "$1,500" },
              { name: "SARA Bridge Migration", desc: "Import all your SARA Plus data — customers, WOs, quotes, commissions", price: "$999" },
              { name: "Custom Integrations", desc: "Connect any third-party API to Nexus — quoted per project", price: "Custom" },
            ].map(s => (
              <div key={s.name} className="flex items-center justify-between gap-4 p-4">
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.desc}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">{s.price}</span>
                  <button className="text-xs text-[#6B7EFF] hover:underline border border-[#6B7EFF]/30 rounded-lg px-3 py-1.5 flex items-center gap-1">
                    Request <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Invoice summary & CTA ── */}
        <div className="bg-white border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Monthly summary</h2>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Professional plan</span>
              <span className="text-foreground font-medium">${tier.price}/mo</span>
            </div>
            {addOns.filter(a => a.active).map(a => (
              <div key={a.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{a.name}</span>
                <span className="text-foreground font-medium">${a.price}{a.unit}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 flex justify-between text-sm font-semibold">
              <span className="text-foreground">Total</span>
              <span className="text-foreground">${totalMRR}/mo</span>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 text-sm font-medium text-white bg-[#6B7EFF] hover:bg-[#5a6ee8] rounded-lg px-5 py-2 transition-colors"
            >
              <Check size={14} /> Save changes
            </button>
            <button className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5">
              <CreditCard size={14} /> Update payment method
            </button>
            <button className="text-sm text-muted-foreground hover:text-red-500 ml-auto flex items-center gap-1.5">
              <AlertTriangle size={14} /> Cancel subscription
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
