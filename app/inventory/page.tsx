"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { DataTable } from "@/components/ui/DataTable";
import { SlideOver, SlideOverFooter } from "@/components/ui/SlideOver";
import type { Column } from "@/components/ui/DataTable";
import {
  Plus,
  X,
  Search,
  AlertTriangle,
  Package,
  ClipboardList,
  CheckCircle2,
  XCircle,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Edit2, Truck, Archive, RotateCcw, DollarSign } = require('lucide-react') as any;

// ─── Types ─────────────────────────────────────────────────────────────────────

type StockStatus = "ok" | "low" | "out";
type Tab = "Warehouse" | "Van Stock" | "Purchase Orders";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  sku: string | null;
  on_hand: number;
  on_truck: number;
  min_stock: number;
  reorder_qty: number;
  location: string | null;
  supplier: string | null;
  unit_cost: number;
  unit_price: number;
  status: StockStatus;
}

interface PurchaseOrder {
  id: string;
  po_number: string | null;
  supplier: string | null;
  status: string;
  total: number;
  created_at: string;
  ordered_at: string | null;
  expected_at: string | null;
}

interface ItemFormState {
  name: string;
  sku: string;
  category: string;
  description: string;
  unit_cost: string;
  unit_price: string;
  on_hand: string;
  on_truck: string;
  min_stock: string;
  reorder_qty: string;
  location: string;
  supplier: string;
  supplier_sku: string;
}

const EMPTY_FORM: ItemFormState = {
  name: "", sku: "", category: "Other", description: "",
  unit_cost: "0", unit_price: "0", on_hand: "0", on_truck: "0",
  min_stock: "0", reorder_qty: "1", location: "", supplier: "", supplier_sku: "",
};

const CATEGORIES = [
  "All",
  "Cameras",
  "Gate Hardware",
  "Access Control",
  "Networking",
  "Tools & Consumables",
  "Other",
];

const TABS: Tab[] = ["Warehouse", "Van Stock", "Purchase Orders"];

// ─── Config ────────────────────────────────────────────────────────────────────

const categoryColor: Record<string, string> = {
  Cameras:              "bg-blue-100 text-blue-700",
  "Gate Hardware":      "bg-orange-100 text-orange-700",
  "Access Control":     "bg-violet-100 text-violet-700",
  Networking:           "bg-teal-100 text-teal-700",
  "Tools & Consumables": "bg-slate-100 text-slate-600",
  Other:                "bg-gray-100 text-gray-600",
};

const statusConfig: Record<StockStatus, { badge: string; icon: React.ReactNode; label: string }> = {
  ok:  { badge: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 size={13} className="text-emerald-600" />, label: "OK"           },
  low: { badge: "bg-amber-100 text-amber-700",     icon: <AlertTriangle size={13} className="text-amber-500" />,  label: "Low"          },
  out: { badge: "bg-red-100 text-red-700",          icon: <XCircle size={13} className="text-red-500" />,          label: "Out of Stock" },
};

const poStatusConfig: Record<string, { badge: string; label: string }> = {
  draft:     { badge: "bg-slate-100 text-slate-600",    label: "Draft"     },
  sent:      { badge: "bg-blue-100 text-blue-700",      label: "Sent"      },
  confirmed: { badge: "bg-violet-100 text-violet-700",  label: "Confirmed" },
  partial:   { badge: "bg-amber-100 text-amber-700",    label: "Partial"   },
  received:  { badge: "bg-emerald-100 text-emerald-700", label: "Received" },
  cancelled: { badge: "bg-red-100 text-red-700",        label: "Cancelled" },
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso + (iso.length === 10 ? "T12:00:00" : "")).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ─── Add / Edit Slide-Over ────────────────────────────────────────────────────

interface ItemSlideOverProps {
  open: boolean;
  initial?: InventoryItem | null;
  onClose: () => void;
  onSaved: (item: InventoryItem) => void;
}

