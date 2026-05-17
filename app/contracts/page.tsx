"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  Eye,
  Download,
  Send,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  X,
  Calendar,
  Check,
  ChevronRight,
  Loader2,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DollarSign, Archive, AlertCircle } = require('lucide-react') as any;

// ─── Types ────────────────────────────────────────────────────────────────────

type ContractStatus = "Active" | "Pending Signature" | "Draft" | "Expired";

interface DbContract {
  id: string;
  contract_number: string;
  title: string;
  status: string; // db: draft | pending_signature | active | expired | cancelled
  setup_amount: number;
  mrr: number;
  total_value: number;
  start_date?: string | null;
  end_date?: string | null;
  terms_summary?: string | null;
  assigned_rep?: string | null;
  client_org?: { id: string; name: string } | null;
  site?: { id: string; name: string } | null;
  signatories?: Array<{ id: string; role: string; name: string; email: string; signed: boolean; signed_at?: string | null }>;
}

function dbStatusToUi(s: string): ContractStatus {
  if (s === 'active') return 'Active';
  if (s === 'pending_signature') return 'Pending Signature';
  if (s === 'expired' || s === 'cancelled') return 'Expired';
  return 'Draft';
}

function dbToContract(db: DbContract): Contract {
  const uiStatus = dbStatusToUi(db.status);
  return {
    id: db.id as unknown as number,
    name: db.title,
    customer: db.client_org?.name ?? db.site?.name ?? 'Unknown',
    setup: `$${(db.setup_amount ?? 0).toLocaleString()}`,
    mrr: `$${(db.mrr ?? 0).toLocaleString()}/mo`,
    totalValue: `$${(db.total_value ?? 0).toLocaleString()}`,
    status: uiStatus,
    created: db.start_date ? db.start_date.slice(0, 10) : '',
    expires: db.end_date ? db.end_date.slice(0, 10) : '',
    rep: db.assigned_rep ?? '—',
    signatories: (db.signatories ?? []).map(s => ({
      role: s.role,
      name: s.name,
      email: s.email ?? '',
      signed: s.signed,
      signedDate: s.signed_at ? s.signed_at.slice(0, 10) : undefined,
    })),
    termsSummary: db.terms_summary ?? '',
  };
}

interface Contract {
  id: number;
  name: string;
  customer: string;
  setup: string;
  mrr: string;
  totalValue: string;
  status: ContractStatus;
  created: string;
  expires: string;
  rep: string;
  signatories: { role: string; name: string; email: string; signed: boolean; signedDate?: string }[];
  termsSummary: string;
}

// ─── No mock data — pages show empty state when DB is empty ──────────────────

// STAT_CARDS are computed from live data in the component

const FILTER_TABS = ["All", "Active", "Pending", "Draft", "Expired"] as const;
type FilterTab = typeof FILTER_TABS[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: ContractStatus) {
  if (status === "Active") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <CheckCircle2 className="w-3 h-3" />
      Active
    </span>
  );
  if (status === "Pending Signature") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
      Pending Signature
    </span>
  );
  if (status === "Draft") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
      <Archive className="w-3 h-3" />
      Draft
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
      <XCircle className="w-3 h-3" />
      Expired
    </span>
  );
}

