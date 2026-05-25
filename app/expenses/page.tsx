"use client";
import { useState } from "react";
import { Plus, Filter, Download, Calendar } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DollarSign, TrendingDown, Receipt, Tag, BarChart3: BarChart3Icon, Upload } = require("lucide-react") as any;

const CATEGORIES = ["All", "Labor", "Parts & Materials", "Fuel & Mileage", "Software & Subscriptions", "Equipment", "Office", "Marketing", "Other"];

const MOCK_EXPENSES = [
  { id: "EXP-001", date: "2026-05-22", vendor: "Home Depot",       category: "Parts & Materials",      amount: 342.17, description: "Gate hardware, conduit fittings",       status: "approved", tech: "Marcus R." },
  { id: "EXP-002", date: "2026-05-21", vendor: "Shell Gas",        category: "Fuel & Mileage",          amount: 87.40,  description: "Field vehicle fuel — Sunset Commons",  status: "approved", tech: "Jay T." },
  { id: "EXP-003", date: "2026-05-20", vendor: "Amazon Business",  category: "Parts & Materials",      amount: 218.55, description: "Control board, relay modules",          status: "pending",  tech: "Marcus R." },
  { id: "EXP-004", date: "2026-05-19", vendor: "Anthropic",        category: "Software & Subscriptions", amount: 250.00, description: "Claude API — May usage",              status: "approved", tech: "System" },
  { id: "EXP-005", date: "2026-05-18", vendor: "Mapbox",           category: "Software & Subscriptions", amount: 49.00,  description: "Maps API — May",                     status: "approved", tech: "System" },
  { id: "EXP-006", date: "2026-05-17", vendor: "Lowe's",           category: "Parts & Materials",      amount: 156.80, description: "Conduit, wire, junction boxes",         status: "approved", tech: "David K." },
  { id: "EXP-007", date: "2026-05-16", vendor: "Uber Eats",        category: "Other",                  amount: 34.22,  description: "Team lunch — site install crew",        status: "pending",  tech: "Marcus R." },
  { id: "EXP-008", date: "2026-05-15", vendor: "Costco Business",  category: "Office",                 amount: 127.44, description: "Office supplies, cleaning",             status: "approved", tech: "Admin" },
  { id: "EXP-009", date: "2026-05-14", vendor: "ADI Global",       category: "Equipment",              amount: 1240.00, description: "Brivo ACS300 controllers ×2",         status: "approved", tech: "David K." },
  { id: "EXP-010", date: "2026-05-13", vendor: "Google Workspace", category: "Software & Subscriptions", amount: 36.00, description: "Business email — 6 seats",           status: "approved", tech: "System" },
];

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  pending:  "bg-amber-500/15 text-amber-400 border-amber-500/20",
  rejected: "bg-red-500/15 text-red-400 border-red-500/20",
};

const SUMMARY = [
  { label: "This Month",   value: "$2,541.58", delta: "+12%", color: "#6B7EFF" },
  { label: "Pending",      value: "$252.77",   delta: "2 items", color: "#F59E0B" },
  { label: "Parts & Matls", value: "$717.52", delta: "28%",    color: "#10B981" },
  { label: "Software",     value: "$335.00",   delta: "13%",   color: "#8B5CF6" },
];

export default function ExpensesPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = MOCK_EXPENSES.filter(e => {
    const matchesCat = activeCategory === "All" || e.category === activeCategory;
    const matchesSearch = !search || e.vendor.toLowerCase().includes(search.toLowerCase()) || e.description.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const total = filtered.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and approve field + operational spending</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Download size={14} /> Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors" style={{ background: "#6B7EFF" }}>
            <Plus size={14} /> Add Expense
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {SUMMARY.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
            <p className="text-xs mt-1 font-semibold" style={{ color: s.color }}>{s.delta} of total</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-48">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search vendor or description…"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30"
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeCategory === cat
                    ? "text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                style={activeCategory === cat ? { background: "#6B7EFF" } : undefined}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">{filtered.length} expenses · <span className="text-gray-500">${total.toFixed(2)} total</span></p>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Calendar size={12} /> Sorted by date
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              {["Date", "Vendor", "Category", "Description", "Tech / Source", "Amount", "Status", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(exp => (
              <tr key={exp.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{exp.date}</td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900">{exp.vendor}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#6B7EFF]/10 text-[#6B7EFF]">
                    <Tag size={9} />{exp.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">{exp.description}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{exp.tech}</td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900">${exp.amount.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLORS[exp.status]}`}>
                    {exp.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button className="opacity-0 group-hover:opacity-100 text-xs text-[#6B7EFF] font-semibold transition-opacity">
                    Review →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
