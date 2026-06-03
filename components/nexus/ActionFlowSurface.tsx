'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type NexusTabId = 'my-day' | 'recent' | 'opps' | 'jobs' | 'field' | 'people'

type StepId = 'start' | 'lead-source' | 'research' | 'opportunity' | 'call-name' | 'call-property' | 'call-need' | 'call-review'

type FlowAction =
  | { kind: 'next'; stepId: StepId }
  | { kind: 'route'; href: string }
  | { kind: 'assistant'; prompt: string; scope: string }

type FlowCard = {
  title: string
  subtitle: string
  hex: string
  action: FlowAction
}

type InboundLeadDraft = {
  source: 'phone' | 'website' | 'unknown'
  contactName: string
  propertyName: string
  need: string
}

const EMPTY_DRAFT: InboundLeadDraft = {
  source: 'unknown',
  contactName: '',
  propertyName: '',
  need: '',
}

const STEPS: Record<Exclude<StepId, 'call-name' | 'call-property' | 'call-need' | 'call-review'>, { eyebrow: string; title: string; subtitle: string; cards: FlowCard[] }> = {
  start: {
    eyebrow: 'Revenue flow',
    title: 'What are we starting with?',
    subtitle: 'Pick one simple card. Nexus will guide the next step.',
    cards: [
      { title: 'Someone Called', subtitle: 'Capture a phone lead step by step.', hex: '#34d399', action: { kind: 'next', stepId: 'call-name' } },
      { title: 'Create Opportunity', subtitle: 'There is a real deal to work.', hex: '#6B7EFF', action: { kind: 'next', stepId: 'opportunity' } },
      { title: 'View Pipeline', subtitle: 'See active leads and open deals.', hex: '#fbbf24', action: { kind: 'route', href: '/crm' } },
    ],
  },
  'lead-source': {
    eyebrow: 'Create Lead / Step 1',
    title: 'Where did the lead come from?',
    subtitle: 'No forms yet. Pick the source, then Nexus asks one question at a time.',
    cards: [
      { title: 'Website Lead', subtitle: 'They came from the website or form.', hex: '#34d399', action: { kind: 'assistant', prompt: 'Create a new website lead. Ask me only for missing details one at a time.', scope: 'opps_leads' } },
      { title: 'Phone Call', subtitle: 'They called or texted about service.', hex: '#6B7EFF', action: { kind: 'next', stepId: 'call-name' } },
      { title: 'Research First', subtitle: 'Run property intel before outreach.', hex: '#a855f7', action: { kind: 'next', stepId: 'research' } },
    ],
  },
  research: {
    eyebrow: 'Create Lead / Research',
    title: 'Use intel before the sales move.',
    subtitle: 'Research the property, then turn it into a lead or pitch.',
    cards: [
      { title: 'Run ARIA', subtitle: 'Research a property or management company.', hex: '#a855f7', action: { kind: 'route', href: '/aria' } },
      { title: 'Pitch Brief', subtitle: 'Generate simple outreach notes.', hex: '#6B7EFF', action: { kind: 'assistant', prompt: 'Generate a pitch brief for the last ARIA search', scope: 'opps_leads' } },
      { title: 'Back', subtitle: 'Choose another lead path.', hex: '#34d399', action: { kind: 'next', stepId: 'lead-source' } },
    ],
  },
  opportunity: {
    eyebrow: 'Create Opportunity',
    title: 'What should happen with this deal?',
    subtitle: 'Start the deal, quote it, or schedule the next touch.',
    cards: [
      { title: 'New Deal', subtitle: 'Create an opportunity from scratch.', hex: '#6B7EFF', action: { kind: 'assistant', prompt: 'Create a new opportunity. Ask for account, deal name, value, and stage one at a time.', scope: 'opps_leads' } },
      { title: 'Generate Quote', subtitle: 'Start a quote or proposal.', hex: '#fbbf24', action: { kind: 'route', href: '/quotes/new' } },
      { title: 'Follow-Up', subtitle: 'Make sure the deal does not stall.', hex: '#34d399', action: { kind: 'assistant', prompt: 'Schedule a follow-up for this opportunity. Ask what account or deal it is for.', scope: 'opps_leads' } },
    ],
  },
}

function rgb(hex: string): string {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '107,126,255'
}

async function askNexus(prompt: string, scope: string, contextData?: Record<string, unknown>) {
  const res = await fetch('/api/assistant/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], scope, contextData }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message ?? 'Nexus could not complete that action.')
  return data?.response ?? data?.message ?? 'Nexus is ready for the next step.'
}

function FlowCardButton({ card, disabled, onAction }: { card: FlowCard; disabled: boolean; onAction: (action: FlowAction) => void }) {
  const color = rgb(card.hex)
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onAction(card.action)}
      className="group relative min-h-[132px] rounded-3xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60"
      style={{ background: `linear-gradient(145deg, rgba(${color},0.14), rgba(255,255,255,0.035))`, border: `1px solid rgba(${color},0.24)`, boxShadow: '0 18px 50px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.06)', backdropFilter: 'blur(18px)' }}
    >
      <div className="mb-4 h-8 w-8 rounded-2xl" style={{ background: `rgba(${color},0.28)`, border: `1px solid rgba(${color},0.34)` }} />
      <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>{card.title}</div>
      <div className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.42)' }}>{card.subtitle}</div>
      <div className="absolute bottom-4 right-4 text-xs opacity-45 transition-opacity group-hover:opacity-90" style={{ color: card.hex }}>Next</div>
    </button>
  )
}

