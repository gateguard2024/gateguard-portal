# ARIA Route Map

**Branch:** beta  
**Date:** June 3, 2026  
**Sprint:** C — ARIA workflow import

---

## Current ARIA Routes

| Route / File | Purpose | Notes |
|---|---|---|
| `app/aria/page.tsx` | ARIA UI | Candidate grid, pipeline panel, Intel DB, SWR cache, Realtime subscription |
| `app/api/aria/research/deep/route.ts` | Deep research API | 4-phase ARIA engine v8 — classification, Phase 1A/1B, enrichment, intelligence, synthesis |
| `app/api/aria/searches/route.ts` | Search history | GET saved searches scoped to current user |
| `app/api/aria/searches/[id]/import/route.ts` | Import lead from ARIA | Stamps assignment + 7-day temp hold on import |
| `app/api/aria/properties/route.ts` | Intel DB — list | GET paginated + filterable + POST batch upsert |
| `app/api/aria/properties/[id]/route.ts` | Intel DB — detail | GET single + PATCH sales cycle fields |
| `app/api/aria/cache/route.ts` | SWR fast-path | Sub-200ms DB lookup before full pipeline |
| `app/api/aria/enrich/route.ts` | Background enrich | POST fires Inngest aria/property.enrich event |
| `app/api/aria/usage/route.ts` | Usage tracking | GET my/org/hierarchy search counts |
| `app/api/aria/test/route.ts` | Diagnostic | Raw API calls per step, no Haiku processing |

---

## Current ARIA Workflow

```
User opens /aria
    ↓
Types property name, company, city, or criteria
    ↓
Phase 0: Haiku classifies query
    (specific_property | city_prospect | criteria_prospect | contract_prospect)
    ↓
Phase 1A (specific_property): listing page fetch, amenity extraction, phone search
    or
Phase 1B (prospecting): 3 Serper searches → 6-8 candidates returned
    + Top-3 lightweight enrichment (units/phone/management/gate signal)
    ↓
Phase 2: Owner lookup, ISP/video enrichment, ROE/bulk agreement detection,
         EDGAR + last sale, FCC broadband map
    ↓
Phase 3: PropTech Scout, pain signal extraction, contact search,
         Apollo enrichment, NinjaPear validation
    ↓
Phase 4: Sonnet synthesis → structured report
         (Promise.allSettled — fallback to deterministic data if Sonnet fails)
    ↓
Evidence packets saved (source_url + raw_snippet per finding)
Intelligence DB upserted (aria_properties — never deleted)
    ↓
User reviews: Property tab | Decision Maker tab | Intel tab | SCOUT tab
    ↓
User imports lead (stamps assigned_to + 7-day temp hold)
```

---

## ARIA v8 Reliability Features (on beta as of Sprint C)

| Feature | Description |
|---|---|
| Ticket 1 — Candidate preservation | `saveCandidatesToDB` status always `'pending'` — no auto-selection |
| Ticket 2 — Evidence persistence | Phase 1B/1A/3 saves source URL + raw snippet per finding |
| Ticket 4 — Top-3 enrichment | `enrichTopCandidates()` — 3 Serper + 3 Haiku for top candidates |
| Ticket 5 — PropTech Scout | `ProptechFinding` interface — confidence-scored proptech with source URLs |
| Synthesis fallback | `Promise.allSettled` + `buildFallbackRawData()` — Sonnet timeout never loses data |
| Candidate grid fix | `viewMode === 'candidates'` (not `candidates.length > 0`) |

---

## Future Nexus Launch Points

| Nexus Object | Future Launch | Purpose |
|---|---|---|
| Lead | Run ARIA | Research the property or management company before qualification. Surface ISP stack, proptech, pain signals, and decision maker chain before the first call. |
| Opportunity | Run ARIA | Enrich deal intelligence before quote or proposal. Confirm tech stack, bulk agreement window, and ownership to sharpen the pitch. |
| Site | Run ARIA | Full site intelligence — proptech stack, connectivity, resident pain, contract expiry, and displacement opportunities for an active customer site. |
| Project | Run ARIA | Pull property context for delivery planning — gate/access/intercom details, vendor footprint, and management contacts for install coordination. |

---

## Not Built In This Sprint

- No Lead Glass Window ARIA action implementation
- No Opportunity Glass Window ARIA action implementation
- No Site ARIA implementation
- No Project ARIA implementation
- No deep ARIA troubleshooting or engine changes
- No ARIA redesign or glass window migration

This sprint imports the current ARIA workflow into beta and maps future launch points. The ARIA UI and engine are brought over as-is from main.

---

## Files Brought From Main In This Sprint

| File | What Changed |
|---|---|
| `app/api/aria/research/deep/route.ts` | All v8 tickets: evidence packets, candidate preservation, top-3 enrichment, PropTech Scout, synthesis fallback |
| `app/aria/page.tsx` | CandidateGrid render fix: `viewMode === 'candidates'` |

## Files Not Touched

All Nexus glass workflow files were left unchanged:
- `components/nexus/ActionFlowSurface.tsx`
- `components/nexus/windows/LeadGlassWindow.tsx`
- `components/nexus/windows/OpportunityGlassWindow.tsx`
- `app/api/nexus/opps/workbench/route.ts`
- `app/api/nexus/opps/lead-window/[id]/route.ts`
- `app/api/nexus/opps/opportunity-window/[id]/route.ts`
- `app/api/nexus/flows/inbound-lead/route.ts`
- `lib/current-user.ts`
- `lib/org-scope.ts`
