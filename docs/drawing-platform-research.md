# GateGuard Drawing Platform — Competitive Research & Feature Specification

**Document purpose:** Exhaustive research into Bluebeam Revu, System Surveyor, security drawing standards, and rack diagram conventions — compiled to inform the design and build of a professional-grade security system drawing/diagram platform inside the GateGuard Dealer Portal.

**Date compiled:** June 1, 2026  
**Research sources:** Bluebeam.com, support.bluebeam.com user manual, systemsurveyor.com product pages, NFPA 72, NEC Articles 760/725/800, BICSI TDMM, SIA drawing conventions, industry domain expertise.

---

## TABLE OF CONTENTS

1. Bluebeam Revu — Complete Feature Breakdown
2. System Surveyor — Complete Feature Breakdown
3. Security System Drawing Standards & Conventions
4. Rack Diagram Standards
5. SmartShape / Visio Pattern Analysis
6. Feature Comparison Matrix
7. Recommended Feature Set for GateGuard Drawing Platform
8. Canvas & Rendering Technology Recommendation
9. Specific UX Patterns to Adopt
10. Build Priority Roadmap

---

## 1. BLUEBEAM REVU — COMPLETE FEATURE BREAKDOWN

### 1.1 What Bluebeam Revu Is

Bluebeam Revu is the dominant PDF markup and collaboration platform used in architecture, engineering, and construction (AEC). It is a Windows desktop application (with a cloud/web companion) that sits on top of PDF documents. Users import existing drawings (PDFs) and annotate, measure, mark up, and collaborate on them. It does NOT create drawings from scratch — it augments existing PDFs. This is a critical distinction: Bluebeam is a PDF annotation tool; we need a native drawing canvas.

Pricing: Bluebeam starts at ~$260/year per seat (Basics), up to ~$490/year (Complete). Studio collaboration is included in all plans.

Why the industry loves it: 3 million+ users globally. Contractors use it to mark up architect-supplied PDFs with RFIs, redlines, punchlist items, and quantity takeoffs. It is not purpose-built for security system design but is widely misused for it because it is "already open."

---

### 1.2 Markup Tools — Full List

Bluebeam's markup toolset is organized into categories in its "Tool Chest" panel. Every tool can be configured with custom colors, line weights, opacity, and fill styles, then saved as a reusable named tool.

#### Shape Markups

Line tool — Single straight line segment. Properties: start/end caps (arrow, circle, square, open, closed, diamond, slash), stroke color, width, dash pattern.

Arc tool — Curved line / arc segment. Control point to adjust curvature; same end caps as line.

Arrow tool — Line with arrowhead preset. Quick access shortcut for annotating callout directions.

Polyline tool — Multi-segment open line. Each vertex clickable; can close to polygon; useful for cable runs.

Polygon tool — Closed multi-segment shape with fill. Fill color + opacity + stroke. Used for coverage areas.

Rectangle tool — Axis-aligned rectangle. Fill + stroke; can be rounded-corner. Used for rooms and zones.

Ellipse tool — Circle or oval. Fill + stroke. Used for FOV approximations and coverage circles.

Cloud tool — Revision cloud (wavy boundary). Standard revision cloud per ANSI/ISO convention. Used to indicate drawing changes.

Cloud+ tool — Revision cloud with embedded note. Cloud shape + attached popup note for revision description.

Highlight tool — Semi-transparent filled rectangle. Yellow or any color, for highlighting zones on a PDF.

Pen tool — Freehand stroke. Pressure-sensitive on tablet. Used for freehand sketches.

Dimension tool — Linear dimension line with tick marks and text. Reads from page scale; shows actual dimension in drawing units.

#### Text Markups

Text Box — Standard text box with border; font, size, color, alignment configurable.

Typewriter — Inline text placed directly on the page, no border box.

Callout — Text box + leader line + arrowhead; drag anchor point; multi-vertex leader supported.

Note (Flag) — Small icon that opens a popup note on hover/click. Used for annotations that should not clutter the drawing.

Edit/Review text — Strikethrough, insert, replace annotations on actual PDF text content.

#### Measurement Markups

Set Page Scale — Defines real-world distance represented by pixel distance on the page. Calibrate by clicking two known-distance points. Supports feet, inches, meters, mm, cm.

Length — Single straight line segment, returns real-world length. Shows both the markup and the computed length in the markups list.

Polylength — Multi-segment path, returns total length. Primary cable run calculation tool; sums all segments.

Perimeter — Closed polygon, returns perimeter. Good for conduit around rooms.

Area — Closed polygon, returns area. Good for coverage zone size.

Diameter — Circle by clicking center + edge. Returns diameter measurement.

3-Point Radius — Click 3 points on an arc to measure its radius. For curved walls and conduit bends.

Center Radius — Click center then edge for radius.

Angle — Click 3 points to measure included angle. For angled wall intersections.

Volume — Area measurement with depth property. Less relevant for security.

Count tool — Click to place counted instances; auto-tallies. Critical for device count takeoffs: click each camera/reader, get total count automatically.

Cutout — Subtract an area from another measurement. For measuring rooms with holes/cutouts.

Dynamic Fill — Click to fill an enclosed area automatically. Flood-fill measurement: click inside a room and it auto-traces the boundary.

#### Sketch-to-Scale Tools

These markup tools respect the page scale and draw shapes at real-world dimensions:
- Rectangle Sketch: draw a rectangle at specified real-world dimensions (e.g., "draw 10ft x 8ft room")
- Ellipse Sketch: draw ellipse at specified real-world dimensions
- Polygon Sketch: draw polygon at real-world dimensions
- Polyline Sketch: draw multi-segment line at real-world dimensions

#### Image Markups

Image tool — Insert PNG/JPG/BMP image as a markup layer element.

Camera tool — Capture photo from webcam and insert as markup.

Crop Image — Crop an inserted image markup.

Embedded markup media — Attach video or audio to a markup popup.

#### Stamps

Stamps are pre-designed image overlays placed on the PDF:

Built-in stamps: APPROVED, DRAFT, FINAL, VOID, FOR REVIEW, FOR CONSTRUCTION, etc.

Custom stamps: Users can create stamps from any PDF page or image.

Dynamic stamps: Stamps with fillable fields (date, author, project number, etc.) that prompt for input when placed.

Stamp library: Stamps organized into sets and shared via Tool Chest.

Key use for security: Create a stamp for each device type (camera model, reader model) with pre-filled spec data.

#### Forms

PDF form fields: Text input, checkbox, radio button, dropdown, list box, button.

Digital signatures: Place signature fields, certify documents.

Form creation: Draw fields on any PDF page.

Key use for security: Create inspection forms that techs fill in the field; punch list items.

---

### 1.3 Tool Chest — Custom Tool Sets

The Tool Chest is Bluebeam's equivalent of a symbol library. It is one of the most powerful features:

Tool Sets: Named collections of pre-configured markup tools. A "Security Camera Survey" tool set might contain: Camera (circle with number), Door Contact (rectangle), Motion Sensor (triangle), Cable Run (polyline, red, 2pt), Note (flag markup), etc.

Custom tool creation: Right-click any placed markup → "Add to Tool Chest" → saves all properties (color, size, text, etc.).

Tool Set sharing: Tool sets can be exported as .btx files and shared with team members; importing puts them in the Tool Chest immediately.

My Tools: Personal always-available tools.

Tool Set organization: Expandable groups within the panel.

Dynamic Fill symbol: A shape that auto-fills an enclosed region with color when clicked. Used for room coloring.

Search: Filter the Tool Chest by name.

Key limitation for security: All symbols are generic. There is no intelligence. A "camera" is just a circle with a label; it has no FOV calculator, no spec sheet, no BOM integration.

---

### 1.4 PDF Calibration and Measurement (Scale System)

Bluebeam's scale system is critical to understand for our implementation:

1. Set Page Scale dialog: User draws a line between two known points, enters the real-world distance and unit. Bluebeam computes the scale ratio (e.g., 1 inch = 25 feet, or 1:300).
2. Multiple scales on one page: Different areas of one PDF can have different scales (rare but supported).
3. Multiple scales across pages: Each page can have its own scale; Bluebeam stores per-page scale metadata.
4. Scale display: A scale bar indicator shown in the status bar; clicking opens the scale dialog.
5. Imperial and metric: Full support for feet/inches, decimal feet, meters, centimeters, millimeters.
6. Calibration marks: Two-point calibration (click two known points) or enter ratio directly.
7. How measurements display: After calibration, all measurement markups show both the drawn length and the real-world dimension. A cable run polyline would show "47.5 ft" automatically.
8. Measurement panel: Lists all measurements on the current page, filterable by type, sortable by value. Can total polylength measurements for a total cable run.
9. Export measurements: Export measurement data to CSV/Excel for estimating.

Our implementation requirement: We must have a calibration system where the user either sets a known scale via ratio input, or clicks two known points and enters the real distance. Then all cable runs, device spacing, and coverage areas auto-calculate in real-world units.

---

### 1.5 Layers and Layer Management

Bluebeam supports PDF layers (Optional Content Groups in PDF spec):

Layer panel: Lists all layers in the PDF; click eye icon to show/hide.

Layer creation: Add custom layers; assign markups to specific layers.

Layer locking: Lock a layer to prevent editing.

Print layers: Choose which layers print.

Layer states: Save/restore layer visibility configurations as named presets.

Merge layers: Flatten selected layers into the PDF permanently.

For security drawings, the recommended layer structure is:
- Layer 0: Floor plan background (locked, imported image)
- Layer 1: Video surveillance (cameras + FOV cones + cable runs)
- Layer 2: Access control (readers + door hardware + controller locations)
- Layer 3: Intrusion detection (motion sensors, door contacts, glass breaks)
- Layer 4: Cable infrastructure (conduit paths, IDF/MDF locations)
- Layer 5: Network/IT (switches, PoE injectors, NVR rack)
- Layer 6: Notes and annotations
- Layer 7: As-built verification status

---

### 1.6 Studio Sessions (Real-Time Collaboration)

Studio Sessions are Bluebeam's real-time multi-user markup collaboration:

