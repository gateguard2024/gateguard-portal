# /tech Field Tool — Bug + Glass Cleanup Audit

> Goal: make `/tech` (the field-technician PWA) match the Nexus glass look and be "so easy a 5th grader can use it." `/tech/page.tsx` is ~3,780 lines, one screen-state machine. Screens: `pin · identity · home · choice · symptom · diag · wiring · cable · install · survey · survey_add · survey_transcript · training · training_course · netscout · jobs`.

## 1. Functional bugs (fix first)

1. **`alert()` on server error** (`~750`) — native browser alert breaks the app feel. Replace with an in-app glass error banner.
2. **Silent fetch failures / infinite spinners** — products load (`~629`), tech identity (`~742`), resolution submit (`~824`), proposal generate (`~2733`) all `.catch(() => {})` with no error UI. A network blip = stuck "Loading…/Saving…" forever. Add error state + Retry.
3. **GPS keeps pinging after permission denied** (`~708`) — pings call geolocation without checking `gpsGranted`; fails silently forever.
4. **Stale closures / overlapping requests** — image analysis (`~844`) and diagnostic step fetch (`~762`) aren't cancelled on unmount or double-tap; a fast Retry can fire two requests and overwrite the result. Add an AbortController + disable Retry while pending.
5. **No logout / no session expiry** (`~593`) — tech code lives in sessionStorage with no expiry and no sign-out button on any screen.
6. **Deep screens can feel like dead-ends** — `survey_transcript` / `survey_add` Re-enter/back controls scroll out of view; make the back action sticky.

## 2. Design — align to Nexus glass

`/tech` is already dark-navy, but it's **flat**, not glass, and off-palette:

- **No translucency/blur.** Cards use solid `C.bgCard (#0E1729)`. Nexus = `rgba(255,255,255,0.04)` + `1px solid rgba(255,255,255,0.08)` + `backdropFilter: blur(...)`, radius 18.
- **No cyan.** Everything defaults to brand blue `#6B7EFF`; Nexus pairs it with `#00C8FF`. (Survey screens even use a one-off teal `#2DD4BF`.)
- **Mono overused.** IBM Plex Mono on titles, job cards, nav labels (8px) — robotic and hard to read in sunlight. Use Inter for titles/body; keep mono only for small labels, codes, meter readings, badges.
- **Inconsistent radii/borders/padding** — cards 14/16/18, buttons 8/10/12, pills 20 vs 999; padding 13/16 mixed.
- **Flat top bars** (`#040810`) vs the glass headers used elsewhere.

**Highest-leverage fix:** these all flow from the shared `C` palette and `S` style objects near the bottom of the file. Add `glass`, `glassBorder`, `cyan` tokens + shared `glassCard` / `btnPrimary` / `btnGlass` styles once and most screens inherit the new look.

## 3. 5th-grader simplicity

- **Home has 7 equal-weight nav tabs** (Diagnose / My Jobs / Wiring / Cable / Survey / NetScout / Train) — no primary, no guidance. Promote Diagnose + My Jobs; tuck the rest behind "More."
- **Jargon labels** → plain English: "SELECT MODE" → "What do you need?", "DESCRIBE THE FAULT" → "What's not working?", "INITIALIZE DIAGNOSTIC" → "Start diagnosis", "LOG LABOR" → "Time spent (hours)", "METER SETUP" → "How to use your multimeter".
- **Tiny tap targets** — 8–9px nav/condition labels, native checkboxes; bump to ≥44px, bigger icons, custom checkboxes (gloves-friendly).
- **No progress sense** — diagnostic progress bar jumps erratically; add "Step X of ~Y" and step labels on symptom/survey flows.
- **Disabled-button mystery** — the job "Complete" lock shows 🔒 but not a plain reason; spell it out.

## 4. Prioritized plan

**Phase 1 — Critical bugs (~2h):** replace `alert()` with glass banner; add error+Retry states to the 4 silent fetches; gate GPS on `gpsGranted`; AbortController + disable-while-pending on diag/image fetches; add a sign-out.

**Phase 2 — Glass restyle (~8h):** add glass/cyan tokens to `C`; shared `glassCard`/`btn*` styles in `S`; convert cards, top bars, search bar, device/survey rows; standardize radius (18 cards / 12 buttons / 999 pills); titles → Inter.

**Phase 3 — Simplicity (~7h):** trim home nav to 3 + More; plain-English labels; ≥44px tap targets + custom checkboxes; progress indicators; clear disabled-reasons; sticky back on deep screens.

**Phase 4 — Optional (~7h):** extract `C`/`S` to `styles.ts` (shared with WiringGuide/CableGuide); `useReducer` for diagnostic state; ARIA labels.

Worst screens by issue count: **home**, **diag**, **survey/survey_add/survey_transcript**, **jobs**.
