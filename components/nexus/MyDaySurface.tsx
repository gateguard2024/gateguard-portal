'use client'

import { useCallback, useEffect, useState } from 'react'
import { AddEventModal } from '@/components/calendar/AddEventModal'
import { NexusGlassBackButton } from '@/components/nexus/NexusGlassBackButton'
import { MyDayRelatedJobGlass } from '@/components/nexus/MyDayRelatedJobGlass'
import { NexusGlyphTile, type NexusGlyphKind } from '@/components/nexus/NexusGlyphTile'
import { TodoBoard } from '@/components/nexus/TodoBoard'
import CalendarViews from '@/components/nexus/CalendarViews'
import MessagesShell from '@/components/nexus/MessagesShell'

type MyDayPanel = 'schedule' | 'top10' | 'todos' | 'messages' | null

type MyDayTopItem = {
  id: string
  type: string
  title: string
  reason: string
  urgency: 'high' | 'medium' | 'low'
  score: number
  date?: string | null
  time?: string | null
  link?: string | null
}

type MyDayEvent = {
  id: string
  type: string
  title: string
  date?: string | null
  time?: string | null
  starts_at?: string | null
}

type MyDaySummary = {
  success?: boolean
  counts?: {
    today_total?: number
    week_total?: number
    today_todos?: number
    today_work_orders?: number
    today_crm_activities?: number
    today_tracker_tasks?: number
  }
  today?: {
    events?: MyDayEvent[]
  }
  top_10?: MyDayTopItem[]
  google_calendar?: {
    connected?: boolean
  }
}

type MyDayCard = {
  id: Exclude<MyDayPanel, null>
  title: string
  subtitle: string
  hex: string
  glyph: NexusGlyphKind
  actionLabel: string
  badge?: string
}

type MessageNote = {
  id: string
  text: string
  createdAt: string
}

const MESSAGE_NOTE_KEY = 'nexus_my_day_message_notes'

function rgb(hex: string): string {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '0,200,255'
}

function formatEventTime(event?: { time?: string | null; starts_at?: string | null } | null): string {
  if (!event) return ''
  if (event.time) return event.time
  if (event.starts_at?.includes('T')) return event.starts_at.split('T')[1]?.slice(0, 5) ?? ''
  return ''
}

function MyDayCardButton({ card, onClick }: { card: MyDayCard; onClick: () => void }) {
  const color = rgb(card.hex)

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative min-h-[138px] overflow-hidden rounded-3xl p-4 text-left transition-all duration-200 hover:-translate-y-1 disabled:opacity-60"
      style={{
        background: `radial-gradient(circle at 18% 8%, rgba(${color},0.26), transparent 32%), linear-gradient(145deg, rgba(8,18,34,0.88), rgba(3,9,22,0.78))`,
        border: `1px solid rgba(${color},0.34)`,
        boxShadow: `0 0 26px rgba(${color},0.16), 0 22px 58px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.08)`,
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full" style={{ background: `rgba(${color},0.14)`, filter: 'blur(18px)' }} />
      {card.badge && (
        <div className="absolute right-4 top-4 rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ background: `rgba(${color},0.16)`, border: `1px solid rgba(${color},0.34)`, color: 'rgba(255,255,255,0.86)' }}>
          {card.badge}
        </div>
      )}
      <NexusGlyphTile kind={card.glyph} color={card.hex} />
      <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.96)' }}>{card.title}</div>
      <div className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.68)' }}>{card.subtitle}</div>
      <div className="absolute bottom-4 right-4 rounded-full px-3 py-1 text-xs font-semibold opacity-90 transition-opacity group-hover:opacity-100" style={{ background: `rgba(${color},0.14)`, border: `1px solid rgba(${color},0.32)`, color: card.hex, boxShadow: `0 0 14px rgba(${color},0.18)` }}>{card.actionLabel}</div>
    </button>
  )
}

