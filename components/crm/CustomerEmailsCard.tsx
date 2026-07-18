"use client";

// CustomerEmailsCard — compact "Emails" card for the customer (organization)
// detail page. Lists Gmail conversations auto-matched to this customer via its
// contacts' email addresses (or manually linked from an opportunity).
// Read-focused: expand a thread to read messages; composing lives on the
// opportunity Emails tab and in Nexus Messages.

import { useEffect, useState } from "react";
import {
  Mail, ChevronDown, ChevronRight, ArrowUpRight, Sparkles,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowDownLeft } = require("lucide-react") as any;

type Msg = {
  id: string;
  direction: "inbound" | "outbound";
  from_address: string;
  from_name: string | null;
  body: string;
  body_html: string | null;
  sent_at: string | null;
  created_at: string;
};

type Thread = {
  id: string;
  subject: string | null;
  participants: { name?: string; address: string }[];
  last_message_at: string | null;
  link_source?: string | null;
  messages: Msg[];
};

function fmt(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function CustomerEmailsCard({ orgId }: { orgId: string }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/customers/${orgId}/emails`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { threads: [] }))
      .then((d) => setThreads(d.threads ?? []))
      .catch(() => setThreads([]))
      .finally(() => setLoaded(true));
  }, [orgId]);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Mail size={14} className="text-brand-400" /> Emails ({threads.length})
        </h3>
      </div>

      {!loaded ? (
        <div className="py-4 text-xs text-muted-foreground">Loading…</div>
      ) : threads.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No emails matched yet. Conversations with this customer&apos;s contacts attach here
          automatically after each Gmail sync.
        </p>
      ) : (
        <div className="space-y-2">
          {threads.map((t) => {
            const isOpen = open === t.id;
            const last = t.messages[t.messages.length - 1];
            return (
              <div key={t.id} className="border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : t.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                >
                  {isOpen ? <ChevronDown size={14} className="shrink-0 text-muted-foreground" /> : <ChevronRight size={14} className="shrink-0 text-muted-foreground" />}
                  {last?.direction === "outbound"
                    ? <ArrowUpRight size={13} className="shrink-0 text-[#6B7EFF]" />
                    : <ArrowDownLeft size={13} className="shrink-0 text-emerald-600" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{t.subject || "(no subject)"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {(t.participants ?? []).map((p) => p.name || p.address).slice(0, 3).join(", ")}
                      {" · "}{t.messages.length} message{t.messages.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  {t.link_source === "auto" && (
                    <span title="Matched automatically by contact email" className="shrink-0 flex items-center gap-1 text-[10px] font-medium text-[#6B7EFF] bg-[#6B7EFF]/10 px-1.5 py-0.5 rounded-full">
                      <Sparkles size={10} /> auto
                    </span>
                  )}
                  <span className="shrink-0 text-[11px] text-muted-foreground">{fmt(t.last_message_at)}</span>
                </button>
                {isOpen && (
                  <div className="border-t border-border divide-y divide-border">
                    {t.messages.map((m) => (
                      <div key={m.id} className="px-3 py-2.5">
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1">
                          {m.direction === "outbound"
                            ? <ArrowUpRight size={11} className="text-[#6B7EFF]" />
                            : <ArrowDownLeft size={11} className="text-emerald-600" />}
                          <span className="font-medium text-foreground">{m.from_name || m.from_address}</span>
                          <span className="ml-auto">{fmt(m.sent_at ?? m.created_at)}</span>
                        </div>
                        {m.body_html ? (
                          <iframe
                            sandbox=""
                            srcDoc={m.body_html}
                            title={`cust-email-${m.id}`}
                            className="w-full rounded border border-border bg-white"
                            style={{ height: 260 }}
                          />
                        ) : (
                          <div className="text-sm whitespace-pre-wrap text-foreground/90">{m.body}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
