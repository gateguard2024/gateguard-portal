'use client'

import { useState } from 'react'

type AnyRecord = Record<string, any>

type LeadAction =
  | 'edit_details'
  | 'create_opportunity'
  | 'add_note'
  | 'log_call'
  | 'schedule_followup'
  | 'update_status'

type LeadGlassData = {
  lead?: AnyRecord | null
  people?: { primaryContact?: AnyRecord | null; contacts?: AnyRecord[] }
  company?: AnyRecord | null
  properties?: { linked?: AnyRecord[]; possible?: AnyRecord[]; sites?: AnyRecord[] }
  activity?: { activities?: AnyRecord[]; crmActivities?: AnyRecord[] }
  todos?: AnyRecord[]
  attachments?: AnyRecord[]
  surveys?: AnyRecord[]
  opportunities?: AnyRecord[]
  nextBestActions?: Array<{ title: string; subtitle: string; action: string }>
}

function val(value: unknown, fallback = 'Not added yet') {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

function leadSourceLabel(source: unknown): string {
  const raw = String(source ?? '').trim().toLowerCase()
  const clean = raw.startsWith('nexus_') ? raw.replace('nexus_', '') : raw
  if (clean === 'outbound') return 'Outbound Cold Call'
  if (clean === 'walk_in' || clean === 'walk-in') return 'Walk-In'
  if (clean === 'website') return 'Website / Other'
  if (clean === 'phone') return 'Phone Call'
  return source ? String(source) : 'Unknown'
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
        {typeof count === 'number' && count > 0 && <div className="rounded-full px-2 py-1 text-[10px]" style={{ background: 'rgba(107,126,255,0.12)', color: 'rgba(165,180,255,0.9)' }}>{count}</div>}
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

function MiniStat({ label, value: statValue }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.16)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.34)' }}>{label}</div>
      <div className="mt-1 truncate text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.82)' }}>{statValue}</div>
    </div>
  )
}

function ActionButton({ title, subtitle, active, onClick }: { title: string; subtitle: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5" style={{ background: active ? 'rgba(107,126,255,0.14)' : 'rgba(52,211,153,0.08)', border: active ? '1px solid rgba(107,126,255,0.32)' : '1px solid rgba(52,211,153,0.18)', color: 'rgba(255,255,255,0.86)' }}>
      <div className="text-xs font-semibold">{title}</div>
      <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.42)' }}>{subtitle}</div>
    </button>
  )
}

function DuplicateGuardSection({ data }: { data: LeadGlassData }) {
  const contacts = data.people?.contacts ?? []
  const company = data.company
  const possibleProperties = data.properties?.possible ?? []
  const sites = data.properties?.sites ?? []
  const opportunities = data.opportunities ?? []
  const totalMatches = contacts.length + (company ? 1 : 0) + possibleProperties.length + sites.length + opportunities.length

  return (
    <Section title="Possible Matches — Duplicate Guard" count={totalMatches}>
      <p className="mb-4 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>Before creating new records, check these existing matches. Update and link instead of duplicating. Display only — no actions yet.</p>
      <div className="space-y-4">
        <div><div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(107,126,255,0.7)' }}>Possible Contact Matches ({contacts.length})</div><ListBlock records={contacts} emptyText="No possible contact matches found." render={contact => <MiniRow title={personName(contact)} subtitle={[contact.title, contact.email, contact.phone].filter(Boolean).join(' • ')} meta="Contact" />} /></div>
        <div><div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(107,126,255,0.7)' }}>Possible Company Matches ({company ? 1 : 0})</div>{company ? <MiniRow title={val(company.name, 'Possible company')} subtitle={[company.website, company.city, company.state].filter(Boolean).join(' • ')} meta="Company" /> : <Empty text="No possible company matches found." />}</div>
        <div><div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(107,126,255,0.7)' }}>Possible Property Matches ({possibleProperties.length})</div><ListBlock records={possibleProperties} emptyText="No possible property matches found." render={property => <MiniRow title={val(property.name, 'Possible property')} subtitle={[property.address, property.city, property.state].filter(Boolean).join(', ')} meta={property.unit_count ? `${property.unit_count} units` : 'Property'} />} /></div>
        <div><div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(107,126,255,0.7)' }}>Possible Site Matches ({sites.length})</div><ListBlock records={sites} emptyText="No possible site matches found." render={site => <MiniRow title={val(site.name, 'Possible site')} subtitle={[site.address, site.city, site.state].filter(Boolean).join(', ')} meta={site.units ? `${site.units} units` : 'Site'} />} /></div>
        <div><div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(107,126,255,0.7)' }}>Possible Opportunity Matches ({opportunities.length})</div><ListBlock records={opportunities} emptyText="No possible opportunity matches found." render={opp => <MiniRow title={val(opp.name, 'Possible opportunity')} subtitle={[opp.account_name, opp.next_step].filter(Boolean).join(' • ')} meta={val(opp.stage, 'Opportunity')} />} /></div>
      </div>
    </Section>
  )
}

