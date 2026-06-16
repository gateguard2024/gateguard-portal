'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ActionFlowSurface } from '@/components/nexus/ActionFlowSurface'
import { NexusGlassBackButton } from '@/components/nexus/NexusGlassBackButton'
import { type NexusGlyphKind } from '@/components/nexus/NexusGlyphTile'
import { NexusActionCard } from '@/components/nexus/NexusActionCard'
import { NewOpportunityFlow } from '@/components/nexus/NewOpportunityFlow'
import { ExistingOpportunityFlow } from '@/components/nexus/ExistingOpportunityFlow'
import { PricingCalculator } from '@/components/nexus/PricingCalculator'

type GroupId = 'leads' | 'opportunities' | 'quotes' | 'research'
type PanelId = 'new-opp' | 'existing-opp' | 'new-lead-flow' | 'leads-workbench' | 'rough-calc'

type SalesItem = {
  title: string
  subtitle: string
  glyph: NexusGlyphKind
  badge?: string
  href?: string   // route to an existing page
  panel?: PanelId // open a glass panel in-place
  soon?: boolean  // not built yet — show "Coming soon"
}

type SalesGroup = {
  id: GroupId
  title: string
  subtitle: string
  hex: string
  glyph: NexusGlyphKind
  badge?: string
  items: SalesItem[]
}

const GROUPS: SalesGroup[] = [
  {
    id: 'leads', title: 'Leads', subtitle: 'Add and work the people who might buy.', hex: '#00C8FF', glyph: 'lead',
    items: [
      { title: 'New Lead', subtitle: 'Add someone who called, walked in, or came from the website.', glyph: 'lead', panel: 'new-lead-flow' },
      { title: 'Existing Leads', subtitle: 'See and work the leads already in your pipeline.', glyph: 'pipeline', panel: 'leads-workbench' },
      { title: 'Hot Leads', subtitle: 'The leads most likely to close soon.', glyph: 'activity', soon: true },
      { title: 'Cold Leads', subtitle: 'Leads that have gone quiet — time to re-engage.', glyph: 'todo', soon: true },
    ],
  },
  {
    id: 'opportunities', title: 'Opportunities', subtitle: 'The deals you are actively working.', hex: '#007CFF', glyph: 'pipeline',
    items: [
      { title: 'New Opportunity', subtitle: 'Start a deal from an existing lead or customer.', glyph: 'pipeline', panel: 'new-opp' },
      { title: 'Existing Opportunity', subtitle: 'Pick a deal you own or can see, and work it.', glyph: 'pipeline', panel: 'existing-opp' },
      { title: 'Site Surveys', subtitle: 'Capture the property survey behind a deal.', glyph: 'research', href: '/survey' },
      { title: 'Rough Calculator', subtitle: 'Quick monthly pricing from gates, doors, cameras, and units.', glyph: 'quote', panel: 'rough-calc' },
    ],
  },
  {
    id: 'quotes', title: 'Quotes & Proposals', subtitle: 'Build the numbers and the proposal.', hex: '#FBBF24', glyph: 'quote',
    items: [
      { title: 'Bill of Materials', subtitle: 'The equipment and parts list for the job.', glyph: 'quote', href: '/quotes/new' },
      { title: 'Scope of Work', subtitle: 'What will be installed and done on site.', glyph: 'job-open', href: '/survey' },
      { title: 'Proposals', subtitle: 'Create, send, and track customer proposals.', glyph: 'quote', href: '/quotes' },
      { title: 'Closing this Month', subtitle: 'Deals expected to close this month.', glyph: 'activity', soon: true },
    ],
  },
  {
    id: 'research', title: 'Research', subtitle: 'Know the property before you reach out.', hex: '#8B5CF6', glyph: 'research', badge: 'ARIA',
    items: [
      { title: 'ARIA', subtitle: 'Research the property, owner, contacts, and proptech.', glyph: 'research', badge: 'ARIA', href: '/aria' },
    ],
  },
]

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

function SalesDetailShell({ title, subtitle, onClose, children, actions }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] overflow-hidden bg-black/68 px-4 py-4 backdrop-blur-sm sm:py-6">
      <div
        className="mx-auto grid h-[calc(100dvh-2rem)] w-full max-w-6xl xl:max-w-none grid-cols-1 gap-4 overflow-hidden rounded-[2rem] p-5 shadow-2xl sm:h-[calc(100dvh-3rem)] lg:grid-cols-[minmax(0,1fr)_260px]"
        style={{
          background: 'radial-gradient(circle at 18% 0%, rgba(0,124,255,0.16), transparent 32%), linear-gradient(180deg, rgba(8,18,34,0.97), rgba(3,9,22,0.97))',
          border: '1px solid rgba(0,200,255,0.20)',
          boxShadow: '0 30px 100px rgba(0,0,0,0.60), 0 0 58px rgba(0,124,255,0.13), inset 0 1px 0 rgba(255,255,255,0.07)',
          backdropFilter: 'blur(28px)',
        }}
      >
        <div className="min-h-0 overflow-y-auto pr-1" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <NexusGlassBackButton label="Back to Sales" onClick={onClose} />
          <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(0,200,255,0.82)' }}>Sales</div>
          <h2 className="mt-1 text-2xl font-semibold" style={{ color: 'rgba(255,255,255,0.97)', textShadow: '0 0 18px rgba(0,124,255,0.20)' }}>{title}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.54)' }}>{subtitle}</p>
          <div className="mt-5">{children}</div>
        </div>
        <aside className="min-h-0 overflow-y-auto rounded-3xl p-4" style={{ background: 'linear-gradient(180deg, rgba(8,18,34,0.68), rgba(3,9,22,0.52))', border: '1px solid rgba(59,130,246,0.15)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>Actions</div>
          <div className="mt-4 space-y-2">{actions}</div>
        </aside>
      </div>
    </div>
  )
}

