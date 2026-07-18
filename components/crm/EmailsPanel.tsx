"use client";

// EmailsPanel — the "Emails" tab for an opportunity (light CRM theme).
//
// Shows every Gmail conversation linked to the record (sent AND received),
// suggests synced-but-unlinked threads that involve the record's contact
// emails (one-click Link), and includes an in-portal composer that sends
// through the user's connected Gmail — so sent mail is logged automatically
// and you never have to leave the portal.
//
// Data: GET  /api/crm/opportunities/[id]/emails
//       POST /api/crm/opportunities/[id]/emails/send
//       POST /api/crm/opportunities/[id]/emails/link
//       POST /api/nexus/messages/sync        (refresh Gmail now)
//       POST /api/nexus/messages/match       (backfill auto-matching)

import { useCallback, useEffect, useState } from "react";
import {
  Mail, Send, RefreshCw, Link2, ChevronDown, ChevronRight,
  ArrowUpRight, Sparkles, X,
} from "lucide-react";
// Icons missing from this lucide version's type exports (same pattern as the CRM pages).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowDownLeft, Unlink } = require("lucide-react") as any;

type Msg = {
  id: string;
  thread_id: string;
  direction: "inbound" | "outbound";
  from_address: string;
  from_name: string | null;
  to_addresses: { name?: string; address: string }[];
  subject: string | null;
  body: string;
  body_html: string | null;
  status: string;
  sent_at: string | null;
  created_at: string;
};

type Thread = {
  id: string;
  subject: string | null;
  participants: { name?: string; address: string }[];
  last_message_at: string | null;
  unread_count?: number;
  link_source?: string | null;
  messages?: Msg[];
};

