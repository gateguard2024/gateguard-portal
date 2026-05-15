"use client";

import { useState, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Shield, ChevronDown, ChevronUp, Check,
  Mail, Clock, RefreshCw, X, AlertCircle, Eye,
  Users, Building2, Zap,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { UserPlus, EyeOff } = require("lucide-react") as any;
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface UserRecord {
  id: string;
  email: string;
  full_name: string;
  image_url: string | null;
  created_at: string;
  last_sign_in: string | null;
  status?: string;
  permissions: Permissions | null;
}

interface Permissions {
  id?: string;
  clerk_user_id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  // Module visibility
  can_see_dashboard: boolean;
  can_see_crm: boolean;
  can_see_crm_all_orgs: boolean;
  can_see_maintenance: boolean;
  can_see_tech: boolean;
  can_see_products: boolean;
  can_see_quotes: boolean;
  can_see_billing: boolean;
  can_see_reps: boolean;
  can_see_compliance: boolean;
  can_see_reports: boolean;
  can_see_map: boolean;
  can_see_scorecard: boolean;
  can_see_directv: boolean;
  can_see_aria: boolean;
  can_see_cameras: boolean;
  can_see_access_control: boolean;
  can_see_network: boolean;
  can_see_admin: boolean;
  // Actions
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_invite: boolean;
}

const DEFAULT_PERMISSIONS = (email: string, clerk_user_id: string): Permissions => ({
  clerk_user_id,
  email,
  full_name: "",
  role: "viewer",
  is_active: true,
  can_see_dashboard: true,
  can_see_crm: false,
  can_see_crm_all_orgs: false,
  can_see_maintenance: false,
  can_see_tech: false,
  can_see_products: false,
  can_see_quotes: false,
  can_see_billing: false,
  can_see_reps: false,
  can_see_compliance: false,
  can_see_reports: false,
  can_see_map: false,
  can_see_scorecard: false,
  can_see_directv: false,
  can_see_aria: false,
  can_see_cameras: false,
  can_see_access_control: false,
  can_see_network: false,
  can_see_admin: false,
  can_create: false,
  can_edit: false,
  can_delete: false,
  can_invite: false,
});

// ── Role presets (one-click setup per user type) ───────────────────────────

const ROLE_PRESETS: Record<string, Partial<Permissions>> = {
  admin: {
    role: "admin",
    can_see_dashboard: true, can_see_crm: true, can_see_crm_all_orgs: true,
    can_see_maintenance: true, can_see_tech: true, can_see_products: true,
    can_see_quotes: true, can_see_billing: true, can_see_reps: true,
    can_see_compliance: true, can_see_reports: true, can_see_map: true,
    can_see_scorecard: true, can_see_directv: true, can_see_aria: true,
    can_see_cameras: true, can_see_access_control: true, can_see_network: true,
    can_see_admin: true, can_create: true, can_edit: false, can_delete: false, can_invite: true,
  },
  gg_sales: {
    role: "gg_sales",
    can_see_dashboard: true, can_see_crm: true, can_see_crm_all_orgs: true,
    can_see_maintenance: true, can_see_tech: true, can_see_products: true,
    can_see_quotes: true, can_see_billing: false, can_see_reps: true,
    can_see_compliance: false, can_see_reports: true, can_see_map: true,
    can_see_scorecard: true, can_see_directv: true, can_see_aria: true,
    can_see_cameras: false, can_see_access_control: false, can_see_network: false,
    can_see_admin: false, can_create: true, can_edit: false, can_delete: false, can_invite: false,
  },
  master_agent: {
    role: "master_agent",
    can_see_dashboard: true, can_see_crm: true, can_see_crm_all_orgs: true,
    can_see_maintenance: false, can_see_tech: false, can_see_products: true,
    can_see_quotes: true, can_see_billing: false, can_see_reps: true,
    can_see_compliance: false, can_see_reports: true, can_see_map: true,
    can_see_scorecard: true, can_see_directv: true, can_see_aria: false,
    can_see_cameras: false, can_see_access_control: false, can_see_network: false,
    can_see_admin: false, can_create: true, can_edit: false, can_delete: false, can_invite: false,
  },
  dealer: {
    role: "dealer",
    can_see_dashboard: true, can_see_crm: true, can_see_crm_all_orgs: false,
    can_see_maintenance: true, can_see_tech: true, can_see_products: true,
    can_see_quotes: true, can_see_billing: true, can_see_reps: false,
    can_see_compliance: true, can_see_reports: false, can_see_map: false,
    can_see_scorecard: false, can_see_directv: false, can_see_aria: false,
    can_see_cameras: false, can_see_access_control: false, can_see_network: false,
    can_see_admin: false, can_create: true, can_edit: false, can_delete: false, can_invite: false,
  },
  channel_partner: {
    role: "channel_partner",
    can_see_dashboard: true, can_see_crm: true, can_see_crm_all_orgs: false,
    can_see_maintenance: false, can_see_tech: false, can_see_products: true,
    can_see_quotes: true, can_see_billing: false, can_see_reps: false,
    can_see_compliance: false, can_see_reports: false, can_see_map: false,
    can_see_scorecard: false, can_see_directv: true, can_see_aria: false,
    can_see_cameras: false, can_see_access_control: false, can_see_network: false,
    can_see_admin: false, can_create: true, can_edit: false, can_delete: false, can_invite: false,
  },
  viewer: {
    role: "viewer",
    can_see_dashboard: true, can_see_crm: false, can_see_crm_all_orgs: false,
    can_see_maintenance: false, can_see_tech: false, can_see_products: false,
    can_see_quotes: false, can_see_billing: false, can_see_reps: false,
    can_see_compliance: false, can_see_reports: false, can_see_map: false,
    can_see_scorecard: false, can_see_directv: false, can_see_aria: false,
    can_see_cameras: false, can_see_access_control: false, can_see_network: false,
    can_see_admin: false, can_create: false, can_edit: false, can_delete: false, can_invite: false,
  },
};

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  admin:          { label: "Admin",           color: "text-red-700",    bg: "bg-red-100" },
  gg_sales:       { label: "GG Sales",        color: "text-brand-700",  bg: "bg-brand-100" },
  master_agent:   { label: "Master Agent",    color: "text-violet-700", bg: "bg-violet-100" },
  dealer:         { label: "Dealer",          color: "text-sky-700",    bg: "bg-sky-100" },
  channel_partner:{ label: "Channel Partner", color: "text-emerald-700",bg: "bg-emerald-100" },
  sub_dealer:     { label: "Sub-Dealer",      color: "text-amber-700",  bg: "bg-amber-100" },
  rep:            { label: "Rep",             color: "text-orange-700", bg: "bg-orange-100" },
  viewer:         { label: "Viewer",          color: "text-slate-600",  bg: "bg-slate-100" },
};

