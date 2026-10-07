'use client'

/**
 * GatesClient — gates & access management: category filters, per-opening control
 * cards (Open 10s / Hold open 1hr / Force close), and a site lockdown control.
 * Control actions require a signed-in manager; destructive ones use press-and-hold.
 * Lockdown secures entry gates only — egress + pedestrian routes always stay open.
 */
import { useEffect, useState } from 'react'
import { OpsShell, useOpsManager, C } from '@/components/portal/ops/OpsShell'
import { HoldButton } from '@/components/portal/ops/HoldButton'
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires
const { KeyRound, Lock, ShieldAlert } = require('lucide-react') as any

type Door = { id: string; name: string }
const EGRESS = /(exit|egress|ped|pedestrian|walk|man\s?gate|ada|emergenc)/i
function card(): React.CSSProperties { return { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 } }

function Inner({ slug }: { slug: string }) {
  const { manager, requireSignIn } = useOpsManager()
  const [doors, setDoors] = useState<Door[]>([])
  const [filter, setFilter] = useState<'all' | 'gates' | 'doors'>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [lockActive, setLockActive] = useState(false)

  useEffect(() => { fetch(`/api/portal/${slug}/summary`).then(r => r.json()).then(j => setDoors(j.doors ?? [])).catch(() => {}) }, [slug])

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(null), 3200) }
  async function cmd(d: Door, action: 'open' | 'hold_open' | 'force_close') {
    if (!manager) { requireSignIn(); return }
    setBusy(`${d.id}:${action}`)
    try {
      const r = await fetch(`/api/portal/${slug}/gate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ door_id: d.id, door_name: d.name, action, minutes: action === 'hold_open' ? 60 : undefined }) })
      const j = await r.json().catch(() => ({}))
      flash(r.ok ? `${d.name}: ${action.replace('_', ' ')} ✓${j.note ? ' (recorded)' : ''}` : (j?.error || 'Command failed'))
    } catch { flash('Command failed') } finally { setBusy(null) }
  }
  async function lockdown(active: boolean) {
    if (!manager) { requireSignIn(); return }
    try {
      const r = await fetch(`/api/portal/${slug}/lockdown`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) })
      const j = await r.json().catch(() => ({}))
      if (r.ok) { setLockActive(active); flash(active ? `Lockdown engaged — ${(j.affected || []).length} gate(s); egress stays open` : 'Lockdown lifted') }
      else flash(j?.error || 'Lockdown failed')
    } catch { flash('Lockdown failed') }
  }

  const shown = doors.filter(d => filter === 'all' ? true : filter === 'gates' ? /gate/i.test(d.name) : !/gate/i.test(d.name))
  const counts = { all: doors.length, gates: doors.filter(d => /gate/i.test(d.name)).length, doors: doors.filter(d => !/gate/i.test(d.name)).length }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Lockdown */}
      <div style={{ ...card(), borderColor: lockActive ? 'rgba(239,68,68,0.5)' : C.border, boxShadow: lockActive ? '0 0 20px 2px rgba(239,68,68,0.25)' : undefined }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldAlert size={18} color={lockActive ? C.alert : C.ink2} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>{lockActive ? 'Lockdown ACTIVE' : 'Site lockdown'}</div>
              <div style={{ fontSize: 11.5, color: C.ink2 }}>Secures entry gates only — people can always leave (egress + pedestrian stay open).</div>
            </div>
          </div>
          <div style={{ width: 220 }}>
            {lockActive
              ? <HoldButton tone="cyan" label="Hold to lift lockdown" holdingLabel="Lifting…" onConfirm={() => lockdown(false)} />
              : <HoldButton tone="alert" label="Hold to engage lockdown" holdingLabel="Engaging…" onConfirm={() => lockdown(true)} disabled={!manager} title={manager ? undefined : 'Sign in to control'} />}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8 }}>
        {([['all', `All (${counts.all})`], ['gates', `Gates (${counts.gates})`], ['doors', `Doors (${counts.doors})`]] as const).map(([k, lbl]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${filter === k ? 'rgba(0,163,224,0.5)' : C.border}`, background: filter === k ? 'rgba(0,163,224,0.16)' : 'transparent', color: filter === k ? C.cyan : C.ink2 }}>{lbl}</button>
        ))}
      </div>

      {/* Control cards */}
      {shown.length === 0 ? (
        <div style={{ ...card(), textAlign: 'center', color: C.ink2, fontSize: 13 }}>No access points connected for this site yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {shown.map(d => {
            const egress = EGRESS.test(d.name)
            return (
              <div key={d.id} style={card()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{d.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: 'rgba(16,185,129,0.12)', color: C.safe, border: '1px solid rgba(16,185,129,0.3)' }}>SECURED</span>
                </div>
                <button onClick={() => cmd(d, 'open')} disabled={busy === `${d.id}:open`} style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid rgba(0,163,224,0.4)', background: 'rgba(0,163,224,0.14)', color: C.cyan, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}><KeyRound size={14} /> Open (10s)</button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}><HoldButton tone="amber" label="Hold 1 hr" holdingLabel="Holding…" onConfirm={() => cmd(d, 'hold_open')} disabled={!manager} /></div>
                  <div style={{ flex: 1 }}><HoldButton tone="alert" label="Force close" holdingLabel="Closing…" onConfirm={() => cmd(d, 'force_close')} disabled={!manager || egress} title={egress ? 'Egress/pedestrian routes cannot be force-closed' : undefined} /></div>
                </div>
                {egress && <div style={{ fontSize: 10.5, color: C.ink2, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Lock size={11} /> Egress route — never force-closed</div>}
              </div>
            )
          })}
        </div>
      )}
      {!manager && <div style={{ fontSize: 11.5, color: C.ink2 }}>Sign in with your personal PIN (top right) to control gates.</div>}

      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 130, background: C.surface, border: `1px solid ${C.border}`, color: C.ink, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{toast}</div>}
    </div>
  )
}

export default function GatesClient({ slug, displayName }: { slug: string; displayName: string }) {
  return <OpsShell slug={slug} displayName={displayName} active="gates"><Inner slug={slug} /></OpsShell>
}
