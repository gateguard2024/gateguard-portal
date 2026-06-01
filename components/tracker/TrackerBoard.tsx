'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, X, ChevronDown, ChevronRight, Send, Layers, Loader2,
  Trash2, User, Filter, Check, Clock, AlertTriangle,
  MessageSquare, ArrowRight, ChevronUp,
} from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Sparkles, LayoutList, LayoutGrid, MoreVertical } = require('lucide-react') as any

// ── Types ──────────────────────────────────────────────────────────────────────

interface TrackerGroup {
  id: string
  name: string
  color: string
  position: number
  entity_type?: string | null
  entity_id?: string | null
  org_id?: string | null
}

interface TrackerItem {
  id: string
  group_id: string
  title: string
  type: 'bug' | 'enhancement' | 'question' | 'task'
  module?: string | null
  severity?: string | null
  priority?: string | null
  status: string
  owner_name?: string | null
  reporter_name?: string | null
  date_reported?: string | null
  target_release?: string | null
  notes?: string | null
  position: number
  parent_item_id?: string | null
  created_at: string
  updated_at: string
  subItems?: TrackerItem[]
}

interface TrackerComment {
  id: string
  item_id: string
  author: string
  body: string
  created_at: string
}

type ViewMode = 'board' | 'table'
type DrawerTab = 'timeline' | 'comments' | 'files'

