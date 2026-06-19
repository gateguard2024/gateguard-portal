"use client";

// L10 weekly meeting runner (#71) — runs the standard 90-minute Level 10 agenda
// with per-segment timers, pulling LIVE data from the existing EOS endpoints
// (rocks / scorecard / issues / todos). Actions (rock status, IDS solve, add
// to-do) reuse the same APIs the EOS page uses — no new tables.
import { useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { CheckCircle2, Circle, Plus, ChevronLeft, ChevronRight, Clock } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Play, Pause } = require("lucide-react") as any;

type AnyRec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const SEGMENTS: { key: string; label: string; min: number; blurb: string }[] = [
  { key: "segue",     label: "Segue",            min: 5,  blurb: "Share one personal + one business good-news headline from each person." },
  { key: "scorecard", label: "Scorecard",        min: 5,  blurb: "Read each number. On-track or off-track only — drop off-track ones to Issues." },
  { key: "rocks",     label: "Rock Review",      min: 5,  blurb: "Each rock is On Track or Off Track. Off-track rocks drop to the Issues list." },
  { key: "headlines", label: "Customer / Employee Headlines", min: 5, blurb: "Quick headlines only. Anything needing discussion drops to Issues." },
  { key: "todos",     label: "To-Do List",       min: 5,  blurb: "Review last week's to-dos. Done or not done. 7-day completion is the goal." },
  { key: "ids",       label: "IDS — Identify, Discuss, Solve", min: 60, blurb: "Prioritize the top issues. Solve them one at a time. Capture to-dos." },
  { key: "conclude",  label: "Conclude",         min: 5,  blurb: "Recap to-dos, cascading messages, and rate the meeting 1–10." },
];

const fmt = (s: number) => `${s < 0 ? "-" : ""}${String(Math.floor(Math.abs(s) / 60)).padStart(2, "0")}:${String(Math.abs(s) % 60).padStart(2, "0")}`;
const meetingLabel = () => `L10 ${new Date().toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}`;

