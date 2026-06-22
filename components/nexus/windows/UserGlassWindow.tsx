'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  effectiveAccess, rolePresetAccess, ACCESS_RANK,
  type AccessLevel, type SimpleRole,
} from '@/lib/permissions'

// ── Data shape (matches GET /api/nexus/internal/user-window/[id]) ────────────
type CatalogItem = { key: string; label: string; section_label: string; sort_order: number }
export type UserWindowData = {
  user: {
    id: string; clerk_user_id: string; name: string; email: string
    role: SimpleRole; org_id: string; org_name: string; org_tier: string
    last_login_at: string | null; deactivated?: boolean
  }
  catalog: CatalogItem[]
  orgAccess: Record<string, AccessLevel>
  userOverrides: Record<string, AccessLevel>
  callerCap: Record<string, AccessLevel>
  roles: SimpleRole[]
  systemAccess?: { capabilities: string[]; all_sites: boolean; site_ids: string[] }
  systemCapabilities?: { key: string; label: string; icon: string }[]
  orgSites?: { id: string; name: string }[]
}

const VIOLET = '#8B5CF6'
const ROLE_BLURB: Record<SimpleRole, { title: string; sub: string }> = {
  admin:      { title: 'Admin',      sub: 'Sees everything in the org. Can manage users and access.' },
  supervisor: { title: 'Supervisor', sub: 'Sees everything in the org. Cannot manage users.' },
  user:       { title: 'User',       sub: 'Sees only work assigned to them. No admin tools.' },
}
const LEVEL_LABEL: Record<AccessLevel, string> = { none: 'Hidden', view: 'View', edit: 'Edit' }
const LEVEL_COLOR: Record<AccessLevel, string> = { none: 'rgba(255,255,255,0.30)', view: '#7dd3fc', edit: '#34d399' }
const LEVELS: AccessLevel[] = ['none', 'view', 'edit']

function Section({ title, children, accent = VIOLET }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-3xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>{title}</div>
      {children}
    </div>
  )
}

