# GateGuard Design Language — Apple-grade

> **North star: our interfaces should look and feel like Apple's (macOS / iOS).**
> Fortune-500 polished — the restraint of Apple, the precision of Amazon's console.
> A well-made instrument, never a cartoon. When in doubt, ask: *"Would this ship in
> macOS System Settings or an Apple pro app?"* If not, it's too loud.

This is the standard for **every** GateGuard surface — Portal, Property interface,
and Resident experience. New screens and restyles conform to it.

---

## The five rules

1. **Neutral canvas, one accent.** The interface is graphite and near-black. Color
   is earned, not sprinkled. Exactly **one** accent (system blue). Semantic colors
   (red / green / orange) appear only as small **status dots** or a single figure —
   never as filled badges, colored borders, or multiple saturated blocks competing.

2. **Semibold, not black.** Headings and numbers are **600** weight, tabular-nums,
   slightly tight tracking. Heavy 800/900 "extrabold" reads cartoonish — avoid it.
   Let size and spacing create hierarchy, not weight.

3. **Tight corners, hairline separators.** Cards 12px, controls/tiles 8–10px, pills
   6px. Rows divide with **1px hairlines** (`rgba(255,255,255,0.06–0.09)`), not gaps
   of colored chrome. No bubbly radii.

4. **Flat surfaces, no glow.** Elevated graphite panels with a subtle 1px top inset
   highlight and a soft shadow. **No** neon glow, no gradient-glass blur stacks, no
   colored box-shadows. Depth comes from value (lighter surface = closer), not light.

5. **Whitespace and one job per view.** Generous padding, clear single focal point,
   scannable. The squint test: the title and primary number should be the two things
   you can still read. Don't crowd a module so it buries its neighbors.

---

## Tokens (dark — the default)

```
Surfaces      bg      #000000        page
              surface #1C1C1E        cards
              surface2#2C2C2E        inner tiles, controls
Separators    hair    rgba(255,255,255,0.09)   /  hair2 rgba(255,255,255,0.055)
Text          ink     #F5F5F7        headings / primary
              ink2    rgba(235,235,245,0.60)    secondary
              ink3    rgba(235,235,245,0.30)    tertiary / captions
Accent        blue    #0A84FF        the one accent — primary buttons, links, active
Semantic      red     #FF453A   green #30D158   orange #FF9F0A   (status only, sparing)
Radii         card 12 · control 10 · tile 10 · pill 6
Type          -apple-system,"SF Pro Display","SF Pro Text",Inter,"Segoe UI",Roboto
              headings/numbers 600 · body 400–500 · letter-spacing -0.01em
              numbers: font-variant-numeric: tabular-nums; tracking -0.02em
Shadow        0 1px 0 rgba(255,255,255,0.03) inset, 0 6px 20px -8px rgba(0,0,0,0.5)
```

A light theme (Portal `#F8FAFC`, Customer portal) mirrors the same rules inverted:
white surfaces, `#F5F5F7` fills, graphite text, same single blue accent, same tight
radii and hairlines.

## Reference mock

`outputs/gg-myday-apple.html` is the canonical example (the My Day dashboard rebuilt
to this standard). Match its surfaces, weights, radii, and color discipline.

## Anti-patterns (what made earlier screens feel "cartoony")

- Saturated cyan/green/amber/violet all firing at once → pick neutral + one accent.
- 800-weight "extrabold" everywhere → drop to 600.
- Gradient-glass panels with blur + neon glow shadows → flat graphite + hairline.
- Pill badges on every row → status dots + muted label text.
- Big bubbly 18–22px radii → tighten to 12 / 10 / 6.
