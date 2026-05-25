"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Search, ChevronDown, ChevronUp, Loader2, Check } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Edit2, AlertCircle, DollarSign, BarChart3, Save, Lock } = require("lucide-react") as any;

// ─── Types ────────────────────────────────────────────────────────────────────

type AccountType = "asset" | "liability" | "equity" | "revenue" | "cogs" | "expense";

interface Account {
  id: string;
  account_number: string;
  name: string;
  type: AccountType;
  sub_type?: string;
  description?: string;
  parent_account_id?: string;
  balance: number;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const SECTION_CONFIG: {
  type: AccountType;
  label: string;
  color: string;
  bg: string;
  headerBg: string;
}[] = [
  { type: "asset",     label: "Assets",            color: "text-blue-700",    bg: "bg-blue-50",   headerBg: "bg-blue-50 border-blue-200" },
  { type: "liability", label: "Liabilities",        color: "text-red-700",     bg: "bg-red-50",    headerBg: "bg-red-50 border-red-200" },
  { type: "equity",    label: "Equity",             color: "text-purple-700",  bg: "bg-purple-50", headerBg: "bg-purple-50 border-purple-200" },
  { type: "revenue",   label: "Revenue",            color: "text-green-700",   bg: "bg-green-50",  headerBg: "bg-green-50 border-green-200" },
  { type: "cogs",      label: "Cost of Goods Sold", color: "text-amber-700",   bg: "bg-amber-50",  headerBg: "bg-amber-50 border-amber-200" },
  { type: "expense",   label: "Expenses",           color: "text-orange-700",  bg: "bg-orange-50", headerBg: "bg-orange-50 border-orange-200" },
];

function fmt(n: number) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5].map(i => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${50 + (i * 23) % 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Account Form Slide-over ──────────────────────────────────────────────────

interface SlideOverProps {
  open: boolean;
  editAccount?: Account | null;
  accounts: Account[];
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY_FORM = {
  account_number: "",
  name: "",
  type: "asset" as AccountType,
  sub_type: "",
  description: "",
  parent_account_id: "",
};

function AccountSlideOver({ open, editAccount, accounts, onClose, onSaved }: SlideOverProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setError(null); return; }
    if (editAccount) {
      setForm({
        account_number: editAccount.account_number,
        name: editAccount.name,
        type: editAccount.type,
        sub_type: editAccount.sub_type ?? "",
        description: editAccount.description ?? "",
        parent_account_id: editAccount.parent_account_id ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, editAccount]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Account name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const url = editAccount ? `/api/chart-of-accounts/${editAccount.id}` : "/api/chart-of-accounts";
      const method = editAccount ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const isEdit = !!editAccount;
  const parentOptions = accounts.filter(a => !editAccount || a.id !== editAccount.id);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{isEdit ? "Edit Account" : "New Account"}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{isEdit ? editAccount?.name : "Add to chart of accounts"}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        <form id="coa-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
            <input
              type="text"
              value={form.account_number}
              onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))}
              placeholder="e.g. 1000"
              className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/50 focus:border-[#6B7EFF]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Cash and Cash Equivalents"
              className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/50 focus:border-[#6B7EFF]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as AccountType }))}
              className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/50 focus:border-[#6B7EFF] bg-white"
            >
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
              <option value="equity">Equity</option>
              <option value="revenue">Revenue</option>
              <option value="cogs">Cost of Goods Sold</option>
              <option value="expense">Expense</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sub-type</label>
            <input
              type="text"
              value={form.sub_type}
              onChange={e => setForm(f => ({ ...f, sub_type: e.target.value }))}
              placeholder="e.g. Current Asset, Fixed Asset"
              className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/50 focus:border-[#6B7EFF]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional description"
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/50 focus:border-[#6B7EFF] resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parent Account</label>
            <select
              value={form.parent_account_id}
              onChange={e => setForm(f => ({ ...f, parent_account_id: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/50 focus:border-[#6B7EFF] bg-white"
            >
              <option value="">None (top-level)</option>
              {parentOptions.map(a => (
                <option key={a.id} value={a.id}>
                  {a.account_number ? `${a.account_number} — ` : ""}{a.name}
                </option>
              ))}
            </select>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            form="coa-form"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
            style={{ background: "#6B7EFF" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [slideOver, setSlideOver] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<AccountType>>(new Set());

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/chart-of-accounts");
      if (res.ok) setAccounts(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  function toggleSection(type: AccountType) {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  }

  async function handleDeactivate(account: Account) {
    const newState = !account.is_active;
    const res = await fetch(`/api/chart-of-accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: newState }),
    });
    if (res.ok) {
      setAccounts(prev => prev.map(a => a.id === account.id ? { ...a, is_active: newState } : a));
    }
  }

  function openEdit(account: Account) {
    setEditAccount(account);
    setSlideOver(true);
  }

  function openNew() {
    setEditAccount(null);
    setSlideOver(true);
  }

  // Filter by search
  const filtered = search
    ? accounts.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.account_number?.toLowerCase().includes(search.toLowerCase()) ||
        a.sub_type?.toLowerCase().includes(search.toLowerCase())
      )
    : accounts;

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="px-8 pt-8 pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            Chart of Accounts
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage your general ledger accounts and balances</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-sm transition-colors"
          style={{ background: "#6B7EFF" }}
        >
          <Plus size={16} />
          New Account
        </button>
      </div>

      {/* ── Search ───────────────────────────────────────────────────────────── */}
      <div className="px-8 pb-4">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search accounts…"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/50 focus:border-[#6B7EFF]"
          />
        </div>
      </div>

      {/* ── Sections ─────────────────────────────────────────────────────────── */}
      <div className="px-8 pb-8 space-y-4">
        {SECTION_CONFIG.map(section => {
          const sectionAccounts = filtered.filter(a => a.type === section.type);
          const isCollapsed = collapsedSections.has(section.type);
          const totalBalance = sectionAccounts.reduce((s, a) => s + (a.balance ?? 0), 0);

          if (loading) {
            return (
              <div key={section.type} className="bg-white border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
                  <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
                  <div className="h-5 w-8 bg-gray-200 rounded animate-pulse" />
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {[1, 2, 3].map(i => <SkeletonRow key={i} />)}
                  </tbody>
                </table>
              </div>
            );
          }

          // Skip empty sections when searching
          if (search && sectionAccounts.length === 0) return null;

          return (
            <div key={section.type} className="bg-white border border-border rounded-xl overflow-hidden">
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.type)}
                className={`w-full flex items-center gap-3 px-4 py-3 border-b transition-colors ${section.headerBg} hover:opacity-90`}
              >
                <span className={`text-sm font-bold ${section.color}`}>{section.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${section.bg} ${section.color}`}>
                  {sectionAccounts.length}
                </span>
                <span className="ml-auto text-sm font-semibold text-gray-600">{fmt(totalBalance)}</span>
                {isCollapsed ? (
                  <ChevronDown size={14} className="text-gray-400 shrink-0" />
                ) : (
                  <ChevronUp size={14} className="text-gray-400 shrink-0" />
                )}
              </button>

              {/* Section rows */}
              {!isCollapsed && (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-28">Number</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Sub-type</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Balance</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sectionAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400 italic">
                          No {section.label.toLowerCase()} accounts yet.
                          <button onClick={openNew} className="ml-1 text-[#6B7EFF] hover:underline">Add one →</button>
                        </td>
                      </tr>
                    ) : (
                      sectionAccounts.map(account => (
                        <tr
                          key={account.id}
                          className={`hover:bg-gray-50 transition-colors ${!account.is_active ? "opacity-50" : ""}`}
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs font-semibold text-gray-600">
                              {account.account_number || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`font-medium text-gray-900 ${!account.is_active ? "line-through" : ""}`}>
                                {account.name}
                                {!account.is_active && (
                                  <span className="ml-1 text-xs text-gray-400 no-underline">(Inactive)</span>
                                )}
                              </span>
                              {account.is_system && (
                                <Lock size={11} className="text-gray-400 shrink-0" title="System account — cannot be deleted" />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {account.sub_type ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${section.bg} ${section.color}`}>
                                {account.sub_type}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            {fmt(account.balance ?? 0)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {!account.is_system && (
                                <>
                                  <button
                                    onClick={() => openEdit(account)}
                                    className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                                    title="Edit"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeactivate(account)}
                                    className={`p-1.5 rounded transition-colors text-xs font-medium ${
                                      account.is_active
                                        ? "hover:bg-red-50 text-gray-400 hover:text-red-600"
                                        : "hover:bg-green-50 text-gray-400 hover:text-green-600"
                                    }`}
                                    title={account.is_active ? "Deactivate" : "Reactivate"}
                                  >
                                    {account.is_active ? "×" : "✓"}
                                  </button>
                                </>
                              )}
                              {account.is_system && (
                                <span className="text-xs text-gray-300 pr-1">System</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Slide-over ───────────────────────────────────────────────────────── */}
      <AccountSlideOver
        open={slideOver}
        editAccount={editAccount}
        accounts={accounts}
        onClose={() => { setSlideOver(false); setEditAccount(null); }}
        onSaved={() => { fetchAccounts(); setSlideOver(false); setEditAccount(null); }}
      />
    </div>
  );
}
