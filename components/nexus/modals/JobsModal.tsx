'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

const CARD_STYLE = {
  background: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.09)',
  backdropFilter: 'blur(8px)',
}

export function JobsModal() {
  const router = useRouter()

  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-2xl">

      <Link href="/projects" className="group rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02]"
        style={{ ...CARD_STYLE, borderColor: 'rgba(107,126,255,0.18)' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(107,126,255,0.18)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 2h4v4H2zM8 2h4v4H8zM2 8h4v4H2zM8 8h4v4H8z" stroke="#6B7EFF" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(107,126,255,0.8)' }}>Board</span>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>Active jobs</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Install, service, convert</p>
      </Link>

      <button
        onClick={() => router.push('/projects?new=1')}
        className="group rounded-2xl p-4 text-left transition-all duration-200 hover:scale-[1.02]"
        style={CARD_STYLE}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.15)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 2v10M2 7h10" stroke="#34d399" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(52,211,153,0.7)' }}>New</span>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>Create job</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>From won opportunity</p>
      </button>

      <Link href="/dispatch" className="group rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02]"
        style={CARD_STYLE}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.12)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="5.5" stroke="#fbbf24" strokeWidth="1.2"/>
              <circle cx="7" cy="7" r="2" stroke="#fbbf24" strokeWidth="1.2"/>
              <path d="M7 1.5V3M7 11v1.5M1.5 7H3M11 7h1.5" stroke="#fbbf24" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(251,191,36,0.7)' }}>Dispatch</span>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>Work orders</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Schedule &amp; assign techs</p>
      </Link>

    </div>
  )
}