Host a session: Any user can host; invite by email or session ID.

Session panel: Shows all attendees with color-coded cursors; live chat.

Real-time sync: All markups appear instantly for all session attendees.

Permission levels: Full access, Read-only, Markup only.

Session files: Host adds PDFs to the session; attendees cannot add/remove without permission.

Markup alerts: Subscribe to alerts when another user places a markup.

Session recordings: Complete audit trail of all markups by user + timestamp.

Finish session: Host finalizes; all markups are merged into the PDF.

Studio Projects (persistent cloud storage):
- Folder/file hierarchy like a cloud drive
- Version history with restore capability
- Permission management (view only, markup, full access)
- Share links with external partners (no Bluebeam license required for view-only)
- "Checkout" system to prevent simultaneous editing conflicts
- Integration with Bluebeam Cloud mobile app

---

### 1.7 Batch Processing

Bluebeam's Batch menu enables processing multiple PDFs at once:

Batch Compare — Find differences between two versions of a drawing set.

Batch Overlay — Overlay two drawing versions with color coding (old=red, new=green).

Batch Link — Auto-create hyperlinks from drawing sheet names/numbers to actual sheets.

Batch Print — Print multiple PDFs with consistent settings.

Batch Slip Sheet — Replace old sheets in a set with new versions while preserving markups.

Batch Sign & Seal — Apply digital signatures across multiple documents.

Batch Stamp — Apply a stamp to multiple pages/documents at once.

Markup Summary — Generate a PDF report of all markups across all documents.

Batch Crop & Page Setup — Resize/crop pages across multiple PDFs.

Batch Headers & Footers — Add consistent title block info to multiple PDFs.

---

### 1.8 Hyperlinking Between Sheets

Batch Link: Automatically scan all pages for sheet numbers matching the naming convention and create hyperlinks between them.

Manual links: Draw a rectangle on any markup → right-click → Add Link → link to another page, external URL, or attachment.

Bookmarks panel: Named bookmarks to specific page locations; click to jump.

---

### 1.9 Revision Clouds

The Cloud and Cloud+ tools implement the standard AEC revision cloud:

Cloud tool: Draws a closed wavy boundary (bumps facing outward per ISO 128 convention). The bump size is configurable. Standard colors: red (active revision), grey (superseded).

Cloud+ tool: Same cloud shape + a triangular revision tag in the corner showing revision letter/number + date + author initials.

Automated revision tracking: Studio Sessions log who placed each cloud, when, and from which session.

---

### 1.10 Markups List (Data Panel)

The Markups List is a sortable/filterable spreadsheet of every markup on the current document:

Columns: Author, Subject, Date, Color, Page, Status, Layer, Comment, Custom columns.

Custom columns: Add any property (checkbox, text, dropdown, date, number); assign values per markup.

Status field: Assign statuses (In Progress, Completed, Rejected, etc.) per markup.

Export: Export full markups list to CSV, XML, or PDF summary report.

Filter/Sort: Filter by any column; sort ascending/descending.

Bulk edit: Select multiple markups → change status/properties in bulk.

For security systems: The Markups List is how the "BOM" is generated in Bluebeam. If you create a custom "Device Type" column and mark each camera symbol as "Camera — Axis P3245", then export the list, you get a rough BOM. This is very manual. System Surveyor automates this.

---

### 1.11 Export Formats

From Bluebeam, you can export to:
- PDF (standard, flattened, or with layers)
- DWG/DXF (AutoCAD format, via plugin)
- Office formats: Word (.docx), Excel (.xlsx), PowerPoint (.pptx)
- Image formats: PNG, JPG, BMP, TIFF (per page)
- CSV/XML (markup data export)
- XPS (Microsoft XML Paper Specification)

---

### 1.12 Bluebeam Max (AI Features, 2025+)

AI-powered markup extraction: Automatically detect and count recurring symbols on drawings.

AI document comparison: Identify drawing changes without manual overlay.

AI classification: Auto-classify markups by type.

Relevance for GateGuard: If we build AI-powered symbol recognition into our platform, we can automatically count devices from imported floor plans.

---

### 1.13 Bluebeam's Critical Gaps for Security Integrators

1. No device intelligence: A circle is just a circle. No FOV cone calculation, no pixel-density calculator, no spec sheet attachment, no BOM auto-generation.
2. No camera advisor: No tool that recommends camera models based on distance and required resolution.
3. PDF-centric: You must import a PDF first. You cannot draw a floor plan from scratch.
4. No system-type awareness: Bluebeam does not know if you are drawing cameras vs access control vs fire. It is all just markups.
5. No lifecycle management: No "proposed vs installed vs maintenance needed" status system.
6. No photo association to device: You can attach a photo to any markup, but it is not structured as "photo of this specific device at this location."
7. No BOM automation: The BOM is manual — custom columns in the Markups List, exported to Excel. No pricing, no labor, no auto-subtotal.
8. Price: $260-$490/year per seat. For a dealer org with 5 estimators, that is $1,300-$2,450/year on top of GateGuard.
9. Desktop-first: The web/mobile experience lags significantly behind the desktop app.

---

## 2. SYSTEM SURVEYOR — COMPLETE FEATURE BREAKDOWN

### 2.1 What System Surveyor Is

System Surveyor is a purpose-built cloud platform for physical security system design. It is a browser-based + mobile-tablet application specifically designed for security integrators. Unlike Bluebeam, it is NOT a PDF annotator — it is a native drawing canvas with security-specific intelligence built in. Users drag-and-drop device icons onto floor plans, calculate coverage, generate BOMs, and produce proposals.

Target users: Security integrators, systems engineers, technology directors, loss prevention managers.

Differentiator vs Bluebeam: System Surveyor knows what a camera is. It can calculate pixels on target, recommend models based on DORI standards, auto-generate a bill of materials, and track whether devices are "proposed" vs "installed."

Pricing: Multi-tier based on seats and features. Entry level ~$99/month, enterprise pricing negotiated. Manufacturer partner catalogs are a value-add that locks users in.

---

### 2.2 Floor Plan Import

System Surveyor supports these floor plan input methods:

1. Import JPG/PNG/PDF: Upload an image or PDF of a floor plan. The system renders it as the canvas background.
2. Google Maps / Google Earth integration: For outdoor sites, use satellite/aerial imagery as the base layer. Set scale by measuring known distances.
3. Photo of fire escape plan: Take a photo with the tablet camera of any posted floor plan (e.g., the hotel fire map near elevator) and use it immediately.
4. Scale setting: After import, user clicks two known-distance points and enters the real distance. All subsequent measurements use this calibration.
5. Offline capture: The mobile tablet app works offline; floor plan captured in field syncs to cloud when connectivity is restored.
6. Multi-floor support: Create a "Site" with multiple "Surveys." Each survey represents one floor or one building. Sites can be grouped for campus projects.

---

### 2.3 Device Icon Library — Complete Catalog

System Surveyor calls devices "Elements" organized by "System Type":

Video Surveillance: Camera (dome, bullet, PTZ, panoramic, thermal, fisheye, license plate reader), NVR/DVR, Video Encoder, Video Server, Video Decoder.

Access Control: Card Reader, Biometric Reader, Door Controller, Access Panel, Electric Strike, Magnetic Lock, REX Sensor, Door Contact, Turnstile, Gate Controller.

Intrusion Detection: Motion Detector (PIR), Dual-Tech Detector, Glass Break, Door/Window Contact, Vibration Sensor, Shock Sensor, Smoke Detector, CO Detector, Flood Sensor, Control Panel, Keypad, Siren, Strobe.

Fire Alarm: Smoke Detector, Heat Detector, Pull Station, Horn/Strobe, Annunciator Panel, FACP.

Audio/Visual (AV): Display/Monitor, Speaker, Microphone, Amplifier, Video Matrix, Audio DSP.

IT Assets: Network Switch, PoE Switch, Wireless Access Point, Server, Rack Unit, Patch Panel, UPS.

Cable Infrastructure: Single-mode fiber, Multi-mode fiber, CAT6/CAT5e, Coax RG-6, 2-conductor wire, Conduit, Junction Box, Pull Box, IDF/MDF Rack.

Building Management: HVAC Thermostat, Door Lock (smart), Lighting Control, Elevator Interface.

Healthcare: Nurse Call Station, Panic Button, Wander Management Tag, Staff Duress.

Facility Equipment: Electric Panel, Generator, PDU, UPS Battery.

Life Safety: Emergency Phone, Mass Notification Speaker, Strobe Light, Exit Sign.

Each element has specific attribute fields (a "wizard") that collect device-specific data:

Camera attributes: Manufacturer, Model, Resolution (MP), Lens (mm or angle), IR distance, IP address, MAC address, Storage location, Installation status, Notes.

Door Reader attributes: Manufacturer, Model, Credential type (RFID, PIN, biometric), Door number, Controller panel assignment, Protocol, Notes.

Access Panel attributes: Controller model, Number of doors, IP/MAC, Firmware version, Wiegand/OSDP protocol, Notes.

---

### 2.4 FOV (Field of View) Cone Tool — Camera Advisor

Camera Advisor is System Surveyor's marquee feature.

Two-way recommendation engine:
- Mode A — "I know my camera, show me the coverage": Select camera model from catalog → system draws the FOV cone based on lens specifications → shows pixels per foot at various distances.
- Mode B — "I know my coverage need, recommend a camera": Input desired image quality (identify, recognize, detect) + distance → system recommends camera models that meet those requirements.

DORI Standard implementation:
- DORI = Detection, Observation, Recognition, Identification (plus Monitor and Inspection variants)
- Detection: Can detect a person/object exists (~25 PPF = pixels per foot)
- Observation: Can determine general characteristics (~62 PPF)
- Recognition: Can determine if known person (~125 PPF)
- Identification: Can positively ID a face or plate (~250 PPF)
- The system maps these to camera resolution + distance combinations
- User slides a DORI slider; canvas shows the cone changing

