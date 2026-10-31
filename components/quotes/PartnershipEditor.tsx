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
import { PAGE_BG, FONT } from '@/components/nexus/tasks/shared'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Quote = Record<string, any>
const numOrU = (v: string) => (v === '' ? undefined : Math.max(0, Number(v) || 0))

// ⚠️ These are defined at MODULE scope on purpose. When they lived inside the
// component they were a brand-new component type on every render, so React
// remounted every input on each keystroke — the "one letter at a time" bug.
// Light "rich hybrid" palette — matches the ROI calculator and the client letter.
const INK = '#1D1D1F', MUT = '#6E6E73', CYAN = '#0071E3'
// Dark-rail palette — the editor's left rail matches the Nexus workbench (dark
// steel). Labels/headers go light; inputs stay light cards and the proposal
// letter on the right stays white.
const LBL_DK = '#6E6E73', TXT_DK = '#1D1D1F'
const inS: React.CSSProperties = { display: 'block', width: '100%', marginTop: 4, minHeight: 34, padding: '7px 10px', borderRadius: 8, background: '#fff', border: '1px solid rgba(0,0,0,0.14)', color: INK, fontSize: 13, fontFamily: 'inherit' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 500, color: LBL_DK }
const Field = ({ l, children }: { l: string; children: React.ReactNode }) => (<label style={lbl}>{l}{children}</label>)
const Sec = ({ t }: { t: string }) => <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: INK, margin: '22px 0 10px', paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.08)' }}>{t}</h2>

