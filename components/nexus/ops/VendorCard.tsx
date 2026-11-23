'use client'

/**
 * Vendor card in the job view — send this job to an outside vendor (no login for them),
 * see where they are, answer their "different day" request, approve their invoice.
 * API: /api/maintenance/[id]/vendor (rules: lib/vendor-jobs.ts, migration 239).
 */
import React, { useCallback, useEffect, useState } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
const INK = '#1D1D1F', INK2 = '#3A3A3C', INK3 = '#6E6E73', LINE = 'rgba(0,0,0,0.08)', BLUE = '#0071E3', GREEN = '#1A7F37', RED = '#D70015', ORANGE = '#B25000'
const card: React.CSSProperties = { background: '#FFFFFF', borderRadius: 14, padding: 18, boxShadow: '0 1px 2px rgba(10,20,40,0.06), 0 8px 24px rgba(10,20,40,0.08)' }
const btn: React.CSSProperties = { background: BLUE, color: 'white', border: 0, borderRadius: 10, padding: '8px 13px', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }
const btn2: React.CSSProperties = { ...btn, background: '#FFFFFF', color: INK, border: '1px solid rgba(0,0,0,0.12)' }
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.14)', color: INK, borderRadius: 8, padding: '8px 10px', fontSize: 13.5, fontFamily: 'inherit' }
const nice = (d?: string | null) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '—')
const ago = (iso?: string | null) => { if (!iso) return ''; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? `${Math.max(1, m)} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago` }
const vname = (v: Row | null | undefined) => v?.company || v?.name || 'Vendor'
const TONE: Record<string, string> = { sent: ORANGE, accepted: BLUE, on_the_way: BLUE, arrived: BLUE, done: GREEN, declined: RED }

