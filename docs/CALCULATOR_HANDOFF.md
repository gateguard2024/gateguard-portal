# GateGuard ROI / Partnership Calculator — Build Handoff

Purpose: port the GateGuard Property Partnership **ROI calculator** onto the public
website (`gateguard-web`). This spec is self-contained — every formula and constant
is here, so you do not need the portal repo to rebuild it. It was verified against
the "Vinnings at Laurel Creek" ROI spreadsheet and the live portal engine.

Reference implementation in the portal (`gateguard-portal`, for fidelity only):
- `lib/roi-model.ts` — the engine (pure function `computeRoi`)
- `app/api/roi/compute/route.ts` — corporate-gated API wrapper
- `components/nexus/RoiCalculator.tsx` — the light-hybrid UI
- `lib/partnership-proposal.ts` — resident-fee + set-up derivation used by the proposal

---

## ⚠️ READ FIRST — what may go on a public page

The full engine computes **GateGuard's internal cost (COGS), profit, and ROI**. Those
are confidential and must **never render on a public/marketing page or ship in public
JS**.

- **Public / resident-facing (safe to show):** units, openings, set-up fee, the resident
  **Parking & Amenity (P&A)** fee per unit, annual resident revenue.
- **Internal only (corporate/dealer login required, compute server-side):** install COGS,
  monthly COGS, dealer/sales/MSO/package payouts, monthly profit, annual profit, ROI
  months, PASS/FAIL, and every cost breakdown line.

If the website calculator is a **public estimator**, build only the resident-facing side
(scope → set-up + resident P&A). If it sits **behind a dealer/corporate login**, you can
include the internal figures but keep the math server-side and gate the response by role
(mirror `app/api/roi/compute/route.ts`).

---

## Inputs

Site & terms:
- `units` (integer)
- `termMonths` (default 60)
- `setupFee` (one-time $, paid by the property) — see "Set-up pricing" for how the proposal derives it
- `monthlyPA` (base resident P&A, $/unit/year, default 125)
- `paOffset` (default 0)

Scope — each opening type splits Working vs Needs-repair:
- `workingVehGates`, `nonWorkingVehGates`
- `workingPedGates`, `nonWorkingPedGates`
- `workingAccessDoors`, `nonWorkingAccessDoors`
- `exitGates`

Cameras: `existingCameras`, `newCameras`, `conversionCameras`, `monitoredCameras`, `recorders`
Security: `securityPanel`, `securityDoors`, `additionalDoors`, `additionalMotions`, `cell`

Payouts — entered as **$ per unit per month** (see "P&A build-up"):
- `salesRepPerUnit`, `msoPerUnit`, `packagePerUnit`

Editable rates (with defaults):
- `dealerPerGate` = 150, `dealerPerDoor` = 50
- `revenueDivisor` = 14, `passThresholdMonths` = 4

## Derived counts
```
vehGates   = workingVehGates + nonWorkingVehGates
pedGates   = workingPedGates + nonWorkingPedGates
accessDoors= workingAccessDoors + nonWorkingAccessDoors
points     = vehGates + pedGates + accessDoors          // exit gates NOT included here
openings   = points + exitGates                          // total physical openings
workingOpenings = workingVehGates + workingPedGates + workingAccessDoors
repairOpenings  = nonWorkingVehGates + nonWorkingPedGates + nonWorkingAccessDoors
```

---

## Set-up pricing (proposal side)
The ROI engine takes `setupFee` as an input. The proposal derives it two ways (dealer chooses):
- **By condition:** `workingOpenings × 500 + repairOpenings × 750`
- **Flat:** `openings × flatRate` (one rate for every opening)

Deposit split: half at signing, half at Go-Live (`deposit = round(setupFee/2)`, `goLive = setupFee − deposit`).

## Install COGS (one-time — INTERNAL)
```
door controllers   450 × (points − exitGates)
readers            250 × (points − exitGates)
remote openers     150 × (vehGates − exitGates)
shelly kits         75 × vehGates
recorder            60 × recorders
new cameras         20 × newCameras
analog/conversion  100 × conversionCameras
security base      350 × securityPanel
security doors      45 × (securityDoors + additionalDoors)
security motions    65 × additionalMotions
security cell radio  75 × cell
startupCogs   = sum of the above
startupProfit = setupFee − startupCogs        // can be negative
```

