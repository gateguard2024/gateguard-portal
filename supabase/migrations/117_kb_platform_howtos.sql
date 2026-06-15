-- Migration 117: Seed KB — Platform How-To articles (Nexus user help)
--
-- Answers the everyday questions people type into the "Ask Nexus anything" bar.
-- All plain-language, 5th-grader simple. Renders as plain text (whitespace kept).
-- Idempotent: each insert is guarded WHERE NOT EXISTS on title. Run beta → prod.
-- kb_articles already exists (migration 004) — no GRANT needed.

-- Helper pattern: INSERT ... SELECT ... WHERE NOT EXISTS (title match)

INSERT INTO public.kb_articles (category, title, description, content, difficulty, author, active)
SELECT 'Platform How-To', 'Getting Around Nexus',
 'The basics: the bottom tabs, the "Ask Nexus anything" bar, and quick words that jump you anywhere.',
 $c$WHAT YOU SEE

The home screen has one big search bar — "Ask Nexus anything" — and a row of tabs along the bottom:
My Day, Sales, Jobs, Operations, Design, Systems, and Money/Docs.

THE TABS
- My Day — your to-dos, schedule, priorities, and messages.
- Sales — leads, opportunities, and your pipeline.
- Jobs — work orders and field work (Dispatch lives here too).
- Operations — find any customer, property, or site.
- Design — floor plans, system designs, and as-builts.
- Systems — installed devices and whether they are online.
- Money/Docs — invoices, renewals, and documents to sign.

THE ASK BAR (fastest way to move)
Type a place and press enter to jump straight there:
- "dispatch", "money", "design", "sales", "jobs"
- "new quote", "calendar", "aria"
- "help" — opens this knowledge center.

Or ask a real question (like "create a new lead") and Nexus will help you do it.

THE ADMIN ICON
Settings and user management live behind the small admin icon in the top-right corner (only shown to admins).$c$,
 'Basic', 'GateGuard', true
WHERE NOT EXISTS (SELECT 1 FROM public.kb_articles WHERE title = 'Getting Around Nexus');

INSERT INTO public.kb_articles (category, title, description, content, difficulty, author, active)
SELECT 'Platform How-To', 'Capture a New Lead',
 'Add a new lead from a phone call, walk-in, website, or any source.',
 $c$WHERE TO GO

Open the Sales tab, then choose "Capture Lead."

STEPS
1. Pick where the lead came from (phone call, walk-in, outbound, website, or other).
2. Enter the contact name and the property or company.
3. Write one line about what they need.
4. Click Save.

Nexus checks for duplicates first. If it finds a possible match, it shows it so you do not create the same lead twice.

WHAT HAPPENS NEXT
The new lead opens so you can add a note, log a call, schedule a follow-up, or turn it into an opportunity.$c$,
 'Basic', 'GateGuard', true
WHERE NOT EXISTS (SELECT 1 FROM public.kb_articles WHERE title = 'Capture a New Lead');

INSERT INTO public.kb_articles (category, title, description, content, difficulty, author, active)
SELECT 'Platform How-To', 'Work Your Leads and Opportunities',
 'Find what needs attention and move deals forward.',
 $c$WHERE TO GO

Open the Sales tab. Pick a pile of work: My Leads, Open Leads, Needs Attention, Open Opportunities, or Proposal Follow-Ups. You can also search by name.

OPEN A LEAD OR DEAL
Click any card to open it. Inside you can:
- Add a note.
- Log a call.
- Schedule a follow-up.
- Change the stage.
- Turn a lead into an opportunity (a real deal).

TIP
"Needs Attention" shows what is going cold so nothing slips.$c$,
 'Basic', 'GateGuard', true
WHERE NOT EXISTS (SELECT 1 FROM public.kb_articles WHERE title = 'Work Your Leads and Opportunities');

INSERT INTO public.kb_articles (category, title, description, content, difficulty, author, active)
SELECT 'Platform How-To', 'Create and Send a Quote',
 'Build a quote and send it to the customer for online approval.',
 $c$WHERE TO GO

Type "new quote" in the Ask bar, or open a customer and choose New Quote.

BUILD IT
1. Add line items (equipment and monthly service).
2. Watch the pricing summary on the side.
3. If the margin is too low, Nexus asks for approval before you can send.

SEND IT
Click Send. The customer gets an email with a private link. They open a clean page — no login needed — where they can Approve, Request Changes, or Ask a Question. When they approve, the quote updates automatically.$c$,
 'Basic', 'GateGuard', true
WHERE NOT EXISTS (SELECT 1 FROM public.kb_articles WHERE title = 'Create and Send a Quote');

INSERT INTO public.kb_articles (category, title, description, content, difficulty, author, active)
SELECT 'Platform How-To', 'Get a Document Signed',
 'Send NDAs, agreements, and proposals for a no-login online signature.',
 $c$HOW IT WORKS

