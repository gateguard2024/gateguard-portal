'use client'

/** Sales board — shared types, stage list, reasons, money + date helpers. */

export type Deal = {
  id: string; key: string; name: string; account: string | null; management_co: string | null
  units: number | null; city: string | null
  stage: string; stage_label: string; probability: number; tab: 'open' | 'won' | 'lost' | 'archived'
  close_date: string | null; mrr: number | null; tcv: number | null; weighted: number | null; term_assumed: boolean
  owner_id: string | null; owner_name: string | null
  days_in_stage: number; stalled: boolean
  next: { id: string; type: string; subject: string | null; due_at: string | null } | null
  overdue: number
  type: string | null; source: string | null; tags: string[]
  created_at: string | null; won_at: string | null; lost_at: string | null
  lost_reason: string | null; lost_competitor: string | null; lost_note: string | null
  has_job: boolean
}
export type Owner = { id: string; name: string }

export const STAGES: { key: string; label: string; short: string; prob: number }[] = [
  { key: 'meet_present', label: 'Meet & Present', short: 'Meet', prob: 20 },
  { key: 'survey', label: 'Site Survey', short: 'Survey', prob: 35 },
  { key: 'propose', label: 'Proposal', short: 'Proposal', prob: 50 },
  { key: 'negotiate', label: 'Negotiate', short: 'Negotiate', prob: 70 },
  { key: 'contract', label: 'Contract & Sign', short: 'Contract', prob: 85 },
  { key: 'deposit', label: 'Deposit', short: 'Deposit', prob: 95 },
]
export const stageIndex = (k: string) => STAGES.findIndex(s => s.key === k)
export const stageLabel = (k: string) => STAGES.find(s => s.key === k)?.label ?? (k === 'won' ? 'Won' : k === 'lost' ? 'Lost' : k)

/** Quick reasons on the "What happened?" dialog, by destination stage. */
export const FORWARD_REASONS: Record<string, string[]> = {
  meet_present: ['First meeting held', 'Intro call done', 'Referral came in'],
  survey: ['Meeting went well', 'Survey booked', 'Customer asked for a walk-through'],
  propose: ['Survey done', 'Scope agreed', 'Proposal sent'],
  negotiate: ['Proposal reviewed', 'Pricing questions', 'Board / owner review'],
  contract: ['Verbal yes', 'Terms agreed', 'Contract sent'],
  deposit: ['Contract signed', 'Deposit invoiced'],
  won: ['Deposit received', 'Signed and paid', 'PO received'],
}
export const BACKWARD_REASONS = ['Customer paused', 'Scope changed', 'New decision maker', 'Re-survey needed', 'Budget re-review']
export const LOST_REASONS = ['Price', 'Went with competitor', 'Timing / no budget', 'Went silent', 'Not a fit', 'Other']
export const ACT_TYPES: { key: string; label: string }[] = [
  { key: 'call', label: 'Call' }, { key: 'email', label: 'Email' }, { key: 'meeting', label: 'Meeting' },
  { key: 'visit', label: 'Site visit' }, { key: 'task', label: 'Task' },
]
export const DEAL_TYPES = ['New install', 'Upgrade', 'Service conversion', 'DirecTV bulk', 'Property']
export const SOURCES = ['Lead', 'Referral', 'ARIA', 'Trade show', 'Inbound', 'Outbound', 'Existing customer', 'Direct']
export const FORECAST = [{ key: 'pipeline', label: 'Pipeline' }, { key: 'best_case', label: 'Best case' }, { key: 'commit', label: 'Commit' }, { key: 'omitted', label: 'Omitted' }]
export const INTERESTS = ['Access control', 'Video', 'Intercom', 'LPR', 'Remote monitoring', 'Gate operators', 'Smart locks', 'Package room', 'Wi-Fi / ISP', 'DirecTV']

export function money(n: number | null | undefined, short = true): string {
  if (n == null) return '—'
  const a = Math.abs(n)
  if (short && a >= 1_000_000) return `$${(n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 2).replace(/\.?0+$/, '')}M`
  if (short && a >= 1000) return `$${(n / 1000).toFixed(a >= 100_000 ? 0 : 1).replace(/\.0$/, '')}k`
  return `$${Math.round(n).toLocaleString()}`
}
export function localISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function fmtDate(iso: string | null | undefined, withYear = false) {
  if (!iso) return '—'
  const d = iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(withYear || d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) })
}
export function initials(name?: string | null) {
  return (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '—'
}

/** Next-step chip: overdue (red) / today (green) / planned (blue) / none (orange). */
export function nextChip(d: Pick<Deal, 'next' | 'overdue'>): { cls: 'late' | 'today' | 'ok' | 'none'; text: string } {
  if (!d.next) return { cls: 'none', text: 'No next step' }
  const due = d.next.due_at ? new Date(d.next.due_at) : null
  const what = d.next.subject || d.next.type
  if (!due) return { cls: 'ok', text: what }
  const today = localISO()
  const day = localISO(due)
  if (due.getTime() < Date.now() && day < today) {
    const n = Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(`${day}T00:00:00`).getTime()) / 86400000)
    return { cls: 'late', text: `${what} · ${n === 1 ? '1 day' : `${n} days`} late` }
  }
  if (day === today) return { cls: due.getTime() < Date.now() ? 'late' : 'today', text: `${what} · ${due.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` }
  const diff = (new Date(`${day}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000
  return { cls: 'ok', text: `${what} · ${diff < 7 ? due.toLocaleDateString(undefined, { weekday: 'short' }) : fmtDate(day)}` }
}
export const needsAttention = (d: Deal) => d.tab === 'open' && (!d.next || d.overdue > 0)