## Monthly (INTERNAL except revenue basis)
```
monthlyRevenue = (units / revenueDivisor) × (monthlyPA + paOffset)     // divisor default 14

// Servicing-dealer pay:
dealerPay = 150 × (vehGates + exitGates) + 50 × (pedGates + accessDoors)
salesPay  = salesRepPerUnit × units
msoPay    = msoPerUnit × units
packagePay= packagePerUnit × units
payroll   = dealerPay + salesPay + msoPay + packagePay

// Monthly COGS:
brivo site fee        100 (flat)
entry-point fee       8  × points
recorder              60 × recorders
existing cameras      10 × (existingCameras + conversionCameras)
new cameras           18 × newCameras
active review         25 × monitoredCameras
security cell          7 × cell
security monitoring    6 × recorders
monthlyCogs = sum of the above

monthlyProfit = monthlyRevenue − payroll − monthlyCogs
annualProfit  = monthlyProfit × 12
roiMonths     = startupProfit >= 0 ? 0
              : monthlyProfit <= 0 ? Infinity
              : −startupProfit / monthlyProfit
pass          = roiMonths <= passThresholdMonths        // default 4 months
```

## P&A build-up (RESIDENT-FACING — safe to show)
Sales, MSO, and package-room are entered **$/unit/month**; each ×12 stacks onto the resident P&A:
```
salesAnnualPerUnit   = salesRepPerUnit × 12
msoAnnualPerUnit     = msoPerUnit × 12
packageAnnualPerUnit = packagePerUnit × 12
paAdditionsPerUnitYr = salesAnnualPerUnit + msoAnnualPerUnit + packageAnnualPerUnit
residentPaTotal      = monthlyPA (base) + paAdditionsPerUnitYr          // $/unit/year
annualResidentRevenue= units × residentPaTotal
```

## Resident fee helper (proposal auto-fill, separate)
When deriving the resident P&A from the internal $/unit/month program cost:
```
residentFeeFromMonthly(perUnitMonthly) = roundUpToNearest5( perUnitMonthly × 12 × 1.20 )
```

## Rounding
Round each money value to cents (`round(x*100)/100`); round displayed dollars to whole numbers.

---

## Verified example — "Vinnings at Laurel Creek"
Inputs: 244 units; vehicle gates 4 (all needs-repair); pedestrian gates 2; access doors 2;
exit gates 2; cameras 8 existing + 2 new (2 monitored) + 1 recorder; security panel 1 +
3 doors + cell 1; set-up $5,000; base P&A $125.

Base result (no payouts):
- startupCogs **$5,460** → startupProfit **−$460**
- dealerPay = 6 gates × $150 + 4 doors × $50 = **$1,100**
- monthlyCogs **$403**; monthlyRevenue (244/14 × 125) **$2,178.57**
- monthlyProfit **$675.57**; annualProfit **$8,106.86**; roiMonths **0.68**; **PASS**

With payouts $1 sales + $0.50 MSO + $2 package (per unit/mo):
- add-ons = $12 + $6 + $24 = **$42/unit/yr** → resident P&A **$167/unit/yr**

---

## UI / styling (match the portal)
Light "porcelain steel" hybrid:
- page ground `linear-gradient(140deg,#E7EDF6,#DCE5F1)`; white cards `#ffffff`,
  border `rgba(70,100,140,0.16)`, soft shadow `0 8px 22px rgba(20,40,80,0.06)`
- ink text `#17293e`; muted `#5a708c`; accent cyan `#2f7fb8`; positive green `#12855f` / `#12b886`; alert red `#b91c1c`
- Inputs are tap-friendly **steppers** (− value +); PASS/FAIL as a green/red chip.

Layout: left = inputs (Site & terms, Gates & doors [working/needs-repair], Cameras,
Security, Payouts→P&A); right = result cards (Units, Openings, Set-up fee, Resident P&A/yr,
+ internal-only: start-up/monthly/annual profit, ROI months, PASS/FAIL, and the cost breakdowns).

---

## Suggested build for the website
1. Put `computeRoi` in a server route (or serverless function) — never in public client JS if it returns COGS/profit.
2. Public estimator page posts scope → gets back **only** the resident-facing subset
   (units, openings, set-up fee, residentPaTotal, annualResidentRevenue).
3. If a dealer/corporate area exists, gate the full result by role like the portal API does.
