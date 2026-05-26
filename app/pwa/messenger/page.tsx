"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Send, RefreshCw, Plus, Search, Settings } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { MessageCircle, PhoneCall, Mail, Calendar, Lock, ChevronLeft, Shield } = require("lucide-react") as any;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Channel {
  id: string;
  channel_type: string;
  display_name: string;
  is_active: boolean;
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
  status: string;
  sent_at: string | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHANNEL_COLOR: Record<string, string> = {
  gmail:    "#EA4335",
  smtp:     "#185FA5",
  caldav:   "#15803d",
  phone:    "#854F0B",
  twilio:   "#EF9F27",
  internal: "#6B7EFF",
};

const CHANNEL_ICON: Record<string, React.ElementType> = {
  gmail:    Mail,
  smtp:     Mail,
  caldav:   Calendar,
  phone:    PhoneCall,
  twilio:   PhoneCall,
  internal: Lock,
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return "now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function avatarColor(name: string): string {
  const palette = ["#6B7EFF", "#EA580C", "#15803d", "#7c3aed", "#0F6E56", "#854F0B"];
  return palette[name.charCodeAt(0) % palette.length];
}

// ─── Main PWA component ───────────────────────────────────────────────────────

export default function PwaMessengerPage() {
  const [channels, setChannels]         = useState<Channel[]>([]);
  const [threads, setThreads]           = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages]         = useState<Message[]>([]);
  const [reply, setReply]               = useState("");
  const [sending, setSending]           = useState(false);
  const [search, setSearch]             = useState("");
  const [showSearch, setShowSearch]     = useState(false);
  const [loading, setLoading]           = useState(true);
  const [loadingMsgs, setLoadingMsgs]   = useState(false);
  const [view, setView]                 = useState<"list" | "conv">("list");
  const bottomRef                       = useRef<HTMLDivElement>(null);

  // ── Load channels + threads ────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [chRes, thRes] = await Promise.all([
        fetch("/api/messages/channels"),
        fetch("/api/messages/threads?limit=50"),
      ]);
      if (chRes.ok) {
        const d = await chRes.json() as { channels: Channel[] };
        setChannels(d.channels ?? []);
      }
      if (thRes.ok) {
        const d = await thRes.json() as { threads: Thread[] };
        setThreads(d.threads ?? []);
      }
    } catch (_) {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  // ── Open thread ────────────────────────────────────────────────────────────
  async function openThread(thread: Thread) {
    setActiveThread(thread);
    setView("conv");
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/messages/threads/${thread.id}`);
      if (res.ok) {
        const d = await res.json() as { messages: Message[] };
        setMessages(d.messages ?? []);
        setThreads((prev) => prev.map((t) => t.id === thread.id ? { ...t, unread_count: 0 } : t));
      }
    } catch (_) {} finally {
      setLoadingMsgs(false);
    }
  }

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send reply ─────────────────────────────────────────────────────────────
  async function handleSend() {
    if (!reply.trim() || !activeThread) return;
    setSending(true);
    const optimistic: Message = {
      id:           `temp-${Date.now()}`,
      direction:    "outbound",
      source_type:  activeThread.message_channels?.channel_type ?? "internal",
      from_address: "me",
      from_name:    "You",
      body:         reply,
      status:       "pending",
      sent_at:      new Date().toISOString(),
      created_at:   new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setReply("");
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: activeThread.id, body: optimistic.body }),
      });
      if (res.ok) {
        const d = await res.json() as { message: Message };
        setMessages((prev) => prev.map((m) => m.id === optimistic.id ? d.message : m));
      } else {
        setMessages((prev) => prev.map((m) => m.id === optimistic.id ? { ...m, status: "failed" } : m));
      }
    } catch (_) {
      setMessages((prev) => prev.map((m) => m.id === optimistic.id ? { ...m, status: "failed" } : m));
    } finally {
      setSending(false);
    }
  }

  // ── Filtered threads ───────────────────────────────────────────────────────
  const filtered = threads.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.subject?.toLowerCase().includes(q) ||
      t.participants.some((p) => (p.name ?? p.address).toLowerCase().includes(q))
    );
  });

  const totalUnread = threads.reduce((n, t) => n + t.unread_count, 0);

  // ─── Thread list view ──────────────────────────────────────────────────────
  function renderThreadList() {
    return (
      <div className="flex flex-col h-full bg-white">
        {/* Header */}
        <div className="bg-[#0C111D] px-4 pt-safe-top" style={{ paddingTop: "env(safe-area-inset-top, 12px)" }}>
          <div className="flex items-center gap-3 pb-3 pt-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#6B7EFF,#a78bfa)" }}>
              <MessageCircle size={16} style={{ color: "#fff" }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white leading-none">GG Messenger</p>
              <p className="text-[10px] text-white/50 mt-0.5">Secure org network</p>
            </div>
            <div className="flex items-center gap-2">
              {totalUnread > 0 && (
                <span className="text-[9px] font-bold bg-[#6B7EFF] text-white px-1.5 py-0.5 rounded-full">
                  {totalUnread}
                </span>
              )}
              <button onClick={() => setShowSearch((v) => !v)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <Search size={15} style={{ color: "rgba(255,255,255,0.6)" }} />
              </button>
              <button onClick={() => { void loadData(); }} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <RefreshCw size={15} style={{ color: "rgba(255,255,255,0.6)" }} className={loading ? "animate-spin" : ""} />
              </button>
              <a href="/messages/settings" className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <Settings size={15} style={{ color: "rgba(255,255,255,0.6)" }} />
              </a>
            </div>
          </div>

          {/* Secure banner */}
          <div className="flex items-center gap-2 bg-emerald-700/20 border border-emerald-600/30 rounded-lg px-3 py-2 mb-3">
            <Shield size={12} style={{ color: "#6ee7b7" }} />
            <span className="text-[11px] font-medium text-emerald-300">Secure Organization Network</span>
          </div>

          {/* Search bar */}
          {showSearch && (
            <div className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-lg px-3 py-2 mb-3">
              <Search size={12} style={{ color: "rgba(255,255,255,0.4)" }} />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="flex-1 bg-transparent text-xs text-white placeholder:text-white/40 outline-none"
              />
            </div>
          )}
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-xs text-gray-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <MessageCircle size={28} style={{ color: "#d1d5db" }} />
              <p className="text-xs text-gray-400">No conversations yet</p>
              <a href="/messages/settings" className="text-xs font-medium text-[#6B7EFF]">Connect a channel →</a>
            </div>
          ) : (
            filtered.map((thread) => {
              const sender  = thread.participants[0];
              const name    = sender?.name ?? sender?.address ?? "Unknown";
              const preview = thread.messages?.[0]?.body ?? "";
              const chColor = CHANNEL_COLOR[thread.message_channels?.channel_type ?? "internal"];
              return (
                <button
                  key={thread.id}
                  onClick={() => { void openThread(thread); }}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100 transition-colors ${
                    thread.unread_count > 0 ? "bg-[#6B7EFF]/[0.03]" : ""
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center font-semibold text-sm shrink-0"
                    style={{ background: avatarColor(name) + "22", color: avatarColor(name) }}
                  >
                    {initials(name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className={`text-sm flex-1 truncate ${thread.unread_count > 0 ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                        {name}
                      </p>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {timeAgo(thread.last_message_at)}
                      </span>
                    </div>
                    {thread.subject && (
                      <p className="text-[11px] text-gray-600 truncate mb-0.5">{thread.subject}</p>
                    )}
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] text-gray-400 truncate flex-1">{preview}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: chColor + "18", color: chColor }}
                        >
                          {thread.message_channels?.channel_type?.toUpperCase() ?? "ORG"}
                        </span>
                        {thread.unread_count > 0 && (
                          <span className="w-4 h-4 bg-[#6B7EFF] text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                            {thread.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* New conversation FAB */}
        <div className="absolute bottom-6 right-4" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <button
            className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-none"
            style={{ background: "#6B7EFF" }}
          >
            <Plus size={22} />
          </button>
        </div>
      </div>
    );
  }

  // ─── Conversation view ─────────────────────────────────────────────────────
  function renderConversation() {
    if (!activeThread) return null;
    const sender    = activeThread.participants[0];
    const name      = sender?.name ?? sender?.address ?? "Unknown";
    const chType    = activeThread.message_channels?.channel_type ?? "internal";
    const chColor   = CHANNEL_COLOR[chType];
    const ChIcon    = CHANNEL_ICON[chType] ?? MessageCircle;

    return (
      <div className="flex flex-col h-full bg-gray-50">
        {/* Header */}
        <div className="bg-[#0C111D] px-4" style={{ paddingTop: "env(safe-area-inset-top, 12px)" }}>
          <div className="flex items-center gap-3 py-3">
            <button onClick={() => setView("list")} className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <ChevronLeft size={20} style={{ color: "rgba(255,255,255,0.7)" }} />
            </button>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm shrink-0"
              style={{ background: avatarColor(name) + "33", color: avatarColor(name) }}
            >
              {initials(name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-none truncate">{name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <ChIcon size={10} style={{ color: chColor }} />
                <span className="text-[10px]" style={{ color: chColor }}>
                  {activeThread.message_channels?.display_name ?? chType}
                </span>
              </div>
            </div>
            {activeThread.linked_wo_id && (
              <a
                href={`/maintenance/${activeThread.linked_wo_id}`}
                className="text-[10px] font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-1 rounded-lg"
              >
                WO
              </a>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
          {loadingMsgs ? (
            <div className="flex items-center justify-center h-40 text-xs text-gray-400">Loading…</div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-xs text-gray-400">No messages yet — say hello!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOut = msg.direction === "outbound";
              const failed = msg.status === "failed";
              return (
                <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[78%]">
                    {!isOut && (
                      <p className="text-[9px] text-gray-400 mb-1 pl-1">
                        {msg.from_name ?? msg.from_address}
                      </p>
                    )}
                    <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isOut
                        ? failed
                          ? "bg-red-100 text-red-700 rounded-br-sm"
                          : "bg-[#6B7EFF] text-white rounded-br-sm"
                        : "bg-white text-gray-800 rounded-bl-sm border border-gray-100"
                    }`}>
                      {msg.body}
                    </div>
                    <p className={`text-[9px] text-gray-400 mt-1 ${isOut ? "text-right pr-1" : "pl-1"}`}>
                      {failed ? "Failed to send" : timeAgo(msg.sent_at ?? msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Reply bar */}
        <div
          className="bg-white border-t border-gray-100 px-3 py-2.5 flex items-end gap-2"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom, 8px), 8px)" }}
        >
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
            }}
            placeholder={`Message via ${chType}…`}
            rows={1}
            className="flex-1 resize-none border border-gray-200 rounded-2xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#6B7EFF]/50 bg-gray-50"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={() => { void handleSend(); }}
            disabled={sending || !reply.trim()}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 transition-opacity disabled:opacity-40"
            style={{ background: "#6B7EFF" }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
      {view === "list" ? renderThreadList() : renderConversation()}
    </div>
  );
}
