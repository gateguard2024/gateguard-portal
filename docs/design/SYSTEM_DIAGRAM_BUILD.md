# Design — System Diagram Tool (Phased Build)

Goal: produce professional multi-zone system/wiring diagrams (like the Flint River
Apartments example) **with ease** — labeled zones, real device icons, color-coded
power/data/access wiring, and callouts (IP, port, program-to notes) — then save the
result as a site's as-built.

## Current state (keep — do not remove)
- `/design/floor-plans` (Fabric.js): device placement, orthogonal cable routing,
  camera FOV cones, rack diagrams, 28 device types, BOM, wire schedule, PNG export.
- "Add components onto a background image" mode: **~2/10 maturity**, in active use.
  This stays as its own mode. The new System Diagram mode is additive, not a replacement.

## Target (reference: Flint River diagram)
- Labeled **zone frames**: Leasing Office, Building 240, Entry Gate, Pole Enclosure,
  Old Call Box, etc. — containers you drop devices into.
- Real **proptech components**: UniFi Gateway, 8-port PoE switch, PoE inserters
  (+/++/+++), NanoStation/mesh, dome + bullet cameras; access-control single-door
  controller + slide-operator board; mag lock; Push-to-Exit; Knox box.
- **Color-coded connectors** with a legend: red = power, blue = data/PoE,
  green = access/relay, grey = signal. Orthogonal routing.
- **Callouts**: IP address, "Program to 192.168.1.x", port labels, N.C./COM.
- **Export** PNG/PDF and **save as the site's as-built**.

## Phases
- **Phase 1 (task #191)** — Component library + zone frames + colored connectors on
  the existing Fabric canvas, as a new "System Diagram" mode. Background-image mode
  preserved.
- **Phase 2 (task #192)** — Starter templates (e.g. "gated MDU + UniFi + gate
  controllers") + PNG/PDF export + save back to the site Design record as as-built.
- **Phase 3 (task #193)** — Snap connectors to device ports, auto-BOM from placed
  components, IP/port callouts, versioned Design record (floor plan → system design →
  as-built) linked to site + job.

## Decision (locked)
- **Icon style: HYBRID.** Clean line-symbols are the base for every device; each
  component supports an optional "product photo" toggle so a rep can flip to the
  real UniFi/board/camera render when they want the Flint-River look. The library is
  built symbol-first with a `photoUrl` slot per component.