function repBadge(rep: string) {
  const colors: Record<string, string> = {
    "RF": "bg-[#2563EB]/10 text-[#2563EB]",
    "Marcus": "bg-violet-100 text-violet-700",
    "Jordan": "bg-teal-100 text-teal-700",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold", colors[rep] ?? "bg-slate-100 text-slate-600")}>
      {rep}
    </span>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function ContractDetailPanel({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Panel header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#2563EB]/10 flex items-center justify-center">
              <FileText className="w-4.5 h-4.5 text-[#2563EB]" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Contract Details</p>
              <p className="text-sm font-bold text-slate-900 leading-tight">{contract.customer}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Name + status */}
          <div>
            <h2 className="text-base font-bold text-slate-900 mb-2">{contract.name}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {statusBadge(contract.status)}
              {repBadge(contract.rep)}
            </div>
          </div>

          {/* Key dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Created
              </p>
              <p className="text-sm font-semibold text-slate-900">{contract.created || "—"}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Expires
              </p>
              <p className={cn("text-sm font-semibold", contract.status === "Expired" ? "text-red-600" : "text-slate-900")}>
                {contract.expires || "—"}
              </p>
            </div>
          </div>

          {/* Financials */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Financials</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Setup Fee</span>
              <span className="text-sm font-bold text-slate-900">{contract.setup}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Monthly Recurring</span>
              <span className="text-sm font-bold text-slate-900">{contract.mrr}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Total Contract Value</span>
              <span className="text-sm font-bold text-[#2563EB]">{contract.totalValue}</span>
            </div>
          </div>

          {/* Terms summary */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Terms Summary</p>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-sm text-slate-700 leading-relaxed">{contract.termsSummary}</p>
            </div>
          </div>

          {/* Signatories */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Signatory Status</p>
            <div className="space-y-3">
              {contract.signatories.map((sig, i) => (
                <div key={i} className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-4">
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold",
                    sig.signed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  )}>
                    {sig.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{sig.name}</p>
                    <p className="text-xs text-slate-500">{sig.role} · {sig.email}</p>
                  </div>
                  <div className="flex-shrink-0">
                    {sig.signed ? (
                      <div className="flex flex-col items-end">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <Check className="w-3.5 h-3.5" /> Signed
                        </span>
                        {sig.signedDate && (
                          <span className="text-xs text-slate-400 mt-0.5">{sig.signedDate}</span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                        <AlertCircle className="w-3.5 h-3.5" /> Awaiting
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel footer actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex-shrink-0 flex items-center gap-3">
          <button className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            <Download className="w-4 h-4" />
            Download PDF
          </button>
          {(contract.status === "Draft" || contract.status === "Pending Signature") && (
            <button className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors">
              <Send className="w-4 h-4" />
              Send for Signature
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContractsPage() {
  const [filterTab, setFilterTab] = useState<FilterTab>("All");
  const [search, setSearch] = useState("");
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [CONTRACTS, setCONTRACTS] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/contracts')
      .then(r => r.json())
      .then(json => {
        if (json.contracts) {
          setCONTRACTS(json.contracts.map(dbToContract));
        }
      })
      .catch(() => { /* keep empty — proper empty state shown */ })
      .finally(() => setLoading(false));
  }, []);

  const STAT_CARDS = [
    { label: "Active", value: CONTRACTS.filter(c => c.status === "Active").length, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100" },
    { label: "Pending Signature", value: CONTRACTS.filter(c => c.status === "Pending Signature").length, icon: Clock, color: "text-amber-600", bg: "bg-amber-100", accentValue: "text-amber-600" },
    { label: "Expired", value: CONTRACTS.filter(c => c.status === "Expired").length, icon: XCircle, color: "text-red-500", bg: "bg-red-100", accentValue: "text-red-600" },
    { label: "Draft", value: CONTRACTS.filter(c => c.status === "Draft").length, icon: Archive, color: "text-slate-500", bg: "bg-slate-100" },
    {
      label: "Total Contract Value",
      value: loading ? "—" : (() => {
        const total = CONTRACTS.reduce((s, c) => {
          const n = parseFloat(c.totalValue.replace(/[$,]/g, ''));
          return s + (isNaN(n) ? 0 : n);
        }, 0);
        return total >= 1_000_000 ? `$${(total/1_000_000).toFixed(2)}M` : `$${(total/1000).toFixed(0)}K`;
      })(),
      icon: DollarSign, color: "text-[#2563EB]", bg: "bg-[#2563EB]/10"
    },
  ];

  const filtered = CONTRACTS.filter((c) => {
    const matchesTab =
      filterTab === "All" ||
      (filterTab === "Active" && c.status === "Active") ||
      (filterTab === "Pending" && c.status === "Pending Signature") ||
      (filterTab === "Draft" && c.status === "Draft") ||
      (filterTab === "Expired" && c.status === "Expired");

    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.customer.toLowerCase().includes(q) ||
      c.rep.toLowerCase().includes(q);

    return matchesTab && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-100 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold text-slate-900">Contracts</h1>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search contracts…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 bg-white shadow-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] w-56 transition-all"
              />
            </div>
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors shadow-sm">
              <Plus className="w-4 h-4" />
              New Contract
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {STAT_CARDS.map((card) => (
            <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", card.bg)}>
                  <card.icon className={cn("w-4 h-4", card.color)} />
                </div>
              </div>
              <p className={cn("text-xl font-bold tabular-nums", (card as any).accentValue ?? "text-slate-900")}>{card.value}</p>
              <p className="text-xs font-medium text-slate-500 mt-0.5">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs + table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Filter tabs */}
          <div className="flex border-b border-slate-200 overflow-x-auto">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={cn(
                  "px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors relative",
                  filterTab === tab
                    ? "text-[#2563EB] border-b-2 border-[#2563EB] -mb-px bg-white"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                )}
              >
                {tab}
                {tab !== "All" && !loading && (
                  <span className={cn(
                    "ml-2 inline-flex items-center justify-center rounded-full text-xs font-bold px-1.5 py-0.5",
                    filterTab === tab ? "bg-[#2563EB]/10 text-[#2563EB]" : "bg-slate-100 text-slate-500"
                  )}>
                    {CONTRACTS.filter(c =>
                      tab === "Active" ? c.status === "Active" :
                      tab === "Pending" ? c.status === "Pending Signature" :
                      tab === "Draft" ? c.status === "Draft" :
                      c.status === "Expired"
                    ).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading contracts…</span>
            </div>
          )}

          {/* Table */}
          {!loading && <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Contract Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Value</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Created</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Expires</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Rep</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <FileText className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                      <p className="text-sm font-medium text-slate-400">
                        {CONTRACTS.length === 0 ? "No contracts yet — click + New Contract to get started" : "No contracts match your search or filter."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((contract) => (
                    <tr
                      key={contract.id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer group"
                      onClick={() => setSelectedContract(contract)}
                    >
                      <td className="px-5 py-3.5 max-w-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                          <span className="font-medium text-slate-900 truncate max-w-[200px]">{contract.name}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100" />
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">{contract.customer}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div>
                          <p className="font-semibold text-slate-900">{contract.setup}</p>
                          <p className="text-xs text-slate-500">{contract.mrr}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {statusBadge(contract.status)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">{contract.created || <span className="text-slate-300">—</span>}</td>
                      <td className={cn("px-4 py-3.5 whitespace-nowrap", contract.status === "Expired" ? "text-red-500 font-medium" : "text-slate-500")}>
                        {contract.expires || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {repBadge(contract.rep)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSelectedContract(contract)}
                            title="View"
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            title="Download"
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {(contract.status === "Draft" || contract.status === "Pending Signature") && (
                            <button
                              title="Send for Signature"
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#2563EB]/10 text-slate-400 hover:text-[#2563EB] transition-colors"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>}

          {/* Table footer */}
          {!loading && (
            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/60">
              <p className="text-xs text-slate-400">
                Showing {filtered.length} of {CONTRACTS.length} contracts
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Detail slide-in panel */}
      {selectedContract && (
        <ContractDetailPanel
          contract={selectedContract}
          onClose={() => setSelectedContract(null)}
        />
      )}
    </div>
  );
}