FOV cone rendering:
- Cone drawn as a triangle/wedge from the camera icon
- Cone angle matches the actual lens horizontal field of view
- Cone depth matches the useful distance at the selected DORI level
- Color-coded: green (full resolution), amber (partial), red (inadequate)
- "Show all FOV cones" layer toggle at design time
- Overlapping cones show coverage gaps visually

Pixels Per Foot (PPF) visualization:
- Overlaid on the FOV cone: a grid or color band showing PPF at distance
- At-a-glance: designer sees the sweet spot where image quality meets requirement
- Updated in real-time as the camera icon is dragged

Camera selection from BOM:
- When Camera Advisor selects a model, that model is automatically added to the BOM
- Changing the selection updates the BOM instantly

Key DORI math (to implement):
```
PPF = (Horizontal_Resolution_pixels) / (Distance_feet * tan(HFOV_radians / 2) * 2)
```
Where:
- Horizontal_Resolution_pixels = camera sensor horizontal resolution (e.g., 1920 for 1080p, 2560 for 4MP)
- Distance_feet = target distance from camera
- HFOV_radians = horizontal field of view in radians

Example: A 4MP camera (2560x1440) with a 90 degree HFOV lens at 20 feet:
PPF = 2560 / (20 * tan(pi/4) * 2) = 2560 / 40 = 64 PPF (Observation level)

Range for a given DORI level:
D = resolution_horizontal / (required_ppf * 2 * tan(HFOV_radians / 2))

---

### 2.5 Cable Run Measurement Tool

System Surveyor automatically calculates cable runs using the floor plan scale:

Draw cable: Click to place cable path vertices (like a polyline).

Scale calculation: The system reads the floor plan scale to convert pixel length to real-world feet/meters.

Cable type attribute: Each cable segment has a type property (CAT6, Fiber, Coax, 2-conductor, etc.).

Overhead factor: User can set a percentage (e.g., 15%) added for slack, bends, and routing overhead.

Cable run total: All cable segments of the same type summed for the BOM.

Output in BOM:
- CAT6: 347 ft (auto-calculated from all camera + reader cable runs)
- 2-conductor: 85 ft (motion sensor loop)

---

### 2.6 Auto-BOM Generation

Bill of Materials is automatically generated as devices are placed:

Every drag-and-drop adds to the BOM.

BOM line items: Device type, Manufacturer, Model number, Quantity, Unit price (if configured), Extended price.

Element Profiles: User creates profiles for frequently used devices (e.g., "Axis P3245 standard install kit") — includes the camera, a mounting bracket, a power supply, and a data label — placing one camera icon adds all four line items to the BOM automatically.

Manufacturer catalogs: 30+ manufacturer partners provide pre-built Element Profiles. Partners include: Hikvision/DeepSight, Allegion, Verkada, Avigilon, Alarm.com, Brivo, Eagle Eye, Pelco, DMP, i-Pro, Rhombus, Digital Watchdog, OpenEye, Radionix, Zenitel, Prodatakey, InVid Tech, and 15+ more. Over 100,000 devices available.

Accessories inclusion: Each Element Profile can include accessories (mounting hardware, connectors, conduit fittings).

Cable totals: Cable run measurements feed directly into BOM as material quantities.

Labor lines: Can add labor rate + hours estimate per element type.

Export formats: PDF (branded), Excel (.xlsx), CSV.

---

### 2.7 Photo Attachment Per Device

Photo capture is one of System Surveyor's most-loved features:

In-field tablet: Tap a device icon → tap camera icon → take photo → photo is auto-associated with that specific device.

Multiple photos: Each device can have unlimited photos (installation photo, site condition photo, before/after).

Annotation on photos: Draw on photos (circles, arrows, text) before saving.

Photo Tour report: Generate a PDF with every device photo in sequence (great for punch list walkthroughs).

Retrieval: On web or tablet, tap any device → see its photos instantly.

Maintenance photos: Post-install photos for as-built documentation.

---

### 2.8 Site Map Import — Google Maps Integration

Google Maps aerial view: Use satellite imagery as canvas background for parking lots, perimeters, building exteriors.

Scale on aerial: Use known building measurements (architectural plans) to set scale on the aerial photo.

Outdoor element placement: All the same device icons work on aerial views — fence-mount cameras, gate operators, intercoms, LPR cameras at entry.

Indoor/outdoor multi-view: A site can have an outdoor aerial survey + multiple indoor floor plan surveys linked.

---

### 2.9 Multi-Floor / Multi-Area Support

Site hierarchy: Organization → Sites → Surveys.

One site, many surveys: Each floor is a separate survey; each building wing can be a separate survey.

Folder structure: Surveys organized in folders (e.g., "East Wing" folder contains Floor 1, Floor 2, Roof surveys).

Campus support: Group multiple sites under a "Campus" organization.

Cross-floor BOM: BOM rolls up across all surveys in a site (total cameras for the building, not per floor).

---

### 2.10 Layering System

System Type layers: Each system type (Video Surveillance, Access Control, etc.) is automatically on its own layer.

Toggle layers: Click to show/hide all cameras, all access control, etc.

Installation Status layer: Show only "Proposed" devices, or only "In Place" devices, or only "Needs Replacement."

Area of Coverage toggle: Show/hide all FOV cones independently from device icons.

Cable layer toggle: Show/hide all cable runs.

Combination views: For a sales proposal, hide cables + show FOV cones; for an installation plan, hide FOV cones + show cables + show conduit.

Layer export: PDF export respects layer visibility — create proposal PDF with one layer combination, installation PDF with another.

---

### 2.11 Digital As-Built

Live record: Not a static PDF — a live, queryable cloud database of all installed devices.

Device lifecycle states: Proposed → Ordered → Delivered → Installed → Commissioned → In Service → Maintenance Required → Decommissioned.

Configuration data (InfoMask): Store sensitive configuration data (IP address, MAC address, admin password, RTSP URL, firmware version) per device, encrypted and permission-controlled.

Maintenance scheduling: Set maintenance dates per device type; Critical Date Report shows upcoming service needs.

Service history: Log each maintenance visit with photos and notes.

---

### 2.12 Proposal Generation

Branded reports: Upload company logo → appears on every report cover page.

Survey Layout report: Floor plan with device legend, scale bar, orientation arrow, revision block, generated as PDF.

Bill of Materials report: Formatted BOM with pricing, totals, manufacturer info.

Photo Tour report: All device photos in sequence, captioned with device attributes.

Executive Summary report: High-level project scope for non-technical stakeholders.

Element Detail report: Full attribute data for every device (for installation team).

Critical Date report: Devices with upcoming maintenance/warranty expiration.

Custom report builder: Choose which data columns to include; filter by system type or installation status.

Export options: PDF (print-ready), Excel (for editing), CSV (for import elsewhere).

Sharing: Generate a web link (with optional passcode + expiration) to share a live view of the survey with stakeholders.

---

### 2.13 Collaboration Features

Team Members: Add unlimited team members to the organization; each gets their own login.

Guest Users: Invite external partners (manufacturer reps, subcontractors) with limited access — can view and comment but not edit.

Survey Comments: Thread-based comments attached to specific devices or areas; email notifications.

Real-time co-editing: Multiple users can edit the same survey simultaneously.

Permission levels: Admin, Manager, Technician, Viewer.

Manufacturer collaboration: Invite manufacturer rep into a survey to see device placement and provide spec recommendations.

---

### 2.14 Integration Marketplace

Pre-built integrations (Enterprise/Corporate tier only):
- HubSpot CRM: push survey/BOM data to HubSpot deals
- Oracle NetSuite: push BOM/proposal data to NetSuite quotes
- Built via Prismatic.io workflow connector

API: REST API for reading/writing survey data, device data, BOM data.

Manufacturer catalogs: 30+ manufacturer partners whose product SKUs are embedded as pre-built Element Profiles (100,000+ devices total).

---

### 2.15 System Surveyor's Critical Gaps

1. Not a real CAD tool: Cannot draw walls, rooms, or architectural elements. You import a floor plan image but cannot create one.
2. No schematic view: Cannot draw a system block diagram (panel → reader → door) or riser diagram.
3. Limited markup tools: No revision clouds, no dimension lines, no callout leaders like Bluebeam.
4. No PDF annotation: Cannot mark up a submitted shop drawing or RFI.
5. Basic cable routing: Cable runs are simple polylines; no automatic routing around obstacles, no conduit fill calculations.
6. No rack diagram: Cannot design the equipment rack layout.
7. No wire/termination schedule: Cannot generate a point-to-point wiring schedule.
8. 3D visualization is minimal: Basic 3D is mentioned but not a true 3D walkthrough.
9. Limited offline: Mobile offline mode is limited in what edits it supports.
10. Price: Enterprise tiers are expensive; small dealers may find it hard to justify.
11. No GateGuard integration: No way to connect a System Surveyor survey to a GateGuard quote, work order, or site record.

---

## 3. SECURITY SYSTEM DRAWING STANDARDS & CONVENTIONS

### 3.1 Symbol Standards

#### ANSI/SIA Intrusion Detection Symbols

Triangle (filled): Motion detector / PIR sensor
Diamond: Glass break detector
Rectangle with X: Door/window contact
Circle with lightning bolt: Shock/vibration sensor
Square with S: Smoke detector
Rectangle with keypad icon: Alarm keypad
Hexagon: Control panel / alarm panel

#### Access Control Symbols

Rectangle with R: Card reader / credential reader
Rectangle with card swipe: Proximity reader
Circle with fingerprint: Biometric reader
Rectangle + line from door edge: Electric strike
Rectangle + magnet symbol: Magnetic lock / maglok
Arrow through door: Request to Exit (REX) sensor
Key symbol: Key switch
Square with intercom speaker: Intercom / video intercom

#### Video Surveillance Symbols

Circle (small): Camera (generic, overhead/dome)
Triangle pointing right: Camera (bullet/directional, side view)
Circle with fan/wedge: Camera with FOV cone
Square with R: Recording device (NVR/DVR)
Circle with P: PTZ camera
Circle with L: License plate recognition camera
Rectangle with TV: Monitor/display

#### Fire Alarm Symbols (NFPA 72)

