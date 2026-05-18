"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import {
  Mail, Phone, MapPin, Building2, Users,
  CheckCircle2, Clock, AlertTriangle, ExternalLink,
  Shield, Wrench, FileText, Star, Loader2,
  RefreshCw, X,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowLeft, Camera, DollarSign, Edit2, Activity, Save } = require("lucide-react") as any;

type OrgTier =
  | "corporate" | "master_agent" | "master_dealer"
  | "full_dealer" | "service_dealer" | "install_contractor"
  | "sales_partner" | "client";

interface Site {
  id: string; name: string; address: string | null;
  city: string | null; state: string | null; status: string; created_at: string;
}

interface ChildOrg {
  id: string; name: string; org_tier: OrgTier;
  is_active: boolean; primary_contact_name: string | null;
}

interface WorkOrder {
  id: string; title: string; status: string;
  scheduled_date: string | null; priority: string; site_id: string;
}

interface OrgDetail {
  id: string; name: string; org_tier: OrgTier;
  is_active: boolean;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  city: string | null; state: string | null;
  parent_org_id: string | null;
  parent_name: string | null;
  onboarded_at: string | null;
  notes: string | null;
  sites: Site[];
  children: ChildOrg[];
  recent_work_orders: WorkOrder[];
  stats: { sites: number; cameras: number; doors: number; children: number };
}

const TIER_CONFIG: Record<string, { label: string; cls: string; icon: string }> = {
  corporate:          { label: "Corporate",    cls: "bg-brand-400/10 text-brand-400 border border-brand-400/20",    icon: "🏢" },
  master_agent:       { label: "Master Agent", cls: "bg-violet-50 text-violet-700 border border-violet-200",         icon: "⭐" },
  master_dealer:      { label: "MSO",          cls: "bg-violet-50 text-violet-700 border border-violet-200",         icon: "🌐" },
  full_dealer:        { label: "Dealer",        cls: "bg-sky-50 text-sky-700 border border-sky-200",                 icon: "🔧" },
  service_dealer:     { label: "Svc Partner",  cls: "bg-emerald-50 text-emerald-700 border border-emerald-200",     icon: "🛠️" },
  install_contractor: { label: "Installer",    cls: "bg-teal-50 text-teal-700 border border-teal-200",              icon: "🔩" },
  sales_partner:      { label: "Sales Partner",cls: "bg-emerald-50 text-emerald-700 border border-emerald-200",     icon: "🤝" },
  client:             { label: "Client",        cls: "bg-amber-50 text-amber-700 border border-amber-200",           icon: "🏘️" },
};

