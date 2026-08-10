/**
 * lib/proposal-modules.ts — the proposal MODULE ENGINE (Phase 1).
 *
 * A proposal is an ordered stack of interchangeable content modules plus one
 * pricing module. This file is the single source of truth for:
 *   - the block types + their default copy (the "module library")
 *   - deriving a sensible default stack from an existing quote (no backfill)
 *   - computing totals the same way everywhere (builder preview AND public page)
 *
 * The renderer (components/public/ProposalView.tsx) maps each block type to JSX;
 * the future builder (Phase 2) reorders/toggles these same blocks. Corporate can
 * later edit the default copy here without touching any page.
 */

export type ProposalBlockType =
  | 'hero'          // headline + monthly badge + prepared-for
  | 'cover_letter'  // personal note from the rep
  | 'problem'       // the pain / "the cycle"
  | 'included'      // what you get (INCLUDED cards) + stat strip
  | 'costs_gone'    // costs that disappear
  | 'cameras'       // visibility / incident reporting
  | 'value_props'   // why it wins (grid)
  | 'testimonial'   // customer quote
  | 'quote'         // the pricing block (setup + recurring + optional add-ons)
  | 'payment_schedule' // deposit / ramp-up / milestone schedule
  | 'attachments'   // downloadable spec sheets / docs
  | 'agreement'     // collapsible service agreement / SOW
  | 'close'         // sign / accept