interface TrackerBoardProps {
  entityType?: string
  entityId?: string
  defaultView?: ViewMode
  compact?: boolean
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['new', 'in_progress', 'in_review', 'blocked', 'done', 'wont_fix']
const TYPE_OPTIONS   = ['bug', 'enhancement', 'question', 'task']
const SEVERITY_OPTIONS = ['1_low', '2_medium', '3_high', '4_critical', '5_critical']
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent']

function statusColor(status: string) {
  switch (status) {
    case 'in_progress': return 'bg-amber-100 text-amber-800'
    case 'done':        return 'bg-emerald-100 text-emerald-800'
    case 'blocked':     return 'bg-orange-100 text-orange-800'
    case 'in_review':   return 'bg-blue-100 text-blue-800'
    case 'wont_fix':    return 'bg-slate-100 text-slate-500'
    default:            return 'bg-slate-100 text-slate-700'
  }
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function typeColor(type: string) {
  switch (type) {
    case 'bug':         return 'bg-red-50 text-red-700 border-red-200'
    case 'enhancement': return 'bg-violet-50 text-violet-700 border-violet-200'
    case 'question':    return 'bg-pink-50 text-pink-700 border-pink-200'
    case 'task':        return 'bg-sky-50 text-sky-700 border-sky-200'
    default:            return 'bg-slate-50 text-slate-600 border-slate-200'
  }
}

function cardAuraBorder(item: TrackerItem): string {
  if (item.severity === '5_critical') return 'border-l-4 border-l-red-500'
  if (item.status === 'in_progress')  return 'border-l-4 border-l-amber-400'
  if (item.status === 'done')         return 'border-l-4 border-l-emerald-400'
  if (item.status === 'blocked')      return 'border-l-4 border-l-orange-400'
  if (item.type   === 'enhancement')  return 'border-l-4 border-l-violet-400'
  return 'border-l-4 border-l-transparent'
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function TrackerBoard({ entityType, entityId, defaultView = 'board', compact = false }: TrackerBoardProps) {
  const [groups,   setGroups]   = useState<TrackerGroup[]>([])
  const [items,    setItems]    = useState<TrackerItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [view,     setView]     = useState<ViewMode>(defaultView)

  // Drawer
  const [activeItem,  setActiveItem]  = useState<TrackerItem | null>(null)
  const [drawerTab,   setDrawerTab]   = useState<DrawerTab>('comments')
  const [comments,    setComments]    = useState<TrackerComment[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [commentSending, setCommentSending] = useState(false)
  const [aiSummary,  setAiSummary]   = useState<string | null>(null)

  // New item modal
  const [showNewModal,  setShowNewModal]  = useState(false)
  const [newItemGroup,  setNewItemGroup]  = useState('')
  const [newTitle,      setNewTitle]      = useState('')
  const [newType,       setNewType]       = useState('task')
  const [newStatus,     setNewStatus]     = useState('new')
  const [newSeverity,   setNewSeverity]   = useState('')
  const [newPriority,   setNewPriority]   = useState('')
  const [newNotes,      setNewNotes]      = useState('')
  const [saving,        setSaving]        = useState(false)

  // NL bar
  const [nlInput, setNlInput] = useState('')
  const [nlGroup, setNlGroup] = useState('')

  // Table sort
  const [sortCol, setSortCol]   = useState<string>('updated_at')
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('desc')

  // Sub-item expansion
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Collapsed groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // ── Data Fetching ────────────────────────────────────────────────────────────

  const fetchGroups = useCallback(async () => {
    const params = new URLSearchParams()
    if (entityType) params.set('entity_type', entityType)
    if (entityId)   params.set('entity_id', entityId)
    const res = await fetch(`/api/tracker/groups?${params}`)
    if (!res.ok) return []
    return (await res.json()) as TrackerGroup[]
  }, [entityType, entityId])

  const fetchItems = useCallback(async (groupIds: string[]) => {
    if (!groupIds.length) return []
    const params = new URLSearchParams({ group_ids: groupIds.join(','), include_subitems: 'true' })
    const res = await fetch(`/api/tracker/items?${params}`)
    if (!res.ok) return []
    return (await res.json()) as TrackerItem[]
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    const grps = await fetchGroups()
    setGroups(grps)
    const allItems = await fetchItems(grps.map(g => g.id))
    setItems(allItems)
    setLoading(false)
  }, [fetchGroups, fetchItems])

  useEffect(() => { void loadAll() }, [loadAll])

  // ── Sub-items ────────────────────────────────────────────────────────────────

  const topItems = items.filter(i => !i.parent_item_id)
  const subitemsMap: Record<string, TrackerItem[]> = {}
  items.forEach(i => {
    if (i.parent_item_id) {
      if (!subitemsMap[i.parent_item_id]) subitemsMap[i.parent_item_id] = []
      subitemsMap[i.parent_item_id].push(i)
    }
  })

  // ── Create Item ──────────────────────────────────────────────────────────────

  const createItem = async () => {
    if (!newTitle.trim() || !newItemGroup) return
    setSaving(true)
    await fetch('/api/tracker/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group_id: newItemGroup, title: newTitle, type: newType,
        status: newStatus, severity: newSeverity || null,
        priority: newPriority || null, notes: newNotes || null,
      }),
    })
    setShowNewModal(false)
    setNewTitle(''); setNewNotes('')
    setSaving(false)
    await loadAll()
  }

  const openNewModal = (groupId?: string) => {
    setNewItemGroup(groupId ?? (groups[0]?.id ?? ''))
    setNewType('task'); setNewStatus('new')
    setNewSeverity(''); setNewPriority(''); setNewNotes('')
    setShowNewModal(true)
  }

  // ── NL Quick-Create ──────────────────────────────────────────────────────────

  const submitNl = async (groupId: string) => {
    if (!nlInput.trim()) return
    await fetch('/api/tracker/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId, title: nlInput, type: 'task', status: 'new' }),
    })
    setNlInput(''); setNlGroup('')
    await loadAll()
  }

  // ── Patch Item ───────────────────────────────────────────────────────────────

