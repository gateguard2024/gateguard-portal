'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { NexusGlyphTile, type NexusGlyphKind } from '@/components/nexus/NexusGlyphTile'

type CustomersSitesPanel = 'find-customer' | 'find-property' | 'attention' | 'systems' | null

type CustomersSitesCard = {
  id: Exclude<CustomersSitesPanel, null>
  title: string
  subtitle: string
  hex: string
  glyph: NexusGlyphKind
  badge?: string
}

function rgb(hex: string): string {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '0,200,255'
}

function CustomerSiteCardButton({ card, onClick }: { card: CustomersSitesCard; onClick: () => void }) {
  const color = rgb(card.hex)

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative min-h-[138px] overflow-hidden rounded-3xl p-4 text-left transition-all duration-200 hover:-translate-y-1"
      style={{
        background: `radial-gradient(circle at 18% 8%, rgba(${color},0.26), transparent 32%), linear-gradient(145deg, rgba(8,18,34,0.88), rgba(3,9,22,0.78))`,
        border: `1px solid rgba(${color},0.34)`,
        boxShadow: `0 0 26px rgba(${color},0.16), 0 22px 58px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.08)`,
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full" style={{ background: `rgba(${color},0.14)`, filter: 'blur(18px)' }} />
      {card.badge && (
        <div className="absolute right-4 top-4 rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ background: `rgba(${color},0.16)`, border: `1px solid rgba(${color},0.34)`, color: 'rgba(255,255,255,0.86)' }}>
          {card.badge}
        </div>
      )}
      <NexusGlyphTile kind={card.glyph} color={card.hex} />
      <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.96)' }}>{card.title}</div>
      <div className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.56)' }}>{card.subtitle}</div>
      <div className="absolute bottom-4 right-4 text-xs opacity-75 transition-opacity group-hover:opacity-100" style={{ color: card.hex, textShadow: `0 0 14px rgba(${color},0.40)` }}>Open →</div>
    </button>
  )
}

function ActionButton({ label, onClick, muted }: { label: string; onClick?: () => void; muted?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl px-3 py-3 text-left text-xs font-semibold transition-opacity hover:opacity-85"
      style={muted
        ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.50)' }
        : { background: 'linear-gradient(135deg, rgba(0,124,255,0.22), rgba(0,200,255,0.10))', border: '1px solid rgba(0,200,255,0.26)', color: '#7dd3fc', boxShadow: '0 0 18px rgba(0,124,255,0.12)' }}
    >
      {label}
    </button>
  )
}

