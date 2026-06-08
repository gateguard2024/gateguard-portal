'use client'

import { useEffect }         from 'react'
import { MyDayModal }        from '@/components/nexus/modals/MyDayModal'
import { RecentWorkModal }   from '@/components/nexus/modals/RecentWorkModal'
import { NewOppsLeadsModal } from '@/components/nexus/modals/NewOppsLeadsModal'
import { JobsModal }         from '@/components/nexus/modals/JobsModal'
import { FieldModal }        from '@/components/nexus/modals/FieldModal'
import { PeopleModal }       from '@/components/nexus/modals/PeopleModal'

// TabId still exported for any callers that need it
export type TabId = 'my-day' | 'recent' | 'opps' | 'jobs' | 'field' | 'people'

interface Props {
  type:     string
  label:    string
  onClose:  () => void
}

function ModalContent({ type }: { type: string }) {
  switch (type) {
    case 'my-day':  return <MyDayModal />
    case 'recent':  return <RecentWorkModal />
    case 'opps':    return <NewOppsLeadsModal />
    case 'jobs':    return <JobsModal />
    case 'field':   return <FieldModal />
    case 'people':  return <PeopleModal />
    default:        return <MyDayModal />
  }
}

export function DynamicModal({ type, label, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Prevent background scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <>
      {/* Dimmed backdrop — click to close */}
      <div
        className="fixed inset-0 z-30 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — anchored just above the bottom nav bar (76px tall) */}
      <div
        className="fixed bottom-[76px] left-0 right-0 z-40 flex justify-center px-4 pb-2"
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        <div
          className="w-full max-w-2xl rounded-2xl p-5 max-h-[calc(100vh-76px-24px)] overflow-y-auto overscroll-contain"
          style={{
            background:    'rgba(6, 12, 32, 0.94)',
            border:        '1px solid rgba(107,126,255,0.22)',
            backdropFilter: 'blur(28px)',
            boxShadow:     '0 -8px 48px rgba(107,126,255,0.14), 0 0 0 0.5px rgba(107,126,255,0.08)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header row */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p
                className="text-xs uppercase tracking-[0.14em] mb-0.5"
                style={{ color: 'rgba(107,126,255,0.55)' }}
              >
                Quick actions
              </p>
              <h2 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>
                {label}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{
                background: 'rgba(255,255,255,0.05)',
                color:      'rgba(255,255,255,0.35)',
                border:     '0.5px solid rgba(255,255,255,0.08)',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
              aria-label="Close"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <ModalContent type={type} />
        </div>
      </div>
    </>
  )
}
