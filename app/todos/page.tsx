'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import {
  Plus, Check, Trash2, Calendar, Search, ChevronDown, ChevronRight,
  Loader2, X, User,
} from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Flag, Clock3, Link2, Repeat, GripVertical, CheckSquare } = require('lucide-react') as any
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Todo {
  id: string
  title: string
  body: string | null
  priority: 'high' | 'normal' | 'low'
  status: 'open' | 'in_progress' | 'done'
  due_date: string | null
  created_by: string
  created_by_name: string | null
  assigned_to: string | null
  assigned_to_name: string | null
  linked_type: string | null
  linked_id: string | null
  linked_label: string | null
  recurrence_type: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  recurrence_interval: number
  recurrence_ends_at: string | null
  completed_at: string | null
  created_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  open:        { label: 'Open',        bg: 'bg-slate-500/10',   text: 'text-slate-400',   dot: 'bg-slate-400'   },
  in_progress: { label: 'In Progress', bg: 'bg-blue-500/10',    text: 'text-blue-400',    dot: 'bg-blue-400'    },
  done:        { label: 'Done',        bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
}

const PRIORITY_CFG = {
  high:   { label: 'High',   color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/30'   },
  normal: { label: 'Normal', color: 'text-amber-400',  bg: 'bg-amber-400/10',  border: 'border-amber-400/30' },
  low:    { label: 'Low',    color: 'text-slate-400',  bg: 'bg-slate-400/10',  border: 'border-slate-400/30' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGroup(todo: Todo): 'overdue' | 'today' | 'this_week' | 'later' | 'done' {
  if (todo.status === 'done') return 'done'
  if (!todo.due_date) return 'later'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(todo.due_date + 'T00:00:00')
  const diff = Math.floor((d.getTime() - today.getTime()) / 86400000)
  if (diff < 0)  return 'overdue'
  if (diff === 0) return 'today'
  if (diff <= 6)  return 'this_week'
  return 'later'
}

const GROUP_LABELS: Record<string, { label: string; color: string; headerBg: string }> = {
  overdue:   { label: 'Overdue',    color: 'text-red-400',   headerBg: 'bg-red-500/5'    },
  today:     { label: 'Today',      color: 'text-amber-400', headerBg: 'bg-amber-500/5'  },
  this_week: { label: 'This Week',  color: 'text-blue-400',  headerBg: 'bg-blue-500/5'   },
  later:     { label: 'Later',      color: 'text-muted-foreground', headerBg: 'bg-muted/30' },
  done:      { label: 'Done',       color: 'text-emerald-400', headerBg: 'bg-emerald-500/5' },
}

const GROUP_ORDER = ['overdue', 'today', 'this_week', 'later', 'done']

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].substring(0, 2).toUpperCase()
}

function avatarColor(name: string | null | undefined): string {
  const colors = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500']
  if (!name) return colors[0]
  let hash = 0
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function fmtDue(d: string | null): { text: string; color: string } | null {
  if (!d) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const date = new Date(d + 'T00:00:00')
  const diff = Math.floor((date.getTime() - today.getTime()) / 86400000)
  if (diff < 0)   return { text: `${Math.abs(diff)}d overdue`, color: 'text-red-400' }
  if (diff === 0) return { text: 'Today', color: 'text-amber-400' }
  if (diff === 1) return { text: 'Tomorrow', color: 'text-amber-400' }
  return { text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: 'text-muted-foreground' }
}

// ─── Inline-edit cell ─────────────────────────────────────────────────────────

function InlineText({
  value,
  onCommit,
  placeholder,
  className,
}: {
  value: string
  onCommit: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  function activate(e: React.MouseEvent) {
    e.stopPropagation()
    setDraft(value)
    setEditing(true)
    setTimeout(() => ref.current?.select(), 10)
  }

  function commit() {
    setEditing(false)
    if (draft.trim() && draft.trim() !== value) onCommit(draft.trim())
  }

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setEditing(false); setDraft(value) }
        }}
        className={`bg-background border border-[#6B7EFF] rounded px-2 py-0.5 text-sm outline-none w-full ${className ?? ''}`}
        onClick={e => e.stopPropagation()}
      />
    )
  }
  return (
    <span
      onClick={activate}
      className={`cursor-text hover:bg-muted/40 rounded px-1 py-0.5 transition-colors truncate block ${className ?? ''}`}
      title="Click to edit"
    >
      {value || <span className="text-muted-foreground italic text-xs">{placeholder}</span>}
    </span>
  )
}

