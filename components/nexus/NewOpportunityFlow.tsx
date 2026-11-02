'use client'

// New Opportunity — guided glass flow.
// Step 1: choose source (existing Lead or existing Customer).
// Step 2: search + pick the record.
// Step 3: the opportunity form (prefilled), then create.
// Light Apple sheet (white card on a soft dim), matching the other converted tabs.
import { useEffect, useState } from 'react'

type Source = 'lead' | 'customer' | 'blank'
type Step = 'source' | 'pick' | 'form'

type LeadRow = { id: string; name?: string; company?: string; company_name?: string; property_name?: string; contact_name?: string; stage?: string; units?: number; location?: string; mrr?: number | null; cameras?: number | null }

// `data` carries the real values. `subtitle` is only the human-readable line —
// never parse facts back out of it.
type SearchData = {
  units?: number | null
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  property_type?: string | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
}
type SearchResult = { id: string; type: string; title: string; subtitle: string; data?: SearchData }

type Selected = {
  label: string
  sublabel: string
  account_name: string
  contact_name: string
  lead_id?: string
  site_id?: string
  contact_email?: string
  contact_phone?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  property_type?: string
}

// GateGuard sales pipeline. "Deposit collected" is the conversion point —
// it will trigger Customer + active Job creation (wired in a follow-up).
const STAGES: { value: string; label: string }[] = [
  { value: 'info_request', label: 'Request for more information' },
  { value: 'site_survey', label: 'Site Survey request' },
  { value: 'pre_approval', label: 'Pre-Approval' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'agreement_deposit', label: 'Agreement & Deposit' },
  { value: 'agreement_signed', label: 'Agreement signed' },
  { value: 'deposit_collected', label: 'Deposit collected (→ Customer + Job)' },
]

const MRR_PER_UNIT = 10  // easy-start formula: $10/month/unit (refine later)

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[12px] font-medium" style={{ color: MUTED }}>{label}</div>
      {children}
    </label>
  )
}

const TEXT = '#1D1D1F', TEXT2 = '#3A3A3C', MUTED = '#6E6E73', BLUE = '#0071E3', LINE = 'rgba(0,0,0,0.08)', BORDER = 'rgba(0,0,0,0.12)'
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif'
const inputStyle = { background: '#FFFFFF', border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 10, fontFamily: FONT } as const
const INPUT = 'h-10 w-full px-3 text-[14px] outline-none focus:ring-2 focus:ring-[#0071E3]/30'
const rowStyle = { background: '#FFFFFF', border: `1px solid ${LINE}`, borderRadius: 12 } as const

