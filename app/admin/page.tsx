"use client";

import { useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Building2, Users, Plus, ChevronRight, ChevronDown,
  MoreHorizontal, Shield, CheckCircle2, Clock, XCircle,
  Mail, Phone, Globe, MapPin, Edit2, Zap, Network,
  Search, AlertTriangle, Check, Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────
type OrgTier = "corporate" | "mso" | "dealer" | "partner" | "client";
type OrgStatus = "active" | "inactive" | "suspended" | "onboarding";

interface OrgNode {
  id: string;
  name: string;
  tier: OrgTier;
  status: OrgStatus;
  parentId: string | null;
  email?: string;
  phone?: string;
  website?: string;
  city?: string;
  state?: string;
  userCount?: number;
  propertyCount?: number;
  mrr?: number;
  primaryColor?: string;
  integrations?: { eagleeye?: boolean; brivo?: boolean; quickbooks?: boolean };
  createdAt?: string;
  children?: OrgNode[];
}

// ── Mock org tree ──────────────────────────────────────────────────────────
const ORG_TREE: OrgNode[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "GateGuard, LLC",
    tier: "corporate",
    status: "active",
    parentId: null,
    email: "rfeldman@gateguard.co",
    phone: "(404) 555-0100",
    website: "gateguard.co",
    city: "Atlanta", state: "GA",
    userCount: 4, propertyCount: 0, mrr: 0,
    primaryColor: "#2563EB",
    createdAt: "Jan 1, 2026",
    children: [
      {
        id: "mso-001",
        name: "Southeast Security Group",
        tier: "mso",
        status: "active",
        parentId: "00000000-0000-0000-0000-000000000001",
        email: "ops@sesecuritygroup.com",
        phone: "(404) 555-0201",
        city: "Atlanta", state: "GA",
        userCount: 2, propertyCount: 0, mrr: 0,
        createdAt: "Jan 15, 2026",
        children: [
          {
            id: "dealer-001",
            name: "SecureATL",
            tier: "dealer",
            status: "active",
            parentId: "mso-001",
            email: "owner@secureatl.com",
            phone: "(404) 555-0301",
            website: "secureatl.com",
            city: "Atlanta", state: "GA",
            userCount: 3, propertyCount: 12, mrr: 14200,
            integrations: { eagleeye: true, brivo: true, quickbooks: false },
            createdAt: "Feb 1, 2026",
            children: [
              {
                id: "partner-001",
                name: "Realty Referrals LLC",
                tier: "partner",
                status: "active",
                parentId: "dealer-001",
                email: "sarah@realtyreferrals.com",
                city: "Decatur", state: "GA",
                userCount: 1, propertyCount: 0, mrr: 0,
                createdAt: "Feb 20, 2026",
                children: [],
              },
            ],
          },
          {
            id: "dealer-002",
            name: "Peach State Access",
            tier: "dealer",
            status: "onboarding",
            parentId: "mso-001",
            email: "mike@peachstateaccess.com",
            phone: "(678) 555-0302",
            city: "Marietta", state: "GA",
            userCount: 1, propertyCount: 2, mrr: 2400,
            integrations: { eagleeye: true, brivo: false, quickbooks: false },
            createdAt: "Apr 10, 2026",
            children: [],
          },
        ],
      },
      {
        id: "mso-002",
        name: "Coastal Systems, Inc.",
        tier: "mso",
        status: "active",
        parentId: "00000000-0000-0000-0000-000000000001",
        email: "contact@coastalsystems.io",
        phone: "(912) 555-0202",
        city: "Savannah", state: "GA",
        userCount: 1, propertyCount: 0, mrr: 0,
        createdAt: "Mar 1, 2026",
        children: [
          {
            id: "dealer-003",
            name: "Tidewater Security",
            tier: "dealer",
            status: "active",
            parentId: "mso-002",
            email: "ops@tidewatersec.com",
            city: "Savannah", state: "GA",
            userCount: 2, propertyCount: 5, mrr: 6100,
            integrations: { eagleeye: true, brivo: false, quickbooks: true },
            createdAt: "Mar 15, 2026",
            children: [],
          },
        ],
      },
    ],
  },
];

