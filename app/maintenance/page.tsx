import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import { Plus, Wrench, CheckCircle2, Clock, AlertTriangle, Calendar, User } from "lucide-react";

const workOrders = [
  { id: "WO-2026-089", title: "Camera offline — Main Gate",        customer: "Stonegate Townhomes", assignee: "James T.", priority: "high",   status: "in_progress", due: "2026-04-24", created: "2026-04-23" },
  { id: "WO-2026-088", title: "Brivo panel firmware update",       customer: "Pegasus Properties",  assignee: "Maria L.", priority: "medium", status: "open",        due: "2026-04-30", created: "2026-04-22" },
  { id: "WO-2026-087", title: "Annual camera lens cleaning",       customer: "Angel Oak",           assignee: "James T.", priority: "low",    status: "scheduled",   due: "2026-05-01", created: "2026-04-20" },
  { id: "WO-2026-086", title: "Access control reader replacement", customer: "3888 Peachtree",      assignee: "Maria L.", priority: "high",   status: "open",        due: "2026-04-25", created: "2026-04-21" },
  { id: "WO-2026-085", title: "NVR hard drive replacement",        customer: "Midwood Gardens",     assignee: "James T.", priority: "medium", status: "completed",   due: "2026-04-22", created: "2026-04-18" },
  { id: "WO-2026-084", title: "New camera installation x3",        customer: "Mitul Patel",         assignee: "Carlos R.", priority: "low",  status: "completed",   due: "2026-04-19", created: "2026-04-15" },
];

const priorityConfig: Record<string, { bg: string; text: string }> = {
  high:   { bg: "bg-red-500/10",    text: "text-red-400"    },
  medium: { bg: "bg-amber-500/10",  text: "text-amber-400"  },
  low:    { bg: "bg-slate-500/10",  text: "text-slate-400"  },
};

const statusConfig: Record<string, { label: string; icon: any; bg: string; text: string }> = {
  open:        { label: "Open",        icon: Clock,          bg: "bg-blue-500/10",    text: "text-blue-400"    },
  in_progress: { label: "In Progress", icon: Wrench,         bg: "bg-amber-500/10",   text: "text-amber-400"   },
  scheduled:   { label: "Scheduled",   icon: Calendar,       bg: "bg-violet-500/10",  text: "text-violet-400"  },
  completed:   { label: "Completed",   icon: CheckCircle2,   bg: "bg-emerald-500/10", text: "text-emerald-400" },
};

export default function MaintenancePage() {
  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Maintenance" subtitle="Work Orders & Asset Management" />
      <div className="flex-1 p-6 space-y-5">

        <div className="flex items-center gap-3">
          <AISearch placeholder='Try "show overdue work orders" or "schedule annual maintenance for Angel Oak"' className="flex-1" />
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors shadow-lg shadow-brand-500/20">
            <Plus size={16} /> New Work Order
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Open",        value: String(workOrders.filter(w => w.status === "open").length),        color: "text-blue-400",    bg: "bg-blue-500/10",    icon: Clock        },
            { label: "In Progress", value: String(workOrders.filter(w => w.status === "in_progress").length), color: "text-amber-400",   bg: "bg-amber-500/10",   icon: Wrench       },
            { label: "Scheduled",   value: String(workOrders.filter(w => w.status === "scheduled").length),   color: "text-violet-400",  bg: "bg-violet-500/10",  icon: Calendar     },
            { label: "Completed",   value: String(workOrders.filter(w => w.status === "completed").length),   color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle2 },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${s.bg}`}><Icon size={16} className={s.color} /></div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Work Orders table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
            <Wrench size={15} className="text-brand-400" />
            <h2 className="text-sm font-semibold">Work Orders</h2>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-background/30">
                {["WO #", "Title", "Customer", "Assignee", "Priority", "Status", "Due", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-muted-foreground font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workOrders.map((wo) => {
                const pc = priorityConfig[wo.priority];
                const sc = statusConfig[wo.status];
                const StatusIcon = sc.icon;
                return (
                  <tr key={wo.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors cursor-pointer group">
                    <td className="px-4 py-3 font-mono text-brand-400">{wo.id}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{wo.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{wo.customer}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-brand-800 flex items-center justify-center text-[10px] text-brand-300 font-semibold">
                          {wo.assignee.split(" ").map(n => n[0]).join("")}
                        </div>
                        <span className="text-muted-foreground">{wo.assignee}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${pc.bg} ${pc.text}`}>{wo.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${sc.bg} ${sc.text}`}>
                        <StatusIcon size={10} />{sc.label}
                      </span>
                    </td>
                    <td className={`px-4 py-3 ${wo.status !== "completed" && new Date(wo.due) < new Date() ? "text-red-400 font-medium" : "text-muted-foreground"}`}>
                      {wo.due}
                    </td>
                    <td className="px-4 py-3">
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-brand-500/10 text-brand-400">
                        <Wrench size={13} />
                      </button>
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
