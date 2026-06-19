# Making `/tech` Second to None — Field-Tech App Playbook

Synthesis of a 5-angle competitive study (ServiceTitan, BuildOps, Jobber, Housecall Pro, FieldEdge, ServiceTrade, simPRO, Praxedo, ServiceMax, Salesforce FS, FieldPulse, plus security peers System Surveyor, D-Tools, Verkada, Brivo, Alarm.com, SedonaOffice, and AI/AR players Aquant, XOi, IFS, TeamViewer, Librestream). Sources at bottom.

## TL;DR — where we already stand
GateGuard `/tech` is, surprisingly, **already ahead of the pack on the hardest, most-differentiating axis: AI manual-backed, step-by-step diagnostics with terminal maps.** That's exactly where ServiceTitan (Atlas/Field Pro) and Aquant are racing to. We also have two things **no market leader ships on mobile**: a **wiring-pinout/cable-reference library** and a **dealer-neutral** posture (Brivo↔UniFi mix) where Verkada/Brivo/Alarm.com apps are single-vendor.

So "second to none" is not about catching up — it's about (1) finishing the **table-stakes job flow** so techs trust it daily, and (2) bolting our AI/wiring strengths onto a **device-anchored, offline-first, photo-proof** workflow that the generic FSM apps can't match.

---

## Tier 1 — Table-stakes to finish (high impact, mostly low/med effort)
These are the things every loved field app does; gaps here cause abandonment regardless of how good our AI is.