S in circle: Smoke detector
H in circle: Heat detector
SD in box: Smoke detector, duct type
M in box: Manual pull station
H/S combined: Combination horn/strobe
A in triangle: Annunciator

---

### 3.2 NFPA 72 Drawing Requirements

The National Fire Protection Association 72 (National Fire Alarm and Signaling Code) includes drawing requirements:
- Floor plans must show all device locations with manufacturer-standard symbols
- Symbols must include a legend on every sheet
- Conduit/cable routing paths required on installation drawings
- Panel schedule required (each panel, zones, device counts)
- Battery calculations on the drawing title block
- Wiring diagram (riser diagram) required showing inter-panel connections

### 3.3 NEC Low-Voltage Wiring Requirements

NEC Article 760 covers fire alarm wiring; Article 800 covers communications circuits; Article 725 covers Class 1/2/3 remote control and signaling circuits. Drawing requirements:
- Show wire types (FPLR, FPLP, CL2, CL3)
- Show circuit classes (Class A, Class B, Class D)
- Show power supply sources and backup battery

### 3.4 Drawing Sheet Conventions

Standard sheet numbering convention for security drawings:
- S-001: Security general notes + symbols legend
- S-101 through S-1xx: Floor plan sheets (camera/sensor locations)
- S-201 through S-2xx: Access control sheets
- S-301 through S-3xx: Riser diagrams
- S-401 through S-4xx: Rack elevations
- S-501 through S-5xx: Details and wiring schedules

Professional title block must include: Client name, project address, drawing title, drawing number, revision history, engineer stamp, scale indicator, north arrow, graphic scale bar.

### 3.5 Riser Diagrams

A riser (or "single-line") diagram shows the system architecture without physical location:
- All panels/controllers shown as boxes
- Cables shown as single lines between boxes
- Each cable labeled with type and wire gauge
- Each connection labeled with port number
- The riser diagram is the "system logic" drawing — it tells you HOW things connect, not WHERE they are physically
- For access control: shows Lenel/Genetec server → Mercury controller → panels → readers
- For video: shows NVR/VMS server → PoE switches → cameras
- For intrusion: shows DMPXR500 → zone expansion modules → field devices

Our platform must generate this automatically from the floor plan device placement.

### 3.6 As-Built Drawing Requirements

As-built drawings must show:
- Final device locations (not proposed locations)
- Actual cable routing (as-installed, not design intent)
- Final device model numbers and serial numbers
- Final IP addresses and network configuration
- Conduit sizes and fill percentages
- Panel programming schedule (zone assignments, user codes, etc.)
- Warranty card numbers and expiration dates

---

## 4. RACK DIAGRAM STANDARDS

### 4.1 Physical Rack Standards

Rack Unit (U): 1U = 1.75 inches of vertical space; standard rack = 42U or 48U.

Width: Standard 19-inch rack width; equipment mounts in "ears" that span 19" mounting rails.

Depth: Shallow racks: 18"; standard racks: 24"; deep racks: 36" (for servers).

Mounting holes: Spaced at 1U intervals in sets of 3 (top of U, middle, bottom); 10-32 threaded or M6 threaded or 1/4" square holes.

### 4.2 Rack Diagram Drawing Conventions

A rack elevation diagram shows:
- Front view of rack with each U unit labeled 1-42/48 from bottom to top
- Each device shown as a rectangle spanning its U height (1U switch = 1 unit tall, 2U NVR = 2 units tall)
- Device label inside rectangle: Make/model, hostname/IP, asset tag
- Blank panels shown for empty slots
- Power consumption shown per device (optional)
- Total power load calculation at bottom

### 4.3 Common Security System Rack Layout (mid-size property)

```
U48 ──────────────────────────────── (top)
U47 [ Cable Patch Panel — CAT6 24-port      ]
U46 [ Blank panel                            ]
U45 [ PoE Switch — 24-port (Cameras 1-20)  ]
U44 [ Blank panel                            ]
U43 [ PoE Switch — 24-port (Cameras 21-40) ]
U42 [ Blank panel                            ]
U41 [ NVR — 8TB, 64-channel                ] (2U)
U40 [ NVR — cont'd                          ]
U39 [ Blank panel                            ]
U38 [ Access Control Appliance (2U)          ]
U37 [ Access Control — cont'd               ]
U36 [ Mercury Controller MR52               ]
U35 [ Blank panel                            ]
U34 [ Network Switch — Management           ]
U33 [ Firewall/Router (UDM Pro)             ]
U32 [ Blank panel                            ]
U31 [ KVM + Monitor arm                     ]
U30 [ Blank panel                            ]
U29 [ UPS — APC 1500VA (2U)                ]
U28 [ UPS — cont'd                          ]
U1  ──────────────────────────────── (bottom)
```

### 4.4 Rack Diagram UX Patterns from Best-in-Class Tools

1. The rack is drawn as a 19" wide column, 42U tall, with U numbers on the left margin.
2. Devices snap to U boundaries — drag a 2U switch and it fills exactly 2 units.
3. Height of equipment is pulled from a device catalog (a 24-port Cisco switch is always 1U).
4. Each device is a card with: icon, model name, hostname/IP, asset tag.
5. Blank panels fill empty slots.
6. Power capacity indicator at bottom: "Total load: 1,847W / Rack capacity: 4,000W".
7. Export as PDF, PNG, or Visio XML.

---

## 5. SMARTSHAPE / VISIO PATTERN ANALYSIS

### 5.1 How Visio SmartShapes Work

Microsoft Visio's SmartShapes are the gold standard for intelligent diagram symbols. Key behaviors:

Shape data (properties): Each shape has a properties form attached. A "Network Switch" shape has fields: Manufacturer, Model, IP Address, Number of ports, etc. Properties stored in the shape itself.

Shape formulas: Properties can compute values. A camera shape's FOV cone size is a formula: Width * 2 * TAN(ShapeData.HFOV / 2 * PI() / 180).

Connection points: Shapes have defined connection points (blue X markers at specified locations). Lines drawn between shapes snap to these points. A switch shape has a connection point per port.

Glue: When shapes are connected via Visio's connection tool, they stay connected when shapes are moved — the line follows the shape.

Masters: Shape definitions stored as "Masters" in a stencil file (.vssx). Deploying a new master version updates all instances in a drawing.

Custom properties form: Right-clicking a shape → Properties opens a form showing all shape data fields with labels and input types.

Data linking: Visio can link shape data to an Excel spreadsheet or database; shapes auto-update when data changes.

### 5.2 How to Implement SmartShape Behavior in Our Platform

Our device icons need SmartShape-like behavior:

1. Device schema: Each device type has a defined JSON schema of properties (Camera: resolution, lens, IP, etc.)
2. Properties panel: Clicking a device opens a properties sidebar with typed form fields
3. Formula-driven geometry: The FOV cone SVG path is computed from lens angle and distance properties, not stored as a static shape
4. Connection system: Cables connect from specific "ports" on devices; connections persist when devices are moved
5. BOM derivation: BOM is derived from device properties, not manually entered
6. Template library: Device types stored as schemas with default values; placing a new device initializes with template defaults

### 5.3 Network Diagram Patterns (Netbrain / Netscout)

High-end network documentation tools add:
- Topology auto-discovery: Scan the network → automatically place all switches, access points, cameras in a diagram
- Live status overlays: Color-code devices by online/offline/alarm status
- Port labeling: Every cable run labeled with the source port, destination port, cable ID
- VLAN visualization: Show which devices are on which VLAN with color coding

For GateGuard: When a site already has devices in Supabase (from Brivo sync, UniFi sync), we can auto-place them on the canvas without manual entry. This is a direct competitive advantage.

---

## 6. FEATURE COMPARISON MATRIX

| Feature | Bluebeam Revu | System Surveyor | GateGuard Current | Priority |
|---------|--------------|-----------------|-------------------|---------|
| Import floor plan (JPG/PNG/PDF) | PDF only | Yes | No | P0 Critical |
| Google Maps / aerial import | No | Yes | No | P0 Critical |
| Set drawing scale / calibration | Yes (excellent) | Yes | No | P0 Critical |
| Device icon library (security) | No (generic) | Yes (50+ types) | No | P0 Critical |
| Drag-and-drop device placement | Partial (stamps) | Yes | No | P0 Critical |
| FOV cone tool for cameras | No | Yes (DORI-based) | No | P0 Critical |
| FOV pixel density calculator | No | Yes (PPF) | No | P0 Critical |
| Cable run measurement (auto-total) | Yes (polylength) | Yes | No | P0 Critical |
| Auto BOM from device placement | No (manual only) | Yes | No | P0 Critical |
| Device properties form | Custom columns | Yes (per type) | No | P0 Critical |
| Layer management | Yes (excellent) | Yes (system-type) | No | P0 Critical |
| Scale bar widget | Yes | Yes | No | P0 Critical |
| Proposal generation (branded PDF) | Partial | Yes | No | P0 Critical |
| BOM export (Excel/PDF) | Manual only | Yes | No | P0 Critical |
| Native integration with quote | No | No | YES | P0 Critical |
| Native integration with work orders | No | No | YES | P0 Critical |
| Multi-floor support | Yes (multi-page) | Yes (surveys) | No | P1 High |
| Photo attachment per device | Partial | Yes (native) | No | P1 High |
| Photo tour report | No | Yes | No | P1 High |
| Camera advisor / recommendation | No | Yes (DORI) | No | P1 High |
| Dimension lines | Yes (excellent) | No | No | P1 High |
| Device lifecycle status | No | Yes | No | P1 High |
| Digital as-built record | No | Yes | No | P1 High |
| Manufacturer product catalogs | No | Yes (30+ mfrs) | No | P1 High |
| Rack diagram | No | No | No | P1 High |
| Drawing legend auto-generation | Yes (manual) | Yes | No | P1 High |
| Real-time collaboration | Yes (Studio) | Yes | No | P2 Medium |
| Revision clouds | Yes (excellent) | No | No | P2 Medium |
| Riser/schematic diagram | No | No | No | P2 Medium |
| Wiring schedule generation | No | No | No | P2 Medium |
| Offline field use (tablet/mobile) | Partial | Yes | No | P2 Medium |
| QR code per device | No | No | No | P2 Medium |
| Brivo / UniFi auto-import | No | No | No (planned) | P1 High |
| Conduit fill calculator | No | No | No | P2 Medium |
| Network topology auto-discovery | No | No | No | P3 Low |
| 3D visualization | No | Minimal | No | P3 Low |
| AI symbol detection from floor plan | Partial (Max) | No | No | P3 Low |
| Batch processing | Yes (excellent) | No | No | P3 Low |
| PDF annotation/redline | Yes (core) | No | No | P3 Low |

