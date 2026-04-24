# GateGuard OS — Deployment Guide
## GitHub Desktop → Vercel → Supabase → portal.gateguard.co
### No Terminal Required

---

## STEP 1 — GitHub (via GitHub Desktop)

### 1a. Install GitHub Desktop
1. Go to **desktop.github.com** → Download for Mac → Install it
2. Open GitHub Desktop → **Sign in to GitHub.com** with your account

### 1b. Create the repository on GitHub.com
1. Go to **github.com** → click the **+** (top right) → **New repository**
2. Settings:
   - **Owner:** your account or org
   - **Repository name:** `gateguard-portal`
   - **Visibility:** ✅ Private
   - ❌ Do NOT check "Add README" (we have one)
3. Click **Create repository**
4. On the next screen, click **"Set up in Desktop"** button
   - This opens GitHub Desktop automatically
   - Choose where to save it on your Mac → **Clone**

### 1c. Add the project files
1. Open **Finder**
2. Navigate to your `gateguard-portal/` folder (on your Desktop → Contex folder)
3. Select **all files and folders** inside it (Cmd+A)
4. **Copy** them (Cmd+C)
5. Navigate to where GitHub Desktop cloned the repo (it tells you the path)
6. **Paste** everything there (Cmd+V) — overwrite if asked

### 1d. Commit and push
1. Switch back to **GitHub Desktop**
2. You'll see all the files listed under "Changes" on the left
3. In the **Summary** box at the bottom left, type:
   ```
   feat: GateGuard OS Phase 1 — UI scaffold
   ```
4. Click **Commit to main**
5. Click **Publish branch** (top right) → pushes to GitHub

✅ Go to **github.com/YOUR_NAME/gateguard-portal** — you should see all the files

---

## STEP 2 — Supabase

### 2a. Create the project
1. Go to **supabase.com** → Sign in → **New Project**
2. Settings:
   - **Project name:** `gateguard-portal`
   - **Database password:** click Generate → **copy and save it somewhere safe**
   - **Region:** `East US (North Virginia)` ← closest to Atlanta
3. Click **Create new project** — wait about 2 minutes

### 2b. Run the database schema
1. Left sidebar → **SQL Editor** → **New query**
2. Open the file `supabase/migrations/001_initial_schema.sql` from the project folder
   - You can open it with TextEdit or any text editor
3. Select all (Cmd+A) → Copy (Cmd+C)
4. Click in the Supabase SQL Editor → Paste (Cmd+V)
5. Click **Run** (green button, or Cmd+Enter)
6. Should say: ✅ **"Success. No rows returned"**

### 2c. Save your API keys
1. Left sidebar → **Settings** (gear icon) → **API**
2. Save these — you'll need them in Step 3:

| Copy this | Save as |
|-----------|---------|
| **Project URL** | `NEXT_PUBLIC_SUPABASE_URL` |
| **anon / public** key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **service_role** key | `SUPABASE_SERVICE_ROLE_KEY` ⚠️ keep secret |

---

## STEP 3 — Vercel

### 3a. Import from GitHub
1. Go to **vercel.com** → Log in with GitHub
2. Click **Add New** → **Project**
3. Find `gateguard-portal` → click **Import**
4. Framework: **Next.js** ← auto-detected ✅

### 3b. Add environment variables
Before clicking Deploy, scroll down to **Environment Variables** and add each one:

Click **Add** for each row below:

```
Name                                Value
─────────────────────────────────── ──────────────────────────────
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY   pk_live_... (from Clerk - Step 4)
CLERK_SECRET_KEY                    sk_live_... (from Clerk - Step 4)
NEXT_PUBLIC_SUPABASE_URL            https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY       eyJ...
SUPABASE_SERVICE_ROLE_KEY           eyJ...
EAGLEEYE_API_KEY                    (skip for now — add in Phase 2)
BRIVO_CLIENT_ID                     (skip for now — add in Phase 2)
NEXT_PUBLIC_APP_URL                 https://portal.gateguard.co
```

