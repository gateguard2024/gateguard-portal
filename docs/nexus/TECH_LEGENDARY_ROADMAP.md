# /tech → Legendary: Diagnosis + "Many Levels Up" Roadmap

North star: **so easy a 5th-grader can (1) use it, (2) solve any field issue, (3) understand everything shown, (4) follow full step-by-step install / service / diagnosis — with warnings, real images from manual + web, and more.**

---

## A. Diagnosis of the tool today (honest)

**What's already strong (keep + build on):**
- AI manual-backed diagnostics (`/api/kb/ask`): vector search over `manual_chunks` + per-device **terminal maps** (`device_suggestions`) → returns one structured step at a time `{type, text, detail, unit, expected, choices, manual_ref}`. This is the hard part, and we're ahead of most of the market here.
- Color-coded step types (VERIFY/ACTION/MEASURE/RESOLVED/ESCALATE), measure inputs, photo-capture diagnosis (`analyze-image`), wiring/cable guides, scan-to-asset, pre-job brief, offline-first.

**Gaps vs the 4 goals (what makes it *not yet* legendary):**
1. **Text-only. No images in steps.** `manual_chunks` are text; steps *cite* a page (`manual_ref.url/page`) but never *show* the diagram or part. A 5th-grader needs to **see** the J2 terminal, not read "J2."
2. **Diagnose-only.** There is no full guided **Install** or **Service/PM** procedure — only symptom triage. The user wants all three, step by step.
3. **Warnings aren't visually loud.** No DANGER/WARNING/CAUTION panels, no spring-tension / high-voltage / LOTO emphasis.
4. **Reading level is technical**, not 5th-grade. Steps say "isolation test," "obstruction terminal pair."
5. **Coverage gap.** Devices without a vectorized manual get thinner help; no on-the-fly ingest.
6. **Trust/clarity extras missing:** no inline tappable citation, no read-aloud/voice, no "explain simpler," no tools/parts/time up front, no confidence + clean escalate-with-context.

---

## B. The "legendary step" — the unit everything builds on

Adopt the **iFixit/Dozuki + ANSI Z535.6** anatomy. Every step:

```
Step {
  n, title,                 // imperative, <20 words, 5th-grade (Flesch-Kincaid ≤6)
  instruction,              // one action only
  image,                    // ALWAYS: a manual figure OR web part image OR annotated photo
  annotations[],            // arrows/circles/number-balloons on the image, color-matched to text
  tools_needed[], parts_needed[], est_minutes,
  spec_callouts[],          // torque / gauge / voltage / distance chips
  safety: SafetyMessage[],  // ANSI Z535.6, rendered ABOVE the action
  verification,             // every step ends in a check (expected value/range, pass/fail)
  branches?,                // diagnosis: condition → next | ESCALATE
  citation,                 // "LiftMaster manual p.42" — tappable, opens the figure
}
SafetyMessage { signal_word: DANGER|WARNING|CAUTION|NOTICE, hazard, consequence, avoidance }
```

Signal-word panels: **DANGER** `#C8102E`/white · **WARNING** `#FF6900`/black · **CAUTION** `#FFD100`/black · **NOTICE** `#0072CE`/white. Status must always be **color + icon + word** (never color alone). One action + one annotated photo per step is the single highest-value change for a novice.

---

## C. Three modes (not just diagnose)

- **INSTALL** — pre-job (tools/parts/PPE/grouped safety) → **Mount → Wire → Power → Configure/Commission → Test** → Definition of Done = the **UL 325 2-second obstruction-reversal test + two entrapment means per zone** (block WO close until pass) → sign-off.
- **SERVICE / PM** — inspection checklist, measurements **with expected ranges** (loop mA, supply V, gate force), lube/clean, monthly safety-device test, pass/fail closure.
- **DIAGNOSE** — current engine, upgraded: **Symptom/photo/code → isolate → measure → confirm → fix → verify**, ranked causes + recommended part (Aquant pattern), one question at a time, ESCALATE branch.

