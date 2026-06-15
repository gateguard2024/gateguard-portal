# Full Flows — Sales→Job & Dealer Recruitment→Active Site (spec)

> Authoritative as of today's hierarchy (lib/permissions.ts roles admin/supervisor/user/tech + lib/org-scope downward subtree + migration 110 canonical parent + corporate guarantee). Supersedes any older hierarchy assumptions.

## Rule 1 — When is a SITE "active"? (Russel, authoritative)
> A site becomes **active** once the **contract is signed AND the deposit is paid**.
> A site is **long-lived** — we may work on it many times over the years; that does NOT change what made it active. So "active" is NOT tied to a job being created or completed.

Implications:
- A **Site record exists early** (created when a deal is won, or when the contract/quote is sent), with status like `prospect`/`pending`.
- Two signals flip it to `active`:
  1. **Contract signed** — the site's agreement/proposal `document_signatures` row is `fully_executed`.
  2. **Deposit paid** — the deposit `invoice` for that site/job is marked paid.
- When BOTH are true → set `sites.status = 'active'` (compute on each signal). Once active, it stays active across future jobs.
- Sites scope to the dealer via `org_id` / `master_dealer_id` / `install_dealer_id` (already honored by the new org-scope).

## Flow A — Sales → Job (customer) — DETAILED (Russel, authoritative)
1. Capture lead ✅
2. Work the lead (note/call/follow-up/status) ✅
3. Create opportunity ✅
3A. **Schedule survey** — book the site survey (survey record + calendar/work-order). ⚠️ survey module exists; scheduling wire TBD
3B. **Complete survey** — capture devices/conditions on site. ✅ (survey page)
3C. **Create SOW & BOM** — generate Scope of Work + Bill of Materials from the survey. ✅ (`/api/surveys/[id]/generate`)
4A. **Create proposal** — build the proposal/quote from the SOW & BOM. ✅ (survey → create-quote / quote builder)
4B. **Send proposal** — to the customer via the no-login portal. ✅ (`/api/quotes/[id]/send`)
4C. **Negotiate proposal** — customer requests changes / asks questions; revise + resend. ⚠️ portal has request-changes/ask; revision loop wire TBD
4D. **Send deposit invoice & contract** — issue the deposit invoice + the contract for signature together. ⏳ wire (invoices + signatures both exist; combined send to build)
4E. **Contract signed & deposit collected** — agreement `fully_executed` AND deposit invoice paid. ✅ signals exist / ⏳ combined gate (#60). **This is effectively "Won."**
6A. **Create Site (ACTIVE)** — once 4E is true, create the Site under the right dealer org with status `active` (Rule 1). Long-lived from here on. ⏳ #60 (`/api/sites` exists)
6B. **Order / track / receive parts** — procurement: create PO, track, confirm receipt. ⚠️ job checklist has a procurement group; real parts tracking TBD
7A. **Schedule job** — put the install on the calendar / assign a tech (Dispatch). ✅
7B. **Finish job** — complete the install, QC. ✅ (job complete)
7C. **Customer handoff** — sign-off / handoff to the customer; site stays active for future service. ⚠️/⏳ handoff step TBD

Note: "Mark Won" becomes automatic at **4E** (contract signed + deposit collected) rather than a manual button. Future service jobs attach to the same active site without re-deriving "active."

## Flow B — Dealer Recruitment → Onboarded Dealer + First Active Site — DETAILED
1. **Capture dealer recruitment lead** ⏳ #61 — prospect dealer enters the funnel.
   - 1A capture source + company + contact + territory of interest
   - 1B set recruitment stage = Prospect
2. **Vet the prospect** ⏳ #61 (+#48) — gate before any org is created.
   - 2A background & credit check (mandatory if they'll hold inventory/financial data)
   - 2B verify business entity (legal name, license)
   - 2C territory-overlap check vs existing dealers
   - 2D assign Channel Manager (internal account manager) as single point of contact
   - 2E stage = Ready to onboard
3. **Convert to onboarding** ⏳ #61 — converting the recruit creates the **draft dealer org** (`create-draft-dealer`, inactive). Wizard itself ✅
4. **Onboarding wizard** ✅ (these steps exist today)
   - 4A tier / type · 4B org info · 4C relationships (parent/master) · 4D commission config
   - 4E NDA send + sign ✅ · 4F Dealer Agreement (ADA) send + sign ✅
   - 4G **W-9 + ACH** collected with the ADA ⏳ #48 (so commissions can be paid)
   - 4H users (admin + technicians) · 4I compliance (COI, license, background ack) ✅
5. **Activate dealer** ✅ (org active, admin invited, techs get GG-XX-#### codes)
   - 5A welcome email + login credentials ✅
   - 5B welcome letter introducing the Channel Manager ⏳ #48
   - 5C marketing / co-branding toolkit delivered ⏳ #48
6. **Provision access** ✅ — role (admin/supervisor/user/tech) + feature flags by tier; **downward-only visibility** (today's hierarchy; a dealer never sees above/around itself).
7. **Training & certification** ⏳ #48 (training module + scorecards exist)
   - 7A platform training · 7B sales certification · 7C field/tech certification (if self-install)
8. **Dealer's first site goes ACTIVE** — the new dealer runs **Flow A** for their first property.
   - 8A first-sale shadowing (monitored first deal) ⏳ #48
   - 8B reaches Flow A step 4E → 6A → **site active** (contract signed + deposit collected, Rule 1) ⏳ #60
9. **Ongoing management** ⏳ #48 — mandatory 30 / 60 / 90-day reviews (volume, install quality, marketing compliance, platform usage).

### Already works today (intern can do now)
Steps 3→4→5→6: start wizard (draft org) → NDA/Agreement → users/compliance → activate → admin invited, access provisioned by tier.
### Net-new builds
Recruitment funnel + vetting + Channel Manager (#61); W-9/ACH, welcome letter, marketing toolkit, certification, shadowing, 30/60/90 (#48); site-active rule (#60).

## Build tasks
- **#60** Site lifecycle + activation rule: site states (prospect/pending/active/inactive/churned); create-on-won; flip to active when contract `fully_executed` AND deposit invoice paid; keep active across future jobs.
- **#61** Dealer recruitment pipeline: recruitment-lead object + stages; "Convert to onboarding" → draft org → existing wizard.

## Works today (for intern testing now)
- Customer: lead → opportunity → Mark Won → Create Project (install job + checklist).
- Dealer: start wizard (draft org) → NDA/Agreement → activate → admin invited.
- Site creation API exists (`/api/sites`, status defaults active) — can be used manually until #60 automates the rule.
