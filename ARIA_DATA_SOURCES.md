# ARIA Data Sources & API Subscriptions

> Last updated: May 29, 2026 (session 7)
> Owner: Russel Feldman — rfeldman@gateguard.co
> Purpose: Track every external API, subscription, and data source powering the GateGuard portal.
> Do NOT publish this file or reference it in the UI. Internal reference only.

---

## Active Subscriptions

### 1. Anthropic (Claude)
- **Used for:** Claude Haiku (all KB / diagnostic / extraction calls), Claude Sonnet (ARIA synthesis)
- **Env var:** `ANTHROPIC_API_KEY`
- **Models:** `claude-haiku-4-5-20251001` (fast extraction), `claude-sonnet-4-6` (ARIA deep synthesis)
- **Pricing:** Pay per token. Haiku ~$0.00025/1K input. Sonnet ~$0.003/1K input.
- **Sign in:** console.anthropic.com
- **Notes:** Core dependency — every AI feature breaks without this key.

---

### 2. Tavily
- **Used for:** ARIA — listing sites, review scraping, ISP confirmation, proptech vendor searches
- **Env var:** `TAVILY_API_KEY`
- **Endpoint:** `https://api.tavily.com/search`
- **Auth:** `Authorization: Bearer {key}`
- **Pricing:** Free tier available. Paid plans from ~$10/mo. Advanced depth costs more per call.
- **Sign in:** tavily.com
- **Calls per ARIA search:** ~8–10 (mix of basic + advanced)
- **Notes:** Best for structured pages (listing sites, company sites). Worse than Serper for Reddit.

---

### 3. Serper
- **Used for:** ARIA — bootstrap, pain signals, LinkedIn people searches, Reddit, news, email format
- **Env var:** `SERPER_API_KEY`
- **Endpoint:** `https://google.serper.dev/search` (organic) and `/news`
- **Auth:** `X-API-KEY: {key}` header
- **Pricing:** ~$1 / 1000 queries. Pay as you go.
- **Sign in:** serper.dev
- **Calls per ARIA search:** ~12–14
- **Notes:** Best tool for Reddit (indexes it better than Tavily). Used for all LinkedIn people searches.

---

### 4. Apollo
- **Used for:** ARIA Step 6 — contact enrichment (email + phone) for confirmed names
- **Env var:** `APOLLO_API_KEY`
- **Current endpoint:** `POST https://api.apollo.io/api/v1/people/match`
- **Auth:** `Authorization: Bearer {key}` ⚠️ Old `X-Api-Key` header is deprecated
- **Dead endpoint (do not use):** `/api/v1/mixed_people/search` — returns 403
- **Pricing:** Basic plan $49/mo includes enrichment credits.
- **Sign in:** app.apollo.io → Settings → Integrations → API
- **Calls per ARIA search:** 1 (top confirmed contact)
- **Notes:** Input is `name + domain` → returns email, phone, LinkedIn URL. Must use `/people/match`.

---

### 5. NinjaPear (formerly Nubela / ProxyCurl)
- **Used for:** ARIA Step 6 — validate top contact is still currently employed
- **Env var:** `NINJAPEAR_API_KEY` ⚠️ Old name was `PROXYCURL_API_KEY` — must rename in Vercel
- **Endpoint:** `GET https://nubela.co/api/v1/employee/profile?first_name=X&last_name=Y&employer_website=Z`
- **Auth:** `Authorization: Bearer {key}`
- **Pricing:** $50 / 2500 credits. Each Employee API call = 3 credits. ~833 lookups per $50 (~$0.06/call)
- **Sign in:** nubela.co
- **Calls per ARIA search:** 1 (validation only)
- **Notes:** No LinkedIn scraping. `work_experience[].end_date === null` = currently employed. Company rebranded Nubela → NinjaPear in 2025/2026. Old ProxyCurl endpoints (`/proxycurl/api/v2/linkedin`) are dead.

---

