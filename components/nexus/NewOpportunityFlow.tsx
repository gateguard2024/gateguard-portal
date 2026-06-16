'use client'

// New Opportunity — guided glass flow.
// Step 1: choose source (existing Lead or existing Customer).
// Step 2: search + pick the record.
// Step 3: the glass opportunity form (prefilled), then create.
import { useEffect, useState } from 'react'

type Source = 'lead' | 'customer'
type Step = 'source' | 'pick' | 'form'

type LeadRow = { id: string; name?: string; company?: string; company_name?: string; property_name?: string; contact_name?: string; stage?: string; units?: number; location?: string }
type SearchResult = { id: string; type: string; title: string; subtitle: string }

type Selected = {
  label: string
  sublabel: string
  account_name: string
  contact_name: string
  lead_id?: string
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
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.55)' }}>{label}</div>
      {children}
    </label>
  )
}

const inputStyle = { background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.92)' } as const

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
    setSource(s); setQuery(''); setLeads([]); setResults([]); setStep('pick')
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
    setMrr(u ? String(u * MRR_PER_UNIT) : '')
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
    setSelected({ label: r.title, sublabel: r.subtitle, account_name: r.title, contact_name: r.type === 'contact' ? r.title : '' })
    setName(`${r.title} — Opportunity`)
    setStep('form')
  }

  async function create() {
    setBusy(true); setResult(null)
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        stage,
        source: source === 'lead' ? 'lead' : 'customer',
        account_name: selected?.account_name || null,
        contact_name: selected?.contact_name || null,
        description: notes.trim() || null,
      }
      if (mrr.trim()) body.est_mrr = Number(mrr) || 0
      if (value.trim()) body.value = Number(value) || 0
      if (units.trim()) body.description = `${notes.trim() ? notes.trim() + '\n' : ''}Units: ${units} · MRR @ $${MRR_PER_UNIT}/unit`
      if (selected?.lead_id) body.lead_id = selected.lead_id

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
    <div className="fixed inset-0 z-[96] overflow-hidden bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="mx-auto flex h-auto max-h-[calc(100dvh-3rem)] w-full max-w-xl flex-col overflow-hidden rounded-[2rem] p-5 shadow-2xl"
        style={{ background: 'radial-gradient(circle at 16% 0%, rgba(0,124,255,0.16), transparent 34%), linear-gradient(180deg, rgba(8,18,34,0.97), rgba(3,9,22,0.97))', border: '1px solid rgba(0,200,255,0.22)', boxShadow: '0 30px 100px rgba(0,0,0,0.6), 0 0 58px rgba(0,124,255,0.12)', backdropFilter: 'blur(28px)' }}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(0,200,255,0.82)' }}>New Opportunity</div>
            <h2 className="mt-1 text-xl font-semibold" style={{ color: 'rgba(255,255,255,0.97)' }}>
              {step === 'source' ? 'Where is this deal coming from?' : step === 'pick' ? (source === 'lead' ? 'Pick the lead' : 'Find the customer') : 'Opportunity details'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>✕</button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {result && (
            <div className="rounded-2xl p-3 text-xs" style={{ background: result.ok ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)', border: `1px solid ${result.ok ? 'rgba(52,211,153,0.35)' : 'rgba(248,113,113,0.35)'}`, color: result.ok ? '#6ee7b7' : '#fca5a5' }}>{result.message}</div>
          )}

          {step === 'source' && !result && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {([['lead', 'From an existing Lead', 'Convert a lead you are already working into a deal.'], ['customer', 'From an existing Customer', 'Start a new deal for a customer you already serve.']] as const).map(([s, title, sub]) => (
                <button key={s} type="button" onClick={() => chooseSource(s)} className="rounded-2xl p-4 text-left transition-all hover:-translate-y-0.5" style={{ background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.22)' }}>
                  <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>{title}</div>
                  <div className="mt-1 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{sub}</div>
                </button>
              ))}
            </div>
          )}

          {step === 'pick' && !result && (
            <div className="space-y-3">
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder={source === 'lead' ? 'Filter your leads…' : 'Search customers, companies, or properties…'} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle} />
              {picking && <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Searching…</div>}
              <div className="space-y-2">
                {source === 'lead' && leadList.map(l => (
                  <button key={l.id} type="button" onClick={() => pickLead(l)} className="w-full rounded-2xl px-3 py-3 text-left transition-all hover:-translate-y-0.5" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{l.property_name || l.name || 'Lead'}</div>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.48)' }}>{[l.name, l.location, l.units ? `${l.units} units` : null].filter(Boolean).join(' · ') || 'Lead'}</div>
                  </button>
                ))}
                {source === 'lead' && !picking && leadList.length === 0 && <div className="rounded-2xl px-3 py-3 text-xs" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)' }}>No leads match. Try a different name.</div>}
                {source === 'customer' && results.map(r => (
                  <button key={`${r.type}-${r.id}`} type="button" onClick={() => pickCustomer(r)} className="w-full rounded-2xl px-3 py-3 text-left transition-all hover:-translate-y-0.5" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{r.title}</div>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.48)' }}>{r.subtitle}</div>
                  </button>
                ))}
                {source === 'customer' && query.trim().length < 2 && <div className="rounded-2xl px-3 py-3 text-xs" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)' }}>Type at least 2 characters to search.</div>}
              </div>
            </div>
          )}

          {step === 'form' && !result && (
            <div className="space-y-3">
              {selected && (
                <div className="rounded-2xl px-3 py-2.5" style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.28)' }}>
                  <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'rgba(125,229,255,0.9)' }}>{source === 'lead' ? 'From lead' : 'From customer'}</div>
                  <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>{selected.label}</div>
                  <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{selected.sublabel}</div>
                </div>
              )}
              <Field label="Opportunity name"><input value={name} onChange={e => setName(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle} /></Field>
              <Field label="Stage">
                <select value={stage} onChange={e => setStage(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle}>
                  {STAGES.map(s => <option key={s.value} value={s.value} style={{ background: '#0b1424' }}>{s.label}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Units"><input value={units} onChange={e => onUnitsChange(e.target.value)} inputMode="numeric" placeholder="0" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle} /></Field>
                <Field label={`Monthly $ (MRR · $${MRR_PER_UNIT}/unit)`}><input value={mrr} onChange={e => setMrr(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle} /></Field>
              </div>
              <Field label="One-time $ (optional)"><input value={value} onChange={e => setValue(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle} /></Field>
              <Field label="Notes (optional)"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle} /></Field>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={() => {
            if (result) { onClose(); return }
            if (step === 'form') { setStep('pick'); return }
            if (step === 'pick') { setStep('source'); return }
            onClose()
          }} className="rounded-2xl px-4 py-2 text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
            {result ? 'Close' : step === 'source' ? 'Cancel' : 'Back'}
          </button>
          {result?.ok ? (
            <button type="button" onClick={onClose} className="rounded-2xl px-4 py-2 text-xs font-semibold" style={{ background: 'linear-gradient(135deg, #007CFF, #00C8FF)', color: 'white' }}>Done</button>
          ) : step === 'form' ? (
            <button type="button" disabled={busy || !name.trim()} onClick={create} className="rounded-2xl px-4 py-2 text-xs font-semibold disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #007CFF, #00C8FF)', color: 'white' }}>{busy ? 'Creating…' : 'Create Opportunity'}</button>
          ) : <span />}
        </div>
      </div>
    </div>
  )
}
