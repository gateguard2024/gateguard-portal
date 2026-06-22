'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { InternalDealerOnboardingBoard } from '@/components/nexus/InternalDealerOnboardingBoard'
import { IntegrationsConsole } from '@/components/nexus/IntegrationsConsole'
import { ProvisioningQueue } from '@/components/nexus/ProvisioningQueue'
import { InternalTrackerBoard } from '@/components/nexus/InternalTrackerBoard'
import { InternalUsersFeaturesBoard } from '@/components/nexus/InternalUsersFeaturesBoard'
import { NexusGlassBackButton } from '@/components/nexus/NexusGlassBackButton'
import { type NexusGlyphKind } from '@/components/nexus/NexusGlyphTile'
import { NexusActionCard } from '@/components/nexus/NexusActionCard'

type InternalPanel = 'tracker' | 'dealer-onboarding' | 'users-features' | 'integrations' | 'provisioning' | 'playbooks' | 'training' | null

type InternalCard = {
  id: Exclude<InternalPanel, null>
  title: string
  subtitle: string
  hex: string
  glyph: NexusGlyphKind
  badge?: string
}

function rgb(hex: string): string {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '139,92,246'
}

function InternalCardButton({ card, onClick }: { card: InternalCard; onClick: () => void }) {
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
        ? { background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(139,92,246,0.07))', border: '1px solid rgba(255,255,255,0.22)', color: 'rgba(255,255,255,0.92)', boxShadow: '0 0 16px rgba(139,92,246,0.10), inset 0 1px 0 rgba(255,255,255,0.08)' }
        : { background: 'linear-gradient(135deg, rgba(139,92,246,0.22), rgba(0,200,255,0.08))', border: '1px solid rgba(139,92,246,0.26)', color: '#ddd6fe', boxShadow: '0 0 18px rgba(139,92,246,0.12)' }}
      aria-label={displayLabel}
      title={displayLabel}
    >
      {displayLabel}
    </button>
  )
}

function InternalDetailShell({ title, subtitle, onClose, children, actions }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] overflow-hidden bg-black/68 px-4 py-4 backdrop-blur-sm sm:py-6">
      <div
        className="mx-auto grid h-[calc(100dvh-2rem)] w-full max-w-6xl xl:max-w-none grid-cols-1 gap-4 overflow-hidden rounded-[2rem] p-5 shadow-2xl sm:h-[calc(100dvh-3rem)] lg:grid-cols-[1fr_260px]"
        style={{
          background: 'radial-gradient(circle at 18% 0%, rgba(139,92,246,0.15), transparent 32%), linear-gradient(180deg, rgba(8,18,34,0.97), rgba(3,9,22,0.97))',
          border: '1px solid rgba(139,92,246,0.20)',
          boxShadow: '0 30px 100px rgba(0,0,0,0.60), 0 0 58px rgba(139,92,246,0.11), inset 0 1px 0 rgba(255,255,255,0.07)',
          backdropFilter: 'blur(28px)',
        }}
      >
        <div className="min-h-0 overflow-y-auto pr-1" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <NexusGlassBackButton label="Back to Internal" onClick={onClose} />
          <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(196,181,253,0.86)' }}>Internal</div>
          <h2 className="mt-1 text-2xl font-semibold" style={{ color: 'rgba(255,255,255,0.97)', textShadow: '0 0 18px rgba(139,92,246,0.18)' }}>{title}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.54)' }}>{subtitle}</p>
          <div className="mt-5">{children}</div>
        </div>
        <aside className="min-h-0 overflow-y-auto rounded-3xl p-4" style={{ background: 'linear-gradient(180deg, rgba(8,18,34,0.68), rgba(3,9,22,0.52))', border: '1px solid rgba(139,92,246,0.15)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>Actions</div>
          <div className="mt-4 space-y-2">{actions}</div>
        </aside>
      </div>
    </div>
  )
}

