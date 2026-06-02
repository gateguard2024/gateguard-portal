'use client'

import { useState, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { ActionCommandBar }  from '@/components/nexus/ActionCommandBar'
import { DynamicModal }      from '@/components/nexus/DynamicModal'
import type { TabId }        from '@/components/nexus/DynamicModal'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ─── Nav definition ───────────────────────────────────────────────────────────

const NAV_TABS: { id: TabId; label: string; badge?: number }[] = [
  { id: 'my-day',  label: 'My Day' },
  { id: 'recent',  label: 'Recent Work' },
  { id: 'opps',    label: 'New Opps/Leads', badge: 3 },
  { id: 'jobs',    label: 'Jobs' },
  { id: 'field',   label: 'Field' },
  { id: 'people',  label: 'People' },
]

// ─── Logo SVG ─────────────────────────────────────────────────────────────────

function NexusLogoMark() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {/* Outer hexagon */}
      <polygon
        points="32,4 56,18 56,46 32,60 8,46 8,18"
        fill="rgba(13,33,80,0.85)"
        stroke="rgba(107,126,255,0.55)"
        strokeWidth="1.5"
      />
      {/* Inner hexagon */}
      <polygon
        points="32,14 48,23 48,41 32,50 16,41 16,23"
        fill="none"
        stroke="rgba(107,126,255,0.25)"
        strokeWidth="1"
      />
      {/* Spoke lines */}
      <line x1="32" y1="4"  x2="32" y2="14" stroke="rgba(107,126,255,0.4)" strokeWidth="1"/>
      <line x1="56" y1="18" x2="48" y2="23" stroke="rgba(107,126,255,0.4)" strokeWidth="1"/>
      <line x1="56" y1="46" x2="48" y2="41" stroke="rgba(107,126,255,0.4)" strokeWidth="1"/>
      <line x1="32" y1="60" x2="32" y2="50" stroke="rgba(107,126,255,0.4)" strokeWidth="1"/>
      <line x1="8"  y1="46" x2="16" y2="41" stroke="rgba(107,126,255,0.4)" strokeWidth="1"/>
      <line x1="8"  y1="18" x2="16" y2="23" stroke="rgba(107,126,255,0.4)" strokeWidth="1"/>
      {/* Center dot */}
      <circle cx="32" cy="32" r="4" fill="#6B7EFF" opacity="0.9"/>
      <circle cx="32" cy="32" r="8" fill="none" stroke="rgba(107,126,255,0.3)" strokeWidth="1"/>
    </svg>
  )
}

// ─── Inline chat response area ────────────────────────────────────────────────

