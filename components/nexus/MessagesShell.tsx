'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Search, MessageSquare, Send, Clock, Settings } from 'lucide-react';
import MessagesConnectorPane from '@/components/nexus/MessagesConnectorPane';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowLeft, PhoneForwarded, PhoneMissed } = require('lucide-react') as any;
// --- Types ---
type Channel = 'call' | 'text' | 'email';
type Message = {
  id: string;
  direction: 'in' | 'out';
  channel: Channel;
  body: string;
  body_html?: string;
  subject?: string;
  at: string;
  duration_secs?: number;
};
type LinkedType = 'lead' | 'contact' | 'customer' | 'opportunity' | 'job';
type Conversation = {
  id: string;
  contact_name: string;
  company?: string | null;
  channel: Channel;
  preview: string;
  subject?: string;
  unread: boolean;
  needs_reply: boolean;
  last_at: string;
  messages: Message[];
  channel_id?: string | null;     // connector this thread belongs to (for replies)
  contact_address?: string | null; // recipient email/phone (for replies)
  linked_type?: LinkedType | null;
  linked_id?: string | null;
  linked_label?: string | null;
};
// --- Real connector data, with a graceful preview fallback ---
// Pulls the current user's threads from /api/nexus/messages/threads. If the
// endpoint is unreachable (e.g. migration 115 not yet run), falls back to the
// preview dataset so the panel still renders.
const loadConversations = async (): Promise<Conversation[]> => {
  try {
    const res = await fetch('/api/nexus/messages/threads', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.conversations)) return json.conversations as Conversation[];
    }
  } catch {
    /* fall through to preview data */
  }
  return loadPreviewConversations();
};
const loadPreviewConversations = async (): Promise<Conversation[]> => {
  return [
    {
      id: 'c1', contact_name: 'Sarah Jenkins', company: 'Property Management Inc.', channel: 'text',
      preview: 'Can you send the gate code for tomorrow?', unread: true, needs_reply: true,
      last_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      messages: [
        { id: 'm1', direction: 'out', channel: 'text', body: 'Hi Sarah, your vendor access is approved.', at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
        { id: 'm2', direction: 'in', channel: 'text', body: 'Thanks! Can you send the gate code for tomorrow?', at: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
      ]
    },
    {
      id: 'c2', contact_name: 'Michael Chen', company: 'Delivery Driver', channel: 'call',
      preview: 'Missed Call', unread: true, needs_reply: true,
      last_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      messages: [{ id: 'm3', direction: 'in', channel: 'call', body: 'Missed Call', at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), duration_secs: 0 }]
    },
    {
      id: 'c3', contact_name: 'Elena Rodriguez', company: null, channel: 'email',
      preview: 'Updating my contact list for the community newsletter.', unread: false, needs_reply: false,
      last_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      messages: [
        { id: 'm4', direction: 'in', channel: 'email', body: 'Hello, I just moved into unit 4B. Updating my contact list for the community newsletter. Thanks, Elena.', at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
        { id: 'm5', direction: 'out', channel: 'email', body: 'Welcome Elena! You have been added to the list.', at: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString() }
      ]
    },
    {
      id: 'c4', contact_name: 'David Kim', company: 'Kim Landscaping', channel: 'call',
      preview: 'Outbound Call (5m 20s)', unread: false, needs_reply: false,
      last_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      messages: [{ id: 'm6', direction: 'out', channel: 'call', body: 'Discussed weekly schedule', at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), duration_secs: 320 }]
    },
    {
      id: 'c5', contact_name: 'Amanda Torres', company: 'HOA Board', channel: 'text',
      preview: 'Sounds good, see you at the meeting.', unread: false, needs_reply: false,
      last_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      messages: [
        { id: 'm7', direction: 'in', channel: 'text', body: 'Are we still on for 6 PM?', at: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString() },
        { id: 'm8', direction: 'out', channel: 'text', body: 'Yes, I have the reports ready.', at: new Date(Date.now() - 1000 * 60 * 60 * 49).toISOString() },
        { id: 'm9', direction: 'in', channel: 'text', body: 'Sounds good, see you at the meeting.', at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() }
      ]
    },
    {
      id: 'c6', contact_name: 'John Smith', company: null, channel: 'email',
      preview: 'Question about parking permits', unread: true, needs_reply: true,
      last_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      messages: [{ id: 'm10', direction: 'in', channel: 'email', body: 'Hi, how do I apply for a guest parking permit for this weekend?', at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() }]
    },
    {
      id: 'c7', contact_name: 'Fast Courier Services', company: 'Vendor', channel: 'text',
      preview: 'Driver is at the north gate.', unread: false, needs_reply: false,
      last_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
      messages: [{ id: 'm11', direction: 'in', channel: 'text', body: 'Driver is at the north gate.', at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString() }]
    },
    {
      id: 'c8', contact_name: 'Rebecca Lee', company: null, channel: 'call',
      preview: 'Inbound Call (1m 15s)', unread: false, needs_reply: false,
      last_at: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
      messages: [{ id: 'm12', direction: 'in', channel: 'call', body: 'Gate access issue resolved', at: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(), duration_secs: 75 }]
    }
  ];
};
// --- Helpers ---
const formatRelativeTime = (isoString: string) => {
  const date = new Date(isoString);
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
const formatTimeOnly = (isoString: string) => new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const formatDuration = (seconds?: number) => {
  if (seconds === undefined) return '';
  if (seconds === 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};
// Email-first + calm: three quiet filters instead of a crowded channel tab-row.
const FILTERS = ['All', 'Unread', 'Needs reply'] as const;
type FilterType = typeof FILTERS[number];
// Record-type badge colors (matches the link-to-record types).
const RECORD_BADGE: Record<string, { label: string; color: string }> = {
  lead: { label: 'Lead', color: '#f59e0b' },
  customer: { label: 'Customer', color: '#34d399' },
  opportunity: { label: 'Deal', color: '#818cf8' },
  contact: { label: 'Contact', color: '#60a5fa' },
  job: { label: 'Job', color: '#2dd4bf' },
  dealer: { label: 'Dealer', color: '#a78bfa' },
};
// Bucket a conversation by day for the Today / Yesterday / Earlier list grouping.
const dayBucket = (iso: string) => {
  const d = new Date(iso); const n = new Date();
  const y = new Date(n); y.setDate(n.getDate() - 1);
  if (d.toDateString() === n.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
};
const initials = (name: string) =>
  (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '✉';
// Soft, deterministic avatar tint per contact so the list reads at a glance.
const AVATAR_TINTS = ['#6B7EFF', '#34D399', '#F59E0B', '#EC4899', '#22D3EE', '#A78BFA'];
const tintFor = (s: string) => AVATAR_TINTS[[...(s || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TINTS.length];
// Render real email HTML safely: drop scripts, global <style> (would leak into the
// app), iframes, and inline event handlers — keep inline styles so formatting shows.
// Make a plain-text email readable (5th-grader): drop the image-URL footnotes
// Gmail dumps as [https://…], collapse runaway blank lines, trim tracking junk.
const cleanPlainText = (body: string) => (body || '')
  .replace(/\[https?:\/\/[^\]]+\]/g, '')                 // [https://lh3.googleusercontent…] dumps
  .replace(/<https?:\/\/[^>]+>/g, '')                    // <https://…> angle-bracket links
  .replace(/^\s*https?:\/\/\S+\s*$/gm, '')               // bare URL-only lines
  .replace(/‌|­|​/g, '')                  // zero-width / tracking chars
  .replace(/\n{3,}/g, '\n\n')                            // collapse blank-line runs
  .trim();
const sanitizeEmailHtml = (html: string) => (html || '')
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
  .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
  .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
  .replace(/javascript:/gi, '');
// --- Main Component ---
export default function MessagesShell() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [replyText, setReplyText] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  // Run a Gmail sync and surface exactly what happened (count or error) so an
  // empty inbox is never a silent mystery.
  const runSync = React.useCallback(async () => {
    setSyncing(true); setSyncMsg(null);
    try {
      const r = await fetch('/api/nexus/messages/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inline: true }) });
      const res = await r.json().catch(() => ({}));
      if (!r.ok) { setSyncMsg(res?.error ? `Sync error: ${res.error}` : `Sync failed (${r.status})`); return; }
      if ((res?.channels ?? 0) === 0) { setSyncMsg('No email account connected yet — tap the ⚙ to connect Gmail.'); return; }
      const c = await loadConversations(); setConversations(c);
      setSyncMsg(res?.error ? `Synced with an issue: ${res.error}` : `Synced — ${res?.fetched ?? 0} new email${(res?.fetched ?? 0) === 1 ? '' : 's'}.`);
    } catch (e) {
      setSyncMsg(e instanceof Error ? `Sync error: ${e.message}` : 'Sync error.');
    } finally { setSyncing(false); }
  }, []);
  useEffect(() => {
    let cancelled = false;
    loadConversations().then(c => { if (!cancelled) setConversations(c); });
    void runSync();
    return () => { cancelled = true; };
  }, [runSync]);
  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      const matchesSearch =
        c.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.company && c.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
        c.preview.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      switch (activeFilter) {
        case 'Unread': return c.unread;
        case 'Needs reply': return c.needs_reply;
        case 'All':
        default: return true;
      }
    });
  }, [conversations, searchQuery, activeFilter]);
  const selectedConversation = conversations.find(c => c.id === selectedId);
  const [sending, setSending] = useState(false);

  // Assign-to-record picker (lead / contact / customer / opportunity / job)
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkQuery, setLinkQuery] = useState('');
  const [linkResults, setLinkResults] = useState<{ id: string; label: string; sublabel?: string; type: string }[]>([]);
  useEffect(() => {
    if (!linkOpen) return;
    let active = true;
    const t = setTimeout(async () => {
      const j = await fetch(`/api/todos/search-records?type=all&q=${encodeURIComponent(linkQuery)}`).then(r => r.json()).catch(() => ({}));
      if (active) setLinkResults(Array.isArray(j.results) ? j.results : []);
    }, 220);
    return () => { active = false; clearTimeout(t); };
  }, [linkQuery, linkOpen]);
  const patchLink = async (conv: Conversation, payload: { linked_type: string | null; linked_id?: string | null; linked_label?: string | null }) => {
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, linked_type: (payload.linked_type as LinkedType) ?? null, linked_id: payload.linked_id ?? null, linked_label: payload.linked_label ?? null } : c));
    await fetch(`/api/nexus/messages/threads/${conv.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
  };

  // Open a conversation + mark it read (clears the unread dot, Superhuman-style).
  const selectConversation = React.useCallback((id: string) => {
    setSelectedId(id);
    setConversations(prev => prev.map(c => c.id === id ? { ...c, unread: false, needs_reply: false } : c));
    void fetch(`/api/nexus/messages/threads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read: true }) }).catch(() => {});
  }, []);

  // Email signature (edited in Setup, appended server-side on send).
  const [signature, setSignature] = useState('');
  const [sigSaved, setSigSaved] = useState(false);
  useEffect(() => { if (showSetup) void fetch('/api/nexus/messages/signature').then(r => r.json()).then(j => setSignature(j.signature ?? '')).catch(() => {}); }, [showSetup]);
  const saveSignature = async () => {
    await fetch('/api/nexus/messages/signature', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signature }) }).catch(() => {});
    setSigSaved(true); setTimeout(() => setSigSaved(false), 1800);
  };

  // Keyboard navigation — j/k (or ↑/↓) to move, Esc to close. Skips when typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showSetup) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const list = filteredConversations;
      if (list.length === 0) return;
      const idx = list.findIndex(c => c.id === selectedId);
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); selectConversation(list[Math.min(list.length - 1, idx + 1)].id); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); selectConversation(list[Math.max(0, idx < 0 ? 0 : idx - 1)].id); }
      else if (e.key === 'Escape') { setSelectedId(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filteredConversations, selectedId, showSetup, selectConversation]);

  const handleSend = async () => {
    const conv = selectedConversation;
    if (!replyText.trim() || !conv) return;
    const text = replyText.trim();

    // Optimistically append; reconcile from the server on success.
    const optimistic: Message = {
      id: `tmp-${Date.now()}`, direction: 'out', channel: conv.channel, body: text,
      at: new Date().toISOString(),
    };
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, messages: [...c.messages, optimistic], preview: text, last_at: optimistic.at } : c));
    setReplyText('');

    // Only email connectors can send today (SMTP / Gmail). Calls/texts are read-only.
    if (conv.channel !== 'email' || !conv.channel_id || !conv.contact_address) return;
    setSending(true);
    try {
      await fetch('/api/nexus/messages/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: conv.channel_id,
          to: conv.contact_address,
          thread_id: conv.id,
          subject: `Re: ${conv.preview || 'Message'}`,
          text,
        }),
      });
      loadConversations().then(setConversations);
    } catch {
      /* keep optimistic message; server reload will reconcile next open */
    } finally {
      setSending(false);
    }
  };
  const glassPanel = { backgroundColor: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' };
  const textPrimary = { color: 'rgba(255,255,255,0.9)' };
  const textSecondary = { color: 'rgba(255,255,255,0.5)' };
  const textFaint = { color: 'rgba(255,255,255,0.34)' };
  const brandBlue = '#6B7EFF';
  if (showSetup) {
    return (
      <div className="w-full h-[78dvh] overflow-y-auto rounded-2xl p-4" style={{ ...textPrimary, ...glassPanel }}>
        <button onClick={() => { setShowSetup(false); loadConversations().then(setConversations); }} className="flex items-center gap-2 mb-4 px-3 py-2 rounded-full text-sm hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.7)' }}>
          <ArrowLeft size={16} /> Back to messages
        </button>
        <MessagesConnectorPane />
        {/* Email signature — appended to every email you send */}
        <div className="mt-6 rounded-2xl p-4" style={glassPanel}>
          <div className="text-sm font-semibold mb-1">Email signature</div>
          <div className="text-xs mb-3" style={textSecondary}>Added to the bottom of every email you send.</div>
          <textarea value={signature} onChange={e => setSignature(e.target.value)} rows={5} placeholder={"Russel Feldman\nGateGuard\n(555) 123-4567"} className="w-full rounded-xl px-3 py-2 text-sm bg-black/30 outline-none resize-y" style={{ ...textPrimary, border: '1px solid rgba(255,255,255,0.1)' }} />
          <button onClick={saveSignature} className="mt-3 px-4 py-2 rounded-full text-sm" style={{ backgroundColor: brandBlue, color: 'white' }}>{sigSaved ? 'Saved ✓' : 'Save signature'}</button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex w-full h-[78dvh] font-sans overflow-hidden rounded-2xl" style={{ ...textPrimary, background: '#0e0e10', border: '1px solid rgba(255,255,255,0.08)' }}>
      <style>{`.nexus-email-html img{max-width:100%!important;height:auto!important} .nexus-email-html table{max-width:100%!important} .nexus-email-html a{color:#2563eb} .nexus-email-html *{max-width:100%} @keyframes spin{to{transform:rotate(360deg)}} .hide-scrollbar::-webkit-scrollbar{display:none} .hide-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>

      {/* ── LEFT: Inbox ──────────────────────────────────────────── */}
      <div className={`w-full md:w-[320px] flex-shrink-0 flex-col border-r ${selectedId ? 'hidden md:flex' : 'flex'}`} style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#121214' }}>
        <div className="px-4 pt-4 pb-3 flex flex-col gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center justify-between">
            <h1 className="text-[15px] font-semibold tracking-tight">Inbox</h1>
            <div className="flex items-center gap-1">
              <button onClick={runSync} disabled={syncing} title="Refresh" className="p-1.5 rounded-md hover:bg-white/10 disabled:opacity-50" style={{ color: 'rgba(255,255,255,0.55)' }}>
                <span style={{ display: 'inline-block', fontSize: 15, animation: syncing ? 'spin 1s linear infinite' : 'none' }}>↻</span>
              </button>
              <button onClick={() => setShowSetup(true)} title="Connect mailbox & signature" className="p-1.5 rounded-md hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.55)' }}><Settings size={16} /></button>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Search size={14} style={textSecondary} />
            <input type="text" placeholder="Search…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent border-none outline-none text-[13px] w-full placeholder:text-white/30" style={textPrimary} />
          </div>
          <div className="flex items-center gap-1.5">
            {FILTERS.map(filter => (
              <button key={filter} onClick={() => setActiveFilter(filter)} className="px-3 py-1 rounded-full text-[12px] font-medium transition-colors" style={{ backgroundColor: activeFilter === filter ? 'rgba(99,102,241,0.18)' : 'transparent', border: activeFilter === filter ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent', color: activeFilter === filter ? '#c7d2fe' : 'rgba(255,255,255,0.5)' }}>{filter}</button>
            ))}
          </div>
          {syncMsg && <div className="text-[11px]" style={{ color: syncMsg.toLowerCase().includes('error') || syncMsg.toLowerCase().includes('issue') ? '#fca5a5' : 'rgba(255,255,255,0.45)' }}>{syncMsg}</div>}
        </div>
        <div className="flex-1 overflow-y-auto hide-scrollbar">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-sm" style={textSecondary}>No conversations found.</div>
          ) : (() => {
            const groups: { label: string; items: Conversation[] }[] = [];
            for (const c of filteredConversations) {
              const label = dayBucket(c.last_at);
              const g = groups.find(x => x.label === label);
              if (g) g.items.push(c); else groups.push({ label, items: [c] });
            }
            return groups.map(group => (
              <div key={group.label}>
                <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider sticky top-0 z-10" style={{ color: 'rgba(255,255,255,0.4)', background: '#121214', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{group.label}</div>
                {group.items.map(conv => {
                  const sel = selectedId === conv.id;
                  const badge = conv.linked_type ? RECORD_BADGE[conv.linked_type] : null;
                  const indent = conv.unread ? 16 : 0;
                  return (
                    <button key={conv.id} onClick={() => selectConversation(conv.id)} className="w-full text-left px-4 py-3 flex flex-col gap-1 transition-colors hover:bg-white/[0.03]" style={{ backgroundColor: sel ? 'rgba(99,102,241,0.10)' : 'transparent', borderLeft: sel ? '2px solid #6366f1' : '2px solid transparent' }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {conv.unread && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#6366f1' }} />}
                          <span className="truncate text-[14px]" style={{ color: conv.unread ? '#f4f4f5' : 'rgba(255,255,255,0.7)', fontWeight: conv.unread ? 700 : 500 }}>{conv.contact_name}</span>
                        </div>
                        <span className="text-[12px] flex-shrink-0" style={{ color: sel ? '#a5b4fc' : 'rgba(255,255,255,0.4)' }}>{formatRelativeTime(conv.last_at)}</span>
                      </div>
                      <div className="flex items-center gap-2 min-w-0" style={{ paddingLeft: indent }}>
                        {badge && <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide flex-shrink-0" style={{ background: `${badge.color}22`, color: badge.color, border: `1px solid ${badge.color}33` }}>{badge.label}</span>}
                        <span className="truncate text-[13px]" style={{ color: conv.unread ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)', fontWeight: conv.unread ? 500 : 400 }}>{conv.subject || conv.preview || '(no subject)'}</span>
                      </div>
                      {conv.subject && conv.preview && <span className="truncate text-[12px]" style={{ color: 'rgba(255,255,255,0.35)', paddingLeft: indent }}>{conv.preview}</span>}
                    </button>
                  );
                })}
              </div>
            ));
          })()}
        </div>
      </div>
      {/* ── CENTER: Thread ───────────────────────────────────────── */}
      <div className={`flex-1 flex-col h-full ${!selectedId ? 'hidden md:flex' : 'flex'}`} style={{ background: '#0a0a0c' }}>
        {!selectedConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4" style={glassPanel}>
              <MessageSquare size={24} style={textSecondary} />
            </div>
            <h3 className="text-lg font-medium mb-2" style={textPrimary}>Pick a conversation</h3>
            <p className="text-sm max-w-xs" style={textSecondary}>Select a message to read and reply. Use <span className="font-mono text-xs px-1 rounded" style={{ background: 'rgba(255,255,255,0.08)' }}>j</span> / <span className="font-mono text-xs px-1 rounded" style={{ background: 'rgba(255,255,255,0.08)' }}>k</span> to move.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-6 py-3 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <button onClick={() => setSelectedId(null)} className="md:hidden p-2 -ml-2 rounded-full hover:bg-white/10"><ArrowLeft size={20} /></button>
              <div className="min-w-0">
                <div className="font-semibold text-[15px] truncate tracking-tight">{selectedConversation.subject || selectedConversation.contact_name}</div>
                <div className="text-[12px] truncate" style={textSecondary}>{selectedConversation.contact_name}{selectedConversation.contact_address ? ` · ${selectedConversation.contact_address}` : ''}</div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 hide-scrollbar">
              {selectedConversation.messages.map((msg) => {
                const isCall = msg.channel === 'call';
                const isInbound = msg.direction === 'in';
                if (isCall) {
                  return (
                    <div key={msg.id} className="flex justify-center my-4">
                      <div className="px-4 py-3 rounded-2xl flex items-center gap-4 min-w-[240px]" style={glassPanel}>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: isInbound ? 'rgba(255,255,255,0.05)' : 'rgba(107,126,255,0.1)' }}>
                          {isInbound ? <PhoneMissed size={18} style={textSecondary} /> : <PhoneForwarded size={18} style={{ color: brandBlue }} />}
                        </div>
                        <div>
                          <div className="text-sm font-medium" style={textPrimary}>{isInbound ? 'Inbound Call' : 'Outbound Call'}</div>
                          <div className="text-xs flex items-center gap-2 mt-0.5" style={textSecondary}>
                            <span>{formatTimeOnly(msg.at)}</span>
                            {msg.duration_secs !== undefined && (<><span>•</span><span className="flex items-center gap-1"><Clock size={10} /> {formatDuration(msg.duration_secs)}</span></>)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                // Email → a readable letter (Front/Thunderbird style): clear From/date
                // header, full-width body with comfortable line length & spacing.
                if (msg.channel === 'email') {
                  return (
                    <div key={msg.id} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center justify-between gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: isInbound ? 'rgba(255,255,255,0.06)' : 'rgba(107,126,255,0.16)', color: isInbound ? 'rgba(255,255,255,0.6)' : '#b3bcff' }}>{isInbound ? 'Received' : 'Sent'}</span>
                          <span className="text-xs truncate" style={textSecondary}>{isInbound ? selectedConversation.contact_name : 'You'}</span>
                        </div>
                        <span className="text-[11px] flex-shrink-0" style={textFaint}>{new Date(msg.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {msg.body_html
                        ? <div className="nexus-email-html" style={{ background: '#ffffff', color: '#1a1a2e', padding: '20px 24px', fontSize: 14, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(msg.body_html) }} />
                        : <div className="px-5 py-4 text-sm" style={{ color: 'rgba(255,255,255,0.86)', lineHeight: 1.65, maxWidth: 680, whiteSpace: 'pre-wrap' }}>{cleanPlainText(msg.body)}</div>}
                    </div>
                  );
                }
                return (
                  <div key={msg.id} className={`flex flex-col max-w-[80%] ${isInbound ? 'self-start' : 'self-end'}`}>
                    <div className={`px-4 py-2.5 text-sm shadow-sm ${isInbound ? 'rounded-2xl rounded-tl-sm bg-white/10' : 'rounded-2xl rounded-tr-sm'}`} style={isInbound ? undefined : { backgroundColor: brandBlue, color: 'white' }}>
                      {msg.body}
                    </div>
                    <span className={`text-[10px] mt-1 ${isInbound ? 'ml-1' : 'mr-1 self-end'}`} style={textFaint}>{formatTimeOnly(msg.at)}</span>
                  </div>
                );
              })}
            </div>
            <div className="p-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="rounded-xl flex flex-col" style={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="flex items-center gap-2 px-4 py-2 text-[12px]" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>
                  <span className="font-semibold">Reply via:</span>
                  <span className="px-2 py-0.5 rounded capitalize" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)' }}>{selectedConversation.channel === 'email' ? 'Email' : selectedConversation.channel}</span>
                </div>
                <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void handleSend(); } }} placeholder="Type your reply… (⌘↵ to send)" className="w-full bg-transparent border-none outline-none resize-none p-4 text-[14px] placeholder:text-white/30 min-h-[72px]" style={textPrimary} />
                <div className="flex justify-between items-center px-4 py-2.5" style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="text-[11px]" style={textFaint}>Signature added automatically</span>
                  <button onClick={handleSend} disabled={!replyText.trim() || sending} className="px-4 py-1.5 rounded-md text-[13px] font-semibold flex items-center gap-2 disabled:opacity-40" style={{ background: '#6366f1', color: 'white' }}>{sending ? 'Sending…' : 'Send'} <span className="font-mono text-[10px] px-1 rounded" style={{ background: 'rgba(255,255,255,0.2)' }}>⌘↵</span></button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── RIGHT: Context ───────────────────────────────────────── */}
      {selectedConversation && (
        <div className="hidden lg:flex w-[280px] flex-shrink-0 border-l flex-col overflow-y-auto hide-scrollbar" style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#121214' }}>
          <div className="p-5 flex flex-col items-center text-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl mb-3" style={{ background: `${tintFor(selectedConversation.contact_name)}22`, color: tintFor(selectedConversation.contact_name) }}>{initials(selectedConversation.contact_name)}</div>
            <h3 className="font-bold text-[15px]">{selectedConversation.contact_name}</h3>
            {selectedConversation.contact_address && <p className="text-[12px] mt-0.5 break-all" style={textSecondary}>{selectedConversation.contact_address}</p>}
          </div>
          <div className="p-4 flex flex-col gap-5">
            {/* Link to record — lead / contact / customer / opportunity / job */}
            <div className="relative">
              <div className="flex justify-between items-center mb-2">
                <div className="text-[11px] font-bold uppercase tracking-wider" style={textSecondary}>Linked record</div>
                {selectedConversation.linked_label && <button onClick={() => void patchLink(selectedConversation, { linked_type: null })} className="text-[11px]" style={{ color: '#fca5a5' }}>Unlink</button>}
              </div>
              {selectedConversation.linked_label ? (
                <div className="p-3 rounded-lg flex items-center gap-2" style={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {(() => { const b = selectedConversation.linked_type ? RECORD_BADGE[selectedConversation.linked_type] : null; return b ? <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase flex-shrink-0" style={{ background: `${b.color}22`, color: b.color }}>{b.label}</span> : null; })()}
                  <span className="font-semibold text-[13px] truncate">{selectedConversation.linked_label}</span>
                </div>
              ) : (
                <button onClick={() => setLinkOpen(o => !o)} className="w-full px-3 py-2 rounded-lg text-[13px] text-left" style={{ background: '#18181b', border: '1px dashed rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)' }}>+ Link to lead, deal, customer, job…</button>
              )}
              {linkOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl p-2" style={{ background: '#161620', border: '1px solid rgba(99,102,241,0.3)' }}>
                  <input autoFocus value={linkQuery} onChange={e => setLinkQuery(e.target.value)} placeholder="Search…" className="w-full rounded-lg px-3 py-2 text-sm bg-black/30 outline-none mb-2" style={{ ...textPrimary, border: '1px solid rgba(255,255,255,0.1)' }} />
                  <div className="max-h-56 overflow-y-auto flex flex-col gap-1 hide-scrollbar">
                    {linkResults.map(r => (
                      <button key={`${r.type}-${r.id}`} onClick={() => { void patchLink(selectedConversation, { linked_type: r.type, linked_id: r.id, linked_label: r.label }); setLinkOpen(false); setLinkQuery(''); }} className="text-left px-2 py-1.5 rounded-lg hover:bg-white/5">
                        <div className="text-[13px]">{r.label}</div>
                        <div className="text-[11px]" style={textFaint}>{r.type}{r.sublabel ? ` · ${r.sublabel}` : ''}</div>
                      </button>
                    ))}
                    {linkResults.length === 0 && <div className="px-2 py-1.5 text-xs" style={textFaint}>{linkQuery ? 'No matches.' : 'Type to search.'}</div>}
                  </div>
                </div>
              )}
            </div>
            {/* Channel */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={textSecondary}>Channel</div>
              <span className="px-2 py-1 rounded text-[12px] capitalize" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)' }}>{selectedConversation.channel}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
