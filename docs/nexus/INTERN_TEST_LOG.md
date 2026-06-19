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
*(new builds appended below as they ship)*
