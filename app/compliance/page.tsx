"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import {
  AlertTriangle,
  XCircle,
  FileText,
  Plus,
  Loader2,
  Eye,
  Upload,
  MapPin,
  Filter,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ShieldCheck, Paperclip, Save, Trash2Icon } = require("lucide-react") as any;
import { EmptyState } from "@/components/ui/EmptyState";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { SlideOver, SlideOverFooter } from "@/components/ui/SlideOver";

// ─── Types ────────────────────────────────────────────────────────────────────

type ComplianceStatus = "compliant" | "expiring_soon" | "expired" | "no_expiry";

interface PermitDocument {
  name: string;
  url: string;
  path: string;
  uploaded_at: string;
}

interface Permit {
  id: string;
  type: string;
  label: string | null;
  site_name: string | null;
  site_id: string | null;
  issued_by: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  days_remaining: number | null;
  status: ComplianceStatus;
  permit_number: string | null;
  inspector_name: string | null;
  inspection_date: string | null;
  jurisdiction: string | null;
  notes: string | null;
  documents: PermitDocument[] | null;
}

interface Site {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
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

function inputClass(extra = "") {
  return `border border-border rounded-lg px-3 h-9 text-sm w-full bg-background focus:outline-none focus:ring-2 focus:ring-brand-400/50 ${extra}`;
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

// ─── Permit Detail SlideOver ──────────────────────────────────────────────────

interface PermitDetailProps {
  permit: Permit;
  onClose: () => void;
  onSaved: () => void;
}

function PermitDetail({ permit, onClose, onSaved }: PermitDetailProps) {
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    type:            permit.type,
    label:           permit.label          ?? "",
    permit_number:   permit.permit_number  ?? "",
    issued_by:       permit.issued_by      ?? "",
    jurisdiction:    permit.jurisdiction   ?? "",
    inspector_name:  permit.inspector_name ?? "",
    issue_date:      permit.issue_date     ?? "",
    expiry_date:     permit.expiry_date    ?? "",
    inspection_date: permit.inspection_date ?? "",
    notes:           permit.notes          ?? "",
  });

  const [docs, setDocs] = useState<PermitDocument[]>(permit.documents ?? []);

