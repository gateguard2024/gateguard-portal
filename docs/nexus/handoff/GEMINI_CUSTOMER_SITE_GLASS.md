# Handoff Brief — Gemini: Nexus Customer / Site finder + detail glass

> Paste this ENTIRE doc into Gemini. Return ONE self-contained `.tsx`. Claude wires it to real search APIs afterward. This is the Operations/Business → Customer Sites experience.

## Standard (match exactly)
GateGuard Nexus — dark frosted-**glass** UI. Next.js App Router, TypeScript, Tailwind **core utilities only** (no custom config, no UI libs).
- Cards/containers: `rounded-2xl`/`rounded-3xl`, bg `rgba(255,255,255,0.035)`, border `1px solid rgba(255,255,255,0.08)`.
- Text: headings `rgba(255,255,255,0.9)`, secondary `rgba(255,255,255,0.5)`, faint `rgba(255,255,255,0.34)`. Accents: brand `#6B7EFF`, cyan `#00C8FF`, violet `#8B5CF6`.
- Inline `style={{}}` rgba() fine. Mobile-friendly; end with `pb-28`. 5th-grader simple. Start with `'use client'`, default export, no required props, imports only `react` + `lucide-react`.

## Object-format rule (IMPORTANT — every Nexus object detail looks the same)
The detail pane MUST follow this exact layout (so customer, site, lead, job, etc. all feel identical):
1. **Big top card** — object type label, main name, company/site context, location/status.
2. **Four quick facts** row (e.g., units, open jobs, contacts, status). 4 columns.
3. **Human detail blocks** — Contacts · Properties/Sites · Open Jobs · Documents · Activity · Notes.
4. **Right action rail** — most common action first (Open jobs, Add contact, New quote, Add note), edit near top, clear labels.
5. Internal scroll + bottom padding.

## Task — `CustomerSiteFinder`
- A search box + two tabs: **Customers** and **Properties**.
- Typing filters a results list (client-side over mock). Each result row: name, company/address, a couple meta chips (units / open jobs / status).
- Click a result → opens the **detail glass pane** (the object-format layout above) for that customer or property.
- Detail pane "Back" returns to results. Action-rail buttons are stubs calling `onAction(name, id)` (console.log).

## Data contract
```ts
type Customer = { id: string; name: string; company?: string|null; email?: string|null; phone?: string|null; site_count: number; open_jobs: number; status: string; contacts: {name:string; role?:string; phone?:string}[]; sites: {id:string; name:string; address?:string; units?:number}[] }
type Property = { id: string; name: string; address?: string|null; management_company?: string|null; units?: number; gates?: number; cameras?: number; open_jobs: number; status: string; systems: string[] }
```
Provide `async loadCustomers()` (~8) and `async loadProperties()` (~8) returning realistic mock data so both tabs + detail panes are fully visible.

## Output rules
ONE `.tsx`, default export `CustomerSiteFinder`, no required props, all data behind `loadCustomers()`/`loadProperties()`/`onAction()` stubs, Tailwind core only, no localStorage.
