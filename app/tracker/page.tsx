'use client'
import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus, Search, Filter, X, Download, Users, Settings,
  Loader2, Check, ChevronDown,
} from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const {
  BarChart3, GanttChart, LayoutGrid, Table2, Columns, Zap, CalendarDays,
  TrendingUp, UserCheck, Briefcase,
} = require('lucide-react') as any
import { TopBar } from '@/components/layout/TopBar'
import { BoardView } from '@/components/tracker/views/BoardView'
import { TableView } from '@/components/tracker/views/TableView'
import { GanttView } from '@/components/tracker/views/GanttView'
import { CalendarView } from '@/components/tracker/views/CalendarView'
import { ChartView } from '@/components/tracker/views/ChartView'
import { WorkloadView } from '@/components/tracker/views/WorkloadView'
import { TimelineView } from '@/components/tracker/views/TimelineView'
import { ItemDrawer } from '@/components/tracker/ItemDrawer'
import { AutomationsPanel } from '@/components/tracker/AutomationsPanel'
import type { TrackerItem, TrackerGroup } from '@/components/tracker/views/BoardView'

type ViewMode = 'board' | 'table' | 'gantt' | 'calendar' | 'chart' | 'workload' | 'timeline'

interface OrgUser { id: string; name: string; email: string; role: string }
interface Dependency { id: string; from_item_id: string; to_item_id: string; dep_type: string }

interface FilterRule {
  id: string
  field: string
  condition: string
  value: string
}

const VIEW_TABS: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
  { key: 'board',    label: 'Board',    icon: <Columns size={14} /> },
  { key: 'table',    label: 'Table',    icon: <Table2 size={14} /> },
  { key: 'gantt',    label: 'Gantt',    icon: <GanttChart size={14} /> },
  { key: 'calendar', label: 'Calendar', icon: <CalendarDays size={14} /> },
  { key: 'chart',    label: 'Charts',   icon: <BarChart3 size={14} /> },
  { key: 'workload', label: 'Workload', icon: <UserCheck size={14} /> },
  { key: 'timeline', label: 'Timeline', icon: <TrendingUp size={14} /> },
]

const FILTER_FIELDS = [
  { key: 'status',     label: 'Status' },
  { key: 'priority',   label: 'Priority' },
  { key: 'owner_name', label: 'Assignee' },
  { key: 'due_date',   label: 'Due Date' },
  { key: 'tags',       label: 'Tags' },
]

const FILTER_CONDITIONS: Record<string, string[]> = {
  status:     ['is', 'is not'],
  priority:   ['is', 'is not'],
  owner_name: ['is', 'is not', 'contains'],
  due_date:   ['is before', 'is after', 'is exactly'],
  tags:       ['contains'],
}

const STATUS_VALUES = ['new', 'in_progress', 'in_review', 'on_hold', 'done', 'blocked', 'wont_fix']
const PRIORITY_VALUES = ['low', 'medium', 'high', 'critical']

function applyFilters(items: TrackerItem[], filters: FilterRule[]): TrackerItem[] {
  if (filters.length === 0) return items
  return items.filter(item => {
    return filters.every(f => {
      const rawVal = (item as unknown as Record<string, unknown>)[f.field]
      const val = Array.isArray(rawVal) ? rawVal.join(' ') : String(rawVal ?? '').toLowerCase()
      const fval = f.value.toLowerCase()
      switch (f.condition) {
        case 'is':         return val === fval
        case 'is not':     return val !== fval
        case 'contains':   return val.includes(fval)
        case 'is before':  return item.due_date ? new Date(item.due_date) < new Date(f.value) : false
        case 'is after':   return item.due_date ? new Date(item.due_date) > new Date(f.value) : false
        case 'is exactly': return val === fval
        default:           return true
      }
    })
  })
}

