# Intern B — 12-Hour Work Plan
## You OWN the Dealer Experience: Lead → Fully Certified Dealer

Your job for 2 days (~6 hrs/day): be the channel manager onboarding a brand-new dealer — from "interested" to **active, logged-in, and on the path to certified**. Own finding every bug and every spot that isn't **easy enough for a 5th grader**. Test on **beta**.

Use `INTERN2_DEALER_ONBOARD_TEST.md` as your click-by-click script. This plan is how to spend the 12 hours and what to hand back.

**Score on every screen:** "Would a 5th grader know what to do without asking?"
**Two running lists:** 🐞 Bugs and 😕 Confusing.

---

## ⚠️ First thing (Hour 1) — confirm prereqs WITH THE ADMIN
Onboarding sends real emails + creates logins. Before testing, confirm on beta: **RESEND_API_KEY** set, **Clerk** configured, migrations **017 / 025 / 026** run. If any are missing, you can still test up to "Send for signature" — note where it stalls. Have **two** test emails ready (one = the dealer's signer, one = the dealer's admin user).

---

## DAY 1 (6 hours)

**Hour 1 — Orientation + prereqs (above)**
- Open Admin (top-right icon) → Dealers → New Dealer. Read the "coming soon — don't log as a bug" list.

**Hours 2–3 — Run the wizard end-to-end, logging every step**
Type → Org info (creates a **draft** dealer) → NDA send + **sign from your test email** → Relationships → Commission → Agreement send + **sign** → Users (admin + tech) → Compliance → **Activate**.
- For each step: did it work? was it obvious? Did the NDA/Agreement emails arrive and let you sign cleanly?

**Hour 4 — Did activation really work?**
- Confirm the dealer's **admin user got an invite email** and can accept + log in. Confirm the **technician got a GG-XX-#### code**. If either didn't happen, that's a top bug.

**Hour 5 — Jargon & ease-of-use pass**
- Score each step 1–5. Flag terms a normal person wouldn't know: **MA, MSO, SP, SD, "per unit," entity type, tier**. Note where the flow jumped a step (e.g., skipped commission) without explaining why.

**Hour 6 — Day 1 report**
- Top 5 bugs, top 5 confusing spots, and whether the NDA→Agreement→Activate path is clear.

---

## DAY 2 (6 hours)

**Hour 7 — Resume + break-it**
- Start a 2nd dealer, fill only Type + Org info, leave. From the Dealers list use **Resume →**; confirm it reopens at the right step. Try empty fields, Back mid-wizard, refresh — note anything lost.

**Hour 8 — Become the new dealer**
- Log in as the dealer admin you just invited. Can they reach their sections? Create their **first property/site** and run a quick mini lead→opportunity to see their world.

**Hour 9 — Permissions (very important)**
- As the dealer, confirm they see **only their own org and anything below them** — NOT corporate, NOT sibling dealers, NOT other dealers' leads/jobs/customers. If they can see anything "above or sideways," that's a top security bug. (Confirm your corporate login still sees everything.)

**Hour 10 — The "certified" gap**
- Today there's no training/certification step yet (the **University** is coming). Walk the onboarding and note: where SHOULD training + certification live? What would a new dealer need to learn before going live? Write it as a wishlist — this feeds the University build.

**Hour 11 — Rank everything**
- One ranked list: top 10 issues, each 🐞 bug or 😕 confusing, with screen + expected vs actual.

**Hour 12 — Final report + walkthrough**
- 1-page summary: "Can someone onboard a brand-new dealer to active + logged-in without help? Where do they get stuck? What's missing before a dealer is truly 'certified and ready'?" Be ready to screen-share.

---

## What to hand back
- Ranked top-10 list (bug vs confusing, screen, expected vs actual, screenshot).
- Per-step 5th-grader scores + the acronyms that need plain-English labels.
- The **certification/training wishlist** (feeds University).
- One sentence: the single biggest thing that would make onboarding easier.
