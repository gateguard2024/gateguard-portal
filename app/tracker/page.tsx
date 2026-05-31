'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import {
  Plus, X, ChevronDown, ChevronRight, Send, Layers,
  Loader2, Trash2, User,
} from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Mic, Sparkles, Bot } = require('lucide-react') as any

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrackerGroup {
  id: string
  name: string
  color: string
  position: number
  org_id: string
  created_at: string
}

interface TrackerItem {
  id: string
  group_id: string
  title: string
  type: 'bug' | 'enhancement' | 'question' | 'task'
  module?: string
  severity?: string
  priority?: string
  status: 'new' | 'in_progress' | 'done' | 'blocked' | 'on_hold'
  owner_name?: string
  reporter_name?: string
  date_reported?: string
  target_release?: string
  notes?: string
  position: number
  created_at: string
  updated_at: string
}

interface TrackerComment {
  id: string
  item_id: string
  author_name: string
  author_initials: string
  body: string
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cardAura(item: TrackerItem): { border: string; shadow: string; bg: string } {
  if (item.severity === '5_critical') {
    return { border: '#ef4444', shadow: '0 0 14px rgba(239,68,68,0.20)', bg: 'rgba(239,68,68,0.07)' }
  }
  if (item.status === 'in_progress') {
    return { border: '#f59e0b', shadow: '0 0 12px rgba(245,158,11,0.16)', bg: 'rgba(245,158,11,0.05)' }
  }
  if (item.type === 'enhancement') {
    return { border: '#8b5cf6', shadow: '0 0 10px rgba(139,92,246,0.14)', bg: 'rgba(139,92,246,0.05)' }
  }
  if (item.status === 'done') {
    return { border: '#10b981', shadow: '0 0 8px rgba(16,185,129,0.12)', bg: 'rgba(16,185,129,0.04)' }
  }
  if (item.status === 'blocked') {
    return { border: '#f97316', shadow: '0 0 10px rgba(249,115,22,0.15)', bg: 'rgba(249,115,22,0.05)' }
  }
  if (item.type === 'question') {
    return { border: '#db2777', shadow: '0 0 8px rgba(219,39,119,0.10)', bg: 'rgba(219,39,119,0.04)' }
  }
  if (item.type === 'bug' && item.status === 'new') {
    return { border: '#ef4444', shadow: '0 0 10px rgba(239,68,68,0.12)', bg: 'rgba(239,68,68,0.04)' }
  }
  return { border: '#1e3a5f', shadow: 'none', bg: 'rgba(255,255,255,0.025)' }
}

function typeColor(type: string): string {
  if (type === 'bug')         return '#ef4444'
  if (type === 'enhancement') return '#8b5cf6'
  if (type === 'question')    return '#db2777'
  return '#6B7EFF'
}

function statusLabel(s: string): string {
  return s === 'new' ? 'New'
    : s === 'in_progress' ? 'In Progress'
    : s === 'done'        ? 'Done'
    : s === 'blocked'     ? 'Blocked'
    : s === 'on_hold'     ? 'On Hold'
    : s
}

function severityLabel(s: string): string {
  return s === '1_info'      ? 'Info'
    : s === '2_minor'        ? 'Minor'
    : s === '3_moderate'     ? 'Moderate'
    : s === '4_major'        ? 'Major'
    : s === '5_critical'     ? 'Critical'
    : s
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TrackerPage() {
  const [groups,          setGroups]          = useState<TrackerGroup[]>([])
  const [items,           setItems]           = useState<TrackerItem[]>([])
  const [selectedItem,    setSelectedItem]    = useState<TrackerItem | null>(null)
  const [comments,        setComments]        = useState<TrackerComment[]>([])
  const [drawerTab,       setDrawerTab]       = useState<'timeline' | 'updates' | 'files'>('timeline')
  const [filterType,      setFilterType]      = useState<string>('all')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [newComment,      setNewComment]      = useState('')
  const [showNewItem,     setShowNewItem]     = useState(false)
  const [loading,         setLoading]         = useState(true)
  const [submitting,      setSubmitting]      = useState(false)
  const [newItemForm,     setNewItemForm]     = useState({
    title: '', group_id: '', type: 'bug', module: '', severity: '', priority: 'medium',
  })
  const commentRef = useRef<HTMLTextAreaElement>(null)

  // ─── Data ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      const [gRes, iRes] = await Promise.all([
        fetch('/api/tracker/groups'),
        fetch('/api/tracker/items'),
      ])
      const g: TrackerGroup[] = await gRes.json()
      const i: TrackerItem[]  = await iRes.json()
      const gs = Array.isArray(g) ? g : []
      const is = Array.isArray(i) ? i : []
      setGroups(gs)
      setItems(is)
      if (gs.length > 0) {
        setNewItemForm(f => f.group_id ? f : { ...f, group_id: gs[0].id })
      }
    } catch (_) {
      /* silently ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const fetchComments = useCallback(async (itemId: string) => {
    try {
      const res = await fetch(`/api/tracker/items/${itemId}/comments`)
      const c: TrackerComment[] = await res.json()
      setComments(Array.isArray(c) ? c : [])
    } catch (_) { setComments([]) }
  }, [])

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleSelectItem = useCallback((item: TrackerItem) => {
    setSelectedItem(item)
    setDrawerTab('timeline')
    fetchComments(item.id)
  }, [fetchComments])

  const handleUpdateStatus = useCallback(async (id: string, status: TrackerItem['status']) => {
    try {
      const res = await fetch(`/api/tracker/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const updated: TrackerItem = await res.json()
      setItems(prev => prev.map(it => it.id === id ? updated : it))
      setSelectedItem(prev => prev?.id === id ? updated : prev)
    } catch (_) { /* noop */ }
  }, [])

  const handleDeleteItem = useCallback(async (id: string) => {
    if (!confirm('Delete this item?')) return
    try {
      await fetch(`/api/tracker/items/${id}`, { method: 'DELETE' })
      setItems(prev => prev.filter(it => it.id !== id))
      if (selectedItem?.id === id) setSelectedItem(null)
    } catch (_) { /* noop */ }
  }, [selectedItem])

  const handleAddComment = useCallback(async () => {
    if (!newComment.trim() || !selectedItem) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/tracker/items/${selectedItem.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newComment.trim() }),
      })
      const c: TrackerComment = await res.json()
      setComments(prev => [...prev, c])
      setNewComment('')
    } catch (_) { /* noop */ } finally { setSubmitting(false) }
  }, [newComment, selectedItem])

  const handleCreateItem = useCallback(async () => {
    if (!newItemForm.title.trim() || !newItemForm.group_id) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/tracker/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newItemForm,
          severity: newItemForm.severity || undefined,
          module:   newItemForm.module   || undefined,
        }),
      })
      if (res.ok) {
        setShowNewItem(false)
        setNewItemForm(f => ({ ...f, title: '', module: '', severity: '' }))
        await fetchAll()
      }
    } catch (_) { /* noop */ } finally { setSubmitting(false) }
  }, [newItemForm, fetchAll])

  // ─── Derived ───────────────────────────────────────────────────────────────

  const filteredItems = filterType === 'all'
    ? items
    : items.filter(i => i.type === filterType)

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#060e1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} style={{ color: '#6B7EFF', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#060e1a', display: 'flex', flexDirection: 'column' }}>
      {/* ── TopBar ── */}
      <TopBar
        title="Nexus Tracker"
        subtitle="Bugs · Enhancements · Questions"
        actions={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {(['all', 'bug', 'enhancement', 'question', 'task'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                style={{
                  padding: '4px 11px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  border: filterType === t
                    ? `1px solid ${t === 'all' ? '#6B7EFF' : typeColor(t)}`
                    : '1px solid rgba(255,255,255,0.07)',
                  background: filterType === t
                    ? `${t === 'all' ? '#6B7EFF' : typeColor(t)}22`
                    : 'transparent',
                  color: filterType === t
                    ? (t === 'all' ? '#a5b4fc' : typeColor(t))
                    : '#475569',
                  cursor: 'pointer', textTransform: 'capitalize',
                }}
              >
                {t === 'all' ? 'All' : t}
              </button>
            ))}
            <button
              onClick={() => setShowNewItem(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: '#6B7EFF', color: '#fff', border: 'none', cursor: 'pointer',
                marginLeft: 4,
              }}
            >
              <Plus size={14} /> New Item
            </button>
          </div>
        }
      />

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* ── Board ── */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '28px 32px',
          background: '#070e20',
        }}>
          {groups.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#334155', paddingTop: 80 }}>
              <Layers size={40} style={{ margin: '0 auto 14px', display: 'block', opacity: 0.4 }} />
              <p style={{ fontSize: 14 }}>Run migration 102 and refresh to see groups.</p>
            </div>
          ) : (
            groups.map(group => {
              const groupItems = filteredItems.filter(it => it.group_id === group.id)
              const isCollapsed = collapsedGroups.has(group.id)

              return (
                <div key={group.id} style={{ marginBottom: 36 }}>
                  {/* Group header */}
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, marginBottom: isCollapsed ? 0 : 14,
                      cursor: 'pointer', userSelect: 'none',
                    }}
                    onClick={() => setCollapsedGroups(prev => {
                      const next = new Set(prev)
                      next.has(group.id) ? next.delete(group.id) : next.add(group.id)
                      return next
                    })}
                  >
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: group.color,
                      boxShadow: `0 0 8px ${group.color}88`,
                    }} />
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: '#e2e8f0',
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                    }}>
                      {group.name}
                    </span>
                    <span style={{ fontSize: 11, color: '#334155', fontWeight: 500 }}>
                      {groupItems.length}
                    </span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.04)' }} />
                    {isCollapsed
                      ? <ChevronRight size={13} color="#334155" />
                      : <ChevronDown size={13} color="#334155" />
                    }
                  </div>

                  {/* Cards */}
                  {!isCollapsed && (
                    <div>
                      {groupItems.length === 0 && (
                        <p style={{ fontSize: 12, color: '#1e3a5f', fontStyle: 'italic', paddingLeft: 4, margin: '0 0 10px' }}>
                          No items
                        </p>
                      )}

                      {groupItems.map(item => {
                        const aura = cardAura(item)
                        const isSelected = selectedItem?.id === item.id
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleSelectItem(item)}
                            style={{
                              background: isSelected ? 'rgba(107,126,255,0.09)' : aura.bg,
                              border: `1px solid ${isSelected ? '#6B7EFF55' : aura.border + '55'}`,
                              borderLeft: `3px solid ${aura.border}`,
                              boxShadow: isSelected ? '0 0 16px rgba(107,126,255,0.18)' : aura.shadow,
                              borderRadius: 9,
                              padding: '10px 14px',
                              marginBottom: 7,
                              cursor: 'pointer',
                              transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
                            }}
                          >
                            {/* Type + chips row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                color: typeColor(item.type), letterSpacing: '0.05em',
                              }}>
                                {item.type}
                              </span>
                              {item.severity && (
                                <span style={{ fontSize: 10, color: '#64748b', background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: 4 }}>
                                  {severityLabel(item.severity)}
                                </span>
                              )}
                              {item.module && (
                                <span style={{ fontSize: 10, color: '#475569', background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: 4 }}>
                                  {item.module}
                                </span>
                              )}
                            </div>

                            {/* Title */}
                            <p style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0', margin: '0 0 7px', lineHeight: 1.4 }}>
                              {item.title}
                            </p>

                            {/* Status + meta row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                                background: item.status === 'done'        ? 'rgba(16,185,129,0.12)'
                                  : item.status === 'in_progress'         ? 'rgba(245,158,11,0.12)'
                                  : item.status === 'blocked'             ? 'rgba(249,115,22,0.12)'
                                  : item.status === 'on_hold'             ? 'rgba(100,116,139,0.10)'
                                  :                                         'rgba(148,163,184,0.07)',
                                color: item.status === 'done'             ? '#10b981'
                                  : item.status === 'in_progress'         ? '#f59e0b'
                                  : item.status === 'blocked'             ? '#f97316'
                                  : item.status === 'on_hold'             ? '#64748b'
                                  :                                         '#475569',
                              }}>
                                {statusLabel(item.status)}
                              </span>
                              {item.owner_name && (
                                <span style={{ fontSize: 10, color: '#475569', display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <User size={9} /> {item.owner_name}
                                </span>
                              )}
                              <span style={{ fontSize: 10, color: '#1e3a5f', marginLeft: 'auto' }}>
                                {timeAgo(item.created_at)}
                              </span>
                            </div>
                          </div>
                        )
                      })}

                      {/* NL Automation bar */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, marginTop: 8,
                        background: 'rgba(107,126,255,0.03)',
                        border: '1px dashed rgba(107,126,255,0.10)',
                        borderRadius: 8, padding: '7px 12px',
                      }}>
                        <Bot size={13} color="#6B7EFF" style={{ flexShrink: 0, opacity: 0.6 }} />
                        <input
                          placeholder={`Tell Nexus what to do with ${group.name}…`}
                          onClick={e => e.stopPropagation()}
                          style={{
                            flex: 1, background: 'none', border: 'none', outline: 'none',
                            fontSize: 12, color: '#475569', fontStyle: 'italic',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* ── Right Drawer ── */}
        {selectedItem && (
          <div style={{
            width: 360, flexShrink: 0,
            background: '#0a1222',
            borderLeft: '1px solid rgba(255,255,255,0.055)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Drawer top */}
            <div style={{ padding: '16px 16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: typeColor(selectedItem.type) }} />
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: typeColor(selectedItem.type), letterSpacing: '0.07em' }}>
                    {selectedItem.type}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155', padding: 2 }}
                >
                  <X size={15} />
                </button>
              </div>

              <h2 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: '0 0 10px', lineHeight: 1.4 }}>
                {selectedItem.title}
              </h2>

              {/* AI TL;DR */}
              <div style={{
                display: 'flex', gap: 8, alignItems: 'flex-start',
                background: 'rgba(107,126,255,0.055)', borderRadius: 8,
                border: '1px solid rgba(107,126,255,0.12)',
                padding: '8px 10px', marginBottom: 12,
              }}>
                <Sparkles size={12} color="#6B7EFF" style={{ marginTop: 2, flexShrink: 0 }} />
                <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, fontStyle: 'italic', lineHeight: 1.55 }}>
                  {selectedItem.type === 'bug'
                    ? `${severityLabel(selectedItem.severity || '2_minor')} bug in ${selectedItem.module || 'the portal'}. Status: ${statusLabel(selectedItem.status).toLowerCase()}.${selectedItem.owner_name ? ` Owner: ${selectedItem.owner_name}.` : ' Unassigned.'}`
                    : selectedItem.type === 'enhancement'
                    ? `Enhancement for ${selectedItem.module || 'the system'}${selectedItem.priority ? ` — ${selectedItem.priority} priority` : ''}${selectedItem.target_release ? `. Target: ${selectedItem.target_release}` : ''}.`
                    : `${selectedItem.type.charAt(0).toUpperCase() + selectedItem.type.slice(1)} — ${statusLabel(selectedItem.status).toLowerCase()}${selectedItem.notes ? '. ' + selectedItem.notes.slice(0, 70) + '…' : '.'}`
                  }
                </p>
              </div>

              {/* Status buttons */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                {(['new', 'in_progress', 'done', 'blocked', 'on_hold'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => handleUpdateStatus(selectedItem.id, s)}
                    style={{
                      fontSize: 10, fontWeight: 600, padding: '4px 9px', borderRadius: 6,
                      border: selectedItem.status === s
                        ? '1.5px solid #6B7EFF'
                        : '1px solid rgba(255,255,255,0.07)',
                      background: selectedItem.status === s
                        ? 'rgba(107,126,255,0.14)'
                        : 'rgba(255,255,255,0.025)',
                      color: selectedItem.status === s ? '#a5b4fc' : '#334155',
                      cursor: 'pointer', transition: 'all 0.1s',
                    }}
                  >
                    {statusLabel(s)}
                  </button>
                ))}
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex' }}>
                {(['timeline', 'updates', 'files'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setDrawerTab(t)}
                    style={{
                      flex: 1, padding: '7px 0', fontSize: 11, fontWeight: 600,
                      background: 'none', border: 'none', cursor: 'pointer',
                      textTransform: 'capitalize',
                      color: drawerTab === t ? '#6B7EFF' : '#334155',
                      borderBottom: `2px solid ${drawerTab === t ? '#6B7EFF' : 'transparent'}`,
                      transition: 'all 0.12s',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Drawer body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>

              {drawerTab === 'timeline' && (
                <div>
                  {/* Meta chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
                    {selectedItem.severity && (
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', color: '#fca5a5', fontWeight: 500 }}>
                        {severityLabel(selectedItem.severity)}
                      </span>
                    )}
                    {selectedItem.priority && (
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.08)', color: '#fde68a', fontWeight: 500 }}>
                        {selectedItem.priority}
                      </span>
                    )}
                    {selectedItem.module && (
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(107,126,255,0.08)', color: '#a5b4fc', fontWeight: 500 }}>
                        {selectedItem.module}
                      </span>
                    )}
                    {selectedItem.target_release && (
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.08)', color: '#6ee7b7', fontWeight: 500 }}>
                        🎯 {selectedItem.target_release}
                      </span>
                    )}
                  </div>

                  {/* Context Mirrors */}
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 7px' }}>
                      Context Mirrors
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '8px 10px' }}>
                        <p style={{ fontSize: 11, color: '#6B7EFF', fontWeight: 600, margin: '0 0 3px' }}>📋 Work Order</p>
                        <p style={{ fontSize: 11, color: '#334155', margin: 0 }}>No linked WO — open Dispatch to associate</p>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '8px 10px' }}>
                        <p style={{ fontSize: 11, color: '#8b5cf6', fontWeight: 600, margin: '0 0 3px' }}>💼 Quote</p>
                        <p style={{ fontSize: 11, color: '#334155', margin: 0 }}>No quote linked — view Quotes to attach</p>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {selectedItem.notes && (
                    <div style={{ marginBottom: 14 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>
                        Notes
                      </p>
                      <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
                        {selectedItem.notes}
                      </p>
                    </div>
                  )}

                  {/* Reporter */}
                  {selectedItem.reporter_name && (
                    <p style={{ fontSize: 11, color: '#1e3a5f', marginBottom: 14 }}>
                      Reported by <span style={{ color: '#475569' }}>{selectedItem.reporter_name}</span>
                      {selectedItem.date_reported ? ` on ${selectedItem.date_reported}` : ''}
                    </p>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteItem(selectedItem.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 11, color: '#ef4444',
                      background: 'rgba(239,68,68,0.05)',
                      border: '1px solid rgba(239,68,68,0.12)',
                      borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={11} /> Delete item
                  </button>
                </div>
              )}

              {drawerTab === 'updates' && (
                <div>
                  {comments.length === 0 && (
                    <p style={{ fontSize: 12, color: '#1e3a5f', fontStyle: 'italic', margin: 0 }}>
                      No updates yet.
                    </p>
                  )}
                  {comments.map(c => (
                    <div key={c.id} style={{ display: 'flex', gap: 9, marginBottom: 16 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                        background: '#12213d',
                        border: '1px solid rgba(107,126,255,0.18)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, color: '#a5b4fc',
                      }}>
                        {c.author_initials}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1' }}>{c.author_name}</span>
                          <span style={{ fontSize: 10, color: '#1e3a5f' }}>{timeAgo(c.created_at)}</span>
                        </div>
                        <p style={{ fontSize: 12, color: '#64748b', margin: '3px 0 0', lineHeight: 1.55 }}>
                          {c.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {drawerTab === 'files' && (
                <p style={{ fontSize: 12, color: '#1e3a5f', fontStyle: 'italic', margin: 0 }}>
                  File attachments coming in a future update.
                </p>
              )}
            </div>

            {/* Reply bar */}
            <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', background: '#080f1d' }}>
              <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end' }}>
                <textarea
                  ref={commentRef}
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment() } }}
                  placeholder="Add an update…"
                  rows={2}
                  style={{
                    flex: 1, resize: 'none',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 8, color: '#e2e8f0', fontSize: 12,
                    padding: '7px 10px', outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || submitting}
                    style={{
                      width: 32, height: 32, borderRadius: 8, border: 'none',
                      cursor: newComment.trim() ? 'pointer' : 'default',
                      background: newComment.trim() ? '#6B7EFF' : 'rgba(255,255,255,0.04)',
                      color: newComment.trim() ? '#fff' : '#1e3a5f',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.1s',
                    }}
                  >
                    {submitting
                      ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                      : <Send size={12} />
                    }
                  </button>
                  <button style={{
                    width: 32, height: 32, borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.02)', color: '#1e3a5f',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Mic size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── New Item Modal ── */}
      {showNewItem && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.72)',
            zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setShowNewItem(false)}
        >
          <div
            style={{
              background: '#0d1829', borderRadius: 12,
              border: '1px solid rgba(107,126,255,0.22)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
              width: 440, maxWidth: '92vw', padding: '24px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>New Tracker Item</h2>
              <button
                onClick={() => setShowNewItem(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155' }}
              >
                <X size={17} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                autoFocus
                placeholder="Item title…"
                value={newItemForm.title}
                onChange={e => setNewItemForm(f => ({ ...f, title: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateItem() }}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8, boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
                  color: '#e2e8f0', fontSize: 14, outline: 'none',
                }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {/* Group */}
                <select
                  value={newItemForm.group_id}
                  onChange={e => setNewItemForm(f => ({ ...f, group_id: e.target.value }))}
                  style={{ padding: '8px 10px', borderRadius: 8, background: '#0d1829', border: '1px solid rgba(255,255,255,0.10)', color: '#e2e8f0', fontSize: 12, outline: 'none' }}
                >
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>

                {/* Type */}
                <select
                  value={newItemForm.type}
                  onChange={e => setNewItemForm(f => ({ ...f, type: e.target.value }))}
                  style={{ padding: '8px 10px', borderRadius: 8, background: '#0d1829', border: '1px solid rgba(255,255,255,0.10)', color: '#e2e8f0', fontSize: 12, outline: 'none' }}
                >
                  <option value="bug">Bug</option>
                  <option value="enhancement">Enhancement</option>
                  <option value="question">Question</option>
                  <option value="task">Task</option>
                </select>

                {/* Severity */}
                <select
                  value={newItemForm.severity}
                  onChange={e => setNewItemForm(f => ({ ...f, severity: e.target.value }))}
                  style={{ padding: '8px 10px', borderRadius: 8, background: '#0d1829', border: '1px solid rgba(255,255,255,0.10)', color: '#e2e8f0', fontSize: 12, outline: 'none' }}
                >
                  <option value="">Severity…</option>
                  <option value="1_info">Info</option>
                  <option value="2_minor">Minor</option>
                  <option value="3_moderate">Moderate</option>
                  <option value="4_major">Major</option>
                  <option value="5_critical">Critical</option>
                </select>

                {/* Priority */}
                <select
                  value={newItemForm.priority}
                  onChange={e => setNewItemForm(f => ({ ...f, priority: e.target.value }))}
                  style={{ padding: '8px 10px', borderRadius: 8, background: '#0d1829', border: '1px solid rgba(255,255,255,0.10)', color: '#e2e8f0', fontSize: 12, outline: 'none' }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              {/* Module */}
              <input
                placeholder="Module (e.g. CRM, Quotes, Dispatch)"
                value={newItemForm.module}
                onChange={e => setNewItemForm(f => ({ ...f, module: e.target.value }))}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8, boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: '#e2e8f0', fontSize: 13, outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowNewItem(false)}
                style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, background: 'none', border: '1px solid rgba(255,255,255,0.09)', color: '#475569', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateItem}
                disabled={!newItemForm.title.trim() || submitting}
                style={{
                  padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: newItemForm.title.trim() ? '#6B7EFF' : '#12213d',
                  color: newItemForm.title.trim() ? '#fff' : '#1e3a5f',
                  border: 'none', cursor: newItemForm.title.trim() ? 'pointer' : 'default',
                  transition: 'background 0.1s',
                }}
              >
                {submitting ? 'Creating…' : 'Create Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
