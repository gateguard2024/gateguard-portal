# Integrations Track — Definition of Done

Everything required to fully complete the integrations section. ✅ shipped · ⏳ remaining · 🔮 future/vision.
Migrations for this track: 128 (vault+RLS), 129 (door_cameras), 130 (tags), 131 (member_system_access). Env: `CREDENTIALS_ENC_KEY`.

## A. Foundation
- ✅ Per-site encrypted credential vault (AES-256-GCM, one master key, RLS, server-only)
- ✅ Unified accessor `getSiteVendorCreds(site, vendor)` + status (no secrets returned)
- ✅ Corporate-only credential management; dealers never see keys; friendly "contact Gate Guard" messaging
- ✅ Corporate **Integrations console** (Internal → Site Integrations): all sites + per-vendor status
- ✅ Dealer-admin **capability access control** (doors/cameras/relays/door_users) + site scope, enforced on every operate endpoint

## B. Vendor coverage  (each: connect → list → operate → log)
- ✅ **Brivo** — doors (list/unlock/audit), users (list/add/suspend), groups. Per-site own creds.
- ✅ **Eagle Eye** — v3 OAuth connect, camera list + tags, live preview, recorded playback (server-proxied).
- ✅ **Shelly** — relays list + toggle (logged).
- ⏳ **UniFi** — connect + network/clients/device status. NEEDS: controller type (UDM vs classic) or GGSOC client.
- ⏳ **Cellular relays** — open/close + status. NEEDS: the actual product + API (currently undefined).
- 🔮 Intercoms (ButterflyMX / DoorBird), other gate operators — add as the 4-layer pattern when needed.

## C. Unified property experience
- ✅ **Site Security console** — live camera tiles + door unlock + recorded playback in one place
- ✅ Audit events for unlocks + relay toggles flow to the site activity timeline
- ⏳ **UI consolidation** — fold Security/Doors/Relays/Connections into ONE tabbed "Site Systems" panel
- ⏳ **Event-linked playback** — click a door-unlock event → jump the player to that exact moment
- ⏳ **Camera↔door auto-match** — suggest links from Eagle Eye tags (less manual)
- 🔮 **Normalized device model** (`site_devices`) — vendor-agnostic Door/Camera/Relay objects so the UI (and the resident app) never reference a vendor directly. This is the architectural layer behind the "supersedes Brivo/Eagle Eye" vision.

## D. Lifecycle & operations
- ✅ Add/edit/delete site + per-vendor creds (Set up / Update / Remove)
- ✅ Eagle Eye token auto-refresh
- ⏳ **IT-3: fold credential setup into new-site onboarding** (a "Connect systems" checklist step at handoff)
- ⏳ **Connection health** — surface token expiry, offline cameras, failed tests; alert corporate
- ⏳ **Audit view** — a clean "who unlocked/toggled what, when" log (events exist; needs a surface)

## E. End-user / PM tier  (the supersession layer)
- 🔮 **Property-manager / resident role** scoped to their property (extends the `canOperate` engine)
- 🔮 Resident-facing unified view (ties to the GateCard product) + visitor management

## F. Hardening / production-readiness
- ⏳ **Live-test every vendor** against real accounts (Eagle Eye media, Brivo unlock, Shelly control) — surfaces 1–2 one-spot fixes
- ⏳ Run migrations 128–131 + `CREDENTIALS_ENC_KEY` on **prod** (currently beta only)
- ⏳ **OAuth `state` signing** (Eagle Eye `state` is the raw site_id today) — CSRF hardening
- ⏳ **Media proxy caching / rate-limit** (preview polling + clip proxy = bandwidth/cost control)
- 🔮 Per-door / per-camera capability granularity (deferred; whole-capability today)

---

## Recommended order
1. **Deploy + live-test** (migrations + key, verify Eagle Eye/Brivo/Shelly) — *do this before building more.*
2. **UI consolidation** — one "Site Systems" tabbed panel (no input needed; can run in parallel with #1).
3. **IT-3 onboarding integration** — make connecting systems part of the sale→site flow.
4. **UniFi + cellular** — once specs are provided.
5. **Event-linked playback + camera↔door auto-match** — refinements.
6. **Hardening** — OAuth state signing, media caching, connection-health alerts.
7. **🔮 Normalized device model + PM/resident tier** — the bigger "property supersedes vendors" build (its own track).
