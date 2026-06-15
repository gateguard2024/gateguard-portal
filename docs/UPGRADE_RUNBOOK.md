# Dependency & Next.js Upgrade Runbook

The goal: **never fall more than one major version behind.** Big jumps (like Next 14 → 15 forced by Clerk v6) are painful and risky; small, frequent steps are boring and safe. This runbook is how we keep current.

## Cadence

| Frequency | What | Who |
|-----------|------|-----|
| **Weekly (automated)** | Dependabot opens grouped PRs for patch + minor bumps. Review, let CI pass, merge. | Anyone |
| **Monthly** | Run `npm outdated`; clear any minor drift the bot missed. | Lead dev |
| **Quarterly (maintenance window)** | Review available **major** upgrades (Next, React, Clerk, Supabase). Plan + execute one major at a time on a branch. | Lead dev |

Rule of thumb: a major upgrade that's been out **>1 quarter** goes on the next quarterly window. Don't let two stack up.

## Golden rules

1. **One major per branch.** Never bundle Next + React + Clerk majors together.
2. **Branch → beta → soak → main.** Never upgrade directly on `main`. Let it run on beta for a day.
3. **Green gate before merge:** `npx tsc --noEmit` clean + `npm run build` succeeds + smoke-test the core flow (login → lead → quote → job).
4. **Read the upgrade guide + run the codemod first** — don't hand-edit what a codemod can do.
5. **Check the coupling** before starting: does the target version force another major? (e.g., Clerk v6 requires Next ≥15.2.3.) If so, sequence the dependency it requires first.

## Minor / patch upgrade (weekly, ~10 min)

```bash
git checkout -b deps/$(date +%Y-%m-%d)
npm outdated                      # see what's behind
npm update                        # applies ^-range minors/patches
npx tsc --noEmit && npm run build # green gate
git commit -am "chore(deps): weekly minor/patch sweep" && git push origin HEAD
```

## Next.js major upgrade (quarterly, on a branch)

```bash
git checkout -b upgrade/next-<version>
node -v                                   # confirm Node meets the new minimum
npx @next/codemod@latest upgrade latest    # interactive: bumps next/react + applies codemods
# OR a specific transform, e.g. the async request APIs:
npx @next/codemod@latest next-async-request-api .
npx tsc --noEmit                          # fix what the codemod couldn't
npm run build
```

Then: deploy the branch to **beta**, retest, soak ~1 day, and only then merge to `main`.

### Known coupling map (update as we learn)

- **Clerk v6 (Core 3)** → requires **Next ≥ 15.2.3** and **Node ≥ 20.9**. Upgrade Next first.
- **Next 15** → `cookies()`, `headers()`, `searchParams`, and dynamic-route `params` become **async** (codemod handles most). React 19 recommended (18 still supported).
- Supabase JS majors → check RLS/auth-helper changes.

## What CI must check (add if missing)

- `tsc --noEmit` (type safety)
- `next build` (build integrity)
- A minimal e2e/smoke pass on the critical path

## Pre-flight checklist for any major

- [ ] Read the official upgrade guide end to end
- [ ] Confirm Node/peer-dep minimums are met
- [ ] Check the coupling map above — does it force another major?
- [ ] Branch off `main`
- [ ] Run the codemod, then hand-fix + `tsc`
- [ ] `npm run build` clean
- [ ] Deploy to beta, smoke-test login → lead → quote → job
- [ ] Soak 1 day on beta
- [ ] Merge to `main`, watch the prod deploy
