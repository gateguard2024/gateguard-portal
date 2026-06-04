'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LeadGlassWindow } from '@/components/nexus/windows/LeadGlassWindow'
import { OpportunityGlassWindow } from '@/components/nexus/windows/OpportunityGlassWindow'

export type NexusTabId = 'my-day' | 'recent' | 'opps' | 'jobs' | 'field' | 'people'

type StepId = 'start' | 'research' | 'opportunity' | 'call-name' | 'call-property' | 'call-need' | 'call-review' | 'workbench'

type FlowAction =
  | { kind: 'next'; stepId: StepId }
  | { kind: 'route'; href: string }
  | { kind: 'assistant'; prompt: string; scope: string }
  | { kind: 'workbench'; focus?: WorkbenchFocus }

type FlowCard = {
  title: string
  subtitle: string
  hex: string
  action: FlowAction
}

type NextCard = {
  title: string
  subtitle: string
  action: string
}

type InboundLeadDraft = {
  source: 'phone' | 'website' | 'unknown'
  contactName: string
  propertyName: string
  need: string
}

// WorkbenchRecord covers both leads (contact_name) and opportunities (name)
type WorkbenchRecord = {
  id: string
  name?: string | null
  contact_name?: string | null
  company?: string | null
  company_name?: string | null
  account_name?: string | null
  management_co?: string | null
  location?: string | null
  stage?: string | null
  source?: string | null
  value?: number | null
  notes?: string | null
  created_at?: string | null
}

type WorkbenchFocus = 'myLeads' | 'openLeads' | 'needsAttention' | 'openOpportunities' | 'proposalFollowUps' | 'search'

type WorkbenchData = {
  stats?: Record<string, number>
  myLeads?: WorkbenchRecord[]
  openLeads?: WorkbenchRecord[]
  needsAttention?: WorkbenchRecord[]
  openOpportunities?: WorkbenchRecord[]
  proposalFollowUps?: WorkbenchRecord[]
  leads?: WorkbenchRecord[]
  opportunities?: WorkbenchRecord[]
}

const EMPTY_DRAFT: InboundLeadDraft = {
  source: 'unknown',
  contactName: '',
  propertyName: '',
  need: '',
}

