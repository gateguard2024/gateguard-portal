'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { InternalDealerOnboardingBoard } from '@/components/nexus/InternalDealerOnboardingBoard'
import { IntegrationsConsole } from '@/components/nexus/IntegrationsConsole'
import { ProvisioningQueue } from '@/components/nexus/ProvisioningQueue'
import { InternalTrackerBoard } from '@/components/nexus/InternalTrackerBoard'
import { InternalUsersFeaturesBoard } from '@/components/nexus/InternalUsersFeaturesBoard'
import { NexusGlyphTile, type NexusGlyphKind } from '@/components/nexus/NexusGlyphTile'
import { PricingConsoleBody } from '@/components/admin/PricingConsoleBody'
import { CostSheetBody } from '@/components/admin/CostSheetBody'
import { AriaCapsBody } from '@/components/admin/AriaCapsBody'
import { AdminReportConsole } from '@/components/nexus/AdminReportConsole'

// ---- Console tokens (identical to Operations / Sales / My Day steel) ----
const FRAME_STYLE = { background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.05) 0 1px,transparent 1px 4px), linear-gradient(180deg,#5a6c84,#45556a)', border: '1px solid rgba(10,16,24,0.4)', boxShadow: '0 26px 54px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 2px rgba(0,0,0,0.4)' } as const
const TILE_BG = 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#2b3c52,#1e2a3a)'
const TILE_STYLE = { background: TILE_BG, border: '1px solid rgba(140,170,200,0.22)', boxShadow: '0 14px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.14)' } as const
const WELL = 'linear-gradient(180deg,#22303f,#1a2532)'

type InternalPanel = 'tracker' | 'dealer-onboarding' | 'users-features' | 'integrations' | 'provisioning' | 'pricing' | 'costs' | 'aria-caps' | 'playbooks' | 'training' | null

type InternalCard = {
  id: Exclude<InternalPanel, null>
  title: string
  subtitle: string
  accent: string
  glyph: NexusGlyphKind
  badge?: string
}

function SteelCard({ card, onClick }: { card: InternalCard; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex min-h-[168px] flex-col overflow-hidden rounded-2xl p-4 text-left transition-transform duration-200 hover:-translate-y-1"
      style={TILE_STYLE}
    >
      {card.badge && (
        <div className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ background: 'rgba(20,32,44,0.6)', border: `1px solid ${card.accent}55`, color: card.accent }}>{card.badge}</div>
      )}
      <NexusGlyphTile kind={card.glyph} color={card.accent} />
      <div className="text-[15px] font-bold leading-tight" style={{ color: '#eaf2fb' }}>{card.title}</div>
      <div className="mt-1.5 text-[12px] leading-relaxed" style={{ color: '#c3d3e2' }}>{card.subtitle}</div>
      <div className="mt-auto pt-3" style={{ borderTop: '1px solid rgba(140,170,200,0.16)' }}>
        <div className="flex items-center gap-1.5 pt-2.5 text-[12.5px] font-semibold" style={{ color: card.accent }}>
          <span>Open</span>
          <span className="transition-transform duration-200 ease-out group-hover:translate-x-1" aria-hidden="true">→</span>
        </div>
      </div>
    </button>
  )
}

function ActionButton({ label, onClick, muted }: { label: string; onClick?: () => void; muted?: boolean }) {
  const displayLabel = muted ? `${label} — Coming Soon` : label
  return (
    <button
      type="button"
      onClick={muted ? undefined : onClick}
      disabled={muted}
      className="w-full rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      style={muted
        ? { background: '#1a2532', border: '1px solid rgba(140,170,200,0.16)', color: '#9FD8EC' }
        : { background: '#26374a', border: '1px solid rgba(95,184,224,0.32)', color: '#cfe0f0' }}
      aria-label={displayLabel}
      title={muted ? 'Coming soon' : displayLabel}
    >
      {displayLabel}
    </button>
  )
}

