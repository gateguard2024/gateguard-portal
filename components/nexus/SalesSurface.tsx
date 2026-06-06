'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ActionFlowSurface } from '@/components/nexus/ActionFlowSurface'

type SalesPanel = 'new-lead' | 'work-leads' | 'quotes' | 'aria' | null

type SalesCard = {
  id: Exclude<SalesPanel, null>
  title: string
  subtitle: string
  hex: string
  badge?: string
}

function rgb(hex: string): string {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '0,200,255'
}

function SalesCardButton({ card, onClick }: { card: SalesCard; onClick: () => void }) {
  const color = rgb(card.hex)

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative min-h-[132px] overflow-hidden rounded-3xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: `linear-gradient(145deg, rgba(${color},0.18), rgba(255,255,255,0.035))`,
        border: `1px solid rgba(${color},0.30)`,
        boxShadow: `0 0 22px rgba(${color},0.12), 0 18px 50px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.06)`,
        backdropFilter: 'blur(18px)',
      }}
    >
      {card.badge && (
        <div className="absolute right-4 top-4 rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ background: `rgba(${color},0.14)`, border: `1px solid rgba(${color},0.28)`, color: 'rgba(255,255,255,0.82)' }}>
          {card.badge}
        </div>
      )}
      <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-2xl text-sm" style={{ background: `rgba(${color},0.28)`, border: `1px solid rgba(${color},0.38)`, color: 'rgba(255,255,255,0.9)' }} />
      <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>{card.title}</div>
      <div className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.48)' }}>{card.subtitle}</div>
      <div className="absolute bottom-4 right-4 text-xs opacity-70 transition-opacity group-hover:opacity-100" style={{ color: card.hex }}>Open →</div>
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
        ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.48)' }
        : { background: 'rgba(0,200,255,0.10)', border: '1px solid rgba(0,200,255,0.22)', color: '#7dd3fc' }}
    >
      {label}
    </button>
  )
}

function SalesDetailShell({ title, subtitle, onClose, children, actions }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-4 py-6">
      <div
        className="grid max-h-[86vh] w-full max-w-6xl grid-cols-1 gap-4 overflow-hidden rounded-[2rem] p-5 shadow-2xl lg:grid-cols-[1fr_260px]"
        style={{
          background: 'linear-gradient(180deg, rgba(8,18,34,0.96), rgba(5,10,22,0.96))',
          border: '1px solid rgba(0,200,255,0.16)',
          boxShadow: '0 30px 100px rgba(0,0,0,0.55), 0 0 48px rgba(0,200,255,0.10), inset 0 1px 0 rgba(255,255,255,0.06)',
          backdropFilter: 'blur(26px)',
        }}
      >
        <div className="min-h-0 overflow-y-auto pr-1">
          <button type="button" onClick={onClose} className="mb-4 rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.58)' }}>← Back to Sales</button>
          <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(0,200,255,0.78)' }}>Sales</div>
          <h2 className="mt-1 text-2xl font-semibold" style={{ color: 'rgba(255,255,255,0.96)' }}>{title}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.48)' }}>{subtitle}</p>
          <div className="mt-5">{children}</div>
        </div>
        <aside className="rounded-3xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>Actions</div>
          <div className="mt-4 space-y-2">{actions}</div>
        </aside>
      </div>
    </div>
  )
}

