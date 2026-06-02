'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

type ActionCard = {
  eyebrow: string
  title: string
  description: string
  signal: string
  actionLabel: string
  accent: string
  href?: string
  onClick?: () => void
  toolName: string
}

const CARD_STYLE = {
  background: 'linear-gradient(145deg, rgba(255,255,255,0.075), rgba(255,255,255,0.025))',
  border: '1px solid rgba(255,255,255,0.1)',
  boxShadow: '0 22px 70px rgba(0,0,0,0.28)',
  backdropFilter: 'blur(18px)',
}

function ActionCardShell({ card }: { card: ActionCard }) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background: card.accent,
                boxShadow: `0 0 18px ${card.accent}`,
              }}
            />
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
              {card.eyebrow}
            </span>
          </div>
          <h3 className="text-base font-semibold text-white/90">{card.title}</h3>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{
            background: `${card.accent}1f`,
            color: card.accent,
            border: `1px solid ${card.accent}4d`,
          }}
        >
          Nexus
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-white/45">{card.description}</p>
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 px-3 py-2">
        <p className="text-xs leading-relaxed text-white/50">{card.signal}</p>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/25" data-tool={card.toolName}>
          {card.toolName}
        </span>
        <span
          className="rounded-full px-4 py-2 text-xs font-semibold text-white shadow-[0_10px_32px_rgba(107,126,255,0.2)] transition group-hover:translate-x-0.5"
          style={{ background: card.accent }}
        >
          {card.actionLabel}
        </span>
      </div>
    </>
  )

  const className = 'group min-h-[230px] rounded-3xl p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10'

  if (card.href) {
    return (
      <Link href={card.href} className={className} style={CARD_STYLE}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={card.onClick} className={className} style={CARD_STYLE}>
      {content}
    </button>
  )
}

export function NewOppsLeadsModal() {
  const router = useRouter()
  const cards: ActionCard[] = [
    {
      eyebrow: 'Needs review',
      title: 'Review AI-drafted leads',
      description: 'Open the lead queue Nexus and ARIA are preparing from research, referrals, and inbound signals.',
      signal: 'Best first move: confirm the property/contact match, then let Nexus create the lead with the source notes attached.',
      actionLabel: 'Open leads',
      accent: '#6B7EFF',
      href: '/crm/leads',
      toolName: 'create_lead',
    },
    {
      eyebrow: 'Convert next',
      title: 'Turn qualified leads into opportunities',
      description: 'Work the shortlist of leads that have enough context to become active pipeline.',
      signal: 'Nexus handoff: one-tap opportunity creation, stage assignment, value estimate, and follow-up task.',
      actionLabel: 'Open pipeline',
      accent: '#34D399',
      href: '/crm/opportunities',
      toolName: 'create_opportunity',
    },
    {
      eyebrow: 'Command mode',
      title: 'Create from plain language',
      description: 'Skip the CRM form. Tell Nexus who the lead is, what property it belongs to, and what needs to happen.',
      signal: 'Example: "Add Sarah at Camden Crossing as a gate upgrade lead and remind me to call Friday."',
      actionLabel: 'Start with Nexus',
      accent: '#FBBF24',
      onClick: () => router.push('/crm?intent=new-lead'),
      toolName: 'assistant_tool_use',
    },
    {
      eyebrow: 'Deal movement',
      title: 'Find stalled opportunities',
      description: 'Surface deals where the next step is obvious: survey, quote, follow-up, or owner approval.',
      signal: 'Backend hook: rank cards by AI score, deal velocity, stale activity, margin risk, and urgency.',
      actionLabel: 'View CRM',
      accent: '#38BDF8',
      href: '/crm',
      toolName: 'update_opportunity_stage',
    },
  ]

  return (
    <section className="w-full">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6B7EFF]/70">
            Sales action center
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white/90">Leads and opportunities</h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-white/40">
          Start with intent. Nexus turns the selected path into a confirmation card before anything changes.
        </p>
      </div>

      <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
        {cards.map(card => (
          <ActionCardShell key={card.title} card={card} />
        ))}
      </div>
    </section>
  )
}