// ── Permission sections for the checkbox panel ──────────────────────────────

const PERMISSION_SECTIONS = [
  {
    title: "Portal Modules",
    description: "Which sections this user can see in the sidebar",
    icon: <Eye size={14} />,
    items: [
      { key: "can_see_dashboard",      label: "Dashboard",         desc: "Main portal home" },
      { key: "can_see_crm",            label: "CRM",               desc: "Leads, opportunities, pipeline" },
      { key: "can_see_crm_all_orgs",   label: "CRM — All Orgs",    desc: "See pipeline across ALL dealers, not just their own", indent: true },
      { key: "can_see_maintenance",    label: "Maintenance",       desc: "Work orders & field jobs" },
      { key: "can_see_tech",           label: "Tech Tool (/tech)", desc: "Field diagnostic tool" },
      { key: "can_see_products",       label: "Products",          desc: "Equipment catalog & manuals" },
      { key: "can_see_quotes",         label: "Quotes",            desc: "Quote builder & sent proposals" },
      { key: "can_see_billing",        label: "Billing",           desc: "Invoices, MRR, payments" },
      { key: "can_see_reps",           label: "Reps",              desc: "Rep hierarchy & commissions" },
      { key: "can_see_compliance",     label: "Compliance",        desc: "Permits & compliance tracker" },
      { key: "can_see_reports",        label: "Reports",           desc: "Multi-site roll-up reports" },
      { key: "can_see_map",            label: "Map",               desc: "Territory map view" },
      { key: "can_see_scorecard",      label: "Scorecard",         desc: "Dealer performance scorecard" },
    ],
  },
  {
    title: "Advanced Modules",
    description: "AI tools, hardware integrations, and channel features",
    icon: <Zap size={14} />,
    items: [
      { key: "can_see_directv",        label: "DirecTV Channel",   desc: "DirecTV/AT&T dealer dashboard + SARA Bridge" },
      { key: "can_see_aria",           label: "ARIA",              desc: "AI marketing intelligence engine" },
      { key: "can_see_cameras",        label: "Cameras",           desc: "Eagle Eye live feeds & archive" },
      { key: "can_see_access_control", label: "Access Control",    desc: "Brivo access control & credentials" },
      { key: "can_see_network",        label: "Network",           desc: "UniFi infrastructure & VLANs" },
      { key: "can_see_admin",          label: "Admin Panel",       desc: "User management (this page) — Russel only", danger: true },
    ],
  },
  {
    title: "Actions",
    description: "What this user can do — edit and delete disabled for all users right now",
    icon: <Shield size={14} />,
    items: [
      { key: "can_create",  label: "Can Create",  desc: "Create new leads, opportunities, work orders" },
      { key: "can_invite",  label: "Can Invite",  desc: "Invite new users to the portal" },
      { key: "can_edit",    label: "Can Edit",    desc: "Edit existing records — currently disabled", locked: true },
      { key: "can_delete",  label: "Can Delete",  desc: "Delete records — currently disabled", locked: true },
    ],
  },
];

