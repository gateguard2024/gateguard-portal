'use client'

import Link from 'next/link'

const CARD_STYLE = {
  background: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.09)',
  backdropFilter: 'blur(8px)',
}

export function RecentWorkModal() {
  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-2xl">

      <Link href="/quotes" className="group rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02]"
        style={CARD_STYLE}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(107,126,255,0.18)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2.5 2h9a1 1 0 011 1v8a1 1 0 01-1 1h-9a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="#6B7EFF" strokeWidth="1.2"/>
              <path d="M4 5h6M4 7.5h4M4 10h3" stroke="#6B7EFF" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(107,126,255,0.8)' }}>Quotes</span>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>Recent quotes</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>View & edit pipeline</p>
      </Link>

      <Link href="/dispatch" className="group rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02]"
        style={CARD_STYLE}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.15)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 11L5 8l3 2 4-5" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(52,211,153,0.7)' }}>Field</span>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>Work orders</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Completed &amp; active</p>
      </Link>

      <Link href="/crm" className="group rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02]"
        style={CARD_STYLE}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.15)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="5" r="2.5" stroke="#a855f7" strokeWidth="1.2"/>
              <path d="M1.5 13c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" stroke="#a855f7" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(168,85,247,0.8)' }}>Activity</span>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>CRM activity</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Calls, emails, notes</p>
      </Link>

    </div>
  )
}
