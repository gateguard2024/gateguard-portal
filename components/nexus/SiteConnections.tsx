'use client';

// Per-site vendor connections (#83 expanded). Admins paste each property's own
// Brivo / Eagle Eye / Shelly / UniFi credentials; they're encrypted server-side
// (never returned). Brivo has a live Test. UI-only field metadata — no secrets
// or server crypto imported here.
import React, { useEffect, useState } from "react";

type Vendor = "brivo" | "eagle_eye" | "shelly" | "unifi";
type Field = { key: string; label: string; secret?: boolean; placeholder?: string };

const VENDORS: { vendor: Vendor; label: string; fields: Field[] }[] = [
  { vendor: "brivo", label: "Brivo · Access Control", fields: [
    { key: "username", label: "Brivo username" }, { key: "password", label: "Brivo password", secret: true },
    { key: "api_key", label: "Brivo API key", secret: true }, { key: "client_id", label: "Brivo client ID" }, { key: "client_secret", label: "Brivo client secret", secret: true },
    { key: "site_id", label: "Brivo site ID", placeholder: "e.g. 123456" } ] },
  { vendor: "eagle_eye", label: "Eagle Eye · Cameras", fields: [
    { key: "client_id", label: "EEN client ID" }, { key: "client_secret", label: "EEN client secret", secret: true } ] },
  { vendor: "shelly", label: "Shelly · Relays / Power", fields: [
    { key: "auth_key", label: "Cloud auth key", secret: true }, { key: "server", label: "Cloud server", placeholder: "shelly-12-eu.shelly.cloud" },
    { key: "device_tag", label: "Property tag in device names", placeholder: "defaults to site name, e.g. Elevate Greene" } ] },
  { vendor: "unifi", label: "UniFi · Network + Access", fields: [
    { key: "cloud_api_key", label: "Cloud API key (unifi.ui.com)", secret: true }, { key: "cloud_site_id", label: "Cloud site ID", placeholder: "pick from site list after saving key" }, { key: "cloud_host_id", label: "Cloud host ID (optional)" },
    { key: "host", label: "Local controller URL", placeholder: "https://192.168.1.1" }, { key: "api_key", label: "Local Network API key", secret: true }, { key: "site", label: "Local network site", placeholder: "default" },
    { key: "access_host", label: "Access controller URL", placeholder: "https://<ip>:12445" }, { key: "access_token", label: "Access API token", secret: true } ] },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Status = { vendor: Vendor; configured: boolean; status: string | null; last_verified_at: string | null; last_error: string | null };

export function SiteConnections({ siteId }: { siteId: string }) {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [keyOk, setKeyOk] = useState(true);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Vendor | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [cloudSites, setCloudSites] = useState<{ site_id: string; name: string; host_id: string | null; host_name: string | null }[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch(`/api/sites/${siteId}/integrations`).then(r => r.json()).then(d => {
      setStatuses(d.integrations ?? []); setKeyOk(d.key_configured !== false);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [siteId]);
  useEffect(() => { load(); }, [load]);

  function statusOf(v: Vendor) { return statuses.find(s => s.vendor === v); }
  function chip(s?: Status) {
    if (!s || !s.configured) return { label: "Not set", color: "#64748b" };
    if (s.status === "verified") return { label: "Verified", color: "#34d399" };
    if (s.status === "error") return { label: "Error", color: "#f87171" };
    return { label: "Configured", color: "#fbbf24" };
  }

  async function save(vendor: Vendor) {
    setBusy(true); setMsg(null);
    const r = await fetch(`/api/sites/${siteId}/integrations`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vendor, credentials: form }) }).then(x => x.json()).catch(() => null);
    setBusy(false);
    if (r && r.ok) { setMsg("Saved ✓"); setForm({}); setOpen(null); load(); }
    else setMsg((r && r.error) || "Couldn't save.");
  }
  async function test(vendor: Vendor) {
    setBusy(true); setMsg(null);
    const r = await fetch(`/api/sites/${siteId}/integrations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test", vendor }) }).then(x => x.json()).catch(() => null);
    setBusy(false);
    setMsg(r?.verified ? "Connection verified ✓" : r?.note || r?.error || "Test finished.");
    load();
  }
  async function remove(vendor: Vendor, label: string) {
    if (!window.confirm(`Remove the ${label} login for this site? This can't be undone.`)) return;
    setBusy(true); setMsg(null);
    const r = await fetch(`/api/sites/${siteId}/integrations?vendor=${vendor}`, { method: "DELETE" }).then(x => x.json()).catch(() => null);
    setBusy(false);
    if (r && r.ok) { setMsg("Removed ✓"); setOpen(null); load(); }
    else setMsg((r && r.error) || "Couldn't remove.");
  }

  // UniFi cloud: save whatever's typed (so the key is stored), then list the account's
  // sites so the user can pick this property instead of pasting a Cloud site ID.
  async function loadUniFiSites() {
    setLoadingSites(true); setMsg(null);
    try {
      if (Object.keys(form).length) {
        await fetch(`/api/sites/${siteId}/integrations`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vendor: "unifi", credentials: form }) });
      }
      const r = await fetch(`/api/unifi/cloud/sites?site_id=${siteId}`).then(x => x.json()).catch(() => null);
      if (r?.sites?.length) { setCloudSites(r.sites); load(); }
      else { setCloudSites([]); setMsg(r?.error || "No sites returned for this key. Double-check the Cloud API key."); }
    } catch { setMsg("Couldn't load sites."); }
    finally { setLoadingSites(false); }
  }

  const card = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 18 } as const;
  const input = { background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.92)", borderRadius: 10, padding: "9px 11px", width: "100%", fontSize: 13 } as const;

  return (
    <div style={card}>
      <div style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.95)", marginBottom: 4 }}>Connections</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>This property&apos;s own Brivo, Eagle Eye, Shelly, and UniFi logins. Stored encrypted — never shown again.</div>
      {!keyOk && <div style={{ fontSize: 12, color: "#fca5a5", marginBottom: 10 }}>Server encryption key not set (CREDENTIALS_ENC_KEY) — saving is disabled until it&apos;s configured.</div>}
      {loading ? <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Loading…</div> : (
        <div style={{ display: "grid", gap: 8 }}>
          {VENDORS.map(({ vendor, label, fields }) => {
            const s = statusOf(vendor); const c = chip(s); const isOpen = open === vendor;
            return (
              <div key={vendor} style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: c.color }}>{c.label}</span>
                    <button onClick={() => { setOpen(isOpen ? null : vendor); setForm({}); setMsg(null); }} style={{ fontSize: 12, color: "#7DE5FF", background: "none", border: "none", cursor: "pointer" }}>{isOpen ? "Cancel" : s?.configured ? "Update" : "Set up"}</button>
                  </div>
                </div>
                {s?.last_error && !isOpen && <div style={{ fontSize: 11, color: "#fca5a5", marginTop: 4 }}>{s.last_error}</div>}
                {isOpen && (
                  <div style={{ display: "grid", gap: 7, marginTop: 10 }}>
                    {fields.map(f => (
                      <input key={f.key} type={f.secret ? "password" : "text"} autoComplete="new-password"
                        placeholder={f.label + (f.placeholder ? ` (${f.placeholder})` : "")}
                        value={form[f.key] ?? ""} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={input} />
                    ))}
                    {vendor === "unifi" && (
                      <div style={{ display: "grid", gap: 6, paddingTop: 4 }}>
                        <button type="button" onClick={loadUniFiSites} disabled={loadingSites} style={{ justifySelf: "start", fontSize: 12, fontWeight: 600, background: "rgba(125,229,255,0.12)", border: "1px solid rgba(125,229,255,0.35)", color: "#7DE5FF", borderRadius: 9, padding: "7px 12px", cursor: "pointer", opacity: loadingSites ? 0.5 : 1 }}>{loadingSites ? "Loading sites…" : "↻ Load my UniFi sites"}</button>
                        {cloudSites.length > 0 && (
                          <select value={form.cloud_site_id ?? ""} onChange={e => { const s = cloudSites.find(x => x.site_id === e.target.value); setForm(p => ({ ...p, cloud_site_id: e.target.value, cloud_host_id: s?.host_id ?? p.cloud_host_id ?? "" })); }} style={input}>
                            <option value="">— pick this property&apos;s UniFi site —</option>
                            {cloudSites.map(s => <option key={s.site_id} value={s.site_id}>{s.name}{s.host_name ? ` · ${s.host_name}` : ""}</option>)}
                          </select>
                        )}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => save(vendor)} disabled={busy || !keyOk} style={{ fontSize: 12, fontWeight: 600, background: "rgba(0,200,255,0.18)", border: "1px solid rgba(0,200,255,0.45)", color: "#7DE5FF", borderRadius: 10, padding: "7px 14px", cursor: "pointer", opacity: busy || !keyOk ? 0.5 : 1 }}>{busy ? "Saving…" : "Save"}</button>
                      {s?.configured && vendor !== "eagle_eye" && <button onClick={() => test(vendor)} disabled={busy} style={{ fontSize: 12, fontWeight: 600, background: "rgba(52,211,153,0.16)", border: "1px solid rgba(52,211,153,0.4)", color: "#6ee7b7", borderRadius: 10, padding: "7px 14px", cursor: "pointer", opacity: busy ? 0.5 : 1 }}>Test</button>}
                      {s?.configured && vendor === "eagle_eye" && <button onClick={() => { window.location.href = `/api/eagle-eye/connect?site_id=${siteId}`; }} style={{ fontSize: 12, fontWeight: 600, background: "rgba(52,211,153,0.16)", border: "1px solid rgba(52,211,153,0.4)", color: "#6ee7b7", borderRadius: 10, padding: "7px 14px", cursor: "pointer" }}>{s.status === "verified" ? "Reconnect Eagle Eye" : "Connect Eagle Eye →"}</button>}
                      {s?.configured && <button onClick={() => remove(vendor, label)} disabled={busy} style={{ fontSize: 12, fontWeight: 600, background: "rgba(248,113,113,0.14)", border: "1px solid rgba(248,113,113,0.4)", color: "#fca5a5", borderRadius: 10, padding: "7px 14px", cursor: "pointer", opacity: busy ? 0.5 : 1, marginLeft: "auto" }}>Remove</button>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {msg && <div style={{ fontSize: 12, color: msg.includes("✓") ? "#6ee7b7" : "#fbbf24", marginTop: 10 }}>{msg}</div>}
    </div>
  );
}
