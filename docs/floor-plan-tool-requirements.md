# GateGuard Floor Plan Tool — Feature Requirements
*Research: Bluebeam Revu + System Surveyor | June 2026*

---

## What Makes Bluebeam Feel Professional

Bluebeam Revu is the AEC industry standard for PDF-based design markup. Its professional reputation comes from five things field teams trust unconditionally:

**Precision drawing controls.** Shift-lock constrains any line to 0°, 45°, or 90°. The full snap engine includes snap-to-grid, snap-to-content (PDF geometry), and snap-to-markup (other placed objects). Midpoint and intersection snaps give clean, aligned runs without counting pixels. Every measurement snaps to the PDF's underlying geometry — no freehand drift.

**PDF as the ground truth.** Bluebeam treats the PDF blueprint as the native canvas, not a background image. It reads the embedded page scale metadata when available, and when it isn't, you calibrate by clicking two known points (e.g., two ends of a labeled wall) and typing the real-world dimension. From that moment, every measurement tool, every symbol, and every area calculation is anchored to real-world feet or meters. You don't retype scale per session — it's saved in the document.

**Tool Chest + Dynamic Scaler.** The Tool Chest is a sidebar panel of reusable symbols (stamps, custom shapes, manufacturer icons). Symbols are saved at a reference scale. When you drop them onto a calibrated drawing at a different scale (1/4" vs 1/8"), the Dynamic Tool Set Scaler automatically resizes the symbol proportionally. One library serves every plan size.

**Measurement engine.** Length, area, perimeter, volume, count — all calculate against the calibrated scale. Estimators and PMs can hand off a PDF to the field with measurements already embedded and trusted, because every markup has a recorded user, timestamp, and is locked to the author's account. No one can quietly delete someone else's markup in a Studio Session.

**Studio Sessions (real-time co-markup).** Multiple reviewers join a cloud session and see each other's markups appear live. Each user's markups are color-coded and author-locked. A full activity log captures who added what and when. Guests can mark up without a paid license in view/comment mode. Sessions have permission tiers: some participants can add documents, others only markup, others read-only.

---

## What Makes System Surveyor Easy for Field Techs

System Surveyor was built from scratch for one persona: the security integrator walking a site with an iPad. Everything it does is optimized for that 45-minute site walk.

**Drag-from-sidebar device placement.** 100,000+ devices from real manufacturer catalogs (Axis, Genetec, HID, Allegion, LenelS2, etc.) live in a searchable sidebar. A tech finds the exact model being installed, drags it onto the floor plan, and it appears as the correct manufacturer icon — not a generic rectangle. The BOM is built automatically as devices are placed.

**Photo-per-device capture.** Tapping a placed device icon opens a note panel with a camera button. The photo is geotagged to that device's location on the plan, not lost in the camera roll. During installation, techs update photos again (as-installed vs. as-surveyed). The final report exports a photo tour in PDF — every device, every location, in sequence.

**Camera FOV visualization.** The Camera Advisor tool takes inputs (camera model, mount height, target distance, H/FOV angle, desired PPF at DORI resolution levels) and draws the actual coverage cone on the plan — to scale, with adjustable transparency. Blind spots are visually obvious. Changing the FOV angle rotates the cone live. This is the single most-used feature with clients in the room.

**System layers.** Access control, cameras, intercoms, and cable runs live on separate toggleable layers. A tech can show only the camera layer to a client, then add the access layer without redrawing anything.

**One-tap BOM export.** After placing all devices, the BOM is already built. Export as PDF or Excel for proposals and procurement. There's an API for pushing the BOM directly to estimating or CRM systems. No re-entry.

**Offline-first mobile.** The iPad app syncs on reconnect. Techs walk the site in airplane mode, work normally, tap sync when back in Wi-Fi range. The 2026 phone app (iOS + Android) extends this to every subcontractor — not just the tech with the iPad.

**Sharing with clients and subs.** A shareable link sends the full design with read-only or edit privileges. Clients can view the plan in a browser with no login, see device placements and coverage areas, and comment inline.

---

## GateGuard Feature Requirements

The target: Bluebeam's measurement discipline and document fidelity, System Surveyor's speed-of-placement and field UX. The user is a GateGuard technician or salesperson doing a site walk at a multi-family property, gate entry, or commercial building.

### 1. Floor Plan Import and Scale Calibration

- Accept PDF upload as the base layer; render at full resolution, pannable and zoomable
- On import, attempt to read embedded PDF page scale metadata automatically
- If metadata is absent, present a calibration flow: user clicks two points on the plan and types the real-world distance (e.g., "50 ft") — all subsequent measurements and device icons use this scale
- Display current scale (e.g., "1/8\" = 1'-0\"") persistently in a status bar
- Support common architectural scales as presets: 1/4", 1/8", 1/16", 1:100, 1:200
- Allow per-page scale (multi-building plans often mix scales across pages)

### 2. Drawing and Markup Tools

