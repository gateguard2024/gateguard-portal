'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { NexusGlassBackButton } from '@/components/nexus/NexusGlassBackButton'
import { type NexusGlyphKind } from '@/components/nexus/NexusGlyphTile'
import { NexusActionCard } from '@/components/nexus/NexusActionCard'
import CustomerSiteFinder from '@/components/nexus/CustomerSiteFinder'
import { SiteDetailDrawer } from '@/components/nexus/OperationsHub'

type CustomersSitesPanel = 'find-customer' | 'find-property' | 'attention' | 'systems' | null

type CustomersSitesCard = {
  id: Exclude<CustomersSitesPanel, null>
  title: string
  subtitle: string
  hex: string
  glyph: NexusGlyphKind
  badge?: string
}

type SearchResult = {
  id: string
  type: 'company' | 'contact' | 'customer' | 'property' | 'site'
  title: string
  subtitle: string
  meta?: string
  href?: string
}

type SimpleDetail = {
  id: string
  type: SearchResult['type']
  title: string
  subtitle: string
  status?: string | null
  details: Array<{ label: string; value: string }>
  actions: Array<{ label: string; href: string }>
}

function rgb(hex: string): string {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '0,200,255'
}

function CustomerSiteCardButton({ card, onClick }: { card: CustomersSitesCard; onClick: () => void }) {
  return (
    <NexusActionCard
      title={card.title}
      subtitle={card.subtitle}
      hex={card.hex}
      glyph={card.glyph}
      badge={card.badge}
      onClick={onClick}
    />
  )
}

function ActionButton({ label, onClick, muted }: { label: string; onClick?: () => void; muted?: boolean }) {
  const displayLabel = muted ? `${label} — Coming Soon` : label
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl px-3 py-3 text-left text-xs font-semibold transition-all hover:-translate-y-0.5 hover:opacity-95 active:translate-y-0"
      style={muted
        ? { background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(0,200,255,0.055))', border: '1px solid rgba(255,255,255,0.22)', color: 'rgba(255,255,255,0.92)', boxShadow: '0 0 16px rgba(0,200,255,0.08), inset 0 1px 0 rgba(255,255,255,0.08)' }
        : { background: 'linear-gradient(135deg, rgba(0,124,255,0.22), rgba(0,200,255,0.10))', border: '1px solid rgba(0,200,255,0.26)', color: '#7dd3fc', boxShadow: '0 0 18px rgba(0,124,255,0.12)' }}
      aria-label={displayLabel}
      title={displayLabel}
    >
      {displayLabel}
    </button>
  )
}

function typeLabel(type: SearchResult['type']): string {
  if (type === 'company') return 'Customer / Company'
  if (type === 'contact') return 'Contact'
  if (type === 'customer') return 'Customer Account'
  if (type === 'property') return 'Property'
  return 'Site'
}

