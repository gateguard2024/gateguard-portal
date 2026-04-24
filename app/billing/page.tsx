import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import { CreditCard, CheckCircle2, Clock, AlertTriangle, DollarSign, TrendingUp, Plus } from "lucide-react";

const invoices = [
  { id: "INV-2026-041", customer: "Angel Oak - Properties",  amount: 1199, mrr: true,  status: "paid",    due: "2026-04-01", paid: "2026-04-02", service: "Professional Plan + 88 Cameras" },
  { id: "INV-2026-040", customer: "Pegasus Properties",      amount: 749,  mrr: true,  status: "paid",    due: "2026-04-01", paid: "2026-04-03", service: "Professional Plan + 22 Cameras" },
  { id: "INV-2026-039", customer: "3888 Peachtree",          amount: 499,  mrr: true,  status: "paid",    due: "2026-04-01", paid: "2026-04-01", service: "Professional Plan + 19 Cameras" },
  { id: "INV-2026-038", customer: "Elevate Greene",          amount: 349,  mrr: true,  status: "paid",    due: "2026-04-01", paid: "2026-04-04", service: "Standard Plan + 30 Cameras"     },
  { id: "INV-2026-037", customer: "Midwood Gardens",         amount: 299,  mrr: true,  status: "overdue", due: "2026-04-01", paid: "",           service: "Standard Plan + 14 Cameras"     },
  { id: "INV-2026-036", customer: "Stonegate Townhomes",     amount: 349,  mrr: true,  status: "paid",    due: "2026-04-01", paid: "2026-04-02", service: "Standard Plan + 14 Cameras"     },
  { id: "INV-2026-035", customer: "Flint River",             amount: 8500, mrr: false, status: "pending", due: "2026-05-01", paid: "",           service: "Equipment Installation"          },
  { id: "INV-2026-034", customer: "Mitul Patel",             amount: 499,  mrr: true,  status: "paid",    due: "2026-04-01", paid: "2026-04-01", service: "Professional Plan + 9 Cameras"   },
];

const totalMrr = invoices.filter(i => i.mrr && i.status === "paid").reduce((s, i) => s + i.amount, 0);
const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
const totalOverdue = invoices.filter(i => i.status === "overdue").reduce((s, i) => s + i.amount, 0);
const totalPending = invoices.filter(i => i.status === "pending").reduce((s, i) => s + i.amount, 0);

const statusConfig: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  paid:    { label: "Paid",    bg: "bg-emerald-500/10", text: "text-emerald-400", icon: CheckCircle2  },
  overdue: { label: "Overdue", bg: "bg-red-500/10",     text: "text-red-400",     icon: AlertTriangle },
  pending: { label: "Pending", bg: "bg-amber-500/10",   text: "text-amber-400",   icon: Clock         },
};

export default function BillingPage() {
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
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-background/30">
                {["Invoice #", "Customer", "Service", "Amount", "Type", "Status", "Due", "Paid"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-muted-foreground font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const sc = statusConfig[inv.status];
                const StatusIcon = sc.icon;
                return (
                  <tr key={inv.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-mono text-brand-400">{inv.id}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{inv.customer}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{inv.service}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">${inv.amount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${inv.mrr ? "bg-brand-500/10 text-brand-400" : "bg-slate-500/10 text-slate-400"}`}>
                        {inv.mrr ? "Recurring" : "One-time"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${sc.bg} ${sc.text}`}>
                        <StatusIcon size={10} />{sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.due}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.paid || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
