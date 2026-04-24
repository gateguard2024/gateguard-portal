"use client";

import { useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Settings, Zap, Users, Bell, Palette, DollarSign,
  Edit2, Check, XCircle, ChevronDown, ChevronRight,
} from "lucide-react";
import { PRICING } from "@/types/quote";

// ── Inline-editable price cell ─────────────────────────────────────────────
function PriceCell({
  value,
  onChange,
  prefix = "$",
  suffix = "",
}: {
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  function commit() {
    const n = parseFloat(draft);
    if (!isNaN(n) && n >= 0) onChange(n);
    else setDraft(String(value));
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">{prefix}</span>
        <input
          autoFocus
          type="number"
          min="0"
          step="0.01"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(String(value)); setEditing(false); } }}
          className="w-20 px-2 py-0.5 rounded border border-brand-400/50 bg-background text-sm text-foreground outline-none focus:border-brand-400 text-right"
        />
        <span className="text-xs text-muted-foreground">{suffix}</span>
        <button onClick={commit} className="text-emerald-400 hover:text-emerald-300 ml-1"><Check size={12} /></button>
        <button onClick={() => { setDraft(String(value)); setEditing(false); }} className="text-red-400 hover:text-red-300"><XCircle size={12} /></button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      className="group flex items-center gap-1.5 text-sm text-foreground hover:text-brand-400 transition-colors"
    >
      <span>{prefix}{value.toLocaleString()}{suffix}</span>
      <Edit2 size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />
    </button>
  );
}

// ── Simple labelled row ────────────────────────────────────────────────────
function PriceRow({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
      <div>
        <span className="text-sm text-foreground">{label}</span>
        {note && <span className="ml-2 text-[11px] text-muted-foreground/70">{note}</span>}
      </div>
      <div className="flex items-center gap-6">{children}</div>
    </div>
  );
}

