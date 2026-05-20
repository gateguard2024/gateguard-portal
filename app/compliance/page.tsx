"use client";

import { useEffect, useState, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import {
  AlertTriangle,
  XCircle,
  FileText,
  Plus,
  Loader2,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ShieldCheck } = require("lucide-react") as any;
import { EmptyState } from "@/components/ui/EmptyState";
import { DataTable, type Column } from "@/components/ui/DataTable";

// ─── Types ────────────────────────────────────────────────────────────────────

type ComplianceStatus = "compliant" | "expiring_soon" | "expired" | "no_expiry";

interface Permit {
  id: string;
  type: string;
  label: string | null;
  site_name: string | null;
  issued_by: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  days_remaining: number | null;
  status: ComplianceStatus;
  permit_number: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PERMIT_TYPE_LABELS: Record<string, string> = {
  gate_permit:         "Gate Permit",
  fire_marshal:        "Fire Marshal",
  hoa_certificate:     "HOA Certificate",
  city_license:        "City License",
  electrical_permit:   "Electrical Permit",
  low_voltage_license: "Low Voltage License",
  other:               "Other",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ComplianceStatus }) {
  if (status === "compliant" || status === "no_expiry")
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-400/10 text-emerald-400">Compliant</span>;
  if (status === "expiring_soon")
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400/10 text-amber-400">Expiring Soon</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-400/10 text-red-400">Expired</span>;
}

function DaysCell({ days, status }: { days: number | null; status: ComplianceStatus }) {
  if (!days && days !== 0) return <span className="text-muted-foreground">—</span>;
  if (status === "expired")
    return <span className="font-semibold text-red-400">EXPIRED</span>;
  if (status === "expiring_soon")
    return <span className="font-semibold text-amber-400">{days} days</span>;
  return <span className="text-foreground">{days} days</span>;
}

// ─── Table columns ────────────────────────────────────────────────────────────

const PERMIT_COLUMNS: Column<Permit>[] = [
  {
    key: "site_name",
    label: "Property",
    sortable: true,
    render: (_, row) => row.site_name
      ? <span className="font-medium text-foreground whitespace-nowrap">{row.site_name}</span>
      : <span className="text-muted-foreground italic">Unassigned</span>,
  },
  {
    key: "type",
    label: "Type",
    render: (_, row) => (
      <span className="text-muted-foreground whitespace-nowrap">
        {row.label ?? PERMIT_TYPE_LABELS[row.type] ?? row.type}
      </span>
    ),
  },
  {
    key: "permit_number",
    label: "Permit #",
    sortable: true,
    render: (_, row) => row.permit_number
      ? <span className="text-muted-foreground font-mono">{row.permit_number}</span>
      : <span className="text-border">—</span>,
  },
  {
    key: "issued_by",
    label: "Jurisdiction",
    render: (_, row) => row.issued_by
      ? <span className="text-muted-foreground whitespace-nowrap">{row.issued_by}</span>
      : <span className="text-border">—</span>,
  },
  {
    key: "issue_date",
    label: "Issued",
    sortable: true,
    render: (_, row) => <span className="text-muted-foreground whitespace-nowrap">{fmtDate(row.issue_date)}</span>,
  },
  {
    key: "expiry_date",
    label: "Expires",
    sortable: true,
    render: (_, row) => <span className="text-muted-foreground whitespace-nowrap">{fmtDate(row.expiry_date)}</span>,
  },
  {
    key: "days_remaining",
    label: "Days",
    render: (_, row) => <DaysCell days={row.days_remaining} status={row.status} />,
  },
  {
    key: "status",
    label: "Status",
    render: (_, row) => <StatusBadge status={row.status} />,
  },
];

// ─── Add Permit Form ──────────────────────────────────────────────────────────

interface AddPermitFormProps {
  onSaved: () => void;
  onCancel: () => void;
}

function AddPermitForm({ onSaved, onCancel }: AddPermitFormProps) {
  const [form, setForm] = useState({
    type: "gate_permit",
    issued_by: "",
    permit_number: "",
    issue_date: "",
    expiry_date: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/permits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      onSaved();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={e => { void handleSubmit(e); }}
      className="bg-card border border-brand-400/30 rounded-xl p-4 flex flex-wrap gap-3 items-end">
      <div>
        <label className="block text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Type *</label>
        <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
          className="border border-border rounded-lg px-3 py-2 text-xs bg-background">
          {Object.entries(PERMIT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Issued By</label>
        <input value={form.issued_by} onChange={e => setForm(f => ({ ...f, issued_by: e.target.value }))}
          className="border border-border rounded-lg px-3 py-2 text-xs w-40 bg-background"
          placeholder="City of Atlanta" />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Permit #</label>
        <input value={form.permit_number} onChange={e => setForm(f => ({ ...f, permit_number: e.target.value }))}
          className="border border-border rounded-lg px-3 py-2 text-xs w-32 bg-background"
          placeholder="GP-12345" />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Issue Date</label>
        <input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))}
          className="border border-border rounded-lg px-3 py-2 text-xs bg-background" />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Expiry Date</label>
        <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
          className="border border-border rounded-lg px-3 py-2 text-xs bg-background" />
      </div>
      <button type="submit" disabled={saving}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-400 text-white text-xs font-semibold hover:bg-brand-500 transition-colors disabled:opacity-50">
        {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
        Save
      </button>
      <button type="button" onClick={onCancel}
        className="px-4 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent/30 transition-colors">
        Cancel
      </button>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CompliancePage() {
  const [permits,    setPermits]    = useState<Permit[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showAdd,    setShowAdd]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/permits");
      const data = await res.json();
      setPermits(data.permits ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const expiredCount    = permits.filter(p => p.status === "expired").length;
  const expiringCount   = permits.filter(p => p.status === "expiring_soon").length;
  const compliantCount  = permits.filter(p => p.status === "compliant" || p.status === "no_expiry").length;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar
        title="Compliance & Permits"
        subtitle="Gate permits, inspections, and regulatory deadlines per property"
        actions={
          <button
            onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-400 text-white text-xs font-semibold hover:bg-brand-500 transition-colors"
          >
            <Plus size={13} />
            Add Permit
          </button>
        }
      />

      <div className="flex-1 p-6 space-y-6 max-w-screen-xl mx-auto w-full">

        {/* Add Permit Form */}
        {showAdd && (
          <AddPermitForm
            onSaved={() => { setShowAdd(false); void load(); }}
            onCancel={() => setShowAdd(false)}
          />
        )}

        {/* Expired Alert Banner */}
        {!loading && expiredCount > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
            <XCircle size={16} className="shrink-0" />
            <p className="text-sm font-medium">
              {expiredCount} permit{expiredCount > 1 ? "s" : ""} expired — immediate action required
            </p>
          </div>
        )}

        {/* AI Search */}
        <AISearch placeholder='Try "show expiring permits in Atlanta" or "fire marshal certificates"' />

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-brand-400/10"><FileText size={16} className="text-brand-400" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loading ? "—" : permits.length}</p>
              <p className="text-xs text-muted-foreground">Total Items</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-400/10"><ShieldCheck size={16} className="text-emerald-400" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loading ? "—" : compliantCount}</p>
              <p className="text-xs text-muted-foreground">Compliant</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-400/10"><AlertTriangle size={16} className="text-amber-400" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loading ? "—" : expiringCount}</p>
              <p className="text-xs text-muted-foreground">Expiring Soon</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-red-400/10"><XCircle size={16} className="text-red-400" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loading ? "—" : expiredCount}</p>
              <p className="text-xs text-muted-foreground">Expired / Overdue</p>
            </div>
          </div>
        </div>

        {/* Permits Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
            <ShieldCheck size={15} className="text-brand-400" />
            <h2 className="text-sm font-semibold">Permit & Compliance Registry</h2>
            {!loading && permits.length > 0 && (
              <span className="ml-auto text-[10px] text-muted-foreground">{permits.length} records</span>
            )}
          </div>

          <DataTable<Permit>
            columns={PERMIT_COLUMNS}
            data={permits}
            rowKey="id"
            loading={loading}
            skeletonRows={5}
            emptyState={
              <EmptyState
                icon={<ShieldCheck size={32} className="text-muted-foreground" />}
                title="No permits on file"
                description="Click Add Permit to start tracking compliance"
              />
            }
          />
        </div>

      </div>
    </div>
  );
}