export function SalesSurface() {
  const router = useRouter()
  const [activePanel, setActivePanel] = useState<SalesPanel>(null)

  const cards: SalesCard[] = [
    {
      id: 'new-lead',
      title: 'New Lead',
      subtitle: 'Capture a call, walk-in, outbound lead, or website lead.',
      hex: '#00C8FF',
    },
    {
      id: 'work-leads',
      title: 'Work Leads',
      subtitle: 'Open leads, follow-ups, opportunities, and sales search.',
      hex: '#007CFF',
    },
    {
      id: 'quotes',
      title: 'Quotes',
      subtitle: 'Start a proposal, continue drafts, or review sent quotes.',
      hex: '#fbbf24',
    },
    {
      id: 'aria',
      title: 'ARIA Research',
      subtitle: 'Run property intel before calling, pitching, or quoting.',
      hex: '#a855f7',
      badge: 'AI',
    },
  ]

  return (
    <section className="mt-9 w-full max-w-5xl">
      <div
        className="rounded-[2rem] p-5 sm:p-6"
        style={{
          background: 'linear-gradient(180deg, rgba(0,200,255,0.07), rgba(255,255,255,0.022))',
          border: '1px solid rgba(0,200,255,0.14)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.32), 0 0 38px rgba(0,200,255,0.07), inset 0 1px 0 rgba(255,255,255,0.06)',
          backdropFilter: 'blur(24px)',
        }}
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(0,200,255,0.78)' }}>Sales</div>
            <h2 className="mt-1 text-xl font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.96)' }}>What sales work are we doing?</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.48)' }}>
              Leads, opportunities, quotes, surveys, and ARIA research all start here.
            </p>
          </div>
          <div className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]" style={{ background: 'rgba(0,200,255,0.10)', color: 'rgba(125,229,255,0.95)', border: '1px solid rgba(0,200,255,0.24)' }}>Sales OS</div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(card => <SalesCardButton key={card.id} card={card} onClick={() => setActivePanel(card.id)} />)}
        </div>

        <div className="mt-5 text-[11px]" style={{ color: 'rgba(255,255,255,0.32)' }}>
          Sales stays simple: create a lead, work existing pipeline, quote it, or research with ARIA.
        </div>
      </div>

      {activePanel === 'new-lead' && (
        <SalesDetailShell
          title="New Lead"
          subtitle="Capture the lead first. Details, ARIA, quote, and follow-up come after."
          onClose={() => setActivePanel(null)}
          actions={
            <>
              <ActionButton label="Run ARIA First" onClick={() => router.push('/aria')} />
              <ActionButton label="Start Quote" onClick={() => router.push('/quotes/new')} />
              <ActionButton label="Open CRM" onClick={() => router.push('/crm')} muted />
            </>
          }
        >
          <ActionFlowSurface activeTab="opps" />
        </SalesDetailShell>
      )}

      {activePanel === 'work-leads' && (
        <SalesDetailShell
          title="Work Leads"
          subtitle="Find open leads, opportunities, and follow-ups that need action."
          onClose={() => setActivePanel(null)}
          actions={
            <>
              <ActionButton label="Search Pipeline" muted />
              <ActionButton label="Run ARIA" onClick={() => router.push('/aria')} />
              <ActionButton label="Open CRM" onClick={() => router.push('/crm')} muted />
            </>
          }
        >
          <ActionFlowSurface activeTab="opps" />
        </SalesDetailShell>
      )}

      {activePanel === 'quotes' && (
        <SalesDetailShell
          title="Quotes"
          subtitle="Start or continue the proposal path without making users hunt through CRM."
          onClose={() => setActivePanel(null)}
          actions={
            <>
              <ActionButton label="New Quote" onClick={() => router.push('/quotes/new')} />
              <ActionButton label="View Quotes" onClick={() => router.push('/quotes')} />
              <ActionButton label="Import Survey" onClick={() => router.push('/survey')} muted />
            </>
          }
        >
          <div className="rounded-3xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>Quote workflow</div>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.48)' }}>
              The quote builder already exists. This board is the simple sales doorway into proposals, survey imports, and approvals.
            </p>
          </div>
        </SalesDetailShell>
      )}

      {activePanel === 'aria' && (
        <SalesDetailShell
          title="ARIA Research"
          subtitle="Research the property, management company, contacts, and proptech before outreach."
          onClose={() => setActivePanel(null)}
          actions={
            <>
              <ActionButton label="Launch ARIA" onClick={() => router.push('/aria')} />
              <ActionButton label="Recent Searches" onClick={() => router.push('/aria')} />
              <ActionButton label="Create Lead After Research" muted />
            </>
          }
        >
          <div className="rounded-3xl p-4" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.20)' }}>
            <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>ARIA lives inside Sales</div>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.50)' }}>
              ARIA is the paid research engine. For now it opens the ARIA workspace; next we will bring recent searches and create-lead handoff into this glass board.
            </p>
          </div>
        </SalesDetailShell>
      )}
    </section>
  )
}
