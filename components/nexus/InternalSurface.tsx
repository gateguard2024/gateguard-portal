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

// ---- Tool windows use the same light look as the Admin landing (.sy styles from systems/shared) ----

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
  const displayLabel = muted ? `${label} — coming soon` : label
  return (
    <button type="button" className="sy-b line sm" onClick={muted ? undefined : onClick} disabled={muted} aria-label={displayLabel} title={muted ? 'Coming soon' : displayLabel}>
      {displayLabel}
    </button>
  )
}

// A tool window: the same light, centered window as Property portals, wide enough for tables.
function InternalDetailShell({ title, subtitle, onClose, children, actions }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode; actions?: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="sy-sheet-bg" style={{ zIndex: 90 }} onClick={onClose}>
      <div className="sy-sheet" role="dialog" aria-modal="true" aria-label={title} style={{ ['--w' as string]: '1180px', height: 'min(100%, 92dvh)' }} onClick={e => e.stopPropagation()}>
        <div className="hd" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: '1 1 320px' }}>
            <button type="button" className="sy-b line sm" style={{ marginBottom: 8 }} onClick={onClose}>‹ Admin</button>
            <h2>{title}</h2>
            <div className="s" style={{ maxWidth: 720, lineHeight: 1.45 }}>{subtitle}</div>
          </div>
          {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{actions}</div>}
        </div>
        <div className="bd" style={{ background: '#F5F5F7', flex: 1, alignContent: 'start' }}>{children}</div>
      </div>
    </div>
  )
}

function InternalInfoPanel({ copy }: { copy: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 2px rgba(10,20,40,.06), 0 8px 24px rgba(10,20,40,.08)' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F' }}>Coming soon</div>
      <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.45, color: '#6E6E73' }}>{copy}</p>
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

  // Finance is a whole page in place of Admin (same look), not a pop-up over it.
  if (activePanel === 'finance' && isFinanceAdmin) {
    return <FinancePage myEmail={user?.primaryEmailAddress?.emailAddress ?? ''} onClose={() => setActivePanel(null)} />
  }

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
