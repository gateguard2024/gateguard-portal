'use client'

// Brivo Users — per-site, mirrors Brivo's Users flow.
// Site picker (scoped: corporate=all, dealer=subtree, PM=own) → live list →
// Add User → Suspend/Reactivate. Read is live; writes hit the Brivo API.
import { useCallback, useEffect, useState } from 'react'

type Site = { org_id: string; name: string; brivo_site_id: string }
type BrivoUser = { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; unitNumber: string | null; active: boolean; groupIds: string[] }
type Group = { id: string; name: string }

const inputStyle = { background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.92)' } as const

export function BrivoUsersSurface() {
  const [sites, setSites] = useState<Site[]>([])
  const [siteId, setSiteId] = useState('')
  const [users, setUsers] = useState<BrivoUser[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/brivo/sites')
        const data = await res.json().catch(() => ({}))
        const list: Site[] = data.sites ?? []
        setSites(list)
        if (list[0]) setSiteId(list[0].brivo_site_id)
        else { setLoading(false) }
      } catch { setError('Could not load your Brivo sites.'); setLoading(false) }
    })()
  }, [])

  const loadUsers = useCallback(async (sid: string) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/brivo/users?site_id=${encodeURIComponent(sid)}&groups=1`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Could not load users.')
      setUsers(data.users ?? [])
      setGroups(data.groups ?? [])
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load users.'); setUsers([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (siteId) void loadUsers(siteId) }, [siteId, loadUsers])

  async function toggleSuspend(u: BrivoUser) {
    setBusyId(u.id)
    try {
      const res = await fetch(`/api/brivo/users/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ site_id: siteId, suspended: u.active }) })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error ?? 'Update failed.') }
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, active: !x.active } : x))
    } catch (e) { setError(e instanceof Error ? e.message : 'Update failed.') }
    finally { setBusyId(null) }
  }

  const filtered = query.trim()
    ? users.filter(u => `${u.firstName} ${u.lastName} ${u.email ?? ''} ${u.unitNumber ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
    : users
  const siteName = sites.find(s => s.brivo_site_id === siteId)?.name ?? ''

  return (
    <section className="mt-9 w-full max-w-5xl">
      <div className="rounded-[2rem] p-5 sm:p-6" style={{ background: 'radial-gradient(circle at 12% 0%, rgba(0,124,255,0.18), transparent 34%), linear-gradient(180deg, rgba(8,18,34,0.78), rgba(3,9,22,0.72))', border: '1px solid rgba(0,200,255,0.18)', boxShadow: '0 28px 90px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.07)', backdropFilter: 'blur(26px)' }}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(0,200,255,0.82)' }}>Access · Brivo</div>
            <h2 className="mt-1 text-xl font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.97)' }}>Site users</h2>
            <p className="mt-1 text-[13px]" style={{ color: 'rgba(255,255,255,0.7)' }}>People with access at {siteName || 'your site'}. Add residents/staff and suspend access.</p>
          </div>
          {sites.length > 0 && (
            <button type="button" onClick={() => setAddOpen(true)} className="self-start rounded-full px-4 py-2 text-xs font-semibold" style={{ background: 'rgba(107,126,255,0.22)', border: '1px solid rgba(107,126,255,0.5)', color: '#fff' }}>+ Add User</button>
          )}
        </div>

        {sites.length > 1 && (
          <select value={siteId} onChange={e => setSiteId(e.target.value)} className="mb-4 w-full rounded-xl px-3 py-2 text-sm outline-none sm:max-w-sm" style={inputStyle}>
            {sites.map(s => <option key={s.brivo_site_id} value={s.brivo_site_id} style={{ background: '#0b1424' }}>{s.name}</option>)}
          </select>
        )}

        {sites.length === 0 && !loading && (
          <div className="rounded-2xl p-4 text-sm" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.35)', color: '#fde68a' }}>No Brivo site is connected to your account yet. Once a site is linked, its users appear here.</div>
        )}

        {error && <div className="mb-3 rounded-2xl p-3 text-xs" style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', color: '#fca5a5' }}>{error}</div>}

        {sites.length > 0 && (
          <>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search users by name, email, or unit…" className="mb-3 w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle} />
            {loading ? (
              <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>Loading users…</div>
            ) : (
              <div className="space-y-2">
                {filtered.map(u => (
                  <div key={u.id} className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>{`${u.firstName} ${u.lastName}`.trim() || 'Unnamed'}</span>
                        <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide" style={u.active ? { background: 'rgba(52,211,153,0.14)', color: '#6ee7b7', border: '1px solid rgba(52,211,153,0.35)' } : { background: 'rgba(248,113,113,0.14)', color: '#fca5a5', border: '1px solid rgba(248,113,113,0.35)' }}>{u.active ? 'Active' : 'Suspended'}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[11px]" style={{ color: 'rgba(255,255,255,0.48)' }}>{[u.unitNumber ? `Unit ${u.unitNumber}` : null, u.email, u.phone].filter(Boolean).join(' · ') || 'No contact info'}</div>
                    </div>
                    <button type="button" disabled={busyId === u.id} onClick={() => toggleSuspend(u)} className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50" style={u.active ? { background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', color: '#fca5a5' } : { background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.35)', color: '#6ee7b7' }}>{busyId === u.id ? '…' : u.active ? 'Suspend' : 'Reactivate'}</button>
                  </div>
                ))}
                {filtered.length === 0 && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' }}>{query ? 'No users match your search.' : 'No users at this site yet.'}</div>}
              </div>
            )}
          </>
        )}
      </div>

      {addOpen && <AddBrivoUser siteId={siteId} siteName={siteName} groups={groups} onClose={() => setAddOpen(false)} onAdded={() => { setAddOpen(false); void loadUsers(siteId) }} />}
    </section>
  )
}

function AddBrivoUser({ siteId, siteName, groups, onClose, onAdded }: { siteId: string; siteName: string; groups: Group[]; onClose: () => void; onAdded: () => void }) {
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [email, setEmail] = useState('')
  const [unit, setUnit] = useState('')
  const [groupId, setGroupId] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/brivo/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ site_id: siteId, firstName: first, lastName: last, email, unit, groupId: groupId || null }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d?.error ?? 'Could not add user.')
      onAdded()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not add user.') }
    finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[96] overflow-hidden bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="mx-auto flex h-auto max-h-[calc(100dvh-3rem)] w-full max-w-md flex-col overflow-hidden rounded-[2rem] p-5 shadow-2xl" style={{ background: 'radial-gradient(circle at 16% 0%, rgba(0,124,255,0.16), transparent 34%), linear-gradient(180deg, rgba(8,18,34,0.97), rgba(3,9,22,0.97))', border: '1px solid rgba(0,200,255,0.22)', backdropFilter: 'blur(28px)' }}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(0,200,255,0.82)' }}>Add User</div>
            <h2 className="mt-1 text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.97)' }}>{siteName}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>✕</button>
        </div>
        <div className="space-y-3 overflow-y-auto pr-1">
          {err && <div className="rounded-2xl p-3 text-xs" style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', color: '#fca5a5' }}>{err}</div>}
          <div className="grid grid-cols-2 gap-2">
            <input value={first} onChange={e => setFirst(e.target.value)} placeholder="First name" className="rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle} />
            <input value={last} onChange={e => setLast(e.target.value)} placeholder="Last name" className="rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle} />
          </div>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email (optional)" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle} />
          <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="Unit (optional)" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle} />
          {groups.length > 0 && (
            <label className="block">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.55)' }}>Access group (grants entry)</div>
              <select value={groupId} onChange={e => setGroupId(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle}>
                <option value="" style={{ background: '#0b1424' }}>No group yet</option>
                {groups.map(g => <option key={g.id} value={g.id} style={{ background: '#0b1424' }}>{g.name}</option>)}
              </select>
            </label>
          )}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-2xl px-4 py-2 text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>Cancel</button>
          <button type="button" disabled={busy || !first.trim() || !last.trim()} onClick={submit} className="rounded-2xl px-4 py-2 text-xs font-semibold disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #007CFF, #00C8FF)', color: 'white' }}>{busy ? 'Adding…' : 'Add User'}</button>
        </div>
      </div>
    </div>
  )
}