1. **Offline-first capture (NOT just offline-capable).** *Highest impact.* Techs work in gate vaults, mechanical rooms, rural perimeters. The app must never say "wait for connectivity." Pattern: write every action (photo, part, time, note, signature, step-check) to local storage immediately + a sync queue that drains invisibly. Read views cached too. **Footgun to avoid (ServiceTitan's real bug): never let a data refresh clobber an unsynced queue.** *Effort: med-high (Service Worker + IndexedDB queue on the PWA).* Best-in-class: ServiceMax Go, BuildOps, Praxedo.
2. **Required-photo checklist per device type + Quick Capture.** One tap to camera (no menu diving), auto GPS+timestamp, and a *required* shot list per device (reader serial, controller board/MAC, gate-operator nameplate, **before/during/after**). *Impact: high, effort: low-med.* Best: Housecall Pro (annotate/timestamp/video), SnapProof methodology.
3. **Job-centric navigation with the checklist as the home of each job.** The "job" is the central object: Overview / Steps / Equipment / Photos / History / Complete. Never bury steps under tabs. We have most of this in My Jobs — tighten it. *Impact: high, effort: low.* Best pattern: Team400 design spec, Jobber simplicity.
4. **Glanceable status + linear steps + forgiving UI.** Big status chips, "Step 6 of 8" progress, confirm-before-destroy, auto-save, easy undo, plain-English disabled reasons. *Impact: med-high, effort: low.*
5. **Kill typing.** Pickers + voice notes + scan + photo instead of free text; pre-fill from the work order. Data entry is the #1 under-rated pain point. *Impact: high, effort: med.*
6. **One-tap comms** to dispatch / supervisor / other techs on the job. *Impact: med, effort: low.*

## Tier 2 — Differentiators worth adding (where we leapfrog)
7. **Nameplate / QR / barcode OCR to capture device serial + MAC in seconds.** *This is the single highest-leverage new feature.* It ties directly to our Equipment-on-site + site asset history, and it's how the best security apps work: ServiceTrade **Smart Scan** (nameplate OCR → asset), Verkada (multi-QR in one frame → provision), XOi (dataplate OCR → pulls manual + history). For us: scan → create/lookup `site_assets` → auto-link the manual (we already have `products.manual_url` + vectorized manuals). *Impact: very high, effort: med.* **Differentiator becoming standard — get there first in our niche.**
8. **Device-anchored data model (the System Surveyor edge).** Photos, serials, test status, and notes attach to a *specific device on a scaled floor plan*, not a flat form. We already have the Design/floor-plan platform + site assets — connect them so a tech taps a device on the plan to see/add its history. *Impact: high, effort: high.* Nobody in generic FSM has this; it's the security-installer moat.
9. **AI pre-job brief.** On opening a job, an AI summary of the site: equipment installed, last visits, open issues, gate/access notes, contact. We have the data (site history, ARIA-style synthesis, `/api/kb`). *Impact: high, effort: med.* Best: Salesforce Work Briefings, IFS, ServiceTitan Field Pro.
10. **Photo/AI visual diagnostics in-flow.** Tech photographs the fault → AI returns likely cause + the relevant manual step. We already call `/api/kb/ask` with equipment context and have `analyze-image`; surface "📷 Diagnose from photo" inside the job. *Impact: high, effort: med.* Best: Salesforce Einstein (on-device, offline), XOi.
11. **Parts / truck inventory with barcode scan + auto-deduct.** Scan a part onto a WO, decrement truck stock, request replenishment. *Impact: med-high, effort: med-high.* Best: ServiceTitan (truck-stock guardrails), simPRO + FieldPulse (barcode), ServiceTrade (predictive pre-staging). We have `products` + `purchase_orders` already.
12. **In-field signature + customer sign-off on completion** (ties our proof gate to a signed completion record / mini service report PDF). *Impact: med, effort: med.* Table-stakes everywhere; we're missing the signature.

## Tier 3 — Moonshots / later
13. **AR remote expert ("see what I see")** — senior tech guides a junior via live video + markers. Best: TeamViewer Frontline, Librestream (low-bandwidth/offline). *Effort: high; integrate, don't build.*
14. **Closed knowledge loop** — field resolutions auto-write/refine KB articles (IFS, Aquant). We already capture resolutions via `/api/kb/resolve`; feed them back into the manual corpus. *Effort: med, compounding payoff.*
15. **Live commissioning** (scan → actually provision/test the device) — Verkada/Brivo/Alarm.com do this single-vendor. Our dealer-neutral Brivo↔UniFi position makes a cross-vendor version uniquely valuable. *Effort: high, depends on vendor APIs.*

---

## Recommended build order (impact ÷ effort)
1. **Finish the job flow + Quick-Capture required photos + glanceable/forgiving UI** (Tier 1 #2–4, #6) — fast, makes techs trust it.
2. **Offline-first capture queue** (Tier 1 #1) — the trust multiplier; bigger lift, do it deliberately.
3. **Scan-to-asset (nameplate/QR OCR)** (Tier 2 #7) — our biggest leapfrog, reuses manuals we already vectorized.
4. **AI pre-job brief + photo-diagnose in-flow** (Tier 2 #9–10) — leans on strengths we already have.
5. **Signature on completion**, then **parts/inventory scan** (Tier 2 #12, #11).
6. Later: device-anchored plan link (#8), knowledge loop (#14), AR/commissioning (#13, #15).

## What to copy from whom
- **Jobber** — ruthless simplicity (see schedule → Start → notes/photos → Complete). Our north star for ease.
- **Housecall Pro** — checklist UX (pass/fail, required steps) + photo annotate/timestamp/video.
- **ServiceTrade** — Smart Scan nameplate OCR + asset history + audio memos.
- **ServiceTitan** — AI field mentor depth + offline guardrails (and learn from its destructive-resync footgun).
- **System Surveyor** — device-anchored-to-floor-plan data model + as-built lifecycle record.
- **Salesforce / XOi** — photo→AI diagnosis and AI pre-job briefs.
- **Team400 / NN/G** — the hard UX rules: 44–48px targets, offline-first, kill typing, forgiving UI, <2s launch.

---

### Sources (primary)
ServiceTitan Field/Pro & inventory & Tap-to-Pay (servicetitan.com/features/pro/field, /features/field-mobile-app, help.servicetitan.com) · Housecall Pro checklists & jobsite photos (housecallpro.com/features) · ServiceTrade mobile app & Smart Scan & PartsManager (servicetrade.com) · FieldEdge equipment history (fieldedge.com) · BuildOps technician app (buildops.com) · simPRO barcoding (helpguide.simprogroup.com) · ServiceMax Go offline/van-stock (ptc.com/.../servicemax/go-mobile) · Salesforce Field Service AI (salesforce.com/news/stories/ai-for-field-service) · System Surveyor product features/as-built/BOM (systemsurveyor.com) · D-Tools Mobile Install (d-tools.com) · Verkada Command mobile (verkada.com/command/mobile) · Alarm.com MobileTech (alarm.com) · Aquant field technicians (aquant.ai) · XOi (xoi.io) · IFS Cloud 25R2 AI (blog.ifs.com) · TeamViewer Frontline xAssist (teamviewer.com) · Librestream Onsight (librestream.com) · Team400 field-service design patterns (team400.ai/blog/2025-07-field-service-mobile-apps) · NN/G touch targets (nngroup.com/articles/touch-target-size) · Skedulo, SnapProof, GetJobReport (offline-first).
