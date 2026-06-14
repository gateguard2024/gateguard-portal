# Dealer Onboarding — Target Workflow (spec)

> Source: Russel's notes (June 2026). Captured for the Dealer Onboarding rebuild.
> Per the build rule, this is DOCUMENTED now and built when we reach the dealer-onboarding phase.
> The goal is a seamless pipeline from "interested" through the first 90 days of selling.

## The complete 8-stage workflow

### 1. Lead Capture & Initial Vetting
- Receive the lead / application from the interested dealer.
- **NEW — Background & credit checks.** Mandatory if they will hold physical inventory (e.g. receivers) or process sensitive customer financial data.
- Verify business entity; check for problematic **territorial overlaps** with existing dealers.

### 2. Hierarchy & Team Assignment
- Determine org structure: Master/Primary Dealer (reports to corporate) vs Sub-Dealer (rolls up to a Master Dealer).
- **NEW — Assign dedicated Channel Manager.** Attach a specific internal account manager to the dealer file now, so they have a single point of contact through onboarding.

### 3. Contracting & Financial Compliance
- Generate + send the **Authorized Dealer Agreement (ADA)**.
- **NEW — Collect financial & tax docs concurrently.** Require **W-9** and **ACH direct-deposit** forms alongside the ADA so we're legally cleared to pay commissions.
- Track signatures; receive the fully executed agreement package.

### 4. System Provisioning & Access Control
- Create their corporate account in the partner portal/CRM.
- Select user levels (Owner / Sales Rep / Technician).
- Configure explicit access controls — they only see pricing, customer data, and tools relevant to their tier + hierarchy level.

### 5. Welcome Sequence & Asset Delivery
- Trigger automated onboarding email with portal login credentials.
- Send official **Welcome Letter** introducing their assigned Channel Manager.
- **NEW — Distribute Marketing & Co-Branding Toolkit.** Approved logos, promo materials, and clear compliance rules for how they may advertise the product.

### 6. Training & Certification
- **Platform training** — entering orders, tracking installs, navigating the portal.
- **Sales training + certification** — pitching accurately and compliantly.
- **Field/technician certification** — if they install their own hardware.

### 7. First Sale Shadowing & Go-Live
- Dealer is officially "live," but the first order is closely monitored.
- **Shadowed first sale** — support team or their Master Dealer walks them through pitch → data entry → install scheduling to catch early mistakes.

### 8. Ongoing Management (30/60/90-Day Reviews)
- Mandatory check-ins at 30, 60, 90 days.
- Review sales volume, install quality, marketing compliance, platform usage — confirm they're ramping profitably.

---

## Gap analysis vs. what exists today

| Stage | Already built | To add |
|------|---------------|--------|
| 1. Vetting | — | Background/credit check capture, entity verification, territory-overlap check |
| 2. Hierarchy & team | Tier + parent-org relationships (wizard steps 2 & 4) | **Channel Manager assignment** field on the org |
| 3. Contracting | NDA + ADA via e-sign (`lib/nda-template.ts`, `lib/agreement-template.ts`, `/sign`, `/document` portal) | **W-9 + ACH** collection in the same package |
| 4. Provisioning | Org + admin user + Clerk; roles (admin/supervisor/user/tech) + feature flags by tier | Mostly done — confirm user-level + access mapping at onboard time |
| 5. Welcome + assets | NDA/Agreement emails via Resend | **Welcome letter** w/ Channel Manager intro + **Marketing/Co-Branding toolkit** delivery |
| 6. Training | `/training`, SAGE agent, `dealer_scorecards` (migration 021) | Onboarding-gated **certification** tracking (platform/sales/field) |
| 7. Shadowing | — | **Shadowed first sale** flag + checklist before unrestricted go-live |
| 8. 30/60/90 reviews | Scorecards exist | Auto-scheduled **30/60/90 review tasks** (tie to tracker + scheduled tasks) |

## Likely backend work when we build this
- `organizations`: `channel_manager_user_id`, `onboarding_stage` (enum across the 8 stages), `vetting_status`, `territory`/overlap check.
- New `dealer_onboarding_docs` (or reuse `document_signatures`) for W-9 + ACH alongside NDA/ADA.
- `dealer_certifications` table (platform/sales/field, status + date).
- Onboarding checklist driving the wizard + a dealer-facing progress view.
- Auto-create 30/60/90 review tasks (tracker / scheduled tasks) at go-live.
- Marketing toolkit: a documents bundle linked to the dealer org.

## Notes
- Current wizard: `app/admin/dealers/new/page.tsx` (7 steps) + `app/api/admin/onboard-dealer/route.ts` + Compliance tab on `app/admin/dealers/[id]/page.tsx`. This 8-stage flow is the superset to grow it into.
- W-9/ACH are financial PII — store with the same care as other compliance docs; never expose in list endpoints.
