'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ActionFlowSurface } from '@/components/nexus/ActionFlowSurface'
import { NexusGlyphTile, type NexusGlyphKind } from '@/components/nexus/NexusGlyphTile'

type SalesPanel = 'new-lead' | 'work-leads' | 'quotes' | 'aria' | null

type SalesCard = {
  id: Exclude<SalesPanel, null>
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

function SalesCardButton({ card, onClick }: { card: SalesCard; onClick: () => void }) {
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

function SalesDetailShell({ title, subtitle, onClose, children, actions }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode; actions?: React.ReactNode }) {
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
          <button type="button" onClick={onClose} className="mb-4 rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,200,255,0.14)', color: 'rgba(255,255,255,0.62)' }}>← Back to Sales</button>
          <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(0,200,255,0.82)' }}>Sales</div>
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

export function SalesSurface() {
  const router = useRouter()
  const [activePanel, setActivePanel] = useState<SalesPanel>(null)

  const cards: SalesCard[] = [
    {
      id: 'new-lead',
      title: 'Add New Lead',
      subtitle: 'Add someone who called, walked in, came from outbound, or came from the website.',
      hex: '#00C8FF',
      glyph: 'lead',
    },
    {
      id: 'work-leads',
      title: 'Work My Leads',
      subtitle: 'See leads, follow-ups, opportunities, and sales work that need action.',
      hex: '#007CFF',
      glyph: 'pipeline',
    },
    {
      id: 'quotes',
      title: 'Create / Work Quotes',
      subtitle: 'Start a quote, keep working a draft, or review a sent proposal.',
      hex: '#FBBF24',
      glyph: 'quote',
    },
    {
      id: 'aria',
      title: 'Research Property',
      subtitle: 'Use ARIA to learn about a property before calling, pitching, or quoting.',
      hex: '#8B5CF6',
      glyph: 'research',
      badge: 'ARIA',
    },
  ]

  return (
    <section className="mt-9 w-full max-w-5xl">
      <div
        className="rounded-[2rem] p-5 sm:p-6"
        style={{
          background: 'radial-gradient(circle at 12% 0%, rgba(0,124,255,0.18), transparent 34%), linear-gradient(180deg, rgba(8,18,34,0.78), rgba(3,9,22,0.72))',
          border: '1px solid rgba(0,200,255,0.18)',
          boxShadow: '0 28px 90px rgba(0,0,0,0.38), 0 0 46px rgba(0,124,255,0.12), inset 0 1px 0 rgba(255,255,255,0.07)',
          backdropFilter: 'blur(26px)',
        }}
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(0,200,255,0.82)' }}>Sales</div>
            <h2 className="mt-1 text-xl font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.97)', textShadow: '0 0 18px rgba(0,124,255,0.22)' }}>What sales work are we doing?</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.54)' }}>
              Add leads, work follow-ups, build quotes, or research a property.
            </p>
          </div>
          <div className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]" style={{ background: 'rgba(0,124,255,0.14)', color: 'rgba(125,229,255,0.96)', border: '1px solid rgba(0,200,255,0.28)', boxShadow: '0 0 18px rgba(0,124,255,0.12)' }}>Sales OS</div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(card => <SalesCardButton key={card.id} card={card} onClick={() => setActivePanel(card.id)} />)}
        </div>

        <div className="mt-5 text-[11px]" style={{ color: 'rgba(255,255,255,0.38)' }}>
          Sales stays simple: add a lead, work my leads, create or work quotes, or research a property.
        </div>
      </div>

      {activePanel === 'new-lead' && (
        <SalesDetailShell
          title="Add New Lead"
          subtitle="Add the lead first. Details, ARIA, quote, and follow-up come after."
          onClose={() => setActivePanel(null)}
          actions={
            <>
              <ActionButton label="Research Property First" onClick={() => router.push('/aria')} />
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
          title="Work My Leads"
          subtitle="Find open leads, opportunities, and follow-ups that need action."
          onClose={() => setActivePanel(null)}
          actions={
            <>
              <ActionButton label="Search Pipeline" muted />
              <ActionButton label="Research Property" onClick={() => router.push('/aria')} />
              <ActionButton label="Open CRM" onClick={() => router.push('/crm')} muted />
            </>
          }
        >
          <ActionFlowSurface activeTab="opps" />
        </SalesDetailShell>
      )}

      {activePanel === 'quotes' && (
        <SalesDetailShell
          title="Create / Work Quotes"
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
          <div className="rounded-3xl p-4" style={{ background: 'linear-gradient(180deg, rgba(8,18,34,0.70), rgba(3,9,22,0.48))', border: '1px solid rgba(59,130,246,0.16)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
            <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>Quote workflow</div>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.54)' }}>
              The quote builder already exists. This board is the simple sales doorway into proposals, survey imports, and approvals.
            </p>
          </div>
        </SalesDetailShell>
      )}

      {activePanel === 'aria' && (
        <SalesDetailShell
          title="Research Property"
          subtitle="Use ARIA to research the property, management company, contacts, and proptech before outreach."
          onClose={() => setActivePanel(null)}
          actions={
            <>
              <ActionButton label="Launch ARIA" onClick={() => router.push('/aria')} />
              <ActionButton label="Recent Searches" onClick={() => router.push('/aria')} />
              <ActionButton label="Create Lead After Research" muted />
            </>
          }
        >
          <div className="rounded-3xl p-4" style={{ background: 'radial-gradient(circle at 12% 0%, rgba(139,92,246,0.18), transparent 34%), linear-gradient(180deg, rgba(8,18,34,0.70), rgba(3,9,22,0.48))', border: '1px solid rgba(139,92,246,0.24)', boxShadow: '0 0 28px rgba(139,92,246,0.10), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
            <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>ARIA powers property research</div>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.56)' }}>
              ARIA is the paid research engine. For now it opens the ARIA workspace; next we will bring recent searches and create-lead handoff into this glass board.
            </p>
          </div>
        </SalesDetailShell>
      )}
    </section>
  )
}