export function UserGlassWindow({
  data, onBack, onRefresh,
}: {
  data: UserWindowData
  onBack: () => void
  onRefresh?: () => Promise<void> | void
}) {
  const { user, catalog, orgAccess, userOverrides, callerCap } = data
  const [role, setRole] = useState<SimpleRole>(user.role)
  const [busy, setBusy] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  // Move-to-org picker + deactivate (Build 7)
  const [orgs, setOrgs] = useState<{ id: string; name: string; tier_label: string }[]>([])
  const [moveTo, setMoveTo] = useState('')
  // Site Systems access (dealer-admin)
  const sysCaps = data.systemCapabilities ?? []
  const orgSites = data.orgSites ?? []
  const [caps, setCaps] = useState<Set<string>>(new Set(data.systemAccess?.capabilities ?? []))
  const [allSites, setAllSites] = useState<boolean>(data.systemAccess?.all_sites ?? false)
  const [siteIds, setSiteIds] = useState<Set<string>>(new Set(data.systemAccess?.site_ids ?? []))
  async function saveSystems(nextCaps: Set<string>, nextAll: boolean, nextSites: Set<string>) {
    setCaps(nextCaps); setAllSites(nextAll); setSiteIds(nextSites)
    await post({ action: 'set_system_access', capabilities: [...nextCaps], all_sites: nextAll, site_ids: [...nextSites] })
  }
  useEffect(() => {
    void fetch('/api/nexus/internal/assignable-orgs').then(r => r.json()).then(j => setOrgs(j.orgs ?? [])).catch(() => {})
  }, [])

  async function post(body: Record<string, unknown>) {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch(`/api/nexus/internal/user-window/${user.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.success === false) throw new Error(json?.message ?? 'Update failed.')
      if (onRefresh) await onRefresh()
      return true
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Update failed.')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function changeRole(next: SimpleRole) {
    if (next === role) return
    const prev = role
    setRole(next)
    const ok = await post({ action: 'set_role', role: next })
    if (!ok) setRole(prev)
  }

  // Group catalog by section for the access preview.
  const grouped = useMemo(() => {
    const m = new Map<string, CatalogItem[]>()
    for (const c of [...catalog].sort((a, b) => a.sort_order - b.sort_order)) {
      if (!m.has(c.section_label)) m.set(c.section_label, [])
      m.get(c.section_label)!.push(c)
    }
    return Array.from(m.entries())
  }, [catalog])

  function previewLevel(key: string): AccessLevel {
    return effectiveAccess({ role, featureKey: key, orgLevel: orgAccess[key] ?? 'none', userOverride: userOverrides[key] ?? null })
  }

  const visibleCount = catalog.filter(c => previewLevel(c.key) !== 'none').length

  return (
    <div className="fixed inset-0 z-[95] overflow-hidden bg-black/70 px-4 py-4 backdrop-blur-sm sm:py-6">
      <div
        className="mx-auto flex h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] p-5 shadow-2xl sm:h-[calc(100dvh-3rem)]"
        style={{
          background: 'radial-gradient(circle at 16% 0%, rgba(139,92,246,0.16), transparent 34%), linear-gradient(180deg, rgba(8,18,34,0.97), rgba(3,9,22,0.97))',
          border: '1px solid rgba(139,92,246,0.22)',
          boxShadow: '0 30px 100px rgba(0,0,0,0.6), 0 0 58px rgba(139,92,246,0.12), inset 0 1px 0 rgba(255,255,255,0.07)',
          backdropFilter: 'blur(28px)',
        }}
      >
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <button type="button" onClick={onBack} className="mb-2 text-[11px]" style={{ color: 'rgba(196,181,253,0.86)' }}>← Back to Users</button>
            <h2 className="text-2xl font-semibold" style={{ color: 'rgba(255,255,255,0.97)' }}>{user.name}</h2>
            <div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {user.email} · {user.org_name} · {user.org_tier.replace(/_/g, ' ')}
            </div>
          </div>
          <div className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ background: 'rgba(139,92,246,0.16)', border: '1px solid rgba(139,92,246,0.34)', color: '#ddd6fe' }}>
            {ROLE_BLURB[role].title}
          </div>
        </div>

        {msg && <div className="mb-3 rounded-2xl p-3 text-xs" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>{msg}</div>}

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Role picker */}
          <Section title="Job / Role">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {data.roles.map(r => {
                const active = role === r
                return (
                  <button key={r} type="button" disabled={busy} onClick={() => changeRole(r)}
                    className="rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5 disabled:opacity-60"
                    style={{
                      background: active ? 'rgba(139,92,246,0.16)' : 'rgba(0,0,0,0.18)',
                      border: active ? '1px solid rgba(139,92,246,0.42)' : '1px solid rgba(255,255,255,0.07)',
                    }}>
                    <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>{ROLE_BLURB[r].title}</div>
                    <div className="mt-1 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{ROLE_BLURB[r].sub}</div>
                  </button>
                )
              })}
            </div>
          </Section>

          {/* Status & Organization (Build 7) */}
          <Section title="Status & Organization" accent="#fbbf24">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Active / deactivated */}
              <div className="rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.4)' }}>Account status</div>
                <div className="mt-1 text-sm font-semibold" style={{ color: user.deactivated ? '#fca5a5' : '#34d399' }}>{user.deactivated ? 'Deactivated' : 'Active'}</div>
                <button type="button" disabled={busy} onClick={() => post({ action: 'set_active', active: !!user.deactivated })}
                  className="mt-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
                  style={user.deactivated
                    ? { background: 'rgba(52,211,153,0.18)', border: '1px solid rgba(52,211,153,0.4)', color: '#6ee7b7' }
                    : { background: 'rgba(248,113,113,0.14)', border: '1px solid rgba(248,113,113,0.35)', color: '#fca5a5' }}>
                  {user.deactivated ? 'Reactivate user' : 'Deactivate user'}
                </button>
                <div className="mt-1.5 text-[10px]" style={{ color: 'rgba(255,255,255,0.34)' }}>{user.deactivated ? 'They cannot sign in until reactivated.' : 'Blocks sign-in. Reversible at any time.'}</div>
              </div>
              {/* Move org */}
              <div className="rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.4)' }}>Organization</div>
                <div className="mt-1 text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{user.org_name}</div>
                <div className="mt-2 flex gap-1.5">
                  <select value={moveTo} onChange={e => setMoveTo(e.target.value)} className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-[11px] outline-none" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' }}>
                    <option value="">Move to…</option>
                    {orgs.filter(o => o.id !== user.org_id).map(o => <option key={o.id} value={o.id}>{o.name} ({o.tier_label})</option>)}
                  </select>
                  <button type="button" disabled={busy || !moveTo} onClick={async () => { const ok = await post({ action: 'move_org', dest_org_id: moveTo }); if (ok) setMoveTo('') }}
                    className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-40" style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', color: '#ddd6fe' }}>Move</button>
                </div>
                <div className="mt-1.5 text-[10px]" style={{ color: 'rgba(255,255,255,0.34)' }}>Only organizations in your network are listed.</div>
              </div>
            </div>
          </Section>

          {/* Site Systems access (dealer-admin assigns who can operate what) */}
          {sysCaps.length > 0 && (
            <Section title="Site Systems access" accent="#34d399">
              <div className="mb-3 text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>What this person can operate at your sites. Admins already have everything.</div>
              <div className="flex flex-wrap gap-1.5">
                {sysCaps.map(c => {
                  const on = caps.has(c.key)
                  return (
                    <button key={c.key} type="button" disabled={busy} onClick={() => { const n = new Set(caps); if (on) n.delete(c.key); else n.add(c.key); void saveSystems(n, allSites, siteIds) }}
                      className="rounded-full px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50"
                      style={{ background: on ? 'rgba(52,211,153,0.18)' : 'rgba(255,255,255,0.05)', border: `1px solid ${on ? 'rgba(52,211,153,0.45)' : 'rgba(255,255,255,0.12)'}`, color: on ? '#6ee7b7' : 'rgba(255,255,255,0.6)' }}>
                      {c.icon} {c.label}
                    </button>
                  )
                })}
              </div>
              <div className="mt-4 mb-1.5 text-[11px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.4)' }}>Which sites</div>
              <div className="flex gap-1.5">
                <button type="button" disabled={busy} onClick={() => void saveSystems(caps, true, siteIds)} className="rounded-lg px-3 py-1.5 text-[11px] font-semibold" style={{ background: allSites ? 'rgba(52,211,153,0.18)' : 'rgba(255,255,255,0.05)', border: `1px solid ${allSites ? 'rgba(52,211,153,0.45)' : 'rgba(255,255,255,0.12)'}`, color: allSites ? '#6ee7b7' : 'rgba(255,255,255,0.6)' }}>All our sites</button>
                <button type="button" disabled={busy} onClick={() => void saveSystems(caps, false, siteIds)} className="rounded-lg px-3 py-1.5 text-[11px] font-semibold" style={{ background: !allSites ? 'rgba(52,211,153,0.18)' : 'rgba(255,255,255,0.05)', border: `1px solid ${!allSites ? 'rgba(52,211,153,0.45)' : 'rgba(255,255,255,0.12)'}`, color: !allSites ? '#6ee7b7' : 'rgba(255,255,255,0.6)' }}>Pick sites</button>
              </div>
              {!allSites && (
                <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-xl p-2" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {orgSites.length === 0 ? <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>No sites in this org yet.</div> : orgSites.map(s => {
                    const on = siteIds.has(s.id)
                    return (
                      <button key={s.id} type="button" disabled={busy} onClick={() => { const n = new Set(siteIds); if (on) n.delete(s.id); else n.add(s.id); void saveSystems(caps, false, n) }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px]" style={{ background: on ? 'rgba(52,211,153,0.12)' : 'transparent', color: 'rgba(255,255,255,0.82)' }}>
                        <span style={{ width: 16, height: 16, borderRadius: 4, background: on ? '#34d399' : 'rgba(255,255,255,0.08)', color: '#06241a', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{on ? '✓' : ''}</span>
                        {s.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </Section>
          )}

          {/* Access package preview */}
          <Section title={`What they can see — ${visibleCount} feature${visibleCount === 1 ? '' : 's'}`}>
            <div className="space-y-3">
              {grouped.map(([section, items]) => {
                const shown = items.filter(i => previewLevel(i.key) !== 'none')
                if (shown.length === 0) return null
                return (
                  <div key={section}>
                    <div className="mb-1.5 text-[10px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)' }}>{section}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {shown.map(i => {
                        const lvl = previewLevel(i.key)
                        const overridden = userOverrides[i.key] != null
                        return (
                          <span key={i.key} className="rounded-full px-2.5 py-1 text-[11px]"
                            style={{ background: 'rgba(0,0,0,0.22)', border: `1px solid ${overridden ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`, color: 'rgba(255,255,255,0.78)' }}>
                            {i.label} <span style={{ color: LEVEL_COLOR[lvl] }}>· {LEVEL_LABEL[lvl]}</span>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {visibleCount === 0 && <div className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>This role currently sees nothing — the org may not have access to these features.</div>}
            </div>
          </Section>

          {/* Advanced per-feature tuning */}
          <Section title="Advanced — fine-tune individual features" accent="#7dd3fc">
            <button type="button" onClick={() => setAdvanced(a => !a)} className="mb-3 text-[11px]" style={{ color: '#7dd3fc' }}>
              {advanced ? 'Hide advanced ▲' : 'Show advanced ▼'}
            </button>
            {advanced && (
              <div className="space-y-1.5">
                <div className="mb-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Options above your own access are locked. Leave on “Preset” to follow the role default.
                </div>
                {[...catalog].sort((a, b) => a.sort_order - b.sort_order).map(c => {
                  const cap = callerCap[c.key] ?? 'none'
                  const preset = rolePresetAccess(role, c.key, orgAccess[c.key] ?? 'none')
                  const override = userOverrides[c.key] ?? null
                  return (
                    <div key={c.key} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.16)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="min-w-0">
                        <div className="truncate text-xs" style={{ color: 'rgba(255,255,255,0.8)' }}>{c.label}</div>
                        <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.34)' }}>{c.section_label} · preset {LEVEL_LABEL[preset]}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" disabled={busy} onClick={() => post({ action: 'clear_feature_access', feature_key: c.key })}
                          className="rounded-lg px-2 py-1 text-[10px] disabled:opacity-50"
                          style={{ background: override == null ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: override == null ? '#ddd6fe' : 'rgba(255,255,255,0.5)' }}>
                          Preset
                        </button>
                        {LEVELS.map(lvl => {
                          const locked = ACCESS_RANK[lvl] > ACCESS_RANK[cap]
                          const active = override === lvl
                          return (
                            <button key={lvl} type="button" disabled={busy || locked}
                              onClick={() => post({ action: 'set_feature_access', feature_key: c.key, access_level: lvl })}
                              className="rounded-lg px-2 py-1 text-[10px] disabled:cursor-not-allowed"
                              style={{
                                background: active ? `${LEVEL_COLOR[lvl]}22` : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${active ? LEVEL_COLOR[lvl] : 'rgba(255,255,255,0.08)'}`,
                                color: locked ? 'rgba(255,255,255,0.22)' : active ? LEVEL_COLOR[lvl] : 'rgba(255,255,255,0.55)',
                                opacity: locked ? 0.4 : 1,
                              }}>
                              {LEVEL_LABEL[lvl]}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.34)' }}>{busy ? 'Saving…' : 'Changes save automatically'}</div>
          <button type="button" onClick={onBack} className="rounded-2xl px-4 py-2 text-xs font-semibold" style={{ background: 'linear-gradient(135deg, #8B5CF6, #007CFF)', color: 'white' }}>Done</button>
        </div>
      </div>
    </div>
  )
}
