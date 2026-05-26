"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, RefreshCw } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Eye, EyeOff, Copy, Trash2, ExternalLink, PhoneCall, Lock, Server } = require("lucide-react") as any;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Channel {
  id: string;
  channel_type: string;
  display_name: string;
  is_active: boolean;
  last_synced_at: string | null;
  config: Record<string, unknown>;
}

// ─── Channel icons (brand SVG) ────────────────────────────────────────────────

function GmailIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.907 1.528-1.147C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
    </svg>
  );
}

function TwilioIcon({ size = 20 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#F22F46", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "#fff", fontWeight: 900, fontSize: size * 0.55, lineHeight: 1 }}>T</span>
    </div>
  );
}

function OutlookIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M24 7.387v10.478L19.2 21V9.6L24 7.387zM14.4 3l9.6 4.387-9.6 4.373-9.6-4.373L14.4 3zM0 7.387L4.8 9.6V21L0 17.865V7.387zM14.4 12.76L4.8 8.4v11.4l9.6 4.2 9.6-4.2V8.4l-9.6 4.36z" fill="#0078D4"/>
    </svg>
  );
}

function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// ─── Secret field ─────────────────────────────────────────────────────────────

function SecretField({ label, value }: { label: string; value: string }) {
  const [show, setShow] = useState(false);
  const masked = "•".repeat(Math.min(value.length || 16, 16));
  return (
    <div className="mb-2">
      <p className="text-[10px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">{label}</p>
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
        <span className="flex-1 text-xs font-mono text-gray-700 truncate">
          {show ? (value || "(not set)") : masked}
        </span>
        <button onClick={() => setShow((v) => !v)} className="text-gray-400 hover:text-gray-600 transition-colors">
          {show ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
        {value && (
          <button
            onClick={() => { void navigator.clipboard.writeText(value); }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Copy size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Channel card ─────────────────────────────────────────────────────────────

function ChannelCard({
  icon,
  iconBg,
  title,
  subtitle,
  connected,
  lastSynced,
  children,
  onConnect,
  onDisconnect,
  statusDot = true,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  connected: boolean;
  lastSynced?: string | null;
  children?: React.ReactNode;
  onConnect?: () => void;
  onDisconnect?: () => void;
  statusDot?: boolean;
}) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "#fff", border: "1px solid #f0f0f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      {/* Card header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: iconBg }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900">{title}</span>
            {statusDot && (
              <div className={`w-2 h-2 rounded-full shrink-0 ${connected ? "bg-emerald-500" : "bg-gray-300"}`} />
            )}
          </div>
          <span className="text-[11px] text-gray-400">{subtitle}</span>
        </div>
        {connected && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>
            Connected
          </span>
        )}
      </div>

      {/* Body */}
      {children}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-1 border-t" style={{ borderColor: "#f5f5f5" }}>
        {connected ? (
          <>
            {lastSynced && (
              <span className="text-[10px] text-gray-400 flex-1">Synced {new Date(lastSynced).toLocaleDateString()}</span>
            )}
            {onDisconnect && (
              <button
                onClick={onDisconnect}
                className="flex items-center gap-1 text-[11px] font-medium text-red-500 hover:text-red-600 transition-colors"
              >
                <Trash2 size={11} /> Disconnect
              </button>
            )}
          </>
        ) : (
          <>
            <span className="text-[10px] text-gray-400 flex-1">Not connected</span>
            {onConnect && (
              <button
                onClick={onConnect}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white transition-opacity hover:opacity-90"
                style={{ background: "#6B7EFF" }}
              >
                Connect →
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── OAuth form card ──────────────────────────────────────────────────────────

function OAuthCard({
  icon, iconBg, title, subtitle, oauthState, existing, onDisconnect,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  oauthState: string;
  existing: Channel | undefined;
  onDisconnect: (id: string) => Promise<void>;
}) {
  function buildOAuthUrl() {
    const clientId   = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return "#";
    const scopes     = oauthState === "caldav"
      ? "https://www.googleapis.com/auth/calendar openid email"
      : "https://mail.google.com/ openid email";
    const origin     = typeof window !== "undefined" ? window.location.origin : "";
    const redirectUri = encodeURIComponent(`${origin}/api/auth/gmail-oauth`);
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${oauthState}`;
  }

  return (
    <ChannelCard
      icon={icon}
      iconBg={iconBg}
      title={title}
      subtitle={subtitle}
      connected={!!existing?.is_active}
      lastSynced={existing?.last_synced_at}
      onDisconnect={existing ? () => onDisconnect(existing.id) : undefined}
      onConnect={undefined}
    >
      {!existing?.is_active && (
        <a
          href={buildOAuthUrl()}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          style={{ border: "1px solid #e5e7eb" }}
        >
          <GoogleIcon size={16} />
          Connect with Google
        </a>
      )}
      {existing?.is_active && existing.config && (
        <p className="text-xs text-gray-500">
          {(existing.config.email as string) || existing.display_name}
        </p>
      )}
    </ChannelCard>
  );
}

// ─── Credential form card ─────────────────────────────────────────────────────

function CredentialCard({
  icon, iconBg, title, subtitle, fields, channelType, existing, onSave, onDisconnect,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  fields: { key: string; label: string; placeholder: string; secret: boolean }[];
  channelType: string;
  existing: Channel | undefined;
  onSave: (type: string, config: Record<string, string>) => Promise<void>;
  onDisconnect: (id: string) => Promise<void>;
}) {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(channelType, config);
    setSaving(false);
    setConfig({});
  }

  return (
    <ChannelCard
      icon={icon}
      iconBg={iconBg}
      title={title}
      subtitle={subtitle}
      connected={!!existing?.is_active}
      lastSynced={existing?.last_synced_at}
      onDisconnect={existing ? () => onDisconnect(existing.id) : undefined}
    >
      {existing?.is_active ? (
        <div className="space-y-1">
          {fields.filter((f) => f.secret).map((f) => (
            <SecretField key={f.key} label={f.label} value={String(existing.config?.[f.key] ?? "")} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((f) => (
            <div key={f.key}>
              <p className="text-[10px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">{f.label}</p>
              <input
                type={f.secret ? "password" : "text"}
                placeholder={f.placeholder}
                value={config[f.key] ?? ""}
                onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-lg text-xs text-gray-800 outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}
              />
            </div>
          ))}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "#6B7EFF" }}
          >
            {saving ? "Saving…" : "Save & Connect"}
          </button>
        </div>
      )}
    </ChannelCard>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative w-10 h-5 rounded-full transition-colors shrink-0"
      style={{ background: value ? "#6B7EFF" : "#d1d5db" }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
        style={{ transform: value ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  );
}

// ─── Main settings page ───────────────────────────────────────────────────────

function SettingsContent() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading]   = useState(true);
  const [banner, setBanner]     = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pwaEnabled, setPwaEnabled] = useState(true);

  const connected = searchParams.get("connected");
  const error     = searchParams.get("error");

  useEffect(() => {
    if (connected) setBanner({ type: "success", text: `${connected === "gmail" ? "Gmail" : "Channel"} connected successfully.` });
    if (error)     setBanner({ type: "error",   text: `Connection failed: ${error.replace(/_/g, " ")}` });
  }, [connected, error]);

  const loadChannels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/messages/channels");
      if (res.ok) {
        const d = await res.json() as { channels: Channel[] };
        setChannels(d.channels ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void loadChannels(); }, [loadChannels]);

  async function handleSave(type: string, config: Record<string, string>) {
    try {
      const res = await fetch("/api/messages/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_type: type, display_name: type, config }),
      });
      if (res.ok) {
        setBanner({ type: "success", text: `${type} channel connected.` });
        await loadChannels();
      } else {
        setBanner({ type: "error", text: "Failed to save channel." });
      }
    } catch {
      setBanner({ type: "error", text: "Network error." });
    }
  }

  async function handleDisconnect(id: string) {
    try {
      await fetch(`/api/messages/channels/${id}`, { method: "DELETE" });
      setChannels((prev) => prev.filter((c) => c.id !== id));
      setBanner({ type: "success", text: "Channel disconnected." });
    } catch { /* ignore */ }
  }

  function ch(type: string) { return channels.find((c) => c.channel_type === type); }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f8fafc" }}>
      {/* Left nav (mirrors messages page style) */}
      <div className="flex flex-col" style={{ width: 220, background: "#fff", borderRight: "1px solid #f0f0f0" }}>
        <div className="px-4 py-4 border-b" style={{ borderColor: "#f0f0f0" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-bold"
              style={{ background: "linear-gradient(135deg, #6B7EFF 0%, #8b5cf6 100%)" }}>
              G
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">GG Messenger</p>
              <p className="text-[10px] text-gray-400">Single dashboard</p>
            </div>
          </div>
        </div>
        <div className="flex-1 px-2 py-3 space-y-1">
          <button
            onClick={() => router.push("/messages")}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ← Back to Inbox
          </button>
          <div className="px-3 pt-3 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">System Settings</p>
          </div>
          <div className="px-3 py-1.5 rounded-lg text-sm font-semibold"
            style={{ background: "linear-gradient(135deg, #6B7EFF 0%, #8b5cf6 100%)", color: "#fff" }}>
            Channel Management
          </div>
        </div>
      </div>

      {/* Main settings content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => router.push("/messages")} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">System Settings</button>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-800">Channel Management</span>
          <div className="flex-1" />
          <button onClick={() => { void loadChannels(); }} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <RefreshCw size={14} className="text-gray-400" />
          </button>
        </div>

        {/* Banner */}
        {banner && (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl mb-6 text-sm"
            style={{
              background: banner.type === "success" ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${banner.type === "success" ? "#bbf7d0" : "#fecaca"}`,
              color: banner.type === "success" ? "#15803d" : "#dc2626",
            }}
          >
            <CheckCircle2 size={15} />
            {banner.text}
            <button onClick={() => setBanner(null)} className="ml-auto opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Section 1: Unified Gateway Configuration */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-gray-900 mb-1">Unified Gateway Configuration</h2>
          <p className="text-xs text-gray-500 mb-4">Programmable SMS and phone number routing</p>
          <div className="grid grid-cols-2 gap-4">
            <CredentialCard
              icon={<TwilioIcon size={20} />}
              iconBg="#fff1f2"
              title="Twilio API"
              subtitle="SMS, Voice, WhatsApp Business"
              fields={[
                { key: "account_sid",  label: "API Key (Account SID)", placeholder: "ACxxxxxxxxxxxxxxxx", secret: false },
                { key: "auth_token",   label: "Password (Auth Token)",  placeholder: "••••••••••••••••",  secret: true  },
                { key: "phone_number", label: "Twilio Number",          placeholder: "+1 (480) 555-0100", secret: false },
              ]}
              channelType="twilio"
              existing={ch("twilio")}
              onSave={handleSave}
              onDisconnect={handleDisconnect}
            />
            <CredentialCard
              icon={<PhoneCall size={20} style={{ color: "#854F0B" }} />}
              iconBg="#fff8e6"
              title="SMS Gateway (Phone)"
              subtitle="Carrier SMS bridge for mobile numbers"
              fields={[
                { key: "phone_number", label: "Phone Number", placeholder: "+1 (480) 555-0100", secret: false },
                { key: "carrier",      label: "Carrier",      placeholder: "AT&T / Verizon / T-Mobile", secret: false },
              ]}
              channelType="phone"
              existing={ch("phone")}
              onSave={handleSave}
              onDisconnect={handleDisconnect}
            />
          </div>
        </div>

        {/* Section 2: Email Accounts */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-gray-900 mb-1">Email Accounts</h2>
          <p className="text-xs text-gray-500 mb-4">Connect email accounts for inbound and outbound messaging</p>
          <div className="grid grid-cols-2 gap-4">
            <OAuthCard
              icon={<GmailIcon size={20} />}
              iconBg="#fef2f2"
              title="Gmail"
              subtitle="IMAP · OAuth2"
              oauthState="gmail"
              existing={ch("gmail")}
              onDisconnect={handleDisconnect}
            />
            <CredentialCard
              icon={<OutlookIcon size={20} />}
              iconBg="#eff6ff"
              title="Outlook / SMTP"
              subtitle="POP3 · Any mail server"
              fields={[
                { key: "smtp_host",     label: "SMTP Host",     placeholder: "smtp.office365.com",  secret: false },
                { key: "smtp_port",     label: "Port",          placeholder: "587",                  secret: false },
                { key: "smtp_user",     label: "Username",      placeholder: "you@company.com",       secret: false },
                { key: "smtp_password", label: "Password",      placeholder: "••••••••",              secret: true  },
                { key: "from_address",  label: "From Address",  placeholder: "you@company.com",       secret: false },
              ]}
              channelType="smtp"
              existing={ch("smtp")}
              onSave={handleSave}
              onDisconnect={handleDisconnect}
            />
          </div>
        </div>

        {/* Section 3: CalDAV / Calendar */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-gray-900 mb-1">Calendar Integration</h2>
          <p className="text-xs text-gray-500 mb-4">Sync events from Google Calendar or any CalDAV server</p>
          <div className="grid grid-cols-2 gap-4">
            <OAuthCard
              icon={
                <svg width={20} height={20} viewBox="0 0 24 24">
                  <path d="M19 4h-1V2h-2v2H8V2H6v2H5C3.9 4 3 4.9 3 6v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zM7 12h5v5H7z" fill="#1565C0"/>
                </svg>
              }
              iconBg="#e3f2fd"
              title="Google Calendar"
              subtitle="CalDAV · OAuth2"
              oauthState="caldav"
              existing={ch("caldav")}
              onDisconnect={handleDisconnect}
            />
            <CredentialCard
              icon={<Server size={20} style={{ color: "#374151" }} />}
              iconBg="#f9fafb"
              title="Custom CalDAV Server"
              subtitle="Apple iCloud, Nextcloud, Fastmail…"
              fields={[
                { key: "caldav_url",  label: "CalDAV Server URL", placeholder: "https://caldav.example.com/", secret: false },
                { key: "caldav_user", label: "Username",          placeholder: "you@example.com",             secret: false },
                { key: "caldav_pass", label: "Password",          placeholder: "••••••••",                    secret: true  },
              ]}
              channelType="caldav"
              existing={undefined}
              onSave={handleSave}
              onDisconnect={handleDisconnect}
            />
          </div>
        </div>

        {/* Section 4: Org PWA Chat Builder */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-gray-900 mb-1">Org PWA Chat Builder</h2>
          <p className="text-xs text-gray-500 mb-4">Configure and deploy the GateGuard Messenger PWA for your organization</p>
          <div className="grid grid-cols-2 gap-4">
            {/* Brand colors */}
            <div className="rounded-2xl p-4" style={{ background: "#fff", border: "1px solid #f0f0f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <p className="text-sm font-bold text-gray-900 mb-3">Brand Colors</p>
              <div className="flex gap-2 mb-3">
                {["#6B7EFF","#8b5cf6","#0C111D","#EA580C","#15803d"].map((c) => (
                  <div key={c} className="w-7 h-7 rounded-lg cursor-pointer hover:scale-110 transition-transform" style={{ background: c }} />
                ))}
              </div>
              <div className="flex gap-2">
                <div className="flex-1 h-8 rounded-lg" style={{ background: "linear-gradient(135deg, #6B7EFF, #8b5cf6)" }} />
                <div className="flex-1 h-8 rounded-lg" style={{ background: "#0C111D" }} />
              </div>
              <p className="text-[10px] text-gray-400 mt-2">Primary gradient · Dark bg</p>
            </div>

            {/* Deployment status */}
            <div className="rounded-2xl p-4" style={{ background: "#fff", border: "1px solid #f0f0f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-gray-900">Deployment Status</p>
                <Toggle value={pwaEnabled} onChange={setPwaEnabled} />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full ${pwaEnabled ? "bg-emerald-500" : "bg-gray-300"}`} />
                <span className="text-xs text-gray-600">{pwaEnabled ? "PWA active — installable on mobile" : "PWA disabled"}</span>
              </div>
              <a
                href="/pwa/messenger"
                target="_blank"
                className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
                style={{ color: "#6B7EFF" }}
              >
                <ExternalLink size={11} />
                Open PWA Messenger
              </a>
            </div>
          </div>
        </div>

        {/* Section 5: Internal Org Channel */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-gray-900 mb-1">Internal Org Channel</h2>
          <p className="text-xs text-gray-500 mb-4">Secure real-time messaging for all portal users — always on</p>
          <div className="grid grid-cols-2 gap-4">
            <ChannelCard
              icon={<Lock size={20} style={{ color: "#6B7EFF" }} />}
              iconBg="#ede8ff"
              title="Org Chat (Internal)"
              subtitle="Clerk-authenticated · Always enabled"
              connected={!!ch("internal")?.is_active}
              statusDot={true}
            >
              <p className="text-xs text-gray-500">All portal users can send and receive internal messages. No external configuration needed.</p>
            </ChannelCard>
          </div>
        </div>

        {/* Env vars reference */}
        <div className="rounded-2xl p-5 mb-8" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Required Environment Variables (Vercel)</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
            {[
              ["GOOGLE_CLIENT_ID", "Gmail + CalDAV OAuth"],
              ["GOOGLE_CLIENT_SECRET", "Gmail + CalDAV OAuth"],
              ["NEXT_PUBLIC_GOOGLE_CLIENT_ID", "Browser OAuth redirect"],
              ["TWILIO_ACCOUNT_SID", "Twilio SMS/Voice"],
              ["TWILIO_AUTH_TOKEN", "Twilio SMS/Voice"],
              ["TWILIO_PHONE_NUMBER", "Outbound SMS from number"],
              ["RESEND_API_KEY", "SMTP fallback via Resend"],
              ["NEXT_PUBLIC_APP_URL", "OAuth callback base URL"],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-baseline gap-2">
                <code className="text-[10px] font-mono text-gray-700 shrink-0">{key}</code>
                <span className="text-[10px] text-gray-400 truncate">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MessagesSettings() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-sm text-gray-400">Loading…</div>}>
      <SettingsContent />
    </Suspense>
  );
}
