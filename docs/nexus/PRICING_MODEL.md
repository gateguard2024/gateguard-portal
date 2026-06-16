# GateGuard Pricing Model — Working Reference (roadmap)

Status: **defining.** This captures costs + decisions so the formula work isn't lost. Not yet built.

## Why a flat per-unit price can't work
Sites vary enormously in configuration — e.g.:
- 3 gates + 2 cameras
- 11 gates + 16 doors + 5 cameras
- cameras only

So pricing must be an **itemized calculator** (per component), not a single $/unit number. The customer-facing price can still *present* simply (e.g., a blended monthly), but it's computed from the parts below.

## Brivo costs (what GateGuard pays), monthly
| Component | Cost |
|---|---|
| Base | $89.25 |
| Common/hardwired doors — S1 (doors 1–2) | $11.10 each |
| …S2 (doors 3–12) | $9.00 each |
| …S3 (doors 13+) | $3.72 each |
| Mobile passes (500 included in MDU base) | +$9.30 per extra 100 |
| Per-unit control — Schlage/Allegion/dormakaba via Brivo mobile-pass app | $2.25/unit |
| Per-unit control — Brivo smart-home via gateway | $4.50/unit |

## Camera costs (what GateGuard pays), monthly
| Component | Cost |
|---|---|
| Camera with access | $14 each |
| Camera monitored | $30 each |

## Pricing anchor (decided)
- **"$5 model" = $5/unit/month retail** is the anchor for per-unit access.
- **$2.50 = the cost ceiling per unit** to hold the $5 model (≈50% margin / $2.50 profit).
- Mobile-pass-app units ($2.25/unit) **fit** under the ceiling → $5 model works.
- Gateway / smart-home units ($4.50/unit) **break** the $5 model → need their own tier (TBD).

## The scaling problem (decided framing)
- Fixed costs (base $89.25, doors, cameras, extra passes) sit **on top** of per-unit cost.
- To stay ≤ $2.50/unit all-in on pass-app units, fixed costs can only add **$0.25/unit** — the base alone ($89.25) doesn't amortize under $0.25/unit until **~357 units**. So flat $5 only holds for large pass-app properties; everything else needs the levers below.

## MODEL (current)
Two layers. Implemented in `components/nexus/PricingCalculator.tsx`.

**Step 1 — Gate Guard cost** (what GG pays Brivo / Eagle Eye), monthly:
- Base $89.25/site (500 passes incl; ~1.5 passes/unit) — applies when there's access
- Doors tiered: $11.10 (1–2) / $9.00 (3–12) / $3.72 (13+)
- Common-area smart lock (Schlage/Allegion/dormakaba): $2.25 each
- Unit control: $2.25/unit (app) or $4.50/unit (gateway)
- Cameras: $15 each (monitored OR stored-video — same cost)
- Extra mobile passes: $30 per 100 over the 500 included

**Step 2 — Dealer price** = GG cost + (living units × per-unit margin), where GG margin is **bounded $2.25 min / $3.00 max** per unit. (`MARGIN_MIN = 2.25`, `MARGIN_MAX = 3.00`.)

**Phase 2 — End-user price** = dealer price + dealer markup (TBD).

Open: how the per-unit margin applies to **gate-only / camera-only** sites with no living units (currently no margin until living units entered). Where used: Sales → Opportunities → **Rough Calculator** (live). Next: feed dealer price → opportunity MRR + proposal.

## Calculator requirement (when built)
Itemized inputs per site: # gates/common doors (auto-tier S1/S2/S3), # units + control type (pass-app vs gateway), # cameras (with-access vs monitored), # mobile passes. Output: true monthly cost + recommended retail (per the model above) + blended $/unit + margin. Feeds the opportunity MRR field and the Sales → Opportunities → Rough Calculator.
