'use client'

/**
 * /admin/integrations — corporate service health. Shows each account-level
 * integration as LIVE / FAILED / NOT CONNECTED with a live re-check, so when
 * you add a service you can immediately see whether it's actually working.
 */
import { useCallback, useEffect, useState } from 'react'

type Status = 'live' | 'failed' | 'not_configured'
type Check = { key: string; name: string; category: string; status: Status; detail: string; connectPath?: string }

const INK = '#17293e', MUT = '#5a708c', CYAN = '#2f7fb8'
const TONE: Record<Status, { dot: string; label: string; fg: string; bg: string }> = {
  live:           { dot: '#12b886', label: 'Live', fg: '#0f6e56', bg: 'rgba(18,133,95,0.10)' },
  failed:         { dot: '#e24b4a', label: 'Failed', fg: '#a32d2d', bg: 'rgba(220,38,38,0.10)' },
  not_configured: { dot: '#94a3b8', label: 'Not connected', fg: '#475569', bg: 'rgba(100,116,139,0.10)' },
}

export default function IntegrationsHealthPage() {
  const [checks, setChecks] = useState<Check[] | null>(null)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true); setErr(null)
    fetch('/api/admin/integrations/health', { cache: 'no-store' })
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j?.error || 'Failed to load'); return j })
      .then(j => { setChecks(j.checks ?? []); setCheckedAt(j.checkedAt ?? null) })
      .catch(e => setErr(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const card: React.CSSProperties = { background: '#fff', border: '1px solid rgba(70,100,140,0.16)', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 3px rgba(20,40,80,0.06), 0 8px 22px rgba(20,40,80,0.06)' }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: INK, margin: 0 }}>Integrations health</h1>
          <div style={{ fontSize: 13, color: MUT, marginTop: 3 }}>
            Live connection status for account-level services.{checkedAt ? ` Checked ${new Date(checkedAt).toLocaleTimeString()}.` : ''}
          </div>
        </div>
        <button onClick={load} disabled={loading} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid rgba(47,127,184,0.4)', background: '#e2eefb', color: CYAN, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{loading ? 'Checking…' : 'Re-check'}</button>
      </div>

      {err && <div style={{ ...card, marginTop: 16, color: '#a32d2d', borderColor: 'rgba(220,38,38,0.3)' }}>{err}</div>}

      <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
        {loading && !checks && <div style={{ ...card, color: MUT }}>Running live checks…</div>}
        {checks?.map(c => {
          const t = TONE[c.status]
          return (
            <div key={c.key} style={{ ...card, display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: t.dot, flexShrink: 0, boxShadow: c.status === 'live' ? '0 0 8px rgba(18,184,134,0.6)' : 'none' }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: INK }}>{c.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUT }}>{c.category}</span>
                </div>
                <div style={{ fontSize: 12.5, color: MUT, marginTop: 2 }}>{c.detail}</div>
              </div>
              {c.connectPath && c.status !== 'live' && (
                <a href={c.connectPath} style={{ fontSize: 12.5, fontWeight: 700, color: CYAN, textDecoration: 'none', whiteSpace: 'nowrap' }}>Connect ↗</a>
              )}
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.fg, background: t.bg, padding: '5px 10px', borderRadius: 8, whiteSpace: 'nowrap' }}>{t.label}</span>
            </div>
          )
        })}
      </div>

      <div style={{ ...card, marginTop: 16, background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.35)', fontSize: 12.5, color: '#7a4b06' }}>
        <b>If Google keeps dropping:</b> a Google OAuth consent screen left in “Testing” expires refresh tokens after 7 days. Publish the consent screen (Google Cloud Console → OAuth consent screen → Publish app) so Calendar and Gmail stay connected.
      </div>
    </div>
  )
}
