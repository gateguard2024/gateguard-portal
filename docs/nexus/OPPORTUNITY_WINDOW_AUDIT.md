# Opportunity Window — Deep Audit

**Surface:** Nexus glass Opportunity window (`components/nexus/windows/OpportunityGlassWindow.tsx` + `/api/nexus/opps/opportunity-window/[id]`)
**Scope of review:** ownership integrity, data accuracy, usability, and feature parity vs. best‑in‑class (Salesforce).
**Date:** session 16. Grounded in a line‑by‑line read of the component, its API route, the workbench loader, the scoping layer, and the parallel `/crm` surface.

---

## Overall grade: **5.5 / 10**

The security foundation is solid (org‑level isolation is real and enforced on both read and write), and the operator‑view concept is good. But it falls short of a 10 on three fronts: a within‑org record‑ownership gap, several "the UI can lie" accuracy issues, and a thin feature set next to Salesforce (no activity logging, no editable tasks, no contact roles, no products/line items, no stage guidance).

### Scorecard

| Dimension | Grade | One‑line verdict |
|---|---|---|
| Ownership integrity | 6.5 / 10 | Org isolation is correct; **within‑org "my records" scoping is missing** on opportunities. |
| Accuracy | 5 / 10 | Correct field mapping, but optimistic UI + drift‑retry + swallowed errors let the screen show things that aren't true. |
| Usability | 5 / 10 | Clean layout, but read‑only where it should be interactive; two of the core actions aren't wired. |
| Feature completeness (vs Salesforce) | 4.5 / 10 | Covers the basics; missing the pipeline‑management depth that makes Salesforce a 10. |

---

## 1. Ownership integrity — 6.5 / 10

**What's right (keep it):**
- **No cross‑org IDOR.** The GET resolves the caller's org scope and constrains the query by `dealer_org_id` before fetching, so loading another org's opportunity id returns a 404 rather than the record. Corporate intentionally sees all.
- **Writes are scope‑checked.** Every POST action re‑resolves scope and 404s before mutating. `reassign_opp` additionally requires admin/corporate.
- **Correct org columns on inserts.** Attachments stamp `dealer_org_id`; follow‑up todos stamp `org_id` (todos uses `org_id`, not `dealer_org_id`).

**Gaps to close:**

1. **[High] Within‑org record ownership isn't enforced.** A scoping helper for `opportunities` (by `rep_id`) exists but is never applied to the window GET or the workbench. A plain `user`‑role rep therefore sees and can open/edit **every opportunity in their org**, not just their own. Leads are filtered this way; opportunities are not. This is the "cross‑pollination" gap.
2. **[Medium] `/api/trash` delete path is unverified.** "Delete opportunity" posts to `/api/trash` with `{table:'opportunities', ids:[…]}`. That route's org‑scoping wasn't in scope of this audit and must be confirmed — a soft‑delete endpoint that trusts the id list would be a real hole.
3. **[Medium] Reassign target isn't subtree‑validated in the handler.** `reassign_opp` sets `rep_id` to whatever `assignee_id` the client sends; it relies entirely on the assignee picker's API being scoped. Add a check that the target is in the caller's subtree.
4. **[Low] Null‑org inserts for corporate‑owned deals.** When `dealer_org_id` is null (corporate‑owned), attachments/todos/activities are inserted with a null org and won't reappear in any `.in('org_id', …)` view.
5. **[Low] Cross‑surface inconsistency.** The `/crm` route grants the assigned rep cross‑org access; the glass window does not — same user, two different answers.

---

## 2. Accuracy — 5 / 10

1. **[High] Optimistic edits are never reconciled with server truth.** Saved edits are held in a local override map that `show()` always prefers over the server record, and it's never cleared after refresh. Combined with #2 below, the screen can display a value the database rejected — indefinitely, until the window is reopened.
2. **[High] Silent "drift‑retry" can drop fields while reporting success.** `update_details` strips an unmigrated column and retries up to 8×, then returns `success: true`. If a field's column is missing, the user's edit is silently dropped but they're told "saved."
3. **[Medium] Query failures are indistinguishable from empty.** Every related fetch (activities, todos, attachments, quote…) is wrapped in a helper that swallows errors and returns `[]`/`null` with no logging. A failing `crm_activities` query renders as "No activity yet." — masking a real outage.
4. **[Medium] `formatMoney` has no millions branch** — `$1,000,000` renders as `"$1000.0k"`. Small MRR is fine; large `amount` values are misrendered.
5. **[Low] Raw ISO timestamps shown as data.** Close Date, Updated, and activity/task metadata render unformatted ISO strings; the `/crm` page has date helpers the window doesn't.

