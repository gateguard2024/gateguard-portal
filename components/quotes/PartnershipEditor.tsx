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
import { resolvePartnership, money, type PartnershipConfig, type BillingMode } from '@/lib/partnership-proposal'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Quote = Record<string, any>
const numOrU = (v: string) => (v === '' ? undefined : Math.max(0, Number(v) || 0))

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

  const inS: React.CSSProperties = { display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 9, background: '#0c1420', border: '1px solid rgba(140,170,200,0.24)', color: '#eef4fb', fontSize: 13 }
  const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#9fb4c9' }
  const Field = ({ l, children }: { l: string; children: React.ReactNode }) => (<label style={lbl}>{l}{children}</label>)
  const Sec = ({ t }: { t: string }) => <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5FB8E0', margin: '14px 0 6px' }}>{t}</div>

  if (err && !quote) return <div style={{ padding: 40, color: '#fca5a5' }}>{err}</div>
  if (!quote) return <div style={{ padding: 40, color: '#9fb4c9' }}>Loading…</div>

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#101b2e,#0b1322)', display: 'flex' }}>
      <style>{`@media print { .pp-form,.pp-bar{display:none!important} .pp-preview{position:static!important;width:100%!important;padding:0!important;background:#fff!important} body{background:#fff!important} }`}</style>

      {/* Left form */}
      <aside className="pp-form" style={{ width: 380, flexShrink: 0, height: '100vh', overflowY: 'auto', padding: 18, borderRight: '1px solid rgba(95,184,224,0.2)' }}>
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

        <Sec t="Scope" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field l="Entry gates"><input type="number" min={0} value={cfg.entry_gates ?? ''} onChange={e => set('entry_gates', numOrU(e.target.value))} style={inS} /></Field>
          <Field l="Exit gates"><input type="number" min={0} value={cfg.exit_gates ?? ''} onChange={e => set('exit_gates', numOrU(e.target.value))} style={inS} /></Field>
          <Field l="Amenity doors"><input type="number" min={0} value={cfg.amenity_doors ?? ''} onChange={e => set('amenity_doors', numOrU(e.target.value))} style={inS} /></Field>
          <Field l="Cameras"><input type="number" min={0} value={cfg.cameras ?? ''} onChange={e => set('cameras', numOrU(e.target.value))} style={inS} /></Field>
        </div>
        <div style={{ height: 8 }} /><Field l="Camera note (optional)"><input value={cfg.camera_note ?? ''} onChange={e => set('camera_note', e.target.value)} placeholder="pool, front gate, and rear gate" style={inS} /></Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer', fontSize: 12, color: '#c3d3e2' }}>
          <input type="checkbox" checked={cfg.cameras_included ?? (r.cameras > 0)} onChange={e => set('cameras_included', e.target.checked)} />
          Cameras included in the base program (shows the camera scope + delivers line)
        </label>
        <div style={{ height: 8 }} /><Field l="Openings breakdown (intro prose)"><input value={cfg.openings_breakdown ?? ''} onChange={e => set('openings_breakdown', e.target.value)} placeholder="five vehicle gates, the pedestrian gate, and five amenity doors" style={inS} /></Field>
        <div style={{ fontSize: 11, color: '#8fa4b8', marginTop: 6 }}>{r.accessPoints} access points ({r.gates} gates + {r.amenityDoors} doors)</div>

        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#9fb4c9', marginTop: 12, marginBottom: 4 }}>Scope grid columns (leave blank to auto-build)</div>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 8, marginBottom: 6 }}>
            <input value={String(cfg.scope_stats?.[i]?.num ?? '')} onChange={e => setStat(i, 'num', e.target.value)} placeholder="#" style={inS} />
            <input value={cfg.scope_stats?.[i]?.label ?? ''} onChange={e => setStat(i, 'label', e.target.value)} placeholder={i === 0 ? 'entry gate — working' : i === 3 ? 'residential units' : 'exit gates — one down today'} style={inS} />
          </div>
        ))}
        <div style={{ fontSize: 10.5, color: '#8fa4b8' }}>Now showing: {r.scopeStats.map(s => `${s.num ?? ''} ${s.label ?? ''}`.trim()).filter(Boolean).join(' · ')}</div>

        <div style={{ height: 8 }} /><Field l="Gate note (optional)"><input value={cfg.gate_note ?? ''} onChange={e => set('gate_note', e.target.value)} placeholder="2 entry, 1 exit  ·  or: damaged, repaired" style={inS} /></Field>

        <Sec t="Money" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field l="Set-up / point"><input type="number" min={0} value={cfg.setup_per_point ?? ''} onChange={e => set('setup_per_point', numOrU(e.target.value))} placeholder="500" style={inS} /></Field>
          <Field l="Set-up total (override)"><input type="number" min={0} value={cfg.setup_fee ?? ''} onChange={e => set('setup_fee', numOrU(e.target.value))} placeholder={String(r.setupFee)} style={inS} /></Field>
        </div>
        <div style={{ height: 8 }} /><Field l="Set-up note (structure paragraph)"><input value={cfg.setup_note ?? ''} onChange={e => set('setup_note', e.target.value)} placeholder="$500 per opening — $5,500 for all eleven, incl. 3 cameras" style={inS} /></Field>
        <div style={{ height: 8 }} /><Field l="Set-up cell note (terms box)"><input value={cfg.setup_cell_note ?? ''} onChange={e => set('setup_cell_note', e.target.value)} placeholder="$500 per opening across all eleven openings, plus three new cameras." style={inS} /></Field>
        <div style={{ fontSize: 11, color: '#8fa4b8', marginTop: 6 }}>Set-up {money(r.setupFee)} · deposit {money(r.deposit)} · Go-Live {money(r.goLive)}</div>

        <Sec t="Billing" />
        <div style={{ display: 'flex', gap: 6 }}>
          {(['resident', 'property_monthly'] as BillingMode[]).map(m => (
            <button key={m} onClick={() => set('billing_mode', m)} style={{ flex: 1, padding: '8px 6px', borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: 'pointer', ...(((cfg.billing_mode ?? 'resident') === m) ? { background: '#5FB8E0', border: '1px solid #5FB8E0', color: '#04202e' } : { background: 'transparent', border: '1px solid rgba(255,255,255,0.18)', color: '#c3d3e2' }) }}>{m === 'resident' ? 'Resident-funded' : 'Property bulk / mo'}</button>
          ))}
        </div>
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field l="Resident fee / unit"><input type="number" min={0} value={cfg.resident_fee ?? ''} onChange={e => set('resident_fee', numOrU(e.target.value))} placeholder="100" style={{ ...inS, opacity: resident ? 1 : 0.5 }} disabled={!resident} /></Field>
          <Field l="Property $/mo (bulk)"><input type="number" min={0} value={cfg.property_monthly ?? ''} onChange={e => set('property_monthly', numOrU(e.target.value))} placeholder="0" style={{ ...inS, opacity: resident ? 0.5 : 1 }} disabled={resident} /></Field>
        </div>

        <Sec t="Competitor takeover (optional)" />
        <Field l="Competitor name"><input value={cfg.takeover_competitor ?? ''} onChange={e => set('takeover_competitor', e.target.value)} placeholder="Gatewise" style={inS} /></Field>
        <div style={{ height: 8 }} /><Field l="Takeover note (optional — auto-written if blank)"><textarea value={cfg.takeover_note ?? ''} onChange={e => set('takeover_note', e.target.value)} rows={3} placeholder="Leave blank to auto-generate from the competitor name." style={{ ...inS, resize: 'vertical' }} /></Field>
        <div style={{ fontSize: 10.5, color: '#8fa4b8', marginTop: 4 }}>Adds a “We take it over” section + a “Cancel …” next step.</div>

        <Sec t="Term" />
        <Field l="Term (months)"><input type="number" min={1} value={cfg.term_months ?? ''} onChange={e => set('term_months', numOrU(e.target.value))} placeholder="60" style={inS} /></Field>
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
