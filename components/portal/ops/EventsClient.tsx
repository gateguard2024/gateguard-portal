'use client'

/**
 * EventsClient — the Event Tracker page (approved design). Stat cards + filter
 * chips + search. Source switch (Nov 24 2026): Doors (Brivo access events) ·
 * Cameras (Eagle Eye / Edge camera events — motion, people, vehicles, plates; last
 * 7 days max) · All. The camera button opens Vision on the right camera at that
 * moment (door events → the camera linked to that door).
 */
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { OpsShell, useOpsManager, C } from '@/components/portal/ops/OpsShell'
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires
const { Search, Zap, XCircle, ShieldCheck, Play, ChevronDown } = require('lucide-react') as any

type Evt = { id: string; at?: string | null; time: string; date: string; label: string; user: string; gate: string; cat: 'access' | 'denied' | 'admin' | 'schedule' | 'camera'; tone: string; camKey?: string | null }
type Source = 'all' | 'doors' | 'cameras'
const SOURCES: [Source, string][] = [['all', 'All'], ['doors', 'Doors & gates'], ['cameras', 'Cameras']]
const TZ = 'America/New_York'
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: TZ })
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', timeZone: TZ })
const toneColor: Record<string, string> = { safe: C.safe, cyan: C.cyan, warn: C.warn, alert: C.alert }

function panel(extra?: React.CSSProperties): React.CSSProperties {
  return { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.04), 0 6px 20px -12px rgba(0,0,0,.18)', ...extra }
}

const CATS: [string, string][] = [['all', 'All events'], ['access', 'Valid access'], ['denied', 'Denied'], ['admin', 'Admin'], ['schedule', 'Scheduled']]

