'use client'

import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type PeopleTab = 'accounts' | 'dealers' | 'contacts'

interface AccountRow { id: string; name?: string; status?: string; tier?: string; created_at?: string; site_count?: number }
interface DealerRow  { id: string; name?: string; tier?: string; onboarding_complete?: boolean; created_at?: string; city?: string; state?: string }
interface ContactRow { id: string; name?: string; company_name?: string; stage?: string; email?: string; phone?: string; created_at?: string }

interface Props { onBack: () => void }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIER_HEX: Record<string, string> = {
  corporate: '#a855f7', master_agent: '#f59e0b', master_dealer: '#6B7EFF',
  sales_dealer: '#34d399', install_dealer: '#0B7285', service_dealer: '#94a3b8',
}
const STAGE_HEX: Record<string, string> = {
  new: '#6B7EFF', contacted: '#fbbf24', qualified: '#34d399',
  proposal_sent: '#0B7285', won: '#10b981', lost: '#f87171',
}

function hexRgb(h: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h)
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '107,126,255'
}

function timeAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 3600)  return `${Math.round(d / 60)}m ago`
  if (d < 86400) return `${Math.round(d / 3600)}h ago`
  return `${Math.round(d / 86400)}d ago`
}

function tierLabel(tier: string): string {
  return tier.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ─── Explorer ─────────────────────────────────────────────────────────────────

export function PeopleExplorer({ onBack }: Props) {
  const [tab,      setTab]     = useState<PeopleTab>('accounts')
  const [accounts, setAccts]   = useState<AccountRow[]>([])
  const [dealers,  setDealers] = useState<DealerRow[]>([])
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [loading,  setLoad]    = useState(true)
  const [search,   setSearch]  = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/accounts?limit=30').then(r => r.json()).catch(() => ({})),
      fetch('/api/admin/dealers?limit=30').then(r => r.json()).catch(() => ({})),
      fetch('/api/crm/leads?limit=30').then(r => r.json()).catch(() => ({})),
    ]).then(([a, d, c]) => {
      setAccts(a.accounts ?? a.records ?? a.organizations ?? [])
      setDealers(d.dealers ?? d.records ?? d.organizations ?? [])
      setContacts(c.leads ?? c.records ?? [])
    }).finally(() => setLoad(false))
  }, [])

  const q = search.toLowerCase()
  const filtAccts    = accounts.filter(a => !q || (a.name ?? '').toLowerCase().includes(q))
  const filtDealers  = dealers.filter(d => !q || (d.name ?? '').toLowerCase().includes(q))
  const filtContacts = contacts.filter(c => !q || (c.name ?? '').toLowerCase().includes(q) || (c.company_name ?? '').toLowerCase().includes(q))

  const TABS = [
    { key: 'accounts'  as PeopleTab, label: 'Accounts',  count: accounts.length,  hex: '#6B7EFF' },
    { key: 'dealers'   as PeopleTab, label: 'Network',   count: dealers.length,   hex: '#34d399' },
    { key: 'contacts'  as PeopleTab, label: 'Contacts',  count: contacts.length,  hex: '#fbbf24' },
  ]
  const activeHex = TABS.find(t => t.key === tab)?.hex ?? '#6B7EFF'
  const rgb = hexRgb(activeHex)

  return (
    <>
      <style>{`
        @keyframes nexus-slide-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .nexus-explorer { animation: nexus-slide-up 0.22s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      <div className="nexus-explorer space-y-3">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 transition-colors"
            style={{ color: `rgba(${rgb},0.55)` }}
            onMouseEnter={e => (e.currentTarget.style.color = `rgba(${rgb},0.95)`)}
            onMouseLeave={e => (e.currentTarget.style.color = `rgba(${rgb},0.55)`)}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs font-medium">People</span>
          </button>
          <div className="flex-1 h-px" style={{ background: `rgba(${rgb},0.15)` }} />
          {/* Search */}
          <div className="relative">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="text-[10px] bg-transparent outline-none pl-5 pr-2 py-0.5 rounded-lg"
              style={{
                border: '0.5px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.7)',
                width: 90,
              }}
            />
            <svg className="absolute left-1.5 top-1/2 -translate-y-1/2" width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
              <circle cx="3.5" cy="3.5" r="2.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
              <path d="M6 6l1.5 1.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-[9px] uppercase tracking-widest font-mono px-2 py-0.5 rounded"
            style={{ background: `rgba(${rgb},0.08)`, color: `rgba(${rgb},0.55)`, border: `0.5px solid rgba(${rgb},0.18)` }}>
            Archivist
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5">
          {TABS.map(t => {
            const tRgb = hexRgb(t.hex)
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all"
                style={tab === t.key
                  ? { background: `rgba(${tRgb},0.2)`, border: `0.5px solid rgba(${tRgb},0.45)`, color: t.hex }
                  : { background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.3)' }
                }
              >
                {t.label} ({t.count})
              </button>
            )
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center gap-2 py-6 justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin" />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</p>
          </div>
        ) : tab === 'accounts' ? (
          <div className="space-y-1.5 overflow-y-auto pr-0.5" style={{ maxHeight: '38vh', scrollbarWidth: 'none' }}>
            <div className="grid px-3 py-1.5 rounded-lg gap-2"
              style={{ gridTemplateColumns: '1fr 80px 52px 52px', background: 'rgba(255,255,255,0.03)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
              {['Account', 'Status', 'Sites', 'Added'].map(h => (
                <span key={h} className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>{h}</span>
              ))}
            </div>
            {filtAccts.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.22)' }}>No accounts found</p>
            ) : filtAccts.map(a => {
              const hex2 = a.status === 'active' ? '#34d399' : '#94a3b8'
              const rgb2 = hexRgb(hex2)
              return (
                <div key={a.id} className="grid items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ gridTemplateColumns: '1fr 80px 52px 52px', background: 'rgba(255,255,255,0.025)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{a.name ?? '—'}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                    style={{ background: `rgba(${rgb2},0.12)`, color: hex2, border: `0.5px solid rgba(${rgb2},0.25)` }}>
                    {a.status ?? 'active'}
                  </span>
                  <span className="text-[10px] font-mono text-center" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {a.site_count ?? '—'}
                  </span>
                  <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.22)' }}>
                    {a.created_at ? timeAgo(a.created_at) : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        ) : tab === 'dealers' ? (
          <div className="space-y-1.5 overflow-y-auto pr-0.5" style={{ maxHeight: '38vh', scrollbarWidth: 'none' }}>
            <div className="grid px-3 py-1.5 rounded-lg gap-2"
              style={{ gridTemplateColumns: '1fr 110px 80px 52px', background: 'rgba(255,255,255,0.03)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
              {['Dealer', 'Tier', 'Onboarding', 'Added'].map(h => (
                <span key={h} className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>{h}</span>
              ))}
            </div>
            {filtDealers.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.22)' }}>No dealers found</p>
            ) : filtDealers.map(d => {
              const tHex = TIER_HEX[d.tier ?? ''] ?? '#6B7EFF'
              const tRgb = hexRgb(tHex)
              return (
                <div key={d.id} className="grid items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ gridTemplateColumns: '1fr 110px 80px 52px', background: 'rgba(255,255,255,0.025)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{d.name ?? '—'}</p>
                    {(d.city || d.state) && <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{[d.city, d.state].filter(Boolean).join(', ')}</p>}
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded"
                    style={{ background: `rgba(${tRgb},0.12)`, color: tHex, border: `0.5px solid rgba(${tRgb},0.25)` }}>
                    {tierLabel(d.tier ?? 'dealer')}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded text-center"
                    style={d.onboarding_complete
                      ? { background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '0.5px solid rgba(52,211,153,0.25)' }
                      : { background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '0.5px solid rgba(251,191,36,0.25)' }
                    }
                  >
                    {d.onboarding_complete ? 'Complete' : 'Pending'}
                  </span>
                  <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.22)' }}>
                    {d.created_at ? timeAgo(d.created_at) : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-1.5 overflow-y-auto pr-0.5" style={{ maxHeight: '38vh', scrollbarWidth: 'none' }}>
            <div className="grid px-3 py-1.5 rounded-lg gap-2"
              style={{ gridTemplateColumns: '1fr 1fr 80px 52px', background: 'rgba(255,255,255,0.03)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
              {['Name', 'Company', 'Stage', 'Added'].map(h => (
                <span key={h} className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>{h}</span>
              ))}
            </div>
            {filtContacts.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.22)' }}>No contacts found</p>
            ) : filtContacts.map(c => {
              const hex2 = STAGE_HEX[c.stage ?? ''] ?? '#6B7EFF'
              const rgb2 = hexRgb(hex2)
              return (
                <div key={c.id} className="grid items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ gridTemplateColumns: '1fr 1fr 80px 52px', background: 'rgba(255,255,255,0.025)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{c.name ?? '—'}</p>
                  <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{c.company_name ?? '—'}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                    style={{ background: `rgba(${rgb2},0.12)`, color: hex2, border: `0.5px solid rgba(${rgb2},0.25)` }}>
                    {(c.stage ?? 'new').replace('_', ' ')}
                  </span>
                  <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.22)' }}>
                    {c.created_at ? timeAgo(c.created_at) : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-0.5" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {tab === 'accounts' ? `${filtAccts.length} accounts` : tab === 'dealers' ? `${filtDealers.length} dealers` : `${filtContacts.length} contacts`}
          </span>
          <span className="text-[9px] uppercase tracking-widest" style={{ color: `rgba(${rgb},0.3)` }}>
            Nexus Archivist · People
          </span>
        </div>
      </div>
    </>
  )
}
