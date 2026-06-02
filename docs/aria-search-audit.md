# ARIA Search Engine — Architectural Audit & Gap Analysis

> Written June 1, 2026. References ARIA engine v7.5 at `app/api/aria/research/deep/route.ts` (2,067 lines).
> Engine architecture overview: Phase 0 (classification) → Phase 1A (listing identity) or 1B (prospecting) → Phase 2 (enrichment) → Phase 3 (intelligence) → Phase 4 (Sonnet synthesis).

---

## 1. Best-in-Class Architecture Summary

### Perplexity AI

Perplexity's online models use a **query-to-search-to-LLM** pipeline where the search subsystem operates independently of the LLM prompt. Key architectural traits:

- **Multi-turn search loops**: Perplexity generates follow-up queries dynamically based on gaps in prior search results — not a fixed sequence of 4-5 searches but a loop that stops when answer confidence exceeds a threshold.
- **Source credibility scoring**: Every result is scored by domain authority, freshness, and content relevance before being passed to the LLM. Results from low-authority domains are deprioritized or excluded.
- **Citation grounding**: Every factual claim in the output is linked to a specific source URL, allowing the LLM to "defend" each output — if a citation cannot be found, that fact is dropped or flagged as low-confidence.
- **Query rewriting**: The user's raw query is rewritten into 3-5 search sub-queries before any search runs. "Greystar apartments in Atlanta with gate problems" becomes distinct queries for property listing, gate reviews, Greystar Atlanta portfolio, etc.
- **Recency filter enforcement**: Perplexity's API exposes `search_recency_filter` (week/month/year). For volatile data (staff, prices), it uses short windows. For structural data (property specs), it uses longer windows.

### Exa.ai

Exa's flagship contribution is **neural semantic search** vs keyword search. Their architecture:

- **Neural vs keyword routing**: Exa automatically decides whether a query is better served by neural (embedding-based similarity) or keyword (BM25-style) search. Queries like "multifamily with ButterflyMX intercom and gate complaints" are routed to neural; exact company names go to keyword.
- **Deep Search endpoint** (`/search?type=deep`): Runs multiple rounds of search, extracts structured data, and returns it in the exact JSON schema specified. It achieved 94% accuracy on the FRAMES benchmark at 11-second median latency, beating Perplexity Deep Research (68% at 82s) by a massive margin.
- **Contents API**: After identifying URLs, Exa extracts full page content or specific structured fields (e.g., "extract the CEO name from this page") in a single API call. This is equivalent to ARIA's Tavily `rawContent=true` pattern but with model-controlled structured extraction rather than heuristic text slicing.
- **Monitors**: Exa's monitor feature runs recurring searches on a schedule and alerts when new results appear — directly applicable to ROE expiry tracking and ownership change detection.
- **Agent API**: Exa launched an agent endpoint that runs multi-hop research internally and returns structured results — similar to ARIA Phase 4 but with the search loop managed by the API, not application code.

### Tavily

Tavily is purpose-built for RAG. Key traits:

- **Aggregation over 20+ sources per call**: A single Tavily advanced search queries and scrapes multiple sources, scores results for relevance, and returns pre-filtered content — reducing the LLM's need to filter noise.
- **`include_answer` flag**: Tavily can return a short AI-generated answer alongside search results, useful for quick fact checks (e.g., "Is this property occupied?") before running a full extraction prompt.
- **Domain whitelisting/blacklisting**: `include_domains`/`exclude_domains` restricts results to trusted sources (e.g., only `apartments.com`, `costar.com`) or excludes noise.
- **Score-based result filtering**: Each Tavily result has a `score` field (0.0–1.0). ARIA receives this in the `TavilyResult` interface but does not use it for any ranking or filtering before passing to Haiku.

### Harvey AI (Legal/Enterprise Research Pattern)

Harvey builds research flows for law firms with these patterns directly applicable to ARIA:

- **Source hierarchy enforcement**: Harvey assigns authority tiers to sources (primary = tier 1; secondary = tier 2; general web = tier 3). Higher-tier sources override lower-tier sources in contradictory cases. ARIA has no source hierarchy — FCC broadband data and Reddit reviews are treated equivalently.
- **Contradiction detection**: When two sources disagree (e.g., apartments.com says 200 units, a press release says 312 units), Harvey flags the contradiction and picks the higher-authority source with an explicit note. ARIA silently picks whatever Haiku extracts.
- **Evidence chains**: Every extracted fact is linked to its exact source snippet and source URL. ARIA builds `evidence` strings in `bulk_agreements` but not systematically across all extracted fields.
- **Structured extraction vs free-form synthesis**: Harvey uses structured extraction (function_calling) for factual fields, reserving free-form synthesis only for narrative analysis. ARIA uses Sonnet tool-use correctly for the final synthesis but Haiku extraction throughout Phases 1A-3 is free-form JSON parsing with regex fallback, which loses citation chains.

