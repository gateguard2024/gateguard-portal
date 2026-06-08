# Dealer Hierarchy and Permissions Model

This document is the source of truth for dealer onboarding, platform users, feature settings, compliance, and downstream access rules.

The product rule is simple:

> A user, dealer, or sub-dealer can never be given more access than the parent organization has.

The UX rule is also simple:

> A 5th grader should understand who they are adding, what that person can do, and what still needs to be completed before access is live.

---

## 1. Current Source-of-Truth Systems

The platform currently uses several access systems. The direction is to standardize them.

### Clerk publicMetadata

Used for identity context and coarse app access.

Required fields:

```json
{
  "org_id": "<supabase organizations.id>",
  "org_tier": "full_dealer",
  "role": "dealer"
}
```

Clerk should remain the identity source and should not become the long-term home for granular permissions.

### Supabase organizations

Used for hierarchy.

Important fields:

```txt
organizations.id
organizations.name
organizations.org_tier
organizations.parent_org_id
organizations.is_active
organizations.onboarding_complete
organizations.onboarded_at
```

### feature_catalog

Global feature list and tier defaults.

Access levels:

```txt
none
view
edit
```

### org_feature_flags

Org-level feature overrides.

### user_feature_access

User-specific access overrides.

The user's effective access must always be capped by the org's access.

```txt
effective_user_access = min(org_access, user_override || org_access)
```

---

## 2. Organization Hierarchy

Recommended hierarchy:

```txt
GateGuard Corporate
  ├── Master Agent
  │     └── Recruits / oversees assigned dealer network
  │
  ├── MSO / Master Dealer
  │     ├── Full Dealer
  │     ├── Service Dealer
  │     ├── Install Contractor
  │     └── Sales Partner
  │
  ├── Full Dealer
  │     ├── Internal users
  │     ├── Reps
  │     ├── Techs
  │     └── Subcontractors if enabled
  │
  ├── Service Dealer
  │     ├── Service users
  │     └── Techs
  │
  ├── Install Contractor
  │     └── Install users / techs only
  │
  ├── Sales Partner
  │     └── Sales reps only
  │
  └── Client
        └── Customer / property portal only
```

Database values:

```txt
corporate
master_agent
master_dealer
full_dealer
service_dealer
install_contractor
sales_partner
client
```

UI label recommendation:

```txt
master_dealer = MSO / Master Dealer
```

Use `master_dealer` in database and APIs. Use `MSO` or `MSO / Master Dealer` in user-facing UI.

---

## 3. Who Can Create Whom

### GateGuard Corporate

Can create and manage everything:

```txt
Master Agent
MSO / Master Dealer
Full Dealer
Service Dealer
Install Contractor
Sales Partner
Client
Internal corporate users
```

### Master Agent

Recommended ability:

```txt
Can nominate or create assigned dealer network if Corporate enables it.
Can manage only descendants.
Cannot create Corporate users.
Cannot grant admin access above their own access.
```

Allowed child orgs if enabled:

```txt
MSO / Master Dealer
Full Dealer
Sales Partner
```

### MSO / Master Dealer

Recommended ability:

```txt
Can create/manage child dealer network under itself.
Can manage only descendants.
Cannot create Corporate users.
Cannot exceed its own feature access.
```

Allowed child orgs if enabled:

```txt
Full Dealer
Service Dealer
Install Contractor
Sales Partner
```

### Full Dealer

Recommended ability:

```txt
Can invite/manage users inside its own org.
Can create reps and techs.
Can create subcontractors only if feature enabled.
Cannot create full child dealers by default.
```

### Service Dealer

Recommended ability:

```txt
Can invite/manage service users and techs inside its own org.
Cannot create dealer orgs.
Cannot grant sales/billing/admin modules unless enabled.
```

### Install Contractor

Recommended ability:

```txt
Can invite/manage install users and techs inside its own org.
Cannot create dealer orgs.
```

### Sales Partner

Recommended ability:

```txt
Can invite/manage sales reps inside its own org if enabled.
Cannot create dealer orgs.
Cannot access jobs, dispatch, billing, or field tools by default.
```

### Client

Recommended ability:

```txt
Can only access customer/property portal views.
Cannot create users unless explicitly enabled for property managers later.
```

---

## 4. User Roles Inside an Org

Simple roles for UX:

```txt
Owner / Admin
Manager
User
Rep
Tech
Viewer
```

Existing code roles include:

```txt
admin
supervisor
agent
dealer
rep
client
```

Recommended mapping:

| UX Role | Code Role | Meaning |
|---|---|---|
| Owner / Admin | admin | Full access within org; can manage users/features inside allowed boundary |
| Manager | supervisor | Can manage work/users depending on feature access; no corporate settings |
| User | dealer / agent | Standard operational user |
| Rep | rep | Sales/pipeline only |
| Tech | dealer or technician record | Field/tech access only; may use tech code path depending on workflow |
| Viewer | client or viewer | Read-only / portal-limited |

---

## 5. Permission Rule

A user can only receive access that the parent org already has.

Plain English:

```txt
You cannot give away something you do not have.
```

Examples:

```txt
A Sales Partner cannot grant Dispatch.
A Service Dealer cannot grant CRM unless their org has CRM.
A Dealer Admin cannot make someone Corporate.
A Master Dealer cannot see unrelated downstream dealer data.
A Corporate Admin can override anything.
```

Technical rule:

```txt
requested_user_access <= org_access <= parent_org_access
```

When a parent org creates a child org:

```txt
child_org_feature_access <= parent_org_feature_access
```

When a user invites another user:

