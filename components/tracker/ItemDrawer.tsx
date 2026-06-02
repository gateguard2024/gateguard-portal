'use client'
import { useState, useEffect, useCallback } from 'react'
import { X, Plus, Trash2, Send, AlertTriangle, Loader2, Check, Clock } from 'lucide-react'
import type { TrackerItem, TrackerGroup } from './views/BoardView'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Sparkles, Link2 } = require('lucide-react') as any

type DrawerTab = 'details' | 'comments' | 'activity' | 'subitems' | 'dependencies'

const STATUS_OPTIONS = [
  { key: 'new',         label: 'Not Started', color: '#94A3B8', bg: '#F8FAFC' },
  { key: 'in_progress', label: 'In Progress',  color: '#6B7EFF', bg: '#EEF2FF' },
  { key: 'in_review',   label: 'In Review',    color: '#06B6D4', bg: '#ECFEFF' },
  { key: 'on_hold',     label: 'On Hold',      color: '#F59E0B', bg: '#FFFBEB' },
  { key: 'done',        label: 'Done',          color: '#10B981', bg: '#ECFDF5' },
  { key: 'blocked',     label: 'Blocked',       color: '#EF4444', bg: '#FEF2F2' },
  { key: 'wont_fix',    label: "Won't Fix",    color: '#94A3B8', bg: '#F8FAFC' },
]

const PRIORITY_OPTIONS = [
  { key: 'low',      label: 'Low',      color: '#94A3B8' },
  { key: 'medium',   label: 'Medium',   color: '#F59E0B' },
  { key: 'high',     label: 'High',     color: '#EF4444' },
  { key: 'critical', label: 'Critical', color: '#7C3AED' },
]

function statusInfo(s: string) { return STATUS_OPTIONS.find(o => o.key === s) ?? { key: s, label: s, color: '#94A3B8', bg: '#F8FAFC' } }
function priorityInfo(p: string) { return PRIORITY_OPTIONS.find(o => o.key === p) ?? { key: p, label: p, color: '#94A3B8' } }

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

interface OrgUser { id: string; name: string; email: string; role: string }
interface Comment { id: string; item_id: string; author: string; body: string; created_at: string }
interface Activity { id: string; item_id: string; user_name: string; action: string; field_name?: string; old_value?: string; new_value?: string; created_at: string }
interface Dependency { id: string; from_item_id: string; to_item_id: string; dep_type: string }

interface ItemDrawerProps {
  item: TrackerItem
  groups: TrackerGroup[]
  allItems: TrackerItem[]
  orgUsers: OrgUser[]
  onClose: () => void
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => void
}

