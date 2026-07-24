'use client'

// NexusConsoleRail — collapsible "launch pad" console. Per Russel's July 2026
// direction it lives on the LEFT edge and pops in/out; the RIGHT edge carries
// the actions/to-dos/follow-ups pop-out (NexusActionsRail).
//
// COSMETIC / IA-ONLY: the items are the EXISTING Nexus destinations (the same
// tabs as the bottom nav, plus Help / Admin). No new IA — just a launch pad.
// State persists in localStorage. Desktop-only (lg+).

import { useEffect, useState } from 'react'
import {
  TrendingUp, Wrench, Layers, Package, Activity, Info, Shield,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Home } = require('lucide-react') as any

export interface RailItem {
  id: string
  label: string
  icon: 'home' | 'sales' | 'ops' | 'design' | 'catalog' | 'systems' | 'help' | 'admin'
}

const ICONS = {
  home: Home, sales: TrendingUp, ops: Wrench, design: Layers,
  catalog: Package, systems: Activity, help: Info, admin: Shield,
} as const

export function NexusConsoleRail({
  items,
  activeId,
  onSelect,
  side = 'left',
  open: openProp,
  onToggle,
}: {
  items: RailItem[]
  activeId?: string
  onSelect: (id: string) => void
  side?: 'left' | 'right'
  open?: boolean
  onToggle?: () => void
}) {
  const controlled = openProp !== undefined
  const [openState, setOpenState] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const OPEN_KEY = `gg_nexus_rail_open_${side}`
  const isLeft = side === 'left'
  const open = controlled ? !!openProp : openState

  useEffect(() => {
    if (!controlled) {
      try { setOpenState(localStorage.getItem(OPEN_KEY) === '1') } catch { /* default closed */ }
    }
    setHydrated(true)
  }, [OPEN_KEY, controlled])

  function toggle() {
    if (controlled) { onToggle?.(); return }
    setOpenState((v) => {
      try { localStorage.setItem(OPEN_KEY, v ? '0' : '1') } catch { /* ignore */ }
      return !v
    })
  }

  // Chevron points "outward-to-close" when open, "inward-to-open" when closed.
  const chevron = isLeft
    ? (open ? <ChevronLeft size={14} /> : <ChevronRight size={14} />)
    : (open ? <ChevronRight size={14} /> : <ChevronLeft size={14} />)

  return (
    <div className="hidden lg:block">
      {/* Edge toggle tab — always visible, rides the rail's edge. */}
      <button
        type="button"
        onClick={toggle}
        aria-label={open ? 'Hide launch pad' : 'Show launch pad'}
        className={`fixed top-1/2 z-40 flex h-16 w-6 -translate-y-1/2 items-center justify-center transition-all duration-300 ${isLeft ? 'rounded-r-xl' : 'rounded-l-xl'}`}
        style={{
          ...(isLeft ? { left: open ? 232 : 0 } : { right: open ? 232 : 0 }),
          background: '#0e1e38',
          border: '1px solid rgba(45,212,191,0.30)',
          ...(isLeft ? { borderLeft: 'none' } : { borderRight: 'none' }),
          color: '#7DE5FF',
          boxShadow: '0 0 18px rgba(45,212,191,0.20)',
        }}
      >
        {chevron}
      </button>

      {/* The rail itself — slides in/out. */}
      <aside
        aria-hidden={!open}
        className={`fixed bottom-0 top-0 z-30 flex w-[232px] flex-col pt-6 transition-transform duration-300 ${isLeft ? 'left-0' : 'right-0'}`}
        style={{
          transform: hydrated && open ? 'translateX(0)' : `translateX(${isLeft ? '-100%' : '100%'})`,
          background: '#0e1e38',
          ...(isLeft
            ? { borderRight: '1px solid rgba(45,212,191,0.22)', boxShadow: '18px 0 60px rgba(0,0,0,0.45)' }
            : { borderLeft: '1px solid rgba(45,212,191,0.22)', boxShadow: '-18px 0 60px rgba(0,0,0,0.45)' }),
        }}
      >
        <div className="px-5 pb-5">
          <div className="text-[10px] font-semibold uppercase leading-relaxed tracking-[0.28em]" style={{ color: 'rgba(125,229,255,0.72)' }}>
            Launch
            <br />
            Pad
          </div>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
          {items.map((item) => {
            const Icon = ICONS[item.icon]
            const active = activeId === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className="mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-all"
                style={active
                  ? { background: 'rgba(45,212,191,0.14)', border: '1px solid rgba(45,212,191,0.32)', color: 'rgba(255,255,255,0.95)' }
                  : { border: '1px solid transparent', color: 'rgba(255,255,255,0.60)' }}
              >
                <Icon size={15} style={{ color: active ? '#7DE5FF' : 'rgba(125,229,255,0.55)' }} />
                {item.label}
              </button>
            )
          })}
        </nav>
      </aside>
    </div>
  )
}
