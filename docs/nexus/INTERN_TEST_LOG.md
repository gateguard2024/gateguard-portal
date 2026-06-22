# Nexus — Intern QA Test Log

Running checklist of everything we *think* is complete and needs human verification on **beta**
(`https://gateguard-portal-git-beta-gate-guard.vercel.app/`). Check the box when verified; note the date + tester + any bug.

Legend: ☐ untested · ☑ verified · ⚠ bug found (file an item)

---

## Build 1 — Product/manual intake loop  (pushed beta · YYYY-MM-DD)
Where: **Operations Hub → Parts** tab.

- ☐ "+ Add product" with a **manual PDF URL** saves, and the success note mentions vectorizing.
- ☐ After adding a product with a manual, within ~1–2 min its card shows an **"AI ready"** green badge.
- ☐ A product card with a manual but no coverage shows **"Vectorize manual now"**; clicking it flips to "Vectorizing… refresh in a minute."
- ☐ After re-vectorize, badge shows figure count (e.g. "AI ready · 4 🖼") when figures exist.
- ☐ A product with **no** manual URL shows "No manual linked — add a manual PDF URL to power AI diagnostics."
- ☐ Vectorize button error path shows red text + **Retry**.
- ☐ Field tool: a newly-vectorized product now returns real manual-cited steps in **/tech → Diagnose** (confirms ingest worked end-to-end).
- ☐ Coverage badges load without slowing the Parts tab noticeably.

**Depends on infra:** Inngest keys set on beta (manual ingest job), `BRAVE_API_KEY` optional (figure web fallback).

---

## Build 2 — Part-Finder  (pushed beta · YYYY-MM-DD)
Where: **Operations Hub → Parts** tab, "🔎 Find it for me" box.

