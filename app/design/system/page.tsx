"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, Zap, FileText, Plus, Loader2 } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Cpu, Wand2 } = require("lucide-react") as any;
import { EmptyState } from "@/components/ui/EmptyState";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FloorPlan {
  id: string;
  name: string;
  level: string;
  device_count: number;
  connection_count: number;
  updated_at: string;
}

interface PlacedDevice {
  id: string;
  typeKey: string;
  label: string;
  x: number;
  y: number;
  condition: string;
  action: string;
  notes: string;
}

interface Connection {
  id: string;
  fromId: string;
  toId: string;
  cableType: string;
  lengthFt: number;
  fromTerminal: string;
  toTerminal: string;
}

interface ForgeConnection {
  from_device: string;
  from_terminal: string;
  to_device: string;
  to_terminal: string;
  cable_type: string;
  wire_gauge: string;
  length_estimate_ft: number;
  notes: string;
}

interface ForgePowerEntry {
  device: string;
  voltage: string;
  amperage: string;
  source: string;
}

interface ForgeBomAddition {
  item: string;
  qty: number;
  reason: string;
}

interface ForgeResult {
  connections: ForgeConnection[];
  power_summary: ForgePowerEntry[];
  bom_additions: ForgeBomAddition[];
  notes: string;
}

interface LivePlanData {
  devices: PlacedDevice[];
  connections: Connection[];
}

// ─── Static demo data (fallback when no Supabase plan selected) ───────────────

const DEMO_PLANS: FloorPlan[] = [
  { id: "demo-1", name: "Sunset Commons",  level: "Main Entrance", device_count: 6, connection_count: 4, updated_at: new Date().toISOString() },
  { id: "demo-2", name: "Riverview Apts",  level: "Pool Gate",     device_count: 4, connection_count: 2, updated_at: new Date().toISOString() },
];

const DEMO_DEVICES: Record<string, PlacedDevice[]> = {
  "demo-1": [
    { id: "d1", typeKey: "dk6050",    label: "Entry Gate - North",  x: 25, y: 45, condition: "good", action: "keep",    notes: "" },
    { id: "d2", typeKey: "dk6050",    label: "Exit Gate - North",   x: 25, y: 60, condition: "fair", action: "service", notes: "" },
    { id: "d3", typeKey: "dk1835",    label: "Entry Callbox",       x: 18, y: 45, condition: "good", action: "keep",    notes: "" },
    { id: "d4", typeKey: "brivo_300", label: "Brivo ACS300",        x: 75, y: 30, condition: "good", action: "keep",    notes: "" },
    { id: "d5", typeKey: "camera_lpr",label: "LPR Camera - Entry",  x: 12, y: 45, condition: "good", action: "keep",    notes: "" },
    { id: "d6", typeKey: "ucg_ultra", label: "UCG-Ultra",           x: 75, y: 55, condition: "good", action: "keep",    notes: "" },
  ],
  "demo-2": [
    { id: "r1", typeKey: "brivo_100",   label: "Brivo ACS100",       x: 60, y: 35, condition: "good", action: "keep",    notes: "" },
    { id: "r2", typeKey: "reader",      label: "Card Reader",         x: 45, y: 50, condition: "fair", action: "replace", notes: "" },
    { id: "r3", typeKey: "mag_lock",    label: "Pool Gate Mag Lock",  x: 45, y: 65, condition: "good", action: "keep",    notes: "" },
    { id: "r4", typeKey: "camera_dome", label: "Dome Camera",         x: 72, y: 25, condition: "good", action: "keep",    notes: "" },
  ],
};