  const patchItem = async (id: string, patch: Record<string, unknown>) => {
    await fetch(`/api/tracker/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
    if (activeItem?.id === id) setActiveItem(prev => prev ? { ...prev, ...patch } : null)
  }

  // ── Delete Item ──────────────────────────────────────────────────────────────

  const deleteItem = async (id: string) => {
    await fetch(`/api/tracker/items/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
    if (activeItem?.id === id) setActiveItem(null)
  }

  // ── Open Item Drawer ─────────────────────────────────────────────────────────

  const openDrawer = async (item: TrackerItem) => {
    setActiveItem(item)
    setDrawerTab('comments')
    setAiSummary(null)
    const res = await fetch(`/api/tracker/items/${item.id}/comments`)
    if (res.ok) setComments(await res.json())
    else setComments([])
  }

  const sendComment = async () => {
    if (!activeItem || !commentBody.trim()) return
    setCommentSending(true)
    await fetch(`/api/tracker/items/${activeItem.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: commentBody }),
    })
    setCommentBody('')
    const res = await fetch(`/api/tracker/items/${activeItem.id}/comments`)
    if (res.ok) setComments(await res.json())
    setCommentSending(false)
  }

  const generateAiSummary = () => {
    if (!activeItem) return
    setAiSummary(`This ${activeItem.type} is currently ${statusLabel(activeItem.status)}. ${activeItem.notes ? 'Notes: ' + activeItem.notes.slice(0, 120) + '…' : 'No additional notes.'}`)
  }

  // ── Table Sort ───────────────────────────────────────────────────────────────

  const sortedItems = [...topItems].sort((a, b) => {
    const va = ((a as unknown) as Record<string, unknown>)[sortCol] as string ?? ''
    const vb = ((b as unknown) as Record<string, unknown>)[sortCol] as string ?? ''
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
  })

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const groupForItem = (item: TrackerItem) => groups.find(g => g.id === item.group_id)

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Loading tracker…</span>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">
            {entityType ? `${entityType.replace('_', ' ')} tasks` : 'Tracker'}
          </span>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {topItems.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setView('board')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                view === 'board' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Board
            </button>
            <button
              onClick={() => setView('table')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                view === 'table' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" /> Table
            </button>
          </div>
          <button
            onClick={() => openNewModal()}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#6B7EFF] hover:bg-[#5a6ee8] text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Item
          </button>
        </div>
      </div>

      {/* ── Board View ──────────────────────────────────────────────────────── */}
      {view === 'board' && (
        <div className="space-y-4">
          {groups.map(group => {
            const groupItems = topItems.filter(i => i.group_id === group.id)
            const isCollapsed = collapsedGroups.has(group.id)
            return (
              <div key={group.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {/* Group header */}
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setCollapsedGroups(prev => {
                    const next = new Set(prev)
                    if (next.has(group.id)) next.delete(group.id)
                    else next.add(group.id)
                    return next
                  })}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
                    <span className="text-sm font-semibold text-slate-800">{group.name}</span>
                    <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                      {groupItems.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); openNewModal(group.id) }}
                      className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-[#6B7EFF] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    {isCollapsed
                      ? <ChevronRight className="w-4 h-4 text-slate-400" />
                      : <ChevronDown  className="w-4 h-4 text-slate-400" />
                    }
                  </div>
                </div>

                {/* Items */}
                {!isCollapsed && (
                  <div className="divide-y divide-slate-100">
                    {groupItems.length === 0 && (
                      <div className="px-4 py-6 text-center text-xs text-slate-400">
                        No items yet —{' '}
                        <button
                          className="text-[#6B7EFF] hover:underline"
                          onClick={() => openNewModal(group.id)}
                        >
                          add one
                        </button>
                      </div>
                    )}
                    {groupItems.map(item => {
                      const subs = subitemsMap[item.id] ?? []
                      const isExpanded = expanded.has(item.id)
                      return (
                        <div key={item.id}>
                          <div
                            className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer group transition-colors ${cardAuraBorder(item)}`}
                            onClick={() => openDrawer(item)}
                          >
                            {/* Type badge */}
                            <span className={`mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${typeColor(item.type)}`}>
                              {item.type[0].toUpperCase()}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-800 truncate">{item.title}</span>
                                {subs.length > 0 && (
                                  <button
                                    className="flex items-center gap-0.5 text-[10px] text-slate-400 hover:text-slate-600 shrink-0"
                                    onClick={e => { e.stopPropagation(); setExpanded(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n }) }}
                                  >
                                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                    {subs.length}
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor(item.status)}`}>
                                  {statusLabel(item.status)}
                                </span>
                                {item.priority && (
                                  <span className="text-[10px] text-slate-400">{item.priority}</span>
                                )}
                                {item.owner_name && (
                                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                    <User className="w-2.5 h-2.5" />{item.owner_name}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500 transition-all shrink-0"
                              onClick={e => { e.stopPropagation(); deleteItem(item.id) }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Sub-items */}
                          {isExpanded && subs.map(sub => (
                            <div
                              key={sub.id}
                              className={`flex items-start gap-3 pl-10 pr-4 py-2.5 bg-slate-50/60 hover:bg-slate-50 cursor-pointer group border-t border-slate-100 ${cardAuraBorder(sub)}`}
                              onClick={() => openDrawer(sub)}
                            >
                              <ArrowRight className="w-3 h-3 text-slate-300 mt-1 shrink-0" />
                              <span className={`mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${typeColor(sub.type)}`}>
                                {sub.type[0].toUpperCase()}
                              </span>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs text-slate-700 truncate block">{sub.title}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor(sub.status)}`}>
                                  {statusLabel(sub.status)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })}

                    {/* NL quick-add bar */}
                    {nlGroup === group.id ? (
                      <div className="flex items-center gap-2 px-4 py-2 border-t border-slate-100">
                        <input
                          autoFocus
                          value={nlInput}
                          onChange={e => setNlInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') submitNl(group.id); if (e.key === 'Escape') setNlGroup('') }}
                          placeholder="Describe the item and press Enter…"
                          className="flex-1 text-xs bg-transparent outline-none text-slate-700 placeholder-slate-400"
                        />
                        <button onClick={() => submitNl(group.id)} className="text-[#6B7EFF] hover:text-[#5a6ee8]">
                          <Send className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setNlGroup('')} className="text-slate-400 hover:text-slate-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-400 hover:text-[#6B7EFF] hover:bg-slate-50 border-t border-slate-100 transition-colors"
                        onClick={() => setNlGroup(group.id)}
                      >
                        <Plus className="w-3.5 h-3.5" /> Add item
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Table View ──────────────────────────────────────────────────────── */}
      {view === 'table' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 font-medium">
                {[
                  { key: 'title',      label: 'Title' },
                  { key: 'group_id',   label: 'Group' },
                  { key: 'type',       label: 'Type' },
                  { key: 'status',     label: 'Status' },
                  { key: 'priority',   label: 'Priority' },
                  { key: 'owner_name', label: 'Owner' },
                  { key: 'updated_at', label: 'Updated' },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="px-3 py-2.5 text-left cursor-pointer hover:text-slate-800 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {sortCol === col.key && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-xs text-slate-400 py-8">
                    No items yet — <button className="text-[#6B7EFF] hover:underline" onClick={() => openNewModal()}>add one</button>
                  </td>
                </tr>
              )}
              {sortedItems.map(item => (
                <tr
                  key={item.id}
                  onClick={() => openDrawer(item)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2.5 text-slate-800 font-medium max-w-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: groupForItem(item)?.color ?? '#94a3b8' }} />
                      <span className="truncate">{item.title}</span>
                      {(subitemsMap[item.id]?.length ?? 0) > 0 && (
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 rounded shrink-0">
                          +{subitemsMap[item.id].length}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs">
                    {groupForItem(item)?.name ?? '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${typeColor(item.type)}`}>
                      {item.type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 capitalize">{item.priority ?? '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{item.owner_name ?? '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-400">
                    {new Date(item.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Item Drawer ──────────────────────────────────────────────────────── */}
      {activeItem && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setActiveItem(null)}>
          <div
            className="relative bg-white w-full max-w-xl h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className={`flex items-start gap-3 px-5 py-4 border-b border-slate-200 ${cardAuraBorder(activeItem)}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${typeColor(activeItem.type)}`}>
                    {activeItem.type}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor(activeItem.status)}`}>
                    {statusLabel(activeItem.status)}
                  </span>
                  {activeItem.priority && (
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{activeItem.priority}</span>
                  )}
                </div>
                <h2 className="text-base font-semibold text-slate-900 leading-snug">{activeItem.title}</h2>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                  {activeItem.reporter_name && <span>Reported by {activeItem.reporter_name}</span>}
                  {activeItem.date_reported && <span>{new Date(activeItem.date_reported).toLocaleDateString()}</span>}
                  {activeItem.owner_name    && <span className="flex items-center gap-1"><User className="w-3 h-3" />{activeItem.owner_name}</span>}
                </div>
              </div>
              <button onClick={() => setActiveItem(null)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* AI TL;DR */}
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              {aiSummary ? (
                <p className="text-xs text-slate-600 leading-relaxed">{aiSummary}</p>
              ) : (
                <button
                  onClick={generateAiSummary}
                  className="flex items-center gap-1.5 text-xs text-[#6B7EFF] hover:text-[#5a6ee8] font-medium"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Generate AI summary
                </button>
              )}
            </div>

            {/* Status quick actions */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 overflow-x-auto">
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => patchItem(activeItem.id, { status: s })}
                  className={`shrink-0 text-[10px] px-2 py-1 rounded-full font-medium transition-all border ${
                    activeItem.status === s
                      ? `${statusColor(s)} border-current ring-2 ring-offset-1 ring-[#6B7EFF]`
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {statusLabel(s)}
                </button>
              ))}
            </div>

            {/* Notes */}
            {activeItem.notes && (
              <div className="px-5 py-3 border-b border-slate-100">
                <p className="text-xs text-slate-500 font-medium mb-1">Notes</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{activeItem.notes}</p>
              </div>
            )}

            {/* Tabs */}
            <div className="flex items-center gap-0 border-b border-slate-200 px-5">
              {(['timeline', 'comments', 'files'] as DrawerTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setDrawerTab(tab)}
                  className={`px-3 py-2.5 text-xs font-medium capitalize border-b-2 transition-all -mb-px ${
                    drawerTab === tab
                      ? 'border-[#6B7EFF] text-[#6B7EFF]'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {drawerTab === 'timeline' && (
                <div className="px-5 py-4">
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>Created {new Date(activeItem.created_at).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>Updated {new Date(activeItem.updated_at).toLocaleString()}</span>
                  </div>
                  {activeItem.target_release && (
                    <div className="flex items-center gap-3 text-xs text-slate-600 mt-2">
                      <Layers className="w-3.5 h-3.5 shrink-0" />
                      <span>Target release: {activeItem.target_release}</span>
                    </div>
                  )}
                </div>
              )}

              {drawerTab === 'comments' && (
                <div className="px-5 py-4 space-y-4">
                  {comments.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">No comments yet.</p>
                  )}
                  {comments.map(c => (
                    <div key={c.id} className="flex gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-[#6B7EFF]/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] text-[#6B7EFF] font-bold">{c.author[0]?.toUpperCase()}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium text-slate-700">{c.author}</span>
                          <span className="text-[10px] text-slate-400">{new Date(c.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">{c.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {drawerTab === 'files' && (
                <div className="px-5 py-8 text-center text-xs text-slate-400">
                  File attachments coming soon.
                </div>
              )}
            </div>

            {/* Comment reply bar */}
            {drawerTab === 'comments' && (
              <div className="border-t border-slate-200 px-4 py-3 flex items-center gap-2 bg-white">
                <input
                  value={commentBody}
                  onChange={e => setCommentBody(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment() } }}
                  placeholder="Add a comment…"
                  className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#6B7EFF] placeholder-slate-400"
                />
                <button
                  onClick={sendComment}
                  disabled={commentSending || !commentBody.trim()}
                  className="p-2 bg-[#6B7EFF] hover:bg-[#5a6ee8] disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {commentSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            )}

            {/* Delete item */}
            <div className="border-t border-slate-100 px-5 py-3">
              <button
                onClick={() => deleteItem(activeItem.id)}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Item Modal ───────────────────────────────────────────────────── */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowNewModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">New Item</h3>
              <button onClick={() => setShowNewModal(false)} className="p-1 hover:bg-slate-100 rounded text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Title *</label>
                <input
                  autoFocus
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Describe the item…"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6B7EFF] placeholder-slate-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Group</label>
                  <select value={newItemGroup} onChange={e => setNewItemGroup(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#6B7EFF] bg-white">
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Type</label>
                  <select value={newType} onChange={e => setNewType(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#6B7EFF] bg-white capitalize">
                    {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Status</label>
                  <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#6B7EFF] bg-white">
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Priority</label>
                  <select value={newPriority} onChange={e => setNewPriority(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#6B7EFF] bg-white capitalize">
                    <option value="">—</option>
                    {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Notes</label>
                <textarea
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  rows={3}
                  placeholder="Optional details…"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6B7EFF] resize-none placeholder-slate-400"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50">
              <button onClick={() => setShowNewModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={createItem}
                disabled={saving || !newTitle.trim() || !newItemGroup}
                className="flex items-center gap-2 px-4 py-2 bg-[#6B7EFF] hover:bg-[#5a6ee8] disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
