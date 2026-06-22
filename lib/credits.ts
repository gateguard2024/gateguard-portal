// DEPRECATED / RETIRED (migration audit, June 2026).
// This module targeted a `credit_wallets` table that was NEVER created by any
// migration, and was not imported anywhere. The live credits system is the ARIA
// credits ledger: tables `credit_balances` / `credit_transactions` / `credit_packages`
// with RPCs `grant_aria_credits` / `spend_aria_credits`
// (see app/api/aria/credits/* and app/api/billing/webhook). Do not add code here —
// use the ARIA credit ledger instead. File kept only because the sandbox can't
// delete it; safe to `git rm` on the host.
export {}
