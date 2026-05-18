"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Plus, Check, Trash2, Calendar, User, ChevronDown,
  Loader2, AlertCircle, RefreshCw,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { CheckSquare, Circle, Clock3, Link2, Flag } = require("lucide-react") as any;

interface Todo {
  id: string;
  title: string;
  body: string | null;
  priority: "high" | "normal" | "low";
  status: "open" | "in_progress" | "done";
  due_date: string | null;
  created_by: string;
  created_by_name: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  linked_type: string | null;
  linked_label: string | null;
  completed_at: string | null;
  created_at: string;
}

const PRIORITY_CONFIG = {
  high:   { label: "High",   color: "text-red-400",    bg: "bg-red-400/10",    border: "border-red-400/30" },
  normal: { label: "Normal", color: "text-amber-400",  bg: "bg-amber-400/10",  border: "border-amber-400/30" },
  low:    { label: "Low",    color: "text-slate-400",  bg: "bg-slate-400/10",  border: "border-slate-400/30" },
};

const STATUS_CONFIG = {
  open:        { label: "Open",        color: "text-muted-foreground" },
  in_progress: { label: "In Progress", color: "text-brand-400" },
  done:        { label: "Done",        color: "text-emerald-400" },
};

function prioritySort(a: Todo, b: Todo) {
  const order = { high: 0, normal: 1, low: 2 };
  return order[a.priority] - order[b.priority];
}

