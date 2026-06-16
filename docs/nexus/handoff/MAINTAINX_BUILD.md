# GateGuard CMMS ("our MaintainX") — UI + Wiring Plan (outsourcing brief)

Goal: a MaintainX-style maintenance module **layered on GateGuard's existing data**, not a from-scratch backend. Emphasis (per Russel): map **parts → sites**, **client-triggered requests**, **service history**, and **install + service tracking of parts & labor → profitability**.

Build style: each page below is a **self-contained `.tsx`** with mock-data stubs and the Nexus **dark glass** theme (cards `rgba(255,255,255,0.04)` bg / `0.08` border; brand `#6B7EFF`, cyan `#00C8FF`; one-job-per-screen, 5th-grader simple). Gemini/ChatGPT returns the shell with mocks; **Claude then lucide-fixes + wires to the real APIs** below.

---

## Reuse what already exists (do NOT rebuild)

| Concept | Table | Notes |
|---|---|---|
| **Parts / equipment catalog** | `products` | sku, name, brand, category, **dealer_cost**, **sell_price**, msrp, image. *This is the single parts list — the CMMS Parts page reads this, not a new one.* |
| **Installed assets per site** | `site_assets` | site_id, **product_id**, serial, mac/ip, firmware, location_zone, **work_order_id** (install WO), installed_by, status, last_seen_at. → the Asset register + parts↔site map. |
| **Sites / locations** | `sites` | the "Locations" module. |
| **Work orders** | `work_orders` | wo_number, property_id, device_id, assigned_to, priority, status, due_date, completed_at. |
| **Technicians** | `technicians` | assignees. |
| **Client-triggered requests** | `wo_requests` (mig 015) | resident/PM submits → becomes a WO. |
| **Preventive maintenance** | `pm_schedules` (mig 016) | interval_days, next_due_at → auto-generate WOs. |
| **Labor / time** | field tickets + time tracking (mig 032) | hours per WO → labor cost. |
| **Inventory / stock** | inventory (mig 035) | stock levels on parts. |
| **Billing lines** | `quote_line_items`, `invoice_line_items` | parts + labor sold → revenue side of profitability. |

**Gaps to add (small migrations, confirm first):**
- `work_order_parts` — parts USED on a WO: `wo_id, product_id, qty, unit_cost (snapshot of products.dealer_cost), unit_price (snapshot of sell_price), billable bool`. This is the missing link for per-WO parts profitability.
- `work_order_labor` — or reuse field-ticket time: `wo_id, technician_id, hours, cost_rate, bill_rate, billable`.
- `procedures` / `checklists` — reusable inspection templates + `wo_checklist_items` (if not already in mig 014 cmms_enhancement — verify).

---

## Pages to build (the shell)

Each is a glass page; routes live under a new **`/cmms`** (or fold into the existing Jobs surface).

1. **Dashboard** — KPI cards (open WOs, overdue, PM due this week, low-stock parts, **this month's labor+parts margin**), recent activity, WO-by-status mini board.
2. **Work Orders** — list + **board (kanban by status)** + **calendar** toggle. Filters: status, priority, assignee, site, asset. Row → WO detail.
3. **Work Order detail** — header (status/priority/assignee/due); **Asset + Site** links; **Procedure/checklist**; **Parts used** (add from `products`, qty, auto cost+price); **Labor** (techs, hours); comments + photos; **live profitability strip** (parts margin + labor margin → total). "Complete" gate.
4. **Requests** — incoming `wo_requests` (client-triggered) → review → **Convert to WO**. Plus a **public request form** (QR at a site) for residents/PMs.
5. **Assets** — list (from `site_assets`) grouped by site; **Asset detail**: specs, serial/mac/ip, firmware, install info, **service history** (all WOs touching it), health (last_seen), attached docs, QR.
6. **Locations (Sites)** — sites list → site detail with its **assets, open WOs, PM schedules, and lifetime parts+labor spend/margin**.
7. **Preventive Maintenance** — `pm_schedules` list (next due, interval); create/edit; "generate now"; calendar of upcoming PMs.
8. **Procedures / Checklists** — reusable template library; attach to WOs/PMs.
9. **Parts & Inventory** — the **`products`** catalog with stock levels (cost, price, on-hand, low-stock alert, reorder); usage history; vendors + POs (phase 2).
10. **Reporting / Profitability** — by WO / site / tech / period: parts cost vs price, labor cost vs billed, **margin**; MTTR, completion, downtime.
11. **Messages** — reuse existing per-WO comments + team chat.

---

## The profitability model (the headline feature)

For any WO / site / period:
- **Parts:** Σ `work_order_parts.qty × (unit_price − unit_cost)` → parts margin. Cost/price snapshotted from `products` at time of use.
- **Labor:** Σ `hours × (bill_rate − cost_rate)` → labor margin.
- **Revenue** ties to `invoice_line_items`; **margin %** = (price − cost) / price.
- Roll up to **per-site lifetime profitability** (install job + every service WO) and **per-tech** efficiency.

This is why parts/labor must be tracked **on the WO at cost AND price** — install and service both feed the same margin engine.

---

## Wiring map (Claude does this after the shell lands)

| Page | GET | POST/PATCH |
|---|---|---|
| Work Orders | `/api/work-orders` (list, filters, scope by org) | create/update status/assignee |
| WO detail | `/api/work-orders/[id]` (+ assets, parts, labor, checklist) | add part (from products), log labor, complete |
| Requests | `/api/wo-requests` | convert → work order |
| Assets | `/api/site-assets?site_id=` | create/update install |
| PM | `/api/pm-schedules` | create / generate-now |
| Parts | `/api/products` (catalog + stock) | adjust stock |
| Reporting | `/api/cmms/profitability?scope=` | — |

All endpoints **org-scoped** via `resolveOrgScope` (corporate all / dealer subtree / PM own), same pattern as the rest of Nexus.

---

## What to hand the LLM
"Build these 11 glass pages as self-contained React/TSX with mock data and the Nexus dark-glass theme. One job per screen, large tap targets, no nested scrolling. Use the field names listed above so wiring is a drop-in. Return one file per page; no backend." Claude then fixes lucide imports and wires each page to the endpoints above.
