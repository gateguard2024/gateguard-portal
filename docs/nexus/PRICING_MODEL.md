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

## LOCKED RULE
**Price = max($150 minimum, cost × 2)** → 50% margin. That's it.
- Implemented in `components/nexus/PricingCalculator.tsx` (`MIN_FEE = 150`, `PRICE_MULTIPLIER = 2`).
- **Scaling is automatic** — cost itself scales (Brivo door tiers $11.10→$9→$3.72; flat per-unit), so big sites get a lower blended $/unit with no separate slider.
- **Gateway resolves itself** — gateway units cost $4.50, so at 2× they contribute $9 to price automatically. No separate gateway tier needed.
- **Brivo base ($89.25) only counts when there's access** (doors/units). Cameras-only sites skip it.
- **Minimum fee $150/mo** protects tiny sites.
- No volume slider (kept 5th-grader simple). If desired later, it's one tunable lever.

Where used: Sales → Opportunities → **Rough Calculator** (live). Next: feed the chosen price into the opportunity MRR + proposal builder.

## Calculator requirement (when built)
Itemized inputs per site: # gates/common doors (auto-tier S1/S2/S3), # units + control type (pass-app vs gateway), # cameras (with-access vs monitored), # mobile passes. Output: true monthly cost + recommended retail (per the model above) + blended $/unit + margin. Feeds the opportunity MRR field and the Sales → Opportunities → Rough Calculator.
