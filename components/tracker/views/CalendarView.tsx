'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { TrackerItem } from './BoardView'

const STATUS_COLORS: Record<string, string> = {
  new:         '#94A3B8',
  in_progress: '#6B7EFF',
  in_review:   '#06B6D4',
  on_hold:     '#F59E0B',
  done:        '#10B981',
  blocked:     '#EF4444',
  wont_fix:    '#94A3B8',
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

interface CalendarViewProps {
  items: TrackerItem[]
  onItemClick: (item: TrackerItem) => void
  onItemCreate: (groupId: string, status: string, title: string, dueDate: string) => Promise<void>
  defaultGroupId?: string
}

export function CalendarView({ items, onItemClick, onItemCreate, defaultGroupId }: CalendarViewProps) {
  const today = new Date()
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [creating, setCreating] = useState<Date | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay() // 0=Sun
  const totalCells  = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7

  const cells: (Date | null)[] = Array.from({ length: totalCells }, (_, i) => {
    const d = i - startOffset + 1
    if (d < 1 || d > lastDay.getDate()) return null
    return new Date(year, month, d)
  })

  function itemsForDay(day: Date): TrackerItem[] {
    return items.filter(item => {
      if (!item.due_date && !item.start_date) return false
      const due   = item.due_date   ? new Date(item.due_date + 'T12:00:00')   : null
      return due && sameDay(due, day)
    })
  }

  function multiDayItems(day: Date): TrackerItem[] {
    if (!day) return []
    return items.filter(item => {
      if (!item.start_date || !item.due_date) return false
      const start = new Date(item.start_date + 'T12:00:00')
      const end   = new Date(item.due_date   + 'T12:00:00')
      return day >= start && day <= end && !sameDay(start, end)
    })
  }

  async function handleCreate(day: Date) {
    if (!newTitle.trim()) return
    setSaving(true)
    const dueDate = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    await onItemCreate(defaultGroupId ?? '', 'new', newTitle.trim(), dueDate)
    setNewTitle('')
    setCreating(null)
    setSaving(false)
  }

  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', margin: 0 }}>{monthLabel}</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          ><ChevronLeft size={16} color="#64748B" /></button>
          <button
            onClick={() => setViewDate(new Date())}
            style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#374151', fontWeight: 600 }}
          >Today</button>
          <button
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          ><ChevronRight size={16} color="#64748B" /></button>
        </div>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 1 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#94A3B8', padding: '6px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: '#E2E8F0', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
        {cells.map((day, ci) => {
          if (!day) {
            return <div key={`empty-${ci}`} style={{ background: '#F8FAFC', minHeight: 90 }} />
          }
          const isToday = sameDay(day, today)
          const isCurrentMonth = day.getMonth() === month
          const dayItems = itemsForDay(day)
          const spanItems = multiDayItems(day)
          const allItems = [...spanItems, ...dayItems]
          const shown = allItems.slice(0, 4)
          const overflow = allItems.length - 4

          const isCreating = creating && sameDay(creating, day)

          return (
            <div
              key={day.toISOString()}
              style={{
                background: isToday ? '#EEF2FF' : isCurrentMonth ? '#fff' : '#F8FAFC',
                minHeight: 90, padding: 6, cursor: 'pointer',
                position: 'relative',
              }}
              onClick={() => { if (!isCreating) setCreating(day) }}
            >
              {/* Day number */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{
                  fontSize: 12, fontWeight: isToday ? 800 : 500,
                  color: isToday ? '#6B7EFF' : isCurrentMonth ? '#374151' : '#CBD5E1',
                  width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%',
                  background: isToday ? 'rgba(107,126,255,0.12)' : 'transparent',
                }}>{day.getDate()}</span>
                {isCurrentMonth && (
                  <button
                    onClick={e => { e.stopPropagation(); setCreating(day) }}
                    style={{ opacity: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 1 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0' }}
                  ><Plus size={11} color="#94A3B8" /></button>
                )}
              </div>

              {/* Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {shown.map(item => (
                  <div
                    key={item.id}
                    onClick={e => { e.stopPropagation(); onItemClick(item) }}
                    style={{
                      fontSize: 10, fontWeight: 600,
                      padding: '2px 5px', borderRadius: 3,
                      background: STATUS_COLORS[item.status] ?? '#94A3B8',
                      color: '#fff',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}
                  >{item.title}</div>
                ))}
                {overflow > 0 && (
                  <span style={{ fontSize: 10, color: '#6B7EFF', fontWeight: 600 }}>+{overflow} more</span>
                )}
              </div>

              {/* Create inline */}
              {isCreating && (
                <div
                  style={{
                    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
                    background: '#fff', border: '2px solid #6B7EFF', borderRadius: 8, padding: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <input
                    autoFocus
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleCreate(day)
                      if (e.key === 'Escape') { setCreating(null); setNewTitle('') }
                    }}
                    placeholder="New item..."
                    style={{ width: '100%', fontSize: 11, border: 'none', outline: 'none', marginBottom: 4, boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleCreate(day)} disabled={saving} style={{ flex: 1, padding: '3px 0', borderRadius: 4, border: 'none', background: '#6B7EFF', color: '#fff', fontSize: 10, cursor: 'pointer' }}>
                      {saving ? '...' : 'Add'}
                    </button>
                    <button onClick={() => { setCreating(null); setNewTitle('') }} style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid #E2E8F0', background: 'transparent', fontSize: 10, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
