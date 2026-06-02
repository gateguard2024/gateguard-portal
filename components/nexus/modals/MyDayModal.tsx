'use client'

import Link from 'next/link'

const CARD_STYLE = {
  background: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.09)',
  backdropFilter: 'blur(8px)',
}

export function MyDayModal() {
  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-2xl">

      <Link href="/dispatch" className="group rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02]"
        style={{ ...CARD_STYLE, borderColor: 'rgba(107,126,255,0.18)' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(107,126,255,0.18)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="1" y="4" width="12" height="8" rx="1.5" stroke="#6B7EFF" strokeWidth="1.2"/>
              <path d="M4 4V3a3 3 0 016 0v1" stroke="#6B7EFF" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(107,126,255,0.8)' }}>Today</span>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>Work orders</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>View today&apos;s schedule</p>
      </Link>

      <Link href="/todos" className="group rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02]"
        style={CARD_STYLE}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.15)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 7l3 3 7-7" stroke="#34d399" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(52,211,153,0.7)' }}>To-dos</span>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>Open tasks</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Your assigned items</p>
      </Link>

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
