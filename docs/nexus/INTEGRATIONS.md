# Site Integrations — Connector Keys & Setup

How each property's hardware/cloud connects to Nexus. **Credentials are entered per-site** in
**Site → Systems → Setup ⚙ (Connections)** — corporate only — and stored **encrypted** in the
`site_integrations` vault (never shown again after saving). Secret values belong in the team
password manager, **not** in this repo.

Server encryption requires env `CREDENTIALS_ENC_KEY` to be set (saving is disabled without it).

---

## UniFi — Network + Access

Two ways to reach a property's UniFi console:

### Cloud (recommended for remote sites) — Site Manager API
- **What:** reaches the console through Ubiquiti's cloud (`api.ui.com`), no public IP / port-forward.
- **Where to get the key:** sign in at **unifi.ui.com** → Settings (gear) → **API** → **Create API Key**. One key covers the whole Ubiquiti account (all properties).
- **Fields (per site):**
  - `cloud_api_key` *(secret)* — the unifi.ui.com API key.
  - `cloud_site_id` — the site's `siteId` on the account. Find it via `…/api/unifi/cloud/sites?site_id=<portal-site-id>` (corporate). Leave blank if the account has only one console.
  - `cloud_host_id` *(optional)* — the console/host id, if a site spans multiple.
- **Env fallback:** `UNIFI_SITE_MANAGER_KEY` — set once on Vercel to use one account key for every site without entering it per-site.
- **Shows in portal:** internet up/down, ISP, throughput/latency/uptime, client counts, AP/gear health (Network widget).
- **Auth:** header `X-API-KEY`. Endpoints: `/v1/hosts`, `/v1/sites`, `/v1/devices`, ISP metrics. _Verify field names with `?debug=1` on first connect._

### Local (only if the console is reachable from the internet / VPN)
- `host` (controller URL, e.g. `https://1.2.3.4`), `api_key` *(secret)*, `site` (default `default`).
- UniFi Access (door unlock): `access_host`, `access_token` *(secret)*.

---

## Shelly — Relays / Power (Cloud Control API)
- **Where to get the key:** Shelly Smart Control app → Settings → User Settings → **Authorization Cloud Key**.
- **Fields (per site):**
  - `auth_key` *(secret)* — Shelly cloud auth key.
  - `server` — cloud server, e.g. `shelly-12-eu.shelly.cloud`.
  - `device_tag` — property name as it appears in device names (defaults to the site name). One Shelly account can hold many properties; this filters to just this one. Area = the rest of the device name.

---

## Eagle Eye — Cameras (OAuth2)
- `client_id`, `client_secret` *(secret)* per site, then a one-time **Connect Eagle Eye** OAuth.
- Redirect URI must be registered in the EEN app and match `EEN_REDIRECT_BASE` (env) exactly.

## Brivo — Access Control
- `username`, `password` *(secret)*, `api_key` *(secret)*, `client_id`, `client_secret` *(secret)*, `site_id`.

---

## Where keys live
- **Per-site, encrypted:** `site_integrations` table (vault), via the Setup ⚙ panel. Corporate-only to enter; values never returned to the browser.
- **Account-wide env (optional):** `UNIFI_SITE_MANAGER_KEY` (UniFi cloud). Set in the portal's Vercel project.
- **Actual secret values:** store in the team password manager. Do not commit them.

> First property using UniFi cloud: **Elevate Greene.** Record its `cloud_site_id` here once confirmed (the ID is not secret): `cloud_site_id = ________`.
