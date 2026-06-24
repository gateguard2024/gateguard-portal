# Checkpoint — June 23, 2026

Where things stand across the GateGuard codebases after today's session.

---

## The three repos (confirmed)

| Repo | Deploys to | Role |
|---|---|---|
| `gateguard-portal` | portal.gateguard.co (main) · beta deploy | **Nexus** — dealer/corp portal, `/tech`, scheduling |
| `gateguard-web` | gateguard.co (main) | **Marketing site** — landing, pricing, investor, contact |
| `gateguard` (GateCard) | gatecard.co | Customer/resident apps (not connected this session) |

Full detail: `docs/nexus/SYSTEM_MAP.md`. One-master-DB plan: `docs/nexus/CONSOLIDATION_PLAN.md`.

---

## Done this session

### Cameras — FIXED & deployed ✅
- Site Security door tiles stopped flashing. Root cause: the door tile was defined *inside* `SiteSecurity`, so every 5s refresh remounted it. Hoisted `DoorTile` to module scope + blob-buffered `LiveCam` (the preview route sends `no-store`, which defeated the old preload). User confirmed resolved.

### `/tech` "My Jobs" login — built, on beta, NOT yet on prod ⏳
- Real cause: a per-tech code was treated like a password; identity then came from stale `localStorage` (whoever logged in last). 
- Fixes: `resolveTechByCode()` + `/api/tech/identity` returns `me`; login resolves identity **from the code** and overwrites stale identity; `/api/tech/work-orders` lets a per-tech code win over a passed `tech_id`; inline "why empty" diagnostic on My Jobs + on the picker.
- **Pending:** promote beta→main; then confirm the test environment actually has techs + assigned WOs.

### Schedule app — relocated into the portal, on beta, NOT yet on prod ⏳
- Public booking page at **`/schedule`** (full-screen, no sidebar, no login). Uses the portal's **per-user Google OAuth** (`user_settings.gcal_refresh_token` via `getGcalAccessToken`) — NOT a service account; no `googleapis` dep.
- `/api/schedule/availability` (Google free/busy) + `/api/schedule/book` (creates the Google event **and** mirrors into Nexus `calendar_events`).
- **Step 2 dealer routing built:** booking asks for ZIP → `getScheduleHost({zip})` finds the nearest dealer org (profiles→org→connected calendar, ranked by state+ZIP), books on that dealer's calendar; falls back to corporate. Confirmation names the dealer.

### Marketing site rewires — built (confirm pushed to gateguard-web `main`) ⏳
- **Login** → links to `portal.gateguard.co` (one Clerk). `/login` redirects there.
- **Schedule** nav/footer → `portal.gateguard.co/schedule`; `/schedule` redirects there.
- **Contact** → live **Find a Dealer** widget (via same-origin proxy → `/api/dealers/locator`) + corporate contact block.

---

## Pending / next actions

1. **Promote portal beta→main** so `/schedule` + `/tech` fixes hit prod:
   `git checkout main && git merge --ff-only beta && git push origin main && git checkout beta`
   (Verify on the beta URL first — if beta itself 404s, the build is failing.)
2. **Push `gateguard-web` to `main`** if not already (Login/Schedule/Find-a-Dealer).
3. **Connect a Google Calendar** for at least one rep in the portal (Calendar → Connect Google) so bookings work. Optional `SCHEDULE_HOST_USER_ID` to pin the corporate host.
4. **Verify `/tech` My Jobs** on the env that has techs + assigned work orders.
5. Later: continue one-master-DB consolidation (gateguard-web client-portal data is abandoned, so this is mostly retiring legacy, not migrating).

---

## Key decisions locked in
- **One Supabase master** = the Nexus project. gateguard-web's client-portal `properties` data is **abandoned**, not migrated.
- gateguard-web stays the **marketing front door**; its app features hand off to the portal.
- Scheduling uses **per-user Gmail OAuth** in the portal (each user connects their own).
- Dealer routing is by **ZIP proximity** to dealer orgs that have a connected calendar.

## Open questions
- Is `gateguard-web` on the **same Clerk** instance as the portal? (Matters only if we ever carry web logins into the portal — currently we just link out, so not blocking.)
- Confirm prod has dealer orgs populated for the locator to return results.
