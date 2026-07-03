"use client";
/**
 * Design Studio — editor (dark glass).  /design/floor-plans?plan=ID
 *
 * System Surveyor + Adobe-PDF feel:
 *  - background picker (Blank / upload image / import PDF page-1 / satellite map)
 *  - categorized GateGuard device library, place/move/select/delete
 *  - color-coded wiring (red power / blue data / green access) + legend
 *  - camera coverage cones (fov angle/range/direction)
 *  - set-scale (drag a line + real distance)
 *  - inspector with System-Surveyor depth (name, mfr, model, price, qty, status, AOC)
 *  - live BOM (counts + est. total price × qty)
 *  - Save (PUT) / Load on mount / export PNG / print
 *
 * Persistence: floor_plans + floor_plan_devices ONLY. Every canvas object is a
 * floor_plan_devices row; positions are PERCENTAGES. Extra data packs into notes JSON.
 * Wires = device_type '__wire__', zones = device_type '__zone__'.
 */
import React, { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, X, Download, Trash2, Loader2, MapPin } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const {
  Ruler, MousePointer, Zap, Camera, Type, Minus, ChevronDown, ChevronRight,
  BarChart3, Upload, Image: ImageIcon, Map: MapIcon, Layers, Printer, GitBranch, Save,
  Stamp: StampIcon,
} = require("lucide-react") as any;

// ── Theme ───────────────────────────────────────────────────────────────────
const BG = "#0B1728";
const CARD = "#131B2E";
const PANEL = "#0F1830";
const BORDER = "rgba(255,255,255,0.1)";
const TEXT = "#F8FAFC";
const MUTED = "#94A3B8";
const BRAND = "#6B7EFF";
const CYAN = "#7DE5FF";

// ── Device library (GateGuard kit) ──────────────────────────────────────────
interface DeviceTypeDef {
  key: string; label: string; color: string; category: string; abbr: string; isCam?: boolean; isBoard?: boolean;
}
const DEVICE_TYPES: DeviceTypeDef[] = [
  { key: "dk6050", label: "DK 6050", color: "#F59E0B", category: "Gate Operators", abbr: "DK" },
  { key: "dk9050", label: "DK 9050", color: "#F59E0B", category: "Gate Operators", abbr: "DK9" },
  { key: "liftmaster", label: "LiftMaster SL3000", color: "#F59E0B", category: "Gate Operators", abbr: "LM" },
  { key: "doorking", label: "DoorKing 1802", color: "#F59E0B", category: "Gate Operators", abbr: "1802" },
  { key: "camera_bullet", label: "Bullet Camera", color: "#3B82F6", category: "Cameras", abbr: "CAM", isCam: true },
  { key: "camera_dome", label: "Dome Camera", color: "#3B82F6", category: "Cameras", abbr: "DOME", isCam: true },
  { key: "camera_ptz", label: "PTZ Camera", color: "#3B82F6", category: "Cameras", abbr: "PTZ", isCam: true },
  { key: "camera_lpr", label: "LPR Camera", color: "#6366F1", category: "Cameras", abbr: "LPR", isCam: true },
  { key: "camera_fisheye", label: "Fisheye Camera", color: "#3B82F6", category: "Cameras", abbr: "FISH", isCam: true },
  { key: "brivo_300", label: "Brivo ACS300", color: "#10B981", category: "Access Control", abbr: "ACS" },
  { key: "brivo_100", label: "Brivo ACS100", color: "#10B981", category: "Access Control", abbr: "ACS1" },
  { key: "reader", label: "Card Reader (HID)", color: "#10B981", category: "Access Control", abbr: "RDR" },
  { key: "rex", label: "REX Sensor", color: "#10B981", category: "Access Control", abbr: "REX" },
  { key: "keypad", label: "Keypad", color: "#10B981", category: "Access Control", abbr: "KPD" },
  { key: "door_contact", label: "Door Contact", color: "#10B981", category: "Access Control", abbr: "DC" },
  { key: "dk1835", label: "DK1835 Callbox", color: "#8B5CF6", category: "Entry Systems", abbr: "CB" },
  { key: "g3_intercom", label: "UniFi G3 Intercom", color: "#8B5CF6", category: "Entry Systems", abbr: "G3" },
  { key: "butterflymx", label: "ButterflyMX Panel", color: "#8B5CF6", category: "Entry Systems", abbr: "BMX" },
  { key: "aiphone_gt", label: "Aiphone GT", color: "#8B5CF6", category: "Entry Systems", abbr: "AP" },
  { key: "ucg_ultra", label: "UCG-Ultra", color: "#0891B2", category: "Networking", abbr: "UCG" },
  { key: "usw_24poe", label: "USW-24-PoE", color: "#0891B2", category: "Networking", abbr: "SW24" },
  { key: "usw_flex", label: "USW-Flex", color: "#0891B2", category: "Networking", abbr: "FLEX" },
  { key: "ap", label: "Access Point", color: "#0891B2", category: "Networking", abbr: "WAP" },
  { key: "loop_det", label: "Loop Detector", color: "#EF4444", category: "Sensors", abbr: "LOOP" },
  { key: "photobeam", label: "Photobeam", color: "#EF4444", category: "Sensors", abbr: "PB" },
  { key: "motion", label: "Motion Sensor", color: "#EF4444", category: "Sensors", abbr: "PIR" },
  { key: "mag_lock", label: "Mag Lock", color: "#64748B", category: "Locks", abbr: "MAG" },
  { key: "strike", label: "Electric Strike", color: "#64748B", category: "Locks", abbr: "STRK" },
  // Added from the Flint River reference sheet ─────────────────────────────────
  { key: "slide_board", label: "Slide Operator Board", color: "#F59E0B", category: "Gate Operators", abbr: "SLIDE", isBoard: true },
  { key: "single_door_ctrl", label: "Single Door Controller", color: "#10B981", category: "Access Control", abbr: "SDC", isBoard: true },
  { key: "pte", label: "Push-to-Exit (PTE)", color: "#10B981", category: "Access Control", abbr: "PTE", isBoard: true },
  { key: "knox_box", label: "Knox Box", color: "#8B5CF6", category: "Entry Systems", abbr: "KNOX" },
  { key: "unifi_gateway", label: "UniFi Gateway", color: "#0891B2", category: "Networking", abbr: "UDM" },
  { key: "usw_8poe", label: "UniFi 8-Port PoE Switch", color: "#0891B2", category: "Networking", abbr: "SW8" },
  { key: "switch_4", label: "4-Port Switch", color: "#0891B2", category: "Networking", abbr: "SW4" },
  { key: "nanostation", label: "NanoStation (USIP NSM5)", color: "#0891B2", category: "Networking", abbr: "NSM5" },
  { key: "ext_mesh", label: "Ext. Mesh AP", color: "#0891B2", category: "Networking", abbr: "MESH" },
  { key: "poe_inserter", label: "PoE Inserter", color: "#0891B2", category: "Networking", abbr: "PoE", isBoard: true },
  { key: "pwr_24v", label: "24V PWR Inserter", color: "#EF4444", category: "Power", abbr: "24V", isBoard: true },
  { key: "xfmr_24vdc", label: "24V DC Transformer", color: "#EF4444", category: "Power", abbr: "XFMR" },
  { key: "mag_lock_board", label: "Mag Lock (wiring)", color: "#64748B", category: "Locks", abbr: "MAG+", isBoard: true },
];

// ── Board terminal maps (Detail mode) ─────────────────────────────────────────
// Named terminals per board device. A conductor of a multi-conductor cable can
// be landed on one of these when a wire is expanded into conductors.
const BOARD_TERMINALS: Record<string, string[]> = {
  single_door_ctrl: ["AC IN 1", "AC IN 2", "BATT+", "BATT−", "LOCK+", "LOCK−", "REX", "GND", "RDR PWR", "RDR GND", "RDR D0", "RDR D1", "AUX N.O.", "AUX COM", "AUX N.C."],
  slide_board: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"],
  poe_inserter: ["POE IN", "DATA / LAN", "POE OUT"],
  pwr_24v: ["24V IN", "GND IN", "24V OUT", "GND OUT"],
  mag_lock_board: ["+", "−"],
  pte: ["N.O.", "COM", "N.C."],
};
// Every terminal name across boards — used as a suggestion list for conductors.
const ALL_TERMINALS = Array.from(new Set(Object.values(BOARD_TERMINALS).flat().concat(["+", "−", "COM", "N.O.", "N.C.", "D0", "D1", "PWR", "GND", "SHIELD"])));

// ── Conductors (Detail mode) ──────────────────────────────────────────────────
// A single wire (a cable) can be expanded into its individual conductors.
interface Conductor { label: string; color: string; term?: string }
// Standard conductor color palette (electrician-familiar).
const CONDUCTOR_PALETTE = ["#EF4444", "#111827", "#F8FAFC", "#22C55E", "#3B82F6", "#F59E0B", "#8B5CF6", "#F97316", "#78716C", "#EC4899"];
// Sensible default conductor sets per cable type — one click to populate.
const CABLE_CONDUCTORS: Record<string, Conductor[]> = {
  "16/2": [{ label: "+", color: "#EF4444" }, { label: "−", color: "#111827" }],
  "18/6": [
    { label: "+", color: "#EF4444" }, { label: "−", color: "#111827" }, { label: "N.O.", color: "#22C55E" },
    { label: "COM", color: "#3B82F6" }, { label: "N.C.", color: "#F59E0B" }, { label: "GND", color: "#78716C" },
  ],
  "22/4": [{ label: "D0", color: "#22C55E" }, { label: "D1", color: "#F8FAFC" }, { label: "PWR", color: "#EF4444" }, { label: "GND", color: "#111827" }],
  "22/2 shielded": [{ label: "A", color: "#EF4444" }, { label: "B", color: "#111827" }, { label: "SHIELD", color: "#78716C" }],
  "CAT6": [{ label: "Data (PoE)", color: "#3B82F6" }],
  "CAT5e": [{ label: "Data (PoE)", color: "#3B82F6" }],
};
const DEVICE_CATEGORIES = Array.from(new Set(DEVICE_TYPES.map((d) => d.category)));
const DEVICE_BY_KEY: Record<string, DeviceTypeDef> = Object.fromEntries(DEVICE_TYPES.map((d) => [d.key, d]));

