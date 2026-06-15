# Handoff Brief — Gemini: Nexus glass Calendar (clean, 5th-grader simple)

> Paste this ENTIRE doc into Gemini. Return ONE self-contained `.tsx`. Claude wires it to the real calendar API + local-first event store afterward. This REPLACES the current crowded calendar with a cleaner one.

## Standard (match exactly)
GateGuard Nexus — dark frosted-**glass** UI. Next.js App Router, TypeScript, Tailwind **core utilities only** (no UI libs).
- Cards: `rounded-2xl`/`rounded-3xl`, bg `rgba(255,255,255,0.035)`, border `1px solid rgba(255,255,255,0.08)`.
- Text: headings `rgba(255,255,255,0.9)`, secondary `rgba(255,255,255,0.5)`, faint `rgba(255,255,255,0.34)`. Accents: brand `#6B7EFF`, cyan `#00C8FF`. Category colors: Jobs `#C2410C`(orange), Sales `#00C8FF`(cyan), To-Dos `#8B5CF6`(violet), Google `#34D399`(green).
- **5th-grader simple + uncluttered.** This is the #1 goal — the current version is too busy. Start `'use client'`, default export, no required props, imports only `react` + `lucide-react`.
- **PWA-contained:** root is a contained card `className="w-full"` that flows in a column (NOT `h-[100dvh]`, NOT full-bleed). It renders inside an existing shell that already shows the page title "Schedule" — so do NOT repeat a big "My Day / Calendar" title inside. Just one slim toolbar + the calendar.

## Anti-clutter rules (important)
- **ONE slim toolbar row**, not two stacked cards. On it: view switch (Month · Week · Day · List) on the left; `‹ Today ›` + the current period label in the middle/right; **+ Add event** button on the right.
- **Category filters** = a single thin row of small toggle chips directly under the toolbar (Jobs / Sales / To-Dos / Google), each a colored dot + label, tap to show/hide. No "Show:" label card around them.
- A small **scope** control (My calendar / My team) as a tiny dropdown inline in the toolbar — not its own card.
- Lots of breathing room. No nested bordered boxes around boxes.

## Views
- **Month:** 7-col grid, current day highlighted, up to ~3 event chips per day then "+N more".
- **Week:** 7 day columns with events listed under each (simple, not an hourly grid).
- **Day:** single day, events listed newest/earliest first; "No events" empty state.
- **List:** upcoming events as a flat chronological list grouped by date.
- Each event chip: a category-colored dot + time + title; click → a small popover/card with title, time, where, and a "Open" link.

## Add event (modal)
A simple glass modal: Title, Date, Start time, End time, All-day toggle, optional Location, optional Notes, and a "Who can see it" = My calendar / My team. Save → `createEvent(...)`. Keep it short and friendly.

## Data contract (Claude wires these EXACT calls)
```ts
type CalCategory = 'jobs' | 'sales' | 'todos' | 'google'
type CalEvent = {
  id: string
  title: string
  start: string          // ISO
  end?: string | null    // ISO
  all_day?: boolean
  category: CalCategory
  location?: string | null
  href?: string | null   // where "Open" goes, if any
}
// GET  /api/calendar/events?scope=me|team&start=<ISO>&end=<ISO>  -> { events: CalEvent[] }
async function loadEvents(startISO: string, endISO: string, scope: 'me'|'team'): Promise<CalEvent[]>
// POST /api/calendar/events  body: { title, start, end, all_day, location, notes, scope }
//   (creates a LOCAL Nexus event; backend also pushes to Google) -> { event: CalEvent }
async function createEvent(form): Promise<CalEvent>
```
For the mockup, implement `loadEvents` with `setTimeout` returning ~6 events spread across the visible range with mixed categories, and `createEvent` that resolves a new event and adds it to state. All state in React `useState`. **No localStorage.**

## Output rules
ONE `.tsx`, `'use client'`, default export `CalendarViews`, no required props, all data behind `loadEvents`/`createEvent`, Tailwind core only. Safe lucide named imports: `ChevronLeft, ChevronRight, Plus, Calendar, X, Clock, MapPin, Check`. If you use any others, import them via `require('lucide-react')`.
