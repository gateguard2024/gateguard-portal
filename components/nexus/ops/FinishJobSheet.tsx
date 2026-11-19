'use client'

/**
 * FinishJobSheet — the close-out every "Complete" goes through (rules in
 * lib/job-closeout.ts). Two required answers, then Complete:
 *   1. Time on site — arrive / leave (filled from the clock if they used it;
 *      entries can be fixed or removed; a running clock must be stopped).
 *   2. Parts used or replaced — add them, or tick "No parts used".
 *   3. Which gate or door (only at properties with openings set up) — so a
 *      repeat visit is counted on the right opening. "Whole property / other" is fine.
 *   0. What it was (lib/service-taxonomy.ts) — visit type, what was worked on, the fix,
 *      and the cause on repairs. "Remote reset" swaps time on site for remote minutes.
 * Corporate can close without them by giving a reason.
 *
 * Works in the portal and the field app: pass `headers` (e.g. x-tech-code) and the
 * host's own `complete` (the field app queues it offline).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { X, Check, Clock, Package, Loader2, Trash2, Plus, MapPin, Wrench } from 'lucide-react'
import { VISIT_TYPES, SYSTEMS, CAUSES, RESOLUTIONS, BILL_TO, NEEDS_CAUSE, BILLABLE_CAUSES, labelOf, type ServiceDetails } from '@/lib/service-taxonomy'

type Entry = { id: string; technician_name: string | null; clock_in: string; clock_out: string | null; duration_mins: number | null; notes?: string | null }
type Part = { id: string; name: string | null; qty: number | null; action: string | null }
type Status = { ok: boolean; message: string; missing: string[]; time: { entries: number; minutes: number; running: number }; parts: { count: number; none: boolean }; opening?: { required: boolean; id: string | null; property: boolean; name: string | null; options: { id: string; name: string; kind: string }[] }; details?: { required: boolean; values: Partial<ServiceDetails>; missing: string[]; suggested: { visit_type: string | null } }; needsMigration?: boolean }

const INK = '#1D1D1F', MUTED = '#6E6E73', BLUE = '#0071E3', GREEN = '#1A7F37', ORANGE = '#B25000', RED = '#D70015', LINE = 'rgba(0,0,0,0.10)'

// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm".
function toLocal(iso: string | Date | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : '')
const hm = (mins: number) => (mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60 ? `${mins % 60} min` : ''}`.trim() : `${mins} min`)
const when = (iso: string) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export function FinishJobSheet({ woId, title, onClose, onCompleted, complete, headers, techName, isCorporate, scheduledAt }: {
  woId: string
  title?: string | null
  onClose: () => void
  onCompleted?: () => void
  /** Completes the job. Return true, or an error message. Gets the override reason when corporate skips the close-out. */
  complete: (overrideReason?: string) => Promise<true | string>
  headers?: Record<string, string>
  techName?: string | null
  isCorporate?: boolean
  scheduledAt?: string | null
}) {
  const h = useMemo(() => ({ 'Content-Type': 'application/json', ...(headers ?? {}) }), [headers])
  const [st, setSt] = useState<Status | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [parts, setParts] = useState<Part[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  // add time
  const [arrive, setArrive] = useState('')
  const [leave, setLeave] = useState(toLocal(new Date()))
  // edit time
  const [editId, setEditId] = useState<string | null>(null)
  const [editIn, setEditIn] = useState('')
  const [editOut, setEditOut] = useState('')
  // add part
  const [pName, setPName] = useState('')
  const [pQty, setPQty] = useState('1')
  const [pAction, setPAction] = useState<'used' | 'installed'>('used')
  // override
  const [skip, setSkip] = useState(false)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    const [s, t, p] = await Promise.all([
      fetch(`/api/maintenance/${woId}/closeout`, { headers: h, cache: 'no-store' }).then((r) => r.json()).catch(() => null),
      fetch(`/api/maintenance/${woId}/time`, { headers: h, cache: 'no-store' }).then((r) => r.json()).catch(() => null),
      fetch(`/api/maintenance/${woId}/parts`, { headers: h, cache: 'no-store' }).then((r) => r.json()).catch(() => null),
    ])
    if (s && typeof s.ok === 'boolean') setSt(s)
    const list: Entry[] = Array.isArray(t?.entries) ? t.entries : []
    setEntries(list)
    setParts(Array.isArray(p?.parts) ? p.parts : [])
    // Pre-fill "arrive" from the earliest clock-in, else the scheduled time.
    setArrive((a) => a || toLocal(list.length ? list[list.length - 1].clock_in : scheduledAt ?? null))
  }, [woId, h, scheduledAt])
  useEffect(() => { void load() }, [load])

  async function call(key: string, url: string, init: RequestInit): Promise<boolean> {
    setBusy(key); setErr(null)
    try {
      const r = await fetch(url, { ...init, headers: h })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(d?.error ?? 'That didn’t save. Try again.'); return false }
      await load(); return true
    } catch { setErr('No connection — try again.'); return false } finally { setBusy(null) }
  }

  const addTime = () => call('time', `/api/maintenance/${woId}/closeout`, { method: 'POST', body: JSON.stringify({ arrive: fromLocal(arrive), leave: fromLocal(leave), technician_name: techName ?? undefined }) })
  const stopClock = (e: Entry) => call(`stop-${e.id}`, `/api/maintenance/${woId}/time`, { method: 'PATCH', body: JSON.stringify({ entry_id: e.id }) })
  const saveEdit = async (e: Entry) => { if (await call(`edit-${e.id}`, `/api/maintenance/${woId}/time`, { method: 'PATCH', body: JSON.stringify({ entry_id: e.id, clock_in: fromLocal(editIn), clock_out: fromLocal(editOut) }) })) setEditId(null) }
  const removeEntry = (e: Entry) => call(`del-${e.id}`, `/api/maintenance/${woId}/time?entry_id=${e.id}`, { method: 'DELETE' })
  const addPart = async () => {
    if (!pName.trim()) return
    if (await call('part', `/api/maintenance/${woId}/parts`, { method: 'POST', body: JSON.stringify({ name: pName.trim(), qty: Number(pQty) || 1, action: pAction, added_by: techName ?? undefined }) })) {
      setPName(''); setPQty('1')
      if (st?.parts.none) await call('none', `/api/maintenance/${woId}/closeout`, { method: 'POST', body: JSON.stringify({ parts_none: false }) })
    }
  }
  const removePart = (p: Part) => call(`delp-${p.id}`, `/api/maintenance/${woId}/parts/${p.id}`, { method: 'DELETE' })
  const setNone = (v: boolean) => { setSt((x) => (x ? { ...x, parts: { ...x.parts, none: v } } : x)); return call('none', `/api/maintenance/${woId}/closeout`, { method: 'POST', body: JSON.stringify({ parts_none: v, technician_name: techName ?? undefined }) }) }

  const setOpening = (v: string) => {
    if (!v) return
    setSt((x) => (x?.opening ? { ...x, opening: { ...x.opening, id: v === 'property' ? null : v, property: v === 'property' } } : x))
    return call('opening', `/api/maintenance/${woId}/closeout`, { method: 'POST', body: JSON.stringify({ opening: v }) })
  }
  async function doComplete(override?: string) {
    setBusy('complete'); setErr(null)
    const r = await complete(override)
    setBusy(null)
    if (r === true) { onCompleted?.(); onClose(); return }
    setErr(r); void load()
  }

  // What it was (235). Each tap saves; the screen updates right away.
  const dt = st?.details
  const dv: Partial<ServiceDetails> = dt?.values ?? {}
  const [remoteMins, setRemoteMins] = useState('')
  useEffect(() => { if (dv.remote_minutes != null) setRemoteMins(String(dv.remote_minutes)) }, [dv.remote_minutes])
  const setDetail = (patch: Partial<ServiceDetails>) => {
    // Hit by a vehicle / abuse / resident error → suggest billing the property (if not picked yet).
    if (patch.cause && BILLABLE_CAUSES.has(patch.cause) && !dv.bill_to) patch = { ...patch, bill_to: 'property' }
    setSt((x) => (x?.details ? { ...x, details: { ...x.details, values: { ...x.details.values, ...patch } } } : x))
    return call('details', `/api/maintenance/${woId}/closeout`, { method: 'POST', body: JSON.stringify({ details: patch }) })
  }
  const [showSecond, setShowSecond] = useState(false)
  const remote = dv.resolution === 'remote_reset'
  const needCause = !!dv.visit_type && NEEDS_CAUSE.has(dv.visit_type)
  const detailsOk = !!dt && (!dt.required || dt.missing.length === 0)
  const timeOk = remote ? Number(dv.remote_minutes) > 0 && !!st && st.time.running === 0 : !!st && st.time.entries > 0 && st.time.running === 0
  const partsOk = !!st && (st.parts.count > 0 || st.parts.none)
  const shownParts = parts.filter((p) => p.action !== 'returned')
  const op = st?.opening
  const openingOk = !!op && (!op.required || !!op.id || op.property)

  return (
    <div role="dialog" aria-modal="true" aria-label="Finish job" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 140, background: 'rgba(10,14,22,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, "Segoe UI", sans-serif' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '92dvh', overflowY: 'auto', background: '#F5F5F7', borderRadius: 16, boxShadow: '0 30px 80px -20px rgba(0,0,0,0.45)', color: INK }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', background: '#fff', borderBottom: `1px solid ${LINE}`, borderRadius: '16px 16px 0 0', position: 'sticky', top: 0, zIndex: 1 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 600 }}>Finish job</div>
            {title && <div style={{ fontSize: 13, color: MUTED, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{title}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 0, background: '#EEEEF0', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: MUTED }}><X size={16} /></button>
        </div>

        <div style={{ padding: 14, display: 'grid', gap: 12 }}>
          {st?.needsMigration && <div style={{ fontSize: 12.5, color: ORANGE }}>“No parts used” needs migration 232 — until it runs, add the parts used.</div>}

          {/* 1. What it was */}
          {dt?.required && (
            <section style={card}>
              <Head n={1} ok={detailsOk} icon={<Wrench size={15} />} title="What was it?" sub={dv.visit_type ? [labelOf('visit_type', dv.visit_type), dv.system ? labelOf('system', dv.system) : null, dv.resolution ? labelOf('resolution', dv.resolution) : null].filter(Boolean).join(' · ') : 'A few taps — so we can see what our calls really are'} />
              <Pick label="Visit type" items={VISIT_TYPES} value={dv.visit_type ?? null} suggested={!dv.visit_type ? dt.suggested.visit_type : null} onPick={(v) => void setDetail({ visit_type: v as ServiceDetails['visit_type'] })} />
              <Pick label="What we worked on" items={SYSTEMS} value={dv.system ?? null} onPick={(v) => void setDetail({ system: v as ServiceDetails['system'], ...(dv.system_2 === v ? { system_2: null } : {}) })} />
              {dv.system && (showSecond || dv.system_2) ? <Pick label="Also worked on (optional)" items={SYSTEMS.filter((x) => x.id !== dv.system)} value={dv.system_2 ?? null} clearable onPick={(v) => void setDetail({ system_2: (v || null) as ServiceDetails['system_2'] })} />
                : dv.system ? <button type="button" onClick={() => setShowSecond(true)} style={{ ...ghost, border: 0, background: 'none', padding: '0 0 6px', color: BLUE }}>+ Also worked on something else</button> : null}
              {needCause && <Pick label="Cause (why it failed)" items={CAUSES} value={dv.cause ?? null} onPick={(v) => void setDetail({ cause: v as ServiceDetails['cause'] })} />}
              <Pick label="Fix" items={RESOLUTIONS} value={dv.resolution ?? null} onPick={(v) => void setDetail({ resolution: v as ServiceDetails['resolution'] })} />
              {remote && (
                <label style={{ ...lbl, marginBottom: 10 }}>Minutes spent remotely
                  <input aria-label="Minutes spent remotely" inputMode="numeric" value={remoteMins} placeholder="e.g. 10" onChange={(x) => setRemoteMins(x.target.value.replace(/\D/g, ''))} onBlur={() => { if (remoteMins !== String(dv.remote_minutes ?? '')) void setDetail({ remote_minutes: remoteMins ? Number(remoteMins) : null }) }} style={{ ...inp, maxWidth: 160 }} />
                </label>
              )}
              <Pick label="Who pays (optional)" items={BILL_TO} value={dv.bill_to ?? null} clearable onPick={(v) => void setDetail({ bill_to: (v || null) as ServiceDetails['bill_to'] })} />
              {dv.bill_to === 'property' && <div style={{ fontSize: 12.5, color: ORANGE, marginTop: -4 }}>Marked ready for billing when the job is completed.</div>}
            </section>
          )}

          {/* 2. Time on site (a remote reset logs remote minutes above instead) */}
          {(!remote || (st?.time.running ?? 0) > 0) && <section style={card}>
            <Head n={dt?.required ? 2 : 1} ok={timeOk} icon={<Clock size={15} />} title="Time on site" sub={st ? (st.time.entries ? `${hm(st.time.minutes)} logged` : 'When did you arrive and leave?') : ''} />
            {entries.map((e) => (
              <div key={e.id} style={{ borderTop: `1px solid ${LINE}`, padding: '8px 0', fontSize: 13.5 }}>
                {editId === e.id ? (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={two}>
                      <label style={lbl}>Arrived<input type="datetime-local" value={editIn} onChange={(x) => setEditIn(x.target.value)} style={inp} /></label>
                      <label style={lbl}>Left<input type="datetime-local" value={editOut} onChange={(x) => setEditOut(x.target.value)} style={inp} /></label>
                    </div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => setEditId(null)} style={ghost}>Cancel</button>
                      <button type="button" onClick={() => void saveEdit(e)} disabled={busy === `edit-${e.id}`} style={primary}>Save times</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontWeight: 600 }}>{e.technician_name || 'Tech'}</b> · {when(e.clock_in)} → {e.clock_out ? `${new Date(e.clock_out).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${hm(e.duration_mins ?? 0)}` : <span style={{ color: ORANGE, fontWeight: 600 }}>still running</span>}
                    </span>
                    {!e.clock_out
                      ? <button type="button" onClick={() => void stopClock(e)} disabled={busy === `stop-${e.id}`} style={{ ...primary, background: ORANGE }}>Stop now</button>
                      : <button type="button" onClick={() => { setEditId(e.id); setEditIn(toLocal(e.clock_in)); setEditOut(toLocal(e.clock_out)) }} style={ghost}>Edit</button>}
                    <button type="button" aria-label="Remove this time" onClick={() => void removeEntry(e)} disabled={busy === `del-${e.id}`} style={{ ...ghost, padding: '5px 7px' }}><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
            ))}
            <div style={{ borderTop: entries.length ? `1px solid ${LINE}` : undefined, paddingTop: entries.length ? 10 : 2, display: 'grid', gap: 8 }}>
              <div style={two}>
                <label style={lbl}>Arrived<input type="datetime-local" aria-label="Arrived" value={arrive} onChange={(x) => setArrive(x.target.value)} style={inp} /></label>
                <label style={lbl}>Left<input type="datetime-local" aria-label="Left" value={leave} onChange={(x) => setLeave(x.target.value)} style={inp} /></label>
              </div>
              <button type="button" onClick={() => void addTime()} disabled={!arrive || !leave || busy === 'time'} style={{ ...primary, justifySelf: 'start', opacity: !arrive || !leave ? 0.5 : 1 }}>
                {busy === 'time' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {entries.length ? 'Add another visit' : 'Save time on site'}
              </button>
            </div>
          </section>}

          {/* 2. Parts */}
          <section style={card}>
            <Head n={dt?.required ? 3 : 2} ok={partsOk} icon={<Package size={15} />} title="Parts used or replaced" sub={st?.parts.none ? 'No parts used' : shownParts.length ? `${shownParts.length} part${shownParts.length === 1 ? '' : 's'}` : 'Add them, or tick “No parts used”'} />
            {shownParts.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: `1px solid ${LINE}`, padding: '7px 0', fontSize: 13.5 }}>
                <span style={{ flex: 1 }}>{p.name || 'Part'} <span style={{ color: MUTED }}>× {p.qty ?? 1}{p.action === 'installed' ? ' · replaced' : ''}</span></span>
                <button type="button" aria-label={`Remove ${p.name}`} onClick={() => void removePart(p)} disabled={busy === `delp-${p.id}`} style={{ ...ghost, padding: '5px 7px' }}><Trash2 size={13} /></button>
              </div>
            ))}
            {!st?.parts.none && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px auto auto', gap: 6, marginTop: shownParts.length ? 8 : 2 }}>
                <input aria-label="Part name" placeholder="Part (e.g. gate operator board)" value={pName} onChange={(x) => setPName(x.target.value)} onKeyDown={(x) => { if (x.key === 'Enter') void addPart() }} style={inp} />
                <input aria-label="Quantity" inputMode="numeric" value={pQty} onChange={(x) => setPQty(x.target.value.replace(/\D/g, ''))} style={inp} />
                <select aria-label="Used or replaced" value={pAction} onChange={(x) => setPAction(x.target.value as 'used' | 'installed')} style={{ ...inp, width: 'auto' }}>
                  <option value="used">Used</option><option value="installed">Replaced</option>
                </select>
                <button type="button" onClick={() => void addPart()} disabled={!pName.trim() || busy === 'part'} style={{ ...primary, opacity: pName.trim() ? 1 : 0.5 }}>Add</button>
              </div>
            )}
            {!shownParts.length && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!st?.parts.none} disabled={busy === 'none'} onChange={(x) => void setNone(x.target.checked)} style={{ width: 18, height: 18 }} />
                No parts used
              </label>
            )}
          </section>

          {/* 3. Which gate or door — only where openings are set up */}
          {op?.required && (
            <section style={card}>
              <Head n={dt?.required ? 4 : 3} ok={openingOk} icon={<MapPin size={15} />} title="Which gate or door?" sub={op.property ? 'Whole property / other' : op.name ?? 'So a repeat visit shows on the right one'} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[...op.options.map((o) => ({ v: o.id, l: o.name })), { v: 'property', l: 'Whole property / other' }].map(({ v, l }) => {
                  const on = v === 'property' ? op.property : op.id === v
                  return <button key={v} type="button" aria-pressed={on} onClick={() => void setOpening(v)} disabled={busy === 'opening'}
                    style={{ border: `1px solid ${on ? INK : 'rgba(0,0,0,0.16)'}`, background: on ? INK : '#fff', color: on ? '#fff' : INK, borderRadius: 999, padding: '7px 13px', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
                })}
              </div>
            </section>
          )}

          {err && <div role="alert" style={{ fontSize: 13, color: RED }}>{err}</div>}

          {/* Complete */}
          <button type="button" onClick={() => void doComplete()} disabled={!st?.ok || busy === 'complete'}
            style={{ ...primary, justifyContent: 'center', padding: 14, fontSize: 15, background: st?.ok ? GREEN : '#D2D2D7', cursor: st?.ok ? 'pointer' : 'not-allowed' }}>
            {busy === 'complete' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Complete job
          </button>
          {st && !st.ok && <div style={{ fontSize: 12.5, color: ORANGE, textAlign: 'center' }}>{st.message}</div>}

          {isCorporate && st && !st.ok && (
            skip ? (
              <div style={{ ...card, display: 'grid', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Close without time and parts (corporate)</div>
                <input aria-label="Reason" placeholder="Why? e.g. old job cleanup, tech no longer with us" value={reason} onChange={(x) => setReason(x.target.value)} style={inp} />
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setSkip(false)} style={ghost}>Cancel</button>
                  <button type="button" onClick={() => void doComplete(reason.trim())} disabled={reason.trim().length < 5 || busy === 'complete'} style={{ ...primary, background: ORANGE, opacity: reason.trim().length < 5 ? 0.5 : 1 }}>Close job anyway</button>
                </div>
              </div>
            ) : <button type="button" onClick={() => setSkip(true)} style={{ ...ghost, justifySelf: 'center', border: 0, background: 'none', color: MUTED, fontSize: 12.5 }}>Close without time and parts…</button>
          )}
        </div>
      </div>
    </div>
  )
}

/** One row of tap-to-pick chips. */
function Pick({ label, items, value, onPick, suggested, clearable }: { label: string; items: readonly { id: string; label: string }[]; value: string | null; onPick: (v: string) => void; suggested?: string | null; clearable?: boolean }) {
  return (
    <div role="group" aria-label={label} style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600, marginBottom: 5 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map((it) => {
          const on = value === it.id, sug = !value && suggested === it.id
          return <button key={it.id} type="button" aria-pressed={on} onClick={() => onPick(on && clearable ? '' : it.id)}
            style={{ border: `1px solid ${on ? INK : sug ? BLUE : 'rgba(0,0,0,0.16)'}`, background: on ? INK : '#fff', color: on ? '#fff' : sug ? BLUE : INK, borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>{it.label}{sug ? ' ?' : ''}</button>
        })}
      </div>
    </div>
  )
}

function Head({ n, ok, icon, title, sub }: { n: number; ok: boolean; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <span aria-hidden style={{ width: 28, height: 28, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: ok ? 'rgba(26,127,55,0.12)' : 'rgba(0,113,227,0.10)', color: ok ? GREEN : BLUE, flexShrink: 0 }}>{ok ? <Check size={15} /> : icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{n}. {title}{ok ? <span style={{ color: GREEN, fontWeight: 500, fontSize: 12.5 }}> · done</span> : <span style={{ color: ORANGE, fontWeight: 500, fontSize: 12.5 }}> · required</span>}</div>
        <div style={{ fontSize: 12.5, color: MUTED }}>{sub}</div>
      </div>
    </div>
  )
}

const card: React.CSSProperties = { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: '12px 14px' }
const two: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }
const lbl: React.CSSProperties = { display: 'grid', gap: 3, minWidth: 0, fontSize: 11.5, color: MUTED, fontWeight: 600 }
const inp: React.CSSProperties = { width: '100%', minWidth: 0, boxSizing: 'border-box', fontSize: 14, padding: '8px 9px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.16)', background: '#fff', color: INK, fontFamily: 'inherit' }
const primary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, borderRadius: 10, padding: '8px 13px', background: BLUE, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const ghost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${LINE}`, borderRadius: 8, padding: '5px 10px', background: '#fff', color: INK, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
