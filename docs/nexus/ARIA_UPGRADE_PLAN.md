# ARIA Upgrade Plan — spec vs. current engine

Engine: `app/api/aria/research/deep/route.ts` (v9.0), UI: `app/aria/page.tsx`, intel DB: `aria_properties` (migrations 098/100/101).

## What already exists (keep — don't rebuild)
- **Social search** of gates / access / lockers / bulk internet / bulk video / smart locks / automation / amenities → typed `pain_signals`. ✅
- **Search-engine + known-data-pool** cross-reference (`KNOWN_MDU_BULK_ISPS`, `KNOWN_VIDEO_PROVIDERS`, live `mdu_providers`, FCC broadband). ✅
- **Deductive proptech compilation** (regex exclusivity + PropTech-Scout Haiku + Sonnet synthesis) with `inferred_proptech[].confidence_pct` + reason. ✅
- **Never-fabricate-a-brand** rule: shows "Present — brand not identified" / "No data found" / named brand. ✅
- **Save/cache** every deep search → `aria_properties` (persistent) + `aria_searches` (30-day); DB-first short-circuit so a known property opens instantly with no new spend. ✅
- **Credit gating** — 100 credits/deep search, atomic spend, corporate can view org balances. ✅

## The six gaps to close

### G1 — Yardi Matrix + apartments.com as real structured sources
Today "Yardi/apartments" = `site:` filters inside Google/Serper queries; no API, no feed. Yardi Matrix has **no public API**. Options: (a) targeted Serper `site:yardimatrix.com`/`apartments.com` queries with **rawContent + JSON extraction** (improve what exists — no credentials needed); (b) a real Yardi **enterprise data feed** if you have credentials; (c) Chrome-automation/CSV import from the Yardi portal.