const WO_STATUS_COLOR: Record<string, string> = {
  open:         "text-blue-500",
  in_progress:  "text-amber-500",
  completed:    "text-emerald-500",
  cancelled:    "text-muted-foreground",
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [org, setOrg]           = useState<OrgDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<Partial<OrgDetail>>({});
  const [saving, setSaving]     = useState(false);
  const [saveErr, setSaveErr]   = useState<string | null>(null);

  async function fetchOrg() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${id}`);
      if (!res.ok) throw new Error(await res.text());
      const data: OrgDetail = await res.json();
      setOrg(data);
      setEditForm({
        name: data.name,
        primary_contact_name: data.primary_contact_name ?? "",
        primary_contact_email: data.primary_contact_email ?? "",
        primary_contact_phone: data.primary_contact_phone ?? "",
        city: data.city ?? "",
        state: data.state ?? "",
        notes: data.notes ?? "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchOrg(); }, [id]);

  async function saveEdit() {
    if (!org) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setOrg(o => o ? { ...o, ...updated } : o);
      setShowEdit(false);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Error saving");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar title="Loading…" />
        <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 size={18} className="animate-spin" /> Loading account…
        </div>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar title="Account Not Found" />
        <div className="flex-1 flex items-center justify-center flex-col gap-4">
          <p className="text-muted-foreground text-sm">{error ?? "Account not found."}</p>
          <div className="flex items-center gap-3">
            <button onClick={fetchOrg} className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent">
              <RefreshCw size={12} /> Retry
            </button>
            <Link href="/customers" className="text-brand-400 hover:underline text-sm flex items-center gap-1">
              <ArrowLeft size={14} /> Back to Customers
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const tc = TIER_CONFIG[org.org_tier] ?? TIER_CONFIG.client;
  const location = [org.city, org.state].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        title={org.name}
        subtitle={`${tc.icon} ${tc.label}${location ? ` · ${location}` : ""}`}
        actions={
          <Link
            href="/customers"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={15} /> Customers
          </Link>
        }
      />

      <div className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-5">

        {/* Header card */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-brand-400/10 border border-brand-400/20 flex items-center justify-center text-xl font-bold text-brand-400">
                {org.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-semibold text-foreground">{org.name}</h2>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${tc.cls}`}>
                    {tc.icon} {tc.label}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${org.is_active ? "bg-emerald-500" : "bg-amber-400"}`} />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {location && (
                    <span className="flex items-center gap-1"><MapPin size={13} /> {location}</span>
                  )}
                  {org.parent_name && (
                    <span className="flex items-center gap-1"><Building2 size={13} /> Under: {org.parent_name}</span>
                  )}
                  {org.onboarded_at && (
                    <span className="text-xs">
                      Onboarded {new Date(org.onboarded_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-accent transition-colors"
            >
              <Edit2 size={13} /> Edit
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 mt-5 pt-5 border-t border-border">
            {[
              { label: "Sites",    value: org.stats.sites    },
              { label: "Children", value: org.stats.children },
              { label: "Cameras",  value: org.stats.cameras  },
              { label: "Doors",    value: org.stats.doors    },
            ].map(s => (
              <div key={s.label} className="text-center p-3 rounded-xl bg-background/50 border border-border/50">
                <p className="text-lg font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-5">
          {/* Contact info */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users size={14} className="text-brand-400" /> Primary Contact
            </h3>
            <div className="space-y-2 text-sm">
              {org.primary_contact_name ? (
                <p className="font-medium text-foreground">{org.primary_contact_name}</p>
              ) : (
                <p className="text-muted-foreground italic text-xs">No contact set</p>
              )}
              {org.primary_contact_email && (
                <a href={`mailto:${org.primary_contact_email}`} className="flex items-center gap-2 text-muted-foreground hover:text-brand-400 transition-colors truncate">
                  <Mail size={13} className="shrink-0" /> <span className="truncate">{org.primary_contact_email}</span>
                </a>
              )}
              {org.primary_contact_phone && (
                <a href={`tel:${org.primary_contact_phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-brand-400 transition-colors">
                  <Phone size={13} /> {org.primary_contact_phone}
                </a>
              )}
              {location && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <MapPin size={13} /> {location}
                </p>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Activity size={14} className="text-brand-400" /> Quick Actions
            </h3>
            <div className="space-y-2">
              {[
                { href: "/cameras",     icon: Camera,    label: "View Cameras"    },
                { href: "/access",      icon: Shield,    label: "Access Control"  },
                { href: "/maintenance", icon: Wrench,    label: "Work Orders"     },
                { href: "/quotes",      icon: FileText,  label: "Quotes"          },
                { href: "/billing",     icon: DollarSign,label: "Billing"         },
              ].map(a => (
                <Link key={a.href} href={a.href} className="flex items-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg px-3 py-2 transition-colors">
                  <a.icon size={14} className="text-brand-400" /> {a.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Star size={14} className="text-brand-400" /> Notes
            </h3>
            {org.notes ? (
              <p className="text-sm text-muted-foreground">{org.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No notes. Click Edit to add.</p>
            )}
          </div>
        </div>

        {/* Child organizations */}
        {org.children.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Building2 size={14} className="text-brand-400" /> Sub-Organizations ({org.children.length})
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {org.children.map(child => {
                const childTc = TIER_CONFIG[child.org_tier] ?? TIER_CONFIG.client;
                return (
                  <Link key={child.id} href={`/customers/${child.id}`} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-brand-400/30 hover:bg-accent transition-all">
                    <div className="w-8 h-8 rounded-lg bg-brand-400/10 flex items-center justify-center text-xs font-bold text-brand-400">
                      {child.name.slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{child.name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${childTc.cls}`}>
                        {childTc.icon} {childTc.label}
                      </span>
                    </div>
                    {child.primary_contact_name && (
                      <p className="text-[10px] text-muted-foreground truncate max-w-[80px]">{child.primary_contact_name}</p>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Sites / Properties */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Building2 size={14} className="text-brand-400" /> Properties / Sites ({org.stats.sites})
            </h3>
            <Link href="/sites" className="text-xs text-brand-400 hover:underline flex items-center gap-1">
              View all <ExternalLink size={11} />
            </Link>
          </div>
          {org.sites.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <Building2 size={24} className="mx-auto mb-2 text-muted-foreground/40" />
              <p>No sites yet for this organization.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {org.sites.map(site => (
                <Link key={site.id} href={`/sites/${site.id}`} className="flex items-center justify-between p-3 rounded-xl border border-border hover:border-brand-400/30 hover:bg-accent transition-all group">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${site.status === "active" ? "bg-emerald-500" : "bg-amber-400"}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-brand-400 transition-colors">{site.name}</p>
                      {(site.city || site.state) && (
                        <p className="text-xs text-muted-foreground">{[site.city, site.state].filter(Boolean).join(", ")}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">{site.status}</span>
                </Link>
              ))}
              {org.stats.sites > org.sites.length && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{org.stats.sites - org.sites.length} more sites —{" "}
                  <Link href="/sites" className="text-brand-400 hover:underline">View all</Link>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Recent work orders */}
        {org.recent_work_orders.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Wrench size={14} className="text-brand-400" /> Recent Work Orders
              </h3>
              <Link href="/maintenance" className="text-xs text-brand-400 hover:underline flex items-center gap-1">
                View all <ExternalLink size={11} />
              </Link>
            </div>
            <div className="space-y-2">
              {org.recent_work_orders.map(wo => (
                <Link key={wo.id} href={`/maintenance/${wo.id}`} className="flex items-center justify-between p-3 rounded-xl border border-border hover:border-brand-400/30 hover:bg-accent transition-all group">
                  <div className="flex items-center gap-3">
                    <Wrench size={13} className={WO_STATUS_COLOR[wo.status] ?? "text-muted-foreground"} />
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-brand-400 transition-colors">{wo.title}</p>
                      {wo.scheduled_date && (
                        <p className="text-xs text-muted-foreground">
                          {new Date(wo.scheduled_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold capitalize ${wo.priority === "urgent" ? "text-red-500" : wo.priority === "high" ? "text-amber-500" : "text-muted-foreground"}`}>
                      {wo.priority}
                    </span>
                    <span className={`text-[10px] capitalize ${WO_STATUS_COLOR[wo.status] ?? "text-muted-foreground"}`}>
                      {wo.status.replace("_", " ")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Edit slide-over */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setShowEdit(false)} />
          <div className="w-[420px] bg-card border-l border-border flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Edit Account</h2>
              <button onClick={() => setShowEdit(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Organization Name</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50"
                  value={editForm.name ?? ""}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">City</label>
                  <input
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50"
                    value={editForm.city ?? ""}
                    onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">State</label>
                  <input
                    maxLength={2}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50"
                    value={editForm.state ?? ""}
                    onChange={e => setEditForm(f => ({ ...f, state: e.target.value.toUpperCase() }))}
                  />
                </div>
              </div>
              <hr className="border-border" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Primary Contact</p>
              {(["primary_contact_name", "primary_contact_email", "primary_contact_phone"] as const).map(field => (
                <div key={field}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5 capitalize">
                    {field.replace("primary_contact_", "").replace("_", " ")}
                  </label>
                  <input
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50"
                    value={(editForm[field] as string) ?? ""}
                    onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                  />
                </div>
              ))}
              <hr className="border-border" />
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Notes</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50 resize-none"
                  value={editForm.notes ?? ""}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
              {saveErr && (
                <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{saveErr}</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border flex gap-3">
              <button onClick={() => setShowEdit(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-brand-400 hover:bg-brand-500 text-navy-DEFAULT text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