Any energized or spring step auto-injects the **OSHA 8-step Lockout/Tagout** subroutine (step 6 explicitly: restrain spring tension).

---

## D. Images — the make-or-break (copyright-clean)

**Primary = our own manuals (no copyright issue):** at ingest, render every PDF page to a PNG (PyMuPDF `get_pixmap` — catches *vector* schematics that image-extraction misses), then a **Claude-vision figure picker** returns bounding boxes + caption + type (wiring/dimension/photo) → crop at high DPI. Store a `manual_figures` table `{manual_id, page, section, bbox, type, caption, image_url}` and embed captions so a step can retrieve "wiring diagram for X." Add `page_image_url` to each `manual_chunk` so any cited step can show its source page.

**Secondary = web part images (provenance-tracked):** prefer the **manufacturer's official spec-page image**; fall back to a license-filtered search (Brave Search API is the durable choice — Bing API is dead, Google CSE is sunsetting). Always store source URL + license.

---

## E. Presentation for a 5th-grader

- Imperative, <20-word steps; jargon defined inline (plain word first, tech term in parens / tap-to-define).
- **Read-aloud (TTS)** each step + hands-free **"done / next / didn't work"** voice flow (one step at a time).
- **"Explain simpler"** toggle (progressive disclosure: simplest first, "why/more" on tap).
- Front-load **difficulty + tools/parts + time**; show **"Step X of N"** progress; put error-recovery right on the step ("If it doesn't move, check…").
- **Inline tappable citation** on every AI step (biggest trust win — we already have the manuals).
- **Confidence-gated escalation**: high → answer; vague/sensory symptom or out-of-range → "Call a senior" carrying the full session (photos, codes, steps tried) — no re-explaining.

---

## F. Phased build plan (impact ÷ effort) — additive, nothing removed

**Phase A — Make every step show an image + a louder warning (highest impact).**
- Migration: `manual_figures` + `manual_chunks.page_image_url`. Ingest pipeline: page-render + vision figure picker (server-side, at manual upload).
- `kb/ask` returns `image_url` (figure) + structured `safety`; diag UI renders the image, ANSI safety panel, and a tappable citation. *Effort: M–L. The legendary leap.*

**Phase B — Plain-language + read-aloud + "explain simpler" + tools/time header.** *Effort: S–M, mostly UI + a prompt tune to 5th-grade.*

**Phase C — INSTALL & SERVICE/PM modes** using the step schema + playbooks we already have; Definition-of-Done gate (UL 325 test) on install. *Effort: M.*

**Phase D — Ranked-cause diagnosis + confidence + clean escalate-with-context** (voice "done/next/didn't work"). *Effort: M.*

**Phase E — Universal coverage:** if a device has no vectorized manual, ingest it on the fly (ties to the **Product Intake / Part-Finder** backlog: web-find part → confirm → add to `products` → vectorize manual → extract figures → wire paths → pricing/distributor).

**Phase F — Web part images** (provenance-tracked) + AR see-what-I-see on escalation (integrate TeamViewer/SightCall, phone-only telestration). *Effort: F = S; AR = L/integrate.*

---

## G. Who to copy for each piece
- **iFixit / Dozuki** — step anatomy, photo-per-step, tools/difficulty up front, color-matched markers.
- **ServiceTitan Atlas** — inline cited answers (>85% accuracy bar).
- **Aquant** — ranked cause + "replace this part," skill-aware, one triage question at a time, voice.
- **XOi** — nameplate/photo as the diagnostic entry; auto work summary (→ our `/api/kb/resolve` loop).
- **Salesforce Einstein** — photo→steps, on-device/offline.
- **ANSI Z535.6 / OSHA 1910.147 / UL 325** — safety panels, LOTO subroutine, commissioning Definition-of-Done.

**Recommended first build: Phase A** — it converts the tool from "reads like a manual" to "shows you exactly what to do," which is the difference between competent and legendary, and it reuses the manual corpus we already vectorized.
