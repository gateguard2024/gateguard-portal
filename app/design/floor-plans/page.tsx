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
  key: string; label: string; color: string; category: string; abbr: string; isCam?: boolean;
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
];
const DEVICE_CATEGORIES = Array.from(new Set(DEVICE_TYPES.map((d) => d.category)));
const DEVICE_BY_KEY: Record<string, DeviceTypeDef> = Object.fromEntries(DEVICE_TYPES.map((d) => [d.key, d]));

// ── Wire colors ──────────────────────────────────────────────────────────────
type WireKind = "power" | "data" | "access" | "signal";
const WIRE_COLORS: Record<WireKind, string> = {
  power: "#EF4444", data: "#3B82F6", access: "#22C55E", signal: "#94A3B8",
};
const WIRE_LABELS: Record<WireKind, string> = {
  power: "Power / PoE", data: "Data", access: "Access / Relay", signal: "Signal",
};

type ToolMode = "select" | "device" | "wire" | "fov" | "zone" | "scale";

// ── Element data packed into notes JSON ──────────────────────────────────────
interface ElemMeta {
  manufacturer?: string; model?: string; price?: number; qty?: number; status?: string;
  fov?: { angle: number; range: number; direction: number };
  zone?: { name: string };
  wire?: { kind: WireKind; from: [number, number]; to: [number, number] };
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

// ── Canvas constant size (persistence is percentage-based, so px is arbitrary) ─
const CANVAS_W = 1600;
const CANVAS_H = 1000;

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
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [tool, setTool] = useState<ToolMode>("select");
  const toolRef = useRef<ToolMode>("select");
  toolRef.current = tool;

  const [devKey, setDevKey] = useState<string | null>(null);
  const devKeyRef = useRef<string | null>(null);
  devKeyRef.current = devKey;

