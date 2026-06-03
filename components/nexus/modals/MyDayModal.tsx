'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ActionCard } from '@/components/nexus/ActionCard'
import { ActionCommandBar } from '@/components/nexus/ActionCommandBar'

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

type View = 'menu' | 'work-orders' | 'tasks' | 'calendar'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!r) return '107,126,255'
  return `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}`
}

// ─── Menu Card ────────────────────────────────────────────────────────────────

interface MenuCardProps {
  label:     string
  subtitle:  string
  icon:      React.ReactNode
  accentHex: string
  badge?:    string | number
  onClick:   () => void
}

function MenuCard({ label, subtitle, icon, accentHex, badge, onClick }: MenuCardProps) {
  const [hover, setHover] = useState(false)
  const rgb = hexToRgb(accentHex)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="relative flex flex-col items-start gap-2 w-full rounded-2xl p-4 text-left transition-all duration-200"
      style={{
        background:  hover ? `rgba(${rgb},0.12)` : `rgba(${rgb},0.06)`,
        border:      hover ? `1px solid rgba(${rgb},0.4)` : `1px solid rgba(${rgb},0.2)`,
        transform:   hover ? 'translateY(-1px)' : 'none',
        boxShadow:   hover ? `0 4px 20px rgba(${rgb},0.15)` : 'none',
      }}
    >
      {badge !== undefined && (
        <span
          className="absolute top-3 right-3 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: `rgba(${rgb},0.2)`, color: accentHex }}
        >
          {badge}
        </span>
      )}

      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `rgba(${rgb},0.18)` }}
      >
        {icon}
      </div>

      <div>
        <p className="text-sm font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.88)' }}>
          {label}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {subtitle}
        </p>
      </div>

      <svg
        width="14" height="14" viewBox="0 0 14 14" fill="none"
        className="mt-auto self-end transition-transform duration-200"
        style={{ transform: hover ? 'translateX(2px)' : 'none', opacity: hover ? 1 : 0.45 }}
        aria-hidden="true"
      >
        <path d="M3 7h8M7 3l4 4-4 4" stroke={accentHex} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}

// ─── Back button ──────────────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 mb-3 transition-colors"
      style={{ color: 'rgba(107,126,255,0.55)' }}
      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(107,126,255,0.9)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(107,126,255,0.55)')}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span className="text-xs font-medium">My Day</span>
    </button>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MyDayModal() {
  const [view,       setView]       = useState<View>('menu')
  const [workOrders, setWorkOrders] = useState<TodayWO[]>([])
  const [loading,    setLoading]    = useState(true)
  const [dismissed,  setDismissed]  = useState<Set<string>>(new Set())
  const [cmdLoading, setCmdLoading] = useState(false)

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

  const handleCommand = useCallback((_query: string) => {
    // Future: pipe to NexusAssistant with WO context pre-loaded
    setCmdLoading(true)
    setTimeout(() => setCmdLoading(false), 1200)
  }, [])

  // ── Step 1: Choice menu ────────────────────────────────────────────────────
  if (view === 'menu') {
    const openCount = workOrders.filter(wo => !dismissed.has(wo.id)).length

    return (
      <div className="space-y-4">
        <p className="text-[11px] uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.28)' }}>
          Select your area of focus
        </p>
        <div className="grid grid-cols-3 gap-3">

          {/* Work Orders */}
          <MenuCard
            label="Work Orders"
            subtitle="Today's jobs"
            accentHex="#6B7EFF"
            badge={!loading && openCount > 0 ? openCount : undefined}
            onClick={() => setView('work-orders')}
            icon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <rect x="2" y="3" width="14" height="12" rx="2" stroke="#6B7EFF" strokeWidth="1.3"/>
                <path d="M6 3V2a1 1 0 012 0v1M10 3V2a1 1 0 012 0v1" stroke="#6B7EFF" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M5 9h8M5 12h5" stroke="#6B7EFF" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            }
          />

          {/* Open Tasks */}
          <MenuCard
            label="Open Tasks"
            subtitle="Your to-dos"
            accentHex="#34d399"
            onClick={() => setView('tasks')}
            icon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M3 9l3.5 3.5L15 5" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
          />

          {/* Calendar */}
          <MenuCard
            label="Schedule"
            subtitle="Calendar"
            accentHex="#fbbf24"
            onClick={() => setView('calendar')}
            icon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <rect x="1.5" y="3.5" width="15" height="13" rx="2" stroke="#fbbf24" strokeWidth="1.3"/>
                <path d="M5.5 2v3M12.5 2v3M1.5 8h15" stroke="#fbbf24" strokeWidth="1.3" strokeLinecap="round"/>
                <circle cx="6" cy="12" r="1" fill="#fbbf24"/>
                <circle cx="9" cy="12" r="1" fill="#fbbf24"/>
                <circle cx="12" cy="12" r="1" fill="#fbbf24"/>
              </svg>
            }
          />

        </div>
      </div>
    )
  }

  // ── Step 2a: Work Orders ───────────────────────────────────────────────────
  if (view === 'work-orders') {
    return (
      <div className="space-y-2">
        <BackButton onClick={() => setView('menu')} />

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
          <div key={wo.id}>
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

        {/* Context-aware command bar */}
        <div className="pt-3" style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <ActionCommandBar onSubmit={handleCommand} isLoading={cmdLoading} />
        </div>
      </div>
    )
  }

  // ── Step 2b: Open Tasks ────────────────────────────────────────────────────
  if (view === 'tasks') {
    return (
      <div className="space-y-3">
        <BackButton onClick={() => setView('menu')} />
        <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'rgba(52,211,153,0.55)' }}>
          Open tasks
        </p>
        <div
          className="py-4 px-4 rounded-xl flex items-center justify-between"
          style={{ background: 'rgba(52,211,153,0.06)', border: '0.5px solid rgba(52,211,153,0.18)' }}
        >
          <div>
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>Your to-do list</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>View and manage all tasks</p>
          </div>
          <Link
            href="/todos"
            className="px-4 py-2 rounded-xl text-xs font-medium transition-all"
            style={{ background: 'rgba(52,211,153,0.15)', border: '0.5px solid rgba(52,211,153,0.3)', color: '#34d399' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.25)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.15)')}
          >
            Open →
          </Link>
        </div>
        <div className="pt-3" style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <ActionCommandBar onSubmit={handleCommand} isLoading={cmdLoading} />
        </div>
      </div>
    )
  }

  // ── Step 2c: Calendar ──────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <BackButton onClick={() => setView('menu')} />
      <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'rgba(251,191,36,0.55)' }}>
        Schedule
      </p>
      <div
        className="py-4 px-4 rounded-xl flex items-center justify-between"
        style={{ background: 'rgba(251,191,36,0.06)', border: '0.5px solid rgba(251,191,36,0.18)' }}
      >
        <div>
          <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>Your calendar</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Today&apos;s schedule &amp; upcoming</p>
        </div>
        <Link
          href="/calendar"
          className="px-4 py-2 rounded-xl text-xs font-medium transition-all"
          style={{ background: 'rgba(251,191,36,0.15)', border: '0.5px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(251,191,36,0.25)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(251,191,36,0.15)')}
        >
          Open →
        </Link>
      </div>
      <div className="pt-3" style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
        <ActionCommandBar onSubmit={handleCommand} isLoading={cmdLoading} />
      </div>
    </div>
  )
}
