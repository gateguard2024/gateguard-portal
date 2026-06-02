'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const CARD_STYLE = {
  background: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.09)',
  backdropFilter: 'blur(8px)',
}

// Stages that count as "needs action"
const ACTIONABLE = new Set([
  'new', 'contacted', 'qualified', 'prospect',
  'aria_draft', 'survey_requested', 'proposal_sent', 'negotiation', 'won',
])

export function NewOppsLeadsModal() {
  const router = useRouter()
  const [needsAction, setNeedsAction] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/crm/leads').then(r => r.json()).catch(() => ({ records: [] })),
      fetch('/api/crm/opportunities').then(r => r.json()).catch(() => ({ records: [] })),
    ]).then(([leadsData, oppsData]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const leads = leadsData.records ?? leadsData.leads ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opps  = oppsData.records ?? oppsData.opportunities ?? []
      const count = [...leads, ...opps].filter((item: any) => ACTIONABLE.has(item.stage ?? '')).length
      setNeedsAction(count)
    })
  }, [])

  return (
    <div className="grid grid-cols-3 gap-3 w-full">

      {/* Action center — hero card */}
      <button
        onClick={() => router.push('/opps')}
        className="col-span-1 group rounded-2xl p-4 text-left transition-all duration-200 hover:scale-[1.02]"
        style={{ ...CARD_STYLE, borderColor: 'rgba(107,126,255,0.3)', background: 'rgba(107,126,255,0.08)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(107,126,255,0.22)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1L8.2 5.5H13L9.5 8L11 13L7 10L3 13L4.5 8L1 5.5H5.8L7 1Z" fill="#6B7EFF"/>
            </svg>
          </div>
          {needsAction !== null && needsAction > 0 && (
            <span className="text-xs font-semibold rounded-full px-2 py-0.5" style={{ background: '#6B7EFF', color: '#fff' }}>
              {needsAction} action{needsAction !== 1 ? 's' : ''}
            </span>
          )}
          {needsAction === 0 && (
            <span className="text-xs rounded-full px-2 py-0.5" style={{ background: 'rgba(52,211,153,0.15)', color: '#6ee7b7' }}>
              All clear
            </span>
          )}
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.9)' }}>Action center</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Next best actions</p>
      </button>

      {/* Create Lead */}
      <button
        onClick={() => router.push('/crm/leads')}
        className="group rounded-2xl p-4 text-left transition-all duration-200 hover:scale-[1.02]"
        style={CARD_STYLE}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.15)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="5" r="2.5" stroke="#34d399" strokeWidth="1.2"/>
              <path d="M1.5 13c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M11 2v3M9.5 3.5h3" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(52,211,153,0.7)' }}>Lead</span>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>Create new lead</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Name, property, contact</p>
      </button>

      {/* Run ARIA */}
      <button
        onClick={() => router.push('/aria')}
        className="group rounded-2xl p-4 text-left transition-all duration-200 hover:scale-[1.02]"
        style={CARD_STYLE}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.15)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="5.5" stroke="#a855f7" strokeWidth="1.2"/>
              <path d="M7 4v3l2 1.5" stroke="#a855f7" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(168,85,247,0.8)' }}>ARIA</span>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>Find properties</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Run lead intelligence</p>
      </button>

    </div>
  )
}
