# Intern task: move 4 people from beta to main (with their data)

**Goal:** four people currently use **beta**. Make their login work on **main**, and
bring their work data (leads, opportunities, notes, to-dos, tasks) with them.

**Why it's two steps:** beta and main are two separate systems — a separate login
book (Clerk) *and* a separate database. So you do two things: (A) give each person
a login on main, then (B) run one script that copies their data over.

**Golden rule:** the script shows you a preview and changes nothing until you add the
word `--apply`. Always run the preview first. **If anything looks wrong or an error
appears, STOP and message [DEVELOPER NAME] before doing `--apply`.**

---

## The 4 people (fill this in first)

| # | Full name | Email | Their role | Their company (org) | Login done (A) | Data done (B) |
|---|-----------|-------|-----------|---------------------|:--:|:--:|
| 1 |           |       |           |                     | ☐ | ☐ |
| 2 |           |       |           |                     | ☐ | ☐ |
| 3 |           |       |           |                     | ☐ | ☐ |
| 4 |           |       |           |                     | ☐ | ☐ |

---

## Part A — Give each person a login on main

Do this for all four first.

1. Go to **main**: https://portal.gateguard.co and sign in as an admin.
2. Open the **Admin → Users** page.
3. Click **Invite user**. Enter their **email**, pick their **role** and **company**
   (from the table above), and send.
4. Tell the person to open the email, click the button, and set a password. Once they
   do, they can log into main. **Tick "Login done" for them.**
5. When all four have accepted, open **Admin → Sync profiles** on main and click it once.

> A person who hasn't accepted their invite yet does **not** exist on main. Part B will
> skip them and tell you — just chase the invite, then re-run.

---

## Part B — Bring their data over

You'll run one script. You need five secret values (get them from [DEVELOPER NAME]):
the **beta** database URL + key, the **main** database URL + key, and the **main**
Clerk secret key (starts with `sk_live_`).

1. Open a terminal in the project folder.
2. Paste in the secrets (replace the `…`):

   ```
   export BETA_SUPABASE_URL="https://<BETA>.supabase.co"
   export BETA_SERVICE_ROLE_KEY="…"
   export PROD_SUPABASE_URL="https://<MAIN>.supabase.co"
   export PROD_SERVICE_ROLE_KEY="…"
   export CLERK_SECRET_KEY="sk_live_…"
   ```

3. **Preview first** (changes nothing) — put the four emails in, comma-separated:

   ```
   node scripts/migrate-beta-user.mjs --emails "person1@x.com,person2@x.com,person3@x.com,person4@x.com"
   ```

4. Read the preview. For each person it prints how many leads, opportunities, notes,
   to-dos, and tasks it will copy. If someone shows **"NOT in production Clerk yet"**,
   they haven't finished Part A — go finish it, then re-run the preview.

5. If the preview looks right, run it **for real**:

   ```
   node scripts/migrate-beta-user.mjs --emails "person1@x.com,person2@x.com,person3@x.com,person4@x.com" --apply
   ```

6. Log into main as one of the four (or ask them) and check that their leads/opps are
   there. **Tick "Data done"** for each person.

---

## If something goes wrong

- Any red error text, or numbers that look way off (e.g. thousands of records for one
  person) → **stop, don't run `--apply` again, message [DEVELOPER NAME].**
- The script is safe to run the **preview** as many times as you want.
- It does **not** delete anything on beta — beta is untouched. It only *copies* to main.

## What "counts" as their data

Leads and opportunities assigned to them, the notes/calls logged on those, their
to-dos, and their tracker tasks. Links to things that don't exist on main yet (like a
specific site record) are left blank on purpose — the names still show, nothing breaks.
If they need something beyond this list, tell [DEVELOPER NAME].
