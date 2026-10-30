'use client'

import { useCallback, useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { AddEventModal } from '@/components/calendar/AddEventModal'
import { NexusGlassBackButton } from '@/components/nexus/NexusGlassBackButton'
import { MyDayRelatedJobGlass } from '@/components/nexus/MyDayRelatedJobGlass'
import { NexusGlyphTile, type NexusGlyphKind } from '@/components/nexus/NexusGlyphTile'
import { TasksSurface, addDays, fmtDue, localISO, type DueFilter, type Task } from '@/components/nexus/tasks/TasksSurface'
import CalendarViews from '@/components/nexus/CalendarViews'
import MessagesShell from '@/components/nexus/MessagesShell'
import { PriorityGlassPane } from '@/components/nexus/PriorityGlassPane'
import { SiteStatusModule } from '@/components/nexus/SiteStatusModule'
import { NEXUS_BG } from '@/components/nexus/NexusBackdrop'

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
  overdue?: boolean
  reason?: string | null
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
  'linear-gradient(90deg,#00A3FF,#00A3FF,#00A3FF)',
  'linear-gradient(90deg,#3f7fb8,#00A3FF)',
  'linear-gradient(90deg,#00A3FF,#7ec8e6)',
  'linear-gradient(90deg,#4a6a86,#7fb6cc)',
  'linear-gradient(90deg,#00A3FF,#00A3FF)',
]

