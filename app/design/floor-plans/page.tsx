"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, X, Download, Trash2, Search, MapPin, FileText } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Copy, Crosshair, Eye, ChevronDown, ChevronRight, Link, Minus } = require("lucide-react") as any;

// ─── Mapbox Token ──────────────────────────────────────────────────────────────
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

// ─── Types ─────────────────────────────────────────────────────────────────────
type DeviceStatus = "existing" | "proposed" | "replace" | "remove";
type RouteMode = "h-first" | "v-first"; // horizontal-then-vertical vs vertical-then-horizontal

type DeviceType = { key: string; label: string; icon: string; color: string; category: string; hasFOV?: boolean; };

type PlacedDevice = {
  id: string; typeKey: string; label: string;
  lng: number; lat: number; status: DeviceStatus; notes: string;
  bearing: number; fovAngle: number; fovRangeFt: number;
};

type Connection = {
  id: string; fromId: string; toId: string;
  cableType: string; lengthFt: number;
  fromTerminal: string; toTerminal: string;
  routeMode: RouteMode;
};

type FloorPlanData = {
  id: string; name: string; address: string;
  centerLng: number; centerLat: number; zoom: number;
  devices: PlacedDevice[]; connections: Connection[];
};

// ─── Cable Types ────────────────────────────────────────────────────────────────
const CABLE_TYPES = [
  { key: "cat6",       label: "CAT6",           color: "#3B82F6", dash: [] },
  { key: "cat5e",      label: "CAT5e",          color: "#06B6D4", dash: [] },
  { key: "2wire",      label: "2-Wire",         color: "#F97316", dash: [6, 3] },
  { key: "18_2",       label: "18/2 LV",        color: "#EAB308", dash: [6, 3] },
  { key: "fiber",      label: "Fiber",          color: "#A855F7", dash: [2, 4] },
  { key: "conduit",    label: "Conduit",        color: "#6B7280", dash: [10, 4] },
  { key: "coax",       label: "Coax",           color: "#EC4899", dash: [] },
];

// ─── Status Config ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<DeviceStatus, { label: string; color: string }> = {
  existing: { label: "Existing",  color: "#2563EB" },
  proposed: { label: "Proposed",  color: "#F97316" },
  replace:  { label: "Replace",   color: "#EF4444" },
  remove:   { label: "Remove",    color: "#6B7280" },
};

// ─── Device Library ─────────────────────────────────────────────────────────────
const DEVICE_TYPES: DeviceType[] = [
  { key: "cam_bullet",  label: "Bullet Camera",     icon: "📷", color: "#3B82F6", category: "Video Surveillance", hasFOV: true },
  { key: "cam_dome",    label: "Dome Camera",        icon: "🎥", color: "#3B82F6", category: "Video Surveillance", hasFOV: true },
  { key: "cam_lpr",     label: "LPR Camera",         icon: "🔭", color: "#6366F1", category: "Video Surveillance", hasFOV: true },
  { key: "cam_ptz",     label: "PTZ Camera",         icon: "🎬", color: "#3B82F6", category: "Video Surveillance", hasFOV: true },
  { key: "cam_fisheye", label: "Fisheye Camera",     icon: "👁", color: "#3B82F6", category: "Video Surveillance", hasFOV: true },
  { key: "nvr",         label: "NVR / DVR",          icon: "🖥", color: "#64748B", category: "Video Surveillance" },
  { key: "brivo_300",   label: "Brivo ACS300",       icon: "🔐", color: "#10B981", category: "Access Control" },
  { key: "brivo_100",   label: "Brivo ACS100",       icon: "🔐", color: "#10B981", category: "Access Control" },
  { key: "brivo_6100",  label: "Brivo ACS6100",      icon: "🔐", color: "#10B981", category: "Access Control" },
  { key: "reader",      label: "Card Reader",        icon: "💳", color: "#10B981", category: "Access Control" },
  { key: "rex",         label: "REX Sensor",         icon: "🔆", color: "#10B981", category: "Access Control" },
  { key: "keypad",      label: "Keypad",             icon: "⌨", color: "#8B5CF6", category: "Access Control" },
  { key: "dk6050",      label: "DK 6050 Gate Op",    icon: "🚧", color: "#F59E0B", category: "Gate Systems" },
  { key: "dk9050",      label: "DK 9050 Gate Op",    icon: "🚧", color: "#F59E0B", category: "Gate Systems" },
  { key: "liftmaster",  label: "LiftMaster SL3000",  icon: "🚧", color: "#F59E0B", category: "Gate Systems" },
  { key: "dk1835",      label: "DK1835 Callbox",     icon: "📞", color: "#8B5CF6", category: "Gate Systems" },
  { key: "g3_intercom", label: "UniFi G3 Intercom",  icon: "🔔", color: "#8B5CF6", category: "Gate Systems" },
  { key: "loop_det",    label: "Loop Detector",      icon: "⭕", color: "#EF4444", category: "Gate Systems" },
  { key: "photobeam",   label: "Photobeam",          icon: "🔦", color: "#EF4444", category: "Gate Systems" },
  { key: "ucg_ultra",   label: "UCG-Ultra",          icon: "🌐", color: "#0891B2", category: "Networking" },
  { key: "usw_flex",    label: "USW-Flex",           icon: "🔌", color: "#0891B2", category: "Networking" },
  { key: "ap",          label: "Access Point",       icon: "📡", color: "#0891B2", category: "Networking" },
  { key: "router",      label: "Router / Firewall",  icon: "🛡", color: "#0891B2", category: "Networking" },
  { key: "mag_lock",    label: "Mag Lock",           icon: "🔒", color: "#64748B", category: "Sensors & Safety" },
  { key: "strike",      label: "Electric Strike",    icon: "⚡", color: "#64748B", category: "Sensors & Safety" },
  { key: "motion",      label: "Motion Sensor",      icon: "👁", color: "#EF4444", category: "Sensors & Safety" },
  { key: "smoke",       label: "Smoke Detector",     icon: "🌫", color: "#EF4444", category: "Sensors & Safety" },
  { key: "panic",       label: "Panic Button",       icon: "🔴", color: "#EF4444", category: "Sensors & Safety" },
  { key: "power_panel", label: "Power Panel",        icon: "⚡", color: "#92400E", category: "Infrastructure" },
  { key: "conduit",     label: "Conduit Run",        icon: "━", color: "#92400E", category: "Infrastructure" },
  { key: "junction",    label: "Junction Box",       icon: "📦", color: "#92400E", category: "Infrastructure" },
  { key: "ups",         label: "UPS / Battery",      icon: "🔋", color: "#92400E", category: "Infrastructure" },
  { key: "server",      label: "Server / Rack",      icon: "🖥", color: "#92400E", category: "Infrastructure" },
];

