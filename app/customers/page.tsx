"use client";
import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import Link from "next/link";
import {
  Plus, Eye, Settings, Phone, Mail, MapPin,
  Building2, Users, Shield, Camera, ChevronRight, Network,
  Loader2, RefreshCw, X,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRow } from "@/components/ui/SkeletonRow";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DollarSign } = require("lucide-react") as any;

type OrgTier =
  | "corporate" | "master_agent" | "master_dealer"
  | "full_dealer" | "service_dealer" | "install_contractor"
  | "sales_partner" | "client";

type FilterTier = "all" | OrgTier;

interface OrgRecord {
  id: string;
  name: string;
  org_tier: OrgTier;
  is_active: boolean;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  city: string | null;
  state: string | null;
  parent_name: string | null;
  site_count: number;
  tier_label: string;
  onboarded_at: string | null;
  created_at: string;
}

interface HierarchySummary {
  corporate: number;
  master_agent: number;
  master_dealer: number;
  full_dealer: number;
  service_dealer: number;
  install_contractor: number;
  sales_partner: number;
  client: number;
}

const TIER_CONFIG: Record<OrgTier, { label: string; cls: string; icon: string }> = {
  corporate:          { label: "Corporate",    cls: "tier-corporate", icon: "🏢" },
  master_agent:       { label: "Master Agent", cls: "tier-mso",       icon: "⭐" },
  master_dealer:      { label: "MSO",          cls: "tier-mso",       icon: "🌐" },
  full_dealer:        { label: "Dealer",        cls: "tier-dealer",    icon: "🔧" },
  service_dealer:     { label: "Svc Partner",  cls: "tier-partner",   icon: "🛠️" },
  install_contractor: { label: "Installer",    cls: "tier-partner",   icon: "🔩" },
  sales_partner:      { label: "Sales Partner",cls: "tier-partner",   icon: "🤝" },
  client:             { label: "Client",        cls: "tier-client",    icon: "🏘️" },
};

const FILTER_TABS: { label: string; value: FilterTier }[] = [
  { label: "All",           value: "all"              },
  { label: "Master Agents", value: "master_agent"     },
  { label: "MSOs",          value: "master_dealer"    },
  { label: "Dealers",       value: "full_dealer"      },
  { label: "Svc Partners",  value: "service_dealer"   },
  { label: "Installers",    value: "install_contractor"},
  { label: "Sales Partners",value: "sales_partner"    },
  { label: "Clients",       value: "client"           },
];

const EMPTY_FORM = {
  name: "",
  org_tier: "full_dealer" as OrgTier,
  primary_contact_name: "",
  primary_contact_email: "",
  primary_contact_phone: "",
  city: "",
  state: "GA",
};