function rgb(hex: string): string {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '95,184,224'
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
      style={{ background: 'linear-gradient(165deg,rgba(255,255,255,0.045),transparent 55%), linear-gradient(180deg,rgba(32,44,66,0.82),rgba(18,26,42,0.78))', backdropFilter: 'blur(18px) saturate(1.15)', border: '1px solid rgba(255,255,255,0.09)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.09), 0 2px 6px rgba(0,0,0,0.25), 0 28px 64px -30px rgba(0,0,0,0.85)' }}
    >
      {card.badge && (
        <div className="absolute right-4 top-4 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ background: 'rgba(13,20,32,0.5)', border: '1px solid rgba(255,255,255,0.18)', color: '#DCE6F0' }}>
          {card.badge}
        </div>
      )}
      <NexusGlyphTile kind={card.glyph} color={card.hex} />
      <div className="text-[17px] font-semibold leading-tight" style={{ color: '#F1F6FB' }}>{card.title}</div>
      <div className="mt-1.5 text-[13px] leading-relaxed" style={{ color: 'rgba(201,213,227,0.96)' }}>{card.subtitle}</div>
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
      <span className="font-medium text-slate-200">{label}</span>
      <span className="ml-0.5 font-bold text-slate-100">{value}</span>
    </div>
  )
  return (
    <div className="relative flex flex-col overflow-hidden rounded-3xl p-5" style={{ background: 'linear-gradient(165deg,rgba(255,255,255,0.045),transparent 55%), linear-gradient(180deg,rgba(32,44,66,0.82),rgba(18,26,42,0.78))', backdropFilter: 'blur(18px) saturate(1.15)', border: '1px solid rgba(255,255,255,0.09)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.09), 0 2px 6px rgba(0,0,0,0.25), 0 28px 64px -30px rgba(0,0,0,0.85)' }}>

      <div className="mb-4 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#00A3FF]">Summary</span>
        <span className="rounded-full border border-white/5 bg-slate-800/60 px-2.5 py-0.5 text-[10px] font-medium text-slate-200">Live data</span>
      </div>

      <div className="relative mb-1 flex items-center justify-center">
        <svg viewBox="0 0 200 128" className="h-28 w-56">
          <defs>
            <linearGradient id="otBz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9d6e2" /><stop offset="0.5" stopColor="#69788b" /><stop offset="1" stopColor="#202934" /></linearGradient>
            <linearGradient id="otPg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#00A3FF" /><stop offset="0.6" stopColor="#00A3FF" /><stop offset="1" stopColor="#DDF3FB" /></linearGradient>
            <radialGradient id="otHb" cx="0.38" cy="0.32"><stop offset="0" stopColor="#f6fafd" /><stop offset="0.5" stopColor="#9fb0c4" /><stop offset="1" stopColor="#232d3a" /></radialGradient>
            <filter id="otGl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="url(#otBz)" strokeWidth="15" strokeLinecap="round" />
          <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#141f2c" strokeWidth="8" strokeLinecap="round" />
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
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0B111E]/70 px-3 py-2 text-xs" style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)' }}>
        {pill('High', high, '#f43f5e')}
        {pill('Med', medium, '#fbbf24')}
        {pill('Low', low, '#94a3b8')}
      </div>

      <hr className="my-4 border-white/5" />

      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Leads</span>
        <span className="text-2xl font-extrabold text-white">{leadsTotal}</span>
      </div>
      <div className="mt-auto flex flex-col gap-2.5">
        {leadStages.length === 0 ? (
          <div className="text-[11px] text-slate-300">No leads yet.</div>
        ) : leadStages.map((st, i) => {
          const pct = Math.max(8, Math.min(100, (st.value / Math.max(1, leadsTotal)) * 100))
          return (
            <div key={st.label} className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium capitalize text-slate-200">{st.label}</span>
                <span className="font-semibold text-slate-200">{st.value}</span>
              </div>
              <div className="h-2.5 w-full rounded-full border border-white/10 bg-[#0B111E] p-[1px]" style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)' }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: LEAD_BAR_GRADIENTS[i % LEAD_BAR_GRADIENTS.length], boxShadow: '0 0 10px rgba(0,163,255,0.4)' }} />
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
      <div className={`mx-auto grid h-[calc(100dvh-2rem)] w-full max-w-5xl xl:max-w-none grid-cols-1 gap-4 overflow-hidden rounded-[2rem] p-5 shadow-2xl sm:h-[calc(100dvh-3rem)] ${actions ? 'lg:grid-cols-[1fr_260px]' : ''}`} style={{ background: NEXUS_BG, border: '1px solid rgba(150,180,210,0.22)', boxShadow: '0 30px 100px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
        <div className="min-h-0 overflow-y-auto pr-1 pb-24" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <NexusGlassBackButton label="Back to My Day" onClick={onClose} />
          <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: '#00A3FF' }}>My Day</div>
          <h2 className="mt-1 text-2xl font-semibold" style={{ color: 'rgba(255,255,255,0.96)' }}>{title}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.64)' }}>{subtitle}</p>
          <div className="mt-5 space-y-2">{children}</div>
        </div>
        {actions && (
          <aside className="min-h-0 overflow-y-auto rounded-3xl p-4 pb-24" style={{ background: 'linear-gradient(165deg,rgba(255,255,255,0.04),transparent 55%), linear-gradient(180deg,rgba(32,44,66,0.82),rgba(18,26,42,0.78))', border: '1px solid #1E293B', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
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
      style={muted ? { background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(0,163,255,0.08))', border: '1px solid rgba(255,255,255,0.22)', color: 'rgba(255,255,255,0.92)', boxShadow: '0 0 16px rgba(0,163,255,0.10), inset 0 1px 0 rgba(255,255,255,0.08)' } : disabled ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.82)' } : { background: 'rgba(0,163,255,0.12)', border: '1px solid rgba(0,163,255,0.3)', color: '#00A3FF' }}
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
    <div className="relative overflow-hidden rounded-2xl border p-4" style={{ background: 'linear-gradient(135deg,rgba(25,200,245,0.06),rgba(107,126,255,0.05)), linear-gradient(180deg,rgba(26,36,54,0.80),rgba(15,22,36,0.84))', borderColor: 'rgba(10,16,24,0.35)', boxShadow: '0 14px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.24)' }}>
      <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: '#00A3FF', boxShadow: '0 0 8px #00A3FF' }} /><span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">Today&apos;s Schedule</span></div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[#00A3FF]/35 bg-[#1E293B] px-2 py-0.5 text-[10px] text-[#00A3FF]">Live data</span>
          <button type="button" onClick={onClose} aria-label="Hide schedule preview" className="text-sm leading-none text-slate-300 hover:text-white">&times;</button>
        </div>
      </div>
      {events.length === 0 ? (
        <button type="button" onClick={onOpen} className="w-full py-6 text-center text-xs text-slate-300 hover:text-white">Nothing scheduled today &mdash; open calendar</button>
      ) : (
        <div className="space-y-1.5">
          {events.slice(0, 5).map((e) => (
            <button key={e.id} type="button" onClick={onOpen} className="flex w-full items-center justify-between rounded-lg border-l-2 bg-[#151D2A] px-2.5 py-2 text-left text-xs text-slate-200 transition-colors hover:bg-[#1E293B]" style={{ borderLeftColor: e.overdue ? '#f43f5e' : '#00A3FF' }}>
              <span className="truncate">{e.title}</span>
              {e.overdue
                ? <span className="ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: 'rgba(244,63,94,0.16)', color: '#fda4af', border: '1px solid rgba(244,63,94,0.4)' }}>Overdue</span>
                : <span className="ml-2 shrink-0 font-mono text-[10px] text-slate-200">{formatEventTime(e)}</span>}
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
    { key: 'low', label: 'Later', accent: '#94a3b8' },
  ]
  return (
    <div className="relative overflow-hidden rounded-2xl border p-4" style={{ background: 'linear-gradient(135deg,rgba(25,200,245,0.06),rgba(107,126,255,0.05)), linear-gradient(180deg,rgba(26,36,54,0.80),rgba(15,22,36,0.84))', borderColor: 'rgba(10,16,24,0.35)', boxShadow: '0 14px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.24)' }}>
      <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: '#00A3FF', boxShadow: '0 0 8px #00A3FF' }} /><span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">To-Dos</span></div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onOpen} className="rounded-full border border-slate-700 bg-slate-800/70 px-2 py-0.5 text-[10px] text-slate-300 hover:text-white">Open board</button>
          <button type="button" onClick={onClose} aria-label="Hide to-dos preview" className="text-sm leading-none text-slate-300 hover:text-white">&times;</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {cols.map((c) => {
          const colItems = items.filter((i) => i.urgency === c.key).slice(0, 3)
          return (
            <div key={c.key} className="space-y-1.5 rounded-xl border border-[#1E293B] bg-[#151D2A] p-2">
              <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: c.accent }} /><span className="text-[10px] font-bold uppercase tracking-wide text-slate-200">{c.label}</span></div>
              {colItems.length === 0 ? (
                <div className="py-1.5 text-[10px] text-slate-300">&mdash;</div>
              ) : colItems.map((i) => (
                <button key={i.id} type="button" onClick={onOpen} className="block w-full truncate rounded-md bg-[#1E293B] px-1.5 py-1 text-left text-[11px] text-slate-300 hover:bg-[#2f4358]">{i.title}</button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const C = { cyan: '#00A3E0', indigo: '#6B7EFF', safe: '#22C55E', warn: '#F59E0B', alert: '#EF4444', ink: '#eef4fb', ink2: '#9fb0c4', ink3: '#6d7f94' }
// Light look (white cards on the navy fade) — same palette as the Tasks screen.
const L = { ink: '#1D1D1F', ink2: '#3A3A3C', ink3: '#6E6E73', line: 'rgba(0,0,0,0.08)', blue: '#0071E3', red: '#D70015', green: '#30A14E', font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif' }
const CARD: React.CSSProperties = { background: '#FFFFFF', borderRadius: 14, boxShadow: '0 1px 2px rgba(10,20,40,0.06), 0 8px 24px rgba(10,20,40,0.08)' }
const DARK_BTN: React.CSSProperties = { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff' }

function MyRing({ size, pct, color, stroke = 6, children }: { size: number; pct: number; color: string; stroke?: number; children: React.ReactNode }) {
  const r = (size - stroke) / 2 - 1
  const circ = 2 * Math.PI * r
  const off = circ * (1 - Math.max(0, Math.min(100, pct)) / 100)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF0F4" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
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
  // Which filter the Tasks screen opens with (Open Tasks / Overdue / To-Dos cards).
  const [tasksDue, setTasksDue] = useState<DueFilter>('all')
  const openTasks = (due: DueFilter) => { setTasksDue(due); setTasksTaskId(null); setActivePanel('todos') }
  // A task to open straight away (from a ?task= link or a notification).
  const [tasksTaskId, setTasksTaskId] = useState<string | null>(null)
  const [myTasks, setMyTasks] = useState<Task[]>([])
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
      const tasksData = await fetch('/api/todos?view=mine&status=open,in_progress,waiting&limit=500').then(r => r.ok ? r.json() : null).catch(() => null) as { todos?: Task[] } | null
      if (tasksData?.todos) setMyTasks(tasksData.todos)
      const leadsData = await fetch('/api/crm/leads').then(r => r.json()).catch(() => [])
      setLeads(Array.isArray(leadsData) ? leadsData : [])
    } catch {
      // My Day still renders useful entry points when summary loading fails.
    }
  }, [])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  // A notification clicked while My Day is showing → open Tasks on that task.
  // (If Tasks is already open it listens for the same event and switches task itself.)
  useEffect(() => {
    function onOpenTask(e: Event) {
      const id = (e as CustomEvent<string>).detail
      if (!id) return
      setTasksTaskId(id)
      setActivePanel(p => { if (p !== 'todos') setTasksDue('all'); return 'todos' })
    }
    window.addEventListener('nexus:open-task', onOpenTask)
    return () => window.removeEventListener('nexus:open-task', onOpenTask)
  }, [])

  // Deep-link: returning from Gmail OAuth (?view=messages) opens the Messages panel.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const task = params.get('task')
    if (task) {
      setTasksDue('all'); setTasksTaskId(task); setActivePanel('todos')
      params.delete('task')
      const qs = params.toString()
      window.history.replaceState({}, '', qs ? `/?${qs}` : '/')
    }
    if (params.get('view') === 'messages') {
      setActivePanel('messages')
      params.delete('view')
      const qs = params.toString()
      window.history.replaceState({}, '', qs ? `/?${qs}` : '/')
    }
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
  const overdueCount = todayEvents.filter(e => e.overdue).length
  // Task numbers come from the real task list (same as the Tasks screen), not the top-10.
  const today = localISO()
  const weekEnd = addDays(today, 7) ?? today
  const openTasksList = myTasks.filter(t => t.status !== 'done')
  const taskOverdue = openTasksList.filter(t => !!t.due_date && t.due_date < today)
  const taskToday = openTasksList.filter(t => t.due_date === today)
  const taskHigh = openTasksList.filter(t => t.priority === 'high').length
  const byDue = (a: Task, b: Task) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')
  const taskGroups = [
    { label: 'Now', dot: '#FF3B30', items: openTasksList.filter(t => !!t.due_date && t.due_date <= today).sort(byDue).slice(0, 3) },
    { label: 'Next', dot: '#FF9500', items: openTasksList.filter(t => !!t.due_date && t.due_date > today && t.due_date <= weekEnd).sort(byDue).slice(0, 3) },
    { label: 'Later', dot: '#C7C7CC', items: openTasksList.filter(t => !t.due_date || t.due_date > weekEnd).sort(byDue).slice(0, 3) },
  ]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const openTaskById = (id: string) => { setTasksDue('all'); setTasksTaskId(id); setActivePanel('todos') }
  async function completeTask(id: string) {
    const prev = myTasks
    setMyTasks(ts => ts.map(t => t.id === id ? { ...t, status: 'done' } : t))
    const res = await fetch(`/api/todos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'done' }) }).catch(() => null)
    if (!res?.ok) setMyTasks(prev)
  }

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
    { id: 'schedule', title: "Today's Schedule", subtitle: nextEvent ? `Next: ${formatEventTime(nextEvent)} ${nextEvent.title}`.trim() : "See today's calendar, site visits, jobs, and appointments.", hex: '#00A3FF', glyph: 'schedule', badge: `${todayCount} today`, actionLabel: 'Open →' },
    { id: 'top10', title: "Today's Priorities", subtitle: workSignalCount > 0 ? `${workSignalCount} item${workSignalCount === 1 ? '' : 's'} need attention today.` : 'Important work will appear here when Nexus finds it.', hex: '#3f7fb8', glyph: 'priority', badge: workSignalCount > 0 ? `${workSignalCount}` : undefined, actionLabel: 'Open →' },
    { id: 'todos', title: 'To-Dos', subtitle: `${todoCount} due today. Open this list to review and finish tasks.`, hex: '#00A3FF', glyph: 'todo', actionLabel: 'Open →' },
    { id: 'messages', title: 'Messages', subtitle: 'Customer calls, emails, texts, and message notes that need attention.', hex: '#34D399', glyph: 'email', badge: messageCount > 0 ? `${messageCount}` : 'New', actionLabel: 'Open →' },
  ]

  if (relatedJobId) {
    return <MyDayRelatedJobGlass jobId={relatedJobId} onBack={() => { setRelatedJobId(null); setActivePanel('top10') }} onRefreshMyDay={loadSummary} />
  }

  return (
    <section className="w-full max-w-[1360px] px-1 sm:px-2" style={{ color: L.ink, fontFamily: L.font, letterSpacing: '-0.01em' }}>
      {/* Greeting — sits on the navy part of the fade */}
      <div className="mb-5 mt-2 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-[24px] font-semibold leading-tight sm:text-[30px]" style={{ color: '#fff', letterSpacing: '-0.025em' }}>{greeting}, {firstName}</h1>
          <div className="mt-1 text-[14px]" style={{ color: 'rgba(255,255,255,0.66)' }}>
            <b style={{ color: '#fff', fontWeight: 600 }}>{top10.length}</b> priorities · <b style={{ color: '#fff', fontWeight: 600 }}>{todayCount}</b> scheduled today
            {taskOverdue.length > 0 && <> · <span style={{ color: '#FF8A80' }}><b style={{ fontWeight: 600 }}>{taskOverdue.length}</b> overdue</span></>}
          </div>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button type="button" onClick={() => { window.location.href = '/quotes/new' }} className="flex h-[38px] min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-2 text-[13px] sm:gap-2 sm:px-4 sm:text-[14px] font-semibold sm:flex-none" style={{ background: L.blue, color: '#fff' }}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg> New quote
          </button>
          <button type="button" onClick={() => { window.location.href = '/dispatch' }} className="flex h-[38px] min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-2 text-[13px] sm:gap-2 sm:px-4 sm:text-[14px] font-medium sm:flex-none" style={DARK_BTN}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M14.7 6.3a4 4 0 1 0-5.4 5.4l-6 6 2 2 6-6a4 4 0 0 0 5.4-5.4l-2.8 2.8-2.4-2.4z" /></svg> Work order
          </button>
          <button type="button" onClick={() => { window.location.href = '/crm/leads' }} className="flex h-[38px] min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-2 text-[13px] sm:gap-2 sm:px-4 sm:text-[14px] font-medium sm:flex-none" style={DARK_BTN}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" /></svg> Add lead
          </button>
        </div>
      </div>

      {/* Four numbers */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:gap-3.5 lg:grid-cols-4">
        {[
          { l: 'Open tasks', v: openTasksList.length, s: `${taskHigh} high priority`, pct: Math.min(100, (openTasksList.length / 20) * 100), col: L.blue, red: false, onClick: () => openTasks('all') },
          { l: 'Overdue', v: taskOverdue.length, s: taskOverdue.length ? 'Needs attention' : 'All clear', pct: Math.min(100, (taskOverdue.length / 12) * 100), col: '#FF3B30', red: taskOverdue.length > 0, onClick: () => openTasks('overdue') },
          { l: 'Due today', v: taskToday.length, s: taskToday.length ? 'Due today' : 'Nothing due today', pct: Math.min(100, (taskToday.length / 8) * 100), col: L.blue, red: false, onClick: () => openTasks('today') },
          { l: 'Leads', v: leads.length, s: `${leadStages.length} stage${leadStages.length === 1 ? '' : 's'}`, pct: Math.min(100, (leads.length / 20) * 100), col: L.green, red: false, onClick: () => { window.location.href = '/crm/leads' } },
        ].map(m => (
          <button key={m.l} type="button" onClick={m.onClick} className="flex w-full min-w-0 items-center gap-2.5 p-3 text-left transition-transform hover:-translate-y-0.5 sm:gap-3.5 sm:px-[18px] sm:py-4" style={CARD}>
            <MyRing size={46} pct={m.pct} color={m.col} stroke={4.5}><span /></MyRing>
            <div className="min-w-0">
              <div className="text-[12px] font-medium" style={{ color: L.ink3 }}>{m.l}</div>
              <div className="mt-0.5 text-[22px] font-semibold leading-tight sm:text-[26px]" style={{ letterSpacing: '-0.02em' }}>{m.v}</div>
              <div className="mt-0.5 truncate text-[12px]" style={{ color: m.red ? L.red : L.ink3 }}>{m.s}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Schedule + Tasks */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="min-w-0 overflow-hidden" style={CARD}>
          <div className="flex items-center justify-between px-[18px] py-3.5" style={{ borderBottom: `1px solid ${L.line}` }}>
            <span className="text-[15px] font-semibold">Today&apos;s schedule</span>
            <button type="button" onClick={() => openCard(cards[0])} className="text-[13px] font-medium" style={{ color: L.blue }}>Open calendar</button>
          </div>
          {todayEvents.length === 0 ? (
            <div className="p-4">
              <button type="button" onClick={() => setAddEventOpen(true)} className="w-full rounded-[10px] py-8 text-center text-[13px]" style={{ color: L.ink3, border: '1px dashed rgba(0,0,0,0.15)' }}>Nothing scheduled today — add an event</button>
            </div>
          ) : todayEvents.slice(0, 6).map((e, i, arr) => {
            const isWO = e.type === 'work_order'
            const meta = [e.type?.replace(/_/g, ' '), e.reason].filter(Boolean).join(' · ')
            return (
              <button key={e.id} type="button" onClick={() => openCard(cards[0])} className="flex w-full items-center gap-3 px-[18px] py-[11px] text-left hover:bg-[#F7F8FA]" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${L.line}` : 'none' }}>
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={e.overdue ? { background: '#FFECEC', color: L.red } : { background: '#EEF4FF', color: L.blue }}>
                  {e.overdue
                    ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                    : isWO
                      ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M14.7 6.3a4 4 0 1 0-5.4 5.4l-6 6 2 2 6-6a4 4 0 0 0 5.4-5.4l-2.8 2.8-2.4-2.4z" /></svg>
                      : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18M8 2v4M16 2v4" /></svg>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{e.title}</span>
                  {meta && <span className="block truncate text-[12px] capitalize" style={{ color: L.ink3 }}>{meta}</span>}
                </span>
                {e.overdue
                  ? <span className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#FFECEC', color: L.red }}>Overdue</span>
                  : <span className="shrink-0 whitespace-nowrap text-[13px] tabular-nums" style={{ color: L.ink2 }}>{formatEventTime(e)}</span>}
              </button>
            )
          })}
        </div>

        <div className="min-w-0 overflow-hidden" style={CARD}>
          <div className="flex items-center justify-between px-[18px] py-3.5" style={{ borderBottom: `1px solid ${L.line}` }}>
            <span className="text-[15px] font-semibold">Tasks</span>
            <button type="button" onClick={() => openTasks('all')} className="text-[13px] font-medium" style={{ color: L.blue }}>Open board</button>
          </div>
          {openTasksList.length === 0 ? (
            <div className="px-[18px] py-8 text-center text-[13px]" style={{ color: L.ink3 }}>No open tasks. Nice.</div>
          ) : (
            <div className="pb-2">
              {taskGroups.map(g => g.items.length === 0 ? null : (
                <div key={g.label}>
                  <div className="flex items-center gap-[7px] px-[18px] pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.04em]" style={{ color: L.ink3 }}>
                    <span className="h-[7px] w-[7px] rounded-full" style={{ background: g.dot }} />{g.label}
                  </div>
                  {g.items.map(t => (
                    <div key={t.id} className="flex items-center gap-2.5 px-[18px] py-[7px] hover:bg-[#F7F8FA]">
                      <input type="checkbox" aria-label={`Mark done: ${t.title}`} checked={false} onChange={() => void completeTask(t.id)} className="h-4 w-4 flex-shrink-0 cursor-pointer" style={{ accentColor: L.blue }} />
                      <button type="button" onClick={() => openTaskById(t.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                        <span className="w-[38px] flex-shrink-0 font-mono text-[11px] font-semibold" style={{ color: L.ink3 }}>{t.key}</span>
                        <span className="min-w-0 flex-1 truncate text-[14px]">{t.title}</span>
                        <span className="shrink-0 whitespace-nowrap text-[12px]" style={{ color: t.due_date && t.due_date < today ? L.red : L.ink3 }}>{fmtDue(t.due_date)}</span>
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Site Status — role-scoped site overview (corporate: all + dealer filter; dealers: theirs) */}
      <SiteStatusModule />

      {/* Messages board (your saved message notes) */}
      <div className="mb-6 overflow-hidden" style={CARD}>
        <div className="flex items-center justify-between px-[18px] py-3.5" style={{ borderBottom: `1px solid ${L.line}` }}>
          <span className="text-[15px] font-semibold">Messages</span>
          <button type="button" onClick={() => openCard(cards[3])} className="text-[13px] font-medium" style={{ color: L.blue }}>Open inbox</button>
        </div>
        {messageNotes.length === 0 ? (
          <div className="p-4">
            <button type="button" onClick={() => openCard(cards[3])} className="w-full rounded-[10px] py-8 text-center text-[13px]" style={{ color: L.ink3, border: '1px dashed rgba(0,0,0,0.15)' }}>No messages yet — open the inbox to add one</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {messageNotes.slice(0, 6).map(note => (
              <button key={note.id} type="button" onClick={() => openCard(cards[3])} className="px-[18px] py-3.5 text-left hover:bg-[#F7F8FA]" style={{ borderBottom: `1px solid ${L.line}`, borderRight: `1px solid ${L.line}` }}>
                <div className="flex items-center gap-2 text-[13px] font-semibold">
                  <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full" style={{ background: '#1C2B47', color: '#fff' }}>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  </span>
                  Note
                  <span className="ml-auto text-[11px] font-normal" style={{ color: L.ink3 }}>{new Date(note.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </div>
                <div className="mt-1.5 line-clamp-2 text-[13px]" style={{ color: L.ink2 }}>{note.text}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {activePanel === 'schedule' && <DetailShell title="Schedule" subtitle="Your calendar — day, week, month, and list views." onClose={() => { setActivePanel(null); void loadSummary(); }}>
        <CalendarViews onChange={loadSummary} />
      </DetailShell>}

      {activePanel === 'top10' && <DetailShell title="Today's Priorities" subtitle="Highest urgency first. Tap one to open it and work it." onClose={() => { setActivePanel(null); void loadSummary(); }} actions={<div className="rounded-2xl p-3 text-[11px]" style={{ background: 'rgba(0,163,255,0.09)', border: '1px solid rgba(0,163,255,0.2)', color: 'rgba(226,232,240,0.72)' }}>Tap any priority to see why it matters and act — open the record, add a note, or mark it done.</div>}>
        <div className="rounded-[1.4rem] p-4" style={{ background: 'linear-gradient(135deg,rgba(25,200,245,0.06),rgba(107,126,255,0.05)), linear-gradient(180deg,rgba(26,36,54,0.80),rgba(15,22,36,0.84))', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 20px 44px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.28)' }}>
        {top10.length > 0 ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: 'rgba(244,63,94,0.12)', color: '#fda4af', border: '1px solid rgba(244,63,94,0.3)' }}>{highCount} high</span>
              <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: 'rgba(251,191,36,0.12)', color: '#fcd34d', border: '1px solid rgba(251,191,36,0.3)' }}>{medCount} medium</span>
              <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: 'rgba(148,163,184,0.14)', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.32)' }}>{lowCount} low</span>
            </div>
            <div className="space-y-2">
              {sortedTop10.map((item, index) => {
                const accent = item.urgency === 'high' ? '#f43f5e' : item.urgency === 'medium' ? '#fbbf24' : '#94a3b8'
                return (
                  <button key={`${item.type}-${item.id}`} type="button" onClick={() => { setSelectedTopItemId(item.id); setPriorityOpen(true) }} className="group relative w-full overflow-hidden rounded-2xl border border-black/30 py-3 pl-4 pr-3 text-left transition-all hover:-translate-y-0.5 hover:border-[#00A3FF]/45" style={{ background: 'linear-gradient(165deg,rgba(255,255,255,0.04),transparent 55%), linear-gradient(180deg,rgba(32,44,66,0.82),rgba(18,26,42,0.78))' }}>
                    <span className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-300">{index + 1}</span>
                          <span className="truncate text-sm font-semibold text-white">{item.title}</span>
                        </div>
                        <div className="mt-1 truncate text-[10.5px] capitalize text-slate-200">{item.reason} · {item.type.replace(/_/g, ' ')}</div>
                      </div>
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ background: `${accent}1f`, color: accent, border: `1px solid ${accent}59` }}>{item.urgency}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-black/30 px-3 py-6 text-center text-xs text-slate-300" style={{ background: 'linear-gradient(165deg,rgba(255,255,255,0.04),transparent 55%), linear-gradient(180deg,rgba(32,44,66,0.82),rgba(18,26,42,0.78))' }}>No priority items yet. Add an event or to-do to start building the day.</div>
        )}
        </div>
      </DetailShell>}

      {priorityOpen && selectedTopItem && (
        <PriorityGlassPane
          item={selectedTopItem}
          onBack={() => setPriorityOpen(false)}
          onRefresh={loadSummary}
          onOpenJob={(id) => { setPriorityOpen(false); setRelatedJobId(id) }}
        />
      )}

      {/* To-Dos opens the Tasks screen (board + list). TodoBoard.tsx is kept until Tasks is confirmed. */}
      {activePanel === 'todos' && <TasksSurface initialDue={tasksDue} initialTaskId={tasksTaskId} onClose={() => { setActivePanel(null); setTasksTaskId(null); void loadSummary(); }} />}

      {activePanel === 'messages' && <DetailShell title="Messages" subtitle="Conversations, calls, texts, and email in one place." onClose={() => { setActivePanel(null); void loadSummary(); }}>
        <div className="rounded-[1.4rem] p-4" style={{ background: 'linear-gradient(135deg,rgba(25,200,245,0.06),rgba(107,126,255,0.05)), linear-gradient(180deg,rgba(26,36,54,0.80),rgba(15,22,36,0.84))', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 20px 44px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.28)' }}>
        <MessagesShell />
        </div>
      </DetailShell>}

      <AddEventModal open={addEventOpen} onClose={() => setAddEventOpen(false)} onSaved={loadSummary} />
    </section>
  )
}
