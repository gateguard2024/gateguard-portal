# Nexus — Open / Future Build Schedule

> Living backlog for the Nexus glass surfaces. Anything pulled out of the main
> nav lands here so the work is parked, not lost.
> Last updated: July 14, 2026.

---

## Nav change — July 14, 2026

The main tab bar (`components/nexus/NexusHomeClient.tsx` → `NAV_ITEMS`) is now:

**My Day · Sales · Operations · Design · Catalog · Systems**

| Change | Detail |
|---|---|
| **Jobs → Operations** | The Jobs surface *is* operations — it carries the name now. `id: 'jobs'` unchanged (routes/`NexusTabId` intact), label only. |
| **Operations tab removed** | Old tab was `id: 'recent'` → `CustomersSitesSurface`. Pulled from the nav. |
| **Money/Docs removed** | Old tab was `id: 'field'` → `MoneyDocsSurfaceNext`. Pulled from the nav. |

**Nothing was deleted.** The tab ids remain in `NEXUS_TABS` because they are the
source of the `NexusTabId` union that every surface switches on — removing an id
breaks the build. The surfaces themselves still compile and are reachable; they
are simply not in the primary flow.

---

## Parked — pulled from the nav, work still owed

### Money/Docs (`MoneyDocsSurfaceNext.tsx`, `MoneyDocsDocumentsBoard.tsx`)
Retired from the nav July 14, 2026. Outstanding before it could return:

