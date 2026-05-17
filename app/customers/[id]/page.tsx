"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import {
  Mail, Phone, MapPin, Building2, Users,
  CheckCircle2, Clock, AlertTriangle, ExternalLink,
  Shield, Wrench, FileText, Star,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowLeft, Camera, DollarSign, Edit2, Activity } = require("lucide-react") as any;

// Shared account data — same source as customers list
const ACCOUNTS: Record<string, {
  id: string; tier: string; name: string;
  contact: string; email: string; phone: string; location: string;
  status: string; stats: Record<string, number | string | undefined>;
  parent?: string; notes?: string;
}> = {
  "MSO-001": {
    id: "MSO-001", tier: "mso", name: "Southeast Security Group",
    contact: "David Marsh", email: "david@sesecuritygroup.com", phone: "678-555-0100",
    location: "Atlanta, GA", status: "active",
    stats: { dealers: 4, clients: 28, cameras: 412, doors: 180 },
    notes: "Largest MSO in Southeast region. 4 active dealers under management.",
  },
  "SO-001": {
    id: "SO-001", tier: "dealer", name: "Gate Guard, LLC",
    contact: "Russel Feldman", email: "rfeldman@gateguard.co", phone: "844-694-2283",
    location: "Atlanta, GA", status: "active",
    stats: { clients: 9, cameras: 138, doors: 124, mrr: 3940 },
    parent: "Southeast Security Group",
    notes: "Primary dealer account. Direct managed accounts.",
  },
  "CP-001": {
    id: "CP-001", tier: "partner", name: "Columbia Residential",
    contact: "Sarah Kim", email: "sarah@columbiares.com", phone: "404-555-0200",
    location: "Atlanta Metro, GA", status: "active",
    stats: { cameras: 96, doors: 72, users: 0, sites: 6 },
    parent: "Gate Guard, LLC",
    notes: "Channel partner. 6 properties across Atlanta metro.",
  },
  "CP-002": {
    id: "CP-002", tier: "partner", name: "Elevate Living",
    contact: "Marcus Webb", email: "marcus@elevateliving.com", phone: "678-555-0300",
    location: "Charlotte, NC", status: "active",
    stats: { cameras: 58, doors: 47, users: 0, sites: 4 },
    parent: "Gate Guard, LLC",
  },
  "CL-001": {
    id: "CL-001", tier: "client", name: "Angel Oak - Properties",
    contact: "Sammy Laroche", email: "sammy.laroche@angeloakcapital.com", phone: "912-956-6711",
    location: "1370 Ave of Americas, NY", status: "active",
    stats: { cameras: 88, doors: 35, users: 8, sites: 1749, mrr: 1200 },
    parent: "Gate Guard, LLC",
  },
  "CL-002": {
    id: "CL-002", tier: "client", name: "Pegasus Properties",
    contact: "Brian Torres", email: "btorres@pegasusprops.com", phone: "404-555-0400",
    location: "Atlanta Metro, GA", status: "active",
    stats: { cameras: 22, doors: 18, users: 0, sites: 3, mrr: 749 },
    parent: "Gate Guard, LLC",
  },
  "CL-003": {
    id: "CL-003", tier: "client", name: "Stonegate Townhomes",
    contact: "Property Manager", email: "mgr@stonegate.com", phone: "",
    location: "Stonegate Community, GA", status: "active",
    stats: { cameras: 12, doors: 8, users: 0, sites: 1, mrr: 499 },
    parent: "Gate Guard, LLC",
  },
  "CL-004": {
    id: "CL-004", tier: "client", name: "3888 Peachtree",
    contact: "Property Mgmt", email: "mgmt@3888peachtree.com", phone: "",
    location: "3888 Peachtree Rd NE, Atlanta", status: "active",
    stats: { cameras: 6, doors: 4, users: 0, sites: 1, mrr: 349 },
    parent: "Gate Guard, LLC",
  },
  "CL-005": {
    id: "CL-005", tier: "client", name: "Midwood Gardens",
    contact: "Property Mgmt", email: "mgmt@midwoodgardens.com", phone: "",
    location: "Atlanta, GA", status: "active",
    stats: { cameras: 14, doors: 10, users: 0, sites: 1, mrr: 299 },
    parent: "Gate Guard, LLC",
  },
};