function InternalDetailShell({ title, subtitle, onClose, children, actions }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] overflow-hidden bg-black/70 px-4 py-4 backdrop-blur-sm sm:py-6">
      <div
        className="mx-auto grid h-[calc(100dvh-2rem)] w-full max-w-6xl xl:max-w-none grid-cols-1 gap-4 overflow-hidden rounded-[2rem] p-5 shadow-2xl sm:h-[calc(100dvh-3rem)] lg:grid-cols-[1fr_260px]"
        style={FRAME_STYLE}
      >
        <div className="min-h-0 overflow-y-auto rounded-3xl p-4" style={{ background: 'linear-gradient(180deg,#1d2a39,#141d28)', border: '1px solid rgba(140,170,200,0.2)', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <button type="button" onClick={onClose} className="mb-3 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-semibold" style={{ background: '#22303f', border: '1px solid rgba(95,184,224,0.28)', color: '#9FD8EC' }}>← Back to Internal</button>
          <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: '#5FB8E0' }}>Internal</div>
          <h2 className="mt-1 text-2xl font-semibold" style={{ color: '#eaf2fb' }}>{title}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: '#c3d3e2' }}>{subtitle}</p>
          <div className="mt-5">{children}</div>
        </div>
        <aside className="min-h-0 overflow-y-auto rounded-3xl p-4" style={{ background: WELL, border: '1px solid rgba(140,170,200,0.18)', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <div className="text-sm font-semibold" style={{ color: '#eaf2fb' }}>Actions</div>
          <div className="mt-4 space-y-2">{actions}</div>
        </aside>
      </div>
    </div>
  )
}

function InternalInfoPanel({ copy }: { copy: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: WELL, border: '1px solid rgba(140,170,200,0.18)' }}>
      <div className="text-sm font-semibold" style={{ color: '#eaf2fb' }}>Internal board</div>
      <p className="mt-2 text-xs leading-relaxed" style={{ color: '#c3d3e2' }}>{copy}</p>
    </div>
  )
}

