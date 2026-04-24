import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import { Plus, Eye, FileText, CheckCircle2, Clock, XCircle, Send, DollarSign } from "lucide-react";

const quotes = [
  { id: "GG-2026-041", customer: "Flint River",      title: "Security System Installation",       value: 18500, mrr: 349, status: "sent",     created: "2026-04-20", expires: "2026-05-20" },
  { id: "GG-2026-040", customer: "Pegasus Properties", title: "Camera Expansion — Building C",    value: 7200,  mrr: 0,   status: "accepted", created: "2026-04-15", expires: "2026-05-15" },
  { id: "GG-2026-039", customer: "Midwood Gardens",  title: "Brivo Access Control Upgrade",        value: 4800,  mrr: 199, status: "draft",    created: "2026-04-10", expires: "2026-05-10" },
  { id: "GG-2026-038", customer: "3888 Peachtree",   title: "Annual Maintenance Contract",         value: 2400,  mrr: 200, status: "accepted", created: "2026-03-28", expires: "2026-04-28" },
  { id: "GG-2026-037", customer: "New Lead - TBD",   title: "Full Security Package — 48 Units",   value: 42000, mrr: 899, status: "draft",    created: "2026-04-22", expires: "2026-05-22" },
  { id: "GG-2026-036", customer: "Elevate Greene",   title: "Additional Camera Installation x6",  value: 3600,  mrr: 0,   status: "expired",  created: "2026-03-01", expires: "2026-04-01" },
];

const statusConfig: Record<string, { label: string; icon: any; bg: string; text: string }> = {
  draft:    { label: "Draft",    icon: Clock,        bg: "bg-slate-500/10",   text: "text-slate-400"   },
  sent:     { label: "Sent",     icon: Send,         bg: "bg-blue-500/10",    text: "text-blue-400"    },
  accepted: { label: "Accepted", icon: CheckCircle2, bg: "bg-emerald-500/10", text: "text-emerald-400" },
  expired:  { label: "Expired",  icon: XCircle,      bg: "bg-red-500/10",     text: "text-red-400"     },
  declined: { label: "Declined", icon: XCircle,      bg: "bg-red-500/10",     text: "text-red-400"     },
};

const totalPipeline = quotes.filter(q => q.status !== "expired").reduce((s, q) => s + q.value, 0);
const totalMrr = quotes.filter(q => q.status === "accepted").reduce((s, q) => s + q.mrr, 0);

export default function QuotesPage() {
  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Quotes" subtitle="Proposals & Quoting Tool" />
      <div className="flex-1 p-6 space-y-5">

        <div className="flex items-center gap-3">
          <AISearch placeholder='Try "generate a quote for a 50-unit apartment with cameras and Brivo access"' className="flex-1" />
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors shadow-lg shadow-brand-500/20">
            <Plus size={16} /> New Quote
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Pipeline",   value: `$${totalPipeline.toLocaleString()}`, icon: DollarSign,   color: "text-brand-400",   bg: "bg-brand-500/10"   },
            { label: "Accepted MRR",     value: `$${totalMrr}/mo`,                   icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { label: "Quotes Sent",      value: String(quotes.filter(q => q.status === "sent").length),     icon: Send,      color: "text-blue-400",    bg: "bg-blue-500/10"    },
            { label: "Draft Quotes",     value: String(quotes.filter(q => q.status === "draft").length),    icon: FileText,  color: "text-amber-400",   bg: "bg-amber-500/10"   },
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

        {/* Quotes table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
            <FileText size={15} className="text-brand-400" />
            <h2 className="text-sm font-semibold">All Quotes</h2>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-background/30">
                {["Quote #", "Customer", "Title", "Value", "MRR", "Status", "Expires", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-muted-foreground font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const sc = statusConfig[q.status];
                const Icon = sc.icon;
                return (
                  <tr key={q.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors group cursor-pointer">
                    <td className="px-4 py-3 font-mono text-brand-400">{q.id}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{q.customer}</td>
                    <td className="px-4 py-3 text-muted-foreground">{q.title}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">${q.value.toLocaleString()}</td>
                    <td className="px-4 py-3 text-muted-foreground">{q.mrr ? `$${q.mrr}/mo` : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${sc.bg} ${sc.text}`}>
                        <Icon size={10} />{sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{q.expires}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 rounded-lg hover:bg-brand-500/10 text-brand-400 transition-colors"><Eye size={13} /></button>
                        <button className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors"><Send size={13} /></button>
                      </div>
                    </td>
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