Priority key:
- P0 Critical: Must have in MVP. Without this, the tool is not viable.
- P1 High: Builds major differentiation. Target within 3 months of MVP.
- P2 Medium: Nice-to-have. Target within 6 months.
- P3 Low: Aspirational. Future roadmap.

---

## 7. RECOMMENDED FEATURE SET FOR GATEGUARD DRAWING PLATFORM

### 7.1 Strategic Positioning

GateGuard's drawing platform has a unique advantage neither Bluebeam nor System Surveyor has: it is native to the dealer's workflow. A floor plan created in GateGuard is already linked to the site record, the quote, the work order, and the technician's mobile view.

This native integration is the killer differentiator. When a device is placed on the canvas:
- It automatically creates a quote line item
- It feeds into the BOM on the quote proposal
- It becomes a task on the install work order
- The tech sees it on their tablet with photos and attributes

Target users: GateGuard dealers, installers, and sales engineers — replacing their current use of Bluebeam (too generic) or System Surveyor (too expensive, disconnected from portal).

Competitive positioning statement: "System Surveyor is great, but it requires you to export a PDF and re-enter everything into your CRM and quoting tool. GateGuard Design is your site survey, your quote, your work order, and your as-built — all in one place."

---

### 7.2 Phase 0 — Foundation Canvas (MVP, Weeks 1–6)

Canvas engine: Fabric.js (see Section 8 for justification)

Core canvas features:
- Pan + zoom (mouse wheel + pinch-to-zoom on mobile)
- Canvas grid with snapping (toggle on/off; 1ft grid based on scale)
- Undo/redo (50-step history stack)
- Multi-select with shift-click and rubber-band selection
- Align + distribute tools (left, center, right, top, middle, bottom)
- Copy/paste/duplicate elements
- Group/ungroup elements
- Lock/unlock elements
- Z-order control (bring to front, send to back)
- Keyboard shortcuts: V (select), H (pan), Z (zoom), Escape (deselect), Delete, Ctrl+Z, Ctrl+Y, Ctrl+C, Ctrl+V, Ctrl+D (duplicate), Ctrl+A (select all), Ctrl+G (group), Ctrl+Shift+G (ungroup)

Floor plan import:
- Upload JPEG/PNG as background layer (locked, non-selectable)
- PDF: render first page as canvas background using pdf.js
- Fit-to-canvas on import
- Adjustable opacity for the background layer (slider 10-100%)

