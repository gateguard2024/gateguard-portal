'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ActionCard } from '@/components/nexus/ActionCard'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TodayWO {
  id:               string
  wo_number:        string
  title:            string
  customer_name:    string | null
  priority:         string
  status:           string
  already_assigned: boolean
  recommended_tech: { id: string; name: string; status: string } | null
  ai_score:         number
  ai_reasoning:     string
}

const PRIORITY_COLOR: Record<string, 'red' | 'amber' | 'blue' | 'green'> = {
  critical: 'red',
  high:     'amber',
  normal:   'blue',
  low:      'green',
}

const STATUS_LABEL: Record<string, string> = {
  open:        'Pending',
  scheduled:   'Assigned',
  in_progress: 'In Progress',
  completed:   'Done',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MyDayModal() {
  const [workOrders, setWorkOrders] = useState<TodayWO[]>([])
  const [loading,    setLoading]    = useState(true)
  const [dismissed,  setDismissed]  = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/dispatch/work-orders/today')
      .then(r => r.json())
      .then(d => setWorkOrders(d.work_orders ?? []))
      .catch(() => setWorkOrders([]))
      .finally(() => setLoading(false))
  }, [])

  const visible = workOrders.filter(wo => !dismissed.has(wo.id)).slice(0, 3)

  async function executeAssignment(wo: TodayWO) {
    if (!wo.recommended_tech) throw new Error('No technician available.')
    const res = await fetch('/api/assistant/execute', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'assign_technician',
        toolArgs: {
          work_order_id:   wo.id,
          technician_id:   wo.recommended_tech.id,
          technician_name: wo.recommended_tech.name,
          reasoning:       wo.ai_reasoning,
        },
      }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error ?? 'Assignment failed.')
  }

  return (
    <div className="w-full space-y-3">

      {/* ── Work Orders — agentic action cards ───────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'rgba(107,126,255,0.55)' }}>
            Work orders today
          </p>
          <Link
            href="/dispatch"
            className="text-[10px] transition-colors"
            style={{ color: 'rgba(255,255,255,0.25)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
          >
            See all →
          </Link>
        </div>

        {loading && (
          <div className="flex items-center gap-2 py-4 px-4 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)' }}>
            <div className="w-4 h-4 rounded-full border-2 border-blue-600/30 border-t-blue-500 animate-spin flex-shrink-0" />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading today&apos;s jobs…</p>
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="py-4 px-4 rounded-xl text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)' }}>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>No open work orders today</p>
            <Link href="/dispatch" className="text-xs mt-1 block"
              style={{ color: 'rgba(107,126,255,0.6)' }}>
              View dispatch →
            </Link>
          </div>
        )}

        {!loading && visible.map(wo => (
          <div key={wo.id} className="mb-2 last:mb-0">
            <ActionCard
              title={`${wo.wo_number}: ${wo.title}`}
              subtitle={wo.customer_name ?? undefined}
              status={STATUS_LABEL[wo.status] ?? wo.status}
              statusColor={PRIORITY_COLOR[wo.priority] ?? 'blue'}
              aiScore={wo.ai_score}
              aiContext={wo.recommended_tech ? 'Technician Recommendation' : 'No technician available'}
              reasoning={wo.ai_reasoning}
              actionLabel={wo.recommended_tech ? `Assign ${wo.recommended_tech.name}` : 'View in Dispatch'}
              confirmLabel="Confirm Assignment"
              onExecute={() => executeAssignment(wo)}
              onDismiss={() => setDismissed(prev => new Set([...prev, wo.id]))}
            />
          </div>
        ))}
      </div>

      {/* ── Quick links: Tasks + Calendar ────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Link href="/todos"
          className="rounded-xl p-3 flex items-center gap-2 transition-all hover:scale-[1.02]"
          style={{ background: 'rgba(52,211,153,0.08)', border: '0.5px solid rgba(52,211,153,0.18)' }}>
          <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(52,211,153,0.18)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M1.5 6l2.5 2.5L10.5 2" stroke="#34d399" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>Open tasks</p>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>Your to-dos</p>
          </div>
        </Link>

        <Link href="/calendar"
          className="rounded-xl p-3 flex items-center gap-2 transition-all hover:scale-[1.02]"
          style={{ background: 'rgba(251,191,36,0.08)', border: '0.5px solid rgba(251,191,36,0.18)' }}>
          <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(251,191,36,0.15)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <rect x="0.5" y="2" width="11" height="9" rx="1.5" stroke="#fbbf24" strokeWidth="1.1"/>
              <path d="M3.5 1v2M8.5 1v2M0.5 5h11" stroke="#fbbf24" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>Schedule</p>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>Calendar</p>
          </div>
        </Link>
      </div>

    </div>
  )
}
