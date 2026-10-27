'use client'

/**
 * Site Status — My Day dashboard module (Apple-grade; see docs/DESIGN_LANGUAGE.md).
 * Role-scoped: corporate sees all sites + a dealer filter; dealers see only theirs.
 * Data: GET /api/dashboard/site-status (counts + list from the `sites` table).
 * NOTE: live camera/gate uptime is a follow-up (needs a cached per-site health layer).
 */
import { useCallback, useEffect, useState } from 'react'

// My Day glass palette — matches the other dashboard modules so it pops on the fabric
// backdrop instead of reading as a flat black box.
const C = {
  tile: 'rgba(14,21,33,0.5)', hair: 'rgba(255,255,255,0.09)', hair2: 'rgba(255,255,255,0.06)',
  ink: '#eaf2fb', ink2: '#9fb0c4', ink3: '#6d7f94',
  blue: '#00A3FF', green: '#34D399', orange: '#f59e0b', red: '#f43f5e',
}
const GLASS = {
  background: 'linear-gradient(165deg,rgba(255,255,255,0.045),transparent 55%), linear-gradient(180deg,rgba(32,44,66,0.82),rgba(18,26,42,0.78))',
  backdropFilter: 'blur(18px) saturate(1.15)',
  border: '1px solid rgba(255,255,255,0.09)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.09), 0 2px 6px rgba(0,0,0,0.25), 0 28px 64px -30px rgba(0,0,0,0.85)',
} as const
const HEALTH: Record<string, string> = { ok: C.green, watch: C.orange, down: C.red }

type SiteRow = { id: string; name: string; dealer: string | null; location: string; status: string | null; health: 'ok' | 'watch' | 'down'; units: number | null }
type Data = {
  canPickDealer: boolean
  dealers: { id: string; name: string }[]
  total: number
  counts: { ok: number; watch: number; down: number }
  units: number
  active: number
  prospects: number
  sites: SiteRow[]
}

function Donut({ counts, total }: { counts: { ok: number; watch: number; down: number }; total: number }) {
  const r = 53, circ = 2 * Math.PI * r
  const t = Math.max(1, counts.ok + counts.watch + counts.down)
  const segs = [
    { v: counts.ok, c: C.green }, { v: counts.watch, c: C.orange }, { v: counts.down, c: C.red },
  ]
  let off = 0
  return (
    <div style={{ position: 'relative', width: 122, height: 122 }}>
      <svg viewBox="0 0 122 122" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="61" cy="61" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
        {segs.map((s, i) => {
          const len = (circ * s.v) / t
          const el = <circle key={i} cx="61" cy="61" r={r} fill="none" stroke={s.c} strokeWidth="9" strokeLinecap={i === 0 ? 'round' : 'butt'} strokeDasharray={`${len} ${circ}`} strokeDashoffset={-off} />
          off += len
          return el
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <b style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{total}</b>
        <span style={{ fontSize: 9, color: C.ink3, letterSpacing: '0.1em', marginTop: 3, textTransform: 'uppercase' }}>Sites</span>
      </div>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 12, background: C.tile, border: `1px solid ${C.hair2}`, padding: '15px 17px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontSize: 10.5, color: C.ink2 }}>{label}</div>
      <div style={{ fontSize: 25, fontWeight: 600, marginTop: 8, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

export function SiteStatusModule() {
  const [data, setData] = useState<Data | null>(null)
  const [dealer, setDealer] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (dealerId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/site-status${dealerId ? `?dealer=${dealerId}` : ''}`)
      const d = await res.json()
      if (res.ok && d.success !== false) setData(d)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { void load(dealer) }, [load, dealer])

  const title = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '15px 20px', borderBottom: `1px solid ${C.hair2}` }}>
      <span style={{ fontSize: 14, fontWeight: 600 }}>Site Status</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: C.ink2 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />Live
      </span>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
        {data?.canPickDealer && (
          <select value={dealer} onChange={e => setDealer(e.target.value)}
            style={{ background: C.tile, border: `1px solid ${C.hair}`, borderRadius: 8, padding: '7px 11px', fontSize: 12, fontWeight: 500, color: C.ink, outline: 'none' }}>
            <option value="">All dealers</option>
            {data.dealers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        <a href="/sites" style={{ fontSize: 11.5, color: C.blue, fontWeight: 500, textDecoration: 'none' }}>View all →</a>
      </div>
    </div>
  )

  return (
    <div style={{ ...GLASS, borderRadius: 16, color: C.ink, marginBottom: 20 }}>
      {title}
      {loading && !data ? (
        <div style={{ padding: 28, fontSize: 12.5, color: C.ink2 }}>Loading sites…</div>
      ) : !data || data.total === 0 ? (
        <div style={{ padding: 28, fontSize: 12.5, color: C.ink2 }}>No sites in your scope yet.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr 1fr', gap: 12, padding: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <Donut counts={data.counts} total={data.total} />
              <div style={{ display: 'flex', gap: 14, marginTop: 14 }}>
                {([['ok', 'active', data.counts.ok], ['watch', 'watch', data.counts.watch], ['down', 'inactive', data.counts.down]] as const).map(([k, lbl, v]) => (
                  <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.ink2 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: HEALTH[k] }} />
                    <b style={{ color: C.ink, fontWeight: 600 }}>{v}</b> {lbl}
                  </span>
                ))}
              </div>
            </div>
            <Kpi label="Active sites" value={data.active} />
            <Kpi label="Total units" value={data.units.toLocaleString()} />
            <Kpi label="Prospects" value={data.prospects} />
          </div>
          <div style={{ padding: '2px 20px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 10.5, letterSpacing: '0.02em', color: C.ink3, textTransform: 'uppercase', padding: '12px 0 2px', borderTop: `1px solid ${C.hair2}` }}>
              Needs attention first
            </div>
            {data.sites.map((s, i) => (
              <a key={s.id} href={`/sites/${s.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', textDecoration: 'none', color: 'inherit', borderTop: i > 0 ? `1px solid ${C.hair2}` : 'none' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: HEALTH[s.health] }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: C.ink2, marginTop: 2 }}>{[s.location, s.dealer].filter(Boolean).join(' · ') || '—'}</div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 10.5, color: C.ink3 }}>
                  <b style={{ display: 'block', fontSize: 11, fontWeight: 600, color: HEALTH[s.health], textTransform: 'capitalize' }}>{s.status ?? '—'}</b>
                  {s.units ? `${s.units} units` : ''}
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
