"use client";
import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import {
  Plus, Eye, Settings, Phone, Mail, MapPin, ExternalLink,
  Building2, Users, Shield, Camera, ChevronRight, Network,
} from "lucide-react";
import { useState } from "react";

type Tier = "all" | "mso" | "dealer" | "partner" | "client";

const tierConfig = {
  corporate: { label: "Corporate",       cls: "tier-corporate", icon: "🏢" },
  mso:       { label: "MSO",             cls: "tier-mso",       icon: "🌐" },
  dealer:    { label: "Dealer / SO",     cls: "tier-dealer",    icon: "🔧" },
  partner:   { label: "Channel Partner", cls: "tier-partner",   icon: "🤝" },
  client:    { label: "Client",          cls: "tier-client",    icon: "🏘️" },
};

const accounts = [
  {
    id: "MSO-001", tier: "mso" as const,
    name: "Southeast Security Group",
    contact: "David Marsh", email: "david@sesecuritygroup.com", phone: "678-555-0100",
    location: "Atlanta, GA",
    stats: { dealers: 4, clients: 28, cameras: 412, doors: 180 },
    status: "active",
  },
  {
    id: "SO-001", tier: "dealer" as const,
    name: "Gate Guard, LLC",
    contact: "Russel Feldman", email: "rfeldman@gateguard.co", phone: "844-694-2283",
    location: "Atlanta, GA",
    stats: { clients: 9, cameras: 138, doors: 124, mrr: 3940 },
    status: "active",
  },
  {
    id: "CP-001", tier: "partner" as const,
    name: "Columbia Residential",
    contact: "Sarah Kim", email: "sarah@columbiares.com", phone: "404-555-0200",
    location: "Atlanta Metro, GA",
    stats: { clients: 6, cameras: 96, doors: 72 },
    status: "active",
  },
  {
    id: "CP-002", tier: "partner" as const,
    name: "Elevate Living",
    contact: "Marcus Webb", email: "marcus@elevateliving.com", phone: "678-555-0300",
    location: "Charlotte, NC",
    stats: { clients: 3, cameras: 58, doors: 47 },
    status: "active",
  },
  {
    id: "CL-001", tier: "client" as const,
    name: "Angel Oak - Properties",
    contact: "Sammy Laroche", email: "sammy.laroche@angeloakcapital.com", phone: "912-956-6711",
    location: "1370 Ave of Americas, NY",
    stats: { cameras: 88, doors: 35, users: 8, sites: 1749 },
    status: "active",
    parent: "Columbia Residential",
  },
  {
    id: "CL-002", tier: "client" as const,
    name: "Pegasus Properties",
    contact: "Brian Torres", email: "btorres@pegasusprops.com", phone: "404-555-0400",
    location: "Atlanta Metro, GA",
    stats: { cameras: 22, doors: 18, users: 8, sites: 3 },
    status: "active",
    parent: "Gate Guard, LLC",
  },
  {
    id: "CL-003", tier: "client" as const,
    name: "Stonegate Townhomes",
    contact: "Property Manager", email: "mgr@stonegate.com", phone: "",
    location: "Stonegate Community, GA",
    stats: { cameras: 14, doors: 12, users: 2, sites: 1 },
    status: "active",
    parent: "Gate Guard, LLC",
  },
  {
    id: "CL-004", tier: "client" as const,
    name: "3888 Peachtree",
    contact: "Property Mgmt", email: "mgmt@3888peachtree.com", phone: "",
    location: "3888 Peachtree Rd NE, Atlanta",
    stats: { cameras: 19, doors: 8, users: 4, sites: 1 },
    status: "active",
    parent: "Gate Guard, LLC",
  },
  {
    id: "CL-005", tier: "client" as const,
    name: "Flint River",
    contact: "", email: "", phone: "",
    location: "Georgia",
    stats: { cameras: 0, doors: 0, users: 0, sites: 0 },
    status: "warning",
    parent: "Gate Guard, LLC",
  },
];

const filterTabs: { label: string; value: Tier }[] = [
  { label: "All",             value: "all"     },
  { label: "MSO",             value: "mso"     },
  { label: "Dealers / SO",    value: "dealer"  },
  { label: "Channel Partners",value: "partner" },
  { label: "Clients",         value: "client"  },
];

