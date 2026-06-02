'use client'
import type { TrackerItem } from './BoardView'

interface OrgUser { id: string; name: string; email: string; role: string }

interface TimelineViewProps {
  items: TrackerItem[]
  orgUsers: OrgUser[]
  onItemClick: (item: TrackerItem) => void
}

const STATUS_COLORS: Record<string, string> = {
  new:         '#94A3B8',
  in_progress: '#6B7EFF',
  in_review:   '#06B6D4',
  on_hold:     '#F59E0B',
  done:        '#10B981',
  blocked:     '#EF4444',
  wont_fix:    '#CBD5E1',
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function TimelineView({ items, orgUsers, onItemClick }: TimelineViewProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const DAY_W = 14 // pixels per day
  const ROW_H = 44

  // Compute range
  const datedItems = items.filter(i => i.start_date || i.due_date)
  const allDates = datedItems.flatMap(i => [
    i.start_date ? new Date(i.start_date + 'T12:00:00') : null,
    i.due_date   ? new Date(i.due_date + 'T12:00:00')   : null,
  ].filter(Boolean) as Date[])

  const minDate = allDates.length > 0 ? addDays(new Date(Math.min(...allDates.map(d => d.getTime()))), -7) : addDays(today, -14)
  const maxDate = allDates.length > 0 ? addDays(new Date(Math.max(...allDates.map(d => d.getTime()))), 14) : addDays(today, 60)
  const totalDays = daysBetween(minDate, maxDate) + 1
  const totalWidth = totalDays * DAY_W
  const todayOffset = daysBetween(minDate, today) * DAY_W

  // Build assignee rows
  const assigneeNames = new Set<string>()
  items.forEach(i => { if (i.owner_name) assigneeNames.add(i.owner_name) })
  orgUsers.forEach(u => assigneeNames.add(u.name))
  const unassignedItems = datedItems.filter(i => !i.owner_name)
  const assignees = Array.from(assigneeNames)
  if (unassignedItems.length > 0) assignees.push('Unassigned')

  // Month labels
  const months: { label: string; left: number; width: number }[] = []
  let cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
  while (cursor < maxDate) {
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    const left  = Math.max(0, daysBetween(minDate, cursor)) * DAY_W
    const right = Math.min(totalDays, daysBetween(minDate, monthEnd) + 1) * DAY_W
    months.push({
      label: cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      left, width: right - left,
    })
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  }

  const LEFT_W = 180

  return (
    <div style={{ display: 'flex', overflow: 'hidden', borderRadius: 12, border: '1px solid #E2E8F0' }}>
      {/* Left panel */}
      <div style={{ width: LEFT_W, flexShrink: 0, borderRight: '1px solid #E2E8F0', background: '#fff' }}>
        <div style={{ height: 36, padding: '0 14px', display: 'flex', alignItems: 'center', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assignee</span>
        </div>
        {assignees.map(name => (
          <div key={name} style={{
            height: ROW_H, padding: '0 14px',
            display: 'flex', alignItems: 'center', gap: 8,
            borderBottom: '1px solid #F1F5F9',
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: name === 'Unassigned' ? '#F1F5F9' : '#6B7EFF',
              color: name === 'Unassigned' ? '#94A3B8' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, flexShrink: 0,
            }}>{name[0]?.toUpperCase()}</div>
            <span style={{ fontSize: 12, color: '#374151', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
          </div>
        ))}
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', position: 'relative' }}>
        {/* Month header */}
        <div style={{ height: 36, position: 'relative', minWidth: totalWidth, background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
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
            width: 2, background: '#EF4444', opacity: 0.5, zIndex: 5, pointerEvents: 'none',
          }} />

          {assignees.map(name => {
            const personItems = name === 'Unassigned'
              ? unassignedItems
              : datedItems.filter(i => i.owner_name === name)

            return (
              <div key={name} style={{ position: 'relative', height: ROW_H, borderBottom: '1px solid #F1F5F9' }}>
                {personItems.map(item => {
                  const startDate = item.start_date ? new Date(item.start_date + 'T12:00:00') : null
                  const endDate   = item.due_date   ? new Date(item.due_date + 'T12:00:00')   : null
                  const left  = startDate ? daysBetween(minDate, startDate) * DAY_W : endDate ? (daysBetween(minDate, endDate) - 0.5) * DAY_W : null
                  const width = startDate && endDate ? Math.max((daysBetween(startDate, endDate) + 1) * DAY_W, DAY_W) : DAY_W * 3

                  if (left === null) return null

                  return (
                    <div
                      key={item.id}
                      onClick={() => onItemClick(item)}
                      title={item.title}
                      style={{
                        position: 'absolute',
                        left, width,
                        top: '50%', transform: 'translateY(-50%)',
                        height: 24, borderRadius: 5,
                        background: STATUS_COLORS[item.status] ?? '#94A3B8',
                        opacity: 0.85,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center',
                        paddingLeft: 6, overflow: 'hidden',
                        zIndex: 2,
                      }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.title}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
