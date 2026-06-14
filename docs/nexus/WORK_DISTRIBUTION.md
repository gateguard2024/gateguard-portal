# Nexus Beta — Work Distribution Across LLMs (Claude / ChatGPT / Gemini)

> How to parallelize the build. Claude (this session) has the repo + tools + live context. ChatGPT/Gemini do **not** — they can only produce self-contained, paste-back artifacts from a clear spec. Assign accordingly.

---

## The rule of thumb

| Owner | Good for | Why |
|---|---|---|
| **Claude (here)** | Anything touching shared files, migrations + code together, permissions/scoping, nav refactor, wiring into existing surfaces, security model | Has repo access, can verify build, knows current state |
| **ChatGPT / Gemini** | One self-contained component or page from a spec; pure utilities; copy/content; visual mockups; static data | No repo access — output must be paste-ready and low-integration-risk |

**Outsource only if:** the task = one file (or a self-contained component), inputs are fully specifiable in a prompt, and integration is "drop it in + Claude wires it." If it needs to *read* other files to be correct, keep it with Claude.

---

## Open tasks — tagged

🟢 outsource-friendly · 🟡 outsource with a context pack · 🔴 keep with Claude

### Phase 1 — Dealer-safe launch
- 🔴 **Hide legacy / dealer-safe shell** — needs repo-wide audit of reachable routes + nav refactor (shared files). Claude.
- 🔴 **Nav redesign / Admin relocation** — edits shared `NexusHomeClient`, `PortalShell`. Claude.
- 🟡 **Lead attachments** — the *upload/preview UI component* can be drafted by ChatGPT/Gemini from the glass standard; Claude wires the API + storage + Lead Glass integration.
- 🔴 **Doc Portal P3 (proposals)** — touches quote send + the universal page + DB. Claude.

### Phase 2 — My Day
- 🟢 **To-Do glass board UI** (list + calendar views, filters) — self-contained component from spec; Claude wires to the tracker API.
- 🟢 **Calendar views UI** (day/week/month + list, color-coded) — self-contained; Claude wires data + hierarchy scoping.
- 🟡 **Messages UI shell** (Conversations / Needs Reply / Calls / Texts / Email) — UI from spec; Claude wires connectors.

### Phase 3 — Jobs
- 🟢 **Job board + Job detail glass UI** — self-contained from the glass standard; Claude wires `/api/nexus/jobs`.

### Phase 4 — Operations/Business
- 🟢 **Find Customer / Find Property search UI** — self-contained; Claude wires search APIs.
- 🟢 **Customer/Site detail glass UI** — self-contained from glass standard; Claude wires data.

### Phase 5 — Money/Docs
- 🟢 **Invoices / Renewals / Compliance board UIs** — self-contained from spec; Claude wires data.

### Phase 6 — Design & Systems
- 🟢 **Design + Systems card boards** (Site Design, Floor Plans, As-Builts; Gates, Cameras, Access, Networks) — self-contained boards; Claude maps to legacy data.

### Phase 7 — Command router
- 🔴 **Natural-language router** — needs the live route/action map + assistant tooling. Claude.

### Cross-cutting / content (great for ChatGPT/Gemini)
- 🟢 **KB how-to articles** (platform how-tos, field guides) — pure content; paste into KB.
- 🟢 **Email copy / proposal copy / onboarding wording** — pure content.
- 🟢 **Visual mockups** of a glass board before building (HTML/CSS) — design exploration.

---

## Context pack to paste into ChatGPT / Gemini

Paste this preamble before any outsourced UI task so the output matches Nexus:

```
You are building a single React (Next.js App Router, TypeScript, Tailwind) component for
"GateGuard Nexus" — a dark "glass" interface. Match this standard EXACTLY:

GLASS STYLE
- Dark portal background; frosted glass cards.
- Card: rounded-3xl, background rgba(255,255,255,0.035), border 1px rgba(255,255,255,0.08).
- Text: white at varying opacity (0.9 heading, 0.5 secondary). Accent brand blue #6B7EFF; cyan #00C8FF.
- Inline styles with rgba() are fine (the codebase uses them). Tailwind core utilities only (no custom config).
- Mobile-friendly; generous bottom padding (a fixed bottom nav must never cut content).

GLASS-PANE LAYOUT (when building a detail pane)
1. Big top card: object type, main name, company/site/context, location/status
2. Four quick facts (editable fields show a pencil icon)
3. Human detail blocks: Address, Needs/Interested In, Notes, People, Related object, Activity, Tasks, Attachments
4. Right action rail: most common action first, edit near top, clear status movement
5. Technical sections only if useful
6. Internal scroll + bottom padding

RULES
- 5th-grader simple. No backend jargon. No dead-end buttons.
- Plain-language labels. No legacy/admin styling.
- Component must be self-contained with NO required props (provide sane defaults / mock data),
  default export, and no external libraries beyond react + lucide-react.
- Put all data fetching behind a single async function stub named loadData() that returns mock data,
  so it can be wired to a real API later.

TASK: <describe the specific board/component, its cards, fields, and actions>
Return ONE .tsx file.
```

Then Claude (here) reviews the returned file, swaps `loadData()` for the real API, fixes lucide-react `require()` quirks, and wires it into the right surface.

---

## Handoff loop

1. You assign a 🟢 task to ChatGPT/Gemini with the context pack + the task's spec (from `NEXUS_BETA_HANDOFF.md`).
2. They return a self-contained `.tsx`.
3. Paste it back here; Claude integrates (API wiring, permissions, build verify, commit).
4. Tracker box gets ticked.

Keep 🔴 items sequential with Claude to avoid merge conflicts on shared files.
