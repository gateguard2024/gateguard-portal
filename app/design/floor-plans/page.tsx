"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, X, Download, Trash2, Search, MapPin, FileText } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Copy, Crosshair, Eye, ChevronDown, ChevronRight, Link, LayoutTemplate } = require("lucide-react") as any;

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

// ─── Types ─────────────────────────────────────────────────────────────────────
type DeviceStatus = "existing" | "proposed" | "replace" | "remove";
type RouteMode = "h-first" | "v-first";

type DeviceType = { key: string; label: string; icon: string; color: string; category: string; hasFOV?: boolean; };

type PlacedDevice = {
  id: string; typeKey: string; label: string;
  // Map mode: real lng/lat. Grid mode: lng=x fraction (0-1), lat=y fraction (0-1)
  lng: number; lat: number;
  status: DeviceStatus; notes: string;
  bearing: number; fovAngle: number; fovRangeFt: number;
};

type Connection = {
  id: string; fromId: string; toId: string;
  cableType: string; lengthFt: number;
  fromTerminal: string; toTerminal: string;
  routeMode: RouteMode;
};

type TitleBlockData = {
  propertyName: string; propertyAddress: string;
  title: string; sheetNum: string;
  date: string; by: string; rev: string;
};

type FloorPlanData = {
  id: string; name: string; address: string;
  centerLng: number; centerLat: number; zoom: number;
  devices: PlacedDevice[]; connections: Connection[];
  titleBlock: TitleBlockData;
};

// ─── Cable Types ────────────────────────────────────────────────────────────────
const CABLE_TYPES = [
  { key: "cat6",   label: "CAT6",    color: "#3B82F6", dash: [] as number[] },
  { key: "cat5e",  label: "CAT5e",   color: "#06B6D4", dash: [] as number[] },
  { key: "2wire",  label: "2-Wire",  color: "#EF4444", dash: [6, 3] as number[] },
  { key: "18_2",   label: "18/2 LV", color: "#EAB308", dash: [6, 3] as number[] },
  { key: "fiber",  label: "Fiber",   color: "#A855F7", dash: [2, 4] as number[] },
  { key: "conduit",label: "Conduit", color: "#6B7280", dash: [10, 4] as number[] },
  { key: "coax",   label: "Coax",    color: "#EC4899", dash: [] as number[] },
];

const STATUS_CONFIG: Record<DeviceStatus, { label: string; color: string }> = {
  existing: { label: "Existing", color: "#2563EB" },
  proposed: { label: "Proposed", color: "#F97316" },
  replace:  { label: "Replace",  color: "#EF4444" },
  remove:   { label: "Remove",   color: "#6B7280" },
};

const DEVICE_TYPES: DeviceType[] = [
  { key: "cam_bullet",  label: "Bullet Camera",    icon: "📷", color: "#3B82F6", category: "Video Surveillance", hasFOV: true },
  { key: "cam_dome",    label: "Dome Camera",       icon: "🎥", color: "#3B82F6", category: "Video Surveillance", hasFOV: true },
  { key: "cam_lpr",     label: "LPR Camera",        icon: "🔭", color: "#6366F1", category: "Video Surveillance", hasFOV: true },
  { key: "cam_ptz",     label: "PTZ Camera",        icon: "🎬", color: "#3B82F6", category: "Video Surveillance", hasFOV: true },
  { key: "cam_fisheye", label: "Fisheye Camera",    icon: "👁", color: "#3B82F6", category: "Video Surveillance", hasFOV: true },
  { key: "nvr",         label: "NVR / DVR",         icon: "🖥", color: "#64748B", category: "Video Surveillance" },
  { key: "brivo_300",   label: "Brivo ACS300",      icon: "🔐", color: "#10B981", category: "Access Control" },
  { key: "brivo_100",   label: "Brivo ACS100",      icon: "🔐", color: "#10B981", category: "Access Control" },
  { key: "brivo_6100",  label: "Brivo ACS6100",     icon: "🔐", color: "#10B981", category: "Access Control" },
  { key: "reader",      label: "Card Reader",       icon: "💳", color: "#10B981", category: "Access Control" },
  { key: "rex",         label: "REX Sensor",        icon: "🔆", color: "#10B981", category: "Access Control" },
  { key: "keypad",      label: "Keypad",            icon: "⌨", color: "#8B5CF6", category: "Access Control" },
  { key: "dk6050",      label: "DK 6050 Gate Op",   icon: "🚧", color: "#F59E0B", category: "Gate Systems" },
  { key: "dk9050",      label: "DK 9050 Gate Op",   icon: "🚧", color: "#F59E0B", category: "Gate Systems" },
  { key: "liftmaster",  label: "LiftMaster SL3000", icon: "🚧", color: "#F59E0B", category: "Gate Systems" },
  { key: "dk1835",      label: "DK1835 Callbox",    icon: "📞", color: "#8B5CF6", category: "Gate Systems" },
  { key: "g3_intercom", label: "UniFi G3 Intercom", icon: "🔔", color: "#8B5CF6", category: "Gate Systems" },
  { key: "loop_det",    label: "Loop Detector",     icon: "⭕", color: "#EF4444", category: "Gate Systems" },
  { key: "photobeam",   label: "Photobeam",         icon: "🔦", color: "#EF4444", category: "Gate Systems" },
  { key: "ucg_ultra",   label: "UCG-Ultra",         icon: "🌐", color: "#0891B2", category: "Networking" },
  { key: "usw_flex",    label: "USW-Flex",          icon: "🔌", color: "#0891B2", category: "Networking" },
  { key: "ap",          label: "Access Point",      icon: "📡", color: "#0891B2", category: "Networking" },
  { key: "router",      label: "Router / Firewall", icon: "🛡", color: "#0891B2", category: "Networking" },
  { key: "mag_lock",    label: "Mag Lock",          icon: "🔒", color: "#64748B", category: "Sensors & Safety" },
  { key: "strike",      label: "Electric Strike",   icon: "⚡", color: "#64748B", category: "Sensors & Safety" },
  { key: "motion",      label: "Motion Sensor",     icon: "👁", color: "#EF4444", category: "Sensors & Safety" },
  { key: "smoke",       label: "Smoke Detector",    icon: "🌫", color: "#EF4444", category: "Sensors & Safety" },
  { key: "panic",       label: "Panic Button",      icon: "🔴", color: "#EF4444", category: "Sensors & Safety" },
  { key: "power_panel", label: "Power Panel",       icon: "⚡", color: "#92400E", category: "Infrastructure" },
  { key: "conduit_run", label: "Conduit Run",       icon: "━", color: "#92400E", category: "Infrastructure" },
  { key: "junction",    label: "Junction Box",      icon: "📦", color: "#92400E", category: "Infrastructure" },
  { key: "ups",         label: "UPS / Battery",     icon: "🔋", color: "#92400E", category: "Infrastructure" },
  { key: "server",      label: "Server / Rack",     icon: "🖥", color: "#92400E", category: "Infrastructure" },
];

const CATEGORIES = [...new Set(DEVICE_TYPES.map(d => d.category))];

function makeTitleBlock(name = "", address = ""): TitleBlockData {
  return {
    propertyName: name, propertyAddress: address,
    title: "Site Map", sheetNum: "S1.1",
    date: new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }),
    by: "GateGuard", rev: "R0",
  };
}

