"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, Mail, Phone, FileText, X,
  Loader2, Check, Users, Trash2,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DollarSign, Edit2, AlertCircle, Building2: BuildingIcon, UserCheck, Save } = require("lucide-react") as any;

// ─── Types ────────────────────────────────────────────────────────────────────

type VendorType = "supplier" | "subcontractor" | "both";
type PaymentTerms = "net15" | "net30" | "net60" | "cod" | "prepaid";
type BillStatus = "draft" | "open" | "paid" | "overdue" | "void";

interface Bill {
  id: string;
  bill_number: string;
  bill_date: string;
  due_date: string;
  status: BillStatus;
  total: number;
  amount_paid: number;
  balance: number;
}

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
  bills?: Bill[];
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

const BILL_STATUS_STYLES: Record<BillStatus, string> = {
  draft: "bg-gray-100 text-gray-500",
  open: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  void: "bg-gray-100 text-gray-400",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Edit Slide-over ──────────────────────────────────────────────────────────

interface EditSlideOverProps {
  open: boolean;
  vendor: Vendor;
  onClose: () => void;
  onSaved: (v: Vendor) => void;
}

function EditVendorSlideOver({ open, vendor, onClose, onSaved }: EditSlideOverProps) {
  const [form, setForm] = useState({
    name: vendor.name,
    type: vendor.type,
    contact_name: vendor.contact_name ?? "",
    email: vendor.email ?? "",
    phone: vendor.phone ?? "",
    payment_terms: vendor.payment_terms,
    notes: vendor.notes ?? "",
    is_1099: vendor.is_1099,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({
        name: vendor.name,
        type: vendor.type,
        contact_name: vendor.contact_name ?? "",
        email: vendor.email ?? "",
        phone: vendor.phone ?? "",
        payment_terms: vendor.payment_terms,
        notes: vendor.notes ?? "",
        is_1099: vendor.is_1099,
      });
      setError(null);
    }
  }, [open, vendor]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Vendor name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/vendors/${vendor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
      const updated = await res.json();
      onSaved(updated);
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
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Edit Vendor</h2>
            <p className="text-sm text-gray-500 mt-0.5">{vendor.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        <form id="edit-vendor-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}

          {[
            { label: "Vendor Name", field: "name", type: "text", required: true },
            { label: "Contact Name", field: "contact_name", type: "text" },
            { label: "Email", field: "email", type: "email" },
            { label: "Phone", field: "phone", type: "tel" },
          ].map(({ label, field, type, required }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
              </label>
              <input
                type={type}
                value={form[field as keyof typeof form] as string}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/50 focus:border-[#6B7EFF]"
              />
            </div>
          ))}

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/50 focus:border-[#6B7EFF] resize-none"
            />
          </div>

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

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            form="edit-vendor-form"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
            style={{ background: "#6B7EFF" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VendorDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "bills" | "work-orders">("overview");
  const [markingCustomer, setMarkingCustomer] = useState(false);

  const fetchVendor = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/vendors/${params.id}`);
      if (res.ok) setVendor(await res.json());
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { fetchVendor(); }, [fetchVendor]);

  async function markAsCustomer() {
    if (!vendor) return;
    setMarkingCustomer(true);
    try {
      const res = await fetch(`/api/vendors/${vendor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_also_customer: true }),
      });
      if (res.ok) setVendor(v => v ? { ...v, is_also_customer: true } : v);
    } finally {
      setMarkingCustomer(false);
    }
  }

  async function handleDelete() {
    if (!vendor) return;
    if (!confirm(`Delete ${vendor.name}? This cannot be undone.`)) return;
    const res = await fetch(`/api/vendors/${vendor.id}`, { method: "DELETE" });
    if (res.ok) router.push("/vendors");
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#F8FAFC] px-8 pt-8">
        <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="h-10 w-64 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-white border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="flex flex-col min-h-screen bg-[#F8FAFC] items-center justify-center">
        <p className="text-gray-500">Vendor not found.</p>
        <Link href="/vendors" className="mt-4 text-sm text-[#6B7EFF] hover:underline">← Back to Vendors</Link>
      </div>
    );
  }

  const bills = vendor.bills ?? [];

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      {/* ── Back ─────────────────────────────────────────────────────────────── */}
      <div className="px-8 pt-6">
        <Link href="/vendors" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ChevronLeft size={16} /> Vendors
        </Link>
      </div>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="px-8 pt-4 pb-4 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#6B7EFF]/10 flex items-center justify-center">
            <Users size={22} className="text-[#6B7EFF]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                {vendor.name}
              </h1>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_COLORS[vendor.type]}`}>
                {TYPE_LABELS[vendor.type]}
              </span>
              {vendor.is_active ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Inactive
                </span>
              )}
            </div>
            {vendor.contact_name && (
              <p className="text-sm text-gray-500 mt-0.5">{vendor.contact_name}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Edit2 size={14} /> Edit
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {/* ── "Also a Customer" banner ─────────────────────────────────────────── */}
      <div className="px-8 pb-4">
        {vendor.is_also_customer ? (
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
            <Check size={14} className="shrink-0" />
            Also a Customer — this vendor has a linked customer record
          </div>
        ) : (
          <button
            onClick={markAsCustomer}
            disabled={markingCustomer}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {markingCustomer ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
            Mark as Customer
          </button>
        )}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="px-8 border-b border-gray-200">
        <div className="flex items-center gap-1">
          {[
            { key: "overview", label: "Overview" },
            { key: "bills", label: `Bills (${bills.length})` },
            { key: "work-orders", label: "Work Orders" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-[#6B7EFF] text-[#6B7EFF]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────────── */}
      <div className="px-8 py-6 flex-1">

        {/* ── Overview ── */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Contact info */}
            <div className="bg-white border border-border rounded-xl p-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Contact</h3>
              <div className="space-y-3">
                {vendor.contact_name && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Users size={14} className="text-gray-400 shrink-0" />
                    {vendor.contact_name}
                  </div>
                )}
                {vendor.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Mail size={14} className="text-gray-400 shrink-0" />
                    <a href={`mailto:${vendor.email}`} className="text-[#6B7EFF] hover:underline">{vendor.email}</a>
                  </div>
                )}
                {vendor.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Phone size={14} className="text-gray-400 shrink-0" />
                    <a href={`tel:${vendor.phone}`} className="hover:underline">{vendor.phone}</a>
                  </div>
                )}
                {!vendor.contact_name && !vendor.email && !vendor.phone && (
                  <p className="text-sm text-gray-400 italic">No contact info on file</p>
                )}
              </div>
            </div>

            {/* Financial */}
            <div className="bg-white border border-border rounded-xl p-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Financial</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">AP Balance</span>
                  <span className="text-sm font-bold text-gray-900">{fmt(vendor.ap_balance ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Bills</span>
                  <span className="text-sm font-medium text-gray-700">{vendor.bills_count ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Payment Terms</span>
                  <span className="text-sm font-medium text-gray-700">{TERMS_LABELS[vendor.payment_terms]}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">1099</span>
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    vendor.is_1099 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {vendor.is_1099 ? "Yes — issues 1099" : "No"}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {vendor.notes && (
              <div className="bg-white border border-border rounded-xl p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Notes</h3>
                <p className="text-sm text-gray-700 whitespace-pre-line">{vendor.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Bills ── */}
        {activeTab === "bills" && (
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Bill #", "Date", "Due Date", "Status", "Total", "Paid", "Balance"].map(col => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bills.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <FileText size={32} className="text-gray-300" />
                        <p className="font-semibold text-gray-500">No bills yet</p>
                        <p className="text-sm">Bills from this vendor will appear here.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  bills.map(bill => (
                    <tr key={bill.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">{bill.bill_number}</td>
                      <td className="px-4 py-3 text-gray-600">{fmtDate(bill.bill_date)}</td>
                      <td className="px-4 py-3 text-gray-600">{fmtDate(bill.due_date)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${BILL_STATUS_STYLES[bill.status]}`}>
                          {bill.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{fmt(bill.total)}</td>
                      <td className="px-4 py-3 text-green-600">{fmt(bill.amount_paid)}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{fmt(bill.balance)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Work Orders ── */}
        {activeTab === "work-orders" && (
          <div className="bg-white border border-border rounded-xl p-16 flex flex-col items-center justify-center text-center">
            <FileText size={36} className="text-gray-300 mb-3" />
            <p className="font-semibold text-gray-500">No work orders yet</p>
            <p className="text-sm text-gray-400 mt-1">Work orders from this vendor will appear here.</p>
          </div>
        )}
      </div>

      {/* ── Edit slide-over ───────────────────────────────────────────────────── */}
      {vendor && (
        <EditVendorSlideOver
          open={editOpen}
          vendor={vendor}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            setVendor(updated);
            setEditOpen(false);
          }}
        />
      )}
    </div>
  );
}