export default function CustomersPage() {
  const [activeTier, setActiveTier] = useState<Tier>("all");

  const filtered = activeTier === "all"
    ? accounts
    : accounts.filter(a => a.tier === activeTier);

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Customers"
        subtitle={`${accounts.length} accounts across all tiers`}
        actions={
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-400 hover:bg-brand-500 text-navy-DEFAULT text-sm font-semibold transition-colors gg-glow">
            <Plus size={15} /> New Account
          </button>
        }
      />

      <div className="flex-1 p-6 space-y-5">
        {/* Hierarchy overview */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Network size={14} className="text-brand-400" />
            <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Organization Hierarchy</span>
          </div>
          <div className="flex items-center gap-0 overflow-x-auto">
            {[
              { label: "GateGuard", sublabel: "Corporate", cls: "tier-corporate", count: 1 },
              { label: "MSOs",      sublabel: "Master Operators", cls: "tier-mso",   count: 1 },
              { label: "Dealers",   sublabel: "System Operators", cls: "tier-dealer",count: 1 },
              { label: "Partners",  sublabel: "Channel Partners", cls: "tier-partner",count: 2 },
              { label: "Clients",   sublabel: "Properties",       cls: "tier-client", count: 9 },
            ].map((tier, i, arr) => (
              <div key={tier.label} className="flex items-center">
                <div className={`px-4 py-2.5 rounded-lg text-center ${tier.cls} min-w-[110px]`}>
                  <p className="text-sm font-bold">{tier.count}</p>
                  <p className="text-[11px] font-semibold">{tier.label}</p>
                  <p className="text-[10px] opacity-70">{tier.sublabel}</p>
                </div>
                {i < arr.length - 1 && (
                  <ChevronRight size={16} className="text-muted-foreground/40 mx-1 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Filter tabs + search */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTier(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTier === tab.value
                    ? "bg-brand-400 text-navy-DEFAULT font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <AISearch
            placeholder='Try "show all clients in Atlanta" or "accounts with offline cameras"'
            className="flex-1"
          />
        </div>

        {/* Account cards */}
        <div className="grid grid-cols-3 gap-4">
          {filtered.map((acct) => {
            const tc = tierConfig[acct.tier];
            return (
              <div
                key={acct.id}
                className="bg-card border border-border rounded-xl p-4 hover:border-brand-400/30 transition-all group cursor-pointer"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${acct.status === "active" ? "status-online" : "status-warning"}`} />
                      <h3 className="text-sm font-semibold text-foreground group-hover:text-brand-400 transition-colors truncate">
                        {acct.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 ml-3.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${tc.cls}`}>
                        {tc.icon} {tc.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 font-mono">{acct.id}</span>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {acct.tier === "mso" && [
                    { label: "Dealers",  value: acct.stats.dealers  },
                    { label: "Clients",  value: acct.stats.clients  },
                    { label: "Cameras",  value: acct.stats.cameras  },
                    { label: "Doors",    value: acct.stats.doors    },
                  ].map(s => (
                    <div key={s.label} className="text-center p-1.5 rounded-lg bg-background/50 border border-border/50">
                      <p className="text-xs font-bold text-foreground">{s.value ?? "—"}</p>
                      <p className="text-[9px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                  {acct.tier === "dealer" && [
                    { label: "Clients",  value: acct.stats.clients  },
                    { label: "Cameras",  value: acct.stats.cameras  },
                    { label: "Doors",    value: acct.stats.doors    },
                    { label: "MRR",      value: acct.stats.mrr ? `$${acct.stats.mrr}` : "—" },
                  ].map(s => (
                    <div key={s.label} className="text-center p-1.5 rounded-lg bg-background/50 border border-border/50">
                      <p className="text-xs font-bold text-foreground">{s.value ?? "—"}</p>
                      <p className="text-[9px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                  {(acct.tier === "partner" || acct.tier === "client") && [
                    { label: "Cameras", value: acct.stats.cameras },
                    { label: "Doors",   value: acct.stats.doors   },
                    { label: "Users",   value: acct.stats.users   },
                    { label: "Sites",   value: acct.stats.sites   },
                  ].map(s => (
                    <div key={s.label} className="text-center p-1.5 rounded-lg bg-background/50 border border-border/50">
                      <p className="text-xs font-bold text-foreground">{s.value ?? "—"}</p>
                      <p className="text-[9px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Contact */}
                {acct.contact && (
                  <div className="text-[11px] text-muted-foreground space-y-0.5 border-t border-border/50 pt-2.5 mb-2.5">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <Users size={10} className="text-brand-400" /> {acct.contact}
                    </div>
                    {acct.email && <div className="flex items-center gap-1.5"><Mail size={9} /> {acct.email}</div>}
                    {acct.phone && <div className="flex items-center gap-1.5"><Phone size={9} /> {acct.phone}</div>}
                    {acct.location && (
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin size={9} /> <span className="truncate">{acct.location}</span>
                      </div>
                    )}
                    {(acct as any).parent && (
                      <div className="flex items-center gap-1.5 text-brand-400/70">
                        <Building2 size={9} /> Under: {(acct as any).parent}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-border/50">
                  <button className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                    <Eye size={12} /> View
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                    <Camera size={12} /> Cameras
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                    <Shield size={12} /> Access
                  </button>
                  <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                    <Settings size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
