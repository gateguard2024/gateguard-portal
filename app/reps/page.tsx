"use client";

import { useEffect, useState, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import {
  Users,
  TrendingUp,
  Clock,
  Plus,
  ChevronRight,
  Loader2,
  Star,
  Layers,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DollarSign } = require("lucide-react") as any;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Rep {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tier: "senior_rep" | "rep" | "sub_rep";
  parent_rep_id: string | null;
  commission_rate: number;
  pipeline_value: number;
  active_sites: number;
  is_active: boolean;
}

interface Commission {
  id: string;
  rep_id: string;
  pay_period: string;
  amount_cents: number;
  door_count: number;
  status: "pending" | "approved" | "paid" | "held";
  sales_reps: { name: string } | null;
}

// ─── Commission model constants ───────────────────────────────────────────────

const COMMISSION_MODEL = [
  { tier: "Master Agent",       rate: "$0.50", color: "text-violet-600", bg: "bg-violet-50",  border: "border-violet-200",  note: "Fixed, off top. Active during onboarding; historical thereafter." },
  { tier: "Master Dealer",      rate: "$0.50", color: "text-brand-400",  bg: "bg-brand-50",   border: "border-brand-200",   note: "Fixed, off top. Portfolio-level account owner." },
  { tier: "Sales Partner",      rate: "$1.00", color: "text-sky-600",    bg: "bg-sky-50",     border: "border-sky-200",     note: "Configurable. Default $1.00/unit. Lifetime on deals they close." },
  { tier: "Service Dealer",     rate: "$3.00", color: "text-emerald-600",bg: "bg-emerald-50", border: "border-emerald-200", note: "Configurable. Default $3.00/unit. Ongoing service relationship." },
  { tier: "Install Contractor", rate: "$0.00", color: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-200",   note: "No recurring. Paid from one-time setup fees only." },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIER_LABELS: Record<string, string> = {
  senior_rep: "Senior Rep",
  rep:        "Rep",
  sub_rep:    "Sub-Rep",
};

function fmtMoney(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 });
}

function fmtPipeline(value: number) {
  if (value >= 1_000_000) return "$" + (value / 1_000_000).toFixed(1) + "M";
  if (value >= 1_000)     return "$" + Math.round(value / 1_000) + "K";
  return "$" + value;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  const label = TIER_LABELS[tier] ?? tier;
  if (tier === "senior_rep")
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-400/10 text-brand-400">{label}</span>;
  if (tier === "rep")
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-400/10 text-violet-400">{label}</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-400/10 text-emerald-400">{label}</span>;
}

function StatusDot({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted-foreground text-[11px] font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-border inline-block" />Inactive
    </span>
  );
}

