import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import {
  Camera, Shield, Wifi, AlertTriangle, Users,
  Eye, Settings, TrendingUp, DollarSign, Wrench,
  ExternalLink, Network, Radio,
} from "lucide-react";

const kpis = [
  { label: "Active Accounts",  value: "12",      sub: "9 clients · 2 partners · 1 MSO", icon: Users,        color: "text-brand-400",   bg: "bg-brand-400/10"   },
  { label: "Cameras Online",   value: "115/138", sub: "23 offline — 2 properties",      icon: Camera,       color: "text-emerald-400", bg: "bg-emerald-400/10" },
  { label: "Doors / Gates",    value: "124",     sub: "All online",                     icon: Shield,       color: "text-blue-400",    bg: "bg-blue-400/10"    },
  { label: "Bridges / CMVRs",  value: "9/10",    sub: "1 reconnecting",                 icon: Wifi,         color: "text-violet-400",  bg: "bg-violet-400/10"  },
  { label: "Monthly MRR",      value: "$3,940",  sub: "+12% vs last month",             icon: DollarSign,   color: "text-emerald-400", bg: "bg-emerald-400/10" },
  { label: "Open Work Orders", value: "4",       sub: "1 high priority",                icon: Wrench,       color: "text-amber-400",   bg: "bg-amber-400/10"   },
  { label: "Active Alerts",    value: "3",       sub: "Last 24 hours",                  icon: AlertTriangle,color: "text-red-400",      bg: "bg-red-400/10"     },
  { label: "Quote Pipeline",   value: "$78.7k",  sub: "5 open quotes",                  icon: TrendingUp,   color: "text-brand-400",   bg: "bg-brand-400/10"   },
];

const accounts = [
  { name: "Angel Oak - Properties",  tier: "client", edition: "Professional", cameras: 88, doors: 35, users: 8,  status: "online",  last: "6 min ago"  },
  { name: "Pegasus Properties",      tier: "client", edition: "Professional", cameras: 22, doors: 18, users: 8,  status: "online",  last: "1 hr ago"   },
  { name: "Stonegate Townhomes",     tier: "client", edition: "Standard",     cameras: 14, doors: 12, users: 2,  status: "online",  last: "2 hr ago"   },
  { name: "3888 Peachtree",          tier: "client", edition: "Professional", cameras: 19, doors: 8,  users: 4,  status: "online",  last: "8 hr ago"   },
  { name: "Elevate Eagles Landing",  tier: "client", edition: "Professional", cameras: 14, doors: 12, users: 0,  status: "online",  last: "Yesterday"  },
  { name: "Elevate Greene",          tier: "client", edition: "Standard",     cameras: 30, doors: 35, users: 0,  status: "online",  last: "Yesterday"  },
  { name: "Midwood Gardens",         tier: "client", edition: "Standard",     cameras: 14, doors: 10, users: 2,  status: "online",  last: "Apr 22"     },
  { name: "Mitul Patel",             tier: "client", edition: "Professional", cameras: 9,  doors: 4,  users: 4,  status: "online",  last: "Apr 22"     },
  { name: "Flint River",             tier: "client", edition: "Standard",     cameras: 0,  doors: 0,  users: 0,  status: "warning", last: "Never"      },
  { name: "Monitoring View",         tier: "client", edition: "Standard",     cameras: 0,  doors: 0,  users: 1,  status: "warning", last: "Mar 24"     },
  { name: "Columbia Residential",    tier: "partner",edition: "Partner",      cameras: 96, doors: 72, users: 0,  status: "online",  last: "Today"      },
  { name: "Southeast Security Group",tier: "mso",    edition: "MSO",          cameras: 412,doors: 180,users: 0,  status: "online",  last: "Today"      },
];

const notifications = [
  { msg: "Camera offline: Main Gate — Flint River",        time: "14 min ago", type: "error"   },
  { msg: "Forced entry event — Stonegate Townhomes",       time: "1 hr ago",   type: "warning" },
  { msg: "Bridge reconnected — Midwood Gardens",           time: "3 hr ago",   type: "success" },
  { msg: "New quote accepted — Pegasus Properties $7,200", time: "5 hr ago",   type: "success" },
];

