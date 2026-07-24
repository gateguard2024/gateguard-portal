# Resident / Property End-User App — Plan (alarm.com-style PWA)

> Status: PLAN + mockup only — no code yet. Audience: residents + property managers
> (NOT dealers). Companion to the vendor-embedding doc and the Nexus portal.

---

## 1. Objective

A mobile-first **PWA** that lets a property's end users run their security + access from one
screen — the way alarm.com's app does: status at a glance, unlock/buzz a gate or door, live
cameras, an activity feed, notifications, and (for managers) user/credential management.

Reference screens: alarm.com **Home** (status, video, scenes, door lock/unlock/buzz, recent
activity) and **User Access** (users, access plans, access points, manage logins).

---

## 2. Architecture — shared backend, two surfaces (the key decision)

Build the vendor integration layer **once**, in the portal, and expose it to two audiences:

- **Dealer** surface = Nexus (what we've been building).
- **Resident / property-manager** surface = this PWA.

Both read the **same per-site connector credentials** (Brivo, Eagle Eye, UniFi, ButterflyMX,
and the gate app). No integration is built or authorized twice. This is *why* it lives in the
portal rather than a standalone app.

**Hard rule — strict role scoping.** A resident is not a dealer. Same app + DB, but a
`resident` / `property_manager` role sees **only their own site/unit** via RLS + role gating,
through a completely separate PWA shell. They never see CRM, pricing, dealer, or other sites.

**Auth:** add `resident` and `property_manager` roles alongside `admin/supervisor/agent/dealer`.
Lightweight sign-in for residents (magic link / phone) — no heavy login.

**Delivery:** PWA (reuse the repo's existing manifest + service worker from `/tech`);
installable, mobile-first, Web Push for alerts. Same backend; friendly entry point
(e.g. `app.gateguard.co`).

---

## 3. Roles

- **Resident** — Home (status), unlock their gate/door, live cameras, their activity, guest codes.
- **Property manager** — everything above + **User Access** (users, badges/PINs, access plans,
  access points), **gate reset**, and full activity/logs for the property. (This maps to the
  existing per-site **Brivo Users module** already in the portal, re-skinned.)

---

## 4. Feature map (screenshots → Gate Guard)

| alarm.com | Resident PWA | Source |
|---|---|---|
| Panel armed/disarmed, System OK | Property status banner | Brivo / gate app |
| Door Lock / Unlock / Buzz Open | Unlock gate · Buzz guest in | Brivo / ButterflyMX / gate app |
| Live Video + clips | Cameras | Eagle Eye (embed) |
| Today's + Recent Activity | Access + camera event feed | Brivo / Eagle Eye events |
| User Access (badges, PINs, plans) | User + credential management (PM) | Brivo Users module (exists) |
| Notifications | Push alerts | Web Push |
| Scenes / Automation | Schedules / access rules | Brivo / UniFi |

---

## 5. NEW — Gate reset (site-level control)

Property managers / site admins need a **"Reset gate"** control (reboot / clear a stuck gate,
re-sync the controller).

- **Privileged action** — property_manager (or site admin) only, never a plain resident.
- **Delegates to the existing gate-management app** (see §7) or the Brivo↔UniFi middleware — the
  PWA does NOT talk to the gate hardware directly; it calls the gate app's control API.
- **Confirmation + audit.** Requires a confirm step; every reset is logged
  (`gate_reset_events`: site_id, gate_id, triggered_by, reason, result, at).

---

## 6. NEW — Temporary / one-time-use access codes

Residents (and PMs) issue guest codes without giving out their own credential.

- **Types:** `one_time` (single use, then auto-revokes), `time_window` (valid Fri 2–6pm),
  `recurring` (e.g. dog walker M/W/F). PIN or share-link.
- **Delivery:** text/email/share-link to the guest with the code + instructions.
- **Provisioning:** the code is pushed to the gate via the **existing gate app / Brivo**, and
  **auto-expires or revokes** on use / at end-of-window. Residents can revoke early.
- **Tracking:** used / unused, when used, by whom.
- **Data model (portal DB):** `guest_access_codes` — `id, site_id, unit_id, created_by, code,
  type, valid_from, valid_to, max_uses, uses, status (active/used/expired/revoked), guest_name,
  delivery_method, provisioned_ref (id in gate app/Brivo), created_at`. Plus `gate_reset_events`
  for §5.

---

## 7. Integration with the existing gate app (in the git registry)

The app that already manages the gate (control + codes) lives in a **separate repo in the Gate
Guard registry** (not `gateguard-portal` or `gateguard-web`). The resident PWA + portal should
**call that app's API** for gate control (unlock, reset) and code provisioning — not reimplement
it.

**To build this, connect that repo** (mount the folder / point a build chat at it) so we can read
its API surface: how it exposes unlock, reset, and code create/revoke, and what auth it expects.
Until then, treat it as the gate-control service behind our thin portal endpoints.

---

## 8. Build phases

- **P1 — Foundation:** `resident` / `property_manager` roles + auth; PWA shell; resident **Home**
  (status + unlock + activity) reading the shared connectors.
- **P2 — Cameras + notifications:** Eagle Eye live/clip embed; Web Push alerts.
- **P3 — Guest codes:** `guest_access_codes` + issue/deliver/revoke, provisioned via the gate app.
- **P4 — Property-manager tools:** User Access (Brivo Users re-skin), **gate reset** (+ audit),
  full logs.

---

## 9. Open questions

1. **Gate app API** — connect that repo so we can see unlock/reset/code endpoints + auth. (Blocker
   for §5–7; everything else can proceed.)
2. **Resident sign-in** — magic link, phone OTP, or property-manager invite only?
3. **Code delivery** — SMS (Twilio?), email, and/or share link — which channels?
4. **Which properties first** — pilot on one live site before rollout?

---

## 10. Customer account — billing & service (property-manager view)

The account holder / property manager also needs the money + service side for their property —
this reads **existing portal tables**, so it's buildable **now** with no gate-app dependency:

- **Open balance** — sum of unpaid invoices.
- **Open invoices** — Pay via the existing Stripe payment link · **Paid invoices** history.
- **Open proposals** — quotes that are Sent/Viewed → "Review" opens the existing public proposal
  page to approve/sign.
- **Open work orders** — status (scheduled / in progress / awaiting parts) + next visit.

**Sources (all existing):** `invoices` + `invoice_line_items` (status, amount, Stripe link),
`quotes` + `quote_line_items` (proposal status), `work_orders` (status, schedule).

**Styling:** dashboard palette (steel canvas `#313f54→#445a73` + blue-glass tiles) with clean,
hairline-bordered panels like the Messages page.

---

## 11. Where it lives (routing)

Per-property client portal — this matches the already-planned backlog item
**"Client portal at portal.gateguard.co/[site-slug]" (Task #50)**.

- **Recommended:** `portal.gateguard.co/property/[site-slug]`
  (e.g. `portal.gateguard.co/property/east-ponce-village`).
- **Use a prefix** (`/property/` or `/p/`). A bare `/[slug]` at the root would be a catch-all that
  collides with the many existing top-level routes (`/aria`, `/crm`, `/quotes`, `/dispatch`, …).
- **Slug** = lowercased, hyphenated site name (East Ponce Village → `east-ponce-village`), stored
  on `sites.slug` (add the column if missing; unique).
- The route resolves the site by slug, **gates by viewer role** (resident / property_manager /
  public sign-in), and renders the customer interface scoped to that one site.
- **Subdomain alternative** (`my.gateguard.co/[slug]` or `[slug].gateguard.co`) reads cleaner but
  needs wildcard DNS + more infra; the path-prefix ships today.

---

## 12. First build — East Ponce Village

Start with the slice that needs **no gate app**: the **billing & service dashboard** (§10) for
East Ponce Village, wired to that site's real invoices / proposals / work orders, at
`portal.gateguard.co/property/east-ponce-village`. Security controls (unlock, cameras, guest
codes, gate reset) follow once the gate-app repo is connected and the resident/PM roles are in.

---

## 13. App shell — persistent bottom nav (both apps)

- **Customer app:** the bottom tab bar (Home / Video / Access / Activity / Settings) is a
  **persistent shell** — it stays fixed on every page; only the content above it swaps. Standard
  native-app behavior.
- **Main portal (Nexus):** the bottom nav pill should **also persist on every route**, not just the
  home surface. Today it's rendered inside `NexusHomeClient` (the `/` shell), so navigating to a
  full page (`/aria`, `/crm`, `/quotes`, `/maintenance`, …) loses it. Fix = lift the bottom nav into
  the shared portal shell/layout so it renders site-wide, with the active tab reflecting the current
  route. (Touches the shell — do deliberately.)
