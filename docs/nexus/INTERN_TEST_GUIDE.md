# Nexus Testing Guide — Easy Step-by-Step

Hi! Thanks for helping test our website. Your job is to **click around and tell us if things work or look broken**. You do NOT need to know anything about computers or code. Just follow each step like a recipe.

## How to use this guide
- Do the missions **in order**, top to bottom.
- Each step says **DO THIS** (what to click) and **YOU SHOULD SEE** (what should happen).
- After each mission, check one box:
  - ✅ **Worked** — it did what the guide said.
  - ❌ **Broke** — it did something different, looked weird, or showed an error.
- If you check ❌, write **what happened** and **what page you were on** in the "Notes" line. A screenshot is gold — press the screenshot button on your computer and save it.
- If you ever get stuck or confused, that's useful too! Write it down. Confusing = a problem we want to fix.

## Before you start
1. Open this website in your browser (Chrome is best):
   **https://gateguard-portal-git-beta-gate-guard.vercel.app/**
2. Log in with the test account you were given.
3. If a page is blank or spins forever for more than 30 seconds, that's a ❌ — write it down.

A few plain words you'll see:
- **Opportunity / Deal** = a possible sale to a customer.
- **Work Order / Job** = a visit our technician makes.
- **Quote** = a price sheet we send a customer.
- **Site / Location** = a property (like an apartment building).

---

# Mission 1 — Add a product and turn on its "AI brain"

**Where to go:** Click **Operations** (bottom of the screen) → click the **Parts** tab.

### Step 1.1 — Add a product
- **DO THIS:** Click the **"+ Add product"** button. Type a made-up product name like `Test Camera 123`. In the box that says **"Manual PDF URL"**, paste this:
  `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf`
  Then click **"Add to catalog"**.
- **YOU SHOULD SEE:** A green message saying it was added, and it mentions reading the manual.

☐ ✅ Worked  ☐ ❌ Broke
Notes: ____________________________________________

### Step 1.2 — Find your product
- **DO THIS:** In the search box, type `Test Camera`.
- **YOU SHOULD SEE:** Your product card appears.

☐ ✅ Worked  ☐ ❌ Broke
Notes: ____________________________________________

### Step 1.3 — Turn on the AI brain
- **DO THIS:** On your product card, click **"Vectorize manual now"**.
- **YOU SHOULD SEE:** The button changes to say it's working in the background ("Vectorizing… refresh in a minute").
- **DO THIS:** Wait 1 minute, then refresh the page (press the reload button) and find the product again.
- **YOU SHOULD SEE:** A green **"AI ready"** badge on the product card.

☐ ✅ Worked  ☐ ❌ Broke
Notes: ____________________________________________

### Step 1.4 — Let the website find a product for you
- **DO THIS:** At the top of the Parts tab there's a box that says **"Find it for me."** Type `LiftMaster CSL24UL` and click **"Look it up."**
- **YOU SHOULD SEE:** After a few seconds, a green "Found: …" message, and the Add-a-Product form fills in by itself (name, brand, etc.).

☐ ✅ Worked  ☐ ❌ Broke
Notes: ____________________________________________

---

# Mission 2 — The price calculator

**Where to go:** Click **Sales** → open any deal/opportunity → click the **Financials** step (it may say "Pricing & profitability").

### Step 2.1 — Type some numbers
- **DO THIS:** In the calculator, type a number in **"Total living units"** (try `100`), and **"Gates / common doors"** (try `2`).
- **YOU SHOULD SEE:** Dollar amounts appear and update by themselves within a second — like "Gate Guard Fee" and "Suggested retail."

☐ ✅ Worked  ☐ ❌ Broke
Notes: ____________________________________________

### Step 2.2 — Numbers make sense
- **DO THIS:** Change the units number to a bigger number (like `500`).
- **YOU SHOULD SEE:** The dollar amounts get bigger too (not smaller, not stuck, not "NaN" or blank).

☐ ✅ Worked  ☐ ❌ Broke
Notes: ____________________________________________

---

# Mission 3 — The sales board (where deals live)