function ItemSlideOver({ open, initial, onClose, onSaved }: ItemSlideOverProps) {
  const [form, setForm] = useState<ItemFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  useEffect(() => {
    if (initial) {
      setForm({
        name:         initial.name,
        sku:          initial.sku          ?? "",
        category:     initial.category,
        description:  "",
        unit_cost:    String(initial.unit_cost),
        unit_price:   String(initial.unit_price),
        on_hand:      String(initial.on_hand),
        on_truck:     String(initial.on_truck),
        min_stock:    String(initial.min_stock),
        reorder_qty:  String(initial.reorder_qty),
        location:     initial.location     ?? "",
        supplier:     initial.supplier     ?? "",
        supplier_sku: "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError("");
  }, [initial, open]);

  const set = (k: keyof ItemFormState, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    try {
      const payload = {
        name:         form.name.trim(),
        sku:          form.sku.trim()          || null,
        category:     form.category,
        description:  form.description.trim()  || null,
        unit_cost:    parseFloat(form.unit_cost)  || 0,
        unit_price:   parseFloat(form.unit_price) || 0,
        on_hand:      parseInt(form.on_hand)      || 0,
        on_truck:     parseInt(form.on_truck)     || 0,
        min_stock:    parseInt(form.min_stock)    || 0,
        reorder_qty:  parseInt(form.reorder_qty)  || 1,
        location:     form.location.trim()    || null,
        supplier:     form.supplier.trim()    || null,
        supplier_sku: form.supplier_sku.trim() || null,
      };

      const url    = initial ? `/api/inventory/${initial.id}` : "/api/inventory";
      const method = initial ? "PATCH" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      onSaved(json);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const inp = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white";
  const lbl = "block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5";

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={initial ? "Edit Item" : "Add Inventory Item"}
      size="md"
      footer={
        <SlideOverFooter
          onCancel={onClose}
          onSave={handleSubmit}
          saving={saving}
          saveLabel={initial ? "Save Changes" : "Add Item"}
        />
      }
    >
      <div className="space-y-4">
        <div>
          <label className={lbl}>Name *</label>
          <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Brivo ACS300 Controller" className={inp} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>SKU</label>
            <input value={form.sku} onChange={e => set("sku", e.target.value)} placeholder="e.g. AC-ACS300" className={inp} />
          </div>
          <div>
            <label className={lbl}>Category</label>
            <select value={form.category} onChange={e => set("category", e.target.value)} className={inp}>
              {CATEGORIES.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Unit Cost ($)</label>
            <input type="number" step="0.01" min="0" value={form.unit_cost} onChange={e => set("unit_cost", e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>Unit Price ($)</label>
            <input type="number" step="0.01" min="0" value={form.unit_price} onChange={e => set("unit_price", e.target.value)} className={inp} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>On Hand (Warehouse)</label>
            <input type="number" min="0" value={form.on_hand} onChange={e => set("on_hand", e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>On Truck (Van)</label>
            <input type="number" min="0" value={form.on_truck} onChange={e => set("on_truck", e.target.value)} className={inp} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Min Stock (reorder at)</label>
            <input type="number" min="0" value={form.min_stock} onChange={e => set("min_stock", e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>Reorder Qty</label>
            <input type="number" min="1" value={form.reorder_qty} onChange={e => set("reorder_qty", e.target.value)} className={inp} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Location / Shelf</label>
            <input value={form.location} onChange={e => set("location", e.target.value)} placeholder="e.g. Shelf A3" className={inp} />
          </div>
          <div>
            <label className={lbl}>Supplier</label>
            <input value={form.supplier} onChange={e => set("supplier", e.target.value)} placeholder="e.g. Brivo" className={inp} />
          </div>
        </div>

        <div>
          <label className={lbl}>Supplier SKU</label>
          <input value={form.supplier_sku} onChange={e => set("supplier_sku", e.target.value)} placeholder="Supplier's part number" className={inp} />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 rounded-xl px-3 py-2">
            <AlertTriangle size={13} /> {error}
          </div>
        )}
      </div>
    </SlideOver>
  );
}

// ─── Adjust Stock Modal ───────────────────────────────────────────────────────

interface AdjustModalProps {
  item: InventoryItem;
  location: "warehouse" | "truck";
  onClose: () => void;
  onAdjusted: (item: InventoryItem) => void;
}

function AdjustModal({ item, location, onClose, onAdjusted }: AdjustModalProps) {
  const [type, setType]   = useState<"add" | "remove" | "set">("add");
  const [qty, setQty]     = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]  = useState("");

  const current = location === "truck" ? item.on_truck : item.on_hand;

  const handleSubmit = async () => {
    const numQty = parseInt(qty);
    if (isNaN(numQty) || numQty < 0) { setError("Enter a valid quantity"); return; }
    setSaving(true); setError("");
    try {
      const res  = await fetch(`/api/inventory/${item.id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, qty: numQty, location }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Adjust failed");
      onAdjusted(json);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Adjust failed");
    } finally {
      setSaving(false);
    }
  };

  const inp = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white";

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-80 p-5" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Adjust {location === "truck" ? "Van" : "Warehouse"} Stock</h3>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X size={14} className="text-slate-500" /></button>
          </div>
          <p className="text-xs text-slate-500 mb-3">{item.name} — Current: <span className="font-bold text-slate-800">{current}</span></p>

          <div className="flex gap-2 mb-3">
            {(["add", "remove", "set"] as const).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={cn("flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors capitalize",
                  type === t ? "bg-[#2563EB] text-white border-[#2563EB]" : "border-slate-200 text-slate-600 hover:border-blue-300")}>
                {t}
              </button>
            ))}
          </div>

          <input type="number" min="0" value={qty} onChange={e => setQty(e.target.value)}
            placeholder={type === "set" ? "Set exact qty" : "Quantity"}
            className={inp} />

          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

          <div className="flex gap-2 mt-4">
            <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSubmit} disabled={saving || !qty}
              className="flex-1 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50">
              {saving ? "Saving…" : "Apply"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [activeTab, setActiveTab]       = useState<Tab>("Warehouse");
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch]             = useState("");

  // Data
  const [items, setItems]               = useState<InventoryItem[]>([]);
  const [pos, setPos]                   = useState<PurchaseOrder[]>([]);
  const [loading, setLoading]           = useState(true);
  const [loadingPos, setLoadingPos]     = useState(false);

  // Tracks inventory item IDs that have a pending PO draft (created during this session)
  const [poPendingIds, setPoPendingIds] = useState<Set<string>>(new Set());

  // Slide-overs / modals
  const [slideOpen, setSlideOpen]       = useState(false);
  const [editItem, setEditItem]         = useState<InventoryItem | null>(null);
  const [adjustItem, setAdjustItem]     = useState<InventoryItem | null>(null);
  const [adjustLocation, setAdjustLocation] = useState<"warehouse" | "truck">("warehouse");

  // Load inventory
  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/inventory");
      const json = await res.json();
      setItems(json.records ?? []);
    } catch (_) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // Load POs
  const loadPOs = useCallback(async () => {
    setLoadingPos(true);
    try {
      const res  = await fetch("/api/purchase-orders");
      const json = await res.json();
      setPos(json.records ?? []);
    } catch (_) {
      // ignore
    } finally {
      setLoadingPos(false);
    }
  }, []);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    if (activeTab === "Purchase Orders") {
      void loadPOs();
    }
  }, [activeTab, loadPOs]);

  // Derived stats
  const lowItems      = items.filter(i => i.status === "low");
  const outItems      = items.filter(i => i.status === "out");
  const vanItems      = items.filter(i => i.on_truck > 0);
  const pendingPOs    = pos.filter(p => ["draft", "sent", "confirmed", "partial"].includes(p.status));

  const stats = [
    { label: "Total SKUs",     value: String(items.length), icon: Package,       color: "text-blue-600",   bg: "bg-blue-50"   },
    { label: "Low Stock",      value: String(lowItems.length + outItems.length), icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Van Stock Items", value: String(vanItems.length), icon: Truck,     color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Pending Orders", value: String(pendingPOs.length), icon: ClipboardList, color: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  // Filter for warehouse tab
  const warehouseItems = items.filter(item => {
    const matchesCat  = activeCategory === "All" || item.category === activeCategory;
    const matchesSearch = !search
      || item.name.toLowerCase().includes(search.toLowerCase())
      || (item.sku ?? "").toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Filter for van tab
  const truckItems = items.filter(item => {
    const matchesSearch = !search
      || item.name.toLowerCase().includes(search.toLowerCase())
      || (item.sku ?? "").toLowerCase().includes(search.toLowerCase());
    return item.on_truck > 0 && matchesSearch;
  });

  const handleItemSaved = (saved: InventoryItem) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    // If the saved item is now below min_stock, auto-create a PO draft
    if (saved.on_hand < saved.min_stock) {
      void (async () => {
        try {
          const res = await fetch('/api/purchase-orders', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              supplier: saved.supplier ?? null,
              status:   'draft',
              items: [{
                inventory_item_id: saved.id,
                name:     saved.name,
                sku:      saved.sku ?? null,
                qty:      saved.reorder_qty ?? 1,
                unit_cost: saved.unit_cost ?? 0,
              }],
            }),
          });
          if (res.ok) {
            const po = await res.json();
            setPos(prev => [po, ...prev]);
            setPoPendingIds(prev => new Set([...prev, saved.id]));
          }
        } catch (_) { /* non-blocking */ }
      })();
    }
  };

  const alertCount = lowItems.length + outItems.length;

  return (
    <div className="min-h-screen bg-[#f0f2f5] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
        <div className="flex items-center gap-3 flex-1 max-w-xl ml-auto">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search parts, SKUs…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 placeholder-slate-400 shadow-sm"
            />
          </div>
          <button
            onClick={() => { setEditItem(null); setSlideOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-700 transition-colors shadow-sm shrink-0"
          >
            <Plus size={15} />
            Add Item
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alertCount > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5">
          <AlertTriangle size={17} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            {alertCount} {alertCount === 1 ? "item" : "items"} below minimum stock level —{" "}
            <span className="font-semibold">Reorder recommended</span>
          </p>
          <button
            onClick={() => setActiveCategory("All")}
            className="ml-auto text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2 shrink-0"
          >
            View all
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-500 font-medium">{s.label}</span>
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", s.bg)}>
                <s.icon size={16} className={s.color} />
              </div>
            </div>
            <p className={cn("text-3xl font-bold", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs + Table Card */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Tab Bar */}
        <div className="flex border-b border-slate-100 px-4 pt-1">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Warehouse Tab ── */}
        {activeTab === "Warehouse" && (
          <>
            {/* Category Pills */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-50 overflow-x-auto">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap transition-colors",
                    activeCategory === cat
                      ? "bg-[#2563EB] text-white border-[#2563EB]"
                      : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                  )}
                >
                  {cat}
                </button>
              ))}
              <span className="ml-auto text-xs text-slate-400 shrink-0">
                {warehouseItems.length} items
              </span>
            </div>

            <DataTable<InventoryItem>
              rowKey="id"
              loading={loading}
              data={warehouseItems}
              className="rounded-none border-0"
              emptyState={
                <EmptyState
                  icon={<Package size={32} className="text-muted-foreground" />}
                  title="No items in stock"
                  description={items.length === 0 ? "Add your first inventory item to get started" : "No items match your search"}
                />
              }
              columns={[
                {
                  key: "name",
                  label: "Item",
                  sortable: true,
                  render: (_v, row) => (
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        <Archive size={13} className="text-slate-400" />
                      </div>
                      <span className="font-medium text-slate-800">{row.name}</span>
                    </div>
                  ),
                } as Column<InventoryItem>,
                {
                  key: "sku",
                  label: "SKU",
                  render: (v) => v
                    ? <code className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">{String(v)}</code>
                    : <span className="text-slate-300">—</span>,
                } as Column<InventoryItem>,
                {
                  key: "category",
                  label: "Category",
                  render: (v) => (
                    <span className={cn("inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full", categoryColor[String(v)] ?? "bg-gray-100 text-gray-600")}>
                      {String(v)}
                    </span>
                  ),
                } as Column<InventoryItem>,
                {
                  key: "on_hand",
                  label: "On Hand",
                  align: "right",
                  sortable: true,
                  render: (_v, row) => (
                    <span className={cn("font-semibold", row.on_hand === 0 ? "text-red-600" : row.status === "low" ? "text-amber-600" : "text-slate-800")}>
                      {row.on_hand}
                    </span>
                  ),
                } as Column<InventoryItem>,
                {
                  key: "min_stock",
                  label: "Min",
                  align: "right",
                  render: (v) => <span className="text-slate-400">{String(v)}</span>,
                } as Column<InventoryItem>,
                {
                  key: "unit_cost",
                  label: "Unit Cost",
                  align: "right",
                  render: (v) => <span className="text-slate-600">${Number(v).toFixed(2)}</span>,
                } as Column<InventoryItem>,
                {
                  key: "unit_price",
                  label: "Sell Price",
                  align: "right",
                  render: (v) => <span className="text-slate-600">${Number(v).toFixed(2)}</span>,
                } as Column<InventoryItem>,
                {
                  key: "location",
                  label: "Location",
                  render: (v) => <span className="text-slate-500 text-xs">{v ? String(v) : "—"}</span>,
                } as Column<InventoryItem>,
                {
                  key: "status",
                  label: "Status",
                  render: (_v, row) => {
                    const sc = statusConfig[row.status];
                    return (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full", sc.badge)}>
                          {sc.icon}{sc.label}
                        </span>
                        {poPendingIds.has(row.id) && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                            PO Pending
                          </span>
                        )}
                      </div>
                    );
                  },
                } as Column<InventoryItem>,
              ]}
              actions={(row) => (
                <div className="flex items-center gap-1.5 justify-end">
                  <button
                    title="Edit"
                    onClick={() => { setEditItem(row); setSlideOpen(true); }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    title="Adjust Stock"
                    onClick={() => { setAdjustItem(row); setAdjustLocation("warehouse"); }}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      row.status !== "ok"
                        ? "bg-blue-50 text-[#2563EB] hover:bg-blue-100"
                        : "hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <RotateCcw size={13} />
                  </button>
                </div>
              )}
            />
          </>
        )}

        {/* ── Van Stock Tab ── */}
        {activeTab === "Van Stock" && (
          <>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
              <span className="text-xs text-slate-400">{truckItems.length} items on trucks</span>
            </div>

            <DataTable<InventoryItem>
              rowKey="id"
              loading={loading}
              data={truckItems}
              className="rounded-none border-0"
              emptyState={
                <EmptyState
                  icon={<Truck size={32} className="text-muted-foreground" />}
                  title="No van stock items yet"
                  description="Items with on_truck > 0 will appear here"
                />
              }
              columns={[
                {
                  key: "name",
                  label: "Item",
                  sortable: true,
                  render: (_v, row) => (
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                        <Truck size={13} className="text-violet-400" />
                      </div>
                      <span className="font-medium text-slate-800">{row.name}</span>
                    </div>
                  ),
                } as Column<InventoryItem>,
                {
                  key: "sku",
                  label: "SKU",
                  render: (v) => v
                    ? <code className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">{String(v)}</code>
                    : <span className="text-slate-300">—</span>,
                } as Column<InventoryItem>,
                {
                  key: "category",
                  label: "Category",
                  render: (v) => (
                    <span className={cn("inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full", categoryColor[String(v)] ?? "bg-gray-100 text-gray-600")}>
                      {String(v)}
                    </span>
                  ),
                } as Column<InventoryItem>,
                {
                  key: "on_truck",
                  label: "On Truck",
                  align: "right",
                  sortable: true,
                  render: (v) => <span className="font-semibold text-violet-600">{String(v)}</span>,
                } as Column<InventoryItem>,
                {
                  key: "on_hand",
                  label: "On Hand",
                  align: "right",
                  sortable: true,
                  render: (v) => <span className="text-slate-500">{String(v)}</span>,
                } as Column<InventoryItem>,
              ]}
              actions={(row) => (
                <div className="flex items-center gap-1.5 justify-end">
                  <button
                    title="Edit"
                    onClick={() => { setEditItem(row); setSlideOpen(true); }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    title="Adjust Van Stock"
                    onClick={() => { setAdjustItem(row); setAdjustLocation("truck"); }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <RotateCcw size={13} />
                  </button>
                </div>
              )}
            />
          </>
        )}

        {/* ── Purchase Orders Tab ── */}
        {activeTab === "Purchase Orders" && (
          <>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
              <span className="text-xs text-slate-400">{pos.length} purchase orders</span>
              <button
                onClick={async () => {
                  const res  = await fetch("/api/purchase-orders", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "draft" }),
                  });
                  if (res.ok) {
                    const json = await res.json();
                    setPos(prev => [json, ...prev]);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus size={12} /> New PO
              </button>
            </div>

            <DataTable<PurchaseOrder>
              rowKey="id"
              loading={loadingPos}
              data={pos}
              className="rounded-none border-0"
              emptyState={
                <EmptyState
                  icon={<ClipboardList size={32} className="text-muted-foreground" />}
                  title="No purchase orders yet"
                  description="Create a new PO to track orders from suppliers"
                />
              }
              columns={[
                {
                  key: "po_number",
                  label: "PO #",
                  sortable: true,
                  render: (_v, row) => (
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                        <DollarSign size={13} className="text-emerald-500" />
                      </div>
                      <code className="text-xs text-slate-600 font-mono">
                        {row.po_number ?? row.id.slice(0, 8).toUpperCase()}
                      </code>
                    </div>
                  ),
                } as Column<PurchaseOrder>,
                {
                  key: "supplier",
                  label: "Supplier",
                  sortable: true,
                  render: (v) => <span className="text-slate-700">{v ? String(v) : "—"}</span>,
                } as Column<PurchaseOrder>,
                {
                  key: "status",
                  label: "Status",
                  render: (v) => {
                    const psc = poStatusConfig[String(v)] ?? { badge: "bg-slate-100 text-slate-600", label: String(v) };
                    return (
                      <span className={cn("inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full", psc.badge)}>
                        {psc.label}
                      </span>
                    );
                  },
                } as Column<PurchaseOrder>,
                {
                  key: "total",
                  label: "Total",
                  align: "right",
                  render: (v) => {
                    const n = Number(v);
                    return <span className="font-semibold text-slate-800">{n > 0 ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</span>;
                  },
                } as Column<PurchaseOrder>,
                {
                  key: "ordered_at",
                  label: "Ordered",
                  sortable: true,
                  render: (v) => <span className="text-xs text-slate-500">{fmtDate(v as string | null)}</span>,
                } as Column<PurchaseOrder>,
                {
                  key: "expected_at",
                  label: "Expected",
                  render: (v) => <span className="text-xs text-slate-500">{fmtDate(v as string | null)}</span>,
                } as Column<PurchaseOrder>,
              ]}
            />
          </>
        )}
      </div>

      {/* Add / Edit Slide-Over */}
      <ItemSlideOver
        open={slideOpen}
        initial={editItem}
        onClose={() => { setSlideOpen(false); setEditItem(null); }}
        onSaved={item => { handleItemSaved(item); setSlideOpen(false); setEditItem(null); }}
      />

      {/* Adjust Stock Modal */}
      {adjustItem && (
        <AdjustModal
          item={adjustItem}
          location={adjustLocation}
          onClose={() => setAdjustItem(null)}
          onAdjusted={item => { handleItemSaved(item); setAdjustItem(null); }}
        />
      )}
    </div>
  );
}