export function LeadGlassWindow({ data, onBack, onRefresh, onOpenOpportunity }: { data: LeadGlassData; onBack: () => void; onRefresh?: () => Promise<void> | void; onOpenOpportunity?: (id: string) => void | Promise<void> }) {
  const lead = data.lead ?? {}
  const contacts = data.people?.contacts ?? []
  const primaryContact = data.people?.primaryContact
  const company = data.company
  const linkedProperties = data.properties?.linked ?? []
  const possibleProperties = data.properties?.possible ?? []
  const sites = data.properties?.sites ?? []
  const activities = [...(data.activity?.crmActivities ?? []), ...(data.activity?.activities ?? [])]
  const todos = data.todos ?? []
  const attachments = data.attachments ?? []
  const surveys = data.surveys ?? []
  const opportunities = data.opportunities ?? []

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

  const [detailContactName, setDetailContactName] = useState(String(lead.contact_name ?? lead.name ?? ''))
  const [detailCompanyName, setDetailCompanyName] = useState(String(lead.company_name ?? company?.name ?? ''))
  const [detailEmail, setDetailEmail] = useState(String(lead.email ?? ''))
  const [detailPhone, setDetailPhone] = useState(String(lead.phone ?? ''))
  const [detailLocation, setDetailLocation] = useState(String(lead.location ?? ''))
  const [detailPropertyType, setDetailPropertyType] = useState(String(lead.property_type ?? ''))
  const [detailUnitCount, setDetailUnitCount] = useState(lead.unit_count ? String(lead.unit_count) : '')
  const [detailNotes, setDetailNotes] = useState(String(lead.notes ?? ''))
  const [detailContactSource, setDetailContactSource] = useState(String(lead.source ?? ''))

  function chooseAction(action: LeadAction) {
    if (action === 'edit_details') {
      setDetailContactName(String(lead.contact_name ?? lead.name ?? ''))
      setDetailCompanyName(String(lead.company_name ?? company?.name ?? ''))
      setDetailEmail(String(lead.email ?? ''))
      setDetailPhone(String(lead.phone ?? ''))
      setDetailLocation(String(lead.location ?? ''))
      setDetailPropertyType(String(lead.property_type ?? ''))
      setDetailUnitCount(lead.unit_count ? String(lead.unit_count) : '')
      setDetailNotes(String(lead.notes ?? ''))
      setDetailContactSource(String(lead.source ?? ''))
    }
    setActiveAction(activeAction === action ? null : action)
    setActionMessage(null)
  }

  async function submitLeadAction(payload: Record<string, unknown>) {
    const leadId = lead.id
    if (!leadId) { setActionMessage('Lead is missing an ID.'); return }
    setActionBusy(true); setActionMessage(null)
    try {
      const res = await fetch(`/api/nexus/opps/lead-window/${leadId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const result = await res.json().catch(() => ({}))
      if (!res.ok || result.success === false) throw new Error(result?.message ?? 'Nexus could not complete that action.')
      const createdOpportunityId = typeof result?.opportunityId === 'string' ? result.opportunityId : typeof result?.opportunity?.id === 'string' ? result.opportunity.id : null
      setActionMessage(result?.message ?? 'Done.'); setActiveAction(null); setNoteText(''); setCallSummary(''); setCallOutcome(''); setCallDuration(''); setFollowupTitle('Follow up on lead'); setFollowupDate(''); setFollowupNotes('')
      if (payload.action === 'create_opportunity' && createdOpportunityId) { await onRefresh?.(); await onOpenOpportunity?.(createdOpportunityId); return }
      await onRefresh?.()
    } catch (error) { setActionMessage(error instanceof Error ? error.message : 'That did not work. Try again.') } finally { setActionBusy(false) }
  }

  async function submitLeadDetails() {
    const leadId = lead.id
    if (!leadId) return
    setActionBusy(true); setActionMessage(null)
    try {
      const res = await fetch(`/api/nexus/opps/lead-window/${leadId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_details', contact_name: detailContactName, company_name: detailCompanyName, email: detailEmail, phone: detailPhone, location: detailLocation, property_type: detailPropertyType, unit_count: detailUnitCount, notes: detailNotes, source: detailContactSource }) })
      const result = await res.json().catch(() => ({}))
      if (!res.ok || result.success === false) throw new Error(result?.message ?? 'Could not update lead details.')
      setActionMessage(result?.message ?? 'Lead details updated.'); setActiveAction(null); await onRefresh?.()
    } catch (error) { setActionMessage(error instanceof Error ? error.message : 'That did not work. Try again.') } finally { setActionBusy(false) }
  }

  return (
    <div className="space-y-4">
      {activeAction === 'edit_details' && (
        <div className="fixed inset-0 z-[120] overflow-y-auto px-4 py-4 sm:py-8" style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)', WebkitOverflowScrolling: 'touch' }}>
          <div className="mx-auto flex min-h-full w-full max-w-2xl items-start justify-center">
            <div className="w-full overflow-hidden rounded-[2rem]" style={{ background: 'linear-gradient(180deg, rgba(14,22,44,0.98), rgba(6,10,24,0.98))', border: '1px solid rgba(107,126,255,0.28)', boxShadow: '0 30px 100px rgba(0,0,0,0.55)' }}>
              <div className="sticky top-0 z-10 flex items-start justify-between gap-3 p-5" style={{ background: 'linear-gradient(180deg, rgba(14,22,44,0.98), rgba(14,22,44,0.92))', borderBottom: '1px solid rgba(107,126,255,0.14)' }}>
                <div><div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: 'rgba(165,180,255,0.85)' }}>Edit Lead Details</div><h3 className="mt-1 text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>Fill in the basics</h3><p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.42)' }}>Add the contact, phone, email, property basics, and notes.</p></div>
                <button type="button" onClick={() => setActiveAction(null)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.62)' }}>Close</button>
              </div>
              <div className="max-h-[calc(100vh-11rem)] overflow-y-auto p-5" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={detailContactName} onChange={e => setDetailContactName(e.target.value)} placeholder="Contact name" className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(107,126,255,0.2)', color: 'rgba(255,255,255,0.88)' }} />
                  <input value={detailPhone} onChange={e => setDetailPhone(e.target.value)} placeholder="Phone" className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(107,126,255,0.2)', color: 'rgba(255,255,255,0.88)' }} />
                  <input value={detailEmail} onChange={e => setDetailEmail(e.target.value)} placeholder="Email" className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(107,126,255,0.2)', color: 'rgba(255,255,255,0.88)' }} />
                  <input value={detailCompanyName} onChange={e => setDetailCompanyName(e.target.value)} placeholder="Property / company" className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(107,126,255,0.2)', color: 'rgba(255,255,255,0.88)' }} />
                  <input value={detailLocation} onChange={e => setDetailLocation(e.target.value)} placeholder="Address / location" className="rounded-xl px-3 py-2 text-sm outline-none sm:col-span-2" style={{ background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(107,126,255,0.2)', color: 'rgba(255,255,255,0.88)' }} />
                  <input value={detailUnitCount} onChange={e => setDetailUnitCount(e.target.value)} placeholder="Units" className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(107,126,255,0.2)', color: 'rgba(255,255,255,0.88)' }} />
                  <input value={detailPropertyType} onChange={e => setDetailPropertyType(e.target.value)} placeholder="Property type" className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(107,126,255,0.2)', color: 'rgba(255,255,255,0.88)' }} />
                  <textarea value={detailNotes} onChange={e => setDetailNotes(e.target.value)} placeholder="Notes / need — include address discrepancies or ARIA vs Google differences here" rows={4} className="rounded-xl px-3 py-2 text-sm outline-none resize-none sm:col-span-2" style={{ background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(107,126,255,0.2)', color: 'rgba(255,255,255,0.88)' }} />
                  <div className="sm:col-span-2">
                    <label className="block mb-1 text-[10px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.38)' }}>Contact Source</label>
                    <select value={detailContactSource} onChange={e => setDetailContactSource(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(107,126,255,0.2)', color: 'rgba(255,255,255,0.88)' }}>
                      <option value="">Unknown</option>
                      <option value="nexus_aria">ARIA</option>
                      <option value="nexus_google">Google</option>
                      <option value="nexus_outbound">Outbound / Manual</option>
                      <option value="nexus_phone">Phone Call</option>
                      <option value="nexus_walk_in">Walk-In</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="sticky bottom-0 flex justify-end gap-2 p-4" style={{ background: 'linear-gradient(0deg, rgba(6,10,24,0.98), rgba(6,10,24,0.90))', borderTop: '1px solid rgba(107,126,255,0.14)' }}>
                <button type="button" onClick={() => setActiveAction(null)} className="rounded-full px-4 py-2 text-xs" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.58)' }}>Cancel</button>
                <button type="button" disabled={actionBusy} onClick={submitLeadDetails} className="rounded-full px-4 py-2 text-xs disabled:opacity-40" style={{ background: '#6B7EFF', color: 'white' }}>{actionBusy ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="rounded-[2rem] p-5" style={{ background: 'linear-gradient(145deg, rgba(107,126,255,0.16), rgba(255,255,255,0.035))', border: '1px solid rgba(107,126,255,0.24)', boxShadow: '0 20px 70px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><button type="button" onClick={onBack} className="mb-4 rounded-full px-3 py-1.5 text-[11px] transition-opacity hover:opacity-80" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.58)' }}>← Back to workbench</button><div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(165,180,255,0.85)' }}>Lead</div><h3 className="mt-2 text-2xl font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.94)' }}>{val(lead.contact_name ?? lead.name, 'Unnamed lead')}</h3><div className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{val(lead.company_name ?? company?.name, 'No company attached')}</div>{lead.location && <div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>{String(lead.location)}</div>}</div><div className="rounded-2xl px-4 py-3 text-right" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.08)' }}><div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.38)' }}>Stage</div><div className="mt-1 text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>{val(lead.stage, 'open')}</div></div></div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><MiniStat label="Source" value={leadSourceLabel(lead.source)} /><MiniStat label="Units" value={val(lead.unit_count, 'Unknown')} /><MiniStat label="Property" value={val(lead.location, 'Not attached')} /><MiniStat label="Updated" value={val(lead.updated_at ?? lead.created_at, 'Unknown')} /></div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3"><div className="space-y-4 lg:col-span-2"><Section title="Overview"><div className="grid gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.62)' }}><div>Need / Notes: {val(lead.notes, 'No notes yet')}</div><div>Email: {val(lead.email)}</div><div>Phone: {val(lead.phone)}</div></div></Section><DuplicateGuardSection data={data} /><Section title="People" count={contacts.length}>{primaryContact && <MiniRow title={personName(primaryContact)} subtitle={[primaryContact.title, primaryContact.email, primaryContact.phone].filter(Boolean).join(' • ')} meta="Primary" />}<div className={primaryContact ? 'mt-2' : ''}><ListBlock records={contacts.filter(c => c.id !== primaryContact?.id)} emptyText="No additional contacts linked yet." render={contact => <MiniRow title={personName(contact)} subtitle={[contact.title, contact.email, contact.phone].filter(Boolean).join(' • ')} />} /></div></Section><Section title="Property / Site" count={linkedProperties.length + possibleProperties.length + sites.length}><ListBlock records={[...linkedProperties.map((item: AnyRecord) => item.properties ?? item), ...possibleProperties, ...sites]} emptyText="No property or site linked yet." render={property => <MiniRow title={val(property.name, 'Unnamed property')} subtitle={[property.address, property.city, property.state, property.zip].filter(Boolean).join(', ')} meta={property.units || property.unit_count ? `${property.units ?? property.unit_count} units` : undefined} />} /></Section><Section title="Activity Timeline" count={activities.length}><ListBlock records={activities} emptyText="No activity yet." render={activity => <MiniRow title={val(activity.subject, val(activity.type, 'Activity'))} subtitle={val(activity.body ?? activity.outcome, '')} meta={val(activity.created_at, '')} />} /></Section><Section title="Tasks" count={todos.length}><ListBlock records={todos} emptyText="No tasks attached yet." render={todo => <MiniRow title={val(todo.title, 'Task')} subtitle={val(todo.body, '')} meta={val(todo.status ?? todo.due_date, '')} />} /></Section></div><div className="space-y-4"><Section title="Actions"><div className="space-y-2"><ActionButton title="Edit Lead Details" subtitle="Add phone, email, property basics, and notes." active={activeAction === 'edit_details'} onClick={() => chooseAction('edit_details')} /><ActionButton title="Create Opportunity" subtitle="This looks like a real deal." active={activeAction === 'create_opportunity'} onClick={() => chooseAction('create_opportunity')} /><ActionButton title="Add Note" subtitle="Remember something about this lead." active={activeAction === 'add_note'} onClick={() => chooseAction('add_note')} /><ActionButton title="Log Call" subtitle="Capture what happened on a call." active={activeAction === 'log_call'} onClick={() => chooseAction('log_call')} /><ActionButton title="Create Task / Follow-Up" subtitle="Put the next touch on your list." active={activeAction === 'schedule_followup'} onClick={() => chooseAction('schedule_followup')} /><ActionButton title="Update Status" subtitle="Move the lead forward." active={activeAction === 'update_status'} onClick={() => chooseAction('update_status')} />
              <button type="button" disabled={actionBusy} onClick={() => submitLeadAction({ action: 'add_note', note: 'Contact not found — needs research.' })} className="w-full rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5 disabled:opacity-40" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: 'rgba(255,255,255,0.86)' }}><div className="text-xs font-semibold">Contact Not Found</div><div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.42)' }}>Flag as needing contact research.</div></button>
              {activeAction === 'create_opportunity' && <div className="rounded-2xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(107,126,255,0.22)' }}><p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>Nexus will create an opportunity and carry forward this lead data. No duplicate will be created if one already exists.</p><div className="flex gap-2"><button type="button" onClick={() => setActiveAction(null)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.045)', color: 'rgba(255,255,255,0.5)' }}>Cancel</button><button type="button" disabled={actionBusy} onClick={() => submitLeadAction({ action: 'create_opportunity' })} className="rounded-full px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ background: '#6B7EFF', color: 'white' }}>{actionBusy ? 'Creating...' : 'Create Opportunity'}</button></div></div>}
              {activeAction === 'add_note' && <div className="rounded-2xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)' }}><textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="What should Nexus remember?" rows={3} className="w-full rounded-xl px-3 py-2 text-xs outline-none resize-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(107,126,255,0.2)', color: 'rgba(255,255,255,0.88)' }} /><div className="flex gap-2"><button type="button" onClick={() => setActiveAction(null)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.045)', color: 'rgba(255,255,255,0.5)' }}>Cancel</button><button type="button" disabled={actionBusy || !noteText.trim()} onClick={() => submitLeadAction({ action: 'add_note', note: noteText })} className="rounded-full px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ background: '#6B7EFF', color: 'white' }}>{actionBusy ? 'Saving...' : 'Save Note'}</button></div></div>}
              {activeAction === 'log_call' && <div className="rounded-2xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)' }}><textarea value={callSummary} onChange={e => setCallSummary(e.target.value)} placeholder="Call summary" rows={2} className="w-full rounded-xl px-3 py-2 text-xs outline-none resize-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(107,126,255,0.2)', color: 'rgba(255,255,255,0.88)' }} /><div className="grid grid-cols-2 gap-2"><input value={callOutcome} onChange={e => setCallOutcome(e.target.value)} placeholder="Outcome (e.g. Left VM)" className="rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(107,126,255,0.2)', color: 'rgba(255,255,255,0.88)' }} /><input value={callDuration} onChange={e => setCallDuration(e.target.value)} placeholder="Duration (mins)" className="rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(107,126,255,0.2)', color: 'rgba(255,255,255,0.88)' }} /></div><div className="flex gap-2"><button type="button" onClick={() => setActiveAction(null)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.045)', color: 'rgba(255,255,255,0.5)' }}>Cancel</button><button type="button" disabled={actionBusy || !callSummary.trim()} onClick={() => submitLeadAction({ action: 'log_call', summary: callSummary, outcome: callOutcome || undefined, duration_mins: callDuration ? parseInt(callDuration, 10) : undefined })} className="rounded-full px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ background: '#6B7EFF', color: 'white' }}>{actionBusy ? 'Saving...' : 'Log Call'}</button></div></div>}
              {activeAction === 'schedule_followup' && <div className="rounded-2xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)' }}><input value={followupTitle} onChange={e => setFollowupTitle(e.target.value)} placeholder="Task title" className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(107,126,255,0.2)', color: 'rgba(255,255,255,0.88)' }} /><input type="date" value={followupDate} onChange={e => setFollowupDate(e.target.value)} className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(107,126,255,0.2)', color: 'rgba(255,255,255,0.88)' }} /><textarea value={followupNotes} onChange={e => setFollowupNotes(e.target.value)} placeholder="Notes (optional)" rows={2} className="w-full rounded-xl px-3 py-2 text-xs outline-none resize-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(107,126,255,0.2)', color: 'rgba(255,255,255,0.88)' }} /><div className="flex gap-2"><button type="button" onClick={() => setActiveAction(null)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.045)', color: 'rgba(255,255,255,0.5)' }}>Cancel</button><button type="button" disabled={actionBusy || !followupTitle.trim()} onClick={() => submitLeadAction({ action: 'schedule_followup', title: followupTitle, due_date: followupDate || undefined, notes: followupNotes || undefined })} className="rounded-full px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ background: '#6B7EFF', color: 'white' }}>{actionBusy ? 'Creating...' : 'Create Task'}</button></div></div>}
              {activeAction === 'update_status' && <div className="rounded-2xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)' }}><label className="block text-[10px] uppercase tracking-[0.14em] mb-1" style={{ color: 'rgba(255,255,255,0.38)' }}>Move lead to</label><select value={statusStage} onChange={e => setStatusStage(e.target.value)} className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(107,126,255,0.2)', color: 'rgba(255,255,255,0.88)' }}><option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="proposal">Proposal</option><option value="won">Won</option><option value="lost">Lost</option></select><div className="flex gap-2"><button type="button" onClick={() => setActiveAction(null)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.045)', color: 'rgba(255,255,255,0.5)' }}>Cancel</button><button type="button" disabled={actionBusy} onClick={() => submitLeadAction({ action: 'update_status', stage: statusStage })} className="rounded-full px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ background: '#6B7EFF', color: 'white' }}>{actionBusy ? 'Saving...' : 'Save Stage'}</button></div></div>}
            </div></Section>{actionMessage && <div className="rounded-2xl p-3 text-xs" style={{ background: 'rgba(107,126,255,0.10)', border: '1px solid rgba(107,126,255,0.18)', color: 'rgba(255,255,255,0.76)' }}>{actionMessage}</div>}</div></div>
    </div>
  )
}
