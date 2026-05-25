"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import { EmptyState } from "@/components/ui/EmptyState";
import { DataTable, type Column } from "@/components/ui/DataTable";
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
const { DollarSign, GitBranch } = require("lucide-react") as any;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Rep {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  tier: "senior_rep" | "rep" | "sub_rep";
  parent_rep_id: string | null;
  commission_rate: number;
  pipeline_value: number;
  active_sites: number;
  is_active: boolean;
}

function repFullName(rep: Rep) {
  return `${rep.first_name} ${rep.last_name}`.trim();
}

interface Commission {
  id: string;
  rep_id: string;
  pay_period: string;
  amount_cents: number;
  door_count?: number | null;
  status: "pending" | "approved" | "paid" | "held";
  sales_reps: { first_name: string; last_name: string; tier: string } | null;
}

// ─── Commission model constants ───────────────────────────────────────────────

const COMMISSION_MODEL = [
  { tier: "Master Agent",       rate: "$0.50", color: "text-violet-600", bg: "bg-violet-50",  border: "border-violet-200",  note: "Fixed, off top. Active during onboarding; historical thereafter." },
  { tier: "MSO",                 rate: "$0.50", color: "text-brand-400",  bg: "bg-brand-50",   border: "border-brand-200",   note: "Fixed, off top. Portfolio-level account owner." },
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

// ─── Hierarchy tree node ──────────────────────────────────────────────────────

function HierarchyNode({
  rep,
  allReps,
  commMTDByRep,
  depth,
  onClick,
}: {
  rep: Rep
  allReps: Rep[]
  commMTDByRep: Record<string, number>
  depth: number
  onClick: (id: string) => void
}) {
  const children = allReps.filter(r => r.parent_rep_id === rep.id)
  const mtdCents = commMTDByRep[rep.id] ?? 0
  const paddingLeft = depth * 24

  return (
    <div>
      <button
        onClick={() => onClick(rep.id)}
        className="w-full flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/50 transition-colors text-left group"
        style={{ paddingLeft: `${paddingLeft + 12}px` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {depth > 0 && (
            <div
              className="border-l-2 border-b-2 border-border rounded-bl-sm shrink-0"
              style={{ width: 14, height: 14, marginLeft: -14, marginBottom: -6 }}
            />
          )}
          <div className="w-7 h-7 rounded-full bg-brand-400/10 flex items-center justify-center text-[10px] font-bold text-brand-400 shrink-0">
            {rep.first_name[0]}{rep.last_name[0]}
          </div>
          <div className="min-w-0">
            <span className="text-sm font-medium text-foreground group-hover:text-brand-400 transition-colors">
              {rep.first_name} {rep.last_name}
            </span>
            <span className="ml-2 text-[10px] text-muted-foreground">
              {TIER_LABELS[rep.tier] ?? rep.tier}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-6 shrink-0 text-right">
          <div>
            <div className="text-sm font-medium text-foreground">{fmtPipeline(rep.pipeline_value)}</div>
            <div className="text-[10px] text-muted-foreground">pipeline</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-emerald-600">{fmtMoney(mtdCents)}</div>
            <div className="text-[10px] text-muted-foreground">MTD</div>
          </div>
        </div>
      </button>
      {children.map(child => (
        <HierarchyNode
          key={child.id}
          rep={child}
          allReps={allReps}
          commMTDByRep={commMTDByRep}
          depth={depth + 1}
          onClick={onClick}
        />
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RepsPage() {
  const router = useRouter();
  const [reps,        setReps]        = useState<Rep[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showAddRep,  setShowAddRep]  = useState(false);
  const [newRepName,  setNewRepName]  = useState("");
  const [newRepEmail, setNewRepEmail] = useState("");
  const [newRepTier,  setNewRepTier]  = useState<"senior_rep"|"rep"|"sub_rep">("rep");
  const [saving,      setSaving]      = useState(false);
  const [hierarchyView, setHierarchyView] = useState(false);
  const [commActionId, setCommActionId]   = useState<string | null>(null);
  const [selectedCommIds, setSelectedCommIds] = useState<Set<string>>(new Set());

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

  // Commission action handler (approve / hold / mark paid)
  const handleCommissionAction = async (commId: string, status: string) => {
    setCommActionId(commId);
    try {
      await fetch(`/api/reps/commissions/${commId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      void load();
    } catch (e) { console.error(e); }
    finally { setCommActionId(null); }
  };

  // Bulk commission action
  const handleBulkAction = async (status: string) => {
    for (const cId of Array.from(selectedCommIds)) {
      try {
        await fetch(`/api/reps/commissions/${cId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
      } catch { /* continue */ }
    }
    setSelectedCommIds(new Set());
    void load();
  };

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

  // Per-rep commission MTD map
  const now2 = new Date();
  const currentPeriod = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, "0")}`;
  const commMTDByRep: Record<string, number> = {};
  for (const c of commissions) {
    if (c.pay_period === currentPeriod && (c.status === "approved" || c.status === "paid")) {
      commMTDByRep[c.rep_id] = (commMTDByRep[c.rep_id] ?? 0) + c.amount_cents;
    }
  }

  // Add rep
  async function handleAddRep(e: React.FormEvent) {
    e.preventDefault();
    if (!newRepName.trim()) return;
    setSaving(true);
    try {
      const parts = newRepName.trim().split(/\s+/);
      const first_name = parts.slice(0, -1).join(" ") || parts[0] || "";
      const last_name  = parts.length > 1 ? parts[parts.length - 1] : "";
      await fetch("/api/reps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name, last_name, email: newRepEmail.trim() || null, tier: newRepTier }),
      });
      setNewRepName(""); setNewRepEmail(""); setShowAddRep(false);
      void load();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  // ─── Rep table columns ──────────────────────────────────────────────────────
  const repColumns: Column<Rep>[] = [
    {
      key: "first_name",
      label: "Name",
      sortable: true,
      render: (_, row) => (
        <button
          onClick={() => router.push(`/reps/${row.id}`)}
          className="font-medium text-foreground whitespace-nowrap hover:text-brand-400 transition-colors text-left flex items-center gap-1"
        >
          {row.parent_rep_id && <ChevronRight size={11} className="text-muted-foreground shrink-0" />}
          {repFullName(row)}
        </button>
      ),
    },
    {
      key: "email",
      label: "Email",
      render: (_, row) => (
        <span className="text-muted-foreground">{row.email ?? "—"}</span>
      ),
    },
    {
      key: "tier",
      label: "Tier",
      render: (_, row) => <TierBadge tier={row.tier} />,
    },
    {
      key: "parent_rep_id",
      label: "Reports To",
      render: (_, row) => (
        <span className="text-muted-foreground">
          {row.parent_rep_id
            ? (repById[row.parent_rep_id] ? repFullName(repById[row.parent_rep_id]) : "—")
            : "—"}
        </span>
      ),
    },
    {
      key: "pipeline_value",
      label: "Pipeline",
      sortable: true,
      render: (_, row) => (
        <span className="font-medium text-foreground">{fmtPipeline(row.pipeline_value)}</span>
      ),
    },
    {
      key: "commission_rate",
      label: "Commission MTD",
      render: (_, row) => {
        const mtdCents = commMTDByRep[row.id] ?? 0;
        return (
          <div>
            <div className="font-semibold text-foreground">{fmtMoney(mtdCents)}</div>
            <div className="text-[10px] text-muted-foreground">${row.commission_rate.toFixed(2)}/unit rate</div>
          </div>
        );
      },
    },
  ];

  // ─── Commission table columns ───────────────────────────────────────────────
  const commissionColumns: Column<Commission>[] = [
    {
      key: "rep_id",
      label: "Rep",
      render: (_, row) => (
        <span className="font-medium text-foreground">
          {row.sales_reps ? `${row.sales_reps.first_name} ${row.sales_reps.last_name}`.trim() : "—"}
        </span>
      ),
    },
    {
      key: "pay_period",
      label: "Period",
      sortable: true,
      render: (_, row) => <span className="font-mono text-xs text-foreground">{row.pay_period}</span>,
    },
    {
      key: "door_count",
      label: "Doors",
      align: "right",
      render: (_, row) => <span className="text-foreground">{row.door_count ?? "—"}</span>,
    },
    {
      key: "amount_cents",
      label: "Amount",
      sortable: true,
      render: (_, row) => <span className="font-semibold text-foreground">{fmtMoney(row.amount_cents)}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (_, row) => <CommissionStatus status={row.status} />,
    },
  ];

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
          <div className="p-5 grid grid-cols-2 sm:grid-cols-5 gap-4">
            {COMMISSION_MODEL.map(m => (
              <div key={m.tier} className={`rounded-xl border-2 ${m.border} ${m.bg} p-5 flex flex-col items-center justify-center text-center gap-2`}>
                <div className={`text-3xl font-extrabold ${m.color}`}>{m.rate}</div>
                <div className="text-xs font-semibold text-slate-600 leading-tight">{m.tier}</div>
                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">per unit / mo</div>
              </div>
            ))}
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
              <span className="text-[10px] text-muted-foreground">{reps.length} reps</span>
            )}
            <div className="ml-auto">
              <button
                onClick={() => setHierarchyView(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  hierarchyView
                    ? "bg-brand-400/10 text-brand-400 border-brand-400/30"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <GitBranch size={12} />
                Hierarchy View
              </button>
            </div>
          </div>

          {hierarchyView ? (
            /* ── Hierarchy Tree ──────────────────────────────── */
            <div className="p-4 space-y-1">
              {reps.filter(r => !r.parent_rep_id).length === 0 && !loading ? (
                <EmptyState
                  icon={<Users size={32} className="text-muted-foreground" />}
                  title="No reps added yet"
                  description="Click Add Rep to build your sales rep network"
                />
              ) : (
                reps.filter(r => !r.parent_rep_id).map(root => (
                  <HierarchyNode
                    key={root.id}
                    rep={root}
                    allReps={reps}
                    commMTDByRep={commMTDByRep}
                    depth={0}
                    onClick={id => router.push(`/reps/${id}`)}
                  />
                ))
              )}
            </div>
          ) : (
            <DataTable<Rep>
              columns={repColumns}
              data={reps}
              rowKey="id"
              loading={loading}
              skeletonRows={5}
              onRowClick={row => router.push(`/reps/${row.id}`)}
              emptyState={
                <EmptyState
                  icon={<Users size={32} className="text-muted-foreground" />}
                  title="No reps added yet"
                  description="Click Add Rep to build your sales rep network"
                />
              }
            />
          )}
        </div>

        {/* Commission Payouts */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border flex-wrap gap-y-2">
            <DollarSign size={15} className="text-brand-400" />
            <h2 className="text-sm font-semibold">Commission Payouts</h2>
            {selectedCommIds.size > 0 && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{selectedCommIds.size} selected</span>
                <button
                  onClick={() => { void handleBulkAction("approved"); }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200 hover:bg-emerald-100 transition-colors"
                >
                  Approve Selected
                </button>
                <button
                  onClick={() => { void handleBulkAction("paid"); }}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  Mark Paid Selected
                </button>
              </div>
            )}
          </div>

          <DataTable<Commission>
            columns={commissionColumns}
            data={commissions}
            rowKey="id"
            loading={loading}
            skeletonRows={4}
            selectable
            selectedIds={selectedCommIds}
            onSelectChange={setSelectedCommIds}
            actions={row => (
              <div className="flex items-center gap-1.5 justify-end">
                {row.status === "pending" && (
                  <>
                    <button
                      onClick={() => { void handleCommissionAction(row.id, "approved"); }}
                      disabled={commActionId === row.id}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => { void handleCommissionAction(row.id, "held"); }}
                      disabled={commActionId === row.id}
                      className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
                    >
                      Hold
                    </button>
                  </>
                )}
                {row.status === "approved" && (
                  <button
                    onClick={() => { void handleCommissionAction(row.id, "paid"); }}
                    disabled={commActionId === row.id}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-50"
                  >
                    Mark Paid
                  </button>
                )}
                {row.status === "held" && (
                  <button
                    onClick={() => { void handleCommissionAction(row.id, "approved"); }}
                    disabled={commActionId === row.id}
                    className="px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 hover:bg-slate-100 transition-colors disabled:opacity-50"
                  >
                    Unhold
                  </button>
                )}
              </div>
            )}
            emptyState={
              <EmptyState
                icon={<Layers size={32} className="text-muted-foreground" />}
                title="No commission records yet"
                description="Commission payouts will appear here once reps close deals"
              />
            }
          />
        </div>

      </div>
    </div>
  );
}
