# Vosker Cellular Camera Integration — Research & Strategy Notes

> Status: **research / not started.** Captured Aug 2026. Decision pending outreach to Vosker.
> Owner: Russel. Purpose: bring solar + LTE cellular cameras into the GateGuard ecosystem.

## Why Vosker at all — the coverage gap it fills

Vosker (V150, V300, VKX, etc.) makes **solar-powered, 4G/LTE cellular** security cameras. Each
ships with a pre-activated SIM and streams to **VOSKER Cloud + the VOSKER app** — no wifi, no
NVR, no trenched power required. Requires a cloud subscription (V300 plans start ~$10/mo).

Strategic value for GateGuard = **off-grid gate / perimeter coverage.** Where a gate or fence
line has **no power and no network**, Eagle Eye / UniFi Protect can't go. Vosker can. Frame every
integration decision around that niche — not as a general camera replacement.

Manufacturer: **Techno-X Group (GTX)** in Victoriaville, Quebec — same owners as **Spypoint**
(cellular hunting cameras). Vosker and Spypoint share the same cloud platform and housings.

## The hard constraint

**Vosker is a closed platform with NO sanctioned public API, webhooks, or SDK** (unlike Eagle Eye
or UniFi). Confirmed via research Aug 2026. There is a "VOSKER Integrators" partner/royalty
program, but its technical terms are not public (page is JS-rendered; couldn't read contents —
revisit with browser tools or ask Vosker directly).

Note: Spypoint (same cloud) has **reverse-engineered, unofficial API clients** on GitHub/npm
(`pyspypoint`, `spypoint-api-wrapper`) that hit the app's private endpoints. This proves a cloud
API exists, but it is undocumented, unsupported, and against ToS — **not safe for a commercial
product.**

## The three paths

### Option 3 — Ingest the alerts (fastest; build now)
Vosker cameras push **motion/detection alerts with a photo** via app push and **email**.
- **How:** dedicated inbox (e.g. `alerts@`) set as the alert recipient → inbound-email parse →
  extract sender/subject/photo → map to a site + camera → drop event into SOC + site activity
  feed → optional workflow trigger (dispatch, notify PM, gate action).
- **Needs:** inbound-email parsing only (we use Resend **outbound** today; would add an inbound
  route — Resend inbound / SendGrid Inbound Parse / Cloudflare Email Workers / Postmark inbound).
- **Pros:** works today, zero Vosker cooperation, rides existing SOC + email stack.
- **Cons:** read-only, alert-only (no live view, no on-demand, no control); brittle if Vosker
  changes email format; image + latency of email, not live video.
- **Verdict:** best **MVP** for off-grid monitoring. Contained feature.

### Option 2 — Integrate with their cloud (best ceiling; needs their "yes")
- **Path A (sanctioned):** get real API/partner access via the Integrators program → unlocks
  live / on-demand / control. Clean and supported. **Requires outreach.**
- **Path B (unofficial):** reverse-engineered cloud API → fragile, unsupported, ToS risk. **Do
  not** build a commercial product on it.
- **Verdict:** the whole option hinges on what Vosker will grant. Email them first.

### Option 1 — Own brand / private label (highest control, highest cost)
- Don't build hardware from scratch — **private-label from a solar+LTE camera ODM**, or negotiate
  an **OEM deal with Techno-X** via the Integrators program; put it on our own cloud.
- **Pros:** full control, own recurring cloud revenue, no roadmap dependency, fits GateGuard brand.
- **Cons:** real capital, firmware/cloud/app or a serious ODM partner, data-plan logistics,
  certification.
- **Verdict:** only if off-grid cameras become a **core SKU** — a longer-term play.

## Recommendation & next actions

1. **Build Option 3 (alert ingestion) as the off-grid MVP** — small, contained, on existing infra.
2. **In parallel, send outreach to Vosker's Integrators program** to scope Option 2 (sanctioned
   API) and OEM terms for Option 1. *Do this first — their answer decides everything downstream.*
3. Let Vosker's response gate Option 1: real API → no need to own hardware; hard no → reconsider
   private-label.

### Open questions to resolve with Vosker
- Does the Integrators program include **API / webhook access**, or is it resale/royalty only?
- Exact **alert delivery** options (email? SMS? per-camera routing? photo vs. video)?
- OEM / private-label terms and minimums (Techno-X).

### Build notes for Option 3 (when we start)
- Add an **inbound email route** (pick provider). Parse: from-address / camera name in subject /
  photo attachment.
- Map alerts → `sites` + a new `camera` record by a per-site alias address or a device-name lookup.
- Surface in **SOC (ggsoc.com)** + the site activity feed; reuse the existing event/notification
  patterns. Consider a `camera_alerts` table (site_id, source='vosker', image_url, detected_at,
  raw_meta jsonb).
- Keep it read-only v1. No control surface until/unless Option 2 lands.

## Sources
- VOSKER 4G/LTE cameras — https://www.vosker.com/us/en
- VOSKER Integrators program — https://www.vosker.com/integrators/
- V150 product page — https://www.vosker.com/us/en/v150-us
- pyspypoint (unofficial Spypoint cloud client) — https://github.com/hstern/pyspypoint
- spypoint-api-wrapper (npm) — https://socket.dev/npm/package/spypoint-api-wrapper
