'use client'

// NexusConsoleRail — collapsible right-side console (July 2026 mockup, §6 of
// docs/nexus/COSMETIC_GUIDE_2026-07_MOCKUP.md).
//
// COSMETIC ONLY: the items are the EXISTING Nexus destinations (the same tabs
// as the bottom nav, plus Help / Admin). No new IA. The rail pops in and out
// via the edge tab; state persists in localStorage. Desktop-only (lg+) — on
// mobile the bottom nav carries navigation and the rail would fight it.

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

const OPEN_KEY = 'gg_nexus_rail_open'

export function NexusConsoleRail({
  items,
  activeId,
  onSelect,
}: {
  items: RailItem[]
  activeId?: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(OPEN_KEY) === '1')
    } catch { /* default closed */ }
    setHydrated(true)
  }, [])

  function toggle() {
    setOpen((v) => {
      try { localStorage.setItem(OPEN_KEY, v ? '0' : '1') } catch { /* ignore */ }
      return !v
    })
  }

  return (
    <div className="hidden lg:block">
      {/* Edge toggle tab — always visible, rides the rail's edge. */}
      <button
        type="button"
        onClick={toggle}
        aria-label={open ? 'Hide console' : 'Show console'}
        className="fixed top-1/2 z-40 flex h-16 w-6 -translate-y-1/2 items-center justify-center rounded-l-xl transition-all duration-300"
        style={{
          right: open ? 232 : 0,
          background: '#0e1e38',
          border: '1px solid rgba(45,212,191,0.30)',
          borderRight: 'none',
          color: '#7DE5FF',
          boxShadow: '0 0 18px rgba(45,212,191,0.20)',
        }}
      >
        {open ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* The rail itself — slides in/out. */}
      <aside
        aria-hidden={!open}
        className="fixed bottom-0 right-0 top-0 z-30 flex w-[232px] flex-col pt-6 transition-transform duration-300"
        style={{
          transform: hydrated && open ? 'translateX(0)' : 'translateX(100%)',
          background: '#0e1e38',
          borderLeft: '1px solid rgba(45,212,191,0.22)',
          boxShadow: '-18px 0 60px rgba(0,0,0,0.45)',
        }}
      >
        <div className="px-5 pb-5">
          <div className="text-[10px] font-semibold uppercase leading-relaxed tracking-[0.28em]" style={{ color: 'rgba(125,229,255,0.72)' }}>
            Management
            <br />
            Console
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
                  ? { background: 'rgba(0,124,255,0.16)', border: '1px solid rgba(0,200,255,0.30)', color: 'rgba(255,255,255,0.95)' }
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
