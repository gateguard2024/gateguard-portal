'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { routeCommand } from '@/lib/command-router'
import { NexusBackdropLayers } from '@/components/nexus/NexusBackdrop'
import { ActionFlowSurface, type NexusTabId } from '@/components/nexus/ActionFlowSurface'
import { CustomersSitesSurface } from '@/components/nexus/CustomersSitesSurface'
import DispatchConsole from '@/components/nexus/DispatchConsole'
import DesignExplorer from '@/components/nexus/DesignExplorer'
import CatalogSurface from '@/components/nexus/CatalogSurface'
import SystemsExplorer from '@/components/nexus/SystemsExplorer'
import { HelpSurface } from '@/components/nexus/HelpSurface'
import { InternalSurface } from '@/components/nexus/InternalSurface'
import { JobsSurface } from '@/components/nexus/JobsSurface'
import { MoneyDocsSurfaceNext } from '@/components/nexus/MoneyDocsSurfaceNext'
import { MyDaySurface } from '@/components/nexus/MyDaySurface'
import { SalesSurface } from '@/components/nexus/SalesSurface'
import { HowToWindow } from '@/components/nexus/HowToWindow'
import { EventsSurface } from '@/components/nexus/EventsSurface'
import { NotificationsBell } from '@/components/nexus/NotificationsBell'
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires
const { HelpCircle, Shield } = require('lucide-react') as any

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

// Signature brand gradient (matches the customer-portal look).
const BRAND = 'linear-gradient(135deg,#19C8F5 0%,#4A8CFF 52%,#6B7EFF 100%)'

const NAV_ITEMS: { label: string; id: NexusTabId }[] = [
  { label: 'My Day', id: 'my-day' },
  { label: 'Sales', id: 'opps' },
  { label: 'Operations', id: 'jobs' },
  { label: 'Design', id: 'design' },
  { label: 'Catalog', id: 'catalog' },
  { label: 'Systems', id: 'systems' },
  { label: 'Events', id: 'events' },
]

const NEXUS_VERSION = 'v2.4.0'