function dueDateLabel(due: string | null): { text: string; color: string } | null {
  if (!due) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(due + "T00:00:00");
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0)  return { text: `${Math.abs(diff)}d overdue`, color: "text-red-400" };
  if (diff === 0) return { text: "Due today",     color: "text-amber-400" };
  if (diff === 1) return { text: "Due tomorrow",  color: "text-amber-400" };
  return { text: `Due ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, color: "text-muted-foreground" };
}

function TodoRow({
  todo,
  onToggleDone,
  onDelete,
  onPriorityChange,
}: {
  todo: Todo;
  onToggleDone: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onPriorityChange: (id: string, priority: "high" | "normal" | "low") => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const isDone = todo.status === "done";
  const dueLabel = dueDateLabel(todo.due_date);
  const pCfg = PRIORITY_CONFIG[todo.priority];

  return (
    <div className={`group flex items-start gap-3 px-4 py-3 rounded-xl border transition-all ${
      isDone
        ? "border-border/50 bg-card/50 opacity-60"
        : "border-border bg-card hover:border-brand-400/30"
    }`}>
      {/* Checkbox */}
      <button
        onClick={() => onToggleDone(todo.id, !isDone)}
        className={`mt-0.5 w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
          isDone
            ? "border-emerald-400 bg-emerald-400"
            : "border-border hover:border-brand-400"
        }`}
      >
        {isDone && <Check size={10} className="text-white" strokeWidth={3} />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {todo.title}
        </p>
        {todo.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{todo.body}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          {/* Priority badge */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(v => !v)}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${pCfg.bg} ${pCfg.color} ${pCfg.border}`}
            >
              <Flag size={8} />
              {pCfg.label}
              <ChevronDown size={8} />
            </button>
            {showMenu && (
              <div className="absolute z-20 top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[100px]">
                {(["high", "normal", "low"] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => { onPriorityChange(todo.id, p); setShowMenu(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors ${PRIORITY_CONFIG[p].color}`}
                  >
                    {PRIORITY_CONFIG[p].label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Due date */}
          {dueLabel && (
            <span className={`inline-flex items-center gap-1 text-[10px] ${dueLabel.color}`}>
              <Clock3 size={9} />
              {dueLabel.text}
            </span>
          )}

          {/* Assignee */}
          {todo.assigned_to_name && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <User size={9} />
              {todo.assigned_to_name}
            </span>
          )}

          {/* Linked record */}
          {todo.linked_label && (
            <span className="inline-flex items-center gap-1 text-[10px] text-brand-400/70">
              <Link2 size={9} />
              {todo.linked_label}
            </span>
          )}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(todo.id)}
        className="opacity-0 group-hover:opacity-100 mt-0.5 p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function QuickAdd({ onAdd }: { onAdd: (title: string, priority: "high" | "normal" | "low", due_date: string) => void }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"high" | "normal" | "low">("normal");
  const [due, setDue] = useState("");
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function submit() {
    if (!title.trim()) return;
    onAdd(title.trim(), priority, due);
    setTitle("");
    setPriority("normal");
    setDue("");
    setExpanded(false);
  }

  return (
    <div className="bg-card border border-border rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Plus size={15} className="text-brand-400 shrink-0" />
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onFocus={() => setExpanded(true)}
          onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setExpanded(false); setTitle(""); } }}
          placeholder="Add a to-do… (press Enter to save)"
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
        />
        {title && (
          <button
            onClick={submit}
            className="px-3 py-1 rounded-lg bg-brand-400 text-white text-xs font-semibold hover:bg-brand-400/80 transition-colors"
          >
            Add
          </button>
        )}
      </div>

      {expanded && (
        <div className="flex items-center gap-3 pl-5">
          <div className="flex items-center gap-1">
            {(["high", "normal", "low"] as const).map(p => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                  priority === p
                    ? `${PRIORITY_CONFIG[p].bg} ${PRIORITY_CONFIG[p].color} ${PRIORITY_CONFIG[p].border}`
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {PRIORITY_CONFIG[p].label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar size={11} />
            <input
              type="date"
              value={due}
              onChange={e => setDue(e.target.value)}
              className="bg-transparent text-xs text-foreground outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"mine" | "assigned">("mine");
  const [filter, setFilter] = useState<"all" | "open" | "done">("open");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ view });
      if (filter !== "all") params.set("status", filter === "open" ? "open" : "done");
      const res  = await fetch(`/api/todos?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setTodos(data.todos ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [view, filter]);

  useEffect(() => { void load(); }, [load]);

  async function addTodo(title: string, priority: "high" | "normal" | "low", due_date: string) {
    const res  = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, priority, due_date: due_date || null }),
    });
    const data = await res.json();
    if (res.ok) setTodos(prev => [data, ...prev]);
  }

  async function toggleDone(id: string, done: boolean) {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, status: done ? "done" : "open" } : t));
    await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: done ? "done" : "open" }),
    });
  }

  async function deleteTodo(id: string) {
    setTodos(prev => prev.filter(t => t.id !== id));
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
  }

  async function changePriority(id: string, priority: "high" | "normal" | "low") {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, priority } : t));
    await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    });
  }

  // Split open vs done
  const open = todos.filter(t => t.status !== "done").sort(prioritySort);
  const done = todos.filter(t => t.status === "done");

  const openCount = open.length;
  const doneCount = done.length;
  const highCount = open.filter(t => t.priority === "high").length;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar
        title="To-Dos"
        subtitle="Personal tasks and team assignments"
        actions={
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-accent transition-colors"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        }
      />

      <div className="flex-1 p-6 space-y-5 max-w-3xl mx-auto w-full">

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Circle,      label: "Open",     value: openCount, color: "text-brand-400",   bg: "bg-brand-400/10" },
            { icon: AlertCircle, label: "High Pri",  value: highCount, color: "text-red-400",     bg: "bg-red-400/10" },
            { icon: CheckSquare, label: "Done",      value: doneCount, color: "text-emerald-400", bg: "bg-emerald-400/10" },
          ].map(card => (
            <div key={card.label} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon size={14} className={card.color} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{card.value}</p>
                <p className="text-[10px] text-muted-foreground">{card.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs + filter */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 bg-accent/40 p-1 rounded-lg">
            {(["mine", "assigned"] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  view === v
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {v === "mine" ? "My To-Dos" : "Assigned Out"}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-accent/40 p-1 rounded-lg">
            {(["open", "all", "done"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                  filter === f
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Quick add */}
        <QuickAdd onAdd={addTodo} />

        {/* List */}
        {loading && (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> Loading to-dos…
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-center gap-3 py-12">
            <span className="text-sm text-destructive">{error}</span>
            <button onClick={load} className="text-xs border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && todos.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <CheckSquare size={36} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">Nothing here — add your first to-do above.</p>
          </div>
        )}

        {!loading && !error && open.length > 0 && (
          <div className="space-y-2">
            {open.map(todo => (
              <TodoRow
                key={todo.id}
                todo={todo}
                onToggleDone={toggleDone}
                onDelete={deleteTodo}
                onPriorityChange={changePriority}
              />
            ))}
          </div>
        )}

        {!loading && !error && done.length > 0 && filter !== "open" && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
              Completed ({doneCount})
            </p>
            {done.map(todo => (
              <TodoRow
                key={todo.id}
                todo={todo}
                onToggleDone={toggleDone}
                onDelete={deleteTodo}
                onPriorityChange={changePriority}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
