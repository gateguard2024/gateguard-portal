'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

const CARD_STYLE = {
  background: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.09)',
  backdropFilter: 'blur(8px)',
}

export function PeopleModal() {
  const router = useRouter()

  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-2xl">

      <Link href="/accounts" className="group rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02]"
        style={{ ...CARD_STYLE, borderColor: 'rgba(107,126,255,0.18)' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(107,126,255,0.18)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="1.5" y="2" width="11" height="10" rx="1.5" stroke="#6B7EFF" strokeWidth="1.2"/>
              <path d="M1.5 5.5h11" stroke="#6B7EFF" strokeWidth="1.2"/>
              <circle cx="5" cy="8.5" r="1" fill="#6B7EFF"/>
              <circle cx="9" cy="8.5" r="1" fill="#6B7EFF"/>
            </svg>
          </div>
          <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(107,126,255,0.8)' }}>Accounts</span>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>All accounts</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Sites &amp; relationships</p>
      </Link>

      <Link href="/admin/dealers" className="group rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02]"
        style={CARD_STYLE}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.15)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 2L3 4.5V9.5L7 12l4-2.5V4.5L7 2z" stroke="#34d399" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M7 5.5V8.5M5.5 7H8.5" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(52,211,153,0.7)' }}>Network</span>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>Dealers</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Partners &amp; reps</p>
      </Link>

      <button
        onClick={() => router.push('/crm/leads?new=1')}
        className="group rounded-2xl p-4 text-left transition-all duration-200 hover:scale-[1.02]"
        style={CARD_STYLE}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.12)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="6" cy="5" r="2.5" stroke="#fbbf24" strokeWidth="1.2"/>
              <path d="M1 13c0-2.5 2-4 5-4" stroke="#fbbf24" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M11 8v4M9 10h4" stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(251,191,36,0.7)' }}>Add</span>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>Add contact</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>New lead or account</p>
      </button>

    </div>
  )
}
