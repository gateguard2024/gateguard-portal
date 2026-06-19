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

## Build 4b — Guided quote builder (#66)  ← next
Rebuild the quote builder as the simple guided-card flow.

## Build 5 — Site lifecycle + activity timeline (#60, #59)
Site activation rule (contract signed AND deposit paid); unified per-record activity timeline (emails + events + notes).

## Build 6 — Dealer onboarding + network (#48, #61, #10)
8-stage dealer onboarding workflow; dealer recruitment pipeline (prospect→vetting→onboarding); fold Dealers + Feature Settings into the admin hub.

## Build 7 — Org/user admin (#75, #76, #77, #78, #64, #79)
Assignable-orgs endpoint; Add-Person company picker; user deactivate/reactivate + move-org (glass); record sharing/co-working; retire legacy /admin/users + /admin/settings/features.

## Build 8 — EOS / Traction (#70, #71, #69)
V/TO + Rocks + Scorecard + Issues surface; restore dashboard EOS; L10 weekly meeting runner; rebuild Timeline/Gantt planner in glass.

## Build 9 — Integrations & extras (#83, #74, #73)
Brivo Users module (per-site); University/Training section; "Ask Nexus anything" smart router bar.

## Build 10 — Platform hardening (#65, #68, #50, #49, #51, #88, #89)
Security batch 2 (ilike/activities scope/role-tech); consolidate Gmail OAuth; doc-portal security/expiry/domain; retire legacy external links + ops pages; code-split Nexus surfaces; concurrency (pooled conn + caching).

## Build 11 — Framework upgrade (#80)  ← do last, isolated
Next 14→15 + Clerk 5→6. Highest blast radius; its own weekend pass.

---
Also standing: run pending migrations (122–125) on prod; ops task — add Gate Guard user / verify mprabhu access (#72).