function SimpleOverview({ detail, onOpen }: { detail: SimpleDetail; onOpen: (href: string) => void }) {
  return (
    <div className="mt-4 rounded-3xl p-4" style={{ background: 'rgba(0,200,255,0.075)', border: '1px solid rgba(0,200,255,0.20)', boxShadow: '0 0 28px rgba(0,124,255,0.10)' }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#7dd3fc' }}>Simple Overview</div>
          <div className="mt-1 text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>{detail.title}</div>
          <div className="mt-1 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.56)' }}>{detail.subtitle}</div>
        </div>
        <div className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ background: 'rgba(0,200,255,0.10)', border: '1px solid rgba(0,200,255,0.20)', color: '#7dd3fc', whiteSpace: 'nowrap' }}>
          {detail.status || typeLabel(detail.type)}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {detail.details.length > 0 ? detail.details.map(item => (
          <div key={`${item.label}-${item.value}`} className="rounded-2xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)' }}>{item.label}</div>
            <div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.78)' }}>{item.value}</div>
          </div>
        )) : (
          <div className="rounded-2xl px-3 py-2 text-xs" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.46)' }}>No extra details yet.</div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {detail.actions.map(action => (
          <button key={`${action.label}-${action.href}`} type="button" onClick={() => onOpen(action.href)} className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: action.label.startsWith('Open') ? 'linear-gradient(135deg, #00C8FF, #007CFF)' : 'rgba(255,255,255,0.05)', border: action.label.startsWith('Open') ? '1px solid rgba(0,200,255,0.35)' : '1px solid rgba(255,255,255,0.08)', color: 'white' }}>
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SimpleSearchBox({ placeholder, mode }: { placeholder: string; mode: 'customer' | 'property' | 'all' }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState<SearchResult | null>(null)
  const [detail, setDetail] = useState<SimpleDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [message, setMessage] = useState<string | null>('Type at least 2 characters, then search.')
  const [manageSiteId, setManageSiteId] = useState<string | null>(null)  // opens the full editable site panel (details + connections)

  async function runSearch() {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setSelected(null)
      setDetail(null)
      setMessage('Type at least 2 characters, then search.')
      return
    }

    setLoading(true)
    setMessage(null)
    setSelected(null)
    setDetail(null)

    try {
      const res = await fetch(`/api/nexus/customers-sites/search?mode=${mode}&q=${encodeURIComponent(q)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error(data?.message ?? 'Search failed.')
      const nextResults = Array.isArray(data.results) ? data.results as SearchResult[] : []
      setResults(nextResults)
      setMessage(nextResults.length === 0 ? 'No matches yet. Try a customer name, property name, address, email, or phone.' : null)
    } catch (error) {
      setResults([])
      setMessage(error instanceof Error ? error.message : 'Could not search right now.')
    } finally {
      setLoading(false)
    }
  }

  async function loadDetail(result: SearchResult) {
    setDetailLoading(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/nexus/customers-sites/detail?type=${result.type}&id=${result.id}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error(data?.message ?? 'Could not load overview.')
      setDetail(data.detail as SimpleDetail)
    } catch (error) {
      setDetail(null)
      setMessage(error instanceof Error ? error.message : 'Could not load overview.')
    } finally {
      setDetailLoading(false)
    }
  }

  function selectResult(result: SearchResult) {
    setSelected(result)
    setDetail(null)
  }

  function openHref(href?: string) {
    if (href) router.push(href)
  }

  return (
    <div className="rounded-3xl p-4" style={{ background: 'linear-gradient(180deg, rgba(8,18,34,0.70), rgba(3,9,22,0.48))', border: '1px solid rgba(59,130,246,0.16)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
      <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>Start here</div>
      <p className="mt-2 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.54)' }}>
        Type what you know. Nexus will search the real customer, contact, property, and site records.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') void runSearch() }}
          placeholder={placeholder}
          className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none"
          style={{ background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(0,200,255,0.18)', color: 'rgba(255,255,255,0.88)' }}
        />
        <button type="button" onClick={() => void runSearch()} disabled={loading} className="rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #00C8FF, #007CFF)', color: 'white', boxShadow: '0 0 20px rgba(0,124,255,0.18)' }}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {message && <div className="mt-3 rounded-2xl px-3 py-2 text-[11px]" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)' }}>{message}</div>}

      {results.length > 0 && (
        <div className="mt-4 space-y-2">
          {results.map(result => {
            const isSelected = selected?.id === result.id && selected.type === result.type
            return (
              <button
                key={`${result.type}-${result.id}`}
                type="button"
                onClick={() => selectResult(result)}
                className="w-full rounded-2xl px-3 py-3 text-left transition-all hover:-translate-y-0.5"
                style={{
                  background: isSelected ? 'rgba(0,200,255,0.12)' : 'rgba(0,0,0,0.18)',
                  border: isSelected ? '1px solid rgba(0,200,255,0.34)' : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{result.title}</div>
                    <div className="mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.48)' }}>{result.subtitle}</div>
                    {result.meta && <div className="mt-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.34)' }}>{result.meta}</div>}
                  </div>
                  <div className="rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ background: 'rgba(0,200,255,0.10)', border: '1px solid rgba(0,200,255,0.18)', color: '#7dd3fc', whiteSpace: 'nowrap' }}>{typeLabel(result.type)}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <div className="mt-4 rounded-3xl p-4" style={{ background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.18)' }}>
          <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#7dd3fc' }}>Selected</div>
          <div className="mt-1 text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>{selected.title}</div>
          <div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.52)' }}>{selected.subtitle}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(selected.type === 'site' || selected.type === 'property') && (
              <button type="button" onClick={() => setManageSiteId(selected.id)} className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'linear-gradient(135deg, #00C8FF, #007CFF)', color: 'white' }}>Edit details & connections</button>
            )}
            <button type="button" onClick={() => openHref(selected.href)} className="rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-40" disabled={!selected.href} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.92)' }}>Open full page</button>
            <button type="button" onClick={() => void loadDetail(selected)} className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.62)' }}>{detailLoading ? 'Loading…' : 'See Overview'}</button>
          </div>
        </div>
      )}

      {detail && <SimpleOverview detail={detail} onOpen={openHref} />}

      {/* Full editable site panel (details + per-site Connections) */}
      {manageSiteId && <SiteDetailDrawer id={manageSiteId} onClose={() => setManageSiteId(null)} />}
    </div>
  )
}

function CustomersSitesDetailShell({ title, subtitle, onClose, children, actions }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/68 px-4 py-6 backdrop-blur-sm">
      <div
        className="grid max-h-[86vh] w-full max-w-6xl xl:max-w-none grid-cols-1 gap-4 overflow-hidden rounded-[2rem] p-5 shadow-2xl lg:grid-cols-[1fr_260px]"
        style={{
          background: 'radial-gradient(circle at 18% 0%, rgba(0,124,255,0.16), transparent 32%), linear-gradient(180deg, rgba(8,18,34,0.97), rgba(3,9,22,0.97))',
          border: '1px solid rgba(0,200,255,0.20)',
          boxShadow: '0 30px 100px rgba(0,0,0,0.60), 0 0 58px rgba(0,124,255,0.13), inset 0 1px 0 rgba(255,255,255,0.07)',
          backdropFilter: 'blur(28px)',
        }}
      >
        <div className="min-h-0 overflow-y-auto pr-1">
          <NexusGlassBackButton label="Back to Operations" onClick={onClose} />
          <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(0,200,255,0.82)' }}>Operations</div>
          <h2 className="mt-1 text-2xl font-semibold" style={{ color: 'rgba(255,255,255,0.97)', textShadow: '0 0 18px rgba(0,124,255,0.20)' }}>{title}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.54)' }}>{subtitle}</p>
          <div className="mt-5">{children}</div>
        </div>
        <aside className="rounded-3xl p-4" style={{ background: 'linear-gradient(180deg, rgba(8,18,34,0.68), rgba(3,9,22,0.52))', border: '1px solid rgba(59,130,246,0.15)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
          <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>Actions</div>
          <div className="mt-4 space-y-2">{actions}</div>
        </aside>
      </div>
    </div>
  )
}

export function CustomersSitesSurface() {
  const router = useRouter()
  const [activePanel, setActivePanel] = useState<CustomersSitesPanel>(null)

  const cards: CustomersSitesCard[] = [
    { id: 'find-customer', title: 'Find Customer', subtitle: 'Look up a customer account, contact, billing relationship, or recent work.', hex: '#00C8FF', glyph: 'lead' },
    { id: 'find-property', title: 'Find Property', subtitle: 'Search by property name, address, site, gate, or management company.', hex: '#007CFF', glyph: 'research' },
    { id: 'attention', title: 'Properties Needing Attention', subtitle: 'See properties with open jobs, missing info, billing issues, or follow-ups.', hex: '#FBBF24', glyph: 'activity', badge: 'Review' },
    { id: 'systems', title: 'Property Systems', subtitle: 'Find cameras, access control, network, gates, and site technology.', hex: '#34D399', glyph: 'job-open', badge: 'Systems' },
  ]

  return (
    <section className="mt-9 w-full max-w-5xl">
      <div className="rounded-[2rem] p-5 sm:p-6" style={{ background: 'radial-gradient(circle at 12% 0%, rgba(0,124,255,0.16), transparent 34%), linear-gradient(180deg, rgba(8,18,34,0.78), rgba(3,9,22,0.72))', border: '1px solid rgba(0,200,255,0.18)', boxShadow: '0 28px 90px rgba(0,0,0,0.38), 0 0 46px rgba(0,124,255,0.12), inset 0 1px 0 rgba(255,255,255,0.07)', backdropFilter: 'blur(26px)' }}>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(0,200,255,0.82)' }}>Operations</div><h2 className="mt-1 text-xl font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.97)', textShadow: '0 0 18px rgba(0,124,255,0.22)' }}>Who or what property are we working on?</h2><p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.54)' }}>Find the customer, property, site systems, or anything that needs attention.</p></div><div className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]" style={{ background: 'rgba(0,124,255,0.14)', color: 'rgba(125,229,255,0.96)', border: '1px solid rgba(0,200,255,0.28)', boxShadow: '0 0 18px rgba(0,124,255,0.12)' }}>Site OS</div></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(card => <CustomerSiteCardButton key={card.id} card={card} onClick={() => setActivePanel(card.id)} />)}</div>
        <div className="mt-5 text-[11px]" style={{ color: 'rgba(255,255,255,0.38)' }}>Operations stays simple: find the person, find the property, review what needs attention, or open the site systems.</div>
      </div>

      {activePanel === 'find-customer' && <CustomersSitesDetailShell title="Find Customer" subtitle="Search for the customer first. From there, Nexus can show properties, jobs, billing, documents, and contacts." onClose={() => setActivePanel(null)} actions={<><ActionButton label="Open Customers" onClick={() => router.push('/customers')} /><ActionButton label="Open Billing" onClick={() => router.push('/billing')} muted /><ActionButton label="Open CRM" onClick={() => router.push('/crm')} muted /></>}><CustomerSiteFinder /></CustomersSitesDetailShell>}
      {activePanel === 'find-property' && <CustomersSitesDetailShell title="Find Property" subtitle="Search for the property, site, address, management company, or installed location." onClose={() => setActivePanel(null)} actions={<><ActionButton label="Open Properties" onClick={() => router.push('/sites')} /><ActionButton label="Run ARIA Research" onClick={() => router.push('/aria')} /><ActionButton label="Open Map" onClick={() => router.push('/map')} muted /></>}><SimpleSearchBox mode="property" placeholder="Search property, site, address, management company, or gate" /></CustomersSitesDetailShell>}
      {activePanel === 'attention' && <CustomersSitesDetailShell title="Properties Needing Attention" subtitle="A simple board for properties with open work, missing details, follow-ups, or issues." onClose={() => setActivePanel(null)} actions={<><ActionButton label="Open Jobs" onClick={() => router.push('/maintenance')} /><ActionButton label="Open Renewals" onClick={() => router.push('/renewals')} muted /><ActionButton label="Open Documents" onClick={() => router.push('/documents')} muted /></>}><div className="rounded-3xl p-4" style={{ background: 'linear-gradient(180deg, rgba(8,18,34,0.70), rgba(3,9,22,0.48))', border: '1px solid rgba(251,191,36,0.18)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}><div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>Attention board coming next</div><p className="mt-2 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.54)' }}>This will pull together open jobs, missing contacts, ARIA gaps, billing issues, document expirations, and property follow-ups.</p></div></CustomersSitesDetailShell>}
      {activePanel === 'systems' && <CustomersSitesDetailShell title="Property Systems" subtitle="Find the technology tied to a property: gates, cameras, access control, network, and design files." onClose={() => setActivePanel(null)} actions={<><ActionButton label="Open Access" onClick={() => router.push('/access')} /><ActionButton label="Open Cameras" onClick={() => router.push('/cameras')} /><ActionButton label="Open Network" onClick={() => router.push('/network')} muted /><ActionButton label="Open Floor Plans" onClick={() => router.push('/design/floor-plans')} muted /></>}><SimpleSearchBox mode="property" placeholder="Search property system, camera, gate, access panel, network, or floor plan" /></CustomersSitesDetailShell>}
    </section>
  )
}
