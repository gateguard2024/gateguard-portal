'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActionItem {
  id: string
  type: 'lead' | 'opportunity'
  name: string
  propertyName?: string | null
  propertyAddress?: string | null
  units?: number | null
  contactName?: string | null
  stage: string
  amount?: number | null
  notes?: string | null
  ariaSummary?: string | null  // pre-filled from aria_properties if available
  updatedAt?: string | null
  createdAt: string
}

// ─── Stage config ─────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  // Lead stages
  new:           { label: 'New lead',          color: '#93a3ff', bg: 'rgba(107,126,255,0.15)' },
  contacted:     { label: 'Contacted',          color: '#93a3ff', bg: 'rgba(107,126,255,0.12)' },
  qualified:     { label: 'Qualified',          color: '#6ee7b7', bg: 'rgba(52,211,153,0.12)'  },
  unqualified:   { label: 'Unqualified',        color: '#fca5a5', bg: 'rgba(239,68,68,0.1)'   },
  // Opportunity stages
  prospect:      { label: 'Prospect',           color: '#93a3ff', bg: 'rgba(107,126,255,0.12)' },
  survey_requested: { label: 'Survey requested', color: '#6ee7b7', bg: 'rgba(52,211,153,0.1)'  },
  proposal_sent: { label: 'Proposal sent',      color: '#fcd34d', bg: 'rgba(251,191,36,0.1)'  },
  negotiation:   { label: 'Negotiating',        color: '#fcd34d', bg: 'rgba(251,191,36,0.12)' },
  won:           { label: 'Closed won',         color: '#86efac', bg: 'rgba(52,211,153,0.18)' },
  lost:          { label: 'Closed lost',        color: '#fca5a5', bg: 'rgba(239,68,68,0.08)'  },
  aria_draft:    { label: 'ARIA draft',         color: '#c084fc', bg: 'rgba(168,85,247,0.14)' },
}

// ─── Next best action per stage ───────────────────────────────────────────────

interface ActionDef {
  label: string
  btnColor: string     // Tailwind-compatible inline CSS bg color
  btnText: string      // text color
  confirmText: (item: ActionItem) => string
  toolName: string
  getArgs:  (item: ActionItem) => Record<string, unknown>
  isNavigation?: boolean
  navHref?: (item: ActionItem) => string
  nextHint?: string
}

const LEAD_ACTIONS: Record<string, ActionDef> = {
  new: {
    label: 'Mark as contacted',
    btnColor: 'rgba(107,126,255,0.22)', btnText: '#93a3ff',
    confirmText: i => `Update "${i.name}" → Contacted`,
    toolName: 'update_lead_stage',
    getArgs: i => ({ lead_id: i.id, stage: 'contacted', reasoning: 'Marking lead as contacted from action center' }),
    nextHint: 'Qualify next',
  },
  contacted: {
    label: 'Qualify lead',
    btnColor: 'rgba(52,211,153,0.18)', btnText: '#6ee7b7',
    confirmText: i => `Update "${i.name}" → Qualified`,
    toolName: 'update_lead_stage',
    getArgs: i => ({ lead_id: i.id, stage: 'qualified', reasoning: 'Qualifying lead from action center' }),
    nextHint: 'Create opportunity next',
  },
  qualified: {
    label: 'Create opportunity',
    btnColor: '#6B7EFF', btnText: '#ffffff',
    confirmText: i => `Create opportunity: ${i.propertyName || i.name} · Source: Lead`,
    toolName: 'create_opportunity',
    getArgs: i => ({
      name: i.propertyName || i.name,
      stage: 'qualified',
      contact_name: i.contactName ?? undefined,
      notes: i.notes ?? undefined,
      reasoning: 'Converting qualified lead to opportunity from action center',
    }),
    nextHint: 'Launch site survey next',
  },
  unqualified: {
    label: 'Re-engage',
    btnColor: 'rgba(251,191,36,0.15)', btnText: '#fcd34d',
    confirmText: i => `Re-open "${i.name}" → Contacted`,
    toolName: 'update_lead_stage',
    getArgs: i => ({ lead_id: i.id, stage: 'contacted', reasoning: 'Re-engaging unqualified lead' }),
  },
}