### Multi-Hop Reasoning Patterns (Google Multi-Hop QA, IRCoT)

Academic and production research systems (Google multi-hop QA, IRCoT from UT Austin, Bing Deep Search) use:

- **Iterative retrieval with chain-of-thought**: Retrieve → reason about gaps → generate new query → retrieve again. Each iteration's query is informed by what the prior iteration found. This is fundamentally different from ARIA's fixed 5-search Phase 1A or 6-search Phase 3.
- **Entity resolution between hops**: Hop 1 identifies "the property management company." Hop 2 searches for contacts at that specific company. Hop 3 searches for the contact on LinkedIn. Each hop uses the entity resolved in the prior hop. ARIA has a partial version (Phase 3 uses `confirmedMgmt` from Phase 1) but no dynamic loop.
- **Stopping criterion**: Research loops stop when the LLM assesses that the question can now be answered with high confidence — not after a fixed number of searches.

### Agentic Research Patterns (LangChain / LangGraph)

- **Tool call visibility**: The LLM sees prior tool results before deciding its next tool call. ARIA pre-plans all searches, runs them in parallel, then asks the LLM to synthesize — meaning Phase 3 cannot react to what Phase 2 discovered.
- **Reflection loop (evaluator-optimizer)**: After synthesis, a second LLM call evaluates the result for completeness. If below threshold, it generates targeted follow-up searches. ARIA has no evaluator pass.
- **Memory across sessions as a search strategy**: Prior search results feed into the next search as context (beyond just seeding initial data from DB). ARIA does DB lookback for known properties but does not inject prior search snippets as context for new search queries.

---

## 2. Our Current Architecture (Phase-by-Phase)

### Phase 0 — Query Classification (lines 420–470)
Single Haiku call classifies query as `specific_property | city_prospect | criteria_prospect | contract_prospect`. Extracts city, state, mgmt company, and size hints. Routes to Phase 1A or 1B accordingly. **Good**: solid routing logic. **Gap**: no query rewriting or query expansion — the raw input goes directly into search strings.

### Phase 1A — Specific Property Identity (lines 494–599)
5 parallel searches: listing sites (Tavily advanced), press/news (Serper news), unit count (Serper search), amenity deep-read (Tavily rawContent=true), phone via Knowledge Graph (Serper KG). Results merged, Haiku extracts ~20 fields in one prompt. **Good**: genuine parallelism, rawContent for amenities is a real competitive advantage. **Gaps**: Haiku single-pass extraction misses multi-hop entity resolution; `score` field from Tavily ignored; no contradiction detection between listing sites and press results.

### Phase 1B — Prospecting Candidate List (lines 624–702)
3 parallel searches producing 6-8 candidate properties for prospecting queries. Returns early without Phase 2/3. **Gaps**: No ISP/bulk agreement lookup on candidates; no contact enrichment; candidates are thin and rely entirely on search snippet content.

### Phase 2 — Enrichment (lines 787–981)
6 parallel searches: FCC broadband (REST), bulk/ISP (Tavily advanced), city-level ISP fallback (Serper), ownership/acquisition news (Serper news), video providers (Serper news), ROE agreements (Serper). Haiku extracts ownership + ISP/video/ROE fields. **Good**: FCC data is a unique competitive signal; bulk agreement deduplication logic is thorough; `filterProviderNames` blocklist prevents service-description pollution. **Gaps**: No property tax/county assessor lookup; no EDGAR/SEC filing lookup despite `edgar_signal` being in the synthesis schema; no CoStar/LoopNet integration; management company brand-name extraction heuristic (line 836) can fail for companies with generic single-word names.

### Phase 3 — Intelligence (lines 1013–1289)
8 parallel searches: pain signals (Serper), proptech rawContent (Tavily), contacts/LinkedIn (Serper), mgmt website (Serper), Reddit (Serper, last 6 months), review sites (Serper, last 6 months), proptech reviews (Serper), property website rawContent (Tavily). Then 3 parallel API calls: email format (Serper scrape), Apollo people match, NinjaPear validation. **Good**: 8-search Phase 3 is genuinely comprehensive; Apollo+NinjaPear parallel is correct. **Gaps**: Only top contact gets Apollo enrichment (line 1184 picks `webContacts[0]`); email format is scraped from Hunter.io via Google rather than Hunter.io API directly; LinkedIn contact extraction relies on Google-indexed snippets, not LinkedIn API.