**Where to go:** Click **Sales** (you'll see columns like a row of buckets).

### Step 3.1 — Count the columns
- **DO THIS:** Look at the column titles across the top.
- **YOU SHOULD SEE:** These 7, in order: **Meet & Present, Site Survey, Proposal, Negotiate, Contract & Sign, Deposit, Closed Won**. (There may also be a "Lost" one.)

☐ ✅ Worked  ☐ ❌ Broke
Notes: ____________________________________________

### Step 3.2 — A deal should never disappear (important!)
- **DO THIS:** Click one deal to open it. Move it forward by clicking **Next** a few times until you reach the **Payment** step. Then close the deal and go back to the **Sales** board.
- **YOU SHOULD SEE:** The same deal is STILL on the board (it should now sit in the **Deposit** or **Contract & Sign** column). It must NOT vanish.

☐ ✅ Worked  ☐ ❌ Broke
Notes: ____________________________________________

---

# Mission 4 — Build a quote (price sheet) for a customer

**Where to go:** Click **Sales** → open a deal → click the **Proposal** step.

### Step 4.1 — Add a product to the quote
- **DO THIS:** In the search box under "Add products," type a product name (like `camera`) and click one that appears.
- **YOU SHOULD SEE:** It gets added to a list below, with a price.

☐ ✅ Worked  ☐ ❌ Broke
Notes: ____________________________________________

### Step 4.2 — Add your own line
- **DO THIS:** Under "Or type a custom line," type `Install labor`, put `1` for quantity and `500` for price, then click **"Add line."**
- **YOU SHOULD SEE:** It appears in the list, and the **totals at the bottom go up**.

☐ ✅ Worked  ☐ ❌ Broke
Notes: ____________________________________________

### Step 4.3 — Make the quote
- **DO THIS:** Click **"Create quote."**
- **YOU SHOULD SEE:** A summary card with a quote number like **GG-2026-0001**, and two buttons ("Open / edit quote" and "Client proposal view").

☐ ✅ Worked  ☐ ❌ Broke
Notes: ____________________________________________

### Step 4.4 — No accidental copies
- **DO THIS:** Leave the Proposal step, then come back to it on the **same deal**.
- **YOU SHOULD SEE:** It shows the quote you just made (the summary), NOT a blank builder. (It should not make a second quote on its own.)

☐ ✅ Worked  ☐ ❌ Broke
Notes: ____________________________________________

---

# Mission 5 — Win the deal and make a job

**Where to go:** Same deal → click the **Payment** step (the last one).

### Step 5.1 — The button is locked until you're ready
- **DO THIS:** Look at the **"Convert to install job"** button.
- **YOU SHOULD SEE:** It's grey/unclickable until you check BOTH boxes: "Contract is signed" and "Deposit payment received."

☐ ✅ Worked  ☐ ❌ Broke
Notes: ____________________________________________

### Step 5.2 — Convert it
- **DO THIS:** Check both boxes, then click **"Deposit collected — convert to install job."**
- **YOU SHOULD SEE:** A green success message saying the deal is closed and a job was created.

☐ ✅ Worked  ☐ ❌ Broke
Notes: ____________________________________________

### Step 5.3 — The job really exists
- **DO THIS:** Go to **Operations → Work Orders**.
- **YOU SHOULD SEE:** A new job with the customer's name and "Install" in the title.

☐ ✅ Worked  ☐ ❌ Broke
Notes: ____________________________________________

---

# Mission 6 — The activity feed (history of a deal)

**Where to go:** Open the same deal you've been using. Scroll to the **bottom**.

### Step 6.1 — See the story of the deal
- **DO THIS:** Look at the **"Deal activity"** box at the bottom.
- **YOU SHOULD SEE:** A list with little icons and times — it should include the **quote** you made (🧾) and the **work order** you made (🔧), newest at the top.

☐ ✅ Worked  ☐ ❌ Broke
Notes: ____________________________________________

---

# Mission 7 — A location's status

**Where to go:** Click **Operations → Locations** → click any location to open it.

### Step 7.1 — Status badge
- **DO THIS:** Look near the top of the location panel.
- **YOU SHOULD SEE:** A small colored label like **Prospect**, **Onboarding**, or **Active**. If it's not active, it should say what's missing (like "To activate: Contract not signed · Deposit not collected").

☐ ✅ Worked  ☐ ❌ Broke
Notes: ____________________________________________

### Step 7.2 — Location history
- **DO THIS:** Scroll to the bottom of the location panel.
- **YOU SHOULD SEE:** A **"Site activity"** list (it may be empty for a brand-new location — that's okay, it should say something friendly, not show an error).

☐ ✅ Worked  ☐ ❌ Broke
Notes: ____________________________________________

---

# Mission 8 — Phone check (do this on your phone!)

- **DO THIS:** Open the same website on your phone and log in. Tap around the bottom buttons.
- **YOU SHOULD SEE:** Things fit on the screen — no text cut off the edges, no buttons hiding behind other buttons, no need to scroll sideways.

☐ ✅ Worked  ☐ ❌ Broke
Notes: ____________________________________________

---

# When you're done
1. Count how many ❌ you found and list the mission numbers here: ____________________
2. Send this sheet (with your notes) plus any screenshots back to the team.
3. Anything that felt confusing, even if it "worked"? Write it here:
   ____________________________________________
   ____________________________________________

**Thank you! Finding problems is exactly the point — every ❌ you catch helps.**
