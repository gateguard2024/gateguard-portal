"use client";

import { useState, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Send, RefreshCw, Settings, Search, Plus } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { MessageCircle, Inbox, PhoneCall, Mail, Calendar, Lock, Filter } = require("lucide-react") as any;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Channel {
  id: string;
  channel_type: "gmail" | "smtp" | "caldav" | "phone" | "twilio" | "internal";
  display_name: string;
  is_active: boolean;
  last_synced_at: string | null;
}

interface ThreadParticipant {
  name?: string;
  address: string;
}

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
  messages: { id: string; body: string; direction: string; from_name: string | null; created_at: string }[];
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHANNEL_ICON: Record<string, React.ElementType> = {
  gmail:    Mail,
  smtp:     Mail,
  caldav:   Calendar,
  phone:    PhoneCall,
  twilio:   PhoneCall,
  internal: Lock,
};

const CHANNEL_COLOR: Record<string, string> = {
  gmail:    "#EA4335",
  smtp:     "#185FA5",
  caldav:   "#15803d",
  phone:    "#854F0B",
  twilio:   "#EF9F27",
  internal: "#6B7EFF",
};

function ChannelBadge({ type, small }: { type: string; small?: boolean }) {
  const color = CHANNEL_COLOR[type] ?? "#6B7EFF";
  const labels: Record<string, string> = {
    gmail: "Gmail", smtp: "Email", caldav: "CalDAV",
    phone: "SMS", twilio: "Twilio", internal: "Org",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold uppercase tracking-wide ${small ? "text-[8px] px-1.5 py-0.5" : "text-[9px] px-2 py-0.5"}`}
      style={{ background: color + "18", color }}
    >
      {labels[type] ?? type}
    </span>
  );
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const colors   = ["#6B7EFF", "#EA580C", "#15803d", "#7c3aed", "#0F6E56", "#854F0B"];
  const idx      = name.charCodeAt(0) % colors.length;
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold shrink-0"
      style={{ width: size, height: size, background: colors[idx] + "22", color: colors[idx], fontSize: size * 0.35 }}
    >
      {initials || "?"}
    </div>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const [channels, setChannels]             = useState<Channel[]>([]);
  const [threads, setThreads]               = useState<Thread[]>([]);
  const [activeThread, setActiveThread]     = useState<Thread | null>(null);
  const [messages, setMessages]             = useState<Message[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | "all">("all");
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [reply, setReply]                   = useState("");
  const [sending, setSending]               = useState(false);
  const [search, setSearch]                 = useState("");

  // ── Load channels ──────────────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/messages/channels");
        if (res.ok) {
          const d = await res.json() as { channels: Channel[] };
          setChannels(d.channels ?? []);
        }
      } catch (_) {}
    })();
  }, []);

  // ── Load threads ───────────────────────────────────────────────────────────
  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (activeChannelId !== "all") params.set("channel_id", activeChannelId);
      const res = await fetch(`/api/messages/threads?${params}`);
      if (res.ok) {
        const d = await res.json() as { threads: Thread[] };
        setThreads(d.threads ?? []);
      }
    } catch (_) {} finally {
      setLoadingThreads(false);
    }
  }, [activeChannelId]);

  useEffect(() => { void loadThreads(); }, [loadThreads]);

  // ── Open thread ────────────────────────────────────────────────────────────
  async function openThread(thread: Thread) {
    setActiveThread(thread);
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/messages/threads/${thread.id}`);
      if (res.ok) {
        const d = await res.json() as { messages: Message[] };
        setMessages(d.messages ?? []);
        // Mark unread → 0 locally
        setThreads((prev) => prev.map((t) => t.id === thread.id ? { ...t, unread_count: 0 } : t));
      }
    } catch (_) {} finally {
      setLoadingMessages(false);
    }
  }

  // ── Send reply ─────────────────────────────────────────────────────────────
  async function sendReply() {
    if (!reply.trim() || !activeThread) return;
    setSending(true);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: activeThread.id, body: reply }),
      });
      if (res.ok) {
        const d = await res.json() as { message: Message };
        setMessages((prev) => [...prev, d.message]);
        setReply("");
      }
    } catch (_) {} finally {
      setSending(false);
    }
  }

  // ── Filtered threads ───────────────────────────────────────────────────────
  const filteredThreads = threads.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.subject?.toLowerCase().includes(q) ||
      t.participants.some((p) => p.name?.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)) ||
      t.messages?.[0]?.body?.toLowerCase().includes(q)
    );
  });

  const totalUnread = threads.reduce((n, t) => n + t.unread_count, 0);

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC]">
      <TopBar
        title="Messages"
        subtitle="Unified inbox — SMS, email, CalDAV, and org chat"
      />

      <div className="flex flex-1 min-h-0">
        {/* ── Channel sidebar ───────────────────────────────────────────────── */}
        <div className="w-52 border-r border-border bg-white flex flex-col py-2">
          <button
            onClick={() => setActiveChannelId("all")}
            className={`flex items-center gap-2.5 px-3 py-2 mx-2 rounded-lg text-xs font-medium transition-colors ${
              activeChannelId === "all"
                ? "bg-[#6B7EFF]/10 text-[#6B7EFF]"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            <Inbox size={14} />
            All messages
            {totalUnread > 0 && (
              <span className="ml-auto text-[9px] font-bold bg-[#6B7EFF] text-white px-1.5 py-0.5 rounded-full">
                {totalUnread}
              </span>
            )}
          </button>

          {channels.length > 0 && (
            <>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide px-3 mt-3 mb-1">
                Channels
              </p>
              {channels.map((ch) => {
                const Icon  = CHANNEL_ICON[ch.channel_type] ?? MessageCircle;
                const color = CHANNEL_COLOR[ch.channel_type] ?? "#6B7EFF";
                const unread = threads.filter((t) => t.channel_id === ch.id).reduce((n, t) => n + t.unread_count, 0);
                return (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChannelId(ch.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 mx-2 rounded-lg text-xs font-medium transition-colors ${
                      activeChannelId === ch.id
                        ? "bg-[#6B7EFF]/10 text-[#6B7EFF]"
                        : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <Icon size={13} style={{ color }} />
                    <span className="truncate flex-1 text-left">{ch.display_name}</span>
                    {unread > 0 && (
                      <span className="text-[9px] font-bold" style={{ color }}>{unread}</span>
                    )}
                  </button>
                );
              })}
            </>
          )}

          <div className="mt-auto px-3 py-3 border-t border-border">
            <a
              href="/messages/settings"
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings size={13} />
              Channel settings
            </a>
          </div>
        </div>

        {/* ── Thread list ───────────────────────────────────────────────────── */}
        <div className="w-72 border-r border-border bg-white flex flex-col">
          <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-border rounded-lg px-2.5 py-1.5">
              <Search size={12} className="text-muted-foreground shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search threads…"
                className="flex-1 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <button
              onClick={() => { void loadThreads(); }}
              className="p-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
            >
              <RefreshCw size={12} className="text-muted-foreground" />
            </button>
            <a
              href="/messages/settings"
              className="p-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
            >
              <Plus size={12} className="text-muted-foreground" />
            </a>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingThreads ? (
              <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
                Loading…
              </div>
            ) : filteredThreads.length === 0 ? (
              <EmptyState
                icon={<MessageCircle size={24} className="text-muted-foreground" />}
                title="No messages"
                description="Connect a channel in settings to see messages here."
              />
            ) : (
              filteredThreads.map((thread) => {
                const sender  = thread.participants[0];
                const preview = thread.messages?.[0]?.body ?? "";
                const isActive = activeThread?.id === thread.id;
                return (
                  <button
                    key={thread.id}
                    onClick={() => { void openThread(thread); }}
                    className={`w-full text-left px-3 py-3 border-b border-border transition-colors flex gap-2.5 ${
                      isActive
                        ? "bg-[#6B7EFF]/5 border-l-2 border-l-[#6B7EFF]"
                        : "hover:bg-accent"
                    } ${thread.unread_count > 0 ? "bg-[#6B7EFF]/[0.02]" : ""}`}
                  >
                    <Avatar name={sender?.name ?? sender?.address ?? "?"} size={34} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-xs truncate flex-1 ${thread.unread_count > 0 ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
                          {sender?.name ?? sender?.address ?? "Unknown"}
                        </span>
                        <span className="text-[9px] text-muted-foreground shrink-0">
                          {timeAgo(thread.last_message_at)}
                        </span>
                      </div>
                      {thread.subject && (
                        <p className="text-[11px] text-foreground/80 truncate mb-0.5">{thread.subject}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground truncate">{preview}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {thread.message_channels && (
                          <ChannelBadge type={thread.message_channels.channel_type} small />
                        )}
                        {thread.linked_wo_id && (
                          <span className="text-[8px] bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-full font-semibold">WO</span>
                        )}
                        {thread.linked_quote_id && (
                          <span className="text-[8px] bg-[#6B7EFF]/10 text-[#6B7EFF] px-1.5 py-0.5 rounded-full font-semibold">Quote</span>
                        )}
                        {thread.unread_count > 0 && (
                          <span className="ml-auto w-4 h-4 bg-[#6B7EFF] text-white text-[8px] font-bold rounded-full flex items-center justify-center shrink-0">
                            {thread.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Conversation panel ────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC]">
          {!activeThread ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={<MessageCircle size={32} className="text-muted-foreground" />}
                title="Select a conversation"
                description="Choose a thread from the left to read and reply."
              />
            </div>
          ) : (
            <>
              {/* Conv header */}
              <div className="px-5 py-3 border-b border-border bg-white flex items-center gap-3">
                <Avatar name={activeThread.participants[0]?.name ?? activeThread.participants[0]?.address ?? "?"} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {activeThread.participants[0]?.name ?? activeThread.participants[0]?.address}
                    </p>
                    {activeThread.message_channels && (
                      <ChannelBadge type={activeThread.message_channels.channel_type} />
                    )}
                  </div>
                  {activeThread.subject && (
                    <p className="text-xs text-muted-foreground truncate">{activeThread.subject}</p>
                  )}
                </div>
                {activeThread.linked_wo_id && (
                  <a href={`/maintenance/${activeThread.linked_wo_id}`} className="text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-lg hover:bg-orange-100 transition-colors">
                    WO →
                  </a>
                )}
                {activeThread.linked_quote_id && (
                  <a href={`/quotes/${activeThread.linked_quote_id}`} className="text-xs font-medium text-[#6B7EFF] bg-[#6B7EFF]/5 border border-[#6B7EFF]/20 px-2.5 py-1 rounded-lg hover:bg-[#6B7EFF]/10 transition-colors">
                    Quote →
                  </a>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">Loading…</div>
                ) : messages.length === 0 ? (
                  <EmptyState
                    icon={<MessageCircle size={24} className="text-muted-foreground" />}
                    title="No messages yet"
                    description="Send the first message below."
                  />
                ) : (
                  messages.map((msg) => {
                    const isOut = msg.direction === "outbound";
                    return (
                      <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                        <div className="max-w-[68%]">
                          {!isOut && (
                            <p className="text-[10px] text-muted-foreground mb-1 pl-1">
                              {msg.from_name ?? msg.from_address}
                            </p>
                          )}
                          <div
                            className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                              isOut
                                ? "bg-[#6B7EFF] text-white rounded-br-sm"
                                : "bg-white border border-border text-foreground rounded-bl-sm"
                            }`}
                          >
                            {msg.body}
                          </div>
                          <p className={`text-[9px] text-muted-foreground mt-1 ${isOut ? "text-right" : "pl-1"}`}>
                            {msg.sent_at ? timeAgo(msg.sent_at) : timeAgo(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Reply bar */}
              <div className="px-5 py-3 border-t border-border bg-white flex items-end gap-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendReply(); }
                  }}
                  placeholder={`Reply via ${activeThread.message_channels?.channel_type ?? "message"}…`}
                  rows={2}
                  className="flex-1 resize-none border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#6B7EFF]/40 bg-white"
                />
                <button
                  onClick={() => { void sendReply(); }}
                  disabled={sending || !reply.trim()}
                  className="p-2.5 bg-[#6B7EFF] text-white rounded-xl hover:bg-[#5a6ee0] transition-colors disabled:opacity-50 shrink-0"
                >
                  <Send size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
