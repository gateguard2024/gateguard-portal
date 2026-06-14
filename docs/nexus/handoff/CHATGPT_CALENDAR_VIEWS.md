# Handoff Brief — ChatGPT: Nexus Calendar Views component

> Paste this ENTIRE document into ChatGPT. It returns ONE self-contained `.tsx` file. A separate engineer (Claude) will wire it to the real API afterward — your job is the UI + interactions on mock data.

---

## Who/what this is for

You are building one React component for **"GateGuard Nexus"** — a dark, frosted-**glass** interface (Next.js App Router, TypeScript, Tailwind core utilities only — no custom Tailwind config, no external UI libraries). The component is the **Calendar** for the "My Day" tab.

## Glass visual standard (match exactly)

- Dark translucent surfaces on a transparent page background (the parent provides the dark gradient).
- Cards/containers: `rounded-3xl` or `rounded-2xl`, background `rgba(255,255,255,0.035)`, border `1px solid rgba(255,255,255,0.08)`.
- Text: white at opacity — headings `rgba(255,255,255,0.9)`, secondary `rgba(255,255,255,0.5)`, faint `rgba(255,255,255,0.34)`.
- Accents: brand blue `#6B7EFF`, cyan `#00C8FF`, violet `#8B5CF6`.
- Inline `style={{ ... }}` with rgba() is fine and common in this codebase. Use Tailwind core classes for layout.
- Mobile-friendly. Generous bottom padding (a fixed bottom nav must never cover content — end the component with `pb-28`).
- 5th-grader simple. Plain labels. No backend jargon. No dead-end buttons.

## The task — Calendar Views

Build `CalendarViews` with **four view modes** the user can switch between via pill buttons:

1. **Month** — a 7-column month grid; each day cell shows up to 3 event chips + "+N more"; today highlighted; click a day → switch to Day view for that date.
2. **Week** — 7 day columns for the current week with time-ordered event chips.
3. **Day** — a single day, events listed in time order with start–end times.
4. **List** — upcoming events as a flat chronological list grouped by date.

Common requirements:
- Prev/Next/Today navigation + a visible current-period label (e.g., "June 2026", "Jun 10–16", "Mon, Jun 10").
- **Color-code events by `type`** using this exact map:
  - `todo` → `#6B7EFF` · `work_order` → `#059669` · `work_order_phase` → `#C2410C` · `pm_schedule` → `#0B7285` · `gcal` → `#7C3AED` · `crm_activity` → `#0EA5E9` · `tracker_task` → `#8B5CF6`
- A small legend showing the type colors.
- Clicking an event opens a lightweight glass popover/panel showing: title, type (plain label), start–end, and an "Open" button (stub `onOpen(event)` — just `console.log` for now).
- An "Add event" button top-right that opens a simple inline form (title, date, start time, end time, type select) and calls a stub `onCreate(payload)` (console.log) then closes.
- All-day events (no time) render as a full-width chip.
- Empty states ("No events") per view.

## Data contract (so it wires up later)

Provide an async stub `loadEvents(rangeStartISO, rangeEndISO)` that returns mock data shaped EXACTLY like this (the real API `/api/calendar/events` returns this shape):

```ts
type CalEvent = {
  id: string
  title: string
  type: 'todo' | 'work_order' | 'work_order_phase' | 'pm_schedule' | 'gcal' | 'crm_activity' | 'tracker_task'
  start_time: string   // ISO timestamp
  end_time: string | null
  is_all_day?: boolean
  owner_name?: string | null   // who it belongs to (for the future hierarchy filter)
}
```

Seed ~12 mock events across several days and all types so every view + color is visible.
Also include a **disabled** "Whose calendar" dropdown stub (label: "Me" / "My team") — the hierarchy filter will be wired later; show it but it can be non-functional.

## Output rules

- Return **ONE** `.tsx` file, default export `CalendarViews`, **no required props** (all stubbed/mock internally).
- Imports: only `react` and `lucide-react`.
- No localStorage/sessionStorage. No data libraries. No Tailwind classes outside the core set.
- Keep all data access behind `loadEvents()` / `onCreate()` / `onOpen()` stubs so it can be wired to the real API later.
- Do not add `'use client'` concerns beyond a normal client component (start the file with `'use client'`).
