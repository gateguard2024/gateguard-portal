'use client'

/**
 * Site Status — My Day dashboard module (Apple-grade; see docs/DESIGN_LANGUAGE.md).
 * Role-scoped: corporate sees all sites + a dealer filter; dealers see only theirs.
 * Data: GET /api/dashboard/site-status (counts + list from the `sites` table).
 * NOTE: live camera/gate uptime is a follow-up (needs a cached per-site health layer).
 */
import { useCallback, useEffect, useState } from 'react'

// Light card palette — matches the new My Day (white cards on the navy fade).
const C = {
  tile: '#F5F6F8', hair: 'rgba(0,0,0,0.12)', hair2: 'rgba(0,0,0,0.08)',
  ink: '#1D1D1F', ink2: '#3A3A3C', ink3: '#6E6E73',
  blue: '#0071E3', green: '#30A14E', orange: '#FF9500', red: '#FF3B30',
}
const GLASS = {
  background: '#FFFFFF',
  boxShadow: '0 1px 2px rgba(10,20,40,0.06), 0 8px 24px rgba(10,20,40,0.08)',
} as const
const HEALTH: Record<string, string> = { ok: C.green, watch: C.orange, down: C.red }
// Darker versions for text, so status words stay readable on white.
const HEALTH_TEXT: Record<string, string> = { ok: '#1A7F37', watch: '#C25E00', down: '#D70015' }

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
        <circle cx="61" cy="61" r={r} fill="none" stroke="#EEF0F4" strokeWidth="9" />
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
      <span style={{ fontSize: 15, fontWeight: 600 }}>Site status</span>
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
    <div style={{ ...GLASS, borderRadius: 16, color: C.ink, marginTop: 20, marginBottom: 20 }}>
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
          <div style={{ padding: '2px 20px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 0 0', borderTop: `1px solid ${C.hair2}`, fontSize: 10.5, letterSpacing: '0.02em', color: C.ink3, textTransform: 'uppercase' }}>
              Needs attention first
              <a href="/sites" style={{ marginLeft: 'auto', color: C.blue, fontSize: 11.5, fontWeight: 500, textTransform: 'none', letterSpacing: 0, textDecoration: 'none' }}>View all sites →</a>
            </div>
            {/* column header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.7fr) 92px 76px 80px 96px 78px', alignItems: 'center', gap: 10, padding: '9px 0 7px', fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.ink3 }}>
              <span>Site</span>
              <span style={{ textAlign: 'center' }}>Cameras</span>
              <span style={{ textAlign: 'center' }}>Access</span>
              <span style={{ textAlign: 'center' }}>Gates</span>
              <span style={{ textAlign: 'center' }}>Packages</span>
              <span style={{ textAlign: 'right' }}>Status</span>
            </div>
            {/* ~4 rows visible, the rest scroll */}
            <div style={{ maxHeight: 192, overflowY: 'auto' }}>
              {data.sites.map((s, i) => (
                <a key={s.id} href={`/sites/${s.id}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.7fr) 92px 76px 80px 96px 78px', alignItems: 'center', gap: 10, padding: '10px 0', textDecoration: 'none', color: 'inherit', borderTop: i > 0 ? `1px solid ${C.hair2}` : 'none' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: HEALTH[s.health] }} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                      <span style={{ display: 'block', fontSize: 11, color: C.ink2, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[s.location, s.dealer].filter(Boolean).join(' · ') || '—'}</span>
                    </span>
                  </span>
                  <span style={{ textAlign: 'center', fontSize: 11.5, color: C.ink3 }}>—</span>
                  <span style={{ textAlign: 'center', fontSize: 11.5, color: C.ink3 }}>—</span>
                  <span style={{ textAlign: 'center', fontSize: 11.5, color: C.ink3 }}>—</span>
                  <span style={{ textAlign: 'center', fontSize: 11.5, color: C.ink3 }}>—</span>
                  <span style={{ textAlign: 'right', fontSize: 11, fontWeight: 600, color: HEALTH_TEXT[s.health], textTransform: 'capitalize' }}>{s.status ?? '—'}</span>
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
