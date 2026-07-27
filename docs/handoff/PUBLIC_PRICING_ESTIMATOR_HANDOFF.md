# Handoff — Public Pricing Estimator for gateguard.co (marketing site)

**For:** the chat/dev building the public marketing site (gateguard.co).
**Goal:** a customer-facing "what will this cost my property?" estimator that returns **only the monthly cost to the property** (and a per-unit figure). Every internal number — our cost sheet, the dealer cut, the sales-rep cut, the distributor cut, and the Gate Guard net — is computed **server-side and thrown away before the response**. None of it ever reaches the browser.

It must produce the **same customer number** as the portal's internal "rough estimator" (both use the pricing engine below). This handoff is self-contained — you do NOT need the portal repo.

---

## 1. Hard rules (read first)

1. **Compute on the server, never the client.** The formula and its constants are a trade secret (they let you back-solve our cost + margins). Put the math in a server route (Next.js Route Handler / API route). The browser only ever sends inputs and receives two numbers.
2. **Return only these fields:** `customerMonthly`, `perUnit`, and an `empty` flag. **Never** return or log `ggCost`, `ggNet`, `dealerCut`, `salesCut`, `distCut`, `gateGuardCombined`, `scale`, or any cost-sheet line. Use an explicit allow-list on the response — never spread the compute result.
3. **Clamp every input.** An un-clamped calculator is a probe: a sweep of unit counts lets someone solve the whole cost sheet. Clamp to the ceilings below and reject the rest.
4. **Rate-limit per IP.** A speed bump against scripted sweeps (the clamps are the real protection).
5. **`Cache-Control: no-store`** on the response.

---

## 2. Inputs (what the UI collects)

| Field | Type | Notes |
|---|---|---|
| `livingUnits` | integer | # of residential units. Clamp 0–2000. |
| `entryPoints` | integer | gates/access-controlled doors. Clamp 0–40. |
| `camerasMonitored` | integer | cameras with active monitoring. Clamp 0–200. |
| `camerasNonMonitored` | integer | recording-only cameras. Clamp 0–200. |
| `smartPackage` | `'none' \| 'lock' \| 'full'` | smart-home tier. Default `none`. |
| `cellular` | `'none' \| 'relay' \| 'full'` | cellular backup tier. Default `none`. |
| `dealerMaintainsEntry` | boolean | usually leave `false` for a public estimate. |

Anything above the ceilings = "that's a real quote conversation," so cap it and (optionally) show a "Contact us for large properties" note.

---

## 3. The server module — drop-in, returns ONLY customer numbers

Create `lib/pricing-public.ts` on the marketing site. This is the portal's engine with the internal fields **removed from the output** — it still computes the full bill internally (the customer price is the sum of all components) but only hands back the two public numbers.

```ts
// lib/pricing-public.ts — SERVER ONLY. Do not import into a client component.
export type SmartPackage = 'none' | 'lock' | 'full'
export type Cellular = 'none' | 'relay' | 'full'

export interface EstimatorInputs {
  livingUnits: number
  entryPoints: number
  camerasMonitored: number
  camerasNonMonitored: number
  smartPackage: SmartPackage
  cellular: Cellular
  dealerMaintainsEntry: boolean
}

// ── Cost sheet (v2) — keep in sync with the portal's lib/pricing-model.ts ──
const BRIVO_SITE = 90
const ENTRY_T1 = 10, ENTRY_T2 = 8, ENTRY_T3 = 5
const LARGE_THRESHOLD = 350, LARGE_BLOCK = 75, LARGE_FEE = 25
const CAM_BASE = 60, CAM_BASE_CAP = 20, CAM_EACH = 20, CAM_CALL = 25, CAM_SMALL = 50
const CELL_RELAY = 6, CELL_FULL = 60
const SMART_COST = 2.5
const DEALER_PER_UNIT = 3, SALES_PER_UNIT = 1, DIST_PER_UNIT = 1
const DEALER_MIN_PER_ENTRY = 150
const GG_MIN_NET_PER_UNIT = 2
const SMART_DEALER_ADD = 0.25, SMART_PARTY_ADD = 0.10

const round2 = (n: number) => Math.round(n * 100) / 100
const smartMult = (p: SmartPackage) => p === 'full' ? 2 : p === 'lock' ? 1 : 0

/** Returns ONLY the customer-facing numbers. All internal margins stay in here. */
export function estimateCustomerPrice(input: EstimatorInputs): { customerMonthly: number; perUnit: number; empty: boolean } {
  const u = Math.max(0, Math.round(input.livingUnits || 0))
  const ep = Math.max(0, Math.round(input.entryPoints || 0))
  const mon = Math.max(0, Math.round(input.camerasMonitored || 0))
  const non = Math.max(0, Math.round(input.camerasNonMonitored || 0))
  const mult = smartMult(input.smartPackage)
  const su = mult > 0 ? u : 0

  const costBrivo = (ep > 0 || su > 0) ? BRIVO_SITE : 0
  let costEntry = 0
  for (let i = 1; i <= ep; i++) costEntry += i <= 2 ? ENTRY_T1 : i <= 6 ? ENTRY_T2 : ENTRY_T3
  const costLarge = u > LARGE_THRESHOLD ? Math.floor((u - LARGE_THRESHOLD) / LARGE_BLOCK) * LARGE_FEE : 0
  const totCam = mon + non
  let costCameras = 0
  if (totCam > 0 && totCam <= 2) costCameras = mon * CAM_SMALL + non * CAM_EACH
  else if (totCam > 0) costCameras = Math.ceil(totCam / CAM_BASE_CAP) * CAM_BASE + totCam * CAM_EACH + mon * CAM_CALL
  const costCellular = input.cellular === 'relay' ? CELL_RELAY : input.cellular === 'full' ? CELL_FULL : 0
  const costSmart = SMART_COST * mult * su
  const ggCost = round2(costBrivo + costEntry + costLarge + costCameras + costCellular + costSmart)

  const dealerMin = DEALER_PER_UNIT * u
  const dealerFloor = input.dealerMaintainsEntry ? DEALER_MIN_PER_ENTRY * ep : 0
  const dealerBase = Math.max(dealerMin, dealerFloor)
  const scale = dealerMin > 0 ? dealerBase / dealerMin : 1
  const dealerAdd = SMART_DEALER_ADD * mult * su
  const partyAdd = SMART_PARTY_ADD * mult * su
  const dealer = round2(dealerBase + dealerAdd)
  const sales = round2(SALES_PER_UNIT * u * scale + partyAdd)
  const dist = round2(DIST_PER_UNIT * u * scale + partyAdd)
  const ggNet = round2(GG_MIN_NET_PER_UNIT * u * scale + partyAdd)  // public = locked 'min2' model

  const customerMonthly = round2(ggCost + dealer + sales + dist + ggNet)
  const perUnit = u > 0 ? round2(customerMonthly / u) : 0
  const empty = u === 0 && ep === 0 && totCam === 0
  return { customerMonthly, perUnit, empty }
}
```

