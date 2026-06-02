'use client'
import React, { useState, useRef } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import type { TrackerItem, TrackerGroup } from './BoardView'

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

function statusInfo(s: string) {
  return STATUS_OPTIONS.find(o => o.key === s) ?? { key: s, label: s, color: '#94A3B8', bg: '#F8FAFC' }
}
function priorityInfo(p: string) {
  return PRIORITY_OPTIONS.find(o => o.key === p) ?? { key: p, label: p, color: '#94A3B8' }
}

interface CellEditState {
  itemId: string
  field: string
}

interface OrgUser { id: string; name: string; email: string; role: string }

interface TableViewProps {
  items: TrackerItem[]
  groups: TrackerGroup[]
  orgUsers: OrgUser[]
  onItemClick: (item: TrackerItem) => void
  onItemUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>
  onItemCreate: (groupId: string, status: string, title: string) => Promise<void>
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onSelectAll: (ids: string[]) => void
}

export function TableView({
  items, groups, orgUsers, onItemClick, onItemUpdate, onItemCreate,
  selectedIds, onToggleSelect, onSelectAll,
}: TableViewProps) {
  const [editing, setEditing] = useState<CellEditState | null>(null)
  const [editVal, setEditVal] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [addingGroup, setAddingGroup] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [showStatusMenu, setShowStatusMenu] = useState<string | null>(null)
  const [showPriorityMenu, setShowPriorityMenu] = useState<string | null>(null)
  const [showPersonMenu, setShowPersonMenu] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState<string>('position')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const inputRef = useRef<HTMLInputElement>(null)

  const topItems = items.filter(i => !i.parent_item_id)
  const subMap: Record<string, TrackerItem[]> = {}
  items.forEach(i => {
    if (i.parent_item_id) {
      if (!subMap[i.parent_item_id]) subMap[i.parent_item_id] = []
      subMap[i.parent_item_id].push(i)
    }
  })

  function sortItems(list: TrackerItem[]) {
    return [...list].sort((a, b) => {
      const va = String((a as unknown as Record<string, unknown>)[sortCol] ?? '')
      const vb = String((b as unknown as Record<string, unknown>)[sortCol] ?? '')
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })
  }

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function startEdit(item: TrackerItem, field: string, val: string) {
    setEditing({ itemId: item.id, field })
    setEditVal(val)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function commitEdit(item: TrackerItem) {
    if (!editing) return
    onItemUpdate(item.id, { [editing.field]: editVal || null })
    setEditing(null)
  }

  async function handleAddToGroup(groupId: string) {
    if (!newTitle.trim()) return
    await onItemCreate(groupId, 'new', newTitle.trim())
    setNewTitle('')
    setAddingGroup(null)
  }

  const thStyle: React.CSSProperties = {
    padding: '8px 12px', textAlign: 'left', fontSize: 11,
    fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap',
    borderBottom: '1px solid #E2E8F0', background: '#F8FAFC',
    cursor: 'pointer', userSelect: 'none',
  }
  const tdStyle: React.CSSProperties = {
    padding: '7px 12px', fontSize: 13, color: '#1E293B',
    borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle',
  }

  const allTopIds = topItems.map(i => i.id)
  const allSelected = allTopIds.length > 0 && allTopIds.every(id => selectedIds.has(id))

  return (
    <div style={{ overflowX: 'auto' }} onClick={() => { setShowStatusMenu(null); setShowPriorityMenu(null); setShowPersonMenu(null) }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 32 }}>
              <input type="checkbox" checked={allSelected}
                onChange={() => allSelected ? onSelectAll([]) : onSelectAll(allTopIds)}
                style={{ cursor: 'pointer' }}
              />
            </th>
            {[
              { key: 'title',      label: 'Title',    frozen: true },
              { key: 'status',     label: 'Status' },
              { key: 'owner_name', label: 'Assignee' },
              { key: 'due_date',   label: 'Due Date' },
              { key: 'priority',   label: 'Priority' },
              { key: 'tags',       label: 'Tags' },
              { key: 'progress_pct', label: 'Progress' },
              { key: 'estimated_hours', label: 'Est. hrs' },
            ].map(col => (
              <th
                key={col.key}
                onClick={() => toggleSort(col.key)}
                style={{
                  ...thStyle,
                  ...(col.frozen ? {
                    position: 'sticky', left: 40, zIndex: 2, background: '#F8FAFC',
                    boxShadow: '2px 0 4px rgba(0,0,0,0.05)',
                  } : {}),
                }}
              >
                {col.label}
                {sortCol === col.key && <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map(group => {
            const groupItems = sortItems(topItems.filter(i => i.group_id === group.id))
            const isCollapsed = collapsedGroups.has(group.id)

            return (
              <>
                {/* Group header row */}
                <tr key={`grp-${group.id}`}>
                  <td colSpan={9} style={{
                    padding: '6px 12px',
                    background: '#F8FAFC',
                    borderBottom: '1px solid #E2E8F0',
                    borderTop: '1px solid #E2E8F0',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                      onClick={() => setCollapsedGroups(prev => {
                        const next = new Set(prev)
                        next.has(group.id) ? next.delete(group.id) : next.add(group.id)
                        return next
                      })}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: group.color }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{group.name}</span>
                      <span style={{ fontSize: 11, color: '#94A3B8', background: '#EEF2FF', borderRadius: 10, padding: '0 6px' }}>
                        {groupItems.length}
                      </span>
                      {isCollapsed ? <ChevronRight size={13} color="#94A3B8" /> : <ChevronDown size={13} color="#94A3B8" />}
                    </div>
                  </td>
                </tr>

                {!isCollapsed && groupItems.map(item => {
                  const subs = subMap[item.id] ?? []
                  const isExpanded = expanded.has(item.id)
                  const si = statusInfo(item.status)
                  const pi = priorityInfo(item.priority)
                  const isOverdue = item.due_date && new Date(item.due_date + 'T12:00:00') < new Date() && item.status !== 'done'

                  return (
                    <>
                      <tr key={item.id} style={{ background: selectedIds.has(item.id) ? '#EEF2FF' : '#fff' }}
                        onMouseEnter={e => { if (!selectedIds.has(item.id)) (e.currentTarget as HTMLTableRowElement).style.background = '#F8FAFC' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = selectedIds.has(item.id) ? '#EEF2FF' : '#fff' }}>
                        {/* Checkbox */}
                        <td style={tdStyle}>
                          <input type="checkbox" checked={selectedIds.has(item.id)}
                            onChange={() => onToggleSelect(item.id)} style={{ cursor: 'pointer' }} />
                        </td>

                        {/* Title (frozen) */}
                        <td style={{
                          ...tdStyle, fontWeight: 500,
                          position: 'sticky', left: 40, background: selectedIds.has(item.id) ? '#EEF2FF' : '#fff',
                          zIndex: 1, boxShadow: '2px 0 4px rgba(0,0,0,0.03)',
                          maxWidth: 320, minWidth: 200,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {subs.length > 0 && (
                              <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                                onClick={() => setExpanded(prev => {
                                  const next = new Set(prev)
                                  next.has(item.id) ? next.delete(item.id) : next.add(item.id)
                                  return next
                                })}>
                                {isExpanded ? <ChevronDown size={13} color="#94A3B8" /> : <ChevronRight size={13} color="#94A3B8" />}
                              </button>
                            )}
                            <span
                              style={{ cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
                              onClick={() => onItemClick(item)}
                            >{item.title}</span>
                            {subs.length > 0 && (
                              <span style={{ fontSize: 10, color: '#94A3B8', background: '#F1F5F9', borderRadius: 6, padding: '0 5px', flexShrink: 0 }}>
                                {'↳'}{subs.length}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td style={tdStyle}>
                          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                            <span
                              onClick={() => setShowStatusMenu(showStatusMenu === item.id ? null : item.id)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                                background: si.bg, color: si.color, cursor: 'pointer',
                                border: `1px solid ${si.color}33`,
                              }}
                            >{si.label}</span>
                            {showStatusMenu === item.id && (
                              <div style={{
                                position: 'absolute', top: '100%', left: 0, zIndex: 50,
                                background: '#fff', border: '1px solid #E2E8F0',
                                borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                overflow: 'hidden', minWidth: 160, marginTop: 4,
                              }}>
                                {STATUS_OPTIONS.map(so => (
                                  <button key={so.key}
                                    onClick={() => { onItemUpdate(item.id, { status: so.key }); setShowStatusMenu(null) }}
                                    style={{
                                      display: 'block', width: '100%', textAlign: 'left',
                                      padding: '8px 12px', border: 'none', cursor: 'pointer',
                                      background: item.status === so.key ? so.bg : 'transparent',
                                      color: so.color, fontSize: 12, fontWeight: 600,
                                    }}>
                                    {so.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Assignee */}
                        <td style={tdStyle}>
                          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                            {editing?.itemId === item.id && editing.field === 'owner_name' ? (
                              <input
                                ref={inputRef}
                                value={editVal}
                                onChange={e => setEditVal(e.target.value)}
                                onBlur={() => commitEdit(item)}
                                onKeyDown={e => { if (e.key === 'Enter') commitEdit(item); if (e.key === 'Escape') setEditing(null) }}
                                style={{ fontSize: 12, border: '1px solid #6B7EFF', borderRadius: 6, padding: '2px 6px', outline: 'none', width: 120 }}
                              />
                            ) : (
                              <span
                                onClick={() => { startEdit(item, 'owner_name', item.owner_name ?? ''); setShowPersonMenu(item.id) }}
                                style={{ fontSize: 12, color: item.owner_name ? '#374151' : '#CBD5E1', cursor: 'pointer' }}
                              >{item.owner_name || 'Unassigned'}</span>
                            )}
                            {showPersonMenu === item.id && orgUsers.length > 0 && (
                              <div style={{
                                position: 'absolute', top: '100%', left: 0, zIndex: 50,
                                background: '#fff', border: '1px solid #E2E8F0',
                                borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                overflow: 'hidden', minWidth: 180, marginTop: 4, maxHeight: 200, overflowY: 'auto',
                              }}>
                                {orgUsers.map(u => (
                                  <button key={u.id}
                                    onClick={() => {
                                      onItemUpdate(item.id, { owner_name: u.name, owner_user_id: u.id })
                                      setShowPersonMenu(null); setEditing(null)
                                    }}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 8,
                                      width: '100%', padding: '8px 12px', border: 'none',
                                      background: 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: 12,
                                    }}>
                                    <div style={{
                                      width: 24, height: 24, borderRadius: '50%',
                                      background: '#6B7EFF', color: '#fff',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: 9, fontWeight: 700, flexShrink: 0,
                                    }}>{u.name[0]}</div>
                                    <div>
                                      <div style={{ fontWeight: 600, color: '#374151' }}>{u.name}</div>
                                      <div style={{ fontSize: 10, color: '#94A3B8' }}>{u.role}</div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Due Date */}
                        <td style={tdStyle}>
                          {editing?.itemId === item.id && editing.field === 'due_date' ? (
                            <input
                              ref={inputRef}
                              type="date"
                              value={editVal}
                              onChange={e => setEditVal(e.target.value)}
                              onBlur={() => commitEdit(item)}
                              style={{ fontSize: 12, border: '1px solid #6B7EFF', borderRadius: 6, padding: '2px 6px', outline: 'none' }}
                            />
                          ) : (
                            <span
                              onClick={() => startEdit(item, 'due_date', item.due_date ?? '')}
                              style={{ fontSize: 12, color: isOverdue ? '#EF4444' : item.due_date ? '#374151' : '#CBD5E1', cursor: 'pointer', fontWeight: isOverdue ? 600 : 400 }}
                            >
                              {item.due_date
                                ? new Date(item.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                : '—'}
                            </span>
                          )}
                        </td>

                        {/* Priority */}
                        <td style={tdStyle}>
                          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                            <span
                              onClick={() => setShowPriorityMenu(showPriorityMenu === item.id ? null : item.id)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                color: pi.color, cursor: 'pointer', border: `1px solid ${pi.color}33`,
                                background: `${pi.color}11`,
                              }}
                            >
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: pi.color }} />
                              {pi.label}
                            </span>
                            {showPriorityMenu === item.id && (
                              <div style={{
                                position: 'absolute', top: '100%', left: 0, zIndex: 50,
                                background: '#fff', border: '1px solid #E2E8F0',
                                borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                overflow: 'hidden', minWidth: 140, marginTop: 4,
                              }}>
                                {PRIORITY_OPTIONS.map(po => (
                                  <button key={po.key}
                                    onClick={() => { onItemUpdate(item.id, { priority: po.key }); setShowPriorityMenu(null) }}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 8,
                                      width: '100%', padding: '8px 12px', border: 'none',
                                      background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: po.color,
                                    }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: po.color }} />
                                    {po.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Tags */}
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {(item.tags ?? []).slice(0, 2).map(tag => (
                              <span key={tag} style={{
                                fontSize: 10, padding: '1px 6px', borderRadius: 4,
                                background: '#EEF2FF', color: '#6B7EFF', fontWeight: 600,
                              }}>{tag}</span>
                            ))}
                            {(item.tags ?? []).length > 2 && (
                              <span style={{ fontSize: 10, color: '#94A3B8' }}>+{item.tags.length - 2}</span>
                            )}
                          </div>
                        </td>

                        {/* Progress */}
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
                              <div style={{
                                height: '100%',
                                width: `${item.progress_pct ?? 0}%`,
                                background: (item.progress_pct ?? 0) >= 100 ? '#10B981' : '#6B7EFF',
                                borderRadius: 3,
                              }} />
                            </div>
                            <span style={{ fontSize: 11, color: '#64748B', minWidth: 32 }}>{item.progress_pct ?? 0}%</span>
                          </div>
                        </td>

                        {/* Est hours */}
                        <td style={tdStyle}>
                          <span style={{ fontSize: 12, color: '#64748B' }}>
                            {item.estimated_hours ? `${item.estimated_hours}h` : '—'}
                          </span>
                        </td>
                      </tr>

                      {/* Sub-items */}
                      {isExpanded && subs.map(sub => (
                        <tr key={sub.id} style={{ background: '#FAFBFF' }}>
                          <td style={tdStyle} />
                          <td style={{
                            ...tdStyle, paddingLeft: 48,
                            position: 'sticky', left: 40, background: '#FAFBFF',
                            zIndex: 1, boxShadow: '2px 0 4px rgba(0,0,0,0.03)',
                          }}>
                            <span style={{ fontSize: 12, color: '#64748B', cursor: 'pointer' }}
                              onClick={() => onItemClick(sub)}>{'↳'} {sub.title}</span>
                          </td>
                          <td style={tdStyle}>
                            <span style={{
                              fontSize: 11, padding: '2px 7px', borderRadius: 8,
                              background: statusInfo(sub.status).bg, color: statusInfo(sub.status).color, fontWeight: 600,
                            }}>{statusInfo(sub.status).label}</span>
                          </td>
                          <td style={tdStyle}><span style={{ fontSize: 12, color: '#94A3B8' }}>{sub.owner_name || '—'}</span></td>
                          <td style={tdStyle}><span style={{ fontSize: 12, color: '#94A3B8' }}>{sub.due_date ? new Date(sub.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</span></td>
                          <td colSpan={4} />
                        </tr>
                      ))}
                    </>
                  )
                })}

                {/* Add item row */}
                {!isCollapsed && (
                  <tr key={`add-${group.id}`}>
                    <td />
                    <td colSpan={8} style={{ padding: '6px 12px', borderBottom: '1px solid #F1F5F9' }}>
                      {addingGroup === group.id ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            autoFocus
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleAddToGroup(group.id)
                              if (e.key === 'Escape') { setAddingGroup(null); setNewTitle('') }
                            }}
                            placeholder="Item title..."
                            style={{
                              flex: 1, fontSize: 13, border: '1px solid #6B7EFF', borderRadius: 6,
                              padding: '4px 8px', outline: 'none',
                            }}
                          />
                          <button onClick={() => handleAddToGroup(group.id)}
                            style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#6B7EFF', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                            Add
                          </button>
                          <button onClick={() => { setAddingGroup(null); setNewTitle('') }}
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'transparent', fontSize: 12, cursor: 'pointer', color: '#64748B' }}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddingGroup(group.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            fontSize: 12, color: '#94A3B8', background: 'none', border: 'none',
                            cursor: 'pointer', padding: '2px 0',
                          }}>
                          <Plus size={13} /> Add item
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
