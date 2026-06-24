# Work Orders & Dispatch — Audit vs. Field-Service Software

_June 24, 2026. How Nexus work orders compare to Housecall Pro, ServiceTitan, Jobber, FieldEdge — what's built, what's table-only, what's missing._

Key finding: **the schema is well ahead of the UI.** Tables already exist for multi-visit, multi-tech crews, subcontractors, and time tracking — but several aren't wired into the drawer or `/tech` yet. So a lot of this is "expose what we already have," not "build from scratch."

---

## Your questions, answered

### 1. Calendar / Gantt / List views? Multiple visits per WO?
| View | Status |
|---|---|
| **List** (Work Orders tab) | ✅ built |
| **Board** (Dashboard, drag-drop by status) | ✅ built |
| **Calendar** (day view; shows WOs + job phases) | ✅ built |
| **Gantt** | ⚠️ exists in `/tracker` and `/projects` only — **not** wired to work orders/dispatch |
| **Map** (tech locations / routing) | ⚠️ partial (`/api/dispatch/optimize` + tech location table exist; no live dispatch map view) |

**Multiple visits per WO:** ⚠️ **partial.** `work_order_phases` (name, scheduled/end date, status, order) + its API exist, and phases already render on the Calendar. But there's **no phase editor in the WO drawer**, and `/tech` shows a *demo* install-phase flow (hardcoded), not the real phases. So multi-visit is half-built — data + calendar yes, day-to-day management no.

### 2. Assign multiple resources to a WO?
⚠️ **Backend yes, UI no.** `work_order_crew` (roles: lead/crew/supervisor/owner) and `work_order_subcontractors` tables + APIs exist. But the drawer only has a **single "Assigned to"** dropdown — no crew picker. So today a WO = one tech in the UI.

### 3. Assignable to a tech, visible in `/tech`?
✅ **Yes** — fixed this session. Assign in Operations Hub → it flows to the tech's **My Jobs** in `/tech` (per-tech login resolves identity from the code).

### 4. Capturing hours & parts across all visits?
⚠️ **Captured, but at the WO level — not per visit.** `work_order_time_entries` (clock in/out, labor minutes, per technician) + `work_order_parts`/`wo_parts_used` are wired (drawer "Log labor" / "Add part", job-costs rollup). But time entries have **no phase/visit link**, so you can't break hours or parts down by visit — it's one bucket for the whole job.

### 5. Tech utilization & re-work management?
❌ **Neither exists.** No utilization metric (billable vs available hours, % utilized, capacity), and no re-work/callback tracking (no callback flag, warranty-return linkage, or first-time-fix rate). This is the biggest gap vs. ServiceTitan/FieldEdge.

---

## What we already have (strong foundation)
Core WO, status board + list + calendar, drag-drop status, per-tech `/tech` with checklist/procedures, **photos** (before/during/after), **signature capture**, **parts + labor + job-cost rollup**, **playbooks/templates**, **PM schedules**, **requests → convert to WO**, **procurement/POs**, AI pre-job brief + photo-diagnose, work-order **reviews** table, call logs, comments/chat, installed-equipment capture, print work order, tech email notifications.

That's already comparable to mid-tier field software on the *execution* side.

---

## Gaps vs. Housecall Pro / ServiceTitan / Jobber / FieldEdge

**Tier 1 — expose what we already have (low effort, high value)**
1. **Crew on a WO** — surface `work_order_crew` in the drawer (add multiple techs + roles). Show all of a crew member's jobs in `/tech`.
2. **Visits/phases as first-class** — phase editor in the drawer; each phase schedulable + assignable; `/tech` shows the real phases; drag phases on the calendar.
3. **Hours & parts per visit** — add `phase_id` to time entries + parts so each visit rolls up its own labor/material.

**Tier 2 — the operational analytics that set the leaders apart**
4. **Tech utilization dashboard** — scheduled vs available hours, % utilized, jobs/day, revenue/tech.
5. **Re-work / callback tracking** — flag a WO as a callback, link it to the original, measure **first-time-fix rate** and warranty re-work cost.
6. **Drag-drop dispatch board** — assign + reschedule by dragging on a tech-by-time grid (not just status columns).
7. **SLA / response timers** — due-by clocks, breach alerts, priority response targets.

**Tier 3 — customer-facing parity (what Housecall Pro/Jobber win on)**
8. **"On my way" / ETA + appointment-reminder SMS** to the customer.
9. **Customer self-scheduling / booking** (ties into the Schedule app you just relocated).
10. **In-field estimate → invoice → payment** with a price book; collect payment on site.
11. **Recurring jobs / service agreements / memberships** (recurring revenue — FieldEdge/ServiceTitan core).
12. **Automated review requests** post-completion (the `work_order_reviews` table is ready).
13. **Live GPS tracking + route optimization** (location table + `/optimize` exist; needs a real map + auto-routing).
14. **Timesheets / payroll export** from time entries; **QuickBooks** two-way.

---

## Recommended sequence
**Phase 1 (this is mostly wiring, days not weeks):** crew picker in drawer → real phases in drawer + `/tech` → `phase_id` on time/parts. That alone gives you multi-visit, multi-resource, per-visit costing.
**Phase 2:** utilization dashboard + callback/first-time-fix tracking (the analytics buyers ask about).
**Phase 3:** customer-facing (ETA SMS, self-scheduling, in-field payment) to match Housecall Pro.

Net: on **field execution** you're already near parity; the real differentiators to close are **per-visit costing, crew, utilization/re-work analytics, and customer-facing scheduling/payment.**
