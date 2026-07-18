# Nexus Cosmetic Guide — July 2026 Mockup Evaluation & Change Log

**Source:** static mockup screenshot provided by Russel, 2026-07-18 ("NEXUS by Gate Guard — Global Management Console").

**Scope — read this first:** the mockup is a **cosmetic guide only**. The tabs, right-rail
menu items ("Quantum Storage," "Neural Flags," etc.), card contents, and integrations
shown (Salesforce/Jira/Adobe) are **placeholders** — they do NOT replace any existing
navigation, IA, or feature set. Everything below is about look and feel applied to our
**existing** UX.

---

## Evaluation — what the mockup does well

1. It keeps our identity: near-black navy base, cyan/blue glow, octagon badge, glass
   panels. It reads as an evolution of the current `NexusBackdrop` look, not a rebrand.
2. It introduces a **multi-accent card system** (blue / green / gold / violet per card)
   on top of our current cyan-only accent — this is the single biggest visual upgrade
   and gives dense grids scannability.
3. It's calmer: fewer competing glows, larger type hierarchy, more whitespace, one hero
   focal point (logo → greeting → command bar), then content.

Risks to watch: per-card accent colors can turn carnival-ish if applied to more than one
stat per card; the constellation background must stay far below the grid's current
contrast or text legibility drops on low-brightness screens.

---

## Change log (cosmetic deltas vs. current beta)

Each item: **what changes → where it lives today.**

### 1. Background: constellation mesh layer
- Mockup shows a subtle geodesic "constellation" line-and-node pattern across the whole
  backdrop, brightest near the top corners, replacing/augmenting the 48px cyan grid.
- → `components/nexus/NexusBackdrop.tsx` (`NexusBackdropLayers`). Add an optional
  `pattern="constellation"` layer (SVG or canvas, `pointer-events-none`) at very low
  alpha (≈ `rgba(0,200,255,0.05–0.08)` strokes). Keep the existing navy scrim (the
  `0.08` darkener) — the mockup base reads slightly deeper than current `NEXUS_BG`.

### 2. Hero block: badge glow ring + wordmark + chip
- Octagon logo sits in a soft circular glow; "NEXUS" in wide letter-spacing
  (~0.35em) with a small outlined pill chip beside it ("PLATFORM ECOSYSTEM" in the
  mockup — ours would say whatever the page is); "by GATE GUARD" microcopy beneath.
- Greeting pattern: dim first phrase + white bold second phrase
  ("Hi Russel, **what can NEXUS achieve…**").
- → Nexus home hero (`components/nexus/NexusHomeClient.tsx`). Pure styling; no copy or
  structure change required elsewhere.

### 3. Command bar: bigger pill, embedded actions
- Single large pill input (~radius-full), leading star/spark icon, trailing cluster:
  waveform, mic, and a circular submit button. Quick-action chips row directly beneath
  (thin 1px borders, dark glass fill, radius-full).
- → Ask-bar component on the Nexus home. Chips = restyle of the existing quick links;
  the chip style (border `rgba(255,255,255,0.12)`, fill `rgba(255,255,255,0.04)`)
  should become a shared `NexusChip` so How-To/EXECUTION-style buttons match.

### 4. Section header pattern: overline + question headline + right tag
- Small cyan caps overline ("SALES"), large white headline phrased as a question,
  one-line dim sub-caption, and a right-aligned outlined pill tag ("SALES OS").
- → Adopt as the standard glass-section header (Sales, Jobs, Operations surfaces).
  Today's section headers are plainer; this is a drop-in restyle.

### 5. Cards: per-card accent system  ⭐ biggest change
- Each card gets ONE accent hue: 1px border at ~35% alpha, faint outer glow, logo chip
  top-left, illustration top-right, title (second line bold), 2-line dim description,
  and a **bottom stat row** — value+label pairs separated by vertical hairlines, with
  at most one value tinted in the card's accent (e.g. the gold "Urgent T4").
- Suggested tokens (extend the current cyan/blue/indigo set):
  `--nx-accent-blue: rgba(0,124,255,*)` (existing) · `--nx-accent-green: rgba(52,211,153,*)`
  · `--nx-accent-gold: rgba(245,197,66,*)` · `--nx-accent-violet: rgba(139,92,246,*)`.
- → `components/nexus/NexusActionCard` (shared) — add an `accent` prop; every surface
  grid (Sales, Jobs, Internal…) inherits at once, same as the "Open →" facelift did.
- Guardrail: one accent per card, one tinted stat max, borders never above ~40% alpha.

### 6. Right rail styling (styling ONLY — items are placeholders)
- Caps-spaced two-line rail header, icon+label rows at comfortable vertical rhythm,
  no boxes — just spacing + hover glow. Bottom pinned outlined button
  (mockup's "EXECUTION GUIDE") matches the chip style from §3.
- → Apply to our existing rail/menu content wherever a Nexus-side rail exists. Do not
  add/remove/rename any menu items from the mockup.

### 7. Persistent helper affordances
- Dim caption under the card grid ("Pick one card above…") and the pill "? How-to"
  launcher bottom-right — we already have `HowToWindow`'s launcher; restyle to the
  chip/pill language (it's close already), keep position.

### 8. Avatar chip
- Top-right circular avatar with thin warm-gold ring — small, but it's the only warm
  accent outside cards, so keep gold reserved for avatar ring + "urgent" stats.

---

## Explicitly NOT in scope (placeholders in the mockup)
- Right-rail menu contents and order; bottom tab names; the third-party integrations
  shown on cards; any copy beyond the hero greeting pattern; the "GLOBAL MANAGEMENT
  CONSOLE" label. Existing IA and features stay exactly as they are.

## Suggested implementation order (all low-risk, shared-component first)
1. §5 card accent prop on `NexusActionCard` (biggest visible win, one file).
2. §3/§7 shared `NexusChip` + ask-bar restyle.
3. §4 section header pattern.
4. §1 constellation layer behind everything (flag it; easy to back out).
5. §2, §6, §8 polish pass.

Per standing rules: no edits to `globals.css`, `Sidebar.tsx`, `PortalShell.tsx`,
`layout.tsx` without explicit scoping — all of the above lands in Nexus components.
