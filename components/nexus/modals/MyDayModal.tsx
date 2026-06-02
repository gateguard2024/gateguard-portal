'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const CARD_STYLE = {
  background: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.09)',
  backdropFilter: 'blur(8px)',
}

function CountBadge({ n }: { n: number | null }) {
  if (n === null) return null
  if (n === 0) return (
    <span className="text-xs rounded-full px-1.5 py-0.5" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)' }}>
      0
    </span>
  )
  return (
    <span className="text-xs font-medium rounded-full px-1.5 py-0.5" style={{ background: '#6B7EFF', color: '#fff' }}>
      {n > 99 ? '99+' : n}
    </span>
  )
}

export function MyDayModal() {
  const [todoCount, setTodoCount] = useState<number | null>(null)
  const [woCount,   setWoCount]   = useState<number | null>(null)

  useEffect(() => {
    // Open todos
    fetch('/api/todos?limit=100')
      .then(r => r.json())
      .then(d => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list = d.todos ?? d.records ?? []
        setTodoCount(list.filter((t: any) => !t.completed).length)
      })
      .catch(() => {})

    // Today's work orders — filter by today's date client-side
    const today = new Date().toISOString().split('T')[0]
    fetch('/api/dispatch/work-orders?limit=50')
      .then(r => r.json())
      .then(d => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list = d.work_orders ?? d.records ?? []
        const todayWos = list.filter((wo: any) => {
          const s = wo.scheduled_date ?? wo.created_at ?? ''
          return s.startsWith(today)
        })
        setWoCount(todayWos.length)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="grid grid-cols-3 gap-3 w-full">

      {/* Work orders */}
      <Link href="/dispatch" className="group rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02]"
        style={{ ...CARD_STYLE, borderColor: 'rgba(107,126,255,0.18)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(107,126,255,0.18)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="1" y="4" width="12" height="8" rx="1.5" stroke="#6B7EFF" strokeWidth="1.2"/>
                <path d="M4 4V3a3 3 0 016 0v1" stroke="#6B7EFF" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(107,126,255,0.8)' }}>Today</span>
          </div>
          <CountBadge n={woCount} />
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>Work orders</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Today&apos;s schedule</p>
      </Link>

      {/* Todos */}
      <Link href="/todos" className="group rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02]"
        style={CARD_STYLE}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.15)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 7l3 3 7-7" stroke="#34d399" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(52,211,153,0.7)' }}>To-dos</span>
          </div>
          <CountBadge n={todoCount} />
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>Open tasks</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Your assigned items</p>
      </Link>

      {/* Calendar */}
      <Link href="/calendar" className="group rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02]"
        style={CARD_STYLE}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.12)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="1" y="2.5" width="12" height="10" rx="1.5" stroke="#fbbf24" strokeWidth="1.2"/>
              <path d="M4 1.5v2M10 1.5v2M1 6h12" stroke="#fbbf24" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(251,191,36,0.7)' }}>Calendar</span>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>Schedule</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Upcoming events</p>
      </Link>

    </div>
  )
}