// ── Starter templates ────────────────────────────────────────────────────────
// A template is a predefined set of devices + wires placed at sensible canvas
// percentages. Applying one just builds those elements on the current plan
// (nothing is persisted until the user hits Save). Coordinates are % of canvas.
interface TplDevice { key: string; xPct: number; yPct: number; label?: string; price?: number; }
interface TplWire { from: [number, number]; to: [number, number]; kind: WireKind; }
interface DesignTemplate {
  id: string; name: string; blurb: string;
  devices: TplDevice[]; wires: TplWire[];
}
const DESIGN_TEMPLATES: DesignTemplate[] = [
  {
    id: "gated_mdu",
    name: "Gated MDU",
    blurb: "Gate operator, entry callbox, 2 cameras & a PoE switch at the entrance.",
    devices: [
      { key: "liftmaster", xPct: 40, yPct: 55, price: 3200 },
      { key: "dk1835", xPct: 30, yPct: 42, price: 1450 },
      { key: "camera_lpr", xPct: 46, yPct: 40, price: 890 },
      { key: "camera_bullet", xPct: 55, yPct: 62, price: 320 },
      { key: "usw_24poe", xPct: 62, yPct: 50, price: 780 },
      { key: "loop_det", xPct: 44, yPct: 62, price: 140 },
    ],
    wires: [
      { from: [62, 50], to: [46, 40], kind: "camera" },  // switch → LPR cam
      { from: [62, 50], to: [55, 62], kind: "camera" },  // switch → bullet cam
      { from: [62, 50], to: [30, 42], kind: "network" }, // switch → callbox
      { from: [30, 42], to: [40, 55], kind: "relay" },   // callbox → operator (open trigger)
      { from: [44, 62], to: [40, 55], kind: "loop" },    // loop → operator
    ],
  },
  {
    id: "access_door",
    name: "Access-Controlled Door",
    blurb: "Brivo controller, card reader, REX, door contact & mag lock on one opening.",
    devices: [
      { key: "brivo_300", xPct: 30, yPct: 45, price: 1100 },
      { key: "reader", xPct: 50, yPct: 40, price: 260 },
      { key: "rex", xPct: 50, yPct: 55, price: 90 },
      { key: "door_contact", xPct: 58, yPct: 47, price: 40 },
      { key: "mag_lock", xPct: 55, yPct: 47, price: 210 },
    ],
    wires: [
      { from: [30, 45], to: [50, 40], kind: "reader" }, // ACS → reader
      { from: [30, 45], to: [50, 55], kind: "reader" }, // ACS → REX (input)
      { from: [30, 45], to: [58, 47], kind: "reader" }, // ACS → door contact (input)
      { from: [30, 45], to: [55, 47], kind: "relay" },  // ACS → mag lock (lock release)
    ],
  },
  {
    id: "camera_ring",
    name: "Perimeter Camera Ring",
    blurb: "Four cameras around the property fed by a central PoE switch.",
    devices: [
      { key: "usw_24poe", xPct: 50, yPct: 50, price: 780 },
      { key: "camera_bullet", xPct: 25, yPct: 25, price: 320 },
      { key: "camera_bullet", xPct: 75, yPct: 25, price: 320 },
      { key: "camera_dome", xPct: 25, yPct: 75, price: 380 },
      { key: "camera_ptz", xPct: 75, yPct: 75, price: 1200 },
    ],
    wires: [
      { from: [50, 50], to: [25, 25], kind: "camera" },
      { from: [50, 50], to: [75, 25], kind: "camera" },
      { from: [50, 50], to: [25, 75], kind: "camera" },
      { from: [50, 50], to: [75, 75], kind: "camera" },
    ],
  },
];


// ── Wire types (colored by SEGMENT ROLE — what the run connects, not voltage) ──
// 12-color cap. Voltage / gauge / PoE / cable type live as per-wire attributes in
// the inspector, so the diagram stays readable while every line keeps full detail.
type WireKind =
  | "line_power" | "device_power"     // Power
  | "motor_motor" | "motor_barrier"   // Gate mechanics
  | "safety" | "loop"                 // Detection & safety
  | "reader" | "relay"                // Entry & access
  | "network" | "camera" | "intercom" | "backhaul"; // Comms & video
const WIRE_COLORS: Record<WireKind, string> = {
  line_power: "#EF4444", device_power: "#F59E0B",
  motor_motor: "#7C3AED", motor_barrier: "#EC4899",
  safety: "#FACC15", loop: "#84CC16",
  reader: "#14B8A6", relay: "#10B981",
  network: "#3B82F6", camera: "#06B6D4", intercom: "#8B5CF6", backhaul: "#64748B",
};
const WIRE_LABELS: Record<WireKind, string> = {
  line_power: "Line power in", device_power: "Head-end → device power",
  motor_motor: "Motor ↔ motor", motor_barrier: "Motor → barrier",
  safety: "Safety devices", loop: "Detection loops",
  reader: "Reader / keypad / callbox", relay: "Relay / trigger / lock",
  network: "Network / data", camera: "Camera → NVR",
  intercom: "Intercom / callbox A/V", backhaul: "Backhaul (fiber / cell / PtP)",
};
// Short chip label for the toolbar/legend where space is tight.
const WIRE_SHORT: Record<WireKind, string> = {
  line_power: "Line power", device_power: "Device power",
  motor_motor: "Motor↔Motor", motor_barrier: "Motor→Barrier",
  safety: "Safety", loop: "Loops",
  reader: "Reader", relay: "Relay / lock",
  network: "Network", camera: "Camera", intercom: "Intercom", backhaul: "Backhaul",
};
// Grouped for the picker + legend so it reads like a tech thinks about a job.
const WIRE_GROUPS: { group: string; kinds: WireKind[] }[] = [
  { group: "Power", kinds: ["line_power", "device_power"] },
  { group: "Gate mechanics", kinds: ["motor_motor", "motor_barrier"] },
  { group: "Detection & safety", kinds: ["safety", "loop"] },
  { group: "Entry & access", kinds: ["reader", "relay"] },
  { group: "Comms & video", kinds: ["network", "camera", "intercom", "backhaul"] },
];
const WIRE_KINDS: WireKind[] = WIRE_GROUPS.flatMap((g) => g.kinds);
// Per-wire detail (color = role; these attributes keep the full spec on click).
interface WireAttrs {
  cable?: string; gauge?: string; lengthFt?: number; poe?: boolean; voltage?: string;
  showConductors?: boolean; conductors?: Conductor[];
}
// Map the legacy 4-kind vocabulary onto the new segment roles so old plans render.
const LEGACY_WIRE_MAP: Record<string, WireKind> = {
  power: "device_power", data: "network", access: "reader", signal: "loop",
};
function normWireKind(k: string): WireKind {
  if ((WIRE_COLORS as Record<string, string>)[k]) return k as WireKind;
  return LEGACY_WIRE_MAP[k] ?? "network";
}
// Common cable choices for the wire inspector dropdown.
const CABLE_OPTIONS = ["", "CAT6", "CAT5e", "Fiber", "16/2", "18/6", "22/4", "22/2 shielded", "RG6 coax", "12 AWG", "14 AWG"];

type ToolMode = "select" | "device" | "wire" | "fov" | "zone" | "scale";

// ── Stage / lifecycle ────────────────────────────────────────────────────────
interface SiteInfo {
  id: string; name: string; address?: string | null;
  city?: string | null; state?: string | null; zip?: string | null;
}
const STAGE_ORDER = ["floor_plan", "system_design", "as_built"] as const;
type Stage = (typeof STAGE_ORDER)[number];
const STAGE_LABEL: Record<Stage, string> = {
  floor_plan: "Floor Plan", system_design: "System Design", as_built: "As-Built",
};
const STAGE_COLOR: Record<Stage, string> = {
  floor_plan: BRAND, system_design: CYAN, as_built: "#34D399",
};
function normStage(status: string): Stage {
  const st = (status ?? "").toLowerCase();
  if (st.includes("as") && st.includes("built")) return "as_built";
  if (st.includes("system") || st.includes("design")) return "system_design";
  return "floor_plan";
}
function nextStage(status: string): Stage | null {
  const i = STAGE_ORDER.indexOf(normStage(status));
  return i >= 0 && i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1] : null;
}

// ── Element data packed into notes JSON ──────────────────────────────────────
interface ElemMeta {
  manufacturer?: string; model?: string; price?: number; qty?: number; status?: string;
  fov?: { angle: number; range: number; direction: number };
  zone?: { name: string };
  wire?: {
    kind: WireKind; from: [number, number]; to: [number, number];
    cable?: string; gauge?: string; lengthFt?: number; poe?: boolean; voltage?: string;
  };
  freeNotes?: string;
}

interface RawDeviceRow {
  id?: string;
  product_id?: string | null;
  device_type: string;
  label: string;
  icon_key?: string | null;
  x_pct: number;
  y_pct: number;
  condition?: string | null;
  action?: string | null;
  notes?: string | null;
  photo_urls?: string[] | null;
}

const genId = () => `e_${Math.random().toString(36).slice(2, 10)}`;

function parseMeta(notes?: string | null): ElemMeta {
  if (!notes) return {};
  try { return JSON.parse(notes) as ElemMeta; } catch { return { freeNotes: notes }; }
}

// ── Sheet size — locked to ARCH 24"w × 18"h (4:3). Persistence is percentage-
// based, so pixels are arbitrary as long as the ratio is 24:18. ──────────────
const SHEET_W_IN = 24;
const SHEET_H_IN = 18;
const CANVAS_W = 1632;                       // 68 px / inch
const CANVAS_H = (CANVAS_W * SHEET_H_IN) / SHEET_W_IN; // 1224 → true 4:3

// ── GateGuard corporate identity (FIXED — not editable in the title block) ─────
const GG_CORP = {
  name: "Gate Guard",
  tagline: "Security & Access Control Systems",
  address: "3423 Piedmont Rd NE, Atlanta, GA 30305",
  phone: "(844) 428-3374",
  web: "gateguard.co",
  logo: "/logo.png",
};

// ── Title-block fields (EDITABLE — the "non-corporate" items) ──────────────────
interface TitleBlock {
  dealerName: string; dealerAddress: string;
  projectName: string; projectAddress: string;
  sheetTitle: string; sheetNumber: string; sheetTotal: string;
  revision: string; date: string; drawnBy: string;
  scale: string; projectNumber: string;
}
const emptyTitleBlock = (): TitleBlock => ({
  dealerName: "", dealerAddress: "",
  projectName: "", projectAddress: "",
  sheetTitle: "System Design", sheetNumber: "1", sheetTotal: "1",
  revision: "A", date: new Date().toISOString().slice(0, 10), drawnBy: "",
  scale: 'As noted', projectNumber: "",
});

