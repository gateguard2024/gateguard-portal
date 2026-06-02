'use client'

import { useState, useCallback } from 'react'
import { useUser }          from '@clerk/nextjs'
import { ActionCommandBar } from '@/components/nexus/ActionCommandBar'
import { DynamicModal }     from '@/components/nexus/DynamicModal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'My Day',         id: 'my-day'  },
  { label: 'Recent Work',    id: 'recent'  },
  { label: 'New Opps/Leads', id: 'opps'    },
  { label: 'Jobs',           id: 'jobs'    },
  { label: 'Field',          id: 'field'   },
  { label: 'People',         id: 'people'  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NexusHome() {
  const { user }  = useUser()
  const firstName = user?.firstName ?? 'there'

  // null = no popup open; string = which tab is expanded
  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [messages,    setMessages]    = useState<ChatMessage[]>([])
  const [isLoading,   setIsLoading]   = useState(false)

  const handleQuery = useCallback(async (query: string) => {
    setActiveModal(null)   // dismiss popup when user types
    const next: ChatMessage[] = [...messages, { role: 'user', content: query }]
    setMessages(next)
    setIsLoading(true)
    try {
      const res  = await fetch('/api/assistant/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: next }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.response ?? data.message ?? 'Done.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally {
      setIsLoading(false)
    }
  }, [messages])

  function toggleModal(id: string) {
    setActiveModal(prev => (prev === id ? null : id))
  }

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: 'radial-gradient(circle at 50% 35%, #0d1f4e 0%, #060e28 38%, #020810 65%, #000306 100%)' }}
    >
      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(107,126,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(107,126,255,0.1) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Center glow orb */}
      <div
        className="absolute pointer-events-none"
        aria-hidden="true"
        style={{
          top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 700, height: 700,
          background: 'radial-gradient(circle, rgba(107,126,255,0.13) 0%, transparent 68%)',
          borderRadius: '50%',
        }}
      />

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-36">

        {/* Logo block */}
        <div className="flex items-center gap-4 mb-6">
          <div style={{
            width: 52, height: 52, borderRadius: 15,
            background: 'linear-gradient(140deg, rgba(107,126,255,0.32) 0%, rgba(107,126,255,0.07) 100%)',
            border: '1px solid rgba(107,126,255,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 28px rgba(107,126,255,0.3)',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 20V4l16 16V4" stroke="#6B7EFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h1
              className="text-4xl font-bold uppercase"
              style={{ color: 'rgba(255,255,255,0.96)', letterSpacing: '0.28em', lineHeight: 1 }}
            >
              NEXUS
            </h1>
            <p
              className="text-xs uppercase"
              style={{ color: 'rgba(107,126,255,0.65)', letterSpacing: '0.22em', marginTop: 3 }}
            >
              by Gate Guard
            </p>
          </div>
        </div>

        {/* Greeting */}
        <p className="text-lg mb-9" style={{ color: 'rgba(255,255,255,0.38)' }}>
          Hi {firstName},{' '}
          <span style={{ color: 'rgba(255,255,255,0.82)' }}>what are we working on today?</span>
        </p>

        {/* Command bar */}
        <ActionCommandBar onSubmit={handleQuery} isLoading={isLoading} />

        {/* Chat thread — visible when Nexus has responded */}
        {messages.length > 0 && (
          <div className="w-full max-w-2xl mt-8 space-y-3">
            <button
              onClick={() => setMessages([])}
              className="text-xs transition-colors"
              style={{ color: 'rgba(255,255,255,0.22)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.22)')}
            >
              ← Clear
            </button>
            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === 'user' ? 'ml-12 text-right' : 'mr-12'
                }`}
                style={
                  m.role === 'user'
                    ? { background: 'rgba(107,126,255,0.18)', border: '0.5px solid rgba(107,126,255,0.35)', color: 'rgba(255,255,255,0.88)' }
                    : { background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.72)' }
                }
              >
                {m.content}
              </div>
            ))}
          </div>
        )}

        {/* Idle hint */}
        {messages.length === 0 && (
          <p
            className="mt-10 text-xs uppercase tracking-widest"
            style={{ color: 'rgba(255,255,255,0.1)' }}
          >
            Tap a tab below to browse quick actions
          </p>
        )}
      </main>

      {/* ── Bottom nav ────────────────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 px-4 py-4 flex justify-center gap-2 bg-black/55 backdrop-blur-xl border-t border-white/5">
        {NAV_ITEMS.map(({ label, id }) => {
          const active = activeModal === id
          return (
            <button
              key={id}
              onClick={() => toggleModal(id)}
              className="px-5 py-2 rounded-full text-sm border transition-all duration-200"
              style={
                active
                  ? {
                      background: 'linear-gradient(135deg, rgba(107,126,255,0.28) 0%, rgba(107,126,255,0.1) 100%)',
                      border:     '1px solid rgba(107,126,255,0.55)',
                      color:      '#a5b4ff',
                      boxShadow:  '0 0 16px rgba(107,126,255,0.25)',
                    }
                  : {
                      background: 'transparent',
                      border:     '0.5px solid rgba(255,255,255,0.07)',
                      color:      'rgba(255,255,255,0.3)',
                    }
              }
            >
              {label}
            </button>
          )
        })}
      </nav>

      {/* ── Popup modal ───────────────────────────────────────────────────────── */}
      {activeModal && (
        <DynamicModal
          type={activeModal}
          label={NAV_ITEMS.find(n => n.id === activeModal)?.label ?? ''}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  )
}
