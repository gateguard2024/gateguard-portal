'use client'

/**
 * Vendor job page — /v/<secret>. No login: the private link IS the access, for one job.
 * Phone-first, Apple-plain. Everything goes through /api/v/<secret> (rules: lib/vendor-jobs.ts).
 * Flow: Accept / Decline → (ask for another day) → On my way → Arrived → Finish (note + sign-off)
 *       → Send invoice. Notes and photos any time.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
const C = { ink: '#1D1D1F', ink2: '#3A3A3C', mute: '#6E6E73', line: 'rgba(0,0,0,.10)', bg: '#F5F5F7', blue: '#0071E3', green: '#1A7F37', red: '#D70015', orange: '#B25000' }
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif'
const DECLINE = ['Too busy that day', 'Too far', 'Not my kind of work', 'Need more information']
const nice = (d?: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Not set yet — we’ll confirm')
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export default function VendorJobPage({ token }: { token: string }) {
  const [v, setV] = useState<Row | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [gone, setGone] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [tool, setTool] = useState<null | 'decline' | 'date' | 'finish'>(null)
  const [f, setF] = useState({ reason: '', date: '', dateNote: '', eta: '', note: '', done: '', sign: '', amount: '', number: '', invNote: '' })
  const [invFile, setInvFile] = useState<{ url: string; name: string } | null>(null)
  const sigRef = useRef<HTMLCanvasElement>(null)
  const [signed, setSigned] = useState(false)

  const api = `/api/v/${encodeURIComponent(token)}`
  const load = useCallback(async () => {
    const r = await fetch(api, { cache: 'no-store' })
    const d = await r.json().catch(() => ({}))
    if (r.status === 410 || r.status === 404) { setGone(d.error ?? 'This link isn’t valid.'); return }
    if (!r.ok) { setErr(d.error ?? 'Couldn’t load the job.'); return }
    setV(d)
  }, [api])
  useEffect(() => { void load() }, [load])

  const flash = (t: string) => { setToast(t); window.setTimeout(() => setToast((x) => (x === t ? null : x)), 3200) }
  async function act(action: string, body: Row = {}): Promise<Row | null> {
    setBusy(action); setErr(null)
    try {
      const r = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) })
      const d = await r.json().catch(() => ({}))
      if (r.status === 410) { setGone(d.error); return null }
      if (!r.ok) { setErr(d.error ?? 'That didn’t save — try again.'); return null }
      if (d.view) setV(d.view)
      if (d.message && d.message !== 'ok') flash(d.message)
      return d
    } finally { setBusy(null) }
  }
  async function upload(file: File, kind: 'photo' | 'invoice'): Promise<string | null> {
    const d = await act(kind === 'photo' ? 'photo_upload_url' : 'invoice_upload_url', { filename: file.name })
    if (!d?.signedUrl) return null
    setBusy(kind)
    try {
      const put = await fetch(d.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file })
      if (!put.ok) { setErr('The upload didn’t go through — try again.'); return null }
      return d.publicUrl as string
    } finally { setBusy(null) }
  }

  // signature pad
  useEffect(() => {
    const c = sigRef.current; if (!c || tool !== 'finish') return
    const ctx = c.getContext('2d')!; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.strokeStyle = C.ink
    let down = false
    const pos = (e: PointerEvent) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * (c.width / r.width), (e.clientY - r.top) * (c.height / r.height)] }
    const start = (e: PointerEvent) => { down = true; const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); c.setPointerCapture(e.pointerId) }
    const move = (e: PointerEvent) => { if (!down) return; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); setSigned(true) }
    const end = () => { down = false }
    c.addEventListener('pointerdown', start); c.addEventListener('pointermove', move); c.addEventListener('pointerup', end); c.addEventListener('pointerleave', end)
    return () => { c.removeEventListener('pointerdown', start); c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', end); c.removeEventListener('pointerleave', end) }
  }, [tool])
  const clearSig = () => { const c = sigRef.current; if (c) { c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setSigned(false) } }

  const shell = (inner: React.ReactNode) => (
    // Covers the whole window (this page must never show Nexus chrome to a vendor).
    <div style={{ position: 'fixed', inset: 0, zIndex: 2147483000, overflowY: 'auto', background: C.bg, color: C.ink, fontFamily: FONT, WebkitFontSmoothing: 'antialiased' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '18px 14px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
          <span aria-hidden style={{ width: 30, height: 30, borderRadius: 8, background: C.ink, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>GG</span>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Gate Guard</span>
          <span style={{ color: C.mute, fontSize: 13 }}>· Vendor job</span>
        </div>
        {inner}
      </div>
      {toast && <div role="status" style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', background: C.ink, color: '#fff', borderRadius: 12, padding: '11px 16px', fontSize: 14, maxWidth: 'calc(100vw - 32px)', boxShadow: '0 10px 30px rgba(0,0,0,.25)' }}>{toast}</div>}
    </div>
  )

  if (gone) return shell(<Card><div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>This link isn’t open</div><div style={{ color: C.ink2 }}>{gone}</div></Card>)
  if (!v) return shell(err ? <Card><div role="alert" style={{ color: C.red }}>{err}</div></Card> : <div style={{ color: C.mute, padding: 30, textAlign: 'center' }}>Loading the job…</div>)

  const job = v.job as Row, site = (v.site ?? {}) as Row, link = v.link as Row, inv = link.invoice as Row | null
  const st = String(link.status)
  const started = ['accepted', 'on_the_way', 'arrived', 'done'].includes(st)
  const closed = !!job.closed

  return shell(<>
    <Card>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.mute, letterSpacing: '.04em', textTransform: 'uppercase' }}>{[job.number, job.gate].filter(Boolean).join(' · ') || 'Service job'}{job.priority && /high|critical|urgent/i.test(job.priority) ? <span style={{ color: C.red }}> · {String(job.priority).toUpperCase()}</span> : null}</div>
      <h1 style={{ margin: '4px 0 2px', fontSize: 22, fontWeight: 600, letterSpacing: '-.02em' }}>{job.title}</h1>
      <div style={{ color: C.ink2, fontSize: 14 }}>For {v.vendor.company || v.vendor.name}</div>
      {job.problem && <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{job.problem}</p>}
      <StatusLine st={st} closed={closed} />
    </Card>

    {err && <div role="alert" style={{ background: '#FDECEA', color: '#8A1209', borderRadius: 12, padding: '10px 14px', margin: '10px 0', fontSize: 14 }}>{err}</div>}

    {/* answer */}
    {(st === 'sent' || st === 'declined') && !closed && (
      <Card>
        <Label>{st === 'declined' ? `You declined: ${link.decline_reason ?? ''}` : 'Can you do this job?'}</Label>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn kind="green" busy={busy === 'accept'} onClick={() => void act('accept')}>Accept the job</Btn>
          {st === 'sent' && <Btn onClick={() => setTool(tool === 'decline' ? null : 'decline')}>Decline</Btn>}
        </div>
        {tool === 'decline' && <div style={{ marginTop: 12 }}>
          <Chips list={DECLINE} on={f.reason} set={(x) => setF({ ...f, reason: x })} />
          <input aria-label="Why" placeholder="Or say why…" value={DECLINE.includes(f.reason) ? '' : f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} style={input} />
          <div style={{ marginTop: 10 }}><Btn kind="red" busy={busy === 'decline'} disabled={!f.reason.trim()} onClick={async () => { if (await act('decline', { reason: f.reason })) setTool(null) }}>Decline the job</Btn></div>
        </div>}
      </Card>
    )}

    {/* date */}
    <Card>
      <Label>Date</Label>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{nice(job.date)}</div>
      {link.request_status === 'pending' && <div style={{ marginTop: 6, fontSize: 14, color: C.orange }}>You asked for {nice(link.requested_date)} — waiting for Gate Guard to confirm. Until then, keep the date above.</div>}
      {link.request_status === 'kept' && <div style={{ marginTop: 6, fontSize: 14, color: C.ink2 }}>Gate Guard kept the date above (you asked for {nice(link.requested_date)}).</div>}
      {link.request_status === 'approved' && <div style={{ marginTop: 6, fontSize: 14, color: C.green }}>Your new day was approved.</div>}
      {!closed && st !== 'done' && st !== 'declined' && <>
        <button type="button" onClick={() => setTool(tool === 'date' ? null : 'date')} style={linkBtn}>Need a different day?</button>
        {tool === 'date' && <div style={{ marginTop: 8 }}>
          <input type="date" aria-label="Day you can do it" min={todayISO()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} style={input} />
          <input aria-label="Note about the day" placeholder="Anything we should know? (optional)" value={f.dateNote} onChange={(e) => setF({ ...f, dateNote: e.target.value })} style={{ ...input, marginTop: 8 }} />
          <div style={{ fontSize: 13, color: C.mute, margin: '8px 0' }}>Gate Guard sets the date — this sends a request.</div>
          <Btn kind="blue" busy={busy === 'request_date'} disabled={!f.date} onClick={async () => { if (await act('request_date', { date: f.date, note: f.dateNote })) setTool(null) }}>Ask for this day</Btn>
        </div>}
      </>}
    </Card>

    {/* where */}
    {site.name && <Card>
      <Label>Where</Label>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{site.name}</div>
      {site.address && <div style={{ color: C.ink2, fontSize: 14, marginTop: 2 }}>{site.address}</div>}
      {site.maps && <a href={site.maps} target="_blank" rel="noreferrer" style={{ ...linkBtn, display: 'inline-block', textDecoration: 'none' }}>Open in Maps</a>}
      {(site.gate_code || site.access_notes || site.contact) && <div style={{ marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 10, display: 'grid', gap: 6, fontSize: 14 }}>
        {site.gate_code && <div><span style={{ color: C.mute }}>Gate code </span><b style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{site.gate_code}</b></div>}
        {site.access_notes && <div style={{ whiteSpace: 'pre-wrap' }}><span style={{ color: C.mute }}>Access </span>{site.access_notes}</div>}
        {site.contact && <div><span style={{ color: C.mute }}>On site </span>{site.contact}{site.contact_phone && <> · <a href={`tel:${site.contact_phone}`} style={{ color: C.blue }}>{site.contact_phone}</a></>}</div>}
      </div>}
    </Card>}

    {/* progress */}
    {started && !closed && st !== 'done' && (
      <Card>
        <Label>Your progress</Label>
        {st === 'accepted' && <>
          <input aria-label="ETA" placeholder="ETA, e.g. 2:30 PM (optional)" value={f.eta} onChange={(e) => setF({ ...f, eta: e.target.value })} style={{ ...input, marginBottom: 8 }} />
          <Btn kind="blue" busy={busy === 'on_the_way'} onClick={() => void act('on_the_way', { eta: f.eta })}>I’m on my way</Btn>
        </>}
        {st === 'on_the_way' && <Btn kind="blue" busy={busy === 'arrived'} onClick={() => void act('arrived')}>I’ve arrived</Btn>}
        {(st === 'arrived' || st === 'on_the_way' || st === 'accepted') && <div style={{ marginTop: 10 }}>
          <Btn kind={st === 'arrived' ? 'green' : undefined} onClick={() => setTool(tool === 'finish' ? null : 'finish')}>Finish the job</Btn>
        </div>}
        {tool === 'finish' && <div style={{ marginTop: 12 }}>
          <textarea aria-label="What you did" rows={4} placeholder="What did you find and fix? Parts / materials used?" value={f.done} onChange={(e) => setF({ ...f, done: e.target.value })} style={{ ...input, resize: 'vertical' }} />
          <input aria-label="Signed off by" placeholder="Who signed off on site? (optional)" value={f.sign} onChange={(e) => setF({ ...f, sign: e.target.value })} style={{ ...input, marginTop: 8 }} />
          <div style={{ fontSize: 13, color: C.mute, margin: '8px 0 4px' }}>Signature (optional)</div>
          <canvas ref={sigRef} width={600} height={180} aria-label="Signature pad" style={{ width: '100%', height: 120, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, touchAction: 'none' }} />
          {signed && <button type="button" onClick={clearSig} style={linkBtn}>Clear signature</button>}
          <div style={{ marginTop: 10 }}><Btn kind="green" busy={busy === 'done'} disabled={!f.done.trim()} onClick={async () => {
            const img = signed && sigRef.current ? sigRef.current.toDataURL('image/png') : undefined
            if (await act('done', { note: f.done, signoff_name: f.sign, signoff_image: img })) setTool(null)
          }}>Mark the job done</Btn></div>
        </div>}
      </Card>
    )}
    {st === 'done' && <Card><Label>Done</Label><div style={{ fontSize: 15 }}>{link.done_note}</div>{link.signoff_name && <div style={{ color: C.mute, fontSize: 13, marginTop: 4 }}>Signed off by {link.signoff_name}</div>}</Card>}

    {/* notes + photos */}
    {started && <Card>
      <Label>Notes &amp; photos</Label>
      {!closed && <>
        <textarea aria-label="Note" rows={2} placeholder="Send Gate Guard a note…" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} style={{ ...input, resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <Btn busy={busy === 'note'} disabled={!f.note.trim()} onClick={async () => { if (await act('note', { text: f.note })) setF({ ...f, note: '' }) }}>Send note</Btn>
          <label style={{ ...btnBase, background: '#fff', color: C.ink, border: `1px solid ${C.line}`, cursor: 'pointer' }}>
            {busy === 'photo' || busy === 'photo_upload_url' ? 'Uploading…' : 'Add photos'}
            <input type="file" accept="image/*" multiple hidden onChange={async (e) => {
              const files = Array.from(e.target.files ?? []); e.target.value = ''
              for (const file of files) { const url = await upload(file, 'photo'); if (url) await act('photo', { url, caption: file.name }) }
            }} />
          </label>
        </div>
      </>}
      {(v.photos as Row[]).length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6, marginTop: 10 }}>
        {(v.photos as Row[]).map((p) => <a key={p.id} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.name ?? 'Photo'} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, display: 'block' }} /></a>)}
      </div>}
    </Card>}

    {/* invoice */}
    {started && <Card>
      <Label>Your invoice</Label>
      {inv && <div style={{ marginBottom: 10, fontSize: 14 }}>
        {inv.status === 'submitted' && <span style={{ color: C.orange }}>Sent — ${Number(inv.amount).toFixed(2)}{inv.number ? ` (#${inv.number})` : ''}. Waiting for approval.</span>}
        {inv.status === 'approved' && <span style={{ color: C.green }}>Approved — ${Number(inv.amount).toFixed(2)}. It’s on its way to be paid.</span>}
        {inv.status === 'paid' && <span style={{ color: C.green }}>Paid — ${Number(inv.amount).toFixed(2)}. Thank you!</span>}
        {inv.status === 'rejected' && <span style={{ color: C.red }}>Gate Guard needs a change: {inv.reject_reason}</span>}
      </div>}
      {(!inv || inv.status === 'rejected' || inv.status === 'submitted') && <>
        <div style={{ display: 'flex', gap: 8 }}>
          <input aria-label="Invoice total" inputMode="decimal" placeholder="Total $" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, '') })} style={{ ...input, flex: 1 }} />
          <input aria-label="Invoice number" placeholder="Invoice # (optional)" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} style={{ ...input, flex: 1 }} />
        </div>
        <input aria-label="Invoice note" placeholder="What it covers (optional)" value={f.invNote} onChange={(e) => setF({ ...f, invNote: e.target.value })} style={{ ...input, marginTop: 8 }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ ...btnBase, background: '#fff', color: C.ink, border: `1px solid ${C.line}`, cursor: 'pointer' }}>
            {busy === 'invoice_upload_url' || busy === 'invoice' ? 'Uploading…' : invFile ? 'Change file' : 'Attach invoice (PDF or photo)'}
            <input type="file" accept="application/pdf,image/*" hidden onChange={async (e) => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; const url = await upload(file, 'invoice'); if (url) setInvFile({ url, name: file.name }) }} />
          </label>
          {invFile && <span style={{ fontSize: 13, color: C.ink2 }}>{invFile.name}</span>}
        </div>
        <div style={{ marginTop: 10 }}><Btn kind="blue" busy={busy === 'invoice'} disabled={!(Number(f.amount) > 0)} onClick={async () => {
          if (await act('invoice', { amount: f.amount, number: f.number, note: f.invNote, file_url: invFile?.url })) { setF({ ...f, amount: '', number: '', invNote: '' }); setInvFile(null) }
        }}>{inv?.status === 'submitted' ? 'Replace invoice' : 'Send invoice'}</Btn></div>
      </>}
    </Card>}

    <div style={{ textAlign: 'center', color: C.mute, fontSize: 12.5, marginTop: 18 }}>This page is just for you and this job — please don’t share the link.</div>
  </>)
}