type EmailsData = {
  connected: boolean;
  channel_id: string | null;
  from_address: string | null;
  contact_emails: string[];
  threads: Thread[];
  suggestions: Thread[];
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function participantLabel(t: Thread, self?: string | null): string {
  const others = (t.participants ?? []).filter(
    (p) => p.address && p.address.toLowerCase() !== (self ?? "").toLowerCase(),
  );
  if (!others.length) return t.participants?.[0]?.address ?? "";
  return others.map((p) => p.name || p.address).slice(0, 3).join(", ") +
    (others.length > 3 ? ` +${others.length - 3}` : "");
}

export default function EmailsPanel({
  opportunityId,
  defaultTo,
}: {
  opportunityId: string;
  defaultTo?: string;
}) {
  const [data, setData] = useState<EmailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Composer
  const [composeOpen, setComposeOpen] = useState(false);
  const [to, setTo] = useState(defaultTo ?? "");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [replyThreadId, setReplyThreadId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentFlash, setSentFlash] = useState(false);

  const base = `/api/crm/opportunities/${opportunityId}/emails`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(base, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Failed to load emails");
      const d = (await res.json()) as EmailsData;
      setData(d);
      if (!to && d.contact_emails?.length) setTo(d.contact_emails[0]);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load emails");
    } finally {
      setLoading(false);
    }
  }, [base, to]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  async function syncNow() {
    setSyncing(true);
    try {
      await fetch("/api/nexus/messages/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inline: true }),
      });
      await fetch("/api/nexus/messages/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 200 }),
      });
      await load();
    } finally {
      setSyncing(false);
    }
  }

  async function linkThread(threadId: string, action: "link" | "unlink") {
    const res = await fetch(`${base}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread_id: threadId, action }),
    });
    if (res.ok) await load();
  }

  async function sendEmail() {
    if (!to.includes("@") || sending) return;
    setSending(true);
    setErr(null);
    try {
      const res = await fetch(`${base}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          text: bodyText,
          thread_id: replyThreadId ?? undefined,
        }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out?.error ?? "Send failed");
      setSubject("");
      setBodyText("");
      setReplyThreadId(null);
      setComposeOpen(false);
      setSentFlash(true);
      setTimeout(() => setSentFlash(false), 3500);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  function startReply(t: Thread) {
    const last = t.messages?.[t.messages.length - 1];
    const other =
      last?.direction === "inbound"
        ? last.from_address
        : last?.to_addresses?.[0]?.address ?? participantLabel(t, data?.from_address);
    setTo(other ?? "");
    setSubject(t.subject ? (t.subject.startsWith("Re:") ? t.subject : `Re: ${t.subject}`) : "");
    setReplyThreadId(t.id);
    setComposeOpen(true);
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Loading emails…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail size={15} className="text-[#6B7EFF]" />
          {data?.connected ? (
            <span>Sending as <span className="font-medium text-foreground">{data.from_address}</span></span>
          ) : (
            <span>Emails matched to this opportunity's contacts</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncNow}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing…" : "Sync Gmail"}
          </button>
          {data?.connected && (
            <button
              onClick={() => { setReplyThreadId(null); setComposeOpen((v) => !v); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#6B7EFF] text-white hover:bg-[#5A6BEB] transition-colors"
            >
              <Send size={13} /> Compose
            </button>
          )}
        </div>
      </div>

      {sentFlash && (
        <div className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          Email sent and logged to this opportunity.
        </div>
      )}
      {err && (
        <div className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {err}
        </div>
      )}

      {/* Connect banner */}
      {data && !data.connected && (
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div className="text-sm">
            <div className="font-semibold">Connect your Gmail to send from the portal</div>
            <div className="text-muted-foreground text-xs mt-0.5">
              Received emails still auto-match below. Connecting Gmail lets you compose and reply right here.
            </div>
          </div>
          <a
            href="/messages/settings"
            className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#6B7EFF] text-white hover:bg-[#5A6BEB]"
          >
            Connect Gmail
          </a>
        </div>
      )}

      {/* Composer */}
      {composeOpen && data?.connected && (
        <div className="bg-card border border-[#6B7EFF]/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <Send size={14} className="text-[#6B7EFF]" />
              {replyThreadId ? "Reply" : "New Email"}
            </div>
            <button onClick={() => { setComposeOpen(false); setReplyThreadId(null); }} className="text-muted-foreground hover:text-foreground">
              <X size={15} />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground w-14">To</label>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                list="opp-contact-emails"
                placeholder="name@company.com"
                className="flex-1 text-sm border border-border rounded-lg px-3 py-1.5 bg-background outline-none focus:border-[#6B7EFF]"
              />
              <datalist id="opp-contact-emails">
                {(data.contact_emails ?? []).map((e) => <option key={e} value={e} />)}
              </datalist>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground w-14">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="flex-1 text-sm border border-border rounded-lg px-3 py-1.5 bg-background outline-none focus:border-[#6B7EFF]"
              />
            </div>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={7}
              placeholder="Write your email… (your saved signature is added automatically)"
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background outline-none focus:border-[#6B7EFF] resize-y"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={sendEmail}
              disabled={sending || !to.includes("@")}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-[#6B7EFF] text-white hover:bg-[#5A6BEB] disabled:opacity-50"
            >
              <Send size={14} /> {sending ? "Sending…" : "Send via Gmail"}
            </button>
          </div>
        </div>
      )}

      {/* Linked threads */}
      {data && data.threads.length === 0 && data.suggestions.length === 0 && (
        <div className="text-sm text-muted-foreground bg-card border border-border rounded-xl p-6 text-center">
          No emails yet. Conversations with{" "}
          {data.contact_emails.length
            ? data.contact_emails.slice(0, 2).join(", ")
            : "this opportunity's contacts"}{" "}
          will appear here automatically after the next Gmail sync.
        </div>
      )}

      {data && data.threads.length > 0 && (
        <div className="space-y-2">
          {data.threads.map((t) => {
            const isOpen = expanded === t.id;
            const msgs = t.messages ?? [];
            const last = msgs[msgs.length - 1];
            return (
              <div key={t.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : t.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                >
                  {isOpen ? <ChevronDown size={15} className="shrink-0 text-muted-foreground" /> : <ChevronRight size={15} className="shrink-0 text-muted-foreground" />}
                  {last?.direction === "outbound"
                    ? <ArrowUpRight size={14} className="shrink-0 text-[#6B7EFF]" />
                    : <ArrowDownLeft size={14} className="shrink-0 text-emerald-600" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{t.subject || "(no subject)"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {participantLabel(t, data.from_address)} · {msgs.length} message{msgs.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  {(t.unread_count ?? 0) > 0 && (
                    <span className="shrink-0 bg-[#6B7EFF] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {t.unread_count}
                    </span>
                  )}
                  {t.link_source === "auto" && (
                    <span title="Matched automatically by contact email" className="shrink-0 flex items-center gap-1 text-[10px] font-medium text-[#6B7EFF] bg-[#6B7EFF]/10 px-1.5 py-0.5 rounded-full">
                      <Sparkles size={10} /> auto
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(t.last_message_at)}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-border divide-y divide-border">
                    {msgs.map((m) => (
                      <div key={m.id} className="px-4 py-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                          {m.direction === "outbound"
                            ? <ArrowUpRight size={12} className="text-[#6B7EFF]" />
                            : <ArrowDownLeft size={12} className="text-emerald-600" />}
                          <span className="font-medium text-foreground">{m.from_name || m.from_address}</span>
                          <span>→ {(m.to_addresses ?? []).map((a) => a.address).join(", ")}</span>
                          <span className="ml-auto">{fmtDate(m.sent_at ?? m.created_at)}</span>
                          {m.status === "failed" && <span className="text-red-600 font-semibold">failed</span>}
                        </div>
                        {m.body_html ? (
                          <iframe
                            sandbox=""
                            srcDoc={m.body_html}
                            title={`email-${m.id}`}
                            className="w-full rounded-lg border border-border bg-white"
                            style={{ height: 320 }}
                          />
                        ) : (
                          <div className="text-sm whitespace-pre-wrap text-foreground/90">{m.body}</div>
                        )}
                      </div>
                    ))}
                    <div className="px-4 py-2.5 flex items-center justify-between bg-muted/30">
                      {data.connected ? (
                        <button onClick={() => startReply(t)} className="text-xs font-semibold text-[#6B7EFF] hover:underline flex items-center gap-1">
                          <Send size={12} /> Reply
                        </button>
                      ) : <span />}
                      <button
                        onClick={() => linkThread(t.id, "unlink")}
                        className="text-xs text-muted-foreground hover:text-red-600 flex items-center gap-1"
                        title="Detach this conversation from the opportunity"
                      >
                        <Unlink size={12} /> Unlink
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Suggestions */}
      {data && data.suggestions.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Sparkles size={12} className="text-[#6B7EFF]" /> Suggested matches
          </div>
          {data.suggestions.map((s) => (
            <div key={s.id} className="bg-card border border-dashed border-border rounded-xl px-4 py-3 flex items-center gap-3">
              <Mail size={14} className="shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{s.subject || "(no subject)"}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {participantLabel(s, data.from_address)} · {fmtDate(s.last_message_at)}
                </div>
              </div>
              <button
                onClick={() => linkThread(s.id, "link")}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-[#6B7EFF]/40 text-[#6B7EFF] hover:bg-[#6B7EFF]/10"
              >
                <Link2 size={12} /> Link
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
