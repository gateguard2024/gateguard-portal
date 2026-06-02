'use client'

import Link from 'next/link'

const CARD_STYLE = {
  background: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.09)',
  backdropFilter: 'blur(8px)',
}

export function FieldModal() {
  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-2xl">

      <Link href="/dispatch" className="group rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02]"
        style={{ ...CARD_STYLE, borderColor: 'rgba(107,126,255,0.18)' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(107,126,255,0.18)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2.5 2h9a1 1 0 011 1v8a1 1 0 01-1 1h-9a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="#6B7EFF" strokeWidth="1.2"/>
              <path d="M4 5.5h6M4 8h4" stroke="#6B7EFF" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(107,126,255,0.8)' }}>Dispatch</span>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>Work orders</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Active field jobs</p>
      </Link>

      <Link href="/tech" className="group rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02]"
        style={CARD_STYLE}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.15)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 2L2.5 5v7h9V5L7 2z" stroke="#34d399" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M5 12V8.5h4V12" stroke="#34d399" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(52,211,153,0.7)' }}>Tech tool</span>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>Field access</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Wiring, KB, diagnostics</p>
      </Link>

      <Link href="/aria" className="group rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02]"
        style={CARD_STYLE}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.15)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="2.5" stroke="#a855f7" strokeWidth="1.2"/>
              <path d="M7 1.5V3M7 11v1.5M1.5 7H3M11 7h1.5M3.5 3.5l1 1M9.5 9.5l1 1M10.5 3.5l-1 1M4.5 9.5l-1 1" stroke="#a855f7" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(168,85,247,0.8)' }}>ARIA</span>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>Site intel</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Research a property</p>
      </Link>

    </div>
  )
}
