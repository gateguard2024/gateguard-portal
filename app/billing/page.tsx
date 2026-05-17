"use client";

import { useState, useEffect } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import { CreditCard, CheckCircle2, Clock, AlertTriangle, Plus, Loader2 } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { TrendingUp, DollarSign } = require('lucide-react') as any;

interface InvoiceRow {
  id: string;
  invoice_number: string;
  title: string;
  status: string;
  is_recurring: boolean;
  amount: number;
  due_date?: string | null;
  paid_at?: string | null;
  client_org?: { id: string; name: string } | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  paid:    { label: "Paid",    bg: "bg-emerald-500/10", text: "text-emerald-400", icon: CheckCircle2  },
  overdue: { label: "Overdue", bg: "bg-red-500/10",     text: "text-red-400",     icon: AlertTriangle },
  pending: { label: "Pending", bg: "bg-amber-500/10",   text: "text-amber-400",   icon: Clock         },
  draft:   { label: "Draft",   bg: "bg-zinc-500/10",    text: "text-zinc-400",    icon: Clock         },
  sent:    { label: "Sent",    bg: "bg-blue-500/10",    text: "text-blue-400",    icon: Clock         },
  void:    { label: "Void",    bg: "bg-slate-500/10",   text: "text-slate-400",   icon: Clock         },
};

export default function BillingPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/billing/invoices')
      .then(r => r.json())
      .then(json => { if (json.invoices) setInvoices(json.invoices); })
      .catch(() => { /* keep empty */ })
      .finally(() => setLoading(false));
  }, []);

  const totalMrr = invoices.filter(i => i.is_recurring && i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const totalOverdue = invoices.filter(i => i.status === "overdue").reduce((s, i) => s + i.amount, 0);
  const totalPending = invoices.filter(i => ["pending", "sent", "draft"].includes(i.status)).reduce((s, i) => s + i.amount, 0);

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Billing" subtitle="QuickBooks Integration · Invoices & Subscriptions" />
      <div className="flex-1 p-6 space-y-5">

        <div className="flex items-center gap-3">
          <AISearch placeholder='Try "show overdue invoices" or "total MRR this month"' className="flex-1" />
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors shadow-lg shadow-brand-500/20">
            <Plus size={16} /> New Invoice
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Monthly MRR",    value: `$${totalMrr.toLocaleString()}/mo`, icon: TrendingUp,  color: "text-brand-400",   bg: "bg-brand-500/10"   },
            { label: "Paid This Month", value: `$${totalPaid.toLocaleString()}`,   icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { label: "Overdue",         value: `$${totalOverdue.toLocaleString()}`, icon: AlertTriangle, color: "text-red-400",   bg: "bg-red-500/10"     },
            { label: "Pending",         value: `$${totalPending.toLocaleString()}`, icon: Clock,       color: "text-amber-400",   bg: "bg-amber-500/10"   },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${s.bg}`}><Icon size={16} className={s.color} /></div>
                <div>
                  <p className="text-lg font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Invoices */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
            <CreditCard size={15} className="text-brand-400" />
            <h2 className="text-sm font-semibold">Invoices</h2>
            <span className="ml-auto text-xs text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Synced with QuickBooks
            </span>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading invoices…</span>
            </div>
          )}

          {!loading && (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-background/30">
                  {["Invoice #", "Customer", "Description", "Amount", "Type", "Status", "Due", "Paid"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const sc = statusConfig[inv.status] ?? statusConfig.draft;
                  const StatusIcon = sc.icon;
                  return (
                    <tr key={inv.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors cursor-pointer">
                      <td className="px-4 py-3 font-mono text-brand-400">{inv.invoice_number}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{inv.client_org?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{inv.title}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">${inv.amount.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${inv.is_recurring ? "bg-brand-500/10 text-brand-400" : "bg-slate-500/10 text-slate-400"}`}>
                          {inv.is_recurring ? "Recurring" : "One-time"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${sc.bg} ${sc.text}`}>
                          <StatusIcon size={10} />{sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{inv.due_date?.slice(0, 10) ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{inv.paid_at?.slice(0, 10) ?? "—"}</td>
                    </tr>
                  );
                })}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">No invoices found</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