- Line, polyline, rectangle, circle, arc, cloud markup tools
- Shift-key orthogonal lock: constrains any line to 0°, 45°, or 90° increments while Shift is held
- Grid overlay with configurable spacing (default 1 ft at current scale); snap-to-grid toggle
- Snap-to-content: cursor snaps to PDF geometry (walls, door edges) when within threshold pixels
- Snap-to-object: cursor snaps to previously placed device icons and markup endpoints
- Midpoint and intersection snap indicators (visible crosshair or highlight on hover)
- Cable/conduit run tool: polyline with configurable line weight and color per cable type (CAT6 = blue, coax = black, 2-wire = red, fiber = orange)
- Auto-length label on cable runs showing real-world feet pulled from calibrated scale

### 3. Device Icon Library

- Sidebar panel with GateGuard-specific device categories: Gate Operators, Access Control (readers, keypads, intercoms), Cameras, Alarm Devices, Infrastructure (panels, NVR/DVR, switches)
- Each category has icons matching physical form factors (pan/tilt camera vs. bullet vs. fisheye; slide gate vs. swing gate vs. barrier arm)
- Icons sized proportionally on the plan based on calibrated scale; maintain correct relative size when zooming
- Drag from sidebar to canvas to place; single tap on mobile
- Search within library by device name, model number, or manufacturer
- "Recently Used" rail at top of sidebar for repeat placements
- Admin-uploadable custom icons (SVG) for non-standard devices or client-specific equipment

### 4. Device Notes and Photo Capture

- Tapping a placed device opens a slide-up panel with: device name (editable), model/part number, quantity override, notes field, status (Surveyed / Ordered / Installed / QC'd)
- Camera button in device panel: captures or attaches photo, stored against that device icon (not the general project gallery)
- Multiple photos per device (before/after, angle shots)
- Photo tour export: all devices in plan order, each with photo and notes, exported as PDF
- GPS coordinate capture when photo is taken on mobile (for outdoor gate or entry point verification)

### 5. Camera FOV Visualization

- When a camera icon is selected, a FOV cone overlay appears showing horizontal field of view
- Adjustable parameters: H/FOV angle (10°-180° slider), depth of coverage (in real-world feet from calibrated scale), rotation handle on canvas
- Coverage cone fill: semi-transparent (default 25% opacity), color-coded by camera type (fixed = blue, PTZ = teal, fisheye = purple)
- Blind spot detection: if two cones share a coverage zone, highlight overlap in green; uncovered doorways or corners get a subtle red halo
- Toggle FOV cones on/off globally (for clean plan export)

### 6. System Layers

- Layer panel (minimum): Cameras, Access Control, Gate Operators, Cable Runs, Intercoms, Notes/Annotations
- Each layer is independently visible/hidden and lock-able
- Device icons placed into the correct layer automatically by device category
- Layer visibility state is saved per user session and restored on reopen
- Export: choose which layers to include in PDF export (e.g., camera-only export for client review)

### 7. Bill of Materials (Auto-Generated)

- BOM builds automatically as devices are placed; updates live
- Columns: Device Name, Model/Part Number, Quantity, Unit Price (pulled from GateGuard product catalog), Line Total
- Tapping the BOM row jumps to that device's location on the plan
- Export BOM to: PDF (formatted proposal-ready), CSV (for procurement), or push directly to a new GateGuard Quote (pre-populated line items via the existing `/api/quotes` POST endpoint)
- Quantities are driven by the canvas — deleting a device icon removes it from the BOM automatically

### 8. Collaboration and Sharing

- Each floor plan design is saved to a site record (links to `/sites/[id]` — the "Design" tab)
- Share link generates a public read-only view (no login required for clients); full canvas, device icons, and FOV cones render in browser
- Internal collaboration: multiple portal users can open the same plan; changes sync in near-real-time (WebSocket or Supabase Realtime on the `floor_plan_devices` table)
- Comment pins: click anywhere on the plan to drop a comment (author + timestamp); visible in a scrollable sidebar list
- Markup audit log: records every device placement, deletion, and note edit with user and timestamp

### 9. Design State Lifecycle

Three named states per design record — not separate tools, just a status on the same canvas:

| State | When | What's Locked |
|-------|------|--------------|
| Floor Plan | Site walk / pre-design | Nothing — full edit |
| System Design | Pre-install, approved | Device positions locked; notes still editable |
| As-Built | Post-install, QC'd | Full lock; changes require re-open with reason |

Status badge visible in the top bar; transition buttons (e.g., "Finalize as System Design") require confirmation. As-Built generates a timestamped, watermarked PDF snapshot automatically.

### 10. Export Formats

- PDF: current view (active layers) with optional GateGuard branding, scale bar, and north arrow
- PDF — Photo Tour: all placed devices in canvas order, each with attached photos and notes
- PDF — As-Built: watermarked "AS-BUILT — [Date] — [Tech Name]" with all layers, measurements annotated
- BOM export: PDF or CSV
- Push to Quote: one-click creation of a draft quote from the BOM (calls existing `/api/quotes` POST)

### 11. Mobile/iPad Experience

- Fully functional on iPad Safari and the Vercel-hosted portal (PWA installable via existing manifest)
- Sidebar collapses to a bottom sheet on mobile; device library accessible via floating "+" button
- Touch-optimized: pinch-to-zoom, two-finger pan, tap-to-select, long-press for device context menu
- Offline mode: plan and placed devices cached locally; sync on reconnect (Supabase offline queue or service worker)
- Camera access for photo capture uses `getUserMedia()` — no native app required

---

*This document should be revisited after a prototype sprint and updated with implementation findings.*
