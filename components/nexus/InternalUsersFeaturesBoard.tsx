'use client'

import { useCallback, useEffect, useState } from 'react'
import { UserGlassWindow, type UserWindowData } from '@/components/nexus/windows/UserGlassWindow'
import { AddPersonWizard } from '@/components/nexus/windows/AddPersonWizard'

type Tab = 'people' | 'techs' | 'orgs'

type UserRow = { id: string; name: string; email: string | null; role: string | null; org_name: string | null; last_login_at: string | null }
type TechRow = { id: string; name: string; email: string | null; employment_type: string; org_name: string | null; access: string; linked: boolean }
type OrgCategory = 'corporate' | 'dealer' | 'client' | 'unclassified'
type OrgRow = { id: string; name: string; tier: string | null; status: string; email: string | null; kind: OrgCategory }
type Counts = { users: number; techs: number; corporate: number; dealers: number; clients: number; unclassified: number }

const TAB_LABEL: Record<Tab, string> = { people: 'Platform Users', techs: 'Field Techs', orgs: 'Organizations' }
const TAB_COLOR: Record<Tab, string> = { people: '#00C8FF', techs: '#34D399', orgs: '#8B5CF6' }

function Pill({ text, color }: { text: string; color: string }) {
  return <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em]" style={{ background: `${color}1f`, border: `1px solid ${color}44`, color }}>{text}</span>
}

