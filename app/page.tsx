'use client'

import { useState, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { ActionCommandBar } from '@/components/nexus/ActionCommandBar'
import { DynamicModal } from '@/components/nexus/DynamicModal'
import type { TabId } from '@/components/nexus/DynamicModal'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface RevertPayload {
  operation: 'delete' | 'update'
  table: string
  id: string
  data?: Record<string, unknown>
}

interface PendingAction {
  toolName: string
  toolArgs: Record<string, unknown>
  reasoning: string
  riskLevel: 'medium' | 'high'
  summary: string
}

interface LastLowRiskAction {
  toolName: string
  summary: string
  reasoning: string
  revertPayload?: RevertPayload
}

interface AssistantResponse {
  response?: string | null
  message?: string
  pendingAction?: PendingAction
  lastLowRiskAction?: LastLowRiskAction | null
}

const NAV_TABS: { id: TabId; label: string; badge?: number }[] = [
  { id: 'my-day', label: 'My Day' },
  { id: 'recent', label: 'Recent Work' },
  { id: 'opps', label: 'New Opps/Leads', badge: 3 },
  { id: 'jobs', label: 'Jobs' },
  { id: 'field', label: 'Field' },
  { id: 'people', label: 'People' },
]

const GLASS_PANEL =
  'bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.28)]'

function inferTabFromQuery(query: string): TabId | null {
  const q = query.toLowerCase()
  if (q.includes('lead') || q.includes('opportunit') || q.includes('pipeline') || q.includes('crm')) return 'opps'
  if (q.includes('job') || q.includes('project')) return 'jobs'
  if (q.includes('tech') || q.includes('field') || q.includes('dispatch') || q.includes('work order')) return 'field'
  if (q.includes('person') || q.includes('people') || q.includes('rep') || q.includes('user')) return 'people'
  if (q.includes('recent') || q.includes('last')) return 'recent'
  if (q.includes('today') || q.includes('day') || q.includes('todo')) return 'my-day'
  return null
}

function NexusLogoMark() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <polygon
        points="32,4 56,18 56,46 32,60 8,46 8,18"
        fill="rgba(13,33,80,0.85)"
        stroke="rgba(107,126,255,0.55)"
        strokeWidth="1.5"
      />
      <polygon
        points="32,14 48,23 48,41 32,50 16,41 16,23"
        fill="none"
        stroke="rgba(107,126,255,0.25)"
        strokeWidth="1"
      />
      <line x1="32" y1="4" x2="32" y2="14" stroke="rgba(107,126,255,0.4)" strokeWidth="1" />
      <line x1="56" y1="18" x2="48" y2="23" stroke="rgba(107,126,255,0.4)" strokeWidth="1" />
      <line x1="56" y1="46" x2="48" y2="41" stroke="rgba(107,126,255,0.4)" strokeWidth="1" />
      <line x1="32" y1="60" x2="32" y2="50" stroke="rgba(107,126,255,0.4)" strokeWidth="1" />
      <line x1="8" y1="46" x2="16" y2="41" stroke="rgba(107,126,255,0.4)" strokeWidth="1" />
      <line x1="8" y1="18" x2="16" y2="23" stroke="rgba(107,126,255,0.4)" strokeWidth="1" />
      <circle cx="32" cy="32" r="4" fill="#6B7EFF" opacity="0.9" />
      <circle cx="32" cy="32" r="8" fill="none" stroke="rgba(107,126,255,0.3)" strokeWidth="1" />
    </svg>
  )
}

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
          key={`${m.role}-${i}`}
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            m.role === 'user' ? 'ml-8 text-right' : 'mr-8'
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
          className="text-xs text-white/25 transition-colors hover:text-white/50"
        >
          Back to quick picks
        </button>
      </div>
    </div>
  )
}

