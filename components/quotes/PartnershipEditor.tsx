'use client'

/**
 * PartnershipEditor — rep-facing form that drives the Property Partnership letter.
 * Left: steel form (contact, scope, money, billing mode, term). Right: the live
 * PartnershipProposal letter (exactly what the client sees / prints). Saves the
 * config to quotes.partnership and flips quote_mode = 'partnership'.
 */
import { useEffect, useMemo, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { PartnershipProposal } from '@/components/public/PartnershipProposal'
import { resolvePartnership, money, residentFeeFromMonthly, type PartnershipConfig, type BillingMode } from '@/lib/partnership-proposal'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Quote = Record<string, any>
const numOrU = (v: string) => (v === '' ? undefined : Math.max(0, Number(v) || 0))

// ⚠️ These are defined at MODULE scope on purpose. When they lived inside the
// component they were a brand-new component type on every render, so React
// remounted every input on each keystroke — the "one letter at a time" bug.
const inS: React.CSSProperties = { display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 9, background: '#0c1420', border: '1px solid rgba(140,170,200,0.24)', color: '#eef4fb', fontSize: 13 }
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#9fb4c9' }
const Field = ({ l, children }: { l: string; children: React.ReactNode }) => (<label style={lbl}>{l}{children}</label>)
const Sec = ({ t }: { t: string }) => <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5FB8E0', margin: '14px 0 6px' }}>{t}</div>

const stepBtn: React.CSSProperties = { width: 30, height: 34, borderRadius: 8, border: '1px solid rgba(140,170,200,0.3)', background: 'rgba(95,184,224,0.1)', color: '#9FD8EC', fontSize: 18, fontWeight: 700, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }
// Tap-friendly number control: [−] value [+]. Steppers keep the form 5th-grader simple.
function Stepper({ label, value, onChange, min = 0, step = 1, prefix = '' }: { label: string; value?: number; onChange: (v: number) => void; min?: number; step?: number; prefix?: string }) {
  const v = value ?? 0
  return (
    <div>
      <div style={lbl}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <button type="button" onClick={() => onChange(Math.max(min, v - step))} style={stepBtn}>−</button>
        <div style={{ position: 'relative', flex: 1 }}>
          {prefix && <span style={{ position: 'absolute', left: 8, top: 9, color: '#8fa4b8', fontSize: 12 }}>{prefix}</span>}
          <input type="number" min={min} value={v} onChange={e => onChange(Math.max(min, Number(e.target.value) || 0))} style={{ display: 'block', width: '100%', padding: '8px 10px', paddingLeft: prefix ? 18 : 10, borderRadius: 9, background: '#0c1420', border: '1px solid rgba(140,170,200,0.24)', color: '#eef4fb', fontSize: 13, textAlign: 'center' }} />
        </div>
        <button type="button" onClick={() => onChange(v + step)} style={stepBtn}>+</button>
      </div>
    </div>
  )
}
const groupCard: React.CSSProperties = { padding: 10, borderRadius: 10, background: 'rgba(95,184,224,0.05)', border: '1px solid rgba(140,170,200,0.18)', marginBottom: 8 }
const groupTitle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#cfe0f0', marginBottom: 6 }
const toggleRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, color: '#c3d3e2', fontWeight: 600 }

