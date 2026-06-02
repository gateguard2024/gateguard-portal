'use client'
import { useState } from 'react'
import type { TrackerItem } from './BoardView'

interface OrgUser { id: string; name: string; email: string; role: string }

interface WorkloadViewProps {
  items: TrackerItem[]
  orgUsers: OrgUser[]
}

function getWeekStart(offset: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay() + offset * 7)
  return d
}

function cellColor(count: number): { bg: string; text: string } {
  if (count === 0)      return { bg: '#F8FAFC', text: '#CBD5E1' }
  if (count <= 2)       return { bg: '#ECFDF5', text: '#059669' }
  if (count <= 4)       return { bg: '#FFFBEB', text: '#D97706' }
  return                       { bg: '#FEF2F2', text: '#DC2626' }
}

export function WorkloadView({ items, orgUsers }: WorkloadViewProps) {
  const [popover, setPopover] = useState<{ userId: string; weekOffset: number } | null>(null)

  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = getWeekStart(i)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start, end, label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
  })

  // Build a list of assignees (from items + org users)
  const assigneeNames = new Set<string>()
  items.forEach(i => { if (i.owner_name) assigneeNames.add(i.owner_name) })
  orgUsers.forEach(u => assigneeNames.add(u.name))
  const assignees = Array.from(assigneeNames)

  function itemsInCell(name: string, week: { start: Date; end: Date }): TrackerItem[] {
    return items.filter(item => {
      if (item.owner_name !== name) return false
      if (!item.due_date && !item.start_date) return false
      const due   = item.due_date   ? new Date(item.due_date + 'T12:00:00')   : null
      const start = item.start_date ? new Date(item.start_date + 'T12:00:00') : null
      if (due && due >= week.start && due <= week.end) return true
      if (start && start >= week.start && start <= week.end) return true
      if (start && due && start <= week.start && due >= week.end) return true
      return false
    })
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
        <thead>
          <tr>
            <th style={{
              textAlign: 'left', padding: '8px 14px', fontSize: 11, fontWeight: 700,
              color: '#64748B', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0',
              minWidth: 160, textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>Assignee</th>
            {weeks.map((w, i) => (
              <th key={i} style={{
                textAlign: 'center', padding: '8px 10px', fontSize: 11, fontWeight: 600,
                color: '#64748B', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0',
                minWidth: 90,
              }}>{w.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {assignees.map(name => (
            <tr key={name}>
              <td style={{
                padding: '10px 14px', borderBottom: '1px solid #F1F5F9',
                display: 'flex', alignItems: 'center', gap: 9,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: '#6B7EFF', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}>{name[0]?.toUpperCase()}</div>
                <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{name}</span>
              </td>
              {weeks.map((w, wi) => {
                const cellItems = itemsInCell(name, w)
                const { bg, text } = cellColor(cellItems.length)
                const isOpen = popover?.userId === name && popover?.weekOffset === wi
                return (
                  <td key={wi} style={{ padding: 6, borderBottom: '1px solid #F1F5F9', textAlign: 'center', position: 'relative' }}>
                    <div
                      onClick={() => setPopover(isOpen ? null : { userId: name, weekOffset: wi })}
                      style={{
                        background: bg, color: text, borderRadius: 8,
                        padding: '10px 6px', cursor: cellItems.length > 0 ? 'pointer' : 'default',
                        fontSize: 13, fontWeight: cellItems.length > 0 ? 700 : 400,
                        border: `1px solid ${cellItems.length > 0 ? text + '33' : '#E2E8F0'}`,
                        minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {cellItems.length > 0 ? cellItems.length : '—'}
                    </div>
                    {isOpen && cellItems.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                        zIndex: 50, background: '#fff', border: '1px solid #E2E8F0',
                        borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        minWidth: 200, padding: 10, marginTop: 4,
                      }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 6 }}>
                          {name} — {w.label}
                        </p>
                        {cellItems.map(item => (
                          <div key={item.id} style={{ fontSize: 12, color: '#374151', padding: '4px 0', borderBottom: '1px solid #F1F5F9' }}>
                            {item.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
          {assignees.length === 0 && (
            <tr>
              <td colSpan={9} style={{ padding: 32, textAlign: 'center', fontSize: 13, color: '#94A3B8' }}>
                No items with assignees yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
