# Handoff Brief — ChatGPT: Nexus Jobs Calendar/Board view

> Paste this ENTIRE doc into ChatGPT. Return ONE self-contained `.tsx`. Claude wires it to the real org-scoped jobs API afterward.

## Standard (match exactly)
GateGuard Nexus — dark frosted-**glass** UI. Next.js App Router, TypeScript, Tailwind **core utilities only** (no custom config, no UI libs).
- Cards/containers: `rounded-2xl`/`rounded-3xl`, bg `rgba(255,255,255,0.035)`, border `1px solid rgba(255,255,255,0.08)`.
- Text: headings `rgba(255,255,255,0.9)`, secondary `rgba(255,255,255,0.5)`, faint `rgba(255,255,255,0.34)`. Accents: brand `#6B7EFF`, cyan `#00C8FF`, amber `#F59E0B` (jobs).
- Inline `style={{}}` with rgba() is fine. Mobile-friendly; end with `pb-28`.
- 5th-grader simple, plain labels, no dead-ends. **Card grids use 4 columns** (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`) where cards are shown.
- Start file with `'use client'`. Default export. **No required props.** Imports: only `react` + `lucide-react`.

## Task — `JobsCalendar`
A scheduling view for field jobs with **two modes** toggled by pills: **Calendar** (Month + Week + Day) and **List**.
- Prev/Next/Today nav + current-period label.
- Each job shows as a chip colored by status: open `#94a3b8`, scheduled `#F59E0B`, in_progress `#6B7EFF`, completed `#34d399`, cancelled `#64748b`.
- Day cells: up to 3 chips + "+N more"; click a day → Day view.
- Click a job chip → lightweight glass popover: title, wo_number, status, scheduled time, assignee, site/customer, and an "Open job" button calling stub `onOpenJob(id)` (console.log).
- A **filter row**: status filter chips (Open/Scheduled/In progress/Completed) toggle show/hide.
- Empty states per mode.

## Data contract (real API shape — `/api/nexus/jobs/workbench` returns sections of these)
```ts
type Job = {
  id: string
  wo_number: string | null
  title: string
  status: 'open' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_date: string | null   // YYYY-MM-DD
  scheduled_time?: string | null   // HH:MM
  assignee_name?: string | null
  customer_name?: string | null
  site_name?: string | null
}
```
Provide `async loadJobs(): Promise<Job[]>` returning ~14 mock jobs across several days and all statuses.

## Output rules
ONE `.tsx`, default export `JobsCalendar`, no required props, all data behind `loadJobs()`/`onOpenJob()` stubs, no localStorage, Tailwind core only.
