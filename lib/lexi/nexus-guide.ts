/**
 * Lexi's built-in guide to Nexus — how the software works, in plain words.
 *
 * Lexi's `nexus_help` tool searches these sections plus the Help tab's
 * articles (kb_articles, category "Platform How-To"), so it can answer
 * "how do I…", "where is…" and walk people through the app.
 *
 * KEEP THIS CURRENT: when a screen or feature ships or changes, update its
 * section here in the same commit. This is what makes Lexi the authority on
 * Nexus. Write it the way you'd explain it to a new hire.
 */
import { ALL_SETUP_GUIDES, setupGuideText } from '@/lib/setup-guides'

export type GuideSection = { id: string; title: string; where: string; keywords: string; text: string }

export const NEXUS_MAP = `Nexus layout (bottom bar, left to right): My Day · Sales · Operations · [Lexi — the Nexus logo in the center] · Catalog · Systems · Events · Help · Admin (managers only). Design is hidden for now.
Separate apps: the field tool at /tech (techs sign in with their app code), the property-manager portal at /portal/<property> (PIN), and client proposal links.`

export const NEXUS_GUIDE: GuideSection[] = [
  {
    id: 'getting-around', title: 'Getting around Nexus', where: 'Bottom bar',
    keywords: 'navigate tabs bottom bar menu where find home',
    text: `Everything lives in the bottom bar: My Day (your tasks, calendar and inbox), Sales (deals and proposals), Operations (jobs, work orders, dispatch, sites, parts), Lexi in the center, Catalog (products), Systems (live gates, cameras, doors, network), Events (access activity), Help, and Admin for managers. Tap a tab to switch. Pages that were redesigned use the light look: a navy band at the top with white cards below.`,
  },
  {
    id: 'my-day', title: 'My Day', where: 'My Day tab',
    keywords: 'my day today tasks calendar inbox messages schedule summary overdue reschedule needs a date unscheduled late',
    text: `My Day is your home base: your tasks (overdue first), today's calendar, and your email inbox synced from Gmail. Tap a task to open it. The calendar shows jobs, maintenance visits, to-dos and Google Calendar events; switch Month / Week / Day / List at the top, and use Add Event to create one. Connect Google Calendar from the calendar's Sync button. Above the calendar, "Needs a date" lists late and undated tasks and jobs: tap Today, Tomorrow or pick a date, or drag one onto a day.`,
  },
  {
    id: 'tasks', title: 'Tasks (to-dos)', where: 'My Day → Tasks, or any deal / customer / work order',
    keywords: 'task todo to-do create assign due date checklist comment link deal customer complete overdue reschedule',
    text: `Create a task with + New task: give it a title, an assignee (defaults to you), a due date and notes. Tasks can be linked to a deal, customer, site, lead or work order — linked tasks show on that record's page too (both ways). Open a task to add a checklist, comments, time, or more links. Tick it to complete. Share a task with the link /?task=<id>. Lexi can create, update and complete tasks for you, with undo.`,
  },
  {
    id: 'sales-board', title: 'Sales board and deals', where: 'Sales tab → Open board',
    keywords: 'sales deal opportunity pipeline board stage move drag stalled mine team rep company forecast won lost',
    text: `Sales shows your pipeline. The board has six stages: Meet, Survey, Proposal, Negotiate, Contract, Deposit. Drag a card to move it — Nexus asks what happened and the next step. A red edge means the deal is stalled (no update in 15 days). Mine shows deals where you are the rep; Team (managers) groups deals by company, then rep. Switch Board / List / Forecast. Won and Lost tabs hold closed deals; won deals get a Create job button, lost deals can be reopened. Tap a card for the side panel (fields, qualification, contacts, next steps, history, Fill from ARIA); tap ⤢ for the full deal page.`,
  },
  {
    id: 'proposals', title: 'Proposals', where: 'A deal → New proposal',
    keywords: 'proposal quote partnership letter send client pdf agreement review approve resident fee units roi',
    text: `Gate Guard sends proposals, not plain quotes. On a deal tap New proposal: it fills in the property, contact and units and opens the Property Partnership editor — form on the left, the live client letter on the right. Count openings as Working or Needs repair, set pricing, add-ons, billing (resident-funded or property monthly) and term. The resident fee auto-calculates from units and openings, so put the real unit count in. Save & review sends it for approval (Gate Guard corporate approves dealer proposals). Once approved you can Download PDF, open the Client view, and Send proposal to client (the service agreement attaches and matches the terms). The ROI box shows PASS/FAIL (needs 30%+ margin and payback in 4 months or less).`,
  },
  {
    id: 'leads', title: 'Leads and ARIA', where: 'Sales → New lead; ARIA',
    keywords: 'lead new lead aria research property intel prospect convert',
    text: `Add a lead with New lead on the Sales page. ARIA researches a property (owner, management company, units, internet and access-control vendors, decision makers) and can fill a deal's fields with Fill from ARIA. Turn a lead into a deal from the lead's page.`,
  },
  {
    id: 'operations', title: 'Operations page', where: 'Operations tab',
    keywords: 'operations jobs work orders system health requests maintenance crew performance coming soon',
    text: `Operations shows open work orders, today's schedule, service performance (average response and resolve time), system health (devices online / needing attention / offline), open requests, preventive maintenance and crew performance. Buttons at the top: New work order, Operations Hub and Sync systems. The Coming soon card lists what's being built next (service agreements, response-time promises, proposal-to-install, truck stock, timecards, repair quotes from the field, auto-tickets, customer updates, smarter maintenance, one job / many visits).`,
  },
  {
    id: 'ops-hub', title: 'Operations Hub', where: 'Operations → Operations Hub',
    keywords: 'operations hub dashboard work orders schedule analytics requests locations techs parts procurement pm playbooks bulk csv export filter overdue unassigned urgent stuck board',
    text: `The Hub has 11 tabs. Dashboard: tap Need a tech, Overdue, Urgent or Stuck (or any status) to jump to those work orders; assign techs from "Needs a tech"; drag cards on the Jobs board to change status. Work Orders: search, filter (Open, Unassigned, Urgent, Overdue, Done, All), sort, tick several to assign a tech or change status at once, and Export CSV. Late jobs show in red. Schedule: the team calendar. Analytics: first-time fix, callbacks, hours, utilization by tech. Requests: incoming service requests → Convert to work order. Locations: sites. Techs: add techs and set their app code. Parts: products and manuals. Procurement: purchase orders. PM: recurring maintenance (overdue in red). Playbooks: reusable step lists you assign to jobs.`,
  },
  {
    id: 'work-order', title: 'Working a job (work order)', where: 'Open any work order',
    keywords: 'work order job create assign tech schedule status complete checklist photos crew visits text customer on my way arrived review print invoice parts labor timer clock signature sign-off priority due hold tasks files',
    text: `Create one with New work order: pick the site, say what needs doing, set priority, tech and date (tick "Email the assigned tech"). Opening a job shows the full job page. At the top: the progress steps New → Scheduled → Working → Done (tap one to move the job), one big button for the next step (Assign a tech, Set a date, Start job, Finish job, Create invoice), "Put on hold" (waiting on parts / stuck), and quick buttons: Call, Text, Directions, Send customer an update, Start timer (clocks labor on the job) and Get customer signature. Below that: Scheduled, Tech, Steps, Parts here, Labor and Parts margin. Tabs: Overview (status, tech, schedule date, priority, due-by date, text the customer — On my way with ETA, Arrived, Job done, Ask for review — crew and extra visits). Scope (work to perform, the site's past work and equipment). Work & money (AI Tech Support, parts, labor, margin, Create invoice, steps / checklist with playbooks and phases, parts and purchase orders). Notes, photos & files (team chat, customer sign-off, photos, notes, tasks for this job, files, follow-up work orders). Done unlocks when all steps are checked and a photo is added. Copy link and Print are top right. Site: Overview → Change site (or Add a site) to pick or change the property; Remove site makes it a general task. Cancel: tap "Cancel job…", pick why (Customer cancelled, Duplicate, Made by mistake, Fixed without a visit, Not needed, Other) — the reason is saved in Notes, the job leaves the board, schedule and tech's list, nothing is deleted. Find it again under Work Orders → Cancelled and tap Reopen. Texts (Overview): a two-way text thread with the customer over Gate Guard's Twilio number — pick who (site contact, property manager or someone else), type, Send. Their replies show up in the thread (with a red "new" badge) and in Notes; it checks for new texts every 15 seconds. On my way / Arrived / Job done and updates sent by text also show in the thread. Gate Guard corporate also sees texts that didn't match a job and can tap "Move to this job". The site button is right under the job title (Change site / + Add a site). Customer updates (Overview, or the "Send customer an update" button): pick a draft — Issue found, Repair / service scheduled, Repair summary, Waiting on parts, Visit rescheduled, Need access or info, Approval needed, Follow-up visit needed, Checked — all working, Job cancelled. It fills in the contact, site, date, tech, finished steps and parts. Fill in anything in [square brackets], pick who (site contact, property manager, or someone else) and how (email, text or both), then Send. Nothing goes out until you tap Send; what was sent is saved in Notes. Photos and Files: pick several at once or drag them onto the card; it shows "Uploading 2 of 5…" and tells you which ones didn't upload.`,
  },
  {
    id: 'sites', title: 'Sites (properties)', where: 'Operations Hub → Locations, or Customers',
    keywords: 'site property location add edit details request form link qr systems keys',
    text: `Add a site in Locations (+ Add a site). Open a site to edit details (address, units, contacts, property manager), create a work order, and copy the public request form link (/request/<site>) to give the property manager or print as a QR code. The site's Systems section shows live cameras, doors, network and relays. Setup & keys (vendor logins) is Gate Guard corporate only.`,
  },
  {
    id: 'systems', title: 'Systems (live equipment)', where: 'Systems tab, or a site',
    keywords: 'systems live camera gate door open unlock relay reboot network unifi brivo eagle eye shelly offline incident setup checklist',
    text: `Systems shows each property's live equipment: Eagle Eye cameras, Brivo doors and gates (open a gate remotely if you have permission), UniFi network, and Shelly relays (power-cycle a gate). Faults and uptime log incidents. Device health on the Operations page comes from here. Credentials are set by Gate Guard corporate only. The Setup tab on each property is a checklist of everything that can be connected there (Brivo, Eagle Eye, Edge box, Shelly, UniFi, door cameras, Gate Watch, the manager portal) with a green check when it works and simple steps for each.`,
  },
  {
    id: 'inactive-offline', title: 'Mark a property or customer inactive · take a property offline', where: 'Systems → a property → the status button (Active) next to Setup & keys; customers: Operations → Find Customer → Actions',
    keywords: 'inactive deactivate disable pause cancel customer leaving lost churn offline decommission remove equipment pull equipment uninstall take down close account reactivate turn back on',
    text: `Gate Guard corporate only. Open the property in Systems and tap its status button (it says Active) next to Setup & keys. Mark inactive pauses the property: monthly billing stops, Gate Watch and the customer portal turn off, and you get a task to send the final invoice or a credit. Nothing is deleted. Take offline & remove equipment is for a customer who is leaving: it does the same, then walks you through the steps — 1) turned off, 2) final invoice, 3) Make removal job (a work order with every installed device as a step), 4) for each device tap where it went: Back to stock, Thrown out or Left with customer (the tech can do this on the job itself), 5) remove the vendor logins in Setup & keys and cancel the vendor accounts, 6) Close out → Offline, kept for history. Turn back on undoes it (billing, Gate Watch and the portal come back; removed equipment stays removed). Inactive properties are hidden in Systems and Locations — tap Show inactive, or just search for one. Customers: Find Customer, pick the account, and use Mark inactive in Actions; tick the box to turn off all their properties too.`,
  },
  {
    id: 'catalog', title: 'Catalog (products and prices)', where: 'Catalog tab',
    keywords: 'catalog products parts price pricing cost margin sku model import csv export stock inventory manual accessories kit labor hours warranty archive bulk',
    text: `The Catalog is the one product list used by quotes, jobs, drawings, stock and the tech app. The tiles at the top filter it: Products, Low stock, Needs a price, Low margin (under 25%), No manual, Archived. Search by name, SKU, brand or tag; pick a category chip, a brand or a sort; switch List / Grid. Tick products to change their category, raise or lower prices by a percent, archive or export them. Import CSV adds or updates products by SKU (Download template shows the columns); Export saves what you're looking at. Tap a product for its page: key numbers (price, cost, margin, labor hours, stock, jobs, quotes, sites), and tabs for Overview (description, specs, details, "Goes with this item" kit parts), Stock (by location, on order), Where used (jobs, quotes, sites, purchase orders — each opens), Manuals & help, and Drawing setup. Edit changes price, cost, labor hours, unit, warranty, accessories, manuals (Upload PDF or Find it online) and drawing setup. Gate Guard catalog items can only be changed by Gate Guard; dealers tap Duplicate to make their own version. Copy link shares a product page.`,
  },
  {
    id: 'customers', title: 'Customers', where: 'Customers page',
    keywords: 'customer account company tasks emails contacts',
    text: `A customer page shows the account's details, contacts, emails and a Tasks card — add a task right there and it appears in Tasks; tasks linked to the customer from elsewhere show up there too.`,
  },
  {
    id: 'field-tool', title: 'Field tool for techs (/tech)', where: '/tech on a phone',
    keywords: 'tech field app mobile code login technician photos checklist signature offline',
    text: `Techs open /tech on their phone and sign in with their personal app code (set in Operations Hub → Techs). They see their jobs, work the checklist, take before/after photos, capture a signature, log parts and hours, get AI troubleshooting and wiring guides, and scan equipment nameplates. It keeps working with a weak signal and syncs later.`,
  },
  {
    id: 'pm-portal', title: 'Property manager portal', where: '/portal/<property>',
    keywords: 'property manager portal customer pin dashboard cameras events billing',
    text: `Each property can have a portal at /portal/<name>, opened with a PIN. Property managers see security status, cameras, gate and door activity, packages, network and billing. Gate Guard sets portals up in Admin → Customer Portals.`,
  },
  {
    id: 'admin', title: 'Admin', where: 'Admin tab (managers)',
    keywords: 'admin users invite role permissions features dealers onboarding',
    text: `Admin is for managers: invite and manage users and roles, turn features on or off per company or user, onboard dealers (NDA and agreement e-sign), and set up customer portals. What each person can see follows their company and role.`,
  },
  {
    id: 'lexi', title: 'Lexi (this assistant)', where: 'Center tab (Nexus logo)',
    keywords: 'lexi ai assistant what can you do help undo confirm brain remember memory forget recording plaud meeting transcript notes inbox waiting reply draft noticed nudges morning brief email daily summary snooze later voice talk speak hands-free read aloud gate open relay reboot power cycle cameras live report chart pipeline by rep',
    text: `Lexi reads deals, jobs, sites, tasks, leads, customers, your inbox and calendar, equipment manuals and this guide, and does work for you: tasks, notes and follow-ups happen right away with Undo; work orders, deals, leads, proposals, assigning techs and won/lost wait for you to tap Confirm. Brain: tap Brain to see what Lexi remembers — "Just for me" preferences and the shared company Brain (pricing, policies, scripts, how we write; admins and supervisors edit it). You can also say "remember that…" or "forget…". Inbox: ask "who's waiting on me?" — Lexi lists emails where you owe a reply and drafts replies in your voice (tap Copy draft). Recording: tap Recording, add an audio file (Plaud, phone voice memo) or paste a transcript; Lexi writes a summary, to-dos (tap Add tasks), a note to log on the deal, and a follow-up email to copy. I noticed: the Lexi home screen lists what needs you, most urgent first — late jobs, system problems, jobs waiting for a tech, emails you owe, overdue tasks, proposals about to expire and quiet deals. Tap Ask Lexi to work it, Open to go to it, or Later to hide it until tomorrow. Morning brief: turn on "Email me this brief every weekday at 6:30am" under that list, or tap Send me one now. Talk: tap Talk to speak hands-free — Lexi answers out loud and listens again; say confirm, skip, undo or stop. The speaker button in the chat box reads typed replies aloud. Live systems: ask "is the Marbella gate working?" or "which cameras are down at Riverwalk?" for live Brivo, Eagle Eye and Shelly status; Gate Guard admins can ask Lexi to open a gate or power-cycle a relay — it always waits for Confirm and is logged on the site timeline. Reports: ask "show my pipeline by rep", "pipeline by stage", "deals won by month", "jobs completed by tech", "open jobs by status" or "jobs created vs completed" — Lexi draws the chart, with a table view and CSV download. Coming soon: sending email, texting customers and calls.`,
  },
  {
    id: 'evening-review', title: 'Nightly review: close out today, plan tomorrow', where: 'Lexi tab → "Close out today · plan tomorrow"',
    keywords: 'nightly evening review close out end of day plan tomorrow top 3 accountable accountability bring list pack parts tomorrow leftover reschedule remind text tonight',
    text: `Lexi's evening routine keeps you on task. Open Lexi and tap "Start tonight's review", or turn on "Remind me every evening" (pick the time and evenings, add your cell for a text, and email if you want) — Lexi texts a link at that time. The review has four parts. 1) How today went: your top 3 from last night (done or not) and every task left over — tap Tomorrow, pick a day, Done, or No date so nothing is left hanging. 2) Tomorrow by area: Sales (follow-ups, calls and meetings due, proposals expiring, quiet deals), Operations (tomorrow's jobs, jobs with no tech, late jobs), Customers (emails you owe, open system problems), Dealers (onboarding not finished — corporate), Admin (tasks due tomorrow) and Money (cash, who owes us, bills, paid today, late invoices — QuickBooks numbers are corporate only), plus your calendar. Each area has "Ask Lexi". 3) Bring tomorrow: parts on tomorrow's jobs (with a warning if they're not ordered or still at the office), proposals for tomorrow's meetings, and your own "always bring" list — tick items off as you pack. 4) Your top 3 for tomorrow: Lexi suggests three, you change them, and "Commit to these" makes them high-priority tasks due tomorrow. The next night Lexi shows which ones got done. It's off until you turn it on.`,
  },
  {
    id: 'quickbooks', title: 'QuickBooks (Gate Guard corporate only)', where: 'Admin → QuickBooks (corporate only)',
    keywords: 'quickbooks qbo qb accounting books invoice sync payment customer match item product cash receivable payable aging profit loss p&l commission bill vendor connect disconnect',
    text: `Gate Guard's own QuickBooks company, for corporate users only. Open Admin → QuickBooks. 1) Connect: sign in to QuickBooks once (it stays connected about 100 days; reconnect when Nexus warns). 2) Settings: pick the date invoices start syncing from, the QuickBooks item to use when a line has no match, the income account for new items, where payments land, and (optional) the expense account for dealer commission bills. 3) Match customers: each property or client is linked to a QuickBooks customer — Auto-match links exact names, Create makes a new customer, or pick one from the list. 4) Match products: link catalog items to QuickBooks items (or Create). 5) Turn on automatic sync. Then: invoices sent from Nexus go to QuickBooks, payments (marked paid or paid by card/bank link) go to QuickBooks, payments and voids made in QuickBooks come back to Nexus, and invoices made in QuickBooks for linked customers show up in Nexus. It runs every 15 minutes (and right away when QuickBooks tells us something changed); "Sync now" runs it immediately. Problems (e.g. a customer not matched) are listed on the page with the reason. The Money section shows cash in the bank, money owed to us by age, bills we owe, and profit this month / last month / this year — Lexi can answer these too ("how much cash do we have?").`,
  },
  // Setup steps (one source: lib/setup-guides.ts — also the Setup tab and the How-to button).
  ...ALL_SETUP_GUIDES.map((g): GuideSection => ({
    id: g.id, title: `Set up: ${g.title}`, where: g.where,
    keywords: `${g.keywords} setup set up how to install connect add new site property feature`,
    text: setupGuideText(g),
  })),
]

/** Best-matching guide sections for a question (simple keyword scoring). */
export function searchGuide(question: string, limit = 3): GuideSection[] {
  const words = question.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2)
  const scored = NEXUS_GUIDE.map(s => {
    const hay = `${s.title} ${s.keywords} ${s.where}`.toLowerCase()
    const body = s.text.toLowerCase()
    let score = 0
    for (const w of words) { if (hay.includes(w)) score += 3; else if (body.includes(w)) score += 1 }
    return { s, score }
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score)
  return (scored.length ? scored : [{ s: NEXUS_GUIDE[0], score: 0 }]).slice(0, limit).map(x => x.s)
}
