# Intern 2 — Dealer Onboarding Test Packet (Dealer Lead → Onboarded Dealer)

You are testing the **dealer onboarding experience** in Nexus on **beta** — bringing a brand-new dealer from "interested" to "active and able to log in," and (stretch) their first property live. Tell us anywhere it's confusing, breaks, or you don't know the next step.

**Golden question on every screen:** "Would a 5th grader know what to do here?"

---

## Before you start (ADMIN must confirm — onboarding can't complete without these)
These are set by the admin on **beta**, not by you. If onboarding stalls, it's almost always one of these:
- **RESEND_API_KEY** set → NDA/Agreement signing emails actually send.
- **Clerk** configured → the final "Activate" step can invite the dealer's admin login.
- **Migrations run on beta:** 017 (dealer tiers + commission), 025/026 (signing docs + templates).
- A **test email you control** to play the dealer's signer + admin user.

## ⚠️ Known "coming soon" — do NOT log these as bugs
- A separate **dealer recruitment funnel** (prospect → vetting) before the wizard. Today, starting the wizard *is* the lead (it creates a draft, inactive dealer).
- **Background/credit check**, **W-9 + ACH** collection, **Channel Manager** assignment.
- **Welcome letter + marketing/co-branding toolkit** on activation.
- **Training & certification** gating; **first-sale shadowing**; **30/60/90-day reviews**.
Note "expected — coming soon" and move on.

---

## DAY 1 — Start the dealer + send documents

1. **Open the wizard.** Admin icon (top-right) → Dealers → **New Dealer** (`/admin/dealers/new`).
2. **Step 1 – Type.** Pick a tier (e.g., **Full Dealer**).
3. **Step 2 – Org info.** Company name "Test Security Co", entity type, license #, service-area state, address, **contact email = your test email**, website. Next.
   - ✅ Expect: a **draft dealer** is saved (you can stop and resume later).
4. **Step 3 – NDA.** Review the NDA, set the effective date, **Send for signature**.
   - ✅ Expect: your test email gets a `nexus.gateguard.co/document/...` link. Open it, type your name, **sign**.
   - ✅ Expect: status moves toward "signed/executed".
5. **Step 4 – Relationships.** Set who this dealer rolls up to (parent / master).
6. **Step 5 – Commission.** Set the rates (master rates are locked). 
   - ⤷ *Note any term you didn't understand (MA, MSO, SP, SD, "per unit").*
7. **Step 6 – Agreement.** Review the Dealer Agreement, **Send for signature**, then sign it from your test email (same as the NDA).

**End of Day 1 feedback (fill in):**
- Did each step clearly tell you what to do next? ___
- Did the NDA + Agreement emails arrive and let you sign without confusion? ___
- Any word/acronym you didn't understand? ___
- Anything that broke or did nothing? ___
- 5th-grader rating (1–5): ___

---

## DAY 2 — Users, compliance, activate, first site

8. **Step 7 – Users.** Add the dealer's **admin user** (name + a 2nd test email + role) and one technician.
9. **Step 8 – Compliance.** Upload/track COI, W-9, license (with expiry), check the background acknowledgment.
10. **Step 9 – Review & Activate.** Click **Activate**.
    - ✅ Expect: the dealer becomes active; the admin user gets a Clerk invite email; the technician gets a `GG-XX-####` code.
11. **Resume test.** Start a *second* dealer, fill only step 1–2, leave. Go to the Dealers list → click **Resume →** on it.
    - ✅ Expect: it reopens at the first unfinished step.
12. **(Stretch) First site.** For the activated dealer, create their first property/site (Operations or Sites) under that dealer.
    - ✅ Expect: the site is created and tied to the dealer. (Auto "active when contract+deposit" is coming soon — for now just confirm a site can be made.)

**End of Day 2 feedback (fill in):**
- Could you take a dealer from "new" to "active + can log in" without asking for help? ___
- Where did you get stuck, or land on an older-looking (non-glass) page? ___
- Did the admin invite + tech code actually appear? ___
- Top 3 things to make simpler: 1.___ 2.___ 3.___
- 5th-grader rating (1–5): ___

---

## How to report
For anything broken: **what screen, what you clicked, what you expected, what happened** (screenshot helps). Mark known items "expected — coming soon".
