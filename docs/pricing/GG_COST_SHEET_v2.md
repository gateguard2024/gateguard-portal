# Gate Guard Cost Sheet — v2 (dictated)

> Captured from Russel's dictation. **Confirm the flagged items before we code it into the rough calculator.** Recurring = per site / month unless noted.

## Platform / site
- **Brivo site fee:** **$90 / site** — flat, regardless of unit count *(confirmed)*

## Entry points (doors / gates) — tiered per door
- Doors **1–2:** $10 each
- Doors **3–6:** $8 each
- Doors **7 and up:** $5 each
- _Examples:_ 2 doors = $10 + $10 = **$20** · 6 doors = 10+10+8+8+8+8 = **$52** · 8 doors = …+5+5 = **$62**

## Large-site surcharge
- If a site has **more than 350 units:** **+$25 per 75 additional units** above 350.
  - _e.g._ 500 units → 150 over 350 → 2 × $25 = **+$50/mo** (150 ÷ 75 = 2)

## Cameras
- **Base camera fee:** $60 / site — covers up to **20 cameras**
- **Per camera:** $20 / camera / site
- **Call center:** $25 / camera / site
- **Small-site exception (2 cameras or fewer):** **$50 / camera / site** (max 2 cameras).
  - This price **includes** the call center fee, and there is **no camera base ($60) site fee** in this case.

## Cellular / connectivity
- **Relay IoT device:** $6 / month
- **Full network:** $60 / month

## Dealer maintenance floor
- When a **dealer maintains** the entry points: lock in **$150 per entry point / month** (floor).

## Distribution — percentage model with per-unit minimums
Everyone's cut **scales by percentage** as the property gets larger or smaller, but never
drops below these **per-unit minimums**:

| Party | Per-unit minimum |
|---|---|
| Dealer | **$3 / unit** |
| Sales rep | **$1 / unit** |
| Distributor | **$1 / unit** |
| Gate Guard net | **$2 / unit — over our cost** |

**Scaling rule (ratio-based, confirmed):** all four hold the **3 : 1 : 1 : 2** ratio. The
dealer's *actual* cut sets the scale — when the **$150 / entry-point** floor pushes the dealer
above its $3/unit minimum, sales, distributor, and Gate Guard net rise by the **same factor**
so the ratio never breaks.

- `scale = dealer ÷ ($3 × units)`  (≥ 1)
- `sales = $1 × units × scale` · `distributor = $1 × units × scale` · `GG net = $2 × units × scale`
- Dealer = `max($3 × units, $150 × entry points)` when the dealer maintains.

_Example — 300 units, 8 entry points, dealer maintains:_ dealer = max($900, $1,200) = **$1,200**;
scale = 1,200 ÷ 900 = **1.33×**; sales = $400, distributor = $400, GG net = $800. Ratio stays 3:1:1:2.

---

## Differences vs. the current live calculator (please confirm)

| Item | Current (live) | New (dictated) |
|---|---|---|
| Brivo site fee | **$90**/site | **$9**/site ⚠️ |
| Entry points | $10 (1–2), $7 (3–8), $5 (9+) | $10 (1–2), $8 (3–6), $5 (7+) |
| Large-site surcharge | none | +$25 per 75 units over 350 |
| Camera model | $25 NVR + $44/cam ($10 cam + $9 cloud + $25 call ctr) | $60 base (≤20 cams) + $20/cam + $25/cam call ctr |
| Small-site cameras | n/a | ≤2 cams → **$50/cam all-in**, no base fee |
| Cellular | $10 each | $6 relay IoT **or** $60 full network |

Once you (1) confirm Brivo $9 vs $90 and (2) finish the dealer section, I'll wire this into the rough calculator's cost sheet.
