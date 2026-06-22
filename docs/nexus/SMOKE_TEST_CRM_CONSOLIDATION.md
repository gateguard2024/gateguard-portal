# Smoke Test — Did the Database Cleanup Work?

**Who:** anyone (an intern is perfect)
**How long:** about 10 minutes
**Why:** we just changed where the app saves leads, opportunities, and activity notes.
This test makes sure nothing broke and the data shows up in the right place.

**Before you start:**
- Open the Nexus app and **log in** (use a staff/admin login, not a dealer one).
- Have this page open so you can check off each box. ✅ = good. ❌ = stop and tell Russel.
- If anything throws an error message on screen, that's a ❌ — write down what it said.

---

## Test 1 — Make a lead with the Nexus helper

The "Nexus helper" is the little chat assistant (the glowing button, usually bottom corner).

1. ☐ Click the **Nexus assistant** button to open the chat.
2. ☐ Type this and send it:
   > Create a lead named Smoke Test Property, company Test HOA, email test@example.com
3. ☐ The assistant should reply that the lead was **created** (it may show a little confirm card — click **Execute** if it asks).
4. ☐ Now go to the **Leads** list (CRM → Leads).
5. ☐ **Find "Smoke Test Property" in the list.** It should be there.

**✅ Pass:** the new lead shows up in the Leads list with the name and company you typed.
**❌ Fail:** the assistant said it worked but the lead is **not** in the list (this is the exact bug we fixed — flag it).

---

## Test 2 — Add a note (activity) to a lead

1. ☐ Open the lead you just made (**Smoke Test Property**).
2. ☐ Find the **Activity** or **Notes** area.
3. ☐ Add a note that says: `Smoke test note on lead`. Save it.
4. ☐ The note should **appear right away** in the activity list.
5. ☐ **Refresh the page** (reload). The note should **still be there**.

**✅ Pass:** the note shows up and stays after a refresh.
**❌ Fail:** the note disappears, shows twice, or throws an error.

---

## Test 3 — Add a note to an opportunity

1. ☐ Go to **CRM → Opportunities** and open **any** opportunity.
2. ☐ Find the **Activity** or **Notes** area.
3. ☐ Add a note that says: `Smoke test note on opportunity`. Save it.
4. ☐ It should appear right away, and still be there after a **refresh**.

**✅ Pass:** the note shows and stays.
**❌ Fail:** error, disappears, or shows twice.

---

## Test 4 — Turn a lead into an opportunity (the "convert" button)

1. ☐ Open the **Smoke Test Property** lead again.
2. ☐ Click the button that turns it into a deal — it says something like **Convert to Opportunity** or **Create Opportunity**.
3. ☐ It should make a **new opportunity** and open it (or show a success message).
4. ☐ On that new opportunity, check the **Activity/Notes** area.
5. ☐ The note you added in Test 2 (`Smoke test note on lead`) should **carry over** and show here too.

**✅ Pass:** the opportunity gets created AND the old lead note came along.
**❌ Fail:** convert button errors, makes nothing, or the note didn't carry over.

---

## When you're done

- ☐ All four tests **passed** → reply to Russel: "Smoke test passed ✅"
- ☐ Any test **failed** → tell Russel **which test number**, and copy any error message you saw.

**Cleanup (optional):** you can delete the "Smoke Test Property" lead and the
opportunity it made so they don't clutter the list. If you're not sure, just leave them.