const DEMO_CONNECTIONS: Record<string, Connection[]> = {
  "demo-1": [
    { id: "c1", fromId: "d4", toId: "d1", cableType: "2wire",  lengthFt: 120, fromTerminal: "Relay 1 COM/NO",  toTerminal: "Open/Common" },
    { id: "c2", fromId: "d4", toId: "d2", cableType: "2wire",  lengthFt: 140, fromTerminal: "Relay 2 COM/NO",  toTerminal: "Open/Common" },
    { id: "c3", fromId: "d3", toId: "d4", cableType: "cat6",   lengthFt: 180, fromTerminal: "LAN Out",          toTerminal: "Wiegand In" },
    { id: "c4", fromId: "d6", toId: "d4", cableType: "cat6",   lengthFt: 25,  fromTerminal: "PoE Port 1",       toTerminal: "LAN In" },
  ],
  "demo-2": [
    { id: "rc1", fromId: "r1", toId: "r2", cableType: "cat6",  lengthFt: 45, fromTerminal: "Wiegand In", toTerminal: "Data Out" },
    { id: "rc2", fromId: "r1", toId: "r3", cableType: "2wire", lengthFt: 30, fromTerminal: "Lock Relay",  toTerminal: "+12V/GND" },
  ],
};

const DEVICE_ICONS: Record<string, string> = {
  dk6050: "🚧", dk9050: "🚧", liftmaster: "🚧",
  camera_bullet: "📷", camera_dome: "🎥", camera_lpr: "🔭",
  brivo_300: "🔐", brivo_100: "🔐", reader: "💳", rex: "🔆",
  dk1835: "📞", g3_intercom: "🔔", keypad: "⌨️",
  ucg_ultra: "🌐", usw_flex: "🔌", ap: "📡",
  loop_det: "⭕", photobeam: "🔦", mag_lock: "🔒", strike: "⚡",
};

