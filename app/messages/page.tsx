"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Send, RefreshCw, Search, Plus, Settings, X } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const {
  MessageCircle, Mail, PhoneCall, Lock, Calendar,
  ChevronRight, Shield, Video, Phone, MoreVertical,
  ArrowLeft, Inbox, Users,
} = require("lucide-react") as any;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Channel {
  id: string;
  channel_type: "gmail" | "smtp" | "caldav" | "phone" | "twilio" | "internal";
  display_name: string;
  is_active: boolean;
  last_synced_at: string | null;
}

interface ThreadParticipant { name?: string; address: string; }

interface Thread {
  id: string;
  channel_id: string;
  subject: string | null;
  participants: ThreadParticipant[];
  last_message_at: string | null;
  unread_count: number;
  linked_wo_id: string | null;
  linked_quote_id: string | null;
  message_channels: { channel_type: string; display_name: string } | null;
  messages: { id: string; body: string; direction: string; from_name: string | null; sent_at: string | null; created_at: string }[];
}

interface Message {
  id: string;
  direction: "inbound" | "outbound";
  source_type: string;
  from_address: string;
  from_name: string | null;
  body: string;
  body_html: string | null;
  status: string;
  sent_at: string | null;
  created_at: string;
}

type NavSection = "overview" | "inbox" | "messages" | "pwa" | "settings";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(ts: string | null): string {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60)    return "now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function threadName(thread: Thread): string {
  if (thread.subject) return thread.subject;
  const p = thread.participants[0];
  if (!p) return "Unknown";
  return p.name ?? p.address;
}

function threadPreview(thread: Thread): string {
  const last = thread.messages?.[thread.messages.length - 1];
  if (!last) return "No messages yet";
  return last.body.slice(0, 80);
}

// ─── Channel badge icons (SVG) ────────────────────────────────────────────────

function GmailBadge() {
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#fff", border: "1px solid #f1f3f4" }}>
      <svg width="14" height="14" viewBox="0 0 24 24">
        <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.907 1.528-1.147C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
      </svg>
    </div>
  );
}

function SmsBadge() {
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#e8f5e9", border: "1px solid #c8e6c9" }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: "#2e7d32", letterSpacing: 0 }}>SMS</span>
    </div>
  );
}

function OutlookBadge() {
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#e3f2fd", border: "1px solid #bbdefb" }}>
      <svg width="14" height="14" viewBox="0 0 24 24">
        <path d="M24 7.387v10.478L19.2 21V9.6L24 7.387zM14.4 3l9.6 4.387-9.6 4.373-9.6-4.373L14.4 3zM0 7.387L4.8 9.6V21L0 17.865V7.387zM14.4 12.76L4.8 8.4v11.4l9.6 4.2 9.6-4.2V8.4l-9.6 4.36z" fill="#0078D4"/>
      </svg>
    </div>
  );
}

function InternalBadge() {
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#ede8ff", border: "1px solid #d4c9ff" }}>
      <Lock size={11} style={{ color: "#6B7EFF" }} />
    </div>
  );
}

