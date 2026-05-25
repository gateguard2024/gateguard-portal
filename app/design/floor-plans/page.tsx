"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, X, Download, Trash2, Search, MapPin, Layers, FileText } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Copy, Crosshair, Eye, ChevronDown, ChevronRight, SlidersHorizontal } = require("lucide-react") as any;

// ─── Mapbox Token ─────────────────────────────────────────────────────────────
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────
type DeviceStatus = "existing" | "proposed" | "replace" | "remove";

type DeviceType = {
  key: string; label: string; icon: string; color: string; category: string;
  hasFOV?: boolean;
};

type PlacedDevice = {
  id: string;
  typeKey: string;
  label: string;
  lng: number;
  lat: number;
  status: DeviceStatus;
  notes: string;
  bearing: number;      // camera aim direction 0-359°
  fovAngle: number;     // field of view width in degrees
  fovRangeFt: number;   // coverage range in feet
};

type Connection = {
  id: string; fromId: string; toId: string;
  cableType: string; lengthFt: number;
  fromTerminal: string; toTerminal: string;
};

type FloorPlanData = {
  id: string; name: string; address: string;
  centerLng: number; centerLat: number; zoom: number;
  devices: PlacedDevice[]; connections: Connection[];
};

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<DeviceStatus, { label: string; color: string; bg: string; dot: string }> = {
  existing:  { label: "Existing",  color: "#2563EB", bg: "#1D4ED8", dot: "bg-blue-500" },
  proposed:  { label: "Proposed",  color: "#F97316", bg: "#EA6B0A", dot: "bg-orange-500" },
  replace:   { label: "Replace",   color: "#EF4444", bg: "#DC2626", dot: "bg-red-500" },
  remove:    { label: "Remove",    color: "#6B7280", bg: "#4B5563", dot: "bg-gray-500" },
};

// ─── Device Library (33 types across 6 categories) ───────────────────────────
const DEVICE_TYPES: DeviceType[] = [
  // Video Surveillance
  { key: "cam_bullet",  label: "Bullet Camera",     icon: "📷", color: "#3B82F6", category: "Video Surveillance", hasFOV: true },
  { key: "cam_dome",    label: "Dome Camera",        icon: "🎥", color: "#3B82F6", category: "Video Surveillance", hasFOV: true },
  { key: "cam_lpr",     label: "LPR Camera",         icon: "🔭", color: "#6366F1", category: "Video Surveillance", hasFOV: true },
  { key: "cam_ptz",     label: "PTZ Camera",         icon: "🎬", color: "#3B82F6", category: "Video Surveillance", hasFOV: true },
  { key: "cam_fisheye", label: "Fisheye Camera",     icon: "👁", color: "#3B82F6", category: "Video Surveillance", hasFOV: true },
  { key: "nvr",         label: "NVR / DVR",          icon: "🖥", color: "#64748B", category: "Video Surveillance" },
  // Access Control
  { key: "brivo_300",   label: "Brivo ACS300",       icon: "🔐", color: "#10B981", category: "Access Control" },
  { key: "brivo_100",   label: "Brivo ACS100",       icon: "🔐", color: "#10B981", category: "Access Control" },
  { key: "brivo_6100",  label: "Brivo ACS6100",      icon: "🔐", color: "#10B981", category: "Access Control" },
  { key: "reader",      label: "Card Reader",        icon: "💳", color: "#10B981", category: "Access Control" },
  { key: "rex",         label: "REX Sensor",         icon: "🔆", color: "#10B981", category: "Access Control" },
  { key: "keypad",      label: "Keypad",             icon: "⌨", color: "#8B5CF6", category: "Access Control" },
  // Gate Systems
  { key: "dk6050",      label: "DK 6050 Gate Op",   icon: "🚧", color: "#F59E0B", category: "Gate Systems" },
  { key: "dk9050",      label: "DK 9050 Gate Op",   icon: "🚧", color: "#F59E0B", category: "Gate Systems" },
  { key: "liftmaster",  label: "LiftMaster SL3000", icon: "🚧", color: "#F59E0B", category: "Gate Systems" },
  { key: "dk1835",      label: "DK1835 Callbox",    icon: "📞", color: "#8B5CF6", category: "Gate Systems" },
  { key: "g3_intercom", label: "UniFi G3 Intercom", icon: "🔔", color: "#8B5CF6", category: "Gate Systems" },
  { key: "loop_det",    label: "Loop Detector",     icon: "⭕", color: "#EF4444", category: "Gate Systems" },
  { key: "photobeam",   label: "Photobeam",         icon: "🔦", color: "#EF4444", category: "Gate Systems" },
  // Networking
  { key: "ucg_ultra",   label: "UCG-Ultra",          icon: "🌐", color: "#0891B2", category: "Networking" },
  { key: "usw_flex",    label: "USW-Flex",           icon: "🔌", color: "#0891B2", category: "Networking" },
  { key: "ap",          label: "Access Point",      icon: "📡", color: "#0891B2", category: "Networking" },
  { key: "router",      label: "Router / Firewall", icon: "🛡", color: "#0891B2", category: "Networking" },
  // Sensors & Safety
  { key: "mag_lock",    label: "Mag Lock",          icon: "🔒", color: "#64748B", category: "Sensors & Safety" },
  { key: "strike",      label: "Electric Strike",  icon: "⚡", color: "#64748B", category: "Sensors & Safety" },
  { key: "motion",      label: "Motion Sensor",     icon: "👁", color: "#EF4444", category: "Sensors & Safety" },
  { key: "smoke",       label: "Smoke Detector",    icon: "🌫", color: "#EF4444", category: "Sensors & Safety" },
  { key: "panic",       label: "Panic Button",      icon: "🔴", color: "#EF4444", category: "Sensors & Safety" },
  // Infrastructure
  { key: "power_panel", label: "Power Panel",       icon: "⚡", color: "#92400E", category: "Infrastructure" },
  { key: "conduit",     label: "Conduit Run",       icon: "━", color: "#92400E", category: "Infrastructure" },
  { key: "junction",    label: "Junction Box",      icon: "📦", color: "#92400E", category: "Infrastructure" },
  { key: "ups",         label: "UPS / Battery",     icon: "🔋", color: "#92400E", category: "Infrastructure" },
  { key: "server",      label: "Server / Rack",     icon: "🖥", color: "#92400E", category: "Infrastructure" },
];