function ChatThread({
  messages,
  onClear,
}: {
  messages: ChatMessage[]
  onClear: () => void
}) {
  return (
    <div className="w-full max-w-2xl space-y-3">
      {messages.map((m, i) => (
        <div
          key={i}
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            m.role === 'user'
              ? 'ml-8 text-right'
              : 'mr-8'
          }`}
          style={
            m.role === 'user'
              ? {
                  background: 'rgba(107,126,255,0.18)',
                  border: '0.5px solid rgba(107,126,255,0.35)',
                  color: 'rgba(255,255,255,0.85)',
                }
              : {
                  background: 'rgba(255,255,255,0.04)',
                  border: '0.5px solid rgba(255,255,255,0.09)',
                  color: 'rgba(255,255,255,0.8)',
                  backdropFilter: 'blur(8px)',
                }
          }
        >
          {m.content}
        </div>
      ))}
      <div className="flex justify-center pt-2">
        <button
          onClick={onClear}
          className="text-xs transition-colors"
          style={{ color: 'rgba(255,255,255,0.25)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
        >
          ← Back to quick picks
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NexusHome() {
  const { user } = useUser()
  const firstName = user?.firstName ?? 'there'
  const initials  = (
    (user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? 'U')
  ).toUpperCase()

  const [activeTab,  setActiveTab]  = useState<TabId>('my-day')
  const [messages,   setMessages]   = useState<ChatMessage[]>([])
  const [isLoading,  setIsLoading]  = useState(false)

  const handleQuery = useCallback(async (query: string) => {
    const next: ChatMessage[] = [...messages, { role: 'user', content: query }]
    setMessages(next)
    setIsLoading(true)

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const data = await res.json()
      const reply = data.response ?? data.message ?? 'Done.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Please try again.' },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [messages])

  const clearChat = useCallback(() => setMessages([]), [])

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 40%, #0d2150 0%, #060e28 40%, #020810 70%, #000306 100%)',
      }}
    >

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(107,126,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(107,126,255,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Minimal top chrome */}
      <header
        className="relative z-10 flex justify-between items-center px-6 py-4"
        style={{ borderBottom: '0.5px solid rgba(107,126,255,0.1)' }}
      >
        <span
          className="text-xs tracking-[0.14em] uppercase"
          style={{ color: 'rgba(255,255,255,0.15)' }}
        >
          portal.gateguard.co
        </span>
        <div className="flex items-center gap-4">
          {/* Bell */}
          <button
            aria-label="Notifications"
            style={{ color: 'rgba(255,255,255,0.22)' }}
            className="transition-colors hover:text-white/50"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2a5 5 0 00-5 5v3l-1 1.5h12L13 10V7a5 5 0 00-5-5z"
                stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M6.5 13.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
          {/* Avatar */}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium"
            style={{
              background: 'rgba(13,33,80,0.9)',
              border: '1px solid rgba(107,126,255,0.35)',
              color: '#6B7EFF',
            }}
          >
            {initials}
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-28 pt-4">

        {/* Logo + branding */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <NexusLogoMark />
          </div>
          <h1
            className="text-4xl font-bold text-white mb-1"
            style={{ letterSpacing: '0.22em', textTransform: 'uppercase' }}
          >
            Nexus
          </h1>
          <p
            className="text-xs"
            style={{ color: 'rgba(107,126,255,0.65)', letterSpacing: '0.2em', textTransform: 'uppercase' }}
          >
            by Gate Guard
          </p>
        </div>

        {/* Greeting */}
        <p
          className="text-lg mb-7 text-center"
          style={{ color: 'rgba(255,255,255,0.45)' }}
        >
          Hi {firstName},{' '}
          <span style={{ color: 'rgba(255,255,255,0.8)' }}>
            what are we working on today?
          </span>
        </p>

        {/* NL command bar */}
        <ActionCommandBar onSubmit={handleQuery} isLoading={isLoading} />

        {/* Content area — chat thread or quick picks */}
        <div className="w-full flex flex-col items-center mt-8">
          {messages.length > 0 ? (
            <>
              <p
                className="text-xs tracking-[0.14em] uppercase mb-4"
                style={{ color: 'rgba(255,255,255,0.18)' }}
              >
                Nexus
              </p>
              <ChatThread messages={messages} onClear={clearChat} />
            </>
          ) : (
            <>
              <p
                className="text-xs tracking-[0.14em] uppercase mb-4"
                style={{ color: 'rgba(255,255,255,0.18)' }}
              >
                Quick picks —{' '}
                {NAV_TABS.find(t => t.id === activeTab)?.label}
              </p>
              <DynamicModal activeTab={activeTab} />
            </>
          )}
        </div>

      </main>

      {/* ── Bottom nav ───────────────────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-20"
        style={{
          background:
            'linear-gradient(to top, rgba(2,8,16,0.98) 0%, rgba(2,8,16,0.82) 100%)',
          backdropFilter: 'blur(16px)',
          borderTop: '0.5px solid rgba(107,126,255,0.1)',
        }}
      >
        <div className="flex justify-center gap-2 px-4 py-3 overflow-x-auto scrollbar-none">
          {NAV_TABS.map(tab => {
            const isActive = activeTab === tab.id && messages.length === 0
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); clearChat() }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all duration-200"
                style={
                  isActive
                    ? {
                        background: 'rgba(107,126,255,0.2)',
                        border: '1px solid rgba(107,126,255,0.45)',
                        color: '#93a3ff',
                      }
                    : {
                        background: 'transparent',
                        border: '0.5px solid rgba(255,255,255,0.07)',
                        color: 'rgba(255,255,255,0.3)',
                      }
                }
              >
                {tab.label}
                {tab.badge != null && (
                  <span
                    className="rounded-full text-xs font-medium leading-none"
                    style={{
                      background: '#6B7EFF',
                      color: 'white',
                      padding: '2px 6px',
                      fontSize: '10px',
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>

    </div>
  )
}
