'use client'

/**
 * PackagesClient — property portal → Packages (Part 14 · package room).
 * The manager's day: what's waiting, what came today, what needs attention (no owner, wrong
 * pickup, boxes left outside the room, unscanned boxes, door propped, aging…), search any box,
 * open its timeline, and fix it: assign a unit, picked up at the desk, staff hold, return to
 * sender, waive a fee, add a note. Office log for boxes taken at the desk. Service mode.
 * Viewing = portal PIN. Every change needs the manager's personal PIN (names a person).
 * Pickup is always allowed — storage fees post to the resident's account, never hold a box.
 * API: /api/portal/[slug]/packages · rules: lib/packages.ts.
 */
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { OpsShell, useOpsManager, C } from '@/components/portal/ops/OpsShell'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = Record<string, any>
const TZ = 'America/New_York'
const money = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`
function when(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const t = d.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).toLowerCase()
  if (d.toLocaleDateString('en-CA', { timeZone: TZ }) === new Date().toLocaleDateString('en-CA', { timeZone: TZ })) return `Today ${t}`
  return `${d.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' })}, ${t}`
}
const DOT = { blue: '#0A84FF', green: '#34C759', orange: '#FF9500', red: '#FF3B30', gray: '#C7C7CC' }
const STATUS_DOT: Record<string, string> = { received: DOT.blue, notified: DOT.blue, unsorted: DOT.orange, staff_hold: DOT.gray, flagged: DOT.red, picked_up: DOT.green, returned: DOT.gray, abandoned: DOT.red }

const CSS = `
.pk-wrap{display:flex;flex-direction:column;gap:16px}
.pk-card{background:${C.card};border-radius:12px;padding:18px 20px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 6px 20px -12px rgba(0,0,0,.18);min-width:0;box-sizing:border-box}
.pk-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.pk-kpi{background:${C.card};border:0;border-radius:12px;padding:16px 18px;text-align:left;cursor:pointer;font:inherit;color:inherit;box-shadow:0 1px 2px rgba(0,0,0,.04),0 6px 20px -12px rgba(0,0,0,.18)}
.pk-kpi:hover{box-shadow:0 0 0 1px rgba(0,113,227,.35),0 6px 20px -12px rgba(0,0,0,.18)}
.pk-num{font-size:30px;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.15}
.pk-k{color:${C.ink3};font-size:13px;display:flex;align-items:center;gap:8px}
.pk-s{color:${C.ink3};font-size:12.5px;margin-top:2px}
.pk-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 14px;border-radius:10px;border:1px solid ${C.border2};background:#fff;color:${C.ink};font:600 13.5px inherit;font-family:inherit;cursor:pointer;white-space:nowrap}
.pk-btn.pri{background:${C.blue};border-color:${C.blue};color:#fff}
.pk-btn.warn{color:${C.alert};border-color:rgba(215,0,21,.3)}
.pk-btn.go{color:${C.safe};border-color:rgba(31,138,59,.3);background:#F0FAF2}
.pk-btn:disabled{opacity:.5;cursor:default}
.pk-seg{display:inline-flex;background:#E8E8ED;border-radius:10px;padding:2px;gap:2px;flex-wrap:wrap}
.pk-seg button{border:0;background:none;min-height:36px;padding:0 14px;border-radius:8px;font:500 13px inherit;font-family:inherit;color:${C.ink};cursor:pointer}
.pk-seg button[aria-pressed=true]{background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.12);font-weight:600}
.pk-in{height:40px;border:1px solid ${C.border2};border-radius:10px;padding:0 12px;font:400 14px inherit;font-family:inherit;color:${C.ink};background:#fff;width:100%;min-width:0;box-sizing:border-box}
textarea.pk-in{height:auto;padding:8px 12px}
.pk-lbl{display:block;font-size:12px;font-weight:500;color:${C.ink3};margin-bottom:5px}
.pk-tw{overflow-x:auto}
.pk-tbl{width:100%;border-collapse:collapse;font-size:13.5px}
.pk-tbl th{text-align:left;font-weight:500;color:${C.ink3};font-size:12px;padding:10px 12px;border-bottom:1px solid ${C.border};white-space:nowrap}
.pk-tbl td{padding:11px 12px;border-bottom:1px solid rgba(0,0,0,.055);vertical-align:middle}
.pk-tbl tr.click{cursor:pointer}.pk-tbl tr.click:hover td{background:#F7F9FC}
.pk-row{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid rgba(0,0,0,.06)}
.pk-row:first-child{border-top:0}
.pk-pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:${C.ink2};background:#F2F2F7;border-radius:6px;padding:3px 8px;white-space:nowrap}
.pk-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none}
.pk-bg{position:fixed;inset:0;z-index:140;background:rgba(0,0,0,.32);display:flex;align-items:center;justify-content:center;padding:16px}
.pk-sheet{background:#fff;border-radius:16px;width:min(var(--w,560px),100%);max-height:88dvh;display:flex;flex-direction:column;box-shadow:0 24px 70px rgba(0,0,0,.28)}
.pk-sheet>.hd{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:16px 18px;border-bottom:1px solid ${C.border}}
.pk-sheet>.bd{padding:16px 18px;overflow-y:auto;display:grid;gap:14px}
.pk-g2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.pk-split{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:16px;align-items:start}
@media (max-width:1000px){.pk-split{grid-template-columns:1fr}}
@media (max-width:760px){.pk-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.pk-g2{grid-template-columns:1fr}.pk-hide{display:none}}
`

