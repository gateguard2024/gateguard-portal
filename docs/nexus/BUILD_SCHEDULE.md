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
