"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  AlertTriangle,
  Package,
  ClipboardList,
  CheckCircle2,
  XCircle,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Edit2, Truck, Archive, RotateCcw } = require('lucide-react') as any;

// ─── Mock Data ────────────────────────────────────────────────────────────────

type StockStatus = "OK" | "Low" | "Out of Stock";
type Category = "Cameras" | "Gate Hardware" | "Access Control" | "Networking" | "Tools & Consumables";
type Tab = "Warehouse" | "Van Stock" | "Purchase Orders";

interface InventoryItem {
  id: string;
  name: string;
  category: Category;
  sku: string;
  onHand: number;
  minStock: number;
  location: string;
  status: StockStatus;
}

const MOCK_INVENTORY: InventoryItem[] = [
  {
    id: "i01",
    name: "EagleEye 4MP Dome Camera",
    category: "Cameras",
    sku: "EE-4MP-DOME",
    onHand: 24,
    minStock: 10,
    location: "Shelf A3",
    status: "OK",
  },
  {
    id: "i02",
    name: "EagleEye 8MP Bullet",
    category: "Cameras",
    sku: "EE-8MP-BULL",
    onHand: 8,
    minStock: 10,
    location: "Shelf A4",
    status: "Low",
  },
  {
    id: "i03",
    name: "Swing Gate Operator (FAAC)",
    category: "Gate Hardware",
    sku: "GH-FAAC-SWG",
    onHand: 3,
    minStock: 5,
    location: "Shelf B1",
    status: "Low",
  },
  {
    id: "i04",
    name: "Slide Gate Motor (Linear)",
    category: "Gate Hardware",
    sku: "GH-LIN-SLD",
    onHand: 6,
    minStock: 4,
    location: "Shelf B2",
    status: "OK",
  },
  {
    id: "i05",
    name: "Brivo ACS300 Controller",
    category: "Access Control",
    sku: "AC-ACS300",
    onHand: 0,
    minStock: 2,
    location: "Shelf C1",
    status: "Out of Stock",
  },
  {
    id: "i06",
    name: "Cat6 Ethernet Cable 500ft",
    category: "Networking",
    sku: "NET-CAT6-500",
    onHand: 12,
    minStock: 5,
    location: "Shelf D2",
    status: "OK",
  },
  {
    id: "i07",
    name: "PoE Injector 30W",
    category: "Networking",
    sku: "NET-POE-30W",
    onHand: 18,
    minStock: 8,
    location: "Shelf D3",
    status: "OK",
  },
  {
    id: "i08",
    name: 'Conduit 1" EMT 10ft',
    category: "Tools & Consumables",
    sku: "TC-COND-1EMT",
    onHand: 45,
    minStock: 20,
    location: "Shelf E1",
    status: "OK",
  },
  {
    id: "i09",
    name: "Wire Nuts (100pk)",
    category: "Tools & Consumables",
    sku: "TC-WNUT-100",
    onHand: 22,
    minStock: 10,
    location: "Shelf E3",
    status: "OK",
  },
  {
    id: "i10",
    name: "Keypad Reader (HID)",
    category: "Access Control",
    sku: "AC-HID-KPD",
    onHand: 5,
    minStock: 3,
    location: "Shelf C2",
    status: "OK",
  },
  {
    id: "i11",
    name: "Network Switch 8-port",
    category: "Networking",
    sku: "NET-SW-8P",
    onHand: 4,
    minStock: 4,
    location: "Shelf D1",
    status: "OK",
  },
  {
    id: "i12",
    name: "Solar Panel 20W (gate backup)",
    category: "Gate Hardware",
    sku: "GH-SOLAR-20",
    onHand: 9,
    minStock: 4,
    location: "Shelf B4",
    status: "OK",
  },
];

const CATEGORIES: (Category | "All")[] = [
  "All",
  "Cameras",
  "Gate Hardware",
  "Access Control",
  "Networking",
  "Tools & Consumables",
];

const TABS: Tab[] = ["Warehouse", "Van Stock", "Purchase Orders"];

// ─── Config ───────────────────────────────────────────────────────────────────

