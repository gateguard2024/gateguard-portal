# Move users to main — simple worksheet

Two parts for each person: **A) give them a login on main**, then **B) copy their data**.
Do Part A for everyone first. Part B (the terminal part) can wait for the intern/developer.

---

## The people (fill this in)

| # | Name | Email | Role | Company | A: invited | A: accepted | A: synced | B: data copied |
|---|------|-------|------|---------|:--:|:--:|:--:|:--:|
| 1 | Savannah Granito |  |  |  | ☐ | ☐ | ☐ | ☐ |
| 2 | Madison Dunn |  |  |  | ☐ | ☐ | ☐ | ☐ |
| 3 | David Bockorny |  |  |  | ☐ | ☐ | ☐ | ☐ |

*(Sharmila Prabhu = just invite fresh on main; no data to copy.)*

---

## Part A — Give them a login on main  (do this now)

For **each** person:

1. Go to **https://portal.gateguard.co** and sign in as admin.
2. Open the **Admin** area → **Users / People**.
3. Click **Add a person** (the invite button).
4. Type their **email**, pick their **role**, pick their **company**. Send. → tick **invited**.
5. They get an email → click the button → set a password. → tick **accepted**.

After all three have accepted:

6. In **Admin**, click **Sync profiles** once. → tick **synced** for all three.

✅ When every row shows invited + accepted + synced, Part A is done. They can log into main.
Part B copies their old data over.

---

## Part B — Copy their data  (terminal — hand to intern/developer)

This runs once, in a terminal, in the project folder. It previews first and changes
nothing until you add `--apply`.

### Step 1 — get 4 values from Supabase

In Supabase, open each project → **Settings → API**:

- BETA project → **Project URL** = `_______________________`
- BETA project → **service_role** key = `_______________________`
- MAIN project → **Project URL** = `_______________________`
- MAIN project → **service_role** key = `_______________________`

> The service_role keys are admin passwords — don't paste them into email or chat.

### Step 2 — paste those 4 values (fill the blanks, then paste the whole block into the terminal)

```
export BETA_SUPABASE_URL="PASTE_BETA_URL_HERE"
export BETA_SERVICE_ROLE_KEY="PASTE_BETA_SERVICE_KEY_HERE"
export PROD_SUPABASE_URL="PASTE_MAIN_URL_HERE"
export PROD_SERVICE_ROLE_KEY="PASTE_MAIN_SERVICE_KEY_HERE"
```

### Step 3 — put the emails in, then PREVIEW (changes nothing)

Replace the emails with the real three, then paste this line:

```
node scripts/migrate-beta-user.mjs --emails "PASTE_EMAIL_1,PASTE_EMAIL_2,PASTE_EMAIL_3"
```

Read what it prints. For each person it shows how many leads / notes / to-dos / tasks it
*would* copy. If anyone shows **"NOT on main yet"** → they didn't finish Part A; fix that
and preview again.

### Step 4 — DO IT (same line + `--apply` on the end)

```
node scripts/migrate-beta-user.mjs --emails "PASTE_EMAIL_1,PASTE_EMAIL_2,PASTE_EMAIL_3" --apply
```

### Step 5 — check

Log into main as one of them (or ask them) and confirm their leads are there. Tick **data copied**.

---

**If anything looks wrong** (red error text, or huge numbers for one person): stop, don't run
`--apply` again, and message the developer. Beta is never changed — this only *copies* to main.