function InternalInfoPanel({ copy }: { copy: string }) {
  return (
    <div className="rounded-3xl p-4" style={{ background: 'linear-gradient(180deg, rgba(8,18,34,0.70), rgba(3,9,22,0.48))', border: '1px solid rgba(139,92,246,0.16)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
      <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>Internal board</div>
      <p className="mt-2 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.54)' }}>{copy}</p>
    </div>
  )
}

export function InternalSurface() {
  const router = useRouter()
  const [activePanel, setActivePanel] = useState<InternalPanel>(null)

  const cards: InternalCard[] = [
    { id: 'tracker', title: 'Tracker', subtitle: 'Open Nexus Tracker work, bugs, build notes, and product tasks.', hex: '#00C8FF', glyph: 'activity', badge: 'Build' },
    { id: 'dealer-onboarding', title: 'Dealer Onboarding', subtitle: 'Track NDA, agreements, compliance, approval, and live dealer status.', hex: '#FBBF24', glyph: 'priority', badge: 'Corporate' },
    { id: 'users-features', title: 'Users & Features', subtitle: 'Manage platform users, roles, feature access, and settings.', hex: '#8B5CF6', glyph: 'pipeline', badge: 'Admin' },
    { id: 'integrations', title: 'Site Integrations', subtitle: 'Connect each property’s Brivo, Eagle Eye, Shelly & UniFi logins (corporate setup).', hex: '#00C8FF', glyph: 'job-open', badge: 'Corporate' },
    { id: 'provisioning', title: 'Sites to Provision', subtitle: 'Won deals waiting for a controller — enter the serial and program Brivo.', hex: '#34D399', glyph: 'priority', badge: 'Corporate' },
    { id: 'playbooks', title: 'Playbooks', subtitle: 'Find internal process, scripts, SOPs, and operating instructions.', hex: '#007CFF', glyph: 'research' },
    { id: 'training', title: 'Training', subtitle: 'Open training, quests, scorecards, and team enablement.', hex: '#34D399', glyph: 'todo' },
  ]

  return (
    <section className="mt-9 w-full max-w-5xl">
      <div
        className="rounded-[2rem] p-5 sm:p-6"
        style={{
          background: 'radial-gradient(circle at 12% 0%, rgba(139,92,246,0.15), transparent 34%), linear-gradient(180deg, rgba(8,18,34,0.78), rgba(3,9,22,0.72))',
          border: '1px solid rgba(139,92,246,0.18)',
          boxShadow: '0 28px 90px rgba(0,0,0,0.38), 0 0 46px rgba(139,92,246,0.10), inset 0 1px 0 rgba(255,255,255,0.07)',
          backdropFilter: 'blur(26px)',
        }}
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(196,181,253,0.86)' }}>Internal</div>
            <h2 className="mt-1 text-xl font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.97)', textShadow: '0 0 18px rgba(139,92,246,0.18)' }}>What internal work are we managing?</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.54)' }}>
              Product tracking, platform settings, playbooks, dealer onboarding, and team training live here.
            </p>
          </div>
          <div className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]" style={{ background: 'rgba(139,92,246,0.14)', color: 'rgba(221,214,254,0.96)', border: '1px solid rgba(139,92,246,0.28)', boxShadow: '0 0 18px rgba(139,92,246,0.10)' }}>Admin OS</div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map(card => <InternalCardButton key={card.id} card={card} onClick={() => setActivePanel(card.id)} />)}
        </div>

        <div className="mt-5 text-[11px]" style={{ color: 'rgba(255,255,255,0.38)' }}>
          Internal stays simple: track product work, onboard dealers, manage users and features, find playbooks, or train the team.
        </div>
      </div>

      {activePanel === 'tracker' && (
        <InternalDetailShell title="Tracker" subtitle="Product work, build issues, bugs, and Nexus roadmap tasks." onClose={() => setActivePanel(null)} actions={<><ActionButton label="Open Nexus Tracker" onClick={() => router.push('/tracker')} /><ActionButton label="Open Playbook" onClick={() => router.push('/playbook')} muted /></>}>
          <InternalTrackerBoard />
        </InternalDetailShell>
      )}

      {activePanel === 'dealer-onboarding' && (
        <InternalDetailShell title="Dealer Onboarding" subtitle="See what each partner needs before access goes live." onClose={() => setActivePanel(null)} actions={<><ActionButton label="Add Dealer" onClick={() => router.push('/admin/dealers/new')} /><ActionButton label="View All Dealers" onClick={() => router.push('/admin/dealers')} /><ActionButton label="Feature Settings" onClick={() => router.push('/admin/settings/features')} muted /></>}>
          <InternalDealerOnboardingBoard />
        </InternalDetailShell>
      )}

      {activePanel === 'users-features' && (
        <InternalDetailShell title="Users & Features" subtitle="Users, roles, feature flags, permissions, and platform setup." onClose={() => setActivePanel(null)} actions={<><ActionButton label="Open Platform Users" onClick={() => router.push('/platform-users')} /><ActionButton label="Open Feature Settings" onClick={() => router.push('/feature-settings')} /><ActionButton label="Open Dealers" onClick={() => router.push('/dealer')} muted /></>}>
          <InternalUsersFeaturesBoard />
        </InternalDetailShell>
      )}

      {activePanel === 'integrations' && (
        <InternalDetailShell title="Site Integrations" subtitle="Corporate setup: connect each property's Brivo, Eagle Eye, Shelly & UniFi logins. Dealers operate doors/cameras at their sites but never see these credentials." onClose={() => setActivePanel(null)} actions={<><ActionButton label="Open Operations Hub" onClick={() => router.push('/cmms')} /><ActionButton label="Open Dealers" onClick={() => router.push('/admin/dealers')} muted /></>}>
          <IntegrationsConsole />
        </InternalDetailShell>
      )}

      {activePanel === 'provisioning' && (
        <InternalDetailShell title="Sites to Provision" subtitle="When a deal is won, Nexus auto-creates the site and pre-fills its doors from the survey. Open one to enter the controller serial and program Brivo." onClose={() => setActivePanel(null)} actions={<><ActionButton label="Open Operations Hub" onClick={() => router.push('/cmms')} /></>}>
          <ProvisioningQueue />
        </InternalDetailShell>
      )}

      {activePanel === 'playbooks' && (
        <InternalDetailShell title="Playbooks" subtitle="Internal SOPs, scripts, operating instructions, and process guidance." onClose={() => setActivePanel(null)} actions={<><ActionButton label="Open Playbook" onClick={() => router.push('/playbook')} /><ActionButton label="Open Knowledge Base" onClick={() => router.push('/kb')} muted /></>}>
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