// ── Config ─────────────────────────────────────────────────────────────────
const TIER_META: Record<OrgTier, { label: string; color: string; bg: string; border: string; dot: string }> = {
  corporate: { label: "Corporate",       color: "text-brand-400",   bg: "bg-brand-400/8",   border: "border-brand-400/20",   dot: "bg-brand-400" },
  mso:       { label: "Master SO",       color: "text-violet-600",  bg: "bg-violet-50",     border: "border-violet-200",     dot: "bg-violet-400" },
  dealer:    { label: "System Operator", color: "text-sky-600",     bg: "bg-sky-50",        border: "border-sky-200",        dot: "bg-sky-400" },
  partner:   { label: "Channel Partner", color: "text-emerald-600", bg: "bg-emerald-50",    border: "border-emerald-200",    dot: "bg-emerald-400" },
  client:    { label: "Client",          color: "text-amber-600",   bg: "bg-amber-50",      border: "border-amber-200",      dot: "bg-amber-400" },
};

const STATUS_META: Record<OrgStatus, { label: string; color: string; dot: string }> = {
  active:     { label: "Active",     color: "text-emerald-600", dot: "bg-emerald-400" },
  inactive:   { label: "Inactive",   color: "text-slate-400",   dot: "bg-slate-400" },
  suspended:  { label: "Suspended",  color: "text-red-500",     dot: "bg-red-400" },
  onboarding: { label: "Onboarding", color: "text-amber-600",   dot: "bg-amber-400" },
};

function flattenTree(nodes: OrgNode[]): OrgNode[] {
  const result: OrgNode[] = [];
  function walk(n: OrgNode) { result.push(n); (n.children || []).forEach(walk); }
  nodes.forEach(walk);
  return result;
}

