"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Plus, Check, Trash2, Calendar, User, ChevronDown,
  Loader2, AlertCircle, RefreshCw, X, Upload, Paperclip,
  FileText, Download, Search,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { CheckSquare, Circle, Clock3, Link2, Flag, Repeat, ExternalLink } = require("lucide-react") as any;
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

const PRIORITY_CONFIG = {
  high:   { label: "High",   pill: "bg-rose-100 text-rose-700",    dot: "bg-rose-400" },
  normal: { label: "Normal", pill: "bg-sky-100 text-sky-700",      dot: "bg-sky-400" },
  low:    { label: "Low",    pill: "bg-slate-100 text-slate-500",  dot: "bg-slate-300" },
};

const STATUS_CONFIG = {
  open:        { label: "Open",        emoji: "📬", pill: "bg-slate-100 text-slate-600" },
  in_progress: { label: "In Progress", emoji: "🚀", pill: "bg-blue-100 text-blue-700" },
  done:        { label: "Done",        emoji: "✅", pill: "bg-emerald-100 text-emerald-700" },
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

function prioritySort(a: Todo, b: Todo) {
  const order = { high: 0, normal: 1, low: 2 };
  return order[a.priority] - order[b.priority];
}

function dueDateLabel(due: string | null): { text: string; color: string } | null {
  if (!due) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(due + "T00:00:00");
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0)   return { text: `${Math.abs(diff)}d overdue`, color: "text-red-400" };
  if (diff === 0) return { text: "Due today",    color: "text-amber-400" };
  if (diff === 1) return { text: "Due tomorrow", color: "text-amber-400" };
  return { text: `Due ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, color: "text-muted-foreground" };
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-md bg-background border-l border-border flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">To-Do Details</h2>
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

          {/* Title */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-accent border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-brand-400/50"
            />
          </div>

          {/* Notes */}
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

          {/* Priority + Due date */}
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

          {/* Assignee */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Assign To</label>
            <input
              value={assignee}
              onChange={e => setAssignee(e.target.value)}
              placeholder="Enter name or email…"
              className="w-full bg-accent border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-brand-400/50"
            />
          </div>

          {/* Linked Record */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Link to Record
            </label>
            <LinkedRecordPicker value={linked} onChange={setLinked} />
          </div>

          {/* Recurrence */}
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

          {/* Attachments */}
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

// ─── Table Group Header ───────────────────────────────────────────────────────

function GroupHeader({
  label,
  count,
  dot,
  collapsed,
  onToggle,
}: {
  label: string;
  count: number;
  dot: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/40 transition-colors rounded-lg group/gh"
    >
      <ChevronDown
        size={13}
        className={`text-muted-foreground transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
      />
      <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
      <span className="text-xs font-bold text-foreground">{label}</span>
      <span className="ml-1 text-[11px] font-semibold text-muted-foreground bg-accent px-1.5 py-0.5 rounded-full">
        {count}
      </span>
    </button>
  );
}

// ─── Todo Row (table-style) ───────────────────────────────────────────────────

