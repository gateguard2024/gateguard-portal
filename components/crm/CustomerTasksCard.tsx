"use client";

// CustomerTasksCard — "Tasks" card for the customer (organization) detail page.
// These are the same tasks as Nexus → Tasks (the todos table): anything linked to this
// customer, either as the task's main link or as an extra "+ Link" record.
// Add a task here and it shows up in Tasks; link a task to this customer in Tasks and it shows here.

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Plus, ExternalLink } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ListChecks } = require("lucide-react") as any;

type Task = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  assigned_to_name: string | null;
  key?: string | null;
  completed_at?: string | null;
};

const fmt = (d: string | null) => (d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
const today = () => new Date().toISOString().slice(0, 10);

export default function CustomerTasksCard({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/todos?linked_type=customer&linked_id=${orgId}&limit=300`, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      setTasks(r.ok ? d.todos ?? [] : []);
    } catch { setTasks([]); }
    setLoaded(true);
  }, [orgId]);
  useEffect(() => { void load(); }, [load]);

  async function add() {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true); setErr(null);
    const r = await fetch("/api/todos", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t, linked_type: "customer", linked_id: orgId, linked_label: orgName }),
    });
    if (!r.ok) setErr((await r.json().catch(() => ({}))).error ?? "Could not add the task.");
    else { setTitle(""); await load(); }
    setBusy(false);
  }

  async function complete(id: string) {
    setTasks(ts => ts.map(x => (x.id === id ? { ...x, status: "done", completed_at: new Date().toISOString() } : x)));
    const r = await fetch(`/api/todos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "done" }) });
    if (!r.ok) { setErr("Could not complete that task."); await load(); }
  }

  const open = tasks.filter(t => t.status !== "done" && t.status !== "cancelled");
  const done = tasks.filter(t => t.status === "done");

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ListChecks size={14} className="text-brand-400" /> Tasks ({open.length} open)
        </h3>
        {done.length > 0 && (
          <button type="button" onClick={() => setShowDone(s => !s)} className="text-xs text-muted-foreground hover:text-foreground">
            {showDone ? "Hide" : "Show"} completed ({done.length})
          </button>
        )}
      </div>

      <form className="flex gap-2 mb-3" onSubmit={e => { e.preventDefault(); void add(); }}>
        <label className="sr-only" htmlFor={`ct-${orgId}`}>New task for this customer</label>
        <input id={`ct-${orgId}`} value={title} onChange={e => setTitle(e.target.value)} placeholder="Add a task for this customer…"
          className="flex-1 h-9 px-3 text-sm rounded-lg border border-border bg-background" />
        <button type="submit" disabled={busy || !title.trim()} className="h-9 px-3 text-sm rounded-lg bg-[#0071E3] text-white disabled:opacity-40 flex items-center gap-1">
          <Plus size={14} /> Add
        </button>
      </form>
      {err && <p role="alert" className="text-xs text-red-600 mb-2">{err}</p>}

      {!loaded ? <p className="text-sm text-muted-foreground">Loading…</p>
        : open.length === 0 && !showDone ? <p className="text-sm text-muted-foreground">No open tasks for this customer.</p>
        : (
          <ul className="divide-y divide-border">
            {[...open, ...(showDone ? done : [])].map(t => {
              const isDone = t.status === "done";
              const late = !isDone && t.due_date && t.due_date < today();
              return (
                <li key={t.id} className="flex items-center gap-3 py-2">
                  <button type="button" aria-label={isDone ? "Completed" : `Complete ${t.title}`} disabled={isDone} onClick={() => void complete(t.id)}
                    className={`shrink-0 ${isDone ? "text-emerald-600" : "text-muted-foreground hover:text-emerald-600"}`}>
                    <CheckCircle2 size={16} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm truncate ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[t.key, t.assigned_to_name, isDone ? `Done ${fmt(t.completed_at ?? null)}` : t.due_date ? `Due ${fmt(t.due_date)}` : null].filter(Boolean).join(" · ")}
                      {late && <span className="text-red-600"> · Overdue</span>}
                    </p>
                  </div>
                  <a href={`/?task=${t.id}`} className="text-muted-foreground hover:text-foreground" aria-label={`Open ${t.title} in Tasks`}><ExternalLink size={14} /></a>
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );
}
