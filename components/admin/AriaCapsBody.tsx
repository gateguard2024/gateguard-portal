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
  const border = '1px solid rgba(0,0,0,0.12)'

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search dealers…"
          className="w-full rounded-md px-3 py-2 text-sm outline-none"
          style={{ background: '#fff', color: '#1D1D1F', border }}
        />
        <button onClick={load} className="rounded-md px-3 py-2 text-sm" style={{ background: '#fff', color: '#3A3A3C', border }}>
          Refresh
        </button>
      </div>

      {err && <div className="mb-3 rounded-md px-3 py-2 text-sm" style={{ background: '#FFECEC', color: '#D70015', border: '1px solid rgba(215,0,21,0.2)' }}>{err}</div>}

      <div className="overflow-hidden rounded-lg" style={{ border, background: '#fff' }}>
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ borderBottom: border }}>
              <th className={cell} style={{ textAlign: 'left', color: '#6E6E73' }}>Dealer</th>
              <th className={cell} style={{ textAlign: 'left', color: '#6E6E73' }}>Tier</th>
              <th className={cell} style={{ textAlign: 'right', color: '#6E6E73' }}>Used (mo)</th>
              <th className={cell} style={{ textAlign: 'left', color: '#6E6E73' }}>Monthly cap</th>
              <th className={cell}></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className={cell} colSpan={5} style={{ color: '#6E6E73' }}>Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td className={cell} colSpan={5} style={{ color: '#6E6E73' }}>No dealers found.</td></tr>
            )}
            {!loading && filtered.map((r) => {
              const val = draft[r.org_id] ?? (r.monthly_limit == null ? '' : String(r.monthly_limit))
              const dirty = draft[r.org_id] !== undefined
              const over = r.monthly_limit != null && r.used >= r.monthly_limit
              return (
                <tr key={r.org_id} style={{ borderTop: border }}>
                  <td className={cell} style={{ color: '#1D1D1F' }}>{r.name}</td>
                  <td className={cell} style={{ color: '#6E6E73' }}>{r.org_tier ?? '—'}</td>
                  <td className={cell} style={{ textAlign: 'right', color: over ? '#D70015' : '#3A3A3C' }}>
                    {r.used}{r.monthly_limit != null ? ` / ${r.monthly_limit}` : ''}
                  </td>
                  <td className={cell}>
                    <input
                      value={val}
                      onChange={(e) => setDraft((d) => ({ ...d, [r.org_id]: e.target.value }))}
                      placeholder="Unlimited"
                      inputMode="numeric"
                      className="w-28 rounded-md px-2 py-1 text-sm outline-none"
                      style={{ background: '#fff', color: '#1D1D1F', border }}
                    />
                  </td>
                  <td className={cell} style={{ textAlign: 'right' }}>
                    <button
                      disabled={!dirty || saving === r.org_id}
                      onClick={() => save(r.org_id)}
                      className="rounded-md px-3 py-1 text-sm"
                      style={{
                        background: dirty ? '#0071E3' : '#F2F2F7',
                        color: dirty ? '#fff' : '#6E6E73',
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
      <p className="mt-3 text-xs" style={{ color: '#6E6E73' }}>
        A save = a new property saved to the Intel DB this month. Re-researching a property already in the DB does not count.
      </p>
    </div>
  )
}