export interface ProposalBlock {
  type: ProposalBlockType
  enabled: boolean
  /** Per-block copy/content overrides. Falls back to the module default. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vars?: Record<string, any>
}

export interface ModuleDef {
  type: ProposalBlockType
  label: string
  /** Core modules can be reordered but never removed (quote, close). */
  core?: boolean
  /** Default copy / structured content for this module. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultVars: Record<string, any>
}

/** The palette the builder shows, in a sensible default order. */
export const MODULE_LIBRARY: ModuleDef[] = [
  { type: 'hero', label: 'Hero / headline', defaultVars: {
    kicker: 'YOUR GATE GUARD · PROPOSAL',
    headline: 'Stop paying to fix the same gates.',
    subhead: 'One fixed monthly price covers every gate — every part, every repair, every camera. Fix it once; then it is our problem forever.',
  } },
  { type: 'cover_letter', label: 'Cover letter', defaultVars: {
    title: 'Thank you for the opportunity',
    body: 'It was great meeting with your team and learning about your operational and security goals. Based on our conversation, I put together the program below and I am confident we can make your gates run smoothly and dependably.',
  } },
  { type: 'problem', label: 'The problem / cycle', defaultVars: {
    kicker: 'THE CYCLE',
    title: 'You have paid for these gates more than once',
    steps: [
      { h: '1 · It breaks', p: 'A gate goes down. Residents cannot get in.' },
      { h: '2 · You pay', p: 'Trip charge, parts, labor. A bill nobody budgeted.' },
      { h: '3 · It works', p: 'For a few weeks. Maybe a couple months.' },
      { h: '4 · It breaks', p: 'Same gate. New invoice. Back to step one.' },
    ],
  } },
  { type: 'included', label: 'What you get', defaultVars: {
    kicker: 'WHAT YOU GET',
    title: 'One price. Every gate. Every repair.',
    // items fall back to the quote's whats_included when present
    items: [
      { h: 'Repair or replace to full operating condition', p: 'Whatever it takes — parts, welding, replacement. After that every repair is ours: parts, labor, PM, and no trip charges.' },
      { h: 'Brivo Mobile Pass + full PMS integration', p: 'Residents enter by phone. Yardi, Entrata & RealPage sync move-ins and move-outs automatically.' },
      { h: 'Daily camera monitoring & reporting', p: 'Watched, not just recorded. When a gate gets hit, you know who hit it.' },
    ],
  } },
  { type: 'costs_gone', label: 'Costs that vanish', defaultVars: {
    kicker: 'WHAT GOES AWAY',
    title: 'Costs you stop paying entirely',
    items: [
      { h: 'Fobs & cards', p: 'Bought at every move-in, lost at every move-out. Reorders stop.' },
      { h: 'DoorKing fees', p: 'Phone line and DKS charges go away with the hardware.' },
      { h: 'Staff time on the resident list', p: 'PMS integration makes the manual data entry disappear.' },
      { h: 'Surprise repair invoices', p: 'No trip charges, parts bills, or emergency labor. One fixed number.' },
    ],
  } },
  { type: 'cameras', label: 'Cameras / visibility', defaultVars: {
    kicker: 'VISIBILITY',
    title: 'Know who damaged the gate',
    items: [
      { h: 'Monitored, not just recorded', p: 'Every vehicle through the main entry is watched in real time.' },
      { h: 'Damage, attributed', p: 'Video of the vehicle that did it — charged to them, not your budget.' },
    ],
  } },
  { type: 'value_props', label: 'Why it wins', defaultVars: {
    kicker: 'WHY IT WINS',
    title: 'Turn an expense into a profit center',
    items: [
      { h: 'Fixed monthly cost', p: 'Predictable budget. No hidden repair costs, no replacement fobs.' },
      { h: 'Boost NOI & cap rate', p: 'Offset instantly with a resident-paid amenity fee at move-in.' },
      { h: 'Zero trip charges', p: 'Every reactive repair covered. PM performed monthly.' },
      { h: 'Portfolio discounts', p: 'Up to 20% off across your properties, +5% on autopay.' },
    ],
  } },
  { type: 'testimonial', label: 'Testimonial', defaultVars: {
    quote: 'Now it’s a non-issue. They catch mechanical glitches before our drivers even notice a delay. Having a team that just makes it happen has saved us countless hours of frustration.',
    author: 'Bill P.', role: 'Regional Manager',
  } },
  { type: 'quote', label: 'The quote', core: true, defaultVars: {} },
  { type: 'payment_schedule', label: 'Payment schedule', defaultVars: { title: 'Payment schedule' } },
  { type: 'attachments', label: 'Attachments', defaultVars: { title: 'Attachments & spec sheets' } },
  { type: 'agreement', label: 'Service agreement', defaultVars: {} },
  { type: 'close', label: 'Close / sign', core: true, defaultVars: {
    title: 'Let’s work together',
    body: 'Happy to move forward? Accept below and we get to work.',
  } },
]

export function moduleDef(type: ProposalBlockType): ModuleDef | undefined {
  return MODULE_LIBRARY.find(m => m.type === type)
}

/**
 * Derive a default module stack from an existing quote so every quote renders
 * with zero backfill. Modules only turn on when the quote actually has content
 * for them (cover message, whats_included, agreement, etc.).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function defaultBlocksFor(quote: any): ProposalBlock[] {
  const has = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== ''
  const stack: ProposalBlock[] = [
    { type: 'hero', enabled: true },
    { type: 'cover_letter', enabled: has(quote?.cover_message), vars: has(quote?.cover_message) ? { body: quote.cover_message } : undefined },
    { type: 'problem', enabled: true },
    { type: 'included', enabled: true },
    { type: 'costs_gone', enabled: true },
    { type: 'value_props', enabled: true },
    { type: 'quote', enabled: true },
    { type: 'payment_schedule', enabled: Array.isArray(quote?.payment_schedule_json) && quote.payment_schedule_json.length > 0 },
    { type: 'attachments', enabled: Array.isArray(quote?.attachments) && quote.attachments.length > 0 },
    { type: 'agreement', enabled: has(quote?.agreement_html) || has(quote?.sow_text) || has(quote?.agreement_type) },
    { type: 'close', enabled: true },
  ]
  return stack
}

/** Resolve the stack to render: saved blocks if present, else the default. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveBlocks(quote: any): ProposalBlock[] {
  const saved = quote?.proposal_blocks
  if (Array.isArray(saved) && saved.length) {
    return saved.filter((b: ProposalBlock) => b && b.type)
  }
  return defaultBlocksFor(quote)
}

// ── Pricing (shared by builder preview + public page) ────────────────────────

export interface PricedLine {
  id: string
  description: string
  qty: number
  unitPrice: number
  total: number
  recurring?: boolean
  is_optional?: boolean
  is_included?: boolean
  section_name?: string
  unit?: string
  notes?: string
}

export interface ProposalTotals {
  oneTime: number        // required one-time (non-optional)
  recurring: number      // required recurring (non-optional)
  optionalRecurring: number   // selected optional recurring
  optionalOneTime: number     // selected optional one-time
  monthly: number        // recurring + selected optional recurring
  setup: number          // oneTime + selected optional one-time
  dueToday: number       // setup + first month (monthly)
}

/**
 * Compute totals identically everywhere. `selectedOptional` is the set of
 * optional line ids the client has toggled ON.
 */
export function computeTotals(lines: PricedLine[], selectedOptional: Set<string>): ProposalTotals {
  let oneTime = 0, recurring = 0, optRec = 0, optOne = 0
  for (const l of lines) {
    const amt = typeof l.total === 'number' ? l.total : (l.qty * l.unitPrice)
    if (l.is_optional) {
      if (!selectedOptional.has(l.id)) continue
      if (l.recurring) optRec += amt; else optOne += amt
    } else {
      if (l.recurring) recurring += amt; else oneTime += amt
    }
  }
  const monthly = recurring + optRec
  const setup = oneTime + optOne
  return { oneTime, recurring, optionalRecurring: optRec, optionalOneTime: optOne, monthly, setup, dueToday: setup + monthly }
}
