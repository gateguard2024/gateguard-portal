'use client'

/**
 * DashboardClient — ops master dashboard: KPI bar, live camera grid (Eagle Eye),
 * gate quick-control hub (Brivo), and the activity/alert stream from site_events.
 * Packages / network / security tiles are placeholders (those modules come later).
 */
import { useEffect, useState } from 'react'
import { OpsShell, useOpsManager, C } from '@/components/portal/ops/OpsShell'
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires
const { DoorOpen, Package, ShieldCheck, Wifi, KeyRound, Video } = require('lucide-react') as any

type Summary = {
  cameras?: { id: string; name: string; online?: boolean | null }[]
  doors?: { id: string; name: string }[]
  activity?: { id: string; label: string; where: string; time: string }[]
}

function card(): React.CSSProperties { return { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 } }

function Inner({ slug }: { slug: string }) {
  const { manager, requireSignIn } = useOpsManager()
  const [s, setS] = useState<Summary>({})
  const [tick, setTick] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => { fetch(`/api/portal/${slug}/summary`).then(r => r.json()).then(setS).catch(() => {}) }, [slug])
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 15000); return () => clearInterval(t) }, [])

  const doors = s.doors ?? []
  const cams = (s.cameras ?? []).slice(0, 4)

  async function openGate(d: { id: string; name: string }) {
    if (!manager) { requireSignIn(); return }
    setBusy(d.id)
    try {
      const r = await fetch(`/api/portal/${slug}/gate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ door_id: d.id, door_name: d.name, action: 'open' }) })
      const j = await r.json().catch(() => ({}))
      setToast(r.ok ? `${d.name} opened` : (j?.error || 'Command failed'))
    } catch { setToast('Command failed') } finally { setBusy(null); setTimeout(() => setToast(null), 3000) }
  }

  const kpis = [
    { label: 'Access gating', value: doors.length ? `${doors.length}/${doors.length} SECURED` : 'No gates linked', Icon: DoorOpen, tone: C.safe },
    { label: 'Package room', value: 'Coming soon', Icon: Package, tone: C.ink2 },
    { label: 'Security', value: manager ? 'Manager on console' : 'View-only', Icon: ShieldCheck, tone: C.cyan },
    { label: 'Network health', value: 'Coming soon', Icon: Wifi, tone: C.ink2 },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {kpis.map((k, i) => (
          <div key={i} style={card()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: k.tone }}><k.Icon size={16} /><span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.ink2 }}>{k.label}</span></div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.ink, marginTop: 8 }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Camera grid */}
        <div style={card()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><Video size={16} color={C.cyan} /><span style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>Live cameras</span></div>
          {cams.length === 0 ? (
            <div style={{ fontSize: 12.5, color: C.ink2, padding: '20px 0', textAlign: 'center' }}>No cameras connected for this site yet.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {cams.map(c => (
                <div key={c.id} style={{ position: 'relative', aspectRatio: '16 / 9', borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}`, background: C.canvas }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/portal/${slug}/camera-preview?camera_id=${encodeURIComponent(c.id)}&t=${tick}`} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', left: 8, bottom: 8, fontSize: 11, fontWeight: 700, color: '#fff', textShadow: '0 1px 2px #000' }}>{c.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gate hub + activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={card()}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, marginBottom: 10 }}>Gates &amp; access</div>
            {doors.length === 0 ? <div style={{ fontSize: 12.5, color: C.ink2 }}>No gates linked for this site.</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {doors.map(d => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: C.safe, flexShrink: 0 }} /><span style={{ fontSize: 13, color: C.ink, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span></div>
                    <button onClick={() => openGate(d)} disabled={busy === d.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: C.cyan, background: 'rgba(0,163,224,0.14)', border: '1px solid rgba(0,163,224,0.4)', borderRadius: 9, padding: '7px 12px', cursor: 'pointer', flexShrink: 0 }}><KeyRound size={13} /> {busy === d.id ? '…' : 'Open 10s'}</button>
                  </div>
                ))}
              </div>
            )}
            {!manager && doors.length > 0 && <div style={{ fontSize: 11, color: C.ink2, marginTop: 8 }}>Sign in with your personal PIN to control gates.</div>}
          </div>

          <div style={card()}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, marginBottom: 10 }}>Activity</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(s.activity ?? []).slice(0, 8).map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12 }}>
                  <span style={{ color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.label}<span style={{ color: C.ink2 }}> · {a.where}</span></span>
                  <span style={{ color: C.ink2, flexShrink: 0 }}>{a.time}</span>
                </div>
              ))}
              {(s.activity ?? []).length === 0 && <div style={{ fontSize: 12.5, color: C.ink2 }}>No recent activity.</div>}
            </div>
          </div>
        </div>
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 130, background: C.surface, border: `1px solid ${C.border}`, color: C.ink, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{toast}</div>}
    </div>
  )
}

export default function DashboardClient({ slug, displayName }: { slug: string; displayName: string }) {
  return <OpsShell slug={slug} displayName={displayName} active="dashboard"><Inner slug={slug} /></OpsShell>
}
