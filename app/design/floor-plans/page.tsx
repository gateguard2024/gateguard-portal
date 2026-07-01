"use client";
import React, { useEffect, useRef, useState } from "react";
import { Plus, X, Download, Trash2, Eye, Layers, FileText, Search } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Ruler, MousePointer, Zap, Camera, Type, Eraser, Minus, ChevronDown, ChevronRight, BarChart3, Upload, EyeOff } = require("lucide-react") as any;

// ─── Types ────────────────────────────────────────────────────────────────────

type PageTab = "floorplan" | "rack" | "wire" | "bom";
type ToolMode = "select" | "device" | "cable" | "fov" | "text" | "measure" | "erase";

interface DeviceTypeDef {
  key: string;
  label: string;
  color: string;
  category: string;
  abbr: string;
  isCam?: boolean;
}

interface RackEquip {
  key: string;
  label: string;
  uHeight: number;
  color: string;
  category: string;
}

interface RackSlottedItem {
  id: string;
  typeKey: string;
  label: string;
  slotStart: number;
  uHeight: number;
  color: string;
  notes?: string;
}

interface RackPanel {
  id: string;
  name: string;
  totalU: number;
  items: RackSlottedItem[];
}

interface FloorPlan {
  id: string;
  name: string;
  level: string;
  canvasJson: string;
}

interface WireRow {
  id: string;
  fromLabel: string;
  toLabel: string;
  cableType: string;
  lengthPx: number;
  fromTerminal: string;
  toTerminal: string;
  notes: string;
}

interface BomRow {
  label: string;
  qty: number;
  category: string;
  source: "Floor Plan" | "Rack";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEVICE_TYPES: DeviceTypeDef[] = [
  // Gate Operators
  { key: "dk6050", label: "DK 6050", color: "#F59E0B", category: "Gate Operators", abbr: "DK" },
  { key: "dk9050", label: "DK 9050", color: "#F59E0B", category: "Gate Operators", abbr: "DK9" },
  { key: "liftmaster", label: "LiftMaster SL3000", color: "#F59E0B", category: "Gate Operators", abbr: "LM" },
  { key: "doorking", label: "DoorKing 1802", color: "#F59E0B", category: "Gate Operators", abbr: "DK1802" },
  // Cameras
  { key: "camera_bullet", label: "Bullet Camera", color: "#3B82F6", category: "Cameras", abbr: "CAM", isCam: true },
  { key: "camera_dome", label: "Dome Camera", color: "#3B82F6", category: "Cameras", abbr: "DOME", isCam: true },
  { key: "camera_ptz", label: "PTZ Camera", color: "#3B82F6", category: "Cameras", abbr: "PTZ", isCam: true },
  { key: "camera_lpr", label: "LPR Camera", color: "#6366F1", category: "Cameras", abbr: "LPR", isCam: true },
  { key: "camera_fisheye", label: "Fisheye Camera", color: "#3B82F6", category: "Cameras", abbr: "FISH", isCam: true },
  // Access Control
  { key: "brivo_300", label: "Brivo ACS300", color: "#10B981", category: "Access Control", abbr: "ACS" },
  { key: "brivo_100", label: "Brivo ACS100", color: "#10B981", category: "Access Control", abbr: "ACS1" },
  { key: "reader", label: "Card Reader (HID)", color: "#10B981", category: "Access Control", abbr: "RDR" },
  { key: "rex", label: "REX Sensor", color: "#10B981", category: "Access Control", abbr: "REX" },
  { key: "keypad", label: "Keypad", color: "#10B981", category: "Access Control", abbr: "KPD" },
  { key: "door_contact", label: "Door Contact", color: "#10B981", category: "Access Control", abbr: "DC" },
  // Entry Systems
  { key: "dk1835", label: "DK1835 Callbox", color: "#8B5CF6", category: "Entry Systems", abbr: "CB" },
  { key: "g3_intercom", label: "UniFi G3 Intercom", color: "#8B5CF6", category: "Entry Systems", abbr: "G3" },
  { key: "butterflymx", label: "ButterflyMX Panel", color: "#8B5CF6", category: "Entry Systems", abbr: "BMX" },
  { key: "aiphone_gt", label: "Aiphone GT", color: "#8B5CF6", category: "Entry Systems", abbr: "AP" },
  // Networking
  { key: "ucg_ultra", label: "UCG-Ultra", color: "#0891B2", category: "Networking", abbr: "UCG" },
  { key: "usw_24poe", label: "USW-24-PoE", color: "#0891B2", category: "Networking", abbr: "SW24" },
  { key: "usw_flex", label: "USW-Flex", color: "#0891B2", category: "Networking", abbr: "FLEX" },
  { key: "ap", label: "Access Point", color: "#0891B2", category: "Networking", abbr: "AP" },
  // Sensors
  { key: "loop_det", label: "Loop Detector", color: "#EF4444", category: "Sensors", abbr: "LOOP" },
  { key: "photobeam", label: "Photobeam", color: "#EF4444", category: "Sensors", abbr: "PB" },
  { key: "motion", label: "Motion Sensor", color: "#EF4444", category: "Sensors", abbr: "PIR" },
  // Locks
  { key: "mag_lock", label: "Mag Lock", color: "#64748B", category: "Locks", abbr: "MAG" },
  { key: "strike", label: "Electric Strike", color: "#64748B", category: "Locks", abbr: "STRK" },
];

const DEVICE_CATEGORIES = Array.from(new Set(DEVICE_TYPES.map((d) => d.category)));

const CABLE_COLORS: Record<string, string> = {
  cat6: "#3B82F6",
  cat5e: "#60A5FA",
  "2wire": "#F59E0B",
  coax: "#EAB308",
  fiber: "#7C3AED",
  ac_power: "#EF4444",
  "4wire": "#10B981",
  "18gauge": "#F97316",
};

const CABLE_TYPES = Object.keys(CABLE_COLORS);

const RACK_EQUIP: RackEquip[] = [
  { key: "nvr_8ch", label: "NVR 8-Channel", uHeight: 2, color: "#3B82F6", category: "Recording" },
  { key: "nvr_16ch", label: "NVR 16-Channel", uHeight: 2, color: "#2563EB", category: "Recording" },
  { key: "switch_8poe", label: "USW-8-PoE", uHeight: 1, color: "#0891B2", category: "Networking" },
  { key: "switch_24poe", label: "USW-24-PoE", uHeight: 1, color: "#0891B2", category: "Networking" },
  { key: "ucg_ultra_rack", label: "UCG-Ultra", uHeight: 1, color: "#0891B2", category: "Networking" },
  { key: "patch_24", label: "24-Port Patch Panel", uHeight: 1, color: "#64748B", category: "Cabling" },
  { key: "cable_mgr", label: "Cable Manager", uHeight: 1, color: "#94A3B8", category: "Cabling" },
  { key: "fiber_panel", label: "Fiber Splice Panel", uHeight: 1, color: "#7C3AED", category: "Cabling" },
  { key: "brivo_rack", label: "Brivo ACS300", uHeight: 1, color: "#10B981", category: "Access Control" },
  { key: "mercury_ctrl", label: "Mercury EP1502", uHeight: 1, color: "#10B981", category: "Access Control" },
  { key: "dk_ctrl", label: "DK Controller", uHeight: 2, color: "#F59E0B", category: "Gate Control" },
  { key: "liftmaster_ctrl", label: "LiftMaster Controller", uHeight: 2, color: "#F59E0B", category: "Gate Control" },
  { key: "ups_1500", label: "UPS 1500VA", uHeight: 2, color: "#EF4444", category: "Power" },
  { key: "ups_3000", label: "UPS 3000VA", uHeight: 3, color: "#DC2626", category: "Power" },
  { key: "pdu", label: "Power Distribution Unit", uHeight: 1, color: "#B91C1C", category: "Power" },
  { key: "blank", label: "Blank Panel", uHeight: 1, color: "#374151", category: "Cabling" },
];

const RACK_CATEGORIES = Array.from(new Set(RACK_EQUIP.map((r) => r.category)));

const DEFAULT_RACK: RackPanel = {
  id: "rack-1",
  name: "Main Equipment Cabinet",
  totalU: 24,
  items: [
    { id: "ri-1", typeKey: "patch_24", label: "Patch Panel", slotStart: 1, uHeight: 1, color: "#64748B" },
    { id: "ri-2", typeKey: "switch_24poe", label: "USW-24-PoE (Cameras)", slotStart: 2, uHeight: 1, color: "#0891B2" },
    { id: "ri-3", typeKey: "switch_8poe", label: "USW-8-PoE (Access)", slotStart: 3, uHeight: 1, color: "#0891B2" },
    { id: "ri-4", typeKey: "ucg_ultra_rack", label: "UCG-Ultra", slotStart: 4, uHeight: 1, color: "#0891B2" },
    { id: "ri-5", typeKey: "cable_mgr", label: "Cable Manager", slotStart: 5, uHeight: 1, color: "#94A3B8" },
    { id: "ri-6", typeKey: "nvr_16ch", label: "NVR 16-Channel", slotStart: 6, uHeight: 2, color: "#3B82F6" },
    { id: "ri-7", typeKey: "brivo_rack", label: "Brivo ACS300", slotStart: 8, uHeight: 1, color: "#10B981" },
    { id: "ri-8", typeKey: "dk_ctrl", label: "DK Gate Controller", slotStart: 9, uHeight: 2, color: "#F59E0B" },
    { id: "ri-9", typeKey: "ups_1500", label: "UPS 1500VA", slotStart: 23, uHeight: 2, color: "#EF4444" },
  ],
};

const U_HEIGHT_PX = 36;
const RACK_WIDTH_PX = 320;
const DEMO_CANVAS_JSON = JSON.stringify({ version: "6.0.0", objects: [] });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function orthogonalPath(
  from: { x: number; y: number },
  to: { x: number; y: number }
): Array<{ x: number; y: number }> {
  const midX = (from.x + to.x) / 2;
  return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to];
}

