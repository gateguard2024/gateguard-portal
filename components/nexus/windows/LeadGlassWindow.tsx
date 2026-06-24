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

const LEAD_STATUS_OPTIONS = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
]

const INTEREST_OPTIONS = [
  { label: 'GateGuard', terms: ['gateguard', 'gate guard', 'gate monitoring', 'gate'] },
  { label: 'Camera Monitoring', terms: ['camera monitoring', 'monitoring'] },
  { label: 'Camera System', terms: ['camera system', 'camera', 'cameras'] },
  { label: 'Bulk Internet', terms: ['bulk internet', 'internet'] },
  { label: 'Bulk WiFi', terms: ['bulk wifi', 'bulk wi-fi', 'wifi', 'wi-fi'] },
  { label: 'Package Locker', terms: ['package locker', 'package lockers', 'locker'] },
]

function val(value: unknown, fallback = 'Not added yet') {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

function leadSourceLabel(source: unknown): string {
  const raw = String(source ?? '').trim().toLowerCase()
  const clean = raw.startsWith('nexus_') ? raw.replace('nexus_', '') : raw
  if (clean === 'aria') return 'ARIA'
  if (clean === 'google') return 'Google'
  if (clean === 'outbound') return 'Outbound / Manual'
  if (clean === 'walk_in' || clean === 'walk-in') return 'Walk-In'
  if (clean === 'website') return 'Website / Other'
  if (clean === 'phone') return 'Phone Call'
  return source ? String(source) : 'Unknown'
}

function statusLabel(stage: unknown): string {
  const raw = String(stage ?? '').trim()
  const found = LEAD_STATUS_OPTIONS.find(option => option.value === raw)
  if (found) return found.label
  return raw ? raw.replace(/_/g, ' ') : 'Open'
}

function personName(person?: AnyRecord | null) {
  if (!person) return 'No contact linked yet'
  return [person.first_name, person.last_name].filter(Boolean).join(' ') || person.contact_name || person.name || 'Unnamed contact'
}

function getAddressText(lead: AnyRecord, linkedProperties: AnyRecord[], possibleProperties: AnyRecord[], sites: AnyRecord[]) {
  const linked = linkedProperties.map((item: AnyRecord) => item.properties ?? item)
  const source = linked[0] ?? possibleProperties[0] ?? sites[0] ?? lead
  const parts = [source.address, source.city, source.state, source.zip].filter(Boolean)
  if (parts.length > 0) return parts.join(', ')
  return val(lead.location, 'Address not added yet')
}

function leadTextIndex(lead: AnyRecord) {
  return [
    lead.notes,
    lead.need,
    lead.need_summary,
    lead.description,
    lead.property_type,
    lead.company_name,
    lead.location,
  ].filter(Boolean).join(' ').toLowerCase()
}

function hasInterest(text: string, terms: string[]) {
  return terms.some(term => text.includes(term))
}

function Section({ title, children, count }: { title: string; children: React.ReactNode; count?: number }) {
  return (
    <div className="rounded-3xl p-4" style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.10)' }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[15px] font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>{title}</div>
        {typeof count === 'number' && count > 0 && (
          <div className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: 'rgba(107,126,255,0.16)', color: 'rgba(198,207,255,0.96)' }}>
            {count}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.62)' }}>{text}</div>
}

function MiniRow({ title, subtitle, meta }: { title: string; subtitle?: string; meta?: string }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: 'rgba(3,9,22,0.34)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{title}</div>
        {meta && <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.58)', whiteSpace: 'nowrap' }}>{meta}</div>}
      </div>
      {subtitle && <div className="mt-1 text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.66)' }}>{subtitle}</div>}
    </div>
  )
}

function ListBlock({ records, emptyText, render }: { records?: AnyRecord[]; emptyText: string; render: (record: AnyRecord) => React.ReactNode }) {
  if (!records || records.length === 0) return <Empty text={emptyText} />
  return <div className="space-y-2">{records.slice(0, 6).map((record, index) => <div key={record.id ?? index}>{render(record)}</div>)}</div>
}