```txt
new_user_feature_access <= inviter_effective_access
```

---

## 6. Feature Access Model

Standardize on:

```txt
feature_catalog
org_feature_flags
user_feature_access
```

Use these levels only:

```txt
none
view
edit
```

Feature Settings controls tier defaults:

```txt
feature_catalog.tier_defaults
```

Dealer/Org detail controls org overrides:

```txt
org_feature_flags
```

Platform Users controls user-specific restrictions:

```txt
user_feature_access
```

Clerk public metadata should hold only:

```txt
org_id
org_tier
role
org_name
```

---

## 7. 5th-Grader User Permission Flow

Platform Users should not start with raw permission checkboxes.

Recommended flow:

```txt
Who are we adding?
↓
What job will they do?
↓
What should they see?
↓
What should they be able to change?
↓
Review access
↓
Send invite / update user
```

Default packages:

```txt
Admin
Manager
Sales Rep
Field Tech
Billing User
Viewer
```

Each package maps to feature access, but the UI should show plain labels.

Example:

```txt
Sales Rep
- Can see leads
- Can create leads
- Can work own quotes if enabled
- Cannot see billing
- Cannot see jobs
- Cannot invite users
```

---

## 8. Dealer Onboarding Flow

Existing flow is directionally correct:

```txt
Type
Org Info
NDA
Relationships
Commission
Agreement
Users
Compliance
Approve
```

Recommended 5th-grader wording:

```txt
1. What kind of partner is this?
2. Who is the company?
3. Send / complete NDA
4. Who are they connected to?
5. Set the money split
6. Send / complete agreement
7. Add first users
8. Collect required paperwork
9. Approve and turn on access
```

A dealer should not be activated until required onboarding steps are complete.

---

## 9. Signing Rules

Recommended rule:

```txt
NDA comes before Agreement.
Agreement comes before activation.
```

Current strict behavior is good for dealers/vendors.

Corporate override can be added later, but it should require:

```txt
reason
approver
timestamp
what was bypassed
```

Required signing records:

```txt
document_signatures.document_type = nda
document_signatures.document_type = dealer_agreement | service_agreement | install_partner_agreement | sales_partner_agreement | master_agent_agreement
```

---

## 10. Compliance Requirements by Tier

Recommended minimums:

### Sales Partner

```txt
NDA
Sales Partner Agreement
Admin user
```

### Master Agent

```txt
NDA
Master Agent Agreement
Admin user
W9
```

### MSO / Master Dealer

```txt
NDA
Dealer Agreement
Admin user
W9
COI if performing work
License if applicable
```

### Full Dealer

```txt
NDA
Dealer Agreement
Admin user
W9
COI
License if applicable
Background check acknowledgment
```

### Service Dealer

```txt
NDA
Service Agreement
Admin user
W9
COI
License if applicable
Background check acknowledgment
```

### Install Contractor

```txt
NDA
Install Partner Agreement
Admin user
W9
COI
License if applicable
Background check acknowledgment
```

---

## 11. Corporate Dealer Onboarding Command Center

Internal should include a Corporate board:

```txt
Internal → Dealer Onboarding
```

Buckets:

```txt
Draft
Needs NDA
NDA Sent
NDA Signed
Needs Agreement
Agreement Sent
Agreement Signed
Needs Compliance
Ready to Approve
Live Dealers
```

5th-grader flow:

```txt
Who are we onboarding?
↓
What is missing?
↓
What is the next action?
↓
Do it or assign it.
```

This should become the corporate office's main place to keep up with dealer onboarding.

---

## 12. Compliance Split

Current Compliance is mostly site/permit/COI oriented.

Recommended split:

```txt
Compliance
  ├── Property / Site Compliance
  └── Dealer / Vendor Compliance
```

Dealer / Vendor Compliance tracks:

```txt
NDA
Agreement
W9
COI
License
Background check
Insurance expiration
Training / certification
```

---

## 13. Build Plan From Here

### Phase 1 — Documentation / Lock Model

Create this document and use it as the reference for all hierarchy work.

### Phase 2 — Internal Dealer Onboarding Board

Build:

```txt
Internal → Dealer Onboarding
```

Use existing sources first:

```txt
organizations
document_signatures
partner_docs / compliance fields if present
```

### Phase 3 — Permission Guard Helpers

Create shared helpers:

```txt
canManageOrg(caller, targetOrg)
canCreateChildOrg(caller, targetTier)
canInviteUser(caller, targetOrg, targetRole)
canAssignFeature(callerFeatureAccess, requestedAccess)
```

### Phase 4 — Platform Users Redesign

Make Platform Users simple:

```txt
Choose user
Choose role
Choose access package
Review effective access
Send invite / update
```

Advanced toggles stay available but hidden behind an advanced mode.

### Phase 5 — Dealer Onboarding Wizard Cleanup

Improve wording and enforce hierarchy/permission guard helpers.

### Phase 6 — Dealer/Vendor Compliance Board

Add dealer/vendor compliance tracking and connect it to onboarding.

---

## 14. Open Decisions

These need final confirmation before enforcement code is built:

1. Can Master Agents create child orgs directly, or only nominate them for Corporate approval?
2. Can MSO / Master Dealers create all child partner types directly?
3. Can Full Dealers create subcontractors, or only internal users?
4. Should any non-corporate org be able to set feature access, or only user roles within already-enabled features?
5. Is NDA always required before agreement, with no exceptions?
6. Which compliance docs are hard blockers for each tier?
7. Should Platform Users remain visible to Dealer Admins, or should they get a simplified Dealer Team page?

Recommended default answers are documented above.
