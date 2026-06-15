# Intern Test Scripts — Dealer Onboarding & Lead → Job

> For interns testing on **beta** this week (incl. onboarding the 4 real dealers).
> Source of truth for the model: `docs/nexus/DEALER_HIERARCHY_AND_PERMISSIONS.md`.
> Golden rule: a user/dealer can never get more access than its parent org. 5th-grader simple.

---

## ⚠️ PREREQS — clear these before testing (admin/owner, not the intern)
Onboarding sends real emails and creates real logins, so these must be set on **beta**:

1. **`RESEND_API_KEY`** set on beta → NDA/Agreement signing emails actually send. (Without it, the signature record is created but no email goes out, and the wizard stalls waiting for a signature.)
2. **Clerk backend keys** configured on beta → the final "Activate" step can invite the dealer's admin user. (Without it, activation 500s.)
3. **Migrations run on beta:** `017` (dealer_network: org_tier + commission_config), `025`/`026` (document_signatures + templates), `105` (jobs), and the calendar `096`/`121`. Verify in Supabase:
   `select to_regclass('public.commission_config'), to_regclass('public.document_signatures'), to_regclass('public.jobs');`
4. **From-domain verified** in Resend (`documents@nexus.gateguard.co`).

If any of #1–#3 are missing, onboarding will partially complete — tell the admin before onboarding a real dealer.

---

## TEST 1 — Dealer Onboarding (onboard a new dealer)

**Where:** sign in as a corporate admin → Admin (top-right icon) → Dealers → "New Dealer" (wizard at `/admin/dealers/new`).

**Steps (the wizard has 9):**
1. **Type** — pick the dealer tier (e.g., Full Dealer). ✅ Expect: tier selected.
2. **Org Info** — name, entity type, license #, service-area states, address, contact email, website. Click Next.
   ✅ Expect: a **draft** org is created (saved as inactive). You can stop and resume later.
3. **NDA** — review the NDA (auto-filled from `lib/nda-template.ts`), set effective date, **Send for signature**.
   ✅ Expect: the dealer's signer gets an email with a `nexus.gateguard.co/document/...` link; status shows "pending."
   👉 To finish the step, the signer opens the link and types their name to sign (you can use a test email you control).
4. **Relationships** — set the parent org / master agent / master dealer this dealer rolls up to.
5. **Commission** — set sales-partner + service-dealer rates (master rates are locked at $0.50). ✅ Saved to commission_config.
6. **Agreement** — review the tier-specific Dealer Agreement (`lib/agreement-template.ts`), **Send for signature** (same flow as NDA).
7. **Users** — add the dealer's **admin user** (name, email, role) + any technicians.
8. **Compliance** — upload/track COI, W-9, license (with expiry) + check the background-check acknowledgment.
9. **Review & Activate** — click **Activate**.
   ✅ Expect: org set active; the admin user gets a Clerk invite email; technicians get `GG-XX-####` codes.

**Resume a half-finished dealer:** Dealers list → the dealer shows a "Resume →" link → reopens the wizard at the first incomplete step. (Or `/admin/dealers/new?resume=<org_id>`.)

**What "done" looks like:** dealer is active, admin can accept the invite and log in, NDA + Agreement both show **fully executed** on the dealer's Compliance tab.

**If you get stuck:** NDA/Agreement won't send → RESEND not set. Activate errors → Clerk not set. No commission save → migration 017 not run. Report to the admin.

---

## TEST 2 — Lead → Job (capture a lead, win it, start the install)

**Where:** Nexus home → **Sales** tab (or the Ask bar).

**Steps:**
1. **Capture a lead** — Sales → "Capture Lead" → pick a source (Phone), enter contact name (e.g., "Test Owner"), property ("Stonegate Apts"), and a one-line need. Click Create.
   ✅ Expect: lead created and opens. (If it warns about a duplicate, choose "create anyway" for testing.)
2. **Work the lead** — in the lead window, try: **Add note**, **Log call**, **Schedule follow-up** (shows up in your To-Dos), **Update status**. ✅ Each should save and appear.
3. **Create the opportunity** — click **Create Opportunity**.
   ✅ Expect: an opportunity is created, the lead flips to "converted," and the **Opportunity window opens automatically**.
4. **Mark it won** — in the opportunity window → Next Best Actions → **Mark Won**.
   ✅ Expect: green confirmation "Marked won ✓ — now use Create Project…"; stage shows "won."
5. **Create the install job** — click **Create Project**.
   ✅ Expect: green "Install job created ✓ — find it under Jobs." A job is created with the install checklist (Deposit → Procurement → Staging → Installation → QC → Billing).
6. **Verify the job** — go to **Jobs** → the new job appears; open it to see the seeded checklist. Optionally open **Dispatch** (button on Jobs) and assign a tech.

**What "done" looks like:** one continuous path from a phone lead to a scheduled install job with a checklist, no dead buttons.

**If you get stuck:** Create Project errors → migration 105 (jobs) not run. Buttons do nothing → hard-refresh (stale build).

---

## Notes for the admin
- The existing onboarding board component is `components/nexus/InternalDealerOnboardingBoard.tsx`; the wizard is `app/admin/dealers/new/page.tsx`; APIs: `create-draft-dealer`, `signatures/send`, `activate-dealer`.
- The full 8-stage onboarding vision (background checks, channel manager, W-9/ACH, marketing toolkit, certification, 30/60/90 reviews) is future scope in `docs/nexus/DEALER_ONBOARDING_WORKFLOW.md`. This week uses the working wizard above.
