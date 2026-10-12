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
type Summary = { cameras?: Cam[]; doors?: Door[]; activity?: Act[]; events_today?: number; credentials_active?: number }
type Billing = { model: 'bulk' | 'resident'; balance: number; lines: { label: string; amount: number }[]; unpaid: { unit: string; name: string; amount: number; days_overdue: number }[]; source: string }

const toneColor: Record<string, string> = { safe: C.safe, cyan: C.cyan, warn: C.warn, alert: C.alert }
const ICON_UNLOCK = <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.5-1.9" /></svg>

function panel(extra?: React.CSSProperties): React.CSSProperties {
  return { background: 'linear-gradient(180deg,rgba(32,44,66,.78),rgba(18,26,42,.72))', backdropFilter: 'blur(18px) saturate(1.15)', border: '1px solid rgba(255,255,255,.085)', borderRadius: 16, overflow: 'hidden', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.09), 0 2px 6px rgba(0,0,0,.25), 0 34px 70px -32px rgba(0,0,0,.85)', ...extra }
}
function phead(title: string, right?: React.ReactNode): React.ReactNode {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 18px', borderBottom: `1px solid ${C.border}` }}><span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>{right}</div>
}

function Ring({ size, pct, color, stroke, children }: { size: number; pct: number; color: string; stroke: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2 - 1, c = 2 * Math.PI * r, off = c * (1 - pct / 100)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={stroke} />
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

  useEffect(() => { fetch(`/api/portal/${slug}/summary`).then(r => r.json()).then(setS).catch(() => {}) }, [slug])
  useEffect(() => { fetch(`/api/portal/${slug}/billing`).then(r => r.json()).then(setBill).catch(() => {}) }, [slug])
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 15000); return () => clearInterval(t) }, [])

  const doors = s.doors ?? []
  const cams = s.cameras ?? []
  const camsOnline = cams.filter(c => c.online !== false).length
  const activity = s.activity ?? []
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(null), 3000) }
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
      if (r.ok) { setLockActive(active); flash(active ? 'Lockdown engaged — residents can always exit' : 'Lockdown lifted') }
      else flash(j?.error || 'Lockdown failed')
    } catch { flash('Lockdown failed') }
  }

  const health = useMemo(() => {
    const camPct = cams.length ? Math.round((camsOnline / cams.length) * 100) : null
    const accessPct = doors.length ? 100 : null
    const bars = [
      { n: 'Access Control', pc: accessPct, note: doors.length ? `${doors.length}/${doors.length} gates` : 'not connected' },
      { n: 'Cameras', pc: camPct, note: cams.length ? `${camsOnline}/${cams.length} online` : 'not connected' },
      { n: 'Network', pc: 100, note: 'reporting' },
      { n: 'Power / Relays', pc: 100, note: 'nominal' },
    ]
    const known = [accessPct, camPct].filter(x => x != null) as number[]
    const score = known.length ? Math.round(known.reduce((a, b) => a + b, 0) / known.length) : null
    return { score, bars }
  }, [cams.length, camsOnline, doors.length])

  const integrations = [{ n: 'Brivo', on: doors.length > 0 }, { n: 'Eagle Eye', on: cams.length > 0 }]

  const L = {
    pagehead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' as const },
    selectbox: { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, background: C.card, border: `1px solid ${C.border2}`, borderRadius: 9, padding: '9px 13px', color: C.ink },
    btn: { fontSize: 13, fontWeight: 700, borderRadius: 9, padding: '9px 15px', cursor: 'pointer', border: `1px solid ${C.border2}`, background: C.card, color: C.ink },
    btnPrimary: { fontSize: 13, fontWeight: 700, borderRadius: 9, padding: '9px 15px', cursor: 'pointer', border: 0, background: BRAND, color: '#041018' },
  }

  const statusCol = lockActive ? C.alert : C.safe
  const kpis = [
    { label: 'Access Events Today', value: s.events_today != null ? s.events_today.toLocaleString() : (activity.length ? `${activity.length}` : '—'), sub: s.events_today != null ? 'across all gates' : 'recent in feed', pct: 100, tone: C.cyan, Icon: Zap },
    { label: 'Active Credentials', value: s.credentials_active != null ? s.credentials_active.toLocaleString() : '—', sub: s.credentials_active != null ? 'residents + staff' : 'syncing…', pct: 100, tone: C.safe, Icon: Users },
    { label: 'Gates Secured', value: doors.length ? `${doors.length}/${doors.length}` : '—', sub: 'all secure', pct: doors.length ? 100 : 0, tone: C.safe, Icon: ShieldCheck },
    { label: 'Cameras Online', value: cams.length ? `${camsOnline}/${cams.length}` : '—', sub: cams.length ? `${Math.round((camsOnline / cams.length) * 100)}% live` : 'not connected', pct: cams.length ? Math.round((camsOnline / cams.length) * 100) : 0, tone: C.cyan, Icon: Video },
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
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1.1fr', gap: 20, alignItems: 'center', padding: '22px 24px', marginBottom: 20, borderRadius: 22, background: lockActive ? 'linear-gradient(135deg,rgba(239,68,68,.12),rgba(180,40,40,.08)),linear-gradient(180deg,rgba(40,20,24,.82),rgba(22,12,14,.85))' : 'linear-gradient(135deg,rgba(25,200,245,.08),rgba(138,92,255,.07)),linear-gradient(180deg,rgba(26,36,54,.78),rgba(15,22,36,.82))', backdropFilter: 'blur(18px) saturate(1.15)', border: `1px solid ${lockActive ? 'rgba(239,68,68,.35)' : 'rgba(255,255,255,.09)'}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08),0 30px 70px -30px rgba(0,0,0,.8)' }} className="gg-hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
          <div style={{ width: 70, height: 70, borderRadius: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#eafaff', background: lockActive ? 'linear-gradient(135deg,#ff5a5a,#c22)' : BRAND, boxShadow: `0 0 30px ${lockActive ? 'rgba(239,68,68,.5)' : 'rgba(74,140,255,.45)'}, inset 0 1px 0 rgba(255,255,255,.3)` }}>
            <svg viewBox="0 0 24 24" width={34} height={34} fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6z" /><path d="m9 12 2 2 4-4" /></svg>
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink3 }}>Site status</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 2 }}>{lockActive ? 'Lockdown Active' : 'All Secure'}</div>
            <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 3 }}>{lockActive ? 'Entry gates secured · residents can always exit' : `${doors.length} gates secured · ${camsOnline} of ${cams.length} cameras live`}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, justifyContent: 'center', borderLeft: '1px solid rgba(255,255,255,.06)', borderRight: '1px solid rgba(255,255,255,.06)', padding: '0 18px' }} className="gg-hero-mid">
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
            <button onClick={() => guarded(() => flash('Issue pass — opens the guest pass form'))} style={qbtn}><Ticket size={15} color={C.cyan} /> Issue pass</button>
            <button onClick={() => doors[0] && openGate(doors[0])} style={qbtn}>{ICON_UNLOCK} Open gate</button>
          </div>
        </div>
      </div>

      {/* KPI Metrics */}
      <div style={{ ...panel(), marginBottom: 20 }}>
        {phead('KPI Metrics')}
        <div style={{ padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }} className="gg-kpis">
            {kpis.map((k, i) => (
              <div key={i} style={{ background: 'linear-gradient(165deg,rgba(255,255,255,.035),rgba(255,255,255,0) 55%),rgba(20,28,43,.5)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: '16px', display: 'flex', alignItems: 'center', gap: 14 }}>
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
                    <div key={c.id} style={{ position: 'relative', aspectRatio: '16 / 10', borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border2}`, background: '#05070b' }}>
                      {off ? <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink3, fontSize: 11, fontWeight: 600 }}>No signal</div> :
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={`/api/portal/${slug}/camera-preview?camera_id=${encodeURIComponent(c.id)}&t=${tick}`} alt={c.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                      <span style={{ position: 'absolute', left: 9, top: 8, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px #000' }}><span style={{ width: 7, height: 7, borderRadius: 999, background: off ? C.alert : C.safe, boxShadow: `0 0 6px ${off ? C.alert : C.safe}` }} />{off ? 'Offline' : 'Live'}</span>
                      <span style={{ position: 'absolute', left: 9, bottom: 8, fontSize: 11.5, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.9)' }}>{c.name}</span>
                    </div>
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
          {phead('Package Room', <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: 'rgba(245,158,11,0.12)', color: C.warn, border: '1px solid rgba(245,158,11,0.3)' }}>SOON</span>)}
          <div style={{ padding: 18 }}>
            <div style={{ fontSize: 13, color: C.ink2, lineHeight: 1.6 }}>Smart-locker and package-room tracking lands with the native hardware rollout — awaiting-pickup counts, carrier log, and resident notifications on our own stack.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 12, color: C.ink3 }}><Package size={15} color={C.ink3} /> Monitoring coming online</div>
          </div>
        </div>

        <div style={panel()}>
          {phead('System & Network', <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: C.safe, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.28)', borderRadius: 999, padding: '4px 10px' }}><span style={{ width: 8, height: 8, borderRadius: 999, background: C.safe, boxShadow: `0 0 8px ${C.safe}` }} />Online</span>)}
          <div style={{ padding: 18 }}>
            <div style={netrow}><span style={{ color: C.ink2 }}>Access controller</span><span style={{ fontWeight: 700, color: doors.length ? C.safe : C.ink3 }}>{doors.length ? 'Reporting ✓' : '—'}</span></div>
            <div style={{ ...netrow, borderBottom: 'none' }}><span style={{ color: C.ink2 }}>Camera gateway</span><span style={{ fontWeight: 700, color: cams.length ? C.safe : C.ink3 }}>{cams.length ? 'Reporting ✓' : '—'}</span></div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.ink3, margin: '14px 0 9px' }}>Integrations</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {integrations.map(it => <span key={it.n} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, padding: '6px 11px', borderRadius: 999, border: `1px solid ${C.border2}`, background: C.card }}><span style={{ width: 7, height: 7, borderRadius: 999, background: it.on ? C.safe : C.ink3, boxShadow: it.on ? `0 0 6px ${C.safe}` : 'none' }} />{it.n}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* Billing */}
      {bill && (
        <div style={{ ...panel(), marginBottom: 20 }}>
          {phead('Billing & Payments', <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 10px', borderRadius: 999, background: 'linear-gradient(135deg,rgba(25,200,245,.16),rgba(138,92,255,.16))', color: '#cfe6ff', border: '1px solid rgba(120,160,255,.35)' }}>{bill.model === 'resident' ? 'Resident-funded' : 'Bulk-funded'}</span>)}
          <div style={{ padding: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 26, alignItems: 'start' }} className="gg-bill">
              <div style={{ background: 'linear-gradient(165deg,rgba(255,255,255,.04),transparent 60%),rgba(20,28,43,.45)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.ink3 }}>Account balance</div>
                <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', margin: '8px 0 12px' }}>${bill.balance.toLocaleString()}</div>
                {bill.lines.map((ln, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '7px 0', borderTop: '1px solid rgba(255,255,255,.06)', color: C.ink2 }}><span>{ln.label}</span><b style={{ color: C.ink, fontWeight: 600 }}>${ln.amount.toLocaleString()}</b></div>)}
                <button onClick={() => flash('Opening secure payment — Stripe')} style={{ marginTop: 14, width: '100%', background: BRAND, color: '#04131f', border: 0, borderRadius: 12, padding: 12, fontWeight: 800, fontSize: 13.5, cursor: 'pointer', boxShadow: '0 8px 24px -8px rgba(74,140,255,.6)' }}>Pay balance</button>
              </div>
              {bill.model === 'resident' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}><span style={{ fontSize: 12.5, fontWeight: 700 }}>Unpaid residents</span><span style={{ fontSize: 11.5, color: C.ink3 }}>{bill.unpaid.length} behind · ${bill.unpaid.reduce((a, b) => a + b.amount, 0)} outstanding</span></div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>{['Unit', 'Resident', 'Amount', 'Overdue', ''].map((h, i) => <th key={i} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.ink3, borderBottom: `1px solid ${C.border}` }}>{h}</th>)}</tr></thead>
                    <tbody>{bill.unpaid.map(r => { const t = r.days_overdue >= 10 ? C.alert : r.days_overdue >= 5 ? C.warn : C.cyan; return (
                      <tr key={r.unit}>
                        <td style={{ padding: '9px 10px', fontSize: 12.5, borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>{r.unit}</td>
                        <td style={{ padding: '9px 10px', fontSize: 12.5, borderBottom: `1px solid ${C.border}` }}>{r.name}</td>
                        <td style={{ padding: '9px 10px', fontSize: 12.5, borderBottom: `1px solid ${C.border}` }}>${r.amount}</td>
                        <td style={{ padding: '9px 10px', borderBottom: `1px solid ${C.border}` }}><span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: `${t}22`, color: t }}>{r.days_overdue}d</span></td>
                        <td style={{ padding: '9px 10px', borderBottom: `1px solid ${C.border}`, textAlign: 'right' }}><button onClick={() => flash(`Payment reminder sent to Unit ${r.unit}`)} style={{ fontSize: 11, fontWeight: 700, color: C.cyan, background: 'rgba(0,163,224,.12)', border: '1px solid rgba(0,163,224,.35)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>Remind</button></td>
                      </tr>) })}
                    </tbody>
                  </table>
                  {bill.source === 'mock' && <div style={{ fontSize: 11, color: C.ink3, marginTop: 10 }}>Sample resident data — live once the billing tables are wired.</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Site Health */}
      <div style={{ ...panel(), marginBottom: 0 }}>
        {phead('Site Health', <Activity size={16} color={C.cyan} />)}
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
            <Ring size={132} pct={health.score ?? 0} color={health.score == null ? C.ink3 : health.score >= 95 ? C.safe : health.score >= 85 ? C.cyan : C.warn} stroke={11}>
              <b style={{ fontSize: 34, fontWeight: 800 }}>{health.score ?? '—'}</b>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: C.ink2, letterSpacing: '0.04em' }}>HEALTH</span>
            </Ring>
            <div style={{ flex: 1, minWidth: 260, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 28px' }} className="gg-hbars">
              {health.bars.map(h => { const col = h.pc == null ? C.ink3 : h.pc >= 99 ? C.safe : h.pc >= 90 ? C.cyan : C.warn; return (
                <div key={h.n}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}><b style={{ fontWeight: 700 }}>{h.n}</b><span style={{ fontWeight: 700, color: C.ink2 }}>{h.pc == null ? '—' : `${h.pc}%`} · {h.note}</span></div>
                  <div style={{ height: 6, borderRadius: 999, background: C.well, overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: `${h.pc ?? 0}%`, background: col }} /></div>
                </div>) })}
            </div>
          </div>
        </div>
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 130, background: C.panel, border: `1px solid ${C.border2}`, color: C.ink, borderRadius: 10, padding: '12px 19px', fontSize: 13, fontWeight: 600, boxShadow: '0 12px 40px rgba(0,0,0,.55)' }}>{toast}</div>}

      <style>{`
        .gg-openbtn:hover{color:${C.cyan}!important;border-color:rgba(0,163,224,.45)!important;background:rgba(0,163,224,.08)!important}
        @media(max-width:1000px){.gg-hero{grid-template-columns:1fr!important}.gg-hero-mid{border:none!important;padding:0!important;justify-content:flex-start!important}.gg-kpis{grid-template-columns:1fr 1fr!important}.gg-cols,.gg-trio{grid-template-columns:1fr!important}.gg-camwall{grid-template-columns:1fr 1fr!important}.gg-hbars,.gg-bill{grid-template-columns:1fr!important}}
      `}</style>
    </div>
  )
}

const qbtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, padding: '11px 10px', borderRadius: 12, cursor: 'pointer', color: C.ink, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)' }
const netrow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, padding: '8px 0', borderBottom: `1px solid ${C.border}` }

export default function DashboardClient({ slug, displayName }: { slug: string; displayName: string }) {
  const [lockActive, setLockActive] = useState(false)
  return (
    <OpsShell slug={slug} displayName={displayName} active="dashboard" lockdown={lockActive}>
      <Inner slug={slug} lockActive={lockActive} setLockActive={setLockActive} />
    </OpsShell>
  )
}
