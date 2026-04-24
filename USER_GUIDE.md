# GateGuard Portal — User Guide

## Setup Guide

### Prerequisites
- Node.js 18+
- npm or pnpm
- Git
- Vercel CLI (`npm i -g vercel`)
- Supabase account
- Clerk account
- Twilio account (Phase 2)

---

### 1. Clone & Install

```bash
git clone https://github.com/gateguard/dealer-portal.git
cd gateguard-portal
npm install
```

---

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
```

| Variable | Where to get it |
|----------|----------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API Keys |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API Keys |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API |
| `EAGLEEYE_API_KEY` | EagleEye Dashboard → API Keys |
| `EAGLEEYE_API_SECRET` | EagleEye Dashboard → API Keys |
| `BRIVO_CLIENT_ID` | Brivo Partner Portal → Integrations |
| `BRIVO_CLIENT_SECRET` | Brivo Partner Portal → Integrations |
| `TWILIO_ACCOUNT_SID` | Twilio Console |
| `TWILIO_AUTH_TOKEN` | Twilio Console |
| `TWILIO_PHONE_NUMBER` | Twilio Console → Phone Numbers |

---

### 3. Supabase Setup

1. Create a new project at supabase.com
2. Run the migration files in `supabase/migrations/` via the SQL editor
3. Enable Row Level Security (RLS) on all tables
4. Copy URL and keys to `.env.local`

---

### 4. Clerk Setup

1. Create a new application at clerk.com
2. Set allowed redirect URLs:
   - `http://localhost:3000`
   - `https://portal.gateguard.co`
3. Enable "Organizations" feature (for multi-tenant dealer/customer access)
4. Add custom roles: `dealer_admin`, `dealer_staff`, `customer_admin`, `customer_viewer`
5. Copy keys to `.env.local`

---

### 5. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

### 6. Deploy to Vercel

```bash
vercel --prod
```

Or connect your GitHub repo to Vercel for automatic deployments on push to `main`.

Set all environment variables in Vercel Dashboard → Project → Settings → Environment Variables.

**Custom domain:** Set `portal.gateguard.co` in Vercel Domains settings.

---

## How to Use the Portal

### Dashboard
The main overview for your dealer account. Shows:
- **Summary metrics** — total accounts, cameras online, bridges/CMVRs, active alerts
- **Accounts table** — all customer accounts with status, edition, camera count, last login
- **System notifications** — EagleEye and Brivo alerts from the last 24 hours
- **AI search** — type natural language queries to find accounts or events

### Customers
Your CRM. Each customer record includes:
- Contact info, sites, account number
- Brivo access tier and administrator count
- EagleEye bridge/camera count
- Notes, activity log, linked quotes and work orders
- **Create New Account** — opens wizard to set up a new customer with EagleEye + Brivo provisioning

### Cameras (EagleEye)
Live camera management powered by EagleEye Networks API:
- **Camera Grid** — live thumbnails, click to open full feed
- **Video Search** — AI-powered search across all cameras and timeframes
- **Layouts** — custom multi-camera views per property
- **Archive** — saved/flagged video clips
- **Downloads** — export clips for law enforcement or insurance

> **Note:** Requires valid EagleEye API key with dealer-level access. See `.env.example`.

### Access Control (Brivo)
Access control management powered by Brivo API:
- **Event Tracker** — live door/access events with AI search
- **Users** — all cardholders across all sites, bulk import/export
- **Devices** — cameras + wired doors, connectivity status
- **Reports** — activity, in/out, custom reports

> **Note:** Requires Brivo Partner Portal credentials. See `.env.example`.

### Quotes
Build and send professional proposals:
1. Click **New Quote**
2. Select customer from dropdown
3. Add line items (equipment, labor, monthly recurring)
4. AI can suggest equipment packages based on site type
5. Preview as a branded PDF or shareable link
6. Customer signs digitally — status updates automatically

### Maintenance
Work order and asset management:
- **Work Orders** — create, assign, track to completion
- **Scheduled Maintenance** — recurring tasks (annual camera cleaning, firmware updates)
- **Assets** — track equipment by serial number, warranty, install date
- **Dispatch** — assign technicians, get mobile updates via Twilio SMS

### Billing
QuickBooks-connected billing:
- View all invoices and payment status
- Create one-time or recurring invoices
- Sync to QuickBooks automatically
- Track subscription MRR per customer

### Settings
- **Integrations** — connect/disconnect EagleEye, Brivo, QuickBooks, Twilio
- **Team** — add dealer staff, set roles
- **Notifications** — configure SMS/email alerts per event type
- **Branding** — customize for white-label customer portal

---

## Dark / Light Mode
Click the sun/moon icon in the top bar to toggle. Preference is saved per user.

## AI Search
Any search bar with the ✦ AI icon accepts natural language:
- *"Show all accounts with offline cameras"*
- *"Find access events for John Doe this week"*
- *"Which customers haven't logged in for 30 days"*

