'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Plus, Check, X, Search, Clock, RefreshCw, Trash2, Send, Loader2 } from 'lucide-react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ShieldCheck, AlertCircle, ChevronRight } = require('lucide-react') as any;

// Mirrors the sanitized shape from GET /api/nexus/messages/channels
type Connector = {
  id: string;
  channel_type: 'gmail' | 'smtp';
  display_name: string;
  email: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  connected: boolean;
  last_synced_at: string | null;
  created_at: string;
};

const glassPanel = { backgroundColor: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' };
const textPrimary = { color: 'rgba(255,255,255,0.9)' };
const textSecondary = { color: 'rgba(255,255,255,0.5)' };
const textFaint = { color: 'rgba(255,255,255,0.34)' };
const brandBlue = '#6B7EFF';
const cyan = '#00C8FF';
const emerald = '#34D399';
const amber = '#F59E0B';
const violet = '#8B5CF6';

const GMAIL_CONNECT_URL = '/api/nexus/messages/google/connect';

// ─── Real API calls ─────────────────────────────────────────────────────────
async function loadConnectors(): Promise<Connector[]> {
  const res = await fetch('/api/nexus/messages/channels', { cache: 'no-store' });
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json.channels) ? json.channels : [];
}
async function addSmtp(form: {
  display_name: string; host: string; port: number; secure: boolean; user: string; pass: string; from_address: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/nexus/messages/channels', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
  });
  if (res.ok) return { ok: true };
  const j = await res.json().catch(() => ({}));
  return { ok: false, error: j.error || 'Could not save mailbox' };
}
async function removeConnector(id: string): Promise<void> {
  await fetch(`/api/nexus/messages/channels?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}
async function testConnector(id: string): Promise<{ ok: boolean; sent_to?: string; error?: string }> {
  const res = await fetch('/api/nexus/messages/channels/test', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel_id: id }),
  });
  return res.json().catch(() => ({ ok: false, error: 'Test failed' }));
}
async function refreshInbox(id: string): Promise<{ ok: boolean; fetched?: number }> {
  const res = await fetch('/api/nexus/messages/sync', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel_id: id, inline: true }),
  });
  return res.json().catch(() => ({ ok: false }));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function relTime(iso: string | null) {
  if (!iso) return 'Never verified';
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  const h = Math.floor(m / 60); const d = Math.floor(h / 24);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d === 1) return 'Yesterday';
  return `${d}d ago`;
}
function kindColor(c: Connector) { return c.channel_type === 'gmail' ? violet : cyan; }
function statusOf(c: Connector): { label: string; color: string } {
  return c.connected ? { label: 'Connected', color: emerald } : { label: 'Needs attention', color: amber };
}
function statusTone(color: string) {
  return { color, backgroundColor: `${color}1A`, border: `1px solid ${color}55` };
}

// ─── SMTP form ─────────────────────────────────────────────────────────────────
function AddMailbox({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(587);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ready = email.trim() && host.trim() && user.trim() && pass.trim();

  const save = async () => {
    if (!ready) return;
    setSaving(true); setErr(null);
    const r = await addSmtp({
      display_name: name.trim() || email.trim(), host: host.trim(), port, secure: port === 465,
      user: user.trim(), pass, from_address: email.trim(),
    });
    setSaving(false);
    if (r.ok) { onAdded(); onClose(); } else setErr(r.error || 'Could not save mailbox');
  };

  const field = 'w-full rounded-2xl bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-white/30';
  return (
    <div className="rounded-3xl p-4 sm:p-5 space-y-4" style={glassPanel}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold" style={textPrimary}>Connect a different email (SMTP)</div>
          <div className="text-xs mt-1" style={textSecondary}>For Outlook, GoDaddy, or a company mail server.</div>
        </div>
        <button type="button" onClick={onClose} className="h-9 w-9 rounded-2xl flex items-center justify-center hover:bg-white/5" style={textSecondary} aria-label="Close"><X size={16} /></button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1.5">
          <span className="text-xs" style={textSecondary}>Email address</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="billing@gateguard.co" className={field} style={{ ...glassPanel, ...textPrimary }} />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs" style={textSecondary}>Display name (optional)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="GateGuard Billing" className={field} style={{ ...glassPanel, ...textPrimary }} />
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <span className="text-xs" style={textSecondary}>SMTP server</span>
          <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.office365.com" className={field} style={{ ...glassPanel, ...textPrimary }} />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs" style={textSecondary}>Port</span>
          <div className="flex gap-2">
            {[465, 587].map((p) => (
              <button key={p} type="button" onClick={() => setPort(p)} className="flex-1 rounded-2xl px-3 py-2.5 text-sm transition"
                style={{ color: port === p ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)', backgroundColor: port === p ? 'rgba(107,126,255,0.16)' : 'rgba(255,255,255,0.035)', border: port === p ? '1px solid rgba(107,126,255,0.45)' : '1px solid rgba(255,255,255,0.08)' }}>
                {p} {p === 465 ? '(SSL)' : '(TLS)'}
              </button>
            ))}
          </div>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs" style={textSecondary}>Username</span>
          <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="usually your full email" className={field} style={{ ...glassPanel, ...textPrimary }} />
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <span className="text-xs" style={textSecondary}>Password / app password</span>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="many providers need an 'app password'" className={field} style={{ ...glassPanel, ...textPrimary }} />
        </label>
      </div>

      {err && <div className="flex items-center gap-2 text-xs" style={{ color: '#F87171' }}><AlertCircle size={14} /> {err}</div>}

      <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
        <button type="button" onClick={onClose} className="rounded-2xl px-4 py-2.5 text-sm font-medium hover:bg-white/5" style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>Cancel</button>
        <button type="button" onClick={save} disabled={!ready || saving} className="rounded-2xl px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40" style={{ color: 'white', background: 'linear-gradient(135deg, #6B7EFF, #00C8FF)' }}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Save mailbox
        </button>
      </div>
    </div>
  );
}

// ─── Detail ─────────────────────────────────────────────────────────────────
function ConnectorDetail({ connector, onChanged }: { connector: Connector | null; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { setResult(null); }, [connector?.id]);

  if (!connector) {
    return (
      <div className="rounded-3xl p-6 min-h-80 flex flex-col items-center justify-center text-center" style={glassPanel}>
        <div className="h-14 w-14 rounded-3xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(107,126,255,0.14)', color: brandBlue }}><Mail size={24} /></div>
        <div className="text-lg font-semibold" style={textPrimary}>Pick a mailbox</div>
        <div className="text-sm mt-2 max-w-xs" style={textSecondary}>Select a mailbox to test it, refresh it, or remove it.</div>
      </div>
    );
  }

  const color = kindColor(connector); const st = statusOf(connector);
  const isGmail = connector.channel_type === 'gmail';

  const doTest = async () => {
    setBusy('test'); setResult(null);
    const r = await testConnector(connector.id); setBusy(null);
    setResult(r.ok ? { ok: true, text: `Test email sent to ${r.sent_to || 'you'} ✓` } : { ok: false, text: r.error || 'Test failed' });
    onChanged();
  };
  const doRefresh = async () => {
    setBusy('refresh'); setResult(null);
    const r = await refreshInbox(connector.id); setBusy(null);
    setResult(r.ok ? { ok: true, text: `Pulled ${r.fetched ?? 0} new message(s)` } : { ok: false, text: 'Could not refresh inbox' });
    onChanged();
  };
  const doRemove = async () => {
    setBusy('remove');
    await removeConnector(connector.id); setBusy(null); onChanged();
  };

  return (
    <div className="rounded-3xl p-4 sm:p-5 space-y-4" style={glassPanel}>
      <div className="rounded-3xl p-5" style={glassPanel}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}1A`, color, border: `1px solid ${color}44` }}><Mail size={22} /></div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-widest" style={textFaint}>Mailbox · {isGmail ? 'Gmail' : 'SMTP'}</div>
              <div className="text-xl font-semibold truncate mt-1" style={textPrimary}>{connector.display_name}</div>
              <div className="text-sm mt-1 truncate" style={textSecondary}>{connector.email || 'No address on file'}</div>
            </div>
          </div>
          <span className="rounded-full px-3 py-1.5 text-xs font-semibold self-start" style={statusTone(st.color)}>{st.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl p-4" style={glassPanel}><div className="text-xs" style={textSecondary}>Type</div><div className="mt-2 text-lg font-semibold" style={textPrimary}>{isGmail ? 'Gmail' : 'SMTP'}</div></div>
        <div className="rounded-2xl p-4" style={glassPanel}><div className="text-xs" style={textSecondary}>Status</div><div className="mt-2 text-lg font-semibold" style={{ color: st.color }}>{st.label}</div></div>
        <div className="rounded-2xl p-4" style={glassPanel}><div className="text-xs" style={textSecondary}>Server</div><div className="mt-2 text-sm font-semibold truncate" style={textPrimary}>{isGmail ? 'gmail.com' : `${connector.smtp_host || '—'}:${connector.smtp_port || ''}`}</div></div>
        <div className="rounded-2xl p-4" style={glassPanel}><div className="text-xs flex items-center gap-1" style={textSecondary}><Clock size={12} />Last verified</div><div className="mt-2 text-sm font-semibold" style={textPrimary}>{relTime(connector.last_synced_at)}</div></div>
      </div>

      {result && (
        <div className="flex items-center gap-2 text-sm rounded-2xl px-3 py-2.5" style={{ ...glassPanel, color: result.ok ? emerald : '#F87171' }}>
          {result.ok ? <Check size={15} /> : <AlertCircle size={15} />} {result.text}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button type="button" onClick={doTest} disabled={busy !== null} className="rounded-2xl px-3 py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40" style={{ color: 'white', background: 'linear-gradient(135deg, #6B7EFF, #00C8FF)' }}>
          {busy === 'test' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send test
        </button>
        {isGmail && (
          <button type="button" onClick={doRefresh} disabled={busy !== null} className="rounded-2xl px-3 py-3 text-sm font-medium flex items-center justify-center gap-2 hover:bg-white/5 disabled:opacity-40" style={{ color: 'rgba(255,255,255,0.72)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {busy === 'refresh' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Refresh inbox
          </button>
        )}
        <button type="button" onClick={doRemove} disabled={busy !== null} className="rounded-2xl px-3 py-3 text-sm font-medium flex items-center justify-center gap-2 hover:bg-white/5 disabled:opacity-40" style={{ color: '#F87171', border: '1px solid rgba(248,113,113,0.25)' }}>
          {busy === 'remove' ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Remove
        </button>
      </div>
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────
export default function MessagesConnectorPane() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);

  const reload = () => loadConnectors().then((items) => {
    setConnectors(items);
    setSelectedId((cur) => cur && items.some((i) => i.id === cur) ? cur : items[0]?.id ?? null);
  });

  useEffect(() => { reload(); }, []);

  // Surface the Gmail OAuth callback result (redirects to ?view=messages&gmail_connected / gmail_error).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    if (p.get('gmail_connected')) { setBanner({ ok: true, text: 'Gmail connected ✓' }); reload(); }
    else if (p.get('gmail_error')) { setBanner({ ok: false, text: `Gmail connection failed: ${p.get('gmail_error')}` }); }
  }, []);

  const filtered = useMemo(() => {
    const n = search.trim().toLowerCase();
    return connectors.filter((c) => !n || c.display_name.toLowerCase().includes(n) || (c.email ?? '').toLowerCase().includes(n));
  }, [connectors, search]);

  const selected = connectors.find((c) => c.id === selectedId) ?? filtered[0] ?? null;
  const connectedCount = connectors.filter((c) => c.connected).length;
  const attentionCount = connectors.filter((c) => !c.connected).length;
  const lastSync = connectors.map((c) => c.last_synced_at).filter(Boolean).sort().pop() ?? null;

  return (
    <div className="w-full pb-28" style={textPrimary}>
      <div className="space-y-5">
        {/* Header */}
        <div className="rounded-3xl p-4 sm:p-5" style={glassPanel}>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest" style={textFaint}><Mail size={14} /> Messages setup</div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight" style={textPrimary}>Connected mailboxes</h1>
          <p className="mt-2 text-sm max-w-2xl" style={textSecondary}>Connect an email account so Nexus can send (and receive) messages for you.</p>
        </div>

        {banner && (
          <div className="flex items-center gap-2 text-sm rounded-2xl px-3 py-2.5" style={{ ...glassPanel, color: banner.ok ? emerald : '#F87171' }}>
            {banner.ok ? <Check size={15} /> : <AlertCircle size={15} />} {banner.text}
          </div>
        )}

        {/* Stat tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-3xl p-4" style={glassPanel}><div className="text-xs" style={textSecondary}>Mailboxes</div><div className="mt-2 text-2xl font-semibold" style={textPrimary}>{connectors.length}</div></div>
          <div className="rounded-3xl p-4" style={glassPanel}><div className="text-xs" style={textSecondary}>Connected</div><div className="mt-2 text-2xl font-semibold" style={{ color: emerald }}>{connectedCount}</div></div>
          <div className="rounded-3xl p-4" style={glassPanel}><div className="text-xs" style={textSecondary}>Needs attention</div><div className="mt-2 text-2xl font-semibold" style={{ color: attentionCount ? amber : 'rgba(255,255,255,0.9)' }}>{attentionCount}</div></div>
          <div className="rounded-3xl p-4" style={glassPanel}><div className="text-xs flex items-center gap-1" style={textSecondary}><Clock size={12} />Last sync</div><div className="mt-2 text-base font-semibold" style={textPrimary}>{relTime(lastSync)}</div></div>
        </div>

        {/* Connect actions */}
        <div className="rounded-3xl p-4 sm:p-5 space-y-3" style={glassPanel}>
          <div className="text-sm font-semibold" style={textPrimary}>Add a mailbox</div>
          <button type="button" onClick={() => { window.location.href = GMAIL_CONNECT_URL; }} className="w-full rounded-2xl px-4 py-3.5 text-sm font-semibold flex items-center justify-center gap-2" style={{ color: 'white', background: 'linear-gradient(135deg, #6B7EFF, #00C8FF)' }}>
            <Mail size={16} /> Connect Gmail
          </button>
          {!showAdd ? (
            <button type="button" onClick={() => setShowAdd(true)} className="w-full rounded-2xl px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 hover:bg-white/5" style={{ color: 'rgba(255,255,255,0.72)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Plus size={15} /> Connect a different email (SMTP)
            </button>
          ) : (
            <AddMailbox onClose={() => setShowAdd(false)} onAdded={reload} />
          )}
          <div className="flex items-center gap-2 text-xs" style={textFaint}><ShieldCheck size={13} /> Your password is stored securely and never shown again.</div>
        </div>

        {/* List + detail */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
          <div className="space-y-3">
            <div className="rounded-3xl p-3" style={glassPanel}>
              <div className="flex items-center gap-2 rounded-2xl px-3 py-2.5" style={glassPanel}>
                <Search size={16} style={textFaint} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search mailboxes..." className="w-full bg-transparent text-sm outline-none placeholder:text-white/30" style={textPrimary} />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-3xl p-8 text-center" style={glassPanel}>
                <Mail size={24} style={{ color: 'rgba(255,255,255,0.34)', margin: '0 auto' }} />
                <div className="mt-3 text-sm font-semibold" style={textPrimary}>No mailboxes yet</div>
                <div className="mt-1 text-xs" style={textSecondary}>Connect Gmail or add an SMTP mailbox above.</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filtered.map((c) => {
                  const color = kindColor(c); const st = statusOf(c); const sel = selected?.id === c.id;
                  return (
                    <button key={c.id} type="button" onClick={() => setSelectedId(c.id)} className="rounded-3xl p-4 text-left transition hover:bg-white/5"
                      style={{ ...glassPanel, borderColor: sel ? 'rgba(107,126,255,0.55)' : 'rgba(255,255,255,0.08)', boxShadow: sel ? '0 0 0 1px rgba(107,126,255,0.18)' : 'none' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}1A`, color, border: `1px solid ${color}44` }}><Mail size={19} /></div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate" style={textPrimary}>{c.display_name}</div>
                            <div className="text-xs truncate" style={textSecondary}>{c.email || (c.channel_type === 'gmail' ? 'Gmail' : 'SMTP')}</div>
                          </div>
                        </div>
                        <ChevronRight size={16} style={textFaint} />
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={statusTone(st.color)}>{st.label}</span>
                        <span className="rounded-full px-2.5 py-1 text-xs" style={{ color, backgroundColor: `${color}14` }}>{c.channel_type === 'gmail' ? 'Gmail' : 'SMTP'}</span>
                        <span className="ml-auto flex items-center gap-1 text-xs" style={textFaint}><Clock size={12} />{relTime(c.last_synced_at)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <ConnectorDetail connector={selected} onChanged={reload} />
        </div>
      </div>
    </div>
  );
}