function MiniStat({ label, value: statValue, onEdit }: { label: string; value: string; onEdit?: () => void }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: 'rgba(3,9,22,0.34)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.56)' }}>{label}</div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[12px] transition-all hover:-translate-y-0.5"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.82)' }}
            aria-label={`Edit ${label}`}
            title={`Edit ${label}`}
          >
            ✎
          </button>
        )}
      </div>
      <div className="mt-1 truncate text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>{statValue}</div>
    </div>
  )
}

function ActionButton({ title, subtitle, active, onClick, tone = 'default' }: { title: string; subtitle: string; active: boolean; onClick: () => void; tone?: 'default' | 'danger' }) {
  const isDanger = tone === 'danger'
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5"
      style={{
        background: active
          ? isDanger ? 'rgba(239,68,68,0.15)' : 'rgba(107,126,255,0.18)'
          : isDanger ? 'rgba(239,68,68,0.10)' : 'rgba(52,211,153,0.10)',
        border: active
          ? isDanger ? '1px solid rgba(239,68,68,0.38)' : '1px solid rgba(107,126,255,0.36)'
          : isDanger ? '1px solid rgba(239,68,68,0.24)' : '1px solid rgba(52,211,153,0.22)',
        color: 'rgba(255,255,255,0.92)',
      }}
    >
      <div className="text-[13px] font-semibold">{title}</div>
      <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.66)' }}>{subtitle}</div>
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

  if (totalMatches === 0) return null

  return (
    <Section title="Possible Duplicates" count={totalMatches}>
      <p className="mb-4 text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.68)' }}>
        Nexus found possible matches. Review these before creating another record.
      </p>
      <div className="space-y-4">
        {contacts.length > 0 && <div><div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(147,165,255,0.9)' }}>Contacts</div><ListBlock records={contacts} emptyText="No contact matches." render={contact => <MiniRow title={personName(contact)} subtitle={[contact.title, contact.email, contact.phone].filter(Boolean).join(' • ')} meta="Contact" />} /></div>}
        {company && <div><div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(147,165,255,0.9)' }}>Company</div><MiniRow title={val(company.name, 'Possible company')} subtitle={[company.website, company.city, company.state].filter(Boolean).join(' • ')} meta="Company" /></div>}
        {possibleProperties.length > 0 && <div><div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(147,165,255,0.9)' }}>Properties</div><ListBlock records={possibleProperties} emptyText="No property matches." render={property => <MiniRow title={val(property.name, 'Possible property')} subtitle={[property.address, property.city, property.state].filter(Boolean).join(', ')} meta={property.unit_count ? `${property.unit_count} units` : 'Property'} />} /></div>}
        {sites.length > 0 && <div><div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(147,165,255,0.9)' }}>Sites</div><ListBlock records={sites} emptyText="No site matches." render={site => <MiniRow title={val(site.name, 'Possible site')} subtitle={[site.address, site.city, site.state].filter(Boolean).join(', ')} meta={site.units ? `${site.units} units` : 'Site'} />} /></div>}
        {opportunities.length > 0 && <div><div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(147,165,255,0.9)' }}>Opportunities</div><ListBlock records={opportunities} emptyText="No opportunity matches." render={opp => <MiniRow title={val(opp.name, 'Possible opportunity')} subtitle={[opp.account_name, opp.next_step].filter(Boolean).join(' • ')} meta={val(opp.stage, 'Opportunity')} />} /></div>}
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
  const interestText = leadTextIndex(lead)
  const addressText = getAddressText(lead, linkedProperties, possibleProperties, sites)

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
  const [otherInterestText, setOtherInterestText] = useState('')

  // Structured interests — start from the saved array, else infer from text (legacy).
  const initialInterests = Array.isArray(lead.interests) && (lead.interests as unknown[]).length
    ? (lead.interests as unknown[]).map(String)
    : INTEREST_OPTIONS.filter(o => hasInterest(interestText, o.terms)).map(o => o.label)
  const [interests, setInterests] = useState<string[]>(initialInterests)
  const [savingInterests, setSavingInterests] = useState(false)

  async function toggleInterest(label: string) {
    if (!lead.id) { setActionMessage('Lead is missing an ID.'); return }
    const next = interests.includes(label) ? interests.filter(x => x !== label) : [...interests, label]
    setInterests(next)
    setSavingInterests(true); setActionMessage(null)
    try {
      const res = await fetch(`/api/nexus/opps/lead-window/${lead.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_details', interests: next }) })
      const result = await res.json().catch(() => ({}))
      if (!res.ok || result.success === false) throw new Error(result?.message ?? 'Could not save interest.')
      await onRefresh?.()
    } catch (error) { setActionMessage(error instanceof Error ? error.message : 'Could not save interest.'); setInterests(interests) } finally { setSavingInterests(false) }
  }

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
    if (action === 'update_status') setStatusStage(String(lead.stage ?? 'prospect'))
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
      setActionMessage(result?.message ?? 'Done.')
      setActiveAction(null)
      setNoteText('')
      setCallSummary('')
      setCallOutcome('')
      setCallDuration('')
      setFollowupTitle('Follow up on lead')
      setFollowupDate('')
      setFollowupNotes('')
      setOtherInterestText('')
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

  async function uploadAttachment(file: File) {
    const leadId = lead.id
    if (!leadId || !file) return
    setActionBusy(true); setActionMessage(null)
    try {
      const urlRes = await fetch(`/api/nexus/opps/lead-window/${leadId}/attachment-url`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name }) })
      const urlData = await urlRes.json().catch(() => ({}))
      if (!urlRes.ok) throw new Error(urlData?.error ?? 'Could not start upload.')
      const put = await fetch(urlData.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file })
      if (!put.ok) throw new Error('Upload failed.')
      const rec = await fetch(`/api/nexus/opps/lead-window/${leadId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add_attachment', file_name: file.name, url: urlData.publicUrl, file_type: file.type, size_bytes: file.size }) })
      const recData = await rec.json().catch(() => ({}))
      if (!rec.ok || recData.success === false) throw new Error(recData?.message ?? 'Could not save attachment.')
      setActionMessage('Attachment added.')
      await onRefresh?.()
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <div className="space-y-4 pb-28">
      {activeAction === 'edit_details' && (
        <div className="fixed inset-0 z-[120] overflow-y-auto px-4 py-4 sm:py-8" style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)', WebkitOverflowScrolling: 'touch' }}>
          <div className="mx-auto flex min-h-full w-full max-w-2xl items-start justify-center">
            <div className="w-full overflow-hidden rounded-[2rem]" style={{ background: 'linear-gradient(180deg, rgba(18,28,52,0.98), rgba(8,14,28,0.98))', border: '1px solid rgba(107,126,255,0.32)', boxShadow: '0 30px 100px rgba(0,0,0,0.55)' }}>
              <div className="sticky top-0 z-10 flex items-start justify-between gap-3 p-5" style={{ background: 'linear-gradient(180deg, rgba(18,28,52,0.98), rgba(18,28,52,0.92))', borderBottom: '1px solid rgba(107,126,255,0.18)' }}><div><div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: 'rgba(190,200,255,0.9)' }}>Edit Lead Details</div><h3 className="mt-1 text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.96)' }}>Fill in the basics</h3><p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.62)' }}>Add the contact, phone, email, property basics, and notes.</p></div><button type="button" onClick={() => setActiveAction(null)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.78)' }}>Close</button></div>
              <div className="max-h-[calc(100vh-11rem)] overflow-y-auto p-5" style={{ WebkitOverflowScrolling: 'touch' }}><div className="grid gap-2 sm:grid-cols-2"><input value={detailContactName} onChange={e => setDetailContactName(e.target.value)} placeholder="Contact name" className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(107,126,255,0.22)', color: 'rgba(255,255,255,0.9)' }} /><input value={detailPhone} onChange={e => setDetailPhone(e.target.value)} placeholder="Phone" className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(107,126,255,0.22)', color: 'rgba(255,255,255,0.9)' }} /><input value={detailEmail} onChange={e => setDetailEmail(e.target.value)} placeholder="Email" className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(107,126,255,0.22)', color: 'rgba(255,255,255,0.9)' }} /><input value={detailCompanyName} onChange={e => setDetailCompanyName(e.target.value)} placeholder="Property / company" className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(107,126,255,0.22)', color: 'rgba(255,255,255,0.9)' }} /><input value={detailLocation} onChange={e => setDetailLocation(e.target.value)} placeholder="Address / location" className="rounded-xl px-3 py-2 text-sm outline-none sm:col-span-2" style={{ background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(107,126,255,0.22)', color: 'rgba(255,255,255,0.9)' }} /><input value={detailUnitCount} onChange={e => setDetailUnitCount(e.target.value)} placeholder="Units" className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(107,126,255,0.22)', color: 'rgba(255,255,255,0.9)' }} /><input value={detailPropertyType} onChange={e => setDetailPropertyType(e.target.value)} placeholder="Property type" className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(107,126,255,0.22)', color: 'rgba(255,255,255,0.9)' }} /><textarea value={detailNotes} onChange={e => setDetailNotes(e.target.value)} placeholder="Notes / need — include address discrepancies or ARIA vs Google differences here" rows={4} className="rounded-xl px-3 py-2 text-sm outline-none resize-none sm:col-span-2" style={{ background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(107,126,255,0.22)', color: 'rgba(255,255,255,0.9)' }} /><div className="sm:col-span-2"><label className="block mb-1 text-[10px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.58)' }}>Contact Source</label><select value={detailContactSource} onChange={e => setDetailContactSource(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(107,126,255,0.22)', color: 'rgba(255,255,255,0.9)' }}><option value="">Unknown</option><option value="nexus_aria">ARIA</option><option value="nexus_google">Google</option><option value="nexus_outbound">Outbound / Manual</option><option value="nexus_phone">Phone Call</option><option value="nexus_walk_in">Walk-In</option></select></div></div></div>
              <div className="sticky bottom-0 flex justify-end gap-2 p-4" style={{ background: 'linear-gradient(0deg, rgba(8,14,28,0.98), rgba(8,14,28,0.90))', borderTop: '1px solid rgba(107,126,255,0.18)' }}><button type="button" onClick={() => setActiveAction(null)} className="rounded-full px-4 py-2 text-xs" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.72)' }}>Cancel</button><button type="button" disabled={actionBusy} onClick={submitLeadDetails} className="rounded-full px-4 py-2 text-xs disabled:opacity-40" style={{ background: '#6B7EFF', color: 'white' }}>{actionBusy ? 'Saving...' : 'Save Changes'}</button></div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-[2rem] p-5" style={{ background: 'linear-gradient(145deg, rgba(120,142,255,0.20), rgba(255,255,255,0.055))', border: '1px solid rgba(120,142,255,0.32)', boxShadow: '0 20px 70px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><button type="button" onClick={onBack} className="mb-4 rounded-full px-3 py-1.5 text-[11px] transition-opacity hover:opacity-90" style={{ background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.74)' }}>← Back to workbench</button><div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(190,200,255,0.9)' }}>Lead</div><h3 className="mt-2 text-3xl font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.98)' }}>{val(lead.contact_name ?? lead.name, 'Unnamed lead')}</h3><div className="mt-2 text-base" style={{ color: 'rgba(255,255,255,0.74)' }}>{val(lead.company_name ?? company?.name, 'No company attached')}</div>{lead.location && <div className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.66)' }}>{String(lead.location)}</div>}</div><div className="rounded-2xl px-4 py-3 text-right" style={{ background: 'rgba(3,9,22,0.32)', border: '1px solid rgba(255,255,255,0.10)' }}><div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.58)' }}>Status</div><div className="mt-1 text-sm font-semibold capitalize" style={{ color: 'rgba(255,255,255,0.92)' }}>{statusLabel(lead.stage)}</div></div></div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><MiniStat label="Source" value={leadSourceLabel(lead.source)} onEdit={() => chooseAction('edit_details')} /><MiniStat label="Units" value={val(lead.unit_count, 'Unknown')} onEdit={() => chooseAction('edit_details')} /><MiniStat label="Phone" value={val(lead.phone)} onEdit={() => chooseAction('edit_details')} /><MiniStat label="Email" value={val(lead.email)} onEdit={() => chooseAction('edit_details')} /></div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <Section title="Address"><div className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.82)' }}>{addressText}</div></Section>
          <Section title="Interested In"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{INTEREST_OPTIONS.map(option => { const checked = interests.includes(option.label); return <button type="button" key={option.label} disabled={savingInterests} onClick={() => toggleInterest(option.label)} className="flex items-center gap-2 rounded-2xl px-3 py-2 text-left transition-opacity disabled:opacity-60" style={{ background: checked ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.04)', border: checked ? '1px solid rgba(52,211,153,0.28)' : '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.86)', cursor: 'pointer' }}><span className="flex h-4 w-4 items-center justify-center rounded border text-[10px]" style={{ borderColor: checked ? 'rgba(52,211,153,0.65)' : 'rgba(255,255,255,0.30)', background: checked ? 'rgba(52,211,153,0.18)' : 'transparent', color: checked ? '#86efac' : 'transparent' }}>✓</span><span className="text-[13px]">{option.label}</span></button> })}</div><div className="mt-3 rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.10)' }}><div className="mb-2 text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>Other</div><textarea value={otherInterestText} onChange={e => setOtherInterestText(e.target.value)} placeholder="Type any other product, service, or need here." rows={2} className="w-full resize-none rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(107,126,255,0.22)', color: 'rgba(255,255,255,0.9)' }} /><button type="button" disabled={actionBusy || !otherInterestText.trim()} onClick={() => submitLeadAction({ action: 'add_note', note: `Other interest: ${otherInterestText.trim()}` })} className="mt-2 rounded-full px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ background: '#6B7EFF', color: 'white' }}>{actionBusy ? 'Saving...' : 'Save Other'}</button></div></Section>
          <Section title="Notes / Details"><div className="space-y-2 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.78)' }}><div>{val(lead.notes, 'No notes added yet.')}</div>{lead.need && <div>Need: {String(lead.need)}</div>}{lead.need_summary && <div>Need Summary: {String(lead.need_summary)}</div>}{lead.description && <div>Description: {String(lead.description)}</div>}</div></Section>
          <Section title="People" count={contacts.length}>{primaryContact && <MiniRow title={personName(primaryContact)} subtitle={[primaryContact.title, primaryContact.email, primaryContact.phone].filter(Boolean).join(' • ')} meta="Primary" />}<div className={primaryContact ? 'mt-2' : ''}><ListBlock records={contacts.filter(c => c.id !== primaryContact?.id)} emptyText="No additional contacts linked yet." render={contact => <MiniRow title={personName(contact)} subtitle={[contact.title, contact.email, contact.phone].filter(Boolean).join(' • ')} />} /></div></Section>
          <Section title="Property / Site" count={linkedProperties.length + possibleProperties.length + sites.length}><ListBlock records={[...linkedProperties.map((item: AnyRecord) => item.properties ?? item), ...possibleProperties, ...sites]} emptyText="No property or site linked yet." render={property => <MiniRow title={val(property.name, 'Unnamed property')} subtitle={[property.address, property.city, property.state, property.zip].filter(Boolean).join(', ')} meta={property.units || property.unit_count ? `${property.units ?? property.unit_count} units` : undefined} />} /></Section>
          <DuplicateGuardSection data={data} />
          <Section title="Activity Timeline" count={activities.length}><ListBlock records={activities} emptyText="No activity yet." render={activity => <MiniRow title={val(activity.subject, val(activity.type, 'Activity'))} subtitle={val(activity.body ?? activity.outcome, '')} meta={val(activity.created_at, '')} />} /></Section>
          <Section title="Tasks / To-Dos" count={todos.length}><ListBlock records={todos} emptyText="No tasks attached yet." render={todo => <MiniRow title={val(todo.title, 'Task')} subtitle={val(todo.body, '')} meta={val(todo.status ?? todo.due_date, '')} />} /></Section>
          <Section title="Attachments" count={attachments.length + surveys.length}>
            <label className="mb-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.28)', color: 'rgba(210,245,255,0.9)' }}>
              {actionBusy ? 'Uploading…' : '+ Add file'}
              <input type="file" className="hidden" disabled={actionBusy} onChange={e => { const f = e.target.files?.[0]; if (f) void uploadAttachment(f); e.currentTarget.value = '' }} />
            </label>
            <ListBlock records={[...attachments, ...surveys]} emptyText="No attachments yet." render={item => {
              const row = <MiniRow title={val(item.file_name ?? item.name ?? item.title ?? item.filename, 'Attachment')} subtitle={val(item.file_type ?? item.status ?? item.type, '')} meta={val(item.created_at, '')} />
              return item.url ? <a href={String(item.url)} target="_blank" rel="noopener noreferrer" className="block">{row}</a> : row
            }} />
          </Section>
        </div>
        <div className="space-y-4"><Section title="Actions"><div className="space-y-2"><ActionButton title="Edit Lead Details" subtitle="Add phone, email, address, and notes." active={activeAction === 'edit_details'} onClick={() => chooseAction('edit_details')} /><ActionButton title="Create Opportunity" subtitle="This looks like a real deal." active={activeAction === 'create_opportunity'} onClick={() => chooseAction('create_opportunity')} /><ActionButton title="Add Note" subtitle="Remember something about this lead." active={activeAction === 'add_note'} onClick={() => chooseAction('add_note')} /><ActionButton title="Log Call" subtitle="Capture what happened on a call." active={activeAction === 'log_call'} onClick={() => chooseAction('log_call')} /><ActionButton title="Create Task / Follow-Up" subtitle="Put the next touch on your list." active={activeAction === 'schedule_followup'} onClick={() => chooseAction('schedule_followup')} /><ActionButton title="Change Lead Status" subtitle="Move this lead forward." active={activeAction === 'update_status'} onClick={() => chooseAction('update_status')} /><ActionButton title="Contact Not Found" subtitle="Needs contact research." active={false} tone="danger" onClick={() => submitLeadAction({ action: 'add_note', note: 'Contact not found — needs research.' })} />
          {activeAction === 'create_opportunity' && <div className="rounded-2xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.20)', border: '1px solid rgba(107,126,255,0.24)' }}><p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.76)' }}>Nexus will create an opportunity and carry forward this lead data.</p><div className="flex gap-2"><button type="button" onClick={() => setActiveAction(null)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}>Cancel</button><button type="button" disabled={actionBusy} onClick={() => submitLeadAction({ action: 'create_opportunity' })} className="rounded-full px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ background: '#6B7EFF', color: 'white' }}>{actionBusy ? 'Creating...' : 'Create Opportunity'}</button></div></div>}
          {activeAction === 'add_note' && <div className="rounded-2xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.20)', border: '1px solid rgba(255,255,255,0.10)' }}><textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="What should Nexus remember?" rows={3} className="w-full rounded-xl px-3 py-2 text-xs outline-none resize-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(107,126,255,0.22)', color: 'rgba(255,255,255,0.9)' }} /><div className="flex gap-2"><button type="button" onClick={() => setActiveAction(null)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}>Cancel</button><button type="button" disabled={actionBusy || !noteText.trim()} onClick={() => submitLeadAction({ action: 'add_note', note: noteText })} className="rounded-full px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ background: '#6B7EFF', color: 'white' }}>{actionBusy ? 'Saving...' : 'Save Note'}</button></div></div>}
          {activeAction === 'update_status' && <div className="rounded-2xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.20)', border: '1px solid rgba(255,255,255,0.10)' }}><label className="block text-[10px] uppercase tracking-[0.14em] mb-1" style={{ color: 'rgba(255,255,255,0.60)' }}>Change lead status to</label><select value={statusStage} onChange={e => setStatusStage(e.target.value)} className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(107,126,255,0.22)', color: 'rgba(255,255,255,0.9)' }}>{LEAD_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><div className="flex gap-2"><button type="button" onClick={() => setActiveAction(null)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}>Cancel</button><button type="button" disabled={actionBusy} onClick={() => submitLeadAction({ action: 'update_status', stage: statusStage })} className="rounded-full px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ background: '#6B7EFF', color: 'white' }}>{actionBusy ? 'Saving...' : 'Save Status'}</button></div></div>}
        </div></Section>{actionMessage && <div className="rounded-2xl p-3 text-xs" style={{ background: 'rgba(107,126,255,0.12)', border: '1px solid rgba(107,126,255,0.22)', color: 'rgba(255,255,255,0.82)' }}>{actionMessage}</div>}</div>
      </div>
    </div>
  )
}
