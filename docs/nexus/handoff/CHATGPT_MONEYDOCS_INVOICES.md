# Handoff Brief — ChatGPT: Nexus Invoices board

> Paste this ENTIRE doc into ChatGPT. Return ONE self-contained `.tsx`. Claude wires it to the real billing API afterward (Money/Docs → Invoices).

## Standard (match exactly)
GateGuard Nexus — dark frosted-**glass** UI. Next.js App Router, TypeScript, Tailwind **core utilities only** (no custom config, no UI libs).
- Cards: `rounded-2xl`/`rounded-3xl`, bg `rgba(255,255,255,0.035)`, border `1px solid rgba(255,255,255,0.08)`.
- Text: headings `rgba(255,255,255,0.9)`, secondary `rgba(255,255,255,0.5)`, faint `rgba(255,255,255,0.34)`. Accents: brand `#6B7EFF`, emerald `#34D399` (paid), amber `#F59E0B` (due), red `#F87171` (overdue).
- Inline `style={{}}` rgba() fine. Mobile-friendly; end with `pb-28`. 5th-grader simple. Start `'use client'`, default export, no required props, imports only `react` + `lucide-react`.

## Task — `InvoicesBoard`
- Top: four **summary tiles** (4-column grid): Open total, Overdue total, Paid (this month), Count — each a glass tile with a number + label.
- Filter chips: **All · Open · Overdue · Paid** (client-side filter).
- Invoice list rows: invoice #, customer/property, amount, due date, a status pill (Open/Overdue/Paid colored per above), and a row click → glass detail popover with: customer, property, amount, status, due date, and stub buttons **Send invoice**, **Mark paid**, **Add note** (call `onAction(name, id)` → console.log).
- Empty states per filter.

## Data contract (real billing shape)
```ts
type Invoice = {
  id: string
  invoice_number: string
  customer_name: string | null
  property_name?: string | null
  amount: number
  status: 'open' | 'overdue' | 'paid' | 'draft' | 'void'
  due_date: string | null   // YYYY-MM-DD
  sent_at?: string | null
}
```
Provide `async loadInvoices(): Promise<Invoice[]>` returning ~10 mock invoices across statuses (some overdue, some paid). Format money as USD.

## Output rules
ONE `.tsx`, default export `InvoicesBoard`, no required props, all data behind `loadInvoices()`/`onAction()` stubs, Tailwind core only, no localStorage.