export function VendorCard({ woId, onChanged }: { woId: string; onChanged?: () => void }) {
  const [d, setD] = useState<Row | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [pick, setPick] = useState('')
  const [note, setNote] = useState('')
  const [via, setVia] = useState<{ text: boolean; email: boolean }>({ text: true, email: true })
  const [adding, setAdding] = useState(false)
  const [nv, setNv] = useState({ name: '', company: '', phone: '', email: '', trade: '', insurance_expiry: '', w9_on_file: false, rate_note: '' })
  const [copyUrl, setCopyUrl] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [why, setWhy] = useState('')

  const api = `/api/maintenance/${woId}/vendor`
  const load = useCallback(async () => {
    const r = await fetch(api, { cache: 'no-store' })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setErr(j.error ?? 'Couldn’t load vendors.'); return }
    setErr(null); setD(j)
  }, [api])
  useEffect(() => { void load() }, [load])

  async function post(action: string, body: Row = {}): Promise<Row | null> {
    setBusy(action + (body.link_id ?? '')); setErr(null); setMsg(null)
    try {
      const r = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error ?? 'That didn’t save.'); return null }
      await load(); onChanged?.()
      return j
    } finally { setBusy(null) }
  }
  const sendResult = (j: Row, who: string) => {
    if (j.url) setCopyUrl(j.url)
    const parts = [j.sent?.length ? `Sent to ${who} by ${j.sent.join(' + ')}.` : `Link made for ${who} — copy it below and send it yourself.`, ...(j.errors ?? [])]
    setMsg(parts.join(' '))
  }

  const rows: Row[] = d?.rows ?? []
  const vendors: Row[] = d?.vendors ?? []
  const free = vendors.filter((v) => !rows.some((r) => r.vendor_id === v.id))
  const chosen = vendors.find((v) => v.id === pick)

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ color: INK3, fontSize: 13 }}>Outside vendor</div>
        {!picking && d && <button type="button" style={btn2} onClick={() => { setPicking(true); setMsg(null); setCopyUrl(null) }}>+ Send to a vendor</button>}
      </div>
      {err && <div role="alert" style={{ fontSize: 12.5, color: RED, marginBottom: 8 }}>{err}</div>}
      {d && d.ready === false && <div style={{ fontSize: 12.5, color: ORANGE }}>Needs migration 239.</div>}
      {!d && !err && <div style={{ fontSize: 12.5, color: INK3 }}>Loading…</div>}
      {d && !rows.length && !picking && <div style={{ fontSize: 13, color: INK3 }}>No vendor on this job. Send it to one — they get a private link (no login) to accept it, update you, add photos and send their invoice.</div>}

      {rows.map((r) => {
        const inv = r.invoice as Row | null
        return (
          <div key={r.id} style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 12, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <b style={{ fontSize: 14 }}>{vname(r.vendor)}</b>
              {r.vendor?.trade && <span style={{ fontSize: 12, color: INK3 }}>{r.vendor.trade}</span>}
              <span style={{ fontSize: 12, fontWeight: 600, color: TONE[r.status] ?? INK3, background: `${TONE[r.status] ?? INK3}14`, borderRadius: 6, padding: '2px 8px' }}>{r.status_label}</span>
              {r.late && <span style={{ fontSize: 12, fontWeight: 600, color: RED }}>Date passed — not started</span>}
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: INK3 }}>{r.viewed_at ? `Opened ${ago(r.viewed_at)}` : r.sent_at ? 'Not opened yet' : ''}</span>
            </div>
            {r.vendor && <div style={{ fontSize: 12.5, color: INK3, marginTop: 3 }}>{[r.vendor.phone && <a key="p" href={`tel:${r.vendor.phone}`} style={{ color: BLUE }}>{r.vendor.phone}</a>, r.vendor.email].filter(Boolean).map((x, i) => <span key={i}>{i ? ' · ' : ''}{x}</span>)}</div>}
            {r.status === 'declined' && r.decline_reason && <div style={{ fontSize: 13, color: RED, marginTop: 6 }}>Declined: {r.decline_reason}</div>}

            {r.request_status === 'pending' && (
              <div style={{ marginTop: 8, padding: '9px 11px', borderRadius: 10, background: 'rgba(178,80,0,0.08)', fontSize: 13 }}>
                Asks to do it <b>{nice(r.requested_date)}</b> instead of {nice(d?.scheduled_date)}{r.request_note ? ` — “${r.request_note}”` : ''}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button type="button" style={btn} disabled={!!busy} onClick={async () => { const j = await post('approve_date', { link_id: r.id }); if (j) setMsg(`Job moved to ${nice(j.scheduled_date)}. ${(j.errors ?? []).join(' ')}`) }}>Move job to {nice(r.requested_date)}</button>
                  <button type="button" style={btn2} disabled={!!busy} onClick={async () => { const j = await post('keep_date', { link_id: r.id }); if (j) setMsg(`Kept ${nice(d?.scheduled_date)} — vendor told. ${(j.errors ?? []).join(' ')}`) }}>Keep the date</button>
                </div>
              </div>
            )}
            {r.status === 'done' && r.done_note && <div style={{ marginTop: 8, fontSize: 13, color: INK2 }}>Vendor’s report: {r.done_note}{r.signoff_name ? ` — signed off by ${r.signoff_name}` : ''}{r.signoff_image && <img src={r.signoff_image} alt="Signature" style={{ display: 'block', maxWidth: 220, maxHeight: 70, marginTop: 6, border: `1px solid ${LINE}`, borderRadius: 6, background: '#fff' }} />}<div style={{ fontSize: 12, color: INK3, marginTop: 4 }}>Check it, then finish the job as usual.</div></div>}

            {inv && (
              <div style={{ marginTop: 8, padding: '9px 11px', borderRadius: 10, background: '#F7F8FA', fontSize: 13 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b>Invoice ${Number(inv.amount ?? 0).toFixed(2)}</b>{inv.number && <span style={{ color: INK3 }}>#{inv.number}</span>}
                  {inv.file_url && <a href={inv.file_url} target="_blank" rel="noreferrer" style={{ color: BLUE }}>View file</a>}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontWeight: 600, color: inv.status === 'submitted' ? ORANGE : inv.status === 'rejected' ? RED : GREEN }}>
                    {inv.status === 'submitted' ? 'Waiting for approval' : inv.status === 'rejected' ? 'Sent back' : inv.status === 'paid' ? 'Paid' : inv.qb_bill_id ? 'Approved · bill in QuickBooks' : 'Approved'}
                  </span>
                </div>
                {inv.note && <div style={{ color: INK2, marginTop: 4 }}>{inv.note}</div>}
                {inv.status === 'rejected' && inv.reject_reason && <div style={{ color: RED, marginTop: 4 }}>You said: {inv.reject_reason}</div>}
                {inv.qb_sync_error && <div style={{ color: RED, marginTop: 4 }}>QuickBooks: {inv.qb_sync_error}</div>}
                {inv.status === 'submitted' && (rejecting === r.id
                  ? <div style={{ marginTop: 8 }}>
                      <input aria-label="Why send it back" placeholder="What needs to change?" value={why} onChange={(e) => setWhy(e.target.value)} style={input} />
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <button type="button" style={{ ...btn, background: RED }} disabled={!why.trim() || !!busy} onClick={async () => { if (await post('reject_invoice', { link_id: r.id, reason: why })) { setRejecting(null); setWhy(''); setMsg('Sent back to the vendor.') } }}>Send back</button>
                        <button type="button" style={btn2} onClick={() => setRejecting(null)}>Cancel</button>
                      </div>
                    </div>
                  : <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button type="button" style={{ ...btn, background: '#248A3D' }} disabled={!!busy} onClick={async () => { const j = await post('approve_invoice', { link_id: r.id }); if (j) setMsg(j.note ?? 'Approved.') }}>{busy === `approve_invoice${r.id}` ? 'Approving…' : 'Approve — add to job cost'}</button>
                      <button type="button" style={btn2} onClick={() => { setRejecting(r.id); setWhy('') }}>Send back</button>
                    </div>)}
              </div>
            )}

            {r.status !== 'declined' && (
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                <button type="button" style={btn2} disabled={!!busy} onClick={async () => { const j = await post('resend', { link_id: r.id, via: Object.entries(via).filter(([, on]) => on).map(([k]) => k) }); if (j) sendResult(j, vname(r.vendor)) }}>Resend link</button>
                <button type="button" style={btn2} disabled={!!busy} onClick={async () => { const j = await post('resend', { link_id: r.id, copy_only: true }); if (j) { setCopyUrl(j.url); setMsg('New link made — the old one no longer works.') } }}>New link to copy</button>
                <button type="button" style={{ ...btn2, color: RED }} disabled={!!busy} onClick={async () => { if (confirm(`Take this job away from ${vname(r.vendor)}? Their link stops working and they’re told.`)) { if (await post('remove', { link_id: r.id, tell: true })) setMsg('Vendor removed from the job.') } }}>Remove</button>
              </div>
            )}
            {r.status === 'declined' && <div style={{ marginTop: 8 }}><button type="button" style={btn2} disabled={!!busy} onClick={async () => { if (await post('remove', { link_id: r.id, tell: false })) setMsg('Cleared.') }}>Clear</button></div>}
          </div>
        )
      })}

      {msg && <div role="status" style={{ fontSize: 12.5, color: /couldn|error|not sent|missing|isn’t/i.test(msg) ? ORANGE : GREEN, marginTop: 10 }}>{msg}</div>}
      {copyUrl && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input readOnly aria-label="Vendor link" value={copyUrl} onFocus={(e) => e.currentTarget.select()} style={{ ...input, fontSize: 12.5 }} />
          <button type="button" style={btn2} onClick={async () => { try { await navigator.clipboard.writeText(copyUrl); setMsg('Link copied.') } catch { setMsg('Select the link and copy it.') } }}>Copy</button>
        </div>
      )}

      {picking && d && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${LINE}`, paddingTop: 12 }}>
          {!adding ? <>
            <select aria-label="Vendor" value={pick} onChange={(e) => setPick(e.target.value)} style={input}>
              <option value="">{free.length ? 'Pick a vendor…' : 'No vendors yet — add one'}</option>
              {free.map((v) => <option key={v.id} value={v.id}>{vname(v)}{v.trade ? ` — ${v.trade}` : ''}{v.warnings?.length ? ' ⚠' : ''}</option>)}
            </select>
            <button type="button" onClick={() => setAdding(true)} style={{ border: 0, background: 'none', color: BLUE, fontSize: 13, padding: '6px 0', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add a new vendor</button>
            {(chosen?.warnings?.length ?? 0) > 0 && chosen && <div style={{ fontSize: 12.5, color: ORANGE, marginTop: 2 }}>{chosen.warnings.join(' · ')}</div>}
            {chosen?.rate_note && <div style={{ fontSize: 12.5, color: INK3, marginTop: 2 }}>Rate: {chosen.rate_note}</div>}
            <textarea aria-label="Note to the vendor" rows={2} placeholder="Note to the vendor (optional) — what to bring, who to ask for…" value={note} onChange={(e) => setNote(e.target.value)} style={{ ...input, marginTop: 8, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', margin: '8px 0', fontSize: 13, color: INK2 }}>
              <label><input type="checkbox" checked={via.text} onChange={(e) => setVia({ ...via, text: e.target.checked })} /> Text{chosen && !chosen.phone ? ' (no phone)' : ''}</label>
              <label><input type="checkbox" checked={via.email} onChange={(e) => setVia({ ...via, email: e.target.checked })} /> Email{chosen && !chosen.email ? ' (no email)' : ''}</label>
            </div>
            <div style={{ fontSize: 12, color: INK3, marginBottom: 8 }}>They see only this job: the property, address, gate, the problem, access notes, gate code and on-site contact. You set the date ({nice(d.scheduled_date)}); they can only ask for another day.</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" style={btn} disabled={!pick || !!busy || (!via.text && !via.email)} onClick={async () => {
                const j = await post('send', { vendor_id: pick, via: Object.entries(via).filter(([, on]) => on).map(([k]) => k), message: note })
                if (j) { sendResult(j, vname(chosen)); setPicking(false); setPick(''); setNote('') }
              }}>{busy?.startsWith('send') ? 'Sending…' : 'Send the job'}</button>
              <button type="button" style={btn2} onClick={() => { setPicking(false); setPick('') }}>Cancel</button>
            </div>
          </> : (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>New vendor</div>
              {([['name', 'Contact name *'], ['company', 'Company'], ['phone', 'Mobile (for texts)'], ['email', 'Email'], ['trade', 'Trade — e.g. Gate operators, Fence, Electrical'], ['rate_note', 'Rate we agreed — e.g. $95/h + $150 trip']] as const).map(([k, l]) => (
                <input key={k} aria-label={l} placeholder={l} value={nv[k]} onChange={(e) => setNv({ ...nv, [k]: e.target.value })} style={input} />
              ))}
              <label style={{ fontSize: 12.5, color: INK3 }}>Insurance good until<input type="date" value={nv.insurance_expiry} onChange={(e) => setNv({ ...nv, insurance_expiry: e.target.value })} style={{ ...input, marginTop: 3 }} /></label>
              <label style={{ fontSize: 13, color: INK2 }}><input type="checkbox" checked={nv.w9_on_file} onChange={(e) => setNv({ ...nv, w9_on_file: e.target.checked })} /> W-9 on file</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" style={btn} disabled={!nv.name.trim() || (!nv.phone.trim() && !nv.email.trim()) || !!busy} onClick={async () => {
                  const j = await post('add_vendor', nv)
                  if (j?.vendor) { setPick(j.vendor.id); setAdding(false); setNv({ name: '', company: '', phone: '', email: '', trade: '', insurance_expiry: '', w9_on_file: false, rate_note: '' }) }
                }}>Save vendor</button>
                <button type="button" style={btn2} onClick={() => setAdding(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default VendorCard
