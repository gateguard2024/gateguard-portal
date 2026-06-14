# Handoff Brief — Gemini: Nexus Customer/Site Finder (REBUILD against real search API)

> Paste this ENTIRE doc into Gemini. Return ONE self-contained `.tsx`. Claude wires the two fetches afterward. This REPLACES the current mock-only CustomerSiteFinder with a real search-as-you-type finder.

## Standard (match exactly)
GateGuard Nexus — dark frosted-**glass** UI. Next.js App Router, TypeScript, Tailwind **core utilities only**.
- Cards/containers: `rounded-2xl`/`rounded-3xl`, bg `rgba(255,255,255,0.035)`, border `1px solid rgba(255,255,255,0.08)`.
- Text: headings `rgba(255,255,255,0.9)`, secondary `rgba(255,255,255,0.5)`, faint `rgba(255,255,255,0.34)`. Accents: brand `#6B7EFF`, cyan `#00C8FF`.
- **5th-grader simple, professional 2036 glass.** Start with `'use client'`, default export, no required props, imports only `react` + `lucide-react`.
- **PWA-CONTAINED (important):** the root element must be a contained card, NOT full-screen. Use `className="flex w-full h-[70dvh] overflow-hidden rounded-3xl"` with internal scroll — do NOT use `h-[100dvh]` or `bg-black/40` full-bleed. It renders inside an existing glass shell.

## Behavior (how it actually works now)
This is **search-as-you-type**, not a preloaded list. There are no separate "Customers" and "Properties" datasets to load up front — there's ONE search endpoint that returns mixed results, and a detail endpoint you call when a result is clicked.

1. A search box at top. As the user types (debounce ~250ms, min 2 chars), call `searchAll(query)`.
2. Results render as a single list of cards. Each result shows an icon by `type`, the `title`, the `subtitle`, and optional `meta`. Group them with small headers by type (Companies, Contacts, Customers, Properties, Sites) OR show simple filter chips (All · Customers · Properties · Companies · Contacts · Sites) — your call, keep it clean.
3. Clicking a result calls `loadDetail(type, id)` and shows a **detail glass pane** (object-format): big top card with title + subtitle + a type chip, then the `details` rendered as clean label/value rows. A "Back" button returns to the results. Action-rail buttons are stubs → `onAction(name, {type,id})` (console.log).
4. Empty states: before typing → a friendly hint ("Search a customer, property, company, or contact."); no results → "No matches yet."

## Data contract (Claude will wire these EXACT calls — build stubs shaped like them)
```ts
type ResultType = 'company' | 'contact' | 'customer' | 'property' | 'site'

type SearchResult = { id: string; type: ResultType; title: string; subtitle: string; meta?: string; href?: string }

type DetailResponse = {
  type: ResultType
  id: string
  title: string
  subtitle: string
  details: { label: string; value: string }[]   // render these as rows
}

// GET /api/nexus/customers-sites/search?q=<query>  ->  { success: true, results: SearchResult[] }
async function searchAll(query: string): Promise<SearchResult[]>

// GET /api/nexus/customers-sites/detail?type=<type>&id=<id>  ->  { success: true, detail: DetailResponse }
async function loadDetail(type: ResultType, id: string): Promise<DetailResponse>

// onAction(name, ref) -> console.log  (Claude wires: open_record, new_quote, new_job, add_note)
```
For the mockup, implement `searchAll()` to filter ~10 in-memory mixed results by the query (with `await new Promise(r=>setTimeout(r,250))`), and `loadDetail()` to return a DetailResponse with ~6 label/value rows for the selected item. All state in React `useState`. **No localStorage.**

## Output rules
ONE `.tsx`, `'use client'`, default export `CustomerSiteFinder`, no required props, all data behind `searchAll`/`loadDetail`/`onAction`, Tailwind core only. Safe lucide named imports: `Search, Building2, User, MapPin, Check, ChevronRight, Plus, FileText`. If you want any of `ArrowLeft, Briefcase, DoorOpen, Camera`, import them via `require('lucide-react')`.
```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowLeft } = require('lucide-react') as any
```
