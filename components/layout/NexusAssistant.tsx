'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { X, Send, Loader2, ChevronDown, AlertCircle, Clock, FileText } from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Sparkles, BrainCircuit, Bell, ToggleLeft, ToggleRight, RefreshCcw } = require('lucide-react') as any

// ─── Types ──────────────────────────────────────────────────────────────────
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  actionConfirmed?: 'todo' | 'todo_completed' | 'work_order' | null
}

interface Alert {
  type: 'todo' | 'quote' | 'wo' | 'scout'
  label: string
  count: number
  href: string
  icon: 'todo' | 'quote' | 'wo' | 'scout'
}

interface PendingAction {
  toolName: string
  toolArgs: Record<string, unknown>
  reasoning: string
  riskLevel: 'medium' | 'high'
  summary: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface UndoState {
  summary: string
  revertPayload: Record<string, unknown>
  countdown: number
}

interface LastLowRiskAction {
  summary: string
  reasoning: string
  revertPayload: Record<string, unknown>
}

// ─── Quick prompt chips ──────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  "What's overdue today?",
  "Show open quotes",
  "Any urgent work orders?",
  "My open leads",
]

// ─── Action quick prompt chips (shown after first message) ───────────────────
const ACTION_PROMPTS = [
  { label: '📝 Add to-do', prompt: 'Create a to-do: ' },
  { label: '🔧 New work order', prompt: 'Create a work order: ' },
  { label: '💰 New lead', prompt: 'Create a new lead: ' },
  { label: '🎯 New opportunity', prompt: 'Create an opportunity: ' },
]

// ─── Alert icon map ──────────────────────────────────────────────────────────
function AlertIcon({ type }: { type: string }) {
  if (type === 'todo')  return <Clock size={12} className="text-amber-500 shrink-0" />
  if (type === 'quote') return <FileText size={12} className="text-blue-500 shrink-0" />
  return <AlertCircle size={12} className="text-red-500 shrink-0" />
}

// ─── Render assistant message with deep links ────────────────────────────────
function AssistantMessage({ content }: { content: string }) {
  // Convert markdown links [text](href) to <a> tags
  const parts = content.split(/(\[([^\]]+)\]\(([^)]+)\))/g)
  const elements: React.ReactNode[] = []
  let i = 0
  while (i < parts.length) {
    const part = parts[i]
    if (part && part.startsWith('[') && i + 2 < parts.length) {
      const text = parts[i + 1]
      const href = parts[i + 2]
      elements.push(
        <a key={i} href={href} className="text-[#6B7EFF] underline underline-offset-2 hover:text-[#5a6ee0]">
          {text}
        </a>
      )
      i += 3
    } else {
      // Split by newlines and bullet points
      const lines = part.split('\n')
      lines.forEach((line, li) => {
        if (line.startsWith('- ') || line.startsWith('• ')) {
          elements.push(
            <div key={`${i}-${li}`} className="flex gap-1.5 my-0.5">
              <span className="text-[#6B7EFF] mt-0.5 shrink-0">•</span>
              <span>{line.replace(/^[-•]\s/, '')}</span>
            </div>
          )
        } else if (line.trim()) {
          elements.push(<span key={`${i}-${li}`}>{line}{li < lines.length - 1 ? ' ' : ''}</span>)
        } else if (li > 0) {
          elements.push(<br key={`${i}-${li}`} />)
        }
      })
      i++
    }
  }
  return <div className="text-[13px] leading-relaxed text-slate-700">{elements}</div>
}