const STEPS: Record<Exclude<StepId, 'call-name' | 'call-property' | 'call-need' | 'call-review' | 'workbench'>, { eyebrow: string; title: string; subtitle: string; cards: FlowCard[] }> = {
  start: {
    eyebrow: 'Revenue flow',
    title: 'What are we doing with revenue today?',
    subtitle: 'Create something new or work what is already open.',
    cards: [
      { title: 'Someone Called', subtitle: 'Capture a phone lead step by step.', hex: '#34d399', action: { kind: 'next', stepId: 'call-name' } },
      { title: 'Work Existing Leads', subtitle: 'Open leads, opportunities, follow-ups, and search.', hex: '#6B7EFF', action: { kind: 'workbench', focus: 'myLeads' } },
      { title: 'Create Opportunity', subtitle: 'There is a real deal to work.', hex: '#fbbf24', action: { kind: 'next', stepId: 'opportunity' } },
    ],
  },
  research: {
    eyebrow: 'Create Lead / Research',
    title: 'Use intel before the sales move.',
    subtitle: 'Research the property, then turn it into a lead or pitch.',
    cards: [
      { title: 'Run ARIA', subtitle: 'Research a property or management company.', hex: '#a855f7', action: { kind: 'route', href: '/aria' } },
      { title: 'Pitch Brief', subtitle: 'Generate simple outreach notes.', hex: '#6B7EFF', action: { kind: 'assistant', prompt: 'Generate a pitch brief for the last ARIA search', scope: 'opps_leads' } },
      { title: 'Back', subtitle: 'Return to revenue choices.', hex: '#34d399', action: { kind: 'next', stepId: 'start' } },
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

const WORKBENCH_LABELS: Record<WorkbenchFocus, string> = {
  myLeads: 'My Leads',
  openLeads: 'Open Leads',
  needsAttention: 'Needs Attention Today',
  openOpportunities: 'Open Opportunities',
  proposalFollowUps: 'Proposal Follow-Ups',
  search: 'Search Person / Property',
}

function rgb(hex: string): string {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '107,126,255'
}

// Leads from the API have contact_name; opportunities have name
function isLeadRecord(record: WorkbenchRecord): boolean {
  return 'contact_name' in record
}

function recordDisplayName(record: WorkbenchRecord): string {
  return record.contact_name ?? record.name ?? 'Untitled'
}

function recordDisplayCompany(record: WorkbenchRecord): string {
  return record.company_name ?? record.company ?? record.account_name ?? record.management_co ?? 'No property or company attached'
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

async function createInboundLead(
  draft: InboundLeadDraft
): Promise<{ message: string; nextCards: NextCard[]; leadId?: string }> {
  const res = await fetch('/api/nexus/flows/inbound-lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...draft, source: 'phone' }),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok || data.success === false) {
    throw new Error(data?.message ?? 'Could not create lead.')
  }

  return {
    message: data.message ?? 'Lead created.',
    nextCards: Array.isArray(data.nextCards) ? data.nextCards : [],
    leadId: typeof data?.lead?.id === 'string' ? data.lead.id : undefined,
  }
}

async function loadWorkbench(query?: string): Promise<WorkbenchData> {
  const url = query?.trim()
    ? `/api/nexus/opps/workbench?q=${encodeURIComponent(query.trim())}`
    : '/api/nexus/opps/workbench'
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) throw new Error(data?.message ?? 'Could not load workbench.')
  return data as WorkbenchData
}

async function fetchLeadWindow(id: string): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/nexus/opps/lead-window/${id}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) throw new Error(data?.message ?? 'Could not open lead.')
  return data
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

function RecordList({ records, emptyText, onLeadClick, onOpportunityClick, leadWindowBusy, opportunityWindowBusy, loadingLeadId, loadingOpportunityId }: {
  records: WorkbenchRecord[]
  emptyText: string
  onLeadClick?: (id: string) => void
  onOpportunityClick?: (id: string) => void
  leadWindowBusy?: boolean
  opportunityWindowBusy?: boolean
  loadingLeadId?: string | null
  loadingOpportunityId?: string | null
}) {
  if (records.length === 0) {
    return <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.42)' }}>{emptyText}</div>
  }

  return (
    <div className="space-y-2">
      {records.map(record => {
        const isLead = isLeadRecord(record)
        const isOpp = !isLead
        const clickable = (isLead && !!onLeadClick) || (isOpp && !!onOpportunityClick)
        const isLoading = (isLead && leadWindowBusy && loadingLeadId === record.id) ||
                          (isOpp && opportunityWindowBusy && loadingOpportunityId === record.id)

        return (
          <div
            key={record.id}
            onClick={clickable ? () => isLead ? onLeadClick!(record.id) : onOpportunityClick!(record.id) : undefined}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') isLead ? onLeadClick!(record.id) : onOpportunityClick!(record.id) } : undefined}
            className={clickable ? 'rounded-2xl p-4 transition-all cursor-pointer hover:-translate-y-0.5' : 'rounded-2xl p-4'}
            style={{
              background: isLoading ? 'rgba(107,126,255,0.12)' : 'rgba(255,255,255,0.035)',
              border: isLoading ? '1px solid rgba(107,126,255,0.28)' : '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                    {isLoading ? 'Opening...' : recordDisplayName(record)}
                  </div>
                  {clickable && !isLoading && (
                    <span className="text-[10px] opacity-40" style={{ color: 'rgba(107,126,255,0.9)' }}>Open →</span>
                  )}
                </div>
                <div className="mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {recordDisplayCompany(record)}
                </div>
              </div>
              <div className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em]" style={{ background: 'rgba(107,126,255,0.1)', color: 'rgba(165,180,255,0.9)', border: '1px solid rgba(107,126,255,0.18)', whiteSpace: 'nowrap' }}>
                {record.stage ?? 'open'}
              </div>
            </div>
            {record.notes && <div className="mt-3 line-clamp-2 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>{record.notes}</div>}
          </div>
        )
      })}
    </div>
  )
}

export function ActionFlowSurface({ activeTab }: { activeTab: NexusTabId | null }) {
  const router = useRouter()
  const [stepId, setStepId] = useState<StepId>('start')
  const [draft, setDraft] = useState<InboundLeadDraft>(EMPTY_DRAFT)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [nextCards, setNextCards] = useState<NextCard[]>([])
  const [workbench, setWorkbench] = useState<WorkbenchData | null>(null)
  const [workbenchFocus, setWorkbenchFocus] = useState<WorkbenchFocus>('openLeads')
  const [searchTerm, setSearchTerm] = useState('')

  // Lead Glass Window state
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [leadWindowData, setLeadWindowData] = useState<Record<string, unknown> | null>(null)
  const [leadWindowBusy, setLeadWindowBusy] = useState(false)
  const [loadingLeadId, setLoadingLeadId] = useState<string | null>(null)

  // Opportunity Glass Window state
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null)
  const [opportunityWindowData, setOpportunityWindowData] = useState<Record<string, unknown> | null>(null)
  const [opportunityWindowBusy, setOpportunityWindowBusy] = useState(false)
  const [loadingOpportunityId, setLoadingOpportunityId] = useState<string | null>(null)

  const simpleStep = stepId === 'call-name' || stepId === 'call-property' || stepId === 'call-need' || stepId === 'call-review' || stepId === 'workbench' ? null : STEPS[stepId]

  function resetFlow() {
    setStepId('start')
    setDraft(EMPTY_DRAFT)
    setStatus(null)
    setNextCards([])
  }

  function closeLeadWindow() {
    setSelectedLeadId(null)
    setLeadWindowData(null)
    // Workbench data preserved — returns to prior view instantly, no re-fetch
  }

  // Refresh the open lead window in place after an action (note/call/followup/status)
  // Does NOT reset workbench data or re-fetch workbench
  async function refreshOpenLead() {
    if (!selectedLeadId) return
    try {
      const data = await fetchLeadWindow(selectedLeadId)
      setLeadWindowData(data)
    } catch {
      // Best-effort — if refresh fails, existing data stays visible
    }
  }

  async function openOpportunity(id: string) {
    setOpportunityWindowBusy(true)
    setLoadingOpportunityId(id)
    try {
      const res = await fetch(`/api/nexus/opps/opportunity-window/${id}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error(data?.message ?? 'Could not open opportunity.')
      setSelectedOpportunityId(id)
      setOpportunityWindowData(data)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not open opportunity.')
    } finally {
      setOpportunityWindowBusy(false)
      setLoadingOpportunityId(null)
    }
  }

  function closeOpportunityWindow() {
    setSelectedOpportunityId(null)
    setOpportunityWindowData(null)
    // Workbench data preserved — no re-fetch
  }

  async function openLead(id: string) {
    setLeadWindowBusy(true)
    setLoadingLeadId(id)
    try {
      const data = await fetchLeadWindow(id)
      setSelectedLeadId(id)
      setLeadWindowData(data)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not open lead. Try again.')
    } finally {
      setLeadWindowBusy(false)
      setLoadingLeadId(null)
    }
  }

  async function openWorkbench(focus: WorkbenchFocus = 'openLeads') {
    setBusy(true)
    setStatus(null)
    setNextCards([])
    try {
      const data = await loadWorkbench(focus === 'search' ? searchTerm : undefined)
      setWorkbench(data)
      setWorkbenchFocus(focus)
      setStepId('workbench')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load workbench.')
    } finally {
      setBusy(false)
    }
  }

  async function submitInboundLead() {
  setBusy(true)
  setStatus(null)
  setNextCards([])

  try {
    const result = await createInboundLead(draft)

    setStatus(result.message)
    setNextCards(result.nextCards)
    setDraft(EMPTY_DRAFT)

    if (result.leadId) {
      await openLead(result.leadId)
    } else {
      await openWorkbench('myLeads')
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'That did not work. Try again.')
  } finally {
    setBusy(false)
  }
}

  async function handleAction(action: FlowAction) {
    setStatus(null)
    setNextCards([])
    if (action.kind === 'workbench') {
      await openWorkbench(action.focus ?? 'openLeads')
      return
    }
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

  const focusedRecords = workbenchFocus === 'search'
    ? [...(workbench?.leads ?? []), ...(workbench?.opportunities ?? [])]
    : workbench?.[workbenchFocus] ?? []

  const focusedEmptyText = workbenchFocus === 'myLeads'
    ? 'No leads assigned to you yet.'
    : workbenchFocus === 'needsAttention'
    ? 'All leads have been touched recently.'
    : 'Nothing found here yet.'

  return (
    <section className="mt-9 w-full max-w-4xl">
      <div className="rounded-[2rem] p-5 sm:p-6" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.022))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.06)', backdropFilter: 'blur(24px)' }}>

        {/* ── Lead Glass Window ── */}
        {selectedLeadId && leadWindowData && (
          <LeadGlassWindow
            data={leadWindowData as Parameters<typeof LeadGlassWindow>[0]['data']}
            onBack={closeLeadWindow}
            onRefresh={refreshOpenLead}
            onOpenOpportunity={async (id: string) => {
              closeLeadWindow()
              await openOpportunity(id)
            }}
          />
        )}

        {/* ── Opportunity Glass Window ── */}
        {!selectedLeadId && selectedOpportunityId && opportunityWindowData && (
          <OpportunityGlassWindow
            data={opportunityWindowData as Parameters<typeof OpportunityGlassWindow>[0]['data']}
            onBack={closeOpportunityWindow}
          />
        )}

        {/* ── Normal flow — hidden while any glass window is active ── */}
        {!(selectedLeadId && leadWindowData) && !(selectedOpportunityId && opportunityWindowData) && (
          <>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(107,126,255,0.62)' }}>{stepId === 'workbench' ? 'Opps / Leads Workbench' : simpleStep?.eyebrow ?? 'Someone Called'}</div>
                <h2 className="mt-1 text-xl font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.94)' }}>{stepId === 'workbench' ? 'Work what is already open.' : simpleStep?.title ?? 'Capture the lead one step at a time.'}</h2>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.42)' }}>{stepId === 'workbench' ? 'Open leads, attention items, opportunities, proposal follow-ups, or search by person/property.' : simpleStep?.subtitle ?? 'No CRM training needed. Answer the simple question, then press Next.'}</p>
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

            {stepId === 'workbench' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                  {(['myLeads', 'openLeads', 'needsAttention', 'openOpportunities', 'proposalFollowUps', 'search'] as WorkbenchFocus[]).map(focus => (
                    <button key={focus} type="button" onClick={() => void openWorkbench(focus)} className="rounded-2xl p-3 text-left text-xs transition-all" style={{ background: workbenchFocus === focus ? 'rgba(107,126,255,0.16)' : 'rgba(255,255,255,0.035)', border: workbenchFocus === focus ? '1px solid rgba(107,126,255,0.32)' : '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.78)' }}>
                      <div className="font-semibold">{WORKBENCH_LABELS[focus]}</div>
                      {focus !== 'search' && <div className="mt-1 opacity-50">{workbench?.stats?.[focus] ?? 0} items</div>}
                    </button>
                  ))}
                </div>

                {workbenchFocus === 'search' && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void openWorkbench('search') }} placeholder="Search person, property, company, or notes" className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(107,126,255,0.22)', color: 'rgba(255,255,255,0.88)' }} />
                    <button type="button" onClick={() => void openWorkbench('search')} className="rounded-2xl px-4 py-3 text-sm" style={{ background: '#6B7EFF', color: 'white' }}>Search</button>
                  </div>
                )}

                <RecordList
                  records={focusedRecords}
                  emptyText={focusedEmptyText}
                  onLeadClick={openLead}
                  onOpportunityClick={openOpportunity}
                  leadWindowBusy={leadWindowBusy}
                  opportunityWindowBusy={opportunityWindowBusy}
                  loadingLeadId={loadingLeadId}
                  loadingOpportunityId={loadingOpportunityId}
                />
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

            {nextCards.length > 0 && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {nextCards.map(card => (
                  <div key={card.title} className="rounded-2xl p-4" style={{ background: 'rgba(52,211,153,0.055)', border: '1px solid rgba(52,211,153,0.16)', color: 'rgba(255,255,255,0.82)' }}>
                    <div className="text-sm font-semibold">{card.title}</div>
                    <div className="mt-1 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{card.subtitle}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.28)' }}>Pick one card. Nexus gives the next obvious step.</div>
              {stepId !== 'start' && <button type="button" onClick={resetFlow} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>Start over</button>}
            </div>

            {(busy || status) && <div className="mt-4 rounded-2xl px-4 py-3 text-xs" style={{ background: 'rgba(107,126,255,0.08)', border: '1px solid rgba(107,126,255,0.16)', color: 'rgba(255,255,255,0.72)' }}>{busy ? 'Nexus is working...' : status}</div>}
          </>
        )}
      </div>
    </section>
  )
}