const tierColor: Record<string, string> = {
  client:  "bg-amber-400/10 text-amber-400",
  partner: "bg-emerald-400/10 text-emerald-400",
  mso:     "bg-violet-400/10 text-violet-400",
};

export default function DashboardPage() {
  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Dashboard"
        subtitle="GateGuard OS — Gate Guard, LLC · System Operator"
      />
      <div className="flex-1 p-6 space-y-5">

        {/* AI Search */}
        <AISearch placeholder='Try "show accounts with offline cameras" · "recent forced entry events" · "MRR this month"' />

        {/* KPI Grid */}
        <div className="grid grid-cols-4 gap-3">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3 hover:border-brand-400/20 transition-colors">
                <div className={`p-2.5 rounded-lg shrink-0 ${k.bg}`}>
                  <Icon size={16} className={k.color} />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-bold text-foreground leading-tight">{k.value}</p>
                  <p className="text-[11px] font-medium text-muted-foreground mt-0.5">{k.label}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{k.sub}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Main content */}
        <div className="grid grid-cols-3 gap-5">
          {/* Accounts table */}
          <div className="col-span-2 bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Network size={14} className="text-brand-400" />
                <span className="text-sm font-semibold text-foreground">All Accounts</span>
                <span className="text-[11px] text-muted-foreground">({accounts.length} total)</span>
              </div>
              <a href="/customers" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors">
                View All <ExternalLink size={11} />
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-background/20">
                    <th className="text-left px-5 py-2.5 text-muted-foreground font-medium">Account</th>
                    <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">Cameras</th>
                    <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">Doors</th>
                    <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">Users</th>
                    <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Last Active</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.name} className="border-b border-border/40 hover:bg-accent/20 transition-colors cursor-pointer group">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.status === "online" ? "status-online" : "status-warning"}`} />
                          <span className="font-medium text-foreground group-hover:text-brand-400 transition-colors">{a.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${tierColor[a.tier] || ""}`}>{a.tier}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center text-muted-foreground">{a.cameras || "—"}</td>
                      <td className="px-3 py-2.5 text-center text-muted-foreground">{a.doors || "—"}</td>
                      <td className="px-3 py-2.5 text-center text-muted-foreground">{a.users || "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{a.last}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-1 hover:bg-brand-400/10 rounded text-brand-400"><Eye size={12} /></button>
                          <button className="p-1 hover:bg-accent rounded text-muted-foreground"><Settings size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            {/* Notifications */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <AlertTriangle size={13} className="text-amber-400" />
                <span className="text-sm font-semibold text-foreground">Alerts</span>
                <span className="ml-auto text-[10px] text-muted-foreground">24 hrs</span>
              </div>
              <div className="p-3 space-y-2">
                {notifications.map((n, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-background/40 border border-border/40">
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                      n.type === "error" ? "bg-red-400" :
                      n.type === "success" ? "bg-emerald-400" : "bg-amber-400"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-snug">{n.msg}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide">Quick Actions</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "New Quote",       icon: "📄", href: "/quotes"      },
                  { label: "Work Order",       icon: "🔧", href: "/maintenance" },
                  { label: "Add Account",      icon: "➕", href: "/customers"  },
                  { label: "View SOC",         icon: "📡", href: "/soc"        },
                ].map((a) => (
                  <a key={a.label} href={a.href}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border hover:border-brand-400/30 hover:bg-brand-400/5 transition-all text-center group">
                    <span className="text-xl">{a.icon}</span>
                    <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">{a.label}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Platform status */}
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide">Platform Status</p>
              {[
                { label: "EagleEye API",  status: "operational" },
                { label: "Brivo API",     status: "operational" },
                { label: "Supabase",      status: "operational" },
                { label: "Vercel",        status: "operational" },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full status-online" /> {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
