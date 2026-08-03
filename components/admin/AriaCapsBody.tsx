'use client'

import { useEffect, useState } from 'react'

type CapRow = {
  org_id: string
  name: string
  org_tier: string | null
  monthly_limit: number | null   // null = unlimited
  used: number
  remaining: number | null
}

export function AriaCapsBody() {
  const [rows, setRows] = useState<CapRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const load = async () => {
    setLoading(true); setErr(null)
    try {
      const r = await fetch('/api/aria/save-caps', { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed to load')
      setRows(j.orgs ?? [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load')
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const save = async (org_id: string) => {
    setSaving(org_id); setErr(null)
    const raw = draft[org_id]
    try {
      const r = await fetch('/api/aria/save-caps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id, monthly_limit: raw === undefined ? null : raw.trim() }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Save failed')
      setDraft((d) => { const n = { ...d }; delete n[org_id]; return n })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally { setSaving(null) }
  }

  const filtered = rows.filter((r) => r.name?.toLowerCase().includes(q.toLowerCase()))

  const cell = 'px-3 py-2.5 text-sm'
  const border = '1px solid rgba(140,170,200,0.18)'

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search dealers…"
          className="w-full rounded-md px-3 py-2 text-sm outline-none"
          style={{ background: '#0c1420', color: '#e7eef7', border }}
        />
        <button onClick={load} className="rounded-md px-3 py-2 text-sm" style={{ background: '#16232f', color: '#cfe0f0', border }}>
          Refresh
        </button>
      </div>

      {err && <div className="mb-3 rounded-md px-3 py-2 text-sm" style={{ background: 'rgba(220,60,60,0.14)', color: '#ffb4b4', border: '1px solid rgba(220,60,60,0.35)' }}>{err}</div>}

      <div className="overflow-hidden rounded-lg" style={{ border, background: 'linear-gradient(180deg,#141d28,#0e161f)' }}>
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ borderBottom: border }}>
              <th className={cell} style={{ textAlign: 'left', color: '#9fb4c9' }}>Dealer</th>
              <th className={cell} style={{ textAlign: 'left', color: '#9fb4c9' }}>Tier</th>
              <th className={cell} style={{ textAlign: 'right', color: '#9fb4c9' }}>Used (mo)</th>
              <th className={cell} style={{ textAlign: 'left', color: '#9fb4c9' }}>Monthly cap</th>
              <th className={cell}></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className={cell} colSpan={5} style={{ color: '#8fa4b8' }}>Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td className={cell} colSpan={5} style={{ color: '#8fa4b8' }}>No dealers found.</td></tr>
            )}
            {!loading && filtered.map((r) => {
              const val = draft[r.org_id] ?? (r.monthly_limit == null ? '' : String(r.monthly_limit))
              const dirty = draft[r.org_id] !== undefined
              const over = r.monthly_limit != null && r.used >= r.monthly_limit
              return (
                <tr key={r.org_id} style={{ borderTop: border }}>
                  <td className={cell} style={{ color: '#e7eef7' }}>{r.name}</td>
                  <td className={cell} style={{ color: '#8fa4b8' }}>{r.org_tier ?? '—'}</td>
                  <td className={cell} style={{ textAlign: 'right', color: over ? '#ffb4b4' : '#cfe0f0' }}>
                    {r.used}{r.monthly_limit != null ? ` / ${r.monthly_limit}` : ''}
                  </td>
                  <td className={cell}>
                    <input
                      value={val}
                      onChange={(e) => setDraft((d) => ({ ...d, [r.org_id]: e.target.value }))}
                      placeholder="Unlimited"
                      inputMode="numeric"
                      className="w-28 rounded-md px-2 py-1 text-sm outline-none"
                      style={{ background: '#0c1420', color: '#e7eef7', border }}
                    />
                  </td>
                  <td className={cell} style={{ textAlign: 'right' }}>
                    <button
                      disabled={!dirty || saving === r.org_id}
                      onClick={() => save(r.org_id)}
                      className="rounded-md px-3 py-1 text-sm"
                      style={{
                        background: dirty ? '#2b6cb0' : '#1a2532',
                        color: dirty ? '#fff' : '#5f7186',
                        border, cursor: dirty ? 'pointer' : 'default',
                      }}
                    >
                      {saving === r.org_id ? 'Saving…' : 'Save'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs" style={{ color: '#6f8299' }}>
        A save = a new property saved to the Intel DB this month. Re-researching a property already in the DB does not count.
      </p>
    </div>
  )
}