export function NewOpportunityFlow({ onClose, onCreated }: { onClose: () => void; onCreated?: (id: string) => void }) {
  const [step, setStep] = useState<Step>('source')
  const [source, setSource] = useState<Source | null>(null)
  const [selected, setSelected] = useState<Selected | null>(null)

  // pick-step data
  const [query, setQuery] = useState('')
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [results, setResults] = useState<SearchResult[]>([])
  const [picking, setPicking] = useState(false)

  // form
  const [name, setName] = useState('')
  // Manual account/contact — used when starting a standalone deal (no lead/customer).
  const [manualAccount, setManualAccount] = useState('')
  const [manualContact, setManualContact] = useState('')
  const [stage, setStage] = useState('info_request')
  const [units, setUnits] = useState('')
  const [mrr, setMrr] = useState('')
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Load leads when entering the lead picker.
  useEffect(() => {
    if (step !== 'pick' || source !== 'lead') return
    let cancelled = false
    setPicking(true)
    void (async () => {
      try {
        const res = await fetch('/api/crm/leads?limit=100')
        const data = await res.json().catch(() => ([]))
        // /api/crm/leads returns a bare array of leads.
        const rows: LeadRow[] = Array.isArray(data) ? data : (data.records ?? data.leads ?? [])
        if (!cancelled) setLeads(rows)
      } catch { if (!cancelled) setLeads([]) }
      finally { if (!cancelled) setPicking(false) }
    })()
    return () => { cancelled = true }
  }, [step, source])

  // Debounced customer search.
  useEffect(() => {
    if (step !== 'pick' || source !== 'customer') return
    if (query.trim().length < 2) { setResults([]); return }
    let cancelled = false
    setPicking(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/nexus/customers-sites/search?q=${encodeURIComponent(query.trim())}`)
        const data = await res.json().catch(() => ({}))
        const rows: SearchResult[] = (data.results ?? []).filter((r: SearchResult) => ['customer', 'company', 'property', 'site'].includes(r.type))
        if (!cancelled) setResults(rows)
      } catch { if (!cancelled) setResults([]) }
      finally { if (!cancelled) setPicking(false) }
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query, step, source])

  function chooseSource(s: Source) {
    setSource(s); setQuery(''); setLeads([]); setResults([])
    // Always clear the previous pick's numbers. Without this, picking a lead
    // (which seeds units/MRR), going Back, then choosing a Customer carried the
    // OLD lead's units into the new deal — silently wrong money.
    setSelected(null); setManualAccount(''); setManualContact('')
    setName(''); setUnits(''); setMrr(''); setValue('')
    // Standalone deal — skip the picker, go straight to a blank form (no lead_id).
    if (s === 'blank') { setStep('form'); return }
    setStep('pick')
  }

  function pickLead(l: LeadRow) {
    const account = l.property_name || l.company || l.company_name || ''
    const label = l.property_name || l.name || 'Lead'
    const rawId = l.id.replace(/^show_/, '')   // tolerate any legacy "show_" prefix; leads now use real ids
    setSelected({
      label,
      sublabel: [l.location, (l.stage ?? '').replace(/_/g, ' ')].filter(Boolean).join(' · ') || account || 'Lead',
      account_name: account,
      contact_name: l.contact_name || l.name || '',
      lead_id: rawId,
    })
    const u = l.units ? Number(l.units) : 0
    setUnits(u ? String(u) : '')
    // Carry the lead's SIZED MRR (units×$10 + cams×$100) forward as the starting
    // estimate; it gets refined to the actual contract MRR later in the cycle.
    const seedMrr = (l.mrr != null && Number(l.mrr) > 0) ? Number(l.mrr) : (u ? u * MRR_PER_UNIT : 0)
    setMrr(seedMrr ? String(seedMrr) : '')
    setName(`${account || label} — Opportunity`)
    setStep('form')
  }

  // Units → MRR auto-calc ($10/unit). User can still edit MRR after.
  function onUnitsChange(raw: string) {
    const clean = raw.replace(/[^0-9]/g, '')
    setUnits(clean)
    setMrr(clean ? String(Number(clean) * MRR_PER_UNIT) : '')
  }

  function pickCustomer(r: SearchResult) {
    const d = r.data ?? {}
    setSelected({
      label: r.title,
      sublabel: r.subtitle,
      account_name: r.title,
      contact_name: r.type === 'contact' ? r.title : (d.contact_name || ''),
      // A site pick IS the property — carry the id so the deal is bound to it
      // instead of being a name-only orphan.
      site_id: r.type === 'site' ? r.id : undefined,
      contact_email: d.contact_email || undefined,
      contact_phone: d.contact_phone || undefined,
      address: d.address || undefined,
      city: d.city || undefined,
      state: d.state || undefined,
      zip: d.zip || undefined,
      property_type: d.property_type || undefined,
    })
    // Prefill units/MRR exactly like the lead path already does. The customer
    // card was showing "236 units" while the Units box sat at 0 because this
    // number was only ever in the display string.
    const u = d.units ? Number(d.units) : 0
    setUnits(u ? String(u) : '')
    setMrr(u ? String(u * MRR_PER_UNIT) : '')
    setName(`${r.title} — Opportunity`)
    setStep('form')
  }

  async function create() {
    setBusy(true); setResult(null)
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        stage,
        source: source === 'lead' ? 'lead' : source === 'customer' ? 'customer' : 'manual',
        account_name: selected?.account_name || manualAccount.trim() || null,
        contact_name: selected?.contact_name || manualContact.trim() || null,
        description: notes.trim() || null,
      }
      if (mrr.trim()) body.est_mrr = Number(mrr) || 0
      // The one-time $ column is `amount`. There is NO `value` column on
      // opportunities — writing one made PostgREST reject the whole insert
      // ("Could not find the 'value' column ... in the schema cache").
      if (value.trim()) body.amount = Number(value) || 0
      if (units.trim()) { body.units = Number(units) || 0; body.description = `${notes.trim() ? notes.trim() + '\n' : ''}Units: ${units} · MRR @ $${MRR_PER_UNIT}/unit` }
      if (selected?.lead_id) body.lead_id = selected.lead_id
      // Carry the customer's real details onto the deal so the record isn't a
      // name with nothing behind it.
      if (selected?.site_id)        body.site_id           = selected.site_id
      if (selected?.address)        body.property_address  = selected.address
      if (selected?.city)           body.property_city     = selected.city
      if (selected?.state)          body.property_state    = selected.state
      if (selected?.zip)            body.property_zip      = selected.zip
      if (selected?.property_type)  body.property_type     = selected.property_type
      if (selected?.contact_email)  body.contact_email     = selected.contact_email
      if (selected?.contact_phone)  body.contact_phone     = selected.contact_phone

      const res = await fetch('/api/crm/opportunities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message ?? data?.error ?? 'Could not create opportunity.')
      // Seamless hand-off: drop straight into the new opportunity's life cycle.
      if (onCreated && data?.id) { onCreated(String(data.id)); return }
      setResult({ ok: true, message: `Opportunity "${name.trim()}" created.` })
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'Could not create opportunity.' })
    } finally { setBusy(false) }
  }

  const leadList = query.trim()
    ? leads.filter(l => `${l.name ?? ''} ${l.company_name ?? ''} ${l.property_name ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
    : leads

  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center overflow-hidden px-4 py-6" style={{ background: 'rgba(0,0,0,0.32)' }}>
      <div role="dialog" aria-modal="true" aria-label="New opportunity"
        className="flex h-auto max-h-[calc(100dvh-3rem)] w-full max-w-xl flex-col overflow-hidden"
        style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: '0 24px 70px rgba(0,0,0,0.28)', color: TEXT, fontFamily: FONT, letterSpacing: '-0.01em' }}>
        <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${LINE}` }}>
          <div>
            <div className="text-[12px] font-medium" style={{ color: MUTED }}>New opportunity</div>
            <h2 className="mt-0.5 text-[17px] font-semibold" style={{ color: TEXT }}>
              {step === 'source' ? 'Where is this deal coming from?' : step === 'pick' ? (source === 'lead' ? 'Pick the lead' : 'Find the customer') : 'Opportunity details'}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full text-sm" style={{ background: '#F2F2F7', color: TEXT2 }}>✕</button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
          {result && (
            <div role={result.ok ? 'status' : 'alert'} className="rounded-[10px] px-3 py-2.5 text-[13px]" style={{ background: result.ok ? '#E8F6EC' : '#FFECEC', color: result.ok ? '#1A7F37' : '#D70015' }}>{result.message}</div>
          )}

          {step === 'source' && !result && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {([['lead', 'From an existing lead', 'Turn a lead you are already working into a deal.'], ['customer', 'From an existing customer', 'Start a new deal for a customer you already serve.']] as const).map(([s, title, sub]) => (
                <button key={s} type="button" onClick={() => chooseSource(s)} className="p-4 text-left transition-shadow hover:shadow-[0_0_0_1px_rgba(0,113,227,0.35)]" style={rowStyle}>
                  <div className="text-[14px] font-semibold" style={{ color: TEXT }}>{title}</div>
                  <div className="mt-1 text-[12.5px] leading-relaxed" style={{ color: MUTED }}>{sub}</div>
                </button>
              ))}
              <button type="button" onClick={() => chooseSource('blank')} className="p-4 text-left transition-shadow hover:shadow-[0_0_0_1px_rgba(0,113,227,0.35)] sm:col-span-2" style={rowStyle}>
                <div className="text-[14px] font-semibold" style={{ color: TEXT }}>Start from scratch</div>
                <div className="mt-1 text-[12.5px] leading-relaxed" style={{ color: MUTED }}>No lead or customer yet — just type the account and details.</div>
              </button>
            </div>
          )}

          {step === 'pick' && !result && (
            <div className="space-y-3">
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder={source === 'lead' ? 'Filter your leads…' : 'Search customers, companies, or properties…'} aria-label="Search" className="h-10 w-full px-3 text-[14px] outline-none focus:ring-2 focus:ring-[#0071E3]/30" style={inputStyle} />
              {picking && <div className="text-[13px]" style={{ color: MUTED }}>Searching…</div>}
              <div className="space-y-2">
                {source === 'lead' && leadList.map(l => (
                  <button key={l.id} type="button" onClick={() => pickLead(l)} className="w-full px-3 py-3 text-left transition-shadow hover:shadow-[0_0_0_1px_rgba(0,113,227,0.35)]" style={rowStyle}>
                    <div className="text-[14px] font-semibold" style={{ color: TEXT }}>{l.property_name || l.name || 'Lead'}</div>
                    <div className="mt-0.5 text-[12.5px]" style={{ color: MUTED }}>{[l.name, l.location, l.units ? `${l.units} units` : null].filter(Boolean).join(' · ') || 'Lead'}</div>
                  </button>
                ))}
                {source === 'lead' && !picking && leadList.length === 0 && <div className="rounded-[10px] px-3 py-3 text-[13px]" style={{ background: '#F5F5F7', color: MUTED }}>No leads match. Try a different name.</div>}
                {source === 'customer' && results.map(r => (
                  <button key={`${r.type}-${r.id}`} type="button" onClick={() => pickCustomer(r)} className="w-full px-3 py-3 text-left transition-shadow hover:shadow-[0_0_0_1px_rgba(0,113,227,0.35)]" style={rowStyle}>
                    <div className="text-[14px] font-semibold" style={{ color: TEXT }}>{r.title}</div>
                    <div className="mt-0.5 text-[12.5px]" style={{ color: MUTED }}>{r.subtitle}</div>
                  </button>
                ))}
                {source === 'customer' && query.trim().length < 2 && <div className="rounded-[10px] px-3 py-3 text-[13px]" style={{ background: '#F5F5F7', color: MUTED }}>Type at least 2 characters to search.</div>}
              </div>
            </div>
          )}

          {step === 'form' && !result && (
            <div className="space-y-3">
              {selected && (
                <div className="rounded-[10px] px-3 py-2.5" style={{ background: '#EEF4FF' }}>
                  <div className="text-[12px] font-medium" style={{ color: BLUE }}>{source === 'lead' ? 'From lead' : 'From customer'}</div>
                  <div className="text-[14px] font-semibold" style={{ color: TEXT }}>{selected.label}</div>
                  <div className="text-[12.5px]" style={{ color: MUTED }}>{selected.sublabel}</div>
                </div>
              )}
              {!selected && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Account / company"><input value={manualAccount} onChange={e => { setManualAccount(e.target.value); if (!name.trim()) setName(e.target.value ? `${e.target.value} — Opportunity` : '') }} placeholder="e.g. The Stratford" className={INPUT} style={inputStyle} /></Field>
                  <Field label="Contact (optional)"><input value={manualContact} onChange={e => setManualContact(e.target.value)} placeholder="Contact name" className={INPUT} style={inputStyle} /></Field>
                </div>
              )}
              <Field label="Opportunity name"><input value={name} onChange={e => setName(e.target.value)} className={INPUT} style={inputStyle} /></Field>
              <Field label="Stage">
                <select value={stage} onChange={e => setStage(e.target.value)} className={INPUT} style={inputStyle}>
                  {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Units"><input value={units} onChange={e => onUnitsChange(e.target.value)} inputMode="numeric" placeholder="0" className={INPUT} style={inputStyle} /></Field>
                <Field label={`Monthly $ (MRR · $${MRR_PER_UNIT}/unit)`}><input value={mrr} onChange={e => setMrr(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" className={INPUT} style={inputStyle} /></Field>
              </div>
              <Field label="One-time $ (optional)"><input value={value} onChange={e => setValue(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" className={INPUT} style={inputStyle} /></Field>
              <Field label="Notes (optional)"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[#0071E3]/30" style={inputStyle} /></Field>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3" style={{ borderTop: `1px solid ${LINE}` }}>
          <button type="button" onClick={() => {
            if (result) { onClose(); return }
            if (step === 'form') { setStep(source === 'blank' ? 'source' : 'pick'); return }
            if (step === 'pick') { setStep('source'); return }
            onClose()
          }} className="h-9 rounded-[10px] px-4 text-[13px] font-medium" style={{ background: '#FFFFFF', border: `1px solid ${BORDER}`, color: TEXT }}>
            {result ? 'Close' : step === 'source' ? 'Cancel' : 'Back'}
          </button>
          {result?.ok ? (
            <button type="button" onClick={onClose} className="h-9 rounded-[10px] px-4 text-[13px] font-semibold" style={{ background: BLUE, color: '#FFFFFF' }}>Done</button>
          ) : step === 'form' ? (
            <button type="button" disabled={busy || !name.trim()} onClick={create} className="h-9 rounded-[10px] px-4 text-[13px] font-semibold disabled:opacity-40" style={{ background: BLUE, color: '#FFFFFF' }}>{busy ? 'Creating…' : 'Create opportunity'}</button>
          ) : <span />}
        </div>
      </div>
    </div>
  )
}