function ChannelBadgeFor({ type }: { type: string }) {
  if (type === "gmail")    return <GmailBadge />;
  if (type === "twilio" || type === "phone") return <SmsBadge />;
  if (type === "smtp")     return <OutlookBadge />;
  if (type === "internal") return <InternalBadge />;
  return <InternalBadge />;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  const colors = ["#6B7EFF","#EA580C","#15803d","#854F0B","#185FA5","#993556"];
  const color  = colors[name.charCodeAt(0) % colors.length];
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-semibold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

// ─── Left messenger nav ───────────────────────────────────────────────────────

function MessengerNav({
  section,
  setSection,
  totalUnread,
  channels,
}: {
  section: NavSection;
  setSection: (s: NavSection) => void;
  totalUnread: number;
  channels: Channel[];
}) {
  const router = useRouter();
  const navItem = (key: NavSection, label: string, icon: React.ReactNode) => (
    <button
      key={key}
      onClick={() => setSection(key)}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left transition-all text-sm"
      style={
        section === key
          ? { background: "linear-gradient(135deg, #6B7EFF 0%, #8b5cf6 100%)", color: "#fff", fontWeight: 600 }
          : { color: "#374151", fontWeight: 400 }
      }
    >
      {icon}
      <span className="flex-1">{label}</span>
      {key === "inbox" && totalUnread > 0 && (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
          style={section === key ? { background: "rgba(255,255,255,0.25)", color: "#fff" } : { background: "#ede8ff", color: "#6B7EFF" }}>
          {totalUnread}
        </span>
      )}
    </button>
  );

  return (
    <div className="flex flex-col h-full" style={{ width: 220, background: "#fff", borderRight: "1px solid #f0f0f0" }}>
      {/* Brand header */}
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

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* Unified Inbox */}
        <div>
          <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Unified Inbox</p>
          <div className="space-y-0.5">
            {navItem("overview", "Overview", <Inbox size={14} />)}
            {navItem("inbox", "Inbox", <MessageCircle size={14} />)}
          </div>
        </div>

        {/* Org Chat */}
        <div>
          <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Org Chat</p>
          <div className="space-y-0.5">
            {navItem("messages", "Messages", <Users size={14} />)}
            {navItem("pwa", "PWA Messenger", <Shield size={14} />)}
          </div>
        </div>

        {/* Create Thread */}
        <button
          onClick={() => setSection("messages")}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "#111827" }}
        >
          <Plus size={13} />
          New Thread
        </button>

        {/* System Settings */}
        <div>
          <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">System Settings</p>
          <button
            onClick={() => router.push("/messages/settings")}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left text-sm transition-all"
            style={{ color: "#374151" }}
          >
            <Settings size={14} />
            Channel Management
          </button>
        </div>

        {/* Connected channels */}
        {channels.filter((c) => c.is_active).length > 0 && (
          <div>
            <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Connected</p>
            {channels.filter((c) => c.is_active).map((ch) => (
              <div key={ch.id} className="flex items-center gap-2 px-3 py-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-xs text-gray-500 truncate">{ch.display_name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Inbox card ───────────────────────────────────────────────────────────────

function InboxCard({ thread, onClick }: { thread: Thread; onClick: () => void }) {
  const name    = threadName(thread);
  const preview = threadPreview(thread);
  const type    = (thread.message_channels as unknown as { channel_type: string } | null)?.channel_type ?? "internal";

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-4 transition-all hover:shadow-md active:scale-[0.99] relative"
      style={{ background: "#fff", boxShadow: "0 1px 4px rgba(107,126,255,0.08), 0 0 0 1px rgba(107,126,255,0.06)" }}
    >
      {/* Channel badge — top right */}
      <div className="absolute top-3 right-3">
        <ChannelBadgeFor type={type} />
      </div>

      <div className="flex items-start gap-3 pr-10">
        <Avatar name={name} size={38} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-sm font-semibold text-gray-900 truncate">{name}</span>
            <span className="text-[10px] text-gray-400 whitespace-nowrap ml-auto">{timeAgo(thread.last_message_at)}</span>
          </div>
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{preview}</p>
          {thread.unread_count > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#6B7EFF]" />
              <span className="text-[10px] font-semibold text-[#6B7EFF]">{thread.unread_count} unread</span>
            </div>
          )}
          {(thread.linked_wo_id || thread.linked_quote_id) && (
            <div className="mt-1.5 flex gap-1.5">
              {thread.linked_wo_id && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#fff7ed", color: "#ea580c" }}>WO linked</span>
              )}
              {thread.linked_quote_id && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#ede8ff", color: "#6B7EFF" }}>Quote linked</span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Thread list item (dark panel) ───────────────────────────────────────────

function ThreadItem({ thread, active, onClick }: { thread: Thread; active: boolean; onClick: () => void }) {
  const name    = threadName(thread);
  const preview = threadPreview(thread);

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors"
      style={{ background: active ? "rgba(107,126,255,0.15)" : "transparent" }}
    >
      <Avatar name={name} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1 mb-0.5">
          <span className="text-sm font-semibold truncate" style={{ color: active ? "#a8b4ff" : "#e5e7eb" }}>{name}</span>
          <span className="text-[10px] ml-auto whitespace-nowrap" style={{ color: "#6b7280" }}>{timeAgo(thread.last_message_at)}</span>
        </div>
        <p className="text-xs truncate" style={{ color: "#9ca3af" }}>{preview}</p>
      </div>
      {thread.unread_count > 0 && (
        <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0 mt-0.5" style={{ background: "#6B7EFF" }}>
          {thread.unread_count}
        </div>
      )}
    </button>
  );
}

// ─── Conversation panel ───────────────────────────────────────────────────────

function ConversationPanel({
  thread,
  messages,
  onBack,
  onSend,
  sending,
}: {
  thread: Thread;
  messages: Message[];
  onBack: () => void;
  onSend: (body: string) => Promise<void>;
  sending: boolean;
}) {
  const [reply, setReply] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const name = threadName(thread);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const body = reply.trim();
    if (!body || sending) return;
    setReply("");
    await onSend(body);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: "#f9fafb" }}>
      {/* Secure banner */}
      <div className="flex items-center gap-2 px-4 py-2" style={{ background: "#1a7340" }}>
        <Shield size={13} style={{ color: "#86efac" }} />
        <span className="text-xs font-semibold" style={{ color: "#86efac" }}>Secure Organization Network</span>
      </div>

      {/* Conversation header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "#e5e7eb", background: "#fff" }}>
        <button onClick={onBack} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} className="text-gray-500" />
        </button>
        <Avatar name={name} size={34} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
          <p className="text-[10px] text-gray-400">
            {thread.participants.map((p) => p.name ?? p.address).join(", ")}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><Phone size={14} className="text-gray-500" /></button>
          <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><Video size={14} className="text-gray-500" /></button>
          <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><MoreVertical size={14} className="text-gray-500" /></button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
            <MessageCircle size={32} style={{ opacity: 0.3 }} />
            <p className="text-sm">No messages yet — start the conversation.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOut = msg.direction === "outbound";
            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isOut ? "flex-row-reverse" : "flex-row"}`}>
                {!isOut && <Avatar name={msg.from_name ?? "?"} size={28} />}
                <div
                  className="max-w-[70%] rounded-2xl px-3.5 py-2.5"
                  style={
                    isOut
                      ? { background: "#6B7EFF", color: "#fff" }
                      : { background: "#fff", color: "#111827", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "0.5px solid #f0f0f0" }
                  }
                >
                  {!isOut && msg.from_name && (
                    <p className="text-[10px] font-semibold mb-0.5" style={{ color: "#6B7EFF" }}>{msg.from_name}</p>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                  <p className={`text-[10px] mt-1 ${isOut ? "text-white/60" : "text-gray-400"}`}>
                    {timeAgo(msg.sent_at ?? msg.created_at)}
                    {msg.status === "failed" && <span className="ml-1 text-red-400">• Failed</span>}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply bar */}
      <div className="px-4 py-3 border-t" style={{ borderColor: "#e5e7eb", background: "#fff" }}>
        <div className="flex items-end gap-2 rounded-xl px-3 py-2.5" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type a message…"
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none outline-none"
            style={{ maxHeight: 120 }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
            }}
          />
          <button
            onClick={() => { void handleSend(); }}
            disabled={!reply.trim() || sending}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0"
            style={reply.trim() ? { background: "#6B7EFF", color: "#fff" } : { background: "#e5e7eb", color: "#9ca3af" }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Overview panel ───────────────────────────────────────────────────────────

function OverviewPanel({ threads, channels, onSelectThread }: { threads: Thread[]; channels: Channel[]; onSelectThread: (t: Thread) => void }) {
  const totalUnread = threads.reduce((a, t) => a + t.unread_count, 0);
  const connected   = channels.filter((c) => c.is_active).length;

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Unified Inbox</h2>
      <p className="text-sm text-gray-500 mb-6">All your channels in one place</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Unread", value: totalUnread, color: "#6B7EFF" },
          { label: "Threads", value: threads.length, color: "#15803d" },
          { label: "Channels", value: connected, color: "#EA580C" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recent threads */}
      <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Recent</p>
      <div className="space-y-2">
        {threads.slice(0, 5).map((t) => (
          <InboxCard key={t.id} thread={t} onClick={() => onSelectThread(t)} />
        ))}
        {threads.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <MessageCircle size={32} style={{ margin: "0 auto 8px", opacity: 0.3 }} />
            <p className="text-sm">No messages yet. Connect a channel to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const [section, setSection]           = useState<NavSection>("inbox");
  const [channels, setChannels]         = useState<Channel[]>([]);
  const [threads, setThreads]           = useState<Thread[]>([]);
  const [loading, setLoading]           = useState(true);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages]         = useState<Message[]>([]);
  const [sending, setSending]           = useState(false);
  const [searchQ, setSearchQ]           = useState("");
  const [searching, setSearching]       = useState(false);

  const totalUnread = threads.reduce((a, t) => a + t.unread_count, 0);

  // ── Load channels ────────────────────────────────────────────────────────────
  const loadChannels = useCallback(async () => {
    try {
      const res = await fetch("/api/messages/channels");
      if (res.ok) {
        const d = await res.json() as { channels: Channel[] };
        setChannels(d.channels ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  // ── Load threads ─────────────────────────────────────────────────────────────
  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/messages/threads?limit=50");
      if (res.ok) {
        const d = await res.json() as { threads: Thread[] };
        setThreads(d.threads ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadChannels();
    void loadThreads();
  }, [loadChannels, loadThreads]);

  // ── Open thread ──────────────────────────────────────────────────────────────
  async function openThread(thread: Thread) {
    setActiveThread(thread);
    setSection("messages");
    try {
      const res = await fetch(`/api/messages/threads/${thread.id}`);
      if (res.ok) {
        const d = await res.json() as { thread: Thread; messages: Message[] };
        setMessages(d.messages ?? []);
        setThreads((prev) => prev.map((t) => t.id === thread.id ? { ...t, unread_count: 0 } : t));
      }
    } catch { /* ignore */ }
  }

  // ── Send message ─────────────────────────────────────────────────────────────
  async function handleSend(body: string) {
    if (!activeThread || sending) return;
    setSending(true);
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      direction: "outbound",
      source_type: activeThread.message_channels?.channel_type ?? "internal",
      from_address: "me",
      from_name: "You",
      body,
      body_html: null,
      status: "pending",
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: activeThread.id, body }),
      });
      if (res.ok) {
        const d = await res.json() as { message: Message };
        setMessages((prev) => prev.map((m) => m.id === optimistic.id ? { ...d.message, direction: "outbound" } : m));
      } else {
        setMessages((prev) => prev.map((m) => m.id === optimistic.id ? { ...m, status: "failed" } : m));
      }
    } catch {
      setMessages((prev) => prev.map((m) => m.id === optimistic.id ? { ...m, status: "failed" } : m));
    }
    setSending(false);
  }

  // ── Filtered threads ─────────────────────────────────────────────────────────
  const filtered = searchQ
    ? threads.filter((t) =>
        threadName(t).toLowerCase().includes(searchQ.toLowerCase()) ||
        threadPreview(t).toLowerCase().includes(searchQ.toLowerCase())
      )
    : threads;

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f8fafc" }}>
      {/* Left messenger nav */}
      <MessengerNav
        section={section}
        setSection={setSection}
        totalUnread={totalUnread}
        channels={channels}
      />

      {/* Main content area */}
      <div className="flex-1 flex min-w-0">

        {/* ── OVERVIEW ── */}
        {section === "overview" && (
          <div className="flex-1" style={{ background: "linear-gradient(135deg, #f0ebff 0%, #e8e0f5 50%, #ede8f8 100%)" }}>
            <OverviewPanel threads={threads} channels={channels} onSelectThread={openThread} />
          </div>
        )}

        {/* ── INBOX ── */}
        {section === "inbox" && (
          <div className="flex-1 flex flex-col min-h-0" style={{ background: "linear-gradient(135deg, #f0ebff 0%, #e8e0f5 50%, #ede8f8 100%)" }}>
            {/* Inbox toolbar */}
            <div className="px-6 pt-5 pb-3 flex items-center gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Inbox</h2>
                <p className="text-xs text-gray-500">{threads.length} conversations · {totalUnread} unread</p>
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/70 backdrop-blur" style={{ border: "1px solid rgba(107,126,255,0.15)" }}>
                <Search size={13} className="text-gray-400" />
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Search…"
                  className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none w-36"
                />
                {searchQ && <button onClick={() => setSearchQ("")}><X size={12} className="text-gray-400" /></button>}
              </div>
              <button
                onClick={() => { void loadThreads(); }}
                className="p-2 rounded-xl bg-white/70 backdrop-blur hover:bg-white transition-colors"
                style={{ border: "1px solid rgba(107,126,255,0.15)" }}
              >
                <RefreshCw size={13} className="text-gray-500" />
              </button>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.6)" }} />
                ))
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-60 gap-3">
                  <MessageCircle size={36} style={{ color: "rgba(107,126,255,0.3)" }} />
                  <p className="text-sm text-gray-500">
                    {searchQ ? "No results" : "No messages yet — connect a channel in Settings."}
                  </p>
                </div>
              ) : (
                filtered.map((t) => (
                  <InboxCard key={t.id} thread={t} onClick={() => openThread(t)} />
                ))
              )}
            </div>
          </div>
        )}

        {/* ── MESSAGES (thread list + conversation) ── */}
        {section === "messages" && (
          <div className="flex-1 flex min-h-0 min-w-0">
            {/* Dark thread list */}
            <div className="flex flex-col" style={{ width: 300, background: "#111827", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
              {/* Thread list header */}
              <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <p className="text-sm font-bold text-white mb-2">Org Chat</p>
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <Search size={12} style={{ color: "#6b7280" }} />
                  <input
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="Search threads…"
                    className="bg-transparent text-xs outline-none flex-1"
                    style={{ color: "#d1d5db" }}
                  />
                </div>
              </div>
              {/* Thread items */}
              <div className="flex-1 overflow-y-auto py-1">
                {filtered.map((t) => (
                  <ThreadItem
                    key={t.id}
                    thread={t}
                    active={activeThread?.id === t.id}
                    onClick={() => openThread(t)}
                  />
                ))}
                {filtered.length === 0 && (
                  <div className="flex flex-col items-center py-10 gap-2">
                    <MessageCircle size={28} style={{ color: "rgba(255,255,255,0.15)" }} />
                    <p className="text-xs" style={{ color: "#6b7280" }}>No threads yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Conversation or empty state */}
            {activeThread ? (
              <ConversationPanel
                thread={activeThread}
                messages={messages}
                onBack={() => setActiveThread(null)}
                onSend={handleSend}
                sending={sending}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ background: "#f9fafb" }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "#ede8ff" }}>
                  <MessageCircle size={28} style={{ color: "#6B7EFF" }} />
                </div>
                <p className="text-sm font-semibold text-gray-700">Select a conversation</p>
                <p className="text-xs text-gray-400">Choose a thread from the list to start messaging</p>
              </div>
            )}
          </div>
        )}

        {/* ── PWA ── */}
        {section === "pwa" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ background: "linear-gradient(135deg, #f0ebff 0%, #e8e0f5 100%)" }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6B7EFF 0%, #8b5cf6 100%)" }}>
              <Shield size={32} className="text-white" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">GG Messenger PWA</p>
              <p className="text-sm text-gray-500 mt-1">Install on your device for WhatsApp-style org chat</p>
            </div>
            <a
              href="/pwa/messenger"
              target="_blank"
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "#6B7EFF" }}
            >
              Open PWA Messenger →
            </a>
          </div>
        )}

      </div>
    </div>
  );
}
