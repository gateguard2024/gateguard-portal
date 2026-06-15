# Handoff Brief — Gemini: Nexus Messages, REDESIGN (clean, email-first, 5th-grader simple)

> Paste this ENTIRE doc into Gemini. Return ONE self-contained `.tsx`. Claude wires it to the real API afterward. This REPLACES the current Messages screen, which is too crowded/confusing.

## The problem to fix
The current Messages screen mixes calls/texts/email with too many filters (All · Needs Reply · Calls · Texts · Email · Follow-ups) and feels busy. **Email is the only live channel right now.** Make it dead-simple: an inbox you can read and reply to. Calls/texts come later — leave them out.

## Standard (match exactly)
GateGuard Nexus — dark frosted-**glass**. Next.js App Router, TS, Tailwind **core utilities only**.
- Cards: `rounded-2xl`/`rounded-3xl`, bg `rgba(255,255,255,0.035)`, border `1px solid rgba(255,255,255,0.08)`.
- Text: headings `rgba(255,255,255,0.9)`, secondary `rgba(255,255,255,0.5)`, faint `rgba(255,255,255,0.34)`. Accent brand `#6B7EFF`, unread dot `#6B7EFF`, success `#34D399`.
- **5th-grader simple + roomy.** Start `'use client'`, default export, no required props, imports only `react` + `lucide-react`.
- **PWA-contained:** root `className="flex w-full h-[78dvh] overflow-hidden rounded-2xl"` with internal scroll. Renders inside a shell that already shows the page title "Messages" — do NOT repeat a big title.

## Layout (two simple panes; on mobile show list, tap → reading view)
- **Left — Inbox list (≈360px):**
  - A slim top row: a small **search** box, a **Sync** button (circular refresh icon), and a **Connect** button (gear/plus) — that's it. NO big filter row. At most ONE toggle: "All / Unread".
  - Below: conversation rows. Each row = sender name (bold if unread), one-line subject/preview, relative time, and a small brand-blue dot if unread. Clean, generous spacing.
  - Empty state (friendly): "No emails yet. Click Connect to add your inbox, then Sync." with a Connect button.
- **Right — Reading pane:**
  - Header: sender name + email + subject.
  - Body: the messages in the thread as simple stacked bubbles (inbound left/neutral, outbound right/brand). Show date/time under each.
  - Bottom: a simple reply box (textarea + Send). One line of help: "Replies send from your connected email."
  - Empty state: "Pick an email to read."

Keep it calm: lots of whitespace, no nested bordered boxes, no badges soup.

## Data contract (Claude wires these EXACT calls)
```ts
type Msg = { id: string; direction: 'in' | 'out'; body: string; at: string }
type Conversation = {
  id: string
  contact_name: string
  contact_address?: string | null   // email to reply to
  channel_id?: string | null        // which mailbox
  subject?: string | null
  preview: string
  unread: boolean
  last_at: string
  messages: Msg[]
}
// GET  /api/nexus/messages/threads        -> { conversations: Conversation[] }
async function loadConversations(): Promise<Conversation[]>
// POST /api/nexus/messages/sync {inline:true}  -> { ok, fetched }   (pull new email)
async function syncInbox(): Promise<{ fetched: number }>
// POST /api/nexus/messages/send  {channel_id, to, thread_id, subject, text} -> { ok }
async function sendReply(conv: Conversation, text: string): Promise<boolean>
// Connect button => navigate to the connector pane (Claude wires; use onConnect())
function onConnect(): void
```
Mock: `loadConversations` returns ~5 email conversations (mixed read/unread, 1–3 messages each). `syncInbox` resolves `{fetched:0}`. `sendReply` optimistically appends an outbound message. **No localStorage.**

## Output rules
ONE `.tsx`, `'use client'`, default export `MessagesShell`, no required props, all data behind the stubs above, Tailwind core only. Safe lucide named imports: `Search, Mail, Send, Settings, Check, RefreshCw, ChevronLeft`. Use `ArrowLeft` via `require('lucide-react')` if needed.