---

## 3. Usability — 5 / 10

| Item | State | Note |
|---|---|---|
| Scroll to bottom | Padding present in‑component | Clipping is in the parent `ActionFlowSurface` scroll container — must be fixed there, verified live. |
| File upload | Wired correctly | Signed‑URL → PUT → record flow is sound. **No remove‑file button** though the backend supports it. |
| Schedule follow‑up | Works (popup) | Creates a **task**, not a timeline activity. |
| Add activity to timeline | **Not supported** | Timeline is strictly read‑only; only auto‑notes from edits appear. |
| Edit / delete tasks | **Not supported** | Tasks list is read‑only, though `/api/todos/[id]` PATCH+DELETE exist. |
| Theme | Mixed | Frame is steel `#0f1822`; section bodies are the lighter blue‑grey `#2b3c52` — not a single steel palette. |

---

## 4. Feature completeness vs Salesforce — 4.5 / 10

Salesforce's Opportunity is the 10 because it is a **pipeline‑management cockpit**, not a record viewer. Benchmark:

| Capability | Salesforce | This window | Gap |
|---|---|---|---|
| Stage **Path** with per‑stage guidance + key fields | ✅ Guided path, "mark stage complete" | Static badge only | **Add a clickable stage path** (biggest single UX lift) |
| Activity **composer** (log call/email/task/event) on the record | ✅ | ❌ read‑only | **Add log‑activity** |
| Tasks: edit, complete, reassign, due/reminder | ✅ | ❌ read‑only | **Wire edit/delete/complete** |
| **Contact Roles** (multiple contacts, decision‑maker/influencer) | ✅ | 1 denormalized site contact | Add contact‑role list |
| **Products / line items** + pricing | ✅ Opportunity Products | ❌ (MRR field only) | Link to quote line items |
| Quotes (multiple, sync primary) | ✅ | 1 read‑only quote card | List + generate |
| Forecast category + probability + expected revenue | ✅ | Fields shown, not editable inline | Inline‑edit + expected‑revenue calc |
| Files + Notes | ✅ | Files ✅ (no remove), Notes read‑only | Add remove + notes editor |
| **Stage / field history** (audit trail) | ✅ | Auto‑note on edits only | Add a real change history |
| Collaboration feed (Chatter) | ✅ | ❌ | Optional |
| **Opportunity scoring / next‑best‑action** | ✅ Einstein | "Next Best Actions" panel (static) | Make it data‑driven |
| Duplicate management | ✅ | ❌ | Optional |
| Inline edit everywhere | ✅ | Modal‑only edit | Add inline edit on MiniStats |

---

## Roadmap to 10 / 10 (prioritized)

**P0 — integrity & trust (do first):**
1. Apply within‑org `rep_id` scoping to the window GET **and** the workbench so reps see only their own opportunities (closes the cross‑pollination gap).
2. Verify/lock down `/api/trash` org‑scoping for delete.
3. Stop the UI from lying: clear the optimistic override after refresh, and surface any drift‑dropped field instead of returning a blanket "saved."
4. Subtree‑validate the reassign target in the handler.

**P1 — core CRM usability (makes it feel real):**
5. **Log Activity** composer (call / email / note / meeting) writing to `crm_activities`, rendered live in the timeline — this is the #1 missing feature.
6. **Editable / completable / deletable tasks** (wire the existing todos PATCH/DELETE).
7. **Remove‑file** button (backend already supports it).
8. Fix `formatMoney` millions branch; format the raw timestamps.

**P2 — Salesforce‑grade depth:**
9. Clickable **stage Path** with per‑stage guidance and "advance stage."
10. **Contact Roles** (multi‑contact with role).
11. Inline edit on the header stats; expected‑revenue = amount × probability.
12. Data‑driven **Next Best Actions** + opportunity score.
13. Real **stage/field history** panel.

**P3 — polish:** single steel palette across frame + sections; verify scroll fix live; collaboration feed if desired.

---

## Bottom line

Security‑wise this is closer to done than it looks — the hard part (org isolation on read and write) is correct. To reach a genuine 10/10 the work is: **(1) close the within‑org ownership gap, (2) make the UI incapable of showing something untrue, and (3) turn the read‑only record viewer into an interactive pipeline cockpit** (log activity, editable tasks, stage path, contact roles). Items P0–P1 alone would move this from a 5.5 to roughly an 8.
