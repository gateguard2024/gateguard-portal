# Public Document Portal — Comprehensive Build Plan

> Branch: **beta**. Goal: every external document link (NDA, agreements, customer contracts, proposals, signature pages, final copies) opens a **no-login, no-chrome, Nexus-glass** page at **nexus.gateguard.co/document/[slug]** — never the internal portal. Single universal page; secure token behind a readable slug.

> Decision locked: `document_signatures` is the **single universal outbound-document table** (it already has ~90% of the required fields). Proposals get a `document_signatures` row too (`document_type='proposal'`). One resolver, one page, all types.

---

## Current state (verified)

| Surface | Today | Verdict |
|---|---|---|
| `/sign/[token]` (NDA/agreements) | No-login, standalone (no sidebar), already Nexus glass, has states + "Open Final Copy" | ✅ close to target |
| `/quotes/[id]/approve` (emailed quote link) | Standalone, but its own branded "GG" cover style — not the unified portal | 🔁 replace via universal page |
| `/quotes/[id]/proposal` (internal preview/share) | Was legacy white shell → **reframed into NexusDocShell this cycle (interim)** | 🟡 interim, replace via universal page |
| `/documents`, `/contracts` | Internal, chrome-wrapped; **no external link points to them** (verified) | ✅ leave internal |
| PortalShell standalone list | `/sign`, `/quotes/*/proposal|approve` already chrome-free | ➕ add `/document` |
| middleware bypass | `/sign/`, `/quotes/` bypassed | ➕ add `/document/` |

The routing/chrome layer is mostly fine. The real work is the **unified slug system + universal page + routing every send through it**.

---

## Phase 0 — Foundation ✅ (done this cycle; migration pending run)

- [x] `components/public/NexusDocShell.tsx` — universal glass portal frame (dark Nexus chrome + "Document Portal" header + white sheet + print-safe). Reused by every public doc page.
- [x] Migration `112_public_document_portal.sql` — adds `public_slug` (unique), `customer_id`, `property_id`; extends `document_type` to include `customer_contract` + `proposal`. **→ run on beta, then prod.**
- [x] `lib/doc-slug.ts` — `generatePublicSlug()`, `generateSecureToken()` (64-char), `publicDocUrl()` (→ nexus.gateguard.co).
- [x] Interim: proposal page reframed into NexusDocShell so it stops looking legacy.
- [ ] Add `NEXT_PUBLIC_NEXUS_URL=https://nexus.gateguard.co` env (beta + prod) and add `nexus.gateguard.co` as a domain alias in Vercel pointing to this app.

---

## Phase 1 — Universal public page `/document/[slug]`

The single front door. One page, state-driven.

