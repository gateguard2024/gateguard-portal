"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Send, RefreshCw, Search, Settings, Plus, X } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { MessageCircle, PhoneCall, Mail, Calendar, Lock, ChevronLeft, Shield, CheckCheck } = require("lucide-react") as any;

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

// ─── Constants ────────────────────────────────────────────────────────────────

const CHANNEL_COLOR: Record<string, string> = {
  gmail:    "#EA4335",
  smtp:     "#185FA5",
  caldav:   "#15803d",
  phone:    "#854F0B",
  twilio:   "#F59E0B",
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

const AVATAR_PALETTE = ["#6B7EFF", "#EA580C", "#15803d", "#7c3aed", "#0F6E56", "#854F0B", "#0284c7", "#db2777"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return "now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  const d = new Date(iso);
  const today = new Date();
  if (d.getFullYear() === today.getFullYear()) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
}

function initials(name: string): string {
  return name.split(" ").map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";
}

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const bg = avatarColor(name);
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: bg + "22", color: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 600, fontSize: size * 0.33, flexShrink: 0,
      }}
    >
      {initials(name)}
    </div>
  );
}

function ChannelPill({ type }: { type: string }) {
  const color = CHANNEL_COLOR[type] ?? "#6B7EFF";
  const label = type === "twilio" ? "SMS" : type.toUpperCase();
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, lineHeight: 1,
      padding: "3px 6px", borderRadius: 99,
      background: color + "18", color,
    }}>
      {label}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

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
  // "chats" = thread list, "conv" = open conversation, "new" = new thread sheet
  const [screen, setScreen]             = useState<"chats" | "conv" | "new">("chats");
  const bottomRef                       = useRef<HTMLDivElement>(null);
  const replyRef                        = useRef<HTMLTextAreaElement>(null);

  // ── Load data ──────────────────────────────────────────────────────────────
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
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  // ── Open thread ────────────────────────────────────────────────────────────
  async function openThread(thread: Thread) {
    setActiveThread(thread);
    setScreen("conv");
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/messages/threads/${thread.id}`);
      if (res.ok) {
        const d = await res.json() as { messages: Message[] };
        setMessages(d.messages ?? []);
        setThreads((prev) => prev.map((t) => t.id === thread.id ? { ...t, unread_count: 0 } : t));
      }
    } catch (_) {
    } finally {
      setLoadingMsgs(false);
    }
  }

  // Scroll to bottom on new messages
  useEffect(() => {
    if (screen === "conv") {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, screen]);

  // Focus reply on conv open
  useEffect(() => {
    if (screen === "conv") {
      setTimeout(() => replyRef.current?.focus(), 100);
    }
  }, [screen]);

  // ── Send ───────────────────────────────────────────────────────────────────
  async function handleSend() {
    if (!reply.trim() || !activeThread) return;
    setSending(true);
    const body = reply.trim();
    const optimistic: Message = {
      id:           `temp-${Date.now()}`,
      direction:    "outbound",
      source_type:  activeThread.message_channels?.channel_type ?? "internal",
      from_address: "me",
      from_name:    "You",
      body,
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
        body: JSON.stringify({ thread_id: activeThread.id, body }),
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

  // ─────────────────────────────────────────────────────────────────────────────
  // CHATS SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  function ChatsScreen() {
    return (
      <>
        {/* ── Fixed header ── */}
        <div style={{
          background: "#0C111D",
          paddingTop: "env(safe-area-inset-top, 0px)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px 10px" }}>
            {/* Brand mark */}
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg,#6B7EFF,#a78bfa)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <MessageCircle size={17} style={{ color: "#fff" }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1, margin: 0 }}>
                GG Messenger
              </p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2, margin: 0 }}>
                {channels.filter((c) => c.is_active).length} channel{channels.filter((c) => c.is_active).length !== 1 ? "s" : ""} active
              </p>
            </div>
            {/* Header actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {totalUnread > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 800, background: "#6B7EFF", color: "#fff",
                  padding: "2px 7px", borderRadius: 99, minWidth: 20, textAlign: "center",
                }}>
                  {totalUnread}
                </span>
              )}
              <button
                onClick={() => setShowSearch((v) => !v)}
                style={{ padding: 8, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", minWidth: 40, minHeight: 40, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                {showSearch ? <X size={16} style={{ color: "rgba(255,255,255,0.6)" }} /> : <Search size={16} style={{ color: "rgba(255,255,255,0.6)" }} />}
              </button>
              <button
                onClick={() => { void loadData(); }}
                style={{ padding: 8, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", minWidth: 40, minHeight: 40, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} style={{ color: "rgba(255,255,255,0.6)" }} />
              </button>
            </div>
          </div>

          {/* Secure banner */}
          <div style={{
            margin: "0 16px 10px",
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(22,163,74,0.15)", border: "1px solid rgba(22,163,74,0.25)",
            borderRadius: 10, padding: "8px 12px",
          }}>
            <Shield size={12} style={{ color: "#86efac", flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: "#86efac" }}>
              End-to-end encrypted org network
            </span>
          </div>

          {/* Search bar */}
          {showSearch && (
            <div style={{
              margin: "0 16px 10px",
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10, padding: "9px 12px",
            }}>
              <Search size={13} style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations…"
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  fontSize: 13, color: "#fff",
                }}
              />
            </div>
          )}
        </div>

        {/* ── Scrollable thread list ── */}
        <div style={{ flex: 1, overflowY: "auto", background: "#fff", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160 }}>
              <RefreshCw size={20} className="animate-spin" style={{ color: "#d1d5db" }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 10 }}>
              <MessageCircle size={32} style={{ color: "#e5e7eb" }} />
              <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>No conversations yet</p>
              <a href="/messages/settings" style={{ fontSize: 13, fontWeight: 600, color: "#6B7EFF", textDecoration: "none" }}>
                Connect a channel →
              </a>
            </div>
          ) : (
            filtered.map((thread, idx) => {
              const sender  = thread.participants[0];
              const name    = sender?.name ?? sender?.address ?? "Unknown";
              const preview = thread.messages?.[0]?.body ?? "";
              const chType  = thread.message_channels?.channel_type ?? "internal";
              const hasUnread = thread.unread_count > 0;

              return (
                <button
                  key={thread.id}
                  onClick={() => { void openThread(thread); }}
                  style={{
                    width: "100%", textAlign: "left", display: "flex", alignItems: "center",
                    gap: 12, padding: "13px 16px",
                    background: hasUnread ? "rgba(107,126,255,0.03)" : "#fff",
                    border: "none", borderBottom: idx < filtered.length - 1 ? "1px solid #f3f4f6" : "none",
                    cursor: "pointer", minHeight: 72,
                  }}
                >
                  {/* Unread indicator */}
                  <div style={{ width: 6, flexShrink: 0 }}>
                    {hasUnread && (
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6B7EFF" }} />
                    )}
                  </div>

                  {/* Avatar */}
                  <Avatar name={name} size={46} />

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <p style={{
                        flex: 1, fontSize: 14, fontWeight: hasUnread ? 700 : 500,
                        color: hasUnread ? "#111827" : "#374151", margin: 0,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {name}
                      </p>
                      <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>
                        {timeAgo(thread.last_message_at)}
                      </span>
                    </div>

                    {thread.subject && (
                      <p style={{
                        fontSize: 12, color: "#6b7280", margin: "0 0 2px",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {thread.subject}
                      </p>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <p style={{
                        flex: 1, fontSize: 12, color: "#9ca3af", margin: 0,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {preview}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                        <ChannelPill type={chType} />
                        {hasUnread && (
                          <span style={{
                            minWidth: 18, height: 18, borderRadius: 99, background: "#6B7EFF",
                            color: "#fff", fontSize: 10, fontWeight: 700,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            padding: "0 5px",
                          }}>
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
          {/* Bottom breathing room above tab bar */}
          <div style={{ height: 8 }} />
        </div>

        {/* ── Bottom tab bar ── */}
        <TabBar active="chats" onNew={() => setScreen("new")} />
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONVERSATION SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  function ConversationScreen() {
    if (!activeThread) return null;
    const sender  = activeThread.participants[0];
    const name    = sender?.name ?? sender?.address ?? "Unknown";
    const chType  = activeThread.message_channels?.channel_type ?? "internal";
    const chColor = CHANNEL_COLOR[chType];
    const ChIcon  = CHANNEL_ICON[chType] ?? MessageCircle;

    return (
      <>
        {/* ── Fixed conv header ── */}
        <div style={{
          background: "#0C111D",
          paddingTop: "env(safe-area-inset-top, 0px)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 8px 10px 4px" }}>
            {/* Back button — large tap target */}
            <button
              onClick={() => { setScreen("chats"); setActiveThread(null); }}
              style={{
                minWidth: 44, minHeight: 44, borderRadius: 10, border: "none",
                background: "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ChevronLeft size={22} style={{ color: "rgba(255,255,255,0.8)" }} />
            </button>

            <Avatar name={name} size={36} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {name}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                <ChIcon size={10} style={{ color: chColor }} />
                <span style={{ fontSize: 11, color: chColor }}>
                  {activeThread.message_channels?.display_name ?? chType}
                </span>
                {activeThread.linked_wo_id && (
                  <>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>·</span>
                    <a
                      href={`/maintenance/${activeThread.linked_wo_id}`}
                      style={{ fontSize: 10, fontWeight: 700, color: "#fb923c", textDecoration: "none" }}
                    >
                      WO linked
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Scrollable messages ── */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "12px 14px 8px",
          background: "#f9fafb", WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}>
          {loadingMsgs ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120 }}>
              <RefreshCw size={18} className="animate-spin" style={{ color: "#d1d5db" }} />
            </div>
          ) : messages.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120 }}>
              <p style={{ fontSize: 13, color: "#9ca3af" }}>No messages — say hello!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOut  = msg.direction === "outbound";
              const failed = msg.status === "failed";
              return (
                <div key={msg.id} style={{ display: "flex", justifyContent: isOut ? "flex-end" : "flex-start", marginBottom: 10 }}>
                  <div style={{ maxWidth: "78%" }}>
                    {!isOut && (
                      <p style={{ fontSize: 10, color: "#9ca3af", margin: "0 0 3px 4px" }}>
                        {msg.from_name ?? msg.from_address}
                      </p>
                    )}
                    <div style={{
                      padding: "10px 14px",
                      borderRadius: isOut ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                      fontSize: 14, lineHeight: 1.45,
                      background: isOut
                        ? failed ? "#fee2e2" : "#6B7EFF"
                        : "#ffffff",
                      color: isOut ? (failed ? "#dc2626" : "#ffffff") : "#1f2937",
                      boxShadow: isOut ? "none" : "0 1px 3px rgba(0,0,0,0.07)",
                      border: isOut ? "none" : "1px solid #f3f4f6",
                      wordBreak: "break-word",
                    }}>
                      {msg.body}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, margin: "3px 4px 0", justifyContent: isOut ? "flex-end" : "flex-start" }}>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>
                        {failed ? "Failed to send" : timeAgo(msg.sent_at ?? msg.created_at)}
                      </span>
                      {isOut && !failed && (
                        <CheckCheck size={12} style={{ color: msg.status === "delivered" ? "#6B7EFF" : "#9ca3af" }} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Reply bar — sits above home indicator ── */}
        <div style={{
          background: "#fff",
          borderTop: "1px solid #f3f4f6",
          padding: "10px 12px",
          paddingBottom: "max(env(safe-area-inset-bottom, 10px), 10px)",
          display: "flex", alignItems: "flex-end", gap: 8,
          flexShrink: 0,
        }}>
          <textarea
            ref={replyRef}
            value={reply}
            onChange={(e) => {
              setReply(e.target.value);
              // Auto-grow
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
            }}
            placeholder={`Message via ${chType}…`}
            rows={1}
            style={{
              flex: 1, resize: "none", border: "1.5px solid #e5e7eb",
              borderRadius: 20, padding: "10px 14px", fontSize: 14,
              outline: "none", background: "#f9fafb", lineHeight: 1.4,
              minHeight: 40, maxHeight: 120, fontFamily: "inherit",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => { e.target.style.borderColor = "#6B7EFF80"; }}
            onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; }}
          />
          <button
            onClick={() => { void handleSend(); }}
            disabled={sending || !reply.trim()}
            style={{
              width: 40, height: 40, borderRadius: "50%", border: "none",
              background: reply.trim() ? "#6B7EFF" : "#e5e7eb",
              cursor: reply.trim() ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, transition: "background 0.15s",
              opacity: sending ? 0.5 : 1,
            }}
          >
            <Send size={16} style={{ color: reply.trim() ? "#fff" : "#9ca3af" }} />
          </button>
        </div>
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // NEW CONVERSATION SHEET (slides up)
  // ─────────────────────────────────────────────────────────────────────────────
  function NewConvSheet() {
    return (
      <>
        {/* Dimmed backdrop */}
        <div
          onClick={() => setScreen("chats")}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 10,
          }}
        />
        {/* Sheet */}
        <div style={{
          position: "fixed", left: 0, right: 0, bottom: 0,
          background: "#fff", borderRadius: "20px 20px 0 0",
          zIndex: 20, padding: "0 0 env(safe-area-inset-bottom, 16px)",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.12)",
        }}>
          {/* Drag handle */}
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: "#e5e7eb" }} />
          </div>

          <div style={{ padding: "4px 20px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: "#111827", margin: 0 }}>New Conversation</p>
              <button
                onClick={() => setScreen("chats")}
                style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "#f3f4f6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} style={{ color: "#6b7280" }} />
              </button>
            </div>

            {/* Channels to start from */}
            {channels.filter((c) => c.is_active).length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 12 }}>No channels connected yet.</p>
                <a
                  href="/messages/settings"
                  style={{ fontSize: 14, fontWeight: 600, color: "#6B7EFF", textDecoration: "none" }}
                >
                  Set up a channel →
                </a>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Start via
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {channels.filter((c) => c.is_active).map((ch) => {
                    const color = CHANNEL_COLOR[ch.channel_type] ?? "#6B7EFF";
                    const Icon  = CHANNEL_ICON[ch.channel_type] ?? MessageCircle;
                    return (
                      <button
                        key={ch.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "12px 14px", borderRadius: 12,
                          border: "1.5px solid #f3f4f6", background: "#fafafa",
                          cursor: "pointer", textAlign: "left",
                          minHeight: 56,
                        }}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                          background: color + "18",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Icon size={16} style={{ color }} />
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>{ch.display_name}</p>
                          <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{ch.channel_type}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB BAR
  // ─────────────────────────────────────────────────────────────────────────────
  function TabBar({ active, onNew }: { active: "chats" | "settings"; onNew: () => void }) {
    return (
      <div style={{
        background: "#fff",
        borderTop: "1px solid #f3f4f6",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        display: "flex", alignItems: "center",
        flexShrink: 0,
      }}>
        {/* Chats tab */}
        <a
          href="/pwa/messenger"
          style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 3, padding: "10px 0",
            textDecoration: "none", color: active === "chats" ? "#6B7EFF" : "#9ca3af",
          }}
        >
          <div style={{ position: "relative" }}>
            <MessageCircle size={22} />
            {totalUnread > 0 && active !== "chats" && (
              <span style={{
                position: "absolute", top: -4, right: -6,
                minWidth: 14, height: 14, borderRadius: 99,
                background: "#6B7EFF", color: "#fff", fontSize: 8, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 3px",
              }}>
                {totalUnread}
              </span>
            )}
          </div>
          <span style={{ fontSize: 10, fontWeight: active === "chats" ? 700 : 500 }}>Chats</span>
        </a>

        {/* New conversation — center action */}
        <div style={{ flex: 0, padding: "8px 20px" }}>
          <button
            onClick={onNew}
            style={{
              width: 48, height: 48, borderRadius: "50%", border: "none",
              background: "linear-gradient(135deg,#6B7EFF,#a78bfa)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 14px rgba(107,126,255,0.4)",
            }}
          >
            <Plus size={20} style={{ color: "#fff" }} />
          </button>
        </div>

        {/* Settings tab */}
        <a
          href="/messages/settings"
          style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 3, padding: "10px 0",
            textDecoration: "none", color: "#9ca3af",
          }}
        >
          <Settings size={22} />
          <span style={{ fontSize: 10, fontWeight: 500 }}>Settings</span>
        </a>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ROOT
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",       // dynamic viewport height — handles iOS address bar
        overflow: "hidden",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        WebkitFontSmoothing: "antialiased",
        background: "#fff",
      }}
    >
      {screen === "chats" && <ChatsScreen />}
      {screen === "conv"  && <ConversationScreen />}

      {/* New conv sheet overlays chats */}
      {screen === "new"   && (
        <>
          <ChatsScreen />
          <NewConvSheet />
        </>
      )}
    </div>
  );
}
