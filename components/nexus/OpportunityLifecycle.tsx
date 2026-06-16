'use client'

// Opportunity Life Cycle — glass shell (7 stages). Mock UI, on-vision.
// Vision: docs/nexus/OPPORTUNITY_LIFECYCLE_VISION.md. Wired to real data in AM.
import { useCallback, useEffect, useRef, useState } from 'react'
import { PricingCalculator } from '@/components/nexus/PricingCalculator'

const cyan = '#00C8FF'
const STAGES = ['Overview', 'Survey', 'Financials', 'Proposal', 'Negotiate', 'Contract & Invoice', 'Sign', 'Payment'] as const

// Canonical stage key per lifecycle step (what we PATCH onto opportunities.stage).
const STAGE_KEYS = ['overview', 'survey', 'financials', 'proposal', 'negotiate', 'contract_invoice', 'sign', 'payment'] as const
// Tolerant map from whatever stage an opp currently has → the right step index.
const STAGE_TO_STEP: Record<string, number> = {
  overview: 0, new: 0, lead: 0, info_request: 0,
  survey_request: 1, site_survey: 1, survey: 1, meet_present: 1,
  pre_approval: 2, financials: 2, quote: 2,
  proposal: 3, propose: 3, proposal_sent: 3,
  negotiate: 4, negotiation: 4,
  agreement_deposit: 5, contract_invoice: 5, contract: 5,
  agreement_signed: 6, sign: 6, signed: 6,
  deposit_collected: 7, payment: 7, won: 7,
}

const cardStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 18 } as const
const inputStyle = { background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.92)', borderRadius: 12, padding: '10px 12px', width: '100%' } as const
const btn = { background: 'rgba(0,200,255,0.18)', border: '1px solid rgba(0,200,255,0.45)', color: '#7DE5FF', borderRadius: 12, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ ...cardStyle, ...style }}>{children}</div>
}
function H({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.95)', marginBottom: 12 }}>{children}</div>
}
function Sub({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{children}</div>
}

export function OpportunityLifecycle({ opportunityId, onClose, initialStage }: { opportunityId?: string; onClose?: () => void; initialStage?: number } = {}) {
  const [stage, setStage] = useState(initialStage ?? 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<Record<string, any> | null>(null)
  const opp = (data?.opportunity ?? {}) as Record<string, any>

  // Load the real opportunity (when opened from New / Existing / Lead-convert).
  const loadData = useCallback(async () => {
    if (!opportunityId) return
    try {
      const res = await fetch(`/api/nexus/opps/opportunity-window/${opportunityId}`)
      const payload = await res.json().catch(() => ({}))
      setData(payload)
      const o = payload.opportunity ?? {}
      // A shortcut (Site Survey / BOM / SOW / Proposals) sets initialStage → it wins.
      if (initialStage == null && o.stage && STAGE_TO_STEP[o.stage] != null) setStage(STAGE_TO_STEP[o.stage])
    } catch { /* keep defaults */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunityId])
  useEffect(() => { void loadData() }, [loadData])

  // Advance/jump a stage → persist to the opportunity (best-effort; interns refine in #82).
  function goToStage(i: number) {
    setStage(i)
    if (opportunityId) {
      void fetch(`/api/crm/opportunities/${opportunityId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: STAGE_KEYS[i] }),
      }).catch(() => {})
    }
  }

  const dealName = (opp?.name || opp?.account_name || 'New opportunity') as string
  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at top left, #11183a, #050712 50%)', color: 'white', fontFamily: 'Inter, Arial, sans-serif', padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {onClose && <button onClick={onClose} style={{ marginBottom: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.8)', borderRadius: 999, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Back to Sales</button>}
        <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7DE5FF' }}>Opportunity · {dealName}{opp?.account_name && opp?.name ? ` · ${opp.account_name}` : ''}</div>
        <h1 style={{ margin: '4px 0 4px', fontSize: 26 }}>Deal life cycle</h1>
        <Sub>Move the deal from survey to signed &amp; paid. One step at a time.</Sub>

        {/* Stepper */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '20px 0 24px' }}>
          {STAGES.map((s, i) => {
            const active = i === stage, done = i < stage
            return (
              <button key={s} onClick={() => goToStage(i)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 14, cursor: 'pointer',
                background: active ? 'rgba(0,200,255,0.18)' : done ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? 'rgba(0,200,255,0.5)' : done ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.1)'}`,
                color: active ? '#7DE5FF' : done ? '#6ee7b7' : 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600,
              }}>
                <span style={{ width: 20, height: 20, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, background: 'rgba(0,0,0,0.3)' }}>{done ? '✓' : i + 1}</span>
                {s}
              </button>
            )
          })}
        </div>

        {stage === 0 && <Overview data={data} opportunityId={opportunityId} onSaved={loadData} />}
        {stage === 1 && <Survey opportunityId={opportunityId} opp={opp} />}
        {stage === 2 && <Financials opp={opp} />}
        {stage === 3 && <Proposal />}
        {stage === 4 && <Negotiate />}
        {stage === 5 && <ContractInvoice />}
        {stage === 6 && <Sign />}
        {stage === 7 && <Payment />}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <button onClick={() => goToStage(Math.max(0, stage - 1))} disabled={stage === 0} style={{ ...btn, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', opacity: stage === 0 ? 0.4 : 1 }}>← Back</button>
          <button onClick={() => stage === STAGES.length - 1 ? onClose?.() : goToStage(Math.min(STAGES.length - 1, stage + 1))} style={btn}>{stage === STAGES.length - 1 ? 'Done' : `Next: ${STAGES[stage + 1]} →`}</button>
        </div>
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Overview({ data, opportunityId, onSaved }: { data: Record<string, any> | null; opportunityId?: string; onSaved?: () => void }) {
  const opp = data?.opportunity ?? {}
  const contact = data?.contact ?? {}
  const company = data?.company ?? {}
  const property = data?.property ?? {}
  const lead = data?.lead
  const activities: any[] = data?.activities ?? [] // eslint-disable-line @typescript-eslint/no-explicit-any
  const attachments: any[] = data?.attachments ?? [] // eslint-disable-line @typescript-eslint/no-explicit-any
  const todos: any[] = data?.todos ?? [] // eslint-disable-line @typescript-eslint/no-explicit-any
  const emails = activities.filter(a => (a.type || '').toLowerCase() === 'email')

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const emptyForm = { account_name: '', contact_name: '', email: '', phone: '', property: '', owner_name: '', units: '', unit_automation: false, mrr: '', source: '' }
  const [form, setForm] = useState(emptyForm)
  useEffect(() => {
    setForm({
      account_name: opp.account_name || company.name || '',
      contact_name: opp.contact_name || contact.contact_name || contact.name || '',
      email: opp.contact_email || contact.email || '',
      phone: opp.contact_phone || contact.phone || '',
      property: opp.property_address || property.name || property.address || '',
      owner_name: opp.owner_name || '',
      units: opp.units != null ? String(opp.units) : (contact.unit_count != null ? String(contact.unit_count) : ''),
      unit_automation: !!opp.unit_automation,
      mrr: opp.est_mrr != null ? String(opp.est_mrr) : '',
      source: opp.source || '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  async function save() {
    if (!opportunityId) { setEditing(false); return }
    setSaving(true)
    try {
      await fetch(`/api/crm/opportunities/${opportunityId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_name: form.account_name || null,
          contact_name: form.contact_name || null,
          contact_email: form.email || null,
          contact_phone: form.phone || null,
          property_address: form.property || null,
          owner_name: form.owner_name || null,
          units: form.units ? Number(form.units) : null,
          unit_automation: form.unit_automation,
          est_mrr: form.mrr ? Number(form.mrr) : null,
          source: form.source || null,
        }),
      })
      onSaved?.()
      setEditing(false)
    } finally { setSaving(false) }
  }

  // Activity composer — Log call / email / meeting / note → real crm_activities.
  const [actType, setActType] = useState<'call' | 'email' | 'meeting' | 'note'>('note')
  const [actSubject, setActSubject] = useState('')
  const [actBody, setActBody] = useState('')
  const [posting, setPosting] = useState(false)
  async function postActivity() {
    if (!opportunityId || !actSubject.trim()) return
    setPosting(true)
    try {
      await fetch('/api/crm/activities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: actType, subject: actSubject.trim(), body: actBody || null, opportunity_id: opportunityId }),
      })
      setActSubject(''); setActBody('')
      onSaved?.()
    } finally { setPosting(false) }
  }
  // Quick note (its own box) → posts a note activity so notes stack in the timeline.
  const [noteText, setNoteText] = useState('')
  async function saveNote() {
    if (!opportunityId || !noteText.trim()) return
    setPosting(true)
    try {
      await fetch('/api/crm/activities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'note', subject: 'Note', body: noteText.trim(), opportunity_id: opportunityId }),
      })
      setNoteText(''); onSaved?.()
    } finally { setPosting(false) }
  }

  // Attachment upload → signed Storage URL → PUT file → record on opportunity.
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState<string | null>(null)
  async function uploadFile(file: File) {
    if (!opportunityId) return
    setUploading(true); setUploadErr(null)
    try {
      const r = await fetch(`/api/nexus/opps/opportunity-window/${opportunityId}/attachment-url`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name }),
      })
      const sig = await r.json()
      if (!r.ok) throw new Error(sig?.error || 'Could not start upload.')
      const put = await fetch(sig.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file })
      if (!put.ok) throw new Error('Upload failed.')
      const rec = await fetch(`/api/nexus/opps/opportunity-window/${opportunityId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_attachment', file_name: file.name, url: sig.publicUrl, file_type: file.type || null, size_bytes: file.size }),
      })
      const recJson = await rec.json()
      if (!rec.ok || recJson.success === false) throw new Error(recJson?.message || 'Could not save file.')
      onSaved?.()
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : 'Upload failed.')
    } finally { setUploading(false) }
  }

  const field = (label: string, value?: string | number | null) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: 14, color: value || value === 0 ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.4)' }}>{value || value === 0 ? value : 'Not set'}</div>
    </div>
  )
  const editField = (label: string, key: keyof typeof emptyForm, numeric = false) => (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
      <input value={String(form[key] ?? '')} inputMode={numeric ? 'numeric' : 'text'} onChange={e => setForm(f => ({ ...f, [key]: numeric ? e.target.value.replace(/[^0-9.]/g, '') : e.target.value }))} style={{ ...inputStyle }} />
    </label>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
      {lead && (
        <Card style={{ gridColumn: '1 / -1', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}>
          <Sub>Converted from lead — <b style={{ color: '#c4b5fd' }}>{lead.contact_name || lead.name || 'lead'}</b>. Notes, history &amp; attachments carry over here.</Sub>
        </Card>
      )}

      <Card style={{ gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.95)' }}>Deal details</div>
          {!editing
            ? <button onClick={() => setEditing(true)} style={{ ...btn, padding: '8px 14px' }}>✏️ Edit</button>
            : <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditing(false)} style={{ ...btn, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.7)' }}>Cancel</button>
                <button onClick={save} disabled={saving} style={{ ...btn, opacity: saving ? 0.5 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
              </div>}
        </div>
        {/* Two critical fields first — these carry into Financials */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 16, marginBottom: 8, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {editing ? editField('Number of units', 'units', true) : field('Number of units', form.units || undefined)}
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Unit automation?</div>
            {editing ? (
              <div style={{ display: 'flex', gap: 8 }}>
                {[['Yes', true], ['No', false]].map(([lbl, val]) => (
                  <button key={String(val)} onClick={() => setForm(f => ({ ...f, unit_automation: val as boolean }))} style={{ ...btn, padding: '8px 18px', background: form.unit_automation === val ? 'rgba(0,200,255,0.2)' : 'rgba(255,255,255,0.05)', border: form.unit_automation === val ? '1px solid rgba(0,200,255,0.5)' : '1px solid rgba(255,255,255,0.12)', color: form.unit_automation === val ? '#7DE5FF' : 'rgba(255,255,255,0.7)' }}>{lbl}</button>
                ))}
              </div>
            ) : <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.92)' }}>{form.unit_automation ? 'Yes — locks on units' : 'No'}</div>}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: '0 24px' }}>
          {editing ? editField('Account', 'account_name') : field('Account', form.account_name || undefined)}
          {editing ? editField('Contact', 'contact_name') : field('Contact', form.contact_name || undefined)}
          {editing ? editField('Email', 'email') : field('Email', form.email || undefined)}
          {editing ? editField('Phone', 'phone') : field('Phone', form.phone || undefined)}
          {editing ? editField('Property', 'property') : field('Property', form.property || undefined)}
          {editing ? editField('Owner', 'owner_name') : field('Owner', form.owner_name || undefined)}
          {editing ? (
            <label style={{ display: 'block', marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Monthly $ (MRR)</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={form.mrr} inputMode="decimal" onChange={e => setForm(f => ({ ...f, mrr: e.target.value.replace(/[^0-9.]/g, '') }))} style={{ ...inputStyle }} />
                <button type="button" onClick={() => setForm(f => ({ ...f, mrr: String((Number(f.units) || 0) * 10) }))} style={{ ...btn, whiteSpace: 'nowrap' }}>$10 × units</button>
              </div>
            </label>
          ) : field('Monthly $ (MRR)', form.mrr ? `$${form.mrr}` : null)}
          {editing ? editField('Source', 'source') : field('Source', form.source || undefined)}
        </div>
      </Card>

      <Card>
        <H>Notes</H>
        <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note…" style={{ ...inputStyle, minHeight: 70 }} />
        <button onClick={saveNote} disabled={posting || !noteText.trim()} style={{ ...btn, marginTop: 8, opacity: posting || !noteText.trim() ? 0.5 : 1 }}>Save note</button>
        <Sub>Notes stack in the activity timeline →</Sub>
      </Card>

      <Card>
        <H>Activity timeline</H>
        {/* Log a call, email, meeting, or note right here */}
        <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {(['call', 'email', 'meeting', 'note'] as const).map(t => (
              <button key={t} onClick={() => setActType(t)} style={{ ...btn, padding: '6px 14px', textTransform: 'capitalize', background: actType === t ? 'rgba(0,200,255,0.2)' : 'rgba(255,255,255,0.05)', border: actType === t ? '1px solid rgba(0,200,255,0.5)' : '1px solid rgba(255,255,255,0.12)', color: actType === t ? '#7DE5FF' : 'rgba(255,255,255,0.7)' }}>{t}</button>
            ))}
          </div>
          <input value={actSubject} onChange={e => setActSubject(e.target.value)} placeholder={`${actType} — what happened?`} style={{ ...inputStyle, marginBottom: 8 }} />
          <textarea value={actBody} onChange={e => setActBody(e.target.value)} placeholder="Details (optional)" style={{ ...inputStyle, minHeight: 48 }} />
          <button onClick={postActivity} disabled={posting || !actSubject.trim()} style={{ ...btn, marginTop: 8, opacity: posting || !actSubject.trim() ? 0.5 : 1 }}>Add to timeline</button>
        </div>
        {activities.length === 0 ? <Sub>No calls, emails, or meetings logged yet.</Sub> : (
          <div style={{ display: 'grid', gap: 8 }}>
            {activities.slice(0, 8).map((a, i) => (
              <div key={a.id || i} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>{a.type || 'note'} {a.subject ? `· ${a.subject}` : ''}</div>
                {a.body && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{String(a.body).slice(0, 120)}</div>}
                {a.created_at && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{String(a.created_at).slice(0, 10)}</div>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <H>Attachments &amp; photos</H>
        {attachments.length === 0 ? <Sub>No files yet.</Sub> : (
          <div style={{ display: 'grid', gap: 6 }}>
            {attachments.map((at, i) => at.url
              ? <a key={at.id || i} href={at.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#7de5ff', textDecoration: 'none' }}>📎 {at.name || at.file_name || 'Attachment'}</a>
              : <div key={at.id || i} style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>📎 {at.name || at.file_name || 'Attachment'}</div>)}
          </div>
        )}
        <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) void uploadFile(f); e.target.value = '' }} />
        <button disabled={uploading || !opportunityId} onClick={() => fileRef.current?.click()} style={{ ...btn, marginTop: 12, opacity: uploading || !opportunityId ? 0.6 : 1 }}>{uploading ? 'Uploading…' : '+ Add attachment'}</button>
        {uploadErr && <Sub><span style={{ color: '#fca5a5' }}>{uploadErr}</span></Sub>}
      </Card>

      <Card>
        <H>Client emails</H>
        {emails.length === 0 ? <Sub>No emails yet.</Sub> : (
          <div style={{ display: 'grid', gap: 6 }}>
            {emails.slice(0, 6).map((e, i) => <div key={e.id || i} style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>✉️ {e.subject || '(no subject)'}</div>)}
          </div>
        )}
        <button onClick={() => setActType('email')} style={{ ...btn, marginTop: 12 }}>✉️ New email</button>
        <Sub>Logs an email on the timeline. Full send/inbox comes with Messages.</Sub>
      </Card>

      <Card>
        <H>Calendar &amp; tasks</H>
        {todos.length === 0 ? <Sub>No upcoming tasks or events.</Sub> : (
          <div style={{ display: 'grid', gap: 6 }}>
            {todos.slice(0, 6).map((t, i) => <div key={t.id || i} style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>📅 {t.title || 'Task'}{t.due_date ? ` · ${String(t.due_date).slice(0, 10)}` : ''}</div>)}
          </div>
        )}
        <button style={{ ...btn, marginTop: 12 }}>+ Add task</button>
      </Card>
    </div>
  )
}

// ─── Site Survey ──────────────────────────────────────────────────────────────
// Simple enough for a 5th grader, powerful enough for the field. Four jobs:
// 1) Voice (record / upload / paste → auto-fill devices)  2) Field notes
// 3) Photos  4) Device inventory (Location · What · Action · Working? · Notes · $)
// Everything saves onto the opportunity's survey row (devices = JSONB).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SurveyDevice = {
  id: string
  name: string
  product_id?: string | null
  source?: 'catalog' | 'one_time' | 'requested'
  brand?: string
  model?: string
  location: string
  working?: boolean | null
  action?: 'new' | 'keep' | 'service' | 'replace' | ''
  notes?: string
  repair_cost?: number | null
}

const ACTION_OPTS: { v: SurveyDevice['action']; label: string; color: string }[] = [
  { v: 'keep', label: 'Keep', color: '#6ee7b7' },
  { v: 'service', label: 'Service', color: '#7DE5FF' },
  { v: 'replace', label: 'Replace', color: '#fbbf24' },
  { v: 'new', label: 'New install', color: '#c4b5fd' },
]

const newSurveyDevice = (): SurveyDevice => ({
  id: (globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random())),
  name: '', location: '', working: null, action: '', notes: '', repair_cost: null, source: 'catalog',
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Survey({ opportunityId, opp }: { opportunityId?: string; opp?: Record<string, any> }) {
  const [surveyId, setSurveyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [transcript, setTranscript] = useState('')
  const [notes, setNotes] = useState('')
  const [devices, setDevices] = useState<SurveyDevice[]>([])
  const [photos, setPhotos] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [recording, setRecording] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef = useRef<any>(null)
  const photoRef = useRef<HTMLInputElement | null>(null)
  const audioRef = useRef<HTMLInputElement | null>(null)

  // Find-or-create the survey for this opportunity, then load it.
  useEffect(() => {
    if (!opportunityId) { setLoading(false); return }
    let cancelled = false
    void (async () => {
      try {
        const list = await fetch(`/api/surveys?opportunity_id=${opportunityId}&limit=1`).then(r => r.json()).catch(() => ({}))
        const rows: any[] = list.surveys ?? list.records ?? (Array.isArray(list) ? list : []) // eslint-disable-line @typescript-eslint/no-explicit-any
        let s = rows.find(r => r.opportunity_id === opportunityId) ?? rows[0]
        if (!s) {
          const created = await fetch('/api/surveys', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              opportunity_id: opportunityId,
              property_name: opp?.account_name || opp?.property_address || 'Site survey',
              property_address: opp?.property_address || null,
            }),
          }).then(r => r.json()).catch(() => null)
          s = created?.survey ?? created
        }
        if (cancelled || !s?.id) { if (!cancelled) setLoading(false); return }
        const full = await fetch(`/api/surveys/${s.id}`).then(r => r.json()).catch(() => ({}))
        const sv = full.survey ?? full
        if (cancelled) return
        setSurveyId(s.id)
        setTranscript(sv.voice_transcript || '')
        setNotes(sv.notes_raw || '')
        setDevices(Array.isArray(sv.devices) ? sv.devices : [])
        setPhotos(Array.isArray(sv.photos) ? sv.photos : [])
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunityId])

  async function patch(body: Record<string, unknown>) {
    if (!surveyId) return
    setSaving(true)
    try {
      await fetch(`/api/surveys/${surveyId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
    } finally { setSaving(false) }
  }
  const saveDevices = (next: SurveyDevice[]) => { setDevices(next); void patch({ devices: next }) }

  // ── Voice: browser dictation ────────────────────────────────────────────────
  function toggleRecord() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (globalThis as any).webkitSpeechRecognition || (globalThis as any).SpeechRecognition
    if (!SR) { setBanner('Voice typing needs Chrome. You can upload a recording or paste text instead.'); return }
    if (recording) { recogRef.current?.stop(); setRecording(false); return }
    const r = new SR(); r.continuous = true; r.interimResults = true; r.lang = 'en-US'
    let base = transcript
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) base += (base ? ' ' : '') + t; else interim += t
      }
      setTranscript(base + (interim ? ' ' + interim : ''))
    }
    r.onend = () => { setRecording(false); setTranscript(base); void patch({ voice_transcript: base }) }
    recogRef.current = r; r.start(); setRecording(true); setBanner(null)
  }

  async function uploadAudio(file: File) {
    setParsing(true); setBanner('Transcribing recording…')
    try {
      const form = new FormData(); form.append('audio', file)
      const j = await fetch('/api/plaud/transcribe', { method: 'POST', body: form }).then(r => r.json())
      if (j.transcript) { setTranscript(j.transcript); await patch({ voice_transcript: j.transcript }); setBanner('Transcribed. Tap "Fill from voice" to build the device list.') }
      else setBanner(j.error || 'Could not transcribe. Paste the text instead.')
    } catch { setBanner('Could not transcribe. Paste the text instead.') }
    finally { setParsing(false) }
  }

  async function fillFromVoice() {
    if (transcript.trim().length < 10) { setBanner('Record or paste a bit more first.'); return }
    setParsing(true); setBanner(null)
    try {
      const j = await fetch('/api/kb/parse-survey-transcript', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, propertyName: opp?.account_name || null }),
      }).then(r => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed: any[] = j.devices ?? []
      if (!parsed.length) { setBanner('No devices found in the recording — add them by hand below.'); return }
      const mapped: SurveyDevice[] = parsed.map(d => ({
        ...newSurveyDevice(),
        name: d.name || '', brand: d.brand || '', model: d.model || '', location: d.location || '',
        working: d.condition === 'poor' || d.condition === 'fair' ? false : true,
        action: d.action === 'new_install' ? 'new' : (d.action || ''),
        notes: d.notes || '', source: 'one_time',
      }))
      saveDevices([...devices, ...mapped])
      setBanner(`Added ${mapped.length} device${mapped.length === 1 ? '' : 's'} from your recording. Review below.`)
    } catch { setBanner('Could not read the recording. Add devices by hand below.') }
    finally { setParsing(false) }
  }

  async function uploadPhoto(file: File) {
    if (!surveyId) return
    const form = new FormData(); form.append('file', file)
    const j = await fetch(`/api/surveys/${surveyId}/upload-image`, { method: 'POST', body: form }).then(r => r.json()).catch(() => ({}))
    if (j.url) { const next = [...photos, j.url]; setPhotos(next); void patch({ photos: next }) }
  }

  if (!opportunityId) return <Card><Sub>Save the opportunity first, then the site survey opens here.</Sub></Card>
  if (loading) return <Card><Sub>Opening the site survey…</Sub></Card>

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {banner && <div style={{ ...cardStyle, padding: 12, fontSize: 13, color: '#c4b5fd', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)' }}>{banner}</div>}

      {/* 1 · Voice */}
      <Card style={{ background: 'radial-gradient(circle at 12% 0%, rgba(139,92,246,0.16), transparent 42%), rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.3)' }}>
        <H>🎙️ Talk through the property</H>
        <Sub>Walk the site and say what you see. Or upload a recording. Then tap “Fill from voice” and Nexus builds your device list.</Sub>
        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={toggleRecord} style={{ ...btn, background: recording ? 'rgba(248,113,113,0.2)' : 'rgba(139,92,246,0.2)', border: `1px solid ${recording ? 'rgba(248,113,113,0.5)' : 'rgba(139,92,246,0.5)'}`, color: recording ? '#fca5a5' : '#c4b5fd', borderRadius: 999, padding: '12px 20px' }}>{recording ? '■ Stop' : '● Record'}</button>
          <button onClick={() => audioRef.current?.click()} style={{ ...btn, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', borderRadius: 999, padding: '12px 20px' }}>⬆ Upload recording</button>
          <input ref={audioRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) void uploadAudio(f); e.target.value = '' }} />
          <button onClick={fillFromVoice} disabled={parsing} style={{ ...btn, opacity: parsing ? 0.6 : 1 }}>{parsing ? 'Working…' : '✨ Fill from voice'}</button>
        </div>
        <textarea value={transcript} onChange={e => setTranscript(e.target.value)} onBlur={() => patch({ voice_transcript: transcript })} placeholder="…your words show up here. You can also just type." rows={4} style={{ ...inputStyle, marginTop: 12, resize: 'vertical' }} />
      </Card>

      {/* 2 · Field notes */}
      <Card>
        <H>📝 Field notes</H>
        <Sub>Anything else worth remembering — access, gate codes, who you met, parking, hazards.</Sub>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => patch({ notes_raw: notes })} placeholder="Type your notes…" rows={3} style={{ ...inputStyle, marginTop: 10, resize: 'vertical' }} />
      </Card>

      {/* 3 · Photos */}
      <Card>
        <H>📷 Survey photos</H>
        <Sub>Snap the gate, the panel, the wiring — anything the installer should see.</Sub>
        {photos.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {photos.map((p, i) => <a key={i} href={p} target="_blank" rel="noreferrer"><img src={p} alt={`Photo ${i + 1}`} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)' }} /></a>)}
          </div>
        )}
        <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) void uploadPhoto(f); e.target.value = '' }} />
        <button onClick={() => photoRef.current?.click()} style={{ ...btn, marginTop: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)' }}>+ Add photo</button>
      </Card>

      {/* 4 · Device inventory */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <H>🧰 What’s on site?</H>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{saving ? 'Saving…' : `${devices.length} item${devices.length === 1 ? '' : 's'}`}</span>
        </div>
        <Sub>Add each device you find. Keep it quick — Location, what it is, is it working, and what to do.</Sub>
        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          {devices.map((d, i) => (
            <DeviceRow key={d.id} device={d} index={i + 1} surveyId={surveyId} opportunityId={opportunityId}
              onChange={nd => saveDevices(devices.map(x => x.id === d.id ? nd : x))}
              onDelete={() => saveDevices(devices.filter(x => x.id !== d.id))} />
          ))}
        </div>
        <button onClick={() => saveDevices([...devices, newSurveyDevice()])} style={{ ...btn, marginTop: 12 }}>+ Add device</button>
      </Card>
    </div>
  )
}

// One device — simple on the surface, full data underneath.
function DeviceRow({ device, index, surveyId, opportunityId, onChange, onDelete }: {
  device: SurveyDevice; index: number; surveyId: string | null; opportunityId?: string
  onChange: (d: SurveyDevice) => void; onDelete: () => void
}) {
  const [picking, setPicking] = useState(false)
  const set = (patch: Partial<SurveyDevice>) => onChange({ ...device, ...patch })
  const label = (t: string) => <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{t}</div>
  const sIn = { ...inputStyle, padding: '8px 10px', fontSize: 13 } as const

  return (
    <div style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#7DE5FF' }}>#{index}{device.source === 'requested' ? '  · 🚩 pending corporate' : device.source === 'one_time' ? '  · custom' : ''}</span>
        <button onClick={onDelete} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <div>
          {label('Where')}
          <input value={device.location} onChange={e => set({ location: e.target.value })} placeholder="Main gate, Lobby, Unit 101…" style={sIn} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          {label('What is it?')}
          <button onClick={() => setPicking(true)} style={{ ...sIn, textAlign: 'left', cursor: 'pointer', color: device.name ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.4)' }}>
            {device.name ? `${device.name}${device.brand ? ` · ${device.brand}` : ''}` : 'Tap to choose a product…'}
          </button>
        </div>
        <div>
          {label('Working?')}
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ v: true, t: 'Yes' }, { v: false, t: 'No' }].map(o => (
              <button key={o.t} onClick={() => set({ working: o.v })} style={{
                flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: device.working === o.v ? (o.v ? 'rgba(110,231,183,0.2)' : 'rgba(248,113,113,0.2)') : 'rgba(255,255,255,0.05)',
                border: `1px solid ${device.working === o.v ? (o.v ? 'rgba(110,231,183,0.5)' : 'rgba(248,113,113,0.5)') : 'rgba(255,255,255,0.12)'}`,
                color: device.working === o.v ? (o.v ? '#6ee7b7' : '#fca5a5') : 'rgba(255,255,255,0.6)',
              }}>{o.t}</button>
            ))}
          </div>
        </div>
        <div>
          {label('What to do')}
          <select value={device.action || ''} onChange={e => set({ action: e.target.value as SurveyDevice['action'] })} style={{ ...sIn, cursor: 'pointer' }}>
            <option value="">Choose…</option>
            {ACTION_OPTS.map(a => <option key={a.v} value={a.v}>{a.label}</option>)}
          </select>
        </div>
        <div>
          {label('Repair cost')}
          <input value={device.repair_cost ?? ''} onChange={e => set({ repair_cost: e.target.value ? Number(e.target.value) : null })} inputMode="decimal" placeholder="$0" style={sIn} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          {label('Notes')}
          <input value={device.notes || ''} onChange={e => set({ notes: e.target.value })} placeholder="Anything the installer should know…" style={sIn} />
        </div>
      </div>
      {picking && <ProductPicker surveyId={surveyId} opportunityId={opportunityId}
        onClose={() => setPicking(false)}
        onPick={(p) => { set(p); setPicking(false) }} />}
    </div>
  )
}

// Choose from catalog · add a one-time item · or ask corporate to add it.
function ProductPicker({ surveyId, opportunityId, onClose, onPick }: {
  surveyId: string | null; opportunityId?: string
  onClose: () => void; onPick: (p: Partial<SurveyDevice>) => void
}) {
  const [q, setQ] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [results, setResults] = useState<any[]>([])
  const [mode, setMode] = useState<'search' | 'request'>('search')
  const [req, setReq] = useState({ name: '', brand: '', model: '', category: '', est_cost: '', notes: '' })
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let active = true
    const t = setTimeout(async () => {
      const j = await fetch(`/api/products?q=${encodeURIComponent(q)}&limit=20`).then(r => r.json()).catch(() => ({}))
      if (active) setResults(j.products ?? [])
    }, 220)
    return () => { active = false; clearTimeout(t) }
  }, [q])

  async function sendRequest() {
    if (!req.name.trim()) return
    setSending(true)
    try {
      await fetch('/api/products/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...req, opportunity_id: opportunityId, survey_id: surveyId }),
      })
      // Save the line now as a custom item marked pending corporate.
      onPick({ name: req.name.trim(), brand: req.brand || '', model: req.model || '', source: 'requested', product_id: null })
    } finally { setSending(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, maxHeight: '80vh', overflow: 'auto', background: 'linear-gradient(180deg, rgba(10,20,38,0.98), rgba(4,10,24,0.98))', border: '1px solid rgba(0,200,255,0.22)', borderRadius: 22, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <H>{mode === 'search' ? 'Choose a product' : '🚩 Ask corporate to add it'}</H>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {mode === 'search' ? (
          <>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search products… (gate operator, camera, reader)" style={inputStyle} />
            <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
              {results.map(p => (
                <button key={p.id} onClick={() => onPick({ name: p.name, brand: p.brand || '', model: p.model || '', product_id: p.id, source: 'catalog' })}
                  style={{ textAlign: 'left', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px', cursor: 'pointer' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{[p.brand, p.category].filter(Boolean).join(' · ') || 'Product'}</div>
                </button>
              ))}
              {results.length === 0 && <Sub>No matches. Add it as a one-time item or ask corporate.</Sub>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button onClick={() => { if (q.trim()) onPick({ name: q.trim(), source: 'one_time', product_id: null }) }} disabled={!q.trim()}
                style={{ ...btn, flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.85)', opacity: q.trim() ? 1 : 0.5 }}>+ Use “{q.trim() || '…'}” once</button>
              <button onClick={() => { setReq(r => ({ ...r, name: q })); setMode('request') }} style={{ ...btn, flex: 1, background: 'rgba(251,191,36,0.16)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24' }}>🚩 Ask corporate</button>
            </div>
          </>
        ) : (
          <>
            <Sub>We’ll save this line now and send the details to corporate to add to the catalog.</Sub>
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              <input value={req.name} onChange={e => setReq({ ...req, name: e.target.value })} placeholder="Product name *" style={inputStyle} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input value={req.brand} onChange={e => setReq({ ...req, brand: e.target.value })} placeholder="Brand" style={inputStyle} />
                <input value={req.model} onChange={e => setReq({ ...req, model: e.target.value })} placeholder="Model" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input value={req.category} onChange={e => setReq({ ...req, category: e.target.value })} placeholder="Category" style={inputStyle} />
                <input value={req.est_cost} onChange={e => setReq({ ...req, est_cost: e.target.value })} inputMode="decimal" placeholder="Est. cost $" style={inputStyle} />
              </div>
              <input value={req.notes} onChange={e => setReq({ ...req, notes: e.target.value })} placeholder="Notes for corporate" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setMode('search')} style={{ ...btn, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.8)' }}>← Back</button>
              <button onClick={sendRequest} disabled={!req.name.trim() || sending} style={{ ...btn, flex: 1, opacity: !req.name.trim() || sending ? 0.6 : 1 }}>{sending ? 'Sending…' : 'Save line + send to corporate'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Financials({ opp }: { opp: Record<string, any> }) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card style={{ background: 'rgba(255,255,255,0.03)' }}>
        <H>Pricing &amp; profitability</H>
        <Sub>Built from the BOM. The calculator below feeds the deal — install cost + IRR keep the dealer profitable.</Sub>
        {(opp?.units || opp?.unit_automation) && <div style={{ marginTop: 10, fontSize: 12, color: '#7DE5FF' }}>Carried from Overview: {opp.units ? `${opp.units} units` : 'units not set'}{opp.unit_automation ? ' · unit automation: Yes' : ''}</div>}
      </Card>
      <PricingCalculator initialUnits={opp?.units} initialUnitAutomation={!!opp?.unit_automation} />
      <Card style={{ background: 'linear-gradient(180deg, rgba(52,211,153,0.1), rgba(8,18,34,0.6))', border: '1px solid rgba(52,211,153,0.3)' }}>
        <H>Install &amp; lifetime profitability (IRR)</H>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12 }}>
          {[['Install cost (BOM + labor)', '$8,400'], ['Upfront margin', '$3,900'], ['Monthly net (recurring)', '$1,000'], ['Deal IRR (24 mo)', '38%']].map(([k, v]) => (
            <div key={k}><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{k}</div><div style={{ fontSize: 22, fontWeight: 700, color: '#6ee7b7' }}>{v}</div></div>
          ))}
        </div>
        <Sub>Mock — wired to real BOM cost + recurring model in AM.</Sub>
      </Card>
    </div>
  )
}

function Proposal() {
  const addons = [
    { id: 'mon', name: 'Camera monitoring', price: 300 },
    { id: 'locks', name: 'Smart locks on units', price: 425 },
    { id: 'talk', name: 'Talk-down at gate', price: 95 },
  ]
  const [on, setOn] = useState<Record<string, boolean>>({})
  const base = 1250
  const total = base + addons.filter(a => on[a.id]).reduce((s, a) => s + a.price, 0)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 16 }}>
      <Card style={{ gridColumn: '1 / -1', background: 'radial-gradient(circle at 50% 0%, rgba(0,124,255,0.2), transparent 50%), rgba(255,255,255,0.04)', textAlign: 'center', padding: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7DE5FF' }}>Proposal · prepared for</div>
        <h2 style={{ margin: '6px 0', fontSize: 28 }}>The Stratford</h2>
        <Sub>A modern access &amp; security upgrade — interactive, add what you want.</Sub>
      </Card>
      <Card>
        <H>What's included</H>
        <ul style={{ paddingLeft: 18, fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.8 }}>
          <li>Gate access at 2 entry points</li><li>Common-door access control</li><li>500 resident mobile passes</li><li>4 amenity cameras</li>
        </ul>
        <div style={{ marginTop: 12, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Base service</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#7DE5FF' }}>{usd(base)}/mo</div>
      </Card>
      <Card>
        <H>Add to your plan</H>
        <Sub>Tap to add — your total updates live.</Sub>
        <div style={{ display: 'grid', gap: 10, margin: '12px 0' }}>
          {addons.map(a => (
            <button key={a.id} onClick={() => setOn(o => ({ ...o, [a.id]: !o[a.id] }))} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
              background: on[a.id] ? 'rgba(52,211,153,0.14)' : 'rgba(0,0,0,0.2)', border: `1px solid ${on[a.id] ? 'rgba(52,211,153,0.45)' : 'rgba(255,255,255,0.1)'}`, color: 'white',
            }}>
              <span><span style={{ marginRight: 8 }}>{on[a.id] ? '✓' : '+'}</span>{a.name}</span>
              <b>{usd(a.price)}/mo</b>
            </button>
          ))}
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>Your total</span>
          <span style={{ fontSize: 26, fontWeight: 800, color: '#6ee7b7' }}>{usd(total)}/mo</span>
        </div>
        <button style={{ ...btn, width: '100%', marginTop: 12, padding: '12px' }}>Accept proposal</button>
      </Card>
    </div>
  )
}

function Negotiate() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 16 }}>
      <Card>
        <H>🤖 Negotiation coach</H>
        <Sub>Ask for advice — the coach keeps you inside profitable margins (tied to the IRR model).</Sub>
        <div style={{ display: 'grid', gap: 10, margin: '14px 0' }}>
          <div style={{ alignSelf: 'flex-start', maxWidth: '85%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, padding: '10px 12px', fontSize: 13 }}>Customer says $1,250/mo is too high. What can I do?</div>
          <div style={{ alignSelf: 'flex-end', maxWidth: '85%', background: 'rgba(0,124,255,0.18)', border: '1px solid rgba(0,124,255,0.4)', borderRadius: 12, padding: '10px 12px', fontSize: 13 }}>Offer 1 month free monitoring instead of cutting the rate — keeps your recurring margin and IRR above target. Holding the monthly protects 24-mo profit.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 12px', color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>Ask the coach…<span style={{ marginLeft: 'auto', ...btn, padding: '6px 12px' }}>Send</span></div>
      </Card>
      <Card>
        <H>Suggested moves</H>
        {[['1 month free monitoring', 'Margin impact −$300 · still 34% IRR ✅'], ['Waive install fee', 'Margin impact −$1,200 · IRR 21% ⚠️'], ['Drop to $1,150/mo', 'Below target margin ❌ — not recommended']].map(([m, impact]) => (
          <div key={m} style={{ marginBottom: 10, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{m}</div><Sub>{impact}</Sub>
          </div>
        ))}
      </Card>
    </div>
  )
}

function ContractInvoice() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 16 }}>
      <Card>
        <H>Contract</H>
        <Sub>Generated from the accepted proposal + agreement template.</Sub>
        <div style={{ marginTop: 12, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7 }}>
          Service & Install Agreement — The Stratford<br />Monthly: $1,250 · Term: 36 months<br />Install: $8,400 · Deposit: 50% ($4,200)
        </div>
        <button style={{ ...btn, marginTop: 12 }}>Generate contract</button>
      </Card>
      <Card>
        <H>Deposit invoice</H>
        <Sub>Collect the deposit to lock the install.</Sub>
        <div style={{ fontSize: 30, fontWeight: 800, color: '#7DE5FF', margin: '12px 0' }}>{usd(4200)}</div>
        <Sub>50% of $8,400 install</Sub>
        <button style={{ ...btn, marginTop: 12 }}>Send deposit invoice (Stripe)</button>
      </Card>
    </div>
  )
}

function Sign() {
  return (
    <Card style={{ maxWidth: 560, margin: '0 auto' }}>
      <H>Sign the agreement</H>
      <Sub>Customer signs online — e-signature, IP captured, fully executed copy stored.</Sub>
      <div style={{ marginTop: 14, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 18, minHeight: 120, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
        Service &amp; Install Agreement — The Stratford …
      </div>
      <div style={{ marginTop: 14, borderBottom: '1px dashed rgba(255,255,255,0.3)', paddingBottom: 6, fontStyle: 'italic', color: 'rgba(255,255,255,0.4)' }}>Sign here</div>
      <button style={{ ...btn, marginTop: 16, width: '100%', padding: 12 }}>Send for signature</button>
    </Card>
  )
}

function Payment() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card style={{ background: 'linear-gradient(180deg, rgba(52,211,153,0.1), rgba(8,18,34,0.6))', border: '1px solid rgba(52,211,153,0.3)' }}>
        <H>Deposit payment</H>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#6ee7b7' }}>{usd(4200)}</div>
          <span style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(251,191,36,0.16)', border: '1px solid rgba(251,191,36,0.4)', color: '#fde68a', fontSize: 12 }}>Awaiting payment</span>
        </div>
        <Sub>When the contract is signed AND the deposit is paid, the deal converts automatically.</Sub>
      </Card>
      <Card>
        <H>Auto-handover on signed + paid</H>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 12 }}>
          <div style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#7DE5FF' }}>→ Customer created</div><Sub>The Stratford becomes an active customer account.</Sub>
          </div>
          <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6ee7b7' }}>→ Active Job created</div><Sub>Install job opens with the BOM, schedule, and deposit linked.</Sub>
          </div>
        </div>
      </Card>
    </div>
  )
}