export function PartnershipEditor({ id }: { id: string }) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [cfg, setCfg] = useState<PartnershipConfig>({})
  const [propName, setPropName] = useState('')
  const [propAddr, setPropAddr] = useState('')
  const [units, setUnits] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // Review gate
  const { user } = useUser()
  const isCorporate = (user?.publicMetadata as { org_tier?: string } | undefined)?.org_tier === 'corporate'
  const [reviewStatus, setReviewStatus] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState<string>('')
  const [busy, setBusy] = useState<string | null>(null)
  const [reviewMsg, setReviewMsg] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  // Auto resident fee (from the rough calculator): perUnit/mo × 12 × 1.2, ceil $5.
  const [perUnitMonthly, setPerUnitMonthly] = useState<number | null>(null)
  const [suggestedFee, setSuggestedFee] = useState<number | null>(null)

  useEffect(() => {
    if (!id) return
    // ?internal=1 — the rep editor may load its own unapproved draft (the gate
    // only hides the client-facing link).
    fetch(`/api/quotes/${id}/public?internal=1`).then(r => r.json()).then(j => {
      if (j?.error) { setErr(j.error); return }
      const q = j.quote || {}
      setQuote(q); setCfg(q.partnership && typeof q.partnership === 'object' ? q.partnership : {})
      setPropName(q.property_name ?? q.client_name ?? '')
      setPropAddr(q.property_address ?? '')
      setUnits(q.units != null ? String(q.units) : '')
      setReviewStatus(q.review_status ?? null)
      setReviewNote(q.review_note ?? '')
    }).catch(() => setErr('Could not load this quote.'))
  }, [id])

  const set = (k: keyof PartnershipConfig, v: unknown) => { setCfg(p => ({ ...p, [k]: v })); setSaved(false) }
  // Scope-grid override rows (up to 4). Blank rows are ignored — the letter then
  // auto-builds the grid from the counts above.
  const setStat = (i: number, key: 'num' | 'label', val: string) => {
    setCfg(p => {
      const next = [...(p.scope_stats ?? [])]
      while (next.length < 4) next.push({})
      next[i] = { ...next[i], [key]: val }
      return { ...p, scope_stats: next }
    })
    setSaved(false)
  }
  const previewQuote = useMemo(() => ({ ...(quote ?? {}), property_name: propName, property_address: propAddr, units: Number(units) || 0 }), [quote, propName, propAddr, units])
  const r = useMemo(() => resolvePartnership(previewQuote, cfg), [previewQuote, cfg])
  const resident = (cfg.billing_mode ?? 'resident') !== 'property_monthly'
  const residentAuto = cfg.resident_fee_auto !== false // default on

  // Pull the rough calculator's $/unit/month for this site, then derive the
  // resident fee (×12, +20%, ceil $5). Runs server-side so the cost model never
  // ships to the browser. Debounced; only the perUnit figure comes back.
  const scopeKey = `${Number(units) || 0}|${r.accessPoints}|${r.camerasIncluded ? r.cameras : 0}`
  useEffect(() => {
    const [u, ep, cam] = scopeKey.split('|').map(Number)
    if (!u) { setPerUnitMonthly(null); setSuggestedFee(null); return }
    const t = setTimeout(() => {
      fetch('/api/pricing/compute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ livingUnits: u, entryPoints: ep, camerasMonitored: cam, camerasNonMonitored: 0, smartPackage: 'none', cellular: 'none', dealerMaintainsEntry: true }),
      }).then(res => res.json()).then(j => {
        const perUnit = j?.result?.perUnit
        if (typeof perUnit !== 'number') return
        setPerUnitMonthly(perUnit)
        setSuggestedFee(residentFeeFromMonthly(perUnit))
      }).catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [scopeKey])

  // In auto mode, keep resident_fee in sync with the suggestion.
  useEffect(() => {
    if (residentAuto && suggestedFee != null && suggestedFee !== cfg.resident_fee) {
      setCfg(p => ({ ...p, resident_fee: suggestedFee }))
    }
  }, [residentAuto, suggestedFee, cfg.resident_fee])

  async function save() {
    setSaving(true); setErr(null)
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnership: cfg, quote_mode: 'partnership', property_name: propName, property_address: propAddr, units: Number(units) || 0 }),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j?.error || 'Save failed.'); return }
      setSaved(true)
      // Server resets a dealer's proposal to 'draft' on save; corporate auto-approves.
      setReviewStatus(isCorporate ? 'approved' : 'draft')
    } catch { setErr('Save failed.') }
    finally { setSaving(false) }
  }

  async function review(action: 'submit' | 'approve' | 'request_changes', note?: string) {
    setBusy(action); setReviewMsg(null); setErr(null)
    try {
      const res = await fetch(`/api/quotes/${id}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(j?.error || 'Could not update review.'); return }
      setReviewStatus(j.review_status)
      setReviewMsg(
        action === 'submit' ? 'Submitted for review — the GateGuard team has been notified.'
        : action === 'approve' ? 'Approved — the client link and PDF are unlocked.'
        : 'Sent back for changes.'
      )
    } catch { setErr('Could not update review.') }
    finally { setBusy(null) }
  }
  const approved = reviewStatus === 'approved' || reviewStatus === null || reviewStatus === 'not_required'

  if (err && !quote) return <div style={{ padding: 40, color: '#fca5a5' }}>{err}</div>
  if (!quote) return <div style={{ padding: 40, color: '#9fb4c9' }}>Loading…</div>

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#101b2e,#0b1322)', display: 'flex' }}>
      <style>{`@media print { .pp-form,.pp-bar{display:none!important} .pp-preview{position:static!important;width:100%!important;padding:0!important;background:#fff!important} body{background:#fff!important} }`}</style>

      {/* Left form */}
      <aside className="pp-form" style={{ width: 380, flexShrink: 0, height: '100vh', overflowY: 'auto', padding: 18, borderRight: '1px solid rgba(95,184,224,0.2)' }}>
        <div className="pp-bar" style={{ marginBottom: 10 }}>
          <button
            onClick={() => {
              const oppId = quote?.opportunity_id
              if (typeof window !== 'undefined' && window.history.length > 1) window.history.back()
              else window.location.href = oppId ? `/crm/opportunities/${oppId}` : '/'
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(140,170,200,0.3)', background: 'transparent', color: '#9fb4c9', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          >← Back to opportunity</button>
        </div>
        <div className="pp-bar" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: '9px', borderRadius: 10, border: 0, fontWeight: 800, fontSize: 13, color: '#04231a', background: 'linear-gradient(135deg,#3ddc97,#12b886)', cursor: 'pointer' }}>{saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save proposal'}</button>
          <button onClick={() => window.print()} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(95,184,224,0.35)', background: 'rgba(95,184,224,0.12)', color: '#9FD8EC', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>PDF</button>
          {approved
            ? <a href={`/quotes/${id}/proposal`} target="_blank" rel="noreferrer" style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(140,170,200,0.3)', color: '#cfe0f0', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>Open ↗</a>
            : <span title="Locked until approved" style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(140,170,200,0.15)', color: 'rgba(207,224,240,0.4)', fontSize: 13, display: 'flex', alignItems: 'center', cursor: 'not-allowed' }}>🔒 Client link</span>}
        </div>
        <div className="pp-bar" style={{ marginBottom: 12 }}>
          <a href={`/quotes/${id}/agreement`} target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', padding: '8px', borderRadius: 10, border: '1px solid rgba(95,184,224,0.28)', background: 'rgba(95,184,224,0.06)', color: '#9FD8EC', fontSize: 12.5, fontWeight: 600, textDecoration: 'none' }}>View service agreement ↗ (auto-matches these terms)</a>
        </div>

        {/* Review gate */}
        {(() => {
          const meta: Record<string, { bg: string; bd: string; fg: string; label: string; note: string }> = {
            draft:             { bg: 'rgba(148,163,184,0.12)', bd: 'rgba(148,163,184,0.4)', fg: '#cbd5e1', label: 'Draft — not sent', note: 'Submit for GateGuard review before this can be sent to the client.' },
            pending:           { bg: 'rgba(251,191,36,0.12)',  bd: 'rgba(251,191,36,0.45)', fg: '#fcd34d', label: 'Pending review', note: 'The GateGuard team has been notified. The client link is locked until approved.' },
            changes_requested: { bg: 'rgba(248,113,113,0.12)', bd: 'rgba(248,113,113,0.45)', fg: '#fca5a5', label: 'Changes requested', note: reviewNote || 'GateGuard asked for changes. Update and re-submit.' },
            approved:          { bg: 'rgba(52,211,153,0.12)',  bd: 'rgba(52,211,153,0.45)', fg: '#6ee7b7', label: 'Approved — cleared to send', note: 'The client link and PDF are unlocked.' },
          }
          const m = meta[reviewStatus ?? 'draft'] ?? meta.draft
          const showGate = reviewStatus != null && reviewStatus !== 'not_required'
          if (!showGate && isCorporate) return null // corporate on a not-yet-gated quote: nothing to show
          return (
            <div className="pp-bar" style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: m.bg, border: `1px solid ${m.bd}` }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: m.fg }}>{m.label}</div>
              <div style={{ fontSize: 11, color: '#a9bccf', marginTop: 3 }}>{m.note}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {!isCorporate && reviewStatus !== 'pending' && reviewStatus !== 'approved' && (
                  <button onClick={() => review('submit')} disabled={busy === 'submit'} style={{ padding: '7px 12px', borderRadius: 8, border: 0, fontWeight: 700, fontSize: 12, color: '#04231a', background: 'linear-gradient(135deg,#5FB8E0,#2f7fb8)', cursor: 'pointer' }}>{busy === 'submit' ? 'Submitting…' : 'Submit for review'}</button>
                )}
                {isCorporate && (
                  <>
                    <button onClick={() => review('approve')} disabled={busy === 'approve'} style={{ padding: '7px 12px', borderRadius: 8, border: 0, fontWeight: 700, fontSize: 12, color: '#04231a', background: 'linear-gradient(135deg,#3ddc97,#12b886)', cursor: 'pointer' }}>{busy === 'approve' ? 'Approving…' : 'Approve'}</button>
                    <button onClick={() => review('request_changes', reviewNote)} disabled={busy === 'request_changes'} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(248,113,113,0.5)', fontWeight: 700, fontSize: 12, color: '#fca5a5', background: 'transparent', cursor: 'pointer' }}>Request changes</button>
                  </>
                )}
              </div>
              {isCorporate && (
                <input value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Note to the dealer (optional, sent with 'Request changes')" style={{ ...inS, marginTop: 8, fontSize: 12 }} />
              )}
              {reviewMsg && <div style={{ fontSize: 11, color: '#6ee7b7', marginTop: 6 }}>{reviewMsg}</div>}
            </div>
          )
        })()}

        {err && <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 8 }}>{err}</div>}

        <Sec t="Property & contact" />
        <Field l="Property name"><input value={propName} onChange={e => { setPropName(e.target.value); setSaved(false) }} style={inS} /></Field>
        <div style={{ height: 8 }} /><Field l="Short name (headers / 'walking me through …')"><input value={cfg.property_short ?? ''} onChange={e => set('property_short', e.target.value)} placeholder="The Halston  ·  Bridgewater" style={inS} /></Field>
        <div style={{ height: 8 }} /><Field l="Address"><input value={propAddr} onChange={e => { setPropAddr(e.target.value); setSaved(false) }} placeholder="Street, City, ST ZIP" style={inS} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <Field l="Contact name"><input value={cfg.contact_name ?? ''} onChange={e => set('contact_name', e.target.value)} style={inS} /></Field>
          <Field l="Contact title"><input value={cfg.contact_title ?? ''} onChange={e => set('contact_title', e.target.value)} style={inS} /></Field>
          <Field l="Management co"><input value={cfg.management_co ?? ''} onChange={e => set('management_co', e.target.value)} style={inS} /></Field>
          <Field l="Units"><input type="number" min={0} value={units} onChange={e => { setUnits(e.target.value); setSaved(false) }} style={inS} /></Field>
        </div>

        <Sec t="Openings & condition" />
        <div style={{ fontSize: 11, color: '#8fa4b8', marginBottom: 8 }}>Count each opening as Working or Needs repair. Repair openings price higher — the letter writes itself.</div>
        <div style={groupCard}>
          <div style={groupTitle}>Entry gates</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Stepper label="Working" value={cfg.entry_gates_working} onChange={v => set('entry_gates_working', v)} />
            <Stepper label="Needs repair" value={cfg.entry_gates_repair} onChange={v => set('entry_gates_repair', v)} />
          </div>
        </div>
        <div style={groupCard}>
          <div style={groupTitle}>Exit gates</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Stepper label="Working" value={cfg.exit_gates_working} onChange={v => set('exit_gates_working', v)} />
            <Stepper label="Needs repair" value={cfg.exit_gates_repair} onChange={v => set('exit_gates_repair', v)} />
          </div>
        </div>
        <div style={groupCard}>
          <div style={groupTitle}>Amenity / pedestrian doors</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Stepper label="Working" value={cfg.amenity_doors_working} onChange={v => set('amenity_doors_working', v)} />
            <Stepper label="Needs repair" value={cfg.amenity_doors_repair} onChange={v => set('amenity_doors_repair', v)} />
          </div>
          <div style={{ height: 8 }} /><Field l="How it reads (door name)"><input value={cfg.door_label ?? ''} onChange={e => set('door_label', e.target.value)} placeholder="club room door · pedestrian gate and amenity doors" style={inS} /></Field>
        </div>
        <div style={groupCard}>
          <label style={toggleRow}>
            <input type="checkbox" checked={cfg.cameras_included ?? (r.cameras > 0)} onChange={e => set('cameras_included', e.target.checked)} />
            Include cameras in the program
          </label>
          {(cfg.cameras_included ?? (r.cameras > 0)) && (
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, marginTop: 8, alignItems: 'start' }}>
              <Stepper label="How many" value={cfg.cameras} onChange={v => set('cameras', v)} />
              <Field l="Where (optional)"><input value={cfg.camera_note ?? ''} onChange={e => set('camera_note', e.target.value)} placeholder="pool, front gate, rear gate" style={inS} /></Field>
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#8fa4b8' }}>{r.accessPoints} openings — {r.workingOpenings} working, {r.repairOpenings} needing repair{r.camerasIncluded && r.cameras ? ` · ${r.cameras} cameras` : ''}</div>

        <Sec t="Set-up pricing" />
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {(['condition', 'flat'] as const).map(m => (
            <button key={m} type="button" onClick={() => set('pricing_mode', m)} style={{ flex: 1, padding: '8px 6px', borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: 'pointer', ...(((cfg.pricing_mode ?? 'condition') === m) ? { background: '#5FB8E0', border: '1px solid #5FB8E0', color: '#04202e' } : { background: 'transparent', border: '1px solid rgba(255,255,255,0.18)', color: '#c3d3e2' }) }}>{m === 'condition' ? 'By condition' : 'Flat fee'}</button>
          ))}
        </div>
        {(cfg.pricing_mode ?? 'condition') === 'flat' ? (
          <Stepper label="$ / opening — flat (all openings same)" value={cfg.setup_flat_per_opening ?? 500} onChange={v => set('setup_flat_per_opening', v)} step={50} prefix="$" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Stepper label="$ / working opening" value={cfg.setup_per_working ?? 500} onChange={v => set('setup_per_working', v)} step={50} prefix="$" />
            <Stepper label="$ / opening needing repair" value={cfg.setup_per_repair ?? 750} onChange={v => set('setup_per_repair', v)} step={50} prefix="$" />
          </div>
        )}
        <div style={{ fontSize: 11.5, color: '#a9bccf', marginTop: 8, padding: '8px 10px', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 8 }}>
          {r.pricingMode === 'flat'
            ? <>{r.accessPoints} openings × {money(r.setupFlatPerOpening)} = <b style={{ color: '#6ee7b7' }}>{money(r.setupFee)}</b> set-up<br /></>
            : <>{r.workingOpenings} × {money(r.setupPerWorking)} + {r.repairOpenings} × {money(r.setupPerRepair)} = <b style={{ color: '#6ee7b7' }}>{money(r.setupFee)}</b> set-up<br /></>}
          deposit {money(r.deposit)} at signing · {money(r.goLive)} at Go-Live
        </div>

        <Sec t="Optional add-ons" />
        <div style={groupCard}>
          <label style={toggleRow}>
            <input type="checkbox" checked={cfg.offer_gate_coverage ?? true} onChange={e => set('offer_gate_coverage', e.target.checked)} />
            Offer gate &amp; hinge coverage
          </label>
          {(cfg.offer_gate_coverage ?? true) && (
            <div style={{ marginTop: 8 }}>
              <Stepper label="$ / gate / mo" value={cfg.addon_gate_hinge_rate ?? 150} onChange={v => set('addon_gate_hinge_rate', v)} step={25} prefix="$" />
              <div style={{ fontSize: 11, color: '#8fa4b8', marginTop: 4 }}>{r.gates} gates × {money(r.addonGateRate)} = {money(r.addonGateTotal)} / mo</div>
            </div>
          )}
        </div>
        <div style={groupCard}>
          <label style={toggleRow}>
            <input type="checkbox" checked={cfg.offer_extra_cameras ?? true} onChange={e => set('offer_extra_cameras', e.target.checked)} />
            Offer extra cameras
          </label>
          {(cfg.offer_extra_cameras ?? true) && (
            <div style={{ marginTop: 8 }}>
              <Stepper label="$ / camera / mo" value={cfg.addon_camera_rate ?? 100} onChange={v => set('addon_camera_rate', v)} step={25} prefix="$" />
            </div>
          )}
        </div>

        <Sec t="Billing" />
        <div style={{ display: 'flex', gap: 6 }}>
          {(['resident', 'property_monthly'] as BillingMode[]).map(m => (
            <button key={m} onClick={() => set('billing_mode', m)} style={{ flex: 1, padding: '8px 6px', borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: 'pointer', ...(((cfg.billing_mode ?? 'resident') === m) ? { background: '#5FB8E0', border: '1px solid #5FB8E0', color: '#04202e' } : { background: 'transparent', border: '1px solid rgba(255,255,255,0.18)', color: '#c3d3e2' }) }}>{m === 'resident' ? 'Resident-funded' : 'Property bulk / mo'}</button>
          ))}
        </div>
        {resident ? (
          <div style={{ ...groupCard, marginTop: 8 }}>
            <label style={toggleRow}>
              <input type="checkbox" checked={residentAuto} onChange={e => set('resident_fee_auto', e.target.checked)} />
              Auto-calculate resident fee (from the rough calculator)
            </label>
            {residentAuto ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#6ee7b7' }}>{suggestedFee != null ? money(suggestedFee) : '—'}<span style={{ fontSize: 12, color: '#8fa4b8', fontWeight: 400 }}> / unit</span></div>
                <div style={{ fontSize: 11, color: '#8fa4b8', marginTop: 2 }}>{perUnitMonthly != null ? `${money(perUnitMonthly)}/unit/mo × 12 × 1.2, rounded up to $5` : 'Enter units + openings to calculate'}</div>
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                <Stepper label="Resident fee / unit" value={cfg.resident_fee ?? 100} onChange={v => set('resident_fee', v)} step={5} prefix="$" />
                {suggestedFee != null && <div style={{ fontSize: 11, color: '#8fa4b8', marginTop: 4 }}>Calculator suggests {money(suggestedFee)} — <button type="button" onClick={() => set('resident_fee', suggestedFee)} style={{ background: 'transparent', border: 0, color: '#5FB8E0', cursor: 'pointer', padding: 0, fontWeight: 700 }}>use it</button></div>}
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>
            <Field l="Property $/mo (bulk)"><input type="number" min={0} value={cfg.property_monthly ?? ''} onChange={e => set('property_monthly', numOrU(e.target.value))} placeholder="0" style={inS} /></Field>
          </div>
        )}

        <Sec t="Competitor takeover (optional)" />
        <Field l="Competitor name"><input value={cfg.takeover_competitor ?? ''} onChange={e => set('takeover_competitor', e.target.value)} placeholder="Gatewise" style={inS} /></Field>
        <div style={{ height: 8 }} /><Field l="Takeover note (optional — auto-written if blank)"><textarea value={cfg.takeover_note ?? ''} onChange={e => set('takeover_note', e.target.value)} rows={3} placeholder="Leave blank to auto-generate from the competitor name." style={{ ...inS, resize: 'vertical' }} /></Field>
        <div style={{ fontSize: 10.5, color: '#8fa4b8', marginTop: 4 }}>Adds a “We take it over” section + a “Cancel …” next step.</div>

        <Sec t="Term" />
        <Field l="Term (months)"><input type="number" min={1} value={cfg.term_months ?? ''} onChange={e => set('term_months', numOrU(e.target.value))} placeholder="60" style={inS} /></Field>

        {/* Advanced — everything below auto-writes from the numbers above; only touch to override wording. */}
        <div style={{ marginTop: 16, borderTop: '1px solid rgba(140,170,200,0.15)', paddingTop: 12 }}>
          <button type="button" onClick={() => setShowAdvanced(s => !s)} style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer', color: '#9fb4c9', fontSize: 12, fontWeight: 700 }}>
            {showAdvanced ? '▾' : '▸'} Fine-tune wording (optional)
          </button>
          {showAdvanced && (
            <div style={{ marginTop: 10 }}>
              <Field l="Openings breakdown (intro)"><input value={cfg.openings_breakdown ?? ''} onChange={e => set('openings_breakdown', e.target.value)} placeholder="auto: five vehicle gates, the pedestrian gate, and five amenity doors" style={inS} /></Field>
              <div style={{ height: 8 }} /><Field l="Set-up note (structure paragraph)"><input value={cfg.setup_note ?? ''} onChange={e => set('setup_note', e.target.value)} placeholder={`auto: ${r.setupNote}`} style={inS} /></Field>
              <div style={{ height: 8 }} /><Field l="Set-up cell note (terms box)"><input value={cfg.setup_cell_note ?? ''} onChange={e => set('setup_cell_note', e.target.value)} placeholder={`auto: ${r.setupCellNote}`} style={inS} /></Field>
              <div style={{ height: 8 }} /><Field l="Gate note"><input value={cfg.gate_note ?? ''} onChange={e => set('gate_note', e.target.value)} placeholder="optional" style={inS} /></Field>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#9fb4c9', marginTop: 12, marginBottom: 4 }}>Scope grid columns (blank = auto)</div>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 8, marginBottom: 6 }}>
                  <input value={String(cfg.scope_stats?.[i]?.num ?? '')} onChange={e => setStat(i, 'num', e.target.value)} placeholder="#" style={inS} />
                  <input value={cfg.scope_stats?.[i]?.label ?? ''} onChange={e => setStat(i, 'label', e.target.value)} placeholder={i === 3 ? 'residential units' : 'exit gates — one down today'} style={inS} />
                </div>
              ))}
              <div style={{ fontSize: 10.5, color: '#8fa4b8' }}>Now showing: {r.scopeStats.map(s => `${s.num ?? ''} ${s.label ?? ''}`.trim()).filter(Boolean).join(' · ')}</div>
            </div>
          )}
        </div>
        <div style={{ height: 40 }} />
      </aside>

      {/* Right live letter */}
      <main className="pp-preview" style={{ flex: 1, height: '100vh', overflowY: 'auto', padding: 24 }}>
        <PartnershipProposal quote={previewQuote} cfg={cfg} />
      </main>
    </div>
  )
}

export default PartnershipEditor