---

## Support
- Email: rfeldman@gateguard.co
- Site: gateguard.co

---

## Deployment Guide

### Option A: Vercel (Recommended)

#### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "feat: initial GateGuard portal scaffold (Phase 1 UI)"
git remote add origin https://github.com/YOUR_ORG/gateguard-portal.git
git push -u origin main
```

#### Step 2 — Connect to Vercel
1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import from GitHub → select `gateguard-portal`
3. Framework: **Next.js** (auto-detected)
4. Root directory: leave as default (`./`)
5. Click **Deploy**

#### Step 3 — Add Environment Variables in Vercel
1. Vercel Dashboard → your project → **Settings → Environment Variables**
2. Add all variables from `.env.example` with your real values
3. Set scope to **Production** + **Preview**
4. Click **Redeploy** to pick up the new vars

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY   → pk_live_...
CLERK_SECRET_KEY                    → sk_live_...
NEXT_PUBLIC_SUPABASE_URL            → https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY       → eyJ...
SUPABASE_SERVICE_ROLE_KEY           → eyJ...
EAGLEEYE_API_KEY                    → (from EagleEye dashboard)
EAGLEEYE_API_SECRET                 → (from EagleEye dashboard)
BRIVO_CLIENT_ID                     → (from Brivo partner portal)
BRIVO_CLIENT_SECRET                 → (from Brivo partner portal)
TWILIO_ACCOUNT_SID                  → AC...
TWILIO_AUTH_TOKEN                   → (from Twilio console)
TWILIO_PHONE_NUMBER                 → +1...
NEXT_PUBLIC_APP_URL                 → https://portal.gateguard.co
```

#### Step 4 — Custom Domain
1. Vercel → Project → **Settings → Domains**
2. Add: `portal.gateguard.co`
3. Copy the CNAME value Vercel provides
4. In your DNS provider (e.g., Cloudflare), add:
   ```
   Type: CNAME
   Name: portal
   Value: cname.vercel-dns.com
   ```
5. Wait 5–10 min for DNS propagation
6. Vercel auto-provisions SSL

#### Step 5 — Verify Deployment
Visit `https://portal.gateguard.co` — you should see the GateGuard Dealer Portal login screen.

---

### Option B: Local Development

```bash
# 1. Clone
git clone https://github.com/YOUR_ORG/gateguard-portal.git
cd gateguard-portal

# 2. Install
npm install

# 3. Set up env
cp .env.example .env.local
# Edit .env.local with your keys

# 4. Run
npm run dev
# → http://localhost:3000
```

---

### GitHub Repository Setup

```bash
# Recommended branch structure
main        → production (auto-deploys to portal.gateguard.co)
staging     → staging (auto-deploys to staging.portal.gateguard.co)
dev         → active development

# Protect main branch in GitHub:
# Settings → Branches → Add rule → require PR reviews before merging
```

**Recommended `.gitignore` additions** (already in Next.js default):
```
.env.local
.env.*.local
node_modules/
.next/
```

---

### Supabase Database Setup

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Region: `US East (N. Virginia)` for lowest latency from Atlanta
3. Generate a strong DB password (save it!)
4. Once project is ready: **Settings → API** → copy URL and keys to Vercel env vars
5. Go to **SQL Editor** → run each migration file from `supabase/migrations/` in order (Phase 2)
6. Enable **RLS** (Row Level Security) on all tables — required for multi-tenant security

---

### Clerk Auth Setup

1. Go to [clerk.com](https://clerk.com) → **Create Application**
2. App name: `GateGuard Portal`
3. Sign-in options: Email + Google
4. Go to **API Keys** → copy publishable + secret keys
5. **Configure → Redirects:**
   - Sign-in redirect: `/`
   - Sign-up redirect: `/`
6. **Organizations** (for dealer/customer separation):
   - Dashboard → Organizations → Enable
   - This lets you have one org per dealer, sub-orgs per customer
7. Add production domain: `portal.gateguard.co` under **Domains**

---

### Post-Deployment Checklist

- [ ] Portal loads at `portal.gateguard.co`
- [ ] Dark/light mode toggle works
- [ ] All nav links resolve (Dashboard, Customers, Cameras, etc.)
- [ ] Clerk sign-in page appears (Phase 2: after Clerk is wired)
- [ ] Vercel deployment logs show no errors
- [ ] `.env.local` is NOT committed to git (`git status` check)
- [ ] Supabase project created and keys added to Vercel

---

### Troubleshooting

| Issue | Fix |
|-------|-----|
| `Module not found` errors | Run `npm install` |
| Blank page on Vercel | Check Vercel build logs for TypeScript errors |
| Env vars not working | Make sure they're set in Vercel → redeploy |
| Clerk redirect loop | Check allowed URLs in Clerk dashboard |
| CSS not loading | Ensure `tailwindcss-animate` is installed |
