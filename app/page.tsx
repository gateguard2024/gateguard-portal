'use client'

import { useState, useCallback } from 'react'
import { useUser }          from '@clerk/nextjs'
import { useRouter }        from 'next/navigation'
import { ActionCommandBar } from '@/components/nexus/ActionCommandBar'
import { DynamicModal }     from '@/components/nexus/DynamicModal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActionCardAction {
  label: string
  href?: string
  toolName?: string
  toolArgs?: Record<string, unknown>
}

interface ActionCard {
  hex: string
  tag: string
  urgent?: boolean
  headline: string
  sub?: string
  actions: ActionCardAction[]
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  cardResponse?: {
    title?: string
    cards: ActionCard[]
    proactive?: ActionCard[]
  }
}

// ─── ActionCard sub-components ────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '107,126,255'
}

function ActionCardItem({
  card,
  onExecute,
  onNavigate,
}: {
  card: ActionCard
  onExecute: (toolName: string, toolArgs: Record<string, unknown>) => void
  onNavigate: (href: string) => void
}) {
  const rgb = hexToRgb(card.hex)
  return (
    <div
      className="rounded-2xl p-3.5 flex flex-col gap-2.5"
      style={{
        background:     `rgba(${rgb},0.07)`,
        border:         `1px solid rgba(${rgb},${card.urgent ? 0.4 : 0.2})`,
        backdropFilter: 'blur(16px)',
        boxShadow:      card.urgent ? `0 0 20px rgba(${rgb},0.14)` : 'none',
      }}
    >
      {/* Tag row */}
      <div className="flex items-center gap-1.5">
        {card.urgent && (
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
            style={{ background: card.hex }}
          />
        )}
        <span
          className="text-[9px] uppercase tracking-widest font-mono"
          style={{ color: `rgba(${rgb},0.65)` }}
        >
          {card.tag}
        </span>
      </div>
      {/* Headline */}
      <p className="text-xs font-medium leading-snug" style={{ color: 'rgba(255,255,255,0.9)' }}>
        {card.headline}
      </p>
      {/* Sub */}
      {card.sub && (
        <p className="text-[9px] leading-normal" style={{ color: 'rgba(255,255,255,0.32)' }}>
          {card.sub}
        </p>
      )}
      {/* Actions */}
      <div className="flex gap-1.5 mt-auto flex-wrap">
        {card.actions.map((action, j) => (
          <button
            key={j}
            onClick={() => {
              if (action.href)     onNavigate(action.href)
              else if (action.toolName) onExecute(action.toolName, action.toolArgs ?? {})
            }}
            className="text-[10px] px-2.5 py-1.5 rounded-lg font-medium transition-all flex-shrink-0"
            style={
              j === 0
                ? { background: `rgba(${rgb},0.18)`, border: `0.5px solid rgba(${rgb},0.4)`,  color: card.hex }
                : { background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)' }
            }
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function CardResponseView({
  title,
  cards,
  proactive,
  onExecute,
  onNavigate,
}: {
  title?: string
  cards: ActionCard[]
  proactive?: ActionCard[]
  onExecute: (toolName: string, toolArgs: Record<string, unknown>) => void
  onNavigate: (href: string) => void
}) {
  const displayCards = cards.length > 0 ? cards : (proactive ?? [])
  const isEmpty      = cards.length === 0 && !proactive?.length
  if (isEmpty) return null

  return (
    <div className="space-y-2.5 w-full">
      {title && (
        <p
          className="text-[9px] uppercase tracking-widest font-mono"
          style={{ color: 'rgba(255,255,255,0.28)' }}
        >
          {title}
        </p>
      )}
      <div className={`grid gap-2.5 ${
        displayCards.length === 1
          ? 'grid-cols-1'
          : displayCards.length === 2
          ? 'grid-cols-1 sm:grid-cols-2'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      }`}>
        {displayCards.map((card, i) => (
          <ActionCardItem
            key={i}
            card={card}
            onExecute={onExecute}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  )
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
  const router    = useRouter()
  const firstName = user?.firstName ?? 'there'

  // null = no popup open; string = which tab is expanded
  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [messages,    setMessages]    = useState<ChatMessage[]>([])
  const [isLoading,   setIsLoading]   = useState(false)

  // Navigate from card actions
  const handleNavigate = useCallback((href: string) => {
    router.push(href)
  }, [router])

  // Execute a tool from a card action button
  const executeCardAction = useCallback(async (toolName: string, toolArgs: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/assistant/execute', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ toolName, toolArgs, reasoning: 'User confirmed action via NEXUS action card' }),
      })
      const d = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: d.message ?? `✓ Done — ${toolName.replace(/_/g, ' ')}`,
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Action failed. Please try again.' }])
    }
  }, [])

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

      // ── ActionCards response (operational query) ───────────────────────────
      if (data.type === 'action_cards') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '',
          cardResponse: {
            title:    data.title,
            cards:    data.cards    ?? [],
            proactive: data.proactive,
          },
        }])
        return
      }

      // ── Regular text / pending action response ─────────────────────────────
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response ?? data.message ?? 'Done.',
      }])
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

        {/* Logo block — icon stacked above text */}
        <div className="flex flex-col items-center mb-6 gap-3">
          {/* Geometric crystal icon */}
          <div style={{
            width: 72, height: 72,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            filter: 'drop-shadow(0 0 18px rgba(107,126,255,0.45))',
          }}>
            <svg width="68" height="68" viewBox="0 0 68 68" fill="none" aria-hidden="true">
              {/* Outer octagon */}
              <polygon
                points="34,4 52,12 64,28 64,40 52,56 34,64 16,56 4,40 4,28 16,12"
                stroke="rgba(255,255,255,0.88)" strokeWidth="1.4" fill="none"
              />
              {/* Mid octagon */}
              <polygon
                points="34,14 47,20 56,32 56,36 47,48 34,54 21,48 12,36 12,32 21,20"
                stroke="rgba(107,126,255,0.55)" strokeWidth="1" fill="none"
              />
              {/* Inner ring */}
              <circle cx="34" cy="34" r="9" stroke="rgba(255,255,255,0.35)" strokeWidth="1" fill="none"/>
              {/* Facet lines — top */}
              <line x1="34" y1="4"  x2="34" y2="25" stroke="rgba(255,255,255,0.18)" strokeWidth="1"/>
              {/* Facet lines — bottom */}
              <line x1="34" y1="43" x2="34" y2="64" stroke="rgba(255,255,255,0.18)" strokeWidth="1"/>
              {/* Facet lines — left */}
              <line x1="4"  y1="34" x2="25" y2="34" stroke="rgba(255,255,255,0.18)" strokeWidth="1"/>
              {/* Facet lines — right */}
              <line x1="43" y1="34" x2="64" y2="34" stroke="rgba(255,255,255,0.18)" strokeWidth="1"/>
              {/* Center glow dot */}
              <circle cx="34" cy="34" r="2.5" fill="rgba(107,126,255,0.9)"/>
            </svg>
          </div>

          {/* Text */}
          <div className="text-center">
            <h1
              className="text-4xl font-bold uppercase"
              style={{ color: 'rgba(255,255,255,0.96)', letterSpacing: '0.28em', lineHeight: 1 }}
            >
              NEXUS
            </h1>
            <p
              className="text-xs uppercase"
              style={{ color: 'rgba(107,126,255,0.65)', letterSpacing: '0.22em', marginTop: 4 }}
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
              <div key={i}>
                {m.role === 'user' ? (
                  /* ── User bubble ─────────────────────────────────────────── */
                  <div
                    className="ml-12 text-right rounded-xl px-4 py-3 text-sm leading-relaxed"
                    style={{ background: 'rgba(107,126,255,0.18)', border: '0.5px solid rgba(107,126,255,0.35)', color: 'rgba(255,255,255,0.88)' }}
                  >
                    {m.content}
                  </div>
                ) : m.cardResponse ? (
                  /* ── ActionCards (operational query) ─────────────────────── */
                  <CardResponseView
                    title={m.cardResponse.title}
                    cards={m.cardResponse.cards}
                    proactive={m.cardResponse.proactive}
                    onExecute={executeCardAction}
                    onNavigate={handleNavigate}
                  />
                ) : m.content ? (
                  /* ── Text response (non-operational / tool confirmation) ─── */
                  <div
                    className="mr-12 rounded-xl px-4 py-3 text-sm leading-relaxed"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.72)' }}
                  >
                    {m.content}
                  </div>
                ) : null}
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
