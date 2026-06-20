# Nexus Build Path — consolidated open items, sequenced

Ordered by momentum (build on what we just shipped) → core revenue ops → admin → EOS → hardening. Each build is one beta push; promote to main after review.

## Build 1 — Finish the product/manual intake loop  ← START HERE
Completes tonight's work so product intake is truly one-tap and visible.
- Per-product **"Vectorize manual now"** button (fires the kb/manual.ingest job on demand).
- **AI-coverage badge** in Parts (shows which products have manual_chunks / figures).
- Manual-trigger endpoint `/api/kb/ingest-manual` + `/api/kb/coverage`.
*(beta-safe, additive, no risky migration)*

## Build 2 — Part-Finder (#113)
Type a part # or paste a URL → web lookup proposes name/brand/model/manual → confirm → add to products → auto-ingest. The capstone of intake.

## Build 3 — Pricing calculator + server-side cost (#84, #86)
Gates/doors/cameras/units → install cost; pull units from Overview; feed survey → financials; move GG cost server-side (security).

## Build 4a — 7-stage pipeline + deposit automation (#82)  ✅ shipped
Canonical pipeline in `lib/pipeline.ts` (single source of truth) + tolerant `normalizeStage()` so lifecycle stages never drop off the board; deposit-collected → Closed Won + auto-create install job.

## Build 4b — Guided quote builder (#66)  ✅ shipped
Proposal step rebuilt as a 3-card flow (add products / custom line / review) that builds a real quote tied to the opportunity, with links to the full quote + client proposal pages.

## Build 5 — Site lifecycle + activity timeline (#60, #59)  ✅ shipped
Unified `/api/activity` feed + reusable `ActivityTimeline` (mounted on opportunities + site drawer); `lib/site-lifecycle.ts` activation rule (contract signed AND deposit paid) + migration 126 + auto-activate on deposit conversion. **Run migration 126 on beta then prod.**

## Build 6a — Dealer onboarding 8-stage layer (#48 core)  ✅ shipped
`lib/dealer-onboarding.ts` (canonical 8 stages + bucket→stage map + 30/60/90 review schedule) + migration 127 (vetting + channel manager columns). Onboarding board now shows Stage N/8, editable Vetting (stage 1) + Channel Manager (stage 2), and 30/60/90 review badges for live dealers (stage 8). **Run migration 127 on beta then prod.**

## Build 6b — Recruitment pipeline + Feature Settings into hub (#61, #10)  ← later
Pre-org prospect/application funnel (prospect→vetting→onboarding) and fold Feature Settings into the admin hub as a board (currently routes out / "coming soon").

## Build 7a — Org/user admin core (#75, #76, #77, #78)  ✅ shipped
Assignable-orgs endpoint + Add-Person company picker were already in place; added **deactivate/reactivate** (soft, Clerk metadata + ban) and **move-user-to-another-org** (hierarchy-gated) actions on the user-window backend + a "Status & Organization" section in the Users & Access glass window.

## Build 7b — Record sharing + legacy retirement (#64, #79)  ← later
Record sharing / co-working + admin redistribute; retire legacy /admin/users + /admin/settings/features pages.

## Build 8 — EOS / Traction (#70, #71, #69)
- #70 EOS surface (V/TO + Rocks + Scorecard + Issues) — already built (`/eos`).
- ✅ #71 **L10 weekly meeting runner** shipped — `/eos/l10`: 7-segment agenda, per-segment + total timers, live data from the EOS APIs, IDS solve + drop-to-issues + capture to-dos, conclude rating. "Run L10" button on the EOS header.
- #69 Tracker/Gantt glass rebuild — separate (deferred, Build 8b).

## Build 9 — Integrations & extras (#83, #74, #73)  ✅ shipped
- #83 Brivo Users module — already built (per-org Brivo token, list/create users + groups, scope-gated `BrivoUsersSurface`). ✅
- #74 University/Training — already built (`/training`: courses, chapters, quizzes, certs, progress). ✅
- ✅ #73 — Ask bar + command router already existed; added the **movable how-to window** (`HowToWindow`): draggable, remembers position, reads the platform how-tos, floats over any Nexus screen. Mounted in `NexusHomeClient`.

## Build 10 — Per-site multi-vendor credentials vault  ✅ shipped (foundation + Brivo)
Each property site has its OWN credentials for **Brivo, Eagle Eye, Shelly, UniFi**.
- `lib/crypto-creds.ts` — AES-256-GCM, ONE master key (`CREDENTIALS_ENC_KEY`); secrets stored as encrypted rows (no per-site env).
- Migration `128_site_integrations.sql` — `site_integrations(site_id, vendor, credentials_enc, status, …)` + GRANT.
- `lib/site-integrations.ts` — unified `getSiteVendorCreds(siteId, vendor)` + status (never returns secrets) + save + test-marking.
- `lib/brivo.ts` → `getSiteBrivoToken(siteId)` reads the vault (Brivo wired end-to-end with a real Test).
- `/api/sites/[id]/integrations` — GET status / PUT save (encrypted) / POST test; admin + site-scope gated.
- **Connections card** on the site drawer to enter + test each vendor's creds.
- **Run migration 128 + set `CREDENTIALS_ENC_KEY`** on beta then prod.
## Build 10b — Add-a-site + full per-site credentials  ✅ shipped
- **"+ Add a site"** in Operations → Locations: create a site, then it opens straight to its Connections card.
- **Brivo is now fully per-site** (own username, password, API key, client ID, client secret, site ID) — nothing shared; `getSiteBrivoToken` builds auth from the site's own creds (env app keys only as legacy fallback).
- **Add / Edit / Delete** all wired: Set up, Update (blank-safe), and **Remove** (confirm + DELETE endpoint).
- Remaining (Build 10c): live clients for Eagle Eye / Shelly / UniFi + repoint the Brivo **Users list/create** screen (BrivoUsersSurface) to the per-site token.

## Build 10 — Platform hardening (#65, #68, #50, #49, #51, #88, #89)
Security batch 2 (ilike/activities scope/role-tech); consolidate Gmail OAuth; doc-portal security/expiry/domain; retire legacy external links + ops pages; code-split Nexus surfaces; concurrency (pooled conn + caching).

## Build 11 — Framework upgrade (#80)  ← do last, isolated
Next 14→15 + Clerk 5→6. Highest blast radius; its own weekend pass.

---
Also standing: run pending migrations (122–125) on prod; ops task — add Gate Guard user / verify mprabhu access (#72).
