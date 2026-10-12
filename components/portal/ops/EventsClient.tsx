'use client'

/**
 * EventsClient — the Event Tracker page (approved design). Stat cards + filter
 * chips + search over live, categorized Brivo access events for the site.
 */
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { OpsShell, C } from '@/components/portal/ops/OpsShell'
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires
const { Search, Zap, XCircle, ShieldCheck, Play, ChevronDown } = require('lucide-react') as any

type Evt = { id: string; time: string; date: string; label: string; user: string; gate: string; cat: 'access' | 'denied' | 'admin' | 'schedule'; tone: string }
const toneColor: Record<string, string> = { safe: C.safe, cyan: C.cyan, warn: C.warn, alert: C.alert }

function panel(extra?: React.CSSProperties): React.CSSProperties {
  return { background: 'linear-gradient(180deg,rgba(32,44,66,.78),rgba(18,26,42,.72))', backdropFilter: 'blur(18px) saturate(1.15)', border: '1px solid rgba(255,255,255,.085)', borderRadius: 16, overflow: 'hidden', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.09), 0 2px 6px rgba(0,0,0,.25), 0 34px 70px -32px rgba(0,0,0,.85)', ...extra }
}

const CATS: [string, string][] = [['all', 'All events'], ['access', 'Valid access'], ['denied', 'Denied'], ['admin', 'Admin'], ['schedule', 'Scheduled']]

function Inner({ slug }: { slug: string }) {
  const router = useRouter()
  const [events, setEvents] = useState<Evt[]>([])
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')

  useEffect(() => { fetch(`/api/portal/${slug}/events`).then(r => r.json()).then(j => { setEvents(j.events || []); setLoading(false) }).catch(() => setLoading(false)) }, [slug])

  const stats = useMemo(() => ({
    today: events.length,
    denied: events.filter(e => e.cat === 'denied').length,
    admin: events.filter(e => e.cat === 'admin').length,
  }), [events])

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return events.filter(e => (cat === 'all' || e.cat === cat) && (!ql || `${e.user} ${e.label} ${e.gate}`.toLowerCase().includes(ql)))
  }, [events, cat, q])

  const statCards = [
    { v: stats.today, l: 'Events (last 7 days)', c: C.cyan, Icon: Zap },
    { v: stats.denied, l: 'Access denied', c: C.alert, Icon: XCircle },
    { v: stats.admin, l: 'Admin / manager actions', c: C.warn, Icon: ShieldCheck },
  ]
  const chip = (active: boolean): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, borderRadius: 10, padding: '9px 13px', cursor: 'pointer', border: `1px solid ${active ? 'rgba(0,163,224,0.5)' : C.border2}`, background: active ? 'rgba(0,163,224,0.12)' : C.card, color: active ? C.cyan : C.ink })
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
          <div key={i} style={{ background: 'linear-gradient(165deg,rgba(255,255,255,.035),transparent 55%),rgba(20,28,43,.5)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: `${s.c}22`, color: s.c }}><s.Icon size={20} /></div>
            <div><div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>{loading ? '—' : s.v}</div><div style={{ fontSize: 11.5, color: C.ink2, marginTop: 4, fontWeight: 600 }}>{s.l}</div></div>
          </div>
        ))}
      </div>

      <div style={{ ...panel(), marginBottom: 20 }}>
        <div style={{ padding: '14px 16px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <span style={{ ...chip(false), color: C.ink2 }}><span style={{ color: C.ink3 }}>Date:</span> Last 7 days <ChevronDown size={14} color={C.ink3} /></span>
          {CATS.map(([k, label]) => <span key={k} onClick={() => setCat(k)} style={chip(cat === k)}>{label}</span>)}
        </div>
      </div>

      <div style={panel()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 18px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>All events</span>
          <span style={{ fontSize: 11.5, color: C.ink3 }}>{loading ? 'Loading…' : `${rows.length} of ${events.length} events`}</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Timestamp', 'Event', 'User', 'Gate / Door', 'Camera'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: C.ink2 }}>Loading events…</td></tr> :
              rows.length === 0 ? <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: C.ink2 }}>No events match.</td></tr> :
                rows.map(e => (
                  <tr key={e.id}>
                    <td style={td}><div style={{ fontWeight: 700 }}>{e.time}</div><div style={{ fontSize: 11, color: C.ink3 }}>{e.date}</div></td>
                    <td style={td}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: toneColor[e.tone] }} />{e.label}</span></td>
                    <td style={{ ...td, fontWeight: 600 }}>{e.user}</td>
                    <td style={{ ...td, color: C.ink2 }}>{e.gate}</td>
                    <td style={td}><button onClick={() => router.push(`/portal/${slug}/video`)} title="View camera" style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', background: 'rgba(0,163,224,.12)', border: '1px solid rgba(0,163,224,.3)', color: C.cyan, cursor: 'pointer' }}><Play size={14} /></button></td>
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
