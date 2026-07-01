# Design Tool — Build Journal (observations from reference images)

Every detail pulled from the reference images (Flint River finished sheet + System
Surveyor screens). This is the spec the rebuild is measured against. Look = the dark-glass
mockup already approved (design_tool_rebuild_plan_v2).

---

## A. Target output — Flint River finished sheet (the "professional" bar)
- **Title block:** property name, full address, small aerial thumbnail with a location pin.
- **Zones as bordered boxes**, each labeled: Leasing Office, Building 240, Exit Gate & Ped
  Gate, Entry Gate, Pole Enclosure, Old Call Box. Zones are arranged like a print sheet.
- **Realistic product art inside zones:** UniFi Gateway, 8-port PoE switch, PoE+ / ++ / +++
  inserters, NanoStation (USIP NSM5), dome cameras (Interior / Front / Parking / Pool),
  single-door controller, slide-operator board, mag lock, Push-to-Exit, Knox box.
- **Color-coded wires:** red = power/PoE, blue = data, green = access/relay, grey/white = signal.
- **Text callouts everywhere:** "Program to 192.168.1.21 Access Point", "PoE+++ Inserter",
  "24V PWR Inserter", "N.C.", "COM", "Ext. Mesh — Mesh to Main Mesh", "Single Door
  Controller", "Slide Operator Board", "Stand Alone", "24V DC PWR".
- Clean light print layout, black-bordered zone boxes. Export must reproduce this quality.

## B. System Surveyor — Site page
- Breadcrumb: Sites / <Site>. Left panel: address, Label, Reference, Created by/at,
  Active toggle. **Contacts and Guests** list (avatar + role badge R/P), "+ Add Contact or
  Guest". **Team Permissions** block.
- Main: list/table view toggle; buttons **Release all edits**, **New folder**, **Report**,
  **New survey**. **Surveys** table: Name, Editor, Last updated, Elements (count), Comments.
  Example rows: "Camera Layout" 46 elements, "Network Layout" 19. Archived toggle.

## C. System Surveyor — Company site list
- Search, **All / Active / Inactive** filter, Dashboard, Manage Library, Library, Add Site.
- Table: Group/Site, City, Created by, Last edit date, Surveys (count link), Comments.

## D. System Surveyor — Survey editor (Camera Layout)
- Top bar: back, **$ pricing**, layers, comment, search, **Reports**, **Done editing**, **Save**.
- Left rail icons: **Add Element**, **Drawing Tools**, **Element Info**, **Survey Info**.
- **Add Element palette** (searchable) categories: Favorite Elements, **Video Surveillance**,
  **Access Control**, **Intrusion Detection**, **Infrastructure**, **Information Technology**,
  **Audio Visual**. (Icons = circular, category-colored.)
- Canvas: **satellite/aerial background**, dozens of camera icons each with an **FOV cone**
  (orange/tan/yellow, varying angle + range), parking "P" markers, building footprints,
  a drop pin, **zoom +/- controls**.
- Selected-element floating toolbar: edit, add photo, duplicate, route/path, color dot,
  status dropdown ("Proposed"), delete. Also a canvas toolbar with **Boundaries** toggle,
  element id, angle (145°), distance (58.81 ft).

## E. System Surveyor — Element Info panel (the depth to match)
Tabs: **Element Info** | **Camera Advisor™**. Sub-nav: Element Profile, Files & Photos,
Name, Installation, Functional, Maintenance, Configuration, Activity Log, Accessories, Notes.
- **Name:** ID, Element Name (Fixed Camera), Descriptive Label (Wide Angle), Room#/Location,
  Installation Status (Proposed), Color, Component Manufacturer (Eagle Eye), Component Model#
  (DX01), Element Quantity (slider), **Device Price ($900)**, **Installation Hours (1.00)**.
- **Installation (Area of Coverage):** AOC Status (Full), **AOC Radius (58.81)**,
  AOC transparency (50), AOC Color, **AOC Angle (145°)**, **AOC Direction**, Minimum Angle (0),
  Maximum Angle (360), Responsible Party, Installation Considerations.
- **Functional:** Connectivity (Network/IP), Camera Style (Box), Camera Type (Day/Night),
  Component Color, Shell Integrity (IP66…), Lens Type, Lens Detail, Camera Features,
  Resolution (32MP/8k), Video Quality, Encoding (H.265), Recording Method, Wide Dynamic,
  Accessories (Mounting Bracket), IR Illumination, Audio (Two-way), Wired/Wireless,
  Network Features (Dual Video Stream).
- **Maintenance:** Installed by, Installation Date, Maintenance Frequency.

## F. System Surveyor — the other three feature screens
- **Device icons:** categorized circular icon grid (Network Patch Panel, Router, Jack, Data
  Storage Array, Biometric Reader, Video Monitor, Wireless Access Point, Badging Printer,
  Universal Transmitter, Cellular Communicator, Battery, Printer, Computer, ID Scanner…).
- **Photos:** annotate a site photo — timestamp toggle, drag-drop element, undo/redo,
  shapes (arrow, box, circle), format (outline/solid), color swatches, size, opacity.
- **Securely:** Add contact (first/last, company, title, email, phone, notes), **Invite as
  Guest** with **Permission (Edit)** + **Expiration (30 days)**.
- **Area of coverage:** camera FOV cones + coverage boundaries drawn over the floor plan.

---

## What we already have to reuse
- Fabric.js canvas, 28 device types, FOV-cone geometry, rack diagram, PNG export
  (`app/design/floor-plans/page.tsx`).
- Mapbox token (`NEXT_PUBLIC_MAPBOX_TOKEN`) → satellite background.
- Reliable server-side upload (`.upload()`) → floor-plan image / PDF import.
- Public document-portal + token infra → secure guest share links.
- `floor_plans` + `floor_plan_devices` tables (migration 071) → extend for layouts/elements.

## Phase 1 scope (building now)
Design landing (property → drawing type) → editor shell in the approved dark glass:
background picker (satellite / floor-plan image / PDF / blank) + set-scale, categorized
icon library (symbol + photo toggle), device placement, color-coded wiring + legend,
Area-of-Coverage cones, inspector + live BOM. Existing floor-plan/background-image tool
stays until this replaces it.
