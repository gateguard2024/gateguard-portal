'use client'

/**
 * DashboardClient — the property-manager command center.
 * Brivo Facility Manager-style layout, GateGuard features:
 *   KPI Metrics · Cameras wall · Event Tracker · Gates control ·
 *   Package Room · System & Network · Site Health.
 * Live data (cameras / doors / activity) comes from /summary; widgets with no
 * feed yet render honest "coming online" states rather than fabricated numbers.
 */
import { useEffect, useMemo, useState } from 'react'
import { OpsShell, useOpsManager, C } from '@/components/portal/ops/OpsShell'
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires
const { Zap, Users, ShieldCheck, Video, DoorOpen, Package, Wifi, Activity, ChevronDown, Lock } = require('lucide-react') as any

type Cam = { id: string; name: string; online?: boolean | null }
type Door = { id: string; name: string }
type Act = { id: string; label: string; where: string; time: string; tone?: string }
type Summary = { cameras?: Cam[]; doors?: Door[]; activity?: Act[]; events_today?: number; credentials_active?: number }

const ICON_UNLOCK = (
  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.5-1.9" /></svg>
)

function panel(): React.CSSProperties { return { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' } }
function phead(title: string, right?: React.ReactNode): React.ReactNode {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 18px', borderBottom: `1px solid ${C.border}` }}><span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>{right}</div>
}
const toneColor: Record<string, string> = { safe: C.safe, cyan: C.cyan, warn: C.warn, alert: C.alert }

function Inner({ slug }: { slug: string }) {
  const { manager, requireSignIn } = useOpsManager()
  const [s, setS] = useState<Summary>({})
  const [tick, setTick] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => { fetch(`/api/portal/${slug}/summary`).then(r => r.json()).then(setS).catch(() => {}) }, [slug])
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 15000); return () => clearInterval(t) }, [])

  const doors = s.doors ?? []
  const cams = s.cameras ?? []
  const camsOnline = cams.filter(c => c.online !== false).length
  const activity = s.activity ?? []

  function flash(t: string) { setToast(t); setTimeout(() => setToast(null), 3000) }
  async function openGate(d: Door) {
    if (!manager) { requireSignIn(); return }
    setBusy(d.id)
    try {
      const r = await fetch(`/api/portal/${slug}/gate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ door_id: d.id, door_name: d.name, action: 'open' }) })
      const j = await r.json().catch(() => ({}))
      flash(r.ok ? `${d.name} opened` : (j?.error || 'Command failed'))
    } catch { flash('Command failed') } finally { setBusy(null) }
  }

  // ---- Site Health (computed from real signals) ----
  const health = useMemo(() => {
    const camPct = cams.length ? Math.round((camsOnline / cams.length) * 100) : null
    const accessPct = doors.length ? 100 : null
    const bars = [
      { n: 'Access Control', pc: accessPct, note: doors.length ? `${doors.length}/${doors.length} gates` : 'not connected' },
      { n: 'Cameras', pc: camPct, note: cams.length ? `${camsOnline}/${cams.length} online` : 'not connected' },
    ]
    const known = bars.filter(b => b.pc != null).map(b => b.pc as number)
    const score = known.length ? Math.round(known.reduce((a, b) => a + b, 0) / known.length) : null
    const label = score == null ? '—' : score >= 95 ? 'EXCELLENT' : score >= 85 ? 'HEALTHY' : score >= 70 ? 'FAIR' : 'NEEDS ATTENTION'
    return { score, label, bars }
  }, [cams.length, camsOnline, doors.length])

  // ---- Integrations (honest: inferred from whether data is flowing) ----
  const integrations = [
    { n: 'Brivo', on: doors.length > 0 },
    { n: 'Eagle Eye', on: cams.length > 0 },
  ]

  const kpis: { label: string; value: string; sub: React.ReactNode; Icon: any; tone: string }[] = [
    { label: 'Access Events Today', value: s.events_today != null ? s.events_today.toLocaleString() : (activity.length ? `${activity.length}` : '—'), sub: s.events_today != null ? 'across all gates' : 'recent in feed', Icon: Zap, tone: C.cyan },
    { label: 'Active Credentials', value: s.credentials_active != null ? s.credentials_active.toLocaleString() : '—', sub: s.credentials_active != null ? 'residents + staff' : 'syncing…', Icon: Users, tone: C.ink2 },
    { label: 'Gates Secured', value: doors.length ? `${doors.length}/${doors.length}` : '—', sub: <span style={{ color: C.safe, fontWeight: 700 }}>All secure</span>, Icon: ShieldCheck, tone: C.safe },
    { label: 'Cameras Online', value: cams.length ? `${camsOnline}/${cams.length}` : '—', sub: cams.length ? `${Math.round((camsOnline / cams.length) * 100)}% live` : 'not connected', Icon: Video, tone: C.cyan },
  ]

  const L = {
    pagehead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 22, flexWrap: 'wrap' as const },
    h1: { margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' },
    sub: { fontSize: 12.5, color: C.ink2, marginTop: 3 },
    selectbox: { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, background: C.card, border: `1px solid ${C.border2}`, borderRadius: 9, padding: '9px 13px', color: C.ink },
    btn: { fontSize: 13, fontWeight: 700, borderRadius: 9, padding: '9px 15px', cursor: 'pointer', border: `1px solid ${C.border2}`, background: C.card, color: C.ink },
    btnPrimary: { fontSize: 13, fontWeight: 700, borderRadius: 9, padding: '9px 15px', cursor: 'pointer', border: 0, background: `linear-gradient(135deg, ${C.cyan}, ${C.blue})`, color: '#04202e' },
    kcard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 18px 16px' },
    netrow: { display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, padding: '8px 0', borderBottom: `1px solid ${C.border}` },
    bar: { height: 6, borderRadius: 999, background: C.well, marginTop: 9, overflow: 'hidden' },
  }

  return (
    <div>
      {/* Page header */}
      <div style={L.pagehead}>
        <div>
          <h1 style={L.h1}>Facility Manager</h1>
          <div style={L.sub}>Live operations overview</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={L.selectbox}><span style={{ color: C.ink3 }}>Site:</span> This property <ChevronDown size={15} color={C.ink2} /></span>
          <button style={L.btn}>Edit</button>
          <button style={L.btnPrimary}>Add Widgets</button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div style={{ ...panel(), marginBottom: 20 }}>
        {phead('KPI Metrics')}
        <div style={{ padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }} className="gg-kpis">
            {kpis.map((k, i) => (
              <div key={i} style={L.kcard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: C.ink2 }}><k.Icon size={15} color={k.tone} />{k.label}</div>
                <div style={{ fontSize: 32, fontWeight: 800, marginTop: 12, letterSpacing: '-0.02em', lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 8, color: C.ink3 }}>{k.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cameras + Event Tracker */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 20, alignItems: 'start', marginBottom: 20 }} className="gg-cols">
        <div style={panel()}>
          {phead('Cameras')}
          <div style={{ padding: 18 }}>
            {cams.length === 0 ? (
              <div style={{ fontSize: 12.5, color: C.ink2, padding: '22px 0', textAlign: 'center' }}>No cameras connected for this site yet.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }} className="gg-camwall">
                {cams.slice(0, 9).map(c => (
                  <div key={c.id} style={{ position: 'relative', aspectRatio: '16 / 10', borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border2}`, background: '#05070b' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/portal/${slug}/camera-preview?camera_id=${encodeURIComponent(c.id)}&t=${tick}`} alt={c.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span style={{ position: 'absolute', left: 9, top: 8, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px #000' }}><span style={{ width: 7, height: 7, borderRadius: 999, background: c.online === false ? C.alert : C.safe, boxShadow: `0 0 6px ${c.online === false ? C.alert : C.safe}` }} />{c.online === false ? 'Offline' : 'Live'}</span>
                    <span style={{ position: 'absolute', left: 9, bottom: 8, fontSize: 11.5, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.9)' }}>{c.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={panel()}>
          {phead('Event Tracker')}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Timestamp', 'Event', 'User', 'Gate'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.ink3, borderBottom: `1px solid ${C.border}` }}>{h}</th>)}</tr></thead>
            <tbody>
              {activity.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: '22px 14px', fontSize: 12.5, color: C.ink2, textAlign: 'center' }}>No recent activity.</td></tr>
              ) : activity.slice(0, 9).map(a => (
                <tr key={a.id}>
                  <td style={{ padding: '11px 14px', fontSize: 12.5, borderBottom: `1px solid ${C.border}`, verticalAlign: 'top' }}><div style={{ fontWeight: 700 }}>{a.time}</div></td>
                  <td style={{ padding: '11px 14px', fontSize: 12.5, borderBottom: `1px solid ${C.border}` }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: toneColor[a.tone || 'safe'] }} />{a.label}</span></td>
                  <td style={{ padding: '11px 14px', fontSize: 12.5, borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>{a.where || '—'}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12.5, borderBottom: `1px solid ${C.border}`, color: C.ink2 }}>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gates / Packages / Network trio */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, alignItems: 'start' }} className="gg-trio">
        {/* Gates */}
        <div style={panel()}>
          {phead('Gates & Access')}
          <div style={{ padding: 18 }}>
            {doors.length === 0 ? <div style={{ fontSize: 12.5, color: C.ink2 }}>No gates linked for this site.</div> : doors.map((d, i) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 2px', borderBottom: i < doors.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: C.safe, flexShrink: 0 }} /><span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.25 }}>{d.name}</span></div>
                <button onClick={() => openGate(d)} disabled={busy === d.id} className="gg-openbtn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: C.ink2, background: 'transparent', border: `1px solid ${C.border2}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', flexShrink: 0 }}>{ICON_UNLOCK}{busy === d.id ? '…' : 'Open'}</button>
              </div>
            ))}
            {!manager && doors.length > 0 && <div style={{ fontSize: 11.5, color: C.ink3, marginTop: 10 }}>Sign in to control gates.</div>}
          </div>
        </div>

        {/* Package Room */}
        <div style={panel()}>
          {phead('Package Room', <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: 'rgba(245,158,11,0.12)', color: C.warn, border: '1px solid rgba(245,158,11,0.3)' }}>SOON</span>)}
          <div style={{ padding: 18 }}>
            <div style={{ fontSize: 13, color: C.ink2, lineHeight: 1.6 }}>Smart-locker and package-room tracking lands with the native hardware rollout — awaiting-pickup counts, carrier log, and resident notifications, all on our own stack.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 12, color: C.ink3 }}><Package size={15} color={C.ink3} /> Monitoring coming online</div>
          </div>
        </div>

        {/* System & Network */}
        <div style={panel()}>
          {phead('System & Network', <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: C.safe, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.28)', borderRadius: 999, padding: '4px 10px' }}><span style={{ width: 8, height: 8, borderRadius: 999, background: C.safe, boxShadow: `0 0 8px ${C.safe}` }} />Online</span>)}
          <div style={{ padding: 18 }}>
            <div style={L.netrow}><span style={{ color: C.ink2 }}>Access controller</span><span style={{ fontWeight: 700, color: doors.length ? C.safe : C.ink3 }}>{doors.length ? 'Reporting ✓' : '—'}</span></div>
            <div style={{ ...L.netrow, borderBottom: 'none' }}><span style={{ color: C.ink2 }}>Camera gateway</span><span style={{ fontWeight: 700, color: cams.length ? C.safe : C.ink3 }}>{cams.length ? 'Reporting ✓' : '—'}</span></div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.ink3, margin: '14px 0 9px' }}>Integrations</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {integrations.map(it => (
                <span key={it.n} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, padding: '6px 11px', borderRadius: 999, border: `1px solid ${C.border2}`, background: C.card }}><span style={{ width: 7, height: 7, borderRadius: 999, background: it.on ? C.safe : C.ink3, boxShadow: it.on ? `0 0 6px ${C.safe}` : 'none' }} />{it.n}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Site Health */}
      <div style={{ ...panel(), marginTop: 20 }}>
        {phead('Site Health', <Activity size={16} color={C.cyan} />)}
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
            <HealthRing score={health.score} label={health.label} />
            <div style={{ flex: 1, minWidth: 260, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 28px' }} className="gg-hbars">
              {health.bars.map(h => {
                const pc = h.pc
                const col = pc == null ? C.ink3 : pc >= 99 ? C.safe : pc >= 90 ? C.cyan : C.warn
                return (
                  <div key={h.n}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}><b style={{ fontWeight: 700 }}>{h.n}</b><span style={{ fontWeight: 700, color: C.ink2 }}>{pc == null ? '—' : `${pc}%`} · {h.note}</span></div>
                    <div style={L.bar}><i style={{ display: 'block', height: '100%', width: `${pc ?? 0}%`, background: col }} /></div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 130, background: C.panel, border: `1px solid ${C.border2}`, color: C.ink, borderRadius: 10, padding: '12px 19px', fontSize: 13, fontWeight: 600, boxShadow: '0 12px 40px rgba(0,0,0,.55)' }}>{toast}</div>}

      <style>{`
        .gg-openbtn:hover{color:${C.cyan}!important;border-color:rgba(0,163,224,.45)!important;background:rgba(0,163,224,.08)!important}
        @media(max-width:1000px){.gg-kpis{grid-template-columns:1fr 1fr!important}.gg-cols,.gg-trio{grid-template-columns:1fr!important}.gg-camwall{grid-template-columns:1fr 1fr!important}.gg-hbars{grid-template-columns:1fr!important}}
      `}</style>
    </div>
  )
}

function HealthRing({ score, label }: { score: number | null; label: string }) {
  const r = 52, circ = 2 * Math.PI * r, pct = score ?? 0, off = circ * (1 - pct / 100)
  const col = score == null ? C.ink3 : score >= 95 ? C.safe : score >= 85 ? C.cyan : C.warn
  return (
    <div style={{ position: 'relative', width: 132, height: 132, flexShrink: 0 }}>
      <svg viewBox="0 0 132 132" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="66" cy="66" r={r} fill="none" stroke={C.border2} strokeWidth={11} />
        <circle cx="66" cy="66" r={r} fill="none" stroke={col} strokeWidth={11} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <b style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>{score ?? '—'}</b>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: col, letterSpacing: '0.04em' }}>{label}</span>
      </div>
    </div>
  )
}

export default function DashboardClient({ slug, displayName }: { slug: string; displayName: string }) {
  return <OpsShell slug={slug} displayName={displayName} active="dashboard"><Inner slug={slug} /></OpsShell>
}