export function InternalUsersFeaturesBoard() {
  const [tab, setTab] = useState<Tab>('people')
  const [users, setUsers] = useState<UserRow[]>([])
  const [techs, setTechs] = useState<TechRow[]>([])
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [counts, setCounts] = useState<Counts>({ users: 0, techs: 0, corporate: 0, dealers: 0, clients: 0, unclassified: 0 })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [userWindow, setUserWindow] = useState<UserWindowData | null>(null)
  const [openUserId, setOpenUserId] = useState<string | null>(null)
  const [userBusy, setUserBusy] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [activating, setActivating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/nexus/internal/users-features')
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error(data?.message ?? 'Could not load users.')
      setUsers(data.users ?? [])
      setTechs(data.techs ?? [])
      setOrgs(data.orgs ?? [])
      setCounts(data.counts ?? { users: 0, techs: 0, corporate: 0, dealers: 0, clients: 0, unclassified: 0 })
      setMessage(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load users.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function openUser(profileId: string) {
    setUserBusy(true); setMessage(null); setOpenUserId(profileId)
    try {
      const res = await fetch(`/api/nexus/internal/user-window/${profileId}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error(data?.message ?? 'Could not open user.')
      setUserWindow(data as UserWindowData)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not open user.')
      setOpenUserId(null)
    } finally {
      setUserBusy(false)
    }
  }

  async function syncLogins() {
    setSyncing(true); setMessage(null)
    try {
      const res = await fetch('/api/admin/sync-profiles', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) throw new Error(data?.error ?? 'Sync failed.')
      setMessage(`Synced ${data.synced} login${data.synced === 1 ? '' : 's'}${data.skipped ? `, skipped ${data.skipped}` : ''}.`)
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sync failed.')
    } finally {
      setSyncing(false)
    }
  }

  // Self-service: stamp the signed-in GateGuard user as a corporate admin.
  // Idempotent; gated server-side to @gateguard.co emails.
  async function activateCorporate() {
    setActivating(true); setMessage(null)
    try {
      const res = await fetch('/api/admin/setup-corporate')
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) throw new Error(data?.error ?? 'Could not activate corporate access.')
      setMessage('✅ Corporate admin access activated for your account. Reloading…')
      setTimeout(() => window.location.reload(), 1200)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not activate corporate access.')
    } finally {
      setActivating(false)
    }
  }

  const tabs: { id: Tab; count: number }[] = [
    { id: 'people', count: counts.users },
    { id: 'techs', count: counts.techs },
    { id: 'orgs', count: orgs.length },
  ]

  // Organization groups, in display order. Unclassified is surfaced (amber) so
  // orgs missing a proper org_tier can be spotted and fixed.
  const orgGroups: [string, OrgCategory, string][] = [
    ['Corporate', 'corporate', '#FBBF24'],
    ['Dealers & Partners', 'dealer', '#8B5CF6'],
    ['Clients', 'client', '#00C8FF'],
    ['Unclassified — needs a tier', 'unclassified', '#F87171'],
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Add a person, then tap a platform user to set role &amp; access.</div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={activateCorporate} disabled={activating} className="rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50" style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.4)', color: 'rgba(125,229,255,0.96)' }} title="GateGuard staff only — sets your account to corporate admin (org_tier=corporate, role=admin). Idempotent.">
            {activating ? 'Activating…' : 'Activate corporate access'}
          </button>
          <button type="button" onClick={syncLogins} disabled={syncing} className="rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)' }}>
            {syncing ? 'Syncing…' : 'Sync logins'}
          </button>
          <button type="button" onClick={() => setShowAdd(true)} className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'linear-gradient(135deg, #8B5CF6, #007CFF)', color: 'white' }}>+ Add Person</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {tabs.map(({ id, count }) => {
          const c = TAB_COLOR[id]
          const active = tab === id
          return (
            <button key={id} type="button" onClick={() => setTab(id)} className="rounded-2xl px-3 py-3 text-left" style={{ background: active ? `${c}1f` : 'rgba(0,0,0,0.18)', border: active ? `1px solid ${c}66` : '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: c }}>{TAB_LABEL[id]}</div>
              <div className="mt-1 text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>{count}</div>
            </button>
          )
        })}
      </div>

      {loading && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)' }}>Loading…</div>}
      {message && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}>{message}</div>}

      {/* People — clickable into the glass editor */}
      {!loading && tab === 'people' && (
        users.length === 0
          ? <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>No portal logins yet. Use “Sync logins” to pull existing accounts, or “+ Add Person”.</div>
          : <div className="space-y-2">
              {users.map(u => {
                const opening = userBusy && openUserId === u.id
                return (
                  <button key={u.id} type="button" onClick={() => openUser(u.id)} className="w-full rounded-2xl px-3 py-3 text-left" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)', opacity: opening ? 0.6 : 1 }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{u.name}</div>
                        <div className="mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.48)' }}>{u.email ?? 'No email'}{u.org_name ? ` · ${u.org_name}` : ''}</div>
                      </div>
                      <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.34)' }}>{u.last_login_at ? `Active ${String(u.last_login_at).slice(0, 10)}` : 'Set access →'}</div>
                    </div>
                  </button>
                )
              })}
            </div>
      )}

      {/* Field techs — display */}
      {!loading && tab === 'techs' && (
        techs.length === 0
          ? <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>No technicians yet. Use “+ Add Person”.</div>
          : <div className="space-y-2">
              {techs.map(t => (
                <div key={t.id} className="rounded-2xl px-3 py-3" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{t.name}</div>
                      <div className="mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.48)' }}>{t.email ?? 'No email'}{t.org_name ? ` · ${t.org_name}` : ''}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Pill text={t.employment_type} color="#34D399" />
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.34)' }}>{t.access === 'portal' ? (t.linked ? 'Login linked' : 'Invite sent') : t.access === 'field_code' ? 'Field code' : 'No login'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
      )}

      {/* Organizations — dealers + clients */}
      {!loading && tab === 'orgs' && (
        <div className="space-y-4">
          {orgGroups.map(([label, kind, c]) => {
            const list = orgs.filter(o => o.kind === kind)
            if (list.length === 0) return null
            return (
            <div key={label}>
              <div className="mb-1.5 text-[10px] uppercase tracking-[0.14em]" style={{ color: c }}>{label} · {list.length}</div>
              {list.length === 0
                ? <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.34)' }}>None.</div>
                : <div className="space-y-2">
                    {list.map(o => (
                      <div key={o.id} className="rounded-2xl px-3 py-3" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{o.name}</div>
                            <div className="mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.48)' }}>{(o.tier ?? '').replace(/_/g, ' ') || 'org'}{o.email ? ` · ${o.email}` : ''}</div>
                          </div>
                          <Pill text={o.status} color={c} />
                        </div>
                      </div>
                    ))}
                  </div>}
            </div>
            )
          })}
        </div>
      )}

      {userWindow && (
        <UserGlassWindow
          data={userWindow}
          onBack={() => { setUserWindow(null); setOpenUserId(null) }}
          onRefresh={async () => { if (openUserId) await openUser(openUserId) }}
        />
      )}

      {showAdd && (
        <AddPersonWizard onClose={() => setShowAdd(false)} onDone={() => { void load() }} />
      )}
    </div>
  )
}
