# Events Module — Plan (property events: lunch & learns, launch parties, meet & greets, trade shows)

> Status: PLAN ONLY — no code yet. Confirm before building.
> Decisions locked: dedicated module · full event-operations workflow · dealers + corporate · new "Events" tab.

---

## 1. Where it lives

- **New "Events" tab** in the Nexus nav (bottom pill + launch-pad), visible to dealers and corporate.
- **Board view** (default): event cards grouped by time (Upcoming / This month / Past) with filters
  (type, property, host rep, status). Each card shows type, title, property, date, status pill, and a
  mini workflow-progress bar.
- **Event glass window** (opens on a card): the workspace shown in the mockup — header + 8-stage
  stepper + panels. Same glass-window pattern as Lead / Job windows.
- **Calendar integration:** every event also appears on the Schedule as a new **"Event"** category
  (distinct color), so it shows up alongside jobs/tasks.

---

## 2. Workflow (the 8 stages)

1. **Plan** — create the event: type, property/site (or ARIA prospect), host rep, date/time, venue,
   goal, budget, expected attendance.
2. **Supplies & materials** — order banners, catering, one-pagers, demo kits; track
   Needed → Ordered → Received, with vendor, cost, and needed-by date.
3. **Email campaign** — staged sends: Save-the-date → Invitation → Reminder → Confirmation →
   Thank-you. Each step has an audience, send date, template, and status (Draft/Scheduled/Sent).
   Reuses the existing Gmail/Messages send pipeline.
4. **Pre-event checklist** — tasks by category (Marketing / Supplies / Logistics / Ops) with owner +
   due date. (Can reuse the tracker/todo engine under the hood.)
5. **Confirmations** — RSVP / guest list: Invited → Yes / Maybe / No → Attended. One-tap
   **convert a confirmed guest to a Lead** (CRM).
6. **Ops & install coordination** — link the event to work orders / installs so timing lines up
   (e.g., demo gate installed the morning before). Pulls from the Operations board.
7. **Held** — run day: capture actual attendance, quick notes/photos.
8. **Follow-up / ROI** — convert attendees, log outcomes + photos, and a simple ROI view
   (budget vs pipeline created + leads generated).

Status field mirrors the stages: `planning → promoting → confirmed → held → follow_up → complete`
(+ `cancelled`).

---

## 3. Data model (new tables — all with GRANT + RLS)

- **`property_events`** — the event. Fields: `id, org_id, created_by, host_user_id, title,
  event_type, site_id (nullable), aria_property_id (nullable), status, event_date, start_time,
  end_time, venue/location, goal, expected_attendance, actual_attendance, budget, actual_cost,
  outcome_notes, created_at`.
- **`event_checklist_items`** — `id, event_id, category, title, owner_user_id, due_date, status`.
- **`event_supplies`** — `id, event_id, item, qty, vendor, cost, needed_by, status
  (needed/ordered/received)`.
- **`event_campaign_steps`** — `id, event_id, step (save_the_date/invite/reminder/confirmation/
  thank_you), audience, send_at, status (draft/scheduled/sent), template_ref, sent_message_id`.
- **`event_guests`** — `id, event_id, name, email, company, rsvp (invited/yes/no/maybe/attended),
  lead_id (nullable), notes`.
- **`event_ops_links`** — `id, event_id, work_order_id, role/note` (ties an install/WO to the event).

Reuse where possible: checklist can lean on the existing tracker; campaign send reuses the Gmail
send route; guest→lead reuses `/api/crm/leads`; ops link reuses `work_orders`.

---

## 4. Integrations (leverage what exists)

- **Calendar** — events surface as an "Event" category on the Schedule (new `calendar_events` type
  or a union in `/api/calendar/events`).
- **CRM** — guests convert to leads; the event links to any opportunities it generates (ROI).
- **Sites / ARIA** — an event ties to a real `site` or an ARIA prospect property.
- **Operations** — event ↔ work orders for install timing.
- **Messages / Gmail** — campaign steps send through the existing pipeline.

---

## 5. Build phases (so each ships reviewable)

- **P1 — Foundation:** migration (tables + GRANTs + RLS), `property_events` CRUD API, Events tab +
  board + "New Event" wizard (Plan stage).
- **P2 — Event window:** glass detail window with the 8-stage stepper + Overview; checklist +
  supplies panels wired.
- **P3 — Campaign + Guests:** staged email campaign (reuse Gmail send) + RSVP guest list with
  guest→lead conversion.
- **P4 — Ops + Follow-up/ROI:** link work orders, held/actuals, outcome + photos, ROI view; calendar
  category integration.

---

## 6. Open questions to confirm before P1

1. **Templates:** do you want reusable **event templates** (e.g., a standard "Lunch & Learn" that
   pre-loads its checklist, supplies list, and campaign steps)? Big time-saver; recommend yes.
2. **Corporate vs dealer visibility:** should corporate see **all** dealers' events (rollup), while a
   dealer sees only their own? (Assumed yes.)
3. **Budget approval:** any approval gate on budget above a threshold, or informational only?
4. **Photos storage:** reuse the existing job-photo/attachment storage bucket for event photos?