function NexusMark() {
  return (
    <div className="mb-6 flex flex-col items-center gap-3">
      <style>{`
        @keyframes nxGlow { 0%,100% { filter: drop-shadow(0 0 16px rgba(0,163,255,0.45)); } 50% { filter: drop-shadow(0 0 32px rgba(0,163,255,0.85)); } }
        @keyframes nxSpin { to { transform: rotate(360deg); } }
        @keyframes nxPing { 0% { transform: scale(0.55); opacity: 0.65; } 80%,100% { transform: scale(2.3); opacity: 0; } }
        @keyframes nxDot { 0%,100% { transform: scale(0.85); opacity: 0.8; } 50% { transform: scale(1.35); opacity: 1; } }
        .nx-glow { animation: nxGlow 3.4s ease-in-out infinite; }
        .nx-spin { transform-box: fill-box; transform-origin: center; animation: nxSpin 18s linear infinite; }
        .nx-ping, .nx-dot { transform-box: fill-box; transform-origin: center; }
        .nx-ping { animation: nxPing 2.8s ease-out infinite; }
        .nx-dot  { animation: nxDot 1.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .nx-glow, .nx-spin, .nx-ping, .nx-dot { animation: none !important; }
        }
      `}</style>
      <div className="nx-glow" style={{ width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="68" height="68" viewBox="0 0 68 68" fill="none" aria-hidden="true">
          <polygon points="34,4 52,12 64,28 64,40 52,56 34,64 16,56 4,40 4,28 16,12" stroke="rgba(255,255,255,0.92)" strokeWidth="1.4" fill="rgba(0,163,255,0.08)" />
          <polygon className="nx-spin" points="34,14 47,20 56,32 56,36 47,48 34,54 21,48 12,36 12,32 21,20" stroke="rgba(0,163,255,0.72)" strokeWidth="1" fill="none" />
          <circle className="nx-ping" cx="34" cy="34" r="9" stroke="rgba(0,163,255,0.55)" strokeWidth="1.2" fill="none" />
          <circle cx="34" cy="34" r="9" stroke="rgba(255,255,255,0.35)" strokeWidth="1" fill="rgba(0,163,255,0.10)" />
          <line x1="34" y1="4"  x2="34" y2="25" stroke="rgba(0,163,255,0.28)" strokeWidth="1" />
          <line x1="34" y1="43" x2="34" y2="64" stroke="rgba(0,163,255,0.28)" strokeWidth="1" />
          <line x1="4"  y1="34" x2="25" y2="34" stroke="rgba(0,163,255,0.28)" strokeWidth="1" />
          <line x1="43" y1="34" x2="64" y2="34" stroke="rgba(0,163,255,0.28)" strokeWidth="1" />
          <circle className="nx-dot" cx="34" cy="34" r="2.5" fill="#00A3FF" />
        </svg>
      </div>
      <div className="text-center">
        <h1 className="text-5xl font-extrabold uppercase" style={{ letterSpacing: '0.3em', lineHeight: 1, backgroundImage: 'linear-gradient(135deg,#9EE8FF 0%,#4A8CFF 50%,#9A8CFF 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent', filter: 'drop-shadow(0 0 24px rgba(74,140,255,0.6)) drop-shadow(0 1px 0 rgba(255,255,255,0.25))' }}>NEXUS</h1>
        <div className="mt-2 flex justify-center">
          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]" style={{ background: 'rgba(0,163,255,0.16)', border: '1px solid rgba(0,163,255,0.45)', color: '#7DE5FF' }}>Professional</span>
        </div>
        <p className="uppercase" style={{ letterSpacing: '0.22em', marginTop: 6 }}>
          <span className="text-xs" style={{ color: 'rgba(125,229,255,0.74)' }}>by </span>
          <span className="text-[15px] font-extrabold" style={{ backgroundImage: 'linear-gradient(135deg,#19C8F5,#6B7EFF)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent', filter: 'drop-shadow(0 0 12px rgba(74,140,255,0.55))' }}>Gate Guard</span>
        </p>
        <div className="mt-2 flex justify-center">
          <span className="rounded-md px-2 py-0.5 text-[10px] tracking-[0.14em]" style={{ fontFamily: 'var(--font-mono, ui-monospace, monospace)', color: 'rgba(226,232,240,0.72)', background: 'rgba(13,20,32,0.5)', border: '1px solid rgba(148,163,184,0.3)' }}>{NEXUS_VERSION}</span>
        </div>
      </div>
    </div>
  )
}

async function postAssistant(messages: ChatMessage[]) {
  const res = await fetch('/api/assistant/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages }) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message ?? 'Something went wrong. Please try again.')
  if (data.type === 'action_cards') return data.title ?? 'Nexus found action cards for that request.'
  if (data.type === 'disambiguation') return data.prompt ?? 'What would you like to do next?'
  return data.response ?? data.message ?? 'Done.'
}

export default function NexusHomeClient() {
  const { user } = useUser()
  const meta = (user?.publicMetadata ?? {}) as Record<string, unknown>
  const isAdmin =
    meta.org_tier === 'corporate' ||
    meta.org_tier === 'master_dealer' ||
    meta.role === 'admin' ||
    meta.role === 'supervisor'
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<NexusTabId>('my-day')
  const [navNonce, setNavNonce] = useState(0)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const goTab = useCallback((id: NexusTabId) => { setActiveTab(id); setNavNonce(n => n + 1) }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('view') === 'admin') {
      if (isAdmin) setActiveTab('people')
      params.delete('view')
      const qs = params.toString()
      window.history.replaceState({}, '', qs ? `/?${qs}` : '/')
    }
    const tab = params.get('tab') as NexusTabId | null
    if (tab && NAV_ITEMS.some(n => n.id === tab)) {
      setActiveTab(tab)
      params.delete('tab')
      const qs = params.toString()
      window.history.replaceState({}, '', qs ? `/?${qs}` : '/')
    }
  }, [isAdmin])

  useEffect(() => {
    function openAdmin() { if (isAdmin) setActiveTab('people') }
    window.addEventListener('nexus:open-admin', openAdmin)
    return () => window.removeEventListener('nexus:open-admin', openAdmin)
  }, [isAdmin])

  useEffect(() => {
    function navigate(e: Event) {
      const tab = (e as CustomEvent<string>).detail as NexusTabId | undefined
      if (tab && NAV_ITEMS.some(n => n.id === tab)) { setActiveTab(tab); setNavNonce(n => n + 1) }
    }
    window.addEventListener('nexus:navigate', navigate)
    return () => window.removeEventListener('nexus:navigate', navigate)
  }, [])

  // Open a task from a notification: on My Day already → tell it directly; otherwise
  // put ?task= in the URL and switch to My Day, which reads it on mount.
  const openTaskFromBell = useCallback((taskId: string) => {
    if (activeTab === 'my-day') { window.dispatchEvent(new CustomEvent('nexus:open-task', { detail: taskId })); return }
    const params = new URLSearchParams(window.location.search)
    params.set('task', taskId)
    window.history.replaceState({}, '', `/?${params.toString()}`)
    goTab('my-day')
  }, [activeTab, goTab])

  const handleQuery = useCallback(async (query: string) => {
    const cmd = routeCommand(query, isAdmin)
    if (cmd.kind === 'tab') { setActiveTab(cmd.tab); return }
    if (cmd.kind === 'route') { router.push(cmd.href); return }

    const nextMessages = [...messages, { role: 'user' as const, content: query }]
    setMessages(nextMessages)
    setIsLoading(true)
    try {
      const response = await postAssistant(nextMessages)
      setMessages(prev => [...prev, { role: 'assistant', content: response }])
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: error instanceof Error ? error.message : 'Something went wrong. Please try again.' }])
    } finally {
      setIsLoading(false)
    }
  }, [messages, isAdmin, router])

  return (
    <div className="relative flex h-screen flex-col overflow-hidden" style={activeTab === 'my-day'
      ? { background: "linear-gradient(180deg, rgba(5,9,16,0.58), rgba(5,9,16,0.74)), url('/myday-fabric.jpg') center / cover fixed" }
      : { background: 'linear-gradient(180deg,#141d2e 0%,#0e1521 55%,#0b111b 100%)' }}>
      {activeTab !== 'my-day' && (<>
        {/* ambient depth — new elevated look */}
        <div className="pointer-events-none absolute inset-0 z-0" style={{ background: 'radial-gradient(1100px 720px at 8% -8%, rgba(30,150,230,0.14), transparent 58%), radial-gradient(1100px 760px at 100% 112%, rgba(107,126,255,0.13), transparent 55%)' }} />
        <NexusBackdropLayers variant="hero" />
      </>)}

      {/* Rails removed — center content is full width now. */}
      <main className="relative z-10 flex flex-1 flex-col items-center overflow-y-auto px-6 pb-40 pt-4">
        <NexusMark />

        {messages.length > 0 && (
          <div className="mt-6 w-full max-w-2xl space-y-3">
            <button type="button" onClick={() => setMessages([])} className="text-xs transition-colors" style={{ color: 'rgba(255,255,255,0.82)' }}>Clear conversation</button>
            {messages.slice(-4).map((message, index) => (
              <div key={`${message.role}-${index}-${message.content.slice(0, 12)}`} className={message.role === 'user' ? 'ml-12 rounded-xl px-4 py-3 text-right text-sm leading-relaxed' : 'mr-12 rounded-xl px-4 py-3 text-sm leading-relaxed'} style={message.role === 'user' ? { background: 'linear-gradient(135deg, rgba(0,163,255,0.20), rgba(107,126,255,0.14))', border: '0.5px solid rgba(0,163,255,0.32)', color: 'rgba(255,255,255,0.9)' } : { background: 'rgba(8,18,34,0.68)', border: '0.5px solid rgba(59,130,246,0.16)', color: 'rgba(255,255,255,0.74)' }}>{message.content}</div>
            ))}
          </div>
        )}

        <div key={`${activeTab}-${navNonce}`} className="w-full flex justify-center">
          {activeTab === 'my-day' ? <MyDaySurface /> : activeTab === 'jobs' ? <JobsSurface onOpenDispatch={() => setActiveTab('dispatch')} /> : activeTab === 'opps' ? <SalesSurface /> : activeTab === 'recent' ? <CustomersSitesSurface /> : activeTab === 'dispatch' ? <DispatchConsole /> : activeTab === 'design' ? <DesignExplorer /> : activeTab === 'catalog' ? <CatalogSurface /> : activeTab === 'systems' ? <SystemsExplorer /> : activeTab === 'help' ? <HelpSurface /> : activeTab === 'field' ? <MoneyDocsSurfaceNext /> : activeTab === 'people' ? <InternalSurface /> : activeTab === 'events' ? <EventsSurface /> : <ActionFlowSurface activeTab={activeTab} />}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 flex justify-center overflow-x-auto px-4 pt-3 backdrop-blur-xl" style={{ background: 'linear-gradient(180deg, rgba(1,4,13,0.12), rgba(1,4,13,0.86))', borderTop: '1px solid rgba(59,130,246,0.12)', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center gap-1 rounded-[1.75rem] border px-2 py-2" style={{ background: 'linear-gradient(180deg, rgba(8,18,34,0.86), rgba(3,9,22,0.92))', borderColor: 'rgba(107,126,255,0.24)', boxShadow: '0 0 44px rgba(74,140,255,0.18), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
          {NAV_ITEMS.map(({ label, id }) => {
            const active = activeTab === id
            return <button key={id} type="button" onClick={() => goTab(id)} className="whitespace-nowrap rounded-2xl border px-5 py-2 text-sm transition-all duration-200" style={active ? { background: BRAND, border: '1px solid rgba(107,126,255,0.5)', color: '#041018', fontWeight: 700, boxShadow: '0 0 22px rgba(74,140,255,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' } : { background: 'rgba(255,255,255,0.018)', border: '0.5px solid rgba(255,255,255,0.055)', color: 'rgba(255,255,255,0.82)' }}>{label}</button>
          })}
          <div className="mx-1.5 h-6 w-px shrink-0" style={{ background: 'rgba(255,255,255,0.14)' }} />
          {/* Help + Admin relocated here from the removed left rail so nothing's lost. */}
          <button type="button" aria-label="Help" onClick={() => goTab('help')} title="Help" className="shrink-0 rounded-full p-2 transition-colors hover:opacity-90" style={{ color: 'rgba(255,255,255,0.6)' }}><HelpCircle size={16} /></button>
          {isAdmin && <button type="button" aria-label="Admin" onClick={() => goTab('people')} title="Admin" className="shrink-0 rounded-full p-2 transition-colors hover:opacity-90" style={{ color: 'rgba(255,255,255,0.45)' }}><Shield size={15} /></button>}
          <NotificationsBell onOpenTask={openTaskFromBell} />
          <div
            className="ml-0.5 h-8 w-8 shrink-0 rounded-full bg-cover bg-center"
            aria-label="You"
            style={user?.imageUrl
              ? { backgroundImage: `url(${user.imageUrl})`, border: '1px solid rgba(74,140,255,0.5)' }
              : { background: BRAND, border: '1px solid rgba(74,140,255,0.5)' }}
          />
        </div>
      </nav>

      {/* Movable how-to window — floats over any screen (#73) */}
      <HowToWindow />
    </div>
  )
}