- ☐ Typing a real part number/name (e.g. "LiftMaster CSL24UL") + **Look it up** returns a "Found: …" green message and prefills the Add-product form.
- ☐ Found products with a manual show "manual linked ✓"; the prefilled **Manual PDF URL** field is populated.
- ☐ Pasting a **product page URL** (https://…) identifies the product from that page.
- ☐ Reviewing the prefilled fields and tapping **Add to catalog** saves the product (and queues manual vectorize when a manual was found).
- ☐ A nonsense query returns an amber "couldn't find" message and still lets you fill it in manually.
- ☐ `manual_url` is only ever a real link from the results (never a hallucinated URL) — spot-check that the linked PDF opens.
- ☐ Brand / model / category / description are reasonable for the found product (editable before saving).

**Depends on infra:** `SERPER_API_KEY` (web search) + `ANTHROPIC_API_KEY`. With no SERPER key, query lookup returns the "paste a URL / add manually" message; URL paste still works.

---

## Build 3 — Pricing calculator hardened (cost moved server-side)  (pushed beta · YYYY-MM-DD)
Where: **Sales → Opportunities → Financials** (Pricing & profitability) and **Sales surface** rough calculator.

- ☐ Calculator still totals correctly as you type units / gates / locks / cameras (compare a known site to the old numbers).
- ☐ Numbers update within ~½ sec after typing stops (debounced server call — confirm no lag/flicker).
- ☐ As **corporate admin**: "Internal (cost + profit)" shows Gate Guard cost / margin; "Dealer view (preview)" hides them.
- ☐ As a **dealer/non-admin** login: only Gate Guard Fee, Suggested Retail, and Your Expected Profit show — **no GG cost, no margin** anywhere.
- ☐ **Security check (critical):** open browser DevTools → Sources/Network on the calculator page as a dealer. The numbers `89.25`, `11.10`, `2.25`, `4.50` and the margin math must **NOT** appear in any client JS. They should only be in the `/api/pricing/compute` response, and only when the logged-in user is a corporate admin.
- ☐ `/api/pricing/compute` called directly by a dealer session returns a result with **no** `ggCost`/`margin` fields even if `viewAsDealer:false` is forced in the body.
- ☐ Opportunity Financials payback/MRR still populate from the calculator output.

**Depends on infra:** none (pure compute). Clerk role/tier metadata must be set for the internal view to appear.

---

## Build 4a — 7-stage pipeline + deposit automation  (pushed beta · YYYY-MM-DD)
Where: **Sales** kanban (`/crm`, `/crm/opportunities`) and **Opportunity → Deal life cycle**.

- ☐ The opportunity board shows the 7 columns in order: Meet & Present, Site Survey, Proposal, Negotiate, Contract & Sign, Deposit, Closed Won (+ Lost).
- ☐ **Drop-off bug fixed:** open an opp, advance it to the "Contract & Invoice", "Sign", and "Payment" steps in the Deal life cycle — then return to the board. The opp must appear in **Contract & Sign / Deposit** columns, never vanish.
- ☐ Pipeline $ total and open/won counts still look right after moving deals.
- ☐ Deal life cycle → **Payment** step: both checkboxes ("Contract signed", "Deposit received") must be checked before the convert button enables.
- ☐ Clicking **"Deposit collected — convert to install job"** moves the opp to **Closed Won** AND creates an install **work order** (check Operations → Work Orders, linked to the opp).
- ☐ Re-opening a won opp's Payment step shows "Already converted" and doesn't make a duplicate job.
- ☐ If job creation fails, the opp still moves to Won and a clear message says to add the job manually (no silent failure).
- ☐ Creating a new opp from the legacy CRM form: stage dropdown shows Site Survey / Proposal / Contract & Sign / Deposit (no more "Survey Request").

**Depends on infra:** none. Reuses existing `/api/dispatch` (work_orders) + `/api/crm/opportunities` PATCH.

---

## Build 4b — Guided quote builder  (pushed beta · YYYY-MM-DD)
Where: **Opportunity → Deal life cycle → Proposal** step.

- ☐ Opening Proposal on an opp with **no** quote shows the 3-step builder (Add products / custom line / Review & create).
- ☐ Searching the catalog returns products; clicking one adds it as a line at its sell price.
- ☐ "Type a custom line" adds a line; the **One-time / Monthly** toggle puts it in the right bucket.
- ☐ Editing a line's qty updates its subtotal and the One-time / Monthly totals live.
- ☐ "Create quote" creates a real quote (gets a GG-YYYY-NNNN number) tied to the opportunity; totals match.
- ☐ After creating, the step shows the quote summary with **Open/edit** and **Client proposal view** links that open the full quote pages.
- ☐ Re-opening Proposal on an opp that already has a quote shows the summary (not a blank builder) — no accidental duplicate.
- ☐ "+ Start another quote" returns to the builder.
- ☐ Created quote appears in the quotes list / Money surface scoped to the right org.

**Depends on infra:** none. Reuses `/api/quotes` (POST) + `/api/products` search.

---

## Build 5 — Site lifecycle + unified activity timeline  (pushed beta · YYYY-MM-DD)
**⚠ Run migration 126 on beta Supabase first** (`126_site_lifecycle.sql` — adds lifecycle columns to `sites`).

Activity timeline (#59) — where: **Opportunity → Deal life cycle** (bottom, "Deal activity") and **Operations → Locations → site drawer** (bottom, "Site activity").

- ☐ Opening a deal shows a "Deal activity" feed combining notes/calls/emails/meetings/tasks + quotes + work orders, newest first, with icons + relative times.
- ☐ Logging a note/activity on the opp then reloading shows it in the feed.
- ☐ Creating a quote (Proposal step) shows a "Quote GG-…" entry in the feed.
- ☐ Converting to a job (Payment step) shows a "Work order …" entry in the feed.
- ☐ A record with no activity shows the friendly empty state (not an error).
- ☐ Site drawer shows a "Site activity" feed (events + work orders + quotes for that site).
- ☐ **Scope check:** the feed only loads for records the user is allowed to see (try an opp/site outside your org → 404, no data leak).

Site lifecycle (#60) — where: **Operations → Locations → site drawer header**.

- ☐ Site shows a status chip: Prospect / Onboarding / Active / Inactive / Churned.
- ☐ A site without contract+deposit shows "To activate: Contract not signed · Deposit not collected".
- ☐ Converting a won deal that's linked to a site (opp has site_id) flips that site to **Active** (after migration 126 is run) — re-open the site to confirm.
- ☐ Before migration 126 runs, conversion still works (site stamp fails silently, no crash).

**Depends on infra:** migration 126 (`sites` lifecycle columns). Timeline needs none.

---

## Build 6a — Dealer onboarding 8-stage layer  (pushed beta · YYYY-MM-DD)
**⚠ Run migration 127 on beta Supabase first** (`127_dealer_onboarding.sql` — adds vetting + channel-manager columns to `organizations`).
Where: **Internal (admin) → Dealer Onboarding** board → click a dealer.

- ☐ The board still loads and the 9 stage buckets (Draft … Live Dealers) show counts (must work even before migration 127 runs).
- ☐ Click any dealer → a **"Partner health"** card shows, with **"Stage N of 8"** matching where they are.
- ☐ Click a **Vetting** chip (Not started / In progress / Cleared / Flagged) → it saves and stays selected after the board reloads. *(needs migration 127)*
- ☐ Type a name in **Channel Manager**, click **Save** → it sticks after reload. *(needs migration 127)*
- ☐ For a **Live** dealer, the card shows **30 / 60 / 90-day review** chips (green = upcoming, amber = due now, red = overdue) based on when they went live.
- ☐ Before migration 127 runs: clicking a vetting chip shows a friendly "Run migration 127" message — it does NOT crash the board.
- ☐ Send NDA / Countersign / Upload / Approve buttons still work exactly as before (no regression).
- ☐ A non-corporate manager only sees dealers in their own network (no one else's).

**Depends on infra:** migration 127 (`organizations` vetting + channel_manager columns).

---

## Build 7a — User deactivate + move-org  (pushed beta · YYYY-MM-DD)
Where: **Internal (admin) → Users & Features → open a user** (Users & Access glass window).

- ☐ Opening a user shows a **"Status & Organization"** section with account status (Active/Deactivated) and the current org.
- ☐ Click **Deactivate user** → status flips to "Deactivated"; reopen shows it stuck. (That user should not be able to sign in afterward — verify with a test account.)
- ☐ Click **Reactivate user** → status returns to Active; they can sign in again.
- ☐ You **cannot** deactivate your own account (it shows a message and refuses).
- ☐ The **Move to…** dropdown lists only organizations in your network (not every org).
- ☐ Pick an org + **Move** → the user's organization updates (reopen to confirm the new org name).
- ☐ A non-corporate admin only sees their own network in both the move list and the user list (no cross-org leakage).
- ☐ Role change + per-feature access (existing features) still work — no regression.

**Depends on infra:** none new (uses Clerk + profiles). No migration.

---

## Build 8 — L10 weekly meeting runner  (pushed beta · YYYY-MM-DD)
Where: **EOS / Operating System** page → green **"Run L10"** button (or go to `/eos/l10`).

- ☐ The runner opens with the 7-segment agenda across the top: Segue, Scorecard, Rock Review, Headlines, To-Do List, IDS, Conclude (with minute budgets).
- ☐ Click **Start meeting** → the Segment timer counts **down** and the Total timer counts **up**.
- ☐ When a segment's time runs out, its timer turns **red** and keeps going negative (doesn't stop the meeting).
- ☐ **Pause/Resume** stops and restarts both timers.
- ☐ **Next segment / Back** move through the agenda and reset the segment timer to that segment's budget.
- ☐ Scorecard segment lists your real measurables with their latest value.
- ☐ Rock Review lists real rocks; clicking **On Track / Off Track** saves (reopen the EOS Rocks tab to confirm it stuck).
- ☐ To-Do List shows real to-dos; checking one marks it done (confirm on the EOS To-Dos tab).
- ☐ IDS lists open issues by priority; **Solved ✓** marks an issue resolved (confirm on EOS Issues tab).
- ☐ "Drop to Issues" boxes (Scorecard/Rocks/Headlines/IDS) create a new issue that appears in IDS and on the EOS Issues tab.
- ☐ "Capture a to-do" in IDS creates a to-do (appears on EOS To-Dos tab).
- ☐ Conclude shows counts (issues solved / to-dos created / open to-dos) and a 1–10 rating selector.

**Depends on infra:** none new — reuses the existing `/api/eos/*` endpoints.

---

## Build 9 — Movable How-To window  (pushed beta · YYYY-MM-DD)
Where: any Nexus screen (home + tabs) — a blue **"? How-to"** button floats bottom-right.

- ☐ The "? How-to" button shows on the main Nexus screens, above the bottom tab bar.
- ☐ Clicking it opens a small floating help window.
- ☐ **Drag** the window by its top bar ("⠿ How-To · drag me anywhere") to anywhere on screen.
- ☐ Close it, reopen it — it remembers where you left it.
- ☐ The search box filters the how-to list as you type.
- ☐ Clicking a how-to expands its steps; clicking again collapses it.
- ☐ The window stays on top while you click around the screen behind it (you don't lose your place).
- ☐ Works on a phone (drag with finger; fits the screen).

*(Brivo Users module and University/Training were already built — spot-check they still load: Admin → Brivo users for a site with credentials; `/training` shows courses.)*

**Depends on infra:** none new (reads existing `/api/kb/articles`).

---

## Build 10 — Per-site vendor connections (credentials vault)  (pushed beta · YYYY-MM-DD)
**⚠ Run migration 128** (`128_site_integrations.sql`) **and set `CREDENTIALS_ENC_KEY`** on beta (any long random string) before testing saving.
Where: **Operations → Locations → open a site → "Connections"** card.

- ☐ The Connections card lists 4 vendors: Brivo, Eagle Eye, Shelly, UniFi — each with a status chip (Not set / Configured / Verified / Error).
- ☐ If `CREDENTIALS_ENC_KEY` isn't set, the card shows a clear "encryption key not set" notice and Save is disabled.
- ☐ Click **Set up** on Brivo, enter username/password/site ID, **Save** → status becomes "Configured".
- ☐ Click **Test** on Brivo → with real credentials it becomes **Verified**; with bad ones it shows **Error** + the reason (no crash).
- ☐ Re-open the site: secret fields are **blank** (we never send saved secrets back) and the status still shows Configured/Verified.
- ☐ Saving with a blank field doesn't wipe a previously-saved secret (partial update is safe).
- ☐ Eagle Eye / Shelly / UniFi save and show "Configured" (their live Test says "coming next" — expected).
- ☐ A non-admin (or someone outside the site's org) can't open this (the card/endpoint returns nothing for them).
- ☐ **Security:** in DevTools Network, the integrations GET response contains status only — **no usernames, passwords, or keys**.

**Depends on infra:** migration 128 + `CREDENTIALS_ENC_KEY` env on beta. (With full per-site Brivo creds entered, Test no longer needs the shared `BRIVO_*` env vars.)

---

## Build 10b — Add-a-site + full per-site credentials (add / edit / delete)  (pushed beta · YYYY-MM-DD)
Where: **Operations → Locations**.

- ☐ **"+ Add a site"** button at the top opens a short form (name required; address/city/state/units optional).
- ☐ **Create site → add its keys** creates the site and immediately opens it.
- ☐ The new site's **Connections** card lists Brivo, Eagle Eye, Shelly, UniFi.
- ☐ **Brivo now asks for that site's OWN full credentials** — username, password, API key, client ID, client secret, site ID (nothing shared with other sites).
- ☐ **Add:** Set up a vendor → fill fields → Save → status "Configured".
- ☐ **Edit:** Update → change a field → Save (blank fields don't wipe existing secrets).
- ☐ **Delete:** **Remove** button asks to confirm, then clears that vendor's login for that site (status back to "Not set").
- ☐ Two different sites can hold completely different Brivo logins — set both and confirm they don't bleed into each other.
- ☐ A non-admin can't add a site or see the Connections card.

**Depends on infra:** migration 128 + `CREDENTIALS_ENC_KEY` (same as Build 10).

---

## Build 10d — Site edit + Connections reachable from Operations  (pushed beta · YYYY-MM-DD)
Where: bottom nav **Operations** → **Find Property** (or **Property Systems**).

- ☐ Search a property/site, click a result → the Selected panel shows an **"Edit details & connections"** button.
- ☐ Clicking it opens the full editable site panel (Details to edit + **Connections** card to add/edit/remove Brivo/Eagle Eye/Shelly/UniFi).
- ☐ This is the same panel as `/cmms → Locations → site`; changes save the same way.
- ☐ "Open full page" still works for the legacy site page.

**Depends on infra:** migration 128 + `CREDENTIALS_ENC_KEY` (for the Connections part).

---

## Build 10e — Brivo Doors (list + unlock, logged)  (pushed beta · YYYY-MM-DD)
Where: open a site (Operations → Find Property → Edit details & connections, or /cmms → Locations) → **Doors (Brivo)** card.

- ☐ For a site with Brivo connected + verified, the Doors card lists that property's real doors.
- ☐ For a site without Brivo set, it shows a friendly "Set up Brivo in Connections above" note (no crash).
- ☐ Clicking **Unlock** asks to confirm ("Unlock … now?"). Cancel = nothing happens.
- ☐ Confirming unlocks the door (verify physically / in Brivo) and shows "Unlocked ✓ — logged."
- ☐ The unlock appears in that site's **activity timeline** (event "door_unlock") with who + when.
- ☐ A non-admin / out-of-scope user can't see or unlock the site's doors.

**Depends on infra:** site has Brivo creds saved + verified (Build 10). Note: door endpoint path assumes Brivo "access-points" — if your Brivo plan differs, that's the one line in lib/brivo.ts to adjust.

## Build 10f — Camera ↔ door mapping  (pushed beta · YYYY-MM-DD)
**⚠ Run migration 129** (`129_door_cameras.sql`).
Where: site panel → **Doors (Brivo)** card.

- ☐ Each door row shows "No camera linked" or the linked camera (📹 name; clickable if a URL was given).
- ☐ **+ Camera** lets you type a camera name + optional live-view URL → **Save camera** → it shows on the row.
- ☐ **Unlink** removes the camera from that door.
- ☐ Unlocking a door that has a camera shows "(camera: …)" in the result and the **activity timeline** door-unlock entry mentions the camera.
- ☐ Camera links persist after reload and are per-site (don't appear on other sites).

Note: cameras are entered **manually** for now. Auto-listing from Eagle Eye needs the exact Eagle Eye API/auth (port from GGSOC) — see below.

## Build 10g — Corporate-only credentials + Integrations console  (pushed beta · YYYY-MM-DD)
Model: **corporate enters/owns vendor credentials; dealers operate but never see them.**

Corporate console — **Internal (admin) → Site Integrations**:
- ☐ Card lists every site with per-vendor chips (Brivo/Eagle Eye/Shelly/UniFi): green ✓ verified, amber • configured, grey — not set, red ! error.
- ☐ Search filters sites; **"Not connected"** filter shows only sites with nothing set up.
- ☐ Clicking a site opens its full panel; corporate sees the **Connections** card to enter/test keys.
- ☐ Shows "X/4 connected" per site.

Permission split:
- ☐ As a **dealer** (non-corporate) login: open a site → you see **Doors / cameras** but the **Connections card is gone** (can't see/edit keys).
- ☐ As a dealer you can still list/unlock doors, link cameras, and manage Brivo users at your sites.
- ☐ The credentials API (`/api/sites/[id]/integrations`) returns 403 for non-corporate even if called directly.
- ☐ As corporate you see Connections everywhere and the console.

**Depends on infra:** migrations 128/129/130 + `CREDENTIALS_ENC_KEY`.

## IT-1 — Eagle Eye Connect (v3 OAuth) + live camera picker  (pushed beta · YYYY-MM-DD)
Setup is **corporate-only**. Where (corporate): site → Connections → Eagle Eye.

- ☐ Corporate enters Eagle Eye **client ID + client secret** → Save → status "Configured".
- ☐ A **"Connect Eagle Eye →"** button appears (corporate only). Clicking it goes to Eagle Eye's login/consent, then returns to the app; status flips to **Verified**.
- ☐ After connect, in the **Doors** card → + Camera, a **"Pick an Eagle Eye camera…"** dropdown lists that account's real cameras; picking one fills the name + its Eagle Eye tags automatically.
- ☐ Manual camera entry still works if you'd rather type it.
- ☐ Dealers can use the camera **picker/list** at their sites, but never see the Connect button or credentials.
- ☐ Token auto-refreshes (camera list keeps working after the access token expires).

**Setup prereq (corporate, one-time):** register a confidential client in the Eagle Eye developer portal and set its **redirect URI to** `https://<your-domain>/api/eagle-eye/callback`. Then paste client ID/secret per site.

## IT-2a — Shelly relays (list + toggle)  (pushed beta · YYYY-MM-DD)
Where: site panel → **Relays / Power (Shelly)** card.

- ☐ For a site with Shelly connected, the card lists that site's relays with ● ON / ○ OFF state.
- ☐ **Turn ON / Turn OFF** asks to confirm ("…switches the physical relay"); cancel does nothing.
- ☐ Confirming switches the relay and shows "Turned … ✓ — logged."
- ☐ The toggle appears in the site **activity timeline** ("relay_toggle") with who + when.
- ☐ Not-connected sites show a friendly note (dealer: "Contact Gate Guard"; corporate: "add in Connections").
- ☐ Dealers can operate relays at their sites; setup (auth key) stays corporate-only.

Note: built against Shelly Cloud `/interface/device/list` + `/device/relay/control`. If your Shelly plan differs, those two calls are the spots to adjust.

**Still on the track:** UniFi (controller auth varies — needs your controller type) and **cellular relays** (specify the product/API). Both store creds today; live control is the follow-up.

## IT-3 — Dealer-admin "Site Systems access"  (pushed beta · YYYY-MM-DD)
**⚠ Run migration 131** (`member_system_access`).
Where: **Internal/Users → open one of your people → "Site Systems access"** section.

- ☐ The section shows switches: 🚪 Doors · 👥 Door users · 📹 Cameras · 🔌 Relays, plus "All our sites" / "Pick sites".
- ☐ Turning a switch on/off saves instantly (reopen the user to confirm it stuck).
- ☐ "Pick sites" shows that org's sites with checkboxes; selections persist.
- ☐ A **non-admin** dealer user with nothing granted **cannot** unlock doors / view cameras / toggle relays — the cards show "you don't have access" and the API returns 403.
- ☐ After the admin grants Doors + a site, that user **can** unlock doors at that site only (not at un-granted sites).
- ☐ **Dealer admins** and **corporate** can operate everything without being granted (no regression).
- ☐ Granting Cameras lets the user see the Eagle Eye camera list/picker; revoking hides it.

Note: this is real enforcement on the endpoints, not cosmetic. Existing non-admin users start with no system access until their admin turns it on.

## IT-4 — Site Security console (live cameras + door unlock + playback)  (pushed beta · YYYY-MM-DD)
Where: site panel → **Site Security** card (top of the systems section). Needs Eagle Eye connected + cameras linked to doors.

- ☐ Each door shows a tile with its **mapped camera's live preview** (refreshes every ~5s, "● LIVE" badge).
- ☐ Doors with no linked camera show a placeholder ("link a camera in the Doors card").
- ☐ **Unlock** on a tile confirms, unlocks, and logs (same as the Doors card).
- ☐ **Recording** opens a player that plays the last ~2 min from that camera.
- ☐ Access-gated: a user without **cameras** capability sees placeholders / no preview; without **doors** can't unlock.
- ☐ The whole point: a dealer can watch + unlock + review footage here **without opening Eagle Eye**.

**Honest caveat (verify on first live test):** the live preview proxies Eagle Eye's MJPEG feed and the player proxies a recorded MP4 — both use the verified v3 endpoints, but Eagle Eye media auth/URL shapes can vary. If a tile shows "live preview unavailable" or the clip won't load, send me what the `/api/eagle-eye/preview` and `/clip` calls return and it's a one-spot fix in `lib/eagle-eye.ts`.

## IT-5 — UniFi + tabbed Site Systems + auto-match + event playback  (pushed beta · YYYY-MM-DD)
- ☐ Site panel now shows ONE **"Site Systems"** card with tabs: 🛡 Security · 🚪 Doors · 🔌 Relays · 🌐 Network · (🔑 Setup, corporate only) — no more long stack.
- ☐ **Network tab**: with UniFi connected, shows connected devices (read) + UniFi Access doors (list + unlock w/ confirm). Needs `network` capability (devices) / `doors` (Access unlock).
- ☐ **Camera↔door auto-match**: in Doors, a door with no camera shows "💡 Link '<camera>'?" suggesting an Eagle Eye camera whose name/tags match the door — one click links it.
- ☐ **Event playback**: in Security, each door tile lists recent "🔓 unlocked <time>" with "▶ clip" that opens the player **at that moment** (not just last 2 min).
- ☐ Dealer-admin **Network** capability switch appears in the user's Site Systems access.

Note: UniFi **Network** uses the controller API key (works if reachable); UniFi **Access** doors need the Access controller reachable from our servers (port 12445) — flag if it can't connect.

---
*(new builds appended below as they ship)*
