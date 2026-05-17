"use client";
import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import {
  Plus, Eye, Settings, Phone, Mail, MapPin,
  Building2, Users, Shield, Camera, ChevronRight, Network, Loader2,
} from "lucide-react";
import { useState, useEffect } from "react";

type Tier = "all" | "mso" | "dealer" | "partner" | "client";

const tierConfig: Record<string, { label: string; cls: string; icon: string }> = {
  corporate: { label: "Corporate",       cls: "tier-corporate", icon: "🏢" },
  mso:       { label: "MSO",             cls: "tier-mso",       icon: "🌐" },
  dealer:    { label: "Dealer / SO",     cls: "tier-dealer",    icon: "🔧" },
  partner:   { label: "Channel Partner", cls: "tier-partner",   icon: "🤝" },
  client:    { label: "Client",          cls: "tier-client",    icon: "🏘️" },
};

interface Account {
  id: string;
  name: string;
  tier: string;
  tier_label?: string;
  is_active: boolean;
  site_count?: number;
  created_at?: string;
  // contact info may not be in the org table — optional fields
  contact?: string;
  email?: string;
  phone?: string;
  location?: string;
  parent?: string;
  stats?: Record<string, number | string | undefined>;
  status?: string;
}

const filterTabs: { label: string; value: Tier }[] = [
  { label: "All",             value: "all"     },
  { label: "MSO",             value: "mso"     },
  { label: "Dealers / SO",    value: "dealer"  },
  { label: "Channel Partners",value: "partner" },
  { label: "Clients",         value: "client"  },
];

export default function CustomersPage() {
  const [activeTier, setActiveTier] = useState<Tier>("all");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/customers')
      .then(r => r.json())
      .then(json => {
        if (json.customers) {
          setAccounts(json.customers.map((c: Account) => ({
            ...c,
            status: c.is_active ? 'active' : 'warning',
            stats: { sites: c.site_count ?? 0 },
          })));
        }
      })
      .catch(() => { /* keep empty */ })
      .finally(() => setLoading(false));
  }, []);

  const filtered = activeTier === "all"
    ? accounts
    : accounts.filter(a => a.tier === activeTier);

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Customers"
        subtitle={loading ? "Loading..." : `${accounts.length} accounts across all tiers`}
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

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Loading accounts…</span>
          </div>
        )}

        {/* Account cards */}
        {!loading && <div className="grid grid-cols-3 gap-4">
          {filtered.map((acct) => {
            const tc = tierConfig[acct.tier] ?? tierConfig.client;
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
                    { label: "Dealers",  value: acct.stats?.dealers  },
                    { label: "Clients",  value: acct.stats?.clients  },
                    { label: "Cameras",  value: acct.stats?.cameras  },
                    { label: "Doors",    value: acct.stats?.doors    },
                  ].map(s => (
                    <div key={s.label} className="text-center p-1.5 rounded-lg bg-background/50 border border-border/50">
                      <p className="text-xs font-bold text-foreground">{s.value ?? "—"}</p>
                      <p className="text-[9px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                  {acct.tier === "dealer" && [
                    { label: "Clients",  value: acct.stats?.clients  },
                    { label: "Cameras",  value: acct.stats?.cameras  },
                    { label: "Doors",    value: acct.stats?.doors    },
                    { label: "MRR",      value: acct.stats?.mrr ? `$${acct.stats.mrr}` : "—" },
                  ].map(s => (
                    <div key={s.label} className="text-center p-1.5 rounded-lg bg-background/50 border border-border/50">
                      <p className="text-xs font-bold text-foreground">{s.value ?? "—"}</p>
                      <p className="text-[9px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                  {(acct.tier === "partner" || acct.tier === "client") && [
                    { label: "Cameras", value: acct.stats?.cameras },
                    { label: "Doors",   value: acct.stats?.doors   },
                    { label: "Users",   value: acct.stats?.users   },
                    { label: "Sites",   value: acct.stats?.sites   },
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
        </div>}
      </div>
    </div>
  );
}