When you send a document (NDA, dealer agreement, or proposal), the other person gets an email with a private link to nexus.gateguard.co. They open a clean signing page — no account, no app.

WHAT THEY DO
1. Read the document on the page.
2. Type their name to sign.
3. Done — you get notified, and the status updates.

COUNTERSIGN
For agreements, GateGuard countersigns after the other party signs, which marks the document fully executed.

THE LINK
The link is private and tied to that document. It can expire, so send a fresh one if it is old.$c$,
 'Basic', 'GateGuard', true
WHERE NOT EXISTS (SELECT 1 FROM public.kb_articles WHERE title = 'Get a Document Signed');

INSERT INTO public.kb_articles (category, title, description, content, difficulty, author, active)
SELECT 'Platform How-To', 'Manage Jobs and Assign a Tech',
 'See field work and send the right technician using the Dispatch board.',
 $c$WHERE TO GO

Open the Jobs tab. To assign work, click "Open Dispatch board."

ON THE DISPATCH BOARD
- Left side: jobs that need a tech.
- Right side: your techs, grouped by status (Available, On Site, Driving, Offline).

ASSIGN A JOB (two taps)
1. Tap the job.
2. Tap the tech to assign it.

That is it — the job shows the tech, and the tech shows the job.

SET A TECH'S STATUS
Use the small colored dots next to a tech to mark them Available, On Site, Driving, or Offline.

OPEN A JOB
Click "Open full job details" to see the site, tasks, parts, notes, and to mark it complete.$c$,
 'Basic', 'GateGuard', true
WHERE NOT EXISTS (SELECT 1 FROM public.kb_articles WHERE title = 'Manage Jobs and Assign a Tech');

INSERT INTO public.kb_articles (category, title, description, content, difficulty, author, active)
SELECT 'Platform How-To', 'Connect Your Email and Send Messages',
 'Hook up Gmail or any email so Nexus can send and receive for you.',
 $c$WHERE TO GO

Open My Day, find the Messages panel, and click the gear (settings) icon.

CONNECT A MAILBOX
- Click "Connect Gmail" and approve access, OR
- Click "Connect a different email" and enter your SMTP details (server, port, username, password). Many providers need an "app password," not your normal password.

TEST IT
Click "Send test" to confirm it works. A green check means you are good.

USE IT
Back in Messages, open any conversation and reply. Email connectors can send now; received Gmail also shows up. Click "Refresh inbox" to pull new mail.$c$,
 'Basic', 'GateGuard', true
WHERE NOT EXISTS (SELECT 1 FROM public.kb_articles WHERE title = 'Connect Your Email and Send Messages');

INSERT INTO public.kb_articles (category, title, description, content, difficulty, author, active)
SELECT 'Platform How-To', 'Find a Customer, Property, or Site',
 'Search everything from one place in the Operations tab.',
 $c$WHERE TO GO

Open the Operations tab and choose "Find Customer."

SEARCH
Start typing — a name, a property, a company, or a contact. Results appear as you type. Use the chips (Customers, Properties, Companies, Contacts, Sites) to narrow it down.

OPEN A RESULT
Click any result to see its details. From there you can open the full record, start a quote, start a job, or add a note.$c$,
 'Basic', 'GateGuard', true
WHERE NOT EXISTS (SELECT 1 FROM public.kb_articles WHERE title = 'Find a Customer, Property, or Site');

INSERT INTO public.kb_articles (category, title, description, content, difficulty, author, active)
SELECT 'Platform How-To', 'Check System Health and Devices',
 'See what is installed at each property and whether it is online.',
 $c$WHERE TO GO

Open the Systems tab.

WHAT YOU SEE
- A summary at the top: total devices, how many are online, and how many need attention.
- A list of sites, each with a health bar (for example "18/20 online").

OPEN A SITE
Click a site to see every device grouped by type (cameras, readers, intercoms, gates, network), each with a status: Online (green), Warning (amber), or Offline (red).

FIX A PROBLEM
If something is offline, click "Create Work Order" to send a tech.$c$,
 'Basic', 'GateGuard', true
WHERE NOT EXISTS (SELECT 1 FROM public.kb_articles WHERE title = 'Check System Health and Devices');

INSERT INTO public.kb_articles (category, title, description, content, difficulty, author, active)
SELECT 'Platform How-To', 'Money and Documents',
 'Collect on invoices, watch renewals, and get paperwork signed.',
 $c$WHERE TO GO

Open the Money/Docs tab.

WHAT IS THERE
- Invoices — what is unpaid, past due, or recently paid.
- Renewals — contracts and services coming due.
- Documents to Sign — paperwork waiting on a signature.
- Compliance — missing or expired paperwork to fix.

You only see money and documents for your own organization and the ones below you.$c$,
 'Basic', 'GateGuard', true
WHERE NOT EXISTS (SELECT 1 FROM public.kb_articles WHERE title = 'Money and Documents');
