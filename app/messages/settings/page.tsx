"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { CheckCircle2, Plus, Trash2, RefreshCw, Settings, Eye } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Mail, PhoneCall, Calendar, Lock, Server, ExternalLink, EyeOff } = require("lucide-react") as any;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Channel {
  id: string;
  channel_type: string;
  display_name: string;
  is_active: boolean;
  last_synced_at: string | null;
  config: Record<string, unknown>;
}

// ─── Channel definitions ──────────────────────────────────────────────────────

const CHANNEL_DEFS = [
  {
    type:        "gmail",
    label:       "Gmail",
    description: "OAuth2 — connect a Google account for inbound/outbound email",
    icon:        Mail,
    iconBg:      "#FEECEC",
    iconColor:   "#EA4335",
    oauthState:  "gmail",
    fields:      [],
  },
  {
    type:        "smtp",
    label:       "SMTP email",
    description: "Any mail server — Outlook, iCloud, custom domain, etc.",
    icon:        Server,
    iconBg:      "#EAF3FF",
    iconColor:   "#185FA5",
    fields:      [
      { key: "smtp_host",     label: "SMTP host",     placeholder: "smtp.example.com", secret: false },
      { key: "smtp_port",     label: "Port",          placeholder: "587",              secret: false },
      { key: "smtp_user",     label: "Username",      placeholder: "you@example.com",  secret: false },
      { key: "smtp_password", label: "Password",      placeholder: "••••••••",         secret: true  },
      { key: "from_address",  label: "From address",  placeholder: "you@example.com",  secret: false },
    ],
  },
  {
    type:        "caldav",
    label:       "CalDAV calendar",
    description: "Google Calendar (OAuth2) or any CalDAV server",
    icon:        Calendar,
    iconBg:      "#EAFAF0",
    iconColor:   "#15803d",
    oauthState:  "caldav",
    fields:      [
      { key: "caldav_url",  label: "CalDAV server URL", placeholder: "https://caldav.example.com/", secret: false },
      { key: "caldav_user", label: "Username",          placeholder: "you@example.com",             secret: false },
      { key: "caldav_pass", label: "Password",          placeholder: "••••••••",                    secret: true  },
    ],
  },
  {
    type:        "phone",
    label:       "Phone / carrier SMS",
    description: "Your mobile number for carrier SMS bridging",
    icon:        PhoneCall,
    iconBg:      "#FFF8E6",
    iconColor:   "#854F0B",
    fields:      [
      { key: "phone_number", label: "Phone number", placeholder: "+1 (480) 555-0100", secret: false },
      { key: "carrier",      label: "Carrier",      placeholder: "AT&T / Verizon / T-Mobile", secret: false },
    ],
  },
  {
    type:        "twilio",
    label:       "Twilio",
    description: "Programmable SMS, voice alerts, and WhatsApp Business API",
    icon:        PhoneCall,
    iconBg:      "#FFF8E6",
    iconColor:   "#EF9F27",
    fields:      [
      { key: "account_sid",  label: "Account SID",   placeholder: "ACxxxxxxxxxxxxxxxx", secret: false },
      { key: "auth_token",   label: "Auth token",    placeholder: "••••••••",           secret: true  },
      { key: "phone_number", label: "Twilio number", placeholder: "+1 (480) 555-0100", secret: false },
    ],
  },
  {
    type:        "internal",
    label:       "Org chat (internal)",
    description: "Secure real-time chat for your organisation — all Clerk users",
    icon:        Lock,
    iconBg:      "#EEEDFE",
    iconColor:   "#6B7EFF",
    fields:      [],
    autoCreate:  true,
  },
] as const;

// ─── Channel card ─────────────────────────────────────────────────────────────