const CABLE_COLORS: Record<string, string> = {
  cat6: "#3B82F6", cat5e: "#60A5FA", "2wire": "#F59E0B",
  coax: "#EAB308", fiber: "#7C3AED", ac_power: "#EF4444",
  "4wire": "#10B981", "18gauge": "#F97316",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SystemDesignPage() {
  const [plans, setPlans]                   = useState<FloorPlan[]>(DEMO_PLANS);
  const [activePlanId, setActivePlanId]     = useState<string>("demo-1");
  const [liveData, setLiveData]             = useState<LivePlanData | null>(null);
  const [tab, setTab]                       = useState<"wire" | "io" | "forge">("wire");
  const [loadingPlans, setLoadingPlans]     = useState(true);
  const [loadingPlan, setLoadingPlan]       = useState(false);
  const [forgeLoading, setForgeLoading]     = useState(false);
  const [forgeResult, setForgeResult]       = useState<ForgeResult | null>(null);
  const [forgeError, setForgeError]         = useState<string | null>(null);
  const [applying, setApplying]             = useState(false);
  const [newPlanName, setNewPlanName]       = useState("");
  const [showNewPlan, setShowNewPlan]       = useState(false);
  const [creatingPlan, setCreatingPlan]     = useState(false);

  // ── Fetch plan list ───────────────────────────────────────────────────────
  const fetchPlans = useCallback(async () => {
    setLoadingPlans(true);
    try {
      const res = await fetch("/api/design/plans");
      if (res.ok) {
        const d = await res.json();
        const livePlans: FloorPlan[] = d.plans ?? [];
        if (livePlans.length > 0) {
          setPlans(livePlans);
          setActivePlanId(livePlans[0].id);
        } else {
          setPlans(DEMO_PLANS);
        }
      }
    } catch {
      setPlans(DEMO_PLANS);
    } finally {
      setLoadingPlans(false);
    }
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  // ── Fetch live plan devices + connections ─────────────────────────────────
  const fetchPlanData = useCallback(async (planId: string) => {
    if (planId.startsWith("demo-")) {
      setLiveData(null);
      return;
    }
    setLoadingPlan(true);
    try {
      const res = await fetch(`/api/design/floor-plans/${planId}`);
      if (res.ok) {
        const d = await res.json();
        setLiveData({
          devices:     d.devices ?? [],
          connections: d.connections ?? [],
        });
      } else {
        setLiveData(null);
      }
    } catch {
      setLiveData(null);
    } finally {
      setLoadingPlan(false);
    }
  }, []);

  useEffect(() => {
    setForgeResult(null);
    setForgeError(null);
    fetchPlanData(activePlanId);
  }, [activePlanId, fetchPlanData]);

  // ── Resolve active plan data ──────────────────────────────────────────────
  const isDemo   = activePlanId.startsWith("demo-");
  const devices  = isDemo ? (DEMO_DEVICES[activePlanId] ?? []) : (liveData?.devices ?? []);
  const conns    = isDemo ? (DEMO_CONNECTIONS[activePlanId] ?? []) : (liveData?.connections ?? []);
  const planMeta = plans.find(p => p.id === activePlanId);

  // ── BOM ───────────────────────────────────────────────────────────────────
  const bom = devices.reduce<Record<string, number>>((acc, d) => {
    acc[d.label] = (acc[d.label] ?? 0) + 1;
    return acc;
  }, {});

  // ── I/O diagram layout ────────────────────────────────────────────────────
  const BOX_W  = 180;
  const BOX_H  = 60;
  const COL_GAP = 80;
  const ROW_GAP = 30;
  const COLS   = 3;

  const devicePositions = devices.map((dev, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return {
      id:     dev.id,
      label:  dev.label,
      typeKey: dev.typeKey,
      cx: 40 + col * (BOX_W + COL_GAP) + BOX_W / 2,
      cy: 40 + row * (BOX_H + ROW_GAP) + BOX_H / 2,
      x:  40 + col * (BOX_W + COL_GAP),
      y:  40 + row * (BOX_H + ROW_GAP),
    };
  });

  const svgWidth  = 40 + COLS * (BOX_W + COL_GAP);
  const svgHeight = 40 + Math.ceil(devices.length / COLS) * (BOX_H + ROW_GAP) + 40;

  // ── FORGE ─────────────────────────────────────────────────────────────────
  const runForge = async () => {
    if (!devices.length) return;
    setForgeLoading(true);
    setForgeError(null);
    setForgeResult(null);
    try {
      const res = await fetch("/api/design/forge", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          devices: devices.map(d => ({ id: d.id, name: d.label, type: d.typeKey, location: "" })),
          context: planMeta ? `Floor plan: ${planMeta.name}, ${planMeta.level}` : "",
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        setForgeError(e.error ?? "FORGE returned an error");
        return;
      }
      const d = await res.json();
      setForgeResult(d.result ?? null);
    } catch (err: unknown) {
      setForgeError(err instanceof Error ? err.message : "Network error");
    } finally {
      setForgeLoading(false);
    }
  };

  const applyToFloorPlan = async () => {
    if (!forgeResult || isDemo) return;
    setApplying(true);
    try {
      const newConns = forgeResult.connections.map(fc => ({
        from_device_id: devices.find(d => d.label === fc.from_device)?.id ?? fc.from_device,
        to_device_id:   devices.find(d => d.label === fc.to_device)?.id ?? fc.to_device,
        cable_type:     fc.cable_type,
        from_terminal:  fc.from_terminal,
        to_terminal:    fc.to_terminal,
        length_ft:      fc.length_estimate_ft,
        notes:          fc.notes,
      }));
      await fetch(`/api/design/floor-plans/${activePlanId}/connections`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ connections: newConns }),
      });
      await fetchPlanData(activePlanId);
    } finally {
      setApplying(false);
    }
  };

  const createPlan = async () => {
    if (!newPlanName.trim()) return;
    setCreatingPlan(true);
    try {
      const res = await fetch("/api/design/plans", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: newPlanName.trim(), level: "Level 1" }),
      });
      if (res.ok) {
        const d = await res.json();
        await fetchPlans();
        setActivePlanId(d.plan.id);
        setShowNewPlan(false);
        setNewPlanName("");
      }
    } finally {
      setCreatingPlan(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">

      {/* Left panel — plan list */}
      <div className="w-52 bg-[#0C111D] flex flex-col h-full shrink-0 border-r border-white/10 p-3">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Plans</span>
          <button
            onClick={() => setShowNewPlan(v => !v)}
            className="w-5 h-5 rounded flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            title="New plan"
          >
            <Plus size={12} />
          </button>
        </div>

        {/* New plan input */}
        {showNewPlan && (
          <div className="mb-2 space-y-1">
            <input
              type="text"
              value={newPlanName}
              onChange={e => setNewPlanName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") createPlan(); if (e.key === "Escape") setShowNewPlan(false); }}
              placeholder="Plan name…"
              autoFocus
              className="w-full px-2 py-1.5 rounded bg-white/10 text-white text-xs placeholder-white/30 border border-white/20 focus:outline-none focus:border-[#6B7EFF]/50"
            />
            <button
              onClick={createPlan}
              disabled={creatingPlan || !newPlanName.trim()}
              className="w-full px-2 py-1 rounded text-xs font-semibold bg-[#6B7EFF] text-white hover:bg-[#5a6ee0] disabled:opacity-50 transition-colors"
            >
              {creatingPlan ? "Creating…" : "Create"}
            </button>
          </div>
        )}

        {/* Plan list */}
        {loadingPlans ? (
          <div className="space-y-1">
            {[1,2,3].map(i => <div key={i} className="h-12 rounded-lg bg-white/5 animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-0.5 flex-1 overflow-y-auto">
            {plans.map(plan => (
              <button
                key={plan.id}
                onClick={() => setActivePlanId(plan.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs mb-0.5 transition-colors ${
                  activePlanId === plan.id
                    ? "bg-[#6B7EFF]/20 text-[#6B7EFF] border border-[#6B7EFF]/20"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="font-semibold truncate">{plan.name}</div>
                <div className="text-[10px] opacity-70">{plan.level}</div>
                <div className="text-[9px] opacity-50 mt-0.5">
                  {plan.device_count} devices · {plan.connection_count} connections
                </div>
              </button>
            ))}
          </div>
        )}

        {/* FORGE badge */}
        <div className="mt-auto pt-3 border-t border-white/10">
          <div className="flex items-center gap-1.5 px-2 py-1.5">
            <div className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-black text-white bg-[#0B7285]">FG</div>
            <div>
              <p className="text-[10px] font-bold text-white">FORGE</p>
              <p className="text-[9px] text-white/40">AI System Design</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center gap-4 px-6 shrink-0">
          <div>
            <div className="text-sm font-bold text-gray-900">System Design</div>
            <div className="text-xs text-gray-500">
              {planMeta ? `${planMeta.name} — ${planMeta.level}` : "Select a plan"}
              {isDemo && <span className="ml-2 text-[10px] text-amber-600 font-semibold">(Demo data)</span>}
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5 ml-4">
            {(["wire", "io", "forge"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  tab === t ? "bg-white shadow text-[#6B7EFF]" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t === "wire" && <FileText size={11} />}
                {t === "io"   && <Cpu size={11} />}
                {t === "forge" && <Wand2 size={11} />}
                {t === "wire" ? "Wire Schedule" : t === "io" ? "I/O Diagram" : "FORGE AI"}
                {t === "forge" && <span className="text-[8px] px-1 py-0.5 rounded bg-[#0B7285] text-white font-bold">AI</span>}
              </button>
            ))}
          </div>

          <div className="ml-auto">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6B7EFF] text-white rounded-lg text-xs font-semibold hover:bg-[#5a6ee8] transition-colors"
            >
              <Download size={12} /> Export PDF
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingPlan ? (
            <div className="flex items-center justify-center py-24 text-gray-400">
              <Loader2 size={24} className="animate-spin mr-2" /> Loading plan data…
            </div>
          ) : tab === "wire" ? (
            <WireScheduleTab
              devices={devices}
              connections={conns}
              bom={bom}
            />
          ) : tab === "io" ? (
            <IODiagramTab
              devices={devices}
              connections={conns}
              devicePositions={devicePositions}
              svgWidth={svgWidth}
              svgHeight={svgHeight}
              BOX_W={BOX_W}
              BOX_H={BOX_H}
              bom={bom}
            />
          ) : (
            <FORGETab
              devices={devices}
              forgeLoading={forgeLoading}
              forgeResult={forgeResult}
              forgeError={forgeError}
              applying={applying}
              isDemo={isDemo}
              onRun={runForge}
              onApply={applyToFloorPlan}
            />
          )}
        </div>
      </div>

      <style>{`@media print { .no-print { display: none; } }`}</style>
    </div>
  );
}

// ─── Wire Schedule Tab ────────────────────────────────────────────────────────

function WireScheduleTab({
  devices,
  connections,
  bom,
}: {
  devices: PlacedDevice[];
  connections: Connection[];
  bom: Record<string, number>;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-bold text-gray-900 mb-3">Wire Schedule</h2>
        {connections.length === 0 ? (
          <EmptyState
            icon={<FileText size={24} className="text-gray-400" />}
            title="No connections yet"
            description="Add connections in Floor Plans or run FORGE AI to auto-generate a wire schedule."
          />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {["From Device", "From Terminal", "Cable", "Length", "To Terminal", "To Device"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {connections.map((conn, i) => {
                  const from  = devices.find(d => d.id === conn.fromId);
                  const to    = devices.find(d => d.id === conn.toId);
                  const color = CABLE_COLORS[conn.cableType] ?? "#94a3b8";
                  return (
                    <tr key={conn.id} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                      <td className="px-4 py-2 font-medium text-gray-900">{from?.label ?? "—"}</td>
                      <td className="px-4 py-2 font-mono text-gray-600">{conn.fromTerminal || "—"}</td>
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                          <span className="font-semibold uppercase" style={{ color }}>{conn.cableType}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-gray-600">{conn.lengthFt > 0 ? `${conn.lengthFt} ft` : "—"}</td>
                      <td className="px-4 py-2 font-mono text-gray-600">{conn.toTerminal || "—"}</td>
                      <td className="px-4 py-2 font-medium text-gray-900">{to?.label ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-bold text-gray-900 mb-3">Bill of Materials</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Item</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Qty</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Notes</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(bom).length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">No devices placed</td></tr>
              ) : (
                Object.entries(bom).map(([label, qty], i) => (
                  <tr key={label} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                    <td className="px-4 py-2 font-medium text-gray-900">{label}</td>
                    <td className="px-4 py-2 font-bold text-gray-900">×{qty}</td>
                    <td className="px-4 py-2 text-gray-400">—</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── I/O Diagram Tab ──────────────────────────────────────────────────────────

function IODiagramTab({
  devices,
  connections,
  devicePositions,
  svgWidth,
  svgHeight,
  BOX_W,
  BOX_H,
  bom,
}: {
  devices: PlacedDevice[];
  connections: Connection[];
  devicePositions: Array<{ id: string; label: string; typeKey: string; cx: number; cy: number; x: number; y: number }>;
  svgWidth: number;
  svgHeight: number;
  BOX_W: number;
  BOX_H: number;
  bom: Record<string, number>;
}) {
  if (devices.length === 0) {
    return (
      <EmptyState
        icon={<Zap size={24} className="text-gray-400" />}
        title="No devices in this plan"
        description="Add devices in Floor Plans or run FORGE AI to generate an I/O diagram."
      />
    );
  }

  return (
    <div>
      <h2 className="text-sm font-bold text-gray-900 mb-3">I/O Block Diagram</h2>
      <div className="bg-white rounded-xl border border-gray-200 p-4 overflow-auto">
        <svg width={svgWidth} height={svgHeight} style={{ minWidth: svgWidth }}>
          {connections.map(conn => {
            const fromPos = devicePositions.find(p => p.id === conn.fromId);
            const toPos   = devicePositions.find(p => p.id === conn.toId);
            if (!fromPos || !toPos) return null;
            const color = CABLE_COLORS[conn.cableType] ?? "#94a3b8";
            const mx = (fromPos.cx + toPos.cx) / 2;
            const my = (fromPos.cy + toPos.cy) / 2;
            return (
              <g key={conn.id}>
                <defs>
                  <marker id={`arr-${conn.id}`} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill={color} />
                  </marker>
                </defs>
                <line
                  x1={fromPos.cx} y1={fromPos.cy}
                  x2={toPos.cx}   y2={toPos.cy}
                  stroke={color} strokeWidth="2"
                  strokeDasharray={conn.cableType === "2wire" ? "6,3" : "none"}
                  markerEnd={`url(#arr-${conn.id})`}
                  opacity="0.7"
                />
                <rect x={mx - 22} y={my - 9} width={44} height={18} rx={4} fill="white" stroke={color} strokeWidth="0.5" opacity="0.9" />
                <text x={mx} y={my + 1} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill={color} fontWeight="700" fontFamily="monospace">
                  {conn.cableType}{conn.lengthFt > 0 ? ` ${conn.lengthFt}ft` : ""}
                </text>
              </g>
            );
          })}

          {devicePositions.map(pos => (
            <g key={pos.id}>
              <rect x={pos.x} y={pos.y} width={BOX_W} height={BOX_H} rx={8} fill="white" stroke="#E2E8F0" strokeWidth="1.5" />
              <text x={pos.cx} y={pos.cy - 8} textAnchor="middle" fontSize="20" dominantBaseline="middle">
                {DEVICE_ICONS[pos.typeKey] ?? "⚙️"}
              </text>
              <text x={pos.cx} y={pos.cy + 14} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600" fontFamily="sans-serif">
                {pos.label.length > 22 ? pos.label.slice(0, 21) + "…" : pos.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">Bill of Materials</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Item</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Qty</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(bom).map(([label, qty], i) => (
                <tr key={label} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                  <td className="px-4 py-2 font-medium text-gray-900">{label}</td>
                  <td className="px-4 py-2 font-bold text-gray-900">×{qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── FORGE AI Tab ─────────────────────────────────────────────────────────────

function FORGETab({
  devices,
  forgeLoading,
  forgeResult,
  forgeError,
  applying,
  isDemo,
  onRun,
  onApply,
}: {
  devices: PlacedDevice[];
  forgeLoading: boolean;
  forgeResult: ForgeResult | null;
  forgeError: string | null;
  applying: boolean;
  isDemo: boolean;
  onRun: () => void;
  onApply: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* FORGE header */}
      <div className="bg-[#0C111D] rounded-xl p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#0B7285" }}>
          <Wand2 size={22} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-white tracking-wide">FORGE AI System Design</h2>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#0B7285] text-white font-bold uppercase tracking-wide">AI</span>
          </div>
          <p className="text-xs text-white/60 mt-0.5">
            FORGE analyzes your device list and generates a complete wiring plan — connections, terminals, cable types, and power requirements.
          </p>
        </div>
        <button
          onClick={onRun}
          disabled={forgeLoading || devices.length === 0}
          className="shrink-0 flex items-center gap-2 px-4 py-2 bg-[#6B7EFF] text-white rounded-lg text-sm font-semibold hover:bg-[#5a6ee0] disabled:opacity-50 transition-colors"
        >
          {forgeLoading ? (
            <><Loader2 size={14} className="animate-spin" /> Analyzing…</>
          ) : (
            <><Zap size={14} /> Generate Design</>
          )}
        </button>
      </div>

      {/* Device list */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Devices in this plan ({devices.length})</h3>
        {devices.length === 0 ? (
          <EmptyState
            icon={<Zap size={22} className="text-gray-400" />}
            title="No devices to design for"
            description="Add devices in Floor Plans first, then come back to generate a FORGE design."
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {devices.map(d => (
              <div key={d.id} className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-2 text-xs">
                <span className="text-base">{DEVICE_ICONS[d.typeKey] ?? "⚙️"}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{d.label}</p>
                  <p className="text-gray-400 text-[10px] truncate">{d.typeKey}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Loading state */}
      {forgeLoading && (
        <div className="flex flex-col items-center py-12 text-gray-500">
          <div className="w-12 h-12 rounded-xl bg-[#0B7285]/10 flex items-center justify-center mb-3">
            <Loader2 size={24} className="animate-spin text-[#0B7285]" />
          </div>
          <p className="text-sm font-semibold text-gray-700">FORGE is analyzing your system…</p>
          <p className="text-xs text-gray-400 mt-1">Determining connections, terminals, and power requirements</p>
        </div>
      )}

      {/* Error */}
      {forgeError && !forgeLoading && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          <strong>FORGE error:</strong> {forgeError}
        </div>
      )}

      {/* Results */}
      {forgeResult && !forgeLoading && (
        <div className="space-y-6">
          {/* Connections */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <FileText size={14} className="text-[#6B7EFF]" /> Wire Connections ({forgeResult.connections.length})
            </h3>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {["From", "Terminal", "Cable", "Gauge", "Est. Ft", "Terminal", "To", "Notes"].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {forgeResult.connections.map((c, i) => {
                    const color = CABLE_COLORS[c.cable_type] ?? "#94a3b8";
                    return (
                      <tr key={i} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                        <td className="px-3 py-2 font-medium text-gray-900 max-w-[120px] truncate">{c.from_device}</td>
                        <td className="px-3 py-2 font-mono text-gray-600 text-[10px]">{c.from_terminal}</td>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                            <span className="font-semibold uppercase" style={{ color }}>{c.cable_type}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-500 text-[10px]">{c.wire_gauge}</td>
                        <td className="px-3 py-2 font-mono text-gray-600">{c.length_estimate_ft > 0 ? `${c.length_estimate_ft}` : "—"}</td>
                        <td className="px-3 py-2 font-mono text-gray-600 text-[10px]">{c.to_terminal}</td>
                        <td className="px-3 py-2 font-medium text-gray-900 max-w-[120px] truncate">{c.to_device}</td>
                        <td className="px-3 py-2 text-gray-400 text-[10px] max-w-[140px] truncate" title={c.notes}>{c.notes || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Power summary */}
          {forgeResult.power_summary.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Zap size={14} className="text-amber-500" /> Power Summary
              </h3>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {["Device", "Voltage", "Amperage", "Power Source"].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {forgeResult.power_summary.map((p, i) => (
                      <tr key={i} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                        <td className="px-4 py-2 font-medium text-gray-900">{p.device}</td>
                        <td className="px-4 py-2 font-mono text-gray-700">{p.voltage}</td>
                        <td className="px-4 py-2 font-mono text-gray-700">{p.amperage}</td>
                        <td className="px-4 py-2 text-gray-600">{p.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* BOM additions */}
          {forgeResult.bom_additions.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-3">Additional Materials Recommended</h3>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {["Item", "Qty", "Why it&apos;s needed"].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-semibold text-gray-600" dangerouslySetInnerHTML={{ __html: h }} />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {forgeResult.bom_additions.map((b, i) => (
                      <tr key={i} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                        <td className="px-4 py-2 font-medium text-gray-900">{b.item}</td>
                        <td className="px-4 py-2 font-bold text-gray-900">×{b.qty}</td>
                        <td className="px-4 py-2 text-gray-600">{b.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* FORGE notes */}
          {forgeResult.notes && (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">FORGE Notes</h3>
              <p className="text-sm text-blue-800">{forgeResult.notes}</p>
            </div>
          )}

          {/* Apply button */}
          {!isDemo && (
            <div className="flex items-center justify-end gap-3 pt-2">
              <p className="text-xs text-gray-400">Apply this design to the floor plan&apos;s connection list</p>
              <button
                onClick={onApply}
                disabled={applying}
                className="flex items-center gap-2 px-4 py-2 bg-[#6B7EFF] text-white rounded-lg text-sm font-semibold hover:bg-[#5a6ee0] disabled:opacity-50 transition-colors"
              >
                {applying ? <><Loader2 size={14} className="animate-spin" /> Applying…</> : "Apply to Floor Plan"}
              </button>
            </div>
          )}
          {isDemo && (
            <p className="text-xs text-amber-600 text-right">Demo plan — save a real floor plan to apply FORGE connections.</p>
          )}
        </div>
      )}
    </div>
  );
}