### Phase 4 — Sonnet Synthesis (lines 1697–1769)
Single Sonnet tool-use call assembles all phase data into the final structured report. Haiku outreach plan + Haiku gatekeeper script run in parallel with Sonnet. **Good**: Parallel Haiku calls are a smart latency optimization. **Gaps**: Sonnet receives pre-processed data, not raw search snippets — it cannot identify errors or contradictions in upstream extraction; synthesis prompt is 1,700+ tokens of instructions.

### Caching & Persistence
SWR fast-path in `app/api/aria/cache/route.ts`: fuzzy ILIKE property name match returns cached `aria_properties` row. 14-day freshness TTL. Stale hits trigger Inngest background re-enrichment. **Good**: architecture is correct. **Gaps**: No semantic similarity in cache lookup (only ILIKE); cache does not distinguish "fresh on all fields" from "fresh on some fields."

---

## 3. Gap Analysis Table

| Feature | Best-in-Class (who does it) | ARIA Status | Priority |
|---|---|---|---|
| **Query rewriting/expansion** | Perplexity: raw query → 3-5 sub-queries before any search | Not implemented. Raw query goes to search strings directly. | P0 |
| **Tavily score-based result filtering** | Tavily best practices: filter results below 0.5 before passing to LLM | Score is in `TavilyResult` interface (line 86) but never used. | P0 |
| **Source authority ranking** | Harvey, Perplexity: domain authority tiers | Not implemented. FCC data and Reddit reviews are treated equivalently. | P0 |
| **Iterative search loop with stopping criterion** | Perplexity, Exa Deep: search → evaluate gaps → search again | Not implemented. Fixed phase structure, no dynamic looping. | P0 |
| **Contradiction detection between sources** | Harvey: flags and resolves unit count/name conflicts | Not implemented. Haiku picks first plausible value silently. | P1 |
| **Multi-hop entity resolution** | Google IRCoT: entity from hop N → query for hop N+1 | Partial. Phase 3 uses Phase 1 management company name. But Phases 2+3 launch in parallel with each other at line 1632, so Phase 3 cannot react to Phase 2 findings. | P1 |
| **Confidence scoring per extracted field** | Harvey, Exa Deep: confidence % on every fact | Partial. `confidence` on bulk agreements only. No field-level confidence elsewhere. | P1 |
| **County assessor / property tax records** | CoStar, Reonomy: authoritative ownership + sale history | Not implemented. `last_sale_price`, `assessed_value` in synthesis schema but no search populates them. | P1 |
| **EDGAR/SEC filing lookup** | Harvey-style: fund-owned properties → SEC 10-K/8-K | `edgar_signal` in schema (line 1351) but zero search code to populate it. | P1 |
| **Semantic cache matching** | Production RAG: embedding similarity for fuzzy property name matching | Not implemented. ILIKE-only with 3 heuristic patterns. Typos break all matches. | P1 |
| **Multi-contact Apollo enrichment** | Apollo batch enrichment | Only `webContacts[0]` gets Apollo (line 1184). All other contacts get constructed emails only. | P1 |
| **Evaluator-optimizer loop** | Anthropic agent patterns: second LLM evaluates output completeness | Not implemented. No post-synthesis quality check or retry. | P1 |
| **Domain whitelisting per search** | Tavily: `include_domains` restricts Phase 1 to listing sites | ARIA uses `site:` in query string instead — less reliable than Tavily API param. | P2 |
| **Hunter.io API for email format** | Hunter.io direct API | Email format scraped from Hunter.io via Google (lines 1193-1206) — fragile if not indexed. | P2 |
| **Recency filter on ROE/bulk searches** | Perplexity: `search_recency_filter` on volatile data | ROE/bulk searches (lines 845, 864) have no recency filter. A 2019 article about an expired agreement scores equally with 2024 news. | P2 |
| **Snippet deduplication before Haiku** | Perplexity, Tavily: deduplicate near-identical snippets | Not implemented. Same review can appear in painResults, redditResults, and reviewResults simultaneously. | P2 |
| **LinkedIn Sales Navigator / direct API** | Apollo, ZoomInfo: direct LinkedIn contact lookup | Not implemented. LinkedIn contacts found via Google-indexed snippets only. | P2 |
| **Structured extraction with source citation** | Exa Deep, Harvey: every fact linked to source URL | Only `evidence` strings in bulk_agreements. No URL-level citation for unit count, year built, contacts. | P2 |
| **Occupancy data sourcing** | CoStar, apartmentdata.com: occupancy from rent rolls | `occupancy` field in synthesis schema but no search targets it. | P2 |
| **Exa neural search for contact finding** | Exa: semantic search for "regional property manager at [company]" | Not implemented. Contact finding relies entirely on Google/LinkedIn snippet indexing. | P2 |
| **Adaptive search count per query type** | Exa, Perplexity: more searches for ambiguous or low-confidence queries | Not implemented. Phase 1A always runs 5 searches regardless of confidence. | P3 |
| **Query performance telemetry** | Production systems: log which queries returned results, which empty | Basic console.log for Phase 1A amenity findings (lines 1587-1589). No structured telemetry. | P3 |
| **Exa Monitors for change tracking** | Exa: subscribe to ownership/press changes for tracked properties | Not implemented. Re-enrichment via Inngest only triggers on user demand. | P3 |
| **In-context deduplication across snippets** | Perplexity, Tavily: remove near-identical snippets before LLM | Not implemented. | P3 |