> **Keep-in-sync note:** if the portal's `lib/pricing-model.ts` constants ever change, update this file to match. Consider a shared package later; for now this is a deliberate copy so the marketing site has zero portal dependency.

---

## 4. The API route (server) — clamp + rate-limit + allow-list

`app/api/pricing/estimate/route.ts` (Next.js App Router on the marketing site):

```ts
import { NextRequest, NextResponse } from 'next/server'
import { estimateCustomerPrice, type SmartPackage, type Cellular } from '@/lib/pricing-public'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_UNITS = 2000, MAX_ENTRY = 40, MAX_CAM = 200
const WINDOW_MS = 60_000, MAX_PER_WINDOW = 30
const hits = new Map<string, { count: number; resetAt: number }>()
function rateLimited(ip: string) {
  const now = Date.now(); const r = hits.get(ip)
  if (!r || now > r.resetAt) { hits.set(ip, { count: 1, resetAt: now + WINDOW_MS }); return false }
  r.count++; return r.count > MAX_PER_WINDOW
}
const clamp = (v: unknown, max: number) => { const n = Number(v); return !Number.isFinite(n) || n < 0 ? 0 : Math.min(Math.round(n), max) }
const SMART: SmartPackage[] = ['none','lock','full']
const CELL: Cellular[] = ['none','relay','full']

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  if (rateLimited(ip)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  let b: Record<string, unknown>
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const r = estimateCustomerPrice({
    livingUnits: clamp(b.livingUnits, MAX_UNITS),
    entryPoints: clamp(b.entryPoints, MAX_ENTRY),
    camerasMonitored: clamp(b.camerasMonitored, MAX_CAM),
    camerasNonMonitored: clamp(b.camerasNonMonitored, MAX_CAM),
    smartPackage: SMART.includes(b.smartPackage as SmartPackage) ? b.smartPackage as SmartPackage : 'none',
    cellular: CELL.includes(b.cellular as Cellular) ? b.cellular as Cellular : 'none',
    dealerMaintainsEntry: b.dealerMaintainsEntry === true,
  })

  // Allow-list ONLY. Never spread the result.
  return NextResponse.json(
    { customerMonthly: r.customerMonthly, perUnit: r.perUnit, empty: r.empty },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
```

---

## 5. The UI (customer-facing)

- A short form: units, entry points, monitored cameras, non-monitored cameras, and two dropdowns (smart package, cellular). Keep it friendly — plain labels, not our internal jargon.
- On change (debounced) or on a "Calculate" button, `POST /api/pricing/estimate` with the inputs.
- Show **one hero number**: **"Estimated monthly cost: $X,XXX/mo"** and a smaller **"≈ $XX.XX per unit / month."** Nothing else.
- A clear disclaimer: *"Estimate only. Final pricing confirmed in a quote."*
- A CTA: **"Get an exact quote"** → your existing contact/lead form. (Optionally POST the estimate + contact into the portal's public lead intake so it lands as a lead — ask the portal team for that endpoint if you want it.)
- Do **not** render any breakdown, line items, or "how we got this." Just the property's price.

---

## 6. Parity test (must match the portal rough estimator exactly)

Send: `{ livingUnits: 100, entryPoints: 2, camerasMonitored: 4, camerasNonMonitored: 0, smartPackage: "none", cellular: "none", dealerMaintainsEntry: false }`

Expected response: `{ "customerMonthly": 1050, "perUnit": 10.5, "empty": false }`

If you get 1050 / 10.5, your port is correct. A second check: all-zeros input → `{ customerMonthly: 0, perUnit: 0, empty: true }` (show a friendly "enter your property details" state, not "$0").

---

## 7. Do-NOT-expose checklist (security review before launch)

- [ ] Response body contains only `customerMonthly`, `perUnit`, `empty` — nothing else.
- [ ] No cost-sheet constants or margin math in any **client** bundle (grep the built JS for `DEALER_PER_UNIT`, `GG_MIN_NET`, `ggCost` — must be zero hits).
- [ ] Inputs clamped; rate-limit active; `no-store` set.
- [ ] No breakdown rendered anywhere in the UI.
