'use client'
import { useState, useRef, useCallback } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { TrackerItem, TrackerGroup } from './BoardView'

type ZoomLevel = 'day' | 'week' | 'month' | 'quarter'

const ZOOM_CONFIG: Record<ZoomLevel, { dayWidth: number; label: string }> = {
  day:     { dayWidth: 30, label: 'Day' },
  week:    { dayWidth: 15, label: 'Week' },
  month:   { dayWidth: 8,  label: 'Month' },
  quarter: { dayWidth: 4,  label: 'Quarter' },
}

const STATUS_COLORS: Record<string, string> = {
  new:         '#94A3B8',
  in_progress: '#6B7EFF',
  in_review:   '#06B6D4',
  on_hold:     '#F59E0B',
  done:        '#10B981',
  blocked:     '#EF4444',
  wont_fix:    '#94A3B8',
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

interface Dependency {
  id: string
  from_item_id: string
  to_item_id: string
  dep_type: string
}

interface GanttViewProps {
  items: TrackerItem[]
  groups: TrackerGroup[]
  dependencies: Dependency[]
  onItemClick: (item: TrackerItem) => void
  onItemUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>
}

export function GanttView({ items, groups, dependencies, onItemClick, onItemUpdate }: GanttViewProps) {
  const [zoom, setZoom] = useState<ZoomLevel>('week')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dragging, setDragging] = useState<{ itemId: string; startX: number; origOffset: number; type: 'move' | 'resize' } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { dayWidth } = ZOOM_CONFIG[zoom]

  // Compute timeline bounds
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const itemsWithDates = items.filter(i => i.start_date || i.due_date)
  const allDates = itemsWithDates.flatMap(i => [
    i.start_date ? new Date(i.start_date + 'T12:00:00') : null,
    i.due_date   ? new Date(i.due_date + 'T12:00:00')   : null,
  ].filter(Boolean) as Date[])

  const minDate = allDates.length > 0
    ? addDays(new Date(Math.min(...allDates.map(d => d.getTime()))), -7)
    : addDays(today, -14)
  const maxDate = allDates.length > 0
    ? addDays(new Date(Math.max(...allDates.map(d => d.getTime()))), 14)
    : addDays(today, 60)

  const totalDays = daysBetween(minDate, maxDate) + 1
  const totalWidth = totalDays * dayWidth
  const todayOffset = daysBetween(minDate, today) * dayWidth

  // Build month labels
  const months: { label: string; left: number; width: number }[] = []
  let cursor = new Date(minDate)
  while (cursor < maxDate) {
    const monthEnd   = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    const left  = Math.max(0, daysBetween(minDate, cursor)) * dayWidth
    const right = Math.min(totalDays, daysBetween(minDate, monthEnd) + 1) * dayWidth
    months.push({
      label: cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      left,
      width: right - left,
    })
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  }

  // Build flat row list
  const topItems = items.filter(i => !i.parent_item_id)
  const subMap: Record<string, TrackerItem[]> = {}
  items.forEach(i => { if (i.parent_item_id) { if (!subMap[i.parent_item_id]) subMap[i.parent_item_id] = []; subMap[i.parent_item_id].push(i) } })

  const rows: Array<{ item: TrackerItem; depth: number; isGroup?: false } | { group: TrackerGroup; isGroup: true }> = []
  groups.forEach(group => {
    rows.push({ group, isGroup: true })
    if (!collapsed.has(group.id)) {
      topItems.filter(i => i.group_id === group.id).forEach(item => {
        rows.push({ item, depth: 0 })
        if (!collapsed.has(item.id)) {
          ;(subMap[item.id] ?? []).forEach(sub => rows.push({ item: sub, depth: 1 }))
        }
      })
    }
  })

  // Mouse drag handlers
  const handleBarMouseDown = useCallback((
    e: React.MouseEvent,
    item: TrackerItem,
    type: 'move' | 'resize'
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const startDate = item.start_date ? new Date(item.start_date + 'T12:00:00') : null
    const origOffset = startDate ? daysBetween(minDate, startDate) * dayWidth : 0
    setDragging({ itemId: item.id, startX: e.clientX, origOffset, type })

    const onMove = (_me: MouseEvent) => {
      // Live preview is debounced for performance — actual update happens on mouseup
    }

    const onUp = (ue: MouseEvent) => {
      const dx = ue.clientX - e.clientX
      const daysDelta = Math.round(dx / dayWidth)
      if (Math.abs(daysDelta) > 0) {
        const patch: Record<string, unknown> = {}
        if (type === 'move') {
          if (item.start_date) {
            patch.start_date = addDays(new Date(item.start_date + 'T12:00:00'), daysDelta).toISOString().split('T')[0]
          }
          if (item.due_date) {
            patch.due_date = addDays(new Date(item.due_date + 'T12:00:00'), daysDelta).toISOString().split('T')[0]
          }
        } else {
          if (item.due_date) {
            patch.due_date = addDays(new Date(item.due_date + 'T12:00:00'), daysDelta).toISOString().split('T')[0]
          }
        }
        if (Object.keys(patch).length > 0) void onItemUpdate(item.id, patch)
      }
      setDragging(null)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayWidth, minDate, onItemUpdate])

  const ROW_H = 36
  const LEFT_W = 260

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, overflow: 'hidden', borderRadius: 12, border: '1px solid #E2E8F0' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginRight: 8 }}>Zoom</span>
        {(['day', 'week', 'month', 'quarter'] as ZoomLevel[]).map(z => (
          <button key={z} onClick={() => setZoom(z)} style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            border: `1px solid ${zoom === z ? '#6B7EFF' : '#E2E8F0'}`,
            background: zoom === z ? '#6B7EFF' : '#fff',
            color: zoom === z ? '#fff' : '#64748B', cursor: 'pointer',
          }}>{ZOOM_CONFIG[z].label}</button>
        ))}
      </div>

      {/* Gantt body */}
      <div style={{ display: 'flex', overflow: 'hidden', flex: 1 }}>
        {/* Left panel - item names */}
        <div style={{ width: LEFT_W, flexShrink: 0, borderRight: '1px solid #E2E8F0', background: '#fff', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ height: 40, padding: '0 12px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Task</span>
          </div>
          {rows.map((row, i) => {
            if (row.isGroup) {
              const g = row.group
              return (
                <div key={`g-${g.id}`} style={{ height: ROW_H, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 7, borderBottom: '1px solid #F1F5F9', background: '#F8FAFC', cursor: 'pointer' }}
                  onClick={() => setCollapsed(prev => { const n = new Set(prev); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n })}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                  {collapsed.has(g.id) ? <ChevronRight size={12} color="#94A3B8" /> : <ChevronDown size={12} color="#94A3B8" />}
                </div>
              )
            }
            const it = row.item
            return (
              <div key={`i-${it.id}-${i}`} style={{
                height: ROW_H, display: 'flex', alignItems: 'center',
                paddingLeft: 12 + (row.depth ?? 0) * 16,
                paddingRight: 12, gap: 6,
                borderBottom: '1px solid #F1F5F9', cursor: 'pointer',
              }}
                onClick={() => onItemClick(it)}>
                {subMap[it.id]?.length > 0 && (
                  <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
                    onClick={e => { e.stopPropagation(); setCollapsed(prev => { const n = new Set(prev); n.has(it.id) ? n.delete(it.id) : n.add(it.id); return n }) }}>
                    {collapsed.has(it.id) ? <ChevronRight size={11} color="#94A3B8" /> : <ChevronDown size={11} color="#94A3B8" />}
                  </button>
                )}
                <span style={{ fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{it.title}</span>
              </div>
            )
          })}
        </div>

        {/* Right panel - timeline */}
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', position: 'relative' }} ref={scrollRef}>
          {/* Month header */}
          <div style={{ height: 40, position: 'relative', minWidth: totalWidth, background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
            {months.map((m, mi) => (
              <div key={mi} style={{
                position: 'absolute', left: m.left, width: m.width, height: '100%',
                display: 'flex', alignItems: 'center', paddingLeft: 8,
                borderRight: '1px solid #E2E8F0',
              }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>{m.label}</span>
              </div>
            ))}
          </div>

          {/* Rows */}
          <div style={{ position: 'relative', minWidth: totalWidth }}>
            {/* Today line */}
            <div style={{
              position: 'absolute', left: todayOffset, top: 0, bottom: 0,
              width: 2, background: '#EF4444', opacity: 0.6, zIndex: 10, pointerEvents: 'none',
            }} />

            {/* Grid lines */}
            {Array.from({ length: Math.ceil(totalDays / 7) }).map((_, wi) => (
              <div key={wi} style={{
                position: 'absolute', left: wi * 7 * dayWidth, top: 0, bottom: 0,
                width: 1, background: '#F1F5F9',
              }} />
            ))}

            {rows.map((row, ri) => {
              const top = ri * ROW_H
              if (row.isGroup) {
                // Group summary bar: span from min start to max end
                const groupTopItems = topItems.filter(i => i.group_id === row.group.id)
                const groupDates = groupTopItems.flatMap(i => [
                  i.start_date ? new Date(i.start_date + 'T12:00:00') : null,
                  i.due_date   ? new Date(i.due_date + 'T12:00:00')   : null,
                ].filter(Boolean) as Date[])
                const gStart = groupDates.length > 0 ? new Date(Math.min(...groupDates.map(d => d.getTime()))) : null
                const gEnd   = groupDates.length > 0 ? new Date(Math.max(...groupDates.map(d => d.getTime()))) : null

                return (
                  <div key={`gr-${row.group.id}`} style={{
                    position: 'relative', height: ROW_H,
                    borderBottom: '1px solid #F1F5F9',
                    background: '#F8FAFC',
                  }}>
                    {gStart && gEnd && (
                      <div style={{
                        position: 'absolute',
                        left: daysBetween(minDate, gStart) * dayWidth,
                        width: (daysBetween(gStart, gEnd) + 1) * dayWidth,
                        top: '50%', transform: 'translateY(-50%)',
                        height: 6, borderRadius: 3,
                        background: row.group.color, opacity: 0.5,
                      }} />
                    )}
                  </div>
                )
              }

              const it = row.item
              const startDate = it.start_date ? new Date(it.start_date + 'T12:00:00') : null
              const endDate   = it.due_date   ? new Date(it.due_date + 'T12:00:00')   : null
              const isMilestone = startDate && endDate && startDate.toDateString() === endDate.toDateString()
              const barLeft  = startDate ? daysBetween(minDate, startDate) * dayWidth : endDate ? (daysBetween(minDate, endDate) - 0.5) * dayWidth : null
              const barWidth = startDate && endDate && !isMilestone ? (daysBetween(startDate, endDate) + 1) * dayWidth : dayWidth
              const barColor = STATUS_COLORS[it.status] ?? '#94A3B8'

              // Incoming dependencies for this item
              const incomingDeps = dependencies.filter(d => d.to_item_id === it.id)
              const hasConflict = incomingDeps.some(d => {
                const fromItem = items.find(i => i.id === d.from_item_id)
                if (!fromItem?.due_date || !it.start_date) return false
                return new Date(it.start_date + 'T12:00:00') <= new Date(fromItem.due_date + 'T12:00:00')
              })

              return (
                <div key={`ir-${it.id}-${ri}`} style={{
                  position: 'relative', height: ROW_H,
                  borderBottom: '1px solid #F1F5F9',
                  background: row.depth === 1 ? '#FAFBFF' : '#fff',
                }}>
                  {barLeft !== null && (
                    isMilestone ? (
                      // Diamond milestone
                      <div
                        style={{
                          position: 'absolute',
                          left: barLeft + dayWidth / 2 - 7,
                          top: '50%', transform: 'translateY(-50%) rotate(45deg)',
                          width: 14, height: 14,
                          background: barColor,
                          cursor: 'pointer', zIndex: 2,
                        }}
                        onClick={() => onItemClick(it)}
                        title={it.title}
                      />
                    ) : (
                      <div
                        style={{
                          position: 'absolute',
                          left: barLeft,
                          width: Math.max(barWidth, dayWidth),
                          top: '50%', transform: 'translateY(-50%)',
                          height: row.depth === 1 ? 14 : 18,
                          borderRadius: 4,
                          background: barColor,
                          opacity: hasConflict ? 1 : 0.82,
                          border: hasConflict ? '2px solid #EF4444' : 'none',
                          cursor: 'grab',
                          display: 'flex', alignItems: 'center',
                          overflow: 'hidden',
                          zIndex: 2,
                        }}
                        onMouseDown={e => handleBarMouseDown(e, it, 'move')}
                        onClick={() => onItemClick(it)}
                        title={it.title}
                      >
                        {/* Progress fill */}
                        {it.progress_pct > 0 && (
                          <div style={{
                            position: 'absolute', left: 0, top: 0, bottom: 0,
                            width: `${it.progress_pct}%`,
                            background: 'rgba(255,255,255,0.25)',
                          }} />
                        )}
                        <span style={{
                          fontSize: 10, color: '#fff', fontWeight: 600,
                          paddingLeft: 6, overflow: 'hidden', whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis', pointerEvents: 'none', flex: 1,
                        }}>{it.title}</span>
                        {/* Resize handle */}
                        <div
                          style={{
                            width: 6, height: '100%', cursor: 'col-resize', flexShrink: 0,
                            background: 'rgba(255,255,255,0.3)',
                          }}
                          onMouseDown={e => { e.stopPropagation(); handleBarMouseDown(e, it, 'resize') }}
                        />
                      </div>
                    )
                  )}

                  {/* Placeholder if no dates */}
                  {barLeft === null && (
                    <div style={{
                      position: 'absolute',
                      left: todayOffset,
                      width: 80,
                      top: '50%', transform: 'translateY(-50%)',
                      height: 8, borderRadius: 4,
                      background: '#E2E8F0',
                      cursor: 'pointer',
                    }} onClick={() => onItemClick(it)} />
                  )}
                </div>
              )
            })}

            {/* Dependency arrows (SVG overlay) */}
            <svg style={{
              position: 'absolute', top: 0, left: 0,
              width: totalWidth, height: rows.length * ROW_H,
              pointerEvents: 'none', zIndex: 5,
            }}>
              {dependencies.map(dep => {
                const fromIdx = rows.findIndex(r => !r.isGroup && r.item.id === dep.from_item_id)
                const toIdx   = rows.findIndex(r => !r.isGroup && r.item.id === dep.to_item_id)
                if (fromIdx < 0 || toIdx < 0) return null
                const fromItem = items.find(i => i.id === dep.from_item_id)
                const toItem   = items.find(i => i.id === dep.to_item_id)
                if (!fromItem?.due_date) return null

                const fromX = (daysBetween(minDate, new Date(fromItem.due_date + 'T12:00:00')) + 1) * dayWidth
                const fromY = fromIdx * ROW_H + ROW_H / 2
                const toStartDate = toItem?.start_date ? new Date(toItem.start_date + 'T12:00:00') : null
                const toX   = toStartDate ? daysBetween(minDate, toStartDate) * dayWidth : fromX + 30
                const toY   = toIdx   * ROW_H + ROW_H / 2

                const isConflict = toItem?.start_date && new Date(toItem.start_date + 'T12:00:00') <= new Date(fromItem.due_date + 'T12:00:00')
                const color = isConflict ? '#EF4444' : '#94A3B8'

                const midX = (fromX + toX) / 2
                const path = `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`

                return (
                  <g key={dep.id}>
                    <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrowhead)" />
                    <defs>
                      <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="3" refY="2" orient="auto">
                        <polygon points="0 0, 6 2, 0 4" fill={color} />
                      </marker>
                    </defs>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
