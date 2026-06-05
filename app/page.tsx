'use client'

import { useCallback, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { ActionCommandBar } from '@/components/nexus/ActionCommandBar'
import { ActionFlowSurface, type NexusTabId } from '@/components/nexus/ActionFlowSurface'
import { JobsSurface } from '@/components/nexus/JobsSurface'
import { MyDaySurface } from '@/components/nexus/MyDaySurface'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

const NAV_ITEMS: { label: string; id: NexusTabId }[] = [
  { label: 'My Day', id: 'my-day' },
  { label: 'Recent Work', id: 'recent' },
  { label: 'New Opps/Leads', id: 'opps' },
  { label: 'Jobs', id: 'jobs' },
  { label: 'Field', id: 'field' },
  { label: 'People', id: 'people' },
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
          filter: 'drop-shadow(0 0 18px rgba(107,126,255,0.45))',
        }}
      >
        <svg width="68" height="68" viewBox="0 0 68 68" fill="none" aria-hidden="true">
          <polygon points="34,4 52,12 64,28 64,40 52,56 34,64 16,56 4,40 4,28 16,12" stroke="rgba(255,255,255,0.88)" strokeWidth="1.4" fill="none" />
          <polygon points="34,14 47,20 56,32 56,36 47,48 34,54 21,48 12,36 12,32 21,20" stroke="rgba(107,126,255,0.55)" strokeWidth="1" fill="none" />
          <circle cx="34" cy="34" r="9" stroke="rgba(255,255,255,0.35)" strokeWidth="1" fill="none" />
          <line x1="34" y1="4" x2="34" y2="25" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
          <line x1="34" y1="43" x2="34" y2="64" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
          <line x1="4" y1="34" x2="25" y2="34" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
          <line x1="43" y1="34" x2="64" y2="34" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
          <circle cx="34" cy="34" r="2.5" fill="rgba(107,126,255,0.9)" />
        </svg>
      </div>
      <div className="text-center">
        <h1 className="text-4xl font-bold uppercase" style={{ color: 'rgba(255,255,255,0.96)', letterSpacing: '0.28em', lineHeight: 1 }}>NEXUS</h1>
        <p className="text-xs uppercase" style={{ color: 'rgba(107,126,255,0.65)', letterSpacing: '0.22em', marginTop: 4 }}>by Gate Guard</p>
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

export default function NexusHome() {
  const { user } = useUser()
  const firstName = user?.firstName ?? 'there'
  const [activeTab, setActiveTab] = useState<NexusTabId>('opps')
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
    <div className="relative flex min-h-screen flex-col overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% 25%, #0a1628 0%, #050c1a 55%, #000208 100%)' }}>
      <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ backgroundImage: 'linear-gradient(rgba(107,126,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(107,126,255,0.1) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      <div className="pointer-events-none absolute" aria-hidden="true" style={{ top: '30%', left: '50%', transform: 'translate(-50%, -50%)', width: 700, height: 700, background: 'radial-gradient(circle, rgba(107,126,255,0.13) 0%, transparent 68%)', borderRadius: '50%' }} />

      <main className="relative z-10 flex flex-1 flex-col items-center px-6 pb-36 pt-16">
        <NexusMark />
        <p className="mb-7 text-center text-lg" style={{ color: 'rgba(255,255,255,0.38)' }}>
          Hi {firstName}, <span style={{ color: 'rgba(255,255,255,0.82)' }}>what are we working on today?</span>
        </p>
        <ActionCommandBar onSubmit={handleQuery} isLoading={isLoading} />

        {messages.length > 0 && (
          <div className="mt-6 w-full max-w-2xl space-y-3">
            <button type="button" onClick={() => setMessages([])} className="text-xs transition-colors" style={{ color: 'rgba(255,255,255,0.22)' }}>Clear conversation</button>
            {messages.slice(-4).map((message, index) => (
              <div key={`${message.role}-${index}-${message.content.slice(0, 12)}`} className={message.role === 'user' ? 'ml-12 rounded-xl px-4 py-3 text-right text-sm leading-relaxed' : 'mr-12 rounded-xl px-4 py-3 text-sm leading-relaxed'} style={message.role === 'user' ? { background: 'rgba(107,126,255,0.18)', border: '0.5px solid rgba(107,126,255,0.35)', color: 'rgba(255,255,255,0.88)' } : { background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.72)' }}>
                {message.content}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'my-day' ? <MyDaySurface /> : activeTab === 'jobs' ? <JobsSurface /> : <ActionFlowSurface activeTab={activeTab} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 flex justify-center gap-2 overflow-x-auto border-t border-white/5 bg-black/55 px-4 py-4 backdrop-blur-xl">
        {NAV_ITEMS.map(({ label, id }) => {
          const active = activeTab === id
          return (
            <button key={id} type="button" onClick={() => setActiveTab(id)} className="whitespace-nowrap rounded-full border px-5 py-2 text-sm transition-all duration-200" style={active ? { background: 'linear-gradient(135deg, rgba(107,126,255,0.28) 0%, rgba(107,126,255,0.1) 100%)', border: '1px solid rgba(107,126,255,0.55)', color: '#a5b4ff', boxShadow: '0 0 16px rgba(107,126,255,0.25)' } : { background: 'transparent', border: '0.5px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)' }}>
              {label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