Scale calibration:
- "Set Scale" tool: user clicks two points on the background → enters real-world distance + unit (feet or meters) → system computes px/ft ratio
- Alternatively: enter scale ratio directly (e.g., 1" = 20')
- Scale bar widget: always visible in bottom-left corner, shows current scale visually
- All distance measurements in the canvas use this calibration

Saved state:
- Auto-save to Supabase every 30 seconds
- Manual save button with "Saved X seconds ago" indicator
- Version history (store last 10 saves)
- Store as JSON: { background, scale, elements[], layers[], metadata }

---

### 7.3 Phase 1 — Device Library & Smart Placement (Weeks 6–12)

Device taxonomy — implement all these system types:

VIDEO SURVEILLANCE (color: #3B82F6 blue)
- camera_dome: Dome Camera
- camera_bullet: Bullet Camera
- camera_ptz: PTZ Camera
- camera_panoramic: Panoramic/360 Camera
- camera_lpr: LPR Camera
- camera_thermal: Thermal Camera
- camera_fisheye: Fisheye Camera
- nvr: NVR/DVR
- video_encoder: Video Encoder

ACCESS CONTROL (color: #10B981 green)
- reader_prox: Proximity Reader
- reader_smart: Smart Card Reader
- reader_biometric: Biometric Reader
- reader_multi: Multi-Tech Reader
- electric_strike: Electric Strike
- maglok: Magnetic Lock
- rex: REX / Request to Exit Sensor
- door_controller: Door Controller
- access_panel: Access Control Panel
- intercom_video: Video Intercom
- intercom_audio: Audio Intercom
- turnstile: Turnstile
- gate_operator: Gate Operator
- gate_controller: Gate Controller/Interface

INTRUSION DETECTION (color: #F59E0B amber)
- pir_motion: PIR Motion Sensor
- dual_tech: Dual-Tech Motion Detector
- glass_break: Glass Break Detector
- door_contact: Door Contact
- window_contact: Window Contact
- vibration_sensor: Vibration/Shock Sensor
- alarm_panel: Alarm Control Panel
- keypad: Alarm Keypad
- siren_strobe: Siren / Strobe
- smoke_detector: Smoke Detector (intrusion zone type)
- co_detector: Carbon Monoxide Detector
- flood_sensor: Flood/Water Sensor

CABLE INFRASTRUCTURE (color: #6B7280 gray)
- poe_switch: PoE Switch
- network_switch: Network Switch (non-PoE)
- patch_panel: Patch Panel
- wireless_ap: Wireless Access Point
- idf_rack: IDF / Telecom Closet
- junction_box: Junction Box / Pull Box
- conduit_marker: Conduit Path Marker
- ups: UPS Battery Backup
- server: Server/Appliance

FIRE ALARM (color: #EF4444 red)
- smoke_detector_fire: Smoke Detector (NFPA 72)
- heat_detector: Heat Detector
- pull_station: Manual Pull Station
- horn_strobe: Horn/Strobe Notification
- facp: Fire Alarm Control Panel
- duct_detector: Duct Smoke Detector

Device attribute schemas — camera example:

```
CAMERA ATTRIBUTES SCHEMA:
  Specification group:
    manufacturer: text, "e.g. Axis, Hikvision, Hanwha"
    model: text (with autocomplete from product catalog)
    resolution_mp: select ["1MP", "2MP", "4MP", "5MP", "8MP", "12MP", "Other"]
    lens_mm: number "e.g. 2.8, 4.0, 6.0, 2.7-13.5mm varifocal"
    hfov_deg: number (auto-calculated from lens if in catalog, else manual)
    ir_distance_ft: number
    camera_type: select ["Dome", "Bullet", "PTZ", "Panoramic", "Fisheye", "LPR", "Thermal"]

  Installation group:
    mounting: select ["Ceiling", "Wall", "Pole", "Pendant", "Corner Mount"]
    height_ft: number
    cable_type: select ["CAT6", "CAT5e", "Fiber SM", "Fiber MM", "Coax RG-6"]
    cable_length_ft: number (auto-calculated from cable run, or manual override)
    install_status: select ["Proposed", "Ordered", "Installed", "Commissioned", "Needs Service"]
    door_number: text (for access control only)
    panel_assignment: text (for access control: which controller)

  Network group (encrypted storage):
    ip_address: text, encrypted
    mac_address: text, encrypted
    rtsp_url: text, encrypted
    admin_password: text, encrypted

  Notes group:
    notes: textarea
    internal_notes: textarea (not shown on customer-facing reports)
```

Device palette sidebar UX:
- Collapsible accordion sections per system type, color-coded headers
- Device icons shown as 48x48px squares in 3-column grid
- Device name below icon (truncated if long)
- Hover tooltip: device description + typical use case
- Search bar at top: typing "dome" filters across all sections
- Favorites row at top (last 5 used, pinnable)
- Count badge on each section header showing devices placed on current canvas

---

### 7.4 Phase 2 — Camera FOV Engine (Weeks 10–16)

FOV cone implementation:

```typescript
// Core PPF calculation
function computePPF(
  resolution_horizontal: number,  // e.g., 1920 for 1080p, 2560 for 4MP
  hfov_deg: number,
  distance_ft: number
): number {
  const hfov_rad = (hfov_deg * Math.PI) / 180;
  const frame_width_ft = 2 * distance_ft * Math.tan(hfov_rad / 2);
  return resolution_horizontal / frame_width_ft;
}

// DORI thresholds (PPF required)
const DORI_THRESHOLDS = {
  detect: 25,       // 25 PPF minimum
  observe: 62,      // 62 PPF minimum
  recognize: 125,   // 125 PPF minimum
  identify: 250,    // 250 PPF minimum (also called Inspect in some standards)
}

// Range for a given DORI level
function computeRangeForDORI(
  resolution_horizontal: number,
  hfov_deg: number,
  dori_level: keyof typeof DORI_THRESHOLDS
): number {
  const required_ppf = DORI_THRESHOLDS[dori_level];
  const hfov_rad = (hfov_deg * Math.PI) / 180;
  return resolution_horizontal / (required_ppf * 2 * Math.tan(hfov_rad / 2));
}

// Common lens HFOV values (for autocomplete/catalog lookup)
const LENS_HFOV_MAP: Record<string, number> = {
  '1.8mm': 170,     // ultra-wide fisheye
  '2.8mm': 102,     // standard wide angle
  '4mm': 82,        // standard
  '6mm': 55,        // medium
  '8mm': 40,        // telephoto
  '12mm': 28,       // long range
  '16mm': 21,       // very long range
  '2.7-13.5mm': 102, // varifocal, wide end
}
```

Cone visual design:
- Semi-transparent filled wedge (triangle on plan view)
- Color by DORI level:
  - Identify (250 PPF): solid green fill at 25% opacity
  - Recognize (125 PPF): teal fill at 25% opacity
  - Observe (62 PPF): amber fill at 20% opacity
  - Detect (25 PPF): light-gray fill at 15% opacity
- Stroke: 1px solid matching fill color at 80% opacity
- Gradient from camera outward: denser near camera, fading at max range

Interaction handles:
- Direction handle at cone tip: drag to rotate camera direction
- Range handle at arc midpoint: drag in/out to override range
- Live PPF label appears while dragging: "64 PPF at 20 ft (Observe)"
- Double-click cone: open camera properties panel

Camera Advisor panel (in camera properties):
- DORI level slider with 5 labeled positions (D / O / R / I / IS)
- Label: "At [calculated range] ft: [PPF] PPF ([level] level)"
- Moving slider updates cone color + range in real-time
- "Recommend camera" button: filter product catalog by resolution/lens combos
- "Add to BOM" button: locks in selected model

---

### 7.5 Phase 3 — Cable Runs & Measurements (Weeks 12–18)

Polylength tool (cable run):
- C key activates cable run mode
- Click to start, click to add vertices, double-click or Escape to end
- Properties: cable type selector (CAT6, CAT5e, Fiber SM, Fiber MM, Coax RG-6, 2-conductor)
- Cable run color: each cable type has a distinct color (CAT6=blue, Fiber=orange, Coax=yellow, 2-cond=gray)
- Total length label at midpoint of cable run
- Overhead factor: set per-project (default 15%); displayed length = measured + overhead
- BOM integration: all cable runs of same type summed → quote line item updated

Measurement display:
- Length in real-world units (feet or meters) based on scale calibration
- Option to show feet-inches ("47' 6"") or decimal feet ("47.5 ft")
- Dynamic update as cable is drawn
- Total cable by type shown in BOM panel

Dimension line tool:
- Click two points → dimension line appears with tick marks + measurement text
- Standard architectural dimension style: arrows or ticks on endpoints, measurement above line
- Auto-snaps to horizontal/vertical when within 5 degrees

Area measurement tool:
- Click to place polygon vertices → computed area shown inside polygon
- Use for coverage zone sizing, room square footage

Scale bar widget:
- Always visible in bottom-left corner of canvas
- Updates when scale changes
- Shows real-world distance as a graphic bar (like Google Maps scale bar)

---

### 7.6 Phase 4 — BOM & Quote Integration (Weeks 14–20)

Data flow:
1. Floor Plan Canvas
2. Device placed (camera, reader, etc.)
3. Auto-creates quote_line_item (or updates existing)
4. Quote BOM panel shows live totals
5. Quote proposal PDF includes floor plan image + BOM

Implementation:
- Each design survey has a quote_id (links to quotes table) — can also exist standalone
- When a device is placed:
  1. Check if quote_line_item exists for this device type + model
  2. If yes: increment quantity by 1
  3. If no: create new line item with default unit price from product catalog
- When a device is deleted: decrement quantity (or remove line item if qty drops to 0)
- Cable runs: sum all cable footage by type → auto-set quantity on cable line items
- Labor lines: auto-calculate from device count x labor rate per device type (configurable per org)

BOM panel (bottom drawer, collapsed by default):

Collapsed state (always visible):
```
[  BOM  |  Cameras: 12  |  Readers: 8  |  Sensors: 14  |  Cable: 342 ft CAT6  |  Est. Total: $24,800  ]
```

Expanded state (30% of screen height):
- System type sections with subtotals
- Per-device-type rows: icon + name + qty + unit price + extended
- Cable section: cable type + footage + boxes needed
- Labor estimate (if configured)
- Project total
- "Push to Quote" button → updates linked quote
- "Export BOM" button → PDF or Excel download

---

### 7.7 Phase 5 — Product Catalog & Manufacturer Data (Weeks 12–16)

Product catalog tables:

```sql
CREATE TABLE public.design_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer TEXT NOT NULL,
  model TEXT NOT NULL,
  device_type TEXT NOT NULL,        -- matches device type IDs from schema
  description TEXT,
  resolution_mp FLOAT,              -- for cameras
  hfov_deg FLOAT,                   -- for cameras (horizontal FOV)
  lens_mm TEXT,                     -- for cameras
  rack_u_height INTEGER DEFAULT 1,  -- for rack devices
  msrp_cents INTEGER,               -- manufacturer suggested retail in cents
  cost_cents INTEGER,               -- our cost (for margin calculation)
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Seed data: Start with top 10 manufacturers, 5-10 models each:
- Axis, Hikvision, Hanwha, Verkada, Avigilon (cameras)
- HID Global, Allegion, Brivo, Mercury (access control)
- UniFi, Cisco, Netgear (infrastructure)
- APC, Tripp Lite (UPS)

Product autocomplete: When user types in manufacturer/model field, suggest from catalog. Selecting a product auto-fills resolution, lens, HFOV.

Element Profiles: Save a device with all attributes (including accessories) as a named template.
- Example: "Axis P3245 Standard Install" = {manufacturer: "Axis", model: "P3245-LVE", resolution_mp: 2, lens_mm: "3-9mm", mounting: "Ceiling", cable_type: "CAT6", accessories: ["Axis T91B61 ceiling mount", "CAT6 patch cable 3ft"]}
- Placing the element from this profile creates all the BOM line items at once

---

### 7.8 Phase 6 — Rack Diagram (Weeks 16–22)

Rack diagram canvas (separate tab/modal from floor plan):

Grid: 42U column, 1U = 20px height, standard rack display
- U number labels on left side (U1 at bottom, U42 at top)
- 19" rack graphic boundary (decorative)
- Empty U slots shown as empty rows

Rack device catalog with U-heights:
```
Cisco SG350-28P PoE Switch: 1U
UniFi USW-24-PoE: 1U
Axis S30 16-ch NVR: 2U
APC SMT1500RM2U UPS: 2U
Tripp Lite SMART3000 UPS: 4U
Genetec Synergis Cloud Link: 1U
Mercury EP4502 Access Controller: 1U
1U Blank Panel: 1U
```

Auto-populate from floor plan:
- When NVR is placed on floor plan → automatically appears in rack
- When PoE switch placed → appears in rack
- Camera count drives PoE switch count suggestion (cameras / 24 ports, rounded up)

Power meter widget:
- Total power draw computed from all rack devices (from catalog specs)
- UPS runtime calculator: at current load, UPS provides X minutes of backup
- Visual indicator: green (< 70% capacity), amber (70-90%), red (> 90%)

Export: Rack elevation PDF showing U layout, device labels, power summary

---

### 7.9 Phase 7 — Reporting & Proposal PDF (Weeks 18–24)

Survey Layout report:
- Export current floor plan view as PDF
- Includes: scale bar, north arrow (configurable), device legend, revision block, page title
- Layer control: choose which layers appear (proposal view vs. installation view)
- Multi-floor: each floor on its own page

Bill of Materials report:
- Professional table: Device Type | Manufacturer | Model | Qty | Unit Price | Extended
- Grouped by system type with subtotals
- Cable materials section
- Labor section
- Project total
- Brand logo on cover page

Photo Tour report:
- Each placed device with its associated photos
- Device label + attributes on left; photo on right
- Sequential pages, suitable for punch list

Full Proposal Package:
- Cover page (company logo, project name, date, client name)
- Executive summary
- Floor plan pages (one per floor)
- Rack diagram page
- Bill of Materials
- Terms and conditions (configurable per org)
- Signature block

Integration with existing quote proposal:
- Floor plan images embedded inline in the existing /quotes/[id]/proposal page
- "Download Full Proposal" button generates the complete package

---

### 7.10 GateGuard-Specific Integrations (Native Advantages)

These are features neither Bluebeam nor System Surveyor can offer:

1. Site sync from existing records: If a site already exists in GateGuard (sites table), pre-populate the drawing with known information (site name, address, existing device records from Brivo/UniFi sync).

2. Auto-push to work order: "Convert to Install Job" button → creates work order with one task per device on the drawing (e.g., "Install Axis P3245 at lobby entrance — Camera 01").

3. Tech QR codes per device: Each placed device generates a QR code that the installing tech can scan in the field → opens the /tech interface pre-populated with that device's attributes → technician confirms installation + attaches photo.

4. Brivo / UniFi device import: Sync installed devices from Brivo (access control) and UniFi (cameras/network) → auto-place them on the canvas as "In Service" devices → drawing becomes a live as-built automatically.

5. Quote line item bidirectional sync: Change a camera model in the quote → updates the device on the canvas. Change a device on the canvas → updates the quote. Single source of truth.

6. Service history on device: Tap a device on the canvas → see all linked work orders that referenced that device → service timeline.

7. ARIA integration: ARIA-researched property data (property management system, existing camera brand, access control brand) pre-populates suggested device types when starting a new survey for that property.

---

## 8. CANVAS & RENDERING TECHNOLOGY RECOMMENDATION

### 8.1 Technology Comparison

SVG (raw): DOM-based, inspectable, CSS-styleable, infinite resolution. Performance degrades with hundreds of elements; event handling gets complex. Not recommended as primary engine for a drawing tool.

Canvas 2D API: Simple, fast for 2D rasterization. No built-in hit-testing; elements are not DOM nodes; not exportable as vectors. Needs a wrapper library.

Fabric.js: Built on Canvas 2D; adds object model, selection, groups, events, serialization. The right choice for this use case.

Konva.js: React-friendly Canvas 2D wrapper (react-konva). Good alternative to Fabric.js. Slightly less ecosystem maturity.

WebGL (Pixi.js, Three.js): Extremely fast but massive complexity. Overkill for a 200-device floor plan; adds 100-300KB bundle weight; complex shader code. Not recommended.

tldraw: Excellent whiteboard UX but designed for freeform collaboration, not structured security device placement with typed attributes. Not recommended as a base.

### 8.2 Recommendation: Fabric.js v6

Primary technology: Fabric.js v6 (Canvas 2D with object model)

Reasons:

1. Object model: Every element on the canvas is an object with properties, events, and methods. A camera is a fabric.Group containing an SVG icon + a label text — it has position, rotation, scale, opacity, and custom properties. This maps exactly to our Device model.

2. Serialization: Built-in canvas.toJSON() / canvas.loadFromJSON() system. Our canvas state is already JSON-serializable for Supabase storage.

3. SVG import + export: Fabric.js can import SVG shapes as canvas objects and export the canvas as SVG or PNG. Our device icons are SVG files; they render as crisp vector graphics.

4. Groups: A camera fabric.Group contains SVG icon + label text + FOV cone polygon. Moving the camera moves the entire group.

5. Events: object:moving, object:modified, object:added, object:removed events fire on all canvas interactions. We hook into these to trigger BOM updates, Supabase saves, and property panel updates.

6. Selection: Multi-select, rubber-band select, group selection — all built in.

7. React integration: Thin custom wrapper in a useEffect with refs.

8. Performance: For a security floor plan with 50-200 devices + FOV cones + cable runs (~300-500 objects total), Canvas 2D is perfectly adequate.

9. Layering: Fabric.js supports z-order; we implement our layer system by managing object ordering and custom "layer" property on each object.

10. Mobile: Fabric.js supports touch events for pinch-zoom and touch drag.

Secondary technology: SVG for icons + exports

All device icons are SVG files (scalable, resolution-independent). We render them inside Fabric.js as SVG objects. For export, we output the canvas as SVG (preserving vector quality) or PNG for embedding in PDFs.

Alternative if Fabric.js v6 performance proves inadequate at scale: Konva.js via react-konva.

### 8.3 Architecture

```
/app/design/page.tsx                    — Route: /design (survey list)
/app/design/[surveyId]/page.tsx         — Specific floor plan survey
/components/design/
  DesignCanvas.tsx                      — Main canvas component (Fabric.js host)
  DevicePalette.tsx                     — Left sidebar: device type browser + search
  DevicePropertiesPanel.tsx             — Right sidebar: selected device form
  LayerPanel.tsx                        — Layer visibility toggles
  BOMPanel.tsx                          — Live BOM panel (collapsible bottom panel)
  ScaleCalibration.tsx                  — Scale setup wizard (modal)
  CameraAdvisorPanel.tsx                — DORI + PPF camera advisor
  CableRunTool.tsx                      — Polyline drawing for cable runs
  ToolBar.tsx                           — Top toolbar: tools, zoom, undo/redo, export
  RackDiagram.tsx                       — Separate rack view (tab)
  FloorSelector.tsx                     — Multi-floor tab bar
  LegendPanel.tsx                       — Auto-generated drawing legend
/lib/design/
  fabricWrapper.ts                      — Fabric.js initialization + configuration
  deviceSchemas.ts                      — Device attribute schemas (TypeScript)
  fovCalculations.ts                    — PPF, DORI, cone geometry math
  scaleSystem.ts                        — Scale calibration + unit conversion utilities
  bomCalculations.ts                    — BOM aggregation + quote integration
  canvasSerializer.ts                   — JSON save/load (Supabase storage)
  exportUtils.ts                        — PDF/SVG/PNG export using jsPDF + pdf-lib
/public/icons/security/                 — SVG icon files for all device types
  camera_dome.svg
  camera_bullet.svg
  camera_ptz.svg
  card_reader.svg
  card_reader_smart.svg
  motion_pir.svg
  door_contact.svg
  glass_break.svg
  alarm_panel.svg
  poe_switch.svg
  nvr.svg
  ups.svg
  smoke_detector.svg
  pull_station.svg
  ...  (50+ icons total)
```

### 8.4 Canvas State Storage Schema

```sql
-- Design surveys table
CREATE TABLE IF NOT EXISTS public.design_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id),
  quote_id UUID REFERENCES quotes(id),
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL DEFAULT 'Floor Plan',
  floor_number INTEGER DEFAULT 1,
  canvas_json JSONB,              -- Fabric.js serialized canvas state
  scale_px_per_ft FLOAT,         -- Calibrated scale
  scale_unit TEXT DEFAULT 'ft',
  background_image_url TEXT,      -- Supabase storage URL for floor plan image
  thumbnail_url TEXT,             -- Auto-generated thumbnail
  created_by TEXT,                -- Clerk user ID
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Individual devices (for querying without parsing full canvas JSON)
CREATE TABLE IF NOT EXISTS public.design_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID REFERENCES design_surveys(id) ON DELETE CASCADE,
  device_type TEXT NOT NULL,      -- e.g., 'camera_dome', 'reader_prox'
  system_type TEXT NOT NULL,      -- e.g., 'video', 'access', 'intrusion'
  label TEXT,                     -- e.g., 'Camera-01', 'Reader-D01'
  x FLOAT, y FLOAT,              -- Canvas position (pixels)
  rotation FLOAT DEFAULT 0,       -- Degrees
  attributes JSONB,               -- Device-specific attributes (non-sensitive)
  encrypted_attributes JSONB,     -- Encrypted network config (IP, password, RTSP)
  install_status TEXT DEFAULT 'proposed',
  quote_line_item_id UUID,        -- Links to quote_line_items
  photos JSONB,                   -- Array of {url, caption, taken_at}
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Cable runs
CREATE TABLE IF NOT EXISTS public.design_cable_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID REFERENCES design_surveys(id) ON DELETE CASCADE,
  cable_type TEXT NOT NULL,       -- 'cat6', 'cat5e', 'fiber_sm', 'coax', '2cond'
  path_json JSONB,                -- Array of {x, y} points
  length_ft FLOAT,                -- Calculated from scale
  overhead_pct FLOAT DEFAULT 0.15,
  from_device_id UUID,
  to_device_id UUID,
  quote_line_item_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 9. SPECIFIC UX PATTERNS TO ADOPT

### 9.1 Left Panel: Device Palette

What to copy from System Surveyor:
- Collapsible accordion sections per system type
- Color-coded section headers (Video=blue, Access=green, Intrusion=amber, Fire=red, Infra=gray)
- Device icons in 3-column grid (48x48px squares)
- Device name below icon
- Hover tooltip: device description + typical use case
- Search bar at top
- Favorites row at top (last 5 used, pinnable)
- Scroll indicator for long lists

What to add over System Surveyor:
- Count badge on each section header (devices placed on current canvas)
- Manufacturer filter: "Show only Axis" or "Show only Brivo"
- Quick count per device type
- Keyboard shortcut: type "C" to jump to cameras, "A" to access control, etc.

### 9.2 Right Panel: Device Properties

What to copy from Visio SmartShapes:
- Contextual: no device selected = canvas-level properties; one device selected = device form
- Form sections: collapsible groups (Specification, Installation, Network Config)
- Field types: text, select (dropdown), number, multiselect (chips), date, textarea
- Inline save: changes auto-apply as you type (no Save button needed per field)
- Photo section: thumbnails of attached photos + "Add Photo" button

What to add:
- AI autofill: when user types partial model number, suggest from product catalog
- "Copy specs from" button: copy attributes from another device of same type
- Linked work order: show last service date + link to work order history
- "View in /tech" link: opens the tech field tool context for this device

### 9.3 FOV Cone Interaction

Visual design:
- Cone rendered as SVG path for crispness (placed as Fabric.js SVG object)
- Color by DORI level: green (Identify), teal (Recognize), amber (Observe), light-gray (Detect)
- Fill: 20% opacity with gradient (darker at camera, lighter at range edge)
- Stroke: 1px solid matching fill color at 80% opacity

Interaction:
- Click camera → cone appears with two handles
  - Direction handle: at the tip of the cone; drag to rotate camera direction
  - Range handle: at the arc midpoint; drag in/out to set manual range override
- While dragging handles: live PPF readout overlay ("89 PPF at 30 ft")
- Double-click cone → opens camera properties panel

DORI slider in properties panel:
- Labeled slider: D | O | R | I | IS
- Moving slider updates cone color AND the range in real-time
- Label: "At 35 ft: 89 PPF (Recognition level)" or "Requires 45 ft max for Identification"

### 9.4 Scale Calibration Wizard

Wizard flow:
1. Import floor plan → "Set Scale to unlock measurements" banner appears
2. User clicks "Set Scale" → crosshair cursor activates
3. Click Point A (one end of a known wall) → red dot placed
4. Click Point B (other end) → red dot placed + temporary dimension line drawn
5. Input dialog: "Enter the real distance between these points" + [number] [ft / m]
6. System computes scale ratio
7. Scale bar widget in bottom-left updates immediately
8. All cable runs and measurements now show in real-world units

Alternative: "Enter scale ratio directly" link → shows "1 inch = [___] feet" input

"Change Scale" button always available (shows in status bar, orange to indicate calibrated).

### 9.5 Layer Controls

Layer panel (accessed via Layers icon in toolbar):

Toggle rows per system type:
- [eye] Video Surveillance (12 devices)
- [eye] Access Control (8 devices)
- [eye] Intrusion Detection (14 devices)
- [eye] Fire Alarm (0 devices)
- [eye] Cable Infrastructure (6 runs)

Additional toggles:
- [eye] FOV Cones
- [eye] Cable Runs
- [eye] Device Labels
- [eye] Floor Plan Background
- [eye] Coverage Areas

Installation Status filter:
- [radio] All devices | Proposed only | In Place only | Needs Service only

Named view presets (one-click buttons):
- "Proposal View" = shows cones + device icons; hides cables
- "Installation View" = shows cables + devices; hides cones
- "As-Built View" = all layers, color-coded by install status
- "Clean Export" = devices only, no labels

### 9.6 Toolbar Design

Horizontal toolbar across top of canvas:

```
[Site: Acme Corp] [Floor: 1 ▾] [+ Floor]   |   [Undo] [Redo]   |   [V Select] [H Pan] [C Cable] [M Measure] [T Text]   |   [Scale: 1"=20' (calibrated)] [Layers] [Zoom: 100%]   |   [Export ▾] [Share ▾]
```

Tool modes:
- V / Select: arrow cursor; click to select, rubber-band to multi-select
- H / Pan: hand cursor; drag to pan canvas
- D / Device Place: activated when clicking a device in palette; click canvas to place
- C / Cable Run: polyline drawing mode; click vertices, Escape or double-click to end
- M / Measure: linear measurement mode
- T / Text: text annotation mode
- Scale Calibrate: two-point calibration mode (activated from status bar or set-up wizard)

Export dropdown:
- Floor Plan PDF (current layer state)
- BOM PDF
- BOM Excel
- Proposal Package PDF (all floors + rack + BOM + cover)
- PNG Image

### 9.7 BOM Panel

Bottom drawer panel, collapsed by default, opens to 30% screen height:

Collapsed state (always visible at bottom):
```
[ BOM  |  Cameras: 12  |  Readers: 8  |  Sensors: 14  |  CAT6: 342 ft  |  Est: $24,800  |  Push to Quote ]
```

Expanded state shows full table:
- Row per device type/model with quantity + pricing
- Cable section
- Labor estimate
- Total
- "Push to Quote" → syncs to linked quote
- "Export BOM" → PDF or Excel

### 9.8 Multi-Device Selection & Alignment

Align toolbar (appears as floating context bar when 2+ devices are selected):
- Align: Left | Center | Right | Top | Middle | Bottom
- Distribute: Horizontal | Vertical
- Match size: Width | Height

Numeric position editor (in properties panel with multi-select):
- X: [___] Y: [___] Rotation: [___°] applies to relative position / rotation of selection

### 9.9 Mobile / Tablet Field UX

Simplified bottom navigation bar (replaces top toolbar):
- Camera icon: open device palette
- Pan icon: pan mode
- Layers icon: layer panel
- Add Photo icon: add photo to selected device
- Menu icon: save, export, settings

Device placement on mobile:
- Tap device type in palette → tap on canvas to place (no drag needed)
- Large device icons (64x64px on mobile) for fat-finger accuracy
- Double-tap to select + open properties

Photo capture:
- Tap device → tap camera icon in properties → native camera opens
- Photo auto-saved and associated with device
- Photo count badge on device icon (small number in corner)

Offline mode:
- Canvas state cached locally in IndexedDB
- Changes queued and synced when online
- Visual indicator in top bar: "Offline — [X] changes pending sync"

---

## 10. BUILD PRIORITY ROADMAP

### Sprint 1 (Weeks 1–3): Canvas Foundation
- Fabric.js canvas setup with React wrapper
- Pan, zoom (mouse + trackpad + pinch-to-zoom)
- Undo/redo (50-step history)
- Background image import (JPG/PNG) as locked background layer
- Scale calibration wizard (two-point + ratio input)
- Scale bar widget (bottom-left, always visible)
- Canvas state save/load via Supabase (design_surveys table)
- Auto-save every 30 seconds
- Toolbar skeleton (tool mode buttons)
- Multi-select + rubber-band selection

### Sprint 2 (Weeks 3–6): Device Placement
- Device palette (left sidebar, accordion sections, 30 core device types)
- SVG icons for all 30 device types
- Drag-and-drop placement from palette
- Click-to-place mode (mobile-friendly)
- Device label auto-numbering (Camera-01, Camera-02, Reader-D01, etc.)
- Device properties panel (right sidebar, contextual forms per device type)
- Device attribute schemas for all 30 types (manufacturer, model, status, etc.)
- Device move/rotate/delete
- Copy/paste/duplicate device
- Layer toggles (per system type)

### Sprint 3 (Weeks 6–9): FOV & Measurements
- FOV cone rendering on camera placement (auto-compute from lens + resolution)
- FOV direction handle (drag to rotate)
- FOV range handle (drag to resize)
- DORI level selector in camera properties
- PPF calculation + live display label
- Cable run tool (polyline drawing, C key shortcut)
- Cable auto-measurement in real-world feet using scale
- Cable type attribute (CAT6, Fiber, Coax, 2-cond)
- Cable colors per type
- Dimension line tool (M key)
- Area measurement tool

### Sprint 4 (Weeks 9–12): BOM & Quote Integration
- BOM panel (live, derived from placed devices)
- Device count by type + cable footage totals
- Link design_surveys to GateGuard quotes table
- Bidirectional sync: device placement <-> quote_line_items
- "Push to Quote" action
- Floor plan export as PNG (embedded in quote proposal PDF)
- Basic proposal package: cover + floor plan + BOM

### Sprint 5 (Weeks 12–16): Product Catalog & Camera Advisor
- Product catalog table (design_products) with 200 seed devices
- Device autocomplete from catalog (type model → suggestions)
- Camera Advisor panel (DORI slider + PPF calculator + camera recommendations)
- Camera advisor drives cone range automatically
- BOM pricing from product catalog (unit price, extended)
- Element Profiles: save device + accessories as reusable template
- Favorites row and recently-used devices in palette
- Installation status layer filter (proposed / installed / needs service)

### Sprint 6 (Weeks 16–20): Rack Diagram & Multi-Floor
- Multi-floor support: floor tabs + per-floor surveys
- Rack diagram view (42U grid, U-snap placement)
- Rack device catalog with U-heights
- Auto-populate rack from floor plan NVR/switch devices
- Power calculation in rack
- Rack export as PDF
- Named view presets in layer panel (Proposal View, Install View, As-Built View)

### Sprint 7 (Weeks 20–24): Reports, Integrations & Polish
- Branded proposal package PDF (all floors + rack + BOM + cover)
- Photo capture per device (mobile camera integration)
- Photo tour report
- Brivo device import → auto-place on canvas
- UniFi device import → auto-place on canvas
- Work order task generation from placed devices
- Tech QR code per device (links to /tech context)
- Google Maps aerial background import
- PDF floor plan import (pdf.js render to background)
- Share link (view-only URL with optional passcode)
- Mobile offline mode (IndexedDB + sync queue)

---

## APPENDIX A: MANUFACTURER PRODUCT CATALOG SEED DATA

Seed these into design_products table for MVP:

VIDEO SURVEILLANCE — CAMERAS:
| Manufacturer | Model | Type | Res (MP) | Lens | HFOV | MSRP |
|---|---|---|---|---|---|---|
| Axis | P3245-LVE | Dome | 2 | 3-9mm | 102° (wide) | $450 |
| Axis | P3267-LV | Dome | 5 | 3-9mm | 102° (wide) | $520 |
| Axis | P3268-LVE | Dome | 8 | 3-9mm | 102° (wide) | $580 |
| Axis | P3245-VE | Dome outdoor | 2 | 3-9mm | 102° | $550 |
| Hanwha | QNV-8080R | Dome | 5 | 2.8mm | 102° | $380 |
| Hikvision | DS-2CD2347G2-LU | Dome | 4 | 2.8mm | 104° | $220 |
| Verkada | CD62 | Dome | 4K | Varifocal | Varifocal | $599 |
| Avigilon | H6A-DO1-IR | Dome | 5 | 3.9mm | 85° | $490 |
| Axis | P1448-LE | Multi-sensor | 32 | Fixed | 180° | $2,200 |
| Axis | Q6135-LE | PTZ | 2 | 3-85mm | 62° | $4,200 |

ACCESS CONTROL — READERS:
| Manufacturer | Model | Type | Credential | MSRP |
|---|---|---|---|---|
| HID Global | RP40-K | Proximity | 125kHz Wiegand | $180 |
| HID Global | iCLASS SE R40 | Smart Card | 13.56MHz, OSDP | $260 |
| HID Global | Signo 20 | Multi-Tech | OSDP v2 | $340 |
| Allegion | AD-300 | Multi-Tech mortise lock | Wiegand/OSDP | $890 |
| Suprema | BioEntry W3 | Biometric | Fingerprint + Card | $580 |
| STid | Mobile ID | BLE/NFC Reader | Mobile Cred | $290 |

ACCESS CONTROL — INFRASTRUCTURE:
| Manufacturer | Model | Type | Doors | MSRP |
|---|---|---|---|---|
| Mercury | EP4502 | Controller | 2 | $550 |
| Mercury | EP1502 | Controller | 1 | $380 |
| Brivo | ACS300 | IP controller | 1 | $480 |
| Genetec | Synergis Cloud Link | Appliance | 8-64 | $2,200 |
| Lenel | LNL-2210 | Controller | 2 | $620 |

INFRASTRUCTURE — NETWORKING:
| Manufacturer | Model | Type | Ports | PoE Budget | MSRP |
|---|---|---|---|---|---|
| UniFi | USW-24-PoE | PoE Switch | 24 | 95W | $279 |
| UniFi | USW-48-PoE | PoE Switch | 48 | 195W | $499 |
| Cisco | SG350-28P | PoE Switch | 28 | 195W | $650 |
| Axis | D8208-R | PoE Switch (rack) | 8 | 240W | $890 |
| UniFi | UDM-Pro | Router/Firewall | — | — | $379 |

INFRASTRUCTURE — NVR/VMS:
| Manufacturer | Model | Type | Channels | Storage | MSRP |
|---|---|---|---|---|---|
| Axis | S3008 | NVR | 8 | 4TB | $1,800 |
| Axis | S30 | NVR | 16-64 | 8TB | $2,400 |
| Hanwha | XRN-1620SB2 | NVR | 16 | 12TB | $1,900 |
| Hikvision | DS-7616NXI-I2/S | NVR | 16 | 8TB | $980 |

---

## APPENDIX B: SECURITY SYSTEM DRAWING ICON SPEC

All device icons must be SVG format, designed on a 48x48px viewBox, with:
- Single path or simple path group (no raster content)
- Fill: "currentColor" (inherits from CSS, enabling theme color-coding per system type)
- Stroke: "none" or "currentColor"
- Centered in viewBox
- Clean, recognizable silhouette at 24x24px display size
- Accessible: include aria-label matching device type name

Standard color-coding when rendered:
- Video Surveillance devices: fill #3B82F6 (blue-500)
- Access Control devices: fill #10B981 (emerald-500)
- Intrusion Detection devices: fill #F59E0B (amber-500)
- Fire Alarm devices: fill #EF4444 (red-500)
- Infrastructure devices: fill #6B7280 (gray-500)
- FOV cones: fill per DORI level (green/teal/amber/gray)
- Cable runs: stroke per cable type (CAT6=blue, Fiber=orange, Coax=yellow, 2-cond=gray)

---

*End of document. This spec is the authoritative design reference for the GateGuard drawing platform. Questions: rfeldman@gateguard.co*
