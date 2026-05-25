"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, Plus, X, Check, Trash2, Copy, Mail, Phone,
  Shield, AlertTriangle, ChevronDown,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { HardHat, Key, FileCheck, Briefcase, ExternalLink } = require("lucide-react") as any;
import { SlideOver, SlideOverFooter } from "@/components/ui/SlideOver";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subcontractor {
  id: string;
  org_id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  trade: string | null;
  license_number: string | null;
  license_expiry: string | null;
  insurance_expiry: string | null;
  status: "active" | "inactive" | "suspended";
  access_code: string;
  created_at: string;
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO: Subcontractor[] = [
  {
    id: "demo-1",
    org_id: "org-1",
    name: "Carlos Ruiz",
    company: "Ruiz Gate Solutions",
    email: "carlos@ruizgate.com",
    phone: "(305) 555-0142",
    trade: "Gate Operator",
    license_number: "EC-0001447",
    license_expiry: "2025-03-15",
    insurance_expiry: "2026-09-01",
    status: "active",
    access_code: "RUIZ4321",
    created_at: "2025-09-01T10:00:00Z",
  },
  {
    id: "demo-2",
    org_id: "org-1",
    name: "Sarah Mitchell",
    company: "Mitchell Low Voltage",
    email: "smitchell@mlv.co",
    phone: "(954) 555-0198",
    trade: "Low Voltage",
    license_number: "LV-0098234",
    license_expiry: "2026-07-20",
    insurance_expiry: "2026-01-15",
    status: "active",
    access_code: "MITCH007",
    created_at: "2025-11-12T14:30:00Z",
  },
  {
    id: "demo-3",
    org_id: "org-1",
    name: "Tony Vasquez",
    company: "Vasquez Electric",
    email: "tony@vasqueze.com",
    phone: "(561) 555-0076",
    trade: "Electrical",
    license_number: "EL-0057832",
    license_expiry: "2024-11-30",
    insurance_expiry: "2025-05-31",
    status: "suspended",
    access_code: "VASQ1122",
    created_at: "2024-08-20T09:00:00Z",
  },
  {
    id: "demo-4",
    org_id: "org-1",
    name: "Priya Anand",
    company: "Anand General Contracting",
    email: "priya@anandgc.com",
    phone: "(786) 555-0231",
    trade: "General",
    license_number: "GC-0023456",
    license_expiry: "2026-12-01",
    insurance_expiry: "2026-06-30",
    status: "active",
    access_code: "ANAND890",
    created_at: "2026-01-15T11:00:00Z",
  },
  {
    id: "demo-5",
    org_id: "org-1",
    name: "Derek Thompson",
    company: null,
    email: "derek.t@gmail.com",
    phone: "(407) 555-0055",
    trade: "HVAC",
    license_number: null,
    license_expiry: "2026-04-10",
    insurance_expiry: "2025-12-31",
    status: "inactive",
    access_code: "DERK5678",
    created_at: "2025-06-05T16:00:00Z",
  },
];

const TRADES = [
  "Gate Operator",
  "Low Voltage",
  "HVAC",
  "Electrical",
  "Plumbing",
  "General",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysDiff(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function ExpiryCell({ date }: { date: string | null }) {
  if (!date) return <span className="text-muted-foreground text-xs">—</span>;
  const days = daysDiff(date);
  const formatted = new Date(date).toLocaleDateString();
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
        <AlertTriangle size={11} /> {formatted}
      </span>
    );
  }
  if (days <= 30) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
        <AlertTriangle size={11} /> {formatted}
      </span>
    );
  }
  return <span className="text-xs text-foreground">{formatted}</span>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active")    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700 border border-green-200"><Check size={9} /> Active</span>;
  if (status === "suspended") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700 border border-red-200"><X size={9} /> Suspended</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600 border border-gray-200"><X size={9} /> Inactive</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SubcontractorsPage() {
  const [subs, setSubs]           = useState<Subcontractor[]>([]);
  const [loading, setLoading]     = useState(true);
  const [slideOpen, setSlideOpen] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [editTarget, setEditTarget] = useState<Subcontractor | null>(null);
  const [copiedId, setCopiedId]   = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    trade: "",
    license_number: "",
    license_expiry: "",
    insurance_expiry: "",
  });

  // ── Fetch ──────────────────────────────────────────────────────────
  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/subcontractors");
      if (res.ok) {
        const d = await res.json();
        setSubs(d.subcontractors?.length ? d.subcontractors : DEMO);
      } else {
        setSubs(DEMO);
      }
    } catch {
      setSubs(DEMO);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  // ── Stats ──────────────────────────────────────────────────────────
  const total       = subs.length;
  const active      = subs.filter(s => s.status === "active").length;
  const suspended   = subs.filter(s => s.status === "suspended").length;
  const expiringSoon = subs.filter(s => {
    const ld = s.license_expiry   ? daysDiff(s.license_expiry)   : 999;
    const id = s.insurance_expiry ? daysDiff(s.insurance_expiry) : 999;
    return Math.min(ld, id) <= 30 && Math.min(ld, id) >= 0;
  }).length;

  // ── Form helpers ───────────────────────────────────────────────────
  function openAdd() {
    setEditTarget(null);
    setForm({ name:"", company:"", email:"", phone:"", trade:"", license_number:"", license_expiry:"", insurance_expiry:"" });
    setSlideOpen(true);
  }

  function openEdit(sub: Subcontractor) {
    setEditTarget(sub);
    setForm({
      name:             sub.name,
      company:          sub.company ?? "",
      email:            sub.email ?? "",
      phone:            sub.phone ?? "",
      trade:            sub.trade ?? "",
      license_number:   sub.license_number ?? "",
      license_expiry:   sub.license_expiry ?? "",
      insurance_expiry: sub.insurance_expiry ?? "",
    });
    setSlideOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name:             form.name,
        company:          form.company || null,
        email:            form.email   || null,
        phone:            form.phone   || null,
        trade:            form.trade   || null,
        license_number:   form.license_number   || null,
        license_expiry:   form.license_expiry   || null,
        insurance_expiry: form.insurance_expiry || null,
      };

      if (editTarget) {
        const res = await fetch(`/api/subcontractors/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const d = await res.json();
          setSubs(prev => prev.map(s => s.id === editTarget.id ? d.subcontractor : s));
        }
      } else {
        const res = await fetch("/api/subcontractors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const d = await res.json();
          setSubs(prev => [d.subcontractor, ...prev]);
        }
      }
      setSlideOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(sub: Subcontractor) {
    if (!confirm(`Delete ${sub.name}? This cannot be undone.`)) return;
    const res = await fetch(`/api/subcontractors/${sub.id}`, { method: "DELETE" });
    if (res.ok) setSubs(prev => prev.filter(s => s.id !== sub.id));
  }

  function copyCode(sub: Subcontractor) {
    navigator.clipboard.writeText(sub.access_code).then(() => {
      setCopiedId(sub.id);
      setTimeout(() => setCopiedId(null), 1800);
    });
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#6B7EFF]/10 flex items-center justify-center">
            <HardHat size={20} className="text-[#6B7EFF]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Subcontractors</h1>
            <p className="text-sm text-muted-foreground">Manage subcontractor access, compliance, and work order assignments</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <a
              href="/subcontractors/portal"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
            >
              <ExternalLink size={13} /> Subcontractor Portal
            </a>
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#6B7EFF] text-white rounded-lg text-sm font-semibold hover:bg-[#5a6ee0] transition-colors"
            >
              <Plus size={14} /> Add Subcontractor
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6 max-w-7xl">
        {/* ── Stats ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total",         value: total,        icon: <Users size={16} className="text-[#6B7EFF]" />,      color: "text-[#6B7EFF]" },
            { label: "Active",        value: active,       icon: <Check size={16} className="text-green-500" />,       color: "text-green-700" },
            { label: "Expiring Soon", value: expiringSoon, icon: <AlertTriangle size={16} className="text-amber-500" />, color: "text-amber-700" },
            { label: "Suspended",     value: suspended,    icon: <Shield size={16} className="text-red-500" />,         color: "text-red-700" },
          ].map(stat => (
            <div key={stat.label} className="bg-white border border-border rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                {stat.icon}
              </div>
              <div>
                <p className={`text-xl font-bold ${stat.color}`}>{loading ? "—" : stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Table ─────────────────────────────────────────────────── */}
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_120px_140px_140px_100px_140px_100px] gap-4 px-4 py-2.5 bg-muted/40 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Name / Company</span>
            <span>Trade</span>
            <span>License Expiry</span>
            <span>Insurance Expiry</span>
            <span>Status</span>
            <span>Access Code</span>
            <span></span>
          </div>

          {loading ? (
            <div className="divide-y divide-border">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="grid grid-cols-[1fr_120px_140px_140px_100px_140px_100px] gap-4 px-4 py-3 items-center animate-pulse">
                  <div className="space-y-1">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                  <div className="h-4 w-20 bg-muted rounded" />
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-5 w-16 bg-muted rounded-full" />
                  <div className="h-7 w-28 bg-muted rounded" />
                  <div className="h-4 w-16 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : subs.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                <HardHat size={26} className="text-muted-foreground" />
              </div>
              <p className="text-base font-semibold text-foreground">No subcontractors yet</p>
              <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-xs">
                Add subcontractors to assign work orders and track their compliance status.
              </p>
              <button
                onClick={openAdd}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#6B7EFF] text-white rounded-lg text-sm font-semibold hover:bg-[#5a6ee0] transition-colors"
              >
                <Plus size={14} /> Add Subcontractor
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {subs.map(sub => (
                <div
                  key={sub.id}
                  className="grid grid-cols-[1fr_120px_140px_140px_100px_140px_100px] gap-4 px-4 py-3 items-center hover:bg-muted/20 transition-colors text-sm"
                >
                  {/* Name + Company */}
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{sub.name}</p>
                    {sub.company && (
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Briefcase size={10} className="shrink-0" /> {sub.company}
                      </p>
                    )}
                    {sub.email && (
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Mail size={10} className="shrink-0" /> {sub.email}
                      </p>
                    )}
                  </div>

                  {/* Trade */}
                  <span className="text-xs text-muted-foreground">{sub.trade ?? "—"}</span>

                  {/* License Expiry */}
                  <ExpiryCell date={sub.license_expiry} />

                  {/* Insurance Expiry */}
                  <ExpiryCell date={sub.insurance_expiry} />

                  {/* Status */}
                  <StatusBadge status={sub.status} />

                  {/* Access Code */}
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold tracking-widest text-foreground bg-muted px-2 py-1 rounded-md select-all">
                      {sub.access_code}
                    </span>
                    <button
                      onClick={() => copyCode(sub)}
                      title="Copy access code"
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      {copiedId === sub.id ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => openEdit(sub)}
                      className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title="Edit"
                    >
                      <FileCheck size={13} />
                    </button>
                    <a
                      href="/subcontractors/portal"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-[#6B7EFF]"
                      title="View their portal"
                    >
                      <ExternalLink size={13} />
                    </a>
                    <button
                      onClick={() => handleDelete(sub)}
                      className="p-1.5 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Add / Edit SlideOver ─────────────────────────────────────── */}
      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={editTarget ? "Edit Subcontractor" : "Add Subcontractor"}
        subtitle={editTarget ? `Editing ${editTarget.name}` : "Add a new subcontractor to your network"}
        size="md"
        footer={
          <SlideOverFooter
            onCancel={() => setSlideOpen(false)}
            onSave={handleSave}
            saveLabel={editTarget ? "Save Changes" : "Add Subcontractor"}
            saving={saving}
            disabled={!form.name.trim()}
          />
        }
      >
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Carlos Ruiz"
              className="w-full h-9 px-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-background"
            />
          </div>

          {/* Company */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Company</label>
            <input
              type="text"
              value={form.company}
              onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
              placeholder="e.g. Ruiz Gate Solutions"
              className="w-full h-9 px-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-background"
            />
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="carlos@example.com"
                className="w-full h-9 px-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-background"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="(305) 555-0100"
                className="w-full h-9 px-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-background"
              />
            </div>
          </div>

          {/* Trade */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Trade</label>
            <div className="relative">
              <select
                value={form.trade}
                onChange={e => setForm(f => ({ ...f, trade: e.target.value }))}
                className="w-full h-9 pl-3 pr-8 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-background appearance-none"
              >
                <option value="">Select a trade…</option>
                {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* License */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">License Number</label>
              <input
                type="text"
                value={form.license_number}
                onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))}
                placeholder="e.g. EC-0001447"
                className="w-full h-9 px-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-background font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">License Expiry</label>
              <input
                type="date"
                value={form.license_expiry}
                onChange={e => setForm(f => ({ ...f, license_expiry: e.target.value }))}
                className="w-full h-9 px-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-background"
              />
            </div>
          </div>

          {/* Insurance */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Insurance Expiry</label>
            <input
              type="date"
              value={form.insurance_expiry}
              onChange={e => setForm(f => ({ ...f, insurance_expiry: e.target.value }))}
              className="w-full h-9 px-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-background"
            />
          </div>

          {/* Info callout */}
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-xs text-blue-700 flex items-start gap-1.5">
              <Key size={12} className="shrink-0 mt-0.5" />
              An 8-character access code will be auto-generated and can be shared with this subcontractor to access their portal at <strong>/subcontractors/portal</strong>.
            </p>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