function DetailShell({ title, subtitle, onClose, children, actions }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] overflow-hidden bg-black/68 px-4 py-4 backdrop-blur-sm sm:py-6">
      <div className="mx-auto grid h-[calc(100dvh-2rem)] w-full max-w-5xl grid-cols-1 gap-4 overflow-hidden rounded-[2rem] p-5 shadow-2xl sm:h-[calc(100dvh-3rem)] lg:grid-cols-[1fr_260px]" style={{ background: 'linear-gradient(180deg, rgba(8,18,34,0.96), rgba(5,10,22,0.96))', border: '1px solid rgba(0,200,255,0.16)', boxShadow: '0 30px 100px rgba(0,0,0,0.55), 0 0 48px rgba(0,200,255,0.10), inset 0 1px 0 rgba(255,255,255,0.06)', backdropFilter: 'blur(26px)' }}>
        <div className="min-h-0 overflow-y-auto pr-1 pb-24" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <NexusGlassBackButton label="Back to My Day" onClick={onClose} />
          <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(0,200,255,0.78)' }}>My Day</div>
          <h2 className="mt-1 text-2xl font-semibold" style={{ color: 'rgba(255,255,255,0.96)' }}>{title}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.64)' }}>{subtitle}</p>
          <div className="mt-5 space-y-2">{children}</div>
        </div>
        <aside className="min-h-0 overflow-y-auto rounded-3xl p-4 pb-24" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>Actions</div>
          <div className="mt-4 space-y-2">{actions}</div>
        </aside>
      </div>
    </div>
  )
}

function ActionButton({ label, onClick, muted, disabled }: { label: string; onClick?: () => void; muted?: boolean; disabled?: boolean }) {
  const displayLabel = muted ? `${label} — Coming Soon` : label
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-2xl px-3 py-3 text-left text-xs font-semibold transition-all hover:-translate-y-0.5 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45 active:translate-y-0"
      style={muted ? { background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(0,200,255,0.055))', border: '1px solid rgba(255,255,255,0.22)', color: 'rgba(255,255,255,0.92)', boxShadow: '0 0 16px rgba(0,200,255,0.08), inset 0 1px 0 rgba(255,255,255,0.08)' } : disabled ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.48)' } : { background: 'rgba(0,200,255,0.10)', border: '1px solid rgba(0,200,255,0.22)', color: '#7dd3fc' }}
    >
      {displayLabel}
    </button>
  )
}

function MessageChannelCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl px-3 py-3" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>{title}</div>
      <div className="mt-1 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.56)' }}>{subtitle}</div>
    </div>
  )
}

