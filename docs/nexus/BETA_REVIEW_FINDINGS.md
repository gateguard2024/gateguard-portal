# Beta Review — Consolidated Findings (June 14, 2026)

Three parallel reviews (security, bugs/correctness, UX). De-duplicated + verified against the code. Severity, file, one-line fix. Reconciled to TODAY's hierarchy (lib/permissions + lib/org-scope).

## 🔴 CRITICAL (fix before broad use)
1. **`/api/crm/leads/[id]/assign` — NO auth + no scope.** VERIFIED (POST has no getCurrentUser). Anyone could reassign a lead to any org by guessing the id. Fix: add getCurrentUser + leadInScope guard (reuse lib/crm-scope).
2. **`ilike` filters built from raw user input** in `.or(\`col.ilike.%${q}%\`)` — aria/properties, invoices, subcontractors, crm/leads, nexus/opps/lead-window. A comma/paren in the query can break/alter the `.or()` filter. Fix: use `.ilike('col', \`%${q}%\`)` param form (or sanitize q: strip `,()%`).

## 🟠 HIGH
3. **`/api/crm/activities/[id]` PATCH/DELETE — authed but not org-scoped.** VERIFIED. A user could edit/delete another org's activity by id. Fix: resolve parent opp/lead and check isInScope.
4. **show_leads cross-dealer visibility** in `/api/crm/leads` — non-corporate users can see the global unassigned pool. Decide: visibility vs ownership; gate or RLS.
5. **No rate-limit on public `/api/document/[slug]` + `/api/signatures/[token]`** — slug/token enumeration + notification spam. (= task #50 / P5.)
6. **SMTP passwords stored unencrypted** in `message_channels.config`. Encrypt at rest (pgsodium / app KMS) before GA. (Known; service-role only today.)
7. **Migration number collisions** — duplicate numbers: 008, 070, 071, 095, 096, 097 (e.g., `095_feature_flags` vs `095_message_center`, `096_org_entity_type` vs `096_calendar_events`, `097_sig_document_html` vs `097_work_order_calendar_sync`). VERIFIED. Manual SQL-editor runs mask this, but a CLI/fresh deploy may skip a dupe. Fix: renumber the *not-yet-on-prod* dupes to 122+; leave already-applied ones but document.

## 🟡 MEDIUM
8. ARIA `x-service-key` is a plain string compare — ensure it's long/random; log usage.
9. `onboard-dealer` returns `document_templates.public_url` into the signing email unvalidated → template-swap phishing. Whitelist the domain.
10. Doc-template/inngest signature assumptions — confirm Inngest `serve()` verifies signatures (SDK does; document it).

## 🟢 LOW
11. `TECH_ACCESS_CODE` is one shared secret for all techs (per-tech codes exist via migration 093 — prefer those).
12. Hardcoded `NOTIFY_TO = 'rfeldman@gateguard.co'` in doc portal — make per-org/configurable.

## ❌ Reported but INVALID / known-future
- "work-orders/today ignores `assignee_org_id`" — that column doesn't exist; install-contractor scoping is a known future TODO.
- onboard-dealer/activate-dealer privilege check — reviewer self-retracted; logic is correct (corporate AND admin).

## ✅ Clean bills (good news)
- **No mock-only UI still mounted** — every Nexus surface fetches real data (mock = fallback only).
- **No dead/console-only buttons** in the glass windows.
- **No lucide named-import violations** (forbidden icons all use require()).
- **No `.catch()` on Supabase queries**, no `${{` pitfalls, no unguarded JSON.parse.
- Webhooks (Clerk/Svix, Stripe, Resend) verify signatures.

## UX — TOP "5th-grader" FIXES
A. **Hide coming-soon placeholder panels** behind real nav cards — CustomersSitesSurface "Properties Needing Attention" + MoneyDocsSurfaceNext "Compliance" open empty stubs. Hide until real, or show a simple count.
B. **De-jargon:** "Est. MRR" → "Monthly Revenue"; define MA/MSO/SP/SD inline in the dealer wizard; "per unit" → "per property".
C. **Mobile/PWA:** SalesSurface, MoneyDocsSurfaceNext, CustomersSitesSurface detail shells need `pb-24` + stack the action rail under content on mobile (buttons currently hidden in a side column on phones). (MyDay shell already fixed.)
D. **Hide "muted/coming-soon" action buttons** until live (they read as broken).
E. **Standardize** back-button label + remove duplicate titles inside detail shells (shell title already shows the section).
F. **Consistent empty states + success feedback** ("Follow-up added ✓ — find it in My Day › To-Dos").

## ── MERGED with Chat's deep review (June 14) + fixes applied ──

### Co-working requirement (Russel, authoritative — reshapes assigned-scope)
Leads, opportunities, and jobs can **share tasks between owners (co-working)** and be **redistributed by admins**. So access for a plain `user` = **owner OR collaborator**, NOT a single-assignee lock; admins/supervisors/corporate can reassign. → Need a **record-sharing/collaborators model** before tightening assigned-scope. Until then, org-scope is the (over-permissive but cross-org-safe) interim. Task #64.

### Chat's net-new SECURITY findings (verified)
- **getCurrentUser failed OPEN** (returned corporate admin on no-session/exception). ✅ **FIXED** — production now falls back to a powerless anonymous user; SYSTEM_USER only in dev.
- **/quotes/* bypass too broad** (internal builder public). ✅ **FIXED** — bypass narrowed to `/quotes/[id]/proposal` + `/approve` only.
- **leads/[id]/assign no auth** (mine). ✅ **FIXED** — now corporate/admin/supervisor + target org must be in scope (matches "redistributed by admins").
- **Job window not assigned-scoped** (SEC-3). ⏳ depends on #64 (owner-or-shared) — do NOT single-assignee lock (breaks co-working).
- **Role model: no `tech` in SimpleRole** (SEC-2). ⏳ #65 — add `tech`; verify applyAssignedScope tech path.

### Chat's WORKFLOW gaps (mostly = Flow A/B builds already specced)
- Quote builder is legacy/dense → **simple guided-card rebuild** (#66; also UX).
- Agreement gate + accepted-quote→job: opportunity/quote status steps (Proposal Sent→Accepted→Agreement Sent→Signed→Countersigned→Deposit→Job). Aligns with Flow A 4A-4E (#60 + flows spec).
- **Procurement** not first-class (order/ETA/receive/ready) → #67. Install can't complete without received materials.
- **Mark Complete too easy** → completion checklist (photos, equipment, customer sign-off, balance invoice, service plan) → #68.
- **Billing milestones** (deposit/balance/monthly service) not first-class → part of #60/flows spec + invoices.

### Doc drift (quick)
NEXUS_BETA_HANDOFF.md + NEXUS_WORKFLOW_MAP.md still list old nav/known-broken — update so future builders/LLMs aren't on stale status.

## Suggested fix order
1) leads/[id]/assign auth (#1) → 2) crm/activities/[id] scope (#3) → 3) ilike param-ize (#2) → 4) hide placeholder panels + de-jargon + mobile pb-24 (A–C) → 5) migration renumbering plan (#7) → 6) rate-limit (#5/P5) → encryption (#6).
