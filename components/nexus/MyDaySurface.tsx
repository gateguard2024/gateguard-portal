'use client'

import { useCallback, useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { AddEventModal } from '@/components/calendar/AddEventModal'
import { NexusGlassBackButton } from '@/components/nexus/NexusGlassBackButton'
import { MyDayRelatedJobGlass } from '@/components/nexus/MyDayRelatedJobGlass'
import { NexusGlyphTile, type NexusGlyphKind } from '@/components/nexus/NexusGlyphTile'
import { TodoBoard } from '@/components/nexus/TodoBoard'
import CalendarViews from '@/components/nexus/CalendarViews'
import MessagesShell from '@/components/nexus/MessagesShell'
import { PriorityGlassPane } from '@/components/nexus/PriorityGlassPane'

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

const LEAD_BAR_GRADIENTS = [
  'linear-gradient(90deg,#06b6d4,#38bdf8,#5eead4)',
  'linear-gradient(90deg,#6366f1,#a78bfa)',
  'linear-gradient(90deg,#10b981,#5eead4)',
  'linear-gradient(90deg,#f59e0b,#fb923c)',
  'linear-gradient(90deg,#ec4899,#fb7185)',
]

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

function MyDayCardButton({ card, onClick, fill }: { card: MyDayCard; onClick: () => void; fill?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col overflow-hidden rounded-2xl p-5 text-left transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60 ${fill ? 'flex-1 min-h-[128px]' : 'min-h-[184px]'}`}
      style={{ background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.05) 0 1px,transparent 1px 4px), linear-gradient(180deg,#586778,#495868)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 10px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -2px 2px rgba(0,0,0,0.35)' }}
    >
      {card.badge && (
        <div className="absolute right-4 top-4 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ background: 'rgba(13,20,32,0.5)', border: '1px solid rgba(255,255,255,0.18)', color: '#DCE6F0' }}>
          {card.badge}
        </div>
      )}
      <NexusGlyphTile kind={card.glyph} color={card.hex} />
      <div className="text-[17px] font-semibold leading-tight" style={{ color: '#F1F6FB' }}>{card.title}</div>
      <div className="mt-1.5 text-[13px] leading-relaxed" style={{ color: 'rgba(196,207,221,0.9)' }}>{card.subtitle}</div>
      <div className="mt-auto flex items-center pt-4">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold transition-all duration-200 group-hover:gap-2.5" style={{ color: '#8FD3EC' }}>
          Open
          <span aria-hidden="true" className="text-[15px] leading-none">&rarr;</span>
        </span>
      </div>
    </button>
  )
}

function DaySummaryBlock({ openTasks, high, medium, low, leadsTotal, leadStages }: { openTasks: number; high: number; medium: number; low: number; leadsTotal: number; leadStages: { label: string; value: number }[] }) {
  // Machined instrument dial (viewBox 200x128, centre 100,100, r80). ~12 open = full sweep.
  const f = Math.max(0.03, Math.min(1, openTasks / 12))
  const th = Math.PI * (1 - f)
  const gx = (100 + 80 * Math.cos(th)).toFixed(1)
  const gy = (100 - 80 * Math.sin(th)).toFixed(1)
  const nx = (100 + 66 * Math.cos(th)).toFixed(1)
  const ny = (100 - 66 * Math.sin(th)).toFixed(1)
  const pill = (label: string, value: number, dot: string) => (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: dot, boxShadow: `0 0 8px ${dot}` }} />
      <span className="font-medium text-slate-400">{label}</span>
      <span className="ml-0.5 font-bold text-slate-100">{value}</span>
    </div>
  )
  return (
    <div className="relative flex flex-col overflow-hidden rounded-3xl p-5" style={{ background: '#0d1420', border: '1px solid rgba(0,0,0,0.6)', boxShadow: 'inset 0 8px 26px rgba(0,0,0,0.8), inset 0 -1px 0 rgba(255,255,255,0.05)' }}>

      <div className="mb-4 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-cyan-400">Summary</span>
        <span className="rounded-full border border-white/5 bg-slate-800/60 px-2.5 py-0.5 text-[10px] font-medium text-slate-400">Live data</span>
      </div>

      <div className="relative mb-1 flex items-center justify-center">
        <svg viewBox="0 0 200 128" className="h-28 w-56">
          <defs>
            <linearGradient id="otBz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9d6e2" /><stop offset="0.5" stopColor="#69788b" /><stop offset="1" stopColor="#202934" /></linearGradient>
            <linearGradient id="otPg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#2f7fb8" /><stop offset="0.6" stopColor="#5FB8E0" /><stop offset="1" stopColor="#DDF3FB" /></linearGradient>
            <radialGradient id="otHb" cx="0.38" cy="0.32"><stop offset="0" stopColor="#f6fafd" /><stop offset="0.5" stopColor="#9fb0c4" /><stop offset="1" stopColor="#232d3a" /></radialGradient>
            <filter id="otGl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="url(#otBz)" strokeWidth="15" strokeLinecap="round" />
          <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#070b12" strokeWidth="8" strokeLinecap="round" />
          <g stroke="#5a6a80" strokeWidth="2">
            <line x1="20" y1="100" x2="29" y2="100" /><line x1="33" y1="57" x2="41" y2="61" /><line x1="72" y1="31" x2="76" y2="39" /><line x1="100" y1="22" x2="100" y2="31" /><line x1="128" y1="31" x2="124" y2="39" /><line x1="167" y1="57" x2="159" y2="61" /><line x1="180" y1="100" x2="171" y2="100" />
          </g>
          <path d={`M20 100 A80 80 0 0 1 ${gx} ${gy}`} fill="none" stroke="url(#otPg)" strokeWidth="7.5" strokeLinecap="round" filter="url(#otGl)" />
          <path d="M32 72 A62 62 0 0 1 74 36" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" />
          <line x1="100" y1="100" x2={nx} y2={ny} stroke="#E7B15C" strokeWidth="3" strokeLinecap="round" filter="url(#otGl)" />
          <circle cx="100" cy="100" r="10" fill="url(#otHb)" stroke="#69788b" />
          <text x="100" y="88" textAnchor="middle" fontSize="34" fill="#F4FAFD" fontWeight="600">{openTasks}</text>
          <text x="100" y="118" textAnchor="middle" fontSize="9" letterSpacing="3" fill="#8FA0B8">OPEN TASKS</text>
        </svg>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/50 px-3 py-2 text-xs" style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)' }}>
        {pill('High', high, '#f43f5e')}
        {pill('Med', medium, '#fbbf24')}
        {pill('Low', low, '#22d3ee')}
      </div>

      <hr className="my-4 border-white/5" />

      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Leads</span>
        <span className="text-2xl font-extrabold text-white">{leadsTotal}</span>
      </div>
      <div className="mt-auto flex flex-col gap-2.5">
        {leadStages.length === 0 ? (
          <div className="text-[11px] text-slate-500">No leads yet.</div>
        ) : leadStages.map((st, i) => {
          const pct = Math.max(8, Math.min(100, (st.value / Math.max(1, leadsTotal)) * 100))
          return (
            <div key={st.label} className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium capitalize text-slate-400">{st.label}</span>
                <span className="font-semibold text-slate-200">{st.value}</span>
              </div>
              <div className="h-2.5 w-full rounded-full border border-white/5 bg-slate-950/90 p-[1px]" style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)' }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: LEAD_BAR_GRADIENTS[i % LEAD_BAR_GRADIENTS.length], boxShadow: '0 0 10px rgba(56,189,248,0.5)' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DetailShell({ title, subtitle, onClose, children, actions }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] overflow-hidden bg-black/68 px-4 py-4 backdrop-blur-sm sm:py-6">
      <div className={`mx-auto grid h-[calc(100dvh-2rem)] w-full max-w-5xl xl:max-w-none grid-cols-1 gap-4 overflow-hidden rounded-[2rem] p-5 shadow-2xl sm:h-[calc(100dvh-3rem)] ${actions ? 'lg:grid-cols-[1fr_260px]' : ''}`} style={{ background: 'linear-gradient(180deg, rgba(8,18,34,0.96), rgba(5,10,22,0.96))', border: '1px solid rgba(0,200,255,0.16)', boxShadow: '0 30px 100px rgba(0,0,0,0.55), 0 0 48px rgba(0,200,255,0.10), inset 0 1px 0 rgba(255,255,255,0.06)', backdropFilter: 'blur(26px)' }}>
        <div className="min-h-0 overflow-y-auto pr-1 pb-24" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <NexusGlassBackButton label="Back to My Day" onClick={onClose} />
          <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(0,200,255,0.78)' }}>My Day</div>
          <h2 className="mt-1 text-2xl font-semibold" style={{ color: 'rgba(255,255,255,0.96)' }}>{title}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.64)' }}>{subtitle}</p>
          <div className="mt-5 space-y-2">{children}</div>
        </div>
        {actions && (
          <aside className="min-h-0 overflow-y-auto rounded-3xl p-4 pb-24" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
            <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>Actions</div>
            <div className="mt-4 space-y-2">{actions}</div>
          </aside>
        )}
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

function SchedulePopout({ events, onOpen, onClose }: { events: MyDayEvent[]; onOpen: () => void; onClose: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border p-4" style={{ background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.05) 0 1px,transparent 1px 4px), linear-gradient(180deg,#5f6e81,#4c5a6d)', borderColor: 'rgba(10,16,24,0.35)', boxShadow: '0 14px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.24)' }}>
      <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: '#22d3ee', boxShadow: '0 0 8px #22d3ee' }} /><span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">Today&apos;s Schedule</span></div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-cyan-800/50 bg-cyan-950/70 px-2 py-0.5 text-[10px] text-cyan-300">Live data</span>
          <button type="button" onClick={onClose} aria-label="Hide schedule preview" className="text-sm leading-none text-slate-500 hover:text-white">&times;</button>
        </div>
      </div>
      {events.length === 0 ? (
        <button type="button" onClick={onOpen} className="w-full py-6 text-center text-xs text-slate-500 hover:text-slate-300">Nothing scheduled today &mdash; open calendar</button>
      ) : (
        <div className="space-y-1.5">
          {events.slice(0, 4).map((e) => (
            <button key={e.id} type="button" onClick={onOpen} className="flex w-full items-center justify-between rounded-lg border-l-2 border-cyan-400 bg-slate-800/40 px-2.5 py-2 text-left text-xs text-slate-200 transition-colors hover:bg-slate-800/70">
              <span className="truncate">{e.title}</span>
              <span className="ml-2 shrink-0 font-mono text-[10px] text-slate-400">{formatEventTime(e)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TodosPopout({ items, onOpen, onClose }: { items: MyDayTopItem[]; onOpen: () => void; onClose: () => void }) {
  const cols: { key: 'high' | 'medium' | 'low'; label: string; accent: string }[] = [
    { key: 'high', label: 'Now', accent: '#f43f5e' },
    { key: 'medium', label: 'Next', accent: '#fbbf24' },
    { key: 'low', label: 'Later', accent: '#22d3ee' },
  ]
  return (
    <div className="relative overflow-hidden rounded-2xl border p-4" style={{ background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.05) 0 1px,transparent 1px 4px), linear-gradient(180deg,#5f6e81,#4c5a6d)', borderColor: 'rgba(10,16,24,0.35)', boxShadow: '0 14px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.24)' }}>
      <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: '#818cf8', boxShadow: '0 0 8px #818cf8' }} /><span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">To-Dos</span></div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onOpen} className="rounded-full border border-slate-700 bg-slate-800/70 px-2 py-0.5 text-[10px] text-slate-300 hover:text-white">Open board</button>
          <button type="button" onClick={onClose} aria-label="Hide to-dos preview" className="text-sm leading-none text-slate-500 hover:text-white">&times;</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {cols.map((c) => {
          const colItems = items.filter((i) => i.urgency === c.key).slice(0, 3)
          return (
            <div key={c.key} className="space-y-1.5 rounded-xl border border-slate-800/80 bg-slate-900/60 p-2">
              <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: c.accent }} /><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{c.label}</span></div>
              {colItems.length === 0 ? (
                <div className="py-1.5 text-[10px] text-slate-600">&mdash;</div>
              ) : colItems.map((i) => (
                <button key={i.id} type="button" onClick={onOpen} className="block w-full truncate rounded-md bg-slate-800/60 px-1.5 py-1 text-left text-[11px] text-slate-300 hover:bg-slate-800">{i.title}</button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function MyDaySurface() {
  const { user } = useUser()
  const firstName = user?.firstName ?? 'there'
  const [summary, setSummary] = useState<MyDaySummary | null>(null)
  const [leads, setLeads] = useState<{ stage?: string }[]>([])
  const [addEventOpen, setAddEventOpen] = useState(false)
  const [activePanel, setActivePanel] = useState<MyDayPanel>(null)
  const [selectedTopItemId, setSelectedTopItemId] = useState<string | null>(null)
  const [selectedTodoItemId, setSelectedTodoItemId] = useState<string | null>(null)
  const [topActionBusy, setTopActionBusy] = useState(false)
  const [topActionMessage, setTopActionMessage] = useState<string | null>(null)
  const [topNote, setTopNote] = useState('')
  const [showTopNoteBox, setShowTopNoteBox] = useState(false)
  const [relatedJobId, setRelatedJobId] = useState<string | null>(null)
  const [priorityOpen, setPriorityOpen] = useState(false)
  const [messageNote, setMessageNote] = useState('')
  const [messageNotes, setMessageNotes] = useState<MessageNote[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(MESSAGE_NOTE_KEY) ?? '[]') as MessageNote[] } catch { return [] }
  })
  const [messageStatus, setMessageStatus] = useState<string | null>(null)
  const POPOUT_KEY = 'nexus_my_day_popouts'
  const [popouts, setPopouts] = useState<{ schedule: boolean; todos: boolean }>(() => {
    if (typeof window === 'undefined') return { schedule: true, todos: true }
    try { return { schedule: true, todos: true, ...(JSON.parse(localStorage.getItem(POPOUT_KEY) ?? '{}') as Record<string, boolean>) } } catch { return { schedule: true, todos: true } }
  })
  const setPopout = (k: 'schedule' | 'todos', v: boolean) => setPopouts(prev => { const next = { ...prev, [k]: v }; try { localStorage.setItem(POPOUT_KEY, JSON.stringify(next)) } catch { /* ignore */ } ; return next })

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

  useEffect(() => {
    let alive = true
    fetch('/api/crm/leads').then(r => r.json()).then((d) => { if (alive) setLeads(Array.isArray(d) ? d : []) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const todayCount = summary?.counts?.today_total ?? 0
  const todayEvents = summary?.today?.events ?? []
  const top10 = summary?.top_10 ?? []
  const todoItems = top10.filter(item => item.type === 'todo' || item.type === 'tracker_task')
  const selectedTopItem = top10.find(item => item.id === selectedTopItemId) ?? null
  const selectedTodoItem = todoItems.find(item => item.id === selectedTodoItemId) ?? null
  const nextEvent = todayEvents[0]
  const todoCount = summary?.counts?.today_todos ?? 0
  const workSignalCount = top10.length
  const messageCount = messageNotes.length
  const highCount = top10.filter(item => item.urgency === 'high').length
  const medCount  = top10.filter(item => item.urgency === 'medium').length
  const lowCount  = top10.filter(item => item.urgency === 'low').length
  const sortedTop10 = [...top10].sort((a, b) => (({ high: 0, medium: 1, low: 2 } as Record<string, number>)[a.urgency] ?? 1) - (({ high: 0, medium: 1, low: 2 } as Record<string, number>)[b.urgency] ?? 1))
  const leadStageCounts = leads.reduce<Record<string, number>>((acc, l) => { const st = (l.stage || 'new'); acc[st] = (acc[st] || 0) + 1; return acc }, {})
  const leadStages = Object.entries(leadStageCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value }))

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

  const openCard = (card: MyDayCard) => { setActivePanel(card.id); setSelectedTopItemId(null); setSelectedTodoItemId(null); setTopActionMessage(null); setShowTopNoteBox(false); setMessageStatus(null) }

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
    <section className="mt-6 w-full">
      {(popouts.schedule || popouts.todos) && (
        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {popouts.schedule && <SchedulePopout events={todayEvents} onOpen={() => openCard(cards[0])} onClose={() => setPopout('schedule', false)} />}
          {popouts.todos && <TodosPopout items={todoItems} onOpen={() => openCard(cards[2])} onClose={() => setPopout('todos', false)} />}
        </div>
      )}
      {!popouts.schedule && !popouts.todos && (
        <button type="button" onClick={() => { setPopout('schedule', true); setPopout('todos', true) }} className="mb-3 rounded-full border border-slate-700/60 bg-slate-800/50 px-3 py-1 text-[11px] text-slate-300 transition-colors hover:text-white">Show previews</button>
      )}
      <div className="relative overflow-hidden rounded-[2rem] p-5 sm:p-6" style={{ background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.05) 0 1px,transparent 1px 4px), linear-gradient(180deg,#6a7889,#515f72)', border: '1px solid rgba(10,16,24,0.4)', boxShadow: '0 26px 54px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 2px rgba(0,0,0,0.4)' }}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(148,163,184,0.45), transparent)' }} />
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
          <h2 className="text-base font-medium leading-tight sm:text-lg" style={{ color: 'rgba(226,232,240,0.94)' }}>Hi <span style={{ color: '#ffffff', fontWeight: 600 }}>{firstName}</span>, <span style={{ color: 'rgba(148,163,184,0.9)', fontWeight: 400 }}>what are we working on today?</span></h2>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: 'rgba(6,78,59,0.45)', border: '1px solid rgba(16,185,129,0.45)', color: '#34d399', fontFamily: 'var(--font-mono, ui-monospace)' }}>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: '#34d399' }} />
            Live Connection
          </span>
        </div>
        <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-[1fr_1.3fr_1fr]">
          <div className="flex flex-col gap-3">
            <MyDayCardButton card={cards[0]} fill onClick={() => openCard(cards[0])} />
            <MyDayCardButton card={cards[1]} fill onClick={() => openCard(cards[1])} />
          </div>
          <DaySummaryBlock openTasks={workSignalCount} high={highCount} medium={medCount} low={lowCount} leadsTotal={leads.length} leadStages={leadStages} />
          <div className="flex flex-col gap-3">
            <MyDayCardButton card={cards[2]} fill onClick={() => openCard(cards[2])} />
            <MyDayCardButton card={cards[3]} fill onClick={() => openCard(cards[3])} />
          </div>
        </div>
      </div>

      {activePanel === 'schedule' && <DetailShell title="Schedule" subtitle="Your calendar — day, week, month, and list views." onClose={() => setActivePanel(null)}>
        <CalendarViews />
      </DetailShell>}

      {activePanel === 'top10' && <DetailShell title="Today's Priorities" subtitle="Highest urgency first. Tap one to open it and work it." onClose={() => setActivePanel(null)} actions={<div className="rounded-2xl p-3 text-[11px]" style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.16)', color: 'rgba(255,255,255,0.6)' }}>Tap any priority to see why it matters and act — open the record, add a note, or mark it done.</div>}>
        {top10.length > 0 ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: 'rgba(244,63,94,0.12)', color: '#fda4af', border: '1px solid rgba(244,63,94,0.3)' }}>{highCount} high</span>
              <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: 'rgba(251,191,36,0.12)', color: '#fcd34d', border: '1px solid rgba(251,191,36,0.3)' }}>{medCount} medium</span>
              <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: 'rgba(34,211,238,0.12)', color: '#67e8f9', border: '1px solid rgba(34,211,238,0.3)' }}>{lowCount} low</span>
            </div>
            <div className="space-y-2">
              {sortedTop10.map((item, index) => {
                const accent = item.urgency === 'high' ? '#f43f5e' : item.urgency === 'medium' ? '#fbbf24' : '#22d3ee'
                return (
                  <button key={`${item.type}-${item.id}`} type="button" onClick={() => { setSelectedTopItemId(item.id); setPriorityOpen(true) }} className="group relative w-full overflow-hidden rounded-2xl border border-white/10 py-3 pl-4 pr-3 text-left backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/20" style={{ background: 'rgba(15,23,42,0.66)' }}>
                    <span className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-500">{index + 1}</span>
                          <span className="truncate text-sm font-semibold text-white">{item.title}</span>
                        </div>
                        <div className="mt-1 truncate text-[10.5px] capitalize text-slate-400">{item.reason} · {item.type.replace(/_/g, ' ')}</div>
                      </div>
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ background: `${accent}1f`, color: accent, border: `1px solid ${accent}59` }}>{item.urgency}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-white/10 px-3 py-6 text-center text-xs text-slate-400" style={{ background: 'rgba(15,23,42,0.5)' }}>No priority items yet. Add an event or to-do to start building the day.</div>
        )}
      </DetailShell>}

      {priorityOpen && selectedTopItem && (
        <PriorityGlassPane
          item={selectedTopItem}
          onBack={() => setPriorityOpen(false)}
          onRefresh={loadSummary}
          onOpenJob={(id) => { setPriorityOpen(false); setRelatedJobId(id) }}
        />
      )}

      {activePanel === 'todos' && <DetailShell title="To-Dos" subtitle="Your tasks — add, prioritize, schedule, and complete." onClose={() => setActivePanel(null)} actions={<div className="rounded-2xl p-3 text-[11px]" style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.22)', color: 'rgba(255,255,255,0.62)' }}>Tip: filter by Today, Overdue, or This Week. Tap a task to set its priority, due date, and status.</div>}>
        <TodoBoard />
      </DetailShell>}

      {activePanel === 'messages' && <DetailShell title="Messages" subtitle="Conversations, calls, texts, and email in one place." onClose={() => setActivePanel(null)}>
        <MessagesShell />
      </DetailShell>}

      <AddEventModal open={addEventOpen} onClose={() => setAddEventOpen(false)} onSaved={loadSummary} />
    </section>
  )
}
