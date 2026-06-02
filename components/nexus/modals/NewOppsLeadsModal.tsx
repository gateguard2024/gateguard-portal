'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

const CARD_STYLE = {
  background: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.09)',
  backdropFilter: 'blur(8px)',
}

export function NewOppsLeadsModal() {
  const router = useRouter()

  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-2xl">

      {/* Create Lead */}
      <button
        onClick={() => router.push('/crm/leads')}
        className="group rounded-2xl p-4 text-left transition-all duration-200 hover:scale-[1.02]"
        style={{ ...CARD_STYLE, borderColor: 'rgba(107,126,255,0.22)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(107,126,255,0.2)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="5" r="2.5" stroke="#6B7EFF" strokeWidth="1.2"/>
              <path d="M1.5 13c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" stroke="#6B7EFF" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M11 2v3M9.5 3.5h3" stroke="#6B7EFF" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(107,126,255,0.9)' }}>Lead</span>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>Create new lead</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Name, property, contact</p>
      </button>

      {/* Create Opportunity */}
      <button
        onClick={() => router.push('/crm/opportunities')}
        className="group rounded-2xl p-4 text-left transition-all duration-200 hover:scale-[1.02]"
        style={{ ...CARD_STYLE, borderColor: 'rgba(52,211,153,0.18)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.15)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="5.5" stroke="#34d399" strokeWidth="1.2"/>
              <path d="M7 4v3l2 2" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(52,211,153,0.8)' }}>Opportunity</span>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>Create opportunity</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Property, stage, value</p>
      </button>

      {/* View Pipeline */}
      <Link
        href="/crm"
        className="group rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02]"
        style={CARD_STYLE}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.12)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="1" y="3" width="2.5" height="8" rx="1" fill="#fbbf24"/>
              <rect x="5.5" y="5" width="2.5" height="6" rx="1" fill="#fbbf24"/>
              <rect x="10" y="1" width="2.5" height="10" rx="1" fill="#fbbf24"/>
            </svg>
          </div>
          <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(251,191,36,0.7)' }}>List</span>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>View leads &amp; opps</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Filters, search, insights</p>
      </Link>

    </div>
  )
}
