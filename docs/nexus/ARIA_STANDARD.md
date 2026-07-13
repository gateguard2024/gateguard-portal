# ARIA Standard — the over-standard for multifamily proptech prospecting

> The bar: **Apollo + Seamless** (find + verified contacts) · **Gong** (deal
> intelligence) · **HubSpot** (pipeline + one timeline). We beat it by being
> vertical: a multifamily property is always the same shape, so we can guarantee
> a **complete, standardized record every time** — something horizontal tools
> structurally cannot.

## The record (single source, same shape for every site)
Canonical `aria_properties.facts` (Data In) + `deductions` (Data Out) — migration 148.
Every field is always attempted; missing = `"No data found"`, never blank.

- **facts.property** — name, address, city, state, units, year_built, occupancy,
  property_type, class, phone, website, management_company, owner_entity, last_sale, lat, lng
- **facts.connectivity** — isp_providers[], video_providers[], bulk_agreements[], roe_detected, roe_expiry_year, fcc_verified
- **facts.proptech_found** — gate_operators[], access_control[], intercoms[], cameras[], smart_locks[], resident_apps[], package_solutions[], tech_generation
- **facts.decision_makers[]** — name, title, company, role_type, email, phone, linkedin (verified + confidence)
- **facts.community_posts[]** — topic-tagged social (internet/video/camera/gate/access/smart-rent/package)
- **deductions.ai_intel** — key_finding, buying_trends, behavioral_profile, primary_concern, buy_score, urgency
- **deductions.scout** — scout_brief, pitch_strategy, outreach_plan (6-mo), outreach_sequence
- **deductions.proptech_inferred[]** — { category, name, confidence_pct, reason }

## Capabilities vs the standard

| Bar (who) | ARIA answer |
|---|---|
| 230M+ contacts, filters, enrichment (Apollo) | Standardized property record + DM chain with verified email/phone + **confidence %** + source |
| Always-fresh 100+ data points (Seamless) | Same ~40 fields on every property, refreshed on re-research, freshness timestamp, "No data found" not blank |
| AI deal score + risk flags (Gong) | **Buy score 1–10** + deterministic **trigger flags** ("Bulk locked — needs expiry", "ROE expires 2026", "Recent acquisition — capex open", "Gate complaints in reviews") |
| Pipeline + one timeline (HubSpot) | Lead/property → stages → one `crm_activities` timeline; SCOUT = the sequencer |
| Advanced segmentation (Apollo) | Filters on multifamily fields: units, class, has-gate, bulk Y/N, contract expiring before YYYY |

## DM / contactability score (1–10)
- 1–3: property phone found · 3–5: onsite manager named · 5–7: senior mgmt · 7–9: ownership/entity · 9–10: full chain (phone + onsite + mgmt + ownership)
- Shown as a badge on every contact + property.

## UX model (Zillow/apartments.com)
1. **Find** — one word (Properties/Listings/Contacts) + area → lightweight results (name · units · location · matched keywords) in **Map or List**.
2. **Property** — view-first: researched = instant report; new = one "Research this property". Standardized report = facts + deductions, confidence-badged.
3. **Act** — tick cards → **Add to Leads / Research**; from a property → Add to Lead / Research / (SCOUT sequence).

Everything measures against this doc.