### 6. Prospeo
- **Used for:** ARIA — email format detection (what format does a company use)
- **Env var:** `PROSPEO_API_KEY`
- **Pricing:** Pay as you go. Free tier available.
- **Sign in:** prospeo.io
- **Status:** ❌ Key not yet configured in Vercel
- **Calls per ARIA search:** 0–1 (conditional)

---

### 7. PDL (People Data Labs)
- **Used for:** ARIA — behavioral/psychographic enrichment on decision makers
- **Env var:** `PDL_API_KEY`
- **Sign in:** peopledatalabs.com
- **Status:** ❌ Key not yet configured in Vercel
- **Notes:** Optional. ARIA degrades gracefully if absent.

---

### 8. Supabase
- **Used for:** Primary database — PostgreSQL + pgvector + RLS
- **Env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Projects:** Beta project (beta.portal.gateguard.co) + Prod project (portal.gateguard.co)
- **Pricing:** Pro plan $25/mo per project
- **Sign in:** supabase.com → dashboard
- **Rule:** Always run migrations on beta first, then prod.

---

### 9. Clerk
- **Used for:** Authentication — all portal users (admin, supervisor, agent, dealer)
- **Env vars:** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- **Pricing:** Free → Pro $25/mo
- **Sign in:** clerk.com
- **Notes:** `/tech` routes bypass Clerk — use `TECH_ACCESS_CODE` env var or per-tech DB code.

---

### 10. Resend
- **Used for:** Transactional email — dealer NDA/agreement signing links, notifications
- **Env var:** `RESEND_API_KEY`
- **Verified domain:** `gateguard.co` ⚠️ NOT `mail.gateguard.co` — common mistake
- **Pricing:** Free tier (3000 emails/mo) → $20/mo
- **Sign in:** resend.com

---

### 11. Stripe
- **Used for:** Invoice payment links
- **Env vars:** `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- **Status:** ❌ Not yet configured on prod
- **Sign in:** dashboard.stripe.com

---

### 12. Mapbox
- **Used for:** Interactive maps — /map, site pins, dispatch split-view
- **Env var:** `NEXT_PUBLIC_MAPBOX_TOKEN`
- **SDK:** Mapbox GL JS v3.3.0
- **Status:** ❌ Not yet configured on prod
- **Pricing:** Free (50K loads/mo) → pay per load
- **Sign in:** account.mapbox.com

---

### 13. Vercel
- **Used for:** Deployment
- **Branches:** `main` → portal.gateguard.co | `beta` → beta.portal.gateguard.co
- **Sign in:** vercel.com → gateguard2024 team
- **Rule:** Always push `main` then `main:beta` after every commit.

---

## Free / Government APIs (No Subscription)

| API | Used For | Endpoint | Notes |
|-----|----------|----------|-------|
| FCC Broadband Map | ISP detection at property coords | `POST https://broadbandmap.fcc.gov/api/public/map/listAvailability` | ⚠️ Changed from GET to POST in 2025/2026 |
| Nominatim (OSM) | Geocoding — address → lat/lng | `https://nominatim.openstreetmap.org/search` | Must include User-Agent header |
| EDGAR / SEC | Ownership detection via SEC filings | `https://efts.sec.gov/LATEST/search-index` | No key needed |

---

## Cost Per Full ARIA Search (v6.59)

| Source | Calls | Cost |
|--------|-------|------|
| Serper | ~13 | ~$0.013 |
| Tavily | ~9 | ~$0.027 |
| Apollo `/people/match` | 1 | ~$0.05–0.10 |
| NinjaPear Employee API | 1 (3 credits) | ~$0.06 |
| Claude Haiku (extraction) | ~7 | ~$0.014 |
| Claude Sonnet (synthesis) | 1 | ~$0.07–0.10 |
| FCC + Nominatim + EDGAR | free | $0 |
| **Total** | | **~$0.23–0.31** |

At 200 searches/month ≈ **$50–60/mo** in API costs.

---

## Pending: Internal Subscriptions Page

**Task #86** — Build `/admin/api-sources` (internal, admin-only) showing:
- All integrations with live status (env var configured ✅ / missing ❌)
- Estimated monthly cost
- Link to each service's dashboard
- Last updated date

Replaces the need to maintain this document manually.
