'use client'

import { useCallback, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { ActionCommandBar } from '@/components/nexus/ActionCommandBar'
import { ActionFlowSurface, type NexusTabId } from '@/components/nexus/ActionFlowSurface'
import { CustomersSitesSurface } from '@/components/nexus/CustomersSitesSurface'
import { JobsSurface } from '@/components/nexus/JobsSurface'
import { MyDaySurface } from '@/components/nexus/MyDaySurface'
import { SalesSurface } from '@/components/nexus/SalesSurface'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

const NAV_ITEMS: { label: string; id: NexusTabId }[] = [
  { label: 'My Day', id: 'my-day' },
  { label: 'Sales', id: 'opps' },
  { label: 'Jobs', id: 'jobs' },
  { label: 'Customers/Sites', id: 'recent' },
  { label: 'Money/Docs', id: 'field' },
  { label: 'Internal', id: 'people' },
]

function NexusMark() {
  return (
    <div className="mb-6 flex flex-col items-center gap-3">
      <div
        style={{
          width: 72,
          height: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          filter: 'drop-shadow(0 0 26px rgba(0,124,255,0.62))',
        }}
      >
        <svg width="68" height="68" viewBox="0 0 68 68" fill="none" aria-hidden="true">
          <polygon points="34,4 52,12 64,28 64,40 52,56 34,64 16,56 4,40 4,28 16,12" stroke="rgba(255,255,255,0.92)" strokeWidth="1.4" fill="rgba(0,124,255,0.08)" />
          <polygon points="34,14 47,20 56,32 56,36 47,48 34,54 21,48 12,36 12,32 21,20" stroke="rgba(0,200,255,0.72)" strokeWidth="1" fill="none" />
          <circle cx="34" cy="34" r="9" stroke="rgba(255,255,255,0.35)" strokeWidth="1" fill="rgba(0,124,255,0.10)" />
          <line x1="34" y1="4" x2="34" y2="25" stroke="rgba(0,200,255,0.28)" strokeWidth="1" />
          <line x1="34" y1="43" x2="34" y2="64" stroke="rgba(0,200,255,0.28)" strokeWidth="1" />
          <line x1="4" y1="34" x2="25" y2="34" stroke="rgba(0,200,255,0.28)" strokeWidth="1" />
          <line x1="43" y1="34" x2="64" y2="34" stroke="rgba(0,200,255,0.28)" strokeWidth="1" />
          <circle cx="34" cy="34" r="2.5" fill="#00C8FF" />
        </svg>
      </div>
      <div className="text-center">
        <h1 className="text-4xl font-bold uppercase" style={{ color: 'rgba(255,255,255,0.97)', letterSpacing: '0.28em', lineHeight: 1, textShadow: '0 0 20px rgba(0,124,255,0.45)' }}>NEXUS</h1>
        <p className="text-xs uppercase" style={{ color: 'rgba(125,229,255,0.74)', letterSpacing: '0.22em', marginTop: 4 }}>by Gate Guard</p>
      </div>
    </div>
  )
}

async function postAssistant(messages: ChatMessage[]) {
  const res = await fetch('/api/assistant/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message ?? 'Something went wrong. Please try again.')
  if (data.type === 'action_cards') return data.title ?? 'Nexus found action cards for that request.'
  if (data.type === 'disambiguation') return data.prompt ?? 'What would you like to do next?'
  return data.response ?? data.message ?? 'Done.'
}

export default function NexusHomeClient() {
  const { user } = useUser()
  const firstName = user?.firstName ?? 'there'
  const [activeTab, setActiveTab] = useState<NexusTabId>('my-day')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleQuery = useCallback(async (query: string) => {
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
  }, [messages])

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,124,255,0.22) 0%, transparent 42%), radial-gradient(ellipse at 12% 32%, rgba(0,200,255,0.12) 0%, transparent 32%), radial-gradient(ellipse at 84% 18%, rgba(79,70,229,0.18) 0%, transparent 34%), linear-gradient(180deg, #020713 0%, #061426 48%, #01040d 100%)' }}>
      <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ backgroundImage: 'linear-gradient(rgba(0,200,255,0.095) 1px, transparent 1px), linear-gradient(90deg, rgba(0,124,255,0.095) 1px, transparent 1px)', backgroundSize: '48px 48px', maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.85), rgba(0,0,0,0.28) 62%, transparent)' }} />
      <div className="pointer-events-none absolute left-1/2 top-[24%]" aria-hidden="true" style={{ transform: 'translate(-50%, -50%)', width: 860, height: 360, background: 'radial-gradient(ellipse, rgba(0,124,255,0.22) 0%, rgba(0,200,255,0.10) 28%, transparent 70%)', borderRadius: '999px', filter: 'blur(10px)' }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" aria-hidden="true" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,200,255,0.55), transparent)' }} />

      <main className="relative z-10 flex flex-1 flex-col items-center px-6 pb-36 pt-16">
        <NexusMark />
        <p className="mb-7 text-center text-lg" style={{ color: 'rgba(255,255,255,0.48)' }}>
          Hi {firstName}, <span style={{ color: 'rgba(255,255,255,0.88)' }}>what are we working on today?</span>
        </p>
        <div className="w-full max-w-3xl rounded-[1.35rem]" style={{ boxShadow: '0 0 34px rgba(0,124,255,0.16), 0 0 1px rgba(0,200,255,0.5)' }}>
          <ActionCommandBar onSubmit={handleQuery} isLoading={isLoading} />
        </div>

        {messages.length > 0 && (
          <div className="mt-6 w-full max-w-2xl space-y-3">
            <button type="button" onClick={() => setMessages([])} className="text-xs transition-colors" style={{ color: 'rgba(255,255,255,0.28)' }}>Clear conversation</button>
            {messages.slice(-4).map((message, index) => (
              <div key={`${message.role}-${index}-${message.content.slice(0, 12)}`} className={message.role === 'user' ? 'ml-12 rounded-xl px-4 py-3 text-right text-sm leading-relaxed' : 'mr-12 rounded-xl px-4 py-3 text-sm leading-relaxed'} style={message.role === 'user' ? { background: 'linear-gradient(135deg, rgba(0,124,255,0.20), rgba(79,70,229,0.14))', border: '0.5px solid rgba(0,200,255,0.32)', color: 'rgba(255,255,255,0.9)' } : { background: 'rgba(8,18,34,0.68)', border: '0.5px solid rgba(59,130,246,0.16)', color: 'rgba(255,255,255,0.74)' }}>
                {message.content}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'my-day'
          ? <MyDaySurface />
          : activeTab === 'jobs'
            ? <JobsSurface />
            : activeTab === 'opps'
              ? <SalesSurface />
              : activeTab === 'recent'
                ? <CustomersSitesSurface />
                : <ActionFlowSurface activeTab={activeTab} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 flex justify-center overflow-x-auto px-4 pb-4 pt-3 backdrop-blur-xl" style={{ background: 'linear-gradient(180deg, rgba(1,4,13,0.12), rgba(1,4,13,0.86))', borderTop: '1px solid rgba(59,130,246,0.12)' }}>
        <div className="flex gap-1 rounded-[1.75rem] border px-2 py-2" style={{ background: 'linear-gradient(180deg, rgba(8,18,34,0.86), rgba(3,9,22,0.92))', borderColor: 'rgba(59,130,246,0.22)', boxShadow: '0 0 44px rgba(0,124,255,0.18), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
          {NAV_ITEMS.map(({ label, id }) => {
            const active = activeTab === id
            return (
              <button key={id} type="button" onClick={() => setActiveTab(id)} className="whitespace-nowrap rounded-2xl border px-5 py-2 text-sm transition-all duration-200" style={active ? { background: 'linear-gradient(135deg, rgba(0,124,255,0.42) 0%, rgba(0,200,255,0.16) 100%)', border: '1px solid rgba(0,200,255,0.42)', color: 'rgba(255,255,255,0.94)', boxShadow: '0 0 22px rgba(0,124,255,0.34), inset 0 1px 0 rgba(255,255,255,0.12)' } : { background: 'rgba(255,255,255,0.018)', border: '0.5px solid rgba(255,255,255,0.055)', color: 'rgba(255,255,255,0.42)' }}>
                {label}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