  const [wireKind, setWireKind] = useState<WireKind>("data");
  const wireKindRef = useRef<WireKind>("data");
  wireKindRef.current = wireKind;

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
          notes: JSON.stringify({ wire: { kind: d.wireKind, from: d.from, to: d.to } } as ElemMeta),
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
    return rows;
  }, []);

  // ── Draw helpers ───────────────────────────────────────────────────────────
  const drawWireObject = useCallback(
    (from: [number, number], to: [number, number], kind: WireKind, label?: string) => {
      const fc = fcRef.current;
      const fabric = fabricRef.current;
      if (!fc || !fabric) return;
      const pts = orthPath({ x: from[0], y: from[1] }, { x: to[0], y: to[1] });
      const line = new fabric.Polyline(pts, {
        stroke: WIRE_COLORS[kind], strokeWidth: 2.5, fill: "transparent", objectCaching: false,
      });
      line.data = { kind: "wire", id: genId(), wireKind: kind, from, to, label: label ?? WIRE_LABELS[kind] };
      fc.add(line);
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
      fill: "rgba(125,229,255,0.04)", stroke: CYAN, strokeWidth: 1.5, strokeDashArray: [6, 4], rx: 8, ry: 8,
    });
    const txt = new fabric.Text(name, {
      left: cx, top: cy - h / 2 - 12, originX: "center", originY: "center",
      fontSize: 12, fontFamily: "Inter, sans-serif", fill: CYAN,
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

      const circle = new fabric.Circle({
        radius: 18, fill: dt.color + "33", stroke: dt.color, strokeWidth: 2,
        originX: "center", originY: "center",
      });
      const abbr = new fabric.Text(dt.abbr, {
        fontSize: 8, fontWeight: "700", fontFamily: "IBM Plex Mono, monospace",
        fill: "#F8FAFC", originX: "center", originY: "center",
      });
      const labelTxt = new fabric.Text(dt.label, {
        fontSize: 9, fontFamily: "Inter, sans-serif", fill: "#F8FAFC",
        originX: "center", originY: "center", top: 26,
        backgroundColor: "rgba(11,23,40,0.75)", padding: 2,
      });
      parts.push(circle, abbr, labelTxt);

      const group = new fabric.Group(parts, {
        left: x, top: y, originX: "center", originY: "center",
      });
      group.data = {
        kind: "device", id: genId(), deviceTypeKey: key, label: dt.label,
        condition: condition ?? "good", action: action ?? "new_install",
        isCam: dt.isCam ?? false,
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

  // ── Background ─────────────────────────────────────────────────────────────
  const applyBackground = useCallback(async (url: string | null) => {
    const fc = fcRef.current;
    const fabric = fabricRef.current;
    if (!fc || !fabric) return;
    if (!url) {
      fc.backgroundImage = undefined;
      fc.backgroundColor = "#0E1A30";
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
        const meta = parseMeta(row.notes);
        const px = (row.x_pct / 100) * CANVAS_W;
        const py = (row.y_pct / 100) * CANVAS_H;
        if (row.device_type === "__wire__" && meta.wire) {
          drawWireObject(meta.wire.from, meta.wire.to, meta.wire.kind, row.label);
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
        if (plan) {
          setPlanName(plan.name ?? "Design");
          setPlanStatus(plan.status ?? "floor_plan");
          setFileUrl(plan.file_url ?? null);
          await applyBackground(plan.file_url ?? null);
        }
        if (Array.isArray(json.devices)) loadDevices(json.devices as RawDeviceRow[]);
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
        backgroundColor: "#0E1A30",
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
      drawZoneObject(p.x, p.y, 240, 160, "New Zone");
      fc.renderAll();
      return;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onMouseMove(opt: any) {
    const fc = fcRef.current;
    const fabric = fabricRef.current;
    if (!fc || !fabric) return;
    if (toolRef.current !== "wire" || wirePtsRef.current.length === 0) return;
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
    if (!fc) return { rows: [] as { label: string; qty: number; price: number; total: number }[], total: 0, wires: 0, zones: 0 };
    const acc: Record<string, { label: string; qty: number; price: number; total: number }> = {};
    let wires = 0, zones = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fc.getObjects().forEach((o: any) => {
      const d = o.data;
      if (!d) return;
      if (d.kind === "wire") { wires++; return; }
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
    return { rows, total, wires, zones };
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
        <select
          value={planStatus}
          onChange={(e) => setPlanStatus(e.target.value)}
          className="text-xs rounded-lg px-2 py-1.5 outline-none"
          style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: TEXT }}
        >
          <option value="floor_plan">Floor Plan</option>
          <option value="system_design">System Design</option>
          <option value="as_built">As-Built</option>
        </select>
        <button
          onClick={() => setShowBgModal(true)}
          className="text-xs flex items-center gap-1.5 rounded-lg px-3 py-1.5"
          style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: MUTED }}
        >
          <ImageIcon size={13} /> Background
        </button>

        <div className="flex-1" />

        {saveMsg && <span className="text-xs" style={{ color: CYAN }}>{saveMsg}</span>}
        <button onClick={exportPng} className="text-xs flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: MUTED }}>
          <Download size={13} /> PNG
        </button>
        <button onClick={printSheet} className="text-xs flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: MUTED }}>
          <Printer size={13} /> Print
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
                          <button
                            key={d.key}
                            onClick={() => chooseDevice(d.key)}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors hover:brightness-125"
                            style={{
                              backgroundColor: devKey === d.key ? `${d.color}22` : PANEL,
                              border: `1px solid ${devKey === d.key ? d.color : BORDER}`,
                            }}
                          >
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-[7px] font-bold shrink-0"
                              style={{ backgroundColor: d.color + "33", border: `1.5px solid ${d.color}`, color: TEXT }}>
                              {d.abbr}
                            </span>
                            <span className="text-[11px] truncate" style={{ color: TEXT }}>{d.label}</span>
                          </button>
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
            {toolBtn("wire", Zap, "Wire")}
            {toolBtn("fov", Camera, "Camera / FOV")}
            {toolBtn("zone", Type, "Zone frame")}
            {toolBtn("scale", Ruler, "Set scale")}
            <div className="w-px h-6 mx-1" style={{ backgroundColor: BORDER }} />
            {(Object.keys(WIRE_COLORS) as WireKind[]).map((k) => (
              <button
                key={k}
                onClick={() => { setWireKind(k); setTool("wire"); }}
                title={WIRE_LABELS[k]}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px]"
                style={{
                  backgroundColor: wireKind === k && tool === "wire" ? `${WIRE_COLORS[k]}22` : CARD,
                  border: `1px solid ${wireKind === k && tool === "wire" ? WIRE_COLORS[k] : BORDER}`,
                  color: TEXT,
                }}
              >
                <span className="w-3 h-1 rounded-full" style={{ backgroundColor: WIRE_COLORS[k] }} />
                {WIRE_LABELS[k].split(" ")[0]}
              </button>
            ))}
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
              <div style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.5)", borderRadius: 8, overflow: "hidden", border: `1px solid ${BORDER}` }}>
                <canvas ref={canvasElRef} />
              </div>
            </div>

            {/* Legend */}
            <div className="fixed bottom-6 left-72 rounded-xl px-3 py-2 flex flex-col gap-1 z-20"
              style={{ backgroundColor: "rgba(19,27,46,0.9)", border: `1px solid ${BORDER}`, backdropFilter: "blur(6px)" }}>
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Wire Legend</span>
              {(Object.keys(WIRE_COLORS) as WireKind[]).map((k) => (
                <div key={k} className="flex items-center gap-2 text-[11px]" style={{ color: TEXT }}>
                  <span className="w-4 h-0.5 rounded" style={{ backgroundColor: WIRE_COLORS[k] }} />
                  {WIRE_LABELS[k]}
                </div>
              ))}
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
  selected, onLabel, onMeta, onField, onRebuildCone,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selected: any;
  onLabel: (v: string) => void;
  onMeta: (p: Partial<ElemMeta>) => void;
  onField: (f: "condition" | "action", v: string) => void;
  onRebuildCone: () => void;
}) {
  const d = selected.data;
  const meta: ElemMeta = d.meta ?? {};
  const isDevice = d.kind === "device";
  const isCam = isDevice && d.isCam;

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
          {d.kind === "device" ? "Element" : d.kind === "wire" ? "Wire" : "Zone"}
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
        <span className="flex items-center gap-1"><Layers size={12} /> {bom.zones} zones</span>
      </div>
    </div>
  );
}

// ── Geometry / util (pure, no refs) ──────────────────────────────────────────
function orthPath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const midX = (a.x + b.x) / 2;
  return [
    { x: a.x, y: a.y },
    { x: midX, y: a.y },
    { x: midX, y: b.y },
    { x: b.x, y: b.y },
  ];
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