> You can add Clerk keys after Step 4 — just redeploy after

### 3c. Deploy
Click **Deploy** — takes about 90 seconds.

✅ Your app is live at something like `gateguard-portal-abc123.vercel.app`

---

## STEP 4 — Clerk (Authentication)

### 4a. Create the app
1. Go to **clerk.com** → **Create application**
2. **Application name:** `GateGuard Portal`
3. Sign-in options: ✅ Email address, ✅ Google
4. Click **Create application**

### 4b. Get your API keys
1. Left sidebar → **API Keys**
2. Copy:
   - **Publishable key** → this is your `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - **Secret key** → this is your `CLERK_SECRET_KEY`

### 4c. Add keys to Vercel
1. Go back to **Vercel** → your project → **Settings** → **Environment Variables**
2. Add or update the two Clerk keys
3. Go to **Deployments** → click the three dots on the latest deploy → **Redeploy**

### 4d. Configure redirect URLs
1. Back in Clerk → **Configure** → **Paths**
2. Set:
   - Sign-in URL: `/sign-in`
   - Sign-up URL: `/sign-up`
   - After sign-in URL: `/`
   - After sign-up URL: `/`
3. Add Production domain: `portal.gateguard.co`

### 4e. Enable Organizations (multi-tenant)
1. Clerk → left sidebar → **Organizations**
2. Toggle **Enable Organizations** → ON ✅
3. This powers the MSO → Dealer → Client hierarchy

---

## STEP 5 — Point portal.gateguard.co to Vercel

### 5a. Add domain in Vercel
1. Vercel → your project → **Settings** → **Domains**
2. Type `portal.gateguard.co` → click **Add**
3. Vercel shows you a CNAME record — it will say something like:
   ```
   CNAME  portal  cname.vercel-dns.com
   ```

### 5b. Add the DNS record in Cloudflare
1. Log into **Cloudflare** (where gateguard.co DNS lives)
2. Click on **gateguard.co** → **DNS** → **Records** → **Add record**
3. Fill in:
   - **Type:** CNAME
   - **Name:** portal
   - **Target:** cname.vercel-dns.com
   - **Proxy status:** 🔘 **DNS only** (grey cloud — NOT orange)
4. Click **Save**

### 5c. Wait and verify
- DNS propagates in 2–10 minutes
- Back in Vercel → Domains — watch for the green ✅ **"Valid Configuration"**
- Visit **https://portal.gateguard.co**

🎉 **You're live.**

---

## Quick Launch Checklist

- [ ] GitHub Desktop installed + signed in
- [ ] Repo created at github.com and files pushed
- [ ] Supabase project created (US East)
- [ ] SQL migration run → tables created
- [ ] Vercel project imported + env vars set
- [ ] First deploy successful
- [ ] Clerk app created + keys added to Vercel
- [ ] DNS CNAME added in Cloudflare (grey cloud proxy)
- [ ] portal.gateguard.co loads ✅
- [ ] Dark mode default, all nav links work ✅

---

## Quick Reference

| Service | URL |
|---------|-----|
| 🌐 Live portal | portal.gateguard.co |
| 🔲 GitHub | github.com/YOUR_NAME/gateguard-portal |
| ▲ Vercel | vercel.com → gateguard-portal |
| 🟢 Supabase | supabase.com/dashboard |
| 🔐 Clerk | dashboard.clerk.com |
| 🖥 GitHub Desktop | desktop.github.com |

---

## If Something Goes Wrong

| Problem | Fix |
|---------|-----|
| Vercel build error | Settings → Environment Variables → make sure Supabase URL/keys are filled in |
| portal.gateguard.co won't load | Make sure Cloudflare proxy is **grey** (DNS only), not orange |
| Clerk error on sign-in | Add `portal.gateguard.co` to allowed domains in Clerk |
| Supabase "table not found" | Re-run the SQL migration in SQL Editor |
| GitHub Desktop not seeing files | Make sure you pasted INTO the cloned repo folder, not next to it |
