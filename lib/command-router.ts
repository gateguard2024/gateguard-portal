// lib/command-router.ts
// Lightweight, deterministic command router for the Nexus command bar.
//
// Goal (5th-grader simple): if someone types a plain navigation command like
// "dispatch", "go to money", or "open design", jump straight to that screen with
// NO AI call. Anything conversational ("create a new lead", "what's my next job?")
// returns { kind: 'assistant' } and falls through to the AI assistant unchanged.
//
// Conservative by design: a phrase only counts as navigation if it is EITHER
//   (a) exactly a known destination keyword, or
//   (b) prefixed with a nav verb ("go to", "open", "show me", "take me to", ...).
// This guarantees we never hijack real assistant requests.

import type { NexusTabId } from '@/components/nexus/ActionFlowSurface'

export type CommandResult =
  | { kind: 'tab'; tab: NexusTabId; label: string }
  | { kind: 'route'; href: string; label: string }
  | { kind: 'assistant' }

// Nav verbs that signal an explicit "take me there" intent.
const NAV_VERBS = [
  'go to', 'goto', 'go', 'open', 'show me', 'show', 'take me to', 'navigate to',
  'nav to', 'jump to', 'view',
]

// Tab destinations → the plain words people might type for each.
const TAB_KEYWORDS: { tab: NexusTabId; label: string; words: string[] }[] = [
  { tab: 'my-day', label: 'My Day', words: ['my day', 'home', 'today', 'dashboard', 'start'] },
  { tab: 'opps', label: 'Sales', words: ['sales', 'leads', 'lead', 'opportunities', 'opportunity', 'pipeline', 'crm', 'deals'] },
  { tab: 'jobs', label: 'Jobs', words: ['jobs', 'job', 'work orders', 'work order', 'job board'] },
  { tab: 'dispatch', label: 'Dispatch', words: ['dispatch', 'roster', 'assign techs', 'techs', 'technicians', 'whos available', "who's available"] },
  { tab: 'recent', label: 'Operations', words: ['operations', 'customers', 'customer', 'sites', 'site', 'properties', 'property', 'accounts'] },
  { tab: 'design', label: 'Design', words: ['design', 'designs', 'floor plan', 'floor plans', 'as-built', 'as built'] },
  { tab: 'systems', label: 'Systems', words: ['systems', 'system', 'devices', 'device health', 'installed devices', 'cameras'] },
  { tab: 'field', label: 'Money/Docs', words: ['money', 'docs', 'money/docs', 'invoices', 'invoice', 'billing', 'renewals', 'documents'] },
  { tab: 'people', label: 'Admin', words: ['admin', 'internal', 'users', 'team', 'people', 'access', 'settings'] },
]

// Direct deep-link shortcuts (exact-ish phrases only).
const ROUTE_SHORTCUTS: { href: string; label: string; words: string[] }[] = [
  { href: '/quotes/new', label: 'New Quote', words: ['new quote', 'create quote', 'start quote'] },
  { href: '/aria', label: 'ARIA', words: ['aria', 'run aria', 'research property', 'property research'] },
  { href: '/calendar', label: 'Calendar', words: ['calendar', 'schedule', 'my calendar'] },
]

// Tabs that only make sense for admins; non-admins fall through to the assistant.
const ADMIN_ONLY_TABS: NexusTabId[] = ['people']

function normalize(raw: string): string {
  return raw.trim().toLowerCase().replace(/[.!?]+$/g, '').replace(/\s+/g, ' ')
}

// Strip a leading nav verb if present. Returns { stripped, hadVerb }.
function stripNavVerb(input: string): { stripped: string; hadVerb: boolean } {
  for (const verb of NAV_VERBS) {
    if (input === verb) return { stripped: '', hadVerb: true }
    if (input.startsWith(verb + ' ')) return { stripped: input.slice(verb.length + 1).trim(), hadVerb: true }
  }
  return { stripped: input, hadVerb: false }
}

/**
 * Resolve a typed command. `isAdmin` gates admin-only destinations.
 * Returns an assistant fall-through for anything that isn't a clear nav command.
 */
export function routeCommand(raw: string, isAdmin = false): CommandResult {
  const input = normalize(raw)
  if (!input) return { kind: 'assistant' }

  // Help intent — send "how do i / how to / help / faq" questions to the
  // knowledge center so users find written answers. Checked before the
  // length gate so full questions ("how do i add a user") still route to help.
  if (
    input === 'help' || input === 'faq' || input === 'how' ||
    input.startsWith('how do i') || input.startsWith('how to') ||
    input.startsWith('how can i') || input.startsWith('how do you')
  ) {
    return { kind: 'tab', tab: 'help', label: 'Help' }
  }

  const { stripped, hadVerb } = stripNavVerb(input)
  const term = stripped || (hadVerb ? '' : input)

  // A command qualifies only if it had a nav verb OR the whole input is short
  // enough to be a destination name (≤ 3 words). Longer free text → assistant.
  const wordCount = input.split(' ').length
  const qualifies = hadVerb || wordCount <= 3
  if (!qualifies || !term) return { kind: 'assistant' }

  // Exact route shortcuts first.
  for (const r of ROUTE_SHORTCUTS) {
    if (r.words.includes(term)) return { kind: 'route', href: r.href, label: r.label }
  }

  // Tab keyword match (exact word match against the destination's word list).
  for (const t of TAB_KEYWORDS) {
    if (t.words.includes(term)) {
      if (ADMIN_ONLY_TABS.includes(t.tab) && !isAdmin) return { kind: 'assistant' }
      return { kind: 'tab', tab: t.tab, label: t.label }
    }
  }

  return { kind: 'assistant' }
}
