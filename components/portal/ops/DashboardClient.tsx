'use client'

/**
 * DashboardClient — the property-manager command center (approved design).
 * Alarm.com-style Security hero + ButterflyMX warmth + PDK device clarity +
 * Brivo data backbone, on an elevated glass theme with the GateGuard brand
 * gradient. Live camera/gate/event data from /summary; billing from /billing;
 * honest "coming online" states where there's no feed yet.
 */
import { useEffect, useMemo, useState } from 'react'
import { OpsShell, useOpsManager, C, BRAND } from '@/components/portal/ops/OpsShell'
import { HoldButton } from '@/components/portal/ops/HoldButton'
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires
const { Zap, Users, ShieldCheck, Video, Package, Activity, ChevronDown, CreditCard, Ticket } = require('lucide-react') as any

type Cam = { id: string; name: string; online?: boolean | null }
type Door = { id: string; name: string }
type Act = { id: string; label: string; where: string; time: string; tone?: string }
type Summary = {
  health?: { score: number; band: 'good' | 'watch' | 'bad'; reasons: { kind: string; text: string; points: number }[] } | null
  gates?: { watched: number; open: { label: string; since: string | null }[]; blind: string[] }; cameras?: Cam[]; doors?: Door[]; activity?: Act[]; events_today?: number; credentials_active?: number }
// Real invoices for this property (lib/portal-billing.ts) — no sample data.
type Billing = { balance: number; overdue: number; due_next: { date: string; amount: number } | null; paid_90: number; invoices: { id: string; number: string; status: string; due_date: string | null; balance: number; days_late: number; pay_url: string | null }[] }

const toneColor: Record<string, string> = { safe: C.safe, cyan: C.cyan, warn: C.warn, alert: C.alert }
const ICON_UNLOCK = <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.5-1.9" /></svg>

function panel(extra?: React.CSSProperties): React.CSSProperties {
  return { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.04), 0 6px 20px -12px rgba(0,0,0,.18)', ...extra }
}
function phead(title: string, right?: React.ReactNode): React.ReactNode {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 18px', borderBottom: `1px solid ${C.border}` }}><span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>{right}</div>
}

function Ring({ size, pct, color, stroke, children }: { size: number; pct: number; color: string; stroke: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2 - 1, c = 2 * Math.PI * r, off = c * (1 - pct / 100)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  )
}