### G2 — Ordered first-pass facts (name, address, phone, **manager email**, units, **class A/B/C/D**, **type**, **occupancy %**) then gap-fill
Currently class/type/occupancy/manager-email are deferred to synthesis or never searched (occupancy is never queried; class enum is missing "D"). Fix: a dedicated first-pass extraction that saves these 8 fields with **source priority** (apts/Yardi value wins, general search only fills what's still missing).

### G3 — Owner POC + 3rd-party mgmt (regional/asset) with **mailing address** each
Today contacts have name/title/email/phone but **no mailing address**, and "owner POC" as a person isn't modeled (owner is an entity string). Add owner-contact person + address fields to the schema + extraction.

### G4 — Found-vs-assumed + accuracy % on **every** core fact
Today only inferred proptech carries a %. Extend a `{value, source: 'found'|'assumed', confidence_pct}` shape to units, phone, email, class, type, occupancy, owner, ISP — surfaced in the UI.

### G5 — Corporate monthly per-dealer save cap
Only credit-per-search gating exists; no monthly save quota. Add `aria_dealer_save_caps` (org_id, monthly_limit) + a monthly-count check on save + a corporate admin UI to set the cap.

### G6 — Popup polish: map embed + larger fonts + wider + steel
Hero image + steel theme already there. Missing: an embedded **map** in the detail popup, **larger typography** (body is 10–12px), and a bit more width.

## Progress
- **v9.1 (done this pass):** G1 first tranche — added Yardi Matrix / LoopNet / CoStar / CBRE / Crexi as a 6th parallel data-source search in Phase 1A, plus a dedicated occupancy/class/type/owner sweep. G2 first tranche — Phase 1A now extracts **manager email, class (A/B/C/D — D added), building type, and occupancy %** in the first pass and threads them into the `aria_properties` upsert with **source priority** (Apts/Yardi value wins; Sonnet only fills gaps). "Never guess class/occupancy" rules enforced in the extractor.
- **G4 (done):** per-field `found` vs `assumed` accuracy % (`field_confidence`) computed in the deep route, persisted into `facts.field_confidence` (merge upgrades assumed→found, never downgrades), and surfaced in the UI as `cfBadge` chips (green ≥90 found / blue found / amber `~%` assumed) on ISP, Video, Bulk, Phone, Units.
- **G3 (done):** owner point-of-contact + contact **mailing addresses** — `StepContact.address` + `role_type: 'owner'` extraction from EDGAR/LLC/registration; flows through `decision_makers` JSONB; UI contact cards show `📍 address` + amber `OWNER` badge.
- **G5 (done):** corporate monthly per-dealer save cap. Migration **181** (`aria_dealer_save_caps`), `lib/aria-save-cap.ts` (`getSaveCapStatus`), enforcement in `save-base` (402 over cap; stamps `org_id` so the count sees the row), corporate-only `GET/PATCH /api/aria/save-caps`, and admin UI at `/admin/aria-caps` + a card in the Internal hub.
- **G6 (done):** ARIA detail popup rethemed to the dashboard's brushed-steel tokens (`STEEL_FRAME` / `STEEL_TILE` / `STEEL_HEADER` / `STEEL_ACCENT`, matching the Opportunity Hub / windows). Widened to `max-w-6xl`; two-pane hero (property photo + live Mapbox **satellite map**, geocoded on open); big warm header banner; fonts bumped throughout (title 28px, rows 13px, buttons 15px, gauges larger); verdict + insight cards + sub-popups all steel. Fortune-500 clean, 5th-grader simple, same font/colors as the main dashboard.
- **All ARIA plan gaps (G1–G6) complete.**

## Deep audit + fixes (session 16, post-G6)

Three parallel audits (engine · persistence/scoping · UI) ran end-to-end. Fixed:

**Data integrity**
- **Same-name/different-address merge (P0 corruption).** Row resolution matched on `property_name` only, so "The Metropolitan" (Atlanta) and (Dallas) merged into one row and cross-contaminated ISP/proptech/contacts. Added `pickAddressMatch()` (name + compatible street number; incompatible ⇒ insert new) in `lib/aria-upsert.ts`, and reused it in `save-base` and the 23505 retry.
- **Address clobber.** `address` was written raw; a blank re-search wiped a known address (half the row's identity). Now via `mergeVal`.
- **Lost secondary writes (P0).** `saveEvidencePackets` (the whole v8 evidence ledger), `mdu_provider_detections`, and the tech-provider counter were detached `void (async…)()` — dropped on Vercel response teardown. Now awaited / routed through `pendingWrites` → `flushWrites()`.

**Save cap (G5 hardening)**
- **Deep-research bypass (P0).** Cap was only enforced in `save-base`; deep research created rows uncapped. Added a central cap net inside `upsertAriaProperties` (the single choke point all save paths flow through) — enriching an existing row is free, only NEW rows count.
- **Batch off-by-one.** `save-base` checked the cap once then saved the whole array; now counts within the batch and reports `cap_blocked`.

**Accuracy / never-fabricate**
- **Substring brand fabrication (P1).** "dishwasher"→Dish, "Seattle"→AT&T, "Wilcox"→Cox. Replaced `includes()` with word-boundary `mentionsProvider()` in the pain-signal loop and supervisor ISP scan; fixed bare `att` + `gigsstreem` typo → canonical display names.
- **Service descriptions leaking as brands (P1).** "High-Speed Internet"/"Cable TV" appended after the filter. Re-run `filterProviderNames` on the FINAL merged ISP/video arrays.
- **"No data found" leaking into scalar fields (P1).** Added to `SENTINEL_STRINGS` so a Sonnet "No data found" collapses to null (and doesn't score a false confidence).
- **Buy score = freshness (meaningless).** Rebuilt from real signals: bulk/ROE to displace + resident pain + reachable contact + low proptech saturation.

**Cross-org security**
- **PATCH not org-scoped (P1).** Any CRM user could overwrite another org's row by id. Now fetches the row's `org_id` and 404s a non-corporate caller from outside their org.

**Contact readiness (sell faster)**
- **Leasing-office email was discovered then dropped.** Now falls back onto `decision_maker.email` so a rep has an address.
- **Popup contact block.** New "Contact this property" card at the top of the report — office phone, primary contact, email, direct phone, owner, management — with **tap-to-call / tap-to-email / copy**. Previously all buried two clicks deep in sub-cards as static text.

**Deferred (documented, lower risk):** `org_id` is nullable (legacy/service rows are corporate-only until backfilled); a few Sonnet schema fields (`assessed_value`, `edgar_signal`) are gathered but not surfaced; the internal `POST /api/aria/properties` relies on the central `upsertAriaProperties` cap net rather than its own early check.

## Suggested order (highest value first)
1. **G2 + G4** (core facts + accuracy labels) — the foundation everything else reads.
2. **G1** (improve Yardi/apartments extraction) — feeds G2.
3. **G3** (owner/mgmt addresses + owner POC).
4. **G6** (popup map + fonts + width).
5. **G5** (corporate monthly save cap).
6. Re-audit pass for accuracy/depth.