const DEMO_PLANS: FloorPlanData[] = [
  {
    id: "plan-1", name: "Brentwood Apartments", address: "2500 Brentwood Blvd, Atlanta, GA",
    centerLng: -84.2807, centerLat: 33.7752, zoom: 18,
    titleBlock: makeTitleBlock("Brentwood Apartments", "2500 Brentwood Blvd, Atlanta, GA 30339"),
    devices: [
      { id: "d1", typeKey: "cam_bullet",  label: "Entry Bullet Cam",    lng: -84.2803, lat: 33.7754, status: "existing", notes: "Eagle Eye, 2023", bearing: 225, fovAngle: 80,  fovRangeFt: 80  },
      { id: "d2", typeKey: "cam_lpr",     label: "Entry LPR Camera",    lng: -84.2800, lat: 33.7753, status: "existing", notes: "LPR entry lane",  bearing: 200, fovAngle: 40,  fovRangeFt: 60  },
      { id: "d3", typeKey: "cam_dome",    label: "Pool Area Dome",      lng: -84.2812, lat: 33.7750, status: "proposed", notes: "Phase 2",         bearing: 0,   fovAngle: 120, fovRangeFt: 50  },
      { id: "d4", typeKey: "dk6050",      label: "Entry Gate Operator", lng: -84.2805, lat: 33.7755, status: "existing", notes: "DK 6050, 2022",   bearing: 0,   fovAngle: 0,   fovRangeFt: 0   },
      { id: "d5", typeKey: "brivo_300",   label: "Brivo ACS300",        lng: -84.2810, lat: 33.7757, status: "existing", notes: "Main controller", bearing: 0,   fovAngle: 0,   fovRangeFt: 0   },
      { id: "d6", typeKey: "dk1835",      label: "Entry Callbox",       lng: -84.2802, lat: 33.7756, status: "existing", notes: "Tenant directory",bearing: 0,   fovAngle: 0,   fovRangeFt: 0   },
    ],
    connections: [
      { id: "c1", fromId: "d5", toId: "d4", cableType: "2wire",  lengthFt: 45, fromTerminal: "Relay",  toTerminal: "Open/Close", routeMode: "h-first" },
      { id: "c2", fromId: "d5", toId: "d6", cableType: "cat6",   lengthFt: 30, fromTerminal: "LAN",    toTerminal: "RJ45",       routeMode: "v-first" },
      { id: "c3", fromId: "d5", toId: "d1", cableType: "cat6",   lengthFt: 60, fromTerminal: "LAN",    toTerminal: "RJ45",       routeMode: "h-first" },
    ],
  },
  {
    id: "plan-2", name: "Riverview Apartments", address: "500 Riverside Dr, Atlanta, GA",
    centerLng: -84.4100, centerLat: 33.7490, zoom: 18,
    titleBlock: makeTitleBlock("Riverview Apartments", "500 Riverside Dr, Atlanta, GA 30339"),
    devices: [
      { id: "d1", typeKey: "cam_bullet", label: "Main Gate Cam", lng: -84.4095, lat: 33.7492, status: "existing", notes: "", bearing: 180, fovAngle: 70, fovRangeFt: 100 },
      { id: "d2", typeKey: "cam_dome",   label: "Lobby Dome",    lng: -84.4103, lat: 33.7489, status: "replace",  notes: "Old unit", bearing: 0, fovAngle: 120, fovRangeFt: 40 },
      { id: "d3", typeKey: "dk9050",     label: "Exit Gate Op",  lng: -84.4097, lat: 33.7491, status: "existing", notes: "", bearing: 0, fovAngle: 0, fovRangeFt: 0 },
    ],
    connections: [],
  },
];

// ─── Geographic helpers ─────────────────────────────────────────────────────────
function buildFOVCoords(lng: number, lat: number, bearingDeg: number, fovDeg: number, rangeFt: number): [number, number][] {
  const rangeM = rangeFt * 0.3048;
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const pts: [number, number][] = [[lng, lat]];
  for (let i = 0; i <= 16; i++) {
    const angle = toRad(bearingDeg - fovDeg / 2 + (fovDeg * i) / 16);
    const latR = toRad(lat); const lngR = toRad(lng); const d = rangeM / R;
    const lat2 = Math.asin(Math.sin(latR) * Math.cos(d) + Math.cos(latR) * Math.sin(d) * Math.cos(angle));
    const lng2 = lngR + Math.atan2(Math.sin(angle) * Math.sin(d) * Math.cos(latR), Math.cos(d) - Math.sin(latR) * Math.sin(lat2));
    pts.push([toDeg(lng2), toDeg(lat2)]);
  }
  pts.push([lng, lat]);
  return pts;
}

