# Handoff Brief — Gemini/ChatGPT: Nexus Messages connector-setup glass pane

> Paste this ENTIRE doc into Gemini (or ChatGPT). Return ONE self-contained `.tsx`. Claude wires it to the real API afterward. This is the **Messages → Connect a mailbox** experience (settings pane inside the Messages shell).

## Standard (match exactly)
GateGuard Nexus — dark frosted-**glass** UI. Next.js App Router, TypeScript, Tailwind **core utilities only** (no custom config, no UI libs).
- Cards/containers: `rounded-2xl`/`rounded-3xl`, bg `rgba(255,255,255,0.035)`, border `1px solid rgba(255,255,255,0.08)`.
- Text: headings `rgba(255,255,255,0.9)`, secondary `rgba(255,255,255,0.5)`, faint `rgba(255,255,255,0.34)`. Accents: brand `#6B7EFF`, cyan `#00C8FF`, emerald `#34D399` (success), amber `#FBBF24` (warning), red `#F87171` (error).
- Inline `style={{}}` rgba() fine. Mobile-friendly; end with `pb-28`. **5th-grader simple.** Start with `'use client'`, default export, no required props, imports only `react` + `lucide-react`.

## What this pane is
A simple settings panel where a non-technical user connects an email mailbox so Nexus can send (and later receive) email. Two ways to connect:
1. **Connect Gmail** — one big friendly button. Clicking it just navigates the browser to an OAuth URL (Claude provides it). No form.
2. **Connect other email (SMTP)** — a short form for people whose email isn't Gmail (Outlook, GoDaddy, company server, etc.).

Plus a list of already-connected mailboxes, each with a "Send test" button and a "Remove" button.

## Layout (top to bottom)
1. **Header** — title "Connected mailboxes", one-line plain-English subtitle ("Connect an email account so Nexus can send messages for you.").
2. **Connected list** — one glass row per connected mailbox: an icon (Gmail vs SMTP), the email address, a small status chip (**Connected** emerald / **Needs attention** amber), "last verified" relative time if present, and two actions: **Send test** and **Remove**. If none connected, a friendly empty state.
3. **Add card(s)** — the big **Connect Gmail** button, then a collapsible **"Connect a different email"** section that expands the SMTP form.
4. SMTP form fields (plain labels, helper text under tricky ones):
   - Email address (the address mail is sent from)
   - Display name (optional — "what people see in the From line")
   - SMTP server / host (helper: "e.g. smtp.office365.com")
   - Port (helper: "usually 465 or 587") — a small select/segmented: 465 (SSL) / 587 (STARTTLS)
   - Username (helper: "usually your full email address")
   - Password / app password (type=password; helper: "many providers require an 'app password', not your login password")
   - **Save mailbox** button (disabled until host+port+username+password+email filled).
5. After "Send test": show an inline result line — emerald "Test email sent to you@example.com ✓" or red error text. After "Save mailbox": optimistically add it to the list.

Keep it calm and roomy. No tables. No dense borders. This should feel as clean as the dashboard cards.

## Data contract (Claude will replace the stubs with these exact calls)
```ts
type Connector = {
  id: string
  channel_type: 'gmail' | 'smtp'
  display_name: string
  email: string | null
  smtp_host: string | null
  smtp_port: number | null
  connected: boolean          // gmail authorized OR smtp configured
  last_synced_at: string | null
  created_at: string
}

// GET  /api/nexus/messages/channels                -> { channels: Connector[] }
async function loadConnectors(): Promise<Connector[]>

// POST /api/nexus/messages/channels                -> { channel: Connector }
//   body: { display_name, host, port, secure, user, pass, from_address }
async function addSmtp(form): Promise<Connector>

// DELETE /api/nexus/messages/channels?id=<id>      -> { ok: true }
async function removeConnector(id: string): Promise<void>

// POST /api/nexus/messages/channels/test           -> { ok: boolean, sent_to?, error? }
//   body: { channel_id }
async function testConnector(id: string): Promise<{ ok: boolean; sent_to?: string; error?: string }>

// Connect Gmail = navigate the browser to this URL (no fetch):
const GMAIL_CONNECT_URL = '/api/nexus/messages/google/connect'
// onConnectGmail() should do: window.location.href = GMAIL_CONNECT_URL
```
For the mockup, implement the four async functions with `await new Promise(r=>setTimeout(r,300))` + realistic in-memory data (start with ~2 connectors: one Gmail "ops@stonegate.com" connected, one SMTP "billing@gateguard.co"). `addSmtp` pushes a new row; `removeConnector` filters it out; `testConnector` returns `{ ok:true, sent_to:'you@gateguard.co' }`. Keep all state in React `useState` — **no localStorage**.

## Output rules
ONE `.tsx`, `'use client'`, default export `MessagesConnectorPane`, no required props, all data behind the stub functions above, Tailwind core utilities only, imports only `react` + `lucide-react`. If you use any of these lucide icons, import them via `require('lucide-react')` instead of named import (Vercel cache quirk): `ArrowLeft, AlertCircle, Trash2` are fine as named; if unsure, prefer `Mail, Plus, Check, X, Loader2, Send, Trash2, Shield` (all safe named imports).
