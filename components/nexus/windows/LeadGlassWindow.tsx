'use client'

import { useState } from 'react'

type AnyRecord = Record<string, any>

type LeadAction = 'add_note' | 'log_call' | 'schedule_followup' | 'update_status'

type LeadGlassData = {
  lead?: AnyRecord | null
  people?: {
    primaryContact?: AnyRecord | null
    contacts?: AnyRecord[]
  }
  company?: AnyRecord | null
  properties?: {
    linked?: AnyRecord[]
    possible?: AnyRecord[]
    sites?: AnyRecord[]
  }
  activity?: {
    activities?: AnyRecord[]
    crmActivities?: AnyRecord[]
  }
  todos?: AnyRecord[]
  attachments?: AnyRecord[]
  surveys?: AnyRecord[]
  opportunities?: AnyRecord[]
  nextBestActions?: Array<{ title: string; subtitle: string; action: string }>
}

function val(v: unknown, fallback = 'Not added yet') {
  if (v === null || v === undefined || v === '') return fallback
  return String(v)
}

function personName(person?: AnyRecord | null) {
  if (!person) return 'No contact linked yet'
  return [person.first_name, person.last_name].filter(Boolean).join(' ') || person.contact_name || person.name || 'Unnamed contact'
}

function Section({ title, children, count }: { title: string; children: React.ReactNode; count?: number }) {
  return (
    <div className="rounded-3xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{title}</div>
        {typeof count === 'number' && count > 0 && (
          <div className="rounded-full px-2 py-1 text-[10px]" style={{ background: 'rgba(107,126,255,0.12)', color: 'rgba(165,180,255,0.9)' }}>{count}</div>
        )}
      </div>
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>{text}</div>
}

function MiniRow({ title, subtitle, meta }: { title: string; subtitle?: string; meta?: string }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.16)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.84)' }}>{title}</div>
        {meta && <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)', whiteSpace: 'nowrap' }}>{meta}</div>}
      </div>
      {subtitle && <div className="mt-1 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.42)' }}>{subtitle}</div>}
    </div>
  )
}

function ListBlock({ records, emptyText, render }: { records?: AnyRecord[]; emptyText: string; render: (record: AnyRecord) => React.ReactNode }) {
  if (!records || records.length === 0) return <Empty text={emptyText} />
  return <div className="space-y-2">{records.slice(0, 6).map((record, index) => <div key={record.id ?? index}>{render(record)}</div>)}</div>
}

function DuplicateGuardSection({ data }: { data: LeadGlassData }) {
  const contacts = data.people?.contacts ?? []
  const company = data.company
  const possibleProperties = data.properties?.possible ?? []
  const sites = data.properties?.sites ?? []
  const opportunities = data.opportunities ?? []

  const hasContacts = contacts.length > 0
  const hasCompany = !!company
  const hasProperties = possibleProperties.length > 0
  const hasSites = sites.length > 0
  const hasOpps = opportunities.length > 0
  const totalMatches = (hasContacts ? contacts.length : 0) + (hasCompany ? 1 : 0) + possibleProperties.length + sites.length + opportunities.length

  return (
    <Section title="Possible Matches — Duplicate Guard" count={totalMatches}>
      <p className="mb-4 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>
        Before creating new records, check these existing matches. Update and link instead of duplicating.
        Display only — no actions yet.
      </p>

      {/* Contact Matches */}
      <div className="mb-3">
        <div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(107,126,255,0.7)' }}>
          Possible Contact Matches ({contacts.length})
        </div>
        <ListBlock
          records={contacts}
          emptyText="No possible contact matches found."
          render={contact => (
            <MiniRow
              title={personName(contact)}
              subtitle={[contact.title, contact.email, contact.phone].filter(Boolean).join(' • ')}
              meta="Contact"
            />
          )}
        />
      </div>

      {/* Company Matches */}
      <div className="mb-3">
        <div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(107,126,255,0.7)' }}>
          Possible Company Matches ({hasCompany ? 1 : 0})
        </div>
        {hasCompany ? (
          <MiniRow
            title={val(company!.name, 'Possible company')}
            subtitle={[company!.website, company!.city, company!.state].filter(Boolean).join(' • ')}
            meta="Company"
          />
        ) : (
          <Empty text="No possible company matches found." />
        )}
      </div>

      {/* Property Matches */}
      <div className="mb-3">
        <div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(107,126,255,0.7)' }}>
          Possible Property Matches ({possibleProperties.length})
        </div>
        <ListBlock
          records={possibleProperties}
          emptyText="No possible property matches found."
          render={property => (
            <MiniRow
              title={val(property.name, 'Possible property')}
              subtitle={[property.address, property.city, property.state].filter(Boolean).join(', ')}
              meta={property.unit_count ? `${property.unit_count} units` : 'Property'}
            />
          )}
        />
      </div>

      {/* Site Matches */}
      <div className="mb-3">
        <div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(107,126,255,0.7)' }}>
          Possible Site Matches ({sites.length})
        </div>
        <ListBlock
          records={sites}
          emptyText="No possible site matches found."
          render={site => (
            <MiniRow
              title={val(site.name, 'Possible site')}
              subtitle={[site.address, site.city, site.state].filter(Boolean).join(', ')}
              meta={site.units ? `${site.units} units` : 'Site'}
            />
          )}
        />
      </div>

      {/* Opportunity Matches */}
      <div>
        <div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(107,126,255,0.7)' }}>
          Possible Opportunity Matches ({opportunities.length})
        </div>
        <ListBlock
          records={opportunities}
          emptyText="No possible opportunity matches found."
          render={opp => (
            <MiniRow
              title={val(opp.name, 'Possible opportunity')}
              subtitle={[opp.account_name, opp.next_step].filter(Boolean).join(' • ')}
              meta={val(opp.stage, 'Opportunity')}
            />
          )}
        />
      </div>
    </Section>
  )
}

