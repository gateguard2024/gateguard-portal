# Product Catalog → Portal Import — Phase Plan

Source: `GateGuard_Product_Catalogue_v a.1.docx` (July 16, 2026 draft).
Approach per Russel: break the document into phases and work through them slowly.
One phase = one build unit; a phase ships only when its catalog sections are stable.

| Phase | Catalog sections | What gets built | Status |
|-------|-----------------|-----------------|--------|
| **1 — Corporate pricing console** | §4 Base price & gate economics · §5 Buckets · Part Two price lines | **ONE catalog:** program pricing columns added to `service_catalog` (floor/target/status/quotable/bucket, migration 157) + `catalog_pricing_settings` + audit log; corporate-only API; admin page at `/admin/settings/pricing`. The catalog doc defines SERVICE & LABOR lines — the hardware `products` table (manuals / troubleshooter cross-reference ecosystem: manual_chunks, troubleshoot_sessions, device_suggestions, manual_figures) is intentionally untouched | 🔨 in progress |
| **2 — CPQ enforcement** | §7 Layering rules · B.1–B.4 configured-at-sale | Quote builder reads pricing from DB: deal-check band ($225–$310/gate), below-floor dual-approval gate, setup fees by Working/Non-working, required per-access-point steps, Tier 3 acknowledgment, "not quotable" blocking for [Open] items | ⏳ |
| **3 — Dealer-facing catalog** | Part Two specs A.0–C.8 · §8 responsibility matrices | `catalog_products` (full spec text, matrices, dealer_visible flags); Catalog surface cards + portal page; feature-flag gated rollout | ⏳ |
| **4 — Contract terms wiring** | §6 Term, payment schedule, ETF, territory, launch/ramp | Payment milestones + ETF schedule into quote/agreement templates and e-sign merge vars; SLA language BLOCKED from quotes until §9 item 5 resolves | ⏳ |
| **5 — Open-items tracker + KB** | §9 Open items | Tracker board seeded with the 10 open decisions (owners + due dates); `kb_articles` per spec so the Ask bar answers catalog questions | ⏳ |

Standing rules for every phase:
- [Open] items are **visible but never quotable** — the portal blocks them, it doesn't hide them.
- Anything touching the dealer/corporate revenue splits (§9 items 7–8) stays `dealer_visible = false` until resolved.
- No SOW/quote may print "48-hour dispatch" until the formal SLA (§9 item 5) is signed off.
- Pricing changes go through `/admin/settings/pricing` only — never hardcoded in CPQ.