export function ItemDrawer({ item, groups, allItems, orgUsers, onClose, onUpdate, onDelete }: ItemDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>('details')
  const [comments, setComments] = useState<Comment[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [deps, setDeps] = useState<Dependency[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [sending, setSending] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showPriorityMenu, setShowPriorityMenu] = useState(false)
  const [showUserPicker, setShowUserPicker] = useState(false)
  const [depSearch, setDepSearch] = useState('')
  const [loadingDeps, setLoadingDeps] = useState(false)

  // Local editable state
  const [notes, setNotes] = useState(item.notes ?? '')
  const [estHours, setEstHours] = useState(String(item.estimated_hours ?? ''))
  const [actHours, setActHours] = useState(String(item.actual_hours ?? ''))
  const [tagInput, setTagInput] = useState('')
  const [progress, setProgress] = useState(item.progress_pct ?? 0)

  const si = statusInfo(item.status)
  const pi = priorityInfo(item.priority)

  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/tracker/items/${item.id}/comments`)
      if (res.ok) setComments(await res.json())
    } catch { /* noop */ }
  }, [item.id])

  const loadActivity = useCallback(async () => {
    try {
      const res = await fetch(`/api/tracker/activity?item_id=${item.id}`)
      if (res.ok) {
        const d = await res.json()
        setActivity(d.activity ?? [])
      }
    } catch { /* noop */ }
  }, [item.id])

  const loadDeps = useCallback(async () => {
    setLoadingDeps(true)
    try {
      const res = await fetch(`/api/tracker/dependencies?item_id=${item.id}`)
      if (res.ok) {
        const d = await res.json()
        setDeps(d.dependencies ?? [])
      }
    } catch { /* noop */ } finally { setLoadingDeps(false) }
  }, [item.id])

  useEffect(() => {
    loadComments()
    loadDeps()
  }, [loadComments, loadDeps])

  useEffect(() => {
    if (tab === 'activity') loadActivity()
    if (tab === 'dependencies') loadDeps()
  }, [tab, loadActivity, loadDeps])

  async function sendComment() {
    if (!commentBody.trim()) return
    setSending(true)
    try {
      await fetch(`/api/tracker/items/${item.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: commentBody }),
      })
      setCommentBody('')
      await loadComments()
    } catch { /* noop */ } finally { setSending(false) }
  }

  async function addDependency(toItemId: string) {
    try {
      await fetch('/api/tracker/dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_item_id: item.id, to_item_id: toItemId, dep_type: 'finish_to_start' }),
      })
      await loadDeps()
      setDepSearch('')
    } catch { /* noop */ }
  }

  async function removeDep(depId: string) {
    try {
      await fetch('/api/tracker/dependencies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: depId }),
      })
      await loadDeps()
    } catch { /* noop */ }
  }

  function generateSummary() {
    setAiSummary(`${item.type} is currently ${si.label.toLowerCase()}. ${item.notes ? 'Notes: ' + item.notes.slice(0, 100) + '…' : 'No notes.'}${item.owner_name ? ` Assigned to ${item.owner_name}.` : ' Unassigned.'}${item.due_date ? ` Due ${new Date(item.due_date + 'T12:00:00').toLocaleDateString()}.` : ''}`)
  }

  function addTag() {
    if (!tagInput.trim()) return
    const newTags = [...(item.tags ?? []), tagInput.trim().toLowerCase()]
    onUpdate(item.id, { tags: newTags })
    setTagInput('')
  }

  function removeTag(tag: string) {
    onUpdate(item.id, { tags: (item.tags ?? []).filter(t => t !== tag) })
  }

  const isOverdue = item.due_date && new Date(item.due_date + 'T12:00:00') < new Date() && item.status !== 'done'

  // Items that can be dependencies (not self, not already a dep)
  const depItemIds = new Set(deps.map(d => d.from_item_id === item.id ? d.to_item_id : d.from_item_id))
  const depCandidates = allItems.filter(i => i.id !== item.id && !depItemIds.has(i.id) &&
    (!depSearch || i.title.toLowerCase().includes(depSearch.toLowerCase())))

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end',
    }} onClick={onClose}>
      <div
        style={{
          width: '100%', maxWidth: 520, height: '100%',
          background: '#fff', boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
          borderLeft: '1px solid #E2E8F0',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase',
                  background: '#EEF2FF', color: '#6B7EFF', letterSpacing: '0.05em',
                }}>{item.type}</span>

                {/* Status pill */}
                <div style={{ position: 'relative' }}>
                  <span
                    onClick={() => setShowStatusMenu(!showStatusMenu)}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 10,
                      background: si.bg, color: si.color, cursor: 'pointer',
                      border: `1px solid ${si.color}33`,
                    }}
                  >{si.label}</span>
                  {showStatusMenu && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, zIndex: 60,
                      background: '#fff', border: '1px solid #E2E8F0',
                      borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      minWidth: 160, marginTop: 4, overflow: 'hidden',
                    }}>
                      {STATUS_OPTIONS.map(so => (
                        <button key={so.key}
                          onClick={() => { onUpdate(item.id, { status: so.key }); setShowStatusMenu(false) }}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left',
                            padding: '8px 12px', border: 'none', cursor: 'pointer',
                            background: item.status === so.key ? so.bg : 'transparent',
                            color: so.color, fontSize: 12, fontWeight: 600,
                          }}>{so.label}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Priority */}
                <div style={{ position: 'relative' }}>
                  <span
                    onClick={() => setShowPriorityMenu(!showPriorityMenu)}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6,
                      background: `${pi.color}11`, color: pi.color, cursor: 'pointer',
                      border: `1px solid ${pi.color}33`,
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: pi.color }} />
                    {pi.label}
                  </span>
                  {showPriorityMenu && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, zIndex: 60,
                      background: '#fff', border: '1px solid #E2E8F0',
                      borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      minWidth: 140, marginTop: 4, overflow: 'hidden',
                    }}>
                      {PRIORITY_OPTIONS.map(po => (
                        <button key={po.key}
                          onClick={() => { onUpdate(item.id, { priority: po.key }); setShowPriorityMenu(false) }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            width: '100%', padding: '8px 12px', border: 'none',
                            background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: po.color,
                          }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: po.color }} />{po.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', margin: 0, lineHeight: 1.4 }}>{item.title}</h2>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94A3B8', flexShrink: 0 }}>
              <X size={18} />
            </button>
          </div>

          {/* AI Summary */}
          <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 12px', marginBottom: 6 }}>
            {aiSummary ? (
              <p style={{ fontSize: 12, color: '#64748B', margin: 0, lineHeight: 1.6 }}>{aiSummary}</p>
            ) : (
              <button onClick={generateSummary} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, color: '#6B7EFF', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500,
              }}>
                <Sparkles size={13} /> Generate AI summary
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', paddingLeft: 20, overflowX: 'auto' }}>
          {(['details', 'comments', 'activity', 'subitems', 'dependencies'] as DrawerTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '10px 14px', fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
              background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              color: tab === t ? '#6B7EFF' : '#64748B',
              borderBottom: `2px solid ${tab === t ? '#6B7EFF' : 'transparent'}`,
              marginBottom: -1,
            }}>{t}</button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* DETAILS TAB */}
          {tab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Assignee */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Assignee</label>
                <div style={{ position: 'relative' }}>
                  <div
                    onClick={() => setShowUserPicker(!showUserPicker)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                      border: '1px solid #E2E8F0', borderRadius: 8, cursor: 'pointer', background: '#F8FAFC',
                    }}>
                    {item.owner_name ? (
                      <>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#6B7EFF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                          {item.owner_name[0]?.toUpperCase()}
                        </div>
                        <span style={{ fontSize: 13, color: '#374151' }}>{item.owner_name}</span>
                      </>
                    ) : (
                      <span style={{ fontSize: 13, color: '#CBD5E1' }}>Unassigned — click to assign</span>
                    )}
                  </div>
                  {showUserPicker && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60,
                      background: '#fff', border: '1px solid #E2E8F0',
                      borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      marginTop: 4, maxHeight: 200, overflowY: 'auto',
                    }}>
                      <button onClick={() => { onUpdate(item.id, { owner_name: null, owner_user_id: null }); setShowUserPicker(false) }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#94A3B8' }}>
                        Unassign
                      </button>
                      {orgUsers.map(u => (
                        <button key={u.id}
                          onClick={() => { onUpdate(item.id, { owner_name: u.name, owner_user_id: u.id }); setShowUserPicker(false) }}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12 }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#6B7EFF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>{u.name[0]}</div>
                          <div><div style={{ fontWeight: 600, color: '#374151' }}>{u.name}</div><div style={{ fontSize: 10, color: '#94A3B8' }}>{u.role}</div></div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Start Date</label>
                  <input type="date" value={item.start_date ?? ''}
                    onChange={e => onUpdate(item.id, { start_date: e.target.value || null })}
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
                    Due Date {isOverdue && <span style={{ color: '#EF4444' }}>— Overdue</span>}
                  </label>
                  <input type="date" value={item.due_date ?? ''}
                    onChange={e => onUpdate(item.id, { due_date: e.target.value || null })}
                    style={{ width: '100%', padding: '7px 10px', border: `1px solid ${isOverdue ? '#EF4444' : '#E2E8F0'}`, borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  {isOverdue && (
                    <p style={{ fontSize: 10, color: '#EF4444', marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <AlertTriangle size={10} /> Overdue
                    </p>
                  )}
                </div>
              </div>

              {/* Progress */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
                  Progress — {progress}%
                </label>
                <input
                  type="range" min={0} max={100} value={progress}
                  onChange={e => setProgress(Number(e.target.value))}
                  onMouseUp={() => onUpdate(item.id, { progress_pct: progress })}
                  style={{ width: '100%', accentColor: '#6B7EFF' }}
                />
              </div>

              {/* Hours */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Est. Hours</label>
                  <input type="number" value={estHours} min={0} step={0.5}
                    onChange={e => setEstHours(e.target.value)}
                    onBlur={() => onUpdate(item.id, { estimated_hours: estHours ? Number(estHours) : null })}
                    placeholder="—"
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Actual Hours</label>
                  <input type="number" value={actHours} min={0} step={0.5}
                    onChange={e => setActHours(e.target.value)}
                    onBlur={() => onUpdate(item.id, { actual_hours: actHours ? Number(actHours) : null })}
                    placeholder="—"
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Tags</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 7 }}>
                  {(item.tags ?? []).map(tag => (
                    <span key={tag} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 8px', borderRadius: 20, background: '#EEF2FF', color: '#6B7EFF', fontSize: 11, fontWeight: 600,
                    }}>
                      {tag}
                      <button onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6B7EFF', display: 'flex', alignItems: 'center' }}>
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addTag() }}
                    placeholder="Add tag..."
                    style={{ flex: 1, padding: '6px 10px', border: '1px solid #E2E8F0', borderRadius: 7, fontSize: 12, outline: 'none' }}
                  />
                  <button onClick={addTag} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: '#6B7EFF', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  onBlur={() => onUpdate(item.id, { notes: notes || null })}
                  rows={4}
                  placeholder="Add notes..."
                  style={{
                    width: '100%', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8,
                    fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6,
                    color: '#374151',
                  }}
                />
              </div>

              {/* Meta */}
              <div style={{ fontSize: 11, color: '#94A3B8', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={11} /> Created {new Date(item.created_at).toLocaleString()}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Check size={11} /> Updated {new Date(item.updated_at).toLocaleString()}
                </span>
              </div>

              {/* Open full page link */}
              <a href={`/tracker/item/${item.id}`} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6B7EFF', textDecoration: 'none', fontWeight: 500 }}>
                <Link2 size={13} /> Open in full page
              </a>

              {/* Delete */}
              <button
                onClick={() => { if (confirm('Delete this item?')) { onDelete(item.id) } }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 12, color: '#EF4444', background: '#FEF2F2',
                  border: '1px solid #FECACA', borderRadius: 7, padding: '7px 12px', cursor: 'pointer',
                  width: 'fit-content',
                }}
              ><Trash2 size={13} /> Delete item</button>
            </div>
          )}

          {/* COMMENTS TAB */}
          {tab === 'comments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {comments.length === 0 && (
                <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '24px 0' }}>No comments yet.</p>
              )}
              {comments.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#6B7EFF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {c.author[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{c.author}</span>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>{timeAgo(c.created_at)}</span>
                    </div>
                    <p style={{ fontSize: 13, color: '#64748B', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ACTIVITY TAB */}
          {tab === 'activity' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activity.length === 0 && (
                <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '24px 0' }}>No activity recorded yet.</p>
              )}
              {activity.map(a => (
                <div key={a.id} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#6B7EFF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                    {(a.user_name || '?')[0]?.toUpperCase()}
                  </div>
                  <div>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{a.user_name || 'System'}</span>
                    {' '}
                    <span style={{ color: '#64748B' }}>{a.action}</span>
                    {a.field_name && <span style={{ color: '#94A3B8' }}> ({a.field_name}{a.old_value ? `: ${a.old_value} → ${a.new_value}` : ''})</span>}
                    <span style={{ color: '#94A3B8', marginLeft: 6 }}>— {timeAgo(a.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SUB-ITEMS TAB */}
          {tab === 'subitems' && (
            <div>
              <SubItemsTab item={item} allItems={allItems} groups={groups} onUpdate={onUpdate} />
            </div>
          )}

          {/* DEPENDENCIES TAB */}
          {tab === 'dependencies' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {loadingDeps ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94A3B8', fontSize: 13 }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading...
                </div>
              ) : (
                <>
                  {deps.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#94A3B8', padding: '12px 0' }}>No dependencies set.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {deps.map(dep => {
                        const relatedId = dep.from_item_id === item.id ? dep.to_item_id : dep.from_item_id
                        const relatedItem = allItems.find(i => i.id === relatedId)
                        const isFrom = dep.from_item_id === item.id
                        return (
                          <div key={dep.id} style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                            background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
                          }}>
                            <Link2 size={13} color="#6B7EFF" />
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>
                                {isFrom ? 'Depends on' : 'Blocks'}
                              </span>
                              <p style={{ fontSize: 13, color: '#374151', margin: '2px 0 0', fontWeight: 500 }}>
                                {relatedItem?.title ?? relatedId.slice(0, 8)}
                              </p>
                              <span style={{ fontSize: 10, color: '#94A3B8' }}>{dep.dep_type.replace(/_/g, ' ')}</span>
                            </div>
                            <button onClick={() => removeDep(dep.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', alignItems: 'center' }}>
                              <X size={14} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Add dependency */}
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 7 }}>Add dependency</p>
                    <input
                      value={depSearch}
                      onChange={e => setDepSearch(e.target.value)}
                      placeholder="Search items..."
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 6 }}
                    />
                    <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {depCandidates.slice(0, 20).map(candidate => (
                        <button key={candidate.id} onClick={() => addDependency(candidate.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                            background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 7,
                            cursor: 'pointer', fontSize: 12, textAlign: 'left', color: '#374151',
                          }}>
                          <Plus size={12} color="#6B7EFF" />
                          {candidate.title}
                        </button>
                      ))}
                      {depCandidates.length === 0 && depSearch && (
                        <p style={{ fontSize: 12, color: '#94A3B8' }}>No matching items</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Comment input (always visible at bottom when on comments tab) */}
        {tab === 'comments' && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #E2E8F0', background: '#fff' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                value={commentBody}
                onChange={e => setCommentBody(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment() } }}
                placeholder="Add a comment..."
                rows={2}
                style={{
                  flex: 1, resize: 'none', padding: '8px 12px',
                  border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13,
                  outline: 'none', lineHeight: 1.5,
                }}
              />
              <button
                onClick={sendComment}
                disabled={sending || !commentBody.trim()}
                style={{
                  padding: '8px 12px', borderRadius: 8, border: 'none',
                  background: commentBody.trim() ? '#6B7EFF' : '#F1F5F9',
                  color: commentBody.trim() ? '#fff' : '#94A3B8',
                  cursor: commentBody.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center',
                }}
              >
                {sending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
              </button>
            </div>
          </div>
        )}
      </div>
      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// Sub-items mini tab component
function SubItemsTab({ item, allItems, groups, onUpdate }: {
  item: TrackerItem
  allItems: TrackerItem[]
  groups: TrackerGroup[]
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>
}) {
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const subItems = allItems.filter(i => i.parent_item_id === item.id)
  const defaultGroupId = item.group_id

  async function createSubItem() {
    if (!newTitle.trim()) return
    setSaving(true)
    try {
      await fetch('/api/tracker/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: defaultGroupId,
          title: newTitle.trim(),
          type: 'task', status: 'new',
          parent_item_id: item.id,
        }),
      })
      setNewTitle('')
      // Trigger refresh by updating parent's updated_at
      await onUpdate(item.id, { updated_at: new Date().toISOString() })
    } catch { /* noop */ } finally { setSaving(false) }
  }

  const STATUS_COLORS_MINI: Record<string, string> = { new: '#94A3B8', in_progress: '#6B7EFF', done: '#10B981', blocked: '#EF4444', on_hold: '#F59E0B' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {subItems.length === 0 && <p style={{ fontSize: 13, color: '#94A3B8', padding: '12px 0' }}>No sub-items yet.</p>}
      {subItems.map(sub => (
        <div key={sub.id} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
          background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS_MINI[sub.status] ?? '#94A3B8', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, color: '#374151' }}>{sub.title}</span>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>{sub.owner_name || 'Unassigned'}</span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 7, marginTop: 4 }}>
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') createSubItem() }}
          placeholder="Add sub-item..."
          style={{ flex: 1, padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 7, fontSize: 13, outline: 'none' }}
        />
        <button onClick={createSubItem} disabled={saving || !newTitle.trim()}
          style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: '#6B7EFF', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
          {saving ? '...' : 'Add'}
        </button>
      </div>
    </div>
  )
}
