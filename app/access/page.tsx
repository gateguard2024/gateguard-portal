import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import { Shield, Users, DoorOpen, Cpu, BarChart3, CheckCircle2, XCircle, Clock } from "lucide-react";

const tabs = ["Event Tracker", "Users", "Devices", "Reports"];

const events = [
  { time: "6:59:27 PM", siteTime: "6:59:27 PM EDT", event: "Guest Valid Access", user: "Jt (NIX)",         site: "859 Elevate Greene", device: "Gym Door",       hasVideo: true  },
  { time: "6:46:24 PM", siteTime: "6:46:24 PM EDT", event: "Valid access",       user: "Quintez Sellers", site: "859 Elevate Greene", device: "Bathroom Hall",  hasVideo: true  },
  { time: "6:44:28 PM", siteTime: "6:44:28 PM EDT", event: "Valid access",       user: "Quintez Sellers", site: "859 Elevate Greene", device: "Bathroom Hall",  hasVideo: false },
  { time: "6:44:01 PM", siteTime: "6:44:01 PM EDT", event: "Valid access",       user: "Quintez Sellers", site: "859 Elevate Greene", device: "Business Center",hasVideo: true  },
  { time: "6:43:53 PM", siteTime: "6:43:53 PM EDT", event: "Valid access",       user: "Quintez Sellers", site: "859 Elevate Greene", device: "Business Center",hasVideo: false },
  { time: "2:56:03 PM", siteTime: "2:56:03 PM EDT", event: "Valid access",       user: "Jared Davis",     site: "859 Elevate Greene", device: "Gym Door",       hasVideo: true  },
  { time: "11:31:39 AM", siteTime: "11:31:39 AM",   event: "Guest Valid Access", user: "Brandon T.",      site: "859 Elevate Greene", device: "Leasing Lobby",  hasVideo: false },
  { time: "10:28:37 AM", siteTime: "10:28:37 AM",   event: "Guest Valid Access", user: "Kwame A.",        site: "859 Elevate Greene", device: "Main Entrance",  hasVideo: true  },
];

const kpis = [
  { label: "Daily Active Users", value: "4",   icon: Users,     color: "text-brand-400",   bg: "bg-brand-500/10"   },
  { label: "Suspended Users",    value: "16",  icon: XCircle,   color: "text-red-400",     bg: "bg-red-500/10"     },
  { label: "Users Created",      value: "0",   icon: Users,     color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { label: "Users Deleted",      value: "0",   icon: XCircle,   color: "text-muted-foreground", bg: "bg-muted/50"  },
];

export default function AccessPage() {
  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Access Control" subtitle="Brivo Integration · Gate Guard, LLC — Dealer ID 2079739" />
      <div className="flex-1 p-6 space-y-5">

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 w-fit">
          {tabs.map((t, i) => (
            <button key={t} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              i === 0 ? "bg-brand-500 text-white shadow" : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}>{t}</button>
          ))}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${k.bg}`}>
                  <Icon size={16} className={k.color} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{k.value}</p>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* AI Search */}
        <AISearch placeholder='Try "when did John Doe come in today" or "show all forced entry events this week"' />

        {/* Event Tracker */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Shield size={15} className="text-brand-400" />
              <h2 className="text-sm font-semibold">Event Tracker</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Filters:</span>
              {["Date", "Event Name", "User", "Sites", "Devices"].map((f) => (
                <button key={f} className="px-2.5 py-1 rounded-lg border border-border hover:bg-accent transition-colors">{f}</button>
              ))}
            </div>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-background/30">
                <th className="text-left px-5 py-2.5 text-muted-foreground font-medium">Timestamp</th>
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Site Time</th>
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Event</th>
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">User</th>
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Site</th>
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Device</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground">
                    <div>{e.time}</div>
                    <div className="text-[10px] text-muted-foreground/60">04/23/2026</div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{e.siteTime}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      e.event.includes("Guest") ? "bg-brand-500/10 text-brand-400" : "bg-emerald-500/10 text-emerald-400"
                    }`}>
                      <CheckCircle2 size={10} />
                      {e.event}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-foreground font-medium">{e.user}</td>
                  <td className="px-3 py-3 text-muted-foreground">{e.site}</td>
                  <td className="px-3 py-3 text-muted-foreground">{e.device}</td>
                  <td className="px-3 py-3">
                    {e.hasVideo && <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-border">📹</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