function StatusLine({ st, closed }: { st: string; closed: boolean }) {
  const steps = [['accepted', 'Accepted'], ['on_the_way', 'On the way'], ['arrived', 'On site'], ['done', 'Done']] as const
  const rank: Record<string, number> = { sent: 0, accepted: 1, on_the_way: 2, arrived: 3, done: 4 }
  if (closed) return <div style={{ marginTop: 12, fontSize: 13.5, color: C.mute }}>This job is closed.</div>
  if (st === 'declined') return <div style={{ marginTop: 12, fontSize: 13.5, color: C.red }}>You declined this job.</div>
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 14 }} aria-label="Progress">
      {steps.map(([k, l], i) => <div key={k} style={{ flex: 1 }}>
        <div style={{ height: 4, borderRadius: 4, background: (rank[st] ?? 0) > i ? C.green : '#E5E5EA' }} />
        <div style={{ fontSize: 11.5, color: (rank[st] ?? 0) > i ? C.ink : C.mute, marginTop: 4, fontWeight: 500 }}>{l}</div>
      </div>)}
    </div>
  )
}
function Card({ children }: { children: React.ReactNode }) {
  return <section style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 10, boxShadow: '0 1px 2px rgba(0,0,0,.05)', border: `1px solid ${C.line}` }}>{children}</section>
}
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: C.mute, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 8 }}>{children}</div>
}
function Chips({ list, on, set }: { list: string[]; on: string; set: (x: string) => void }) {
  return <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>{list.map((x) => <button key={x} type="button" aria-pressed={on === x} onClick={() => set(on === x ? '' : x)} style={{ fontSize: 13.5, padding: '6px 11px', borderRadius: 20, border: `1px solid ${on === x ? C.blue : C.line}`, background: on === x ? 'rgba(0,113,227,.08)' : '#fff', color: on === x ? '#0058B0' : C.ink2, fontFamily: FONT, cursor: 'pointer' }}>{x}</button>)}</div>
}
const btnBase: React.CSSProperties = { minHeight: 44, padding: '0 16px', borderRadius: 11, fontSize: 15, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: FONT }
function Btn({ children, onClick, kind, busy, disabled }: { children: React.ReactNode; onClick: () => void; kind?: 'blue' | 'green' | 'red'; busy?: boolean; disabled?: boolean }) {
  const bg = kind === 'blue' ? C.blue : kind === 'green' ? '#248A3D' : kind === 'red' ? C.red : '#fff'
  return <button type="button" onClick={onClick} disabled={busy || disabled} style={{ ...btnBase, flex: 1, width: '100%', border: kind ? 0 : `1px solid ${C.line}`, background: bg, color: kind ? '#fff' : C.ink, cursor: busy || disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1 }}>{busy ? 'Saving…' : children}</button>
}
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 12px', borderRadius: 10, border: `1px solid rgba(0,0,0,.16)`, fontSize: 16, fontFamily: FONT, color: C.ink, background: '#fff', outline: 'none' }
const linkBtn: React.CSSProperties = { marginTop: 8, padding: 0, border: 0, background: 'none', color: C.blue, fontSize: 14.5, fontWeight: 500, cursor: 'pointer', fontFamily: FONT }