export default function L10RunnerPage() {
  const [rocks, setRocks] = useState<AnyRec[]>([]);
  const [measurables, setMeasurables] = useState<AnyRec[]>([]);
  const [issues, setIssues] = useState<AnyRec[]>([]);
  const [todos, setTodos] = useState<AnyRec[]>([]);
  const [loading, setLoading] = useState(true);

  const [seg, setSeg] = useState(0);
  const [running, setRunning] = useState(false);
  const [segLeft, setSegLeft] = useState(SEGMENTS[0].min * 60);
  const [total, setTotal] = useState(0);
  const [rating, setRating] = useState<number | null>(null);
  const [solvedCount, setSolvedCount] = useState(0);
  const [createdTodos, setCreatedTodos] = useState(0);
  const startedRef = useRef(false);

  // Load live EOS data.
  useEffect(() => {
    void Promise.all([
      fetch("/api/eos/rocks").then(r => r.ok ? r.json() : []),
      fetch("/api/eos/scorecard").then(r => r.ok ? r.json() : []),
      fetch("/api/eos/issues").then(r => r.ok ? r.json() : []),
      fetch("/api/eos/todos").then(r => r.ok ? r.json() : []),
    ]).then(([r, s, i, t]) => {
      setRocks(Array.isArray(r) ? r : []);
      setMeasurables(Array.isArray(s) ? s : []);
      setIssues(Array.isArray(i) ? i : []);
      setTodos(Array.isArray(t) ? t : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Tick: count segment down + total up while running.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => { setSegLeft(s => s - 1); setTotal(t => t + 1); }, 1000);
    return () => clearInterval(id);
  }, [running]);

  function start() { setRunning(true); startedRef.current = true; }
  function goSeg(i: number) {
    const clamped = Math.max(0, Math.min(SEGMENTS.length - 1, i));
    setSeg(clamped); setSegLeft(SEGMENTS[clamped].min * 60);
  }

  // ── actions (reuse EOS APIs) ──
  function setRockStatus(id: string, status: string) {
    setRocks(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    void fetch(`/api/eos/rocks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => {});
  }
  function toggleTodo(id: string, done: boolean) {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done } : t));
    void fetch(`/api/eos/todos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done }) }).catch(() => {});
  }
  function solveIssue(id: string) {
    setIssues(prev => prev.map(i => i.id === id ? { ...i, status: "Resolved" } : i));
    setSolvedCount(c => c + 1);
    void fetch(`/api/eos/issues/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "Resolved" }) }).catch(() => {});
  }
  async function addIssue(description: string) {
    if (!description.trim()) return;
    const body = { description: description.trim(), type: "Company", priority: "Normal", status: "Open", owner: "RF" };
    const created = await fetch("/api/eos/issues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.ok ? r.json() : null).catch(() => null);
    if (created) setIssues(prev => [created, ...prev]);
  }
  async function addTodo(text: string) {
    if (!text.trim()) return;
    const body = { text: text.trim(), owner: "RF", due_date: null, meeting: meetingLabel() };
    const created = await fetch("/api/eos/todos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.ok ? r.json() : null).catch(() => null);
    if (created) { setTodos(prev => [created, ...prev]); setCreatedTodos(c => c + 1); }
  }

  const cur = SEGMENTS[seg];
  const over = segLeft < 0;

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <TopBar title="Level 10 Meeting" subtitle="Run the weekly L10 — same agenda, every week, on the clock" />
      <div className="flex-1 p-6 max-w-5xl mx-auto w-full">
        {/* Agenda stepper */}
        <div className="flex flex-wrap items-center gap-1.5 mb-5">
          {SEGMENTS.map((s, i) => (
            <button key={s.key} onClick={() => goSeg(i)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${i === seg ? "bg-[#6B7EFF] text-white border-[#6B7EFF]" : i < seg ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-muted-foreground border-border"}`}>
              {i + 1}. {s.label.split(" — ")[0]} <span className="opacity-60">· {s.min}m</span>
            </button>
          ))}
        </div>

        {/* Timer bar */}
        <div className="flex items-center justify-between bg-white border border-border rounded-xl p-4 mb-5">
          <div>
            <div className="text-xs text-muted-foreground">Current segment</div>
            <div className="text-lg font-bold text-foreground">{cur.label}</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Segment</div>
              <div className={`text-2xl font-bold tabular-nums ${over ? "text-red-600" : "text-foreground"}`}>{fmt(segLeft)}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
              <div className="text-2xl font-bold tabular-nums text-[#6B7EFF]">{fmt(total)}</div>
            </div>
            <button onClick={() => setRunning(r => !r)} className="flex items-center gap-1.5 text-sm font-semibold bg-[#6B7EFF] text-white px-4 py-2 rounded-lg">
              {running ? <Pause size={15} /> : <Play size={15} />}{running ? "Pause" : startedRef.current ? "Resume" : "Start"}
            </button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4">{cur.blurb}</p>

        {/* Segment body */}
        <div className="bg-white border border-border rounded-xl p-5 min-h-[320px]">
          {loading ? <p className="text-sm text-muted-foreground">Loading meeting data…</p> : (
            <>
              {cur.key === "segue" && <Segue />}
              {cur.key === "scorecard" && <ScorecardPanel measurables={measurables} onDrop={addIssue} />}
              {cur.key === "rocks" && <RocksPanel rocks={rocks} onStatus={setRockStatus} onDrop={addIssue} />}
              {cur.key === "headlines" && <HeadlinesPanel onDrop={addIssue} />}
              {cur.key === "todos" && <TodosPanel todos={todos} onToggle={toggleTodo} />}
              {cur.key === "ids" && <IdsPanel issues={issues} onSolve={solveIssue} onAddIssue={addIssue} onAddTodo={addTodo} />}
              {cur.key === "conclude" && <ConcludePanel rating={rating} setRating={setRating} solved={solvedCount} created={createdTodos} todos={todos} />}
            </>
          )}
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between mt-5">
          <button onClick={() => goSeg(seg - 1)} disabled={seg === 0} className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-border bg-white disabled:opacity-40"><ChevronLeft size={15} /> Back</button>
          {!running && !startedRef.current
            ? <button onClick={start} className="flex items-center gap-1.5 text-sm font-semibold bg-[#6B7EFF] text-white px-5 py-2 rounded-lg"><Play size={15} /> Start meeting</button>
            : <button onClick={() => goSeg(seg + 1)} disabled={seg === SEGMENTS.length - 1} className="flex items-center gap-1.5 text-sm font-semibold bg-[#6B7EFF] text-white px-5 py-2 rounded-lg disabled:opacity-40">Next segment <ChevronRight size={15} /></button>}
        </div>
      </div>
    </div>
  );
}