export function InternalSurface() {
  const router = useRouter()
  const [activePanel, setActivePanel] = useState<InternalPanel>(null)
  const { user } = useUser()
  // Cost is corporate-only — the card is hidden from everyone else, and the
  // /api/admin/costs route refuses non-corporate even if they reach it.
  const isCorporate = (user?.publicMetadata as { org_tier?: string } | undefined)?.org_tier === 'corporate'

  const cards: InternalCard[] = [
    { id: 'tracker', title: 'Tracker', subtitle: 'Open Nexus Tracker work, bugs, build notes, and product tasks.', accent: '#5FB8E0', glyph: 'activity', badge: 'Build' },
    { id: 'dealer-onboarding', title: 'Dealer Onboarding', subtitle: 'Track NDA, agreements, compliance, approval, and live dealer status.', accent: '#FBBF24', glyph: 'priority', badge: 'Corporate' },
    { id: 'users-features', title: 'Users & Features', subtitle: 'Manage platform users, roles, feature access, and settings.', accent: '#9FD8EC', glyph: 'pipeline', badge: 'Admin' },
    { id: 'integrations', title: 'Site Integrations', subtitle: 'Connect each property’s Brivo, Eagle Eye, Shelly & UniFi logins (corporate setup).', accent: '#5FB8E0', glyph: 'job-open', badge: 'Corporate' },
    { id: 'provisioning', title: 'Sites to Provision', subtitle: 'Won deals waiting for a controller — enter the serial and program Brivo.', accent: '#7EE0A8', glyph: 'priority', badge: 'Corporate' },
    { id: 'pricing', title: 'Pricing Console', subtitle: 'Floors, sweet-spot targets, add-on pricing, and new catalog line items.', accent: '#FBBF24', glyph: 'quote', badge: 'Corporate' },
    ...(isCorporate ? [{ id: 'costs', title: 'Gate Guard Costs', subtitle: 'Our true monthly + hardware cost. Corporate only — never shown to dealers.', accent: '#F2637E', glyph: 'quote', badge: 'Corporate' } as InternalCard] : []),
    ...(isCorporate ? [{ id: 'aria-caps', title: 'ARIA Save Caps', subtitle: 'Cap how many properties each dealer can save to the Intel DB per month.', accent: '#9FD8EC', glyph: 'research', badge: 'Corporate' } as InternalCard] : []),
    { id: 'playbooks', title: 'Playbooks', subtitle: 'Find internal process, scripts, SOPs, and operating instructions.', accent: '#8FD3EC', glyph: 'research' },
    { id: 'training', title: 'Training', subtitle: 'Open training, quests, scorecards, and team enablement.', accent: '#7EE0A8', glyph: 'todo' },
  ]

  return (
    <section className="mt-9 w-full max-w-5xl xl:max-w-none px-1">
      <div className="rounded-[2rem] p-5 sm:p-6" style={FRAME_STYLE}>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: '#5FB8E0' }}>Internal</div>
            <h2 className="mt-1 text-xl font-semibold leading-tight" style={{ color: '#eaf2fb' }}>What internal work are we managing?</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: '#c3d3e2' }}>
              Product tracking, platform settings, playbooks, dealer onboarding, and team training live here.
            </p>
          </div>
          <div className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]" style={{ background: 'rgba(20,32,44,0.5)', color: '#9FD8EC', border: '1px solid rgba(95,184,224,0.4)' }}>Admin OS</div>
        </div>

        {/* Command-center report band — real rollup of leads / opportunities / jobs
            + operations, scoped to the admin's whole hierarchy. */}
        <AdminReportConsole onOpenTab={(tab) => window.dispatchEvent(new CustomEvent('nexus:navigate', { detail: tab }))} />

        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: '#5FB8E0' }}>Admin tools</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map(card => <SteelCard key={card.id} card={card} onClick={() => setActivePanel(card.id)} />)}
        </div>

        <div className="mt-5 text-[11px]" style={{ color: '#37485c' }}>
          Internal stays simple: track product work, onboard dealers, manage users and features, find playbooks, or train the team.
        </div>
      </div>

      {activePanel === 'tracker' && (
        <InternalDetailShell title="Tracker" subtitle="Product work, build issues, bugs, and Nexus roadmap tasks." onClose={() => setActivePanel(null)} actions={<><ActionButton label="Open Nexus Tracker" onClick={() => router.push('/tracker')} /><ActionButton label="Open Playbook" muted /></>}>
          <InternalTrackerBoard />
        </InternalDetailShell>
      )}

      {activePanel === 'dealer-onboarding' && (
        <InternalDetailShell title="Dealer Onboarding" subtitle="See what each partner needs before access goes live." onClose={() => setActivePanel(null)} actions={<><ActionButton label="Add Dealer" onClick={() => router.push('/admin/dealers/new')} /><ActionButton label="View All Dealers" onClick={() => router.push('/admin/dealers')} /><ActionButton label="Feature Settings" onClick={() => router.push('/admin/settings/features')} /></>}>
          <InternalDealerOnboardingBoard />
        </InternalDetailShell>
      )}

      {/* "Open Platform Users" (→ /admin/users) was removed from the actions:
          that legacy page cannot create a corporate user (no org picker, no
          corporate option) and left invitees scope-less. The "+ Add Person"
          glass wizard in the board below is the correct path — it stamps
          org_tier and sends the Clerk invite. */}
      {activePanel === 'users-features' && (
        <InternalDetailShell title="Users & Features" subtitle="Users, roles, feature flags, permissions, and platform setup." onClose={() => setActivePanel(null)} actions={<><ActionButton label="Open Feature Settings" onClick={() => router.push('/admin/settings/features')} /><ActionButton label="Open Dealers" onClick={() => router.push('/admin/dealers')} /></>}>
          <InternalUsersFeaturesBoard />
        </InternalDetailShell>
      )}

      {activePanel === 'integrations' && (
        <InternalDetailShell title="Site Integrations" subtitle="Corporate setup: connect each property's Brivo, Eagle Eye, Shelly & UniFi logins. Dealers operate doors/cameras at their sites but never see these credentials." onClose={() => setActivePanel(null)} actions={<><ActionButton label="Customer Portals" onClick={() => router.push('/admin/portals')} /><ActionButton label="Open Operations Hub" onClick={() => router.push('/cmms')} /><ActionButton label="Open Dealers" onClick={() => router.push('/admin/dealers')} /></>}>
          <IntegrationsConsole />
        </InternalDetailShell>
      )}

      {activePanel === 'provisioning' && (
        <InternalDetailShell title="Sites to Provision" subtitle="When a deal is won, Nexus auto-creates the site and pre-fills its doors from the survey. Open one to enter the controller serial and program Brivo." onClose={() => setActivePanel(null)} actions={<><ActionButton label="Open Operations Hub" onClick={() => router.push('/cmms')} /></>}>
          <ProvisioningQueue />
        </InternalDetailShell>
      )}

      {activePanel === 'pricing' && (
        <InternalDetailShell
          title="Pricing Console"
          subtitle="Every service & labor line on one catalog: floor, sweet-spot target, status, and quotability — dealers layer their own margin on top. Every change is audited."
          onClose={() => setActivePanel(null)}
          actions={<>
            <ActionButton label="← Back to Main Dashboard" onClick={() => { window.location.href = '/' }} />
            <ActionButton label="Open Full Page" onClick={() => router.push('/admin/settings/pricing')} />
            <ActionButton label="Dealer Margin View" onClick={() => router.push('/settings/pricing')} />
          </>}
        >
          <PricingConsoleBody />
        </InternalDetailShell>
      )}

      {activePanel === 'costs' && isCorporate && (
        <InternalDetailShell
          title="Gate Guard Costs"
          subtitle="Our true monthly platform cost and one-time install hardware. These drive the calculators' margin math and are never shown to dealers. Step 4 makes them editable and adds the dealer waterfall (our cost + 10% = dealer cost, then suggested retail)."
          onClose={() => setActivePanel(null)}
          actions={<>
            <ActionButton label="← Back to Main Dashboard" onClick={() => { window.location.href = '/' }} />
            <ActionButton label="Open Pricing Console" onClick={() => setActivePanel('pricing')} />
          </>}
        >
          <CostSheetBody />
        </InternalDetailShell>
      )}

      {activePanel === 'aria-caps' && isCorporate && (
        <InternalDetailShell
          title="ARIA Save Caps"
          subtitle="Cap how many new properties each dealer can save to the Intel DB per calendar month. Blank = unlimited. Re-researching a property already saved does not count."
          onClose={() => setActivePanel(null)}
          actions={<><ActionButton label="Open Full Page" onClick={() => router.push('/admin/aria-caps')} /></>}
        >
          <AriaCapsBody />
        </InternalDetailShell>
      )}

      {activePanel === 'playbooks' && (
        <InternalDetailShell title="Playbooks" subtitle="Internal SOPs, scripts, operating instructions, and process guidance." onClose={() => setActivePanel(null)} actions={<><ActionButton label="Open Knowledge Base" onClick={() => router.push('/kb')} /><ActionButton label="Open Playbook" muted /></>}>
          <InternalInfoPanel copy="This board will make playbooks searchable and easy to follow without forcing users into a document maze." />
        </InternalDetailShell>
      )}

      {activePanel === 'training' && (
        <InternalDetailShell title="Training" subtitle="Quests, training, scorecards, and internal team enablement." onClose={() => setActivePanel(null)} actions={<><ActionButton label="Open Training" onClick={() => router.push('/training')} /><ActionButton label="Open Quests" onClick={() => router.push('/quests')} muted /><ActionButton label="Open Scorecard" onClick={() => router.push('/scorecard')} muted /></>}>
          <InternalInfoPanel copy="This board will guide internal and dealer teams through training, quests, scorecards, and enablement steps." />
        </InternalDetailShell>
      )}
    </section>
  )
}