function ColHeader({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] text-muted-foreground font-medium w-20 text-right">{children}</span>;
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
      <Icon size={15} className="text-brand-400 shrink-0" />
      <div>
        <h2 className="text-sm font-semibold leading-none">{title}</h2>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Collapsible pricing card ───────────────────────────────────────────────
function PricingCard({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 bg-card/50 hover:bg-card transition-colors"
      >
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {open ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
      </button>
      {open && <div className="px-5 py-1 bg-card">{children}</div>}
    </div>
  );
}

// ── Integration + team data ────────────────────────────────────────────────
const integrations = [
  { name: "EagleEye Networks", desc: "Camera management & live video", status: "connected", lastSync: "2 min ago",  icon: "📷" },
  { name: "Brivo",             desc: "Access control & events",        status: "connected", lastSync: "5 min ago",  icon: "🔑" },
  { name: "QuickBooks",        desc: "Billing & invoicing",            status: "pending",   lastSync: "Not set up", icon: "💳" },
  { name: "Twilio",            desc: "SMS alerts & 2FA",               status: "pending",   lastSync: "Not set up", icon: "💬" },
];

const team = [
  { name: "Russel Feldman", email: "rfeldman@gateguard.co", role: "dealer_admin", status: "active" },
  { name: "James Torres",   email: "jtorres@gateguard.co",  role: "dealer_staff", status: "active" },
  { name: "Maria Larson",   email: "mlarson@gateguard.co",  role: "dealer_staff", status: "active" },
];

// ── Mutable pricing types ──────────────────────────────────────────────────
type WNPair   = { working: number; nonWorking: number };
type Monthly  = { perUnit: number; minimum: number; dealerOverrideMax: number };
type T1State  = { residentGate: WNPair; guestGate: WNPair; primaryDoor: WNPair; secondaryDoor: WNPair; callbox: number };
type T2State  = { accessPoint: WNPair; callbox: number };
type NetState = { router: number; switch4port: number; switch8port: number; switch16port: number; radioSmall: number; radioMedium: number; radioLarge: number; enclosure: number };
type CamState = { newMonitoredIncludedSetup: number; newMonitoredIncludedMonthly: number; newMonitoredBillableSetup: number; newMonitoredBillableMonthly: number; newStandaloneSetup: number; existingMonitoredSetup: number; existingMonitoredMonthly: number; existingStandaloneSetup: number; lprSetup: number; lprMonthly: number };
type AddOnState  = { gateMaintenancePerGate: number };
type ContractState = { months: number; depositPercent: number; goLivePercent: number };

// ── Main page ──────────────────────────────────────────────────────────────
export default function SettingsPage() {
  // ── Pricing state (mirrors PRICING constants; TODO: persist to Supabase) ─
  const [monthly,  setMonthly]  = useState<Monthly>({ ...PRICING.monthly });
  const [t1, setT1] = useState<T1State>({
    residentGate:   { ...PRICING.tier1.residentGate   },
    guestGate:      { ...PRICING.tier1.guestGate      },
    primaryDoor:    { ...PRICING.tier1.primaryDoor    },
    secondaryDoor:  { ...PRICING.tier1.secondaryDoor  },
    callbox:        PRICING.tier1.callbox,
  });
  const [t2, setT2] = useState<T2State>({
    accessPoint:    { ...PRICING.tier2.accessPoint    },
    callbox:        PRICING.tier2.callbox,
  });
  const [network,  setNetwork]  = useState<NetState>({ ...PRICING.network });
  const [cameras,  setCameras]  = useState<CamState>({ ...PRICING.cameras });
  const [addOns,   setAddOns]   = useState<AddOnState>({ ...PRICING.addOns });
  const [contract, setContract] = useState<ContractState>({ ...PRICING.contract });

  const [saved, setSaved] = useState(false);
  function handleSave() {
    // TODO: persist to Supabase
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Settings" subtitle="Pricing, Integrations, Team & Notifications" />
      <div className="flex-1 p-6 space-y-6">

        {/* ── PRICING CONFIGURATION ──────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* TODO: Wrap this entire Pricing Configuration block in a top-level collapsible accordion so it doesn't dominate the settings page. The SectionHeader should act as the toggle — collapsed by default, expands to reveal all PricingCards. Same pattern as PricingCard but at the section level. */}
          <SectionHeader icon={DollarSign} title="Pricing Configuration" subtitle="Click any price to edit. Changes apply to all new quotes." />
          <div className="p-5 space-y-4">

            {/* Monthly Service */}
            <PricingCard title="Monthly Service Fee">
              <PriceRow label="Per Unit / Month">
                <PriceCell value={monthly.perUnit} onChange={v => setMonthly(p => ({ ...p, perUnit: v }))} />
              </PriceRow>
              <PriceRow label="Monthly Minimum">
                <PriceCell value={monthly.minimum} onChange={v => setMonthly(p => ({ ...p, minimum: v }))} />
              </PriceRow>
              <PriceRow label="Dealer Override Cap" note="per unit/mo">
                <PriceCell value={monthly.dealerOverrideMax} onChange={v => setMonthly(p => ({ ...p, dealerOverrideMax: v }))} />
              </PriceRow>
            </PricingCard>

            {/* Tier 1 — Mobile Pass */}
            <PricingCard title="Access Control — Tier 1 (Mobile Pass)">
              <div className="flex justify-end gap-6 pb-1 pt-1">
                <ColHeader>Working</ColHeader>
                <ColHeader>Non-Working</ColHeader>
              </div>
              {[
                { label: "Resident Vehicle Gate — Reader",         key: "residentGate"  },
                { label: "Guest Vehicle Gate — App-Only Controller", key: "guestGate"    },
                { label: "Primary Common Door — Controller + Reader", key: "primaryDoor" },
                { label: "Secondary Common Door — Controller Only", key: "secondaryDoor" },
              ].map(({ label, key }) => (
                <PriceRow key={key} label={label}>
                  <PriceCell
                    value={(t1 as any)[key].working}
                    onChange={v => setT1(p => ({ ...p, [key]: { ...(p as any)[key], working: v } }))}
                  />
                  <PriceCell
                    value={(t1 as any)[key].nonWorking}
                    onChange={v => setT1(p => ({ ...p, [key]: { ...(p as any)[key], nonWorking: v } }))}
                  />
                </PriceRow>
              ))}
              <PriceRow label="GateGuard Video Callbox">
                <PriceCell value={t1.callbox} onChange={v => setT1(p => ({ ...p, callbox: v }))} />
              </PriceRow>
            </PricingCard>

            {/* Tier 2 — GateGuard Integrated */}
            <PricingCard title="Access Control — Tier 2 (GateGuard Integrated)">
              <div className="flex justify-end gap-6 pb-1 pt-1">
                <ColHeader>Working</ColHeader>
                <ColHeader>Non-Working</ColHeader>
              </div>
              <PriceRow label="Access Point — Reader + Controller">
                <PriceCell value={t2.accessPoint.working}    onChange={v => setT2(p => ({ ...p, accessPoint: { ...p.accessPoint, working: v }    }))} />
                <PriceCell value={t2.accessPoint.nonWorking} onChange={v => setT2(p => ({ ...p, accessPoint: { ...p.accessPoint, nonWorking: v } }))} />
              </PriceRow>
              <PriceRow label="GateGuard Video Callbox">
                <PriceCell value={t2.callbox} onChange={v => setT2(p => ({ ...p, callbox: v }))} />
              </PriceRow>
            </PricingCard>

            {/* Network Infrastructure */}
            <PricingCard title="Network Infrastructure">
              {[
                { label: "Network Router",         key: "router"      },
                { label: "4-Port PoE Switch",      key: "switch4port" },
                { label: "8-Port PoE Switch",      key: "switch8port" },
                { label: "16-Port PoE Switch",     key: "switch16port"},
                { label: "PTP Radio — Small",      key: "radioSmall"  },
                { label: "PTP Radio — Medium",     key: "radioMedium" },
                { label: "PTP Radio — Large",      key: "radioLarge"  },
                { label: "Weatherproof Enclosure", key: "enclosure"   },
              ].map(({ label, key }) => (
                <PriceRow key={key} label={label}>
                  <PriceCell
                    value={(network as any)[key]}
                    onChange={v => setNetwork(p => ({ ...p, [key]: v }))}
                  />
                </PriceRow>
              ))}
            </PricingCard>

            {/* Cameras */}
            <PricingCard title="Cameras">
              <p className="text-[11px] text-muted-foreground pt-2 pb-1 font-medium uppercase tracking-wide">Existing Cameras</p>
              <PriceRow label="Existing — Monitored (reprogramming)" note="included">
                <span className="text-sm text-muted-foreground">Included</span>
              </PriceRow>
              <PriceRow label="Existing — Monitored (monthly MRR)">
                <PriceCell value={cameras.existingMonitoredMonthly} onChange={v => setCameras(p => ({ ...p, existingMonitoredMonthly: v }))} suffix="/mo" />
              </PriceRow>
              <PriceRow label="Existing — Standalone (reprogramming labor)">
                <PriceCell value={cameras.existingStandaloneSetup} onChange={v => setCameras(p => ({ ...p, existingStandaloneSetup: v }))} />
              </PriceRow>

              <p className="text-[11px] text-muted-foreground pt-3 pb-1 font-medium uppercase tracking-wide">New Cameras — Monitored (Included Contract)</p>
              <PriceRow label="Installation" note="included">
                <span className="text-sm text-muted-foreground">Included</span>
              </PriceRow>
              <PriceRow label="Monthly Monitoring">
                <PriceCell value={cameras.newMonitoredIncludedMonthly} onChange={v => setCameras(p => ({ ...p, newMonitoredIncludedMonthly: v }))} suffix="/mo" />
              </PriceRow>

              <p className="text-[11px] text-muted-foreground pt-3 pb-1 font-medium uppercase tracking-wide">New Cameras — Monitored (Billable)</p>
              <PriceRow label="Installation">
                <PriceCell value={cameras.newMonitoredBillableSetup} onChange={v => setCameras(p => ({ ...p, newMonitoredBillableSetup: v }))} />
              </PriceRow>
              <PriceRow label="Monthly Monitoring">
                <PriceCell value={cameras.newMonitoredBillableMonthly} onChange={v => setCameras(p => ({ ...p, newMonitoredBillableMonthly: v }))} suffix="/mo" />
              </PriceRow>

              <p className="text-[11px] text-muted-foreground pt-3 pb-1 font-medium uppercase tracking-wide">New Cameras — Standalone (No Monitoring)</p>
              <PriceRow label="Installation">
                <PriceCell value={cameras.newStandaloneSetup} onChange={v => setCameras(p => ({ ...p, newStandaloneSetup: v }))} />
              </PriceRow>

              <p className="text-[11px] text-muted-foreground pt-3 pb-1 font-medium uppercase tracking-wide">LPR Cameras</p>
              <PriceRow label="LPR Installation">
                <PriceCell value={cameras.lprSetup} onChange={v => setCameras(p => ({ ...p, lprSetup: v }))} />
              </PriceRow>
              <PriceRow label="LPR Monthly Monitoring">
                <PriceCell value={cameras.lprMonthly} onChange={v => setCameras(p => ({ ...p, lprMonthly: v }))} suffix="/mo" />
              </PriceRow>
            </PricingCard>

            {/* Add-Ons */}
            <PricingCard title="Add-Ons">
              <PriceRow label="Entry Gate Repair Plan" note="per gate/mo">
                <PriceCell value={addOns.gateMaintenancePerGate} onChange={v => setAddOns(p => ({ ...p, gateMaintenancePerGate: v }))} suffix="/mo" />
              </PriceRow>
            </PricingCard>

            {/* Contract Terms */}
            <PricingCard title="Contract Terms">
              <PriceRow label="Contract Length" note="months">
                <PriceCell value={contract.months} onChange={v => setContract(p => ({ ...p, months: v }))} prefix="" suffix=" mo" />
              </PriceRow>
              <PriceRow label="Deposit at Signing" note="% of billable setup + 1st month">
                <PriceCell value={contract.depositPercent * 100} onChange={v => setContract(p => ({ ...p, depositPercent: v / 100 }))} prefix="" suffix="%" />
              </PriceRow>
              <PriceRow label="Payment at Go-Live" note="% of billable setup + 1st month">
                <PriceCell value={contract.goLivePercent * 100} onChange={v => setContract(p => ({ ...p, goLivePercent: v / 100 }))} prefix="" suffix="%" />
              </PriceRow>
            </PricingCard>

            <button
              onClick={handleSave}
              className={`mt-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                saved
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-brand-400 hover:bg-brand-500 text-white gg-glow"
              }`}
            >
              {saved ? "✓ Saved" : "Save Pricing"}
            </button>
          </div>
        </div>

        {/* ── INTEGRATIONS + TEAM ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-6">

          {/* Integrations */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <SectionHeader icon={Zap} title="Integrations" />
            <div className="p-4 space-y-3">
              {integrations.map((int) => (
                <div key={int.name} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-brand-400/30 transition-colors">
                  <span className="text-2xl">{int.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{int.name}</p>
                    <p className="text-[11px] text-muted-foreground">{int.desc}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">Last sync: {int.lastSync}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      int.status === "connected" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                    }`}>
                      {int.status === "connected" ? "● Connected" : "○ Setup"}
                    </span>
                    <button className="text-[11px] text-brand-400 hover:underline">
                      {int.status === "connected" ? "Configure" : "Connect →"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Team */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <div className="flex items-center gap-2">
                <Users size={15} className="text-brand-400" />
                <h2 className="text-sm font-semibold">Team</h2>
              </div>
              <button className="text-xs text-brand-400 hover:text-brand-300 transition-colors">+ Invite</button>
            </div>
            <div className="p-4 space-y-2">
              {team.map((member) => (
                <div key={member.email} className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-brand-400/20 border border-brand-400/30 flex items-center justify-center text-xs font-bold text-brand-400">
                    {member.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{member.name}</p>
                    <p className="text-[11px] text-muted-foreground">{member.email}</p>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-400/10 text-brand-400 font-medium">
                    {member.role.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <SectionHeader icon={Bell} title="Notifications" />
            <div className="p-4 space-y-3">
              {[
                "Camera goes offline",
                "Forced entry event",
                "Bridge disconnected",
                "New access control alert",
                "Work order overdue",
                "Invoice payment received",
              ].map((alert) => (
                <div key={alert} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{alert}</span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" defaultChecked className="accent-blue-500" /> Email
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" defaultChecked className="accent-blue-500" /> SMS
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Branding */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <SectionHeader icon={Palette} title="Branding" />
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">Company Name</label>
                <input defaultValue="Gate Guard, LLC" className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:border-brand-400/60 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Portal URL</label>
                <input defaultValue="portal.gateguard.co" className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:border-brand-400/60 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Primary Color</label>
                <div className="mt-1 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-brand-400 border border-border cursor-pointer" />
                  <input defaultValue="#2563EB" className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono text-foreground outline-none focus:border-brand-400/60 transition-colors" />
                </div>
              </div>
              <button className="w-full py-2 rounded-lg bg-brand-400 hover:bg-brand-500 text-white text-sm font-medium transition-colors">Save Branding</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