function Segue() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Clock size={15} className="text-[#6B7EFF]" /> Good news, around the room</div>
      <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
        <li>One <b>personal</b> good-news headline per person.</li>
        <li>One <b>business</b> good-news headline per person.</li>
        <li>Keep it light and fast — this sets the tone. No problem-solving yet.</li>
      </ul>
    </div>
  );
}

function DropToIssue({ onDrop }: { onDrop: (s: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex gap-2 mt-4">
      <input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && v.trim()) { onDrop(v); setV(""); } }} placeholder="Drop something to the Issues list…" className="flex-1 text-sm border border-border rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-[#6B7EFF]/30" />
      <button onClick={() => { if (v.trim()) { onDrop(v); setV(""); } }} className="flex items-center gap-1 text-sm font-medium bg-[#6B7EFF]/10 text-[#6B7EFF] border border-[#6B7EFF]/20 px-3 py-2 rounded-lg"><Plus size={14} /> To Issues</button>
    </div>
  );
}

function ScorecardPanel({ measurables, onDrop }: { measurables: AnyRec[]; onDrop: (s: string) => void }) {
  if (measurables.length === 0) return <EmptyDrop label="No scorecard measurables yet." onDrop={onDrop} />;
  return (
    <div>
      <div className="divide-y divide-border">
        {measurables.map(m => {
          const latest = m.entries?.[m.entries.length - 1]?.value ?? "—";
          return (
            <div key={m.id} className="flex items-center justify-between py-2.5">
              <div><div className="text-sm font-medium text-foreground">{m.name}</div><div className="text-xs text-muted-foreground">{m.owner} · goal {m.goal}{m.unit ? ` ${m.unit}` : ""}</div></div>
              <div className="text-sm font-semibold tabular-nums text-foreground">{latest}</div>
            </div>
          );
        })}
      </div>
      <DropToIssue onDrop={onDrop} />
    </div>
  );
}