// ── Helper components ──────────────────────────────────────────────────────

function Avatar({ name, imageUrl, size = 8 }: { name: string; imageUrl?: string | null; size?: number }) {
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
  if (imageUrl) {
    return <img src={imageUrl} alt={name} className={`w-${size} h-${size} rounded-full object-cover`} />;
  }
  return (
    <div className={`w-${size} h-${size} rounded-full bg-[#6B7EFF]/20 border border-[#6B7EFF]/30 flex items-center justify-center text-[#6B7EFF] font-bold text-xs shrink-0`}>
      {initials}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_LABELS[role] ?? ROLE_LABELS.viewer;
  return (
    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", cfg.bg, cfg.color)}>
      {cfg.label}
    </span>
  );
}

function Checkbox({ checked, onChange, disabled, danger }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "w-5 h-5 rounded flex items-center justify-center border-2 transition-all shrink-0",
        disabled ? "opacity-40 cursor-not-allowed border-slate-200 bg-slate-50" :
        checked
          ? danger ? "border-red-500 bg-red-500" : "border-[#6B7EFF] bg-[#6B7EFF]"
          : "border-slate-300 bg-white hover:border-[#6B7EFF]"
      )}
    >
      {checked && !disabled && <Check size={11} className="text-white" strokeWidth={3} />}
      {disabled && <X size={9} className="text-slate-400" />}
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [users, setUsers]               = useState<UserRecord[]>([]);
  const [pending, setPending]           = useState<UserRecord[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [editPerms, setEditPerms]       = useState<Permissions | null>(null);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [showInvite, setShowInvite]     = useState(false);
  const [inviteEmail, setInviteEmail]   = useState("");
  const [inviteRole, setInviteRole]     = useState("viewer");
  const [inviteName, setInviteName]     = useState("");
  const [inviting, setInviting]         = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const { users: u, pending: p } = await res.json();
        setUsers(u);
        setPending(p);
      } else {
        setError("Failed to load users");
      }
    } catch (e) {
      setError("Failed to connect");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // When a user is selected, load their permissions into edit state
  const openUser = (user: UserRecord) => {
    setSelectedUser(user);
    setEditPerms(user.permissions ?? DEFAULT_PERMISSIONS(user.email, user.id));
    setSaved(false);
  };

  // Apply a role preset
  const applyPreset = (role: string) => {
    if (!editPerms) return;
    setEditPerms({ ...editPerms, ...ROLE_PRESETS[role] });
  };

  // Toggle a single permission
  const togglePerm = (key: keyof Permissions) => {
    if (!editPerms) return;
    setEditPerms({ ...editPerms, [key]: !editPerms[key] });
  };

  // Save permissions
  const savePermissions = async () => {
    if (!selectedUser || !editPerms) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editPerms),
      });
      if (res.ok) {
        setSaved(true);
        // Update local state
        setUsers(prev => prev.map(u =>
          u.id === selectedUser.id ? { ...u, permissions: editPerms } : u
        ));
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  // Send invite
  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, full_name: inviteName }),
      });
      if (res.ok) {
        setInviteSuccess(true);
        setInviteEmail("");
        setInviteName("");
        setTimeout(() => {
          setShowInvite(false);
          setInviteSuccess(false);
          fetchUsers();
        }, 2000);
      }
    } finally {
      setInviting(false);
    }
  };

  const visibleCount = editPerms
    ? Object.entries(editPerms).filter(([k, v]) => k.startsWith("can_see_") && v === true).length
    : 0;

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="User Management"
        subtitle="Invite users · Control access · Set permissions"
        actions={
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] transition-colors"
          >
            <UserPlus size={15} /> Invite User
          </button>
        }
      />

      <div className="flex-1 flex overflow-hidden">

        {/* ── Left: User List ─────────────────────────────────────────── */}
        <div className="w-[340px] border-r border-border bg-white flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {loading ? "Loading…" : `${users.length} Users`}
            </span>
            <button onClick={fetchUsers} className="p-1 rounded hover:bg-accent text-muted-foreground">
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Active users */}
            {users.map(user => (
              <button
                key={user.id}
                onClick={() => openUser(user)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 border-b border-border/60 hover:bg-accent/40 transition-colors text-left",
                  selectedUser?.id === user.id && "bg-[#6B7EFF]/5 border-l-2 border-l-[#6B7EFF]"
                )}
              >
                <Avatar name={user.full_name || user.email} imageUrl={user.image_url} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {user.full_name || "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <RoleBadge role={user.permissions?.role ?? "viewer"} />
                    {user.permissions && (
                      <span className="text-[9px] text-muted-foreground">
                        {Object.entries(user.permissions).filter(([k, v]) => k.startsWith("can_see_") && v).length} modules
                      </span>
                    )}
                  </div>
                </div>
                {user.last_sign_in && (
                  <span className="text-[9px] text-muted-foreground shrink-0">
                    {new Date(user.last_sign_in).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
              </button>
            ))}

            {/* Pending invites */}
            {pending.length > 0 && (
              <>
                <div className="px-4 py-2 bg-amber-50 border-y border-amber-100">
                  <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">
                    Pending Invitations ({pending.length})
                  </span>
                </div>
                {pending.map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/60 opacity-70">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                      <Mail size={13} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{p.email}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock size={9} className="text-amber-500" />
                        <span className="text-[10px] text-amber-600">Invite pending</span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── Right: Permission Editor ─────────────────────────────────── */}
        {selectedUser && editPerms ? (
          <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">

            {/* User header */}
            <div className="bg-white border-b border-border px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar name={selectedUser.full_name || selectedUser.email} imageUrl={selectedUser.image_url} size={10} />
                  <div>
                    <h2 className="text-base font-bold text-foreground">
                      {selectedUser.full_name || selectedUser.email}
                    </h2>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <RoleBadge role={editPerms.role} />
                      <span className="text-xs text-muted-foreground">
                        {visibleCount} modules visible
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={savePermissions}
                    disabled={saving}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all",
                      saved
                        ? "bg-emerald-500 text-white"
                        : "bg-[#6B7EFF] text-white hover:bg-[#5a6de8]",
                      saving && "opacity-70"
                    )}
                  >
                    {saving ? <RefreshCw size={13} className="animate-spin" /> :
                     saved  ? <Check size={13} /> : <Shield size={13} />}
                    {saved ? "Saved!" : saving ? "Saving…" : "Save Permissions"}
                  </button>
                </div>
              </div>

              {/* Role presets */}
              <div className="mt-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Quick Role Preset</p>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(ROLE_PRESETS).map(role => {
                    const cfg = ROLE_LABELS[role] ?? ROLE_LABELS.viewer;
                    return (
                      <button
                        key={role}
                        onClick={() => applyPreset(role)}
                        className={cn(
                          "px-3 py-1 text-xs font-semibold rounded-full border transition-all",
                          editPerms.role === role
                            ? `${cfg.bg} ${cfg.color} border-current`
                            : "bg-white border-border text-muted-foreground hover:border-[#6B7EFF] hover:text-[#6B7EFF]"
                        )}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Presets auto-fill checkboxes below — you can still customise individually after applying.
                </p>
              </div>
            </div>

            {/* Permission sections */}
            <div className="px-6 py-5 space-y-5">

              {/* Active toggle */}
              <div className="bg-white border border-border rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Account Active</p>
                  <p className="text-xs text-muted-foreground">Inactive users cannot log in to the portal</p>
                </div>
                <button
                  onClick={() => setEditPerms({ ...editPerms, is_active: !editPerms.is_active })}
                  className={cn(
                    "relative w-11 h-6 rounded-full transition-colors",
                    editPerms.is_active ? "bg-[#6B7EFF]" : "bg-slate-200"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all",
                    editPerms.is_active ? "left-[22px]" : "left-0.5"
                  )} />
                </button>
              </div>

              {PERMISSION_SECTIONS.map(section => (
                <div key={section.title} className="bg-white border border-border rounded-xl overflow-hidden">
                  {/* Section header */}
                  <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center gap-2">
                    <span className="text-muted-foreground">{section.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{section.title}</p>
                      <p className="text-[11px] text-muted-foreground">{section.description}</p>
                    </div>
                  </div>

                  {/* Permission rows */}
                  <div className="divide-y divide-border/60">
                    {section.items.map(item => {
                      const key = item.key as keyof Permissions;
                      const checked = !!editPerms[key];
                      const locked = (item as any).locked;
                      const danger = (item as any).danger;
                      const indent = (item as any).indent;

                      return (
                        <div
                          key={item.key}
                          className={cn(
                            "flex items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors",
                            indent && "pl-10",
                            locked && "opacity-50"
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onChange={() => !locked && togglePerm(key)}
                            disabled={locked}
                            danger={danger}
                          />
                          <div className="flex-1">
                            <p className={cn(
                              "text-sm font-medium",
                              danger && checked ? "text-red-600" : "text-foreground"
                            )}>
                              {item.label}
                              {locked && (
                                <span className="ml-2 text-[10px] font-normal text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                                  Locked by admin
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                          </div>
                          {checked && !locked && (
                            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                              ON
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Save button at bottom too */}
              <div className="flex justify-end pb-6">
                <button
                  onClick={savePermissions}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] transition-colors disabled:opacity-70"
                >
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Shield size={14} />}
                  {saved ? "Saved!" : "Save Permissions"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-[#F8FAFC]">
            <div className="w-16 h-16 rounded-2xl bg-[#6B7EFF]/10 flex items-center justify-center mb-4">
              <Users size={28} className="text-[#6B7EFF]" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">Select a user</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Choose a user from the left to view and edit their portal access permissions.
            </p>
            <button
              onClick={() => setShowInvite(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium border border-[#6B7EFF] text-[#6B7EFF] rounded-lg hover:bg-[#6B7EFF]/5 transition-colors"
            >
              <UserPlus size={14} /> Invite your first user
            </button>
          </div>
        )}
      </div>

      {/* ── Invite Modal ──────────────────────────────────────────────── */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Invite User to Portal</h3>
                <p className="text-xs text-muted-foreground">They'll receive an email to set up their account</p>
              </div>
              <button onClick={() => setShowInvite(false)} className="p-1 rounded hover:bg-accent text-muted-foreground">
                <X size={16} />
              </button>
            </div>

            {inviteSuccess ? (
              <div className="px-6 py-10 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                  <Check size={24} className="text-emerald-600" />
                </div>
                <p className="text-base font-semibold text-foreground">Invitation sent!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  They'll receive an email to join the portal.
                </p>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Full Name</label>
                  <input
                    value={inviteName}
                    onChange={e => setInviteName(e.target.value)}
                    placeholder="e.g. Nicole Gagliardi"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:border-[#6B7EFF] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Email Address <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:border-[#6B7EFF] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Starting Role</label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:border-[#6B7EFF] focus:outline-none bg-white"
                  >
                    <option value="viewer">Viewer — read-only dashboard only</option>
                    <option value="dealer">Dealer — their accounts, maintenance, quotes</option>
                    <option value="channel_partner">Channel Partner — CRM + DirecTV</option>
                    <option value="master_agent">Master Agent — channel oversight</option>
                    <option value="gg_sales">GG Sales — full sales access</option>
                    <option value="admin">Admin — nearly everything</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    You can fine-tune individual permissions after they sign up.
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex gap-2">
                  <AlertCircle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700">
                    No one gets edit or delete rights. Only you can change portal content. This invitation gives them view access based on their role.
                  </p>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setShowInvite(false)}
                    className="flex-1 px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-accent transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={sendInvite}
                    disabled={inviting || !inviteEmail.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] transition-colors disabled:opacity-60"
                  >
                    {inviting ? <RefreshCw size={13} className="animate-spin" /> : <Mail size={13} />}
                    {inviting ? "Sending…" : "Send Invitation"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
