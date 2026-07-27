# Vendor Tools Inside Nexus — Embedding & Integration Options

> Goal: let dealers use UniFi, Eagle Eye, Brivo, and ButterflyMX **without leaving Nexus**.
> Research date: July 2026. Verify vendor docs before building each connector.

---

## 1. The core reality (read this first)

You cannot simply drop a vendor's normal admin dashboard into an `<iframe>`. Almost every
SaaS console sends `X-Frame-Options: DENY/SAMEORIGIN` or a `Content-Security-Policy:
frame-ancestors` header that makes the browser **refuse to render it inside another site**.
So "make their page a page inside our site" splits into three real patterns:

- **Pattern A — Embeddable iframe (vendor-provided).** The vendor ships a *purpose-built*
  embed URL that is allowed in iframes. **Only Eagle Eye offers this** (live/history video).
- **Pattern B — API-native page.** Use the vendor's OAuth API to build a **Nexus-styled page**
  that surfaces the tools we care about (doors, events, cameras, devices) directly in our UI.
  This is the right path for **Brivo, ButterflyMX, and UniFi**. It looks fully native and stays
  on-brand, but we only build the features we wire.
- **Pattern C — SSO deep-link fallback.** A "Open in [Vendor]" button that logs the dealer
  straight into the vendor console (new tab) — used where a full native build isn't worth it yet.

Recommended house rule: **A where offered, B for the daily tools dealers need, C as a stopgap.**

---

## 2. Per-vendor findings

### Eagle Eye Networks (cameras / VMS) — ✅ true embed
- **Embed:** Yes. Dedicated iframe host `https://iframe.eagleeyenetworks.com/#/live/<esn>`
  (live), `/#/history?ids=<esn>&time=<ts>` (history), `/#/historylive/<esn>` (both). Auth is
  handled by passing the access token into the iframe via a `postMessage` listener.
- **Auth:** OAuth 2.0 (API v3).
- **Nexus approach (Pattern A):** A "Cameras" page that lists a site's cameras (via `/cameras`)
  and renders the chosen camera(s) in the Eagle Eye iframe player — live grid + history scrubber,
  all inside Nexus. **Strongest, fastest win.**
- We already use Eagle Eye for cameras, so tokens/ESNs are partly in hand.

### Brivo (access control) — ⚙️ API-native
- **Embed:** No supported dashboard iframe. Build native.
- **Auth:** OAuth 2.0 three-legged (authorization-code); per-app API key. Dev portal
  `developer.brivo.com` + `apidocs.brivo.com`. Technology Partner Program.
- **Nexus approach (Pattern B):** A "Access Control" page — list doors/sites, live activity
  events, and one-tap **unlock/pulse** (the API can "open a door"), credential/user management.
  We already provision Brivo per-property, so the account link exists.

### ButterflyMX (intercom / visitor) — ⚙️ API-native (partner approval)
- **Embed:** No dashboard iframe. Open API **+ SDK** (SDK is aimed at embedding video calls into
  *mobile* apps). Build native for web.
- **Auth:** OAuth 2.0 (client_id/secret via developer settings). **Requires partner approval**
  before production credentials — start that application early; it gates go-live.
- **Nexus approach (Pattern B):** A "Intercom" page — buildings/panels, door-release events,
  guest/PIN management (create PIN), and door open. Live video calls in-browser are limited; the
  SDK targets mobile, so treat in-app video as mobile-only for now.

### UniFi (network / access / protect) — ⚙️ API-native (+ deep-link)
- **Embed:** The UniFi console (`unifi.ui.com` Site Manager) is not designed for iframing.
- **Auth/API:** Official UniFi API (`developer.ui.com`): **Site Manager API** (cloud, aggregated
  across sites) + **Local Application APIs** (per-site: Network/Protect/Access detail). API-key
  based; OAuth not clearly published — expect API keys per console.
- **Nexus approach (Pattern B for status, Pattern C for deep control):** A "Network" page pulling
  device/site health + client lists from the Site Manager API for at-a-glance status; for deep
  config, a signed **"Open in UniFi"** deep-link. We already run Brivo↔UniFi middleware, so a
  connector foothold exists.

---

## 3. Recommended build order

1. **Eagle Eye "Cameras" (Pattern A)** — real embed, quickest visible win, we already touch it.
2. **Brivo "Access Control" (Pattern B)** — highest daily value (doors + events + unlock); we
   already provision it, so auth is closest.
3. **ButterflyMX "Intercom" (Pattern B)** — start the **partner-approval application now** (it's
   the long pole); build the page in parallel.
4. **UniFi "Network" (Pattern B status + Pattern C deep-link)** — status cards native, deep config
   via signed deep-link until a fuller native build is justified.

---

## 4. Architecture notes for Nexus

- **New section:** a "Vendor Tools" (or per-site "Systems → Tools") surface with tabs
  Cameras / Access / Intercom / Network, styled in the current slate-glass + cyan direction.
- **Credential store:** one row per (dealer_org or site, vendor) holding OAuth tokens — mirror the
  existing `message_channels` pattern (refresh token + access token + config), RLS-scoped so a
  dealer only sees their own sites' tokens. Reuse the token-refresh approach already in
  `lib/mail-send.ts`/calendar for server-side refresh.
- **Server-side proxying:** call vendor APIs from Next.js route handlers (never expose tokens to
  the browser). For Eagle Eye's iframe, mint a short-lived token server-side and hand it to the
  iframe via `postMessage`.
- **Per-site scoping:** tie each vendor account to a `site` so opening a property in Nexus shows
  exactly that property's cameras/doors/intercom/network.
- **Fallback everywhere:** every tab gets an "Open in [Vendor] ↗" deep-link so dealers are never
  blocked if a native feature isn't built yet.

---

## 5. One-line summary

Only **Eagle Eye** can be truly iframed (and it's built for it). **Brivo, ButterflyMX, and UniFi**
should be surfaced as **native Nexus pages via their OAuth APIs** (with signed deep-links as a
fallback) — which actually reads *better* than an iframe because it stays fully on-brand and
dealers never see they've left our platform.
