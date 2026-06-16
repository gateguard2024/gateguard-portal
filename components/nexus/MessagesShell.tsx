'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Phone, MessageSquare, Mail, Send, CheckCircle2, User, Clock, Settings } from 'lucide-react';
import MessagesConnectorPane from '@/components/nexus/MessagesConnectorPane';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowLeft, CalendarPlus, PhoneForwarded, PhoneMissed } = require('lucide-react') as any;
// --- Types ---
type Channel = 'call' | 'text' | 'email';
type Message = {
  id: string;
  direction: 'in' | 'out';
  channel: Channel;
  body: string;
  at: string;
  duration_secs?: number;
};
type Conversation = {
  id: string;
  contact_name: string;
  company?: string | null;
  channel: Channel;
  preview: string;
  unread: boolean;
  needs_reply: boolean;
  last_at: string;
  messages: Message[];
  channel_id?: string | null;     // connector this thread belongs to (for replies)
  contact_address?: string | null; // recipient email/phone (for replies)
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
const getChannelIcon = (channel: Channel, size = 16) => {
  switch (channel) {
    case 'call': return <Phone size={size} />;
    case 'text': return <MessageSquare size={size} />;
    case 'email': return <Mail size={size} />;
  }
};
const FILTERS = ['All', 'Needs Reply', 'Calls', 'Texts', 'Email', 'Follow-ups'] as const;
type FilterType = typeof FILTERS[number];
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
        case 'Needs Reply': return c.needs_reply;
        case 'Calls': return c.channel === 'call';
        case 'Texts': return c.channel === 'text';
        case 'Email': return c.channel === 'email';
        case 'Follow-ups': return c.needs_reply;
        case 'All':
        default: return true;
      }
    });
  }, [conversations, searchQuery, activeFilter]);
  const selectedConversation = conversations.find(c => c.id === selectedId);
  const [sending, setSending] = useState(false);
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
  const handleAction = (action: string) => { console.log(`Action triggered: ${action} for conversation ${selectedId}`); };
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
      </div>
    );
  }
  return (
    <div className="flex w-full h-[78dvh] pb-4 font-sans overflow-hidden rounded-2xl" style={{ ...textPrimary, ...glassPanel }}>
      {/* LEFT PANE: List */}
      <div className={`w-full md:w-[360px] flex-shrink-0 flex-col border-r ${selectedId ? 'hidden md:flex' : 'flex'}`} style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight">Messages</h1>
            <div className="flex items-center gap-1">
              <button onClick={runSync} disabled={syncing} title="Refresh" className="p-2 rounded-full hover:bg-white/10 disabled:opacity-50" style={{ color: 'rgba(255,255,255,0.6)' }}>
                <span style={{ display: 'inline-block', fontSize: 16, animation: syncing ? 'spin 1s linear infinite' : 'none' }}>↻</span>
              </button>
              <button onClick={() => setShowSetup(true)} title="Connect mailboxes" className="p-2 rounded-full hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.6)' }}><Settings size={18} /></button>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl" style={glassPanel}>
            <Search size={16} style={textSecondary} />
            <input type="text" placeholder="Search conversations..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full placeholder:text-white/30" style={textPrimary} />
          </div>
          {syncMsg && <div className="text-[11px] px-1" style={{ color: syncMsg.toLowerCase().includes('error') || syncMsg.toLowerCase().includes('issue') ? '#fca5a5' : 'rgba(255,255,255,0.5)' }}>{syncMsg}</div>}
        </div>
        <div className="px-4 pb-2 overflow-x-auto flex items-center gap-2">
          {FILTERS.map(filter => (
            <button key={filter} onClick={() => setActiveFilter(filter)} className="px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors" style={{ backgroundColor: activeFilter === filter ? 'rgba(255,255,255,0.1)' : 'transparent', border: activeFilter === filter ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent', color: activeFilter === filter ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)' }}>
              {filter}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-sm" style={textSecondary}>No conversations found.</div>
          ) : (
            filteredConversations.map(conv => (
              <button key={conv.id} onClick={() => setSelectedId(conv.id)} className="w-full text-left p-3 rounded-2xl mb-1 flex items-start gap-3 transition-colors hover:bg-white/5" style={{ backgroundColor: selectedId === conv.id ? 'rgba(255,255,255,0.06)' : 'transparent' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={glassPanel}>
                  <div style={{ color: brandBlue }}>{getChannelIcon(conv.channel, 18)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-medium truncate text-sm">{conv.contact_name}</span>
                    <span className="text-xs flex-shrink-0" style={conv.unread ? { color: brandBlue, fontWeight: 600 } : textFaint}>{formatRelativeTime(conv.last_at)}</span>
                  </div>
                  {conv.company && <div className="text-xs mb-1 truncate" style={textFaint}>{conv.company}</div>}
                  <div className="flex items-center gap-2">
                    <span className="text-xs truncate flex-1" style={conv.unread ? textPrimary : textSecondary}>{conv.preview}</span>
                    {conv.unread && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: brandBlue }} />}
                  </div>
                  {conv.needs_reply && <div className="mt-2 inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#34D399' }}>Needs Reply</div>}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
      {/* RIGHT PANE: Thread Area */}
      <div className={`flex-1 flex-col h-full bg-black/20 ${!selectedId ? 'hidden md:flex' : 'flex'}`}>
        {!selectedConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4" style={glassPanel}>
              <MessageSquare size={24} style={textSecondary} />
            </div>
            <h3 className="text-lg font-medium mb-2" style={textPrimary}>Pick a conversation</h3>
            <p className="text-sm max-w-xs" style={textSecondary}>Select a message from the list to read and reply.</p>
          </div>
        ) : (
          <>
            <div className="h-16 flex items-center justify-between px-4 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedId(null)} className="md:hidden p-2 -ml-2 rounded-full hover:bg-white/10"><ArrowLeft size={20} /></button>
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={glassPanel}>{getChannelIcon(selectedConversation.channel, 16)}</div>
                <div>
                  <div className="font-medium text-sm flex items-center gap-2">{selectedConversation.contact_name}</div>
                  {selectedConversation.company && <div className="text-xs" style={textSecondary}>{selectedConversation.company}</div>}
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
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
            <div className="p-4 flex-shrink-0" style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-2 mb-3 overflow-x-auto">
                <button onClick={() => handleAction('Mark Replied')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors hover:bg-white/10" style={glassPanel}><CheckCircle2 size={12} /> Mark replied</button>
                <button onClick={() => handleAction('Add Follow-up')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors hover:bg-white/10" style={glassPanel}><CalendarPlus size={12} /> Add follow-up</button>
                <button onClick={() => handleAction('Open Contact')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors hover:bg-white/10" style={glassPanel}><User size={12} /> Open contact</button>
              </div>
              <div className="flex items-end gap-2 p-2 rounded-3xl" style={glassPanel}>
                <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={`Reply by ${selectedConversation.channel}...`} className="flex-1 bg-transparent border-none outline-none resize-none px-3 py-2 text-sm max-h-32 min-h-[40px] placeholder:text-white/30" style={textPrimary} rows={1} />
                <button onClick={handleSend} disabled={!replyText.trim() || sending} className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity disabled:opacity-30" style={{ backgroundColor: brandBlue, color: 'white' }}><Send size={16} className="ml-0.5" /></button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