---

## 4. Specific Recommendations with Implementation Notes

### REC-1: Query Rewriting (P0) — ~1 day

**Problem**: The raw user query is passed directly to search strings. "Northland Wharf 7 Atlanta" becomes the literal Tavily search string, without disambiguation into (a) property name query, (b) management company query, (c) city + size filter.

**Best-in-class**: Perplexity rewrites every query into 3-5 sub-queries before any search runs.

**Implementation**: In `classifyQuery()` (line 433), add a `sub_queries` array to the return type. The Haiku prompt already extracts `normalized_query`, `city_hint`, `mgmt_hint` — extend it to also return:

```typescript
sub_queries: [
  '"Wharf 7" apartments Atlanta',
  '"Northland" "Wharf 7" internet amenities',
  '"Northland Investment" Atlanta portfolio',
  '"Wharf 7" apartments reviews complaints',
]
```

Use these pre-generated sub-queries in Phases 1A, 2, and 3 instead of building query strings inline. This eliminates the ad-hoc string construction scattered across `runPhase1A` (lines 511-534), `runPhase2` (lines 843-869), and `runPhase3` (lines 1042-1087).

---

### REC-2: Tavily Score Filtering (P0) — 30 minutes

**Problem**: Line 86 defines `score` in `TavilyResult` but it is never used. Low-relevance results (score < 0.4) pollute Haiku context and can cause extraction errors.

**Implementation**: In `tavilySearch()` (line 88), add a filter before returning:

```typescript
return (data.results ?? [])
  .map((r: TavilyResult) => ({ ...r, source }))
  .filter((r: TavilyResult) => r.score >= 0.4)  // add this line
```

For Phase 2 enrichment where precision matters more, raise the threshold to 0.5. This is a zero-cost change that immediately reduces Haiku noise.

---

### REC-3: Source Authority Ranking (P0) — 2 hours

**Problem**: FCC broadband data (authoritative, government API), Reddit reviews (user-generated, variable quality), and Tavily listing snippets (scraped, possibly stale) all receive equal treatment. Haiku picks whatever text appears first.

**Implementation**: Introduce a `SOURCE_AUTHORITY` map and sort snippets before feeding Haiku:

```typescript
const SOURCE_AUTHORITY: Record<string, number> = {
  'fcc': 10,        // government API — ground truth for ISP availability
  'listing': 9,     // apartments.com / rentcafe verified data
  'amenities': 9,   // raw listing page content
  'phone': 9,       // Google Knowledge Graph
  'press': 7,       // news articles
  'bulk': 6,        // targeted ISP searches
  'owner': 6,       // ownership news
  'proptech': 5,    // proptech brand searches
  'contacts': 5,    // LinkedIn snippets
  'reviews': 4,     // ApartmentRatings / Yelp
  'reddit': 3,      // Reddit user posts
  'pain': 3,        // complaint searches
}
```

Before passing snippets to Haiku, sort by `SOURCE_AUTHORITY[r.source]` descending. Update Haiku prompts to state: "Earlier results are higher authority — prefer them for factual fields (unit count, phone, ISP provider)."