  function field(
    label: string,
    key: keyof typeof form,
    opts?: { type?: string; placeholder?: string; fullWidth?: boolean }
  ) {
    return (
      <div className={opts?.fullWidth ? "col-span-2" : ""}>
        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
          {label}
        </label>
        {editing ? (
          key === "type" ? (
            <select
              value={form[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              className={inputClass()}
            >
              {Object.entries(PERMIT_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          ) : key === "notes" ? (
            <textarea
              value={form[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              rows={3}
              className="border border-border rounded-lg px-3 py-2 text-sm w-full bg-background focus:outline-none focus:ring-2 focus:ring-brand-400/50 resize-none"
              placeholder={opts?.placeholder}
            />
          ) : (
            <input
              type={opts?.type ?? "text"}
              value={form[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              className={inputClass()}
              placeholder={opts?.placeholder}
            />
          )
        ) : (
          <p className="text-sm text-foreground py-1.5 min-h-[36px] leading-tight">
            {form[key] ? (
              opts?.type === "date" ? fmtDate(form[key]) : form[key]
            ) : (
              <span className="text-muted-foreground italic">—</span>
            )}
          </p>
        )}
      </div>
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/permits/${permit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          label:           form.label           || null,
          permit_number:   form.permit_number   || null,
          issued_by:       form.issued_by       || null,
          jurisdiction:    form.jurisdiction    || null,
          inspector_name:  form.inspector_name  || null,
          issue_date:      form.issue_date      || null,
          expiry_date:     form.expiry_date     || null,
          inspection_date: form.inspection_date || null,
          notes:           form.notes           || null,
          documents:       docs,
        }),
      });
      setEditing(false);
      onSaved();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Step 1: get signed upload URL
      const res = await fetch(`/api/permits/${permit.id}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      const { uploadUrl, downloadUrl, path } = await res.json() as {
        uploadUrl: string; downloadUrl: string; path: string
      };

      // Step 2: PUT file directly to Supabase Storage
      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type, "x-upsert": "true" },
        body: file,
      });

      // Step 3: add to local docs array and PATCH permit
      const newDoc: PermitDocument = {
        name: file.name,
        url:  downloadUrl,
        path,
        uploaded_at: new Date().toISOString(),
      };
      const updatedDocs = [...docs, newDoc];
      setDocs(updatedDocs);

      await fetch(`/api/permits/${permit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents: updatedDocs }),
      });
      onSaved();
    } catch (err) { console.error(err); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function handleDeleteDoc(docPath: string) {
    setDeleting(docPath);
    try {
      const updatedDocs = docs.filter(d => d.path !== docPath);
      setDocs(updatedDocs);
      await fetch(`/api/permits/${permit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents: updatedDocs }),
      });
      onSaved();
    } catch (e) { console.error(e); }
    finally { setDeleting(null); }
  }

  const footer = editing ? (
    <SlideOverFooter
      onCancel={() => setEditing(false)}
      onSave={() => void handleSave()}
      saving={saving}
      saveLabel="Save Changes"
    />
  ) : (
    <div className="flex justify-between items-center">
      <StatusBadge status={permit.status} />
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-400 text-white text-sm font-medium hover:bg-brand-500 transition-colors"
      >
        <Save size={13} /> Edit Permit
      </button>
    </div>
  );

  return (
    <SlideOver
      open
      onClose={onClose}
      title={form.label || PERMIT_TYPE_LABELS[form.type] || form.type}
      subtitle={permit.site_name ?? "No property assigned"}
      size="lg"
      footer={footer}
    >
      <div className="space-y-6">
        {/* ── Core Fields ─────────────────────────────────────────────── */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Permit Details</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {field("Type",         "type")}
            {field("Custom Label", "label",         { placeholder: "Optional display name" })}
            {field("Permit #",     "permit_number", { placeholder: "GP-12345" })}
            {field("Issued By",    "issued_by",     { placeholder: "City of Atlanta" })}
            {field("Jurisdiction", "jurisdiction",  { placeholder: "Fulton County" })}
            {field("Issue Date",   "issue_date",    { type: "date" })}
            {field("Expiry Date",  "expiry_date",   { type: "date" })}
            {field("Inspector",    "inspector_name",{ placeholder: "John Smith" })}
            {field("Inspection Date", "inspection_date", { type: "date" })}
            {field("Notes",        "notes",         { fullWidth: true, placeholder: "Additional details..." })}
          </div>
        </div>

        {/* ── Document Attachments ─────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Documents ({docs.length})
            </h3>
            <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {uploading ? "Uploading…" : "Attach Document"}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={e => void handleFileSelect(e)}
                disabled={uploading}
              />
            </label>
          </div>

          {docs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
              <Paperclip size={20} className="text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-xs text-muted-foreground">No documents attached</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">PDF, JPG, or PNG up to 20 MB</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {docs.map(doc => (
                <li
                  key={doc.path}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/20 hover:bg-accent/20 transition-colors"
                >
                  <FileText size={14} className="text-brand-400 shrink-0" />
                  <span className="flex-1 text-xs font-medium text-foreground truncate">{doc.name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(doc.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  {doc.url && (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded hover:bg-accent/40 text-muted-foreground hover:text-foreground transition-colors"
                      title="View"
                    >
                      <Eye size={13} />
                    </a>
                  )}
                  <button
                    onClick={() => void handleDeleteDoc(doc.path)}
                    disabled={deleting === doc.path}
                    className="p-1 rounded hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50"
                    title="Remove"
                  >
                    {deleting === doc.path ? <Loader2 size={13} className="animate-spin" /> : <Trash2Icon size={13} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SlideOver>
  );
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
  {
    key: "documents",
    label: "Docs",
    render: (_, row) => {
      const count = (row.documents ?? []).length;
      return count > 0
        ? <span className="inline-flex items-center gap-1 text-xs text-brand-400"><Paperclip size={11} />{count}</span>
        : <span className="text-border text-xs">—</span>;
    },
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
          className="border border-border rounded-lg px-3 h-9 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-brand-400/50">
          {Object.entries(PERMIT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Issued By</label>
        <input value={form.issued_by} onChange={e => setForm(f => ({ ...f, issued_by: e.target.value }))}
          className="border border-border rounded-lg px-3 h-9 text-sm w-40 bg-background focus:outline-none focus:ring-2 focus:ring-brand-400/50"
          placeholder="City of Atlanta" />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Permit #</label>
        <input value={form.permit_number} onChange={e => setForm(f => ({ ...f, permit_number: e.target.value }))}
          className="border border-border rounded-lg px-3 h-9 text-sm w-32 bg-background focus:outline-none focus:ring-2 focus:ring-brand-400/50"
          placeholder="GP-12345" />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Issue Date</label>
        <input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))}
          className="border border-border rounded-lg px-3 h-9 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-brand-400/50" />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Expiry Date</label>
        <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
          className="border border-border rounded-lg px-3 h-9 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-brand-400/50" />
      </div>
      <button type="submit" disabled={saving}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-400 text-white text-sm font-semibold hover:bg-brand-500 transition-colors disabled:opacity-50">
        {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
        Save
      </button>
      <button type="button" onClick={onCancel}
        className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent/30 transition-colors">
        Cancel
      </button>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CompliancePage() {
  const [permits,       setPermits]       = useState<Permit[]>([]);
  const [sites,         setSites]         = useState<Site[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showAdd,       setShowAdd]       = useState(false);
  const [selectedPermit, setSelectedPermit] = useState<Permit | null>(null);
  const [siteFilter,    setSiteFilter]    = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = siteFilter !== "all" ? `?site_id=${siteFilter}` : "";
      const [permRes, siteRes] = await Promise.all([
        fetch(`/api/permits${params}`),
        fetch("/api/sites?limit=100"),
      ]);
      const permData = await permRes.json() as { permits?: Permit[] };
      const siteData = await siteRes.json() as { sites?: Array<{ id: string; name: string; city: string | null; state: string | null }> };
      setPermits(permData.permits ?? []);
      setSites(
        (siteData.sites ?? []).map(s => ({
          id:    s.id,
          name:  s.name,
          city:  s.city,
          state: s.state,
        }))
      );
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [siteFilter]);

  useEffect(() => { void load(); }, [load]);

  const expiredCount   = permits.filter(p => p.status === "expired").length;
  const expiringCount  = permits.filter(p => p.status === "expiring_soon").length;
  const compliantCount = permits.filter(p => p.status === "compliant" || p.status === "no_expiry").length;

  // Sites with at least one expiring or expired permit
  const sitesWithIssues = new Set(
    permits
      .filter(p => p.status === "expired" || p.status === "expiring_soon")
      .map(p => p.site_id)
      .filter(Boolean)
  ).size;

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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-400/10"><MapPin size={16} className="text-amber-400" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loading ? "—" : sitesWithIssues}</p>
              <p className="text-xs text-muted-foreground">Sites w/ Issues</p>
            </div>
          </div>
        </div>

        {/* Permits Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border flex-wrap">
            <ShieldCheck size={15} className="text-brand-400" />
            <h2 className="text-sm font-semibold">Permit & Compliance Registry</h2>
            {!loading && permits.length > 0 && (
              <span className="text-[10px] text-muted-foreground">{permits.length} records</span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Filter size={13} className="text-muted-foreground" />
              <select
                value={siteFilter}
                onChange={e => setSiteFilter(e.target.value)}
                className="border border-border rounded-lg px-3 h-8 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-brand-400/50"
              >
                <option value="all">All Properties</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.city ? ` — ${s.city}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DataTable<Permit>
            columns={PERMIT_COLUMNS}
            data={permits}
            rowKey="id"
            loading={loading}
            skeletonRows={5}
            onRowClick={row => setSelectedPermit(row)}
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

      {/* Permit Detail SlideOver */}
      {selectedPermit && (
        <PermitDetail
          permit={selectedPermit}
          onClose={() => setSelectedPermit(null)}
          onSaved={() => {
            void load();
            // Refresh the selected permit from the updated list
          }}
        />
      )}
    </div>
  );
}
