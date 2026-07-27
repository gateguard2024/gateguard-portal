# What's New in Nexus — July 2026

A quick tour of what shipped this cycle and where to find it. Everything below is on the
**beta** branch (`beta.portal.gateguard.co`) and promotes to live once approved.

---

## Site Command — your cockpit for a single property

**Where:** top nav **Systems → click any site.**

The individual-site page is now a full command console. At the top, an intelligence strip
shows **Cameras online**, **Doors / gates**, **90-day Uptime**, and **Events today**. Below it,
a quick-tools row and stacked sections give you everything for that property in one place:
Access Control, Faults, Cameras, Doors, Activity, Network, Relays, and Controllers.

---

## Fault & Uptime ledger — know what's down, for how long, and why

**Where:** Site Command → **Report a fault** tile, or the **Faults** section.

Track every gate-open, camera-down, and network failure with **uptime %, time since last
incident, downtime, and MTTR**. Pick a category and cause (power outage, ISP outage,
bumped/damaged gate, reader failure, and more), set severity, and convert any fault straight
into a work order.

### New: it now files itself
The system polls your live feeds **every 10 minutes**. When a UniFi device or an Eagle Eye
camera drops offline, it **auto-opens a fault**; when it recovers, it **auto-resolves** and the
uptime math updates on its own. Faults you log by hand still work exactly as before and live in
the same ledger — machine-raised ones just carry a "monitor" badge. Gate operators (no cloud
feed) stay manual for now.

---

## Access Control depth — Brivo, Shelly, Eagle Eye, UniFi

**Where:** Site Command → **Access Control** section.

Operate the whole property from tabs:

- **Gate & relays** — pulse / open / reset the gate (Shelly).
- **Doors** — unlock a door (Brivo).
- **Users** — search residents & admins by **name, group, phone, or email**. Click a name to
  open an editable **user card**: First/Last, Phone, Email, Groups, Credentials, and Activity —
  plus **send, resend, or revoke** Brivo mobile passes.
- **Guests** and an **Event tracker**.
- **Network** card — internet status, connected clients, and gear health (UniFi).
- **Cameras** — live Eagle Eye event feed.

---

## Events console

**Where:** top nav **Events.**

Rebuilt as a command board: KPIs, a three-lane pipeline, and event creation with a **site /
opportunity picker**. Each event is fully editable (checklist, supplies, campaign, guests,
status, date, budget), and you can edit the templates themselves — including **Property Launch**.

---

## Admin Report Console

**Where:** **Admin** (admin users only).

The admin area now opens on a **report console**: a band summarizing **leads, opportunities, and
jobs across everyone under you** — totals *and* a per-person breakdown — with operations
rollups and charts. The old admin tabs are now quick-action tiles on this page.

---

## Document Library

**Where:** nav **Field (Money / Docs) → Document Library.**

A shared document database with **tier-based visibility** — mark a document visible to all tiers
or **corporate-only**. Upload files and **send for e-signature**: the built-in signer is the
default, with Adobe Acrobat Sign as a secondary option.

---

## Behind the scenes

Five silent reliability fixes: Gmail connections now save their token, invoices release
commission payouts when marked paid, countersignatures are corporate-gated and persist, work-
order parts restock inventory correctly, and the admin console no longer crashes on empty data.

---

## To fully switch everything on (one-time)

- **Run migration 169** (`esign_agreements`) on beta then prod — enables the Acrobat Sign path.
- **Set env vars** on Vercel: `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` (runs the 10-minute
  fault monitor) and `ADOBE_*` (Acrobat Sign).
- **Per site:** enter UniFi / Eagle Eye / Brivo / Shelly credentials under **Systems → Setup &
  keys** (corporate-only), and backfill each device's **MAC / serial (ESN)** so auto-monitoring
  can match them. Sites without this read 0/0.