// ── Invite drawer ──────────────────────────────────────────────────────────
function InviteDrawer({
  onClose,
  allOrgs,
}: {
  onClose: () => void;
  allOrgs: OrgNode[];
}) {
  const [tier, setTier]     = useState<OrgTier>("dealer");
  const [name, setName]     = useState("");
  const [email, setEmail]   = useState("");
  const [parent, setParent] = useState("");
  const [sent, setSent]     = useState(false);

  const parentOptions = allOrgs.filter(o => {
    if (tier === "mso")     return o.tier === "corporate";
    if (tier === "dealer")  return o.tier === "mso";
    if (tier === "partner") return o.tier === "dealer";
    if (tier === "client")  return o.tier === "dealer";
    return false;
  });

  function handleSend() {
    if (!name || !email || !parent) return;
    setSent(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      {/* Panel */}
      <div className="w-[440px] bg-white border-l border-border h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground">Invite Organization</h2>
            <p className="text-xs text-muted-foreground">Create a new org and send an invite email</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <XCircle size={16} />
          </button>
        </div>

        {sent ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground mb-1">Invite Sent!</p>
              <p className="text-sm text-muted-foreground">
                An invitation email was sent to <strong>{email}</strong>.<br />
                The org record for <strong>{name}</strong> has been created with <em>onboarding</em> status.
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 px-5 py-2 rounded-lg bg-brand-400 text-white text-sm font-medium hover:bg-brand-500 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Tier selector */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Org Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(["mso","dealer","partner","client"] as OrgTier[]).map(t => {
                  const m = TIER_META[t];
                  return (
                    <button
                      key={t}
                      onClick={() => { setTier(t); setParent(""); }}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all",
                        tier === t
                          ? `${m.bg} ${m.border} ${m.color} font-semibold`
                          : "border-border text-muted-foreground hover:bg-accent"
                      )}
                    >
                      <div className={cn("w-2 h-2 rounded-full shrink-0", m.dot)} />
                      <span className="text-xs">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Org name */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Organization Name <span className="text-red-400">*</span>
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. SecureATL"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:border-brand-400/60 focus:outline-none bg-background transition-colors"
              />
            </div>

            {/* Admin email */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Admin Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="owner@example.com"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:border-brand-400/60 focus:outline-none bg-background transition-colors"
              />
              <p className="text-[11px] text-muted-foreground mt-1">An invitation to create their admin account will be sent here.</p>
            </div>

            {/* Parent org */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Parent Organization <span className="text-red-400">*</span>
              </label>
              {parentOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No valid parent orgs found for this tier.</p>
              ) : (
                <select
                  value={parent}
                  onChange={e => setParent(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:border-brand-400/60 focus:outline-none bg-background transition-colors"
                >
                  <option value="">Select parent…</option>
                  {parentOptions.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Info box */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5">
              <p className="text-[11px] text-blue-700 leading-relaxed">
                <strong>What happens next:</strong> An org record is created with <em>onboarding</em> status.
                The admin receives an email to set up their Clerk account. Once they log in,
                they can configure integrations, add staff, and start managing properties.
              </p>
            </div>
          </div>
        )}

        {!sent && (
          <div className="px-6 py-4 border-t border-border flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!name || !email || !parent}
              className="flex-1 px-4 py-2 rounded-lg bg-brand-400 hover:bg-brand-500 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Mail size={13} /> Send Invite
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Org detail panel ───────────────────────────────────────────────────────
function OrgDetailPanel({ org, onClose }: { org: OrgNode; onClose: () => void }) {
  const tier   = TIER_META[org.tier];
  const status = STATUS_META[org.status];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[420px] bg-white border-l border-border h-full flex flex-col shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("w-11 h-11 rounded-xl border flex items-center justify-center shrink-0", tier.bg, tier.border)}>
                <Building2 size={20} className={tier.color} />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">{org.name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", tier.bg, tier.border, tier.color)}>
                    {tier.label}
                  </span>
                  <div className="flex items-center gap-1">
                    <div className={cn("w-1.5 h-1.5 rounded-full", status.dot)} />
                    <span className={cn("text-[11px] font-medium", status.color)}>{status.label}</span>
                  </div>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
              <XCircle size={15} />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Users",      value: org.userCount ?? 0,  suffix: "" },
              { label: "Properties", value: org.propertyCount ?? 0, suffix: "" },
              { label: "MRR",        value: org.mrr ? `$${(org.mrr/1000).toFixed(1)}k` : "—", suffix: "" },
            ].map(s => (
              <div key={s.label} className="bg-muted/40 rounded-xl p-3 text-center border border-border">
                <p className="text-base font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Contact info */}
          <div>
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Contact</h3>
            <div className="space-y-2">
              {org.email && (
                <a href={`mailto:${org.email}`} className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-brand-400 transition-colors group">
                  <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
                    <Mail size={13} />
                  </div>
                  {org.email}
                </a>
              )}
              {org.phone && (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
                    <Phone size={13} />
                  </div>
                  {org.phone}
                </div>
              )}
              {org.website && (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
                    <Globe size={13} />
                  </div>
                  {org.website}
                </div>
              )}
              {(org.city || org.state) && (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
                    <MapPin size={13} />
                  </div>
                  {[org.city, org.state].filter(Boolean).join(", ")}
                </div>
              )}
            </div>
          </div>

          {/* Integrations (dealers only) */}
          {org.integrations && (
            <div>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Integrations</h3>
              <div className="space-y-2">
                {(["eagleeye","brivo","quickbooks"] as const).map(key => {
                  const active = org.integrations![key];
                  const labels: Record<string, string> = { eagleeye: "EagleEye VSaaS", brivo: "Brivo Access", quickbooks: "QuickBooks" };
                  return (
                    <div key={key} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border">
                      <div className="flex items-center gap-2">
                        <Zap size={12} className={active ? "text-emerald-500" : "text-muted-foreground"} />
                        <span className="text-sm text-foreground">{labels[key]}</span>
                      </div>
                      <span className={cn(
                        "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                        active ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"
                      )}>
                        {active ? "Connected" : "Not set up"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Status controls */}
          <div>
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Account Status</h3>
            <div className="grid grid-cols-2 gap-2">
              {(["active","onboarding","suspended","inactive"] as OrgStatus[]).map(s => {
                const m = STATUS_META[s];
                return (
                  <button
                    key={s}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all",
                      org.status === s
                        ? "border-brand-400/40 bg-brand-400/8 text-brand-400"
                        : "border-border text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <div className={cn("w-1.5 h-1.5 rounded-full", m.dot)} />
                    {m.label}
                    {org.status === s && <Check size={11} className="ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Org ID */}
          <div>
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Org ID</h3>
            <div className="flex items-center gap-2 bg-muted/40 rounded-lg border border-border px-3 py-2">
              <code className="text-[11px] text-muted-foreground flex-1 truncate font-mono">{org.id}</code>
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <Copy size={12} />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-1 space-y-2">
            <button className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-border hover:bg-accent text-sm font-medium text-foreground transition-colors">
              <Edit2 size={14} className="text-muted-foreground" /> Edit Organization
            </button>
            <button className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-border hover:bg-accent text-sm font-medium text-foreground transition-colors">
              <Users size={14} className="text-muted-foreground" /> Manage Users
            </button>
            <button className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-red-200 hover:bg-red-50 text-sm font-medium text-red-500 transition-colors">
              <Shield size={14} /> Suspend Organization
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Org row (recursive tree) ───────────────────────────────────────────────
function OrgRow({
  org,
  depth,
  onSelect,
}: {
  org: OrgNode;
  depth: number;
  onSelect: (o: OrgNode) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = (org.children?.length ?? 0) > 0;
  const tier   = TIER_META[org.tier];
  const status = STATUS_META[org.status];

  return (
    <>
      <tr
        className="border-b border-border/60 hover:bg-accent/40 transition-colors cursor-pointer group"
        onClick={() => onSelect(org)}
      >
        {/* Name + expand */}
        <td className="px-4 py-3">
          <div className="flex items-center" style={{ paddingLeft: `${depth * 20}px` }}>
            {hasChildren ? (
              <button
                onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
                className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors mr-1.5 shrink-0"
              >
                {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
            ) : (
              <div className="w-5 mr-1.5 shrink-0" />
            )}
            <div className={cn("w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mr-2.5", tier.bg, tier.border)}>
              <Building2 size={13} className={tier.color} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{org.name}</p>
              {(org.city || org.state) && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <MapPin size={9} />{[org.city, org.state].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
          </div>
        </td>

        {/* Tier */}
        <td className="px-4 py-3">
          <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full border", tier.bg, tier.border, tier.color)}>
            {tier.label}
          </span>
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", status.dot)} />
            <span className={cn("text-xs font-medium", status.color)}>{status.label}</span>
          </div>
        </td>

        {/* Users */}
        <td className="px-4 py-3 text-sm text-center text-muted-foreground">
          {org.userCount ?? "—"}
        </td>

        {/* Properties */}
        <td className="px-4 py-3 text-sm text-center text-muted-foreground">
          {org.propertyCount ?? "—"}
        </td>

        {/* MRR */}
        <td className="px-4 py-3 text-sm font-medium text-foreground">
          {org.mrr ? `$${org.mrr.toLocaleString()}` : "—"}
        </td>

        {/* Integrations */}
        <td className="px-4 py-3">
          {org.integrations ? (
            <div className="flex items-center gap-1">
              {(["eagleeye","brivo","quickbooks"] as const).map(k => (
                <span
                  key={k}
                  title={k}
                  className={cn(
                    "w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center border",
                    org.integrations![k]
                      ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                      : "bg-slate-50 border-slate-200 text-slate-400"
                  )}
                >
                  {k === "eagleeye" ? "EE" : k === "brivo" ? "BR" : "QB"}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>

        {/* Created */}
        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{org.createdAt ?? "—"}</td>

        {/* Arrow */}
        <td className="px-4 py-3">
          <ChevronRight size={13} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </td>
      </tr>

      {/* Recurse */}
      {expanded && org.children?.map(child => (
        <OrgRow key={child.id} org={child} depth={depth + 1} onSelect={onSelect} />
      ))}
    </>
  );
}

// ── Summary cards ──────────────────────────────────────────────────────────
function SummaryCards({ orgs }: { orgs: OrgNode[] }) {
  const all     = flattenTree(orgs);
  const msoCnt  = all.filter(o => o.tier === "mso").length;
  const dealers = all.filter(o => o.tier === "dealer");
  const active  = dealers.filter(o => o.status === "active").length;
  const onboard = all.filter(o => o.status === "onboarding").length;
  const totalMrr = dealers.reduce((s, d) => s + (d.mrr ?? 0), 0);

  return (
    <div className="grid grid-cols-4 gap-3 mb-5">
      {[
        { label: "MSOs",             value: msoCnt,              icon: Network,       color: "text-violet-600",  bg: "bg-violet-50" },
        { label: "Active Dealers",   value: active,              icon: Building2,     color: "text-sky-600",     bg: "bg-sky-50" },
        { label: "In Onboarding",    value: onboard,             icon: Clock,         color: "text-amber-600",   bg: "bg-amber-50" },
        { label: "Network MRR",      value: `$${(totalMrr/1000).toFixed(1)}k`, icon: Zap, color: "text-emerald-600", bg: "bg-emerald-50" },
      ].map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", bg)}>
            <Icon size={16} className={color} />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
            <p className="text-lg font-semibold text-foreground leading-tight">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [selected, setSelected]     = useState<OrgNode | null>(null);
  const [showInvite, setShowInvite]  = useState(false);
  const [search, setSearch]          = useState("");
  const allOrgs = flattenTree(ORG_TREE);

  // Filter: if searching, show flat filtered list; else tree
  const searchActive = search.trim().length > 0;
  const filtered = searchActive
    ? allOrgs.filter(o =>
        o.name.toLowerCase().includes(search.toLowerCase()) ||
        (o.email || "").toLowerCase().includes(search.toLowerCase()) ||
        (o.city || "").toLowerCase().includes(search.toLowerCase())
      )
    : [];

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Organizations"
        subtitle="Hierarchy: Corporate → MSO → Dealer → Partner → Client"
        actions={
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-400 hover:bg-brand-500 text-white transition-colors gg-glow"
          >
            <Plus size={13} /> Invite Org
          </button>
        }
      />

      <div className="flex-1 p-6">
        <SummaryCards orgs={ORG_TREE} />

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search organizations…"
              className="w-full pl-8 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:border-brand-400/60 focus:outline-none transition-colors"
            />
          </div>
          <div className="flex-1" />
          {/* Tier legend */}
          <div className="flex items-center gap-3">
            {(Object.entries(TIER_META) as [OrgTier, typeof TIER_META[OrgTier]][]).map(([key, m]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full", m.dot)} />
                <span className="text-[11px] text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Organization", "Tier", "Status", "Users", "Properties", "MRR", "Integrations", "Created", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {searchActive
                ? filtered.map(o => <OrgRow key={o.id} org={o} depth={0} onSelect={setSelected} />)
                : ORG_TREE.map(o => <OrgRow key={o.id} org={o} depth={0} onSelect={setSelected} />)
              }
            </tbody>
          </table>
          {searchActive && filtered.length === 0 && (
            <div className="text-center py-12">
              <AlertTriangle size={24} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No organizations match "{search}"</p>
            </div>
          )}
        </div>
      </div>

      {/* Org detail panel */}
      {selected && <OrgDetailPanel org={selected} onClose={() => setSelected(null)} />}

      {/* Invite drawer */}
      {showInvite && <InviteDrawer onClose={() => setShowInvite(false)} allOrgs={allOrgs} />}
    </div>
  );
}
