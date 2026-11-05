'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { InternalDealerOnboardingBoard } from '@/components/nexus/InternalDealerOnboardingBoard'
import { IntegrationsConsole } from '@/components/nexus/IntegrationsConsole'
import { ProvisioningQueue } from '@/components/nexus/ProvisioningQueue'
import { InternalTrackerBoard } from '@/components/nexus/InternalTrackerBoard'
import { InternalUsersFeaturesBoard } from '@/components/nexus/InternalUsersFeaturesBoard'
import { PricingConsoleBody } from '@/components/admin/PricingConsoleBody'
import { CostSheetBody } from '@/components/admin/CostSheetBody'
import { AriaCapsBody } from '@/components/admin/AriaCapsBody'
import { AdminReportConsole, ADMIN_CSS } from '@/components/nexus/AdminReportConsole'
import { CSS } from '@/components/nexus/systems/shared'
import { QuickBooksPage } from '@/components/nexus/quickbooks/QuickBooksPage'
import { FinancePage } from '@/components/nexus/finance/FinancePage'
import { PortalsAdmin } from '@/components/nexus/systems/PropertyPortal'
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires
const { ListChecks, UserCheck, Users, Key, Server, Tag, BookOpen, DollarSign, Search, FileText, Target, Globe, TrendingUp } = require('lucide-react') as any

// ---- Tool windows still use the steel console look (landing is the light look) ----
const FRAME_STYLE = { background: 'linear-gradient(135deg,rgba(25,200,245,0.06),rgba(107,126,255,0.05)), linear-gradient(180deg,rgba(26,36,54,0.80),rgba(15,22,36,0.84))', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 26px 54px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 2px rgba(0,0,0,0.4)' } as const
const TILE_BG = 'linear-gradient(165deg,rgba(255,255,255,0.045),transparent 55%), linear-gradient(180deg,rgba(32,44,66,0.82),rgba(18,26,42,0.78))'
const TILE_STYLE = { background: TILE_BG, border: '1px solid #1E293B', boxShadow: '0 14px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.14)' } as const
const WELL = 'linear-gradient(180deg,#22303f,#1a2532)'

type InternalPanel = 'quickbooks' | 'finance' |'tracker' | 'dealer-onboarding' | 'users-features' | 'integrations' | 'portals' | 'provisioning' | 'pricing' | 'costs' | 'aria-caps' | 'playbooks' | 'training' | null

type InternalCard = {
  id: Exclude<InternalPanel, null>
  title: string
  subtitle: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any
  badge?: string
}

function ToolCard({ card, onClick }: { card: InternalCard; onClick: () => void }) {
  const Icon = card.icon
  return (
    <button type="button" className="ad-tool" onClick={onClick}>
      <span className="ic"><Icon size={18} strokeWidth={1.8} /></span>
      <span style={{ minWidth: 0 }}>
        <span className="t">{card.title}{card.badge && <span className="sy-pill">{card.badge}</span>}</span>
        <span className="m" style={{ display: 'block' }}>{card.subtitle}</span>
      </span>
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
        ? { background: '#1a2532', border: '1px solid #1E293B', color: '#00A3FF' }
        : { background: '#1E293B', border: '1px solid rgba(0,163,255,0.32)', color: '#cfe0f0' }}
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
        <div className="min-h-0 overflow-y-auto rounded-3xl p-4" style={{ background: 'linear-gradient(180deg,#1d2a39,#141d28)', border: '1px solid #1E293B', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <button type="button" onClick={onClose} className="mb-3 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-semibold" style={{ background: '#22303f', border: '1px solid rgba(0,163,255,0.28)', color: '#00A3FF' }}>← Back to Internal</button>
          <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: '#00A3FF' }}>Internal</div>
          <h2 className="mt-1 text-2xl font-semibold" style={{ color: '#eaf2fb' }}>{title}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: '#c3d3e2' }}>{subtitle}</p>
          <div className="mt-5">{children}</div>
        </div>
        <aside className="min-h-0 overflow-y-auto rounded-3xl p-4" style={{ background: WELL, border: '1px solid #1E293B', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <div className="text-sm font-semibold" style={{ color: '#eaf2fb' }}>Actions</div>
          <div className="mt-4 space-y-2">{actions}</div>
        </aside>
      </div>
    </div>
  )
}

function InternalInfoPanel({ copy }: { copy: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: WELL, border: '1px solid #1E293B' }}>
      <div className="text-sm font-semibold" style={{ color: '#eaf2fb' }}>Internal board</div>
      <p className="mt-2 text-xs leading-relaxed" style={{ color: '#c3d3e2' }}>{copy}</p>
    </div>
  )
}