const SHELL_STYLE = { background: 'radial-gradient(circle at 12% 0%, rgba(0,124,255,0.18), transparent 34%), linear-gradient(180deg, rgba(8,18,34,0.78), rgba(3,9,22,0.72))', border: '1px solid rgba(0,200,255,0.18)', boxShadow: '0 28px 90px rgba(0,0,0,0.38), 0 0 46px rgba(0,124,255,0.12), inset 0 1px 0 rgba(255,255,255,0.07)', backdropFilter: 'blur(26px)' } as const

export function SalesSurface() {
  const router = useRouter()
  const [activeGroup, setActiveGroup] = useState<GroupId | null>(null)
  const [activePanel, setActivePanel] = useState<PanelId | null>(null)
  const [soon, setSoon] = useState<string | null>(null)

  const group = GROUPS.find(g => g.id === activeGroup) ?? null

  function openItem(item: SalesItem) {
    setSoon(null)
    if (item.soon) { setSoon(`${item.title} is coming soon.`); return }
    if (item.href) { router.push(item.href); return }
    if (item.panel) { setActivePanel(item.panel) }
  }

  return (
    <section className="mt-9 w-full max-w-5xl">
      <div className="rounded-[2rem] p-5 sm:p-6" style={SHELL_STYLE}>
        {group && (
          <button type="button" onClick={() => { setActiveGroup(null); setSoon(null) }} className="mb-4 inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5" style={{ background: 'rgba(0,200,255,0.16)', border: '1px solid rgba(0,200,255,0.45)', color: '#7DE5FF', boxShadow: '0 0 18px rgba(0,124,255,0.12)' }}>
            <span aria-hidden style={{ fontSize: '17px', lineHeight: 1 }}>←</span> Back to all Sales
          </button>
        )}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(0,200,255,0.82)' }}>Sales</div>
            <h2 className="mt-1 text-xl font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.97)', textShadow: '0 0 18px rgba(0,124,255,0.22)' }}>
              {group ? group.title : 'What sales work are we doing?'}
            </h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.82)' }}>
              {group ? group.subtitle : 'Pick a lane: leads, opportunities, quotes & proposals, or research.'}
            </p>
          </div>
          {!group && <div className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]" style={{ background: 'rgba(0,124,255,0.14)', color: 'rgba(125,229,255,0.96)', border: '1px solid rgba(0,200,255,0.28)', boxShadow: '0 0 18px rgba(0,124,255,0.12)' }}>Sales OS</div>}
        </div>

        {soon && (
          <div className="mb-4 rounded-2xl px-4 py-3 text-[13px]" style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.4)', color: '#fde68a' }}>{soon} We'll wire this screen in an upcoming build.</div>
        )}

        {!group && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {GROUPS.map(g => (
              <NexusActionCard key={g.id} title={g.title} subtitle={g.subtitle} hex={g.hex} glyph={g.glyph} badge={g.badge} actionLabel="Open →" onClick={() => { setActiveGroup(g.id); setSoon(null) }} />
            ))}
          </div>
        )}

        {group && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {group.items.map(item => (
              <NexusActionCard
                key={item.title}
                title={item.title}
                subtitle={item.subtitle}
                hex={group.hex}
                glyph={item.glyph}
                badge={item.badge ?? (item.soon ? 'Soon' : undefined)}
                actionLabel={item.soon ? 'Coming soon' : 'Open →'}
                onClick={() => openItem(item)}
              />
            ))}
          </div>
        )}
      </div>

      {(activePanel === 'new-lead-flow' || activePanel === 'leads-workbench') && (
        <SalesDetailShell
          title={activePanel === 'new-lead-flow' ? 'Add New Lead' : 'Your Leads'}
          subtitle={activePanel === 'new-lead-flow' ? 'Capture a new lead — phone, walk-in, outbound, or website.' : 'Work your open leads and follow-ups.'}
          onClose={() => setActivePanel(null)}
          actions={<>
            <ActionButton label="New Quote" onClick={() => router.push('/quotes/new')} />
            <ActionButton label="Research Property" onClick={() => router.push('/aria')} />
            <ActionButton label="Site Survey" onClick={() => router.push('/survey')} />
          </>}
        >
          <ActionFlowSurface activeTab="opps" initialView={activePanel === 'new-lead-flow' ? 'capture-lead' : 'leads'} />
        </SalesDetailShell>
      )}

      {activePanel === 'new-opp' && <NewOpportunityFlow onClose={() => setActivePanel(null)} />}
      {activePanel === 'existing-opp' && <ExistingOpportunityFlow onClose={() => setActivePanel(null)} />}
      {activePanel === 'rough-calc' && (
        <SalesDetailShell
          title="Rough Calculator"
          subtitle="Enter what's on the site — Gate Guard cost + dealer price update live."
          onClose={() => setActivePanel(null)}
          actions={<>
            <ActionButton label="Start a Quote" onClick={() => router.push('/quotes/new')} />
            <ActionButton label="New Opportunity" onClick={() => { setActivePanel('new-opp') }} />
          </>}
        >
          <PricingCalculator />
        </SalesDetailShell>
      )}
    </section>
  )
}