function SimpleSearchBox({ placeholder }: { placeholder: string }) {
  return (
    <div className="rounded-3xl p-4" style={{ background: 'linear-gradient(180deg, rgba(8,18,34,0.70), rgba(3,9,22,0.48))', border: '1px solid rgba(59,130,246,0.16)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
      <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>Start here</div>
      <p className="mt-2 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.54)' }}>
        Type what you know. Nexus will help find the right customer, property, site, or system.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          placeholder={placeholder}
          className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none"
          style={{ background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(0,200,255,0.18)', color: 'rgba(255,255,255,0.88)' }}
        />
        <button type="button" className="rounded-2xl px-4 py-3 text-sm font-semibold" style={{ background: 'linear-gradient(135deg, #00C8FF, #007CFF)', color: 'white', boxShadow: '0 0 20px rgba(0,124,255,0.18)' }}>
          Search
        </button>
      </div>
    </div>
  )
}

function CustomersSitesDetailShell({ title, subtitle, onClose, children, actions }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/68 px-4 py-6 backdrop-blur-sm">
      <div
        className="grid max-h-[86vh] w-full max-w-6xl grid-cols-1 gap-4 overflow-hidden rounded-[2rem] p-5 shadow-2xl lg:grid-cols-[1fr_260px]"
        style={{
          background: 'radial-gradient(circle at 18% 0%, rgba(0,124,255,0.16), transparent 32%), linear-gradient(180deg, rgba(8,18,34,0.97), rgba(3,9,22,0.97))',
          border: '1px solid rgba(0,200,255,0.20)',
          boxShadow: '0 30px 100px rgba(0,0,0,0.60), 0 0 58px rgba(0,124,255,0.13), inset 0 1px 0 rgba(255,255,255,0.07)',
          backdropFilter: 'blur(28px)',
        }}
      >
        <div className="min-h-0 overflow-y-auto pr-1">
          <button type="button" onClick={onClose} className="mb-4 rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,200,255,0.14)', color: 'rgba(255,255,255,0.62)' }}>← Back to Customers/Sites</button>
          <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(0,200,255,0.82)' }}>Customers/Sites</div>
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
    {
      id: 'find-customer',
      title: 'Find Customer',
      subtitle: 'Look up a customer account, contact, billing relationship, or recent work.',
      hex: '#00C8FF',
      glyph: 'lead',
    },
    {
      id: 'find-property',
      title: 'Find Property',
      subtitle: 'Search by property name, address, site, gate, or management company.',
      hex: '#007CFF',
      glyph: 'research',
    },
    {
      id: 'attention',
      title: 'Properties Needing Attention',
      subtitle: 'See properties with open jobs, missing info, billing issues, or follow-ups.',
      hex: '#FBBF24',
      glyph: 'activity',
      badge: 'Review',
    },
    {
      id: 'systems',
      title: 'Property Systems',
      subtitle: 'Find cameras, access control, network, gates, and site technology.',
      hex: '#34D399',
      glyph: 'job-open',
      badge: 'Systems',
    },
  ]

  return (
    <section className="mt-9 w-full max-w-5xl">
      <div
        className="rounded-[2rem] p-5 sm:p-6"
        style={{
          background: 'radial-gradient(circle at 12% 0%, rgba(0,124,255,0.16), transparent 34%), linear-gradient(180deg, rgba(8,18,34,0.78), rgba(3,9,22,0.72))',
          border: '1px solid rgba(0,200,255,0.18)',
          boxShadow: '0 28px 90px rgba(0,0,0,0.38), 0 0 46px rgba(0,124,255,0.12), inset 0 1px 0 rgba(255,255,255,0.07)',
          backdropFilter: 'blur(26px)',
        }}
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(0,200,255,0.82)' }}>Customers/Sites</div>
            <h2 className="mt-1 text-xl font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.97)', textShadow: '0 0 18px rgba(0,124,255,0.22)' }}>Who or what property are we working on?</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.54)' }}>
              Find the customer, property, site systems, or anything that needs attention.
            </p>
          </div>
          <div className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]" style={{ background: 'rgba(0,124,255,0.14)', color: 'rgba(125,229,255,0.96)', border: '1px solid rgba(0,200,255,0.28)', boxShadow: '0 0 18px rgba(0,124,255,0.12)' }}>Site OS</div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(card => <CustomerSiteCardButton key={card.id} card={card} onClick={() => setActivePanel(card.id)} />)}
        </div>

        <div className="mt-5 text-[11px]" style={{ color: 'rgba(255,255,255,0.38)' }}>
          Customers/Sites stays simple: find the person, find the property, review what needs attention, or open the site systems.
        </div>
      </div>

      {activePanel === 'find-customer' && (
        <CustomersSitesDetailShell
          title="Find Customer"
          subtitle="Search for the customer first. From there, Nexus can show properties, jobs, billing, documents, and contacts."
          onClose={() => setActivePanel(null)}
          actions={
            <>
              <ActionButton label="Open Customers" onClick={() => router.push('/customers')} />
              <ActionButton label="Open Billing" onClick={() => router.push('/billing')} muted />
              <ActionButton label="Open CRM" onClick={() => router.push('/crm')} muted />
            </>
          }
        >
          <SimpleSearchBox placeholder="Search customer, contact, email, company, or phone" />
        </CustomersSitesDetailShell>
      )}

      {activePanel === 'find-property' && (
        <CustomersSitesDetailShell
          title="Find Property"
          subtitle="Search for the property, site, address, management company, or installed location."
          onClose={() => setActivePanel(null)}
          actions={
            <>
              <ActionButton label="Open Properties" onClick={() => router.push('/sites')} />
              <ActionButton label="Run ARIA Research" onClick={() => router.push('/aria')} />
              <ActionButton label="Open Map" onClick={() => router.push('/map')} muted />
            </>
          }
        >
          <SimpleSearchBox placeholder="Search property, site, address, management company, or gate" />
        </CustomersSitesDetailShell>
      )}

      {activePanel === 'attention' && (
        <CustomersSitesDetailShell
          title="Properties Needing Attention"
          subtitle="A simple board for properties with open work, missing details, follow-ups, or issues."
          onClose={() => setActivePanel(null)}
          actions={
            <>
              <ActionButton label="Open Jobs" onClick={() => router.push('/maintenance')} />
              <ActionButton label="Open Renewals" onClick={() => router.push('/renewals')} muted />
              <ActionButton label="Open Documents" onClick={() => router.push('/documents')} muted />
            </>
          }
        >
          <div className="rounded-3xl p-4" style={{ background: 'linear-gradient(180deg, rgba(8,18,34,0.70), rgba(3,9,22,0.48))', border: '1px solid rgba(251,191,36,0.18)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
            <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>Attention board coming next</div>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.54)' }}>
              This will pull together open jobs, missing contacts, ARIA gaps, billing issues, document expirations, and property follow-ups.
            </p>
          </div>
        </CustomersSitesDetailShell>
      )}

      {activePanel === 'systems' && (
        <CustomersSitesDetailShell
          title="Property Systems"
          subtitle="Find the technology tied to a property: gates, cameras, access control, network, and design files."
          onClose={() => setActivePanel(null)}
          actions={
            <>
              <ActionButton label="Open Access" onClick={() => router.push('/access')} />
              <ActionButton label="Open Cameras" onClick={() => router.push('/cameras')} />
              <ActionButton label="Open Network" onClick={() => router.push('/network')} muted />
              <ActionButton label="Open Floor Plans" onClick={() => router.push('/design/floor-plans')} muted />
            </>
          }
        >
          <SimpleSearchBox placeholder="Search property system, camera, gate, access panel, network, or floor plan" />
        </CustomersSitesDetailShell>
      )}
    </section>
  )
}