function Inner({ slug }: { slug: string }) {
  const router = useRouter()
  const [events, setEvents] = useState<Evt[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState<7 | 30>(7)
  const [err, setErr] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [source, setSource] = useState<Source>('all')
  const [camEvents, setCamEvents] = useState<Evt[] | null>(null)
  const [camErr, setCamErr] = useState<string | null>(null)
  const [byName, setByName] = useState<Record<string, string>>({})
  // Emailed summary (each manager's own: Off / Daily / Weekly) — /api/portal/[slug]/activity-summary
  const { manager, requireSignIn } = useOpsManager()
  const [freq, setFreq] = useState<'off' | 'daily' | 'weekly' | null>(null)
  const [freqMsg, setFreqMsg] = useState<string | null>(null)
  useEffect(() => { if (!manager) { setFreq(null); return } fetch(`/api/portal/${slug}/activity-summary`).then(r => r.json()).then(j => setFreq(j.freq ?? 'off')).catch(() => {}) }, [slug, manager])
  const setSummary = async (f: 'off' | 'daily' | 'weekly' | 'preview') => {
    if (!manager) { requireSignIn(); return }
    const r = await fetch(`/api/portal/${slug}/activity-summary`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f === 'preview' ? { preview: true } : { freq: f }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setFreqMsg(j.error || 'Could not save'); return }
    if (f === 'preview') setFreqMsg('Sample sent to your email'); else { setFreq(f); setFreqMsg(f === 'off' ? 'Summary emails off' : `You’ll get a ${f} summary by email`) }
    setTimeout(() => setFreqMsg(null), 4000)
  }

  // Camera events (Eagle Eye / Edge) — only fetched when Cameras or All is showing.
  useEffect(() => {
    if (source === 'doors') return
    let live = true
    setCamErr(null)
    const start = new Date(Date.now() - Math.min(days, 7) * 864e5).toISOString()
    fetch(`/api/portal/${slug}/video?view=events&start=${encodeURIComponent(start)}`)
      .then(async r => ({ ok: r.ok, j: await r.json().catch(() => ({})) }))
      .then(({ ok, j }) => {
        if (!live) return
        if (!ok) { setCamErr(j.error || 'Camera events didn’t load.'); setCamEvents([]); return }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setCamEvents((j.events ?? []).map((e: any): Evt => ({
          id: e.key, at: e.start, time: fmtTime(e.start), date: fmtDate(e.start), label: e.label || 'Camera event',
          user: e.plate ? `Plate ${e.plate}` : '—', gate: e.cameraName || 'Camera', cat: 'camera', tone: 'cyan', camKey: e.cameraKey,
        })))
        const errs = Object.values(j.errors ?? {}) as string[]
        if (errs.length && !(j.events ?? []).length) setCamErr(errs[0])
      })
      .catch(() => { if (live) { setCamErr('Camera events didn’t load — check your connection.'); setCamEvents([]) } })
    return () => { live = false }
  }, [slug, source, days, reload])
  // Door → its camera (by name), for the camera button on door events.
  useEffect(() => { fetch(`/api/portal/${slug}/door-cameras`).then(r => r.json()).then(j => setByName(j.byName ?? {})).catch(() => {}) }, [slug])
  const openCamera = (e: Evt) => {
    const key = e.camKey ?? byName[e.gate] ?? null
    const at = e.at ? Date.parse(e.at) - 5000 : null
    router.push(key ? `/portal/${slug}/video?cam=${encodeURIComponent(key)}${at ? `&at=${at}` : ''}` : `/portal/${slug}/video`)
  }

  // Up to 30 days: stored history synced hourly from Brivo (migration 241) + a live top-up.
  // Shows the last list from this tab at once (coming back from Vision), then refreshes.
  // A failed refresh keeps what's on screen and says so — never a silent empty list.
  useEffect(() => {
    const k = `gg-pp-events:${slug}:${days}`
    let had = false
    try { const c = sessionStorage.getItem(k); if (c) { setEvents(JSON.parse(c)); had = true } } catch { /* private mode */ }
    setLoading(!had); setErr(null)
    let live = true
    fetch(`/api/portal/${slug}/events?days=${days}`)
      .then(async r => { const j = await r.json().catch(() => ({})); return { ok: r.ok, j } })
      .then(({ ok, j }) => {
        if (!live) return
        if (ok) { setEvents(j.events || []); try { sessionStorage.setItem(k, JSON.stringify(j.events || [])) } catch { /* full */ } }
        else setErr(j.error || 'Door events didn’t load.')
        setLoading(false)
      })
      .catch(() => { if (live) { setErr('Door events didn’t load — check your connection.'); setLoading(false) } })
    return () => { live = false }
  }, [slug, days, reload])

  const stats = useMemo(() => ({
    today: events.length,
    denied: events.filter(e => e.cat === 'denied').length,
    admin: events.filter(e => e.cat === 'admin').length,
  }), [events])

  const shownAll = useMemo(() => {
    const doors = source === 'cameras' ? [] : events
    const cams = source === 'doors' ? [] : (camEvents ?? [])
    return [...doors, ...cams].sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? '')))
  }, [events, camEvents, source])
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    // Door type buttons only apply to door events.
    return shownAll.filter(e => (cat === 'all' || source === 'cameras' || e.cat === cat) && (!ql || `${e.user} ${e.label} ${e.gate}`.toLowerCase().includes(ql)))
  }, [shownAll, cat, q, source])

  // Download what's on screen (current switch, filter and search) as a spreadsheet file.
  const downloadCsv = () => {
    const q2 = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [['Date', 'Time (Eastern)', 'Event', source === 'cameras' ? 'Plate' : 'User', 'Gate / Door / Camera', 'Type'].map(q2).join(',')]
    for (const e of rows) lines.push([e.date, e.time, e.label, e.user, e.gate, e.cat].map(q2).join(','))
    const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `${slug}-activity-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const statCards = [
    { v: stats.today, l: `Door events (last ${days} days)`, c: C.cyan, Icon: Zap },
    { v: stats.denied, l: 'Access denied', c: C.alert, Icon: XCircle },
    { v: stats.admin, l: 'Admin / manager actions', c: C.warn, Icon: ShieldCheck },
  ]
  const chip = (active: boolean): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, borderRadius: 10, padding: '9px 13px', cursor: 'pointer', border: `1px solid ${active ? 'rgba(0,113,227,0.5)' : C.border2}`, background: active ? 'rgba(0,113,227,0.08)' : C.card, color: active ? C.cyan : C.ink })
  const th: React.CSSProperties = { textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.ink3, borderBottom: `1px solid ${C.border}` }
  const td: React.CSSProperties = { padding: '11px 14px', fontSize: 12.5, borderBottom: `1px solid ${C.border}`, verticalAlign: 'middle' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Event Tracker</h1>
          <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 3 }}>Every access event across this property · live</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: C.card, border: `1px solid ${C.border2}`, borderRadius: 11, padding: '9px 14px', width: 360, maxWidth: '46vw' }}>
          <Search size={16} color={C.ink3} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by resident, event or gate" style={{ flex: 1, background: 'transparent', border: 0, outline: 'none', color: C.ink, fontSize: 13 }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }} className="gg-evstats">
        {statCards.map((s, i) => (
          <div key={i} style={{ background: C.well, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: `${s.c}22`, color: s.c }}><s.Icon size={20} /></div>
            <div><div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>{loading ? '—' : s.v}</div><div style={{ fontSize: 11.5, color: C.ink2, marginTop: 4, fontWeight: 600 }}>{s.l}</div></div>
          </div>
        ))}
      </div>

      <div style={{ ...panel(), marginBottom: 20 }}>
        <div style={{ padding: '14px 16px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <button type="button" onClick={() => setDays(days === 7 ? 30 : 7)} aria-label={`Showing the last ${days} days. Switch to ${days === 7 ? 30 : 7} days`} style={{ ...chip(false), color: C.ink2, cursor: 'pointer' }}><span style={{ color: C.ink3 }}>Date:</span> Last {days} days <ChevronDown size={14} color={C.ink3} /></button>
          <span role="group" aria-label="Show" style={{ display: 'inline-flex', gap: 4, padding: 3, borderRadius: 12, background: C.well, border: `1px solid ${C.border}` }}>
            {SOURCES.map(([k, label]) => <button key={k} type="button" aria-pressed={source === k} onClick={() => { setSource(k); if (k === 'cameras') setCat('all') }} style={{ ...chip(source === k), border: 0, padding: '7px 12px' }}>{label}</button>)}
          </span>
          {source !== 'cameras' && CATS.map(([k, label]) => <button key={k} type="button" aria-pressed={cat === k} onClick={() => setCat(k)} style={chip(cat === k)}>{label}</button>)}
          {source !== 'doors' && <span style={{ fontSize: 11.5, color: camErr ? C.alert : C.ink3 }}>{camErr ? `Camera events: ${camErr}` : camEvents === null ? 'Loading camera events…' : `Camera events: last ${Math.min(days, 7)} days`}</span>}
        </div>
      </div>

      <div style={panel()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 18px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{source === 'doors' ? 'Door & gate events' : source === 'cameras' ? 'Camera events' : 'All events'}</span>
            <button type="button" onClick={downloadCsv} disabled={!rows.length} style={{ fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 8, border: `1px solid ${C.border2}`, background: '#fff', color: C.ink, cursor: 'pointer' }}>Download CSV</button>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.ink2 }}>Email me a summary
              <select value={freq ?? 'off'} onChange={e => void setSummary(e.target.value as 'off' | 'daily' | 'weekly')} onFocus={() => { if (!manager) requireSignIn() }} style={{ fontSize: 12, padding: '4px 6px', borderRadius: 7, border: `1px solid ${C.border2}`, background: '#fff' }}>
                <option value="off">Off</option><option value="daily">Daily (7 am)</option><option value="weekly">Weekly (Mondays)</option>
              </select>
            </label>
            {manager && <button type="button" onClick={() => void setSummary('preview')} style={{ fontSize: 12, border: 0, background: 'none', color: C.cyan, cursor: 'pointer', padding: 0 }}>Send me a sample</button>}
            {freqMsg && <span style={{ fontSize: 12, color: C.ink2 }}>{freqMsg}</span>}
          </span>
          <span style={{ fontSize: 11.5, color: err && events.length ? C.alert : C.ink3 }}>{loading ? 'Loading…' : err && events.length ? <>Couldn’t refresh — showing the last list. <button type="button" onClick={() => setReload(x => x + 1)} style={{ border: 0, background: 'none', color: C.cyan, font: 'inherit', fontWeight: 600, cursor: 'pointer', padding: 0 }}>Try again</button></> : `${rows.length} of ${events.length} events`}</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Timestamp', 'Event', source === 'cameras' ? 'Plate' : 'User', source === 'cameras' ? 'Camera' : 'Gate / Door / Camera', 'Watch'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: C.ink2 }}>Loading events…</td></tr> :
              rows.length === 0 ? <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: err ? C.alert : C.ink2 }}>{err && !events.length ? <>{err} <button type="button" onClick={() => setReload(x => x + 1)} style={{ marginLeft: 8, border: 0, background: 'none', color: C.cyan, font: 'inherit', fontWeight: 600, cursor: 'pointer' }}>Try again</button></> : 'No events match.'}</td></tr> :
                rows.map(e => (
                  <tr key={e.id}>
                    <td style={td}><div style={{ fontWeight: 700 }}>{e.time}</div><div style={{ fontSize: 11, color: C.ink3 }}>{e.date}</div></td>
                    <td style={td}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: toneColor[e.tone] }} />{e.label}</span></td>
                    <td style={{ ...td, fontWeight: 600 }}>{e.user}</td>
                    <td style={{ ...td, color: C.ink2 }}>{e.gate}</td>
                    <td style={td}><button type="button" onClick={() => openCamera(e)} title={(e.camKey || byName[e.gate]) ? 'Watch this moment' : 'Open Vision'} aria-label={`Watch ${e.gate} at ${e.time}`} style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', background: 'rgba(0,113,227,.08)', border: '1px solid rgba(0,113,227,.3)', color: C.cyan, cursor: 'pointer' }}><Play size={14} /></button></td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      <style>{`@media(max-width:900px){.gg-evstats{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}

export default function EventsClient({ slug, displayName }: { slug: string; displayName: string }) {
  return <OpsShell slug={slug} displayName={displayName} active="activity"><Inner slug={slug} /></OpsShell>
}