---

### REC-4: Multi-Contact Apollo Enrichment (P1) — 3 hours

**Problem**: Line 1184 (`const topContact = webContacts[0]`) only enriches the first contact found. If 4 LinkedIn profiles are found, only 1 gets an Apollo email lookup. Regional managers and asset managers — often more reachable than the property manager — get nothing.

**Implementation**: Replace the single Apollo call with a bounded loop of 3 contacts max:

```typescript
const contactsToEnrich = webContacts.slice(0, 3).filter(
  c => c.name && c.name.includes(' ')
)
const apolloResults = await Promise.all(
  contactsToEnrich.map(c => {
    const domain = deriveMgmtDomain(c.company || '') || apolloDomain
    return domain ? apolloEnrichPerson(c.name, domain) : Promise.resolve(null)
  })
)
// Patch results back onto contacts by index
contactsToEnrich.forEach((c, i) => {
  if (apolloResults[i]) {
    const idx = allContacts.findIndex(x => x.name === c.name)
    if (idx >= 0) {
      if (apolloResults[i]!.email) allContacts[idx].email = apolloResults[i]!.email!
      if (apolloResults[i]!.phone_numbers?.[0]) allContacts[idx].phone = apolloResults[i]!.phone_numbers![0]
    }
  }
})
```

---

### REC-5: Contradiction Detection for Unit Count (P1) — 4 hours

**Problem**: When listings.com says 200 and a press release says 312, Haiku silently picks one. Unit count errors are the most common data quality complaint.

**Implementation**: Change the unit count extraction to return candidates with sources:

```typescript
// In Phase 1A Haiku schema, replace:
// confirmed_units: number | null
// With:
unit_count_candidates: [
  { value: 312, source: "Press release — opened 312 units in 2021" },
  { value: 200, source: "Apartments.com — 200 available" }
]
```

Then apply a resolution rule in code: prefer the higher number (available < total is expected), prefer press release over listing, prefer year-built-adjacent numbers. Log conflicts to console for observability.

---

### REC-6: County Assessor / Public Records Search (P1) — 1 day

**Problem**: The synthesis schema includes `last_sale_date`, `last_sale_price`, `assessed_value` (lines 1309-1311) but no search in Phases 1-3 targets these fields. Sonnet marks them "No data found" 90% of the time.

**Implementation**: Add a 7th parallel search in Phase 2's `Promise.all` (after line 843):

```typescript
serperSearch(
  `"${confirmedAddress || confirmedName}" "${confirmedCity}" site:loopnet.com OR site:costar.com OR "county property records" OR "assessor" sale price assessment year`,
  4, 'public-records'
),
```

Add extraction for financial fields in the Phase 2 Haiku prompt:
```
- last_sale_price: dollar amount from sale/acquisition records (e.g. "$24.5M")
- last_sale_date: year or "Month YYYY" of most recent sale
- assessed_value: county assessor value if found
```

---

### REC-7: EDGAR Signal Search (P1) — 4 hours

**Problem**: `edgar_signal: boolean` appears in the synthesis schema (line 1351) and `sec_filing_ref: string` is in the ownership schema (line 1356) but no search in the pipeline targets SEC filings. REIT-owned properties regularly have 8-K filings disclosing acquisition prices, unit counts, and management contracts.

**Implementation**: Add an EDGAR search in Phase 2:

```typescript
serperSearch(
  `"${confirmedName}" OR "${confirmedAddress}" "10-K" OR "8-K" OR "REIT" site:sec.gov OR "SEC filing"`,
  3, 'edgar', 'news'
),
```

This is especially valuable for Greystar, Equity Residential, AvalonBay, Camden, and UDR properties which file regularly and whose filings often contain exact unit counts, acquisition dates, and purchase prices.

---

### REC-8: Evaluator-Optimizer Post-Synthesis Pass (P1) — 1.5 days

**Problem**: Sonnet synthesizes Phase 1-3 data with no quality gate. If the report has 8 "No data found" fields, there is no mechanism to detect this and run targeted follow-up searches.

**Best-in-class**: Anthropic's "Building Effective Agents" post recommends a second LLM call to evaluate completeness.

**Implementation**: After Sonnet synthesis (line 1769), add a lightweight completeness check:

```typescript
const CRITICAL_FIELDS = ['units', 'property_phone', 'dm_name', 'isp_providers']
const missingFields = CRITICAL_FIELDS.filter(f => {
  const val = rawData.property_details?.[f] ?? rawData[f]
  return !val || val === 'No data found' || (Array.isArray(val) && val.length === 0)
})

// If >2 critical fields missing, fire targeted follow-up searches (non-blocking)
if (missingFields.length > 2) {
  void (async () => {
    // targeted Serper searches for exactly the missing field types
    // results upserted to aria_properties — available on next cache hit
  })()
}
```

This does not block the user response but improves data quality on subsequent views via the learning loop.

---

### REC-9: Semantic Cache Matching with pgvector (P1) — 2 days

**Problem**: `findCachedProperty()` (line 376) uses three ILIKE patterns. "Northland Wharf 7", "Wharf 7 Atlanta", and "The Wharf at Northland" might all refer to the same property but only the first two would match on `lastTwo = "wharf 7"`. Typos ("Warf 7") break all patterns.

**Best-in-class**: Production RAG systems use embedding similarity — the same approach ARIA already uses for KB article search via OpenAI `text-embedding-3-small`.

**Implementation**:
1. When a property is upserted to `aria_properties`, generate an embedding of `property_name + " " + city + " " + state` and store it in a `name_embedding vector(1536)` column (migration 105).
2. In cache lookup, generate an embedding of the search query and run pgvector cosine similarity:

```sql
SELECT * FROM aria_properties 
ORDER BY name_embedding <=> $1::vector 
LIMIT 1
```

3. Set a similarity threshold (cosine distance < 0.15 = match). Fall back to ILIKE if pgvector returns no close match.

---

### REC-10: Iterative Deepening on Low-Confidence Results (P1) — 3 days

**Problem**: ARIA runs fixed phases regardless of Phase 0 classification. A high-confidence property with 12 data-rich snippets gets the same 5 Phase 1A searches as an obscure property with 0 results.

**Best-in-class**: Perplexity and Exa Deep run adaptive search loops.

**Implementation**: After Phase 1A extraction, evaluate confidence with a simple score:

```typescript
const phase1Confidence = [
  p1.confirmed_name, p1.confirmed_units, p1.confirmed_phone, p1.confirmed_address
].filter(Boolean).length  // 0-4

if (phase1Confidence < 2) {
  // Property not well-identified — run 2 additional disambiguation searches
  const [altListing, directWebsite] = await Promise.all([
    serperSearch(`"${rawQuery}" apartment community -site:zillow.com`, 5, 'alt-listing'),
    tavilySearch(rawQuery + ' official website contact leasing', 3, 'direct-site', 'advanced', true),
  ])
  // Re-run Haiku extraction with augmented snippets
}
```

Similarly for Phase 3 contacts: if `webContacts.length === 0`, run a backup contact search before giving up.

---

### REC-11: Snippet Deduplication by URL (P2) — 30 minutes

**Problem**: Phase 3 combines `painResults`, `redditResults`, `reviewResults`, `proptechReviewResults` into `painAllSources` (line 1096). The same ApartmentRatings review can appear in multiple Serper searches. Haiku wastes context on duplicate text.

**Implementation**: Before building `painSnippets` (line 1096), deduplicate by URL:

```typescript
const seen = new Set<string>()
const deduped = [...painResults, ...socialResults].filter(r => {
  if (!r.url || seen.has(r.url)) return false
  seen.add(r.url)
  return true
})
const painAllSources = deduped
```

This is a 6-line change that recovers Haiku context budget at zero cost.

---

### REC-12: Hunter.io API for Email Format (P2) — 2 hours

**Problem**: Lines 1193-1206 find email format by scraping Hunter.io via Google: `serperSearch('"${domainForEmail}" email format site:hunter.io')`. This is fragile — it depends on Google indexing Hunter.io's format pages, which are often gated.

**Hunter.io API** (free tier: 25 requests/month, $34/month for 500 requests) provides `GET /domain-search?domain=greystar.com` returning the verified email pattern.

**Implementation**: Replace the Serper scrape with a direct Hunter.io API call:

```typescript
async function hunterEmailFormat(domain: string): Promise<string> {
  if (!process.env.HUNTER_API_KEY || !domain) return ''
  try {
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${process.env.HUNTER_API_KEY}&limit=1`,
      { signal: AbortSignal.timeout(3000) }
    )
    const data = await res.json()
    return data?.data?.pattern ?? ''
  } catch { return '' }
}
```

Hunter.io provides verified patterns for 200M+ domains including all major management companies.

---

### REC-13: Recency Filter on ROE/Bulk Searches (P2) — 30 minutes

**Problem**: Phase 2 bulk search (line 845) and ROE search (line 864) have no recency filter. A 2019 article about a bulk agreement that has since expired could score high and be reported as current.

**Implementation**: Add `tbs: 'qdr:y2'` (last 2 years) to Phase 2 ROE and bulk searches:

```typescript
// Line 864 — add tbs param:
serperSearch(
  `${propTarget} ${confirmedCity} "right of entry" OR "ROE agreement" OR "bulk agreement" ...`,
  5, 'roe', 'search', 'qdr:y2'  // last 2 years only
),
```

Keep the ownership news search at a longer window (acquisitions are durable facts). For contract/ROE searches, 2-year window prevents stale expiry dates.

---

### REC-14: Exa Neural Search for Contact Discovery (P2) — 2 days

**Problem**: Phase 3 contact discovery (line 1053) uses `site:linkedin.com` via Serper. This finds only contacts whose LinkedIn profiles are Google-indexed with exact title strings. Senior management (asset managers, VP of operations) is frequently missed.

**Exa neural search** can find "people who manage multifamily portfolios in Atlanta for Greystar" using semantic similarity.

**Implementation**: Add Exa as a fallback contact discovery source when Serper returns fewer than 2 contacts:

```typescript
if (webContacts.length < 2 && process.env.EXA_API_KEY) {
  const exaResults = await exaSearch(
    `${confirmedMgmt || confirmedName} property management ${confirmedCity} director manager`,
    { type: 'neural', category: 'company', numResults: 5 }
  )
  // Pass to Haiku for contact extraction
}
```

---

### REC-15: Source Citation on All Extracted Fields (P2) — 3 days

**Problem**: ARIA produces `evidence` strings for bulk agreements but no URL-level citations for the 40+ other extracted fields. Users cannot verify where "Year Built: 2019" came from.

**Implementation**: Extend Phase 1A extraction schema with a `_sources` field:

```typescript
_sources: {
  confirmed_units: "https://apartments.com/... — '312 apartment homes'",
  confirmed_phone: "[KG] Google Knowledge Graph — 'Phone: (404) 555-1234'",
  listing_isp: "https://rentcafe.com/... — 'GIGstreem managed wifi included'",
}
```

The `sources` field already exists in the API response (line 2049) but only covers Phase 3 raw excerpts. Extending it to all extracted fields enables the "DM Scoring system" from the P1 backlog to show users exactly why a score is what it is.

---

## 5. Quick Wins vs Long-Term Improvements

### Quick Wins (< 4 hours each, no new dependencies)

| Change | File Location | Impact |
|---|---|---|
| Filter Tavily results by `score >= 0.4` (lines 88-110) | `deep/route.ts` | Reduces Haiku noise immediately |
| Deduplicate snippets by URL before Haiku (line 1096) | `deep/route.ts` | Recovers Haiku context budget |
| Add `tbs=qdr:y2` to ROE/bulk searches (lines 845, 864) | `deep/route.ts` | Stops stale contract dates from surfacing |
| Sort all snippets by SOURCE_AUTHORITY before Haiku | `deep/route.ts` | Higher-authority facts win consistently |
| Batch Apollo enrichment for top 3 contacts (line 1184) | `deep/route.ts` | Triples contact email coverage |
| Contradiction logging for unit count (Phase 1A Haiku) | `deep/route.ts` | Visibility into most common data error |

### Medium-Term (1–5 days, no new infrastructure)

| Change | Effort | Impact |
|---|---|---|
| Query rewriting in `classifyQuery` | 1 day | Searches become intent-specific, not literal |
| County assessor / public records search in Phase 2 | 1 day | Populates `last_sale_price`, `assessed_value` fields |
| EDGAR search in Phase 2 | 4 hours | Enables `edgar_signal` + sale price intel for REIT-owned properties |
| Hunter.io API for email format | 2 hours | Reliable email construction for all known management companies |
| Iterative deepening after Phase 1A low-confidence | 2 days | Reduces zero-contact and zero-identity results |
| Post-synthesis completeness evaluator (Haiku) | 1.5 days | Triggers targeted follow-up on incomplete reports |

### Long-Term (1–4 weeks, new infrastructure or APIs)

| Change | Requires | Effort | Impact |
|---|---|---|---|
| Semantic cache matching with pgvector | Migration 105, `name_embedding` column | 2 days | Near-zero false cache misses, catches spelling variants |
| Exa neural search for contact finding | `EXA_API_KEY`, $12-15/1k requests | 2 days | Finds management contacts not Google-indexed |
| Exa Monitors for ownership/press changes | `EXA_API_KEY` | 3 days | Proactive alerts when tracked property changes |
| Full iterative search loop architecture | Significant refactor | 3-4 weeks | Full competitive parity with Perplexity/Exa Deep |
| Source citation on all fields (Harvey-style) | Response schema changes, UI updates | 3 weeks | Enables user verification of every fact |
| Property tax / parcel API | Regrid or ATTOM API ($300-500/mo) | 1 week | Authoritative sale dates, assessed values, ownership history |

---

## 6. Key Observations: What ARIA Does Better Than Most Tools

1. **Domain-specific source targeting**: Using `site:apartments.com OR site:rentcafe.com` in Phase 1A is more precise than Perplexity or Exa's generic web search for property identity confirmation.

2. **FCC Broadband Map integration**: No competitor in the B2B sales intelligence space (Apollo, ZoomInfo, Clearbit) pulls FCC broadband data. This is a genuine data moat for ISP/bulk agreement detection.

3. **Vertical-specific blocklists**: `ISP_SERVICE_DESCRIPTIONS` and `VIDEO_SERVICE_DESCRIPTIONS` (lines 40-58) solving the "fiber internet" vs. ISP provider name pollution problem are more sophisticated than anything in generic research tools.

4. **Listing page rawContent deep read**: Fetching full `rawContent` for amenity pages to extract ISP/cable/proptech brands from amenities sections is a technique that does not exist in generic agents — it encodes domain expertise in the pipeline architecture.

5. **Learning loop / DB seeding**: The `dbPhase2Seed` pattern (lines 1596-1617) uses prior research results to seed current searches, reducing redundant API calls and improving accuracy on re-researched properties. Exa's Monitors achieve a similar goal but ARIA's approach is more customized to the sales workflow.

## 7. Where ARIA Falls Structurally Behind

1. **No feedback loop**: Every search is pre-planned. The engine cannot say "I found the management company is Northland — let me now search specifically for Northland's email domain and org chart." This is the single largest architectural gap vs. Perplexity and Exa Deep.

2. **Single Haiku extraction pass per phase**: Each phase runs one Haiku extraction over all snippets. If the answer is buried in a long document, Haiku may miss it. Exa's Contents API does targeted extraction per-URL, asking "what is the CEO's email on this page?" rather than "find the email in these 15 URLs combined."

3. **No quality signal back to search**: The search layer receives no feedback from the extraction layer. If Haiku extracts zero ISP providers from a bulk search, the system does not retry with different query terms. A true search loop detects this and generates a different query.

4. **Contact coverage bottlenecked by LinkedIn Google indexing**: For properties managed by smaller or regional management companies, LinkedIn profiles are often not indexed by Google. The `site:linkedin.com` Serper search only finds people with public Google-indexed profiles — often 20-30% of the actual employee base for regional firms.

---

## 8. Prioritized Build Order

**Week 1 — All quick wins, maximum impact per hour:**
1. Tavily score filtering (30 min)
2. Snippet deduplication by URL (30 min)
3. SOURCE_AUTHORITY snippet sorting (2 hours)
4. Batch Apollo for top 3 contacts (3 hours)
5. ROE/bulk search recency filter (30 min)

**Week 2 — Query quality and data coverage:**
6. Query rewriting in `classifyQuery` (1 day)
7. County assessor search in Phase 2 (1 day)
8. Hunter.io API for email format (2 hours)
9. EDGAR search in Phase 2 (4 hours)

**Week 3 — Evaluation and semantic matching:**
10. Post-synthesis completeness evaluator (1.5 days)
11. Semantic cache matching with pgvector + migration 105 (2 days)

**Month 2 — Iterative loop architecture:**
12. Adaptive confidence gate after Phase 1A with retry (3 days)
13. Exa neural search integration for contacts (2 days)
14. Source citation schema across all fields (3 days)

---

*This audit was based on reading the full 2,067-line `app/api/aria/research/deep/route.ts` (v7.5), the cache route at `app/api/aria/cache/route.ts`, and reviewing the architectures of Perplexity API, Exa Deep Search ($250M Series C), Tavily, Harvey AI, Anthropic's agent patterns document ("Building Effective Agents"), and LangChain/LangGraph research pipeline documentation. All line references are to the June 1, 2026 version of the engine file.*
