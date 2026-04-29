"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  Filter,
  Camera,
  Shield,
  DoorOpen,
  Cpu,
  Wifi,
  Pencil,
  X,
  SlidersHorizontal,
  ChevronRight,
  MapPin,
  User,
  CheckCircle2,
  Clock,
  FileText,
  Download,
  ArrowRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SurveyType = "Gate Install" | "Camera System" | "Full Site" | "Access Control";
type SurveyStatus = "Draft" | "In Progress" | "Completed" | "Linked to Quote";

interface Survey {
  id: string;
  property: string;
  type: SurveyType;
  status: SurveyStatus;
  tech: string;
  date: string;
  deviceCount: number;
}

type DeviceTool = "Select" | "Camera" | "Gate" | "Door" | "Panel" | "Network" | "Label" | "Eraser";

interface PlacedDevice {
  id: string;
  type: "Camera" | "Gate" | "Panel" | "Network";
  model: string;
  position: string;
  status: "Placed" | "Confirmed";
  top: number;
  left: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const SURVEYS: Survey[] = [
  { id: "s1", property: "Camden Crossing Apts",  type: "Full Site",      status: "In Progress",     tech: "Danny Cruz",   date: "Apr 28", deviceCount: 14 },
  { id: "s2", property: "Maple Ridge HOA",        type: "Gate Install",   status: "Completed",       tech: "Marcus Webb",  date: "Apr 26", deviceCount: 6  },
  { id: "s3", property: "Harbor View Phase 2",    type: "Camera System",  status: "Linked to Quote", tech: "RF",           date: "Apr 24", deviceCount: 12 },
  { id: "s4", property: "Northgate Plaza",        type: "Access Control", status: "Completed",       tech: "Danny Cruz",   date: "Apr 22", deviceCount: 8  },
  { id: "s5", property: "Sunrise Gardens",        type: "Full Site",      status: "Draft",           tech: "Unassigned",   date: "Apr 20", deviceCount: 0  },
  { id: "s6", property: "Willow Creek HOA",       type: "Gate Install",   status: "Linked to Quote", tech: "Marcus Webb",  date: "Apr 18", deviceCount: 5  },
  { id: "s7", property: "Summit Ridge Apts",      type: "Camera System",  status: "Completed",       tech: "RF",           date: "Apr 15", deviceCount: 10 },
  { id: "s8", property: "Cedar Park HOA",         type: "Full Site",      status: "In Progress",     tech: "Danny Cruz",   date: "Apr 12", deviceCount: 7  },
];

const PLACED_DEVICES: PlacedDevice[] = [
  { id: "CAM-01", type: "Camera",  model: "EagleEye 4MP Dome",        position: "Entrance / Lobby",    status: "Confirmed", top: 28,  left: 42  },
  { id: "CAM-02", type: "Camera",  model: "EagleEye 4MP Dome",        position: "Parking Lot North",   status: "Confirmed", top: 62,  left: 18  },
  { id: "CAM-03", type: "Camera",  model: "EagleEye 4MP Dome",        position: "Building A - Entry",  status: "Placed",    top: 38,  left: 70  },
  { id: "CAM-04", type: "Camera",  model: "EagleEye 4MP Dome",        position: "Building B - Entry",  status: "Placed",    top: 55,  left: 72  },
  { id: "CAM-05", type: "Camera",  model: "EagleEye 4MP Dome",        position: "Rear Perimeter",      status: "Placed",    top: 72,  left: 55  },
  { id: "CAM-06", type: "Camera",  model: "EagleEye 4MP Dome",        position: "Pool / Amenity Area", status: "Placed",    top: 48,  left: 30  },
  { id: "GATE-01", type: "Gate",   model: "BX-10 Slide Gate Ctrl",    position: "Main Entrance Gate",  status: "Confirmed", top: 18,  left: 48  },
  { id: "GATE-02", type: "Gate",   model: "BX-10 Slide Gate Ctrl",    position: "Rear Exit Gate",      status: "Placed",    top: 78,  left: 48  },
  { id: "NVR-01",  type: "Panel",  model: "GG-NVR-8 Network Panel",   position: "Building A - MDF",    status: "Confirmed", top: 42,  left: 58  },
  { id: "NET-01",  type: "Network", model: "Ubiquiti AP Pro",         position: "Building A - Roof",   status: "Placed",    top: 30,  left: 62  },
  { id: "NET-02",  type: "Network", model: "Ubiquiti AP Pro",         position: "Building B - Roof",   status: "Placed",    top: 50,  left: 65  },
];

const TOOLS: { id: DeviceTool; label: string; Icon: React.ElementType }[] = [
  { id: "Select",  label: "Select",  Icon: SlidersHorizontal },
  { id: "Camera",  label: "Camera",  Icon: Camera           },
  { id: "Gate",    label: "Gate",    Icon: Shield           },
  { id: "Door",    label: "Door",    Icon: DoorOpen         },
  { id: "Panel",   label: "Panel",   Icon: Cpu              },
  { id: "Network", label: "Network", Icon: Wifi             },
  { id: "Label",   label: "Label",   Icon: Pencil           },
  { id: "Eraser",  label: "Eraser",  Icon: X                },
];

const STATUS_FILTERS = ["All", "Draft", "In Progress", "Completed", "Linked to Quote"] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function surveyTypeBadge(type: SurveyType) {
  const map: Record<SurveyType, string> = {
    "Gate Install":    "bg-purple-50  text-purple-700  border border-purple-200",
    "Camera System":  "bg-sky-50     text-sky-700     border border-sky-200",
    "Full Site":      "bg-orange-50  text-orange-700  border border-orange-200",
    "Access Control": "bg-teal-50    text-teal-700    border border-teal-200",
  };
  return map[type];
}

function statusBadge(status: SurveyStatus) {
  const map: Record<SurveyStatus, string> = {
    "Draft":           "bg-gray-100   text-gray-600",
    "In Progress":     "bg-amber-100  text-amber-700",
    "Completed":       "bg-emerald-100 text-emerald-700",
    "Linked to Quote": "bg-blue-100   text-blue-700",
  };
  return map[status];
}

function statusIcon(status: SurveyStatus) {
  if (status === "Draft")           return <Clock size={11} />;
  if (status === "In Progress")     return <Clock size={11} />;
  if (status === "Completed")       return <CheckCircle2 size={11} />;
  if (status === "Linked to Quote") return <FileText size={11} />;
}

function deviceIcon(type: PlacedDevice["type"], size = 18) {
  if (type === "Camera")  return <Camera  size={size} className="text-blue-600"   />;
  if (type === "Gate")    return <Shield  size={size} className="text-emerald-600" />;
  if (type === "Panel")   return <Cpu     size={size} className="text-slate-500"   />;
  if (type === "Network") return <Wifi    size={size} className="text-indigo-500"  />;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SurveyPage() {
  const [activeTool, setActiveTool]     = useState<DeviceTool>("Camera");
  const [activeStatus, setActiveStatus] = useState<typeof STATUS_FILTERS[number]>("All");
  const [selectedSurvey, setSelectedSurvey] = useState<Survey>(SURVEYS[0]);
  const [zoom, setZoom] = useState(100);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = SURVEYS.filter((s) => {
    const matchStatus = activeStatus === "All" || s.status === activeStatus;
    const matchSearch = s.property.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="flex flex-col min-h-full bg-gray-50">

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Site Surveys</h1>
          <p className="text-sm text-gray-500 mt-0.5">Design systems and generate quotes from property sketches</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <FileText size={14} /> Templates
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
            <Plus size={14} /> New Survey
          </button>
        </div>
      </div>

      {/* ── Stats Row ────────────────────────────────────────────────────────── */}
      <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center gap-6">
        {[
          { label: "Total Surveys",     value: "34",  sub: "",                        valueClass: "text-gray-900" },
          { label: "Open / In Progress", value: "8",  sub: "active",                  valueClass: "text-amber-600" },
          { label: "Linked to Quotes",  value: "26",  sub: "quotes generated",        valueClass: "text-blue-600"  },
          { label: "Devices Placed",    value: "312", sub: "across all surveys",      valueClass: "text-gray-900" },
        ].map(({ label, value, sub, valueClass }) => (
          <div key={label} className="flex items-baseline gap-2">
            <span className={cn("text-2xl font-semibold tabular-nums", valueClass)}>{value}</span>
            <div>
              <p className="text-xs font-medium text-gray-700 leading-none">{label}</p>
              {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
            </div>
            <div className="h-6 w-px bg-gray-200 ml-2" />
          </div>
        ))}
      </div>

      {/* ── Two-Panel Layout ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 160px)" }}>

        {/* Left Panel — Survey List */}
        <div className="w-[35%] min-w-[300px] bg-white border-r border-gray-200 flex flex-col overflow-hidden">

          {/* Search + Filter */}
          <div className="p-3 border-b border-gray-100 space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search surveys..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-gray-50"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveStatus(f)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                    activeStatus === f
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Survey Cards */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filtered.map((survey) => (
              <button
                key={survey.id}
                onClick={() => setSelectedSurvey(survey)}
                className={cn(
                  "w-full text-left px-3 py-3 hover:bg-blue-50/50 transition-colors group",
                  selectedSurvey.id === survey.id && "bg-blue-50 border-r-2 border-r-blue-600"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{survey.property}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium", surveyTypeBadge(survey.type))}>
                        {survey.type}
                      </span>
                      <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium", statusBadge(survey.status))}>
                        {statusIcon(survey.status)}
                        {survey.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-[11px] text-gray-500">
                        <User size={10} /> {survey.tech}
                      </span>
                      <span className="text-[11px] text-gray-400">{survey.date}</span>
                      <span className="flex items-center gap-1 text-[11px] text-gray-500">
                        <MapPin size={10} />
                        {survey.deviceCount === 0 ? "No devices" : `${survey.deviceCount} devices`}
                      </span>
                    </div>
                  </div>
                  <button className={cn(
                    "shrink-0 px-2 py-1 rounded text-[11px] font-medium transition-colors",
                    selectedSurvey.id === survey.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-700"
                  )}>
                    Open
                  </button>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel — Drawing Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Canvas Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <span>Site Surveys</span>
                <ChevronRight size={13} />
                <span className="font-medium text-gray-900">{selectedSurvey.property}</span>
                <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ml-1", statusBadge(selectedSurvey.status))}>
                  {statusIcon(selectedSurvey.status)}
                  {selectedSurvey.status}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <User size={12} />{selectedSurvey.tech}
              <span className="text-gray-300">·</span>
              {selectedSurvey.date}
            </div>
          </div>

          {/* Toolbar */}
          <div className="bg-white border-b border-gray-200 px-3 py-2 flex items-center gap-1">
            {/* Tool Buttons */}
            {TOOLS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTool(id)}
                title={label}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  activeTool === id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <Icon size={13} />
                {id === activeTool && <span>{label}</span>}
              </button>
            ))}

            <div className="flex-1" />

            {/* Zoom */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-1 py-1">
              <button
                onClick={() => setZoom((z) => Math.max(50, z - 10))}
                className="w-6 h-6 flex items-center justify-center rounded text-gray-600 hover:bg-white text-sm font-medium transition-colors"
              >−</button>
              <span className="text-xs text-gray-600 font-medium w-10 text-center tabular-nums">{zoom}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(200, z + 10))}
                className="w-6 h-6 flex items-center justify-center rounded text-gray-600 hover:bg-white text-sm font-medium transition-colors"
              >+</button>
            </div>

            <div className="w-px h-5 bg-gray-200 mx-1" />

            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <Download size={12} /> Export PDF
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors shadow-sm">
              <FileText size={12} /> Link to Quote
            </button>
          </div>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">

            {/* Canvas Area */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div
                className="relative bg-gray-100 overflow-hidden cursor-crosshair select-none"
                style={{
                  height: "420px",
                  backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 39px, #e5e7eb 39px, #e5e7eb 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, #e5e7eb 39px, #e5e7eb 40px)",
                  backgroundSize: "40px 40px",
                }}
              >
                {/* Property outline — main complex footprint */}
                <div
                  className="absolute border-2 border-gray-400 rounded-sm bg-gray-50/60"
                  style={{ top: "8%", left: "8%", right: "8%", bottom: "8%" }}
                />

                {/* Parking lot */}
                <div
                  className="absolute bg-gray-200/70 border border-gray-300 rounded-sm"
                  style={{ top: "55%", left: "10%", width: "28%", height: "30%" }}
                >
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-gray-500 font-medium whitespace-nowrap">PARKING</span>
                </div>

                {/* Building A */}
                <div
                  className="absolute bg-white border-2 border-gray-400 rounded-sm flex items-center justify-center"
                  style={{ top: "20%", left: "20%", width: "30%", height: "30%" }}
                >
                  <span className="text-[11px] text-gray-500 font-semibold tracking-wide">BUILDING A</span>
                </div>

                {/* Building B */}
                <div
                  className="absolute bg-white border-2 border-gray-400 rounded-sm flex items-center justify-center"
                  style={{ top: "20%", left: "58%", width: "25%", height: "30%" }}
                >
                  <span className="text-[11px] text-gray-500 font-semibold tracking-wide">BUILDING B</span>
                </div>

                {/* Entrance gap label */}
                <div
                  className="absolute flex flex-col items-center"
                  style={{ top: "2%", left: "43%", transform: "translateX(-50%)" }}
                >
                  <span className="text-[9px] text-gray-500 font-medium bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">ENTRANCE</span>
                  <div className="w-px h-3 bg-amber-400 mt-0.5" />
                </div>

                {/* Hint text */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-[11px] text-gray-300 font-medium">Click canvas to place {activeTool} device</span>
                </div>

                {/* Placed Devices */}
                {PLACED_DEVICES.map((device) => (
                  <div
                    key={device.id}
                    className="absolute group"
                    style={{ top: `${device.top}%`, left: `${device.left}%`, transform: "translate(-50%, -50%)" }}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center shadow-md border-2 transition-transform group-hover:scale-110",
                      device.type === "Camera"  && "bg-white border-blue-400",
                      device.type === "Gate"    && "bg-white border-emerald-400",
                      device.type === "Panel"   && "bg-white border-slate-400",
                      device.type === "Network" && "bg-white border-indigo-400",
                    )}>
                      {deviceIcon(device.type, 13)}
                    </div>
                    <div className={cn(
                      "absolute left-full ml-1 top-1/2 -translate-y-1/2 whitespace-nowrap",
                      "bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[9px] font-bold shadow-sm text-gray-700",
                    )}>
                      {device.id}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Placed Devices Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">Placed Devices</h3>
                  <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">{PLACED_DEVICES.length}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {["Device #", "Type", "Model", "Position", "Status"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {PLACED_DEVICES.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className="font-mono font-semibold text-gray-800">{d.id}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-1.5 text-gray-700">
                            {deviceIcon(d.type, 12)}
                            {d.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{d.model}</td>
                        <td className="px-4 py-2.5 text-gray-600">{d.position}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                            d.status === "Confirmed" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                          )}>
                            {d.status === "Confirmed" ? <CheckCircle2 size={9} /> : <Clock size={9} />}
                            {d.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* BOM Preview Strip */}
            <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-blue-100 bg-blue-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-blue-600" />
                  <h3 className="text-sm font-semibold text-gray-900">Auto-generated BOM</h3>
                  <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">9 devices</span>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors shadow-sm">
                  Add to Quote <ArrowRight size={12} />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {["SKU", "Product", "Qty", "Unit Price", "Subtotal"].map((h) => (
                        <th key={h} className="text-left px-4 py-2 text-gray-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[
                      { sku: "GG-EE4MD",   product: "EagleEye 4MP Dome",       qty: 6, unit: 249,  total: 1494 },
                      { sku: "GG-BX10",    product: "BX-10 Slide Gate Controller", qty: 2, unit: 895, total: 1790 },
                      { sku: "GG-NVR-8",   product: "GG-NVR-8 Network Panel",  qty: 1, unit: 1199, total: 1199 },
                    ].map((row) => (
                      <tr key={row.sku} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-gray-500">{row.sku}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-800">{row.product}</td>
                        <td className="px-4 py-2.5 text-gray-600 tabular-nums">×{row.qty}</td>
                        <td className="px-4 py-2.5 text-gray-600 tabular-nums">${row.unit.toLocaleString()}</td>
                        <td className="px-4 py-2.5 font-semibold text-gray-800 tabular-nums">${row.total.toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 border-t border-gray-200">
                      <td colSpan={4} className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700">Hardware Total</td>
                      <td className="px-4 py-2.5 font-bold text-gray-900 tabular-nums">$4,483</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