function TodoRow({
  todo,
  onToggleDone,
  onDelete,
  onStatusChange,
  onPriorityChange,
  onClick,
}: {
  todo: Todo;
  onToggleDone: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: Todo["status"]) => void;
  onPriorityChange: (id: string, priority: "high" | "normal" | "low") => void;
  onClick: (todo: Todo) => void;
}) {
  const [showStatusMenu,   setShowStatusMenu]   = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const isDone    = todo.status === "done";
  const dueLabel  = dueDateLabel(todo.due_date);
  const pCfg      = PRIORITY_CONFIG[todo.priority];
  const sCfg      = STATUS_CONFIG[todo.status] ?? STATUS_CONFIG.open;
  const recurring = todo.recurrence_type && todo.recurrence_type !== "none";
  const hasAttach = (todo.todo_attachments?.length ?? 0) > 0;

  return (
    <div
      className={`group grid items-center border-b border-border/50 last:border-0 transition-colors cursor-pointer hover:bg-accent/30 ${isDone ? "opacity-55" : ""}`}
      style={{ gridTemplateColumns: "28px 1fr 148px 96px 108px 36px 28px" }}
      onClick={() => onClick(todo)}
    >
      {/* Checkbox */}
      <div className="flex items-center justify-center">
        <button
          onClick={e => { e.stopPropagation(); onToggleDone(todo.id, !isDone); }}
          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 ${
            isDone ? "!opacity-100 border-emerald-400 bg-emerald-400" : "border-border hover:border-brand-400"
          }`}
        >
          {isDone && <Check size={9} className="text-white" strokeWidth={3} />}
        </button>
      </div>

      {/* Title + inline chips */}
      <div className="flex items-center gap-2 py-2.5 pr-2 min-w-0">
        <span className={`text-sm font-medium leading-snug truncate ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {todo.title}
        </span>
        {/* Inline tag chips */}
        {todo.linked_label && (
          <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-400/10 text-brand-400">
            <Link2 size={8} />{todo.linked_label}
          </span>
        )}
        {recurring && (
          <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-100 text-violet-600">
            <Repeat size={8} />{todo.recurrence_type}
          </span>
        )}
        {hasAttach && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Paperclip size={9} />{todo.todo_attachments!.length}
          </span>
        )}
      </div>

      {/* Status */}
      <div className="relative" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => setShowStatusMenu(v => !v)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all hover:ring-2 hover:ring-offset-1 hover:ring-brand-400/30 ${sCfg.pill}`}
        >
          <span>{sCfg.emoji}</span>
          {sCfg.label}
          <ChevronDown size={9} className="opacity-60" />
        </button>
        {showStatusMenu && (
          <div className="absolute z-30 top-full left-0 mt-1 bg-popover border border-border rounded-xl shadow-xl py-1 min-w-[160px]">
            {(["open", "in_progress", "done"] as const).map(s => {
              const sc = STATUS_CONFIG[s];
              return (
                <button
                  key={s}
                  onClick={() => { onStatusChange(todo.id, s); setShowStatusMenu(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors flex items-center gap-2.5"
                >
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${sc.pill}`}>
                    {sc.emoji} {sc.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Priority */}
      <div className="relative" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => setShowPriorityMenu(v => !v)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all hover:ring-2 hover:ring-offset-1 hover:ring-brand-400/30 ${pCfg.pill}`}
        >
          <span className={`w-2 h-2 rounded-full ${pCfg.dot}`} />
          {pCfg.label}
        </button>
        {showPriorityMenu && (
          <div className="absolute z-30 top-full left-0 mt-1 bg-popover border border-border rounded-xl shadow-xl py-1 min-w-[120px]">
            {(["high", "normal", "low"] as const).map(p => {
              const pc = PRIORITY_CONFIG[p];
              return (
                <button
                  key={p}
                  onClick={() => { onPriorityChange(todo.id, p); setShowPriorityMenu(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors flex items-center gap-2"
                >
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${pc.pill}`}>
                    <span className={`w-2 h-2 rounded-full ${pc.dot}`} />{pc.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Due date */}
      <div className="text-xs pr-2">
        {dueLabel ? (
          <span className={`font-medium ${dueLabel.color}`}>{dueLabel.text}</span>
        ) : (
          <span className="text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity">—</span>
        )}
      </div>

      {/* Assignee avatar */}
      <div className="flex items-center justify-center">
        {todo.assigned_to_name ? (
          <span
            className="w-7 h-7 rounded-full bg-brand-400 text-white flex items-center justify-center text-[10px] font-bold uppercase shrink-0"
            title={todo.assigned_to_name}
          >
            {todo.assigned_to_name.slice(0, 2)}
          </span>
        ) : (
          <span className="w-7 h-7 rounded-full border-2 border-dashed border-border opacity-0 group-hover:opacity-60 transition-opacity" />
        )}
      </div>

      {/* Delete */}
      <div className="flex items-center justify-center">
        <button
          onClick={e => { e.stopPropagation(); onDelete(todo.id); }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Quick Add (table-row style) ─────────────────────────────────────────────

function QuickAdd({ onAdd }: { onAdd: (title: string, priority: Todo["priority"], due_date: string) => void }) {
  const [title, setTitle]       = useState("");
  const [priority, setPriority] = useState<Todo["priority"]>("normal");
  const [due, setDue]           = useState("");
  const inputRef                = useRef<HTMLInputElement>(null);

  function submit() {
    if (!title.trim()) return;
    onAdd(title.trim(), priority, due);
    setTitle(""); setPriority("normal"); setDue("");
    inputRef.current?.focus();
  }

  return (
    <div
      className="grid items-center border-t border-border/50 hover:bg-accent/20 transition-colors"
      style={{ gridTemplateColumns: "28px 1fr 148px 96px 108px 36px 28px" }}
    >
      <div className="flex items-center justify-center">
        <Plus size={14} className="text-muted-foreground/40" />
      </div>
      <div className="py-2.5 pr-2">
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") setTitle(""); }}
          placeholder="Add a task…"
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none"
        />
      </div>
      {/* Status placeholder */}
      <div />
      {/* Priority picker */}
      <div className="flex items-center gap-1">
        {(["high", "normal", "low"] as const).map(p => (
          <button
            key={p}
            onClick={() => setPriority(p)}
            className={`w-2.5 h-2.5 rounded-full transition-all ring-1 ring-offset-1 ${
              priority === p ? `${PRIORITY_CONFIG[p].dot} ring-current` : "bg-border ring-transparent hover:ring-border"
            }`}
            title={PRIORITY_CONFIG[p].label}
          />
        ))}
      </div>
      {/* Due date */}
      <div>
        <input
          type="date"
          value={due}
          onChange={e => setDue(e.target.value)}
          className="w-full bg-transparent text-xs text-muted-foreground outline-none"
        />
      </div>
      {/* Spacer */}
      <div />
      {/* Submit */}
      <div className="flex items-center justify-center">
        {title && (
          <button
            onClick={submit}
            className="w-6 h-6 rounded bg-brand-400 text-white flex items-center justify-center hover:bg-brand-400/80 transition-colors"
          >
            <Check size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TodosPage() {
  const [todos, setTodos]             = useState<Todo[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [view, setView]               = useState<"mine" | "assigned">("mine");
  const [filter, setFilter]           = useState<"open" | "all" | "done">("open");
  const [selected, setSelected]       = useState<Todo | null>(null);
  const [collapsed, setCollapsed]     = useState<Record<string, boolean>>({});

  function toggleGroup(key: string) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  }

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

  async function addTodo(title: string, priority: Todo["priority"], due_date: string) {
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

  async function changeStatus(id: string, status: Todo["status"]) {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function deleteTodo(id: string) {
    setTodos(prev => prev.filter(t => t.id !== id));
    if (selected?.id === id) setSelected(null);
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
  }

  async function changePriority(id: string, priority: Todo["priority"]) {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, priority } : t));
    await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
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

  const open    = todos.filter(t => t.status !== "done").sort(prioritySort);
  const done    = todos.filter(t => t.status === "done");
  const openCnt = open.length;
  const doneCnt = done.length;
  const highCnt = open.filter(t => t.priority === "high").length;

  // Status groups (when showing "all")
  const inProgressTodos = todos.filter(t => t.status === "in_progress").sort(prioritySort);
  const openOnlyTodos   = todos.filter(t => t.status === "open").sort(prioritySort);

  // Build groups based on filter
  type Group = { key: string; label: string; dot: string; items: Todo[] };
  const groups: Group[] = [];
  if (filter === "open") {
    if (inProgressTodos.length > 0) groups.push({ key: "in_progress", label: "In Progress", dot: "bg-blue-400",    items: inProgressTodos });
    if (openOnlyTodos.length > 0)   groups.push({ key: "open",        label: "Open",        dot: "bg-slate-400",  items: openOnlyTodos });
  } else if (filter === "done") {
    if (done.length > 0) groups.push({ key: "done", label: "Completed", dot: "bg-emerald-400", items: done });
  } else {
    if (inProgressTodos.length > 0) groups.push({ key: "in_progress", label: "In Progress", dot: "bg-blue-400",    items: inProgressTodos });
    if (openOnlyTodos.length > 0)   groups.push({ key: "open",        label: "Open",        dot: "bg-slate-400",  items: openOnlyTodos });
    if (done.length > 0)            groups.push({ key: "done",        label: "Completed",   dot: "bg-emerald-400", items: done });
  }

  // Column header definition (matches TodoRow grid)
  const COL_STYLE = "28px 1fr 148px 96px 108px 36px 28px";

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar
        title="To-Dos"
        subtitle="Personal tasks and team assignments"
        actions={
          <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-accent transition-colors">
            <RefreshCw size={12} /> Refresh
          </button>
        }
      />

      <div className="flex-1 p-6 space-y-4 max-w-5xl mx-auto w-full">

        {/* Stats bar */}
        <div className="flex items-center gap-3">
          {[
            { label: "Open",        value: openCnt, accent: "text-brand-400",   bg: "bg-brand-400/10" },
            { label: "In Progress", value: inProgressTodos.length, accent: "text-blue-600",    bg: "bg-blue-50" },
            { label: "High Pri",    value: highCnt, accent: "text-rose-600",    bg: "bg-rose-50" },
            { label: "Done",        value: doneCnt, accent: "text-emerald-600", bg: "bg-emerald-50" },
          ].map(c => (
            <div key={c.label} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${c.bg} border border-border`}>
              <span className={`text-lg font-extrabold leading-none ${c.accent}`}>{c.value}</span>
              <span className="text-xs text-muted-foreground font-medium">{c.label}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => { if (view !== "mine") setView("mine"); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === "mine" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
            >
              My To-Dos
            </button>
            <button
              onClick={() => { if (view !== "assigned") setView("assigned"); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === "assigned" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
            >
              Assigned Out
            </button>
            <div className="w-px h-4 bg-border mx-1" />
            {(["open", "all", "done"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${filter === f ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
              >
                {f === "open" ? "Active" : f === "all" ? "All" : "Done"}
              </button>
            ))}
          </div>
        </div>

        {/* Main table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">

          {/* Column headers */}
          <div
            className="grid items-center border-b border-border bg-accent/40 px-0"
            style={{ gridTemplateColumns: COL_STYLE }}
          >
            <div />
            <div className="py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Task</div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Status</div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Priority</div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Due date</div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-center">Who</div>
            <div />
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 size={16} className="animate-spin" /> Loading to-dos…
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex items-center justify-center gap-3 py-12">
              <span className="text-sm text-destructive">{error}</span>
              <button onClick={load} className="text-xs border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent">Retry</button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && todos.length === 0 && (
            <div className="py-16 flex flex-col items-center gap-3">
              <CheckSquare size={32} className="text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">All clear — no to-dos</p>
              <p className="text-xs text-muted-foreground/60">Use the row below to add one</p>
            </div>
          )}

          {/* Groups */}
          {!loading && !error && groups.map(group => (
            <div key={group.key}>
              <GroupHeader
                label={group.label}
                count={group.items.length}
                dot={group.dot}
                collapsed={collapsed[group.key] ?? false}
                onToggle={() => toggleGroup(group.key)}
              />
              {!(collapsed[group.key]) && group.items.map(todo => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  onToggleDone={toggleDone}
                  onDelete={deleteTodo}
                  onStatusChange={changeStatus}
                  onPriorityChange={changePriority}
                  onClick={setSelected}
                />
              ))}
            </div>
          ))}

          {/* Quick add row — pinned at bottom */}
          <QuickAdd onAdd={addTodo} />
        </div>

        <p className="text-[11px] text-muted-foreground/50 text-center">
          Click any row for notes, attachments, linked records, and recurrence settings
        </p>
      </div>

      {/* Detail Slide-Over */}
      {selected && (
        <TodoSlideOver
          todo={selected}
          onClose={() => setSelected(null)}
          onSave={saveTodo}
          onDelete={id => { deleteTodo(id); setSelected(null); }}
        />
      )}
    </div>
  );
}