function PendingActionCard({
  action,
  isExecuting,
  onExecute,
  onSkip,
}: {
  action: PendingAction
  isExecuting: boolean
  onExecute: () => void
  onSkip: () => void
}) {
  const isHigh = action.riskLevel === 'high'
  const accent = isHigh ? '#D97706' : '#6B7EFF'

  return (
    <div
      className="w-full max-w-2xl rounded-3xl p-4"
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: `1px solid ${isHigh ? 'rgba(217,119,6,0.42)' : 'rgba(107,126,255,0.38)'}`,
        boxShadow: `0 18px 60px ${isHigh ? 'rgba(217,119,6,0.12)' : 'rgba(107,126,255,0.14)'}`,
        backdropFilter: 'blur(18px)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: accent, boxShadow: `0 0 16px ${accent}` }}
            />
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
              {isHigh ? 'High risk confirmation' : 'Confirm action'}
            </span>
          </div>
          <p className="text-sm font-semibold text-white/90">{action.summary}</p>
          {action.reasoning && (
            <p className="mt-1 text-xs italic leading-relaxed text-white/40">{action.reasoning}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onSkip}
            disabled={isExecuting}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/45 transition hover:border-white/20 hover:text-white/70 disabled:opacity-50"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={onExecute}
            disabled={isExecuting}
            className="rounded-full px-4 py-1.5 text-xs font-semibold text-white transition disabled:opacity-60"
            style={{ background: accent }}
          >
            {isExecuting ? 'Executing...' : 'Execute'}
          </button>
        </div>
      </div>
    </div>
  )
}

function UndoStrip({
  action,
  isReverting,
  onUndo,
  onDismiss,
}: {
  action: LastLowRiskAction
  isReverting: boolean
  onUndo: () => void
  onDismiss: () => void
}) {
  return (
    <div className="flex w-full max-w-2xl items-center justify-between gap-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs text-amber-100/80 backdrop-blur-xl">
      <span className="truncate">{action.summary}</span>
      <div className="flex shrink-0 items-center gap-3">
        {action.revertPayload && (
          <button
            type="button"
            onClick={onUndo}
            disabled={isReverting}
            className="font-semibold text-amber-100 transition hover:text-white disabled:opacity-60"
          >
            {isReverting ? 'Undoing...' : 'Undo'}
          </button>
        )}
        <button type="button" onClick={onDismiss} className="text-amber-100/45 transition hover:text-white">
          Dismiss
        </button>
      </div>
    </div>
  )
}

export default function NexusHome() {
  const { user } = useUser()
  const firstName = user?.firstName ?? 'there'
  const initials = ((user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? 'U')).toUpperCase()
  
  const [activeTab, setActiveTab] = useState<TabId>('my-day')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [lastLowRiskAction, setLastLowRiskAction] = useState<LastLowRiskAction | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isReverting, setIsReverting] = useState(false)

  const clearChat = useCallback(() => {
    setMessages([])
    setPendingAction(null)
    setLastLowRiskAction(null)
  }, [])

  const handleQuery = useCallback(async (query: string) => {
    const inferredTab = inferTabFromQuery(query)
    if (inferredTab) setActiveTab(inferredTab)

    const next: ChatMessage[] = [...messages, { role: 'user', content: query }]
    setMessages(next)
    setPendingAction(null)
    setLastLowRiskAction(null)
    setIsLoading(true)

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next,
          currentPage: '/',
          userName: user?.firstName ?? user?.fullName ?? undefined,
        }),
      })
      const data = (await res.json()) as AssistantResponse

      if (!res.ok) throw new Error(data.message ?? 'Assistant unavailable')

      const reply =
        data.response ??
        data.message ??
        (data.pendingAction ? 'I prepared an action for your approval.' : 'Done.')

      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      setPendingAction(data.pendingAction ?? null)
      setLastLowRiskAction(data.lastLowRiskAction ?? null)
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Please try again.' },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [messages, user?.firstName, user?.fullName])

  const executePendingAction = useCallback(async () => {
    if (!pendingAction) return
    setIsExecuting(true)
    try {
      const res = await fetch('/api/assistant/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: pendingAction.toolName,
          toolArgs: pendingAction.toolArgs,
        }),
      })
      const data = await res.json() as {
        success?: boolean
        message?: string
        error?: string
        revertPayload?: RevertPayload
      }

      if (!res.ok || data.success === false) throw new Error(data.error ?? 'Action failed')

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.message ?? `${pendingAction.summary} completed.` },
      ])
      if (data.revertPayload) {
        setLastLowRiskAction({
          toolName: pendingAction.toolName,
          summary: pendingAction.summary,
          reasoning: pendingAction.reasoning,
          revertPayload: data.revertPayload,
        })
      }
      setPendingAction(null)
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'I could not complete that action. Please try again.' },
      ])
    } finally {
      setIsExecuting(false)
    }
  }, [pendingAction])

  const revertLastAction = useCallback(async () => {
    if (!lastLowRiskAction?.revertPayload) return
    setIsReverting(true)
    try {
      const res = await fetch('/api/assistant/revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revertPayload: lastLowRiskAction.revertPayload }),
      })
      if (!res.ok) throw new Error('Revert failed')
      setMessages(prev => [...prev, { role: 'assistant', content: 'Undone.' }])
      setLastLowRiskAction(null)
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'I could not undo that action. Please review it manually.' },
      ])
    } finally {
      setIsReverting(false)
    }
  }, [lastLowRiskAction])

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 40%, #0d2150 0%, #060e28 40%, #020810 70%, #000306 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(107,126,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(107,126,255,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <header
        className="relative z-10 flex items-center justify-between px-6 py-4"
        style={{ borderBottom: '0.5px solid rgba(107,126,255,0.1)' }}
      >
        <span className="text-xs uppercase tracking-[0.14em] text-white/15">portal.gateguard.co</span>
        <div className="flex items-center gap-4">
          <button aria-label="Notifications" className="text-white/25 transition hover:text-white/50">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M8 2a5 5 0 00-5 5v3l-1 1.5h12L13 10V7a5 5 0 00-5-5z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              <path d="M6.5 13.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium"
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

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-28 pt-6">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <NexusLogoMark />
          </div>
          <h1 className="mb-1 text-4xl font-bold uppercase tracking-[0.22em] text-white">Nexus</h1>
          <p className="text-xs uppercase tracking-[0.2em] text-[#6B7EFF]/65">by Gate Guard</p>
        </div>

        <p className="mb-7 text-center text-lg text-white/45">
          Hi {firstName}, <span className="text-white/80">what are we working on today?</span>
        </p>

        <ActionCommandBar onSubmit={handleQuery} isLoading={isLoading || isExecuting || isReverting} />

        <div className="mt-8 flex w-full flex-col items-center gap-4">
          {messages.length > 0 ? (
            <>
              <p className="text-xs uppercase tracking-[0.14em] text-white/20">Nexus</p>
              <ChatThread messages={messages} onClear={clearChat} />
              {pendingAction && (
                <PendingActionCard
                  action={pendingAction}
                  isExecuting={isExecuting}
                  onExecute={executePendingAction}
                  onSkip={() => setPendingAction(null)}
                />
              )}
              {lastLowRiskAction && (
                <UndoStrip
                  action={lastLowRiskAction}
                  isReverting={isReverting}
                  onUndo={revertLastAction}
                  onDismiss={() => setLastLowRiskAction(null)}
                />
              )}
            </>
          ) : (
            <>
              <p className="text-xs uppercase tracking-[0.14em] text-white/20">
                Quick picks - {NAV_TABS.find(tab => tab.id === activeTab)?.label}
              </p>
              <div className={`w-full max-w-4xl p-5 ${GLASS_PANEL}`}>
            <DynamicModal activeTab={activeTab} />
              </div>
            </>
          )}
        </div>
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-20"
        style={{
          background:
            'linear-gradient(to top, rgba(2,8,16,0.98) 0%, rgba(2,8,16,0.82) 100%)',
          backdropFilter: 'blur(16px)',
          borderTop: '0.5px solid rgba(107,126,255,0.1)',
        }}
      >
        <div className="scrollbar-none flex justify-center gap-2 overflow-x-auto px-4 py-3">
          {NAV_TABS.map(tab => {
            const isActive = activeTab === tab.id && messages.length === 0
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id)
                  clearChat()
                }}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm transition-all duration-200"
                style={
                  isActive
                    ? {
                        background: 'rgba(107,126,255,0.14)',
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