export default function CustomersPage() {
  const [activeTier, setActiveTier]     = useState<FilterTier>("all");
  const [search, setSearch]             = useState("");
  const [records, setRecords]           = useState<OrgRecord[]>([]);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [showNew, setShowNew]           = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState<string | null>(null);

  const hierarchy = records.reduce<HierarchySummary>((acc, r) => {
    acc[r.org_tier] = (acc[r.org_tier] ?? 0) + 1;
    return acc;
  }, {} as HierarchySummary);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (activeTier !== "all") params.set("tier", activeTier);
      if (search.trim())        params.set("q", search.trim());
      const res = await fetch(`/api/customers?${params}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRecords(data.records ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [activeTier, search]);

  useEffect(() => {
    const t = setTimeout(fetchCustomers, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [fetchCustomers, search]);

  async function createAccount() {
    if (!form.name.trim() || !form.org_tier) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create");
      }
      setShowNew(false);
      setForm(EMPTY_FORM);
      fetchCustomers();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  const hierarchyPills = [
    { label: "Master Agents", sublabel: "Channel leaders",    cls: "tier-mso",     count: hierarchy.master_agent     ?? 0 },
    { label: "MSOs",          sublabel: "Multi-site ops",     cls: "tier-mso",     count: hierarchy.master_dealer    ?? 0 },
    { label: "Dealers",       sublabel: "System operators",   cls: "tier-dealer",  count: hierarchy.full_dealer      ?? 0 },
    { label: "Partners",      sublabel: "Svc / Install / Sales", cls: "tier-partner", count: (hierarchy.service_dealer ?? 0) + (hierarchy.install_contractor ?? 0) + (hierarchy.sales_partner ?? 0) },
    { label: "Clients",       sublabel: "Properties",         cls: "tier-client",  count: hierarchy.client           ?? 0 },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Customers"
        subtitle={loading ? "Loading…" : `${total} accounts across all tiers`}
        actions={
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-400 hover:bg-brand-500 text-navy-DEFAULT text-sm font-semibold transition-colors gg-glow"
          >
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
            {hierarchyPills.map((tier, i, arr) => (
              <div key={tier.label} className="flex items-center">
                <div className={`px-4 py-2.5 rounded-lg text-center ${tier.cls} min-w-[110px]`}>
                  <p className="text-sm font-bold">{loading ? "…" : tier.count}</p>
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
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 overflow-x-auto shrink-0">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTier(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTier === tab.value
                    ? "bg-brand-400 text-navy-DEFAULT font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex-1">
            <input
              type="text"
              placeholder='Search accounts…'
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand-400/50"
            />
          </div>
        </div>

        {/* States */}
        {loading && (
          <SkeletonRow rows={6} cols={4} />
        )}

        {!loading && error && (
          <div className="flex items-center justify-center py-16 gap-3">
            <span className="text-sm text-destructive">{error}</span>
            <button onClick={fetchCustomers} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5">
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {!loading && !error && records.length === 0 && (
          <EmptyState
            icon={<Users size={32} className="text-muted-foreground" />}
            title="No customers yet"
            description={search ? `No accounts found matching "${search}"` : "Add your first customer to get started"}
          />
        )}

        {/* Account cards */}
        {!loading && !error && records.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {records.map((acct) => {
              const tc = TIER_CONFIG[acct.org_tier] ?? { label: acct.org_tier, cls: "tier-client", icon: "🏢" };
              const viewHref = `/customers/${acct.id}`;
              const location = [acct.city, acct.state].filter(Boolean).join(", ");
              return (
                <div
                  key={acct.id}
                  className="bg-card border border-border rounded-xl p-4 hover:border-brand-400/30 transition-all group cursor-pointer"
                >
                  {/* Header */}
                  <Link href={viewHref} className="flex items-start justify-between mb-3 block">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${acct.is_active ? "status-online" : "status-warning"}`} />
                        <h3 className="text-sm font-semibold text-foreground group-hover:text-brand-400 transition-colors truncate">
                          {acct.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 ml-3.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${tc.cls}`}>
                          {tc.icon} {tc.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-[80px]">{acct.id.slice(0,8)}</span>
                      </div>
                    </div>
                  </Link>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                    <div className="text-center p-1.5 rounded-lg bg-background/50 border border-border/50">
                      <p className="text-xs font-bold text-foreground">{acct.site_count}</p>
                      <p className="text-[9px] text-muted-foreground">Sites</p>
                    </div>
                    <div className="text-center p-1.5 rounded-lg bg-background/50 border border-border/50">
                      <p className="text-xs font-bold text-foreground">—</p>
                      <p className="text-[9px] text-muted-foreground">Cameras</p>
                    </div>
                    <div className="text-center p-1.5 rounded-lg bg-background/50 border border-border/50">
                      <p className="text-xs font-bold text-foreground">—</p>
                      <p className="text-[9px] text-muted-foreground">Doors</p>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="text-[11px] text-muted-foreground space-y-0.5 border-t border-border/50 pt-2.5 mb-2.5">
                    {acct.primary_contact_name && (
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <Users size={10} className="text-brand-400" /> {acct.primary_contact_name}
                      </div>
                    )}
                    {acct.primary_contact_email && (
                      <div className="flex items-center gap-1.5 truncate"><Mail size={9} /> {acct.primary_contact_email}</div>
                    )}
                    {acct.primary_contact_phone && (
                      <div className="flex items-center gap-1.5"><Phone size={9} /> {acct.primary_contact_phone}</div>
                    )}
                    {location && (
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin size={9} /> <span className="truncate">{location}</span>
                      </div>
                    )}
                    {acct.parent_name && (
                      <div className="flex items-center gap-1.5 text-brand-400/70">
                        <Building2 size={9} /> Under: {acct.parent_name}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-border/50">
                    <Link href={viewHref} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                      <Eye size={12} /> View
                    </Link>
                    <Link href="/cameras" className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                      <Camera size={12} /> Cameras
                    </Link>
                    <Link href="/access" className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                      <Shield size={12} /> Access
                    </Link>
                    <Link href={viewHref} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                      <Settings size={12} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Account Slide-over */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setShowNew(false)} />
          <div className="w-[420px] bg-card border-l border-border flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">New Account</h2>
              <button onClick={() => setShowNew(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Organization Name *</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50"
                  placeholder="Acme Properties LLC"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Organization Type *</label>
                <select
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50"
                  value={form.org_tier}
                  onChange={e => setForm(f => ({ ...f, org_tier: e.target.value as OrgTier }))}
                >
                  <option value="master_agent">Master Agent</option>
                  <option value="master_dealer">MSO — Master System Operator</option>
                  <option value="full_dealer">Dealer</option>
                  <option value="service_dealer">Service Partner</option>
                  <option value="install_contractor">Installation Partner</option>
                  <option value="sales_partner">Sales Partner</option>
                  <option value="client">Client (Property)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">City</label>
                  <input
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50"
                    placeholder="Atlanta"
                    value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">State</label>
                  <input
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50"
                    placeholder="GA"
                    maxLength={2}
                    value={form.state}
                    onChange={e => setForm(f => ({ ...f, state: e.target.value.toUpperCase() }))}
                  />
                </div>
              </div>
              <hr className="border-border" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Primary Contact</p>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Name</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50"
                  placeholder="Jane Smith"
                  value={form.primary_contact_name}
                  onChange={e => setForm(f => ({ ...f, primary_contact_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50"
                  placeholder="jane@company.com"
                  value={form.primary_contact_email}
                  onChange={e => setForm(f => ({ ...f, primary_contact_email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Phone</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50"
                  placeholder="404-555-0100"
                  value={form.primary_contact_phone}
                  onChange={e => setForm(f => ({ ...f, primary_contact_phone: e.target.value }))}
                />
              </div>

              {saveError && (
                <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{saveError}</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border flex gap-3">
              <button
                onClick={() => setShowNew(false)}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createAccount}
                disabled={saving || !form.name.trim()}
                className="flex-1 py-2.5 rounded-lg bg-brand-400 hover:bg-brand-500 text-navy-DEFAULT text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {saving ? "Creating…" : "Create Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