function polylinePixelLength(points: Array<{ x: number; y: number }>): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function genId() {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderIcon(Icon: any, size: number): React.ReactNode {
  return <Icon size={size} />;
}

function getCursorForTool(mode: ToolMode, hasDevice: boolean, scaleMode: boolean): string {
  if (scaleMode) return "crosshair";
  switch (mode) {
    case "device": return hasDevice ? "copy" : "default";
    case "cable": return "crosshair";
    case "fov": return "crosshair";
    case "text": return "text";
    case "measure": return "crosshair";
    case "erase": return "cell";
    default: return "default";
  }
}

// ─── Rack Panel Component ─────────────────────────────────────────────────────

function RackPanelView({
  rack,
  onSelectItem,
  selectedItemId,
  selectedEquipKey,
  onPlaceEquip,
  onRemoveItem,
}: {
  rack: RackPanel;
  onSelectItem: (id: string) => void;
  selectedItemId: string | null;
  selectedEquipKey: string | null;
  onPlaceEquip: (rackId: string, slot: number) => void;
  onRemoveItem: (rackId: string, itemId: string) => void;
}) {
  const occupancy: Record<number, RackSlottedItem | undefined> = {};
  rack.items.forEach((item) => {
    for (let u = item.slotStart; u < item.slotStart + item.uHeight; u++) {
      occupancy[u] = item;
    }
  });

  const rendered = new Set<string>();
  const slots: React.JSX.Element[] = [];

  for (let u = 1; u <= rack.totalU; u++) {
    const item = occupancy[u];
    if (item && !rendered.has(item.id)) {
      rendered.add(item.id);
      slots.push(
        <div
          key={`item-${item.id}`}
          style={{
            height: item.uHeight * U_HEIGHT_PX,
            background: item.color + "18",
            borderLeft: `3px solid ${item.color}`,
            borderBottom: "1px solid #1f2937",
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
          }}
          onClick={() => onSelectItem(item.id)}
          className={selectedItemId === item.id ? "ring-1 ring-inset ring-white/30 bg-white/5" : "hover:bg-white/5"}
        >
          <span style={{ color: "#6b7280", fontSize: 9, width: 28, textAlign: "right", paddingRight: 4, alignSelf: "flex-start", paddingTop: 4, fontFamily: "IBM Plex Mono, monospace", flexShrink: 0 }}>
            {item.slotStart}
          </span>
          <div style={{ flex: 1, padding: "4px 8px", minWidth: 0 }}>
            <div style={{ color: "white", fontSize: 11, fontWeight: 600, fontFamily: "Inter, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.label}
            </div>
            <div style={{ color: item.color, fontSize: 9, fontFamily: "IBM Plex Mono, monospace", marginTop: 1 }}>
              {item.uHeight}U · {item.typeKey}
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onRemoveItem(rack.id, item.id); }} style={{ padding: "4px 8px", color: "#4b5563" }} className="hover:text-red-400 transition-colors">
            <X size={12} />
          </button>
        </div>
      );
    } else if (!item) {
      slots.push(
        <div
          key={`empty-${u}`}
          style={{ height: U_HEIGHT_PX, borderBottom: "1px solid #111827", display: "flex", alignItems: "center", cursor: selectedEquipKey ? "pointer" : "default" }}
          onClick={() => selectedEquipKey && onPlaceEquip(rack.id, u)}
          className={selectedEquipKey ? "hover:bg-white/5" : ""}
        >
          <span style={{ color: "#374151", fontSize: 9, width: 28, textAlign: "right", paddingRight: 4, fontFamily: "IBM Plex Mono, monospace", flexShrink: 0 }}>{u}</span>
          <div style={{ flex: 1, height: 1, background: "#1f2937", marginRight: 8 }} />
          {selectedEquipKey && <span style={{ color: "#374151", fontSize: 9, paddingRight: 8 }}>click to place</span>}
        </div>
      );
    }
  }

  return (
    <div style={{ width: RACK_WIDTH_PX, flexShrink: 0 }}>
      <div style={{ background: "#1f2937", padding: "8px 12px", borderRadius: "6px 6px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700, fontFamily: "IBM Plex Mono, monospace" }}>{rack.name}</span>
        <span style={{ color: "#4b5563", fontSize: 10 }}>{rack.totalU}U</span>
      </div>
      <div style={{ border: "3px solid #374151", borderTop: "none", background: "#111827", borderRadius: "0 0 6px 6px", overflow: "hidden" }}>
        {slots}
      </div>
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────────

export default function FloorPlansPage() {
  // Tabs
  const [activeTab, setActiveTab] = useState<PageTab>("floorplan");

  // Fabric refs — use unknown to avoid SSR import issues
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canvasRef = useRef<any>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  // Tool mode
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [selectedDeviceTypeKey, setSelectedDeviceTypeKey] = useState<string | null>(null);
  const [selectedCableType, setSelectedCableType] = useState("cat6");

  // Canvas UI state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [zoom, setZoom] = useState(100);
  const [pixelsPerFoot, setPixelsPerFoot] = useState(0);
  const [scaleMode, setScaleMode] = useState(false);
  const [scaleLinePoints, setScaleLinePoints] = useState<Array<{ x: number; y: number }>>([]);
  const [showScaleDialog, setShowScaleDialog] = useState(false);
  const [scaleFeetInput, setScaleFeetInput] = useState("");
  const [scalePixelDist, setScalePixelDist] = useState(0);
  const [backgroundVisible, setBackgroundVisible] = useState(true);

  // Cable tool
  const [cablePoints, setCablePoints] = useState<Array<{ x: number; y: number }>>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const previewLineRef = useRef<any>(null);
  const cablePointsRef = useRef<Array<{ x: number; y: number }>>([]);

  // FOV
  const [showFovControls, setShowFovControls] = useState(false);

  // Floor plans
  const [plans, setPlans] = useState<FloorPlan[]>([
    { id: "plan-1", name: "Sunset Commons", level: "Main Entrance", canvasJson: DEMO_CANVAS_JSON },
    { id: "plan-2", name: "Riverview Apts", level: "Pool Gate", canvasJson: DEMO_CANVAS_JSON },
  ]);
  const [activePlanId, setActivePlanId] = useState("plan-1");
  const [showNewPlanForm, setShowNewPlanForm] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanLevel, setNewPlanLevel] = useState("");

  // Inspector state
  const [inspLabel, setInspLabel] = useState("");
  const [inspCondition, setInspCondition] = useState("good");
  const [inspAction, setInspAction] = useState("new_install");
  const [inspNotes, setInspNotes] = useState("");
  const [inspCableType, setInspCableType] = useState("cat6");
  const [inspCableFrom, setInspCableFrom] = useState("");
  const [inspCableTo, setInspCableTo] = useState("");
  const [inspFovAngle, setInspFovAngle] = useState(90);
  const [inspFovRange, setInspFovRange] = useState(40);
  const [inspFovDir, setInspFovDir] = useState(0);

  // Device library collapsed categories
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});

  // Rack state
  const [racks, setRacks] = useState<RackPanel[]>([DEFAULT_RACK]);
  const [selectedRackItemId, setSelectedRackItemId] = useState<string | null>(null);
  const [selectedEquipKey, setSelectedEquipKey] = useState<string | null>(null);
  const [collapsedRackCats, setCollapsedRackCats] = useState<Record<string, boolean>>({});
  const [rackInspector, setRackInspector] = useState<RackSlottedItem | null>(null);

  // Wire / BOM
  const [wireRows, setWireRows] = useState<WireRow[]>([]);
  const [bomRows, setBomRows] = useState<BomRow[]>([]);

  // BG image import
  const bgFileRef = useRef<HTMLInputElement>(null);

  // Ref mirrors for event handlers (avoid stale closures)
  const toolModeRef = useRef<ToolMode>("select");
  const devKeyRef = useRef<string | null>(null);
  const cableTypeRef = useRef("cat6");
  const scaleModeRef = useRef(false);

  useEffect(() => { toolModeRef.current = toolMode; }, [toolMode]);
  useEffect(() => { devKeyRef.current = selectedDeviceTypeKey; }, [selectedDeviceTypeKey]);
  useEffect(() => { cableTypeRef.current = selectedCableType; }, [selectedCableType]);
  useEffect(() => { scaleModeRef.current = scaleMode; }, [scaleMode]);
  useEffect(() => { cablePointsRef.current = cablePoints; }, [cablePoints]);

  // ── Canvas init ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab !== "floorplan") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fc: any = null;

    async function init() {
      if (!canvasElRef.current || !canvasContainerRef.current) return;
      const fabricModule = await import("fabric");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fabric = fabricModule as any;

      const w = canvasContainerRef.current.offsetWidth || 1200;
      const h = canvasContainerRef.current.offsetHeight || 800;

      fc = new fabric.Canvas(canvasElRef.current, {
        width: w,
        height: h,
        backgroundColor: "#ffffff",
        selection: true,
        preserveObjectStacking: true,
      });
      canvasRef.current = fc;
      setCanvasReady(true);

      // Draw grid via SVG data URL
      const gs = 24;
      const svgStr = `<svg width="${gs}" height="${gs}" xmlns="http://www.w3.org/2000/svg"><path d="M ${gs} 0 L 0 0 0 ${gs}" fill="none" stroke="#e2e8f0" stroke-width="0.5"/></svg>`;
      const gridUrl = "data:image/svg+xml;base64," + btoa(svgStr);
      // Fabric v6: loadImage is Promise-based and setBackgroundColor was removed.
      fabric.util.loadImage(gridUrl).then((img: HTMLImageElement) => {
        if (!fc) return;
        fc.backgroundColor = new fabric.Pattern({ source: img, repeat: "repeat" });
        fc.requestRenderAll();
      }).catch(() => {});

      // Events
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fc.on("mouse:down", (opt: any) => onMouseDown(opt, fc, fabric));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fc.on("mouse:move", (opt: any) => onMouseMove(opt, fc, fabric));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fc.on("selection:created", (opt: any) => applySelection(opt.selected?.[0]));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fc.on("selection:updated", (opt: any) => applySelection(opt.selected?.[0]));
      fc.on("selection:cleared", () => { setSelectedObject(null); setShowFovControls(false); });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fc.on("mouse:wheel", (opt: any) => {
        let z = fc.getZoom();
        z *= 0.999 ** opt.e.deltaY;
        z = Math.max(0.1, Math.min(10, z));
        fc.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, z);
        opt.e.preventDefault();
        setZoom(Math.round(z * 100));
      });
    }

    init();

    const onResize = () => {
      if (canvasRef.current && canvasContainerRef.current) {
        canvasRef.current.setDimensions({
          width: canvasContainerRef.current.offsetWidth,
          height: canvasContainerRef.current.offsetHeight,
        });
        canvasRef.current.renderAll();
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      if (fc) { fc.dispose(); canvasRef.current = null; setCanvasReady(false); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── Mouse handlers ───────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onMouseDown(opt: any, fc: any, fabric: any) {
    const mode = toolModeRef.current;
    const ptr = typeof fc.getScenePoint === "function" ? fc.getScenePoint(opt.e) : fc.getPointer(opt.e);

    if (scaleModeRef.current) {
      const pts = [...(scaleLinePoints), { x: ptr.x, y: ptr.y }];
      setScaleLinePoints(pts);
      if (pts.length >= 2) {
        const dx = pts[1].x - pts[0].x;
        const dy = pts[1].y - pts[0].y;
        setScalePixelDist(Math.sqrt(dx * dx + dy * dy));
        setShowScaleDialog(true);
        setScaleLinePoints([]);
        setScaleMode(false);
      }
      return;
    }

    if (mode === "device" && devKeyRef.current) {
      if (opt.target) return;
      doPlaceDevice(ptr.x, ptr.y, devKeyRef.current, fc, fabric);
      return;
    }

    if (mode === "cable") {
      if (opt.target) return;
      const newPts = [...cablePointsRef.current, { x: ptr.x, y: ptr.y }];
      cablePointsRef.current = newPts;
      setCablePoints(newPts);
      return;
    }

    if (mode === "erase") {
      if (opt.target && opt.target.data?.type !== "grid") {
        fc.remove(opt.target);
        fc.renderAll();
        setSelectedObject(null);
      }
      return;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onMouseMove(opt: any, fc: any, fabric: any) {
    if (toolModeRef.current !== "cable" || cablePointsRef.current.length === 0) return;
    const ptr = typeof fc.getScenePoint === "function" ? fc.getScenePoint(opt.e) : fc.getPointer(opt.e);

    if (previewLineRef.current) { fc.remove(previewLineRef.current); previewLineRef.current = null; }

    const last = cablePointsRef.current[cablePointsRef.current.length - 1];
    const pts = orthogonalPath(last, ptr);
    const preview = new fabric.Polyline(pts, {
      stroke: CABLE_COLORS[cableTypeRef.current] ?? "#94a3b8",
      strokeWidth: 2,
      fill: "transparent",
      strokeDashArray: [4, 4],
      selectable: false,
      evented: false,
      opacity: 0.6,
      data: { type: "preview" },
    });
    previewLineRef.current = preview;
    fc.add(preview);
    fc.renderAll();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applySelection(obj: any) {
    if (!obj) return;
    setSelectedObject(obj);
    const d = obj.data ?? {};
    if (d.type === "device") {
      setInspLabel(d.label ?? "");
      setInspCondition(d.condition ?? "good");
      setInspAction(d.action ?? "new_install");
      setInspNotes(d.notes ?? "");
      setInspFovAngle(d.fovAngle ?? 90);
      setInspFovRange(d.fovRange ?? 40);
      setInspFovDir(d.fovDirection ?? 0);
      if (d.isCam) setShowFovControls(true);
    } else if (d.type === "cable") {
      setInspCableType(d.cableType ?? "cat6");
      setInspCableFrom(d.fromTerminal ?? "");
      setInspCableTo(d.toTerminal ?? "");
      setInspNotes(d.notes ?? "");
    }
  }

  // ── Device placement ─────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function doPlaceDevice(x: number, y: number, key: string, fc?: any, fabricParam?: any) {
    const canvas = fc ?? canvasRef.current;
    if (!canvas) return;
    const fabricModule = fabricParam ?? (await import("fabric"));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric = fabricModule as any;
    const dt = DEVICE_TYPES.find((d) => d.key === key);
    if (!dt) return;

    const circle = new fabric.Circle({ radius: 20, fill: dt.color + "22", stroke: dt.color, strokeWidth: 2, originX: "center", originY: "center" });
    const abbr = new fabric.Text(dt.abbr, { fontSize: 8, fontWeight: "700", fontFamily: "IBM Plex Mono, monospace", fill: dt.color, originX: "center", originY: "center" });
    const labelTxt = new fabric.Text(dt.label, { fontSize: 9, fontFamily: "Inter, sans-serif", fill: "#374151", originX: "center", originY: "center", top: 28, backgroundColor: "rgba(255,255,255,0.9)", padding: 2 });
    const dot = new fabric.Circle({ radius: 4, fill: "#10B981", originX: "center", originY: "center", left: 14, top: -14 });

    const group = new fabric.Group([circle, abbr, labelTxt, dot], {
      left: x, top: y, originX: "center", originY: "center",
      data: { type: "device", deviceTypeKey: key, label: dt.label, condition: "good", action: "new_install", notes: "", isCam: dt.isCam ?? false, fovAngle: key.includes("dome") ? 90 : key.includes("fisheye") ? 360 : 60, fovRange: 40, fovDirection: 0, id: genId() },
    });

    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.renderAll();
    applySelection(group);
  }

  // ── Finalize cable ───────────────────────────────────────────────────────────

  async function finalizeCable() {
    const pts = cablePointsRef.current;
    if (pts.length < 2 || !canvasRef.current) return;
    const fabricModule = await import("fabric");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric = fabricModule as any;
    const fc = canvasRef.current;

    if (previewLineRef.current) { fc.remove(previewLineRef.current); previewLineRef.current = null; }

    const allPts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const segs = orthogonalPath(pts[i], pts[i + 1]);
      if (i === 0) allPts.push(...segs);
      else allPts.push(...segs.slice(1));
    }

    const ct = cableTypeRef.current;
    const poly = new fabric.Polyline(allPts, {
      stroke: CABLE_COLORS[ct] ?? "#94a3b8",
      strokeWidth: 2,
      fill: "transparent",
      strokeDashArray: ct === "2wire" ? [6, 3] : ct === "fiber" ? [2, 3] : [],
      data: { type: "cable", cableType: ct, points: allPts, fromTerminal: "", toTerminal: "", notes: "", id: genId() },
      selectable: true,
      evented: true,
    });
    fc.add(poly);
    fc.renderAll();
    cablePointsRef.current = [];
    setCablePoints([]);
  }

  // ── FOV cone ─────────────────────────────────────────────────────────────────

  async function addFOVCone(angle: number, range: number, dir: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = selectedObject as any;
    if (!obj || obj.data?.type !== "device" || !canvasRef.current) return;
    const fabricModule = await import("fabric");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric = fabricModule as any;
    const fc = canvasRef.current;
    const camId = obj.data?.id;

    // Remove existing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fc.getObjects().filter((o: any) => o.data?.type === "fov" && o.data?.cameraId === camId).forEach((o: any) => fc.remove(o));

    const cx = obj.left ?? 0;
    const cy = obj.top ?? 0;
    const rPx = range * 8;

    if (angle >= 355) {
      const cone = new fabric.Circle({ radius: rPx, fill: "rgba(14,165,233,0.12)", stroke: "rgba(14,165,233,0.4)", strokeWidth: 1, left: cx, top: cy, originX: "center", originY: "center", selectable: false, evented: false, data: { type: "fov", cameraId: camId } });
      fc.add(cone);
      fc.sendToBack(cone);
    } else {
      const aRad = (angle / 2) * (Math.PI / 180);
      const pts = [{ x: 0, y: 0 }, { x: -rPx * Math.sin(aRad), y: -rPx * Math.cos(aRad) }, { x: rPx * Math.sin(aRad), y: -rPx * Math.cos(aRad) }];
      const cone = new fabric.Polygon(pts, { fill: "rgba(14,165,233,0.12)", stroke: "rgba(14,165,233,0.4)", strokeWidth: 1, left: cx, top: cy, originX: "center", originY: "center", angle: dir, selectable: false, evented: false, data: { type: "fov", cameraId: camId } });
      fc.add(cone);
      fc.sendToBack(cone);
    }
    fc.renderAll();
  }

  // ── Inspector updaters ───────────────────────────────────────────────────────

  function updateDeviceData(updates: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = selectedObject as any;
    if (!obj || !canvasRef.current) return;
    obj.data = { ...obj.data, ...updates };
    if (updates.label !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lbl = obj.getObjects?.()?.find((o: any) => o.type === "text" && o.top > 10);
      if (lbl) lbl.set({ text: String(updates.label) });
    }
    if (updates.condition !== undefined) {
      const condColor = updates.condition === "good" ? "#10B981" : updates.condition === "fair" ? "#F59E0B" : updates.condition === "poor" ? "#EF4444" : "#6B7EFF";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dot = obj.getObjects?.()?.find((o: any) => o.type === "circle" && o.radius === 4);
      if (dot) dot.set({ fill: condColor });
    }
    canvasRef.current.renderAll();
  }

  function updateCableData(updates: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = selectedObject as any;
    if (!obj || !canvasRef.current) return;
    obj.data = { ...obj.data, ...updates };
    if (updates.cableType !== undefined) {
      const ct = String(updates.cableType);
      obj.set({ stroke: CABLE_COLORS[ct] ?? "#94a3b8", strokeDashArray: ct === "2wire" ? [6, 3] : ct === "fiber" ? [2, 3] : [] });
    }
    canvasRef.current.renderAll();
  }

  function deleteSelected() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = selectedObject as any;
    if (!obj || !canvasRef.current) return;
    if (obj.data?.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvasRef.current.getObjects().filter((o: any) => o.data?.cameraId === obj.data.id).forEach((o: any) => canvasRef.current!.remove(o));
    }
    canvasRef.current.remove(obj);
    canvasRef.current.renderAll();
    setSelectedObject(null);
    setShowFovControls(false);
  }

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        const active = canvasRef.current?.getActiveObject();
        if (active) { canvasRef.current.remove(active); canvasRef.current.renderAll(); setSelectedObject(null); }
      }
      if (e.key === "Escape") {
        setToolMode("select");
        setSelectedDeviceTypeKey(null);
        cablePointsRef.current = [];
        setCablePoints([]);
        if (previewLineRef.current && canvasRef.current) { canvasRef.current.remove(previewLineRef.current); previewLineRef.current = null; canvasRef.current.renderAll(); }
      }
      if (e.key === "Enter" && toolModeRef.current === "cable") {
        finalizeCable();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Plan switching ───────────────────────────────────────────────────────────

  function switchPlan(planId: string) {
    if (planId === activePlanId) return;
    if (canvasRef.current) {
      const json = JSON.stringify(canvasRef.current.toJSON());
      setPlans((prev) => prev.map((p) => p.id === activePlanId ? { ...p, canvasJson: json } : p));
    }
    setActivePlanId(planId);
    setSelectedObject(null);
    setToolMode("select");
    setCablePoints([]);
    setTimeout(() => {
      const plan = plans.find((p) => p.id === planId);
      if (plan && canvasRef.current && plan.canvasJson !== DEMO_CANVAS_JSON) {
        canvasRef.current.loadFromJSON(plan.canvasJson, () => canvasRef.current?.renderAll());
      }
    }, 60);
  }

  // ── Background image import ──────────────────────────────────────────────────

  async function handleBgImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !canvasRef.current) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      const fabricModule = await import("fabric");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fabric = fabricModule as any;
      const fc = canvasRef.current;
      if (!fc) return;
      // Fabric v6: fromURL returns a Promise; backgroundImage is a property.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fabric.Image.fromURL(dataUrl).then((img: any) => {
        img.set({ selectable: false, evented: false, opacity: 0.6 });
        img.scaleToWidth(fc.getWidth?.() ?? fc.width ?? 1200);
        fc.backgroundImage = img;
        fc.requestRenderAll();
      }).catch(() => {});
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // ── Scale confirm ────────────────────────────────────────────────────────────

  function confirmScale() {
    const ft = parseFloat(scaleFeetInput);
    if (!ft || ft <= 0 || !scalePixelDist) return;
    setPixelsPerFoot(scalePixelDist / ft);
    setShowScaleDialog(false);
    setScaleFeetInput("");
  }

  // ── Wire / BOM derivation ────────────────────────────────────────────────────

  function refreshDerivedTabs() {
    if (!canvasRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const objs: any[] = canvasRef.current.getObjects();

    const wires: WireRow[] = objs
      .filter((o) => o.data?.type === "cable")
      .map((o) => {
        const d = o.data;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pts: Array<{ x: number; y: number }> = d.points ?? o.points ?? [];
        return { id: d.id ?? genId(), fromLabel: d.fromTerminal || "—", toLabel: d.toTerminal || "—", cableType: d.cableType ?? "cat6", lengthPx: polylinePixelLength(pts), fromTerminal: d.fromTerminal ?? "", toTerminal: d.toTerminal ?? "", notes: d.notes ?? "" };
      });
    setWireRows(wires);

    const devCount: Record<string, { label: string; category: string; qty: number }> = {};
    objs.filter((o) => o.data?.type === "device").forEach((o) => {
      const key = o.data.deviceTypeKey ?? "unknown";
      const dt = DEVICE_TYPES.find((d) => d.key === key);
      const label = o.data.label ?? dt?.label ?? key;
      const cat = dt?.category ?? "Other";
      if (!devCount[key]) devCount[key] = { label, category: cat, qty: 0 };
      devCount[key].qty++;
    });

    const rackCount: Record<string, { label: string; category: string; qty: number }> = {};
    racks.forEach((rack) => {
      rack.items.forEach((item) => {
        const re = RACK_EQUIP.find((r) => r.key === item.typeKey);
        const cat = re?.category ?? "Other";
        if (!rackCount[item.typeKey]) rackCount[item.typeKey] = { label: item.label, category: cat, qty: 0 };
        rackCount[item.typeKey].qty++;
      });
    });

    setBomRows([
      ...Object.values(devCount).map((v) => ({ label: v.label, qty: v.qty, category: v.category, source: "Floor Plan" as const })),
      ...Object.values(rackCount).map((v) => ({ label: v.label, qty: v.qty, category: v.category, source: "Rack" as const })),
    ]);
  }

  useEffect(() => {
    if (activeTab === "wire" || activeTab === "bom") refreshDerivedTabs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, racks]);

  // ── Export ───────────────────────────────────────────────────────────────────

  function exportPng() {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL({ format: "png", multiplier: 2 });
    const plan = plans.find((p) => p.id === activePlanId);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plan?.name ?? "floor-plan"}.png`;
    a.click();
  }

  function exportJson() {
    if (!canvasRef.current) return;
    const json = JSON.stringify(canvasRef.current.toJSON(), null, 2);
    const plan = plans.find((p) => p.id === activePlanId);
    downloadBlob(json, `${plan?.name ?? "floor-plan"}.json`, "application/json");
  }

  function exportWireCsv() {
    const rows = [
      ["From Device", "Cable Type", "Color", "Length (ft)", "To Device", "Notes"],
      ...wireRows.map((r) => [r.fromLabel, r.cableType, CABLE_COLORS[r.cableType] ?? "", pixelsPerFoot > 0 ? (r.lengthPx / pixelsPerFoot).toFixed(1) : "—", r.toLabel, r.notes]),
    ];
    downloadBlob(rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n"), "wire-schedule.csv", "text/csv");
  }

  function exportBomCsv() {
    const rows = [["Device", "Qty", "Category", "Source"], ...bomRows.map((r) => [r.label, String(r.qty), r.category, r.source])];
    downloadBlob(rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n"), "bom.csv", "text/csv");
  }

  // ── Rack helpers ─────────────────────────────────────────────────────────────

  function placeRackEquip(rackId: string, slot: number) {
    if (!selectedEquipKey) return;
    const re = RACK_EQUIP.find((r) => r.key === selectedEquipKey);
    if (!re) return;
    setRacks((prev) => prev.map((rack) => {
      if (rack.id !== rackId) return rack;
      const occ: Record<number, boolean> = {};
      rack.items.forEach((item) => { for (let u = item.slotStart; u < item.slotStart + item.uHeight; u++) occ[u] = true; });
      for (let u = slot; u < slot + re.uHeight; u++) { if (occ[u] || u > rack.totalU) return rack; }
      return { ...rack, items: [...rack.items, { id: genId(), typeKey: re.key, label: re.label, slotStart: slot, uHeight: re.uHeight, color: re.color }] };
    }));
    setSelectedEquipKey(null);
  }

  function removeRackItem(rackId: string, itemId: string) {
    setRacks((prev) => prev.map((rack) => rack.id !== rackId ? rack : { ...rack, items: rack.items.filter((i) => i.id !== itemId) }));
    if (selectedRackItemId === itemId) { setSelectedRackItemId(null); setRackInspector(null); }
  }

  function selectRackItem(itemId: string) {
    setSelectedRackItemId(itemId);
    for (const rack of racks) {
      const item = rack.items.find((i) => i.id === itemId);
      if (item) { setRackInspector(item); break; }
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────────

  const activePlan = plans.find((p) => p.id === activePlanId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selData = (selectedObject as any)?.data;
  const inspType: "device" | "cable" | "none" = selData?.type === "device" ? "device" : selData?.type === "cable" ? "cable" : "none";

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">

      {/* ──────────── LEFT SIDEBAR ──────────── */}
      <div className="w-[220px] bg-[#0C111D] flex flex-col h-full shrink-0 border-r border-white/10">

        {/* Plan list */}
        <div className="p-3 border-b border-white/10 shrink-0">
          <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-2 px-1">Floor Plans</div>
          {plans.map((plan) => (
            <button key={plan.id} onClick={() => switchPlan(plan.id)}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs mb-0.5 transition-colors ${activePlanId === plan.id ? "bg-[#6B7EFF]/20 text-[#6B7EFF]" : "text-white/60 hover:text-white hover:bg-white/5"}`}>
              <div className="font-semibold truncate">{plan.name}</div>
              <div className="text-[10px] opacity-60 truncate">{plan.level}</div>
            </button>
          ))}
          <button onClick={() => setShowNewPlanForm(true)}
            className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/40 hover:text-white/70 text-xs mt-1 border border-dashed border-white/20 hover:border-white/40 transition-colors">
            <Plus size={10} /> New Plan
          </button>
        </div>

        {/* Device library (floor plan tab) */}
        {activeTab === "floorplan" && (
          <div className="flex-1 overflow-y-auto p-2">
            <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-2 px-1">Device Library</div>
            {DEVICE_CATEGORIES.map((cat) => {
              const devices = DEVICE_TYPES.filter((d) => d.category === cat);
              const collapsed = collapsedCats[cat];
              return (
                <div key={cat} className="mb-1">
                  <button onClick={() => setCollapsedCats((p) => ({ ...p, [cat]: !p[cat] }))}
                    className="w-full flex items-center justify-between px-1.5 py-1 text-[9px] font-bold text-white/25 uppercase tracking-wider hover:text-white/40 transition-colors">
                    <span>{cat}</span>
                    {collapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                  </button>
                  {!collapsed && devices.map((dt) => (
                    <button key={dt.key}
                      onClick={() => { setSelectedDeviceTypeKey(selectedDeviceTypeKey === dt.key ? null : dt.key); setToolMode("device"); }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs mb-0.5 transition-colors text-left ${selectedDeviceTypeKey === dt.key ? "bg-[#6B7EFF]/20 text-[#6B7EFF]" : "text-white/60 hover:text-white/90 hover:bg-white/5"}`}>
                      <div className="w-3 h-3 rounded-full flex-shrink-0 border border-white/20" style={{ backgroundColor: dt.color }} />
                      <span className="truncate">{dt.label}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Rack equipment library */}
        {activeTab === "rack" && (
          <div className="flex-1 overflow-y-auto p-2">
            <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-2 px-1">Equipment Library</div>
            {selectedEquipKey && (
              <div className="mb-2 px-2 py-1.5 bg-[#6B7EFF]/20 rounded-lg text-[10px] text-[#6B7EFF] font-medium flex items-start justify-between gap-1">
                <div>
                  <div>{RACK_EQUIP.find((r) => r.key === selectedEquipKey)?.label}</div>
                  <div className="text-white/40 text-[9px]">Click empty slot to place</div>
                </div>
                <button onClick={() => setSelectedEquipKey(null)} className="text-[#6B7EFF]/60 hover:text-[#6B7EFF] mt-0.5"><X size={10} /></button>
              </div>
            )}
            {RACK_CATEGORIES.map((cat) => {
              const equips = RACK_EQUIP.filter((r) => r.category === cat);
              const collapsed = collapsedRackCats[cat];
              return (
                <div key={cat} className="mb-1">
                  <button onClick={() => setCollapsedRackCats((p) => ({ ...p, [cat]: !p[cat] }))}
                    className="w-full flex items-center justify-between px-1.5 py-1 text-[9px] font-bold text-white/25 uppercase tracking-wider hover:text-white/40 transition-colors">
                    <span>{cat}</span>
                    {collapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                  </button>
                  {!collapsed && equips.map((re) => (
                    <button key={re.key}
                      onClick={() => setSelectedEquipKey(selectedEquipKey === re.key ? null : re.key)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs mb-0.5 transition-colors text-left ${selectedEquipKey === re.key ? "bg-[#6B7EFF]/20 text-[#6B7EFF]" : "text-white/60 hover:text-white/90 hover:bg-white/5"}`}>
                      <div className="w-3 rounded-sm flex-shrink-0" style={{ backgroundColor: re.color, height: `${Math.max(12, re.uHeight * 4)}px` }} />
                      <div className="min-w-0">
                        <div className="truncate">{re.label}</div>
                        <div className="text-[9px] opacity-50">{re.uHeight}U</div>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
            <button onClick={() => setRacks((p) => [...p, { id: genId(), name: `Cabinet ${p.length + 1}`, totalU: 24, items: [] }])}
              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/40 hover:text-white/70 text-xs mt-2 border border-dashed border-white/20 hover:border-white/40 transition-colors">
              <Plus size={10} /> Add Rack Cabinet
            </button>
          </div>
        )}

        {/* Wire / BOM sidebar info */}
        {(activeTab === "wire" || activeTab === "bom") && (
          <div className="flex-1 p-3 flex items-center justify-center">
            <div className="text-white/20 text-xs text-center leading-relaxed">
              {activeTab === "wire" ? "Wire schedule derived from canvas cables" : "BOM aggregated from canvas + rack diagrams"}
            </div>
          </div>
        )}
      </div>

      {/* ──────────── MAIN CONTENT ──────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── TOP TOOLBAR ── */}
        <div className="h-12 bg-white border-b border-gray-200 flex items-center gap-2 px-4 shrink-0">

          {/* Tab switcher */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5 mr-2">
            {([["floorplan", "Floor Plan", Layers], ["rack", "Rack", BarChart3], ["wire", "Wire Sched.", FileText], ["bom", "BOM", FileText]] as const).map(([tab, label, Icon]) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${activeTab === tab ? "bg-white shadow text-[#6B7EFF]" : "text-gray-500 hover:text-gray-700"}`}>
                <Icon size={11} />{label}
              </button>
            ))}
          </div>

          {/* Tool buttons (floor plan only) */}
          {activeTab === "floorplan" && (
            <div className="flex items-center gap-0.5">
              {([
                ["select", "Select", MousePointer],
                ["device", "Device", Plus],
                ["cable", "Cable", Zap],
                ["fov", "FOV", Camera],
                ["text", "Text", Type],
                ["measure", "Measure", Ruler],
                ["erase", "Erase", Eraser],
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ] as [ToolMode, string, any][]).map(([mode, label, Icon]) => (
                <button key={mode} title={label}
                  onClick={() => {
                    setToolMode(mode);
                    if (mode !== "device") setSelectedDeviceTypeKey(null);
                    if (mode !== "cable") { cablePointsRef.current = []; setCablePoints([]); if (previewLineRef.current && canvasRef.current) { canvasRef.current.remove(previewLineRef.current); previewLineRef.current = null; canvasRef.current.renderAll(); } }
                    if (canvasRef.current) { canvasRef.current.selection = mode === "select"; }
                  }}
                  className={`p-1.5 rounded-md transition-colors ${toolMode === mode ? "bg-[#6B7EFF] text-white" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}`}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {Icon && renderIcon(Icon as any, 14)}
                </button>
              ))}

              {/* Cable type selector */}
              {toolMode === "cable" && (
                <select value={selectedCableType} onChange={(e) => setSelectedCableType(e.target.value)}
                  className="ml-1 h-7 text-xs border border-gray-200 rounded-lg px-1 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]">
                  {CABLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              )}

              {/* Cable finalize */}
              {toolMode === "cable" && cablePoints.length >= 2 && (
                <button onClick={finalizeCable} className="ml-1 px-2 py-1 bg-[#6B7EFF] text-white rounded-md text-xs font-semibold">
                  Done (↵)
                </button>
              )}

              {/* Cable progress hint */}
              {toolMode === "cable" && cablePoints.length > 0 && (
                <span className="ml-1 text-[10px] text-[#6B7EFF] font-medium">
                  {cablePoints.length} pt{cablePoints.length > 1 ? "s" : ""} — click to add, ↵ to finish
                </span>
              )}
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* Scale display */}
            {pixelsPerFoot > 0 && (
              <span className="text-[10px] text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded">
                1ft = {pixelsPerFoot.toFixed(1)}px
              </span>
            )}

            {/* Floor plan toolbar right-side actions */}
            {activeTab === "floorplan" && (
              <>
                <button
                  onClick={() => { setScaleMode(!scaleMode); setScaleLinePoints([]); }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${scaleMode ? "bg-amber-100 text-amber-700" : "text-gray-500 hover:bg-gray-100"}`}
                  title="Set Scale">
                  <Ruler size={12} />{scaleMode ? "Click 2 pts..." : "Set Scale"}
                </button>

                <button onClick={() => bgFileRef.current?.click()}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors" title="Import background image">
                  <Upload size={12} /> BG
                </button>
                <input ref={bgFileRef} type="file" accept="image/*" className="hidden" onChange={handleBgImport} />

                <button
                  onClick={() => {
                    setBackgroundVisible(!backgroundVisible);
                    if (canvasRef.current) {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const bg = (canvasRef.current as any).backgroundImage;
                      if (bg) bg.set({ opacity: backgroundVisible ? 0 : 0.6 });
                      canvasRef.current.renderAll();
                    }
                  }}
                  className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 transition-colors" title={backgroundVisible ? "Hide BG" : "Show BG"}>
                  {backgroundVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>

                {/* Zoom controls */}
                <div className="flex items-center gap-0.5 border border-gray-200 rounded-lg overflow-hidden">
                  <button onClick={() => { if (!canvasRef.current) return; const z = Math.max(0.1, canvasRef.current.getZoom() * 0.8); canvasRef.current.setZoom(z); setZoom(Math.round(z * 100)); }}
                    className="px-1.5 py-1 text-gray-500 hover:bg-gray-50 text-sm"><Minus size={12} /></button>
                  <button onClick={() => { if (!canvasRef.current) return; canvasRef.current.setZoom(1); setZoom(100); }}
                    className="px-2 py-1 text-xs text-gray-600 font-mono hover:text-[#6B7EFF] min-w-[36px] text-center">{zoom}%</button>
                  <button onClick={() => { if (!canvasRef.current) return; const z = Math.min(10, canvasRef.current.getZoom() * 1.25); canvasRef.current.setZoom(z); setZoom(Math.round(z * 100)); }}
                    className="px-1.5 py-1 text-gray-500 hover:bg-gray-50 text-sm">+</button>
                </div>

                {/* Export dropdown */}
                <div className="relative group">
                  <button className="flex items-center gap-1 px-2.5 py-1.5 bg-[#6B7EFF] text-white rounded-lg text-xs font-semibold hover:bg-[#5a6ee8] transition-colors">
                    <Download size={12} /> Export
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50 hidden group-hover:block">
                    <button onClick={exportPng} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700">PNG (2×)</button>
                    <button onClick={exportJson} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700">JSON</button>
                    <button onClick={() => window.print()} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700">Print</button>
                  </div>
                </div>
              </>
            )}

            {activeTab === "wire" && (
              <button onClick={exportWireCsv} className="flex items-center gap-1 px-2.5 py-1.5 bg-[#6B7EFF] text-white rounded-lg text-xs font-semibold hover:bg-[#5a6ee8] transition-colors">
                <Download size={12} /> Export CSV
              </button>
            )}
            {activeTab === "bom" && (
              <div className="flex gap-2">
                <button onClick={exportBomCsv} className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-colors">
                  <Download size={12} /> CSV
                </button>
                <button onClick={() => window.open("/quotes/new", "_blank")} className="flex items-center gap-1 px-2.5 py-1.5 bg-[#6B7EFF] text-white rounded-lg text-xs font-semibold hover:bg-[#5a6ee8] transition-colors">
                  Create Quote
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── FLOOR PLAN CANVAS ── */}
        {activeTab === "floorplan" && (
          <div className="flex-1 flex overflow-hidden">
            {/* Canvas container */}
            <div ref={canvasContainerRef} className="flex-1 relative overflow-hidden bg-[#F1F5F9]"
              style={{ cursor: getCursorForTool(toolMode, !!selectedDeviceTypeKey, scaleMode) }}
              onDoubleClick={() => { if (toolMode === "cable") finalizeCable(); }}>
              <canvas ref={canvasElRef} id="drawing-canvas" />

              {!canvasReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#F1F5F9]">
                  <div className="text-sm text-gray-400">Initializing canvas...</div>
                </div>
              )}

              {canvasReady && (
                <div className="absolute top-3 left-3 text-xs font-mono text-gray-300 select-none pointer-events-none">
                  {activePlan?.name} — {activePlan?.level}
                </div>
              )}

              {/* Tool hints */}
              {toolMode === "device" && selectedDeviceTypeKey && canvasReady && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#6B7EFF] text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-lg pointer-events-none">
                  Click to place {DEVICE_TYPES.find((d) => d.key === selectedDeviceTypeKey)?.label}
                </div>
              )}
              {toolMode === "cable" && canvasReady && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-lg pointer-events-none">
                  Click to add points · Double-click or ↵ to finish
                </div>
              )}
              {scaleMode && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-amber-600 text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-lg pointer-events-none">
                  Click 2 points to define a known distance
                </div>
              )}
            </div>

            {/* RIGHT INSPECTOR PANEL */}
            <div className="w-[260px] bg-white border-l border-gray-200 flex flex-col overflow-hidden shrink-0">

              {/* Device inspector */}
              {inspType === "device" && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div>
                    <div className="text-xs font-bold text-gray-900 mb-0.5">{String(selData?.deviceTypeKey ?? "")}</div>
                    <div className="text-[10px] text-gray-400">Device Inspector</div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Label</label>
                    <input value={inspLabel} onChange={(e) => { setInspLabel(e.target.value); updateDeviceData({ label: e.target.value }); }}
                      className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Condition</label>
                    <div className="grid grid-cols-2 gap-1">
                      {(["good", "fair", "poor", "new_install"] as const).map((c) => (
                        <button key={c} onClick={() => { setInspCondition(c); updateDeviceData({ condition: c }); }}
                          className={`py-1 rounded-lg text-[10px] font-semibold capitalize transition-colors ${inspCondition === c ? "bg-[#6B7EFF] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                          {c === "new_install" ? "New" : c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Action</label>
                    <div className="grid grid-cols-2 gap-1">
                      {(["keep", "service", "replace", "new_install"] as const).map((a) => (
                        <button key={a} onClick={() => { setInspAction(a); updateDeviceData({ action: a }); }}
                          className={`py-1 rounded-lg text-[10px] font-semibold capitalize transition-colors ${inspAction === a ? "bg-[#6B7EFF] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                          {a === "new_install" ? "New Install" : a}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Notes</label>
                    <textarea value={inspNotes} rows={3}
                      onChange={(e) => { setInspNotes(e.target.value); updateDeviceData({ notes: e.target.value }); }}
                      className="w-full text-xs border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]" />
                  </div>

                  {/* Camera FOV controls */}
                  {(selData?.isCam || showFovControls) && (
                    <div className="space-y-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Camera FOV</div>
                        <button onClick={() => addFOVCone(inspFovAngle, inspFovRange, inspFovDir)}
                          className="text-[10px] px-2 py-0.5 bg-sky-500 text-white rounded-md font-medium">Show</button>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">Angle: {inspFovAngle}°</label>
                        <input type="range" min={10} max={360} value={inspFovAngle}
                          onChange={(e) => { const v = Number(e.target.value); setInspFovAngle(v); updateDeviceData({ fovAngle: v }); }}
                          className="w-full" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">Range: {inspFovRange} ft</label>
                        <input type="number" min={5} max={200} value={inspFovRange}
                          onChange={(e) => { const v = Number(e.target.value); setInspFovRange(v); updateDeviceData({ fovRange: v }); }}
                          className="w-full h-7 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">Direction: {inspFovDir}°</label>
                        <input type="number" min={0} max={359} value={inspFovDir}
                          onChange={(e) => { const v = Number(e.target.value); setInspFovDir(v); updateDeviceData({ fovDirection: v }); }}
                          className="w-full h-7 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]" />
                      </div>
                      <button onClick={() => {
                        const id = selData?.id;
                        if (id && canvasRef.current) {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          canvasRef.current.getObjects().filter((o: any) => o.data?.cameraId === id).forEach((o: any) => canvasRef.current!.remove(o));
                          canvasRef.current.renderAll();
                        }
                      }} className="w-full py-1 rounded-lg text-[10px] bg-gray-100 text-gray-600 hover:bg-gray-200 font-semibold">
                        Remove FOV
                      </button>
                    </div>
                  )}

                  <button onClick={deleteSelected}
                    className="w-full py-1.5 rounded-lg text-xs text-red-600 bg-red-50 hover:bg-red-100 font-semibold transition-colors flex items-center justify-center gap-1">
                    <Trash2 size={11} /> Remove Device
                  </button>
                </div>
              )}

              {/* Cable inspector */}
              {inspType === "cable" && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div>
                    <div className="text-xs font-bold text-gray-900 mb-0.5">Cable Run</div>
                    <div className="text-[10px] text-gray-400">Cable Inspector</div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Cable Type</label>
                    <select value={inspCableType} onChange={(e) => { setInspCableType(e.target.value); updateCableData({ cableType: e.target.value }); }}
                      className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]">
                      {CABLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Length</label>
                    <div className="text-xs text-gray-700 font-mono">
                      {pixelsPerFoot > 0
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ? `~${(polylinePixelLength((selectedObject as any)?.points ?? []) / pixelsPerFoot).toFixed(1)} ft`
                        : "Set scale to calculate"}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">From Terminal</label>
                    <input value={inspCableFrom} placeholder="e.g. Relay 1 COM/NO"
                      onChange={(e) => { setInspCableFrom(e.target.value); updateCableData({ fromTerminal: e.target.value }); }}
                      className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">To Terminal</label>
                    <input value={inspCableTo} placeholder="e.g. Open/Common"
                      onChange={(e) => { setInspCableTo(e.target.value); updateCableData({ toTerminal: e.target.value }); }}
                      className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Notes</label>
                    <textarea value={inspNotes} rows={3}
                      onChange={(e) => { setInspNotes(e.target.value); updateCableData({ notes: e.target.value }); }}
                      className="w-full text-xs border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]" />
                  </div>
                  <button onClick={deleteSelected}
                    className="w-full py-1.5 rounded-lg text-xs text-red-600 bg-red-50 hover:bg-red-100 font-semibold transition-colors flex items-center justify-center gap-1">
                    <Trash2 size={11} /> Remove Cable
                  </button>
                </div>
              )}

              {/* Empty inspector */}
              {inspType === "none" && (
                <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                    <Search size={18} className="text-gray-400" />
                  </div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Nothing selected</div>
                  <div className="text-[10px] text-gray-400">
                    Click a device or cable on the canvas to inspect and edit it
                  </div>
                </div>
              )}

              {/* Bottom panel actions */}
              <div className="p-3 border-t border-gray-100 space-y-1.5 shrink-0">
                <button onClick={exportPng} className="w-full py-1.5 bg-[#6B7EFF] text-white rounded-lg text-xs font-semibold hover:bg-[#5a6ee8] transition-colors">
                  Export PNG
                </button>
                <button onClick={() => window.print()} className="w-full py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-colors">
                  Print
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── RACK DIAGRAM ── */}
        {activeTab === "rack" && (
          <div className="flex-1 flex overflow-hidden">
            {/* Racks area */}
            <div className="flex-1 overflow-x-auto overflow-y-auto bg-[#0d1117] p-6">
              <div className="flex gap-6 min-w-max pb-4">
                {racks.map((rack) => (
                  <RackPanelView key={rack.id} rack={rack} onSelectItem={selectRackItem} selectedItemId={selectedRackItemId} selectedEquipKey={selectedEquipKey} onPlaceEquip={placeRackEquip} onRemoveItem={removeRackItem} />
                ))}
                <div className="flex items-start pt-8">
                  <button onClick={() => setRacks((p) => [...p, { id: genId(), name: `Cabinet ${p.length + 1}`, totalU: 24, items: [] }])}
                    className="w-16 h-24 border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center gap-1 text-white/30 hover:text-white/60 hover:border-white/40 transition-colors">
                    <Plus size={16} /><span className="text-[9px]">Add</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Rack inspector */}
            <div className="w-[260px] bg-white border-l border-gray-200 flex flex-col overflow-hidden shrink-0">
              {rackInspector ? (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div>
                    <div className="text-xs font-bold text-gray-900 mb-0.5">{rackInspector.label}</div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded inline-block" style={{ background: rackInspector.color + "22", color: rackInspector.color }}>
                      {rackInspector.uHeight}U · {rackInspector.typeKey}
                    </span>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Label</label>
                    <input value={rackInspector.label}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRacks((prev) => prev.map((rack) => ({ ...rack, items: rack.items.map((item) => item.id === rackInspector.id ? { ...item, label: v } : item) })));
                        setRackInspector((ri) => ri ? { ...ri, label: v } : ri);
                      }}
                      className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Notes</label>
                    <textarea value={rackInspector.notes ?? ""} rows={4}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRacks((prev) => prev.map((rack) => ({ ...rack, items: rack.items.map((item) => item.id === rackInspector.id ? { ...item, notes: v } : item) })));
                        setRackInspector((ri) => ri ? { ...ri, notes: v } : ri);
                      }}
                      className="w-full text-xs border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]" />
                  </div>
                  <button
                    onClick={() => { for (const rack of racks) { const item = rack.items.find((i) => i.id === rackInspector.id); if (item) { removeRackItem(rack.id, rackInspector.id); break; } } }}
                    className="w-full py-1.5 rounded-lg text-xs text-red-600 bg-red-50 hover:bg-red-100 font-semibold transition-colors flex items-center justify-center gap-1">
                    <Trash2 size={11} /> Remove from Rack
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                    <BarChart3 size={18} className="text-gray-400" />
                  </div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">No item selected</div>
                  <div className="text-[10px] text-gray-400">Select equipment from the library, then click an empty U slot to place it</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── WIRE SCHEDULE ── */}
        {activeTab === "wire" && (
          <div className="flex-1 overflow-auto bg-[#F8FAFC] p-6">
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-bold text-gray-900">Wire Schedule</div>
                  <div className="text-xs text-gray-500">{wireRows.length} cable run{wireRows.length !== 1 ? "s" : ""} · {activePlan?.name}</div>
                </div>
                <button onClick={() => setActiveTab("floorplan")} className="text-xs text-[#6B7EFF] hover:underline">
                  ← Back to Floor Plan
                </button>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {["From Device", "Cable Type", "Color", "Length", "To Device", "Notes"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {wireRows.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No cables drawn yet. Use the Cable tool on the Floor Plan tab.</td></tr>
                    ) : wireRows.map((row) => (
                      <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-700">{row.fromLabel}</td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: (CABLE_COLORS[row.cableType] ?? "#94a3b8") + "22", color: CABLE_COLORS[row.cableType] ?? "#94a3b8" }}>
                            {row.cableType}
                          </span>
                        </td>
                        <td className="px-4 py-2.5"><div className="w-4 h-4 rounded" style={{ background: CABLE_COLORS[row.cableType] ?? "#94a3b8" }} /></td>
                        <td className="px-4 py-2.5 font-mono text-gray-600">{pixelsPerFoot > 0 ? `${(row.lengthPx / pixelsPerFoot).toFixed(1)} ft` : "—"}</td>
                        <td className="px-4 py-2.5 text-gray-700">{row.toLabel}</td>
                        <td className="px-4 py-2.5 text-gray-500">{row.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pixelsPerFoot === 0 && wireRows.length > 0 && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-center gap-2">
                  <Ruler size={14} /> Set scale on the Floor Plan tab to calculate cable lengths in feet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── BOM ── */}
        {activeTab === "bom" && (
          <div className="flex-1 overflow-auto bg-[#F8FAFC] p-6">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-bold text-gray-900">Bill of Materials</div>
                  <div className="text-xs text-gray-500">{bomRows.reduce((acc, r) => acc + r.qty, 0)} items · {activePlan?.name}</div>
                </div>
                <button onClick={() => window.open("/quotes/new", "_blank")} className="text-xs text-[#6B7EFF] hover:underline">
                  Create Quote from BOM →
                </button>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {["Device", "Category", "Qty", "Source"].map((h) => (
                        <th key={h} className={`px-4 py-3 font-semibold text-gray-600 ${h === "Qty" ? "text-center" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bomRows.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Place devices on the Floor Plan or Rack tab to populate the BOM.</td></tr>
                    ) : bomRows.map((row, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800">{row.label}</td>
                        <td className="px-4 py-2.5 text-gray-500">{row.category}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#6B7EFF]/10 text-[#6B7EFF] font-bold text-xs">{row.qty}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${row.source === "Floor Plan" ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-600"}`}>{row.source}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {bomRows.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    ["Total Items", bomRows.reduce((a, r) => a + r.qty, 0)],
                    ["From Floor Plan", bomRows.filter((r) => r.source === "Floor Plan").reduce((a, r) => a + r.qty, 0)],
                    ["From Rack", bomRows.filter((r) => r.source === "Rack").reduce((a, r) => a + r.qty, 0)],
                  ].map(([label, val]) => (
                    <div key={String(label)} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="text-xs text-gray-500 mb-1">{label}</div>
                      <div className="text-xl font-bold text-gray-900">{val}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── NEW PLAN MODAL ── */}
      {showNewPlanForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-5 w-72">
            <div className="text-sm font-bold mb-3">New Floor Plan</div>
            <div className="space-y-2 mb-4">
              <input autoFocus placeholder="Property name (e.g. Oak Village)" value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)}
                className="w-full h-9 text-sm border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]" />
              <input placeholder="Level / Area (e.g. Main Entrance)" value={newPlanLevel} onChange={(e) => setNewPlanLevel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newPlanName) {
                    const np: FloorPlan = { id: genId(), name: newPlanName, level: newPlanLevel || "Level 1", canvasJson: DEMO_CANVAS_JSON };
                    setPlans((p) => [...p, np]); switchPlan(np.id); setNewPlanName(""); setNewPlanLevel(""); setShowNewPlanForm(false);
                  }
                }}
                className="w-full h-9 text-sm border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNewPlanForm(false)} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm font-semibold text-gray-700">Cancel</button>
              <button onClick={() => {
                if (!newPlanName) return;
                const np: FloorPlan = { id: genId(), name: newPlanName, level: newPlanLevel || "Level 1", canvasJson: DEMO_CANVAS_JSON };
                setPlans((p) => [...p, np]); switchPlan(np.id); setNewPlanName(""); setNewPlanLevel(""); setShowNewPlanForm(false);
              }} className="flex-1 py-2 bg-[#6B7EFF] rounded-lg text-sm font-semibold text-white">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SCALE DIALOG ── */}
      {showScaleDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-5 w-72">
            <div className="text-sm font-bold mb-1">Set Scale</div>
            <div className="text-xs text-gray-500 mb-3">
              Line drawn = {scalePixelDist.toFixed(0)}px. What real distance does it represent?
            </div>
            <div className="flex items-center gap-2 mb-4">
              <input type="number" placeholder="e.g. 50" value={scaleFeetInput} autoFocus
                onChange={(e) => setScaleFeetInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") confirmScale(); }}
                className="flex-1 h-9 text-sm border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]" />
              <span className="text-sm text-gray-500 font-medium">feet</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowScaleDialog(false); setScaleFeetInput(""); }} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm font-semibold text-gray-700">Cancel</button>
              <button onClick={confirmScale} className="flex-1 py-2 bg-[#6B7EFF] rounded-lg text-sm font-semibold text-white">Set Scale</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #drawing-canvas, #drawing-canvas * { visibility: visible; }
          #drawing-canvas { position: fixed; top: 0; left: 0; }
        }
      `}</style>
    </div>
  );
}