function RocksPanel({ rocks, onStatus, onDrop }: { rocks: AnyRec[]; onStatus: (id: string, s: string) => void; onDrop: (s: string) => void }) {
  if (rocks.length === 0) return <EmptyDrop label="No rocks this quarter." onDrop={onDrop} />;
  return (
    <div>
      <div className="space-y-2">
        {rocks.map(r => {
          const off = r.status === "Off Track" || r.status === "At Risk";
          return (
            <div key={r.id} className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2.5">
              <div className="min-w-0"><div className="text-sm font-medium text-foreground truncate">{r.name}</div><div className="text-xs text-muted-foreground">{r.owner}{r.due_date ? ` · due ${String(r.due_date).slice(0, 10)}` : ""}</div></div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => onStatus(r.id, "On Track")} className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${!off ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-muted-foreground border-border"}`}>On Track</button>
                <button onClick={() => onStatus(r.id, "Off Track")} className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${off ? "bg-red-50 text-red-700 border-red-200" : "bg-white text-muted-foreground border-border"}`}>Off Track</button>
              </div>
            </div>
          );
        })}
      </div>
      <DropToIssue onDrop={onDrop} />
    </div>
  );
}

function HeadlinesPanel({ onDrop }: { onDrop: (s: string) => void }) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">Quick customer + employee headlines. Anything that needs discussion → drop it to Issues.</div>
      <DropToIssue onDrop={onDrop} />
    </div>
  );
}

function TodosPanel({ todos, onToggle }: { todos: AnyRec[]; onToggle: (id: string, done: boolean) => void }) {
  const open = todos.filter(t => !t.done);
  const pct = todos.length ? Math.round(((todos.length - open.length) / todos.length) * 100) : 0;
  if (todos.length === 0) return <p className="text-sm text-muted-foreground">No to-dos on the list. Capture new ones during IDS.</p>;
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-3">{todos.length - open.length}/{todos.length} done · {pct}% completion (target 90%+)</div>
      <div className="space-y-1.5">
        {todos.map(t => (
          <button key={t.id} onClick={() => onToggle(t.id, !t.done)} className="flex items-center gap-2.5 w-full text-left border border-border rounded-lg px-3 py-2 bg-white">
            {t.done ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : <Circle size={16} className="text-muted-foreground shrink-0" />}
            <span className={`text-sm ${t.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.text}</span>
            <span className="ml-auto text-xs text-muted-foreground shrink-0">{t.owner}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function IdsPanel({ issues, onSolve, onAddIssue, onAddTodo }: { issues: AnyRec[]; onSolve: (id: string) => void; onAddIssue: (s: string) => void; onAddTodo: (s: string) => void }) {
  const RANK: Record<string, number> = { Critical: 0, High: 1, Normal: 2 };
  const open = [...issues].filter(i => i.status !== "Resolved").sort((a, b) => (RANK[a.priority] ?? 3) - (RANK[b.priority] ?? 3));
  const [td, setTd] = useState("");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><div className="text-sm font-semibold text-foreground">Open issues · {open.length}</div></div>
      {open.length === 0 ? <p className="text-sm text-muted-foreground">No open issues. 🎉</p> : (
        <div className="space-y-2">
          {open.map((i, idx) => (
            <div key={i.id} className="flex items-center gap-3 border border-border rounded-lg px-3 py-2.5">
              <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}</span>
              <div className="min-w-0 flex-1"><div className="text-sm font-medium text-foreground">{i.description}</div><div className="text-xs text-muted-foreground">{i.priority} · {i.type} · {i.owner}</div></div>
              <button onClick={() => onSolve(i.id)} className="shrink-0 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg">Solved ✓</button>
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-border pt-3 space-y-2">
        <DropToIssue onDrop={onAddIssue} />
        <div className="flex gap-2">
          <input value={td} onChange={e => setTd(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && td.trim()) { onAddTodo(td); setTd(""); } }} placeholder="Capture a to-do from this issue…" className="flex-1 text-sm border border-border rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-[#6B7EFF]/30" />
          <button onClick={() => { if (td.trim()) { onAddTodo(td); setTd(""); } }} className="flex items-center gap-1 text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-2 rounded-lg"><Plus size={14} /> To-Do</button>
        </div>
      </div>
    </div>
  );
}

function ConcludePanel({ rating, setRating, solved, created, todos }: { rating: number | null; setRating: (n: number) => void; solved: number; created: number; todos: AnyRec[] }) {
  const openTodos = todos.filter(t => !t.done).length;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Issues solved" value={solved} color="text-emerald-600" />
        <Stat label="To-dos created" value={created} color="text-[#6B7EFF]" />
        <Stat label="Open to-dos" value={openTodos} color="text-amber-600" />
      </div>
      <div>
        <div className="text-sm font-semibold text-foreground mb-2">Rate the meeting (1–10)</div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 10 }, (_, n) => n + 1).map(n => (
            <button key={n} onClick={() => setRating(n)} className={`w-9 h-9 rounded-lg text-sm font-semibold border ${rating === n ? "bg-[#6B7EFF] text-white border-[#6B7EFF]" : "bg-white text-muted-foreground border-border"}`}>{n}</button>
          ))}
        </div>
        {rating != null && <p className="text-xs text-muted-foreground mt-2">Meeting rated {rating}/10. Aim for an 8+ — if it&apos;s lower, the lowest scorer says why.</p>}
      </div>
      <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
        <li>Recap every new to-do and who owns it.</li>
        <li>Decide any cascading messages for the team.</li>
        <li>End on time.</li>
      </ul>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return <div className="border border-border rounded-lg p-3 text-center"><div className={`text-2xl font-bold ${color}`}>{value}</div><div className="text-xs text-muted-foreground mt-0.5">{label}</div></div>;
}

function EmptyDrop({ label, onDrop }: { label: string; onDrop: (s: string) => void }) {
  return <div><p className="text-sm text-muted-foreground">{label}</p><DropToIssue onDrop={onDrop} /></div>;
}
