# ARIA Product Plan

## 5th Grader Vision

ARIA should be simple enough that a sales rep can type a property, company, city, or target and immediately understand what to do next.

The user-facing flow should be:

```text
Type a property, company, city, or target
↓
ARIA researches it
↓
ARIA answers: Is this worth calling?
↓
ARIA shows:
- Who to call
- What to say
- What the property probably has today
- Why they may care
- What evidence supports the finding
- Create Lead / Save Site / Send to Scout
```

ARIA should not force the user to understand FCC, Apollo, PropTech Scout, ROE agreements, Reddit, reviews, ownership records, or AI synthesis. Those are engine details. The UI should show the outcome.

## Current Definition

ARIA is GateGuard's property intelligence engine. It researches properties, management companies, owners, decision makers, resident/social pain signals, PropTech stack, connectivity providers, video providers, and sales approach.

The current goal is to turn a manual 30-minute research session into a fast automated brief that tells a rep whether to call, who to call, why to call, and what to say.

## Paid Product Assumptions

- ARIA will be a paid add-on.
- Future clients may buy credits.
- Current working assumption: $1 per search credit.
- Internal cost target: do not exceed $0.40 per completed search.
- Do not charge full credit unless the result meets the minimum payload for the selected search mode.
- Partial results may be free, discounted, or require user acceptance before charging.

## Search Modes and Minimum Payloads

### Search All

Required fact evidence:

- Unit count
- Leasing/property phone
- Property address
- Management company
- Owner / ownership group
- Gate / access status
- Camera and security status
- Smart locks / SmartRent / unit automation
- Package lockers
- ISP provider + bulk yes/no
- Video provider + bulk yes/no
- Social media / resident posts

### ISP / Internet

Required fact evidence:

- Unit count
- Leasing/property phone
- Property address
- Management company
- Owner / ownership group
- ISP provider + bulk yes/no
- Social media / resident posts

### Cable / Video

Required fact evidence:

- Unit count
- Leasing/property phone
- Property address
- Management company
- Owner / ownership group
- Video provider + bulk yes/no
- Social media / resident posts

### Gates & Access

Required fact evidence:

- Unit count
- Leasing/property phone
- Property address
- Management company
- Owner / ownership group
- Gate / access status
- Smart locks / SmartRent / unit automation
- Package lockers
- Social media / resident posts

### Cameras

Required fact evidence:

- Unit count
- Leasing/property phone
- Property address
- Management company
- Owner / ownership group
- Camera and security status
- Social media / resident posts

## Research Quality Model

Every ARIA result should eventually include a `research_quality` object:

```ts
research_quality: {
  mode: 'search_all' | 'isp_internet' | 'cable_video' | 'gates_access' | 'cameras',
  status: 'complete' | 'partial' | 'failed',
  good_enough_to_call: boolean,
  good_enough_to_create_lead: boolean,
  charge_recommendation: 'full_credit' | 'partial_or_free' | 'no_charge',
  found: string[],
  missing: string[],
  unknown: string[],
}
```

### Complete

The selected search mode has all required facts and evidence.

### Partial

The result is useful but missing required facts.

Example: good enough to call, but not enough to charge full credit.

### Failed

The result is not reliable enough to call or create a lead.

## Social Posts Are Required

Social and resident posts are not optional. Sales reps use these posts to understand how to proceed with a sale.

Social data helps answer:

- What are residents complaining about?
- What should the rep avoid mentioning?
- Is there pain around gates, access, cameras, internet, cable, packages, safety, or maintenance?
- What language should the rep use on a cold call?

## Evidence Rules

For required facts, ARIA should show:

```text
Finding
Confidence
Evidence snippet
Source
```

Example:

```text
Gate / Access: Likely yes
Confidence: 82%
Evidence: Resident review mentioned key fob and garage access issues
Source: Google Reviews
```

## Memory and Dedupe

ARIA should not waste money researching the same site repeatedly.

Before a full search:

```text
Check aria_properties
Check recent aria_search_runs
Check active lead / site / opportunity
```

Then choose:

```text
Use existing intel
Refresh missing fields only
Run full research
```

Once a site is found, it should be stored. Future searches should use stored data plus refresh missing or stale facts.

## 60-Day Pool Rule

Leads or recent searches should remain in the owner/user database for 60 days with no activity. If not converted or worked, they should return to the general searchable pool.

This should be distinct from persistent ARIA property memory:

```text
aria_properties = persistent intel, never deleted
aria_searches / lead pool claim = user/org ownership window
claim_expires_at = now + 60 days
```

## Nexus Handoff

ARIA should be able to hand off to Growth Workflow.

Future button:

```text
Create Lead
```

Payload should include:

- contact_name
- company_name / property_name
- phone
- email
- address / location
- unit_count
- property_type
- source = aria
- ARIA summary
- social post summary
- proptech summary
- aria_search_run_id
- aria_property_id

Expected result:

```text
Create Lead
↓
Lead Glass Window opens
↓
ARIA summary is attached
```

## UI Direction

ARIA should stay at `/aria` for now.

The global portal sidebar should be removed from ARIA so users stay focused.

Eventually ARIA should look like a Nexus research cockpit:

- Search target
- Research quality
- Call recommendation
- Who to call
- What to say
- What was found
- What is missing
- Evidence
- Create Lead
- Send to Scout

## Build Stages

### ARIA-1A — Minimum Payload + Focused Workspace

- Remove global portal sidebar/chrome from `/aria`
- Add minimum payload config
- Create reference plan doc

### ARIA-1B — Research Quality API

- Add `research_quality` to deep research response
- Determine found/missing/unknown facts from existing result payload
- Mark result complete / partial / failed
- Add charge recommendation only, not actual billing

### ARIA-1C — Research Quality UI

- Add top Research Quality card in `/aria`
- Show found, missing, unknown
- Show good enough to call / create lead
- Show full credit / partial / no charge recommendation

### ARIA-2 — Create Lead from ARIA

- Add Create Lead button
- Send ARIA property/contact summary to Growth lead creation endpoint
- Open Lead Glass Window

### ARIA-3 — Evidence Drawer

- Display evidence packets for required facts
- Show source URL, snippet, confidence, and phase found

### ARIA-4 — Memory / Refresh Missing Only

- Check persistent property memory first
- Use cached data when fresh
- Refresh only missing or stale facts
- Add 60-day claim/ownership model

### ARIA-5 — Paid Credits

- Add feature gating
- Add credit ledger
- Add preflight cost estimate
- Add charge only when result is complete or accepted partial

### ARIA-6 — Scout Handoff

- Send result to Scout
- Build 90-day outreach plan
- Sync activity back to lead timeline