export function MyDaySurface() {
  const [summary, setSummary] = useState<MyDaySummary | null>(null)
  const [addEventOpen, setAddEventOpen] = useState(false)
  const [activePanel, setActivePanel] = useState<MyDayPanel>(null)
  const [selectedTopItemId, setSelectedTopItemId] = useState<string | null>(null)
  const [selectedTodoItemId, setSelectedTodoItemId] = useState<string | null>(null)
  const [topActionBusy, setTopActionBusy] = useState(false)
  const [topActionMessage, setTopActionMessage] = useState<string | null>(null)
  const [topNote, setTopNote] = useState('')
  const [showTopNoteBox, setShowTopNoteBox] = useState(false)
  const [relatedJobId, setRelatedJobId] = useState<string | null>(null)
  const [messageNote, setMessageNote] = useState('')
  const [messageNotes, setMessageNotes] = useState<MessageNote[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(MESSAGE_NOTE_KEY) ?? '[]') as MessageNote[] } catch { return [] }
  })
  const [messageStatus, setMessageStatus] = useState<string | null>(null)

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/nexus/my-day')
      const data = await res.json().catch(() => null) as MyDaySummary | null
      if (res.ok && data?.success) setSummary(data)
    } catch {
      // My Day still renders useful entry points when summary loading fails.
    }
  }, [])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  const todayCount = summary?.counts?.today_total ?? 0
  const weekCount = summary?.counts?.week_total ?? 0
  const todayEvents = summary?.today?.events ?? []
  const top10 = summary?.top_10 ?? []
  const todoItems = top10.filter(item => item.type === 'todo' || item.type === 'tracker_task')
  const selectedTopItem = top10.find(item => item.id === selectedTopItemId) ?? null
  const selectedTodoItem = todoItems.find(item => item.id === selectedTodoItemId) ?? null
  const nextEvent = todayEvents[0]
  const todoCount = summary?.counts?.today_todos ?? 0
  const workSignalCount = top10.length
  const messageCount = messageNotes.length

  async function submitTopAction(action: 'mark_done' | 'add_note') {
    const item = top10.find(topItem => topItem.id === selectedTopItemId)
    if (!item) return
    setTopActionBusy(true)
    setTopActionMessage(null)
    try {
      const res = await fetch('/api/nexus/my-day/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, item_type: item.type, item_id: item.id, note: topNote }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error(data?.message ?? 'Could not complete that action.')
      setTopActionMessage(data?.message ?? 'Done.')
      setTopNote('')
      setShowTopNoteBox(false)
      await loadSummary()
    } catch (error) {
      setTopActionMessage(error instanceof Error ? error.message : 'That did not work. Try again.')
    } finally {
      setTopActionBusy(false)
    }
  }

  async function submitTodoAction(action: 'mark_done') {
    const item = todoItems.find(todoItem => todoItem.id === selectedTodoItemId)
    if (!item) return
    setTopActionBusy(true)
    setTopActionMessage(null)
    try {
      const res = await fetch('/api/nexus/my-day/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, item_type: item.type, item_id: item.id }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error(data?.message ?? 'Could not complete that action.')
      setTopActionMessage(data?.message ?? 'Done.')
      setSelectedTodoItemId(null)
      await loadSummary()
    } catch (error) {
      setTopActionMessage(error instanceof Error ? error.message : 'That did not work. Try again.')
    } finally {
      setTopActionBusy(false)
    }
  }

  function saveMessageNote() {
    const text = messageNote.trim()
    if (!text) return
    const nextNotes = [{ id: Date.now().toString(), text, createdAt: new Date().toISOString() }, ...messageNotes].slice(0, 8)
    setMessageNotes(nextNotes)
    localStorage.setItem(MESSAGE_NOTE_KEY, JSON.stringify(nextNotes))
    setMessageNote('')
    setMessageStatus('Message note saved for today.')
  }

  function openSelectedRelated() {
    if (!selectedTopItem) { setTopActionMessage('Select an item first.'); return }
    if (selectedTopItem.type !== 'work_order') { setTopActionMessage('This type stays in My Day for now. Full related glass is coming next.'); return }
    setRelatedJobId(selectedTopItem.id)
    setActivePanel(null)
  }

  const cards: MyDayCard[] = [
    { id: 'schedule', title: "Today's Schedule", subtitle: nextEvent ? `Next: ${formatEventTime(nextEvent)} ${nextEvent.title}`.trim() : "See today's calendar, site visits, jobs, and appointments.", hex: '#00C8FF', glyph: 'schedule', badge: `${todayCount} today`, actionLabel: 'Open →' },
    { id: 'top10', title: "Today's Priorities", subtitle: workSignalCount > 0 ? `${workSignalCount} item${workSignalCount === 1 ? '' : 's'} need attention today.` : 'Important work will appear here when Nexus finds it.', hex: '#007CFF', glyph: 'priority', badge: workSignalCount > 0 ? `${workSignalCount}` : undefined, actionLabel: 'Open →' },
    { id: 'todos', title: 'To-Dos', subtitle: `${todoCount} due today. Open this list to review and finish tasks.`, hex: '#8B5CF6', glyph: 'todo', actionLabel: 'Open →' },
    { id: 'messages', title: 'Messages', subtitle: 'Customer calls, emails, texts, and message notes that need attention.', hex: '#34D399', glyph: 'email', badge: messageCount > 0 ? `${messageCount}` : 'New', actionLabel: 'Open →' },
  ]

  if (relatedJobId) {
    return <MyDayRelatedJobGlass jobId={relatedJobId} onBack={() => { setRelatedJobId(null); setActivePanel('top10') }} onRefreshMyDay={loadSummary} />
  }

  return (
    <section className="mt-9 w-full max-w-5xl">
      <div className="rounded-[2rem] p-5 sm:p-6" style={{ background: 'radial-gradient(circle at 12% 0%, rgba(0,124,255,0.16), transparent 34%), linear-gradient(180deg, rgba(8,18,34,0.78), rgba(3,9,22,0.72))', border: '1px solid rgba(0,200,255,0.18)', boxShadow: '0 28px 90px rgba(0,0,0,0.38), 0 0 46px rgba(0,124,255,0.12), inset 0 1px 0 rgba(255,255,255,0.07)', backdropFilter: 'blur(26px)' }}>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(0,200,255,0.82)' }}>My Day</div><h2 className="mt-1 text-xl font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.97)', textShadow: '0 0 18px rgba(0,124,255,0.22)' }}>What needs your attention today?</h2><p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.68)' }}>Choose a category below to view your schedule, priorities, tasks, or messages.</p></div><div className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]" style={{ background: 'rgba(0,124,255,0.14)', color: 'rgba(125,229,255,0.96)', border: '1px solid rgba(0,200,255,0.28)', boxShadow: '0 0 18px rgba(0,124,255,0.12)' }}>{weekCount} this week</div></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(card => <MyDayCardButton key={card.title} card={card} onClick={() => { setActivePanel(card.id); setSelectedTopItemId(null); setSelectedTodoItemId(null); setTopActionMessage(null); setShowTopNoteBox(false); setMessageStatus(null) }} />)}</div>
        <div className="mt-5 text-[11px]" style={{ color: 'rgba(255,255,255,0.58)' }}>Pick one card above. Nexus will open the right work board.</div>
      </div>

      {activePanel === 'schedule' && <DetailShell title="Schedule" subtitle="Your calendar — day, week, month, and list views." onClose={() => setActivePanel(null)}>
        <CalendarViews />
      </DetailShell>}

      {activePanel === 'top10' && <DetailShell title="Today's Priorities" subtitle="Select one item, then choose an action." onClose={() => setActivePanel(null)} actions={<>{selectedTopItem ? <div className="rounded-2xl p-3 text-[11px]" style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.16)', color: 'rgba(255,255,255,0.72)' }}>Selected:<br /><span style={{ color: 'rgba(255,255,255,0.9)' }}>{selectedTopItem.title}</span></div> : <div className="rounded-2xl p-3 text-[11px]" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.42)' }}>Select an item first.</div>}<ActionButton label="Open Related" disabled={!selectedTopItem || topActionBusy} onClick={openSelectedRelated} /><ActionButton label="Mark Done" disabled={!selectedTopItem || topActionBusy} onClick={() => void submitTopAction('mark_done')} /><ActionButton label="Add Note" disabled={!selectedTopItem || topActionBusy} onClick={() => { setShowTopNoteBox(!showTopNoteBox); setTopActionMessage(null) }} />{showTopNoteBox && <div className="space-y-2 rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(0,200,255,0.22)' }}><textarea value={topNote} onChange={e => setTopNote(e.target.value)} placeholder="What should Nexus remember?" rows={3} className="w-full resize-none rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(0,200,255,0.2)', color: 'rgba(255,255,255,0.88)' }} /><button type="button" disabled={topActionBusy || !topNote.trim()} onClick={() => void submitTopAction('add_note')} className="rounded-full px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #00C8FF, #007CFF)', color: 'white' }}>{topActionBusy ? 'Saving...' : 'Save Note'}</button></div>}{topActionMessage && <div className="rounded-2xl px-3 py-2 text-[11px]" style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.18)', color: 'rgba(255,255,255,0.72)' }}>{topActionMessage}</div>}</>}>
        {top10.length > 0 ? top10.map((item, index) => { const selected = selectedTopItemId === item.id; return <button key={`${item.type}-${item.id}`} type="button" onClick={() => { setSelectedTopItemId(item.id); setTopActionMessage(null); setShowTopNoteBox(false) }} className="w-full rounded-2xl px-3 py-3 text-left transition-all hover:-translate-y-0.5" style={{ background: selected ? 'rgba(0,200,255,0.12)' : 'rgba(0,0,0,0.18)', border: selected ? '1px solid rgba(0,200,255,0.34)' : '1px solid rgba(255,255,255,0.06)' }}><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>{index + 1}. {item.title}</div><div className="mt-1 text-[10px] capitalize" style={{ color: 'rgba(255,255,255,0.34)' }}>{item.reason} · {item.type.replace(/_/g, ' ')}</div></div><div className="rounded-full px-2 py-1 text-[9px] font-semibold uppercase" style={{ background: item.urgency === 'high' ? 'rgba(248,113,113,0.16)' : item.urgency === 'medium' ? 'rgba(251,191,36,0.16)' : 'rgba(148,163,184,0.14)', color: item.urgency === 'high' ? '#fca5a5' : item.urgency === 'medium' ? '#fde68a' : '#cbd5e1', border: '1px solid rgba(255,255,255,0.08)' }}>{selected ? 'selected' : item.urgency}</div></div></button> }) : <div className="rounded-2xl px-3 py-3 text-xs" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.42)' }}>No priority items yet. Add an event or to-do to start building the day.</div>}
      </DetailShell>}

      {activePanel === 'todos' && <DetailShell title="To-Dos" subtitle="Your tasks — add, prioritize, schedule, and complete." onClose={() => setActivePanel(null)} actions={<div className="rounded-2xl p-3 text-[11px]" style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.22)', color: 'rgba(255,255,255,0.62)' }}>Tip: filter by Today, Overdue, or This Week. Tap a task to set its priority, due date, and status.</div>}>
        <TodoBoard />
      </DetailShell>}

      {activePanel === 'messages' && <DetailShell title="Messages" subtitle="Conversations, calls, texts, and email in one place." onClose={() => setActivePanel(null)} actions={<div className="rounded-2xl p-3 text-[11px]" style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.22)', color: 'rgba(255,255,255,0.62)' }}>Live email, calls, and texts connect in a later step. Sample conversations are shown to preview the workspace.</div>}>
        <MessagesShell />
      </DetailShell>}

      <AddEventModal open={addEventOpen} onClose={() => setAddEventOpen(false)} onSaved={loadSummary} />
    </section>
  )
}