// ─── ConfirmationCard component ──────────────────────────────────────────────
function ConfirmationCard({ action, onExecute, onSkip }: { action: PendingAction; onExecute: () => void; onSkip: () => void }) {
  const isHigh = action.riskLevel === 'high'
  const accentColor = isHigh ? '#D97706' : '#6B7EFF'
  const badgeLabel = isHigh ? 'HIGH RISK' : 'CONFIRM ACTION'

  return (
    <div className="mx-1 my-1 rounded-xl overflow-hidden border" style={{ borderColor: `${accentColor}40` }}>
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between" style={{ background: `linear-gradient(135deg, #0B1728 0%, ${accentColor}22 100%)` }}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: accentColor }} />
          <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: accentColor }}>NEXUS ACTION</span>
        </div>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${accentColor}22`, color: accentColor }}>{badgeLabel}</span>
      </div>
      {/* Body */}
      <div className="px-3 py-2.5" style={{ background: 'linear-gradient(180deg, #0f1e3a 0%, #0B1728 100%)' }}>
        <p className="text-[13px] font-semibold text-white leading-snug">{action.summary}</p>
        {action.reasoning && (
          <p className="text-[11px] text-slate-400 mt-1 italic leading-relaxed">&ldquo;{action.reasoning}&rdquo;</p>
        )}
      </div>
      {/* Actions */}
      <div className="px-3 py-2 flex gap-2 justify-end" style={{ background: '#0B1728' }}>
        <button
          onClick={onSkip}
          className="text-[11px] text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors font-medium"
        >
          Skip
        </button>
        <button
          onClick={onExecute}
          className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-90 active:scale-95 text-white"
          style={{ backgroundColor: accentColor }}
        >
          Execute →
        </button>
      </div>
    </div>
  )
}

// ─── UndoToast component ─────────────────────────────────────────────────────
function UndoToast({ undoState, onUndo, onDismiss }: { undoState: UndoState; onUndo: () => void; onDismiss: () => void }) {
  return (
    <div className="mx-3 mb-1.5 flex items-center justify-between px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-amber-600 text-[11px]">✓</span>
        <span className="text-[11px] text-amber-800 font-medium truncate">{undoState.summary}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <button onClick={onUndo} className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-1">
          Undo
        </button>
        <span className="text-[10px] text-amber-500 font-mono">{undoState.countdown}s</span>
        <button onClick={onDismiss} className="text-amber-400 hover:text-amber-600">
          <X size={10} />
        </button>
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export function NexusAssistant() {
  const pathname = usePathname()
  const [enabled, setEnabled] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [alertsLoaded, setAlertsLoaded] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [briefingDone, setBriefingDone] = useState(false)
  const [wins, setWins] = useState<Array<{ id: string; type: string; title: string; description: string; time: string }>>([])
  const [activeTab, setActiveTab] = useState<'chat' | 'wins'>('chat')
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [undoState, setUndoState] = useState<UndoState | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionKey = 'nexus_session_briefed'

  // Persist enabled state
  useEffect(() => {
    const stored = localStorage.getItem('nexus_enabled')
    if (stored === 'false') setEnabled(false)
  }, [])
  const toggleEnabled = () => {
    const next = !enabled
    setEnabled(next)
    localStorage.setItem('nexus_enabled', String(next))
    if (!next) setIsOpen(false)
  }

  // Don't show on /tech
  const isTech = pathname.startsWith('/tech')
  if (isTech) return null

  // Load proactive alerts (once per session)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const loadAlerts = useCallback(async () => {
    if (alertsLoaded) return
    setAlertsLoaded(true)
    try {
      const res = await fetch('/api/assistant/alerts')
      if (!res.ok) return
      const data = await res.json()
      const newAlerts: Alert[] = []
      if (data.overdue_todos > 0) newAlerts.push({ type: 'todo', label: `${data.overdue_todos} overdue To-Do${data.overdue_todos > 1 ? 's' : ''}`, count: data.overdue_todos, href: '/todos', icon: 'todo' })
      if (data.expiring_quotes > 0) newAlerts.push({ type: 'quote', label: `${data.expiring_quotes} quote${data.expiring_quotes > 1 ? 's' : ''} expiring soon`, count: data.expiring_quotes, href: '/quotes', icon: 'quote' })
      if (data.open_wos > 0) newAlerts.push({ type: 'wo', label: `${data.open_wos} open work order${data.open_wos > 1 ? 's' : ''}`, count: data.open_wos, href: '/maintenance', icon: 'wo' })
      // SCOUT: leads that opened the outreach email — highest priority signal
      if (data.scout_opened > 0) {
        const lead = data.scout_opened_leads?.[0]
        const label = data.scout_opened === 1 && lead
          ? `🎯 ${lead.property_name} opened your SCOUT email — time to call`
          : `🎯 ${data.scout_opened} leads opened your SCOUT emails — follow up now`
        newAlerts.unshift({ type: 'scout', label, count: data.scout_opened, href: '/crm/leads?stage=new&scout_status=opened', icon: 'scout' })
      }
      setAlerts(newAlerts)
      if (newAlerts.length > 0) setUnreadCount(newAlerts.length)
    } catch { /* silent */ }
  }, [alertsLoaded])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (enabled) {
      loadAlerts()
      // Also fetch wins in parallel
      void (async () => {
        try {
          const res = await fetch('/api/assistant/wins')
          if (res.ok) {
            const data = await res.json() as { wins: typeof wins }
            setWins(data.wins ?? [])
          }
        } catch { /* skip */ }
      })()
    }
  }, [enabled, loadAlerts])

  // Auto-scroll to bottom
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  // Focus input on open
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
      setUnreadCount(0)
      // Show briefing message on first open
      if (!briefingDone && !sessionStorage.getItem(sessionKey)) {
        setBriefingDone(true)
        sessionStorage.setItem(sessionKey, '1')
        const hour = new Date().getHours()
        const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
        const alertLines = alerts.length > 0
          ? `\n\nHere's your briefing:\n${alerts.map(a => `• ${a.label}`).join('\n')}`
          : '\n\nYou have no urgent alerts right now.'
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: `${greeting}! I'm NEXUS, your GateGuard AI assistant. I can answer questions, pull live data, remind you of tasks, and navigate you around the portal.${alertLines}\n\nWhat do you need?`,
          timestamp: new Date(),
        }])
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Undo countdown timer
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!undoState) return
    const timer = setInterval(() => {
      setUndoState(prev => {
        if (!prev) return null
        if (prev.countdown <= 1) { clearInterval(timer); return null }
        return { ...prev, countdown: prev.countdown - 1 }
      })
    }, 1000)
    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!undoState])

  const executeAction = async (action: PendingAction) => {
    setPendingAction(null)
    setIsLoading(true)
    try {
      const res = await fetch('/api/assistant/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolName: action.toolName, toolArgs: action.toolArgs }),
      })
      const data = await res.json() as { success: boolean; message?: string; error?: string; revertPayload?: Record<string, unknown> }

      const confirmMsg = data.success
        ? `✓ Done — ${data.message ?? action.summary}`
        : `⚠ Action failed: ${data.error ?? 'Unknown error'}`

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant' as const,
        content: confirmMsg,
        timestamp: new Date(),
        actionConfirmed: 'work_order', // reuse existing badge style
      }])

      // Start undo countdown for successful actions
      if (data.success && data.revertPayload) {
        setUndoState({ summary: action.summary, revertPayload: data.revertPayload, countdown: 30 })
      }
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant' as const, content: 'Action failed — please try again.', timestamp: new Date() }])
    } finally {
      setIsLoading(false)
    }
  }

  const revertAction = async () => {
    if (!undoState) return
    if (undoTimerRef.current) clearInterval(undoTimerRef.current)
    const snapshot = undoState
    setUndoState(null)
    try {
      await fetch('/api/assistant/revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revertPayload: snapshot.revertPayload }),
      })
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant' as const, content: `↩ Undone — "${snapshot.summary}" has been reverted.`, timestamp: new Date() }])
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant' as const, content: 'Undo failed. Please revert manually.', timestamp: new Date() }])
    }
  }

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || isLoading) return
    setInput('')

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          currentPage: pathname,
          userName: '',
        }),
      })
      const data = await res.json() as {
        response?: string;
        actionsExecuted?: string[];
        pendingAction?: PendingAction;
        lastLowRiskAction?: LastLowRiskAction;
      }

      // Derive a single confirmation chip from the first action executed
      let actionConfirmed: Message['actionConfirmed'] = null
      const firstAction = data.actionsExecuted?.[0]
      if (firstAction === 'create_todo') actionConfirmed = 'todo'
      else if (firstAction === 'complete_todo') actionConfirmed = 'todo_completed'
      else if (firstAction === 'create_work_order') actionConfirmed = 'work_order'

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response ?? 'Sorry, I hit an error. Try again.',
        timestamp: new Date(),
        actionConfirmed,
      }])

      // Handle pending action (medium/high risk)
      if (data.pendingAction) {
        setPendingAction(data.pendingAction)
      }
      // Handle low-risk undo toast
      if (data.lastLowRiskAction?.revertPayload) {
        setUndoState({
          summary: data.lastLowRiskAction.summary,
          revertPayload: data.lastLowRiskAction.revertPayload,
          countdown: 30,
        })
      }
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting right now. Try again in a moment.",
        timestamp: new Date(),
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const clearChat = () => {
    setMessages([])
    setBriefingDone(false)
    sessionStorage.removeItem(sessionKey)
  }

  if (!enabled) {
    // Show a tiny "re-enable" pill at bottom right
    return (
      <button
        onClick={toggleEnabled}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-1.5 bg-white border border-border rounded-full px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted shadow-sm transition-all"
      >
        <Sparkles size={11} className="text-[#6B7EFF]" />
        NEXUS
      </button>
    )
  }

  return (
    <>
      {/* ── Expanded panel ───────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed bottom-20 right-5 z-50 w-[380px] bg-white border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: 'min(540px, calc(100vh - 120px))' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#0B1728] rounded-t-2xl shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#6B7EFF]/20 flex items-center justify-center">
                <BrainCircuit size={14} className="text-[#6B7EFF]" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white leading-none">NEXUS</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Personal AI Assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                title="Clear chat"
              >
                <RefreshCcw size={13} />
              </button>
              <button
                onClick={toggleEnabled}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                title="Disable NEXUS"
              >
                <ToggleRight size={16} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <ChevronDown size={15} />
              </button>
            </div>
          </div>

          {/* Alert bar */}
          {alerts.length > 0 && (
            <div className="shrink-0 bg-amber-50 border-b border-amber-100 px-3 py-2">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {alerts.map((a, i) => (
                  <a key={i} href={a.href} className="flex items-center gap-1 text-[11px] text-amber-700 hover:text-amber-900">
                    <AlertIcon type={a.type} />
                    {a.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex border-b border-slate-100 px-3 pt-2 shrink-0">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors ${activeTab === 'chat' ? 'text-[#6B7EFF] border-b-2 border-[#6B7EFF]' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab('wins')}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors flex items-center gap-1 ${activeTab === 'wins' ? 'text-[#6B7EFF] border-b-2 border-[#6B7EFF]' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Wins
              {wins.length > 0 && <span className="bg-emerald-100 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">{wins.length}</span>}
            </button>
          </div>

          {/* Wins feed */}
          {activeTab === 'wins' && (
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
              {wins.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-2xl mb-2">🏆</p>
                  <p className="text-xs text-slate-400">Wins will appear here — close a deal, earn a 5-star rating, or level up to see them.</p>
                </div>
              ) : wins.map(w => (
                <div key={w.id} className="flex gap-2.5 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700">{w.title}</p>
                    <p className="text-[11px] text-slate-500 truncate">{w.description}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap mt-0.5 font-mono">
                    {new Date(w.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Chat content (messages + prompts + input) */}
          {activeTab === 'chat' && (
            <>
              {/* Messages */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0"
              >
                {messages.length === 0 && !isLoading && (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-full bg-[#6B7EFF]/10 flex items-center justify-center mx-auto mb-3">
                      <Sparkles size={20} className="text-[#6B7EFF]" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Ask me anything</p>
                    <p className="text-xs text-muted-foreground mt-1">I can look up quotes, work orders, leads, and more</p>
                  </div>
                )}

                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-5 h-5 rounded-full bg-[#6B7EFF] flex items-center justify-center shrink-0 mt-0.5 mr-2">
                        <Sparkles size={10} className="text-white" />
                      </div>
                    )}
                    <div
                      className={
                        msg.role === 'user'
                          ? 'bg-[#6B7EFF] text-white text-[13px] px-3 py-2 rounded-2xl rounded-tr-sm max-w-[85%]'
                          : 'bg-slate-50 border border-slate-100 px-3 py-2.5 rounded-2xl rounded-tl-sm max-w-[90%]'
                      }
                    >
                      {msg.role === 'user'
                        ? <span className="text-[13px]">{msg.content}</span>
                        : (
                          <>
                            <AssistantMessage content={msg.content} />
                            {msg.actionConfirmed === 'todo' && (
                              <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                                ✓ To-Do created
                              </span>
                            )}
                            {msg.actionConfirmed === 'todo_completed' && (
                              <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                                ✓ To-Do completed
                              </span>
                            )}
                            {msg.actionConfirmed === 'work_order' && (
                              <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                                ✓ Work order created
                              </span>
                            )}
                          </>
                        )
                      }
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="w-5 h-5 rounded-full bg-[#6B7EFF] flex items-center justify-center shrink-0 mt-0.5 mr-2">
                      <Sparkles size={10} className="text-white" />
                    </div>
                    <div className="bg-slate-50 border border-slate-100 px-3 py-2.5 rounded-2xl rounded-tl-sm flex items-center gap-2">
                      <Loader2 size={12} className="animate-spin text-[#6B7EFF]" />
                      <span className="text-[12px] text-muted-foreground">Thinking…</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Pending action confirmation */}
              {pendingAction && (
                <div className="shrink-0 px-1">
                  <ConfirmationCard
                    action={pendingAction}
                    onExecute={() => executeAction(pendingAction)}
                    onSkip={() => setPendingAction(null)}
                  />
                </div>
              )}

              {/* Quick prompts — shown when chat is empty */}
              {messages.length <= 1 && (
                <div className="shrink-0 px-3 pb-2 flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map(p => (
                    <button
                      key={p}
                      onClick={() => sendMessage(p)}
                      className="text-[11px] bg-slate-50 border border-border rounded-full px-2.5 py-1 hover:bg-[#6B7EFF]/5 hover:border-[#6B7EFF]/30 text-slate-600 hover:text-[#6B7EFF] transition-all"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {/* Action chips — shown after conversation starts */}
              {messages.length > 1 && (
                <div className="shrink-0 px-3 pb-2 flex flex-wrap gap-1.5">
                  {ACTION_PROMPTS.map(a => (
                    <button
                      key={a.label}
                      onClick={() => setInput(a.prompt)}
                      className="text-[11px] bg-slate-50 border border-border rounded-full px-2.5 py-1 hover:bg-[#6B7EFF]/5 hover:border-[#6B7EFF]/30 text-slate-600 hover:text-[#6B7EFF] transition-all"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Undo toast */}
              {undoState && (
                <UndoToast
                  undoState={undoState}
                  onUndo={revertAction}
                  onDismiss={() => { if (undoTimerRef.current) clearInterval(undoTimerRef.current); setUndoState(null) }}
                />
              )}

              {/* Input */}
              <div className="shrink-0 border-t border-border px-3 py-2.5 bg-white rounded-b-2xl">
                <div className="flex items-center gap-2 bg-slate-50 border border-border rounded-xl px-3 py-2 focus-within:border-[#6B7EFF] focus-within:bg-white transition-all">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    placeholder="Ask NEXUS anything…"
                    className="flex-1 bg-transparent text-[13px] outline-none text-foreground placeholder:text-muted-foreground/60"
                    disabled={isLoading}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || isLoading}
                    className="w-7 h-7 rounded-lg bg-[#6B7EFF] flex items-center justify-center disabled:opacity-40 hover:bg-[#5a6ee0] transition-colors shrink-0"
                  >
                    <Send size={12} className="text-white" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Floating trigger button ──────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className={`fixed bottom-5 right-5 z-50 w-13 h-13 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          isOpen
            ? 'bg-[#0B1728] hover:bg-slate-800'
            : 'bg-[#6B7EFF] hover:bg-[#5a6ee0] hover:scale-105 active:scale-95'
        }`}
        style={{ width: 52, height: 52 }}
        aria-label="NEXUS AI Assistant"
      >
        {isOpen
          ? <X size={20} className="text-white" />
          : <Sparkles size={20} className="text-white" />
        }
        {/* Alert badge */}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-sm">
            {unreadCount}
          </span>
        )}
        {/* Pulse ring when alerts exist */}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute inset-0 rounded-full bg-[#6B7EFF] animate-ping opacity-20" />
        )}
      </button>
    </>
  )
}
