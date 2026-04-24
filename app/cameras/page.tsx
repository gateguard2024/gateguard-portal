import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import { Camera, Download, Archive, Grid3X3, Search, Wifi, AlertTriangle } from "lucide-react";

const cameras = [
  { name: "Leasing Entry",   account: "Stonegate Townhomes", status: "online",  feed: true,  time: "22:14:29" },
  { name: "Leasing Rear Door", account: "Stonegate Townhomes", status: "online", feed: true, time: "22:14:29" },
  { name: "Main Gate",       account: "Stonegate Townhomes", status: "online",  feed: true,  time: "22:14:29" },
  { name: "Office Camera",   account: "Stonegate Townhomes", status: "online",  feed: true,  time: "22:14:29" },
  { name: "Amenity Hall",    account: "Angel Oak",           status: "online",  feed: true,  time: "04:25:14" },
  { name: "Back Door",       account: "Angel Oak",           status: "online",  feed: true,  time: "04:25:14" },
  { name: "Business Center", account: "Angel Oak",           status: "online",  feed: true,  time: "04:25:14" },
  { name: "Gym Camera",      account: "Angel Oak",           status: "online",  feed: true,  time: "04:28:37" },
  { name: "Leasing Lobby",   account: "Angel Oak",           status: "online",  feed: true,  time: "04:28:37" },
  { name: "Leasing Parking", account: "Angel Oak",           status: "online",  feed: true,  time: "04:28:37" },
  { name: "Package Lockers", account: "Angel Oak",           status: "offline", feed: false, time: "" },
  { name: "Pool",            account: "Angel Oak",           status: "online",  feed: true,  time: "04:28:37" },
];

const tabs = ["All Cameras", "Layouts", "Video Search", "Archive", "Downloads"];

export default function CamerasPage() {
  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Cameras" subtitle="EagleEye Networks Integration · 138 cameras across 10 accounts" />
      <div className="flex-1 p-6 space-y-5">

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 w-fit">
          {tabs.map((t, i) => (
            <button key={t} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              i === 0 ? "bg-brand-500 text-white shadow" : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}>{t}</button>
          ))}
        </div>

        {/* AI Search */}
        <AISearch placeholder='Try "show motion events at Main Gate yesterday" or "cameras offline last hour"' />

        {/* Stats row */}
        <div className="flex items-center gap-4">
          {[
            { icon: Camera,       label: "138 Total",    color: "text-brand-400"   },
            { icon: Wifi,         label: "115 Online",   color: "text-emerald-400" },
            { icon: AlertTriangle, label: "23 Offline",  color: "text-red-400"     },
            { icon: Archive,      label: "74 MB Archive", color: "text-muted-foreground" },
          ].map(({ icon: Icon, label, color }) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              <Icon size={14} className={color} />
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <Grid3X3 size={13} /> Layouts
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <Download size={13} /> Downloads
            </button>
          </div>
        </div>

        {/* Camera grid */}
        <div className="grid grid-cols-4 gap-3">
          {cameras.map((cam) => (
            <div key={`${cam.account}-${cam.name}`}
              className="bg-card border border-border rounded-xl overflow-hidden hover:border-brand-500/40 transition-all cursor-pointer group">
              {/* Video area */}
              <div className="relative aspect-video bg-slate-900">
                {cam.feed ? (
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                    <Camera size={24} className="text-slate-600" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[10px] text-white font-medium">LIVE</span>
                    </div>
                    <div className="absolute bottom-2 right-2 text-[10px] text-white/70">{cam.time}</div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                    <Camera size={20} className="text-red-500/50" />
                    <span className="text-[10px] text-red-400">Offline</span>
                  </div>
                )}
              </div>
              {/* Info */}
              <div className="p-2.5">
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cam.status === "online" ? "status-online" : "status-offline"}`} />
                  <p className="text-xs font-medium text-foreground truncate group-hover:text-brand-400 transition-colors">{cam.name}</p>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 ml-3 truncate">{cam.account}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">Showing 12 of 138 cameras · <button className="text-brand-400 hover:underline">Load more</button></p>
      </div>
    </div>
  );
}