function Inner({ slug, lockActive, setLockActive }: { slug: string; lockActive: boolean; setLockActive: (v: boolean) => void }) {
  const { manager, requireSignIn } = useOpsManager()
  const [s, setS] = useState<Summary>({})
  const [bill, setBill] = useState<Billing | null>(null)
  const [tick, setTick] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Show what we had last time straight away, then refresh (keeps the page from starting empty).
  useEffect(() => {
    const k = `gg-pp-summary:${slug}`
    try { const c = sessionStorage.getItem(k); if (c) setS(JSON.parse(c)) } catch { /* private mode */ }
    fetch(`/api/portal/${slug}/summary`).then(r => r.ok ? r.json() : null).then(j => { if (!j) return; setS(j); try { sessionStorage.setItem(k, JSON.stringify(j)) } catch { /* full */ } }).catch(() => {})
  }, [slug])
  useEffect(() => { fetch(`/api/portal/${slug}/billing`).then(r => r.json()).then(setBill).catch(() => {}) }, [slug])
  useEffect(() => { const t = setInterval(() => { if (!document.hidden) setTick(x => x + 1) }, 30_000); return () => clearInterval(t) }, [])

  const doors = s.doors ?? []
  const cams = s.cameras ?? []
  const camsOnline = cams.filter(c => c.online !== false).length
  const activity = s.activity ?? []
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(null), Math.max(3000, t.length * 70)) }
  const guarded = (fn: () => void) => { if (!manager) { requireSignIn(); return } fn() }

  async function openGate(d: Door) {
    guarded(async () => {
      setBusy(d.id)
      try {
        const r = await fetch(`/api/portal/${slug}/gate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ door_id: d.id, door_name: d.name, action: 'open' }) })
        const j = await r.json().catch(() => ({}))
        flash(r.ok ? `${d.name} opened` : (j?.error || 'Command failed'))
      } catch { flash('Command failed') } finally { setBusy(null) }
    })
  }
  async function lockdown(active: boolean) {
    try {
      const r = await fetch(`/api/portal/${slug}/lockdown`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) })
      const j = await r.json().catch(() => ({}))
      if (r.ok) { setLockActive(active); flash(active ? `Lockdown logged${j.alerted ? ' and Gate Guard alerted' : ''} — gates are NOT locked automatically yet. Call 911 in an emergency.` : 'Lockdown lifted') }
      else flash(j?.error || 'Lockdown failed')
    } catch { flash('Lockdown failed') }
  }

  // Health = the SAME score Nexus shows (lib/site-health.ts via /summary): 100 minus
  // what's wrong right now, with the reasons. Only real numbers here — no made-up bars.
  const gatesOpen = s.gates?.open ?? []
  const gatesBlind = s.gates?.blind ?? []
  const health = useMemo(() => {
    const camPct = cams.length ? Math.round((camsOnline / cams.length) * 100) : null
    const okDoors = Math.max(0, doors.length - gatesOpen.length)
    const accessPct = doors.length ? Math.round((okDoors / doors.length) * 100) : null
    const bars = [
      { n: 'Gates & doors', pc: accessPct, note: doors.length ? (gatesOpen.length ? `${gatesOpen.length} left open` : `${doors.length}/${doors.length} secure`) : 'not connected' },
      { n: 'Cameras', pc: camPct, note: cams.length ? `${camsOnline}/${cams.length} online` : 'not connected' },
    ]
    const score = s.health ? s.health.score : null
    return { score, band: s.health?.band ?? null, reasons: s.health?.reasons ?? [], bars }
  }, [cams.length, camsOnline, doors.length, gatesOpen.length, s.health])
  const healthCol = health.score == null ? C.ink3 : health.band === 'good' ? C.safe : health.band === 'watch' ? C.warn : C.alert

  const integrations = [{ n: 'Brivo', on: doors.length > 0 }, { n: 'Eagle Eye', on: cams.length > 0 }]

  const L = {
    pagehead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' as const },
    selectbox: { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, background: C.card, border: `1px solid ${C.border2}`, borderRadius: 9, padding: '9px 13px', color: C.ink },
    btn: { fontSize: 13, fontWeight: 700, borderRadius: 9, padding: '9px 15px', cursor: 'pointer', border: `1px solid ${C.border2}`, background: C.card, color: C.ink },
    btnPrimary: { fontSize: 13, fontWeight: 700, borderRadius: 9, padding: '9px 15px', cursor: 'pointer', border: 0, background: BRAND, color: '#fff' },
  }

  const statusCol = lockActive ? C.alert : healthCol
  const statusTitle = lockActive ? 'Lockdown Active' : gatesOpen.length ? (gatesOpen.length === 1 ? 'Gate left open' : `${gatesOpen.length} gates left open`) : health.band === 'bad' ? 'Needs attention' : health.band === 'watch' ? 'Keep an eye on it' : 'All Secure'
  const statusLine = lockActive ? 'Entry gates secured · residents can always exit' : gatesOpen.length ? `${gatesOpen.map(g => g.label).join(', ')}${health.reasons.length > gatesOpen.length ? ` · ${health.reasons.length - gatesOpen.length} more` : ''}` : health.reasons.length ? health.reasons.slice(0, 2).map(r => r.text).join(' · ') : `${doors.length} gates secured · ${camsOnline} of ${cams.length} cameras online`
  const kpis = [
    { label: 'Access Events Today', value: s.events_today != null ? s.events_today.toLocaleString() : (activity.length ? `${activity.length}` : '—'), sub: s.events_today != null ? 'across all gates' : 'recent in feed', pct: 100, tone: C.cyan, Icon: Zap },
    { label: 'Active Credentials', value: s.credentials_active != null ? s.credentials_active.toLocaleString() : '—', sub: s.credentials_active != null ? 'residents + staff' : 'syncing…', pct: 100, tone: C.safe, Icon: Users },
    { label: 'Gates Secured', value: doors.length ? `${Math.max(0, doors.length - gatesOpen.length)}/${doors.length}` : '—', sub: !doors.length ? 'not connected' : gatesOpen.length ? `${gatesOpen.length} left open` : 'all secure', pct: doors.length ? Math.round((Math.max(0, doors.length - gatesOpen.length) / doors.length) * 100) : 0, tone: gatesOpen.length ? C.alert : C.safe, Icon: ShieldCheck },
    { label: 'Cameras Online', value: cams.length ? `${camsOnline}/${cams.length}` : '—', sub: cams.length ? `${Math.round((camsOnline / cams.length) * 100)}% online` : 'not connected', pct: cams.length ? Math.round((camsOnline / cams.length) * 100) : 0, tone: C.cyan, Icon: Video },
  ]

  return (
    <div>
      {/* page header */}
      <div style={L.pagehead}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Facility Manager</h1>
          <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 3 }}>Live operations overview</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={L.selectbox}><span style={{ color: C.ink3 }}>Site:</span> This property <ChevronDown size={15} color={C.ink2} /></span>
          <button style={L.btn}>Edit</button>
          <button style={L.btnPrimary}>Add Widgets</button>
        </div>
      </div>

      {/* Security status hero */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1.1fr', gap: 20, alignItems: 'center', padding: '22px 24px', marginBottom: 20, borderRadius: 22, background: lockActive ? '#FFF6F6' : C.card, border: `1px solid ${lockActive ? 'rgba(215,0,21,.35)' : C.border}`, boxShadow: '0 1px 2px rgba(0,0,0,.04), 0 6px 20px -12px rgba(0,0,0,.18)' }} className="gg-hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
          <div style={{ width: 70, height: 70, borderRadius: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: lockActive ? C.alert : gatesOpen.length || health.band === 'bad' ? C.alert : health.band === 'watch' ? C.warn : BRAND }}>
            <svg viewBox="0 0 24 24" width={34} height={34} fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6z" /><path d="m9 12 2 2 4-4" /></svg>
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink3 }}>Site status</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 2 }}>{statusTitle}</div>
            <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 3 }}>{statusLine}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, justifyContent: 'center', borderLeft: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, padding: '0 18px' }} className="gg-hero-mid">
          <Ring size={92} pct={lockActive ? 100 : (health.score ?? 0)} color={statusCol} stroke={8}>
            <b style={{ fontSize: 24, fontWeight: 800 }}>{lockActive ? 'LOCK' : (health.score ?? '—')}</b>
            <span style={{ fontSize: 9, fontWeight: 700, color: statusCol, letterSpacing: '0.04em' }}>{lockActive ? 'SECURED' : 'HEALTH'}</span>
          </Ring>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {health.bars.slice(0, 3).map(b => (
              <div key={b.n} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.ink2 }}><span style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: b.pc == null ? C.ink3 : b.pc >= 99 ? C.safe : b.pc >= 90 ? C.cyan : C.warn }} />{b.n} · <b style={{ color: C.ink, fontWeight: 600 }}>{b.note}</b></div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lockActive
            ? <HoldButton tone="cyan" label="Hold to lift lockdown" holdingLabel="Lifting…" onConfirm={() => lockdown(false)} />
            : <HoldButton tone="alert" label="Hold to lock down site" holdingLabel="Engaging…" disabled={!manager} title={manager ? undefined : 'Sign in to control'} onConfirm={() => guarded(() => lockdown(true))} />}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {/* Both go to Access: the pass form, and the gates with their cameras (look before you open).
                This button used to open whichever gate was first in the list, with no camera. */}
            <a href={`/portal/${slug}/gates?pass=1`} style={{ ...qbtn, textDecoration: 'none', color: 'inherit' }}><Ticket size={15} color={C.cyan} /> Issue pass</a>
            <a href={`/portal/${slug}/gates`} style={{ ...qbtn, textDecoration: 'none', color: 'inherit' }}>{ICON_UNLOCK} Open a gate</a>
          </div>
        </div>
      </div>

      {/* Needs your attention — what's wrong right now, each with where to fix it */}
      {(() => {
        const go: Record<string, { href: string; label: string }> = {
          gate: { href: `/portal/${slug}/gates`, label: 'See gates' }, blind: { href: `/portal/${slug}/video`, label: 'See cameras' },
          cameras: { href: `/portal/${slug}/video`, label: 'See cameras' }, fault: { href: `/portal/${slug}/service`, label: 'See service' },
          jobs: { href: `/portal/${slug}/service`, label: 'See service' }, overdue: { href: `/portal/${slug}/service`, label: 'See service' },
          requests: { href: `/portal/${slug}/service`, label: 'See service' }, repeat: { href: `/portal/${slug}/service`, label: 'See history' },
        }
        const items = [...health.reasons].sort((a, b) => b.points - a.points)
        const off = cams.filter(c => !c.online)
        return (
          <div style={{ ...panel(), marginBottom: 20 }}>
            {phead(items.length ? `Needs your attention (${items.length})` : 'Needs your attention')}
            {!items.length ? <div style={{ padding: '14px 18px', fontSize: 13, color: C.ink2 }}>{health.score == null ? 'Checking…' : 'Nothing right now — all clear.'}</div> : (
              <div>
                {items.map((r, i) => {
                  const g = go[r.kind] ?? { href: `/portal/${slug}/service`, label: 'Open' }
                  const extra = r.kind === 'cameras' && off.length ? `: ${off.map(c => c.name).slice(0, 4).join(', ')}${off.length > 4 ? '…' : ''}` : ''
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderTop: i ? `1px solid ${C.border}` : undefined }}>
                      <span style={{ width: 8, height: 8, borderRadius: 99, flexShrink: 0, background: r.points >= 15 ? C.alert : r.points >= 6 ? C.warn : C.ink3 }} />
                      <span style={{ flex: 1, fontSize: 13.5, color: C.ink }}>{r.text}{extra}</span>
                      <a href={g.href} style={{ fontSize: 12.5, fontWeight: 600, color: C.cyan, textDecoration: 'none', whiteSpace: 'nowrap' }}>{g.label} ›</a>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {/* KPI Metrics */}
      <div style={{ ...panel(), marginBottom: 20 }}>
        {phead('KPI Metrics')}
        <div style={{ padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }} className="gg-kpis">
            {kpis.map((k, i) => (
              <div key={i} style={{ background: C.well, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <Ring size={58} pct={k.pct} color={k.tone} stroke={5}><k.Icon size={17} color={k.tone} /></Ring>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: C.ink2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, marginTop: 7, letterSpacing: '-0.02em', lineHeight: 1 }}>{k.value}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, marginTop: 6, color: C.ink3 }}>{k.sub}</div>
                </div>
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
            {cams.length === 0 ? <div style={{ fontSize: 12.5, color: C.ink2, padding: '22px 0', textAlign: 'center' }}>No cameras connected for this site yet.</div> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }} className="gg-camwall">
                {cams.slice(0, 9).map(c => {
                  const off = c.online === false
                  return (
                    <a key={c.id} href={`/portal/${slug}/video`} title="Open Video" style={{ display: 'block', position: 'relative', aspectRatio: '16 / 10', borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border2}`, background: '#05070b' }}>
                      {off ? <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink3, fontSize: 11, fontWeight: 600 }}>No signal</div> :
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={`/api/portal/${slug}/camera-preview?camera_id=${encodeURIComponent(c.id)}&t=${tick}`} alt={c.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                      <span style={{ position: 'absolute', left: 9, top: 8, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px #000' }}><span style={{ width: 7, height: 7, borderRadius: 999, background: off ? C.alert : C.safe }} />{off ? 'Offline' : 'Picture · every 30 s'}</span>
                      <span style={{ position: 'absolute', left: 9, bottom: 8, fontSize: 11.5, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.9)' }}>{c.name}</span>
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div style={panel()}>
          {phead('Event Tracker')}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Timestamp', 'Event', 'User', 'Gate'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.ink3, borderBottom: `1px solid ${C.border}` }}>{h}</th>)}</tr></thead>
            <tbody>
              {activity.length === 0 ? <tr><td colSpan={4} style={{ padding: '22px 14px', fontSize: 12.5, color: C.ink2, textAlign: 'center' }}>No recent activity.</td></tr> :
                activity.slice(0, 9).map(a => (
                  <tr key={a.id}>
                    <td style={{ padding: '11px 14px', fontSize: 12.5, borderBottom: `1px solid ${C.border}`, verticalAlign: 'top', fontWeight: 700 }}>{a.time}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12.5, borderBottom: `1px solid ${C.border}` }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: toneColor[a.tone || 'safe'] }} />{a.label}</span></td>
                    <td style={{ padding: '11px 14px', fontSize: 12.5, borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>{a.where || '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12.5, borderBottom: `1px solid ${C.border}`, color: C.ink2 }}>—</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gates / Packages / Network */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, alignItems: 'start', marginBottom: 20 }} className="gg-trio">
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

        <div style={panel()}>
          {phead('Package Room', <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: 'rgba(178,80,0,0.08)', color: C.warn, border: '1px solid rgba(178,80,0,0.3)' }}>SOON</span>)}
          <div style={{ padding: 18 }}>
            <div style={{ fontSize: 13, color: C.ink2, lineHeight: 1.6 }}>Smart-locker and package-room tracking lands with the native hardware rollout — awaiting-pickup counts, carrier log, and resident notifications on our own stack.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 12, color: C.ink3 }}><Package size={15} color={C.ink3} /> Monitoring coming online</div>
          </div>
        </div>

        <div style={panel()}>
          {phead('System & Network', <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: C.safe, background: 'rgba(31,138,59,0.08)', border: '1px solid rgba(31,138,59,0.28)', borderRadius: 999, padding: '4px 10px' }}><span style={{ width: 8, height: 8, borderRadius: 999, background: C.safe }} />Online</span>)}
          <div style={{ padding: 18 }}>
            <div style={netrow}><span style={{ color: C.ink2 }}>Access controller</span><span style={{ fontWeight: 700, color: doors.length ? C.safe : C.ink3 }}>{doors.length ? 'Reporting ✓' : '—'}</span></div>
            <div style={{ ...netrow, borderBottom: 'none' }}><span style={{ color: C.ink2 }}>Camera gateway</span><span style={{ fontWeight: 700, color: cams.length ? C.safe : C.ink3 }}>{cams.length ? 'Reporting ✓' : '—'}</span></div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.ink3, margin: '14px 0 9px' }}>Integrations</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {integrations.map(it => <span key={it.n} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, padding: '6px 11px', borderRadius: 999, border: `1px solid ${C.border2}`, background: C.card }}><span style={{ width: 7, height: 7, borderRadius: 999, background: it.on ? C.safe : C.ink3 }} />{it.n}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* Billing — real invoices; full list on the Billing page */}
      {bill && Array.isArray(bill.invoices) && (
        <div style={{ ...panel(), marginBottom: 20 }}>
          {phead('Billing & Payments', <a href={`/portal/${slug}/billing`} style={{ fontSize: 12, fontWeight: 600, color: C.blue, textDecoration: 'none' }}>All invoices →</a>)}
          <div style={{ padding: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 26, alignItems: 'start' }} className="gg-bill">
              <div style={{ background: C.well, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.ink3 }}>Balance</div>
                <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em', margin: '8px 0 10px' }}>${bill.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '7px 0', borderTop: `1px solid ${C.border}`, color: C.ink2 }}><span>Past due</span><b style={{ color: bill.overdue > 0 ? C.alert : C.ink, fontWeight: 600 }}>${bill.overdue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '7px 0', borderTop: `1px solid ${C.border}`, color: C.ink2 }}><span>Next due</span><b style={{ color: C.ink, fontWeight: 600 }}>{bill.due_next ? `$${bill.due_next.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} · ${new Date(`${bill.due_next.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : '—'}</b></div>
                <a href={`/portal/${slug}/billing`} style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 14, width: '100%', boxSizing: 'border-box', background: BRAND, color: '#fff', borderRadius: 12, padding: 12, fontWeight: 600, fontSize: 13.5 }}>{bill.balance > 0 ? 'View & pay' : 'View invoices'}</a>
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Open invoices</div>
                {bill.invoices.filter(i => i.balance > 0).length === 0 ? <div style={{ fontSize: 13, color: C.ink3 }}>You’re all paid up.</div> : bill.invoices.filter(i => i.balance > 0).slice(0, 5).map(i => (
                  <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: `1px solid ${C.border}`, fontSize: 13 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: i.status === 'overdue' ? '#FF3B30' : '#0A84FF', flex: 'none' }} />
                    <span style={{ fontWeight: 600 }}>{i.number}</span>
                    <span style={{ color: C.ink3, flex: 1 }}>{i.days_late > 0 ? `${i.days_late} days past due` : i.due_date ? `Due ${new Date(`${i.due_date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</span>
                    <b style={{ fontWeight: 600 }}>${i.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>
                    {i.pay_url && <a href={i.pay_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: C.blue, textDecoration: 'none' }}>Pay</a>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Site Health */}
      <div style={{ ...panel(), marginBottom: 0 }}>
        {phead('Site Health', <Activity size={16} color={C.cyan} />)}
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
            <Ring size={132} pct={health.score ?? 0} color={healthCol} stroke={11}>
              <b style={{ fontSize: 34, fontWeight: 800 }}>{health.score ?? '—'}</b>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: C.ink2, letterSpacing: '0.04em' }}>HEALTH</span>
            </Ring>
            <div style={{ flex: 1, minWidth: 260, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 28px' }} className="gg-hbars">
              {health.bars.map(h => { const col = h.pc == null ? C.ink3 : h.pc >= 99 ? C.safe : h.pc >= 90 ? C.cyan : C.warn; return (
                <div key={h.n}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}><b style={{ fontWeight: 700 }}>{h.n}</b><span style={{ fontWeight: 700, color: C.ink2 }}>{h.pc == null ? '—' : `${h.pc}%`} · {h.note}</span></div>
                  <div style={{ height: 6, borderRadius: 999, background: C.well, overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: `${h.pc ?? 0}%`, background: col }} /></div>
                </div>) })}
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>{health.score == null ? 'Health not available yet' : health.reasons.length ? 'What’s lowering the score' : 'Nothing wrong right now'}</div>
                {health.reasons.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, color: C.ink2, padding: '5px 0', borderTop: i ? `1px solid ${C.border}` : undefined }}>
                    <span>{r.text}</span><span style={{ fontWeight: 700, color: C.ink }}>−{r.points}</span>
                  </div>))}
                {gatesBlind.length > 0 && <div style={{ fontSize: 12, color: C.ink3, marginTop: 6 }}>Gate Watch can’t see: {gatesBlind.join(', ')}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 130, background: C.panel, border: `1px solid ${C.border2}`, color: C.ink, borderRadius: 10, padding: '12px 19px', fontSize: 13, fontWeight: 600, boxShadow: '0 12px 40px rgba(0,0,0,.18)' }}>{toast}</div>}

      <style>{`
        .gg-openbtn:hover{color:${C.cyan}!important;border-color:rgba(0,113,227,.45)!important;background:rgba(0,113,227,.06)!important}
        @media(max-width:1000px){.gg-hero{grid-template-columns:1fr!important}.gg-hero-mid{border:none!important;padding:0!important;justify-content:flex-start!important}.gg-kpis{grid-template-columns:1fr 1fr!important}.gg-cols,.gg-trio{grid-template-columns:1fr!important}.gg-camwall{grid-template-columns:1fr 1fr!important}.gg-hbars,.gg-bill{grid-template-columns:1fr!important}}
      `}</style>
    </div>
  )
}

const qbtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, padding: '11px 10px', borderRadius: 12, cursor: 'pointer', color: C.ink, background: C.well, border: `1px solid ${C.border2}` }
const netrow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, padding: '8px 0', borderBottom: `1px solid ${C.border}` }

export default function DashboardClient({ slug, displayName }: { slug: string; displayName: string }) {
  const [lockActive, setLockActive] = useState(false)
  return (
    <OpsShell slug={slug} displayName={displayName} active="dashboard" lockdown={lockActive}>
      <Inner slug={slug} lockActive={lockActive} setLockActive={setLockActive} />
    </OpsShell>
  )
}
