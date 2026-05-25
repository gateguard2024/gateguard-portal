"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus, X, Search, Package, Users, Mail, Phone,
  FileText, ChevronDown, Loader2, Check,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DollarSign, Edit2, Store, Building2Icon, AlertCircle, Save } = require("lucide-react") as any;

// ─── Types ────────────────────────────────────────────────────────────────────

type VendorType = "supplier" | "subcontractor" | "both";
type PaymentTerms = "net30" | "net60" | "net15" | "cod" | "prepaid";

interface Vendor {
  id: string;
  name: string;
  type: VendorType;
  contact_name?: string;
  email?: string;
  phone?: string;
  payment_terms: PaymentTerms;
  notes?: string;
  is_1099: boolean;
  is_also_customer: boolean;
  ap_balance: number;
  bills_count: number;
  is_active: boolean;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<VendorType, string> = {
  supplier: "Supplier",
  subcontractor: "Subcontractor",
  both: "Both",
};

const TYPE_COLORS: Record<VendorType, string> = {
  supplier: "bg-blue-100 text-blue-700",
  subcontractor: "bg-purple-100 text-purple-700",
  both: "bg-emerald-100 text-emerald-700",
};

const TERMS_LABELS: Record<PaymentTerms, string> = {
  net15: "Net 15",
  net30: "Net 30",
  net60: "Net 60",
  cod: "COD",
  prepaid: "Prepaid",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${60 + (i * 17) % 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Type Badge ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: VendorType }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_COLORS[type]}`}>
      {TYPE_LABELS[type]}
    </span>
  );
}

// ─── Slide-over Form ──────────────────────────────────────────────────────────

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY_FORM = {
  name: "",
  type: "supplier" as VendorType,
  contact_name: "",
  email: "",
  phone: "",
  payment_terms: "net30" as PaymentTerms,
  notes: "",
  is_1099: false,
};

function NewVendorSlideOver({ open, onClose, onSaved }: SlideOverProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setForm(EMPTY_FORM); setError(null); }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Vendor name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create vendor");
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">New Vendor</h2>
            <p className="text-sm text-gray-500 mt-0.5">Add a supplier or subcontractor</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form id="vendor-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendor Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. ACCO Brands, ABC Electric"
              className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/50 focus:border-[#6B7EFF]"
              required
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as VendorType }))}
              className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/50 focus:border-[#6B7EFF] bg-white"
            >
              <option value="supplier">Supplier</option>
              <option value="subcontractor">Subcontractor</option>
              <option value="both">Both</option>
            </select>
          </div>

          {/* Contact Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
            <input
              type="text"
              value={form.contact_name}
              onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
              placeholder="Primary contact"
              className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/50 focus:border-[#6B7EFF]"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="vendor@example.com"
              className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/50 focus:border-[#6B7EFF]"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="(555) 000-0000"
              className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/50 focus:border-[#6B7EFF]"
            />
          </div>

          {/* Payment Terms */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
            <select
              value={form.payment_terms}
              onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value as PaymentTerms }))}
              className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/50 focus:border-[#6B7EFF] bg-white"
            >
              <option value="net15">Net 15</option>
              <option value="net30">Net 30</option>
              <option value="net60">Net 60</option>
              <option value="cod">COD</option>
              <option value="prepaid">Prepaid</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any additional notes…"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/50 focus:border-[#6B7EFF] resize-none"
            />
          </div>

          {/* 1099 */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, is_1099: !f.is_1099 }))}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                form.is_1099 ? "bg-[#6B7EFF] border-[#6B7EFF]" : "border-gray-300 bg-white"
              }`}
            >
              {form.is_1099 && <Check size={12} className="text-white" />}
            </button>
            <span className="text-sm text-gray-700">Issue 1099 to this vendor</span>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="vendor-form"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50"
            style={{ background: "#6B7EFF" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving…" : "Create Vendor"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type FilterTab = "all" | VendorType;

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [slideOver, setSlideOver] = useState(false);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("type", filter);
      if (search) params.set("q", search);
      const res = await fetch(`/api/vendors?${params.toString()}`);
      if (res.ok) setVendors(await res.json());
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  // Stats
  const totalAP = vendors.reduce((s, v) => s + (v.ap_balance ?? 0), 0);
  const activeCount = vendors.filter(v => v.is_active).length;
  const subCount = vendors.filter(v => v.type === "subcontractor" || v.type === "both").length;

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "supplier", label: "Supplier" },
    { key: "subcontractor", label: "Subcontractor" },
    { key: "both", label: "Both" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="px-8 pt-8 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              Vendors
            </h1>
            <p className="text-sm text-gray-500 mt-1">Suppliers, subcontractors, and AP management</p>
          </div>
          <button
            onClick={() => setSlideOver(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm"
            style={{ background: "#6B7EFF" }}
          >
            <Plus size={16} />
            New Vendor
          </button>
        </div>
      </div>

      {/* ── Stats bar ────────────────────────────────────────────────────────── */}
      <div className="px-8 pb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Vendors", value: vendors.length.toString(), icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "AP Balance", value: fmt(totalAP), icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Active", value: activeCount.toString(), icon: Check, color: "text-green-600", bg: "bg-green-50" },
          { label: "Subcontractors", value: subCount.toString(), icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}>
              <stat.icon size={18} className={stat.color} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
              <p className="text-xl font-bold text-gray-900 leading-tight">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters + Search ─────────────────────────────────────────────────── */}
      <div className="px-8 pb-4 flex items-center gap-4 flex-wrap">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-white border border-border rounded-lg p-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                filter === tab.key
                  ? "bg-[#6B7EFF] text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search vendors…"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/50 focus:border-[#6B7EFF]"
          />
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="px-8 pb-8 flex-1">
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Name", "Type", "Email", "AP Balance", "Bills", "Terms", "Status", ""].map(col => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : vendors.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <Package size={36} className="text-gray-300" />
                      <p className="font-semibold text-gray-500">No vendors yet</p>
                      <p className="text-sm">Add your first supplier or subcontractor to get started.</p>
                      <button
                        onClick={() => setSlideOver(true)}
                        className="mt-1 flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg"
                        style={{ background: "#6B7EFF" }}
                      >
                        <Plus size={14} /> New Vendor
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                vendors.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/vendors/${v.id}`}
                        className="font-semibold text-[#6B7EFF] hover:underline"
                      >
                        {v.name}
                      </Link>
                      {v.contact_name && (
                        <p className="text-xs text-gray-400 mt-0.5">{v.contact_name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={v.type} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {v.email ? (
                        <a href={`mailto:${v.email}`} className="hover:underline flex items-center gap-1">
                          <Mail size={12} className="text-gray-400 shrink-0" /> {v.email}
                        </a>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {fmt(v.ap_balance ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {v.bills_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {TERMS_LABELS[v.payment_terms] ?? v.payment_terms}
                    </td>
                    <td className="px-4 py-3">
                      {v.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/vendors/${v.id}`}
                        className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-[#6B7EFF] transition-colors"
                      >
                        <Edit2 size={12} /> Edit
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Slide-over ───────────────────────────────────────────────────────── */}
      <NewVendorSlideOver
        open={slideOver}
        onClose={() => setSlideOver(false)}
        onSaved={fetchVendors}
      />
    </div>
  );
}
