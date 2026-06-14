# Handoff Brief — Gemini: Nexus Messages shell component

> Paste this ENTIRE document into Gemini. It returns ONE self-contained `.tsx` file. A separate engineer (Claude) will wire it to the real connectors afterward — your job is the UI + interactions on mock data.

---

## Who/what this is for

You are building one React component for **"GateGuard Nexus"** — a dark, frosted-**glass** interface (Next.js App Router, TypeScript, Tailwind core utilities only — no custom Tailwind config, no external UI libraries). The component is the **Messages** experience for the "My Day" tab.

## Glass visual standard (match exactly)

- Dark translucent surfaces on a transparent page background (parent provides the dark gradient).
- Cards/containers: `rounded-3xl` / `rounded-2xl`, background `rgba(255,255,255,0.035)`, border `1px solid rgba(255,255,255,0.08)`.
- Text: headings `rgba(255,255,255,0.9)`, secondary `rgba(255,255,255,0.5)`, faint `rgba(255,255,255,0.34)`.
- Accents: brand blue `#6B7EFF`, cyan `#00C8FF`, emerald `#34D399`, violet `#8B5CF6`.
- Inline `style={{ ... }}` with rgba() is fine and common here. Tailwind core classes for layout.
- Mobile-friendly. End the component with `pb-28` so a fixed bottom nav never covers content.
- 5th-grader simple. Plain labels. No backend jargon. **Do NOT expose connector/backend names** (no "IMAP/SMTP/Twilio") in the UI — users think in Conversations, Calls, Texts, Email.

## The task — Messages shell

Build `MessagesShell`: a two-pane (responsive: list collapses on mobile) messaging hub.

**Left: filter rail + conversation list**
- Filter tabs with counts: **All · Needs Reply · Calls · Texts · Email · Follow-ups**.
- Conversation rows: contact name, company (optional), last-message preview, channel icon (phone/sms/email), relative time, unread dot, and a small "Needs reply" tag when applicable.
- Search box at top (filters the list client-side).

**Right: conversation thread**
- Header: contact name + company + channel.
- Message bubbles in time order (inbound left, outbound right), each with timestamp; calls render as a call record row (direction + duration) rather than a bubble.
- A reply composer at the bottom: a textarea + Send button (channel-aware placeholder, e.g., "Reply by text…"/"Reply by email…"); calls a stub `onSend(conversationId, text)` (console.log) then clears.
- Quick actions above the composer: **Mark replied**, **Add follow-up**, **Open contact** — all stubs (console.log).
- Empty state when no conversation is selected ("Pick a conversation").

## Data contract (so it wires up later)

Provide an async stub `loadConversations()` returning mock data shaped like this:

```ts
type Channel = 'call' | 'text' | 'email'
type Message = {
  id: string
  direction: 'in' | 'out'
  channel: Channel
  body: string            // for calls: a short summary
  at: string              // ISO timestamp
  duration_secs?: number  // calls only
}
type Conversation = {
  id: string
  contact_name: string
  company?: string | null
  channel: Channel
  preview: string
  unread: boolean
  needs_reply: boolean
  last_at: string         // ISO timestamp
  messages: Message[]
}
```

Seed ~8 mock conversations across all channels, some unread, some needs_reply, with a few messages each (include at least one call record with a duration).

## Output rules

- Return **ONE** `.tsx` file, default export `MessagesShell`, **no required props** (all mock internally).
- Imports: only `react` and `lucide-react`.
- No localStorage/sessionStorage. No data libraries. Tailwind core utilities only.
- Keep all data access behind `loadConversations()` / `onSend()` and the action stubs so it can be wired to the real connectors later.
- Start the file with `'use client'`.