function EditorInner() {
  const params = useSearchParams();
  const planId = params.get("plan");

  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fcRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricRef = useRef<any>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  const [planName, setPlanName] = useState("Design");
  const [planStatus, setPlanStatus] = useState<string>("floor_plan");
  const [planSite, setPlanSite] = useState<SiteInfo | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [tool, setTool] = useState<ToolMode>("select");
  const toolRef = useRef<ToolMode>("select");
  toolRef.current = tool;

  const [devKey, setDevKey] = useState<string | null>(null);
  const devKeyRef = useRef<string | null>(null);
  devKeyRef.current = devKey;

  const [wireKind, setWireKind] = useState<WireKind | null>(null);
  const wireKindRef = useRef<WireKind | null>(null);
  wireKindRef.current = wireKind;
  const [showWirePicker, setShowWirePicker] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [titleBlock, setTitleBlock] = useState<TitleBlock>(emptyTitleBlock);
  const [showTitleBlock, setShowTitleBlock] = useState(false);
  const titleBlockRef = useRef<TitleBlock>(titleBlock);
  titleBlockRef.current = titleBlock;

  // Global device product images (device key → public URL). Preloaded into an
  // HTMLImageElement cache so buildDevice can render them synchronously.
  const [symbols, setSymbols] = useState<Record<string, string>>({});
  const symbolsRef = useRef<Record<string, string>>({});
  symbolsRef.current = symbols;
  const imgCacheRef = useRef<Record<string, HTMLImageElement>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const [expandedCat, setExpandedCat] = useState<Record<string, boolean>>({ Cameras: true });
  const [showLibrary, setShowLibrary] = useState(true);
  const [showBom, setShowBom] = useState(false);

  // selection
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selected, setSelected] = useState<any>(null);
  const [inspectorTick, setInspectorTick] = useState(0);

  // wire drawing points (scene coords)
  const wirePtsRef = useRef<{ x: number; y: number }[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wirePreviewRef = useRef<any>(null);

  // scale drag
  const scalePtsRef = useRef<{ x: number; y: number }[]>([]);
  const [showScaleDialog, setShowScaleDialog] = useState(false);
  const [scalePixelDist, setScalePixelDist] = useState(0);
  const [scaleRealFt, setScaleRealFt] = useState("");
  const [pxPerFt, setPxPerFt] = useState<number | null>(null);
  const pxPerFtRef = useRef<number | null>(null);
  pxPerFtRef.current = pxPerFt;

  // background modal
  const [showBgModal, setShowBgModal] = useState(false);
  const [bgAddress, setBgAddress] = useState("");
  const [bgUploading, setBgUploading] = useState(false);

  // BOM refresh trigger
  const [bomTick, setBomTick] = useState(0);
  const bumpBom = useCallback(() => setBomTick((t) => t + 1), []);

  // ── Serialize all canvas objects to device rows (percentages) ──────────────
  const serialize = useCallback((): RawDeviceRow[] => {
    const fc = fcRef.current;
    if (!fc) return [];
    const rows: RawDeviceRow[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fc.getObjects().forEach((o: any) => {
      const d = o.data;
      if (!d || d.kind === "grid" || d.kind === "bg") return;
      if (d.kind === "device") {
        const c = o.getCenterPoint();
        rows.push({
          device_type: d.deviceTypeKey,
          label: d.label,
          icon_key: d.deviceTypeKey,
          x_pct: (c.x / CANVAS_W) * 100,
          y_pct: (c.y / CANVAS_H) * 100,
          condition: d.condition ?? "good",
          action: d.action ?? "new_install",
          notes: JSON.stringify(d.meta ?? {}),
        });
      } else if (d.kind === "wire") {
        rows.push({
          device_type: "__wire__",
          label: d.label ?? "Wire",
          x_pct: (d.from[0] / CANVAS_W) * 100,
          y_pct: (d.from[1] / CANVAS_H) * 100,
          notes: JSON.stringify({ wire: { kind: d.wireKind, from: d.from, to: d.to, ...(d.wireAttrs ?? {}) } } as ElemMeta),
        });
      } else if (d.kind === "zone") {
        const c = o.getCenterPoint();
        rows.push({
          device_type: "__zone__",
          label: d.label ?? "Zone",
          x_pct: (c.x / CANVAS_W) * 100,
          y_pct: (c.y / CANVAS_H) * 100,
          notes: JSON.stringify({
            zone: { name: d.label },
            freeNotes: JSON.stringify({ w: o.width * o.scaleX, h: o.height * o.scaleY }),
          } as ElemMeta),
        });
      }
    });
    // Title-block (editable non-corporate fields) rides along as one special row.
    rows.push({
      device_type: "__titleblock__",
      label: "Title Block",
      x_pct: 0,
      y_pct: 0,
      notes: JSON.stringify({ freeNotes: JSON.stringify(titleBlockRef.current) } as ElemMeta),
    });
    return rows;
  }, []);

  // ── Draw helpers ───────────────────────────────────────────────────────────
  const drawWireObject = useCallback(
    (from: [number, number], to: [number, number], rawKind: WireKind, label?: string, attrs?: WireAttrs) => {
      const fc = fcRef.current;
      const fabric = fabricRef.current;
      if (!fc || !fabric) return;
      const kind = normWireKind(rawKind);
      const a: WireAttrs = attrs ?? {};
      const conductors = a.conductors ?? [];
      const fan = !!a.showConductors && conductors.length > 0;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let obj: any;
      if (fan) {
        // Detail mode: fan the cable into its individual conductors (parallel strands).
        const paths = conductorPaths({ x: from[0], y: from[1] }, { x: to[0], y: to[1] }, conductors.length, 3.2);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const strands: any[] = paths.map((p, i) =>
          new fabric.Polyline(p, {
            stroke: conductors[i].color || WIRE_COLORS[kind],
            strokeWidth: 1.6, fill: "transparent", objectCaching: false,
            stroke_lineCap: "round",
          })
        );
        obj = new fabric.Group(strands, { objectCaching: false });
      } else {
        const pts = orthPath({ x: from[0], y: from[1] }, { x: to[0], y: to[1] });
        obj = new fabric.Polyline(pts, {
          stroke: WIRE_COLORS[kind], strokeWidth: 2.5, fill: "transparent", objectCaching: false,
        });
      }
      obj.data = { kind: "wire", id: genId(), wireKind: kind, from, to, label: label ?? WIRE_LABELS[kind], wireAttrs: a };
      fc.add(obj);
      bumpBom();
    },
    [bumpBom]
  );

  const drawZoneObject = useCallback((cx: number, cy: number, w: number, h: number, name: string) => {
    const fc = fcRef.current;
    const fabric = fabricRef.current;
    if (!fc || !fabric) return;
    const rect = new fabric.Rect({
      left: cx, top: cy, width: w, height: h, originX: "center", originY: "center",
      fill: "rgba(15,23,42,0.015)", stroke: "#334155", strokeWidth: 1.5, rx: 4, ry: 4,
    });
    const txt = new fabric.Text(name, {
      left: cx, top: cy - h / 2 + 14, originX: "center", originY: "center",
      fontSize: 15, fontWeight: "600", fontFamily: "Inter, sans-serif", fill: "#0f172a",
    });
    const group = new fabric.Group([rect, txt], { left: cx, top: cy, originX: "center", originY: "center" });
    group.data = { kind: "zone", id: genId(), label: name };
    fc.add(group);
    fc.sendObjectToBack(group);
  }, []);

  // ── Build a device group on canvas ─────────────────────────────────────────
  const buildDevice = useCallback(
    (x: number, y: number, key: string, meta: ElemMeta, condition?: string, action?: string) => {
      const fc = fcRef.current;
      const fabric = fabricRef.current;
      if (!fc || !fabric) return null;
      const dt = DEVICE_BY_KEY[key];
      if (!dt) return null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = [];

      if (dt.isCam) {
        const fov = meta.fov ?? defaultFov(key);
        const cone = buildCone(fabric, fov, dt.color, pxPerFtRef.current);
        if (cone) parts.push(cone);
      }

      // Product image (if one has been uploaded for this device type) — else the
      // color-coded badge. Image element is preloaded so this stays synchronous.
      const imgEl = imgCacheRef.current[key];
      if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
        const target = 52;
        const s = target / Math.max(imgEl.naturalWidth, imgEl.naturalHeight);
        const pic = new fabric.Image(imgEl, {
          originX: "center", originY: "center", scaleX: s, scaleY: s, left: 0, top: 0,
        });
        parts.push(pic);
      } else {
        const circle = new fabric.Circle({
          radius: 18, fill: dt.color + "22", stroke: dt.color, strokeWidth: 2,
          originX: "center", originY: "center",
        });
        const abbr = new fabric.Text(dt.abbr, {
          fontSize: 8, fontWeight: "700", fontFamily: "IBM Plex Mono, monospace",
          fill: dt.color, originX: "center", originY: "center",
        });
        parts.push(circle, abbr);
      }
      const labelTxt = new fabric.Text(dt.label, {
        fontSize: 9, fontWeight: "600", fontFamily: "Inter, sans-serif", fill: "#0f172a",
        originX: "center", originY: "center", top: imgEl ? 34 : 26,
        backgroundColor: "rgba(255,255,255,0.82)", padding: 2,
      });
      parts.push(labelTxt);

      const group = new fabric.Group(parts, {
        left: x, top: y, originX: "center", originY: "center",
      });
      group.data = {
        kind: "device", id: genId(), deviceTypeKey: key, label: dt.label,
        condition: condition ?? "good", action: action ?? "new_install",
        isCam: dt.isCam ?? false, isBoard: dt.isBoard ?? false,
        meta: {
          qty: 1, price: 0, status: "Proposed", ...meta,
          fov: dt.isCam ? (meta.fov ?? defaultFov(key)) : undefined,
        },
      };
      fc.add(group);
      return group;
    },
    []
  );

  // ── Device product images ──────────────────────────────────────────────────
  const loadSymbolImage = useCallback(
    (key: string, url: string) =>
      new Promise<void>((resolve) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => { imgCacheRef.current[key] = img; resolve(); };
        img.onerror = () => resolve();
        img.src = url;
      }),
    []
  );

  // Redraw every placed device of a given type (used after an image uploads).
  const refreshDevicesOfType = useCallback((key: string) => {
    const fc = fcRef.current;
    if (!fc) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const targets = fc.getObjects().filter((o: any) => o.data?.kind === "device" && o.data.deviceTypeKey === key);
    for (const o of targets) {
      const c = o.getCenterPoint();
      const meta = { ...(o.data.meta || {}) };
      const cond = o.data.condition, act = o.data.action, label = o.data.label;
      fc.remove(o);
      const g = buildDevice(c.x, c.y, key, meta, cond, act);
      if (g) g.data.label = label;
    }
    fc.requestRenderAll();
    bumpBom();
  }, [buildDevice, bumpBom]);

  const uploadSymbol = useCallback(async (key: string, file: File) => {
    setUploadingKey(key);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("key", key);
      const res = await fetch("/api/design/symbols", { method: "POST", body: fd });
      const json = await res.json();
      if (res.ok && json.url) {
        setSymbols((s) => ({ ...s, [key]: json.url }));
        await loadSymbolImage(key, json.url);
        refreshDevicesOfType(key);
      } else {
        alert(json.error || "Upload failed");
      }
    } catch {
      alert("Upload failed");
    }
    setUploadingKey(null);
  }, [loadSymbolImage, refreshDevicesOfType]);

  // Fetch the shared symbol library on mount + preload each image.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/design/symbols", { cache: "no-store" });
        const json = await res.json();
        if (!active || !json?.symbols) return;
        setSymbols(json.symbols);
        await Promise.all(
          Object.entries(json.symbols).map(([k, u]) => loadSymbolImage(k, u as string))
        );
        if (!active) return;
        Object.keys(json.symbols).forEach((k) => refreshDevicesOfType(k));
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, [loadSymbolImage, refreshDevicesOfType]);

  // ── Background ─────────────────────────────────────────────────────────────
  const applyBackground = useCallback(async (url: string | null) => {
    const fc = fcRef.current;
    const fabric = fabricRef.current;
    if (!fc || !fabric) return;
    if (!url) {
      fc.backgroundImage = undefined;
      fc.backgroundColor = "#FFFFFF";
      fc.renderAll();
      return;
    }
    try {
      const img = await fabric.Image.fromURL(url, { crossOrigin: "anonymous" });
      const scale = Math.min(CANVAS_W / (img.width || CANVAS_W), CANVAS_H / (img.height || CANVAS_H));
      img.set({ scaleX: scale, scaleY: scale, left: 0, top: 0, originX: "left", originY: "top" });
      fc.backgroundImage = img;
      fc.renderAll();
    } catch {
      /* ignore bad url */
    }
  }, []);

  // ── Load devices onto canvas ───────────────────────────────────────────────
  const loadDevices = useCallback(
    (devices: RawDeviceRow[]) => {
      const fc = fcRef.current;
      if (!fc) return;
      for (const row of devices) {
        if (row.device_type === "__titleblock__") continue; // handled in loadPlan
        const meta = parseMeta(row.notes);
        const px = (row.x_pct / 100) * CANVAS_W;
        const py = (row.y_pct / 100) * CANVAS_H;
        if (row.device_type === "__wire__" && meta.wire) {
          const { kind, from, to, ...attrs } = meta.wire;
          drawWireObject(from, to, kind, row.label, attrs);
        } else if (row.device_type === "__zone__") {
          let w = 240, h = 160;
          try {
            const dims = meta.freeNotes ? JSON.parse(meta.freeNotes) : null;
            if (dims?.w) w = dims.w; if (dims?.h) h = dims.h;
          } catch { /* keep defaults */ }
          drawZoneObject(px, py, w, h, row.label);
        } else {
          buildDevice(px, py, row.device_type, meta, row.condition ?? undefined, row.action ?? undefined);
        }
      }
      fc.renderAll();
      bumpBom();
    },
    [buildDevice, drawWireObject, drawZoneObject, bumpBom]
  );

  const loadPlan = useCallback(async () => {
    if (!planId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/design/plans/${planId}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        const plan = json.plan;
        const site: SiteInfo | null = plan?.site ?? null;
        if (plan) {
          setPlanName(plan.name ?? "Design");
          setPlanStatus(plan.status ?? "floor_plan");
          setPlanSite(site);
          setFileUrl(plan.file_url ?? null);
          await applyBackground(plan.file_url ?? null);
        }
        // Title block: load saved fields, else seed sensible defaults from the site.
        const rows: RawDeviceRow[] = Array.isArray(json.devices) ? json.devices : [];
        const tbRow = rows.find((r) => r.device_type === "__titleblock__");
        let tb = emptyTitleBlock();
        if (tbRow) {
          try {
            const meta = parseMeta(tbRow.notes);
            if (meta.freeNotes) tb = { ...tb, ...(JSON.parse(meta.freeNotes) as Partial<TitleBlock>) };
          } catch { /* keep defaults */ }
        }
        if (site) {
          const addr = [site.address, [site.city, site.state].filter(Boolean).join(", "), site.zip].filter(Boolean).join(", ");
          if (!tb.projectName) tb.projectName = site.name ?? "";
          if (!tb.projectAddress) tb.projectAddress = addr;
        }
        if (!tb.sheetTitle && plan?.name) tb.sheetTitle = plan.name;
        setTitleBlock(tb);
        if (rows.length) loadDevices(rows);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [planId, applyBackground, loadDevices]);

  // ── Init Fabric ────────────────────────────────────────────────────────────
  useEffect(() => {
    let disposed = false;
    (async () => {
      const fabric = await import("fabric");
      if (disposed || !canvasElRef.current) return;
      fabricRef.current = fabric;
      const fc = new fabric.Canvas(canvasElRef.current, {
        backgroundColor: "#FFFFFF",
        selection: true,
        preserveObjectStacking: true,
      });
      fc.setDimensions({ width: CANVAS_W, height: CANVAS_H });
      fcRef.current = fc;

      fc.on("mouse:down", (opt: unknown) => onMouseDown(opt));
      fc.on("mouse:move", (opt: unknown) => onMouseMove(opt));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fc.on("selection:created", (e: any) => { setSelected(e.selected?.[0] ?? null); setInspectorTick((t) => t + 1); });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fc.on("selection:updated", (e: any) => { setSelected(e.selected?.[0] ?? null); setInspectorTick((t) => t + 1); });
      fc.on("selection:cleared", () => setSelected(null));
      fc.on("object:modified", () => bumpBom());

      setCanvasReady(true);
      await loadPlan();
    })();

    return () => {
      disposed = true;
      if (fcRef.current) { fcRef.current.dispose(); fcRef.current = null; setCanvasReady(false); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keyboard: delete selected
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        const t = e.target as HTMLElement;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
        deleteSelected();
      }
      if (e.key === "Escape") { setTool("select"); setDevKey(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // ── Mouse handlers ─────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function scenePoint(opt: any) {
    const fc = fcRef.current;
    return typeof fc.getScenePoint === "function" ? fc.getScenePoint(opt.e) : fc.getPointer(opt.e);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onMouseDown(opt: any) {
    const fc = fcRef.current;
    const fabric = fabricRef.current;
    if (!fc || !fabric) return;
    const p = scenePoint(opt);
    const mode = toolRef.current;

    if (mode === "scale") {
      const pts = [...scalePtsRef.current, { x: p.x, y: p.y }];
      scalePtsRef.current = pts;
      if (pts.length >= 2) {
        const dx = pts[1].x - pts[0].x, dy = pts[1].y - pts[0].y;
        setScalePixelDist(Math.sqrt(dx * dx + dy * dy));
        setShowScaleDialog(true);
        scalePtsRef.current = [];
        setTool("select");
      }
      return;
    }

    if ((mode === "device" || mode === "fov") && devKeyRef.current) {
      if (opt.target) return;
      const g = buildDevice(p.x, p.y, devKeyRef.current, {});
      if (g) { fc.setActiveObject(g); setSelected(g); }
      fc.renderAll();
      bumpBom();
      return;
    }

    if (mode === "wire") {
      if (!wireKindRef.current) { setShowWirePicker(true); return; } // pick a wire type first
      if (wirePtsRef.current.length === 0) {
        wirePtsRef.current = [{ x: p.x, y: p.y }];
      } else {
        const from = wirePtsRef.current[0];
        drawWireObject([from.x, from.y], [p.x, p.y], wireKindRef.current);
        wirePtsRef.current = [];
        if (wirePreviewRef.current) { fc.remove(wirePreviewRef.current); wirePreviewRef.current = null; }
        fc.renderAll();
      }
      return;
    }

    if (mode === "zone") {
      if (opt.target) return;
      drawZoneObject(p.x, p.y, 320, 220, "New Area");
      fc.renderAll();
      return;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onMouseMove(opt: any) {
    const fc = fcRef.current;
    const fabric = fabricRef.current;
    if (!fc || !fabric) return;
    if (toolRef.current !== "wire" || wirePtsRef.current.length === 0 || !wireKindRef.current) return;
    const p = scenePoint(opt);
    if (wirePreviewRef.current) { fc.remove(wirePreviewRef.current); wirePreviewRef.current = null; }
    const from = wirePtsRef.current[0];
    const pts = orthPath({ x: from.x, y: from.y }, p);
    const line = new fabric.Polyline(pts, {
      stroke: WIRE_COLORS[wireKindRef.current], strokeWidth: 2.5, fill: "transparent",
      strokeDashArray: [5, 4], selectable: false, evented: false,
    });
    wirePreviewRef.current = line;
    fc.add(line);
    fc.renderAll();
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  function deleteSelected() {
    const fc = fcRef.current;
    if (!fc || !selected) return;
    fc.remove(selected);
    fc.discardActiveObject();
    setSelected(null);
    fc.renderAll();
    bumpBom();
  }

  const chooseDevice = (key: string) => {
    setDevKey(key);
    setTool("device");
  };

  const save = async () => {
    if (!planId) { setSaveMsg("No plan id"); return; }
    setSaving(true);
    setSaveMsg(null);
    try {
      const devices = serialize();
      const res = await fetch(`/api/design/plans/${planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: planName, status: planStatus, file_url: fileUrl, devices }),
      });
      const json = await res.json();
      if (res.ok) setSaveMsg(`Saved · ${json.device_count} elements`);
      else setSaveMsg(json.error || "Save failed");
    } catch {
      setSaveMsg("Network error");
    }
    setSaving(false);
    setTimeout(() => setSaveMsg(null), 3500);
  };

  const exportPng = () => {
    const fc = fcRef.current;
    if (!fc) return;
    const url = fc.toDataURL({ format: "png", multiplier: 1.5 });
    const a = document.createElement("a");
    a.href = url; a.download = `${planName.replace(/\s+/g, "_")}.png`; a.click();
  };

  const printSheet = () => {
    const fc = fcRef.current;
    if (!fc) return;
    const url = fc.toDataURL({ format: "png", multiplier: 2 });
    const w = window.open("");
    if (w) {
      w.document.write(
        `<html><head><title>${planName}</title></head><body style="margin:0"><img src="${url}" style="width:100%"/></body></html>`
      );
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 300);
    }
  };

  // ── Stage promotion (Floor Plan → System Design → As-Built) ────────────────
  const promoteStage = async () => {
    if (!planId) { setSaveMsg("No plan id"); return; }
    const next = nextStage(planStatus);
    if (!next) return;
    setPromoting(true);
    try {
      const res = await fetch(`/api/design/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (res.ok && json.plan) {
        setPlanStatus(json.plan.status ?? next);
        setSaveMsg(`Promoted to ${STAGE_LABEL[next]}`);
      } else {
        setSaveMsg(json.error || "Promote failed");
      }
    } catch {
      setSaveMsg("Network error");
    }
    setPromoting(false);
    setTimeout(() => setSaveMsg(null), 3500);
  };

  // ── Starter templates ──────────────────────────────────────────────────────
  const applyTemplate = (tpl: DesignTemplate) => {
    const fc = fcRef.current;
    if (!fc) return;
    for (const d of tpl.devices) {
      const x = (d.xPct / 100) * CANVAS_W;
      const y = (d.yPct / 100) * CANVAS_H;
      const meta: ElemMeta = { qty: 1, price: d.price ?? 0, status: "Proposed" };
      const g = buildDevice(x, y, d.key, meta);
      if (g && d.label) g.data.label = d.label;
    }
    for (const w of tpl.wires) {
      const from: [number, number] = [(w.from[0] / 100) * CANVAS_W, (w.from[1] / 100) * CANVAS_H];
      const to: [number, number] = [(w.to[0] / 100) * CANVAS_W, (w.to[1] / 100) * CANVAS_H];
      drawWireObject(from, to, w.kind);
    }
    fc.renderAll();
    bumpBom();
    setShowTemplates(false);
    setSaveMsg(`Placed "${tpl.name}" template — Save to keep`);
    setTimeout(() => setSaveMsg(null), 4000);
  };

  // ── Full-sheet PDF export (print-to-PDF, Flint River style) ─────────────────
  const exportPdf = () => {
    const fc = fcRef.current;
    if (!fc) return;
    const img = fc.toDataURL({ format: "png", multiplier: 2 });

    const tb = titleBlock;
    const stage = STAGE_LABEL[normStage(planStatus)];
    const v = (s: string, f = "—") => escapeHtml(s && s.trim() ? s : f);

    // BOM rows from live canvas state.
    const bomRows = bom.rows;
    const grand = bom.total;
    const bomHtml = bomRows.length
      ? bomRows.map((r) => `
        <tr>
          <td class="l">${escapeHtml(r.label)}</td>
          <td class="c">${r.qty}</td>
          <td class="r">${r.total ? "$" + r.total.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}</td>
        </tr>`).join("")
      : `<tr><td colspan="3" class="c muted">No devices placed.</td></tr>`;

    // Wiring legend — only the segment roles actually placed on the drawing.
    const usedKinds = bom.wireKinds;
    const legendHtml = usedKinds.length
      ? WIRE_GROUPS.map((g) => {
          const used = g.kinds.filter((k) => usedKinds.includes(k));
          if (!used.length) return "";
          return `<div class="leggrp">${escapeHtml(g.group)}</div>` +
            used.map((k) => `<span class="leg"><span class="sw" style="background:${WIRE_COLORS[k]}"></span>${escapeHtml(WIRE_LABELS[k])}</span>`).join("");
        }).join("")
      : `<div style="font-size:10px;color:#94a3b8">No wires placed.</div>`;

    // Small title-block field cell.
    const fcell = (label: string, value: string) =>
      `<div class="fc"><div class="fl">${escapeHtml(label)}</div><div class="fv">${value}</div></div>`;

    const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>${v(tb.sheetTitle, "System Design")} — ${v(tb.projectName)}</title>
<style>
  @page { size: ${SHEET_W_IN}in ${SHEET_H_IN}in; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Inter, Arial, sans-serif; color: #0f172a; }
  .outer { width: ${SHEET_W_IN}in; height: ${SHEET_H_IN}in; padding: 0.25in; }
  .inner { width: 100%; height: 100%; border: 2.5px solid #0f172a; display: flex; }
  .draw { flex: 1 1 auto; border-right: 2.5px solid #0f172a; display: flex; align-items: center;
    justify-content: center; overflow: hidden; background: #ffffff; padding: 0.12in; }
  .draw img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .tb { width: 4in; flex: 0 0 4in; display: flex; flex-direction: column; }
  .corp { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-bottom: 2.5px solid #0f172a; }
  .corp img { height: 40px; width: auto; }
  .corp .nm { font-size: 17px; font-weight: 800; line-height: 1; }
  .corp .tl { font-size: 9.5px; color: #475569; margin-top: 2px; }
  .row { padding: 6px 12px; border-bottom: 1px solid #cbd5e1; }
  .rl { font-size: 8.5px; letter-spacing: .06em; text-transform: uppercase; color: #64748b; }
  .rv { font-size: 13px; font-weight: 600; line-height: 1.2; }
  .ra { font-size: 10px; color: #475569; margin-top: 1px; }
  .sheetitle { padding: 9px 12px; border-bottom: 2.5px solid #0f172a; background: #eef1ff; }
  .sheetitle .t { font-size: 20px; font-weight: 800; line-height: 1.1; }
  .sheetitle .st { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #4f46e5; margin-top: 2px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 2.5px solid #0f172a; }
  .fc { padding: 5px 12px; border-top: 1px solid #cbd5e1; }
  .fc:nth-child(odd) { border-right: 1px solid #cbd5e1; }
  .fl { font-size: 8px; letter-spacing: .05em; text-transform: uppercase; color: #64748b; }
  .fv { font-size: 12px; font-weight: 600; }
  .sect { padding: 8px 12px; border-bottom: 1px solid #cbd5e1; }
  .sect h4 { margin: 0 0 5px; font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: #475569; }
  .leggrp { font-size: 8px; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; margin: 4px 0 2px; }
  .leg { display: flex; align-items: center; gap: 6px; font-size: 10px; margin-bottom: 2px; }
  .sw { width: 16px; height: 3px; border-radius: 2px; display: inline-block; flex: none; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { text-align: left; color: #475569; font-weight: 600; border-bottom: 1px solid #cbd5e1; padding: 2px 3px; }
  td { padding: 2px 3px; border-bottom: 1px solid #eef2f7; }
  td.c { text-align: center; } td.r { text-align: right; } td.l { text-align: left; }
  td.muted { color: #94a3b8; }
  .grand { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700;
    padding: 5px 3px 0; border-top: 1.5px solid #0f172a; margin-top: 3px; }
  .spacer { flex: 1 1 auto; }
  .foot { padding: 5px 12px; border-top: 2.5px solid #0f172a; font-size: 8px; color: #64748b;
    display: flex; justify-content: space-between; }
</style></head>
<body onload="setTimeout(function(){window.print();}, 400)">
  <div class="outer"><div class="inner">
    <div class="draw"><img src="${img}"/></div>
    <div class="tb">
      <div class="corp">
        <img src="${GG_CORP.logo}" alt="Gate Guard"/>
        <div>
          <div class="nm">${escapeHtml(GG_CORP.name)}</div>
          <div class="tl">${escapeHtml(GG_CORP.tagline)}</div>
          <div class="tl">${escapeHtml(GG_CORP.address)}</div>
          <div class="tl">${escapeHtml(GG_CORP.phone)} · ${escapeHtml(GG_CORP.web)}</div>
        </div>
      </div>
      <div class="row"><div class="rl">Dealer</div><div class="rv">${v(tb.dealerName)}</div>${tb.dealerAddress ? `<div class="ra">${escapeHtml(tb.dealerAddress)}</div>` : ""}</div>
      <div class="row"><div class="rl">Project / Site</div><div class="rv">${v(tb.projectName)}</div>${tb.projectAddress ? `<div class="ra">${escapeHtml(tb.projectAddress)}</div>` : ""}</div>
      <div class="sheetitle"><div class="t">${v(tb.sheetTitle, "System Design")}</div><div class="st">${escapeHtml(stage)}</div></div>
      <div class="grid">
        ${fcell("Scale", v(tb.scale, "As noted"))}
        ${fcell("Date", v(tb.date))}
        ${fcell("Drawn By", v(tb.drawnBy))}
        ${fcell("Rev", v(tb.revision, "A"))}
        ${fcell("Project No.", v(tb.projectNumber))}
        ${fcell("Sheet", `${v(tb.sheetNumber, "1")} of ${v(tb.sheetTotal, "1")}`)}
      </div>
      <div class="sect">
        <h4>Wiring Legend</h4>
        ${legendHtml}
      </div>
      <div class="sect">
        <h4>Bill of Materials</h4>
        <table>
          <thead><tr><th>Device</th><th style="text-align:center">Qty</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>${bomHtml}</tbody>
        </table>
        <div class="grand"><span>Est. Total</span><span>${grand ? "$" + grand.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}</span></div>
      </div>
      <div class="spacer"></div>
      <div class="foot"><span>${SHEET_W_IN}" × ${SHEET_H_IN}" · ${escapeHtml(GG_CORP.web)}</span><span>${escapeHtml(tb.date || "")}</span></div>
    </div>
  </div></div>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) { alert("Pop-up blocked — allow pop-ups to export the PDF sheet."); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
  };

  // ── Background setters ─────────────────────────────────────────────────────
  const setBlankBackground = async () => {
    setFileUrl(null);
    await applyBackground(null);
    setShowBgModal(false);
  };

  const uploadBackground = async (file: File, isPdf: boolean) => {
    if (!planId) return;
    setBgUploading(true);
    try {
      let toSend: File = file;
      let fileType = "image";
      if (isPdf) {
        const img = await renderPdfFirstPage(file);
        if (img) { toSend = img; fileType = "pdf"; }
      }
      const fd = new FormData();
      fd.append("file", toSend);
      fd.append("file_type", fileType);
      const res = await fetch(`/api/design/plans/${planId}/background`, { method: "POST", body: fd });
      const json = await res.json();
      if (res.ok && json.url) {
        setFileUrl(json.url);
        await applyBackground(json.url);
        setShowBgModal(false);
      } else {
        alert(json.error || "Upload failed");
      }
    } catch {
      alert("Upload failed");
    }
    setBgUploading(false);
  };

  const setSatelliteBackground = async () => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) { alert("Mapbox token not configured"); return; }
    if (!bgAddress.trim()) { alert("Enter an address"); return; }
    setBgUploading(true);
    try {
      const geo = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(bgAddress)}.json?access_token=${token}&limit=1`
      ).then((r) => r.json());
      const center = geo?.features?.[0]?.center;
      if (!center) { alert("Address not found"); setBgUploading(false); return; }
      const [lng, lat] = center;
      const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lng},${lat},17,0/1280x800@2x?access_token=${token}`;
      setFileUrl(url);
      await applyBackground(url);
      if (planId) {
        await fetch(`/api/design/plans/${planId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_url: url, file_type: "satellite", devices: serialize() }),
        });
      }
      setShowBgModal(false);
    } catch {
      alert("Satellite fetch failed");
    }
    setBgUploading(false);
  };

  // ── Inspector patch helpers ────────────────────────────────────────────────
  const patchSelectedMeta = (patch: Partial<ElemMeta>) => {
    if (!selected?.data) return;
    selected.data.meta = { ...(selected.data.meta ?? {}), ...patch };
    setInspectorTick((t) => t + 1);
    bumpBom();
  };
  const patchSelectedLabel = (label: string) => {
    if (!selected?.data) return;
    selected.data.label = label;
    setInspectorTick((t) => t + 1);
  };
  const patchSelectedField = (field: "condition" | "action", value: string) => {
    if (!selected?.data) return;
    selected.data[field] = value;
    setInspectorTick((t) => t + 1);
  };
  // Change a placed wire's segment role — recolors the line in place.
  const patchSelectedWire = (kind: WireKind) => {
    const fc = fcRef.current;
    if (!selected?.data || selected.data.kind !== "wire") return;
    selected.data.wireKind = kind;
    if (!selected.data.label || WIRE_KINDS.some((k) => selected.data.label === WIRE_LABELS[k])) {
      selected.data.label = WIRE_LABELS[kind];
    }
    selected.set({ stroke: WIRE_COLORS[kind] });
    fc?.renderAll();
    setInspectorTick((t) => t + 1);
  };
  const patchSelectedWireAttrs = (patch: Partial<WireAttrs>) => {
    if (!selected?.data || selected.data.kind !== "wire") return;
    selected.data.wireAttrs = { ...(selected.data.wireAttrs ?? {}), ...patch };
    setInspectorTick((t) => t + 1);
  };
  // Redraw the selected wire (single line ↔ fanned conductors) after a change
  // to its conductor set. Mirrors rebuildSelectedCone for cameras.
  const rebuildSelectedWire = () => {
    const fc = fcRef.current;
    if (!fc || !selected?.data || selected.data.kind !== "wire") return;
    const { from, to, wireKind, label, wireAttrs } = selected.data;
    fc.remove(selected);
    drawWireObject(from, to, wireKind, label, wireAttrs);
    const objs = fc.getObjects();
    const g = objs[objs.length - 1];
    if (g) { fc.setActiveObject(g); setSelected(g); }
    fc.requestRenderAll();
  };

  // Re-render camera cone after AOC change.
  const rebuildSelectedCone = () => {
    const fc = fcRef.current;
    const fabric = fabricRef.current;
    if (!fc || !fabric || !selected?.data || selected.data.kind !== "device" || !selected.data.isCam) return;
    const c = selected.getCenterPoint();
    const key = selected.data.deviceTypeKey;
    const meta: ElemMeta = { ...selected.data.meta };
    const condition = selected.data.condition, action = selected.data.action;
    const label = selected.data.label;
    fc.remove(selected);
    const g = buildDevice(c.x, c.y, key, meta, condition, action);
    if (g) { g.data.label = label; fc.setActiveObject(g); setSelected(g); }
    fc.renderAll();
  };

  // ── BOM ────────────────────────────────────────────────────────────────────
  const bom = React.useMemo(() => {
    void bomTick;
    const fc = fcRef.current;
    if (!fc) return { rows: [] as { label: string; qty: number; price: number; total: number }[], total: 0, wires: 0, zones: 0, wireKinds: [] as WireKind[] };
    const acc: Record<string, { label: string; qty: number; price: number; total: number }> = {};
    let wires = 0, zones = 0;
    const usedWire = new Set<WireKind>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fc.getObjects().forEach((o: any) => {
      const d = o.data;
      if (!d) return;
      if (d.kind === "wire") { wires++; usedWire.add(normWireKind(d.wireKind)); return; }
      if (d.kind === "zone") { zones++; return; }
      if (d.kind !== "device") return;
      const meta: ElemMeta = d.meta ?? {};
      const key = d.label + "|" + (meta.model ?? "");
      const qty = Number(meta.qty ?? 1) || 1;
      const price = Number(meta.price ?? 0) || 0;
      if (!acc[key]) acc[key] = { label: d.label, qty: 0, price, total: 0 };
      acc[key].qty += qty;
      acc[key].total += qty * price;
    });
    const rows = Object.values(acc).sort((a, b) => b.qty - a.qty);
    const total = rows.reduce((s, r) => s + r.total, 0);
    return { rows, total, wires, zones, wireKinds: Array.from(usedWire) };
  }, [bomTick]);

  // ── UI ───────────────────────────────────────────────────────────────────
  const toolBtn = (mode: ToolMode, Icon: React.ElementType, label: string) => (
    <button
      onClick={() => { setTool(mode); if (mode !== "device" && mode !== "fov") setDevKey(null); }}
      title={label}
      className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
      style={{
        backgroundColor: tool === mode ? BRAND : PANEL,
        border: `1px solid ${tool === mode ? BRAND : BORDER}`,
        color: tool === mode ? "#0B1728" : MUTED,
      }}
    >
      <Icon size={17} />
    </button>
  );

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: BG, color: TEXT }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0" style={{ borderColor: BORDER }}>
        <Layers size={18} style={{ color: CYAN }} />
        <input
          value={planName}
          onChange={(e) => setPlanName(e.target.value)}
          className="bg-transparent text-sm font-semibold outline-none min-w-0 w-48"
          style={{ color: TEXT }}
        />
        <div
          className="flex items-center gap-1.5 rounded-lg px-2 py-1"
          style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}
          title="Design stage"
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STAGE_COLOR[normStage(planStatus)] }} />
          <select
            value={normStage(planStatus)}
            onChange={(e) => setPlanStatus(e.target.value)}
            className="text-xs bg-transparent outline-none"
            style={{ color: TEXT }}
          >
            <option value="floor_plan">Floor Plan</option>
            <option value="system_design">System Design</option>
            <option value="as_built">As-Built</option>
          </select>
        </div>
        {nextStage(planStatus) && (
          <button
            onClick={promoteStage}
            disabled={promoting}
            title={`Promote to ${STAGE_LABEL[nextStage(planStatus)!]}`}
            className="text-xs font-semibold flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 disabled:opacity-50"
            style={{ backgroundColor: `${STAGE_COLOR[nextStage(planStatus)!]}22`, border: `1px solid ${STAGE_COLOR[nextStage(planStatus)!]}`, color: STAGE_COLOR[nextStage(planStatus)!] }}
          >
            {promoting ? <Loader2 size={13} className="animate-spin" /> : <GitBranch size={13} />}
            Promote → {STAGE_LABEL[nextStage(planStatus)!]}
          </button>
        )}
        <button
          onClick={() => setShowBgModal(true)}
          className="text-xs flex items-center gap-1.5 rounded-lg px-3 py-1.5"
          style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: MUTED }}
        >
          <ImageIcon size={13} /> Background
        </button>
        <button
          onClick={() => setShowTitleBlock(true)}
          className="text-xs flex items-center gap-1.5 rounded-lg px-3 py-1.5"
          style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: MUTED }}
        >
          <StampIcon size={13} /> Title Block
        </button>

        <div className="flex-1" />

        {saveMsg && <span className="text-xs" style={{ color: CYAN }}>{saveMsg}</span>}
        <button onClick={exportPng} className="text-xs flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: MUTED }}>
          <Download size={13} /> PNG
        </button>
        <button onClick={exportPdf} className="text-xs flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: MUTED }}>
          <Printer size={13} /> Export PDF
        </button>
        <button onClick={() => setShowBom((s) => !s)} className="text-xs flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ backgroundColor: showBom ? BRAND : PANEL, border: `1px solid ${showBom ? BRAND : BORDER}`, color: showBom ? "#0B1728" : MUTED }}>
          <BarChart3 size={13} /> BOM
        </button>
        <button onClick={save} disabled={saving} className="text-xs font-semibold flex items-center gap-1.5 rounded-lg px-4 py-1.5 disabled:opacity-50" style={{ backgroundColor: BRAND, color: "#0B1728" }}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Left library */}
        {showLibrary && (
          <div className="w-64 shrink-0 border-r flex flex-col" style={{ borderColor: BORDER, backgroundColor: CARD }}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: BORDER }}>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Element Library</span>
              <button onClick={() => setShowLibrary(false)} style={{ color: MUTED }}><X size={14} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {DEVICE_CATEGORIES.map((cat) => {
                const open = expandedCat[cat];
                const items = DEVICE_TYPES.filter((d) => d.category === cat);
                return (
                  <div key={cat} className="mb-1">
                    <button
                      onClick={() => setExpandedCat((s) => ({ ...s, [cat]: !s[cat] }))}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg"
                      style={{ color: TEXT }}
                    >
                      {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      {cat}
                      <span className="ml-auto text-[10px]" style={{ color: MUTED }}>{items.length}</span>
                    </button>
                    {open && (
                      <div className="pl-2 flex flex-col gap-1 mt-1">
                        {items.map((d) => (
                          <div key={d.key} className="flex items-center gap-1">
                            <button
                              onClick={() => chooseDevice(d.key)}
                              className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors hover:brightness-125"
                              style={{
                                backgroundColor: devKey === d.key ? `${d.color}22` : PANEL,
                                border: `1px solid ${devKey === d.key ? d.color : BORDER}`,
                              }}
                            >
                              {symbols[d.key] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={symbols[d.key]} alt="" className="w-6 h-6 object-contain rounded shrink-0" style={{ backgroundColor: "#fff" }} />
                              ) : (
                                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[7px] font-bold shrink-0"
                                  style={{ backgroundColor: d.color + "33", border: `1.5px solid ${d.color}`, color: TEXT }}>
                                  {d.abbr}
                                </span>
                              )}
                              <span className="text-[11px] truncate" style={{ color: TEXT }}>{d.label}</span>
                            </button>
                            <label
                              title={symbols[d.key] ? "Replace image" : "Upload product image"}
                              className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer shrink-0"
                              style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: symbols[d.key] ? "#34D399" : MUTED }}
                            >
                              {uploadingKey === d.key ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSymbol(d.key, f); e.currentTarget.value = ""; }} />
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Canvas area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
            {!showLibrary && (
              <button onClick={() => setShowLibrary(true)} className="text-xs flex items-center gap-1 rounded-lg px-2.5 py-2" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, color: MUTED }}>
                <Plus size={14} /> Library
              </button>
            )}
            {toolBtn("select", MousePointer, "Select")}
            {toolBtn("fov", Camera, "Camera / FOV")}
            {toolBtn("zone", Type, "Area box (one or many)")}
            {toolBtn("scale", Ruler, "Set scale")}
            <button
              onClick={() => setShowTemplates(true)}
              title="Insert a starter template"
              className="h-10 px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors"
              style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: MUTED }}
            >
              <Layers size={15} /> Template
            </button>
            <div className="w-px h-6 mx-1" style={{ backgroundColor: BORDER }} />
            {/* Wire-type picker — one control, opens a grouped popover (12 segment roles) */}
            <div className="relative">
              <button
                onClick={() => { setShowWirePicker((s) => !s); }}
                title="Choose wire type"
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px]"
                style={{
                  backgroundColor: tool === "wire" && wireKind ? `${WIRE_COLORS[wireKind]}22` : CARD,
                  border: `1px solid ${tool === "wire" && wireKind ? WIRE_COLORS[wireKind] : BORDER}`,
                  color: TEXT,
                }}
              >
                <Zap size={13} style={{ color: wireKind ? WIRE_COLORS[wireKind] : MUTED }} />
                {wireKind ? WIRE_SHORT[wireKind] : "Select wire"}
                <ChevronDown size={12} style={{ color: MUTED }} />
              </button>
              {showWirePicker && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowWirePicker(false)} />
                  <div className="absolute left-0 top-full mt-1 z-40 w-60 rounded-xl p-2 shadow-xl"
                    style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
                    {WIRE_GROUPS.map((g) => (
                      <div key={g.group} className="mb-1.5 last:mb-0">
                        <div className="text-[9px] font-semibold uppercase tracking-wider px-1.5 pb-1" style={{ color: MUTED }}>{g.group}</div>
                        {g.kinds.map((k) => (
                          <button
                            key={k}
                            onClick={() => { setWireKind(k); setTool("wire"); setShowWirePicker(false); }}
                            className="w-full flex items-center gap-2 px-1.5 py-1.5 rounded-lg text-left text-[11px] transition-colors hover:brightness-125"
                            style={{
                              backgroundColor: wireKind === k ? `${WIRE_COLORS[k]}22` : "transparent",
                              border: `1px solid ${wireKind === k ? WIRE_COLORS[k] : "transparent"}`,
                              color: TEXT,
                            }}
                          >
                            <span className="w-4 h-1 rounded-full shrink-0" style={{ backgroundColor: WIRE_COLORS[k] }} />
                            {WIRE_LABELS[k]}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="flex-1" />
            {pxPerFt && <span className="text-[11px]" style={{ color: CYAN }}>Scale: {pxPerFt.toFixed(1)} px/ft</span>}
            {selected && (
              <button onClick={deleteSelected} className="text-xs flex items-center gap-1 rounded-lg px-2.5 py-2" style={{ backgroundColor: "#EF444422", border: "1px solid #EF4444", color: "#FCA5A5" }}>
                <Trash2 size={13} /> Delete
              </button>
            )}
          </div>

          {/* Canvas */}
          <div ref={containerRef} className="flex-1 overflow-auto relative" style={{ backgroundColor: "#08111F" }}>
            {(loading || !canvasReady) && (
              <div className="absolute inset-0 flex items-center justify-center z-10" style={{ color: MUTED }}>
                <Loader2 size={22} className="animate-spin mr-2" /> Loading canvas…
              </div>
            )}
            <div className="p-6 inline-block">
              <div className="relative" style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.5)", borderRadius: 8, overflow: "hidden", border: `1px solid ${BORDER}`, width: CANVAS_W, height: CANVAS_H }}>
                <canvas ref={canvasElRef} />
                {canvasReady && (
                  <SheetFrame
                    tb={titleBlock}
                    stage={STAGE_LABEL[normStage(planStatus)]}
                    onEdit={() => setShowTitleBlock(true)}
                  />
                )}
              </div>
            </div>

            {/* Legend — grouped, collapsible (12 segment roles) */}
            <div className="fixed bottom-6 left-72 rounded-xl px-3 py-2 z-20 max-w-[220px]"
              style={{ backgroundColor: "rgba(19,27,46,0.92)", border: `1px solid ${BORDER}`, backdropFilter: "blur(6px)" }}>
              <button
                onClick={() => setShowLegend((s) => !s)}
                className="w-full flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: MUTED }}
              >
                {showLegend ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Wire Legend
              </button>
              {showLegend && (
                bom.wireKinds.length === 0 ? (
                  <div className="mt-1.5 text-[10px]" style={{ color: MUTED }}>Add wires to build the legend.</div>
                ) : (
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    {WIRE_GROUPS.map((g) => {
                      const used = g.kinds.filter((k) => bom.wireKinds.includes(k));
                      if (used.length === 0) return null;
                      return (
                        <div key={g.group}>
                          <div className="text-[8px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: MUTED }}>{g.group}</div>
                          {used.map((k) => (
                            <div key={k} className="flex items-center gap-2 text-[10.5px] leading-tight py-px" style={{ color: TEXT }}>
                              <span className="w-4 h-0.5 rounded shrink-0" style={{ backgroundColor: WIRE_COLORS[k] }} />
                              {WIRE_LABELS[k]}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Right: inspector or BOM */}
        <div className="w-72 shrink-0 border-l flex flex-col" style={{ borderColor: BORDER, backgroundColor: CARD }}>
          {showBom ? (
            <BomPanel bom={bom} />
          ) : selected?.data ? (
            <Inspector
              key={selected.data.id + "_" + inspectorTick}
              selected={selected}
              onLabel={patchSelectedLabel}
              onMeta={patchSelectedMeta}
              onField={patchSelectedField}
              onWireKind={patchSelectedWire}
              onWireAttrs={patchSelectedWireAttrs}
              onWireRebuild={rebuildSelectedWire}
              onRebuildCone={rebuildSelectedCone}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6" style={{ color: MUTED }}>
              <MousePointer size={22} className="mb-3" />
              <p className="text-sm">Select an element to edit its details, or pick one from the library to place it.</p>
            </div>
          )}
        </div>
      </div>

      {/* Background modal */}
      {showBgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={() => !bgUploading && setShowBgModal(false)}>
          <div className="w-full max-w-md rounded-2xl p-5" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{ color: TEXT }}>Choose background</h2>
              <button onClick={() => !bgUploading && setShowBgModal(false)} style={{ color: MUTED }}><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={setBlankBackground} disabled={bgUploading} className="flex items-center gap-3 rounded-xl px-4 py-3 text-left disabled:opacity-50" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
                <Minus size={16} style={{ color: MUTED }} />
                <div><div className="text-sm font-medium" style={{ color: TEXT }}>Blank</div><div className="text-[11px]" style={{ color: MUTED }}>Pure system diagram</div></div>
              </button>

              <label className="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
                <Upload size={16} style={{ color: BRAND }} />
                <div><div className="text-sm font-medium" style={{ color: TEXT }}>Upload image</div><div className="text-[11px]" style={{ color: MUTED }}>PNG / JPG floor plan</div></div>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBackground(f, false); }} />
              </label>

              <label className="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
                <ImageIcon size={16} style={{ color: "#F59E0B" }} />
                <div><div className="text-sm font-medium" style={{ color: TEXT }}>Import PDF (page 1)</div><div className="text-[11px]" style={{ color: MUTED }}>Rasterized to image</div></div>
                <input type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBackground(f, true); }} />
              </label>

              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
                <div className="flex items-center gap-3 mb-2">
                  <MapIcon size={16} style={{ color: CYAN }} />
                  <div><div className="text-sm font-medium" style={{ color: TEXT }}>Satellite map</div><div className="text-[11px]" style={{ color: MUTED }}>Mapbox aerial by address</div></div>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MapPin size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
                    <input value={bgAddress} onChange={(e) => setBgAddress(e.target.value)} placeholder="Property address" className="w-full pl-8 pr-2 py-2 rounded-lg text-xs outline-none" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, color: TEXT }} />
                  </div>
                  <button onClick={setSatelliteBackground} disabled={bgUploading} className="text-xs font-semibold rounded-lg px-3 py-2 disabled:opacity-50" style={{ backgroundColor: CYAN, color: "#0B1728" }}>Go</button>
                </div>
              </div>

              {bgUploading && (
                <div className="flex items-center justify-center py-2 text-xs" style={{ color: CYAN }}>
                  <Loader2 size={14} className="animate-spin mr-2" /> Working…
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Title-block editor */}
      {showTitleBlock && (
        <TitleBlockModal
          tb={titleBlock}
          onSave={(t) => setTitleBlock(t)}
          onClose={() => setShowTitleBlock(false)}
        />
      )}

      {/* Templates modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={() => setShowTemplates(false)}>
          <div className="w-full max-w-lg rounded-2xl p-5" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold" style={{ color: TEXT }}>Starter templates</h2>
              <button onClick={() => setShowTemplates(false)} style={{ color: MUTED }}><X size={18} /></button>
            </div>
            <p className="text-[11px] mb-4" style={{ color: MUTED }}>Drops a common layout onto the canvas. Elements are placed but not saved until you hit Save.</p>
            <div className="flex flex-col gap-2">
              {DESIGN_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => applyTemplate(tpl)}
                  className="flex items-start gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:brightness-125"
                  style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${CYAN}22`, border: `1px solid ${CYAN}55` }}>
                    <Layers size={16} style={{ color: CYAN }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium" style={{ color: TEXT }}>{tpl.name}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: MUTED }}>{tpl.blurb}</div>
                    <div className="text-[10px] mt-1" style={{ color: MUTED }}>{tpl.devices.length} devices · {tpl.wires.length} wires</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Scale dialog */}
      {showScaleDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-xs rounded-2xl p-5" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
            <h2 className="text-sm font-semibold mb-1" style={{ color: TEXT }}>Set scale</h2>
            <p className="text-[11px] mb-3" style={{ color: MUTED }}>You drew a line of {scalePixelDist.toFixed(0)} px. How long is it in real feet?</p>
            <input value={scaleRealFt} onChange={(e) => setScaleRealFt(e.target.value)} type="number" placeholder="Feet" className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-3" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: TEXT }} />
            <div className="flex gap-2">
              <button onClick={() => { setShowScaleDialog(false); setScaleRealFt(""); }} className="flex-1 text-xs rounded-lg py-2" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: MUTED }}>Cancel</button>
              <button onClick={() => { const ft = parseFloat(scaleRealFt); if (ft > 0) setPxPerFt(scalePixelDist / ft); setShowScaleDialog(false); setScaleRealFt(""); }} className="flex-1 text-xs font-semibold rounded-lg py-2" style={{ backgroundColor: BRAND, color: "#0B1728" }}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inspector panel ──────────────────────────────────────────────────────────
function Inspector({
  selected, onLabel, onMeta, onField, onWireKind, onWireAttrs, onWireRebuild, onRebuildCone,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selected: any;
  onLabel: (v: string) => void;
  onMeta: (p: Partial<ElemMeta>) => void;
  onField: (f: "condition" | "action", v: string) => void;
  onWireKind: (k: WireKind) => void;
  onWireAttrs: (p: Partial<WireAttrs>) => void;
  onWireRebuild: () => void;
  onRebuildCone: () => void;
}) {
  const d = selected.data;
  const meta: ElemMeta = d.meta ?? {};
  const isDevice = d.kind === "device";
  const isCam = isDevice && d.isCam;
  const isBoardDev = isDevice && d.isBoard;
  const boardTerminals: string[] = isBoardDev ? (BOARD_TERMINALS[d.deviceTypeKey] ?? []) : [];
  const isWire = d.kind === "wire";
  const wa: WireAttrs = d.wireAttrs ?? {};
  const conductors: Conductor[] = wa.conductors ?? [];

  const field = (label: string, node: React.ReactNode) => (
    <div className="mb-3">
      <label className="text-[11px] font-medium block mb-1" style={{ color: MUTED }}>{label}</label>
      {node}
    </div>
  );
  const inputStyle = { backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: TEXT };

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND}22`, color: BRAND }}>
          {d.kind === "device" ? "Element" : d.kind === "wire" ? "Wire" : "Area"}
        </span>
      </div>

      {field("Name / Label", (
        <input defaultValue={d.label} onBlur={(e) => onLabel(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
      ))}

      {isDevice && (
        <>
          {field("Manufacturer", (
            <input defaultValue={meta.manufacturer ?? ""} onBlur={(e) => onMeta({ manufacturer: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
          ))}
          {field("Model #", (
            <input defaultValue={meta.model ?? ""} onBlur={(e) => onMeta({ model: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
          ))}
          <div className="grid grid-cols-2 gap-2">
            {field("Qty", (
              <input type="number" min={1} defaultValue={meta.qty ?? 1} onBlur={(e) => onMeta({ qty: Math.max(1, parseInt(e.target.value) || 1) })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            ))}
            {field("Unit price ($)", (
              <input type="number" min={0} step="0.01" defaultValue={meta.price ?? 0} onBlur={(e) => onMeta({ price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            ))}
          </div>
          {field("Status", (
            <select defaultValue={meta.status ?? "Proposed"} onChange={(e) => onMeta({ status: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
              <option>Proposed</option><option>Existing</option><option>Installed</option><option>Remove</option>
            </select>
          ))}
          <div className="grid grid-cols-2 gap-2">
            {field("Condition", (
              <select defaultValue={d.condition ?? "good"} onChange={(e) => onField("condition", e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
                <option value="good">Good</option><option value="fair">Fair</option><option value="poor">Poor</option>
              </select>
            ))}
            {field("Action", (
              <select defaultValue={d.action ?? "new_install"} onChange={(e) => onField("action", e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
                <option value="new_install">New Install</option><option value="keep">Keep</option><option value="replace">Replace</option><option value="remove">Remove</option>
              </select>
            ))}
          </div>

          {isCam && (
            <div className="mt-2 pt-3 border-t" style={{ borderColor: BORDER }}>
              <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: CYAN }}>Area of Coverage</div>
              <div className="grid grid-cols-3 gap-2">
                {field("Angle°", (
                  <input type="number" min={0} max={360} defaultValue={meta.fov?.angle ?? 60}
                    onBlur={(e) => { onMeta({ fov: { angle: parseInt(e.target.value) || 60, range: meta.fov?.range ?? 40, direction: meta.fov?.direction ?? 0 } }); onRebuildCone(); }}
                    className="w-full px-2 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                ))}
                {field("Range ft", (
                  <input type="number" min={1} defaultValue={meta.fov?.range ?? 40}
                    onBlur={(e) => { onMeta({ fov: { angle: meta.fov?.angle ?? 60, range: parseInt(e.target.value) || 40, direction: meta.fov?.direction ?? 0 } }); onRebuildCone(); }}
                    className="w-full px-2 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                ))}
                {field("Dir°", (
                  <input type="number" min={0} max={360} defaultValue={meta.fov?.direction ?? 0}
                    onBlur={(e) => { onMeta({ fov: { angle: meta.fov?.angle ?? 60, range: meta.fov?.range ?? 40, direction: parseInt(e.target.value) || 0 } }); onRebuildCone(); }}
                    className="w-full px-2 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {isBoardDev && boardTerminals.length > 0 && (
        <div className="mt-2 pt-3 border-t" style={{ borderColor: BORDER }}>
          <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: CYAN }}>Board Terminals</div>
          <div className="flex flex-wrap gap-1">
            {boardTerminals.map((t) => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: TEXT }}>{t}</span>
            ))}
          </div>
          <p className="text-[10px] mt-2" style={{ color: MUTED }}>Land a wire’s conductors on these when you expand it (select the wire → Show conductors).</p>
        </div>
      )}

      {isWire && (
        <>
          {field("Wire type", (
            <select
              defaultValue={d.wireKind}
              onChange={(e) => onWireKind(e.target.value as WireKind)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={inputStyle}
            >
              {WIRE_GROUPS.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.kinds.map((k) => <option key={k} value={k}>{WIRE_LABELS[k]}</option>)}
                </optgroup>
              ))}
            </select>
          ))}
          <div className="flex items-center gap-2 mb-3 text-[11px]" style={{ color: MUTED }}>
            <span className="w-5 h-1 rounded-full" style={{ backgroundColor: WIRE_COLORS[normWireKind(d.wireKind)] }} />
            Color shown on the diagram
          </div>
          <div className="grid grid-cols-2 gap-2">
            {field("Cable", (
              <select defaultValue={wa.cable ?? ""} onChange={(e) => onWireAttrs({ cable: e.target.value })} className="w-full px-2 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
                {CABLE_OPTIONS.map((c) => <option key={c} value={c}>{c || "—"}</option>)}
              </select>
            ))}
            {field("Gauge / pair", (
              <input defaultValue={wa.gauge ?? ""} onBlur={(e) => onWireAttrs({ gauge: e.target.value })} placeholder="e.g. 18/2" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {field("Length (ft)", (
              <input type="number" min={0} defaultValue={wa.lengthFt ?? ""} onBlur={(e) => onWireAttrs({ lengthFt: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            ))}
            {field("Voltage", (
              <input defaultValue={wa.voltage ?? ""} onBlur={(e) => onWireAttrs({ voltage: e.target.value })} placeholder="e.g. 24VDC" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            ))}
          </div>
          {field("", (
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: TEXT }}>
              <input type="checkbox" defaultChecked={!!wa.poe} onChange={(e) => onWireAttrs({ poe: e.target.checked })} />
              PoE (power over this run)
            </label>
          ))}

          {/* Detail mode: expand this cable into its individual conductors */}
          <div className="mt-2 pt-3 border-t" style={{ borderColor: BORDER }}>
            <label className="flex items-center gap-2 text-sm cursor-pointer mb-2" style={{ color: TEXT }}>
              <input type="checkbox" checked={!!wa.showConductors}
                onChange={(e) => { onWireAttrs({ showConductors: e.target.checked }); onWireRebuild(); }} />
              Show conductors (Detail)
            </label>
            {wa.showConductors && (
              <>
                <div className="flex flex-wrap gap-2 mb-2">
                  <button
                    onClick={() => { const list = [...conductors, { label: `C${conductors.length + 1}`, color: CONDUCTOR_PALETTE[conductors.length % CONDUCTOR_PALETTE.length] }]; onWireAttrs({ conductors: list }); onWireRebuild(); }}
                    className="text-[11px] rounded-lg px-2 py-1" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: TEXT }}>+ Conductor</button>
                  {wa.cable && CABLE_CONDUCTORS[wa.cable] && (
                    <button
                      onClick={() => { onWireAttrs({ conductors: CABLE_CONDUCTORS[wa.cable as string].map((c) => ({ ...c })), showConductors: true }); onWireRebuild(); }}
                      className="text-[11px] rounded-lg px-2 py-1" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: CYAN }}>Auto-fill from {wa.cable}</button>
                  )}
                </div>
                <datalist id="term-list">{ALL_TERMINALS.map((t) => <option key={t} value={t} />)}</datalist>
                <div className="flex flex-col gap-1.5">
                  {conductors.map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <button title="Cycle color"
                        onClick={() => { const idx = CONDUCTOR_PALETTE.indexOf(c.color); const next = CONDUCTOR_PALETTE[(idx + 1) % CONDUCTOR_PALETTE.length]; const list = conductors.map((x, j) => j === i ? { ...x, color: next } : x); onWireAttrs({ conductors: list }); onWireRebuild(); }}
                        className="w-5 h-5 rounded shrink-0" style={{ backgroundColor: c.color, border: `1px solid ${BORDER}` }} />
                      <input defaultValue={c.label} onBlur={(e) => { const list = conductors.map((x, j) => j === i ? { ...x, label: e.target.value } : x); onWireAttrs({ conductors: list }); }}
                        placeholder="Label" className="w-14 px-2 py-1 rounded text-[11px] outline-none" style={inputStyle} />
                      <input list="term-list" defaultValue={c.term ?? ""} onBlur={(e) => { const list = conductors.map((x, j) => j === i ? { ...x, term: e.target.value } : x); onWireAttrs({ conductors: list }); }}
                        placeholder="Terminal" className="flex-1 min-w-0 px-2 py-1 rounded text-[11px] outline-none" style={inputStyle} />
                      <button onClick={() => { const list = conductors.filter((_, j) => j !== i); onWireAttrs({ conductors: list }); onWireRebuild(); }} style={{ color: MUTED }}><X size={13} /></button>
                    </div>
                  ))}
                  {conductors.length === 0 && <p className="text-[10px]" style={{ color: MUTED }}>Add conductors, or Auto-fill from the cable type.</p>}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {field("Notes", (
        <textarea defaultValue={meta.freeNotes ?? ""} onBlur={(e) => onMeta({ freeNotes: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} />
      ))}
    </div>
  );
}

// ── BOM panel ────────────────────────────────────────────────────────────────
function BomPanel({ bom }: { bom: { rows: { label: string; qty: number; price: number; total: number }[]; total: number; wires: number; zones: number } }) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={16} style={{ color: CYAN }} />
        <span className="text-sm font-semibold" style={{ color: TEXT }}>Bill of Materials</span>
      </div>
      {bom.rows.length === 0 ? (
        <p className="text-xs" style={{ color: MUTED }}>No devices placed yet.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: MUTED }}>
              <th className="text-left font-medium pb-2">Item</th>
              <th className="text-right font-medium pb-2">Qty</th>
              <th className="text-right font-medium pb-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {bom.rows.map((r, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${BORDER}` }}>
                <td className="py-2 pr-1" style={{ color: TEXT }}>{r.label}</td>
                <td className="py-2 text-right" style={{ color: TEXT }}>{r.qty}</td>
                <td className="py-2 text-right" style={{ color: MUTED }}>${r.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: BORDER }}>
        <span className="text-xs" style={{ color: MUTED }}>Est. total</span>
        <span className="text-lg font-semibold" style={{ color: CYAN }}>${bom.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
      </div>
      <div className="mt-3 flex gap-3 text-[11px]" style={{ color: MUTED }}>
        <span className="flex items-center gap-1"><GitBranch size={12} /> {bom.wires} wires</span>
        <span className="flex items-center gap-1"><Layers size={12} /> {bom.zones} areas</span>
      </div>
    </div>
  );
}

// ── Architect sheet frame + right-side title block (on-screen overlay) ─────────
function SheetFrame({ tb, stage, onEdit }: { tb: TitleBlock; stage: string; onEdit: () => void }) {
  const line = "#0f172a";     // dark architect border on the white sheet
  const faint = "#cbd5e1";
  const tbW = 250; // title-block column width in px
  const val = (s: string, fallback = "—") => (s && s.trim() ? s : fallback);

  const cell = (label: string, value: string) => (
    <div style={{ borderTop: `1px solid ${faint}`, padding: "5px 8px" }}>
      <div style={{ fontSize: 8, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 11, color: "#0f172a", fontWeight: 600, lineHeight: 1.2, marginTop: 1 }}>{value}</div>
    </div>
  );

  return (
    <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
      {/* Architect double border */}
      <div className="absolute" style={{ inset: 10, border: `2px solid ${line}`, borderRadius: 2 }} />
      <div className="absolute" style={{ inset: 15, border: `1px solid ${faint}`, borderRadius: 1 }} />

      {/* Right-side title block column (click to edit) */}
      <div
        onClick={onEdit}
        title="Click to edit title block"
        style={{
          pointerEvents: "auto", cursor: "pointer",
          position: "absolute", top: 15, bottom: 15, right: 15, width: tbW,
          borderLeft: `2px solid ${line}`,
          background: "#ffffff",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Corporate header — FIXED */}
        <div style={{ padding: "9px 8px", display: "flex", alignItems: "center", gap: 8, borderBottom: `2px solid ${line}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={GG_CORP.logo} alt="Gate Guard" style={{ height: 26, width: "auto", objectFit: "contain" }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{GG_CORP.name}</div>
            <div style={{ fontSize: 8, color: "#64748b", lineHeight: 1.25, marginTop: 2 }}>{GG_CORP.tagline}</div>
            <div style={{ fontSize: 8, color: "#64748b", lineHeight: 1.25 }}>{GG_CORP.phone} · {GG_CORP.web}</div>
          </div>
        </div>

        {/* Dealer + Project — editable */}
        {cell("Dealer", val(tb.dealerName))}
        {tb.dealerAddress ? <div style={{ padding: "0 8px 5px", fontSize: 9, color: "#64748b" }}>{tb.dealerAddress}</div> : null}
        {cell("Project / Site", val(tb.projectName))}
        {tb.projectAddress ? <div style={{ padding: "0 8px 5px", fontSize: 9, color: "#64748b" }}>{tb.projectAddress}</div> : null}

        {/* Sheet title + stage */}
        <div style={{ borderTop: `2px solid ${line}`, padding: "7px 8px", background: "#eef1ff" }}>
          <div style={{ fontSize: 8, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b" }}>Sheet Title</div>
          <div style={{ fontSize: 14, color: "#0f172a", fontWeight: 700, lineHeight: 1.15 }}>{val(tb.sheetTitle, "System Design")}</div>
          <div style={{ fontSize: 9, color: "#4f46e5", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>{stage}</div>
        </div>

        {/* Fielded grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: `2px solid ${line}` }}>
          <div style={{ borderRight: `1px solid ${faint}` }}>{cell("Scale", val(tb.scale, "As noted"))}</div>
          <div>{cell("Date", val(tb.date))}</div>
          <div style={{ borderRight: `1px solid ${faint}` }}>{cell("Drawn By", val(tb.drawnBy))}</div>
          <div>{cell("Rev", val(tb.revision, "A"))}</div>
          <div style={{ borderRight: `1px solid ${faint}` }}>{cell("Project No.", val(tb.projectNumber))}</div>
          <div>{cell("Sheet", `${val(tb.sheetNumber, "1")} of ${val(tb.sheetTotal, "1")}`)}</div>
        </div>

        <div style={{ flex: 1 }} />
        <div style={{ borderTop: `1px solid ${faint}`, padding: "4px 8px", fontSize: 8, color: "#64748b", textAlign: "right" }}>
          {SHEET_W_IN}" × {SHEET_H_IN}" · Click to edit
        </div>
      </div>
    </div>
  );
}

// ── Title-block edit modal (the "non-corporate items") ─────────────────────────
function TitleBlockModal({ tb, onSave, onClose }: { tb: TitleBlock; onSave: (t: TitleBlock) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<TitleBlock>(tb);
  const set = (k: keyof TitleBlock, v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const inputStyle = { backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: TEXT };
  // Rendered as a function call (not <F/>) so inputs keep focus while typing.
  const F = (label: string, k: keyof TitleBlock, ph?: string, col = 1) => (
    <div key={k} style={{ gridColumn: `span ${col}` }}>
      <label className="text-[11px] font-medium block mb-1" style={{ color: MUTED }}>{label}</label>
      <input value={draft[k]} onChange={(e) => set(k, e.target.value)} placeholder={ph}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-5" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold" style={{ color: TEXT }}>Edit title block</h2>
          <button onClick={onClose} style={{ color: MUTED }}><X size={18} /></button>
        </div>
        <p className="text-[11px] mb-4" style={{ color: MUTED }}>
          Gate Guard's logo and company info are fixed. Everything below is yours to edit for this sheet.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {F("Dealer name", "dealerName", "ABC Security LLC", 2)}
          {F("Dealer address", "dealerAddress", "123 Main St, City, ST", 2)}
          {F("Project / site name", "projectName", "Stonegate Apartments", 2)}
          {F("Project / site address", "projectAddress", "456 Park Ave, City, ST", 2)}
          {F("Sheet title", "sheetTitle", "System Design", 2)}
          {F("Sheet number", "sheetNumber", "1")}
          {F("Total sheets", "sheetTotal", "1")}
          {F("Revision", "revision", "A")}
          {F("Date", "date", "2026-07-01")}
          {F("Drawn by", "drawnBy", "Initials")}
          {F("Scale", "scale", "As noted")}
          {F("Project number", "projectNumber", "GG-1042", 2)}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 text-xs rounded-lg py-2.5" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: MUTED }}>Cancel</button>
          <button onClick={() => { onSave(draft); onClose(); }} className="flex-1 text-xs font-semibold rounded-lg py-2.5" style={{ backgroundColor: BRAND, color: "#0B1728" }}>Apply</button>
        </div>
      </div>
    </div>
  );
}

// ── Geometry / util (pure, no refs) ──────────────────────────────────────────
function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function orthPath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const midX = (a.x + b.x) / 2;
  return [
    { x: a.x, y: a.y },
    { x: midX, y: a.y },
    { x: midX, y: b.y },
    { x: b.x, y: b.y },
  ];
}

// Parallel offset copies of the orth path — one strand per conductor, so a
// multi-conductor cable reads as a ribbon of colored wires in Detail mode.
function conductorPaths(a: { x: number; y: number }, b: { x: number; y: number }, n: number, spacing: number) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len; // unit perpendicular
  const base = orthPath(a, b);
  const mid = (n - 1) / 2;
  const out: { x: number; y: number }[][] = [];
  for (let i = 0; i < n; i++) {
    const off = (i - mid) * spacing;
    out.push(base.map((pt) => ({ x: pt.x + px * off, y: pt.y + py * off })));
  }
  return out;
}

function defaultFov(key: string): { angle: number; range: number; direction: number } {
  if (key.includes("fisheye")) return { angle: 360, range: 30, direction: 0 };
  if (key.includes("dome")) return { angle: 110, range: 40, direction: 0 };
  return { angle: 60, range: 50, direction: 0 };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCone(fabric: any, fov: { angle: number; range: number; direction: number }, color: string, pxPerFt: number | null) {
  const rangePx = (pxPerFt ?? 4) * fov.range; // fall back to ~4px/ft if unscaled
  const dirRad = (fov.direction * Math.PI) / 180;
  if (fov.angle >= 360) {
    return new fabric.Circle({
      radius: rangePx / 2, fill: color + "22", stroke: color, strokeWidth: 1,
      originX: "center", originY: "center", selectable: false, evented: false,
    });
  }
  const halfRad = (fov.angle * Math.PI) / 180 / 2;
  const pts = [{ x: 0, y: 0 }];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const a = dirRad - halfRad + (i / steps) * halfRad * 2;
    pts.push({ x: Math.cos(a) * rangePx, y: Math.sin(a) * rangePx });
  }
  return new fabric.Polygon(pts, {
    fill: color + "22", stroke: color, strokeWidth: 1,
    originX: "center", originY: "center", selectable: false, evented: false,
  });
}

// Render PDF page 1 to a PNG File (pdfjs via CDN, lazy).
async function renderPdfFirstPage(file: File): Promise<File | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!w.pdfjsLib) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        s.onload = () => resolve();
        s.onerror = () => reject();
        document.head.appendChild(s);
      });
      w.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
    const buf = await file.arrayBuffer();
    const pdf = await w.pdfjsLib.getDocument({ data: buf }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/png"));
    if (!blob) return null;
    return new File([blob], file.name.replace(/\.pdf$/i, ".png"), { type: "image/png" });
  } catch {
    return null;
  }
}

export default function DesignFloorPlansPage() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center" style={{ backgroundColor: BG, color: MUTED }}><Loader2 size={22} className="animate-spin" /></div>}>
      <EditorInner />
    </Suspense>
  );
}