const CATEGORIES = [...new Set(DEVICE_TYPES.map(d => d.category))];

// ─── Demo Plans ───────────────────────────────────────────────────────────────
const DEMO_PLANS: FloorPlanData[] = [
  {
    id: "plan-1", name: "Brentwood Apartments", address: "2500 Brentwood Blvd, Atlanta, GA",
    centerLng: -84.2807, centerLat: 33.7752, zoom: 18,
    devices: [
      { id: "d1", typeKey: "cam_bullet",  label: "Entry Bullet Cam",   lng: -84.2803, lat: 33.7754, status: "existing", notes: "Eagle Eye, installed 2023", bearing: 225, fovAngle: 80,  fovRangeFt: 80  },
      { id: "d2", typeKey: "cam_lpr",     label: "Entry LPR Camera",   lng: -84.2800, lat: 33.7753, status: "existing", notes: "LPR on entry lane",       bearing: 200, fovAngle: 40,  fovRangeFt: 60  },
      { id: "d3", typeKey: "cam_dome",    label: "Pool Area Dome",     lng: -84.2812, lat: 33.7750, status: "proposed", notes: "New install - Phase 2",    bearing: 0,   fovAngle: 120, fovRangeFt: 50  },
      { id: "d4", typeKey: "dk6050",      label: "Entry Gate Operator",lng: -84.2805, lat: 33.7755, status: "existing", notes: "DK 6050, 2022",            bearing: 0,   fovAngle: 90,  fovRangeFt: 30  },
      { id: "d5", typeKey: "brivo_300",   label: "Brivo ACS300",       lng: -84.2810, lat: 33.7757, status: "existing", notes: "Main controller",          bearing: 0,   fovAngle: 90,  fovRangeFt: 30  },
      { id: "d6", typeKey: "dk1835",      label: "Entry Callbox",      lng: -84.2802, lat: 33.7756, status: "existing", notes: "Tenant directory",         bearing: 0,   fovAngle: 90,  fovRangeFt: 30  },
    ],
    connections: [],
  },
  {
    id: "plan-2", name: "Riverview Apartments", address: "500 Riverside Dr, Atlanta, GA",
    centerLng: -84.4100, centerLat: 33.7490, zoom: 18,
    devices: [
      { id: "d1", typeKey: "cam_bullet",  label: "Main Gate Cam",      lng: -84.4095, lat: 33.7492, status: "existing", notes: "", bearing: 180, fovAngle: 70,  fovRangeFt: 100 },
      { id: "d2", typeKey: "cam_dome",    label: "Lobby Dome",         lng: -84.4103, lat: 33.7489, status: "replace",  notes: "Old unit, needs swap",    bearing: 0,   fovAngle: 120, fovRangeFt: 40  },
      { id: "d3", typeKey: "dk9050",      label: "Exit Gate Op",       lng: -84.4097, lat: 33.7491, status: "existing", notes: "",                        bearing: 0,   fovAngle: 90,  fovRangeFt: 30  },
    ],
    connections: [],
  },
];

