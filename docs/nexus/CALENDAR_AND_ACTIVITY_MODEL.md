# Calendar + Unified Activity Model (spec)

> Source: Russel (June 2026). Captured for build. Two goals:
> 1) Nexus is the source of truth for events scheduled in Nexus; Google is a sync target.
> 2) Every record (lead, opportunity, customer, job) shows its emails + events + calls + notes in one Activities timeline.

## Part 1 — Local-first calendar

**Principle:** an event created in Nexus is stored in OUR database first. Google Calendar is a downstream copy we push to (and optionally pull from) the user's / customer's calendar. If Google is disconnected, the event still exists in Nexus.

**Current state**
- `app/api/calendar/events/route.ts` already aggregates: todos, work_orders, work_order_phases, pm_schedules, crm_activities, tracker_items, gcal_events — AND references a `calendar_events` table that **does not exist yet**.
- `gcal_events` = the Google mirror (`source_type`, `source_id`, `gcal_event_id`, timestamptz fields).

**To build**
- **Migration: `calendar_events`** (the table the route already expects). Columns: `id`, `org_id`, `user_id` (owner), `title`, `description`, `location`, `start_time timestamptz`, `end_time timestamptz`, `is_all_day`, `status`, plus **entity links** `entity_type` (lead|opportunity|customer|site|work_order|none) + `entity_id`, attendee fields (`attendee_emails jsonb`), `gcal_event_id` (set after push), `created_at/updated_at`. GRANT block required.
- **Write path:** scheduling an event in Nexus (calendar quick-add, "schedule visit", follow-up) writes a `calendar_events` row first.
- **Sync (one-way push default):** after save, if the owner has `gcal_refresh_token`, push to their Google calendar and store the returned `gcal_event_id` back on the row. Customer-facing events can invite the customer's email as a Google attendee (so it lands on the customer's calendar) — Nexus stays the source of truth.
- Pull (optional/2-way) stays as-is via `gcal_events`; do not let a Google edit silently delete a Nexus event.

## Part 2 — Unified Activity timeline per record

**Goal:** on a lead, opportunity, customer, or job, the Activities tab is a full history — newest first — covering ALL of:
- **Emails** (inbound + outbound, from the messages system)
- **Calendar events** (scheduled/visited)
- **Calls + texts** (logged calls, SMS/text threads)
- **Notes** (manual)
- **Status changes** (stage moved, won/lost, assigned, converted)
- **Documents** (quote sent / proposal viewed / NDA or agreement signed)

**Current state / gaps**
- `crm_activities` links to `opportunity_id` + `lead_id` only → no `customer_id`, no `work_order_id`.
- `message_threads` (emails) link to `linked_wo_id` / `linked_quote_id` / `linked_site_id` only → no lead/opportunity/customer link.
- So emails never appear on a lead/opp/customer timeline, and activities don't cover customers/jobs.

**To build**
- **Link emails to records:** add `linked_lead_id`, `linked_opportunity_id`, `linked_customer_id` to `message_threads` (or a generic `entity_type`/`entity_id`). Stamp these when a thread is started from a record, and/or auto-match by contact email.
- **Extend activities coverage:** add `customer_id` + `work_order_id` to `crm_activities` (or generic entity), so calls/notes can attach to customers and jobs too.
- **Unified endpoint:** `GET /api/nexus/activity?entity_type=&entity_id=` that MERGES, newest-first:
  - `crm_activities` (notes, calls, logged emails) for that entity
  - `messages` (real inbound/outbound email) whose thread links to that entity
  - `calendar_events` (and gcal_events) for that entity
  - `document_signatures` (quote sent / proposal viewed / NDA+agreement signed) for that entity
  - status changes from `opportunity_stage_history` (+ lead/job status logs)
  - returns a normalized `{ id, kind: note|call|text|email|event|document|status, title, body, at, direction?, actor }` list
- **UI:** the glass detail panes (LeadGlassWindow, OpportunityGlassWindow, JobGlassWindow, customer detail) render this one merged timeline. 5th-grader simple: an icon per kind, who/what/when, click to open.

## Phasing
1. `calendar_events` migration + write path + one-way Google push (local-first calendar).
2. Entity links on `message_threads` + `crm_activities` (+ backfill where possible by email match).
3. Unified `/api/nexus/activity` endpoint.
4. Wire the merged timeline into the four detail glass panes.

## Notes
- Keep email/PII scoping: activity endpoint is org-scoped + record-scoped (reuse crm-scope helpers).
- Customer-facing calendar invites should send from the nexus mail domain.
