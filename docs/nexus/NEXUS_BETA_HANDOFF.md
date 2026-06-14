# GateGuard Nexus — Beta Handoff & Context Document

> Single source of truth for the Nexus beta product direction. Written so Claude, an intern, or a new developer can understand the product without prior conversations. Branch: **beta**.
>
> Companion docs: `PUBLIC_DOCUMENT_PORTAL_PLAN.md` (+ tracker), `PERMISSIONS_SYSTEM_CONTEXT.md`, `NEXUS_GLASS_WINDOWS.md`, `DEALER_HIERARCHY_AND_PERMISSIONS.md`.

---

## 1. Executive summary

Nexus is the new front end for the GateGuard platform: a **glass interface** that replaces the legacy admin-style portal for all normal users (dealers, reps, techs, customers, interns, team). The user always moves **simple card → glass board → detail object**, and never lands in a legacy/admin screen.

Three things are true right now:
- **The platform engine works** (CRM, quotes, jobs, ARIA, signing, billing, calendar, design, systems all exist in the legacy portal).
- **The glass layer is partially built** — Dashboard surfaces, Lead/Opportunity/Job glass windows, the Internal admin hub, and the permissions system are live on beta.
- **The job now is to finish the glass layer, relocate Admin, add the missing tabs, hide legacy from normal users, and onboard dealers safely this week.**

The two streams already in flight feed directly into this: the **Permissions system** (4 roles, downward org scope, Add Person, Clerk→profiles sync) is the backbone of the dealer-safe shell + Admin panel; the **Public Document Portal** (`/document/[slug]` glass) is the backbone of Dealer Onboarding signing + Money/Docs → Documents to Sign.

---

## 2. The non-negotiable standard

**Nexus standard:**
- Easy enough for a 5th grader.
- Glass interface only.
- No visible legacy/admin pages for normal users.
- No dead-end buttons that look broken.
- No hidden important data; no backend/architecture jargon; no modules named after old system internals.
- Flow: simple cards → glass board → detailed object only when needed.

**Legacy rule:** legacy pages may stay alive for admin/developer fallback, but dealers/interns/regular users must never land there. Any legacy route still reachable inside Nexus is **temporary and tagged for replacement**.

**Intern = the test.** If the intern hesitates, the UI isn't clear enough.