const OPP_ACTIONS: Record<string, ActionDef> = {
  prospect: {
    label: 'Run ARIA research',
    btnColor: 'rgba(168,85,247,0.22)', btnText: '#c084fc',
    confirmText: i => `Launch ARIA research on ${i.propertyName || i.name}`,
    toolName: 'aria_navigate',
    getArgs: i => ({ property: i.propertyName || i.name }),
    isNavigation: true,
    navHref: i => `/aria?search=${encodeURIComponent(i.propertyName || i.name)}`,
    nextHint: 'Intel will populate automatically',
  },
  aria_draft: {
    label: 'Turn into opportunity',
    btnColor: '#6B7EFF', btnText: '#ffffff',
    confirmText: i => `Create opportunity: ${i.propertyName || i.name} · ARIA pre-filled`,
    toolName: 'create_opportunity',
    getArgs: i => ({
      name: i.propertyName || i.name,
      stage: 'qualified',
      contact_name: i.contactName ?? undefined,
      notes: i.ariaSummary ?? i.notes ?? undefined,
      reasoning: 'Converting ARIA draft to opportunity from action center',
    }),
    nextHint: 'Launch site survey next',
  },
  qualified: {
    label: 'Launch site survey',
    btnColor: 'rgba(52,211,153,0.18)', btnText: '#6ee7b7',
    confirmText: i => `Create work order: Site Survey · ${i.propertyName || i.name}`,
    toolName: 'create_work_order',
    getArgs: i => ({
      title: `Site Survey — ${i.propertyName || i.name}`,
      description: `Survey requested from action center for ${i.units ? i.units + '-unit ' : ''}property`,
      reasoning: 'Scheduling site survey for qualified opportunity',
    }),
    nextHint: 'Log survey complete when done',
  },
  survey_requested: {
    label: 'Log survey complete',
    btnColor: 'rgba(52,211,153,0.18)', btnText: '#6ee7b7',
    confirmText: i => `Move "${i.name}" → Proposal · Log survey done`,
    toolName: 'update_opportunity_stage',
    getArgs: i => ({
      opportunity_id: i.id,
      stage: 'proposal_sent',
      reasoning: 'Survey complete — moving to proposal stage from action center',
    }),
    nextHint: 'Send proposal next',
  },
  proposal_sent: {
    label: 'Schedule follow-up',
    btnColor: 'rgba(251,191,36,0.15)', btnText: '#fcd34d',
    confirmText: i => `Schedule follow-up call · ${i.contactName || 'Contact'} re: ${i.name}`,
    toolName: 'schedule_followup',
    getArgs: i => ({
      contact_name: i.contactName ?? 'Contact',
      subject: `Follow-up on proposal — ${i.name}`,
      due_at: new Date(Date.now() + 86400000).toISOString(),
      reasoning: 'Scheduling follow-up after proposal sent',
    }),
    nextHint: 'Move to negotiation on response',
  },
  negotiation: {
    label: 'Log discussion',
    btnColor: 'rgba(251,191,36,0.15)', btnText: '#fcd34d',
    confirmText: i => `Log negotiation activity on "${i.name}"`,
    toolName: 'log_crm_activity',
    getArgs: i => ({
      subject: `Negotiation update — ${i.name}`,
      type: 'note',
      opportunity_id: i.id,
      reasoning: 'Logging negotiation progress from action center',
    }),
    nextHint: 'Mark won when agreement reached',
  },
  won: {
    label: 'Create install job',
    btnColor: 'rgba(52,211,153,0.22)', btnText: '#6ee7b7',
    confirmText: i => `Create New Install job for ${i.propertyName || i.name}${i.amount ? ` · $${i.amount.toLocaleString()}` : ''}`,
    toolName: 'navigate_projects',
    getArgs: i => ({ opportunity_id: i.id }),
    isNavigation: true,
    navHref: i => `/projects?from_opp=${i.id}`,
    nextHint: 'Deposit → Procurement → Install',
  },
  lost: {
    label: 'Re-engage in 90 days',
    btnColor: 'rgba(255,255,255,0.06)', btnText: 'rgba(255,255,255,0.4)',
    confirmText: i => `Schedule re-engagement for "${i.name}" in 90 days`,
    toolName: 'schedule_followup',
    getArgs: i => ({
      contact_name: i.contactName ?? 'Contact',
      subject: `Re-engagement — ${i.name}`,
      due_at: new Date(Date.now() + 90 * 86400000).toISOString(),
      reasoning: 'Scheduling re-engagement for lost opportunity',
    }),
  },
}

// ─── AI Score helper ──────────────────────────────────────────────────────────

function aiScore(id: string, stage: string): number {
  const h = Array.from(id).reduce((a, c) => ((a * 31) + c.charCodeAt(0)) & 0xffff, 0)
  const base = (h % 30) + 50
  const bump: Record<string, number> = {
    aria_draft: 18, won: 25, negotiation: 20, qualified: 15,
    proposal_sent: 10, survey_requested: 12, contacted: 8, prospect: 5, new: 5,
  }
  return Math.min(99, base + (bump[stage] ?? 0))
}

// ─── Card component ───────────────────────────────────────────────────────────

interface Props {
  item: ActionItem
  onDismiss: (id: string) => void
  onExecuted: (id: string) => void
}

