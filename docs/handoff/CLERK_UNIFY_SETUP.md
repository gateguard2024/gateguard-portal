# One Clerk instance across beta + main (satellite setup)

Goal: beta and main share **one** production Clerk instance, so every person has a
single login + a single user ID that works on both sites. Separate **databases**
(beta Supabase vs prod Supabase) are kept — only identity unifies. After this,
there is no more "on beta / on main / on both," and no ongoing reconciliation.

The app code is already done: beta reads three env vars and runs as a Clerk
**satellite**; main leaves them blank and behaves exactly as today.

---

## 1. Clerk dashboard (production instance)

1. Open the **production** Clerk instance (the one main uses, `pk_live_` / `sk_live_`).
2. **Domains → add a satellite domain:** `gateguard-portal-git-beta-gate-guard.vercel.app`.
3. Confirm the primary domain is `portal.gateguard.co`.
4. Add beta to allowed origins / redirect URLs if prompted.

> Clerk's satellite-domain steps occasionally change — confirm the exact clicks in
> Clerk's current "Satellite domains" docs. The three env vars below are what the
> app expects regardless.

## 2. Vercel env — BETA only

Set these on the beta project/branch (and **redeploy beta**):

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_live_…      # SAME as main (production)
CLERK_SECRET_KEY                  = sk_live_…      # SAME as main (production)
NEXT_PUBLIC_CLERK_IS_SATELLITE    = true
NEXT_PUBLIC_CLERK_DOMAIN          = gateguard-portal-git-beta-gate-guard.vercel.app
NEXT_PUBLIC_CLERK_SIGN_IN_URL     = https://portal.gateguard.co/sign-in
```

## 3. Vercel env — MAIN

No change. Keep `pk_live_` / `sk_live_`, and leave the three `…SATELLITE / …DOMAIN /
…SIGN_IN_URL` vars **unset** (main is the primary domain).

---

## 4. Get today's split users onto one instance

Because beta will now use the **production** Clerk instance, anyone who only had a
beta (dev-instance) account needs a production account, and beta's database rows
(tagged with old dev IDs) must be relinked to the production IDs.

1. **Invite everyone into production Clerk.** Main users already have accounts.
   For beta-only testers, invite them on main (admin → Users → Invite). They
   accept once; that single account now works on **both** beta and main.
2. **Relink beta's database** to the production IDs by email — run the reconcile
   script against **beta Supabase** with the **production** Clerk key:
   ```
   export NEXT_PUBLIC_SUPABASE_URL="https://<BETA>.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="<BETA service role key>"
   export CLERK_SECRET_KEY="sk_live_…<PRODUCTION secret key>"

   node scripts/reconcile-clerk-users.mjs           # dry run — read the plan
   node scripts/reconcile-clerk-users.mjs --apply    # relink after review
   ```
   The dry run lists anyone not yet in production Clerk — invite/accept those,
   then apply. (Main's database is already on production IDs, so it needs no run
   unless its dry run shows mismatches.)
3. On beta, run **Sync profiles**, and have testers log in once (self-heal applies
   their org).

---

## After this

- One account per person, one ID everywhere — invitations, roles, and org context
  all live in the single production instance.
- New users are invited once (from either domain) and can use both.
- Beta stays a safe sandbox because the **data** is still a separate database.
- The reconcile script becomes a one-time cleanup, not an ongoing chore.