async function geocodeAddress(address: string, token: string): Promise<{ lng: number; lat: number } | null> {
  if (!token) return null;
  try {
    const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&limit=1`);
    const data = await res.json();
    if (data.features?.[0]?.center) { const [lng, lat] = data.features[0].center; return { lng, lat }; }
  } catch (_) {}
  return null;
}

function pointToSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ─── Grid Background (no Mapbox token) ─────────────────────────────────────────
function GridBackground({ onGridClick }: { onGridClick: (x: number, y: number) => void }) {
  const divRef = useRef<HTMLDivElement>(null);

  function handleClick(e: React.MouseEvent) {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onGridClick(x, y);
  }

  return (
    <div ref={divRef} className="absolute inset-0 bg-white cursor-crosshair" onClick={handleClick}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="smallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#D6E4F5" strokeWidth="0.5"/>
          </pattern>
          <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#smallGrid)"/>
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#A8C4E0" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)"/>
      </svg>
      {/* Hint text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <MapPin size={36} className="text-blue-300 mb-3" />
        <p className="text-blue-400 font-semibold text-sm mb-1">No Map Token</p>
        <p className="text-blue-300 text-xs text-center max-w-56">
          Add <code className="bg-blue-50 text-blue-600 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> for satellite view.<br/>
          Drawing on grid is still fully functional.
        </p>
      </div>
    </div>
  );
}

// ─── GateGuard Title Block Overlay ─────────────────────────────────────────────
function TitleBlockOverlay({ data, onChange }: { data: TitleBlockData; onChange: (d: TitleBlockData) => void }) {
  const [editing, setEditing] = useState(false);

  const field = (label: string, key: keyof TitleBlockData, small = false) => (
    <div className="border-t border-black">
      <div className="text-[7px] text-gray-500 px-1 pt-0.5 leading-none">{label}</div>
      {editing
        ? <input value={data[key]} onChange={e => onChange({ ...data, [key]: e.target.value })}
            className={`w-full border-none outline-none px-1 bg-transparent font-medium text-black ${small ? "text-[9px] pb-0.5" : "text-[10px] pb-0.5"}`} />
        : <div className={`px-1 pb-0.5 font-medium text-black ${small ? "text-[9px]" : "text-[10px]"}`}>{data[key]}</div>
      }
    </div>
  );

  return (
    // Full overlay: pointer-events none so map stays interactive. Only the title block column is interactive.
    <div className="absolute inset-0 pointer-events-none z-20 print:block" style={{ fontFamily: "Arial, sans-serif" }}>
      {/* Drawing border */}
      <div className="absolute inset-3 border-2 border-black" style={{ right: "115px" }} />
      {/* Title block column */}
      <div className="absolute top-3 bottom-3 right-3 w-[108px] border-2 border-black bg-white pointer-events-auto flex flex-col"
           style={{ boxSizing: "border-box" }}>
        {/* GateGuard logo area */}
        <div className="border-b-2 border-black flex items-center justify-center py-1.5 flex-shrink-0">
          <div className="flex flex-col items-center">
            {/* Hexagon logo approximation */}
            <svg width="36" height="36" viewBox="0 0 36 36">
              <polygon points="18,2 32,10 32,26 18,34 4,26 4,10" fill="#003DA5" stroke="#003DA5" strokeWidth="1"/>
              <text x="18" y="17" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="Arial">GATE</text>
              <text x="18" y="25" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="Arial">GUARD</text>
            </svg>
            <div className="text-[7px] font-bold text-[#003DA5] leading-tight mt-0.5">Gate Guard, LLC.</div>
            <div className="text-[6px] text-gray-600 leading-tight text-center">980 Hammond Drive</div>
            <div className="text-[6px] text-gray-600 leading-tight text-center">Atlanta, GA 30328</div>
            <div className="text-[6px] text-gray-600 leading-tight text-center">(844)4MY-GATE</div>
          </div>
        </div>

        {/* Property name + address (rotated vertical text area) */}
        <div className="flex-1 relative border-b-2 border-black overflow-hidden min-h-0">
          <div className="absolute inset-0 flex">
            {/* Property name vertical */}
            <div className="w-1/2 border-r border-black flex items-center justify-center overflow-hidden">
              <div className="text-[9px] font-bold text-black whitespace-nowrap"
                   style={{ transform: "rotate(-90deg)", transformOrigin: "center", width: "80px", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis" }}>
                {data.propertyName || "Property Name"}
              </div>
            </div>
            {/* Address vertical */}
            <div className="w-1/2 flex items-center justify-center overflow-hidden">
              <div className="text-[7px] text-gray-700 whitespace-nowrap"
                   style={{ transform: "rotate(-90deg)", transformOrigin: "center", width: "80px", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis" }}>
                {data.propertyAddress || "Property Address"}
              </div>
            </div>
          </div>
        </div>

        {/* Rev / Date / By / Title rows */}
        <div className="flex-shrink-0">
          {field("REV", "rev", true)}
          {field("Date", "date", true)}
          {field("By", "by", true)}
          {field("Title", "title")}
        </div>

        {/* Sheet number */}
        <div className="border-t-2 border-black flex-shrink-0">
          <div className="text-[7px] text-gray-500 px-1 pt-0.5">Page</div>
          {editing
            ? <input value={data.sheetNum} onChange={e => onChange({ ...data, sheetNum: e.target.value })}
                className="w-full text-center text-2xl font-bold text-black border-none outline-none bg-transparent pb-1" />
            : <div className="text-center text-2xl font-bold text-black pb-1">{data.sheetNum}</div>
          }
        </div>

        {/* Edit toggle */}
        <button onClick={() => setEditing(v => !v)}
          className="text-[8px] py-1 border-t border-black text-center text-gray-500 hover:bg-gray-50 transition-colors">
          {editing ? "✓ Done" : "✎ Edit"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function FloorPlansPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());
  const mapLoadedRef = useRef(false);
  const rafRef = useRef<number>(0);

  const [plans, setPlans] = useState<FloorPlanData[]>(DEMO_PLANS);
  const [activePlanId, setActivePlanId] = useState(DEMO_PLANS[0].id);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [addingDevice, setAddingDevice] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [activeCableType, setActiveCableType] = useState("cat6");
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
  const [searchAddress, setSearchAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [showBOM, setShowBOM] = useState(false);
  const [showTitleBlock, setShowTitleBlock] = useState(false);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanAddr, setNewPlanAddr] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Refs for stable event handler access
  const addingDeviceRef = useRef<string | null>(null); addingDeviceRef.current = addingDevice;
  const connectModeRef = useRef(false); connectModeRef.current = connectMode;
  const connectingFromRef = useRef<string | null>(null); connectingFromRef.current = connectingFromId;
  const activeCableRef = useRef("cat6"); activeCableRef.current = activeCableType;
  const plansRef = useRef(plans); plansRef.current = plans;
  const activePlanIdRef = useRef(activePlanId); activePlanIdRef.current = activePlanId;
  const placeDeviceRef = useRef<((typeKey: string, lng: number, lat: number) => void) | null>(null);
  const createConnectionRef = useRef<((toId: string) => void) | null>(null);
  const handleMapClickRef = useRef<((lng: number, lat: number, screenX: number, screenY: number) => void) | null>(null);

  const activePlan = plans.find(p => p.id === activePlanId)!;
  const selectedDevice = activePlan?.devices.find(d => d.id === selectedDeviceId) ?? null;
  const selectedConnection = activePlan?.connections.find(c => c.id === selectedConnectionId) ?? null;

  // ── Canvas drawing ──────────────────────────────────────────────────────────
  const getScreenPos = useCallback((dev: PlacedDevice): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    if (mapRef.current && mapLoadedRef.current) {
      try {
        const pt = mapRef.current.project([dev.lng, dev.lat]);
        return { x: pt.x, y: pt.y };
      } catch (_) { return null; }
    }
    // Grid mode: lng/lat are fractions (0-1)
    return { x: dev.lng * canvas.width, y: dev.lat * canvas.height };
  }, []);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect && (canvas.width !== rect.width || canvas.height !== rect.height)) {
      canvas.width = rect.width; canvas.height = rect.height;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const plan = plansRef.current.find(p => p.id === activePlanIdRef.current);
    if (!plan) return;

    // Build screen positions
    const screenPos: Record<string, { x: number; y: number }> = {};
    for (const dev of plan.devices) {
      const pos = getScreenPos(dev);
      if (pos) screenPos[dev.id] = pos;
    }

    // Draw connections (orthogonal)
    for (const conn of plan.connections) {
      const a = screenPos[conn.fromId];
      const b = screenPos[conn.toId];
      if (!a || !b) continue;
      const cable = CABLE_TYPES.find(c => c.key === conn.cableType) ?? CABLE_TYPES[0];
      const isSelected = conn.id === selectedConnectionId;
      let mid1x: number, mid1y: number, mid2x: number, mid2y: number;
      if (conn.routeMode === "h-first") {
        const midX = (a.x + b.x) / 2;
        mid1x = midX; mid1y = a.y; mid2x = midX; mid2y = b.y;
      } else {
        const midY = (a.y + b.y) / 2;
        mid1x = a.x; mid1y = midY; mid2x = b.x; mid2y = midY;
      }
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(mid1x, mid1y);
      ctx.lineTo(mid2x, mid2y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = isSelected ? "#FFFFFF" : cable.color;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.globalAlpha = isSelected ? 1 : 0.9;
      ctx.setLineDash(cable.dash);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      [a, b].forEach(pt => {
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? "#FFFFFF" : cable.color;
        ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
      });

      const labelX = (mid1x + mid2x) / 2, labelY = (mid1y + mid2y) / 2;
      ctx.fillStyle = mapRef.current ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.9)";
      ctx.fillRect(labelX - 17, labelY - 7, 34, 14);
      ctx.font = "bold 9px 'IBM Plex Mono',monospace";
      ctx.fillStyle = cable.color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(cable.label.toUpperCase(), labelX, labelY);
    }

    // Grid mode: also draw device icons on canvas
    if (!mapRef.current || !mapLoadedRef.current) {
      for (const dev of plan.devices) {
        const pos = screenPos[dev.id];
        if (!pos) continue;
        const sc = STATUS_CONFIG[dev.status];
        const dt = DEVICE_TYPES.find(t => t.key === dev.typeKey);
        const isSelected = dev.id === selectedDeviceId;
        const isConnecting = dev.id === connectingFromId;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
        ctx.fillStyle = sc.color;
        ctx.globalAlpha = 0.9;
        ctx.fill();
        if (isSelected || isConnecting) {
          ctx.strokeStyle = isConnecting ? "#FCD34D" : "#FFFFFF";
          ctx.lineWidth = 3;
          ctx.globalAlpha = 1;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.font = "16px serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(dt?.icon ?? "📍", pos.x, pos.y);
        // Label
        ctx.font = "bold 10px Arial,sans-serif";
        ctx.fillStyle = "#000";
        ctx.textAlign = "center";
        ctx.fillText(dev.label, pos.x, pos.y + 26);
      }

      // FOV cones (grid mode)
      for (const dev of plan.devices) {
        const pos = screenPos[dev.id];
        const dt = DEVICE_TYPES.find(t => t.key === dev.typeKey);
        if (!pos || !dt?.hasFOV || dev.fovRangeFt <= 0 || dev.fovAngle <= 0) continue;
        const sc = STATUS_CONFIG[dev.status];
        const rangePixels = (dev.fovRangeFt / 200) * canvas.width * 0.12;
        const halfFov = (dev.fovAngle / 2) * (Math.PI / 180);
        const aimRad = (dev.bearing - 90) * (Math.PI / 180);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.arc(pos.x, pos.y, rangePixels, aimRad - halfFov, aimRad + halfFov);
        ctx.closePath();
        ctx.fillStyle = sc.color;
        ctx.globalAlpha = 0.15;
        ctx.fill();
        ctx.strokeStyle = sc.color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }

    // Rubber-band line while connecting
    if (connectMode && connectingFromId && mousePos) {
      const a = screenPos[connectingFromId];
      if (a) {
        const cable = CABLE_TYPES.find(c => c.key === activeCableType) ?? CABLE_TYPES[0];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(mousePos.x, a.y);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.strokeStyle = cable.color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.globalAlpha = 0.7;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }
  }, [selectedConnectionId, selectedDeviceId, connectMode, connectingFromId, mousePos, activeCableType, getScreenPos]);

  const scheduleRedraw = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => drawCanvas());
  }, [drawCanvas]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  // ── Mouse tracking on map container ────────────────────────────────────────
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      scheduleRedraw();
    };
    el.addEventListener("mousemove", handleMove);
    return () => el.removeEventListener("mousemove", handleMove);
  }, [scheduleRedraw]);

  // ── Load Mapbox ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!(window as any).mapboxgl) {
      const css = document.createElement("link"); css.rel = "stylesheet";
      css.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css"; document.head.appendChild(css);
      const script = document.createElement("script");
      script.src = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js";
      script.onload = initMap; document.head.appendChild(script);
    } else {
      initMap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initMap = useCallback(() => {
    if (!mapContainerRef.current || mapRef.current || !MAPBOX_TOKEN) return;
    const mapboxgl = (window as any).mapboxgl;
    if (!mapboxgl) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const plan = DEMO_PLANS[0];
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [plan.centerLng, plan.centerLat], zoom: plan.zoom,
    });
    mapRef.current = map;
    map.on("load", () => { mapLoadedRef.current = true; setMapReady(true); });
    map.on("move",   scheduleRedraw);
    map.on("zoom",   scheduleRedraw);
    map.on("render", scheduleRedraw);
    map.on("click", (e: any) => {
      const { lng, lat } = e.lngLat;
      const canvas = canvasRef.current;
      let screenX = 0, screenY = 0;
      if (canvas) {
        try { const pt = map.project([lng, lat]); screenX = pt.x; screenY = pt.y; } catch (_) {}
      }
      handleMapClickRef.current?.(lng, lat, screenX, screenY);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleRedraw]);

  // Unified click handler for both map mode and grid mode
  handleMapClickRef.current = useCallback((lng: number, lat: number, screenX: number, screenY: number) => {
    if (addingDeviceRef.current) {
      placeDeviceRef.current?.(addingDeviceRef.current, lng, lat);
      return;
    }
    if (connectModeRef.current) return; // connection clicks handled by marker clicks
    // Connection hit-test
    const plan = plansRef.current.find(p => p.id === activePlanIdRef.current);
    const canvas = canvasRef.current;
    if (plan && canvas) {
      for (const conn of plan.connections) {
        const adev = plan.devices.find(d => d.id === conn.fromId);
        const bdev = plan.devices.find(d => d.id === conn.toId);
        if (!adev || !bdev) continue;
        const getPos = (dev: PlacedDevice) => {
          if (mapRef.current && mapLoadedRef.current) {
            try { const pt = mapRef.current.project([dev.lng, dev.lat]); return { x: pt.x, y: pt.y }; } catch (_) { return null; }
          }
          return { x: dev.lng * canvas.width, y: dev.lat * canvas.height };
        };
        const a = getPos(adev), b = getPos(bdev);
        if (!a || !b) continue;
        let mid1x: number, mid1y: number, mid2x: number, mid2y: number;
        if (conn.routeMode === "h-first") {
          const midX = (a.x + b.x) / 2; mid1x = midX; mid1y = a.y; mid2x = midX; mid2y = b.y;
        } else {
          const midY = (a.y + b.y) / 2; mid1x = a.x; mid1y = midY; mid2x = b.x; mid2y = midY;
        }
        const cx = screenX || a.x, cy = screenY || a.y;
        for (const [p1, p2] of [[a, {x:mid1x,y:mid1y}], [{x:mid1x,y:mid1y},{x:mid2x,y:mid2y}], [{x:mid2x,y:mid2y},b]] as [{x:number,y:number},{x:number,y:number}][]) {
          if (pointToSegDist(cx, cy, p1.x, p1.y, p2.x, p2.y) < 8) {
            setSelectedConnectionId(conn.id); setSelectedDeviceId(null); return;
          }
        }
      }
    }
    setSelectedDeviceId(null); setSelectedConnectionId(null);
  }, []);

  // Grid click handler
  const handleGridClick = useCallback((x: number, y: number) => {
    if (addingDeviceRef.current) {
      placeDeviceRef.current?.(addingDeviceRef.current, x, y);
      return;
    }
    if (connectModeRef.current) return;
    const canvas = canvasRef.current;
    const plan = plansRef.current.find(p => p.id === activePlanIdRef.current);
    if (!canvas || !plan) return;
    const screenX = x * canvas.width, screenY = y * canvas.height;
    // Hit-test devices
    for (const dev of plan.devices) {
      const px = dev.lng * canvas.width, py = dev.lat * canvas.height;
      if (Math.hypot(screenX - px, screenY - py) < 20) {
        if (connectModeRef.current) {
          if (!connectingFromRef.current) { setConnectingFromId(dev.id); return; }
          if (connectingFromRef.current !== dev.id) { createConnectionRef.current?.(dev.id); return; }
        } else {
          setSelectedDeviceId(dev.id); setSelectedConnectionId(null); return;
        }
      }
    }
    // Hit-test connections
    for (const conn of plan.connections) {
      const adev = plan.devices.find(d => d.id === conn.fromId);
      const bdev = plan.devices.find(d => d.id === conn.toId);
      if (!adev || !bdev) continue;
      const a = { x: adev.lng * canvas.width, y: adev.lat * canvas.height };
      const b = { x: bdev.lng * canvas.width, y: bdev.lat * canvas.height };
      let mid1x: number, mid1y: number, mid2x: number, mid2y: number;
      if (conn.routeMode === "h-first") {
        const midX = (a.x + b.x) / 2; mid1x = midX; mid1y = a.y; mid2x = midX; mid2y = b.y;
      } else {
        const midY = (a.y + b.y) / 2; mid1x = a.x; mid1y = midY; mid2x = b.x; mid2y = midY;
      }
      for (const [p1,p2] of [[a,{x:mid1x,y:mid1y}],[{x:mid1x,y:mid1y},{x:mid2x,y:mid2y}],[{x:mid2x,y:mid2y},b]] as [{x:number,y:number},{x:number,y:number}][]) {
        if (pointToSegDist(screenX, screenY, p1.x, p1.y, p2.x, p2.y) < 8) {
          setSelectedConnectionId(conn.id); setSelectedDeviceId(null); return;
        }
      }
    }
    setSelectedDeviceId(null); setSelectedConnectionId(null);
  }, []);

  // ── Sync Mapbox markers ─────────────────────────────────────────────────────
  const syncMarkers = useCallback(() => {
    if (!mapRef.current || !mapLoadedRef.current) return;
    const mapboxgl = (window as any).mapboxgl;
    if (!mapboxgl) return;
    const plan = plans.find(p => p.id === activePlanId);
    if (!plan) return;
    const currentIds = new Set(plan.devices.map(d => d.id));
    markersRef.current.forEach((marker, id) => { if (!currentIds.has(id)) { marker.remove(); markersRef.current.delete(id); } });

    plan.devices.forEach(device => {
      const dt = DEVICE_TYPES.find(t => t.key === device.typeKey);
      const sc = STATUS_CONFIG[device.status];
      const isConnectingFrom = connectingFromId === device.id;

      if (!markersRef.current.has(device.id)) {
        const el = document.createElement("div");
        el.style.cssText = `width:36px;height:36px;border-radius:50%;background:${sc.color};border:3px solid white;
          display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;
          box-shadow:0 2px 8px rgba(0,0,0,0.5);transition:transform 0.15s,border-color 0.15s;user-select:none;`;
        el.textContent = dt?.icon ?? "📍";
        el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.2)"; });
        el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          if (connectModeRef.current) {
            if (!connectingFromRef.current) { setConnectingFromId(device.id); }
            else if (connectingFromRef.current !== device.id) { createConnectionRef.current?.(device.id); }
          } else {
            setSelectedDeviceId(device.id); setSelectedConnectionId(null);
          }
        });
        const marker = new mapboxgl.Marker({ element: el, draggable: true })
          .setLngLat([device.lng, device.lat]).addTo(mapRef.current);
        marker.on("dragend", () => {
          const { lng, lat } = marker.getLngLat();
          setPlans(prev => prev.map(p => p.id === activePlanId ? { ...p, devices: p.devices.map(d => d.id === device.id ? { ...d, lng, lat } : d) } : p));
          scheduleRedraw();
        });
        marker.on("drag", scheduleRedraw);
        markersRef.current.set(device.id, marker);
      } else {
        const marker = markersRef.current.get(device.id)!;
        marker.setLngLat([device.lng, device.lat]);
        const el = marker.getElement();
        el.style.background = sc.color;
        el.style.borderColor = isConnectingFrom ? "#FCD34D" : "white";
        el.textContent = dt?.icon ?? "📍";
      }
    });

    updateFOVLayers(plan.devices);
    scheduleRedraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, activePlanId, connectingFromId, scheduleRedraw]);

  function updateFOVLayers(devices: PlacedDevice[]) {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const fovFeatures = devices.filter(d => { const dt = DEVICE_TYPES.find(t => t.key === d.typeKey); return dt?.hasFOV && d.fovRangeFt > 0 && d.fovAngle > 0; })
      .map(d => ({ type: "Feature" as const, properties: { id: d.id, status: d.status },
        geometry: { type: "Polygon" as const, coordinates: [buildFOVCoords(d.lng, d.lat, d.bearing, d.fovAngle, d.fovRangeFt)] } }));
    if (map.getSource("fov-source")) {
      (map.getSource("fov-source") as any).setData({ type: "FeatureCollection", features: fovFeatures });
    } else {
      map.addSource("fov-source", { type: "geojson", data: { type: "FeatureCollection", features: fovFeatures } });
      map.addLayer({ id: "fov-fill", type: "fill", source: "fov-source", paint: { "fill-color": ["match",["get","status"],"existing","#2563EB","proposed","#F97316","replace","#EF4444","#6B7280"], "fill-opacity": 0.18 } });
      map.addLayer({ id: "fov-outline", type: "line", source: "fov-source", paint: { "line-color": ["match",["get","status"],"existing","#2563EB","proposed","#F97316","replace","#EF4444","#6B7280"], "line-width": 1.5, "line-dasharray": [3,2], "line-opacity": 0.7 } });
    }
  }

  const placeDevice = useCallback((typeKey: string, lng: number, lat: number) => {
    const dt = DEVICE_TYPES.find(t => t.key === typeKey)!;
    const newDev: PlacedDevice = { id: `d-${Date.now()}`, typeKey, label: dt.label, lng, lat, status: "proposed", notes: "", bearing: 180, fovAngle: dt.hasFOV ? 80 : 0, fovRangeFt: dt.hasFOV ? 60 : 0 };
    setPlans(prev => prev.map(p => p.id === activePlanId ? { ...p, devices: [...p.devices, newDev] } : p));
    setSelectedDeviceId(newDev.id);
    setAddingDevice(null);
  }, [activePlanId]);
  placeDeviceRef.current = placeDevice;

  const createConnection = useCallback((toId: string) => {
    const fromId = connectingFromId;
    if (!fromId || fromId === toId) return;
    const plan = plans.find(p => p.id === activePlanId);
    if (plan?.connections.find(c => (c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId))) { setConnectingFromId(null); return; }
    const newConn: Connection = { id: `c-${Date.now()}`, fromId, toId, cableType: activeCableRef.current, lengthFt: 0, fromTerminal: "", toTerminal: "", routeMode: "h-first" };
    setPlans(prev => prev.map(p => p.id === activePlanId ? { ...p, connections: [...p.connections, newConn] } : p));
    setConnectingFromId(null); setSelectedConnectionId(newConn.id); setSelectedDeviceId(null);
  }, [activePlanId, connectingFromId, plans]);
  createConnectionRef.current = createConnection;

  useEffect(() => { syncMarkers(); }, [syncMarkers]);

  useEffect(() => {
    if (!mapRef.current || !mapLoadedRef.current) return;
    const plan = plans.find(p => p.id === activePlanId);
    if (!plan) return;
    markersRef.current.forEach(m => m.remove()); markersRef.current.clear();
    mapRef.current.flyTo({ center: [plan.centerLng, plan.centerLat], zoom: plan.zoom, speed: 1.2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlanId]);

  async function handleGeocode() {
    if (!searchAddress.trim()) return;
    setGeocoding(true);
    const result = await geocodeAddress(searchAddress, MAPBOX_TOKEN);
    setGeocoding(false);
    if (result && mapRef.current) {
      mapRef.current.flyTo({ center: [result.lng, result.lat], zoom: 18, speed: 1.5 });
      setPlans(prev => prev.map(p => p.id === activePlanId ? { ...p, centerLng: result.lng, centerLat: result.lat, address: searchAddress } : p));
    }
  }

  function updateDevice(field: keyof PlacedDevice, value: any) {
    if (!selectedDeviceId) return;
    setPlans(prev => prev.map(p => p.id === activePlanId ? { ...p, devices: p.devices.map(d => d.id === selectedDeviceId ? { ...d, [field]: value } : d) } : p));
  }
  function updateConnection(field: keyof Connection, value: any) {
    if (!selectedConnectionId) return;
    setPlans(prev => prev.map(p => p.id === activePlanId ? { ...p, connections: p.connections.map(c => c.id === selectedConnectionId ? { ...c, [field]: value } : c) } : p));
  }
  function updateTitleBlock(data: TitleBlockData) {
    setPlans(prev => prev.map(p => p.id === activePlanId ? { ...p, titleBlock: data } : p));
  }
  function deleteDevice(id: string) {
    markersRef.current.get(id)?.remove(); markersRef.current.delete(id);
    setPlans(prev => prev.map(p => p.id === activePlanId ? { ...p, devices: p.devices.filter(d => d.id !== id), connections: p.connections.filter(c => c.fromId !== id && c.toId !== id) } : p));
    if (selectedDeviceId === id) setSelectedDeviceId(null);
  }
  function deleteConnection(id: string) {
    setPlans(prev => prev.map(p => p.id === activePlanId ? { ...p, connections: p.connections.filter(c => c.id !== id) } : p));
    if (selectedConnectionId === id) setSelectedConnectionId(null);
  }
  function duplicateDevice(id: string) {
    const dev = activePlan.devices.find(d => d.id === id); if (!dev) return;
    const newDev: PlacedDevice = { ...dev, id: `d-${Date.now()}`, lng: dev.lng + (MAPBOX_TOKEN ? 0.0001 : 0.02), lat: dev.lat + (MAPBOX_TOKEN ? 0.0001 : 0.02), label: dev.label + " (copy)" };
    setPlans(prev => prev.map(p => p.id === activePlanId ? { ...p, devices: [...p.devices, newDev] } : p));
    setSelectedDeviceId(newDev.id);
  }

  async function createPlan() {
    if (!newPlanName.trim()) return;
    let centerLng = -84.3880, centerLat = 33.7490, zoom = 16;
    if (newPlanAddr.trim() && MAPBOX_TOKEN) {
      const geo = await geocodeAddress(newPlanAddr, MAPBOX_TOKEN);
      if (geo) { centerLng = geo.lng; centerLat = geo.lat; zoom = 18; }
    }
    const newPlan: FloorPlanData = { id: `plan-${Date.now()}`, name: newPlanName, address: newPlanAddr, centerLng, centerLat, zoom, devices: [], connections: [], titleBlock: makeTitleBlock(newPlanName, newPlanAddr) };
    setPlans(prev => [...prev, newPlan]); setActivePlanId(newPlan.id);
    setShowNewPlan(false); setNewPlanName(""); setNewPlanAddr("");
  }

  const bomRows = activePlan.devices.reduce<Record<string, { label: string; proposed: number; existing: number; replace: number; remove: number }>>((acc, d) => {
    const dt = DEVICE_TYPES.find(t => t.key === d.typeKey); const key = d.typeKey;
    if (!acc[key]) acc[key] = { label: dt?.label ?? key, proposed: 0, existing: 0, replace: 0, remove: 0 };
    acc[key][d.status]++; return acc;
  }, {});

  const isDark = !!MAPBOX_TOKEN;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`flex h-screen overflow-hidden ${isDark ? "bg-[#0f172a] text-white" : "bg-gray-100 text-gray-900"}`}>

      {/* ── Left panel ── */}
      <div className={`w-56 flex flex-col border-r ${isDark ? "border-white/10 bg-[#111827]" : "border-gray-200 bg-white"}`}>
        <div className={`p-3 border-b ${isDark ? "border-white/10" : "border-gray-200"}`}>
          <div className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Devices</div>
          <div className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            {addingDevice ? <span className="text-orange-500">Click {MAPBOX_TOKEN ? "map" : "grid"} to place</span>
            : connectMode && connectingFromId ? <span className="text-yellow-600">Click destination device</span>
            : connectMode ? <span className="text-green-600">Click source device</span>
            : "Click a device to add"}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-2 space-y-2">
          {CATEGORIES.map(cat => (
            <div key={cat}>
              <button onClick={() => setActiveCategory(cat === activeCategory ? "" : cat)}
                className={`w-full flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider px-1 py-1 transition-colors ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-800"}`}>
                <span>{cat}</span>
                {activeCategory === cat ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </button>
              {activeCategory === cat && (
                <div className="mt-0.5 space-y-0.5">
                  {DEVICE_TYPES.filter(d => d.category === cat).map(dt => (
                    <button key={dt.key}
                      onClick={() => { setAddingDevice(addingDevice === dt.key ? null : dt.key); setConnectMode(false); setConnectingFromId(null); }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors ${
                        addingDevice === dt.key ? "bg-orange-500/20 text-orange-600 border border-orange-400/40" : isDark ? "hover:bg-white/5 text-gray-300" : "hover:bg-gray-50 text-gray-700"
                      }`}>
                      <span className="text-base leading-none">{dt.icon}</span>
                      <span className="truncate">{dt.label}</span>
                      {dt.hasFOV && <span className="ml-auto text-[9px] text-gray-400">FOV</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Cable type */}
        <div className={`p-3 border-t ${isDark ? "border-white/10" : "border-gray-200"}`}>
          <div className={`text-[10px] uppercase font-semibold mb-1.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Cable Type</div>
          {CABLE_TYPES.map(ct => (
            <button key={ct.key} onClick={() => setActiveCableType(ct.key)}
              className={`w-full flex items-center gap-2 px-2 py-1 rounded text-[10px] transition-colors ${
                activeCableType === ct.key ? (isDark ? "bg-white/10 text-white" : "bg-gray-100 text-gray-900") : (isDark ? "text-gray-400 hover:text-white hover:bg-white/5" : "text-gray-500 hover:text-gray-800 hover:bg-gray-50")
              }`}>
              <span className="w-3 h-0.5 inline-block rounded-full" style={{ background: ct.color }} />
              {ct.label}
              {activeCableType === ct.key && <span className="ml-auto text-[9px] text-blue-500">active</span>}
            </button>
          ))}
        </div>

        {/* Status legend */}
        <div className={`p-3 border-t ${isDark ? "border-white/10" : "border-gray-200"} space-y-1`}>
          <div className={`text-[10px] uppercase font-semibold mb-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Status</div>
          {(Object.entries(STATUS_CONFIG) as [DeviceStatus, any][]).map(([key, sc]) => (
            <div key={key} className={`flex items-center gap-2 text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: sc.color }} />{sc.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Toolbar */}
        <div className={`h-12 flex items-center gap-3 px-4 border-b flex-shrink-0 ${isDark ? "border-white/10 bg-[#111827]" : "border-gray-200 bg-white"}`}>
          <div className="flex items-center gap-1 overflow-x-auto">
            {plans.map(p => (
              <button key={p.id} onClick={() => setActivePlanId(p.id)}
                className={`px-3 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                  p.id === activePlanId ? "bg-blue-600 text-white" : isDark ? "text-gray-400 hover:text-white hover:bg-white/10" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}>{p.name}</button>
            ))}
            <button onClick={() => setShowNewPlan(true)} className={`ml-1 p-1 rounded transition-colors ${isDark ? "hover:bg-white/10 text-gray-400 hover:text-white" : "hover:bg-gray-100 text-gray-500"}`}><Plus size={14} /></button>
          </div>

          <div className={`w-px h-6 ${isDark ? "bg-white/10" : "bg-gray-200"}`} />

          {MAPBOX_TOKEN && (
            <div className="flex items-center gap-2 max-w-xs flex-1">
              <div className={`flex-1 flex items-center border rounded px-2 py-1 gap-2 ${isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"}`}>
                <Search size={12} className={isDark ? "text-gray-400" : "text-gray-400"} />
                <input type="text" value={searchAddress} onChange={e => setSearchAddress(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleGeocode()}
                  placeholder="Jump to address…"
                  className={`bg-transparent text-xs outline-none w-full ${isDark ? "text-white placeholder-gray-500" : "text-gray-800 placeholder-gray-400"}`} />
              </div>
              <button onClick={handleGeocode} disabled={geocoding} className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs disabled:opacity-50 transition-colors">{geocoding ? "…" : "Go"}</button>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* Connect mode */}
            <button onClick={() => { setConnectMode(v => !v); setConnectingFromId(null); setAddingDevice(null); }}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border transition-colors ${
                connectMode ? "bg-green-500/20 border-green-500/50 text-green-600" : isDark ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
              }`}>
              <Link size={12} />{connectMode ? (connectingFromId ? "Pick Dest" : "Pick Source") : "Connect"}
            </button>

            {/* Title block */}
            <button onClick={() => setShowTitleBlock(v => !v)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border transition-colors ${
                showTitleBlock ? "bg-blue-600 border-blue-500 text-white" : isDark ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
              }`}>
              <LayoutTemplate size={12} />Title Block
            </button>

            {(addingDevice || (connectMode && connectingFromId)) && (
              <div className={`flex items-center gap-2 px-2 py-1 rounded border text-xs ${connectMode ? "bg-yellow-50 border-yellow-300 text-yellow-700" : "bg-orange-50 border-orange-300 text-orange-700"}`}>
                <Crosshair size={12} />
                <span>{connectMode ? "Click destination" : "Click to place"}</span>
                <button onClick={() => { setAddingDevice(null); setConnectingFromId(null); setConnectMode(false); }}><X size={12} /></button>
              </div>
            )}

            <button onClick={() => setShowBOM(!showBOM)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border transition-colors ${showBOM ? "bg-blue-600 border-blue-500 text-white" : isDark ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"}`}>
              <FileText size={12} />BOM
            </button>
            <button className={`flex items-center gap-1.5 px-2 py-1 border rounded text-xs transition-colors ${isDark ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"}`}>
              <Download size={12} />Export
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Map / Grid area */}
          <div className="flex-1 relative" ref={mapContainerRef}>
            {/* Mapbox map (only when token set) */}
            {/* Note: mapContainerRef IS the container for Mapbox */}

            {/* Grid fallback */}
            {!MAPBOX_TOKEN && <GridBackground onGridClick={handleGridClick} />}

            {/* Canvas overlay — pointer-events: none so clicks pass through to Mapbox/grid */}
            <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />

            {/* Title block overlay */}
            {showTitleBlock && <TitleBlockOverlay data={activePlan.titleBlock} onChange={updateTitleBlock} />}

            {/* Status bar */}
            <div className={`absolute bottom-4 left-4 text-xs px-3 py-2 rounded-lg z-10 pointer-events-none ${isDark ? "bg-black/60 backdrop-blur text-gray-300" : "bg-white/90 shadow text-gray-600 border border-gray-200"}`}>
              <span className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{activePlan.devices.length}</span> devices ·{" "}
              <span className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{activePlan.connections.length}</span> connections
              {!MAPBOX_TOKEN && <span className="ml-2 text-orange-500">· Grid mode</span>}
            </div>

            {connectMode && !connectingFromId && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl z-20 pointer-events-none">Click a source device to start a wire</div>
            )}
            {connectMode && connectingFromId && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs font-semibold px-4 py-2 rounded-full shadow-xl z-20 pointer-events-none">Now click the destination device</div>
            )}
          </div>

          {/* Right panel: device */}
          {selectedDevice && !selectedConnection && (
            <div className={`w-64 border-l flex flex-col overflow-y-auto flex-shrink-0 ${isDark ? "border-white/10 bg-[#111827]" : "border-gray-200 bg-white"}`}>
              <div className={`p-3 border-b flex items-center justify-between ${isDark ? "border-white/10" : "border-gray-200"}`}>
                <span className="text-xs font-semibold truncate">{selectedDevice.label}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => duplicateDevice(selectedDevice.id)} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white"><Copy size={12} /></button>
                  <button onClick={() => deleteDevice(selectedDevice.id)} className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400"><Trash2 size={12} /></button>
                  <button onClick={() => setSelectedDeviceId(null)} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white"><X size={12} /></button>
                </div>
              </div>
              <div className="p-3 space-y-3 text-xs">
                <div>
                  <label className={`block mb-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Label</label>
                  <input type="text" value={selectedDevice.label} onChange={e => updateDevice("label", e.target.value)}
                    className={`w-full border rounded px-2 py-1.5 outline-none ${isDark ? "bg-white/5 border-white/10 text-white focus:border-blue-500" : "bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500"}`} />
                </div>
                <div>
                  <label className={`block mb-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Status</label>
                  <div className="grid grid-cols-2 gap-1">
                    {(Object.entries(STATUS_CONFIG) as [DeviceStatus, any][]).map(([key, sc]) => (
                      <button key={key} onClick={() => updateDevice("status", key)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] border transition-colors ${selectedDevice.status === key ? "border-transparent text-white" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                        style={selectedDevice.status === key ? { background: sc.color } : {}}>
                        <span className="w-2 h-2 rounded-full" style={{ background: sc.color }} />{sc.label}
                      </button>
                    ))}
                  </div>
                </div>
                {DEVICE_TYPES.find(t => t.key === selectedDevice.typeKey)?.hasFOV && (
                  <div className={`space-y-2 border rounded-lg p-2.5 ${isDark ? "border-white/10" : "border-gray-200"}`}>
                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase text-gray-500"><Eye size={10} />Camera Coverage</div>
                    {[["Bearing", "bearing", 0, 359, "°", "accent-blue-500"],["FOV Angle","fovAngle",10,180,"°","accent-orange-500"],["Range","fovRangeFt",10,300," ft","accent-green-500"]].map(([lbl,field,mn,mx,unit,accent]) => (
                      <div key={field as string}>
                        <div className="flex justify-between text-gray-500 mb-1"><span>{lbl}</span><span className="font-medium text-gray-800">{(selectedDevice as any)[field as string]}{unit}</span></div>
                        <input type="range" min={mn as number} max={mx as number} value={(selectedDevice as any)[field as string]} onChange={e => updateDevice(field as keyof PlacedDevice, Number(e.target.value))} className={`w-full h-1 ${accent}`} />
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <label className={`block mb-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Notes</label>
                  <textarea value={selectedDevice.notes} onChange={e => updateDevice("notes", e.target.value)} rows={3}
                    className={`w-full border rounded px-2 py-1.5 outline-none resize-none text-[11px] leading-relaxed ${isDark ? "bg-white/5 border-white/10 text-white focus:border-blue-500" : "bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500"}`} />
                </div>
              </div>
            </div>
          )}

          {/* Right panel: connection */}
          {selectedConnection && !selectedDevice && (
            <div className={`w-64 border-l flex flex-col overflow-y-auto flex-shrink-0 ${isDark ? "border-white/10 bg-[#111827]" : "border-gray-200 bg-white"}`}>
              <div className={`p-3 border-b flex items-center justify-between ${isDark ? "border-white/10" : "border-gray-200"}`}>
                <span className="text-xs font-semibold">Wire / Cable</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => deleteConnection(selectedConnection.id)} className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400"><Trash2 size={12} /></button>
                  <button onClick={() => setSelectedConnectionId(null)} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white"><X size={12} /></button>
                </div>
              </div>
              <div className="p-3 space-y-3 text-xs">
                <div className={`flex items-center gap-2 text-[10px] rounded px-2 py-2 ${isDark ? "bg-white/5 text-gray-400" : "bg-gray-50 text-gray-600"}`}>
                  <span className="truncate text-white font-medium">{activePlan.devices.find(d => d.id === selectedConnection.fromId)?.label ?? "—"}</span>
                  <span>→</span>
                  <span className="truncate text-white font-medium">{activePlan.devices.find(d => d.id === selectedConnection.toId)?.label ?? "—"}</span>
                </div>
                <div>
                  <label className={`block mb-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Cable Type</label>
                  {CABLE_TYPES.map(ct => (
                    <button key={ct.key} onClick={() => updateConnection("cableType", ct.key)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[10px] transition-colors ${selectedConnection.cableType === ct.key ? (isDark ? "bg-white/10 text-white" : "bg-gray-100 text-gray-900") : (isDark ? "text-gray-400 hover:bg-white/5" : "text-gray-500 hover:bg-gray-50")}`}>
                      <span className="w-3 h-0.5 rounded-full flex-shrink-0" style={{ background: ct.color }} />{ct.label}
                    </button>
                  ))}
                </div>
                <div>
                  <label className={`block mb-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Route Mode</label>
                  <div className="grid grid-cols-2 gap-1">
                    {(["h-first","v-first"] as RouteMode[]).map(rm => (
                      <button key={rm} onClick={() => updateConnection("routeMode", rm)}
                        className={`px-2 py-1.5 rounded text-[10px] border transition-colors ${selectedConnection.routeMode === rm ? "bg-blue-600 border-blue-500 text-white" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                        {rm === "h-first" ? "→ ↕" : "↕ →"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={`block mb-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Length (ft)</label>
                  <input type="number" value={selectedConnection.lengthFt} onChange={e => updateConnection("lengthFt", Number(e.target.value))}
                    className={`w-full border rounded px-2 py-1.5 outline-none ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-900"}`} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[["From Terminal","fromTerminal","e.g. Relay"],["To Terminal","toTerminal","e.g. COM"]].map(([lbl,fld,ph]) => (
                    <div key={fld}>
                      <label className={`block mb-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>{lbl}</label>
                      <input type="text" value={(selectedConnection as any)[fld]} onChange={e => updateConnection(fld as keyof Connection, e.target.value)} placeholder={ph}
                        className={`w-full border rounded px-2 py-1.5 outline-none text-[10px] ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-900"}`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* BOM panel */}
          {showBOM && (
            <div className={`w-72 border-l flex flex-col overflow-hidden flex-shrink-0 ${isDark ? "border-white/10 bg-[#111827]" : "border-gray-200 bg-white"}`}>
              <div className={`p-3 border-b flex items-center justify-between ${isDark ? "border-white/10" : "border-gray-200"}`}>
                <span className="text-xs font-semibold">Bill of Materials</span>
                <button onClick={() => setShowBOM(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <table className="w-full text-[10px]">
                  <thead><tr className={`border-b ${isDark ? "text-gray-400 border-white/10" : "text-gray-500 border-gray-200"}`}>
                    <th className="text-left pb-1.5">Device</th>
                    <th className="text-center pb-1.5 text-blue-500">Exist</th>
                    <th className="text-center pb-1.5 text-orange-500">New</th>
                    <th className="text-center pb-1.5 text-red-500">Repl</th>
                  </tr></thead>
                  <tbody>
                    {Object.values(bomRows).map((row, i) => (
                      <tr key={i} className={`border-b ${isDark ? "border-white/5" : "border-gray-100"}`}>
                        <td className={`py-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}>{row.label}</td>
                        <td className="text-center text-blue-500">{row.existing || "—"}</td>
                        <td className="text-center text-orange-500">{row.proposed || "—"}</td>
                        <td className="text-center text-red-500">{row.replace || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {activePlan.connections.length > 0 && (
                  <>
                    <div className={`mt-4 mb-2 text-[10px] uppercase font-semibold border-t pt-3 ${isDark ? "text-gray-400 border-white/10" : "text-gray-500 border-gray-200"}`}>Wire Schedule</div>
                    <table className="w-full text-[10px]">
                      <thead><tr className={isDark ? "text-gray-400" : "text-gray-500"}><th className="text-left pb-1">From</th><th className="text-left pb-1">To</th><th className="text-left pb-1">Cable</th><th className="text-right pb-1">ft</th></tr></thead>
                      <tbody>
                        {activePlan.connections.map(c => {
                          const f = activePlan.devices.find(d => d.id === c.fromId);
                          const t = activePlan.devices.find(d => d.id === c.toId);
                          const cable = CABLE_TYPES.find(ct => ct.key === c.cableType);
                          return (
                            <tr key={c.id} className={`border-b cursor-pointer ${isDark ? "border-white/5 hover:bg-white/5" : "border-gray-100 hover:bg-gray-50"}`}
                              onClick={() => { setSelectedConnectionId(c.id); setSelectedDeviceId(null); }}>
                              <td className={`py-1 truncate max-w-[55px] ${isDark ? "text-gray-300" : "text-gray-700"}`}>{f?.label ?? "—"}</td>
                              <td className={`py-1 truncate max-w-[55px] ${isDark ? "text-gray-300" : "text-gray-700"}`}>{t?.label ?? "—"}</td>
                              <td className="py-1"><span style={{ color: cable?.color ?? "#888" }}>{cable?.label ?? c.cableType}</span></td>
                              <td className={`py-1 text-right ${isDark ? "text-gray-400" : "text-gray-500"}`}>{c.lengthFt || "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                )}
                <div className={`mt-4 p-3 rounded-lg border ${isDark ? "bg-blue-500/10 border-blue-500/20" : "bg-blue-50 border-blue-200"}`}>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    {(["existing","proposed","replace"] as DeviceStatus[]).map(s => (
                      <div key={s}><div className="text-sm font-semibold" style={{ color: STATUS_CONFIG[s].color }}>{activePlan.devices.filter(d => d.status === s).length}</div><div className="text-[9px] text-gray-500 capitalize">{s}</div></div>
                    ))}
                  </div>
                </div>
                <button className="mt-3 w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                  <FileText size={12} />Create Quote from BOM
                </button>
                <button className="mt-2 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                  <Download size={12} />Export BOM CSV
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── New Plan Modal ── */}
      {showNewPlan && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className={`border rounded-xl p-6 w-96 shadow-2xl ${isDark ? "bg-[#1e293b] border-white/10" : "bg-white border-gray-200"}`}>
            <h3 className="font-semibold mb-4">New Floor Plan</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Plan Name *</label>
                <input type="text" value={newPlanName} onChange={e => setNewPlanName(e.target.value)} placeholder="e.g. Sunset Commons"
                  className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-900"}`} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Property Address</label>
                <input type="text" value={newPlanAddr} onChange={e => setNewPlanAddr(e.target.value)} placeholder="123 Main St, Atlanta, GA"
                  className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-900"}`} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowNewPlan(false); setNewPlanName(""); setNewPlanAddr(""); }}
                className={`flex-1 px-4 py-2 rounded-lg text-sm transition-colors ${isDark ? "bg-white/5 hover:bg-white/10 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}>Cancel</button>
              <button onClick={createPlan} disabled={!newPlanName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white font-semibold disabled:opacity-50 transition-colors">Create Plan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