const stepBtn: React.CSSProperties = { width: 32, height: 34, borderRadius: 8, border: '1px solid rgba(0,0,0,0.14)', background: '#fff', color: CYAN, fontSize: 18, fontWeight: 500, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }
// Tap-friendly number control: [−] value [+]. Steppers keep the form 5th-grader simple.
function Stepper({ label, value, onChange, min = 0, step = 1, prefix = '' }: { label: string; value?: number; onChange: (v: number) => void; min?: number; step?: number; prefix?: string }) {
  const v = value ?? 0
  return (
    <div>
      <div style={lbl}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <button type="button" onClick={() => onChange(Math.max(min, v - step))} style={stepBtn}>−</button>
        <div style={{ position: 'relative', flex: 1 }}>
          {prefix && <span style={{ position: 'absolute', left: 8, top: 9, color: MUT, fontSize: 12 }}>{prefix}</span>}
          <input type="number" min={min} value={v} onChange={e => onChange(Math.max(min, Number(e.target.value) || 0))} style={{ display: 'block', width: '100%', padding: '8px 10px', paddingLeft: prefix ? 18 : 10, borderRadius: 8, background: '#fff', border: '1px solid rgba(0,0,0,0.14)', color: INK, fontSize: 13, textAlign: 'center', fontFamily: 'inherit' }} />
        </div>
        <button type="button" onClick={() => onChange(v + step)} style={stepBtn}>+</button>
      </div>
    </div>
  )
}
const groupCard: React.CSSProperties = { padding: 12, borderRadius: 10, background: '#F5F5F7', marginBottom: 8 }
const groupTitle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: TXT_DK, marginBottom: 6 }
const toggleRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: TXT_DK, fontWeight: 500 }

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
  // Send-to-client
  const [sendOpen, setSendOpen] = useState(false)
  const [sendTo, setSendTo] = useState('')
  const [sendCc, setSendCc] = useState('')
  const [sendSubject, setSendSubject] = useState('')
  const [attachProposal, setAttachProposal] = useState(true)
  const [attachAgreement, setAttachAgreement] = useState(true)
  const [attachSurvey, setAttachSurvey] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [contacts, setContacts] = useState<any[]>([])
  const [contactId, setContactId] = useState('')
  const [sending, setSending] = useState(false)
  const [sendMsg, setSendMsg] = useState<{ ok: boolean; text: string } | null>(null)
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
      setSendTo(q.client_email ?? '')
    }).catch(() => setErr('Could not load this quote.'))
  }, [id])

  // Load the opportunity's contacts so the rep can auto-fill "To" with the primary
  // contact (or pick another) and choose which contact is primary.
  useEffect(() => {
    const oppId = quote?.opportunity_id
    if (!oppId) return
    fetch(`/api/crm/opportunities/${oppId}/contacts`).then(r => (r.ok ? r.json() : [])).then((cs) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list: any[] = Array.isArray(cs) ? cs : []
      setContacts(list)
      const primary = list.find(c => c.is_primary) || list[0]
      if (primary) {
        setContactId(String(primary.id))
        if (primary.contact_email) setSendTo(primary.contact_email)
        // Fill the letter's addressee from the deal's primary contact when the rep
        // hasn't typed one yet (never overwrites what's already there).
        setCfg(p => ({
          ...p,
          contact_name: p.contact_name || primary.contact_name || undefined,
          contact_title: p.contact_title || primary.contact_title || primary.title || undefined,
        }))
      }
    }).catch(() => {})
  }, [quote?.opportunity_id])

  // Pick a contact as the recipient (fills "To"). Does not change the primary.
  function pickContact(cid: string) {
    setContactId(cid)
    const c = contacts.find(x => String(x.id) === cid)
    if (c?.contact_email) setSendTo(c.contact_email)
  }
  // Persist the selected contact as the opportunity's primary.
  async function makePrimary() {
    const oppId = quote?.opportunity_id
    if (!oppId || !contactId) return
    setContacts(prev => prev.map(x => ({ ...x, is_primary: String(x.id) === contactId })))
    await fetch(`/api/crm/opportunities/${oppId}/contacts`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId, is_primary: true }),
    }).catch(() => {})
  }

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

  // Deal viability (PASS/FAIL) from the ROI calculator — ROI ≤ 4 mo, positive
  // monthly profit, AND ≥ 30% margin. Runs server-side so cost constants stay off
  // the client; scope mapped from this deal's openings + fees.
  const [dealRoi, setDealRoi] = useState<{ pass: boolean; netMargin: number; roiMonths: number } | null>(null)
  useEffect(() => {
    const u = Number(units) || 0
    const payload = {
      units: u, setupFee: r.setupFee, monthlyPA: r.residentFee,
      monthlyBulkFee: (cfg.billing_mode === 'property_monthly' && u > 0) ? (Number(cfg.property_monthly) || 0) / u : 0,
      workingVehGates: cfg.entry_gates_working ?? cfg.entry_gates ?? 0,
      nonWorkingVehGates: cfg.entry_gates_repair ?? 0,
      exitGates: (cfg.exit_gates_working ?? cfg.exit_gates ?? 0) + (cfg.exit_gates_repair ?? 0),
      workingAccessDoors: cfg.amenity_doors_working ?? cfg.amenity_doors ?? 0,
      nonWorkingAccessDoors: cfg.amenity_doors_repair ?? 0,
      newCameras: cfg.cameras ?? 0,
    }
    const t = setTimeout(() => {
      fetch('/api/roi/compute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(res => res.json()).then(j => { if (j?.result) setDealRoi({ pass: !!j.result.pass, netMargin: j.result.netMargin ?? 0, roiMonths: j.result.roiMonths ?? 0 }) })
        .catch(() => {})
    }, 350)
    return () => clearTimeout(t)
  }, [r.setupFee, r.residentFee, cfg, units])
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

  async function save(): Promise<boolean> {
    setSaving(true); setErr(null)
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnership: cfg, quote_mode: 'partnership', property_name: propName, property_address: propAddr, units: Number(units) || 0 }),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j?.error || 'Save failed.'); return false }
      setSaved(true)
      // Server resets a dealer's proposal to 'draft' on save; corporate auto-approves.
      setReviewStatus(isCorporate ? 'approved' : 'draft')
      return true
    } catch { setErr('Save failed.'); return false }
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

  async function sendProposal() {
    setSending(true); setSendMsg(null)
    try {
      const res = await fetch(`/api/quotes/${id}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: sendTo, cc: sendCc || undefined, subject: sendSubject || undefined, attach_proposal: attachProposal, attach_agreement: attachAgreement, attach_survey: attachSurvey }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setSendMsg({ ok: false, text: j?.error || 'Could not send.' }); return }
      setSendMsg({ ok: true, text: `Sent to ${j.to} via ${j.via === 'gmail' ? 'your Gmail' : 'email'} ✓` })
      setReviewStatus('approved') // status is now 'sent' server-side; keep the link unlocked
    } catch { setSendMsg({ ok: false, text: 'Could not send.' }) }
    finally { setSending(false) }
  }

  if (err && !quote) return <div style={{ padding: 40, color: '#b91c1c' }}>{err}</div>
  if (!quote) return <div style={{ padding: 40, color: MUT }}>Loading…</div>

  return (
    <div className="pp-root">
      <style>{`
        .pp-root{height:100vh;display:flex;flex-direction:column;${PAGE_BG}color:#1D1D1F;font-family:${FONT};font-size:14px;line-height:1.45;letter-spacing:-.01em}
        .pp-root *{box-sizing:border-box}
        .pp-hd{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:16px 28px 16px}
        .pp-back{display:inline-flex;align-items:center;gap:6px;min-height:30px;padding:0 2px;border:0;background:none;color:#8EC1FF;font:500 14px ${FONT};cursor:pointer}
        .pp-hd h1{margin:2px 0 0;color:#fff;font-size:26px;font-weight:600;letter-spacing:-.02em}
        .pp-hd .sub{color:#C9D2E0;font-size:13px;margin-top:2px}
        .pp-acts{display:flex;flex-wrap:wrap;gap:8px}
        .pp-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:36px;padding:0 14px;border-radius:10px;border:1px solid rgba(0,0,0,.12);background:#fff;color:#1D1D1F;font:600 13px ${FONT};cursor:pointer;white-space:nowrap;text-decoration:none}
        .pp-btn.pri{background:#0071E3;border-color:#0071E3;color:#fff}.pp-btn.pri:hover{background:#0058B0}
        .pp-btn:disabled,.pp-btn.lock{opacity:.6;cursor:not-allowed}
        .pp-body{flex:1;min-height:0;display:flex;gap:20px;padding:0 28px 24px}
        .pp-form{width:400px;flex-shrink:0;overflow-y:auto;background:#fff;border-radius:12px;padding:18px 18px 8px;box-shadow:0 1px 2px rgba(10,20,40,.06),0 8px 24px rgba(10,20,40,.08)}
        .pp-form input:focus,.pp-form select:focus,.pp-form textarea:focus{outline:2px solid #0071E3;outline-offset:-1px;border-color:transparent}
        .pp-preview{flex:1;min-width:0;overflow-y:auto;border-radius:12px}
        @media (max-width:900px){
          .pp-root{height:auto;min-height:100vh}
          .pp-hd{padding:14px 16px}
          .pp-body{flex-direction:column;padding:0 16px 24px}
          .pp-form{width:auto;overflow:visible}
          .pp-preview{overflow:visible}
        }
        @media print {
          .pp-form,.pp-bar{display:none!important}
          /* The preview is a scroll container on screen; in print it must grow
             to its full height and let overflow show, or only page 1 prints. */
          .pp-preview{position:static!important;height:auto!important;max-height:none!important;overflow:visible!important;width:100%!important;padding:0!important;background:#fff!important}
          .pp-root,.pp-body{height:auto!important;min-height:0!important;overflow:visible!important;display:block!important;background:#fff!important;padding:0!important}
          html,body{height:auto!important;overflow:visible!important;background:#fff!important}
        }
      `}</style>

      <header className="pp-hd pp-bar">
        <div>
          <button
            className="pp-back"
            onClick={() => {
              if (typeof window === 'undefined') return
              // The editor opens in a tab spawned from the deal (window.open → this
              // url). Closing it returns the user to the still-open deal. If this tab
              // wasn't script-opened (direct link / same-tab fallback), close() is a
              // no-op, so fall back to Sales — never the retired /crm detail page.
              window.close()
              setTimeout(() => { if (!window.closed) window.location.href = '/?tab=opps' }, 150)
            }}
          >← Back to deal</button>
          <h1>{propName || 'Proposal'}</h1>
          <div className="sub">Property Partnership proposal{saving ? ' · Saving…' : saved ? ' · Saved' : ''}</div>
        </div>
        <div className="pp-acts">
          <a className="pp-btn" href={`/quotes/${id}/agreement`} target="_blank" rel="noreferrer" title="The service agreement matches these terms automatically">Service agreement ↗</a>
          <button className="pp-btn" onClick={async () => { await save(); window.open(`/api/quotes/${id}/proposal-pdf`, '_blank') }}>Download PDF</button>
          {approved
            ? <a className="pp-btn" href={`/quotes/${id}/proposal`} target="_blank" rel="noreferrer">Client view ↗</a>
            : <span className="pp-btn lock" title="Locked until approved">🔒 Client view</span>}
          <button className="pp-btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save & edit later'}</button>
          <button className="pp-btn pri" onClick={async () => { const ok = await save(); if (ok) await review('submit') }} disabled={saving || busy === 'submit'}>{saving || busy === 'submit' ? 'Saving…' : 'Save & review'}</button>
        </div>
      </header>

      <div className="pp-body">
      {/* Left form */}
      <aside className="pp-form">
        {/* Send to client */}
        <div className="pp-bar" style={{ marginBottom: 12 }}>
          {approved ? (
            <button onClick={() => { setSendOpen(o => !o); setSendMsg(null) }} style={{ width: '100%', padding: '10px', borderRadius: 10, border: 0, fontWeight: 600, fontSize: 13, color: '#fff', background: CYAN, cursor: 'pointer' }}>✉ Send proposal to client</button>
          ) : (
            <div title="Approve the proposal first" style={{ width: '100%', textAlign: 'center', padding: '10px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', color: MUT, fontSize: 12.5, cursor: 'not-allowed' }}>🔒 Send unlocks once approved</div>
          )}
          {approved && sendOpen && (() => {
            const selContact = contacts.find(c => String(c.id) === contactId)
            const recipFirst = (String(selContact?.contact_name || cfg.contact_name || '').trim().split(/\s+/)[0]) || r.property
            const repFirst = (String(quote?.created_by_name || '').trim().split(/\s+/)[0]) || 'Gate Guard'
            const autoSubject = `${recipFirst} - Your gate and camera repair and maintenance proposal from ${repFirst} at Gate Guard.`
            return (
            <div style={{ ...groupCard, marginTop: 8 }}>
              {contacts.length > 0 && (
                <>
                  <Field l="Recipient (from contacts)">
                    <select value={contactId} onChange={e => pickContact(e.target.value)} style={{ ...inS, cursor: 'pointer' }}>
                      {contacts.map(c => (
                        <option key={String(c.id)} value={String(c.id)}>{c.contact_name}{c.is_primary ? ' ★ primary' : ''}{c.contact_email ? ` · ${c.contact_email}` : ' · (no email)'}</option>
                      ))}
                    </select>
                  </Field>
                  <button type="button" onClick={makePrimary} disabled={!contactId || !!selContact?.is_primary} style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: selContact?.is_primary ? MUT : CYAN, background: 'transparent', border: 0, padding: 0, cursor: selContact?.is_primary ? 'default' : 'pointer' }}>{selContact?.is_primary ? '★ This is the primary contact' : '★ Make this the primary contact'}</button>
                  <div style={{ height: 8 }} />
                </>
              )}
              <Field l="To"><input value={sendTo} onChange={e => setSendTo(e.target.value)} placeholder="client@email.com" style={inS} /></Field>
              <div style={{ height: 8 }} /><Field l="CC (optional — comma-separated)"><input value={sendCc} onChange={e => setSendCc(e.target.value)} placeholder="you@gateguard.co, manager@…" style={inS} /></Field>
              <div style={{ height: 8 }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={lbl}>Subject</div>
                <button type="button" onClick={() => setSendSubject(autoSubject)} style={{ fontSize: 10.5, fontWeight: 700, color: CYAN, background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}>↺ use auto</button>
              </div>
              <input value={sendSubject} onChange={e => setSendSubject(e.target.value)} placeholder={autoSubject} style={inS} />
              <div style={{ marginTop: 8, padding: '8px 10px', background: '#EEF4FF', border: '1px solid #D6E4FF', borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: MUT, marginBottom: 6 }}>Attach as PDF</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: INK, marginBottom: 4, cursor: 'pointer' }}><input type="checkbox" checked={attachProposal} onChange={e => setAttachProposal(e.target.checked)} /> Proposal</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: INK, marginBottom: 4, cursor: 'pointer' }}><input type="checkbox" checked={attachAgreement} onChange={e => setAttachAgreement(e.target.checked)} /> Service agreement</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: INK, cursor: 'pointer' }}><input type="checkbox" checked={attachSurvey} onChange={e => setAttachSurvey(e.target.checked)} /> Pre-proposal survey (latest on this opportunity)</label>
                <div style={{ fontSize: 10.5, color: MUT, marginTop: 6 }}>The full proposal is also written into the email body. A CRM activity is logged when you send.</div>
              </div>
              <button onClick={sendProposal} disabled={sending || !sendTo} style={{ marginTop: 8, width: '100%', padding: '9px', borderRadius: 10, border: 0, fontWeight: 600, fontSize: 13, color: '#fff', background: '#248A3D', cursor: 'pointer', opacity: sending || !sendTo ? 0.6 : 1 }}>{sending ? 'Sending…' : 'Send now'}</button>
              <div style={{ fontSize: 10.5, color: MUT, marginTop: 6 }}>Sends from your connected Gmail if available, and marks the proposal as sent.</div>
              {sendMsg && <div style={{ fontSize: 11.5, marginTop: 6, color: sendMsg.ok ? '#248A3D' : '#b91c1c' }}>{sendMsg.text}</div>}
            </div>
            )
          })()}
        </div>

        {/* Review gate */}
        {(() => {
          const meta: Record<string, { bg: string; bd: string; fg: string; label: string; note: string }> = {
            draft:             { bg: 'rgba(100,116,139,0.10)', bd: 'rgba(100,116,139,0.35)', fg: '#475569', label: 'Draft — not sent', note: 'Submit for GateGuard review before this can be sent to the client.' },
            pending:           { bg: 'rgba(245,158,11,0.12)',  bd: 'rgba(245,158,11,0.4)', fg: '#b45309', label: 'Pending review', note: 'The GateGuard team has been notified. The client link is locked until approved.' },
            changes_requested: { bg: 'rgba(220,38,38,0.10)',   bd: 'rgba(220,38,38,0.35)', fg: '#b91c1c', label: 'Changes requested', note: reviewNote || 'GateGuard asked for changes. Update and re-submit.' },
            approved:          { bg: 'rgba(18,133,95,0.10)',   bd: 'rgba(18,133,95,0.4)', fg: '#248A3D', label: 'Approved — cleared to send', note: 'The client link and PDF are unlocked.' },
          }
          const m = meta[reviewStatus ?? 'draft'] ?? meta.draft
          const showGate = reviewStatus != null && reviewStatus !== 'not_required'
          if (!showGate && isCorporate) return null // corporate on a not-yet-gated quote: nothing to show
          return (
            <div className="pp-bar" style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: m.bg, border: `1px solid ${m.bd}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: m.fg }}>{m.label}</div>
              <div style={{ fontSize: 11, color: MUT, marginTop: 3 }}>{m.note}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {!isCorporate && reviewStatus !== 'pending' && reviewStatus !== 'approved' && (
                  <button onClick={() => review('submit')} disabled={busy === 'submit'} style={{ padding: '7px 12px', borderRadius: 8, border: 0, fontWeight: 700, fontSize: 12, color: '#fff', background: CYAN, cursor: 'pointer' }}>{busy === 'submit' ? 'Submitting…' : 'Submit for review'}</button>
                )}
                {isCorporate && (
                  <>
                    <button onClick={() => review('approve')} disabled={busy === 'approve'} style={{ padding: '7px 12px', borderRadius: 8, border: 0, fontWeight: 700, fontSize: 12, color: '#fff', background: '#248A3D', cursor: 'pointer' }}>{busy === 'approve' ? 'Approving…' : 'Approve'}</button>
                    <button onClick={() => review('request_changes', reviewNote)} disabled={busy === 'request_changes'} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(220,38,38,0.5)', fontWeight: 700, fontSize: 12, color: '#b91c1c', background: '#fff', cursor: 'pointer' }}>Request changes</button>
                  </>
                )}
              </div>
              {isCorporate && (
                <input value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Note to the dealer (optional, sent with 'Request changes')" style={{ ...inS, marginTop: 8, fontSize: 12 }} />
              )}
              {reviewMsg && <div style={{ fontSize: 11, color: '#248A3D', marginTop: 6 }}>{reviewMsg}</div>}
            </div>
          )
        })()}

        {err && <div style={{ color: '#b91c1c', fontSize: 12, marginBottom: 8 }}>{err}</div>}

        {dealRoi && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: dealRoi.pass ? '#E8F6EC' : '#FFECEC', border: `1px solid ${dealRoi.pass ? '#BFE5C8' : '#F5C2C2'}` }}>
            <div style={{ fontSize: 11.5, color: '#3A3A3C', lineHeight: 1.35 }}>Deal viability · ROI calc<br /><span style={{ color: MUT, fontSize: 10.5 }}>{Math.round((dealRoi.netMargin || 0) * 100)}% margin · {isFinite(dealRoi.roiMonths) ? dealRoi.roiMonths : '∞'} mo payback · needs ≥30% &amp; ≤4mo</span></div>
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '0.04em', color: dealRoi.pass ? '#248A3D' : '#D70015' }}>{dealRoi.pass ? 'PASS' : 'FAIL'}</div>
          </div>
        )}

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

        <Sec t="Your signature (on the proposal & email)" />
        <Field l="Rep name"><input value={cfg.rep_name ?? ''} onChange={e => set('rep_name', e.target.value)} placeholder="Leave blank to use your profile" style={inS} /></Field>
        <div style={{ height: 8 }} /><Field l="Dealer / company"><input value={cfg.rep_dealer ?? ''} onChange={e => set('rep_dealer', e.target.value)} placeholder="Your dealer name" style={inS} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <Field l="Phone"><input value={cfg.rep_phone ?? ''} onChange={e => set('rep_phone', e.target.value)} placeholder="(555) 123-4567" style={inS} /></Field>
          <Field l="Email"><input value={cfg.rep_email ?? ''} onChange={e => set('rep_email', e.target.value)} placeholder="you@dealer.com" style={inS} /></Field>
        </div>
        <div style={{ fontSize: 11, color: MUT, marginTop: 6 }}>Shows under “Respectfully,” on the letter and in the sent email. Blank fields fall back to your profile.</div>

        <Sec t="Openings & condition" />
        <div style={{ fontSize: 11, color: MUT, marginBottom: 8 }}>Count each opening as Working or Needs repair. Repair openings price higher — the letter writes itself.</div>
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
        <div style={{ fontSize: 11, color: MUT }}>{r.accessPoints} openings — {r.workingOpenings} working, {r.repairOpenings} needing repair{r.camerasIncluded && r.cameras ? ` · ${r.cameras} cameras` : ''}</div>

        <Sec t="Set-up pricing" />
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {(['condition', 'flat'] as const).map(m => (
            <button key={m} type="button" onClick={() => set('pricing_mode', m)} style={{ flex: 1, padding: '8px 6px', borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: 'pointer', ...(((cfg.pricing_mode ?? 'condition') === m) ? { background: CYAN, border: '1px solid #00A3FF', color: '#fff' } : { background: '#fff', border: '1px solid rgba(0,0,0,0.14)', color: '#3A3A3C' }) }}>{m === 'condition' ? 'By condition' : 'Flat fee'}</button>
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
        <div style={{ fontSize: 11.5, color: INK, marginTop: 8, padding: '8px 10px', background: '#E8F6EC', border: '1px solid #BFE5C8', borderRadius: 8 }}>
          {r.pricingMode === 'flat'
            ? <>{r.accessPoints} openings × {money(r.setupFlatPerOpening)} = <b style={{ color: '#248A3D' }}>{money(r.setupFee)}</b> set-up<br /></>
            : <>{r.workingOpenings} × {money(r.setupPerWorking)} + {r.repairOpenings} × {money(r.setupPerRepair)} = <b style={{ color: '#248A3D' }}>{money(r.setupFee)}</b> set-up<br /></>}
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
              <div style={{ fontSize: 11, color: MUT, marginTop: 4 }}>{r.gates} gates × {money(r.addonGateRate)} = {money(r.addonGateTotal)} / mo</div>
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
        <div style={groupCard}>
          <label style={toggleRow}>
            <input type="checkbox" checked={cfg.offer_smart_locks ?? false} onChange={e => set('offer_smart_locks', e.target.checked)} />
            Offer smart locks
          </label>
          {(cfg.offer_smart_locks ?? false) && (
            <div style={{ marginTop: 8 }}>
              <Stepper label="Resident fee / unit (locks elected)" value={cfg.smart_lock_resident_fee ?? 150} onChange={v => set('smart_lock_resident_fee', v)} step={5} prefix="$" />
              <div style={{ height: 6 }} />
              <Stepper label="Install / unit at flip (property pays)" value={cfg.smart_lock_install_per_unit ?? 375} onChange={v => set('smart_lock_install_per_unit', v)} step={25} prefix="$" />
            </div>
          )}
        </div>
        <div style={groupCard}>
          <label style={toggleRow}>
            <input type="checkbox" checked={cfg.offer_package_room ?? false} onChange={e => set('offer_package_room', e.target.checked)} />
            Offer package / parcel room access
          </label>
          {(cfg.offer_package_room ?? false) && (
            <div style={{ marginTop: 8 }}>
              <Stepper label="How many rooms" value={cfg.package_rooms} onChange={v => set('package_rooms', v)} />
              <div style={{ height: 6 }} />
              <Stepper label="Adds $ / unit to P&A" value={cfg.package_room_fee_add ?? 25} onChange={v => set('package_room_fee_add', v)} step={5} prefix="$" />
              <div style={{ fontSize: 11, color: MUT, marginTop: 4 }}>Resident P&A becomes {money(r.residentFeeWithPackage)} / unit when elected.</div>
            </div>
          )}
        </div>
        <div style={groupCard}>
          <label style={toggleRow}>
            <input type="checkbox" checked={cfg.offer_lpr ?? false} onChange={e => set('offer_lpr', e.target.checked)} />
            Offer license-plate recognition (LPR)
          </label>
          {(cfg.offer_lpr ?? false) && (
            <div style={{ marginTop: 8 }}>
              <Stepper label="How many LPR cameras" value={cfg.lpr_count} onChange={v => set('lpr_count', v)} />
              <div style={{ height: 6 }} />
              <Stepper label="$ / camera / mo" value={cfg.lpr_rate ?? 200} onChange={v => set('lpr_rate', v)} step={25} prefix="$" />
              {r.lprCount > 0 && <div style={{ fontSize: 11, color: MUT, marginTop: 4 }}>{r.lprCount} × {money(r.lprRate)} = {money(r.lprMonthlyTotal)} / mo</div>}
              <div style={{ height: 6 }} />
              <Field l="LPR note (optional)"><input value={cfg.lpr_note ?? ''} onChange={e => set('lpr_note', e.target.value)} placeholder="entries covered · plate log retained" style={inS} /></Field>
            </div>
          )}
        </div>

        <Sec t="Value creation (cap rate)" />
        <div style={groupCard}>
          <label style={toggleRow}>
            <input type="checkbox" checked={cfg.show_value_panel ?? (r.annualSavings > 0)} onChange={e => set('show_value_panel', e.target.checked)} />
            Show value-creation panel on proposal
          </label>
          {(cfg.show_value_panel ?? (r.annualSavings > 0)) && (
            <div style={{ marginTop: 8 }}>
              <Stepper label="Est. annual operating savings" value={cfg.annual_savings ?? r.annualSavings} onChange={v => set('annual_savings', v)} step={1000} prefix="$" />
              <div style={{ height: 6 }} />
              <Stepper label="Cap rate %" value={cfg.cap_rate ?? 6} onChange={v => set('cap_rate', v)} step={1} />
              <div style={{ fontSize: 11, color: MUT, marginTop: 4 }}>{money(r.annualSavings)} ÷ {r.capRate}% = <b style={{ color: '#248A3D' }}>{money(r.valueUplift)}</b> in property value</div>
            </div>
          )}
        </div>

        <Sec t="Billing" />
        <div style={{ display: 'flex', gap: 6 }}>
          {(['resident', 'property_monthly'] as BillingMode[]).map(m => (
            <button key={m} onClick={() => set('billing_mode', m)} style={{ flex: 1, padding: '8px 6px', borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: 'pointer', ...(((cfg.billing_mode ?? 'resident') === m) ? { background: CYAN, border: '1px solid #00A3FF', color: '#fff' } : { background: '#fff', border: '1px solid rgba(0,0,0,0.14)', color: '#3A3A3C' }) }}>{m === 'resident' ? 'Resident-funded' : 'Property bulk / mo'}</button>
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
                <div style={{ fontSize: 24, fontWeight: 600, color: '#248A3D' }}>{suggestedFee != null ? money(suggestedFee) : '—'}<span style={{ fontSize: 12, color: MUT, fontWeight: 400 }}> / unit</span></div>
                <div style={{ fontSize: 11, color: MUT, marginTop: 2 }}>{perUnitMonthly != null ? `${money(perUnitMonthly)}/unit/mo × 12 × 1.2, rounded up to $5` : 'Enter units + openings to calculate'}</div>
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                <Stepper label="Resident fee / unit" value={cfg.resident_fee ?? 100} onChange={v => set('resident_fee', v)} step={5} prefix="$" />
                {suggestedFee != null && <div style={{ fontSize: 11, color: MUT, marginTop: 4 }}>Calculator suggests {money(suggestedFee)} — <button type="button" onClick={() => set('resident_fee', suggestedFee)} style={{ background: 'transparent', border: 0, color: CYAN, cursor: 'pointer', padding: 0, fontWeight: 700 }}>use it</button></div>}
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
        <div style={{ fontSize: 10.5, color: MUT, marginTop: 4 }}>Adds a “We take it over” section + a “Cancel …” next step.</div>

        <Sec t="Term" />
        <Field l="Term (months)"><input type="number" min={1} value={cfg.term_months ?? ''} onChange={e => set('term_months', numOrU(e.target.value))} placeholder="60" style={inS} /></Field>
        <div style={{ height: 8 }} /><Field l="Early-termination buyout window (months)"><input type="number" min={0} value={cfg.buyout_months ?? ''} onChange={e => set('buyout_months', numOrU(e.target.value))} placeholder="12" style={inS} /></Field>
        <div style={{ fontSize: 11, color: MUT, marginTop: 6 }}>Buyout base {money(r.buyoutBase)} ({r.units} units × {money(r.residentFee)}) · straight-line {money(r.buyoutMonthly)}/mo · $0 after month {r.buyoutMonths}.</div>

        {/* Advanced — everything below auto-writes from the numbers above; only touch to override wording. */}
        <div style={{ marginTop: 16, borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 12 }}>
          <button type="button" onClick={() => setShowAdvanced(s => !s)} style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer', color: MUT, fontSize: 12, fontWeight: 700 }}>
            {showAdvanced ? '▾' : '▸'} Fine-tune wording (optional)
          </button>
          {showAdvanced && (
            <div style={{ marginTop: 10 }}>
              <Field l="Openings breakdown (intro)"><input value={cfg.openings_breakdown ?? ''} onChange={e => set('openings_breakdown', e.target.value)} placeholder="auto: five vehicle gates, the pedestrian gate, and five amenity doors" style={inS} /></Field>
              <div style={{ height: 8 }} /><Field l="Set-up note (structure paragraph)"><input value={cfg.setup_note ?? ''} onChange={e => set('setup_note', e.target.value)} placeholder={`auto: ${r.setupNote}`} style={inS} /></Field>
              <div style={{ height: 8 }} /><Field l="Set-up cell note (terms box)"><input value={cfg.setup_cell_note ?? ''} onChange={e => set('setup_cell_note', e.target.value)} placeholder={`auto: ${r.setupCellNote}`} style={inS} /></Field>
              <div style={{ height: 8 }} /><Field l="Gate note"><input value={cfg.gate_note ?? ''} onChange={e => set('gate_note', e.target.value)} placeholder="optional" style={inS} /></Field>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: MUT, marginTop: 12, marginBottom: 4 }}>Scope grid columns (blank = auto)</div>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 8, marginBottom: 6 }}>
                  <input value={String(cfg.scope_stats?.[i]?.num ?? '')} onChange={e => setStat(i, 'num', e.target.value)} placeholder="#" style={inS} />
                  <input value={cfg.scope_stats?.[i]?.label ?? ''} onChange={e => setStat(i, 'label', e.target.value)} placeholder={i === 3 ? 'residential units' : 'exit gates — one down today'} style={inS} />
                </div>
              ))}
              <div style={{ fontSize: 10.5, color: MUT }}>Now showing: {r.scopeStats.map(s => `${s.num ?? ''} ${s.label ?? ''}`.trim()).filter(Boolean).join(' · ')}</div>
            </div>
          )}
        </div>
        <div style={{ height: 40 }} />
      </aside>

      {/* Right live letter */}
      <main className="pp-preview">
        <PartnershipProposal quote={previewQuote} cfg={cfg} />
      </main>
      </div>
    </div>
  )
}

export default PartnershipEditor