function CaptureStep({ label, help, value, onChange, onNext, onBack }: { label: string; help: string; value: string; onChange: (v: string) => void; onNext: () => void; onBack: () => void }) {
  return (
    <div className="rounded-3xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <label className="block text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{label}</label>
      <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>{help}</p>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && value.trim()) onNext() }}
        className="mt-4 w-full rounded-2xl px-4 py-3 text-sm outline-none"
        style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(107,126,255,0.22)', color: 'rgba(255,255,255,0.88)' }}
        autoFocus
      />
      <div className="mt-4 flex justify-between gap-3">
        <button type="button" onClick={onBack} className="rounded-full px-4 py-2 text-xs" style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.52)' }}>Back</button>
        <button type="button" disabled={!value.trim()} onClick={onNext} className="rounded-full px-4 py-2 text-xs disabled:opacity-40" style={{ background: '#6B7EFF', color: 'white' }}>Next</button>
      </div>
    </div>
  )
}

export function ActionFlowSurface({ activeTab }: { activeTab: NexusTabId | null }) {
  const router = useRouter()
  const [stepId, setStepId] = useState<StepId>('start')
  const [draft, setDraft] = useState<InboundLeadDraft>(EMPTY_DRAFT)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const simpleStep = stepId === 'call-name' || stepId === 'call-property' || stepId === 'call-need' || stepId === 'call-review' ? null : STEPS[stepId]

  function resetFlow() {
    setStepId('start')
    setDraft(EMPTY_DRAFT)
    setStatus(null)
  }

  async function submitInboundLead() {
    setBusy(true)
    setStatus(null)
    try {
      const summary = `Create a new phone lead. Contact: ${draft.contactName}. Property: ${draft.propertyName}. Need: ${draft.need}. Create the lead and suggest the next best action.`
      const response = await askNexus(summary, 'opps_leads', { ...draft, source: 'phone' })
      setStatus(response)
      setStepId('start')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'That did not work. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleAction(action: FlowAction) {
    setStatus(null)
    if (action.kind === 'next') {
      if (action.stepId === 'call-name') setDraft({ ...EMPTY_DRAFT, source: 'phone' })
      setStepId(action.stepId)
      return
    }
    if (action.kind === 'route') {
      router.push(action.href)
      return
    }
    setBusy(true)
    try {
      setStatus(await askNexus(action.prompt, action.scope))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'That did not work. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-9 w-full max-w-4xl">
      <div className="rounded-[2rem] p-5 sm:p-6" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.022))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.06)', backdropFilter: 'blur(24px)' }}>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(107,126,255,0.62)' }}>{simpleStep?.eyebrow ?? 'Someone Called'}</div>
            <h2 className="mt-1 text-xl font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.94)' }}>{simpleStep?.title ?? 'Capture the lead one step at a time.'}</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.42)' }}>{simpleStep?.subtitle ?? 'No CRM training needed. Answer the simple question, then press Next.'}</p>
          </div>
          <div className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]" style={{ background: 'rgba(107,126,255,0.1)', color: 'rgba(165,180,255,0.9)', border: '1px solid rgba(107,126,255,0.18)' }}>
            {activeTab === 'opps' || !activeTab ? 'New Opps / Leads' : 'Guided Flow'}
          </div>
        </div>

        {simpleStep && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {simpleStep.cards.map(card => <FlowCardButton key={card.title} card={card} disabled={busy} onAction={handleAction} />)}
          </div>
        )}

        {stepId === 'call-name' && <CaptureStep label="Who called?" help="Type the person name. If you only know the company, enter that." value={draft.contactName} onChange={contactName => setDraft(prev => ({ ...prev, contactName }))} onNext={() => setStepId('call-property')} onBack={resetFlow} />}
        {stepId === 'call-property' && <CaptureStep label="What property or company?" help="Enter the property, management company, or account name." value={draft.propertyName} onChange={propertyName => setDraft(prev => ({ ...prev, propertyName }))} onNext={() => setStepId('call-need')} onBack={() => setStepId('call-name')} />}
        {stepId === 'call-need' && <CaptureStep label="What do they need?" help="Example: gate guard, camera monitoring, quote, service, or site walk." value={draft.need} onChange={need => setDraft(prev => ({ ...prev, need }))} onNext={() => setStepId('call-review')} onBack={() => setStepId('call-property')} />}

        {stepId === 'call-review' && (
          <div className="rounded-3xl p-4" style={{ background: 'rgba(52,211,153,0.055)', border: '1px solid rgba(52,211,153,0.18)' }}>
            <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>Ready to create the lead?</div>
            <div className="mt-3 grid gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.66)' }}>
              <div>Contact: {draft.contactName}</div>
              <div>Property: {draft.propertyName}</div>
              <div>Need: {draft.need}</div>
            </div>
            <div className="mt-4 flex justify-between gap-3">
              <button type="button" onClick={() => setStepId('call-need')} className="rounded-full px-4 py-2 text-xs" style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.52)' }}>Back</button>
              <button type="button" disabled={busy} onClick={submitInboundLead} className="rounded-full px-4 py-2 text-xs disabled:opacity-40" style={{ background: '#34d399', color: '#03130c' }}>Create Lead</button>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.28)' }}>Pick one card. Nexus gives the next obvious step.</div>
          {stepId !== 'start' && <button type="button" onClick={resetFlow} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>Start over</button>}
        </div>

        {(busy || status) && <div className="mt-4 rounded-2xl px-4 py-3 text-xs" style={{ background: 'rgba(107,126,255,0.08)', border: '1px solid rgba(107,126,255,0.16)', color: 'rgba(255,255,255,0.72)' }}>{busy ? 'Nexus is working...' : status}</div>}
      </div>
    </section>
  )
}