function Sheet({ title, sub, onClose, children, width = 560 }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  return (
    <div className="pk-bg" onClick={onClose}>
      <div className="pk-sheet" role="dialog" aria-modal="true" style={{ ['--w' as string]: `${width}px` } as CSSProperties} onClick={e => e.stopPropagation()}>
        <div className="hd"><div><div style={{ fontSize: 17, fontWeight: 600 }}>{title}</div>{sub && <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 2 }}>{sub}</div>}</div><button type="button" className="pk-btn" onClick={onClose}>Done</button></div>
        <div className="bd">{children}</div>
      </div>
    </div>
  )
}
const Field = ({ label, children }: { label: string; children: ReactNode }) => <label style={{ display: 'block' }}><span className="pk-lbl">{label}</span>{children}</label>
const Section = ({ s }: { s?: Any | null }) => s ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600 }}><span aria-hidden style={{ width: 9, height: 20, borderRadius: 3, background: s.color }} />{s.name}</span> : <span style={{ color: C.ink3 }}>—</span>

function Inner({ slug }: { slug: string }) {
  const { manager, requireSignIn } = useOpsManager()
  const [data, setData] = useState<Any | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [filter, setFilter] = useState('waiting')
  const [q, setQ] = useState(''); const [qLive, setQLive] = useState('')
  const [open, setOpen] = useState<null | 'log' | 'service'>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ t: string; ok: boolean } | null>(null)

  const flash = (t: string, ok = true) => { setToast({ t, ok }); setTimeout(() => setToast(null), 3500) }
  const load = useCallback(async () => {
    const p = new URLSearchParams({ filter }); if (qLive) p.set('q', qLive)
    try {
      const r = await fetch(`/api/portal/${slug}/packages?${p}`, { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (r.ok) { setData(j); setErr(null) } else setErr(j.error || 'Could not load packages.')
    } catch { setErr('Could not load packages.') }
  }, [slug, filter, qLive])
  useEffect(() => { void load() }, [load])
  useEffect(() => { const t = setTimeout(() => setQLive(q), 300); return () => clearTimeout(t) }, [q])
  useEffect(() => { const t = setInterval(() => { if (!document.hidden) void load() }, 30000); return () => clearInterval(t) }, [load])

  const act = useCallback(async (action: string, body: Any = {}, ok?: string): Promise<Any | null> => {
    if (!manager) { requireSignIn(); return null }
    setBusy(true)
    try {
      const r = await fetch(`/api/portal/${slug}/packages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { if (j.need_manager) requireSignIn(); flash(j.error || 'That didn’t work.', false); return null }
      if (ok) flash(ok)
      void load()
      return j
    } catch { flash('That didn’t work.', false); return null } finally { setBusy(false) }
  }, [manager, requireSignIn, slug, load])

  if (err) return <div className="pk-card" style={{ color: C.alert }}><style>{CSS}</style>{err}</div>
  if (!data) return <div className="pk-card" style={{ color: C.ink3 }}><style>{CSS}</style>Loading packages…</div>
  if (!data.room) return (
    <div className="pk-card"><style>{CSS}</style>
      <div style={{ fontSize: 15, fontWeight: 600 }}>No package room yet</div>
      <div style={{ color: C.ink3, fontSize: 13.5, marginTop: 4 }}>Gate Guard’s package room logs every box with a photo, tells residents where it is, and watches the shelves until pickup. Ask your Gate Guard rep about adding one.</div>
    </div>
  )

  const room = data.room as Any; const ov = data.overview as Any; const fees = data.fees as Any
  const today = data.today_section as Any | null
  const kpis = [
    { k: 'Waiting', v: ov.waiting, s: ov.oldest_days ? `Oldest ${ov.oldest_days} day${ov.oldest_days === 1 ? '' : 's'}` : 'All fresh', dot: DOT.blue, f: 'waiting' },
    { k: 'Delivered today', v: ov.delivered_today, s: today ? `Today’s section: ${today.name}` : '—', dot: DOT.blue, f: 'today' },
    { k: 'Picked up today', v: ov.picked_up_today, s: 'Logged when residents leave', dot: DOT.green, f: 'picked_up' },
    { k: 'Needs attention', v: ov.needs_attention, s: ov.needs_attention ? 'Tap to see what’s open' : 'All clear', dot: ov.needs_attention ? DOT.orange : DOT.green, f: 'attention' },
  ]
  const list = (data.packages ?? []) as Any[]
  const attention: Any[] = [...((data.exceptions ?? []) as Any[]).map(e => ({ ...e, _t: 'ex' })), ...((data.aging ?? []) as Any[]).map(p => ({ ...p, _t: 'age' }))]

  return (
    <div className="pk-wrap">
      <style>{CSS}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{room.name}</span>
          {room.status !== 'live' && <span className="pk-pill"><span className="pk-dot" style={{ background: DOT.orange }} />Being set up</span>}
          {room.service_on && <span className="pk-pill" style={{ background: '#FFF4E5', color: C.warn }}>Service mode until {when(room.service_until)}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="pk-btn" onClick={() => manager ? setOpen('service') : requireSignIn()}>{room.service_on ? 'Service mode on' : 'Service mode'}</button>
          <button type="button" className="pk-btn pri" onClick={() => manager ? setOpen('log') : requireSignIn()}>Log a package</button>
        </div>
      </div>

      <div className="pk-kpis">
        {kpis.map(x => (
          <button key={x.k} type="button" className="pk-kpi" onClick={() => { if (x.f === 'attention') document.getElementById('pk-attention')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); else { setQ(''); setFilter(x.f) } }}>
            <div className="pk-k"><span className="pk-dot" style={{ background: x.dot }} />{x.k}</div>
            <div className="pk-num" style={{ color: x.f === 'attention' && x.v ? C.warn : undefined }}>{x.v}</div>
            <div className="pk-s">{x.s}</div>
          </button>
        ))}
      </div>

      <div className="pk-split">
        <section className="pk-card" aria-label="Packages">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <div className="pk-seg" role="group" aria-label="Show">
              {[['waiting', 'Waiting'], ['today', 'Today'], ['picked_up', 'Picked up'], ['aging', `${fees.free_days}+ days`]].map(([k, l]) => (
                <button key={k} type="button" aria-pressed={!qLive && filter === k} onClick={() => { setQ(''); setFilter(k) }}>{l}</button>
              ))}
            </div>
            <input className="pk-in" style={{ width: 240 }} placeholder="Search name, unit or tracking" value={q} onChange={e => setQ(e.target.value)} aria-label="Search packages" />
          </div>
          <div className="pk-tw">
            <table className="pk-tbl">
              <thead><tr><th>Unit</th><th>Name</th><th>Carrier</th><th>Arrived</th><th>Section</th><th>Status</th><th className="pk-hide" style={{ textAlign: 'right' }}>Fee</th></tr></thead>
              <tbody>
                {list.length === 0 && <tr><td colSpan={7} style={{ color: C.ink3 }}>{qLive ? 'No packages match.' : 'Nothing here right now.'}</td></tr>}
                {list.map(p => (
                  <tr key={p.id} className="click" onClick={() => setDetail(p.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setDetail(p.id) }}>
                    <td style={{ fontWeight: 600 }}>{p.unit || <span style={{ color: C.warn }}>Needs unit</span>}</td>
                    <td>{p.recipient_name || '—'}</td>
                    <td>{p.carrier || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{when(p.received_at)}</td>
                    <td><Section s={p.section} /></td>
                    <td><span className="pk-pill"><span className="pk-dot" style={{ background: STATUS_DOT[p.status] ?? DOT.gray }} />{p.status_label}{!['picked_up', 'returned'].includes(p.status) && p.days ? ` · ${p.days}d` : ''}</span></td>
                    <td className="pk-hide" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: p.fee_now ? C.warn : C.ink3 }}>{p.fee_waived ? 'Waived' : p.fee_now ? money(p.fee_now) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 12 }}>Pickup is always allowed · storage fees post to the resident’s account at pickup ({fees.free_days} days free, then {money(fees.daily_fee_cents)}/day, up to {money(fees.fee_cap_cents)}).</div>
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          <section className="pk-card" id="pk-attention" aria-label="Needs attention">
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Needs attention{attention.length ? ` · ${attention.length}` : ''}</div>
            {attention.length === 0 && <div style={{ color: C.ink3, fontSize: 13.5 }}>All clear.</div>}
            {attention.slice(0, 20).map(x => x._t === 'ex' ? (
              <div key={x.id} className="pk-row">
                <span className="pk-dot" style={{ background: x.severity === 'alert' ? DOT.red : DOT.orange }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{x.title}</div>
                  <div style={{ fontSize: 12.5, color: C.ink3 }}>{[x.label, when(x.created_at)].join(' · ')}{x.detail ? ` — ${x.detail}` : ''}</div>
                  {x.clip_url && <a href={x.clip_url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 600 }}>Watch the clip</a>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {x.package_id && <button type="button" className="pk-btn" style={{ minHeight: 32 }} onClick={() => setDetail(x.package_id)}>Open</button>}
                  <button type="button" className="pk-btn go" style={{ minHeight: 32 }} disabled={busy} onClick={() => act('resolve', { id: x.id, resolution: 'Handled by property' }, 'Marked handled')}>Handled</button>
                </div>
              </div>
            ) : (
              <button key={x.id} type="button" className="pk-row" onClick={() => setDetail(x.id)} style={{ width: '100%', background: 'none', border: 0, borderTop: '1px solid rgba(0,0,0,.06)', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                <span className="pk-dot" style={{ background: DOT.orange }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>Unit {x.unit || '—'} · waiting {x.days} days</div>
                  <div style={{ fontSize: 12.5, color: C.ink3 }}>{[x.recipient_name, x.section?.name, x.fee_now ? `${money(x.fee_now)} so far` : null].filter(Boolean).join(' · ')}</div>
                </div>
              </button>
            ))}
          </section>

          <section className="pk-card" aria-label="Sections">
            <div style={{ fontSize: 15, fontWeight: 600 }}>Sections</div>
            <div style={{ fontSize: 12.5, color: C.ink3, margin: '2px 0 10px' }}>{today ? `Drivers fill ${today.name} today. Each day uses the next empty section.` : 'Each day’s deliveries go in their own color section.'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8 }}>
              {((data.sections ?? []) as Any[]).map(s => (
                <div key={s.id} style={{ border: `1px solid ${today?.id === s.id ? C.blue : C.border}`, borderRadius: 10, padding: '8px 10px' }}>
                  <Section s={s} />
                  <div style={{ fontSize: 12, color: C.ink3, marginTop: 3 }}>{s.waiting} waiting</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
      {!manager && <div style={{ fontSize: 12.5, color: C.ink3 }}>Sign in with your personal PIN to log, hand out or change packages.</div>}

      {open === 'log' && <LogSheet sections={data.sections ?? []} busy={busy} onClose={() => setOpen(null)} onSave={async b => { if (await act('log_package', b, 'Package logged')) setOpen(null) }} />}
      {open === 'service' && <ServiceSheet room={room} busy={busy} onClose={() => setOpen(null)} onSet={async (m, note) => { if (await act('service', { minutes: m, note }, m ? 'Service mode on' : 'Service mode off')) setOpen(null) }} />}
      {detail && <DetailSheet slug={slug} id={detail} busy={busy} act={act} onClose={() => setDetail(null)} />}
      {toast && <div role="status" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 150, background: toast.ok ? 'rgba(29,29,31,.92)' : C.alert, color: '#fff', borderRadius: 12, padding: '10px 16px', fontSize: 13.5, fontWeight: 500, boxShadow: '0 10px 30px rgba(0,0,0,.25)' }}>{toast.t}</div>}
    </div>
  )
}

function LogSheet({ sections, busy, onClose, onSave }: { sections: Any[]; busy: boolean; onClose: () => void; onSave: (b: Any) => void }) {
  const [f, setF] = useState<Any>({ unit: '', recipient_name: '', carrier: '', tracking: '', size: 'box', flags: [] as string[], staff_hold: false, section_id: '', notes: '' })
  const set = (k: string, v: unknown) => setF((p: Any) => ({ ...p, [k]: v }))
  const flag = (k: string) => set('flags', f.flags.includes(k) ? f.flags.filter((x: string) => x !== k) : [...f.flags, k])
  const chip = (on: boolean): CSSProperties => ({ border: `1px solid ${on ? C.ink : C.border2}`, background: on ? C.ink : '#fff', color: on ? '#fff' : C.ink2, borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' })
  return (
    <Sheet title="Log a package" sub="For a box taken at the office or entered by hand. It goes in today’s section unless you pick one." onClose={onClose}>
      <div className="pk-g2">
        <Field label="Unit"><input className="pk-in" id="pkp-unit" value={f.unit} onChange={e => set('unit', e.target.value)} autoFocus /></Field>
        <Field label="Name on the label"><input className="pk-in" id="pkp-name" value={f.recipient_name} onChange={e => set('recipient_name', e.target.value)} /></Field>
        <Field label="Carrier"><select className="pk-in" id="pkp-carrier" value={f.carrier} onChange={e => set('carrier', e.target.value)}><option value="">From tracking number</option>{['UPS', 'FedEx', 'USPS', 'Amazon', 'DHL', 'OnTrac', 'Veho', 'Other'].map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Tracking number (optional)"><input className="pk-in" id="pkp-tracking" value={f.tracking} onChange={e => set('tracking', e.target.value)} /></Field>
        <Field label="Size"><select className="pk-in" id="pkp-size" value={f.size} onChange={e => set('size', e.target.value)}><option value="envelope">Envelope</option><option value="box">Box</option><option value="oversized">Oversized</option></select></Field>
        <Field label="Where it goes"><select className="pk-in" id="pkp-section" value={f.section_id} onChange={e => set('section_id', e.target.value)}><option value="">Automatic</option>{sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[['cold', 'Cold'], ['medication', 'Medication'], ['signature', 'Signature'], ['damaged', 'Damaged']].map(([k, l]) => <button key={k} type="button" aria-pressed={f.flags.includes(k)} style={chip(f.flags.includes(k))} onClick={() => flag(k)}>{l}</button>)}
        <button type="button" aria-pressed={f.staff_hold} style={chip(f.staff_hold)} onClick={() => set('staff_hold', !f.staff_hold)}>Staff hold</button>
      </div>
      <Field label="Note (optional)"><textarea className="pk-in" id="pkp-notes" rows={2} value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
      <div><button type="button" className="pk-btn pri" disabled={busy || (!f.unit.trim() && !f.recipient_name.trim())} onClick={() => onSave({ ...f, section_id: f.section_id || undefined, carrier: f.carrier || undefined })}>Log package</button></div>
    </Sheet>
  )
}

function ServiceSheet({ room, busy, onClose, onSet }: { room: Any; busy: boolean; onClose: () => void; onSet: (m: number, note: string) => void }) {
  const [note, setNote] = useState('')
  return (
    <Sheet title="Service mode" sub="Unlocks the package room for maintenance, pauses people-in-room alerts and holds package alerts. Cameras keep recording. Ends on its own." onClose={onClose} width={460}>
      {room.service_on && <div style={{ background: '#FFF4E5', color: C.warn, borderRadius: 10, padding: '10px 12px', fontSize: 13.5 }}>On until {when(room.service_until)}{room.service_by ? ` · ${room.service_by}` : ''}{room.service_note ? ` · ${room.service_note}` : ''}</div>}
      <Field label="What’s the work? (optional)"><input className="pk-in" id="pkp-svc" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. cleaning, shelf repair" /></Field>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[[15, '15 min'], [60, '1 hour'], [240, '4 hours']].map(([m, l]) => <button key={m} type="button" className="pk-btn" disabled={busy} onClick={() => onSet(Number(m), note)}>{l}</button>)}
        {room.service_on && <button type="button" className="pk-btn warn" disabled={busy} onClick={() => onSet(0, '')}>End now</button>}
      </div>
    </Sheet>
  )
}

function DetailSheet({ slug, id, busy, act, onClose }: { slug: string; id: string; busy: boolean; act: (a: string, b?: Any, ok?: string) => Promise<Any | null>; onClose: () => void }) {
  const [d, setD] = useState<Any | null>(null)
  const [unit, setUnit] = useState(''); const [name, setName] = useState(''); const [note, setNote] = useState('')
  const load = useCallback(async () => {
    const r = await fetch(`/api/portal/${slug}/packages?package=${id}`, { cache: 'no-store' })
    const j = await r.json().catch(() => ({}))
    if (r.ok) { setD(j); setUnit(j.package.unit ?? ''); setName(j.package.recipient_name ?? '') }
  }, [slug, id])
  useEffect(() => { void load() }, [load])
  const run = async (a: string, b: Any = {}, ok?: string) => { const r = await act(a, { id, ...b }, ok); if (r) void load() }
  const p = d?.package as Any | undefined
  const gone = p && ['picked_up', 'returned'].includes(p.status)
  return (
    <Sheet title={p ? (p.unit ? `Unit ${p.unit}` : 'Needs a unit') : 'Package'} sub={p ? [p.recipient_name, p.carrier, p.tracking].filter(Boolean).join(' · ') : undefined} onClose={onClose}>
      {!p ? <div style={{ color: C.ink3 }}>Loading…</div> : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="pk-pill"><span className="pk-dot" style={{ background: STATUS_DOT[p.status] ?? DOT.gray }} />{p.status_label}</span>
            {p.section && <span className="pk-pill"><span aria-hidden style={{ width: 8, height: 14, borderRadius: 2, background: p.section.color }} />{p.section.name}{p.spot ? ` · ${p.spot}` : ''}</span>}
            <span className="pk-pill">Arrived {when(p.received_at)}</span>
            {p.fee_waived ? <span className="pk-pill">Fee waived</span> : p.fee_now > 0 ? <span className="pk-pill" style={{ color: C.warn }}>{money(p.fee_now)}{p.status === 'picked_up' ? ' posted to their account' : ' so far'}</span> : !gone ? <span className="pk-pill">Free until {when(p.free_until)}</span> : null}
            {(p.flags ?? []).map((x: string) => <span key={x} className="pk-pill" style={{ color: x === 'damaged' ? C.alert : undefined }}>{x}</span>)}
          </div>
          {(p.label_photo_url || p.shelf_photo_url) && (
            <div className="pk-g2">
              {p.label_photo_url && <img src={p.label_photo_url} alt="Shipping label" style={{ width: '100%', borderRadius: 10 }} />}
              {p.shelf_photo_url && <img src={p.shelf_photo_url} alt="Where it sits on the shelf" style={{ width: '100%', borderRadius: 10 }} />}
            </div>
          )}
          {p.picked_up_at && <div style={{ fontSize: 13.5 }}>Picked up {when(p.picked_up_at)}{p.picked_up_by ? ` by ${p.picked_up_by}` : ''}.</div>}
          {!gone && (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="pk-btn pri" disabled={busy} onClick={() => run('pickup', {}, 'Marked picked up')}>Picked up at the desk</button>
                {p.status === 'staff_hold' ? <button type="button" className="pk-btn" disabled={busy} onClick={() => run('release', {}, 'Released')}>Release hold</button>
                  : <button type="button" className="pk-btn" disabled={busy} onClick={() => run('hold', {}, 'On staff hold')}>Staff hold</button>}
                {!p.fee_waived && p.fee_now > 0 && <button type="button" className="pk-btn" disabled={busy} onClick={() => run('waive', {}, 'Fee waived')}>Waive fee</button>}
                <button type="button" className="pk-btn warn" disabled={busy} onClick={() => run('return', {}, 'Marked returned to sender')}>Return to sender</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '100px minmax(0,1fr) auto', gap: 8, alignItems: 'end' }}>
                <Field label="Unit"><input className="pk-in" id="pkp-d-unit" value={unit} onChange={e => setUnit(e.target.value)} /></Field>
                <Field label="Name"><input className="pk-in" id="pkp-d-name" value={name} onChange={e => setName(e.target.value)} /></Field>
                <button type="button" className="pk-btn" disabled={busy || !unit.trim()} onClick={() => run('assign', { unit, recipient_name: name }, 'Saved')}>Save</button>
              </div>
            </>
          )}
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Timeline</div>
            {((d!.events ?? []) as Any[]).length === 0 && <div style={{ color: C.ink3, fontSize: 13 }}>No history yet.</div>}
            {((d!.events ?? []) as Any[]).map(e => (
              <div key={e.id} className="pk-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{e.kind.replace(/_/g, ' ').replace(/^./, (c: string) => c.toUpperCase())}{e.detail?.text ? ` — ${e.detail.text}` : ''}{e.detail?.fee_cents ? ` · ${money(e.detail.fee_cents)} to their account` : ''}</div>
                  <div style={{ fontSize: 12.5, color: C.ink3 }}>{when(e.created_at)} · {e.actor}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8 }}>
            <input className="pk-in" id="pkp-d-note" placeholder="Add a note" value={note} onChange={e => setNote(e.target.value)} />
            <button type="button" className="pk-btn" disabled={busy || !note.trim()} onClick={async () => { await run('note', { text: note }); setNote('') }}>Add</button>
          </div>
        </>
      )}
    </Sheet>
  )
}

export default function PackagesClient({ slug, displayName }: { slug: string; displayName: string }) {
  return <OpsShell slug={slug} displayName={displayName} active="packages"><Inner slug={slug} /></OpsShell>
}
