# Handoff Brief — Gemini: Nexus **Design** tab (Floor Plan → System Design → As-Built)

> Paste this ENTIRE doc into Gemini. Return ONE self-contained `.tsx`. Claude wires it to real APIs afterward. This is the bottom-nav **Design** surface.

## Standard (match exactly)
GateGuard Nexus — dark frosted-**glass** UI. Next.js App Router, TypeScript, Tailwind **core utilities only** (no custom config, no UI libs).
- Cards/containers: `rounded-2xl`/`rounded-3xl`, bg `rgba(255,255,255,0.035)`, border `1px solid rgba(255,255,255,0.08)`.
- Text: headings `rgba(255,255,255,0.9)`, secondary `rgba(255,255,255,0.5)`, faint `rgba(255,255,255,0.34)`. Accents: brand `#6B7EFF`, cyan `#00C8FF`, violet `#8B5CF6`, emerald `#34D399`.
- Inline `style={{}}` rgba() fine. Mobile-friendly; end with `pb-28`. **5th-grader simple.** Start with `'use client'`, default export, no required props, imports only `react` + `lucide-react`.

## The big idea (state this in the UI)
Every property has ONE **Design** record that moves through three stages, all linked and versioned:
1. **Floor Plan** — the drawing before install (rooms, doors, gates).
2. **System Design** — devices placed + specced on that plan (cameras, readers, intercoms, NVR, cabling).
3. **As-Built** — the confirmed post-install version (what's actually on site).
The Design tab is where someone picks a property and sees those three stages + jumps into the drawing tool.

## Layout
1. **Header** — "Design" + one-line subtitle ("Floor plans, system designs, and as-builts for every property.").
2. **Search + list** — search box; a list of design records (one per property). Each row: property name, address, a 3-dot **stage tracker** (Floor Plan ● System Design ● As-Built — filled = done, hollow = not yet, current stage highlighted), device count, last-updated relative time.
3. Click a row → **detail glass pane** (object-format below).

## Object-format rule (every Nexus detail looks the same)
1. **Big top card** — label "DESIGN", property name, address, current stage badge.
2. **Four quick facts** row — Stage · Devices placed · Plans (versions) · Last updated. 4 columns.
3. **Human detail blocks**:
   - **Stages** — three cards (Floor Plan / System Design / As-Built): each shows status (Done / In progress / Not started), version number, who updated, a thumbnail placeholder, and an "Open" link.
   - **Devices** — grouped count chips by type (Cameras, Readers, Intercoms, Gates, NVR/Switches) with totals.
   - **BOM summary** — a few line items (qty × name) + a total count.
   - **Activity** — 3–4 recent entries ("System Design v2 saved by …").
4. **Right action rail** — most common first: **Open in drawing tool** (stub `onAction('open_drawing', id)`), **Promote to As-Built**, **Export BOM**, **New version**, **Add note**.
5. Internal scroll + bottom padding.

## Data contract (Claude replaces stubs with these)
```ts
type Stage = 'floor_plan' | 'system_design' | 'as_built'
type StageState = { stage: Stage; status: 'done'|'in_progress'|'not_started'; version: number; updated_by?: string; updated_at?: string }
type DesignRecord = {
  id: string
  property_name: string
  address?: string | null
  current_stage: Stage
  stages: StageState[]                 // always 3, in order
  device_counts: { type: string; count: number }[]
  bom: { name: string; qty: number }[]
  device_total: number
  plan_versions: number
  last_updated: string
  activity: { at: string; text: string }[]
}
// GET /api/nexus/design            -> { records: DesignRecord[] }
async function loadDesigns(): Promise<DesignRecord[]>
// onAction(name, id) -> console.log (Claude wires: open_drawing → /design/floor-plans?plan=<id>)
```
Provide `loadDesigns()` with ~7 realistic records (mix of stages — some only have a floor plan, some fully as-built). All state in React `useState`. **No localStorage.**

## Output rules
ONE `.tsx`, `'use client'`, default export `DesignExplorer`, no required props, data behind `loadDesigns()`/`onAction()`, Tailwind core only. Safe lucide named imports: `Search, Check, Plus, FileText, Download, Layers,  ChevronRight`. If you want any of `LayoutGrid, Map, Image, Pen, Cpu`, import them via `require('lucide-react')`.
