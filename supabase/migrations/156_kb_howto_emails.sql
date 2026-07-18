-- Migration 156: Seed KB — Platform How-To: "Emails on Opportunities and Customers"
--
-- User help for the new Emails feature: the Emails tab on an opportunity,
-- automatic matching of sent/received Gmail to CRM records, and the in-portal
-- composer. Plain language, same style as 117. Idempotent (guarded on title).

INSERT INTO public.kb_articles (category, title, description, content, difficulty, author, active)
SELECT 'Platform How-To', 'Emails on Opportunities and Customers',
 'See every email for a deal in one place, send from the portal, and let Nexus match mail to the right record automatically.',
 $c$WHAT IT DOES

Every email you send or receive with a customer contact now shows up on the right record — automatically. No more digging through your inbox to remember what was said.

WHERE TO LOOK
- Open any opportunity and click the "Emails" tab (next to Activity).
- On a customer page, scroll to the "Emails" card.

HOW MATCHING WORKS
Nexus checks the people on each email against the contact emails saved on your opportunities and customers. If someone on the email is a saved contact, the conversation attaches itself. Threads matched this way show a small "auto" badge.

- If a conversation was matched to the wrong place, click "Unlink." Nexus remembers and won't re-attach it.
- Under "Suggested matches" you'll see conversations Nexus thinks belong here — click "Link" to attach one.

TIP: matching only works if contact emails are filled in. Add the contact's email to the opportunity (or the customer's contact list) and their mail starts attaching on the next sync.

SEND EMAIL WITHOUT LEAVING THE PORTAL
1. Open the opportunity's Emails tab.
2. Click "Compose" (or "Reply" inside a conversation).
3. Write your email and click "Send via Gmail."

It sends from YOUR Gmail address, adds your saved signature, and logs itself on the opportunity's Activity timeline — all in one step.

FIRST-TIME SETUP
You need your Gmail connected once: go to Messages → Settings and connect Gmail. After that, mail syncs about every 10 minutes. Use "Sync Gmail" on the Emails tab any time you want it right now.$c$,
 'Basic', 'GateGuard', true
WHERE NOT EXISTS (SELECT 1 FROM public.kb_articles WHERE title = 'Emails on Opportunities and Customers');
