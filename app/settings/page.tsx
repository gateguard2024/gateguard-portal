import { TopBar } from "@/components/layout/TopBar";
import { Settings, Zap, Users, Bell, Palette, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

const integrations = [
  { name: "EagleEye Networks", desc: "Camera management & live video", status: "connected", lastSync: "2 min ago",  icon: "📷" },
  { name: "Brivo",             desc: "Access control & events",        status: "connected", lastSync: "5 min ago",  icon: "🔑" },
  { name: "QuickBooks",        desc: "Billing & invoicing",            status: "pending",   lastSync: "Not set up", icon: "💳" },
  { name: "Twilio",            desc: "SMS alerts & 2FA",               status: "pending",   lastSync: "Not set up", icon: "💬" },
];

const team = [
  { name: "Russel Feldman", email: "rfeldman@gateguard.co", role: "dealer_admin",  status: "active" },
  { name: "James Torres",   email: "jtorres@gateguard.co",  role: "dealer_staff",  status: "active" },
  { name: "Maria Larson",   email: "mlarson@gateguard.co",  role: "dealer_staff",  status: "active" },
];

export default function SettingsPage() {
  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Settings" subtitle="Integrations, Team, Notifications & Branding" />
      <div className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-2 gap-6">

          {/* Integrations */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
              <Zap size={15} className="text-brand-400" />
              <h2 className="text-sm font-semibold">Integrations</h2>
            </div>
            <div className="p-4 space-y-3">
              {integrations.map((int) => (
                <div key={int.name} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-brand-500/30 transition-colors">
                  <span className="text-2xl">{int.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{int.name}</p>
                    <p className="text-[11px] text-muted-foreground">{int.desc}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">Last sync: {int.lastSync}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      int.status === "connected" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                    }`}>
                      {int.status === "connected" ? "● Connected" : "○ Setup"}
                    </span>
                    <button className="text-[11px] text-brand-400 hover:underline">
                      {int.status === "connected" ? "Configure" : "Connect →"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Team */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <div className="flex items-center gap-2">
                <Users size={15} className="text-brand-400" />
                <h2 className="text-sm font-semibold">Team</h2>
              </div>
              <button className="text-xs text-brand-400 hover:text-brand-300 transition-colors">+ Invite</button>
            </div>
            <div className="p-4 space-y-2">
              {team.map((member) => (
                <div key={member.email} className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-xs text-white font-semibold">
                    {member.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{member.name}</p>
                    <p className="text-[11px] text-muted-foreground">{member.email}</p>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 font-medium">
                    {member.role.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
              <Bell size={15} className="text-brand-400" />
              <h2 className="text-sm font-semibold">Notifications</h2>
            </div>
            <div className="p-4 space-y-3">
              {[
                "Camera goes offline",
                "Forced entry event",
                "Bridge disconnected",
                "New access control alert",
                "Work order overdue",
                "Invoice payment received",
              ].map((alert) => (
                <div key={alert} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{alert}</span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" defaultChecked className="accent-cyan-500" /> Email
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" defaultChecked className="accent-cyan-500" /> SMS
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Branding */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
              <Palette size={15} className="text-brand-400" />
              <h2 className="text-sm font-semibold">Branding</h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">Company Name</label>
                <input defaultValue="Gate Guard, LLC" className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:border-brand-500/60 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Portal URL</label>
                <input defaultValue="portal.gateguard.co" className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:border-brand-500/60 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Primary Color</label>
                <div className="mt-1 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-brand-500 border border-border cursor-pointer" />
                  <input defaultValue="#06b6d4" className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono text-foreground outline-none focus:border-brand-500/60 transition-colors" />
                </div>
              </div>
              <button className="w-full py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors">Save Branding</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