// ─── Sortable row ─────────────────────────────────────────────────────────────

function SortableTodoRow({
  todo,
  onPatch,
  onDelete,
  onExpand,
}: {
  todo: Todo
  onPatch: (id: string, patch: Partial<Todo>) => void
  onDelete: (id: string) => void
  onExpand: (todo: Todo) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  const [showStatusMenu,   setShowStatusMenu]   = useState(false)
  const [showPriorityMenu, setShowPriorityMenu] = useState(false)
  const [editingDue, setEditingDue] = useState(false)
  const [editingAssignee, setEditingAssignee] = useState(false)
  const [assigneeDraft, setAssigneeDraft] = useState(todo.assigned_to_name ?? '')
  const assigneeRef = useRef<HTMLInputElement>(null)

  const isDone   = todo.status === 'done'
  const sCfg     = STATUS_CFG[todo.status]
  const pCfg     = PRIORITY_CFG[todo.priority]
  const dueLabel = fmtDue(todo.due_date)

  function commitAssignee() {
    setEditingAssignee(false)
    if (assigneeDraft.trim() !== (todo.assigned_to_name ?? '')) {
      onPatch(todo.id, { assigned_to_name: assigneeDraft.trim() || null })
    }
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`group border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${isDone ? 'opacity-60' : ''}`}
    >
      {/* Drag handle */}
      <td className="w-6 pl-2 pr-0 py-2.5">
        <button
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab text-muted-foreground hover:text-foreground"
          onClick={e => e.stopPropagation()}
        >
          <GripVertical size={14} />
        </button>
      </td>

      {/* Checkbox */}
      <td className="w-8 py-2.5">
        <button
          onClick={e => { e.stopPropagation(); onPatch(todo.id, { status: isDone ? 'open' : 'done' }) }}
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            isDone ? 'border-emerald-400 bg-emerald-400' : 'border-border hover:border-[#6B7EFF]'
          }`}
        >
          {isDone && <Check size={10} className="text-white" strokeWidth={3} />}
        </button>
      </td>

      {/* Item / Title */}
      <td className="py-2.5 pr-4 min-w-0 max-w-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <InlineText
            value={todo.title}
            onCommit={v => onPatch(todo.id, { title: v })}
            placeholder="Untitled"
            className={`flex-1 text-sm font-medium ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}
          />
          {todo.linked_label && (
            <span className="flex-shrink-0 text-[10px] text-[#6B7EFF]/70 flex items-center gap-0.5">
              <Link2 size={8} />{todo.linked_label}
            </span>
          )}
          {todo.recurrence_type !== 'none' && (
            <span className="flex-shrink-0"><Repeat size={10} className="text-violet-400" /></span>
          )}
          {/* expand detail */}
          <button
            onClick={e => { e.stopPropagation(); onExpand(todo) }}
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            title="Open detail"
          >
            <ChevronRight size={13} />
          </button>
        </div>
        {todo.body && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate pl-1">{todo.body}</p>
        )}
      </td>

      {/* Person / Assignee */}
      <td className="py-2.5 pr-4 w-36">
        {editingAssignee ? (
          <input
            ref={assigneeRef}
            value={assigneeDraft}
            autoFocus
            onChange={e => setAssigneeDraft(e.target.value)}
            onBlur={commitAssignee}
            onKeyDown={e => {
              if (e.key === 'Enter') commitAssignee()
              if (e.key === 'Escape') { setEditingAssignee(false); setAssigneeDraft(todo.assigned_to_name ?? '') }
            }}
            className="w-full bg-background border border-[#6B7EFF] rounded px-2 py-0.5 text-xs outline-none"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <button
            onClick={e => { e.stopPropagation(); setAssigneeDraft(todo.assigned_to_name ?? ''); setEditingAssignee(true) }}
            className="flex items-center gap-1.5 hover:bg-muted/40 rounded px-1 py-0.5 transition-colors w-full"
          >
            {todo.assigned_to_name ? (
              <>
                <span className={`w-6 h-6 rounded-full ${avatarColor(todo.assigned_to_name)} text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0`}>
                  {initials(todo.assigned_to_name)}
                </span>
                <span className="text-xs text-foreground truncate">{todo.assigned_to_name}</span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                <User size={11} /> Assign
              </span>
            )}
          </button>
        )}
      </td>

      {/* Status */}
      <td className="py-2.5 pr-4 w-32" onClick={e => e.stopPropagation()}>
        <div className="relative">
          <button
            onClick={() => setShowStatusMenu(v => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${sCfg.bg} ${sCfg.text} w-full justify-between`}
          >
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${sCfg.dot}`} />
              {sCfg.label}
            </span>
            <ChevronDown size={10} />
          </button>
          {showStatusMenu && (
            <div className="absolute z-30 top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[130px]">
              {(Object.entries(STATUS_CFG) as [keyof typeof STATUS_CFG, typeof STATUS_CFG[keyof typeof STATUS_CFG]][]).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => { onPatch(todo.id, { status: k }); setShowStatusMenu(false) }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors flex items-center gap-2 ${v.text}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </td>

      {/* Due date */}
      <td className="py-2.5 pr-4 w-28" onClick={e => e.stopPropagation()}>
        {editingDue ? (
          <input
            type="date"
            autoFocus
            defaultValue={todo.due_date ?? ''}
            onBlur={e => { setEditingDue(false); onPatch(todo.id, { due_date: e.target.value || null }) }}
            onChange={e => { setEditingDue(false); onPatch(todo.id, { due_date: e.target.value || null }) }}
            className="w-full bg-background border border-[#6B7EFF] rounded px-2 py-0.5 text-xs outline-none"
          />
        ) : (
          <button
            onClick={() => setEditingDue(true)}
            className="flex items-center gap-1 hover:bg-muted/40 rounded px-1 py-0.5 transition-colors w-full"
          >
            {dueLabel ? (
              <span className={`text-xs flex items-center gap-1 ${dueLabel.color}`}>
                <Clock3 size={10} />{dueLabel.text}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground flex items-center gap-1 italic">
                <Calendar size={10} /> No date
              </span>
            )}
          </button>
        )}
      </td>

      {/* Priority */}
      <td className="py-2.5 pr-4 w-28" onClick={e => e.stopPropagation()}>
        <div className="relative">
          <button
            onClick={() => setShowPriorityMenu(v => !v)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold border w-full justify-between ${pCfg.bg} ${pCfg.color} ${pCfg.border}`}
          >
            <span className="flex items-center gap-1"><Flag size={9} />{pCfg.label}</span>
            <ChevronDown size={9} />
          </button>
          {showPriorityMenu && (
            <div className="absolute z-30 top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[100px]">
              {(Object.entries(PRIORITY_CFG) as [keyof typeof PRIORITY_CFG, typeof PRIORITY_CFG[keyof typeof PRIORITY_CFG]][]).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => { onPatch(todo.id, { priority: k }); setShowPriorityMenu(false) }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors ${v.color}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </td>

      {/* Delete */}
      <td className="py-2.5 w-8 pr-3">
        <button
          onClick={e => { e.stopPropagation(); onDelete(todo.id) }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400"
        >
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  )
}

// ─── Group section ─────────────────────────────────────────────────────────────

function GroupSection({
  groupKey,
  todos,
  onPatch,
  onDelete,
  onExpand,
  onAddInGroup,
}: {
  groupKey: string
  todos: Todo[]
  onPatch: (id: string, patch: Partial<Todo>) => void
  onDelete: (id: string) => void
  onExpand: (todo: Todo) => void
  onAddInGroup: (groupKey: string) => void
}) {
  const [collapsed, setCollapsed] = useState(groupKey === 'done' && todos.length > 0)
  const cfg = GROUP_LABELS[groupKey]
  const doneCount = todos.filter(t => t.status === 'done').length
  const ids = todos.map(t => t.id)

  return (
    <div className="mb-2">
      {/* Group header */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-t-lg text-left ${cfg.headerBg} hover:brightness-95 transition-colors`}
      >
        {collapsed
          ? <ChevronRight size={13} className={cfg.color} />
          : <ChevronDown  size={13} className={cfg.color} />
        }
        <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
        <span className="text-xs text-muted-foreground ml-1">{todos.length}</span>
        {groupKey !== 'done' && todos.length > 0 && (
          <div className="ml-2 flex gap-1">
            {/* Mini progress bar */}
            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all"
                style={{ width: `${todos.length ? (doneCount / todos.length) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{doneCount}/{todos.length}</span>
          </div>
        )}
      </button>

      {!collapsed && (
        <div className="bg-card border border-t-0 border-border rounded-b-lg overflow-hidden">
          {/* Column headers — only show on first visible group */}
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <table className="w-full">
              <tbody>
                {todos.map(todo => (
                  <SortableTodoRow
                    key={todo.id}
                    todo={todo}
                    onPatch={onPatch}
                    onDelete={onDelete}
                    onExpand={onExpand}
                  />
                ))}
              </tbody>
              {/* Footer summary */}
              <tfoot>
                <tr className="border-t border-border bg-muted/20">
                  <td colSpan={2} className="py-2 pl-10">
                    <button
                      onClick={() => onAddInGroup(groupKey)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#6B7EFF] transition-colors"
                    >
                      <Plus size={12} /> Add item
                    </button>
                  </td>
                  <td className="py-2 pr-4 text-xs text-muted-foreground">
                    {todos.length} item{todos.length !== 1 ? 's' : ''}
                  </td>
                  <td className="py-2 pr-4 text-xs text-muted-foreground" />
                  <td className="py-2 pr-4 text-xs text-muted-foreground">
                    {doneCount > 0 && (
                      <span className="text-emerald-400">{doneCount} done</span>
                    )}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </SortableContext>
        </div>
      )}
    </div>
  )
}

// ─── Detail panel (slide-over style) ─────────────────────────────────────────

function DetailPanel({ todo, onClose, onPatch, onDelete }: {
  todo: Todo
  onClose: () => void
  onPatch: (id: string, patch: Partial<Todo>) => void
  onDelete: (id: string) => void
}) {
  const [body, setBody] = useState(todo.body ?? '')
  const [saving, setSaving] = useState(false)

  async function saveBody() {
    if (body === (todo.body ?? '')) return
    setSaving(true)
    await fetch(`/api/todos/${todo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    }).catch(() => {})
    setSaving(false)
    onPatch(todo.id, { body })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[400px] h-full bg-card border-l border-border flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="font-semibold text-sm truncate">{todo.title}</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Status</p>
              <div className="relative">
                <select
                  value={todo.status}
                  onChange={e => onPatch(todo.id, { status: e.target.value as Todo['status'] })}
                  className="w-full bg-background border border-border rounded-lg px-3 h-8 text-xs text-foreground outline-none focus:border-[#6B7EFF]"
                >
                  {(Object.entries(STATUS_CFG) as [keyof typeof STATUS_CFG, typeof STATUS_CFG[keyof typeof STATUS_CFG]][]).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Priority</p>
              <select
                value={todo.priority}
                onChange={e => onPatch(todo.id, { priority: e.target.value as Todo['priority'] })}
                className="w-full bg-background border border-border rounded-lg px-3 h-8 text-xs text-foreground outline-none focus:border-[#6B7EFF]"
              >
                {(Object.entries(PRIORITY_CFG) as [keyof typeof PRIORITY_CFG, typeof PRIORITY_CFG[keyof typeof PRIORITY_CFG]][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Due Date</p>
              <input
                type="date"
                defaultValue={todo.due_date ?? ''}
                onChange={e => onPatch(todo.id, { due_date: e.target.value || null })}
                className="w-full bg-background border border-border rounded-lg px-3 h-8 text-xs text-foreground outline-none focus:border-[#6B7EFF]"
              />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Assigned To</p>
              <input
                defaultValue={todo.assigned_to_name ?? ''}
                onBlur={e => onPatch(todo.id, { assigned_to_name: e.target.value || null })}
                placeholder="Name or email"
                className="w-full bg-background border border-border rounded-lg px-3 h-8 text-xs text-foreground outline-none focus:border-[#6B7EFF] placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Notes</p>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              onBlur={saveBody}
              rows={5}
              placeholder="Add notes, details, links…"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-[#6B7EFF] placeholder:text-muted-foreground resize-none"
            />
            {saving && <p className="text-[10px] text-muted-foreground mt-1">Saving…</p>}
          </div>

          {/* Linked record */}
          {todo.linked_label && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Linked Record</p>
              <span className="inline-flex items-center gap-1.5 text-xs text-[#6B7EFF] bg-[#6B7EFF]/10 px-2 py-1 rounded-lg">
                <Link2 size={10} />{todo.linked_type}: {todo.linked_label}
              </span>
            </div>
          )}

          {todo.recurrence_type !== 'none' && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Recurrence</p>
              <span className="text-xs text-violet-400 flex items-center gap-1">
                <Repeat size={10} />
                Every {todo.recurrence_interval > 1 ? `${todo.recurrence_interval} ` : ''}{todo.recurrence_type.replace('ly', '')}{todo.recurrence_interval > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex gap-2">
          <button
            onClick={() => { onDelete(todo.id); onClose() }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-400 border border-red-400/30 rounded-lg hover:bg-red-400/10 transition-colors"
          >
            <Trash2 size={12} /> Delete
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function TodosPage() {
  const [todos,    setTodos]    = useState<Todo[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [detail,   setDetail]   = useState<Todo | null>(null)

  // Quick-add state
  const [adding, setAdding]   = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDue, setNewDue]   = useState('')
  const [newPriority, setNewPriority] = useState<'high' | 'normal' | 'low'>('normal')
  const [saving, setSaving]   = useState(false)
  const newInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchTodos = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/todos?limit=200')
      const json = await res.json()
      setTodos(json.records ?? json.todos ?? [])
    } catch {
      setTodos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTodos() }, [fetchTodos])

  // ── Patch ──────────────────────────────────────────────────────────────────
  const patchTodo = useCallback(async (id: string, patch: Partial<Todo>) => {
    // Optimistic update
    setTodos(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
    if (detail?.id === id) setDetail(prev => prev ? { ...prev, ...patch } : null)
    await fetch(`/api/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => {})
  }, [detail?.id])

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteTodo = useCallback(async (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id))
    await fetch(`/api/todos/${id}`, { method: 'DELETE' }).catch(() => {})
  }, [])

  // ── Create ─────────────────────────────────────────────────────────────────
  async function createTodo(titleOverride?: string, groupHint?: string) {
    const title = titleOverride ?? newTitle.trim()
    if (!title) return

    // Figure out default due date from group hint
    let dueDate = newDue || null
    if (!dueDate && groupHint) {
      const today = new Date()
      if (groupHint === 'today') {
        dueDate = today.toISOString().split('T')[0]
      } else if (groupHint === 'this_week') {
        const friday = new Date(today)
        friday.setDate(today.getDate() + (5 - today.getDay() + 7) % 7 || 7)
        dueDate = friday.toISOString().split('T')[0]
      }
    }

    setSaving(true)
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          priority: newPriority,
          due_date: dueDate,
          status: 'open',
          recurrence_type: 'none',
          recurrence_interval: 1,
        }),
      })
      const json = await res.json()
      if (json.record ?? json.todo) {
        setTodos(prev => [json.record ?? json.todo, ...prev])
      }
      setNewTitle('')
      setNewDue('')
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  function handleAddInGroup(groupKey: string) {
    setAdding(true)
    setTimeout(() => newInputRef.current?.focus(), 50)
  }

  // ── Drag ───────────────────────────────────────────────────────────────────
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setTodos(prev => {
        const oldIdx = prev.findIndex(t => t.id === active.id)
        const newIdx = prev.findIndex(t => t.id === over.id)
        return arrayMove(prev, oldIdx, newIdx)
      })
    }
  }

  // ── Filter + Group ─────────────────────────────────────────────────────────
  const filtered = todos.filter(t =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()) ||
    (t.assigned_to_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (t.body ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const grouped = GROUP_ORDER.reduce((acc, g) => {
    acc[g] = filtered.filter(t => getGroup(t) === g)
    return acc
  }, {} as Record<string, Todo[]>)

  const totalOpen = todos.filter(t => t.status !== 'done').length
  const totalDone = todos.filter(t => t.status === 'done').length

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-background">
      <TopBar
        title="To-Dos"
        subtitle="Track action items, assign owners, set due dates"
        actions={
          <button
            onClick={() => { setAdding(true); setTimeout(() => newInputRef.current?.focus(), 50) }}
            className="flex items-center gap-2 bg-[#6B7EFF] hover:bg-[#5a6ee0] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={15} /> New Item
          </button>
        }
      />

      <div className="p-6 max-w-6xl mx-auto space-y-4">

        {/* Stats + search bar */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CheckSquare size={14} className="text-[#6B7EFF]" />
              <strong className="text-foreground">{totalOpen}</strong> open
            </span>
            <span>·</span>
            <span className="text-emerald-400">
              <strong>{totalDone}</strong> done
            </span>
            {totalOpen + totalDone > 0 && (
              <>
                <span>·</span>
                <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all"
                    style={{ width: `${((totalDone / (totalOpen + totalDone)) * 100).toFixed(0)}%` }}
                  />
                </div>
                <span>{((totalDone / (totalOpen + totalDone)) * 100).toFixed(0)}%</span>
              </>
            )}
          </div>
          <div className="flex-1" />
          <div className="relative w-56">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search items…"
              className="w-full pl-8 pr-3 h-8 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
            />
          </div>
        </div>

        {/* Quick-add row */}
        {adding && (
          <div className="bg-card border border-[#6B7EFF]/40 rounded-xl p-3 flex items-center gap-3 shadow-sm">
            <div className="w-5 h-5 rounded-full border-2 border-border flex-shrink-0" />
            <input
              ref={newInputRef}
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') createTodo()
                if (e.key === 'Escape') { setAdding(false); setNewTitle('') }
              }}
              placeholder="What needs to be done?"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <input
              type="date"
              value={newDue}
              onChange={e => setNewDue(e.target.value)}
              className="bg-background border border-border rounded px-2 h-7 text-xs text-foreground outline-none focus:border-[#6B7EFF] w-32"
            />
            <select
              value={newPriority}
              onChange={e => setNewPriority(e.target.value as 'high' | 'normal' | 'low')}
              className="bg-background border border-border rounded px-2 h-7 text-xs text-foreground outline-none focus:border-[#6B7EFF]"
            >
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
            <button
              onClick={() => createTodo()}
              disabled={saving || !newTitle.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6B7EFF] hover:bg-[#5a6ee0] text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              Add
            </button>
            <button onClick={() => { setAdding(false); setNewTitle('') }} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Column headers */}
        {!loading && todos.length > 0 && (
          <div className="flex items-center gap-0 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-1.5">
            <span className="w-6 flex-shrink-0" />   {/* drag handle */}
            <span className="w-8 flex-shrink-0" />   {/* checkbox */}
            <span className="flex-1 pr-4 min-w-0">Item</span>
            <span className="w-36 pr-4 flex-shrink-0">Person</span>
            <span className="w-32 pr-4 flex-shrink-0">Status</span>
            <span className="w-28 pr-4 flex-shrink-0">Due</span>
            <span className="w-28 pr-4 flex-shrink-0">Priority</span>
            <span className="w-8 flex-shrink-0" />   {/* delete */}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 bg-card border border-border rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && todos.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-16 text-center">
            <CheckSquare size={40} className="text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-semibold text-foreground">No to-dos yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first action item to get started</p>
            <button
              onClick={() => { setAdding(true); setTimeout(() => newInputRef.current?.focus(), 50) }}
              className="mt-4 flex items-center gap-2 mx-auto bg-[#6B7EFF] hover:bg-[#5a6ee0] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={14} /> New Item
            </button>
          </div>
        )}

        {/* Groups */}
        {!loading && todos.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            {GROUP_ORDER.filter(g => grouped[g]?.length > 0 || g === 'today').map(g => {
              if (!grouped[g]?.length && g !== 'today') return null
              if (!grouped[g]?.length && g === 'today') return null
              return (
                <GroupSection
                  key={g}
                  groupKey={g}
                  todos={grouped[g] ?? []}
                  onPatch={patchTodo}
                  onDelete={deleteTodo}
                  onExpand={setDetail}
                  onAddInGroup={handleAddInGroup}
                />
              )
            })}
          </DndContext>
        )}
      </div>

      {/* Detail panel */}
      {detail && (
        <DetailPanel
          todo={detail}
          onClose={() => setDetail(null)}
          onPatch={patchTodo}
          onDelete={deleteTodo}
        />
      )}
    </div>
  )
}
