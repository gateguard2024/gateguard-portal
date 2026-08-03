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
- **Still open:** G6 (popup map embed + larger fonts + width).

## Suggested order (highest value first)
1. **G2 + G4** (core facts + accuracy labels) — the foundation everything else reads.
2. **G1** (improve Yardi/apartments extraction) — feeds G2.
3. **G3** (owner/mgmt addresses + owner POC).
4. **G6** (popup map + fonts + width).
5. **G5** (corporate monthly save cap).
6. Re-audit pass for accuracy/depth.