export function OpportunityActionCard({ item, onDismiss, onExecuted }: Props) {
  const router = useRouter()
  const [confirming, setConfirming]   = useState(false)
  const [loading,    setLoading]      = useState(false)
  const [done,       setDone]         = useState(false)
  const [error,      setError]        = useState<string | null>(null)

  const actions  = item.type === 'lead' ? LEAD_ACTIONS : OPP_ACTIONS
  const actionDef = actions[item.stage] ?? null
  const score    = aiScore(item.id, item.stage)
  const stageCfg = STAGE_LABELS[item.stage] ?? { label: item.stage, color: '#93a3ff', bg: 'rgba(107,126,255,0.12)' }

  const displayName    = item.propertyName || item.name
  const locationLine   = [item.units ? `${item.units} units` : null, item.propertyAddress].filter(Boolean).join(' · ')
  const contextSnippet = item.ariaSummary || item.notes

  async function handleExecute() {
    if (!actionDef) return

    if (actionDef.isNavigation) {
      router.push(actionDef.navHref!(item))
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/assistant/execute', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ toolName: actionDef.toolName, toolArgs: actionDef.getArgs(item) }),
      })
      const data = await res.json()

      if (data.success) {
        setDone(true)
        setConfirming(false)
        setTimeout(() => onExecuted(item.id), 1200)
      } else {
        setError(data.error ?? 'Something went wrong')
      }
    } catch {
      setError('Network error — try again')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div
        className="rounded-2xl p-4 mb-3 transition-all duration-500"
        style={{
          background: 'rgba(52,211,153,0.04)',
          border: '0.5px solid rgba(52,211,153,0.15)',
          opacity: 0.5,
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: '#6ee7b7', fontSize: 14 }}>✓</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            Done — {actionDef?.nextHint ?? 'next step queued'}
          </span>
        </div>
      </div>
    )
  }

  // Highlight cards with high score or ARIA draft
  const isHighPriority = score >= 75 || item.stage === 'aria_draft'

  return (
    <div
      className="rounded-2xl p-4 mb-3 relative"
      style={{
        background: isHighPriority
          ? 'rgba(107,126,255,0.06)'
          : 'rgba(255,255,255,0.03)',
        border: isHighPriority
          ? '1px solid rgba(107,126,255,0.2)'
          : '0.5px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Dismiss */}
      <button
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss"
        className="absolute top-3 right-3 transition-opacity opacity-20 hover:opacity-60"
        style={{ color: 'rgba(255,255,255,0.7)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
      >
        ×
      </button>

      {/* Header row */}
      <div className="flex items-start gap-3 mb-3 pr-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>
              {displayName}
            </span>
            <span
              className="rounded-full"
              style={{ ...stageCfg, fontSize: 11, padding: '2px 9px', fontWeight: 500, background: stageCfg.bg, color: stageCfg.color }}
            >
              {stageCfg.label}
            </span>
          </div>
          {locationLine && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
              {locationLine}
              {item.contactName ? ` · DM: ${item.contactName}` : ''}
            </div>
          )}
        </div>

        {/* AI score */}
        <div
          className="rounded-lg flex-shrink-0"
          style={{
            background: score >= 80 ? 'rgba(107,126,255,0.2)' : 'rgba(255,255,255,0.05)',
            color:      score >= 80 ? '#93a3ff'                : 'rgba(255,255,255,0.3)',
            fontSize:   11,
            fontWeight: 500,
            padding:    '3px 8px',
          }}
        >
          AI {score}/99
        </div>
      </div>

      {/* Context snippet */}
      {contextSnippet && (
        <div
          className="rounded-lg mb-3 text-xs leading-relaxed"
          style={{
            padding: '9px 12px',
            background: 'rgba(255,255,255,0.03)',
            borderLeft: '2px solid rgba(107,126,255,0.35)',
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          {contextSnippet}
        </div>
      )}

      {/* Amount badge for opps */}
      {item.amount != null && item.amount > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>Pipeline value</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#6ee7b7' }}>
            ${item.amount.toLocaleString()}
          </span>
        </div>
      )}

      {/* Action button */}
      {actionDef && !confirming && (
        <button
          onClick={() => actionDef.isNavigation ? handleExecute() : setConfirming(true)}
          className="w-full rounded-xl text-sm font-medium transition-opacity hover:opacity-85"
          style={{
            background: actionDef.btnColor,
            color:      actionDef.btnText,
            border:     actionDef.btnText !== '#ffffff'
              ? `1px solid ${actionDef.btnText.replace(')', ', 0.3)').replace('rgb', 'rgba')}`
              : 'none',
            padding: '11px 16px',
          }}
        >
          {actionDef.label}
        </button>
      )}

      {/* Confirm panel */}
      {confirming && actionDef && (
        <div
          className="rounded-xl mt-1 p-3"
          style={{
            background: 'rgba(13,33,80,0.9)',
            border:     '1px solid rgba(107,126,255,0.35)',
          }}
        >
          <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Nexus will:</p>
          <p className="text-sm mb-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {actionDef.confirmText(item)}
          </p>
          {error && (
            <p className="text-xs mb-2" style={{ color: '#fca5a5' }}>{error}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleExecute}
              disabled={loading}
              className="flex-1 rounded-lg text-sm font-medium transition-opacity"
              style={{ background: '#6B7EFF', color: '#fff', border: 'none', padding: '8px', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Running…' : 'Execute'}
            </button>
            <button
              onClick={() => { setConfirming(false); setError(null) }}
              className="flex-1 rounded-lg text-sm"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '0.5px solid rgba(255,255,255,0.1)', padding: '8px', cursor: 'pointer' }}
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