function CommissionStatus({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid:     "bg-emerald-400/10 text-emerald-400",
    approved: "bg-blue-400/10 text-blue-400",
    pending:  "bg-amber-400/10 text-amber-400",
    held:     "bg-rose-400/10 text-rose-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${map[status] ?? "bg-slate-100 text-slate-500"}`}>
      {status}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RepsPage() {
  const [reps,        setReps]        = useState<Rep[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showAddRep,  setShowAddRep]  = useState(false);
  const [newRepName,  setNewRepName]  = useState("");
  const [newRepEmail, setNewRepEmail] = useState("");
  const [newRepTier,  setNewRepTier]  = useState<"senior_rep"|"rep"|"sub_rep">("rep");
  const [saving,      setSaving]      = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, cRes] = await Promise.all([
        fetch("/api/reps"),
        fetch("/api/reps/commissions"),
      ]);
      const [rData, cData] = await Promise.all([rRes.json(), cRes.json()]);
      setReps(rData.reps ?? []);
      setCommissions(cData.commissions ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Build lookup: rep id → name (for parent rep display)
  const repById: Record<string, Rep> = {};
  for (const r of reps) repById[r.id] = r;

  // Summary stats
  const activeCount  = reps.filter(r => r.is_active).length;
  const totalPipeline = reps.reduce((s, r) => s + r.pipeline_value, 0);
  const pendingCents = commissions.filter(c => c.status === "pending").reduce((s, c) => s + c.amount_cents, 0);
  const paidThisMonthCents = commissions
    .filter(c => {
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      return c.status === "paid" && c.pay_period === period;
    })
    .reduce((s, c) => s + c.amount_cents, 0);

  // Add rep
  async function handleAddRep(e: React.FormEvent) {
    e.preventDefault();
    if (!newRepName.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/reps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRepName.trim(), email: newRepEmail.trim() || null, tier: newRepTier }),
      });
      setNewRepName(""); setNewRepEmail(""); setShowAddRep(false);
      void load();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar
        title="Reps & Commissions"
        subtitle="Sales rep network, pipeline, and payout tracking"
        actions={
          <button
            onClick={() => setShowAddRep(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-400 text-white text-xs font-semibold hover:bg-brand-500 transition-colors"
          >
            <Plus size={13} />
            Add Rep
          </button>
        }
      />

      <div className="flex-1 p-6 space-y-6 max-w-screen-xl mx-auto w-full">

        {/* Add Rep inline form */}
        {showAddRep && (
          <form onSubmit={e => { void handleAddRep(e); }} className="bg-card border border-brand-400/30 rounded-xl p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Name *</label>
              <input value={newRepName} onChange={e => setNewRepName(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-xs w-44 bg-background"
                placeholder="Full name" required />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Email</label>
              <input value={newRepEmail} onChange={e => setNewRepEmail(e.target.value)} type="email"
                className="border border-border rounded-lg px-3 py-2 text-xs w-48 bg-background"
                placeholder="rep@example.com" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Tier</label>
              <select value={newRepTier} onChange={e => setNewRepTier(e.target.value as "senior_rep"|"rep"|"sub_rep")}
                className="border border-border rounded-lg px-3 py-2 text-xs bg-background">
                <option value="senior_rep">Senior Rep</option>
                <option value="rep">Rep</option>
                <option value="sub_rep">Sub-Rep</option>
              </select>
            </div>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-400 text-white text-xs font-semibold hover:bg-brand-500 transition-colors disabled:opacity-50">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Save
            </button>
            <button type="button" onClick={() => setShowAddRep(false)}
              className="px-4 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent/30 transition-colors">
              Cancel
            </button>
          </form>
        )}

        {/* Commission model breakdown */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
            <DollarSign size={15} className="text-brand-400" />
            <h2 className="text-sm font-semibold">Dealer Commission Model — $5.00 Dealer Pool / Unit / Month</h2>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-5 gap-3">
            {COMMISSION_MODEL.map(m => (
              <div key={m.tier} className={`rounded-lg border ${m.border} ${m.bg} p-3`}>
                <div className={`text-lg font-bold ${m.color}`}>{m.rate}</div>
                <div className="text-xs font-semibold text-slate-700 mt-0.5">{m.tier}</div>
                <div className="text-[10px] text-slate-500 mt-1 leading-snug">{m.note}</div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-border bg-background/30">
            <p className="text-[10px] text-muted-foreground">
              Property pays $10/unit/month · GateGuard keeps $5.00 gross margin · Dealer pool: $5.00 distributed per config above.
              Add-ons (Video Monitoring, Callbox, LPR, Kiosk): 50/50 GateGuard/Dealer split.
              Door Surcharge: ($200 × units) ÷ 12/month → 100% GateGuard.
            </p>
          </div>
        </div>

        {/* AI Search */}
        <AISearch placeholder='Try "show top reps by pipeline" or "pending payouts this month"' />

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-brand-400/10"><Users size={16} className="text-brand-400" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loading ? "—" : activeCount}</p>
              <p className="text-xs text-muted-foreground">Active Reps</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-brand-400/10"><TrendingUp size={16} className="text-brand-400" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loading ? "—" : fmtPipeline(totalPipeline)}</p>
              <p className="text-xs text-muted-foreground">Active Pipeline</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-400/10"><DollarSign size={16} className="text-emerald-400" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loading ? "—" : fmtMoney(paidThisMonthCents)}</p>
              <p className="text-xs text-muted-foreground">Paid This Month</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-400/10"><Clock size={16} className="text-amber-400" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loading ? "—" : fmtMoney(pendingCents)}</p>
              <p className="text-xs text-muted-foreground">Pending Payouts</p>
            </div>
          </div>
        </div>

        {/* Reps Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
            <Users size={15} className="text-brand-400" />
            <h2 className="text-sm font-semibold">Rep Network</h2>
            {reps.length > 0 && (
              <span className="ml-auto text-[10px] text-muted-foreground">{reps.length} reps</span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-xs">Loading reps…</span>
            </div>
          ) : reps.length === 0 ? (
            <div className="py-12 text-center">
              <Star size={28} className="mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No reps yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Click Add Rep to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-background/30">
                    {["Rep Name", "Tier", "Parent Rep", "Active Sites", "Pipeline Value", "Rate/Unit", "Status"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reps.map(rep => (
                    <tr key={rep.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                        {rep.parent_rep_id && <ChevronRight size={11} className="inline text-muted-foreground mr-1" />}
                        {rep.name}
                      </td>
                      <td className="px-4 py-3"><TierBadge tier={rep.tier} /></td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {rep.parent_rep_id
                          ? (repById[rep.parent_rep_id]?.name ?? <span className="text-border italic">—</span>)
                          : <span className="text-border">—</span>}
                      </td>
                      <td className="px-4 py-3 text-foreground">{rep.active_sites}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{fmtPipeline(rep.pipeline_value)}</td>
                      <td className="px-4 py-3 text-muted-foreground">${rep.commission_rate.toFixed(2)}</td>
                      <td className="px-4 py-3"><StatusDot active={rep.is_active} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Commission Payouts */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
            <DollarSign size={15} className="text-brand-400" />
            <h2 className="text-sm font-semibold">Commission Payouts</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-xs">Loading payouts…</span>
            </div>
          ) : commissions.length === 0 ? (
            <div className="py-8 text-center">
              <Layers size={24} className="mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">No commission records yet</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-background/30">
                  {["Rep", "Period", "Doors", "Amount", "Status"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {commissions.map(c => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{c.sales_reps?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.pay_period}</td>
                    <td className="px-4 py-3 text-foreground">{c.door_count}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{fmtMoney(c.amount_cents)}</td>
                    <td className="px-4 py-3"><CommissionStatus status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