const categoryColor: Record<Category, string> = {
  Cameras: "bg-blue-100 text-blue-700",
  "Gate Hardware": "bg-orange-100 text-orange-700",
  "Access Control": "bg-violet-100 text-violet-700",
  Networking: "bg-teal-100 text-teal-700",
  "Tools & Consumables": "bg-slate-100 text-slate-600",
};

const statusConfig: Record<StockStatus, { badge: string; icon: React.ReactNode }> = {
  OK: {
    badge: "bg-emerald-100 text-emerald-700",
    icon: <CheckCircle2 size={13} className="text-emerald-600" />,
  },
  Low: {
    badge: "bg-amber-100 text-amber-700",
    icon: <AlertTriangle size={13} className="text-amber-500" />,
  },
  "Out of Stock": {
    badge: "bg-red-100 text-red-700",
    icon: <XCircle size={13} className="text-red-500" />,
  },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Warehouse");
  const [activeCategory, setActiveCategory] = useState<Category | "All">("All");
  const [search, setSearch] = useState("");

  const stats = [
    { label: "Total SKUs", value: "147", icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
    {
      label: "Low Stock",
      value: "3",
      icon: AlertTriangle,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Van Stock Items",
      value: "89",
      icon: Truck,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      label: "Pending Orders",
      value: "2",
      icon: ClipboardList,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
  ];

  const filteredItems = MOCK_INVENTORY.filter((item) => {
    const matchesCategory = activeCategory === "All" || item.category === activeCategory;
    const matchesSearch =
      search === "" ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#f0f2f5] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
        <div className="flex items-center gap-3 flex-1 max-w-xl ml-auto">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search parts, SKUs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 placeholder-slate-400 shadow-sm"
            />
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-700 transition-colors shadow-sm shrink-0">
            <Plus size={15} />
            Add Item
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5">
        <AlertTriangle size={17} className="text-amber-500 shrink-0" />
        <p className="text-sm text-amber-800 font-medium">
          3 items below minimum stock level —{" "}
          <span className="font-semibold">Reorder recommended</span>
        </p>
        <button className="ml-auto text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2 shrink-0">
          View all
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
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
          {TABS.map((tab) => (
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

        {activeTab === "Warehouse" ? (
          <>
            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-50 overflow-x-auto">
              {CATEGORIES.map((cat) => (
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
                {filteredItems.length} items
              </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">
                      Part Name
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                      Category
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                      SKU
                    </th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                      On Hand
                    </th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                      Min
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                      Location
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                      Status
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredItems.map((item) => {
                    const sc = statusConfig[item.status];
                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          "hover:bg-slate-50/80 transition-colors",
                          item.status === "Out of Stock" && "bg-red-50/40",
                          item.status === "Low" && "bg-amber-50/30"
                        )}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                              <Archive size={13} className="text-slate-400" />
                            </div>
                            <span className="font-medium text-slate-800">{item.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={cn(
                              "inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full",
                              categoryColor[item.category]
                            )}
                          >
                            {item.category}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <code className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                            {item.sku}
                          </code>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span
                            className={cn(
                              "font-semibold",
                              item.onHand === 0
                                ? "text-red-600"
                                : item.onHand < item.minStock
                                ? "text-amber-600"
                                : "text-slate-800"
                            )}
                          >
                            {item.onHand}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right text-slate-400">{item.minStock}</td>
                        <td className="px-4 py-3.5 text-slate-500 text-xs">{item.location}</td>
                        <td className="px-4 py-3.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full",
                              sc.badge
                            )}
                          >
                            {sc.icon}
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              title="Edit"
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              title="Reorder"
                              className={cn(
                                "p-1.5 rounded-lg transition-colors",
                                item.status !== "OK"
                                  ? "bg-blue-50 text-[#2563EB] hover:bg-blue-100"
                                  : "hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                              )}
                            >
                              <RotateCcw size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredItems.length === 0 && (
                <div className="py-16 text-center text-slate-400">
                  <Package size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No items match your search</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="py-20 text-center text-slate-400">
            <Truck size={36} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">{activeTab} view coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}
