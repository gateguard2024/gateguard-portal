'use client'
import { useState } from 'react'
import { Plus, Clock, User } from 'lucide-react'

export interface TrackerItem {
  id: string
  group_id: string
  title: string
  type: string
  status: string
  priority: string
  tags: string[]
  progress_pct: number
  owner_name?: string | null
  owner_user_id?: string | null
  due_date?: string | null
  start_date?: string | null
  notes?: string | null
  parent_item_id?: string | null
  estimated_hours?: number | null
  actual_hours?: number | null
  data: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface TrackerGroup {
  id: string
  name: string
  color: string
  position: number
  column_schema?: unknown[]
  entity_type?: string | null
  entity_id?: string | null
}

const KANBAN_STATUSES = [
  { key: 'new',         label: 'Not Started', color: '#94A3B8', bg: '#F8FAFC' },
  { key: 'in_progress', label: 'In Progress',  color: '#6B7EFF', bg: '#EEF2FF' },
  { key: 'on_hold',     label: 'On Hold',      color: '#F59E0B', bg: '#FFFBEB' },
  { key: 'done',        label: 'Done',          color: '#10B981', bg: '#ECFDF5' },
  { key: 'blocked',     label: 'Blocked',       color: '#EF4444', bg: '#FEF2F2' },
]

const PRIORITY_COLORS: Record<string, string> = {
  low:      '#94A3B8',
  medium:   '#F59E0B',
  high:     '#EF4444',
  critical: '#7C3AED',
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function avatarColor(name: string) {
  const colors = ['#6B7EFF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % colors.length
  return colors[h]
}

interface BoardViewProps {
  items: TrackerItem[]
  groups: TrackerGroup[]
  onItemClick: (item: TrackerItem) => void
  onItemCreate: (groupId: string, status: string, title: string) => Promise<void>
  compact?: boolean
}

export function BoardView({ items, onItemClick, onItemCreate, compact = false }: BoardViewProps) {
  const [addingTo, setAddingTo]   = useState<string | null>(null)
  const [newTitle, setNewTitle]   = useState('')
  const [saving,   setSaving]     = useState(false)

  const topItems = items.filter(i => !i.parent_item_id)

  async function handleAdd(statusKey: string) {
    if (!newTitle.trim()) return
    setSaving(true)
    await onItemCreate('', statusKey, newTitle.trim())
    setNewTitle('')
    setAddingTo(null)
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
      {KANBAN_STATUSES.map(col => {
        const colItems = topItems.filter(i => i.status === col.key)
        const subCounts: Record<string, number> = {}
        items.forEach(i => { if (i.parent_item_id) subCounts[i.parent_item_id] = (subCounts[i.parent_item_id] ?? 0) + 1 })

        return (
          <div key={col.key} style={{
            minWidth: compact ? 220 : 260,
            maxWidth: compact ? 220 : 280,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            {/* Column header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 2px' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: col.color }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', flex: 1 }}>{col.label}</span>
              <span style={{
                fontSize: 11, background: '#F1F5F9', color: '#64748B',
                borderRadius: 10, padding: '1px 7px', fontWeight: 600,
              }}>{colItems.length}</span>
            </div>

            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {colItems.map(item => {
                const isOverdue = item.due_date && new Date(item.due_date + 'T12:00:00') < new Date() && item.status !== 'done'
                const subCount = subCounts[item.id] ?? 0
                return (
                  <div
                    key={item.id}
                    onClick={() => onItemClick(item)}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderLeft: `3px solid ${PRIORITY_COLORS[item.priority] ?? '#94A3B8'}`,
                      borderRadius: 9,
                      padding: compact ? '8px 10px' : '10px 12px',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      transition: 'box-shadow 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' }}
                  >
                    {/* Tags */}
                    {!compact && item.tags && item.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginBottom: 5, flexWrap: 'wrap' }}>
                        {item.tags.slice(0, 3).map(tag => (
                          <span key={tag} style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 4,
                            background: '#EEF2FF', color: '#6B7EFF', fontWeight: 600,
                          }}>{tag}</span>
                        ))}
                      </div>
                    )}

                    {/* Title */}
                    <p style={{
                      fontSize: compact ? 12 : 13,
                      fontWeight: 500,
                      color: '#1E293B',
                      margin: '0 0 6px',
                      lineHeight: 1.4,
                    }}>{item.title}</p>

                    {/* Progress bar */}
                    {!compact && item.progress_pct > 0 && (
                      <div style={{ height: 3, background: '#F1F5F9', borderRadius: 2, marginBottom: 7, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${item.progress_pct}%`,
                          background: item.progress_pct >= 100 ? '#10B981' : '#6B7EFF',
                          borderRadius: 2,
                          transition: 'width 0.3s',
                        }} />
                      </div>
                    )}

                    {/* Footer row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {/* Priority dot */}
                      <div style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: PRIORITY_COLORS[item.priority] ?? '#94A3B8',
                        flexShrink: 0,
                      }} title={item.priority} />

                      {/* Owner avatar */}
                      {item.owner_name && (
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%',
                          background: avatarColor(item.owner_name),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0,
                        }} title={item.owner_name}>
                          {initials(item.owner_name)}
                        </div>
                      )}
                      {!item.owner_name && (
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%',
                          background: '#F1F5F9',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <User size={10} color="#94A3B8" />
                        </div>
                      )}

                      {/* Due date */}
                      {item.due_date && (
                        <span style={{
                          fontSize: 10,
                          color: isOverdue ? '#EF4444' : '#64748B',
                          display: 'flex', alignItems: 'center', gap: 2, fontWeight: isOverdue ? 600 : 400,
                        }}>
                          <Clock size={9} />
                          {new Date(item.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}

                      {/* Sub-item count */}
                      {subCount > 0 && (
                        <span style={{
                          fontSize: 10, color: '#94A3B8',
                          background: '#F8FAFC', border: '1px solid #E2E8F0',
                          borderRadius: 6, padding: '0px 5px',
                          marginLeft: 'auto', fontWeight: 500,
                        }}>↳{subCount}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Add card */}
            {addingTo === col.key ? (
              <div style={{
                background: '#fff', border: '2px solid #6B7EFF',
                borderRadius: 9, padding: '8px 10px',
              }}>
                <input
                  autoFocus
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAdd(col.key)
                    if (e.key === 'Escape') { setAddingTo(null); setNewTitle('') }
                  }}
                  placeholder="Item title…"
                  style={{
                    width: '100%', border: 'none', outline: 'none',
                    fontSize: 13, color: '#1E293B', background: 'transparent',
                    marginBottom: 6,
                  }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => handleAdd(col.key)}
                    disabled={saving || !newTitle.trim()}
                    style={{
                      flex: 1, padding: '5px 0', borderRadius: 6, border: 'none',
                      background: '#6B7EFF', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >{saving ? '…' : 'Add'}</button>
                  <button
                    onClick={() => { setAddingTo(null); setNewTitle('') }}
                    style={{
                      padding: '5px 10px', borderRadius: 6,
                      border: '1px solid #E2E8F0', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#64748B',
                    }}
                  >Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingTo(col.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  width: '100%', padding: '7px 10px', borderRadius: 8,
                  border: '1px dashed #E2E8F0', background: 'transparent',
                  color: '#94A3B8', fontSize: 12, cursor: 'pointer',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.borderColor = '#6B7EFF'; el.style.color = '#6B7EFF'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.borderColor = '#E2E8F0'; el.style.color = '#94A3B8'
                }}
              >
                <Plus size={13} /> Add item
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
