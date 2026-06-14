# Handoff Brief — Gemini: Nexus **Dispatch** console (glass)

> Paste this ENTIRE doc into Gemini. Return ONE self-contained `.tsx`. Claude wires it to the real `/api/dispatch` afterward. This is the dispatcher's command console — NOT a job list (Jobs already has its own surface).

## Standard (match exactly)
GateGuard Nexus — dark frosted-**glass** UI. Next.js App Router, TypeScript, Tailwind **core utilities only** (no custom config, no UI libs).
- Cards/containers: `rounded-2xl`/`rounded-3xl`, bg `rgba(255,255,255,0.035)`, border `1px solid rgba(255,255,255,0.08)`.
- Text: headings `rgba(255,255,255,0.9)`, secondary `rgba(255,255,255,0.5)`, faint `rgba(255,255,255,0.34)`. Accents: brand `#6B7EFF`, cyan `#00C8FF`, emerald `#34D399` (available/online), amber `#FBBF24` (driving/needs action), violet `#8B5CF6`, red `#F87171` (urgent).
- Inline `style={{}}` rgba() fine. Mobile-friendly; end with `pb-28`. **5th-grader simple.** Start with `'use client'`, default export, no required props, imports only `react` + `lucide-react`.

## What this is (one job)
A dispatcher opens this to answer: **"Who's free, and what still needs a tech?"** Two columns: jobs that need assigning on the left, the tech roster (by live status) on the right. Drag-free: you click a job, click a tech, it's assigned. Plus a simple day schedule strip.

## Layout
1. **Header** — "Dispatch" + subtitle ("Assign jobs to techs and see who's available right now."). A small live stat row: Unassigned · Assigned today · Techs available · Techs on site.
2. **Two-column body** (stacks on mobile):
   - **Left — Jobs needing a tech:** filter chips (All · Urgent · Unassigned · In Progress). Each job card: title + property, a priority pill (urgent red / normal cyan / scheduled faint), status pill (Pending/Assigned/In Progress), ETA, WO number, and the assigned tech name (or "Unassigned"). Clicking a job selects it (highlight) and reveals an **Assign to…** inline picker of available techs.
   - **Right — Tech roster:** grouped by status (Available, On Site, Driving, Offline). Each tech row: initials avatar, name, role, a status dot (emerald/violet/amber/faint), current job if any, and a small status changer (Set Available / On Site / Driving / Offline).
3. **Bottom — Today's schedule strip:** a simple horizontal timeline of today's assigned jobs (time + property + tech), read-only is fine.

Keep it calm and roomy — match the dashboard card quality, not a dense table.

## Object-format note
If a job card is expanded, show the same shape used everywhere: top line (title/property), 4 quick facts (priority, status, ETA, WO#), then the assign action. Don't invent a different layout.

## Data contract (Claude replaces stubs with these EXACT shapes)
```ts
type DispatchStatus = 'Pending' | 'Assigned' | 'In Progress' | 'Completed'
type Priority = 'urgent' | 'normal' | 'scheduled'
type TechStatus = 'Available' | 'On Site' | 'Driving' | 'Offline'

type Job = {
  id: string
  title: string | null
  property: string | null       // customer/property name
  jobType?: string | null
  assignedTech: string | null   // null = unassigned
  assignedTechId: string | null
  eta: string                   // ISO date or 'TBD'
  priority: Priority
  status: DispatchStatus
  woNumber?: string | null
  site_id?: string | null
}
type Tech = {
  id: string
  name: string
  initials: string
  role: string
  status: TechStatus
  currentJobId: string | null
}

// GET /api/dispatch -> { jobs: Job[], techs: Tech[] }
async function loadDispatch(): Promise<{ jobs: Job[]; techs: Tech[] }>

// Assign a job to a tech (Claude wires to PATCH work order + tech.current_job_id)
function onAssign(jobId: string, techId: string): void            // console.log for mock

// Change a tech's status (Claude wires to PATCH /api/dispatch/technicians/[id] { status })
function onSetTechStatus(techId: string, status: TechStatus): void // console.log for mock

// Open the full job (Claude wires to the Job glass / /maintenance/[id])
function onOpenJob(jobId: string): void                            // console.log for mock
```
For the mock, implement `loadDispatch()` with `await new Promise(r=>setTimeout(r,300))` returning ~6 jobs (mix of unassigned/assigned, urgent/normal, a couple In Progress) and ~6 techs across all four statuses. Keep all state in React `useState`; `onAssign`/`onSetTechStatus` should optimistically update local state so the UI feels live. **No localStorage.**

## Output rules
ONE `.tsx`, `'use client'`, default export `DispatchConsole`, no required props, all data behind the stubs above, Tailwind core utilities only. Safe lucide named imports: `Search, Check, Clock, Phone, User, Users, MapPin, Wrench, ChevronRight, Plus`. If you use any of these, import them via `require('lucide-react')`: `Truck, ArrowLeft, Radio, Navigation, Circle, AlertCircle`.