- Invoices board: QB-style product picker + Mark as Paid (was Task #234)
- Stripe payment links end-to-end (`STRIPE_SECRET_KEY` + publishable key on Vercel)
- Documents: New Contract flow — Upload / From scratch / From template, linked
  back to the originating entity (site, opportunity, dealer)
- Doc portal security: expiry + domain restrictions (open P5)
- Commission payouts surface

**Decide before rebuilding:** does Money/Docs come back as its own tab, fold into
Operations, or move behind the admin icon? Not yet decided.

### Operations — old tab (`CustomersSitesSurface.tsx`)
Retired from the nav July 14, 2026 in favour of Jobs-as-Operations. Outstanding:

- Confirm nothing in the old surface is orphaned — the customer/site finder and
  the site drawer must exist inside the new Operations (Jobs) surface
- Site lifecycle + activation rule (contract signed AND deposit paid)
- Site Service Analytics tab on `/sites/[id]` (Task #132)

---

## Procurement + Job Costing — the vision (July 14, 2026)

**The goal:** a work order tells the whole money-and-materials story. A tech knows
whether his parts are on site before he drives out; an owner knows what the job
actually cost.

### Why it didn't work — three islands
`purchase_orders` had **no `work_order_id`** (POs floated free of jobs).
`purchase_order_items` linked only to `inventory_items`, **never the products
catalog**. `work_order_parts` had **no `po_id`** and no notion of where a part
physically was. So nothing could answer "are my parts here?" — the data had no
path to say it.

⚠️ **Trap:** the live parts table is **`work_order_parts`** (migration 035).
`wo_parts_used` (migration 014) is LEGACY and unused by the API — migration 135
documents that exact confusion. Never add columns to `wo_parts_used`.

### Done — the plumbing (migrations 151 + 152)
| Link | Column |
|---|---|
| Work order → its POs | `purchase_orders.work_order_id` |
| PO line → catalog item | `purchase_order_items.product_id` |
| Job part → the PO buying it | `work_order_parts.po_id` |
| Job part → catalog item | `work_order_parts.product_id` |
| **Where the part physically is** | `work_order_parts.supply_status` |
| Expected delivery | `work_order_parts.expected_at` |
| Parts vs expendables | `work_order_parts.is_expendable` |
| Labor billing model | `work_order_time_entries.labor_type` — `hourly` / `day_rate` / `sub_invoice` |
| Labor money | `cost_rate`, `days`, `invoice_amount`, `invoice_ref`, `subcontractor_org_id`, `bill_amount` |

`supply_status` values are deliberately plain because techs read them:
`not_ordered → ordered → shipped → at_office → on_truck → installed`.
Distinct from the existing `action` column (`used/installed/returned/warranty`),
which records what HAPPENED to a part, not where it is on the way there.

### Still owed — the UI (nothing of this is on screen yet)
1. **Procurement on the work order.** A Parts & Procurement section in the job
   drawer: each part with its supply status, expected date, and the PO it's on.
   Dispatch and the tech see the same truth. Status editable in one tap.
2. **Order from the job.** "Create PO for this job" → pre-filled from the job's
   parts, stamped with `work_order_id`, lines bound to `product_id`.
3. **Two-way sync.** Receiving a PO in the Procurement tab flips its parts to
   `at_office` on every linked job automatically. This is the "they should talk
   to each other" requirement — it must be automatic, not a second manual step.
4. **Catalog matching.** Adding a part searches `products` and binds
   `product_id`, so name/sku/image come from the single source of truth instead
   of free text. Loose text stays allowed but flagged as unmatched.
5. **Job cost panel.** Labor + Parts + Expendables + total cost vs billed, with
   margin. Labor must sum all three types (hourly mins × rate, day rate × days,
   sub invoice amount).
6. **Sub invoices.** Attach the sub's invoice to the labor entry (reuse the
   existing job attachments) so accounting can tie the number to the paper.
7. **Procurement discoverability.** It has NO entry card today — it's two clicks
   deep inside the Ops Hub with no way to find it. Same for Parts, Techs, PM,
   Playbooks, Analytics. Give Procurement its own card.

### Open question to settle first
`work_order_phases` now does double duty — the Overview tab renders those same
rows as **"Visits"** (with dates/status), while the Steps card uses them as
**phases** (Wiring/Trim/Headend/Program). A phase added in one shows up in the
other. Decide: are visits and phases the same thing, or should Visits filter to
only dated rows?

---

## Design — multi-page sets + BOM double-count guard (July 14, 2026)

**The problem is money, not cosmetics.** A drawing set has several pages and the
SAME physical device legitimately appears on more than one:

```
Page 1  Overview          -> headend switch (the real one)
Page 2  Enclosure detail  -> the SAME switch, drawn again for clarity
```

Today **every placed device counts toward the BOM**, so that switch is counted
twice — we'd quote the customer for two and carry two expense lines. Bad quote,
skewed job cost, skewed margin.

**The rule:** exactly ONE instance of a physical device counts. Every other
drawing of it is a **reference** — visible on the page, invisible to the BOM.

### Done — schema (migration 154)
| Need | Column |
|---|---|
| Page order in a set | `floor_plans.page_no` |
| What the sheet is | `floor_plans.sheet_type` (overview/enclosure/riser/headend/detail/as_built) |
| Pages belong to a set | `floor_plans.set_id` (NULL = standalone, all existing rows) |
| **Counts on the BOM?** | `floor_plan_devices.include_in_bom` (default **true** = today's behaviour) |
| Which one is the real device | `floor_plan_devices.same_as_device_id` (+ CHECK: can't reference itself) |

### ⚠️ Still owed — and the DB alone does NOT fix this
**The BOM is computed from LIVE CANVAS STATE** (`bom.rows` in
`app/design/floor-plans/page.tsx`), not from `floor_plan_devices`. So:
1. The **canvas device object** must carry `include_in_bom` — not just the row.
2. The **BOM tally must skip** anything false. Without this, 154 is a column
   nobody reads.
3. **Page tabs** in the design tool: add/rename/reorder/delete pages in a set.
4. **Per-device toggle**, plain words: *"Count on BOM"* / *"Reference only —
   already counted on Page 1"*.
5. **Smart default:** dropping a product that already exists elsewhere in the set
   should default to `include_in_bom = false` and prefill `same_as_device_id`.
   The safe default is the one that can't over-bill a customer.
6. Show the reference link on the drawing ("same switch as Page 1") so it isn't
   a mystery to whoever reads the sheet.

---

## Open build queue (unchanged, still owed)

### P1 — ARIA
- **Phase 2 — Deep research on demand.** The initial find is now base data only
  (`/api/aria/research/base`). The deep engine runs only when explicitly asked.
  Next: make the deep run *enrich* the saved base row rather than re-create it.
- DM scoring 1–10 surfaced on every property card + detail
- "No data found" policy across every field — never a blank cell
- Proptech inference with confidence % when reviews imply a system but no brand
- Sales script / cold-call guide in the PropTech tab, built from real findings

### P2 — Jobs / Operations
- Won opportunity → Job conversion, full New Install workflow:
  deposit → PO/procurement → assembly → schedule → QC/handoff → final billing
- Procurement first-class + Mark-Complete proof gate (open Task #67)
- CMMS / "our MaintainX" glass UI (open Task #85)

### P2 — Platform
- Retire legacy `/admin/users` + `/admin/settings/features` (Task #79)
- Dealer-safe shell part 2 — hide legacy ops pages (Task #51)
- Record sharing / co-working + admin redistribute (Task #64)
- Security batch 2 — ilike scoping, activities scope, role/tech (Task #65)
- Code-split Nexus surfaces via `next/dynamic` (Task #88)
- Concurrency hardening — Supabase pooled connections + endpoint caching (#89)
- Next 14→15 + Clerk 5→6 migration (Task #80)

### P3 — Design
- Link floor plans → system design → as-built as one versioned Design record
- Preserve + mature the background-image component tool (Task #194)

---

## Standing rules (do not regress)

1. **Develop on `beta`.** Promote `beta` → `main` only after Russel approves.
2. **No new tables** — expand the existing schema.
3. **Every search saves.** All data, facts *and* inferred, persists to Supabase.
4. **Never fire-and-forget a write.** `void (async () => …)()` is killed the
   moment a serverless response returns — that silently dropped ARIA saves for
   weeks. Await it, and surface the failure.
5. **Never claim success you didn't verify.** A `200 { upserted: 0 }` and a
   hardcoded "✓ Saved" badge hid a total write failure. Report the truth.
6. **So easy a 5th grader can use it.**