// ─── Geographic helpers ───────────────────────────────────────────────────────
function buildFOVCoords(
  lng: number, lat: number,
  bearingDeg: number, fovDeg: number, rangeFt: number
): [number, number][] {
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
    const lng2 = lngR + Math.atan2(
      Math.sin(angle) * Math.sin(d) * Math.cos(latR),
      Math.cos(d) - Math.sin(latR) * Math.sin(lat2)
    );

    pts.push([toDeg(lng2), toDeg(lat2)]);
  }
  pts.push([lng, lat]);
  return pts;
}

async function geocodeAddress(address: string, token: string): Promise<{ lng: number; lat: number } | null> {
  if (!token) return null;
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&limit=1`
    );
    const data = await res.json();
    if (data.features?.[0]?.center) {
      const [lng, lat] = data.features[0].center;
      return { lng, lat };
    }
  } catch (_) { /* ignore */ }
  return null;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function FloorPlansPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());
  const mapLoadedRef = useRef(false);

  const [plans, setPlans] = useState<FloorPlanData[]>(DEMO_PLANS);
  const [activePlanId, setActivePlanId] = useState(DEMO_PLANS[0].id);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [addingDevice, setAddingDevice] = useState<string | null>(null); // typeKey being placed
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
  const [searchAddress, setSearchAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [showBOM, setShowBOM] = useState(false);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanAddr, setNewPlanAddr] = useState("");
  const [mapReady, setMapReady] = useState(false);

  const activePlan = plans.find(p => p.id === activePlanId)!;
  const selectedDevice = activePlan?.devices.find(d => d.id === selectedDeviceId) ?? null;

  // ── Load Mapbox GL JS via script tag ────────────────────────────────────────
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    map.on("load", () => {
      mapLoadedRef.current = true;
      setMapReady(true);
    });

    map.on("click", (e: any) => {
      if (!addingDeviceRef.current) { setSelectedDeviceId(null); return; }
      const { lng, lat } = e.lngLat;
      placeDeviceRef.current?.(addingDeviceRef.current, lng, lat);
    });
  }, []);

  // Use refs so event handlers can see latest state
  const addingDeviceRef = useRef<string | null>(null);
  addingDeviceRef.current = addingDevice;

  const placeDeviceRef = useRef<((typeKey: string, lng: number, lat: number) => void) | null>(null);

  // ── Sync devices to markers ─────────────────────────────────────────────────
  const syncMarkers = useCallback(() => {
    if (!mapRef.current || !mapLoadedRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapboxgl = (window as any).mapboxgl;
    if (!mapboxgl) return;

    const plan = plans.find(p => p.id === activePlanId);
    if (!plan) return;

    // Remove stale markers
    const currentIds = new Set(plan.devices.map(d => d.id));
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) { marker.remove(); markersRef.current.delete(id); }
    });

    // Add/update markers
    plan.devices.forEach(device => {
      const dt = DEVICE_TYPES.find(t => t.key === device.typeKey);
      const sc = STATUS_CONFIG[device.status];

      if (!markersRef.current.has(device.id)) {
        const el = document.createElement("div");
        el.className = "floor-plan-marker";
        el.style.cssText = `
          width: 36px; height: 36px; border-radius: 50%;
          background: ${sc.color}; border: 3px solid white;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.5);
          transition: transform 0.15s;
        `;
        el.textContent = dt?.icon ?? "📍";
        el.title = device.label;

        el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.2)"; });
        el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelectedDeviceId(device.id);
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
        });

        markersRef.current.set(device.id, marker);
      } else {
        markersRef.current.get(device.id)!.setLngLat([device.lng, device.lat]);
        const el = markersRef.current.get(device.id)!.getElement();
        el.style.background = sc.color;
        el.textContent = dt?.icon ?? "📍";
      }
    });

    // Update FOV layers
    updateFOVLayers(plan.devices);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, activePlanId]);

  function updateFOVLayers(devices: PlacedDevice[]) {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;

    const fovFeatures = devices
      .filter(d => {
        const dt = DEVICE_TYPES.find(t => t.key === d.typeKey);
        return dt?.hasFOV && d.fovRangeFt > 0 && d.fovAngle > 0;
      })
      .map(d => ({
        type: "Feature" as const,
        properties: { id: d.id, status: d.status },
        geometry: {
          type: "Polygon" as const,
          coordinates: [buildFOVCoords(d.lng, d.lat, d.bearing, d.fovAngle, d.fovRangeFt)],
        },
      }));

    if (map.getSource("fov-source")) {
      (map.getSource("fov-source") as any).setData({ type: "FeatureCollection", features: fovFeatures });
    } else {
      map.addSource("fov-source", {
        type: "geojson",
        data: { type: "FeatureCollection", features: fovFeatures },
      });
      map.addLayer({
        id: "fov-fill",
        type: "fill",
        source: "fov-source",
        paint: {
          "fill-color": [
            "match", ["get", "status"],
            "existing", "#2563EB",
            "proposed", "#F97316",
            "replace",  "#EF4444",
            "#6B7280"
          ],
          "fill-opacity": 0.18,
        },
      });
      map.addLayer({
        id: "fov-outline",
        type: "line",
        source: "fov-source",
        paint: {
          "line-color": [
            "match", ["get", "status"],
            "existing", "#2563EB",
            "proposed", "#F97316",
            "replace",  "#EF4444",
            "#6B7280"
          ],
          "line-width": 1.5,
          "line-dasharray": [3, 2],
          "line-opacity": 0.7,
        },
      });
    }
  }

  // ── Place device ─────────────────────────────────────────────────────────────
  const placeDevice = useCallback((typeKey: string, lng: number, lat: number) => {
    const dt = DEVICE_TYPES.find(t => t.key === typeKey)!;
    const newDevice: PlacedDevice = {
      id: `d-${Date.now()}`,
      typeKey,
      label: dt.label,
      lng, lat,
      status: "proposed",
      notes: "",
      bearing: 180,
      fovAngle: dt.hasFOV ? 80 : 0,
      fovRangeFt: dt.hasFOV ? 60 : 0,
    };
    setPlans(prev => prev.map(p =>
      p.id === activePlanId ? { ...p, devices: [...p.devices, newDevice] } : p
    ));
    setSelectedDeviceId(newDevice.id);
    setAddingDevice(null);
  }, [activePlanId]);

  placeDeviceRef.current = placeDevice;

  useEffect(() => { syncMarkers(); }, [syncMarkers]);

  // ── Switch plan ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapLoadedRef.current) return;
    const plan = plans.find(p => p.id === activePlanId);
    if (!plan) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current.clear();
    mapRef.current.flyTo({ center: [plan.centerLng, plan.centerLat], zoom: plan.zoom, speed: 1.2 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlanId]);

  // ── Geocode search ───────────────────────────────────────────────────────────
  async function handleGeocode() {
    if (!searchAddress.trim()) return;
    setGeocoding(true);
    const result = await geocodeAddress(searchAddress, MAPBOX_TOKEN);
    setGeocoding(false);
    if (result && mapRef.current) {
      mapRef.current.flyTo({ center: [result.lng, result.lat], zoom: 18, speed: 1.5 });
      setPlans(prev => prev.map(p =>
        p.id === activePlanId
          ? { ...p, centerLng: result.lng, centerLat: result.lat, address: searchAddress }
          : p
      ));
    }
  }

  // ── Update device field ──────────────────────────────────────────────────────
  function updateDevice(field: keyof PlacedDevice, value: any) {
    if (!selectedDeviceId) return;
    setPlans(prev => prev.map(p =>
      p.id === activePlanId
        ? { ...p, devices: p.devices.map(d => d.id === selectedDeviceId ? { ...d, [field]: value } : d) }
        : p
    ));
  }

  function deleteDevice(id: string) {
    markersRef.current.get(id)?.remove();
    markersRef.current.delete(id);
    setPlans(prev => prev.map(p =>
      p.id === activePlanId ? { ...p, devices: p.devices.filter(d => d.id !== id) } : p
    ));
    if (selectedDeviceId === id) setSelectedDeviceId(null);
  }

  function duplicateDevice(id: string) {
    const dev = activePlan.devices.find(d => d.id === id);
    if (!dev) return;
    const newDev: PlacedDevice = { ...dev, id: `d-${Date.now()}`, lng: dev.lng + 0.0001, lat: dev.lat + 0.0001, label: dev.label + " (copy)" };
    setPlans(prev => prev.map(p =>
      p.id === activePlanId ? { ...p, devices: [...p.devices, newDev] } : p
    ));
    setSelectedDeviceId(newDev.id);
  }

  // ── BOM generation ───────────────────────────────────────────────────────────
  const bomRows = activePlan.devices.reduce<Record<string, { label: string; proposed: number; existing: number; replace: number; remove: number }>>((acc, d) => {
    const dt = DEVICE_TYPES.find(t => t.key === d.typeKey);
    const key = d.typeKey;
    if (!acc[key]) acc[key] = { label: dt?.label ?? key, proposed: 0, existing: 0, replace: 0, remove: 0 };
    acc[key][d.status]++;
    return acc;
  }, {});

  // ── New plan modal ───────────────────────────────────────────────────────────
  async function createPlan() {
    if (!newPlanName.trim()) return;
    let centerLng = -84.3880, centerLat = 33.7490, zoom = 16;
    if (newPlanAddr.trim()) {
      const geo = await geocodeAddress(newPlanAddr, MAPBOX_TOKEN);
      if (geo) { centerLng = geo.lng; centerLat = geo.lat; zoom = 18; }
    }
    const newPlan: FloorPlanData = {
      id: `plan-${Date.now()}`, name: newPlanName, address: newPlanAddr,
      centerLng, centerLat, zoom, devices: [], connections: [],
    };
    setPlans(prev => [...prev, newPlan]);
    setActivePlanId(newPlan.id);
    setShowNewPlan(false);
    setNewPlanName(""); setNewPlanAddr("");
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#0f172a] text-white overflow-hidden">

      {/* ── Left panel: device library ── */}
      <div className="w-56 flex flex-col border-r border-white/10 bg-[#111827]">
        <div className="p-3 border-b border-white/10">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Devices</div>
          <div className="text-[10px] text-gray-500">
            {addingDevice
              ? <span className="text-orange-400">Click map to place</span>
              : "Select to add to map"}
          </div>
        </div>

        {/* Category tabs */}
        <div className="overflow-y-auto flex-1 p-2 space-y-3">
          {CATEGORIES.map(cat => (
            <div key={cat}>
              <button
                onClick={() => setActiveCategory(cat === activeCategory ? "" : cat)}
                className="w-full flex items-center justify-between text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 py-1 hover:text-white transition-colors"
              >
                <span>{cat}</span>
                {activeCategory === cat ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </button>

              {activeCategory === cat && (
                <div className="mt-1 space-y-0.5">
                  {DEVICE_TYPES.filter(d => d.category === cat).map(dt => (
                    <button
                      key={dt.key}
                      onClick={() => setAddingDevice(addingDevice === dt.key ? null : dt.key)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors text-left ${
                        addingDevice === dt.key
                          ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
                          : "hover:bg-white/5 text-gray-300"
                      }`}
                    >
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

      {/* ── Main map area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Toolbar */}
        <div className="h-12 flex items-center gap-3 px-4 border-b border-white/10 bg-[#111827] flex-shrink-0">
          {/* Plan tabs */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {plans.map(p => (
              <button
                key={p.id}
                onClick={() => setActivePlanId(p.id)}
                className={`px-3 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                  p.id === activePlanId
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                {p.name}
              </button>
            ))}
            <button
              onClick={() => setShowNewPlan(true)}
              className="ml-1 p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="w-px h-6 bg-white/10 mx-1" />

          {/* Address search */}
          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <div className="flex-1 flex items-center bg-white/5 border border-white/10 rounded px-2 py-1 gap-2">
              <Search size={12} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                value={searchAddress}
                onChange={e => setSearchAddress(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleGeocode()}
                placeholder="Jump to address…"
                className="bg-transparent text-xs text-white placeholder-gray-500 outline-none w-full"
              />
            </div>
            <button
              onClick={handleGeocode}
              disabled={geocoding}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs disabled:opacity-50 transition-colors"
            >
              {geocoding ? "…" : "Go"}
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {addingDevice && (
              <div className="flex items-center gap-2 bg-orange-500/20 border border-orange-500/40 rounded px-2 py-1">
                <Crosshair size={12} className="text-orange-400" />
                <span className="text-xs text-orange-400">Click map to place</span>
                <button onClick={() => setAddingDevice(null)} className="text-orange-400 hover:text-orange-200">
                  <X size={12} />
                </button>
              </div>
            )}
            <button
              onClick={() => setShowBOM(!showBOM)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                showBOM ? "bg-blue-600 text-white" : "bg-white/5 hover:bg-white/10 text-gray-300"
              }`}
            >
              <FileText size={12} />
              BOM
            </button>
            <button className="flex items-center gap-1.5 px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-xs text-gray-300 transition-colors">
              <Download size={12} />
              Export
            </button>
          </div>
        </div>

        {/* Map + right panel */}
        <div className="flex-1 flex overflow-hidden">

          {/* Map container */}
          <div className="flex-1 relative">
            {/* Mapbox map */}
            <div ref={mapContainerRef} className="absolute inset-0" />

            {/* No token fallback */}
            {!MAPBOX_TOKEN && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f172a] z-10">
                <MapPin size={48} className="text-blue-500 mb-4 opacity-50" />
                <p className="text-white font-semibold mb-2">Mapbox Token Required</p>
                <p className="text-gray-400 text-sm text-center max-w-xs">
                  Set <code className="bg-white/10 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> in your environment to enable satellite map view.
                </p>
              </div>
            )}

            {/* Cursor mode indicator */}
            {addingDevice && mapReady && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl z-10 pointer-events-none">
                Click anywhere on the map to place device
              </div>
            )}

            {/* Device count badge */}
            {mapReady && (
              <div className="absolute bottom-6 left-4 bg-black/60 backdrop-blur rounded-lg px-3 py-2 text-xs text-gray-300 z-10">
                <span className="font-semibold text-white">{activePlan.devices.length}</span> devices on plan
              </div>
            )}
          </div>

          {/* Right panel: device properties */}
          {selectedDevice && (
            <div className="w-64 border-l border-white/10 bg-[#111827] flex flex-col overflow-y-auto flex-shrink-0">
              <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <span className="text-xs font-semibold text-white truncate">{selectedDevice.label}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => duplicateDevice(selectedDevice.id)} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors" title="Duplicate">
                    <Copy size={12} />
                  </button>
                  <button onClick={() => deleteDevice(selectedDevice.id)} className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition-colors" title="Delete">
                    <Trash2 size={12} />
                  </button>
                  <button onClick={() => setSelectedDeviceId(null)} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors">
                    <X size={12} />
                  </button>
                </div>
              </div>

              <div className="p-3 space-y-3 text-xs">

                {/* Label */}
                <div>
                  <label className="block text-gray-400 mb-1">Label</label>
                  <input
                    type="text"
                    value={selectedDevice.label}
                    onChange={e => updateDevice("label", e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white outline-none focus:border-blue-500"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-gray-400 mb-1">Status</label>
                  <div className="grid grid-cols-2 gap-1">
                    {(Object.entries(STATUS_CONFIG) as [DeviceStatus, any][]).map(([key, sc]) => (
                      <button
                        key={key}
                        onClick={() => updateDevice("status", key)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] border transition-colors ${
                          selectedDevice.status === key
                            ? "border-transparent text-white"
                            : "border-white/10 text-gray-400 hover:border-white/20"
                        }`}
                        style={selectedDevice.status === key ? { background: sc.color } : {}}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ background: sc.color }} />
                        {sc.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* FOV controls (cameras only) */}
                {DEVICE_TYPES.find(t => t.key === selectedDevice.typeKey)?.hasFOV && (
                  <div className="space-y-2.5 border border-white/10 rounded-lg p-2.5 bg-white/3">
                    <div className="flex items-center gap-1 text-gray-400 text-[10px] font-semibold uppercase">
                      <Eye size={10} />
                      Camera Coverage
                    </div>

                    <div>
                      <div className="flex justify-between text-gray-400 mb-1">
                        <span>Bearing</span>
                        <span className="text-white">{selectedDevice.bearing}°</span>
                      </div>
                      <input type="range" min={0} max={359} value={selectedDevice.bearing}
                        onChange={e => updateDevice("bearing", Number(e.target.value))}
                        className="w-full accent-blue-500 h-1"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-gray-400 mb-1">
                        <span>FOV Angle</span>
                        <span className="text-white">{selectedDevice.fovAngle}°</span>
                      </div>
                      <input type="range" min={10} max={180} value={selectedDevice.fovAngle}
                        onChange={e => updateDevice("fovAngle", Number(e.target.value))}
                        className="w-full accent-orange-500 h-1"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-gray-400 mb-1">
                        <span>Range</span>
                        <span className="text-white">{selectedDevice.fovRangeFt} ft</span>
                      </div>
                      <input type="range" min={10} max={300} value={selectedDevice.fovRangeFt}
                        onChange={e => updateDevice("fovRangeFt", Number(e.target.value))}
                        className="w-full accent-green-500 h-1"
                      />
                    </div>
                  </div>
                )}

                {/* GPS coords */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-gray-400 mb-1">Lat</label>
                    <input type="number" step={0.0001} value={selectedDevice.lat.toFixed(6)}
                      onChange={e => updateDevice("lat", parseFloat(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white text-[10px] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-1">Lng</label>
                    <input type="number" step={0.0001} value={selectedDevice.lng.toFixed(6)}
                      onChange={e => updateDevice("lng", parseFloat(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white text-[10px] outline-none"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-gray-400 mb-1">Notes</label>
                  <textarea
                    value={selectedDevice.notes}
                    onChange={e => updateDevice("notes", e.target.value)}
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white outline-none focus:border-blue-500 resize-none text-[11px] leading-relaxed"
                  />
                </div>

              </div>
            </div>
          )}

          {/* BOM panel */}
          {showBOM && (
            <div className="w-72 border-l border-white/10 bg-[#111827] flex flex-col overflow-hidden flex-shrink-0">
              <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Bill of Materials</span>
                <button onClick={() => setShowBOM(false)} className="text-gray-400 hover:text-white">
                  <X size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-gray-400 border-b border-white/10">
                      <th className="text-left pb-1.5">Device</th>
                      <th className="text-center pb-1.5 text-blue-400">Exist</th>
                      <th className="text-center pb-1.5 text-orange-400">New</th>
                      <th className="text-center pb-1.5 text-red-400">Repl</th>
                    </tr>
                  </thead>
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

                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="text-[10px] text-gray-400 mb-1">Total Devices</div>
                  <div className="text-2xl font-bold text-white">{activePlan.devices.length}</div>
                  <div className="grid grid-cols-3 gap-1 mt-2">
                    {(["existing","proposed","replace"] as DeviceStatus[]).map(s => (
                      <div key={s} className="text-center">
                        <div className="text-sm font-semibold" style={{ color: STATUS_CONFIG[s].color }}>
                          {activePlan.devices.filter(d => d.status === s).length}
                        </div>
                        <div className="text-[9px] text-gray-500 capitalize">{s}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <button className="mt-3 w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                  <FileText size={12} />
                  Create Quote from BOM
                </button>
                <button className="mt-2 w-full bg-white/5 hover:bg-white/10 text-gray-300 text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                  <Download size={12} />
                  Export BOM CSV
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
                <input
                  type="text"
                  value={newPlanName}
                  onChange={e => setNewPlanName(e.target.value)}
                  placeholder="e.g. Sunset Commons"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Property Address (optional)</label>
                <input
                  type="text"
                  value={newPlanAddr}
                  onChange={e => setNewPlanAddr(e.target.value)}
                  placeholder="123 Main St, Atlanta, GA"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowNewPlan(false); setNewPlanName(""); setNewPlanAddr(""); }}
                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createPlan}
                disabled={!newPlanName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white font-semibold disabled:opacity-50 transition-colors"
              >
                Create Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