const TIER_CONFIG: Record<string, { label: string; cls: string; icon: string }> = {
  corporate: { label: "Corporate",       cls: "bg-brand-400/10 text-brand-400 border border-brand-400/20",  icon: "🏢" },
  mso:       { label: "MSO",             cls: "bg-violet-50 text-violet-700 border border-violet-200",       icon: "🌐" },
  dealer:    { label: "Dealer / SO",     cls: "bg-sky-50 text-sky-700 border border-sky-200",               icon: "🔧" },
  partner:   { label: "Channel Partner", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200",   icon: "🤝" },
  client:    { label: "Client",          cls: "bg-amber-50 text-amber-700 border border-amber-200",          icon: "🏘️" },
};

const STAT_LABELS: Record<string, string> = {
  dealers: "Dealers", clients: "Clients", cameras: "Cameras",
  doors: "Doors", users: "Users", sites: "Sites", mrr: "MRR",
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const acct = ACCOUNTS[id];

  if (!acct) {
    return (
      <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
        <TopBar title="Customer Not Found" />
        <div className="flex-1 flex items-center justify-center flex-col gap-4">
          <p className="text-muted-foreground">Account "{id}" not found.</p>
          <Link href="/customers" className="text-brand-400 hover:underline text-sm flex items-center gap-1">
            <ArrowLeft size={14} /> Back to Customers
          </Link>
        </div>
      </div>
    );
  }

  const tc = TIER_CONFIG[acct.tier] ?? TIER_CONFIG.client;
  const stats = Object.entries(acct.stats).filter(([, v]) => v !== undefined);

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <TopBar
        title={acct.name}
        subtitle={`${tc.icon} ${tc.label} · ${acct.id}`}
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
        <div className="bg-white border border-border rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-brand-400/10 border border-brand-400/20 flex items-center justify-center text-xl font-bold text-brand-400">
                {acct.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-semibold text-foreground">{acct.name}</h2>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${tc.cls}`}>
                    {tc.icon} {tc.label}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${acct.status === "active" ? "bg-emerald-500" : "bg-amber-400"}`} />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {acct.location && (
                    <span className="flex items-center gap-1"><MapPin size={13} /> {acct.location}</span>
                  )}
                  {acct.parent && (
                    <span className="flex items-center gap-1"><Building2 size={13} /> Under: {acct.parent}</span>
                  )}
                  <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{acct.id}</span>
                </div>
              </div>
            </div>
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-accent transition-colors">
              <Edit2 size={13} /> Edit
            </button>
          </div>

          {/* Stats row */}
          {stats.length > 0 && (
            <div className="grid grid-cols-4 gap-3 mt-5 pt-5 border-t border-border">
              {stats.map(([key, val]) => (
                <div key={key} className="text-center p-3 rounded-xl bg-[#F8FAFC] border border-border/50">
                  <p className="text-lg font-bold text-foreground">
                    {key === "mrr" ? `$${val?.toLocaleString()}` : val ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">{STAT_LABELS[key] ?? key}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-5">
          {/* Contact info */}
          <div className="bg-white border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users size={14} className="text-brand-400" /> Primary Contact
            </h3>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-foreground">{acct.contact}</p>
              {acct.email && (
                <a href={`mailto:${acct.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-brand-400 transition-colors">
                  <Mail size={13} /> {acct.email}
                </a>
              )}
              {acct.phone && (
                <a href={`tel:${acct.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-brand-400 transition-colors">
                  <Phone size={13} /> {acct.phone}
                </a>
              )}
              {acct.location && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <MapPin size={13} /> {acct.location}
                </p>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-white border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Activity size={14} className="text-brand-400" /> Quick Actions
            </h3>
            <div className="space-y-2">
              <Link href="/cameras" className="flex items-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground hover:bg-slate-50 rounded-lg px-3 py-2 transition-colors">
                <Camera size={14} className="text-brand-400" /> View Cameras
              </Link>
              <Link href="/access" className="flex items-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground hover:bg-slate-50 rounded-lg px-3 py-2 transition-colors">
                <Shield size={14} className="text-brand-400" /> Access Control
              </Link>
              <Link href="/maintenance" className="flex items-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground hover:bg-slate-50 rounded-lg px-3 py-2 transition-colors">
                <Wrench size={14} className="text-brand-400" /> Work Orders
              </Link>
              <Link href="/quotes" className="flex items-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground hover:bg-slate-50 rounded-lg px-3 py-2 transition-colors">
                <FileText size={14} className="text-brand-400" /> Quotes
              </Link>
              <Link href="/billing" className="flex items-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground hover:bg-slate-50 rounded-lg px-3 py-2 transition-colors">
                <DollarSign size={14} className="text-brand-400" /> Billing
              </Link>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Star size={14} className="text-brand-400" /> Notes
            </h3>
            {acct.notes ? (
              <p className="text-sm text-muted-foreground">{acct.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No notes yet.</p>
            )}
          </div>
        </div>

        {/* Sites / Properties */}
        <div className="bg-white border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Building2 size={14} className="text-brand-400" /> Properties / Sites
            </h3>
            <Link href="/sites" className="text-xs text-brand-400 hover:underline flex items-center gap-1">
              View all <ExternalLink size={11} />
            </Link>
          </div>
          <div className="text-center py-6 text-sm text-muted-foreground">
            <Building2 size={24} className="mx-auto mb-2 text-muted-foreground/40" />
            <p>Sites will load here from live data.</p>
            <Link href="/sites" className="text-brand-400 hover:underline text-xs mt-1 inline-block">
              Go to Properties →
            </Link>
          </div>
        </div>

        {/* Activity timeline */}
        <div className="bg-white border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock size={14} className="text-brand-400" /> Recent Activity
          </h3>
          <div className="space-y-3">
            {[
              { icon: CheckCircle2, color: "text-emerald-500", label: "Account activated", time: "May 2026" },
              { icon: FileText,     color: "text-brand-400",   label: "Quote #Q-2026-011 sent",    time: "Apr 2026" },
              { icon: Wrench,       color: "text-amber-500",   label: "Work order WO-041 completed", time: "Mar 2026" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <item.icon size={15} className={item.color} />
                <span className="text-foreground flex-1">{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
