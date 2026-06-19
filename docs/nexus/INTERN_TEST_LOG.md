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
*(new builds appended below as they ship)*