export function InternalSurface() {
  const router = useRouter()
  const [activePanel, setActivePanel] = useState<InternalPanel>(null)
  const [team, setTeam] = useState<{ members: number; orgs: number } | null>(null)
  const { user } = useUser()
  // Cost is corporate-only — the card is hidden from everyone else, and the
  // /api/admin/costs route refuses non-corporate even if they reach it.
  const isCorporate = (user?.publicMetadata as { org_tier?: string } | undefined)?.org_tier === 'corporate'
  // Finance: corporate admins only in the UI; every /api/finance route also needs the senior admin code.
  const isFinanceAdmin = isCorporate && (user?.publicMetadata as { role?: string } | undefined)?.role === 'admin'
  // ?qb=1 (back from QuickBooks sign-in, or a Lexi link) opens the QuickBooks page.
  const [qbNotice, setQbNotice] = useState<{ ok: boolean; reason?: string | null } | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = new URLSearchParams(window.location.search)
    // ?portals=1 (the old /admin/portals page redirects here) opens Property portals.
    if (p.get('portals') === '1') {
      setActivePanel('portals'); p.delete('portals')
      const q = p.toString(); window.history.replaceState({}, '', q ? `/?${q}` : '/'); return
    }
    if (p.get('qb') !== '1') return
    const res = p.get('qbo')
    if (res) setQbNotice({ ok: res === 'connected', reason: p.get('qbreason') })
    setActivePanel('quickbooks')
    for (const k of ['qb', 'qbo', 'qbreason']) p.delete(k)
    const qs = p.toString()
    window.history.replaceState({}, '', qs ? `/?${qs}` : '/')
  }, [])

  const cards: InternalCard[] = [
    { id: 'users-features', title: 'Users & features', subtitle: 'Add people, set roles, and choose what each company can use.', icon: Users },
    { id: 'dealer-onboarding', title: 'Dealer onboarding', subtitle: 'NDA, agreement, approval and go-live for each new dealer.', icon: UserCheck, badge: 'Corporate' },
    { id: 'integrations', title: 'Site logins', subtitle: 'Connect each property’s Brivo, Eagle Eye, Shelly and UniFi.', icon: Key, badge: 'Corporate' },
    ...(isCorporate ? [{ id: 'portals', title: 'Property portals', subtitle: 'Each property manager’s portal: turn it on, access code, cameras and gates.', icon: Globe, badge: 'Corporate' } as InternalCard] : []),
    { id: 'provisioning', title: 'Sites to set up', subtitle: 'Won deals waiting for a controller serial and Brivo programming.', icon: Server, badge: 'Corporate' },
    { id: 'pricing', title: 'Pricing', subtitle: 'Floors, target prices, add-ons and new catalog lines.', icon: Tag, badge: 'Corporate' },
    ...(isCorporate ? [{ id: 'quickbooks', title: 'QuickBooks', subtitle: 'Cash, who owes us, profit — plus invoice and payment sync.', icon: BookOpen, badge: 'Corporate' } as InternalCard] : []),
    ...(isFinanceAdmin ? [{ id: 'finance', title: 'Finance', subtitle: 'Cash outlook, bills by due date and tight weeks ahead. Senior admin code required.', icon: TrendingUp, badge: 'Senior admin' } as InternalCard] : []),
    ...(isCorporate ? [{ id: 'costs', title: 'Our costs', subtitle: 'What Gate Guard really pays each month and for hardware. Never shown to dealers.', icon: DollarSign, badge: 'Corporate' } as InternalCard] : []),
    ...(isCorporate ? [{ id: 'aria-caps', title: 'ARIA save limits', subtitle: 'How many properties each dealer can save to Intel each month.', icon: Search, badge: 'Corporate' } as InternalCard] : []),
    { id: 'tracker', title: 'Tracker', subtitle: 'Nexus build work, bugs and product tasks.', icon: ListChecks },
    { id: 'playbooks', title: 'Playbooks', subtitle: 'How we do things: scripts, steps and procedures.', icon: FileText },
    { id: 'training', title: 'Training', subtitle: 'Training, quests and scorecards for the team.', icon: Target },
  ]
  return (
    <>
    <section className="sy">
      <style>{CSS}{ADMIN_CSS}</style>
      <header className="sy-hd">
        <div>
          <h1>Admin</h1>
          <div className="sub">How your companies are doing, and the tools to run Nexus.</div>
        </div>
        {team && <span className="ad-team"><span className="sy-dot" style={{ background: '#30D158' }} />{team.members} {team.members === 1 ? 'person' : 'people'} · {team.orgs} {team.orgs === 1 ? 'company' : 'companies'}</span>}
      </header>

      {/* Command-center report band — real rollup of leads / opportunities / jobs
          + operations, scoped to the admin's whole hierarchy. */}
      <AdminReportConsole onTeam={setTeam} onOpenTab={(tab) => window.dispatchEvent(new CustomEvent('nexus:navigate', { detail: tab }))} />

      <div className="ad-sec"><h2>Admin tools</h2></div>
      <div className="ad-tools">
        {cards.map(card => <ToolCard key={card.id} card={card} onClick={() => setActivePanel(card.id)} />)}
      </div>
    </section>

      {/* Corporate only in the UI; every /api/integrations/quickbooks route also refuses non-corporate. */}
      {activePanel === 'quickbooks' && isCorporate && (
        <QuickBooksPage notice={qbNotice} onClose={() => { setActivePanel(null); setQbNotice(null) }} />
      )}

      {activePanel === 'finance' && isFinanceAdmin && (
        <FinancePage myEmail={user?.primaryEmailAddress?.emailAddress ?? ''} onClose={() => setActivePanel(null)} />
      )}

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

      {/* Corporate only in the UI; every /api/admin/portals route also refuses non-corporate. */}
      {activePanel === 'portals' && isCorporate && (
        <div className="sy"><PortalsAdmin onClose={() => setActivePanel(null)} /></div>
      )}

      {activePanel === 'integrations' && (
        <InternalDetailShell title="Site Integrations" subtitle="Corporate setup: connect each property's Brivo, Eagle Eye, Shelly & UniFi logins. Dealers operate doors/cameras at their sites but never see these credentials." onClose={() => setActivePanel(null)} actions={<><ActionButton label="Property portals" onClick={() => setActivePanel('portals')} /><ActionButton label="Open Operations Hub" onClick={() => router.push('/cmms')} /><ActionButton label="Open Dealers" onClick={() => router.push('/admin/dealers')} /></>}>
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
    </>
  )
}