const CATEGORIES = [...new Set(DEVICE_TYPES.map(d => d.category))];

// ─── Demo Plans ─────────────────────────────────────────────────────────────────
const DEMO_PLANS: FloorPlanData[] = [
  {
    id: "plan-1", name: "Brentwood Apartments", address: "2500 Brentwood Blvd, Atlanta, GA",
    centerLng: -84.2807, centerLat: 33.7752, zoom: 18,
    devices: [
      { id: "d1", typeKey: "cam_bullet",  label: "Entry Bullet Cam",    lng: -84.2803, lat: 33.7754, status: "existing", notes: "Eagle Eye, installed 2023", bearing: 225, fovAngle: 80,  fovRangeFt: 80  },
      { id: "d2", typeKey: "cam_lpr",     label: "Entry LPR Camera",    lng: -84.2800, lat: 33.7753, status: "existing", notes: "LPR on entry lane",        bearing: 200, fovAngle: 40,  fovRangeFt: 60  },
      { id: "d3", typeKey: "cam_dome",    label: "Pool Area Dome",      lng: -84.2812, lat: 33.7750, status: "proposed", notes: "New install — Phase 2",    bearing: 0,   fovAngle: 120, fovRangeFt: 50  },
      { id: "d4", typeKey: "dk6050",      label: "Entry Gate Operator", lng: -84.2805, lat: 33.7755, status: "existing", notes: "DK 6050, 2022",            bearing: 0,   fovAngle: 0,   fovRangeFt: 0   },
      { id: "d5", typeKey: "brivo_300",   label: "Brivo ACS300",        lng: -84.2810, lat: 33.7757, status: "existing", notes: "Main controller",          bearing: 0,   fovAngle: 0,   fovRangeFt: 0   },
      { id: "d6", typeKey: "dk1835",      label: "Entry Callbox",       lng: -84.2802, lat: 33.7756, status: "existing", notes: "Tenant directory",         bearing: 0,   fovAngle: 0,   fovRangeFt: 0   },
    ],
    connections: [
      { id: "c1", fromId: "d5", toId: "d4", cableType: "2wire",  lengthFt: 45, fromTerminal: "Relay", toTerminal: "Open/Close", routeMode: "h-first" },
      { id: "c2", fromId: "d5", toId: "d6", cableType: "cat6",   lengthFt: 30, fromTerminal: "LAN",   toTerminal: "RJ45",       routeMode: "v-first" },
      { id: "c3", fromId: "d5", toId: "d1", cableType: "cat6",   lengthFt: 60, fromTerminal: "LAN",   toTerminal: "RJ45",       routeMode: "h-first" },
    ],
  },
  {
    id: "plan-2", name: "Riverview Apartments", address: "500 Riverside Dr, Atlanta, GA",
    centerLng: -84.4100, centerLat: 33.7490, zoom: 18,
    devices: [
      { id: "d1", typeKey: "cam_bullet", label: "Main Gate Cam", lng: -84.4095, lat: 33.7492, status: "existing", notes: "", bearing: 180, fovAngle: 70,  fovRangeFt: 100 },
      { id: "d2", typeKey: "cam_dome",   label: "Lobby Dome",    lng: -84.4103, lat: 33.7489, status: "replace",  notes: "Old unit",  bearing: 0,   fovAngle: 120, fovRangeFt: 40  },
      { id: "d3", typeKey: "dk9050",     label: "Exit Gate Op",  lng: -84.4097, lat: 33.7491, status: "existing", notes: "",         bearing: 0,   fovAngle: 0,   fovRangeFt: 0   },
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
  const steps = 16;
  const halfFov = fovDeg / 2;
  for (let i = 0; i <= steps; i++) {
    const angle = toRad(bearingDeg - halfFov + (fovDeg * i) / steps);
    const latR = toRad(lat);
    const lngR = toRad(lng);
    const d = rangeM / R;
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
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanAddr, setNewPlanAddr] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const activePlan = plans.find(p => p.id === activePlanId)!;
  const selectedDevice = activePlan?.devices.find(d => d.id === selectedDeviceId) ?? null;
  const selectedConnection = activePlan?.connections.find(c => c.id === selectedConnectionId) ?? null;

  // ── Canvas drawing ──────────────────────────────────────────────────────────
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const map = mapRef.current;
    if (!canvas || !map || !mapLoadedRef.current) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize canvas to match container
    const rect = canvas.parentElement!.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const plan = plans.find(p => p.id === activePlanId);
    if (!plan) return;

    // Build a map of device id → screen {x, y}
    const screenPos: Record<string, { x: number; y: number }> = {};
    for (const dev of plan.devices) {
      try {
        const pt = map.project([dev.lng, dev.lat]);
        screenPos[dev.id] = { x: pt.x, y: pt.y };
      } catch (_) {}
    }

    // Draw each connection
    for (const conn of plan.connections) {
      const a = screenPos[conn.fromId];
      const b = screenPos[conn.toId];
      if (!a || !b) continue;

      const cable = CABLE_TYPES.find(c => c.key === conn.cableType) ?? CABLE_TYPES[0];
      const isSelected = conn.id === selectedConnectionId;

      // Compute orthogonal mid-point
      let mid1x: number, mid1y: number, mid2x: number, mid2y: number;
      if (conn.routeMode === "h-first") {
        // Go horizontal to midX, then vertical
        const midX = (a.x + b.x) / 2;
        mid1x = midX; mid1y = a.y;
        mid2x = midX; mid2y = b.y;
      } else {
        // Go vertical to midY, then horizontal
        const midY = (a.y + b.y) / 2;
        mid1x = a.x; mid1y = midY;
        mid2x = b.x; mid2y = midY;
      }

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(mid1x, mid1y);
      ctx.lineTo(mid2x, mid2y);
      ctx.lineTo(b.x, b.y);

      ctx.strokeStyle = isSelected ? "#FFFFFF" : cable.color;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.globalAlpha = isSelected ? 1 : 0.85;
      if (cable.dash.length > 0) {
        ctx.setLineDash(cable.dash);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Draw small circles at endpoints
      [a, b].forEach(pt => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? "#FFFFFF" : cable.color;
        ctx.globalAlpha = 0.9;
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Cable type label at midpoint
      const labelX = (mid1x + mid2x) / 2;
      const labelY = (mid1y + mid2y) / 2;
      const labelW = 34;
      const labelH = 14;
      ctx.fillStyle = "rgba(15,23,42,0.85)";
      ctx.fillRect(labelX - labelW / 2, labelY - labelH / 2, labelW, labelH);
      ctx.font = "bold 9px 'IBM Plex Mono', monospace";
      ctx.fillStyle = cable.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(cable.label.toUpperCase(), labelX, labelY);
    }

    // Draw rubber-band line while connecting
    if (connectMode && connectingFromId && mousePos) {
      const a = screenPos[connectingFromId];
      if (a) {
        const cable = CABLE_TYPES.find(c => c.key === activeCableType) ?? CABLE_TYPES[0];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        // Orthogonal rubber-band: h-first by default
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
  }, [plans, activePlanId, selectedConnectionId, connectMode, connectingFromId, mousePos, activeCableType]);

  // Redraw on every animation frame while map is moving, then settle
  const scheduleRedraw = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => { drawCanvas(); });
  }, [drawCanvas]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // ── Load Mapbox GL JS ────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).mapboxgl) { initMap(); return; }
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css";
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js";
    script.onload = initMap;
    document.head.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initMap = useCallback(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const mapboxgl = (window as any).mapboxgl;
    if (!mapboxgl || !MAPBOX_TOKEN) { setMapReady(false); return; }
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const plan = DEMO_PLANS[0];
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [plan.centerLng, plan.centerLat],
      zoom: plan.zoom,
    });
    mapRef.current = map;
    map.on("load", () => { mapLoadedRef.current = true; setMapReady(true); });
    map.on("move",   scheduleRedraw);
    map.on("zoom",   scheduleRedraw);
    map.on("rotate", scheduleRedraw);
    map.on("pitch",  scheduleRedraw);
    map.on("render", scheduleRedraw);
    map.on("click", (e: any) => {
      if (addingDeviceRef.current) {
        const { lng, lat } = e.lngLat;
        placeDeviceRef.current?.(addingDeviceRef.current, lng, lat);
      } else if (!connectModeRef.current) {
        setSelectedDeviceId(null);
        setSelectedConnectionId(null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleRedraw]);

  const addingDeviceRef = useRef<string | null>(null);
  addingDeviceRef.current = addingDevice;
  const connectModeRef = useRef(false);
  connectModeRef.current = connectMode;
  const connectingFromRef = useRef<string | null>(null);
  connectingFromRef.current = connectingFromId;
  const activeCableRef = useRef("cat6");
  activeCableRef.current = activeCableType;
  const placeDeviceRef = useRef<((typeKey: string, lng: number, lat: number) => void) | null>(null);
  const createConnectionRef = useRef<((toId: string) => void) | null>(null);

  // ── Sync markers ─────────────────────────────────────────────────────────────
  const syncMarkers = useCallback(() => {
    if (!mapRef.current || !mapLoadedRef.current) return;
    const mapboxgl = (window as any).mapboxgl;
    if (!mapboxgl) return;
    const plan = plans.find(p => p.id === activePlanId);
    if (!plan) return;

    const currentIds = new Set(plan.devices.map(d => d.id));
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) { marker.remove(); markersRef.current.delete(id); }
    });

    plan.devices.forEach(device => {
      const dt = DEVICE_TYPES.find(t => t.key === device.typeKey);
      const sc = STATUS_CONFIG[device.status];
      const isConnectingFrom = connectingFromId === device.id;

      if (!markersRef.current.has(device.id)) {
        const el = document.createElement("div");
        el.className = "floor-plan-marker";
        el.style.cssText = `
          width:36px;height:36px;border-radius:50%;
          background:${sc.color};border:3px solid white;
          display:flex;align-items:center;justify-content:center;
          font-size:16px;cursor:pointer;
          box-shadow:0 2px 8px rgba(0,0,0,0.5);
          transition:transform 0.15s,border-color 0.15s;
          user-select:none;
        `;
        el.textContent = dt?.icon ?? "📍";
        el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.2)"; });
        el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          if (connectModeRef.current) {
            if (!connectingFromRef.current) {
              setConnectingFromId(device.id);
            } else if (connectingFromRef.current !== device.id) {
              createConnectionRef.current?.(device.id);
            }
          } else {
            setSelectedDeviceId(device.id);
            setSelectedConnectionId(null);
          }
        });

        const marker = new mapboxgl.Marker({ element: el, draggable: true })
          .setLngLat([device.lng, device.lat])
          .addTo(mapRef.current);

        marker.on("dragend", () => {
          const { lng, lat } = marker.getLngLat();
          setPlans(prev => prev.map(p =>
            p.id === activePlanId
              ? { ...p, devices: p.devices.map(d => d.id === device.id ? { ...d, lng, lat } : d) }
              : p
          ));
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
    const fovFeatures = devices
      .filter(d => { const dt = DEVICE_TYPES.find(t => t.key === d.typeKey); return dt?.hasFOV && d.fovRangeFt > 0 && d.fovAngle > 0; })
      .map(d => ({
        type: "Feature" as const,
        properties: { id: d.id, status: d.status },
        geometry: { type: "Polygon" as const, coordinates: [buildFOVCoords(d.lng, d.lat, d.bearing, d.fovAngle, d.fovRangeFt)] },
      }));
    if (map.getSource("fov-source")) {
      (map.getSource("fov-source") as any).setData({ type: "FeatureCollection", features: fovFeatures });
    } else {
      map.addSource("fov-source", { type: "geojson", data: { type: "FeatureCollection", features: fovFeatures } });
      map.addLayer({ id: "fov-fill", type: "fill", source: "fov-source",
        paint: { "fill-color": ["match",["get","status"],"existing","#2563EB","proposed","#F97316","replace","#EF4444","#6B7280"], "fill-opacity": 0.18 } });
      map.addLayer({ id: "fov-outline", type: "line", source: "fov-source",
        paint: { "line-color": ["match",["get","status"],"existing","#2563EB","proposed","#F97316","replace","#EF4444","#6B7280"], "line-width": 1.5, "line-dasharray": [3,2], "line-opacity": 0.7 } });
    }
  }

  const placeDevice = useCallback((typeKey: string, lng: number, lat: number) => {
    const dt = DEVICE_TYPES.find(t => t.key === typeKey)!;
    const newDevice: PlacedDevice = { id: `d-${Date.now()}`, typeKey, label: dt.label, lng, lat, status: "proposed", notes: "", bearing: 180, fovAngle: dt.hasFOV ? 80 : 0, fovRangeFt: dt.hasFOV ? 60 : 0 };
    setPlans(prev => prev.map(p => p.id === activePlanId ? { ...p, devices: [...p.devices, newDevice] } : p));
    setSelectedDeviceId(newDevice.id);
    setAddingDevice(null);
  }, [activePlanId]);
  placeDeviceRef.current = placeDevice;

  const createConnection = useCallback((toId: string) => {
    const fromId = connectingFromId;
    if (!fromId || fromId === toId) return;
    // Check if already connected
    const plan = plans.find(p => p.id === activePlanId);
    if (plan?.connections.find(c => (c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId))) {
      setConnectingFromId(null); return;
    }
    const newConn: Connection = { id: `c-${Date.now()}`, fromId, toId, cableType: activeCableRef.current, lengthFt: 0, fromTerminal: "", toTerminal: "", routeMode: "h-first" };
    setPlans(prev => prev.map(p => p.id === activePlanId ? { ...p, connections: [...p.connections, newConn] } : p));
    setConnectingFromId(null);
    setSelectedConnectionId(newConn.id);
    setSelectedDeviceId(null);
  }, [activePlanId, connectingFromId, plans]);
  createConnectionRef.current = createConnection;

  useEffect(() => { syncMarkers(); }, [syncMarkers]);

  // Canvas mouse tracking for rubber-band line
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    canvas.addEventListener("mousemove", handleMove);
    return () => canvas.removeEventListener("mousemove", handleMove);
  }, []);

  // Click on canvas (for connection selection)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleClick = (e: MouseEvent) => {
      if (!mapLoadedRef.current || addingDevice || connectMode) return;
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const map = mapRef.current;
      const plan = plans.find(p => p.id === activePlanId);
      if (!map || !plan) return;

      // Hit-test connections (check if click is near any segment)
      for (const conn of plan.connections) {
        const adev = plan.devices.find(d => d.id === conn.fromId);
        const bdev = plan.devices.find(d => d.id === conn.toId);
        if (!adev || !bdev) continue;
        try {
          const a = map.project([adev.lng, adev.lat]);
          const b = map.project([bdev.lng, bdev.lat]);
          let mid1x: number, mid1y: number, mid2x: number, mid2y: number;
          if (conn.routeMode === "h-first") {
            const midX = (a.x + b.x) / 2;
            mid1x = midX; mid1y = a.y; mid2x = midX; mid2y = b.y;
          } else {
            const midY = (a.y + b.y) / 2;
            mid1x = a.x; mid1y = midY; mid2x = b.x; mid2y = midY;
          }
          const segments = [[a, {x:mid1x,y:mid1y}],[{x:mid1x,y:mid1y},{x:mid2x,y:mid2y}],[{x:mid2x,y:mid2y},b]];
          for (const [p1,p2] of segments) {
            const dist = pointToSegDist(cx, cy, p1.x, p1.y, p2.x, p2.y);
            if (dist < 8) { setSelectedConnectionId(conn.id); setSelectedDeviceId(null); return; }
          }
        } catch (_) {}
      }
    };
    canvas.addEventListener("click", handleClick);
    return () => canvas.removeEventListener("click", handleClick);
  }, [plans, activePlanId, addingDevice, connectMode]);

  function pointToSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax, dy = by - ay;
    if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px-ax)*dx + (py-ay)*dy) / (dx*dx + dy*dy)));
    return Math.hypot(px - (ax+t*dx), py - (ay+t*dy));
  }

  useEffect(() => {
    if (!mapRef.current || !mapLoadedRef.current) return;
    const plan = plans.find(p => p.id === activePlanId);
    if (!plan) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current.clear();
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

  function deleteDevice(id: string) {
    markersRef.current.get(id)?.remove();
    markersRef.current.delete(id);
    setPlans(prev => prev.map(p =>
      p.id === activePlanId
        ? { ...p, devices: p.devices.filter(d => d.id !== id), connections: p.connections.filter(c => c.fromId !== id && c.toId !== id) }
        : p
    ));
    if (selectedDeviceId === id) setSelectedDeviceId(null);
  }

  function deleteConnection(id: string) {
    setPlans(prev => prev.map(p => p.id === activePlanId ? { ...p, connections: p.connections.filter(c => c.id !== id) } : p));
    if (selectedConnectionId === id) setSelectedConnectionId(null);
  }

  function duplicateDevice(id: string) {
    const dev = activePlan.devices.find(d => d.id === id);
    if (!dev) return;
    const newDev: PlacedDevice = { ...dev, id: `d-${Date.now()}`, lng: dev.lng + 0.0001, lat: dev.lat + 0.0001, label: dev.label + " (copy)" };
    setPlans(prev => prev.map(p => p.id === activePlanId ? { ...p, devices: [...p.devices, newDev] } : p));
    setSelectedDeviceId(newDev.id);
  }

  const bomRows = activePlan.devices.reduce<Record<string, { label: string; proposed: number; existing: number; replace: number; remove: number }>>((acc, d) => {
    const dt = DEVICE_TYPES.find(t => t.key === d.typeKey);
    const key = d.typeKey;
    if (!acc[key]) acc[key] = { label: dt?.label ?? key, proposed: 0, existing: 0, replace: 0, remove: 0 };
    acc[key][d.status]++;
    return acc;
  }, {});

  async function createPlan() {
    if (!newPlanName.trim()) return;
    let centerLng = -84.3880, centerLat = 33.7490, zoom = 16;
    if (newPlanAddr.trim()) {
      const geo = await geocodeAddress(newPlanAddr, MAPBOX_TOKEN);
      if (geo) { centerLng = geo.lng; centerLat = geo.lat; zoom = 18; }
    }
    const newPlan: FloorPlanData = { id: `plan-${Date.now()}`, name: newPlanName, address: newPlanAddr, centerLng, centerLat, zoom, devices: [], connections: [] };
    setPlans(prev => [...prev, newPlan]);
    setActivePlanId(newPlan.id);
    setShowNewPlan(false);
    setNewPlanName(""); setNewPlanAddr("");
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#0f172a] text-white overflow-hidden">

      {/* ── Left panel ── */}
      <div className="w-56 flex flex-col border-r border-white/10 bg-[#111827]">
        <div className="p-3 border-b border-white/10">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Devices</div>
          <div className="text-[10px] text-gray-500">
            {addingDevice ? <span className="text-orange-400">Click map to place</span>
            : connectMode && connectingFromId ? <span className="text-yellow-400">Now click destination</span>
            : connectMode ? <span className="text-green-400">Click source device</span>
            : "Select to add to map"}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-2 space-y-3">
          {CATEGORIES.map(cat => (
            <div key={cat}>
              <button onClick={() => setActiveCategory(cat === activeCategory ? "" : cat)}
                className="w-full flex items-center justify-between text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 py-1 hover:text-white transition-colors">
                <span>{cat}</span>
                {activeCategory === cat ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </button>
              {activeCategory === cat && (
                <div className="mt-1 space-y-0.5">
                  {DEVICE_TYPES.filter(d => d.category === cat).map(dt => (
                    <button key={dt.key}
                      onClick={() => { setAddingDevice(addingDevice === dt.key ? null : dt.key); setConnectMode(false); setConnectingFromId(null); }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors text-left ${
                        addingDevice === dt.key ? "bg-orange-500/20 text-orange-400 border border-orange-500/40" : "hover:bg-white/5 text-gray-300"
                      }`}>
                      <span className="text-base leading-none">{dt.icon}</span>
                      <span className="truncate">{dt.label}</span>
                      {dt.hasFOV && <span className="ml-auto text-[9px] text-gray-500">FOV</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Cable type selector */}
        <div className="p-3 border-t border-white/10">
          <div className="text-[10px] text-gray-400 uppercase font-semibold mb-2">Cable Type</div>
          <div className="space-y-0.5">
            {CABLE_TYPES.map(ct => (
              <button key={ct.key}
                onClick={() => setActiveCableType(ct.key)}
                className={`w-full flex items-center gap-2 px-2 py-1 rounded text-[10px] transition-colors ${
                  activeCableType === ct.key ? "bg-white/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}>
                <span className="w-3 h-0.5 inline-block rounded-full" style={{ background: ct.color }} />
                {ct.label}
                {activeCableType === ct.key && <span className="ml-auto text-[9px] text-blue-400">active</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Status legend */}
        <div className="p-3 border-t border-white/10 space-y-1">
          <div className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Status</div>
          {(Object.entries(STATUS_CONFIG) as [DeviceStatus, any][]).map(([key, sc]) => (
            <div key={key} className="flex items-center gap-2 text-xs text-gray-400">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: sc.color }} />
              {sc.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Toolbar */}
        <div className="h-12 flex items-center gap-3 px-4 border-b border-white/10 bg-[#111827] flex-shrink-0">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {plans.map(p => (
              <button key={p.id} onClick={() => setActivePlanId(p.id)}
                className={`px-3 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                  p.id === activePlanId ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-white/10"
                }`}>{p.name}</button>
            ))}
            <button onClick={() => setShowNewPlan(true)} className="ml-1 p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"><Plus size={14} /></button>
          </div>

          <div className="w-px h-6 bg-white/10" />

          {/* Address search */}
          <div className="flex items-center gap-2 max-w-xs flex-1">
            <div className="flex-1 flex items-center bg-white/5 border border-white/10 rounded px-2 py-1 gap-2">
              <Search size={12} className="text-gray-400 flex-shrink-0" />
              <input type="text" value={searchAddress} onChange={e => setSearchAddress(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleGeocode()}
                placeholder="Jump to address…"
                className="bg-transparent text-xs text-white placeholder-gray-500 outline-none w-full" />
            </div>
            <button onClick={handleGeocode} disabled={geocoding}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs disabled:opacity-50 transition-colors">
              {geocoding ? "…" : "Go"}
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Connect mode toggle */}
            <button
              onClick={() => { setConnectMode(v => !v); setConnectingFromId(null); setAddingDevice(null); }}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors border ${
                connectMode
                  ? "bg-green-500/20 border-green-500/50 text-green-400"
                  : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
              }`}
            >
              <Link size={12} />
              {connectMode ? (connectingFromId ? "Pick Dest" : "Pick Source") : "Connect"}
            </button>

            {/* Active mode pill */}
            {(addingDevice || (connectMode && connectingFromId)) && (
              <div className={`flex items-center gap-2 ${connectMode ? "bg-yellow-500/20 border border-yellow-500/40" : "bg-orange-500/20 border border-orange-500/40"} rounded px-2 py-1`}>
                <Crosshair size={12} className={connectMode ? "text-yellow-400" : "text-orange-400"} />
                <span className={`text-xs ${connectMode ? "text-yellow-400" : "text-orange-400"}`}>
                  {connectMode ? "Click destination device" : "Click map to place"}
                </span>
                <button onClick={() => { setAddingDevice(null); setConnectingFromId(null); setConnectMode(false); }}
                  className={connectMode ? "text-yellow-400 hover:text-yellow-200" : "text-orange-400 hover:text-orange-200"}>
                  <X size={12} />
                </button>
              </div>
            )}

            <button onClick={() => setShowBOM(!showBOM)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${showBOM ? "bg-blue-600 text-white" : "bg-white/5 hover:bg-white/10 text-gray-300"}`}>
              <FileText size={12} />BOM
            </button>
            <button className="flex items-center gap-1.5 px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-xs text-gray-300 transition-colors">
              <Download size={12} />Export
            </button>
          </div>
        </div>

        {/* Map + panels */}
        <div className="flex-1 flex overflow-hidden">

          {/* Map container */}
          <div className="flex-1 relative">
            <div ref={mapContainerRef} className="absolute inset-0" />
            {/* Canvas overlay for orthogonal lines */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 pointer-events-auto z-10"
              style={{ cursor: connectMode ? "crosshair" : addingDevice ? "crosshair" : "default" }}
            />

            {!MAPBOX_TOKEN && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f172a] z-20">
                <MapPin size={48} className="text-blue-500 mb-4 opacity-50" />
                <p className="text-white font-semibold mb-2">Mapbox Token Required</p>
                <p className="text-gray-400 text-sm text-center max-w-xs">Set <code className="bg-white/10 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> in your environment.</p>
              </div>
            )}

            {mapReady && (
              <div className="absolute bottom-6 left-4 bg-black/60 backdrop-blur rounded-lg px-3 py-2 text-xs text-gray-300 z-10 pointer-events-none">
                <span className="font-semibold text-white">{activePlan.devices.length}</span> devices ·{" "}
                <span className="font-semibold text-white">{activePlan.connections.length}</span> connections
              </div>
            )}

            {/* Hint: how to connect */}
            {connectMode && !connectingFromId && mapReady && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl z-20 pointer-events-none">
                Click a source device to start a wire
              </div>
            )}
            {connectMode && connectingFromId && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs font-semibold px-4 py-2 rounded-full shadow-xl z-20 pointer-events-none">
                Now click the destination device
              </div>
            )}
          </div>

          {/* Right panel: device properties */}
          {selectedDevice && !selectedConnection && (
            <div className="w-64 border-l border-white/10 bg-[#111827] flex flex-col overflow-y-auto flex-shrink-0">
              <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <span className="text-xs font-semibold text-white truncate">{selectedDevice.label}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => duplicateDevice(selectedDevice.id)} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors" title="Duplicate"><Copy size={12} /></button>
                  <button onClick={() => deleteDevice(selectedDevice.id)} className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                  <button onClick={() => setSelectedDeviceId(null)} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"><X size={12} /></button>
                </div>
              </div>
              <div className="p-3 space-y-3 text-xs">
                <div>
                  <label className="block text-gray-400 mb-1">Label</label>
                  <input type="text" value={selectedDevice.label} onChange={e => updateDevice("label", e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Status</label>
                  <div className="grid grid-cols-2 gap-1">
                    {(Object.entries(STATUS_CONFIG) as [DeviceStatus, any][]).map(([key, sc]) => (
                      <button key={key} onClick={() => updateDevice("status", key)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] border transition-colors ${
                          selectedDevice.status === key ? "border-transparent text-white" : "border-white/10 text-gray-400 hover:border-white/20"
                        }`}
                        style={selectedDevice.status === key ? { background: sc.color } : {}}>
                        <span className="w-2 h-2 rounded-full" style={{ background: sc.color }} />{sc.label}
                      </button>
                    ))}
                  </div>
                </div>
                {DEVICE_TYPES.find(t => t.key === selectedDevice.typeKey)?.hasFOV && (
                  <div className="space-y-2.5 border border-white/10 rounded-lg p-2.5">
                    <div className="flex items-center gap-1 text-gray-400 text-[10px] font-semibold uppercase"><Eye size={10} />Camera Coverage</div>
                    <div>
                      <div className="flex justify-between text-gray-400 mb-1"><span>Bearing</span><span className="text-white">{selectedDevice.bearing}°</span></div>
                      <input type="range" min={0} max={359} value={selectedDevice.bearing} onChange={e => updateDevice("bearing", Number(e.target.value))} className="w-full accent-blue-500 h-1" />
                    </div>
                    <div>
                      <div className="flex justify-between text-gray-400 mb-1"><span>FOV Angle</span><span className="text-white">{selectedDevice.fovAngle}°</span></div>
                      <input type="range" min={10} max={180} value={selectedDevice.fovAngle} onChange={e => updateDevice("fovAngle", Number(e.target.value))} className="w-full accent-orange-500 h-1" />
                    </div>
                    <div>
                      <div className="flex justify-between text-gray-400 mb-1"><span>Range</span><span className="text-white">{selectedDevice.fovRangeFt} ft</span></div>
                      <input type="range" min={10} max={300} value={selectedDevice.fovRangeFt} onChange={e => updateDevice("fovRangeFt", Number(e.target.value))} className="w-full accent-green-500 h-1" />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="block text-gray-400 mb-1">Lat</label><input type="number" step={0.0001} value={selectedDevice.lat.toFixed(6)} onChange={e => updateDevice("lat", parseFloat(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white text-[10px] outline-none" /></div>
                  <div><label className="block text-gray-400 mb-1">Lng</label><input type="number" step={0.0001} value={selectedDevice.lng.toFixed(6)} onChange={e => updateDevice("lng", parseFloat(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white text-[10px] outline-none" /></div>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Notes</label>
                  <textarea value={selectedDevice.notes} onChange={e => updateDevice("notes", e.target.value)} rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white outline-none focus:border-blue-500 resize-none text-[11px] leading-relaxed" />
                </div>
              </div>
            </div>
          )}

          {/* Right panel: connection properties */}
          {selectedConnection && !selectedDevice && (
            <div className="w-64 border-l border-white/10 bg-[#111827] flex flex-col overflow-y-auto flex-shrink-0">
              <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Wire / Cable</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => deleteConnection(selectedConnection.id)} className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                  <button onClick={() => setSelectedConnectionId(null)} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"><X size={12} /></button>
                </div>
              </div>
              <div className="p-3 space-y-3 text-xs">
                <div className="flex items-center gap-2 text-[10px] text-gray-400 bg-white/5 rounded px-2 py-2">
                  <span className="text-white truncate">{activePlan.devices.find(d => d.id === selectedConnection.fromId)?.label ?? "—"}</span>
                  <span>→</span>
                  <span className="text-white truncate">{activePlan.devices.find(d => d.id === selectedConnection.toId)?.label ?? "—"}</span>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Cable Type</label>
                  <div className="space-y-0.5">
                    {CABLE_TYPES.map(ct => (
                      <button key={ct.key} onClick={() => updateConnection("cableType", ct.key)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[10px] transition-colors ${
                          selectedConnection.cableType === ct.key ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5"
                        }`}>
                        <span className="w-3 h-0.5 inline-block rounded-full flex-shrink-0" style={{ background: ct.color }} />
                        {ct.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Route Mode</label>
                  <div className="grid grid-cols-2 gap-1">
                    {(["h-first", "v-first"] as RouteMode[]).map(rm => (
                      <button key={rm} onClick={() => updateConnection("routeMode", rm)}
                        className={`px-2 py-1.5 rounded text-[10px] border transition-colors ${
                          selectedConnection.routeMode === rm
                            ? "bg-blue-600 border-blue-500 text-white"
                            : "border-white/10 text-gray-400 hover:border-white/20"
                        }`}>
                        {rm === "h-first" ? "→ ↕" : "↕ →"}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1 text-[9px] text-gray-500">{selectedConnection.routeMode === "h-first" ? "Horizontal then vertical" : "Vertical then horizontal"}</div>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Length (ft)</label>
                  <input type="number" value={selectedConnection.lengthFt} onChange={e => updateConnection("lengthFt", Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white outline-none focus:border-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-gray-400 mb-1">From Terminal</label>
                    <input type="text" value={selectedConnection.fromTerminal} onChange={e => updateConnection("fromTerminal", e.target.value)} placeholder="e.g. Relay"
                      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-1">To Terminal</label>
                    <input type="text" value={selectedConnection.toTerminal} onChange={e => updateConnection("toTerminal", e.target.value)} placeholder="e.g. COM"
                      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white outline-none focus:border-blue-500" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BOM panel */}
          {showBOM && (
            <div className="w-72 border-l border-white/10 bg-[#111827] flex flex-col overflow-hidden flex-shrink-0">
              <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Bill of Materials</span>
                <button onClick={() => setShowBOM(false)} className="text-gray-400 hover:text-white"><X size={14} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <table className="w-full text-[10px]">
                  <thead><tr className="text-gray-400 border-b border-white/10">
                    <th className="text-left pb-1.5">Device</th>
                    <th className="text-center pb-1.5 text-blue-400">Exist</th>
                    <th className="text-center pb-1.5 text-orange-400">New</th>
                    <th className="text-center pb-1.5 text-red-400">Repl</th>
                  </tr></thead>
                  <tbody>
                    {Object.values(bomRows).map((row, i) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="py-1.5 text-gray-300">{row.label}</td>
                        <td className="text-center text-blue-400">{row.existing || "—"}</td>
                        <td className="text-center text-orange-400">{row.proposed || "—"}</td>
                        <td className="text-center text-red-400">{row.replace || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Wire schedule */}
                {activePlan.connections.length > 0 && (
                  <>
                    <div className="mt-4 mb-2 text-[10px] text-gray-400 uppercase font-semibold border-t border-white/10 pt-3">Wire Schedule</div>
                    <table className="w-full text-[10px]">
                      <thead><tr className="text-gray-400 border-b border-white/10">
                        <th className="text-left pb-1">From</th>
                        <th className="text-left pb-1">To</th>
                        <th className="text-left pb-1">Cable</th>
                        <th className="text-right pb-1">ft</th>
                      </tr></thead>
                      <tbody>
                        {activePlan.connections.map(c => {
                          const fromDev = activePlan.devices.find(d => d.id === c.fromId);
                          const toDev = activePlan.devices.find(d => d.id === c.toId);
                          const cable = CABLE_TYPES.find(ct => ct.key === c.cableType);
                          return (
                            <tr key={c.id} className="border-b border-white/5 cursor-pointer hover:bg-white/5"
                              onClick={() => { setSelectedConnectionId(c.id); setSelectedDeviceId(null); }}>
                              <td className="py-1 text-gray-300 truncate max-w-[60px]">{fromDev?.label ?? "—"}</td>
                              <td className="py-1 text-gray-300 truncate max-w-[60px]">{toDev?.label ?? "—"}</td>
                              <td className="py-1"><span style={{ color: cable?.color ?? "#fff" }}>{cable?.label ?? c.cableType}</span></td>
                              <td className="py-1 text-right text-gray-400">{c.lengthFt || "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                )}

                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="grid grid-cols-3 gap-1">
                    {(["existing","proposed","replace"] as DeviceStatus[]).map(s => (
                      <div key={s} className="text-center">
                        <div className="text-sm font-semibold" style={{ color: STATUS_CONFIG[s].color }}>{activePlan.devices.filter(d => d.status === s).length}</div>
                        <div className="text-[9px] text-gray-500 capitalize">{s}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <button className="mt-3 w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                  <FileText size={12} />Create Quote from BOM
                </button>
                <button className="mt-2 w-full bg-white/5 hover:bg-white/10 text-gray-300 text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                  <Download size={12} />Export BOM CSV
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── New Plan Modal ── */}
      {showNewPlan && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#1e293b] border border-white/10 rounded-xl p-6 w-96 shadow-2xl">
            <h3 className="text-white font-semibold mb-4">New Floor Plan</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Plan Name *</label>
                <input type="text" value={newPlanName} onChange={e => setNewPlanName(e.target.value)} placeholder="e.g. Sunset Commons"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Property Address (optional)</label>
                <input type="text" value={newPlanAddr} onChange={e => setNewPlanAddr(e.target.value)} placeholder="123 Main St, Atlanta, GA"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowNewPlan(false); setNewPlanName(""); setNewPlanAddr(""); }}
                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300 transition-colors">Cancel</button>
              <button onClick={createPlan} disabled={!newPlanName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white font-semibold disabled:opacity-50 transition-colors">Create Plan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
