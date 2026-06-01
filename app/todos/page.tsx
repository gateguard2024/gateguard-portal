"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Plus, Check, Trash2, Calendar, User, ChevronDown, ChevronRight,
  Loader2, RefreshCw, X, Upload, FileText, Download, Search,
  Star, Zap, AlertTriangle, CheckCircle2, ClipboardList, Filter,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Repeat, Link2, CheckSquare, Paperclip } = require("lucide-react") as any;
import { EmptyState } from "@/components/ui/EmptyState";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Attachment {
  id: string;
  name: string;
  url: string;
  size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
}

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
  linked_id: string | null;
  linked_label: string | null;
  recurrence_type: "none" | "daily" | "weekly" | "monthly" | "yearly";
  recurrence_interval: number;
  recurrence_ends_at: string | null;
  completed_at: string | null;
  created_at: string;
  todo_attachments?: Attachment[];
}

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  type: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  open:        { label: "Haven't started", dot: "bg-blue-500",   text: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200" },
  in_progress: { label: "Working on it",   dot: "bg-amber-500",  text: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200" },
  done:        { label: "Done",            dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
};

const PRIORITY_STARS: Record<Todo["priority"], number> = { high: 4, normal: 3, low: 2 };

const PRIORITY_CONFIG = {
  high:   { label: "High",   color: "text-red-500",   bg: "bg-red-50",   border: "border-red-200" },
  normal: { label: "Normal", color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-200" },
  low:    { label: "Low",    color: "text-slate-400", bg: "bg-slate-50", border: "border-slate-200" },
};

const LINKED_TYPES = [
  { value: "lead",        label: "Lead" },
  { value: "opportunity", label: "Opportunity" },
  { value: "customer",    label: "Customer" },
  { value: "property",    label: "Property" },
  { value: "dealer",      label: "Dealer" },
];

const RECURRENCE_OPTIONS = [
  { value: "none",    label: "Does not repeat" },
  { value: "daily",   label: "Daily" },
  { value: "weekly",  label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly",  label: "Yearly" },
];

const GROUPS: { key: string; label: string; color: string; linked_types: (string | null)[] }[] = [
  { key: "inbox",     label: "Task Inbox",                  color: "#6B7EFF", linked_types: [null] },
  { key: "opps",      label: "Connected Opportunities",     color: "#0891B2", linked_types: ["opportunity", "property"] },
  { key: "customers", label: "Customer Service Items",      color: "#059669", linked_types: ["customer"] },
  { key: "leads",     label: "Lead Follow-ups",             color: "#EA580C", linked_types: ["lead"] },
  { key: "dealers",   label: "Dealer Items",                color: "#7C3AED", linked_types: ["dealer"] },
];

type ViewMode = "list" | "kanban";

// ─── Utilities ────────────────────────────────────────────────────────────────

function prioritySort(a: Todo, b: Todo) {
  const order: Record<Todo["priority"], number> = { high: 0, normal: 1, low: 2 };
  return order[a.priority] - order[b.priority];
}

function dueDateLabel(due: string | null): { text: string; color: string } | null {
  if (!due) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(due + "T00:00:00");
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0)   return { text: `${Math.abs(diff)}d overdue`, color: "text-red-600" };
  if (diff === 0) return { text: "Due today",    color: "text-amber-600" };
  if (diff === 1) return { text: "Due tomorrow", color: "text-amber-600" };
  return { text: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), color: "text-slate-500" };
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({ priority }: { priority: Todo["priority"] }) {
  const count = PRIORITY_STARS[priority];
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={11}
          className={i < count ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200"}
        />
      ))}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({
  status,
  onClick,
}: {
  status: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.open;
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap transition-all hover:brightness-95 ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} shrink-0`} />
      {cfg.label}
    </button>
  );
}

// ─── Group Progress Bar ───────────────────────────────────────────────────────

function GroupProgressBar({ todos }: { todos: Todo[] }) {
  const total  = todos.length;
  if (total === 0) return null;
  const open   = todos.filter(t => t.status === "open").length;
  const inProg = todos.filter(t => t.status === "in_progress").length;
  const done   = todos.filter(t => t.status === "done").length;
  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden flex min-w-0">
        <div className="bg-blue-400 h-full transition-all"   style={{ width: `${(open   / total) * 100}%` }} />
        <div className="bg-amber-400 h-full transition-all" style={{ width: `${(inProg / total) * 100}%` }} />
        <div className="bg-emerald-400 h-full transition-all" style={{ width: `${(done  / total) * 100}%` }} />
      </div>
      <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
        {done}/{total} done
      </span>
    </div>
  );
}

// ─── Linked Record Picker ─────────────────────────────────────────────────────

function LinkedRecordPicker({
  value,
  onChange,
}: {
  value: { type: string; id: string; label: string } | null;
  onChange: (v: { type: string; id: string; label: string } | null) => void;
}) {
  const [recordType, setRecordType] = useState(value?.type ?? "lead");
  const [query, setQuery] = useState(value?.label ?? "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const res = await fetch(`/api/todos/search-records?q=${encodeURIComponent(query)}&type=${recordType}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setOpen(true);
    }, 300);
  }, [query, recordType]);

  function select(r: SearchResult) {
    onChange({ type: r.type, id: r.id, label: r.label });
    setQuery(r.label);
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setQuery("");
    setResults([]);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select
          value={recordType}
          onChange={e => { setRecordType(e.target.value); setQuery(""); onChange(null); }}
          className="flex-shrink-0 bg-accent border border-border rounded-lg px-2 py-1.5 text-xs text-foreground outline-none"
        >
          {LINKED_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <div className="relative flex-1">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); if (!e.target.value) onChange(null); }}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder={`Search ${recordType}s…`}
            className="w-full pl-7 pr-7 py-1.5 bg-accent border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-brand-400/50"
          />
          {query && (
            <button onClick={clear} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={11} />
            </button>
          )}
          {open && results.length > 0 && (
            <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
              {results.map(r => (
                <button
                  key={r.id}
                  onMouseDown={() => select(r)}
                  className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b border-border/50 last:border-0"
                >
                  <p className="text-xs font-medium text-foreground">{r.label}</p>
                  {r.sublabel && <p className="text-[10px] text-muted-foreground">{r.sublabel}</p>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {value && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-brand-400/10 border border-brand-400/20 rounded-lg">
          <Link2 size={10} className="text-brand-400" />
          <span className="text-[11px] text-brand-400 font-medium">{value.label}</span>
          <span className="text-[10px] text-muted-foreground capitalize ml-1">({value.type})</span>
          <button onClick={clear} className="ml-auto text-muted-foreground hover:text-foreground">
            <X size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Detail Slide-Over ────────────────────────────────────────────────────────

function TodoSlideOver({
  todo,
  onClose,
  onSave,
  onDelete,
}: {
  todo: Todo;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Todo>) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle]         = useState(todo.title);
  const [body, setBody]           = useState(todo.body ?? "");
  const [priority, setPriority]   = useState(todo.priority);
  const [dueDate, setDueDate]     = useState(todo.due_date ?? "");
  const [assignee, setAssignee]   = useState(todo.assigned_to_name ?? "");
  const [linked, setLinked]       = useState<{ type: string; id: string; label: string } | null>(
    todo.linked_id ? { type: todo.linked_type ?? "lead", id: todo.linked_id, label: todo.linked_label ?? "" } : null
  );
  const [recType, setRecType]     = useState(todo.recurrence_type ?? "none");
  const [recInterval, setRecInterval] = useState(todo.recurrence_interval ?? 1);
  const [recEnds, setRecEnds]     = useState(todo.recurrence_ends_at ?? "");
  const [attachments, setAttachments] = useState<Attachment[]>(todo.todo_attachments ?? []);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef                   = useRef<HTMLInputElement>(null);

  async function save() {
    setSaving(true);
    await onSave(todo.id, {
      title,
      body: body || null,
      priority,
      due_date: dueDate || null,
      assigned_to_name: assignee || null,
      linked_type: linked?.type ?? null,
      linked_id: linked?.id ?? null,
      linked_label: linked?.label ?? null,
      recurrence_type: recType as Todo["recurrence_type"],
      recurrence_interval: recInterval,
      recurrence_ends_at: recEnds || null,
    });
    setSaving(false);
    onClose();
  }

  async function uploadFile(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res  = await fetch(`/api/todos/${todo.id}/attachments`, { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) setAttachments(prev => [...prev, data]);
    setUploading(false);
  }

  async function deleteAttachment(attachId: string) {
    await fetch(`/api/todos/${todo.id}/attachments?attachment_id=${attachId}`, { method: "DELETE" });
    setAttachments(prev => prev.filter(a => a.id !== attachId));
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-md bg-background border-l border-border flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Task Details</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDelete(todo.id)}
              className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
            >
              <Trash2 size={14} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-accent border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-brand-400/50"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Notes</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={4}
              placeholder="Add notes, context, or details…"
              className="w-full bg-accent border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-brand-400/50 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as Todo["priority"])}
                className="w-full bg-accent border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none"
              >
                {(["high", "normal", "low"] as const).map(p => (
                  <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full bg-accent border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Assign To</label>
            <input
              value={assignee}
              onChange={e => setAssignee(e.target.value)}
              placeholder="Enter name or email…"
              className="w-full bg-accent border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-brand-400/50"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Link to Record</label>
            <LinkedRecordPicker value={linked} onChange={setLinked} />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Repeat size={10} /> Recurrence
            </label>
            <select
              value={recType}
              onChange={e => setRecType(e.target.value as Todo["recurrence_type"])}
              className="w-full bg-accent border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none mb-2"
            >
              {RECURRENCE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {recType !== "none" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Every</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={recInterval}
                      onChange={e => setRecInterval(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 bg-accent border border-border rounded-lg px-2 py-1.5 text-sm text-foreground outline-none text-center"
                    />
                    <span className="text-xs text-muted-foreground capitalize">{recType.replace("ly","")}{recInterval > 1 ? "s" : ""}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Ends on</label>
                  <input
                    type="date"
                    value={recEnds}
                    onChange={e => setRecEnds(e.target.value)}
                    className="w-full bg-accent border border-border rounded-lg px-2 py-1.5 text-xs text-foreground outline-none"
                  />
                </div>
              </div>
            )}
            {recType !== "none" && (
              <p className="text-[10px] text-muted-foreground mt-2">
                When completed, the next occurrence is created automatically.
              </p>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Paperclip size={10} /> Attachments
              </label>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-400/80 transition-colors"
              >
                {uploading ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                Upload
              </button>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }}
              />
            </div>
            {attachments.length === 0 ? (
              <div
                onClick={() => fileRef.current?.click()}
                className="border border-dashed border-border rounded-lg p-4 text-center text-muted-foreground/50 text-xs cursor-pointer hover:border-brand-400/30 hover:text-muted-foreground transition-colors"
              >
                Drop files or click Upload
              </div>
            ) : (
              <div className="space-y-1.5">
                {attachments.map(a => (
                  <div key={a.id} className="flex items-center gap-2 px-3 py-2 bg-accent rounded-lg group">
                    <FileText size={12} className="text-brand-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate">{a.name}</p>
                      {a.size_bytes && <p className="text-[10px] text-muted-foreground">{formatBytes(a.size_bytes)}</p>}
                    </div>
                    <a href={a.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                      <Download size={12} />
                    </a>
                    <button
                      onClick={() => deleteAttachment(a.id)}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-brand-400 text-white text-sm font-semibold hover:bg-brand-400/80 transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Table Header ─────────────────────────────────────────────────────────────

function TableHeader() {
  return (
    <div
      className="grid items-center bg-slate-50 border-b border-slate-100"
      style={{ gridTemplateColumns: "44px 1fr 148px 128px 160px 100px 116px 44px" }}
    >
      <div className="py-2.5" />
      <div className="py-2.5 pr-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Task</div>
      <div className="py-2.5 pr-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Source</div>
      <div className="py-2.5 pr-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned To</div>
      <div className="py-2.5 pr-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</div>
      <div className="py-2.5 pr-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Priority</div>
      <div className="py-2.5 pr-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Due Date</div>
      <div className="py-2.5" />
    </div>
  );
}

// ─── Status Cycle Button ──────────────────────────────────────────────────────

function StatusCycleButton({
  todo,
  onStatusClick,
}: {
  todo: Todo;
  onStatusClick: (id: string, status: Todo["status"]) => void;
}) {
  const statuses: Todo["status"][] = ["open", "in_progress", "done"];
  const next = statuses[(statuses.indexOf(todo.status) + 1) % statuses.length];
  return (
    <StatusBadge
      status={todo.status}
      onClick={e => { e.stopPropagation(); onStatusClick(todo.id, next); }}
    />
  );
}

// ─── Table Row ────────────────────────────────────────────────────────────────

function TodoTableRow({
  todo,
  onToggleDone,
  onDelete,
  onClick,
  onStatusClick,
}: {
  todo: Todo;
  onToggleDone: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onClick: (todo: Todo) => void;
  onStatusClick: (id: string, status: Todo["status"]) => void;
}) {
  const isDone   = todo.status === "done";
  const dueLabel = dueDateLabel(todo.due_date);

  return (
    <div
      className={`group grid items-center border-b border-slate-100 last:border-0 transition-colors cursor-pointer ${
        isDone ? "bg-slate-50/40 opacity-70 hover:opacity-90" : "bg-white hover:bg-slate-50/50"
      }`}
      style={{ gridTemplateColumns: "44px 1fr 148px 128px 160px 100px 116px 44px" }}
      onClick={() => onClick(todo)}
    >
      {/* Checkbox */}
      <div className="flex items-center justify-center py-3.5">
        <button
          onClick={e => { e.stopPropagation(); onToggleDone(todo.id, !isDone); }}
          className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
            isDone
              ? "border-emerald-400 bg-emerald-400"
              : "border-slate-300 hover:border-[#6B7EFF]"
          }`}
        >
          {isDone && <Check size={9} className="text-white" strokeWidth={3} />}
        </button>
      </div>

      {/* Task */}
      <div className="py-3.5 pr-4 min-w-0">
        <p className={`text-[13px] font-medium leading-snug truncate ${
          isDone ? "line-through text-slate-400" : "text-slate-800"
        }`}>
          {todo.title}
        </p>
        {todo.body && (
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">{todo.body}</p>
        )}
        {(todo.recurrence_type && todo.recurrence_type !== "none") && (
          <span className="inline-flex items-center gap-1 text-[10px] text-violet-500 mt-0.5">
            <Repeat size={8} /> {todo.recurrence_type}
          </span>
        )}
      </div>

      {/* Source */}
      <div className="py-3.5 pr-4 min-w-0">
        {todo.linked_label ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-[#6B7EFF] font-medium truncate max-w-full">
            <Link2 size={9} className="shrink-0" />
            <span className="truncate">{todo.linked_label}</span>
          </span>
        ) : (
          <span className="text-[11px] text-slate-300">—</span>
        )}
      </div>

      {/* Assigned To */}
      <div className="py-3.5 pr-4 min-w-0">
        {todo.assigned_to_name ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-[#6B7EFF]/15 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-[#6B7EFF]">
                {todo.assigned_to_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-[11px] text-slate-600 truncate">{todo.assigned_to_name}</span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-300">Unassigned</span>
        )}
      </div>

      {/* Status */}
      <div className="py-3.5 pr-4" onClick={e => e.stopPropagation()}>
        <StatusCycleButton todo={todo} onStatusClick={onStatusClick} />
      </div>

      {/* Priority */}
      <div className="py-3.5 pr-4">
        <StarRating priority={todo.priority} />
        <span className="text-[9px] text-slate-400 mt-0.5 block">{PRIORITY_CONFIG[todo.priority].label}</span>
      </div>

      {/* Due Date */}
      <div className="py-3.5 pr-4">
        {dueLabel ? (
          <span className={`text-[11px] font-medium ${dueLabel.color}`}>{dueLabel.text}</span>
        ) : (
          <span className="text-[11px] text-slate-300">—</span>
        )}
      </div>

      {/* Actions */}
      <div className="py-3.5 flex items-center justify-center">
        <button
          onClick={e => { e.stopPropagation(); onDelete(todo.id); }}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 hover:text-red-400 text-slate-400 transition-all"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Todo Group ───────────────────────────────────────────────────────────────

function TodoGroup({
  label,
  color,
  todos,
  onToggleDone,
  onDelete,
  onClick,
  onStatusClick,
  onAddTodo,
}: {
  label: string;
  color: string;
  todos: Todo[];
  onToggleDone: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onClick: (todo: Todo) => void;
  onStatusClick: (id: string, status: Todo["status"]) => void;
  onAddTodo: (title: string) => void;
}) {
  const [open, setOpen]           = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [addingTitle, setAddingTitle] = useState("");

  const avgStars = todos.length
    ? Math.round(todos.reduce((sum, t) => sum + PRIORITY_STARS[t.priority], 0) / todos.length)
    : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
      {/* Group header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50/60 transition-colors text-left select-none"
        style={{ borderLeft: `3px solid ${color}` }}
        onClick={() => setOpen(v => !v)}
      >
        {open
          ? <ChevronDown size={14} className="text-slate-400 shrink-0" />
          : <ChevronRight size={14} className="text-slate-400 shrink-0" />
        }
        <span className="text-[13px] font-bold text-slate-700 flex-1">{label}</span>

        {/* Avg priority stars */}
        <div className="flex items-center gap-0.5 mr-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              size={9}
              className={i < avgStars ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200"}
            />
          ))}
        </div>

        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{ backgroundColor: `${color}18`, color }}
        >
          {todos.length} {todos.length === 1 ? "task" : "tasks"}
        </span>
      </button>

      {open && (
        <>
          <TableHeader />

          {/* Rows */}
          {todos.length === 0 ? (
            <div className="py-8 text-center text-[11px] text-slate-400">No tasks in this group yet</div>
          ) : (
            todos.map(todo => (
              <TodoTableRow
                key={todo.id}
                todo={todo}
                onToggleDone={onToggleDone}
                onDelete={onDelete}
                onClick={onClick}
                onStatusClick={onStatusClick}
              />
            ))
          )}

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/40 flex items-center gap-4">
            <GroupProgressBar todos={todos} />

            <button
              onClick={() => setShowAdd(v => !v)}
              className="flex items-center gap-1.5 text-[11px] font-semibold shrink-0 transition-colors hover:opacity-70"
              style={{ color }}
            >
              <Plus size={11} />
              Add task
            </button>

            <button
              className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-500 hover:text-violet-600 shrink-0 transition-colors"
            >
              <Zap size={11} />
              Add to L10
            </button>
          </div>

          {/* Inline add row */}
          {showAdd && (
            <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/60">
              <div className="flex items-center gap-2">
                <Plus size={12} className="text-slate-400 shrink-0" />
                <input
                  autoFocus
                  value={addingTitle}
                  onChange={e => setAddingTitle(e.target.value)}
                  placeholder="New task title…"
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-300 outline-none focus:border-[#6B7EFF]/40 focus:ring-2 focus:ring-[#6B7EFF]/10"
                  onKeyDown={e => {
                    if (e.key === "Enter" && addingTitle.trim()) {
                      onAddTodo(addingTitle.trim());
                      setAddingTitle("");
                      setShowAdd(false);
                    }
                    if (e.key === "Escape") { setShowAdd(false); setAddingTitle(""); }
                  }}
                />
                <button
                  disabled={!addingTitle.trim()}
                  onClick={() => {
                    if (addingTitle.trim()) {
                      onAddTodo(addingTitle.trim());
                      setAddingTitle("");
                      setShowAdd(false);
                    }
                  }}
                  className="px-3 py-1.5 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors hover:opacity-90"
                  style={{ backgroundColor: color }}
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowAdd(false); setAddingTitle(""); }}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Kanban View ──────────────────────────────────────────────────────────────

function KanbanView({
  todos,
  onToggleDone,
  onDelete,
  onClick,
}: {
  todos: Todo[];
  onToggleDone: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onClick: (todo: Todo) => void;
}) {
  const columns: { key: Todo["status"]; label: string; color: string }[] = [
    { key: "open",        label: "Haven't Started", color: "#6B7EFF" },
    { key: "in_progress", label: "Working On It",   color: "#F59E0B" },
    { key: "done",        label: "Done",             color: "#10B981" },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {columns.map(col => {
        const colTodos = todos.filter(t => t.status === col.key);
        return (
          <div key={col.key} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div
              className="px-4 py-3 border-b border-slate-100"
              style={{ borderTop: `3px solid ${col.color}` }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-slate-700">{col.label}</span>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${col.color}18`, color: col.color }}
                >
                  {colTodos.length}
                </span>
              </div>
            </div>
            <div className="p-3 space-y-2 min-h-[200px]">
              {colTodos.map(todo => {
                const dueLabel = dueDateLabel(todo.due_date);
                return (
                  <div
                    key={todo.id}
                    onClick={() => onClick(todo)}
                    className="group bg-white border border-slate-200 rounded-lg p-3 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <button
                        onClick={e => { e.stopPropagation(); onToggleDone(todo.id, todo.status !== "done"); }}
                        className={`mt-0.5 w-[16px] h-[16px] rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          todo.status === "done" ? "border-emerald-400 bg-emerald-400" : "border-slate-300 hover:border-[#6B7EFF]"
                        }`}
                      >
                        {todo.status === "done" && <Check size={8} className="text-white" strokeWidth={3} />}
                      </button>
                      <p className={`text-[13px] font-medium leading-snug flex-1 min-w-0 ${
                        todo.status === "done" ? "line-through text-slate-400" : "text-slate-800"
                      }`}>
                        {todo.title}
                      </p>
                      <button
                        onClick={e => { e.stopPropagation(); onDelete(todo.id); }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 transition-all shrink-0"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 pl-6 flex-wrap">
                      <StarRating priority={todo.priority} />
                      {dueLabel && (
                        <span className={`text-[10px] font-medium ${dueLabel.color}`}>{dueLabel.text}</span>
                      )}
                    </div>
                    {todo.linked_label && (
                      <div className="mt-1.5 pl-6 flex items-center gap-1">
                        <Link2 size={9} className="text-[#6B7EFF]" />
                        <span className="text-[10px] text-[#6B7EFF] font-medium truncate">{todo.linked_label}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {colTodos.length === 0 && (
                <div className="py-8 text-center text-[11px] text-slate-300">No tasks here</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TodosPage() {
  const [todos, setTodos]         = useState<Todo[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [scope, setScope]         = useState<"mine" | "assigned">("mine");
  const [viewMode, setViewMode]   = useState<ViewMode>("list");
  const [selected, setSelected]   = useState<Todo | null>(null);
  const [showDone, setShowDone]   = useState(false);

  // Create modal
  const [showCreate,   setShowCreate]   = useState(false);
  const [createTitle,  setCreateTitle]  = useState('');
  const [createPriority, setCreatePriority] = useState<Todo['priority']>('normal');
  const [createDue,    setCreateDue]    = useState('');
  const [createSaving, setCreateSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ view: scope });
      const res  = await fetch(`/api/todos?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setTodos(data.todos ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { void load(); }, [load]);

  async function addTodo(title: string, priority: Todo["priority"] = "normal") {
    const res  = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, priority }),
    });
    const data = await res.json();
    if (res.ok) setTodos(prev => [data, ...prev]);
  }

  async function submitCreate() {
    if (!createTitle.trim()) return;
    setCreateSaving(true);
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title:    createTitle.trim(),
        priority: createPriority,
        due_date: createDue || null,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setTodos(prev => [data, ...prev]);
      setShowCreate(false);
      setCreateTitle(''); setCreatePriority('normal'); setCreateDue('');
    }
    setCreateSaving(false);
  }

  async function toggleDone(id: string, done: boolean) {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, status: done ? "done" : "open" } : t));
    const res  = await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: done ? "done" : "open" }),
    });
    const data = await res.json();
    if (res.ok && data.spawned) {
      setTodos(prev => [data.spawned, ...prev.map(t => t.id === id ? data.todo : t)]);
    }
  }

  async function deleteTodo(id: string) {
    setTodos(prev => prev.filter(t => t.id !== id));
    if (selected?.id === id) setSelected(null);
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
  }

  async function changeStatus(id: string, status: Todo["status"]) {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function saveTodo(id: string, updates: Partial<Todo>) {
    const res  = await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (res.ok) setTodos(prev => prev.map(t => t.id === id ? { ...t, ...data.todo } : t));
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const openCount  = todos.filter(t => t.status !== "done").length;
  const highCount  = todos.filter(t => t.priority === "high" && t.status !== "done").length;
  const doneCount  = todos.filter(t => t.status === "done").length;

  // ── Grouped todos ──────────────────────────────────────────────────────────
  const visibleTodos = useMemo(
    () => showDone ? todos : todos.filter(t => t.status !== "done"),
    [todos, showDone]
  );

  const groupedTodos = useMemo(() => {
    return GROUPS.map(group => ({
      ...group,
      todos: visibleTodos
        .filter(t => {
          if (group.linked_types.includes(null) && !t.linked_type) return true;
          return group.linked_types.includes(t.linked_type);
        })
        .sort(prioritySort),
    })).filter(g => g.todos.length > 0 || g.key === "inbox");
  }, [visibleTodos]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <TopBar
        title="To-Dos"
        subtitle="Tasks, action items, and team assignments"
        actions={
          <div className="flex items-center gap-2">
            {/* New Task button */}
            <button
              onClick={() => { setCreateTitle(''); setCreatePriority('normal'); setCreateDue(''); setShowCreate(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6B7EFF] hover:bg-[#5a6ee8] text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
            >
              <Plus size={13} /> New Task
            </button>

            {/* Scope toggle */}
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
              {(["mine", "assigned"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    scope === s ? "bg-[#6B7EFF] text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {s === "mine" ? "My Tasks" : "Assigned Out"}
                </button>
              ))}
            </div>

            {/* View toggle */}
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
              {([
                { key: "list",   label: "List" },
                { key: "kanban", label: "Kanban" },
              ] as { key: ViewMode; label: string }[]).map(v => (
                <button
                  key={v.key}
                  onClick={() => setViewMode(v.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === v.key ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {/* Show/hide completed */}
            <button
              onClick={() => setShowDone(v => !v)}
              className={`flex items-center gap-1.5 text-xs font-medium border rounded-lg px-3 py-1.5 transition-colors ${
                showDone
                  ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                  : "border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <CheckCircle2 size={12} />
              {showDone
                ? "Hide completed"
                : `Show completed${doneCount > 0 ? ` (${doneCount})` : ""}`}
            </button>

            <button
              onClick={load}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 bg-white rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-5">

        {/* ── Stats strip ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: ClipboardList, label: "Open Tasks",    value: openCount, color: "#6B7EFF", bg: "#6B7EFF18" },
            { icon: AlertTriangle, label: "High Priority", value: highCount, color: "#EF4444", bg: "#EF444418" },
            { icon: CheckCircle2,  label: "Done",          value: doneCount, color: "#10B981", bg: "#10B98118" },
          ].map(card => (
            <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
              <div className="p-2.5 rounded-xl shrink-0" style={{ backgroundColor: card.bg }}>
                <card.icon size={16} style={{ color: card.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{card.value}</p>
                <p className="text-[11px] text-slate-500 font-medium">{card.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── States ──────────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading tasks…</span>
          </div>
        )}
        {!loading && error && (
          <div className="flex items-center justify-center gap-3 py-16">
            <span className="text-sm text-red-500">{error}</span>
            <button onClick={load} className="text-xs border border-slate-200 bg-white rounded-lg px-3 py-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && todos.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <EmptyState
              icon={<CheckSquare size={32} className="text-slate-300" />}
              title="All clear — no open tasks"
              description="Add a task below to get started"
            />
          </div>
        )}

        {/* ── List view ────────────────────────────────────────────────────── */}
        {!loading && !error && todos.length > 0 && viewMode === "list" && (
          <div>
            {groupedTodos.map(group => (
              <TodoGroup
                key={group.key}
                label={group.label}
                color={group.color}
                todos={group.todos}
                onToggleDone={toggleDone}
                onDelete={deleteTodo}
                onClick={setSelected}
                onStatusClick={changeStatus}
                onAddTodo={addTodo}
              />
            ))}
          </div>
        )}

        {/* ── Kanban view ──────────────────────────────────────────────────── */}
        {!loading && !error && todos.length > 0 && viewMode === "kanban" && (
          <KanbanView
            todos={visibleTodos}
            onToggleDone={toggleDone}
            onDelete={deleteTodo}
            onClick={setSelected}
          />
        )}

      </div>

      {/* ── Create Task Modal ─────────────────────────────────────────────── */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">New Task</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-slate-100 rounded text-slate-400">
                <X size={14} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Task *</label>
                <input
                  autoFocus
                  value={createTitle}
                  onChange={e => setCreateTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void submitCreate(); if (e.key === 'Escape') setShowCreate(false); }}
                  placeholder="What needs to be done?"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6B7EFF] placeholder-slate-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Priority</label>
                  <select
                    value={createPriority}
                    onChange={e => setCreatePriority(e.target.value as Todo['priority'])}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-[#6B7EFF] bg-white"
                  >
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Due Date</label>
                  <input
                    type="date"
                    value={createDue}
                    onChange={e => setCreateDue(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-[#6B7EFF]"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void submitCreate()}
                disabled={!createTitle.trim() || createSaving}
                className="px-4 py-2 text-sm font-semibold bg-[#6B7EFF] hover:bg-[#5a6ee8] disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1.5"
              >
                {createSaving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Slide-Over */}
      {selected && (
        <TodoSlideOver
          todo={selected}
          onClose={() => setSelected(null)}
          onSave={saveTodo}
          onDelete={id => { void deleteTodo(id); setSelected(null); }}
        />
      )}
    </div>
  );
}