export default function TrackerPage() {
  const [groups,       setGroups]       = useState<TrackerGroup[]>([])
  const [items,        setItems]        = useState<TrackerItem[]>([])
  const [orgUsers,     setOrgUsers]     = useState<OrgUser[]>([])
  const [dependencies, setDependencies] = useState<Dependency[]>([])
  const [loading,      setLoading]      = useState(true)
  const [view,         setView]         = useState<ViewMode>('board')
  const [activeItem,   setActiveItem]   = useState<TrackerItem | null>(null)
  const [showAutomations, setShowAutomations] = useState(false)
  const [search,       setSearch]       = useState('')
  const [showFilter,   setShowFilter]   = useState(false)
  const [filters,      setFilters]      = useState<FilterRule[]>([])
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set())
  const [showBulkMenu, setShowBulkMenu] = useState(false)
  const [showMobileViewMenu, setShowMobileViewMenu] = useState(false)

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadGroups = useCallback(async () => {
    const res = await fetch('/api/tracker/groups')
    if (!res.ok) return []
    return await res.json() as TrackerGroup[]
  }, [])

  const loadItems = useCallback(async (groupIds: string[]) => {
    if (!groupIds.length) return []
    const params = new URLSearchParams({ group_ids: groupIds.join(','), include_subitems: 'true' })
    const res = await fetch(`/api/tracker/items?${params}`)
    if (!res.ok) return []
    return await res.json() as TrackerItem[]
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    const grps = await loadGroups()
    setGroups(grps)
    const allItems = await loadItems(grps.map(g => g.id))
    setItems(allItems)

    // Load dependencies
    try {
      const dRes = await fetch('/api/tracker/dependencies')
      if (dRes.ok) {
        const d = await dRes.json()
        setDependencies(d.dependencies ?? [])
      }
    } catch { /* noop */ }

    setLoading(false)
  }, [loadGroups, loadItems])

  useEffect(() => { void loadAll() }, [loadAll])

  // Load org users
  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.ok ? r.json() : { users: [] })
      .then(d => {
        const list: OrgUser[] = (d.users ?? []).map((u: Record<string, unknown>) => ({
          id:    u.id as string,
          name:  [u.first_name, u.last_name].filter(Boolean).join(' ') || (u.email as string),
          email: u.email as string,
          role:  (u.role as string) ?? '',
        }))
        setOrgUsers(list)
      })
      .catch(() => {})
  }, [])

  // ── Item actions ─────────────────────────────────────────────────────────────

  const handleItemUpdate = useCallback(async (id: string, patch: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/tracker/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (res.ok) {
        const updated: TrackerItem = await res.json()
        setItems(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i))
        setActiveItem(prev => prev?.id === id ? { ...prev, ...updated } : prev)
      }
    } catch { /* noop */ }
  }, [])

  const handleItemDelete = useCallback((id: string) => {
    void fetch(`/api/tracker/items/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
    setActiveItem(prev => prev?.id === id ? null : prev)
  }, [])

  const handleItemCreate = useCallback(async (groupId: string, status: string, title: string, dueDate?: string) => {
    const targetGroupId = groupId || groups[0]?.id
    if (!targetGroupId) return
    try {
      const res = await fetch('/api/tracker/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: targetGroupId, title, status,
          type: 'task',
          due_date: dueDate ?? null,
        }),
      })
      if (res.ok) {
        const newItem: TrackerItem = await res.json()
        setItems(prev => [newItem, ...prev])
      }
    } catch { /* noop */ }
  }, [groups])

  // ── Bulk actions ─────────────────────────────────────────────────────────────

  const bulkUpdate = useCallback(async (patch: Record<string, unknown>) => {
    await Promise.all(Array.from(selectedIds).map(id => handleItemUpdate(id, patch)))
    setSelectedIds(new Set())
    setShowBulkMenu(false)
  }, [selectedIds, handleItemUpdate])

  const bulkDelete = useCallback(() => {
    if (!confirm(`Delete ${selectedIds.size} items?`)) return
    Array.from(selectedIds).forEach(handleItemDelete)
    setSelectedIds(new Set())
  }, [selectedIds, handleItemDelete])

  // ── Filter helpers ────────────────────────────────────────────────────────────

  function addFilter() {
    setFilters(prev => [...prev, {
      id: Math.random().toString(36).slice(2),
      field: 'status', condition: 'is', value: '',
    }])
  }

  function updateFilter(id: string, patch: Partial<FilterRule>) {
    setFilters(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f))
  }

  function removeFilter(id: string) {
    setFilters(prev => prev.filter(f => f.id !== id))
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const searchedItems = search
    ? items.filter(i => i.title.toLowerCase().includes(search.toLowerCase()))
    : items

  const filteredItems = applyFilters(searchedItems, filters)

  // ── Export CSV ────────────────────────────────────────────────────────────────

  function exportCsv() {
    const topItems = filteredItems.filter(i => !i.parent_item_id)
    const rows = [
      ['Title', 'Status', 'Priority', 'Assignee', 'Due Date', 'Progress', 'Tags', 'Group'],
      ...topItems.map(i => [
        i.title, i.status, i.priority, i.owner_name ?? '', i.due_date ?? '',
        String(i.progress_pct ?? 0) + '%',
        (i.tags ?? []).join(', '),
        groups.find(g => g.id === i.group_id)?.name ?? '',
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = `tracker-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // ── Item click ───────────────────────────────────────────────────────────────

  const handleItemClick = useCallback((item: TrackerItem) => {
    setActiveItem(item)
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={28} style={{ color: '#6B7EFF', animation: 'spin 1s linear infinite' }} />
        <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const topItemCount = filteredItems.filter(i => !i.parent_item_id).length
  const doneCount    = filteredItems.filter(i => i.status === 'done' && !i.parent_item_id).length
  const defaultGroupId = groups[0]?.id ?? ''

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>

      {/* TopBar */}
      <TopBar
        title="Nexus Tracker"
        subtitle={`${topItemCount} items · ${doneCount} done`}
        actions={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={() => { handleItemCreate('', 'new', 'New Task') }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
                borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: '#6B7EFF', color: '#fff', border: 'none', cursor: 'pointer',
              }}
            >
              <Plus size={14} /> New Item
            </button>
          </div>
        }
      />

      {/* Sub-toolbar */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #E2E8F0',
        padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items..."
            style={{
              width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
              border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none',
              background: '#F8FAFC', boxSizing: 'border-box',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <X size={12} color="#94A3B8" />
            </button>
          )}
        </div>

        {/* View tabs — desktop */}
        <div style={{ display: 'flex', gap: 2, background: '#F1F5F9', padding: '3px', borderRadius: 9, flexWrap: 'nowrap', overflowX: 'auto' }} className="hidden-on-mobile">
          {VIEW_TABS.map(vt => (
            <button
              key={vt.key}
              onClick={() => setView(vt.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: 'none',
                background: view === vt.key ? '#fff' : 'transparent',
                color: view === vt.key ? '#1E293B' : '#64748B',
                boxShadow: view === vt.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                whiteSpace: 'nowrap',
                transition: 'background 0.1s, box-shadow 0.1s',
              }}
            >
              {vt.icon} {vt.label}
            </button>
          ))}
        </div>

        {/* View picker — mobile */}
        <div style={{ position: 'relative' }} className="mobile-view-picker">
          <button
            onClick={() => setShowMobileViewMenu(!showMobileViewMenu)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 8, border: '1px solid #E2E8F0',
              background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151',
            }}
          >
            {VIEW_TABS.find(v => v.key === view)?.icon}
            {VIEW_TABS.find(v => v.key === view)?.label}
            <ChevronDown size={12} />
          </button>
          {showMobileViewMenu && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 30,
              background: '#fff', border: '1px solid #E2E8F0',
              borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              minWidth: 160, marginTop: 4, overflow: 'hidden',
            }}>
              {VIEW_TABS.map(vt => (
                <button key={vt.key} onClick={() => { setView(vt.key); setShowMobileViewMenu(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '9px 14px', border: 'none', background: view === vt.key ? '#EEF2FF' : 'transparent',
                    color: view === vt.key ? '#6B7EFF' : '#374151', fontSize: 13, cursor: 'pointer',
                    fontWeight: view === vt.key ? 700 : 400,
                  }}>
                  {view === vt.key && <Check size={12} />}
                  {vt.icon} {vt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: '#E2E8F0', flexShrink: 0 }} />

        {/* Filter button */}
        <button
          onClick={() => setShowFilter(!showFilter)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
            borderRadius: 8, border: `1px solid ${showFilter ? '#6B7EFF' : '#E2E8F0'}`,
            background: showFilter ? '#EEF2FF' : '#fff', fontSize: 12, fontWeight: 600,
            color: showFilter ? '#6B7EFF' : '#64748B', cursor: 'pointer',
          }}
        >
          <Filter size={13} />
          Filter
          {filters.length > 0 && (
            <span style={{ background: '#6B7EFF', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>
              {filters.length}
            </span>
          )}
        </button>

        {/* Group by (cosmetic) */}
        <button style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
          borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff',
          fontSize: 12, fontWeight: 600, color: '#64748B', cursor: 'pointer',
        }}>
          <Briefcase size={13} /> Group
        </button>

        {/* Columns */}
        <button style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
          borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff',
          fontSize: 12, fontWeight: 600, color: '#64748B', cursor: 'pointer',
        }}>
          <Settings size={13} /> Columns
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {/* Automations */}
          <button
            onClick={() => setShowAutomations(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
              borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff',
              fontSize: 12, fontWeight: 600, color: '#64748B', cursor: 'pointer',
            }}
          >
            <Zap size={13} /> Automations
          </button>

          {/* Export */}
          <button
            onClick={exportCsv}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
              borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff',
              fontSize: 12, fontWeight: 600, color: '#64748B', cursor: 'pointer',
            }}
          >
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilter && (
        <div style={{
          background: '#fff', borderBottom: '1px solid #E2E8F0',
          padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          {filters.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '4px 8px' }}>
              <select value={f.field} onChange={e => updateFilter(f.id, { field: e.target.value, condition: FILTER_CONDITIONS[e.target.value]?.[0] ?? 'is', value: '' })}
                style={{ border: 'none', background: 'transparent', fontSize: 12, outline: 'none', color: '#374151', fontWeight: 600 }}>
                {FILTER_FIELDS.map(ff => <option key={ff.key} value={ff.key}>{ff.label}</option>)}
              </select>
              <select value={f.condition} onChange={e => updateFilter(f.id, { condition: e.target.value })}
                style={{ border: 'none', background: 'transparent', fontSize: 12, outline: 'none', color: '#64748B' }}>
                {(FILTER_CONDITIONS[f.field] ?? ['is']).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {f.field === 'status' ? (
                <select value={f.value} onChange={e => updateFilter(f.id, { value: e.target.value })}
                  style={{ border: 'none', background: 'transparent', fontSize: 12, outline: 'none', color: '#374151' }}>
                  <option value="">any</option>
                  {STATUS_VALUES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : f.field === 'priority' ? (
                <select value={f.value} onChange={e => updateFilter(f.id, { value: e.target.value })}
                  style={{ border: 'none', background: 'transparent', fontSize: 12, outline: 'none', color: '#374151' }}>
                  <option value="">any</option>
                  {PRIORITY_VALUES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (
                <input value={f.value} onChange={e => updateFilter(f.id, { value: e.target.value })}
                  placeholder="value..."
                  style={{ border: 'none', background: 'transparent', fontSize: 12, outline: 'none', color: '#374151', width: 90 }} />
              )}
              <button onClick={() => removeFilter(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#94A3B8' }}>
                <X size={12} />
              </button>
            </div>
          ))}
          <button onClick={addFilter}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7, border: '1px dashed #E2E8F0', background: 'transparent', fontSize: 12, color: '#64748B', cursor: 'pointer' }}>
            <Plus size={12} /> Add filter
          </button>
          {filters.length > 0 && (
            <button onClick={() => setFilters([])} style={{ fontSize: 12, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div style={{
          background: '#1E293B', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{selectedIds.size} selected</span>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowBulkMenu(!showBulkMenu)} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7,
              border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, cursor: 'pointer',
            }}>
              Change Status <ChevronDown size={12} />
            </button>
            {showBulkMenu && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 30,
                background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 160, marginTop: 4, overflow: 'hidden',
              }}>
                {['new', 'in_progress', 'done', 'blocked', 'on_hold'].map(s => (
                  <button key={s} onClick={() => bulkUpdate({ status: s })}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent', fontSize: 12, cursor: 'pointer', color: '#374151' }}>
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => bulkUpdate({ owner_name: null })} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
            <Users size={13} style={{ display: 'inline', marginRight: 5 }} />
            Unassign
          </button>
          <button onClick={bulkDelete} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.15)', color: '#FCA5A5', fontSize: 12, cursor: 'pointer' }}>
            Delete
          </button>
          <button onClick={() => setSelectedIds(new Set())} style={{ marginLeft: 'auto', color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>
        {groups.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <LayoutGrid size={40} style={{ margin: '0 auto 12px', display: 'block', color: '#CBD5E1' }} />
            <p style={{ fontSize: 14, color: '#94A3B8' }}>No boards yet. Run migration 106 and refresh.</p>
          </div>
        ) : (
          <>
            {view === 'board' && (
              <BoardView
                items={filteredItems}
                groups={groups}
                onItemClick={handleItemClick}
                onItemCreate={handleItemCreate}
              />
            )}
            {view === 'table' && (
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
                <TableView
                  items={filteredItems}
                  groups={groups}
                  orgUsers={orgUsers}
                  onItemClick={handleItemClick}
                  onItemUpdate={handleItemUpdate}
                  onItemCreate={handleItemCreate}
                  selectedIds={selectedIds}
                  onToggleSelect={id => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })}
                  onSelectAll={ids => setSelectedIds(new Set(ids))}
                />
              </div>
            )}
            {view === 'gantt' && (
              <GanttView
                items={filteredItems}
                groups={groups}
                dependencies={dependencies}
                onItemClick={handleItemClick}
                onItemUpdate={handleItemUpdate}
              />
            )}
            {view === 'calendar' && (
              <CalendarView
                items={filteredItems}
                onItemClick={handleItemClick}
                onItemCreate={(gId, status, title, dueDate) => handleItemCreate(gId || defaultGroupId, status, title, dueDate)}
                defaultGroupId={defaultGroupId}
              />
            )}
            {view === 'chart' && (
              <ChartView
                items={filteredItems}
                groups={groups}
              />
            )}
            {view === 'workload' && (
              <WorkloadView
                items={filteredItems}
                orgUsers={orgUsers}
              />
            )}
            {view === 'timeline' && (
              <TimelineView
                items={filteredItems}
                orgUsers={orgUsers}
                onItemClick={handleItemClick}
              />
            )}
          </>
        )}
      </div>

      {/* Item Drawer */}
      {activeItem && (
        <ItemDrawer
          item={activeItem}
          groups={groups}
          allItems={items}
          orgUsers={orgUsers}
          onClose={() => setActiveItem(null)}
          onUpdate={handleItemUpdate}
          onDelete={handleItemDelete}
        />
      )}

      {/* Automations Panel */}
      {showAutomations && (
        <AutomationsPanel onClose={() => setShowAutomations(false)} />
      )}

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 768px) {
          .mobile-view-picker { display: none; }
        }
        @media (max-width: 767px) {
          .hidden-on-mobile { display: none !important; }
        }
      `}</style>
    </div>
  )
}