- [ ] **1.1** `middleware.ts` — add `/document/` and `/proposal/` to the bypass list (no Clerk).
- [ ] **1.2** `components/layout/PortalShell.tsx` — add `/document` (and `/proposal`) to `isStandalone`.
- [ ] **1.3** `app/api/document/[slug]/route.ts` — GET resolver: slug → `document_signatures` record; return ONLY public-safe fields shaped by status (never expose token/internal IDs). 404→ "unavailable" payload; expired→ "expired" payload.
- [ ] **1.4** `app/api/document/[slug]/route.ts` — POST actions (gated by matching the record's token server-side): `sign`, `approve`, `request_changes`, `ask_question`. Reuse existing signature logic where possible.
- [ ] **1.5** `app/document/[slug]/page.tsx` — universal glass page (NexusDocShell). Renders by state:
  - **review** — main card "[Document Type] · Prepared for [Company] · Sent by GateGuard" + document_html inline (or document_url open link) + steps.
  - **sign** — signature capture (fold in `/sign` UI).
  - **approve** (proposals) — Approve / Request Changes / Ask a Question / Download PDF.
  - **awaiting countersignature** — "Signed — pending GateGuard countersignature."
  - **final** — "Document Complete · Open Final Copy" (executed_cert_url).
  - **expired** / **unavailable** — friendly glass messages.
- [ ] **1.6** Status → UI map helper (`lib/doc-status.ts`): for each `document_type` + `status`, the label + which step/actions show (matches the spec's visible-states lists for NDA/Contract/Proposal).

**Acceptance:** open a seeded slug in incognito → no login, no chrome, correct state renders.

---

## Phase 2 — Route NDA + agreements + contracts through the portal

- [ ] **2.1** `app/api/signatures/send/route.ts` — on send, also generate + store `public_slug`; email link uses `publicDocUrl(slug)` (nexus.gateguard.co/document/[slug]) instead of `/sign/[token]`.
- [ ] **2.2** Keep `/sign/[token]` working: make it a thin redirect to `/document/[slug]` when a slug exists (back-compat for already-sent links).
- [ ] **2.3** `customer_contract` type: wire the contract send (Dealer Onboarding / Customer / Sales) to create a `document_signatures` row + slug, same as NDA.
- [ ] **2.4** Countersign + final copy: `executed_cert_url` shown on the universal page; email "Open Final Copy" → `publicDocUrl(slug)`.
- [ ] **2.5** Populated review: confirm `document_html` renders inline for NDA + each agreement type.

**Acceptance (NDA + Contract):** send → incognito → no chrome → populated doc → sign → countersign → Open Final works.

---

## Phase 3 — Route proposals through the portal

- [ ] **3.1** On quote send (`app/api/quotes/[id]/send/route.ts`): create a `document_signatures` row `document_type='proposal'`, link `opportunity_id`/`customer_id`/`property_id`, set `document_html` (rendered proposal) or `document_url` (proposal link), generate `public_slug`.
- [ ] **3.2** Email links to `publicDocUrl(slug)` instead of `/quotes/[id]/approve`.
- [ ] **3.3** Universal page proposal mode: Review Proposal → Approve / Request Changes / Ask a Question / Download PDF. Approve updates the quote status + the doc status; "request changes"/"ask a question" notify GateGuard (Resend).
- [ ] **3.4** Approved proposal → sales record / contract path (reuse existing approve logic).

**Acceptance (Proposal):** send → incognito → no chrome → readable → Approve / Request Changes path clear.

---

## Phase 4 — Retire legacy external links

- [ ] **4.1** Audit every `Resend`/email send for outbound URLs; ensure all point to `publicDocUrl(slug)`.
- [ ] **4.2** Redirect `/quotes/[id]/approve` and `/quotes/[id]/proposal` to the universal page when a slug exists (keep internal preview for staff).
- [ ] **4.3** Remove/redirect any remaining external entry points that render chrome.

---

## Phase 5 — Security, expiry, polish

- [ ] **5.1** Token is the real credential: resolver verifies token/record server-side; slug alone (and the 8-digit) never grants access to another document.
- [ ] **5.2** Expired links → glass "This link has expired" page; invalid slug → glass "Document unavailable" page.
- [ ] **5.3** Mobile pass on the universal page (NexusDocShell already responsive).
- [ ] **5.4** `nexus.gateguard.co` live (Vercel domain + env); verify HTTPS.
- [ ] **5.5** Rate-limit the resolver to deter slug enumeration.

---

## Acceptance test matrix (from spec)

- **NDA:** send → incognito → no login wall / no sidebar / no internal nav → populated NDA → sign → countersign → Open Final NDA works.
- **Contract:** send → incognito → no chrome → populated → sign → final stored.
- **Proposal:** send → incognito → no chrome → readable → approve / request-changes clear.
- **Security:** expired → expired page; invalid slug → unavailable page; cannot guess another doc from the 8-digit number alone.

---

## Execution order (efficiency-optimized)

1. Phase 0 finish (run migration 112 on beta; set nexus env/domain).
2. Phase 1 (universal page + resolver) — the keystone; everything else plugs in.
3. Phase 2 (NDA/contracts onto it) — highest urgency, simplest (signatures already modeled).
4. Phase 3 (proposals onto it).
5. Phase 4 (retire legacy links).
6. Phase 5 (security/expiry/domain/polish).

Each phase ends green-build + its acceptance test before the next.