function ChannelCard({
  def,
  existing,
  onAdd,
  onDelete,
  onToggle,
}: {
  def: typeof CHANNEL_DEFS[number];
  existing: Channel | undefined;
  onAdd:    (type: string, config: Record<string, string>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggle: (id: string, active: boolean) => Promise<void>;
}) {
  const [expanded, setExpanded]   = useState(false);
  const [config, setConfig]       = useState<Record<string, string>>({});
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [saving, setSaving]       = useState(false);

  const Icon = def.icon;

  async function handleSave() {
    setSaving(true);
    await onAdd(def.type, config);
    setSaving(false);
    setExpanded(false);
    setConfig({});
  }

  const oauthUrl = def.oauthState
    ? `/api/auth/gmail-oauth?state=${def.oauthState}&redirect_uri=${encodeURIComponent(`${typeof window !== "undefined" ? window.location.origin : ""}/api/auth/gmail-oauth`)}`
    : null;

  // For OAuth-only channels (gmail + caldav via Google), build the Google OAuth consent URL
  const googleOAuthUrl = def.oauthState ? (() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return null;
    const scopes = def.oauthState === "caldav"
      ? "https://www.googleapis.com/auth/calendar openid email"
      : "https://mail.google.com/ openid email";
    const redirectUri = encodeURIComponent(`${typeof window !== "undefined" ? window.location.origin : ""}/api/auth/gmail-oauth`);
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${def.oauthState}`;
  })() : null;

  return (
    <div className="border border-border rounded-xl bg-white">
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: def.iconBg }}>
          <Icon size={18} style={{ color: def.iconColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{def.label}</p>
          <p className="text-xs text-muted-foreground">{def.description}</p>
        </div>

        {existing ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
              existing.is_active
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-slate-100 text-slate-500 border border-slate-200"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${existing.is_active ? "bg-emerald-500" : "bg-slate-400"}`} />
              {existing.is_active ? "Connected" : "Inactive"}
            </span>
            <button
              onClick={() => { void onToggle(existing.id, !existing.is_active); }}
              className="p-1.5 border border-border rounded-lg hover:bg-accent transition-colors"
              title={existing.is_active ? "Disable" : "Enable"}
            >
              <Settings size={12} className="text-muted-foreground" />
            </button>
            <button
              onClick={() => { void onDelete(existing.id); }}
              className="p-1.5 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              title="Remove channel"
            >
              <Trash2 size={12} className="text-red-500" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            {googleOAuthUrl ? (
              <a
                href={googleOAuthUrl}
                className="flex items-center gap-1.5 text-xs font-medium bg-[#6B7EFF] text-white px-3 py-1.5 rounded-lg hover:bg-[#5a6ee0] transition-colors"
              >
                Connect with Google <ExternalLink size={11} />
              </a>
            ) : def.fields.length > 0 ? (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium border border-border px-3 py-1.5 rounded-lg hover:bg-accent transition-colors"
              >
                <Plus size={12} />
                Connect
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* Credential form */}
      {expanded && !existing && def.fields.length > 0 && (
        <div className="border-t border-border px-4 py-4 space-y-3">
          {def.fields.map((field) => (
            <div key={field.key}>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{field.label}</label>
              <div className="relative">
                <input
                  type={field.secret && !showSecret[field.key] ? "password" : "text"}
                  placeholder={field.placeholder}
                  value={config[field.key] ?? ""}
                  onChange={(e) => setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full text-xs border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-[#6B7EFF]/40 bg-white pr-8"
                />
                {field.secret && (
                  <button
                    onClick={() => setShowSecret((p) => ({ ...p, [field.key]: !p[field.key] }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecret[field.key] ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { void handleSave(); }}
              disabled={saving}
              className="flex-1 text-xs font-medium bg-[#6B7EFF] text-white py-2 rounded-lg hover:bg-[#5a6ee0] disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save channel"}
            </button>
            <button
              onClick={() => { setExpanded(false); setConfig({}); }}
              className="px-4 text-xs font-medium border border-border py-2 rounded-lg hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Last synced */}
      {existing?.last_synced_at && (
        <div className="px-4 pb-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <RefreshCw size={9} />
          Last synced {new Date(existing.last_synced_at).toLocaleString()}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function SettingsInner() {
  const searchParams  = useSearchParams();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading]   = useState(true);
  const [banner, setBanner]     = useState<string | null>(null);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error     = searchParams.get("error");
    if (connected) setBanner(`✓ ${connected} connected successfully`);
    if (error)     setBanner(`Error: ${error.replace(/_/g, " ")}`);
  }, [searchParams]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/messages/channels");
        if (res.ok) {
          const d = await res.json() as { channels: Channel[] };
          setChannels(d.channels ?? []);
        }
      } catch (_) {} finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleAdd(type: string, config: Record<string, string>) {
    const label = CHANNEL_DEFS.find((d) => d.type === type)?.label ?? type;
    try {
      const res = await fetch("/api/messages/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_type: type, display_name: label, config }),
      });
      if (res.ok) {
        const d = await res.json() as { channel: Channel };
        setChannels((prev) => [...prev, d.channel]);
        setBanner(`✓ ${label} connected`);
      }
    } catch (_) {}
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/messages/channels/${id}`, { method: "DELETE" });
      if (res.ok) setChannels((prev) => prev.filter((c) => c.id !== id));
    } catch (_) {}
  }

  async function handleToggle(id: string, active: boolean) {
    try {
      const res = await fetch(`/api/messages/channels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: active }),
      });
      if (res.ok) {
        setChannels((prev) => prev.map((c) => c.id === id ? { ...c, is_active: active } : c));
      }
    } catch (_) {}
  }

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC]">
      <TopBar
        title="Message Center settings"
        subtitle="Connect channels — Gmail, SMTP, CalDAV, phone, and Twilio"
      />

      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-3xl mx-auto w-full">
        {banner && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
            banner.startsWith("✓")
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}>
            <CheckCircle2 size={14} />
            {banner}
            <button onClick={() => setBanner(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">dismiss</button>
          </div>
        )}

        <div className="mb-5">
          <h2 className="text-sm font-semibold text-foreground mb-0.5">Channel configuration</h2>
          <p className="text-xs text-muted-foreground">
            Connect the channels you want in your unified inbox. Credentials are stored encrypted in Supabase.
          </p>
        </div>

        {loading ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-3">
            {CHANNEL_DEFS.map((def) => {
              const existing = channels.find((c) => c.channel_type === def.type);
              return (
                <ChannelCard
                  key={def.type}
                  def={def}
                  existing={existing}
                  onAdd={handleAdd}
                  onDelete={handleDelete}
                  onToggle={handleToggle}
                />
              );
            })}
          </div>
        )}

        <div className="mt-8 p-4 bg-white border border-border rounded-xl">
          <p className="text-xs font-semibold text-foreground mb-1">Required env vars</p>
          <div className="space-y-1 text-[11px] text-muted-foreground font-mono">
            <p><span className="text-amber-600">GOOGLE_CLIENT_ID</span> + <span className="text-amber-600">GOOGLE_CLIENT_SECRET</span> — Gmail &amp; CalDAV OAuth</p>
            <p><span className="text-amber-600">TWILIO_ACCOUNT_SID</span> + <span className="text-amber-600">TWILIO_AUTH_TOKEN</span> + <span className="text-amber-600">TWILIO_PHONE_NUMBER</span> — SMS</p>
            <p><span className="text-amber-600">RESEND_API_KEY</span> — SMTP send via Resend</p>
            <p><span className="text-amber-600">NEXT_PUBLIC_GOOGLE_CLIENT_ID</span> — client-side OAuth button</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MessagesSettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-xs text-muted-foreground">Loading…</div>}>
      <SettingsInner />
    </Suspense>
  );
}