**Hard UX rules (apply to every screen — locked):**
- **5th-grader simple** — plain words, no jargon, no dead-ends.
- **Landing is ALWAYS My Day.** Admin is never the landing; it's reachable only via the near-hidden admin icon (top-right, all pages, admins only).
- **Card grids = 4 columns** (desktop) — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`. Cards → glass board → detail pane.
- **Sub-menus never more than 4 items.** If a surface needs more, group into ≤4 cards.
- **One object format.** Every object detail — job, work order, parts, customer, lead, opportunity, site, invoice, technician — opens in the SAME glass-pane format (see §15). Same layout, same action-rail pattern, same terminology. A user who learns one learns them all.

---

## 3. Target global navigation

**Current bottom bar** (in `components/nexus/NexusHomeClient.tsx` → `NAV_ITEMS`):
My Day · Sales · Jobs · Customers/Sites · Money/Docs · **Internal**

**Target bottom bar:**
My Day · Sales · Jobs · **Operations/Business** · **Design** · **Systems** · Money/Docs

Changes:
- **Rename** Customers/Sites → **Operations/Business** (it absorbs Customer Sites as its primary board).
- **Add** Design and Systems as top-level tabs.
- **Remove Internal** from the bottom bar.
- **Admin → near-hidden icon** above/near the Nexus mark — visible to admins who know where to look, not part of normal flow.

**Admin panel contents:** Dealer Onboarding · Users & Features · Feature Permissions · Platform Settings · Internal Tracker · Playbooks · Training · System Administration.

> Implementation note: the tab→surface switch lives in `NexusHomeClient.tsx` (`activeTab` → `MyDaySurface` / `SalesSurface` / `JobsSurface` / `CustomersSitesSurface` / `MoneyDocsSurfaceNext` / `InternalSurface`). Adding/renaming tabs = edit `NAV_ITEMS` + the surface switch + add `DesignSurface` / `SystemsSurface`. Moving Admin = remove the `Internal` nav item and mount `InternalSurface` behind the hidden admin icon.

---

## 4. Standard tab flow

Every tab follows: **1) Main card → 2) Glass board → 3) Detail pane → 4) Action rail → 5) Deep/legacy fallback (admin/advanced only).**

Each tab below is documented as: Purpose · Primary user · Current state · Cards · Boards · Detail panes · Actions · Legacy to replace · Permissions · Phase.

---

## 5. My Day

- **Purpose:** daily command center. **Primary user:** everyone. **Current state:** `MyDaySurface` exists; calendar + todos backends exist (`/api/calendar/*`, `/api/todos`), GCal sync built. **Phase:** 2.
- **Cards:** Today's Schedule · Today's Priorities · To-Dos · Messages.
- **Today's Schedule:** GateGuard-hosted calendar + Google sync; day/week/month + list; color-coded; **see own + direct-reports' calendars** (uses the permissions hierarchy); add/edit/assign event; open site/job/customer context from an event.
- **Today's Priorities:** actionable, not a list — open each item in its glass pane, mark done, add note, open related job/lead/customer/invoice/task.
- **To-Dos:** "Monday.com power, 5th-grade simple" — list + calendar views (no charts yet); open/add/edit/assign task; subtasks; due date; priority; notes; link to lead/job/customer/quote/invoice/site/dealer; mark complete; reassign; filters (mine/team/overdue/today/this week). Backed by the tracker tables.
- **Messages:** channels = Gmail · generic IMAP · SMTP send · Twilio voice · Twilio SMS/MMS. **No Slack/WhatsApp this phase.** User concept = Messages / Conversations / Needs Reply / Calls / Texts / Email / Follow-ups — backend connectors are hidden from users.
- **Legacy to replace:** `/calendar`, `/todos` pages. **Permissions:** all roles; calendar visibility scoped by hierarchy.

---

## 6. Sales

- **Purpose:** lead → opportunity → quote. **Primary user:** reps, dealers. **Current state:** Add Lead debugged/working; Work My Leads mostly working (Lead Glass improved); quotes need full build; ARIA in place. **Phase:** 1 (leads), 3 (quotes).
- **Cards:** Add New Lead · Work My Leads · Create/Work Quotes · Research Property/ARIA.
- **Add New Lead** ✅ — retain: duplicate override, existing-lead edit, contact-not-found, source tracking, lead stage update.
- **Work My Leads** 🟡 — Lead Glass is the standard. **Add next:** attachments (add/open/link to opp/customer/property); open detail; change status; add note; create opportunity; contact-not-found; "other interest" text.
- **Create/Work Quotes** ☐ full build — model on **Quiller / Quotient**: guided cards not a spreadsheet; create from lead/opportunity/customer/property; packages + optional add-ons + monitoring + access control + install work + recurring fees; generates a proposal customer view (→ Public Document Portal); trackable status.
- **Research Property/ARIA** — leave ARIA in place. **Permission rule:** if user lacks ARIA permission, **still show the card, visibly locked** ("ARIA is a paid research feature") — do not hide it.
- **Legacy to replace:** `/crm`, `/quotes`, `/survey`. **Permissions:** `sales.crm`, `sales.quotes`, `ai.aria` (paid/locked).

---

## 7. Jobs

- **Purpose:** field work lifecycle. **Primary user:** dispatch, techs, dealers. **Current state:** `JobsSurface` + Job glass window exist; `/api/nexus/jobs/*` built. **Phase:** 3.
- **Cards:** Today's Jobs · Needs Attention · Schedule Visit · Open Jobs — all must open **real glass boards**.
- **Board:** Monday-like but simpler; list + calendar views.
- **Job detail glass:** assigned technician, status, notes, photos, attachments, subtasks/checklist, customer/site link, schedule/reschedule, mark complete.
- **Later:** Needs Attention view, Dispatch view.
- **Legacy to replace:** `/maintenance`, `/dispatch`, `/projects`. **Permissions:** `field.work_orders`, `field.dispatch`.

---

## 8. Operations / Business (replaces Customer Sites)

- **Purpose:** business ops around customers, properties, sites, service relationships. **Current state:** `CustomersSitesSurface` exists; rename + expand. **Phase:** 4.
- **Primary board:** Customer Sites. **Flow:** Operations/Business → Customer Sites → card → glass board → customer/property/site detail.
- **Cards:** Find Customer · Find Property · Properties Needing Attention · Property Systems.
- **Find Customer** searches: accounts, companies, contacts, billing relationships, recent jobs, documents, sites/properties.
- **Find Property** searches: name, address, site, management company, gates, cameras, systems, open jobs.
- **Properties Needing Attention** surfaces (eventually): open jobs, missing contacts, ARIA gaps, billing issues, document expirations, follow-ups, system issues.
- **Property Systems** surfaces: gates, cameras, access control, network, floor plans, as-builts, devices, installed systems.
- **Legacy to replace:** `/customers`, `/sites`. **Permissions:** `business.customers`, `business.properties`.

---

## 9. Money / Docs

- **Purpose:** invoices, renewals, signing, compliance. **Current state:** `MoneyDocsSurfaceNext` exists; signing → Public Document Portal (Phase 0–1 built). **Phase:** 5.
- **Cards:** Invoices · Renewals · Documents to Sign · Compliance.
- **Invoices:** open/paid/overdue; customer account; property/site association; send invoice; payment status; notes/follow-up.
- **Renewals:** contract/monitoring/dealer/service renewals; expiration dates; reminders; open renewal; assign owner.
- **Documents to Sign:** NDA, dealer agreements, customer proposals, service agreements, completed/final executed docs; open final copy; countersign when needed; send final copy. **→ all via the Public Document Portal (`/document/[slug]`).**
- **Compliance:** W9, COI, license, background-check acknowledgment; dealer + vendor compliance; customer/site compliance eventually.
- **Legacy to replace:** `/billing`, `/renewals`, `/contracts`, `/documents`, `/compliance`. **Permissions:** `business.billing`, `documents.*`, `dealer.compliance`.

---

## 10. Design (new tab)

- **Purpose:** designs, floor plans, drawings, as-builts, proposal/design packages, site layout, camera placement, access-control layout, network topology, engineering notes. **Phase:** 6.
- **Cards (4-tier selection):** Site Design · Floor Plans · As-Builts · Proposal Drawings — each opens a glass board.
- **Legacy to replace:** `/design/floor-plans`, `/design/system`, `/design/as-builts`. **Permissions:** `design.*`.

---

## 11. Systems (new tab)

- **Purpose:** all installed/managed systems. **Phase:** 6.
- **Cards:** Gates · Cameras · Access Control · Networks.
- **System object (future):** customer, property, site, device list, status, service history, attachments, notes, photos, monitoring status, warranty/service plan, related jobs.
- **Legacy to replace:** `/cameras`, `/access`, `/network`. **Permissions:** `systems.*`.

---

## 12. Admin panel (near-hidden icon, not a bottom-bar tab)

- **Access:** small icon above/near the Nexus mark; corporate/admin only.
- **Contents:** Dealer Onboarding · Users & Features · Tracker · Playbooks · Training · Settings.
- **Current state:** `InternalSurface` already implements this hub (Users & Features glass board ✅, Dealer Onboarding board ✅, Tracker ✅). Work = detach it from the bottom bar and mount behind the admin icon.
- **Dealer Onboarding (URGENT — Week 1):** create dealer → assign tier → send NDA → dealer signs → GateGuard countersigns → final NDA visible → send Agreement → dealer signs → countersign → final visible → collect compliance → assign users → assign permissions → activate dealer.
  - Allowed onboarding permission sets: Corporate, Master Agent, Master Dealer, + other approved roles.
  - Signing runs through the **Public Document Portal**.

---

## 13. Permission map (built)

Source of truth: `PERMISSIONS_SYSTEM_CONTEXT.md`. Summary:
- **Org scope (downward only):** a user sees their org + everything below, never up/sideways. Corporate = all.
- **Roles (4):** Admin (all in org + manages users), Supervisor (all in org, no user mgmt), User (assigned-only: leads/opps/quotes/WOs), Tech (field tools + their work orders).
- **Feature flags:** `feature_catalog` → `org_feature_flags` → `user_feature_access`, levels none/view/edit, driven by role presets + advanced override; capped so nobody grants more than they have.
- **Locked-but-visible** paid features (e.g., ARIA) instead of hidden.
- **Admin UI:** Internal → Users & Features (glass user editor + Add Person wizard); Clerk→profiles sync (webhook + backfill) keeps the user list real.

---

## 14. Dealer rollout map

### Week 1 — Dealers
Dealers onboarding this week must: log in → see **only** Nexus → add sub-users → add leads → work leads → move lead to opportunity → add notes → add attachments → create basic customer/opportunity records — **without training**.

Week-1 build focus:
1. Dealer login + permission-safe Nexus shell (no legacy exposed).
2. Sales: Add New Lead ✅.
3. Sales: Work My Leads 🟡.
4. Attachments on leads ☐.
5. Dealer user management ✅ (Add Person + Users & Features).
6. Dealer onboarding documents complete (NDA/agreement via Public Document Portal) 🟡.
7. No legacy UI exposed to dealers ☐ (legacy-hide pass).

### Week 2 — Customers & installs
Customers, properties, installs/jobs, site systems, schedules, job assignment, job notes/photos, customer/site detail glass.

---

## 15. Glass-pane standard (Lead Glass is the model)

1. **Big top card** — object type, main name, company/site/context, location/status.
2. **Four quick facts** — editable fields show a pencil icon; no buried key data.
3. **Human detail blocks** — Address · Needs/Interested In · Notes/Details · People · Related object · Activity · Tasks · Attachments.
4. **Right action rail** — most common action first, edit near top, clear status movement, no mixed terminology.
5. **Technical sections only if useful** — duplicate guard only when matches exist; no empty diagnostic blocks.
6. **Bottom padding / internal scroll** — bottom nav must never cut off content.

Existing implementations to follow: `components/nexus/windows/LeadGlassWindow.tsx`, `OpportunityGlassWindow.tsx`, `JobGlassWindow.tsx`, `UserGlassWindow.tsx`, and the public `NexusDocShell`.

---

## 16. Legacy removal strategy

1. **Hide, don't delete (yet):** keep legacy routes alive for admin/dev; block normal users via the permission shell + nav (legacy not linked from Nexus).
2. **Tag every legacy route** reachable in Nexus as temporary (this doc's "Legacy to replace" lines are the registry).
3. **Replace per tab** following the phase plan; when a glass board fully covers a legacy page, remove its last Nexus entry point.
4. **External links never touch legacy/chrome** — all outbound documents go through `/document/[slug]` (Public Document Portal).
5. **Audit gate:** no dealer-visible path may land on a `bg-white`/sidebar legacy screen (intern test).

---

## 17. Known working / broken / open

### Known working (verified)
- Permissions engine (roles, downward scope, assigned-only, Add Person, Clerk→profiles sync, org classification).
- Glass surfaces: Dashboard/Nexus home, My Day/Sales/Jobs/Customers-Sites/Money-Docs/Internal surfaces, Lead/Opportunity/Job/User glass windows.
- Add New Lead; Work My Leads (core); ARIA; signing via `/sign/[token]` (glass); Public Document Portal Phase 0–1 (`/document/[slug]`).
- Dealer Onboarding board + Users & Features board (in Internal/Admin).

### Known broken / incomplete
- Internal still in bottom bar (must move to hidden admin icon).
- Design, Systems, Operations/Business (rename) tabs not yet top-level.
- Proposal/approve customer pages were legacy-styled (proposal reframed to glass; approve to be replaced by `/document/[slug]`).
- **Nexus Coach — positive reinforcement layer (logged for build schedule):** visible, opt-out-able encouragement — win celebrations (glow/confetti on deal approved, lead won, job completed), a rotating encouragement/"coach" line on My Day, momentum + streak cues, and a warm-tone microcopy pass. Explicitly NOT subliminal/hidden messaging (deceptive + restricted); all perceived and dismissible. Wire to real events (quote accepted, opportunity won, work order completed).
- ~~Lead attachments missing~~ ✅ done. **Quotes — full overhaul required (logged, not yet scheduled):** the current quote builder + customer view need a ground-up rework modeled on Quiller/Quotient — guided cards (not a spreadsheet), create-from lead/opp/customer/property, packages + optional add-ons + monitoring + access control + install + recurring, generates the customer proposal view (now via the Public Document Portal), trackable status. Treat as its own mini-project after the Phase 1–7 spine; do not patch piecemeal.
- Messages connectors not built. To-Dos not yet full Monday-simple. Calendar hierarchy visibility not wired.
- Legacy pages still reachable; legacy-hide pass for dealers not done.

### Open build list (by phase, see §18)
Attachments → quote builder → tab nav redesign → admin relocation → My Day completion → Jobs glass → Operations → Money/Docs → Design/Systems → command router.

---

## 18. Claude / developer task sequence (phase rollout)

> The Public Document Portal sub-plan (`PUBLIC_DOCUMENT_PORTAL_PLAN.md`) executes inside Phase 1 (dealer signing) and Phase 5 (Money/Docs). The Permissions system is already largely complete and underpins Phase 1.

- **Phase 1 — Dealer-safe launch (THIS WEEK):** hide legacy for dealers · finish Dealer Onboarding (NDA/agreement signing via document portal) · finish Sales lead→opportunity path · add lead attachments · admin permissions for dealer onboarding · confirm NDA/agreement signing workflow.
- **Phase 2 — My Day:** schedule views · Google Calendar sync · calendar visibility by hierarchy · To-Dos (Monday-simple) · Messages connector foundation.
- **Phase 3 — Jobs/installs:** Today's Jobs · Needs Attention · Schedule Visit · Open Jobs · job detail glass · field notes/photos · assignment · calendar integration.
- **Phase 4 — Operations/Business:** customers · properties · customer sites · property systems (customers & installs for week two).
- **Phase 5 — Money/Docs:** invoices · renewals · documents (portal) · compliance.
- **Phase 6 — Design & Systems:** legacy design + system pages mapped to glass; as-builts/floor plans/devices/service plans.
- **Phase 7 — Command router:** natural language routes to the right tab/board/action ("show my open leads", "create a new lead", "send NDA to dealer", "show today's jobs", "add task for technician").

Each phase ends green-build + an intern walkthrough before the next.

---

## 19. Navigation reframe — current vs target (quick reference)

| Bottom bar slot | Current | Target | Action |
|---|---|---|---|
| 1 | My Day | My Day | keep |
| 2 | Sales | Sales | keep |
| 3 | Jobs | Jobs | keep |
| 4 | Customers/Sites | Operations/Business | rename + expand |
| 5 | Money/Docs | Design | add Design; move Money/Docs |
| 6 | Internal | Systems | add Systems |
| 7 | — | Money/Docs | keep (re-slotted) |
| hidden | — | Admin icon | move Internal here |