function MiniStat({ label, value: statValue }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.16)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.34)' }}>{label}</div>
      <div className="mt-1 truncate text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.82)' }}>{statValue}</div>
    </div>
  )
}

export function LeadGlassWindow({
  data,
  onBack,
  onRefresh,
}: {
  data: LeadGlassData
  onBack: () => void
  onRefresh?: () => Promise<void> | void
}) {
  const lead = data.lead ?? {}
  const contacts = data.people?.contacts ?? []
  const primaryContact = data.people?.primaryContact
  const company = data.company
  const linkedProperties = data.properties?.linked ?? []
  const possibleProperties = data.properties?.possible ?? []
  const sites = data.properties?.sites ?? []
  const activities = [...(data.activity?.crmActivities ?? []), ...(data.activity?.activities ?? [])]
  const nextBestActions = data.nextBestActions ?? []

  // ── Action state ─────────────────────────────────────────────────────────────
  const [activeAction, setActiveAction] = useState<LeadAction | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [callSummary, setCallSummary] = useState('')
  const [callOutcome, setCallOutcome] = useState('')
  const [callDuration, setCallDuration] = useState('')
  const [followupTitle, setFollowupTitle] = useState('Follow up on lead')
  const [followupDate, setFollowupDate] = useState('')
  const [followupNotes, setFollowupNotes] = useState('')
  const [statusStage, setStatusStage] = useState(String(lead.stage ?? 'prospect'))

  async function submitLeadAction(payload: Record<string, unknown>) {
    const leadId = lead.id
    if (!leadId) {
      setActionMessage('Lead is missing an ID.')
      return
    }
    setActionBusy(true)
    setActionMessage(null)
    try {
      const res = await fetch(`/api/nexus/opps/lead-window/${leadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok || result.success === false) {
        throw new Error(result?.message ?? 'Nexus could not complete that action.')
      }
      setActionMessage(result?.message ?? 'Done.')
      setActiveAction(null)
      // Reset form fields
      setNoteText('')
      setCallSummary('')
      setCallOutcome('')
      setCallDuration('')
      setFollowupTitle('Follow up on lead')
      setFollowupDate('')
      setFollowupNotes('')
      await onRefresh?.()
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'That did not work. Try again.')
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-[2rem] p-5" style={{ background: 'linear-gradient(145deg, rgba(107,126,255,0.16), rgba(255,255,255,0.035))', border: '1px solid rgba(107,126,255,0.24)', boxShadow: '0 20px 70px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button
              type="button"
              onClick={onBack}
              className="mb-4 rounded-full px-3 py-1.5 text-[11px] transition-opacity hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.58)' }}
            >
              ← Back to workbench
            </button>
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(165,180,255,0.85)' }}>Lead</div>
            <h3 className="mt-2 text-2xl font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.94)' }}>
              {val(lead.contact_name ?? lead.name, 'Unnamed lead')}
            </h3>
            <div className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {val(lead.company_name ?? company?.name, 'No company attached')}
            </div>
          </div>
          <div className="rounded-2xl px-4 py-3 text-right" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.38)' }}>Stage</div>
            <div className="mt-1 text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>{val(lead.stage, 'open')}</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Source" value={val(lead.source, 'Unknown')} />
          <MiniStat label="Units" value={val(lead.unit_count, 'Unknown')} />
          <MiniStat label="Property" value={val(lead.location, 'Not attached')} />
          <MiniStat label="Updated" value={val(lead.updated_at ?? lead.created_at, 'Unknown')} />
        </div>
      </div>

      {/* Body — 2-col on large */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-4 lg:col-span-2">
          <Section title="Overview">
            <div className="grid gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.62)' }}>
              <div>Need / Notes: {val(lead.notes, 'No notes yet')}</div>
              <div>Email: {val(lead.email)}</div>
              <div>Phone: {val(lead.phone)}</div>
            </div>
          </Section>

          {/* Duplicate Guard — 5 separate categories */}
          <DuplicateGuardSection data={data} />

          <Section title="People" count={contacts.length}>
            {primaryContact && (
              <MiniRow
                title={personName(primaryContact)}
                subtitle={[primaryContact.title, primaryContact.email, primaryContact.phone].filter(Boolean).join(' • ')}
                meta="Primary"
              />
            )}
            <div className={primaryContact ? 'mt-2' : ''}>
              <ListBlock
                records={contacts.filter(c => c.id !== primaryContact?.id)}
                emptyText="No additional contacts linked yet."
                render={contact => (
                  <MiniRow
                    title={personName(contact)}
                    subtitle={[contact.title, contact.email, contact.phone].filter(Boolean).join(' • ')}
                  />
                )}
              />
            </div>
          </Section>

          <Section title="Property / Site" count={linkedProperties.length + possibleProperties.length + sites.length}>
            <ListBlock
              records={[...linkedProperties.map((item: AnyRecord) => item.properties ?? item), ...possibleProperties, ...sites]}
              emptyText="No property or site linked yet."
              render={property => (
                <MiniRow
                  title={val(property.name, 'Unnamed property')}
                  subtitle={[property.address, property.city, property.state, property.zip].filter(Boolean).join(', ')}
                  meta={property.units || property.unit_count ? `${property.units ?? property.unit_count} units` : undefined}
                />
              )}
            />
          </Section>

          <Section title="Activity Timeline" count={activities.length}>
            <ListBlock
              records={activities}
              emptyText="No activity yet."
              render={activity => (
                <MiniRow
                  title={val(activity.subject, val(activity.type, 'Activity'))}
                  subtitle={val(activity.body ?? activity.outcome, '')}
                  meta={val(activity.created_at, '')}
                />
              )}
            />
          </Section>

          <Section title="Tasks" count={data.todos?.length ?? 0}>
            <ListBlock
              records={data.todos}
              emptyText="No tasks attached yet."
              render={todo => (
                <MiniRow
                  title={val(todo.title, 'Task')}
                  subtitle={val(todo.body, '')}
                  meta={val(todo.status ?? todo.due_date, '')}
                />
              )}
            />
          </Section>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* ── Actions ──────────────────────────────────────────────────────── */}
          <Section title="Actions">
            <div className="space-y-2">
              {/* Four real action buttons */}
              {([
                { action: 'add_note' as LeadAction,        label: 'Add Note',           sub: 'Remember something about this lead.' },
                { action: 'log_call' as LeadAction,        label: 'Log Call',           sub: 'Capture what happened on a call.' },
                { action: 'schedule_followup' as LeadAction, label: 'Schedule Follow-Up', sub: 'Put the next touch on your list.' },
                { action: 'update_status' as LeadAction,   label: 'Update Status',      sub: 'Move the lead forward.' },
              ]).map(({ action, label, sub }) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => { setActiveAction(activeAction === action ? null : action); setActionMessage(null) }}
                  className="w-full rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5"
                  style={{
                    background: activeAction === action ? 'rgba(107,126,255,0.14)' : 'rgba(52,211,153,0.08)',
                    border: activeAction === action ? '1px solid rgba(107,126,255,0.32)' : '1px solid rgba(52,211,153,0.18)',
                    color: 'rgba(255,255,255,0.86)',
                  }}
                >
                  <div className="text-xs font-semibold">{label}</div>
                  <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.42)' }}>{sub}</div>
                </button>
              ))}

              {/* Inline action panels */}
              {activeAction === 'add_note' && (
                <div className="rounded-2xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="What should Nexus remember?"
                    rows={3}
                    className="w-full rounded-xl px-3 py-2 text-xs outline-none resize-none"
                    style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(107,126,255,0.2)', color: 'rgba(255,255,255,0.88)' }}
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setActiveAction(null)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.045)', color: 'rgba(255,255,255,0.5)' }}>Cancel</button>
                    <button type="button" disabled={actionBusy || !noteText.trim()} onClick={() => submitLeadAction({ action: 'add_note', note: noteText })} className="rounded-full px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ background: '#6B7EFF', color: 'white' }}>{actionBusy ? 'Saving...' : 'Save Note'}</button>
                  </div>
                </div>
              )}

              {activeAction === 'log_call' && (
                <div className="rounded-2xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <textarea
                    value={callSummary}
                    onChange={e => setCallSummary(e.target.value)}
                    placeholder="What happened on the call?"
                    rows={3}
                    className="w-full rounded-xl px-3 py-2 text-xs outline-none resize-none"
                    style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(107,126,255,0.2)', color: 'rgba(255,255,255,0.88)' }}
                  />
                  <input value={callOutcome} onChange={e => setCallOutcome(e.target.value)} placeholder="Outcome, if any" className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.88)' }} />
                  <input value={callDuration} onChange={e => setCallDuration(e.target.value)} placeholder="Duration, if useful" className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.88)' }} />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setActiveAction(null)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.045)', color: 'rgba(255,255,255,0.5)' }}>Cancel</button>
                    <button type="button" disabled={actionBusy || !callSummary.trim()} onClick={() => submitLeadAction({ action: 'log_call', summary: callSummary, outcome: callOutcome, duration: callDuration })} className="rounded-full px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ background: '#6B7EFF', color: 'white' }}>{actionBusy ? 'Saving...' : 'Log Call'}</button>
                  </div>
                </div>
              )}

              {activeAction === 'schedule_followup' && (
                <div className="rounded-2xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <input value={followupTitle} onChange={e => setFollowupTitle(e.target.value)} placeholder="What should the follow-up be?" className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(107,126,255,0.2)', color: 'rgba(255,255,255,0.88)' }} />
                  <input type="date" value={followupDate} onChange={e => setFollowupDate(e.target.value)} className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.88)' }} />
                  <textarea value={followupNotes} onChange={e => setFollowupNotes(e.target.value)} placeholder="Anything to remember?" rows={2} className="w-full rounded-xl px-3 py-2 text-xs outline-none resize-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.88)' }} />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setActiveAction(null)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.045)', color: 'rgba(255,255,255,0.5)' }}>Cancel</button>
                    <button type="button" disabled={actionBusy} onClick={() => submitLeadAction({ action: 'schedule_followup', title: followupTitle, due_date: followupDate, notes: followupNotes })} className="rounded-full px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ background: '#6B7EFF', color: 'white' }}>{actionBusy ? 'Saving...' : 'Schedule'}</button>
                  </div>
                </div>
              )}

              {activeAction === 'update_status' && (
                <div className="rounded-2xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <select value={statusStage} onChange={e => setStatusStage(e.target.value)} className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(107,126,255,0.2)', color: 'rgba(255,255,255,0.88)' }}>
                    <option value="prospect">Prospect</option>
                    <option value="new">New</option>
                    <option value="contacted">Working</option>
                    <option value="qualifying">Qualifying</option>
                    <option value="qualified">Qualified</option>
                    <option value="proposal">Proposal</option>
                    <option value="negotiation">Negotiation</option>
                    <option value="converted">Opportunity Created</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                    <option value="dead">Dead</option>
                  </select>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setActiveAction(null)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.045)', color: 'rgba(255,255,255,0.5)' }}>Cancel</button>
                    <button type="button" disabled={actionBusy} onClick={() => submitLeadAction({ action: 'update_status', stage: statusStage })} className="rounded-full px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ background: '#6B7EFF', color: 'white' }}>{actionBusy ? 'Saving...' : 'Update'}</button>
                  </div>
                </div>
              )}

              {/* Status / success message */}
              {actionMessage && (
                <div className="rounded-2xl px-3 py-2 text-[11px]" style={{ background: 'rgba(107,126,255,0.08)', border: '1px solid rgba(107,126,255,0.18)', color: 'rgba(255,255,255,0.72)' }}>
                  {actionMessage}
                </div>
              )}
            </div>
          </Section>

          <Section title="Files" count={data.attachments?.length ?? 0}>
            <ListBlock
              records={data.attachments}
              emptyText="No files attached yet."
              render={file => <MiniRow title={val(file.file_name, 'File')} subtitle={val(file.file_type ?? file.type, '')} />}
            />
          </Section>

          <Section title="Surveys" count={data.surveys?.length ?? 0}>
            <ListBlock
              records={data.surveys}
              emptyText="No surveys found yet."
              render={survey => (
                <MiniRow
                  title={val(survey.survey_number ?? survey.property_name, 'Survey')}
                  subtitle={val(survey.ai_summary, 'No summary yet')}
                  meta={val(survey.status, '')}
                />
              )}
            />
          </Section>

          <Section title="Related Opportunities" count={data.opportunities?.length ?? 0}>
            <ListBlock
              records={data.opportunities}
              emptyText="No related opportunities yet."
              render={opp => (
                <MiniRow
                  title={val(opp.name, 'Opportunity')}
                  subtitle={val(opp.next_step ?? opp.account_name, '')}
                  meta={val(opp.stage, '')}
                />
              )}
            />
          </Section>
        </div>
      </div>
    </div>
  )
}
