"use client";
import { useState, useRef } from "react";
import { Plus, X, Download, Trash2 } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Ruler, PenTool, MousePointer } = require("lucide-react") as any;

// ─── Types ────────────────────────────────────────────────────────────────────

type DeviceType = { key: string; label: string; icon: string; color: string; category: string; };
type PlacedDevice = { id: string; typeKey: string; label: string; x: number; y: number; condition: 'good'|'fair'|'poor'|'new_install'; action: 'keep'|'service'|'replace'|'new_install'; notes: string; };
type Connection = { id: string; fromId: string; toId: string; cableType: string; lengthFt: number; fromTerminal: string; toTerminal: string; };
type Annotation = { id: string; type: 'text'|'rect'|'arrow'; x: number; y: number; x2?: number; y2?: number; text?: string; color: string; };
type FloorPlanData = { id: string; name: string; level: string; devices: PlacedDevice[]; connections: Connection[]; annotations: Annotation[]; };

// ─── Device Library ───────────────────────────────────────────────────────────

const DEVICE_TYPES: DeviceType[] = [
  { key: 'dk6050',       label: 'DK 6050 Gate Op',    icon: '🚧', color: '#F59E0B', category: 'Gate Operators' },
  { key: 'dk9050',       label: 'DK 9050 Gate Op',    icon: '🚧', color: '#F59E0B', category: 'Gate Operators' },
  { key: 'liftmaster',   label: 'LiftMaster SL3000',  icon: '🚧', color: '#F59E0B', category: 'Gate Operators' },
  { key: 'camera_bullet',label: 'Bullet Camera',       icon: '📷', color: '#3B82F6', category: 'Cameras' },
  { key: 'camera_dome',  label: 'Dome Camera',         icon: '🎥', color: '#3B82F6', category: 'Cameras' },
  { key: 'camera_lpr',   label: 'LPR Camera',          icon: '🔭', color: '#6366F1', category: 'Cameras' },
  { key: 'brivo_300',    label: 'Brivo ACS300',        icon: '🔐', color: '#10B981', category: 'Access Control' },
  { key: 'brivo_100',    label: 'Brivo ACS100',        icon: '🔐', color: '#10B981', category: 'Access Control' },
  { key: 'reader',       label: 'Card Reader',         icon: '💳', color: '#10B981', category: 'Access Control' },
  { key: 'rex',          label: 'REX Sensor',          icon: '🔆', color: '#10B981', category: 'Access Control' },
  { key: 'dk1835',       label: 'DK1835 Callbox',      icon: '📞', color: '#8B5CF6', category: 'Entry Systems' },
  { key: 'g3_intercom',  label: 'UniFi G3 Intercom',  icon: '🔔', color: '#8B5CF6', category: 'Entry Systems' },
  { key: 'keypad',       label: 'Keypad',              icon: '⌨️', color: '#8B5CF6', category: 'Entry Systems' },
  { key: 'ucg_ultra',   label: 'UCG-Ultra',           icon: '🌐', color: '#0891B2', category: 'Networking' },
  { key: 'usw_flex',    label: 'USW-Flex',            icon: '🔌', color: '#0891B2', category: 'Networking' },
  { key: 'ap',          label: 'Access Point',        icon: '📡', color: '#0891B2', category: 'Networking' },
  { key: 'loop_det',    label: 'Loop Detector',       icon: '⭕', color: '#EF4444', category: 'Sensors' },
  { key: 'photobeam',   label: 'Photobeam',           icon: '🔦', color: '#EF4444', category: 'Sensors' },
  { key: 'mag_lock',    label: 'Mag Lock',            icon: '🔒', color: '#64748B', category: 'Locks' },
  { key: 'strike',      label: 'Electric Strike',     icon: '⚡', color: '#64748B', category: 'Locks' },
];

// ─── Demo Data ────────────────────────────────────────────────────────────────

const DEMO_PLANS: FloorPlanData[] = [
  {
    id: 'plan-1', name: 'Sunset Commons', level: 'Main Entrance',
    devices: [
      { id: 'd1', typeKey: 'dk6050',      label: 'Entry Gate - North',  x: 25, y: 45, condition: 'good', action: 'keep',    notes: 'DK 6050, installed 2023' },
      { id: 'd2', typeKey: 'dk6050',      label: 'Exit Gate - North',   x: 25, y: 60, condition: 'fair', action: 'service', notes: 'Loop detector intermittent' },
      { id: 'd3', typeKey: 'dk1835',      label: 'Entry Callbox',       x: 18, y: 45, condition: 'good', action: 'keep',    notes: '' },
      { id: 'd4', typeKey: 'brivo_300',   label: 'Brivo ACS300',        x: 75, y: 30, condition: 'good', action: 'keep',    notes: 'Controls all entry gates' },
      { id: 'd5', typeKey: 'camera_lpr',  label: 'LPR Camera - Entry',  x: 12, y: 45, condition: 'good', action: 'keep',    notes: '' },
      { id: 'd6', typeKey: 'ucg_ultra',  label: 'UCG-Ultra',           x: 75, y: 55, condition: 'good', action: 'keep',    notes: 'UniFi gateway' },
    ],
    connections: [
      { id: 'c1', fromId: 'd4', toId: 'd1', cableType: '2wire',  lengthFt: 120, fromTerminal: 'Relay 1 COM/NO',  toTerminal: 'Open/Common' },
      { id: 'c2', fromId: 'd4', toId: 'd2', cableType: '2wire',  lengthFt: 140, fromTerminal: 'Relay 2 COM/NO',  toTerminal: 'Open/Common' },
      { id: 'c3', fromId: 'd3', toId: 'd4', cableType: 'cat6',   lengthFt: 180, fromTerminal: 'LAN Out',          toTerminal: 'Wiegand In' },
      { id: 'c4', fromId: 'd6', toId: 'd4', cableType: 'cat6',   lengthFt: 25,  fromTerminal: 'PoE Port 1',       toTerminal: 'LAN In' },
    ],
    annotations: [],
  },
  {
    id: 'plan-2', name: 'Riverview Apts', level: 'Pool Gate',
    devices: [
      { id: 'r1', typeKey: 'brivo_100',  label: 'Brivo ACS100',        x: 60, y: 35, condition: 'good', action: 'keep',    notes: '' },
      { id: 'r2', typeKey: 'reader',     label: 'Card Reader',          x: 45, y: 50, condition: 'fair', action: 'replace', notes: 'Intermittent in rain' },
      { id: 'r3', typeKey: 'mag_lock',   label: 'Pool Gate Mag Lock',   x: 45, y: 65, condition: 'good', action: 'keep',    notes: '600lb mag lock' },
      { id: 'r4', typeKey: 'camera_dome',label: 'Dome Camera',          x: 72, y: 25, condition: 'good', action: 'keep',    notes: '' },
    ],
    connections: [
      { id: 'rc1', fromId: 'r1', toId: 'r2', cableType: 'cat6',  lengthFt: 45, fromTerminal: 'Wiegand In', toTerminal: 'Data Out' },
      { id: 'rc2', fromId: 'r1', toId: 'r3', cableType: '2wire', lengthFt: 30, fromTerminal: 'Lock Relay',  toTerminal: '+12V/GND' },
    ],
    annotations: [],
  },
];

const CABLE_COLORS: Record<string, string> = {
  cat6: '#3B82F6', cat5e: '#60A5FA', '2wire': '#F59E0B',
  coax: '#EAB308', fiber: '#7C3AED', ac_power: '#EF4444',
  '4wire': '#10B981', '18gauge': '#F97316',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function FloorPlansPage() {
  const [plans, setPlans] = useState<FloorPlanData[]>(DEMO_PLANS);
  const [activePlanId, setActivePlanId] = useState('plan-1');
  const [mode, setMode] = useState<'survey'|'design'|'markup'>('survey');
  const [selectedDeviceTypeKey, setSelectedDeviceTypeKey] = useState<string|null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string|null>(null);
  const [connectingFromId, setConnectingFromId] = useState<string|null>(null);
  const [pendingConnection, setPendingConnection] = useState<{fromId:string;toId:string}|null>(null);
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [connForm, setConnForm] = useState({ cableType: 'cat6', lengthFt: 0, fromTerminal: '', toTerminal: '' });
  const [showNewPlanForm, setShowNewPlanForm] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanLevel, setNewPlanLevel] = useState('');
  const [showAnnotationInput, setShowAnnotationInput] = useState(false);
  const [annotText, setAnnotText] = useState('');
  const [annotPos, setAnnotPos] = useState({x:0,y:0});
  const [draggingDeviceId, setDraggingDeviceId] = useState<string|null>(null);
  const [dragOffset, setDragOffset] = useState({dx:0,dy:0});
  const canvasRef = useRef<HTMLDivElement>(null);

  const activePlan = plans.find(p => p.id === activePlanId)!;
  const selectedDevice = activePlan?.devices.find(d => d.id === selectedDeviceId) ?? null;

  function getDeviceType(typeKey: string) {
    return DEVICE_TYPES.find(t => t.key === typeKey);
  }

  const bom = activePlan?.devices.reduce<Record<string, number>>((acc, d) => {
    const dt = getDeviceType(d.typeKey);
    const label = dt?.label ?? d.typeKey;
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {}) ?? {};

  function updateActivePlan(fn: (plan: FloorPlanData) => FloorPlanData) {
    setPlans(prev => prev.map(p => p.id === activePlanId ? fn(p) : p));
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!canvasRef.current) return;
    if (draggingDeviceId) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    if (mode === 'survey' && selectedDeviceTypeKey) {
      const dt = getDeviceType(selectedDeviceTypeKey);
      const newDevice: PlacedDevice = {
        id: `d-${Date.now()}`, typeKey: selectedDeviceTypeKey,
        label: dt?.label ?? 'New Device',
        x: xPct, y: yPct,
        condition: 'new_install', action: 'new_install', notes: '',
      };
      updateActivePlan(p => ({ ...p, devices: [...p.devices, newDevice] }));
      setSelectedDeviceId(newDevice.id);
    } else if (mode === 'markup') {
      setAnnotPos({ x: xPct, y: yPct });
      setShowAnnotationInput(true);
    } else if (mode === 'survey') {
      setSelectedDeviceId(null);
    }
  }

  function handleDeviceClick(e: React.MouseEvent, deviceId: string) {
    e.stopPropagation();
    if (draggingDeviceId) return;
    if (mode === 'design') {
      if (!connectingFromId) {
        setConnectingFromId(deviceId);
      } else if (connectingFromId !== deviceId) {
        setPendingConnection({ fromId: connectingFromId, toId: deviceId });
        setShowConnectionForm(true);
        setConnectingFromId(null);
      }
    } else {
      setSelectedDeviceId(deviceId === selectedDeviceId ? null : deviceId);
    }
  }

  function addConnection() {
    if (!pendingConnection) return;
    const conn: Connection = {
      id: `conn-${Date.now()}`,
      fromId: pendingConnection.fromId,
      toId: pendingConnection.toId,
      ...connForm,
    };
    updateActivePlan(p => ({ ...p, connections: [...p.connections, conn] }));
    setShowConnectionForm(false);
    setPendingConnection(null);
    setConnForm({ cableType: 'cat6', lengthFt: 0, fromTerminal: '', toTerminal: '' });
  }

  function handleDeviceMouseDown(e: React.MouseEvent, deviceId: string) {
    if (mode !== 'survey') return;
    e.stopPropagation();
    e.preventDefault();
    setDraggingDeviceId(deviceId);
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const device = activePlan.devices.find(d => d.id === deviceId)!;
      const deviceX = (device.x / 100) * rect.width;
      const deviceY = (device.y / 100) * rect.height;
      setDragOffset({ dx: e.clientX - rect.left - deviceX, dy: e.clientY - rect.top - deviceY });
    }
    setSelectedDeviceId(deviceId);
  }

  function handleCanvasMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!draggingDeviceId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const xPct = Math.max(2, Math.min(98, ((e.clientX - rect.left - dragOffset.dx) / rect.width) * 100));
    const yPct = Math.max(2, Math.min(98, ((e.clientY - rect.top - dragOffset.dy) / rect.height) * 100));
    updateActivePlan(p => ({
      ...p,
      devices: p.devices.map(d => d.id === draggingDeviceId ? { ...d, x: xPct, y: yPct } : d),
    }));
  }

  function handleCanvasMouseUp() {
    setDraggingDeviceId(null);
  }

  const categories = Array.from(new Set(DEVICE_TYPES.map(d => d.category)));

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* Left Panel */}
      <div className="w-56 bg-[#0C111D] flex flex-col h-full shrink-0 border-r border-white/10">
        <div className="p-4 border-b border-white/10">
          <div className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Floor Plans</div>
          {plans.map(plan => (
            <button key={plan.id} onClick={() => { setActivePlanId(plan.id); setSelectedDeviceId(null); setConnectingFromId(null); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs mb-1 transition-colors ${activePlanId === plan.id ? 'bg-[#6B7EFF]/20 text-[#6B7EFF]' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
              <div className="font-semibold">{plan.name}</div>
              <div className="text-[10px] opacity-70">{plan.level}</div>
            </button>
          ))}
          <button onClick={() => setShowNewPlanForm(true)}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/40 hover:text-white/70 text-xs mt-1 border border-dashed border-white/20 hover:border-white/40 transition-colors">
            <Plus size={10} /> New Plan
          </button>
        </div>

        {mode === 'survey' && (
          <div className="flex-1 overflow-y-auto p-3">
            <div className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Device Library</div>
            {categories.map(cat => (
              <div key={cat} className="mb-3">
                <div className="text-[9px] font-bold text-white/25 uppercase tracking-wider px-1 mb-1">{cat}</div>
                {DEVICE_TYPES.filter(d => d.category === cat).map(dt => (
                  <button key={dt.key} onClick={() => setSelectedDeviceTypeKey(selectedDeviceTypeKey === dt.key ? null : dt.key)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs mb-0.5 transition-colors text-left ${selectedDeviceTypeKey === dt.key ? 'bg-[#6B7EFF]/20 text-[#6B7EFF]' : 'text-white/60 hover:text-white/90 hover:bg-white/5'}`}>
                    <span className="text-sm">{dt.icon}</span>
                    <span className="truncate">{dt.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {mode === 'design' && (
          <div className="flex-1 overflow-y-auto p-3">
            <div className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Placed Devices</div>
            {activePlan.devices.map(d => {
              const dt = getDeviceType(d.typeKey);
              return (
                <button key={d.id} onClick={() => setConnectingFromId(connectingFromId === d.id ? null : d.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs mb-0.5 transition-colors text-left ${connectingFromId === d.id ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40' : 'text-white/60 hover:text-white/90 hover:bg-white/5'}`}>
                  <span>{dt?.icon}</span>
                  <span className="truncate">{d.label}</span>
                </button>
              );
            })}
            {connectingFromId && (
              <div className="mt-3 p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-[10px] text-blue-400">
                Click another device on the canvas to draw a connection
              </div>
            )}
          </div>
        )}

        {mode === 'markup' && (
          <div className="flex-1 p-3">
            <div className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Markup Tools</div>
            <div className="space-y-1">
              {([['✏️','Text Note'],['➡️','Arrow'],['▭','Rectangle'],['☁️','Cloud Callout'],['📏','Measurement']] as const).map(([icon,label]) => (
                <button key={label} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-white/60 hover:text-white/90 hover:bg-white/5 text-left">
                  <span>{icon}</span><span>{label}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 text-[10px] text-white/30">Click on the canvas to place text annotations</div>
          </div>
        )}
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top toolbar */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center gap-4 px-6 shrink-0">
          <div>
            <div className="text-sm font-bold text-gray-900">{activePlan?.name}</div>
            <div className="text-xs text-gray-500">{activePlan?.level}</div>
          </div>

          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
            {([['survey','📍 Survey'],['design','⚡ Design'],['markup','✏️ Markup']] as const).map(([m,label]) => (
              <button key={m} onClick={() => { setMode(m); setSelectedDeviceTypeKey(null); setConnectingFromId(null); }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${mode === m ? 'bg-white shadow text-[#6B7EFF]' : 'text-gray-500 hover:text-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>

          {mode === 'survey' && selectedDeviceTypeKey && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6B7EFF]/10 rounded-lg text-xs text-[#6B7EFF] font-medium">
              <span>{getDeviceType(selectedDeviceTypeKey)?.icon}</span>
              Click canvas to place {getDeviceType(selectedDeviceTypeKey)?.label}
              <button onClick={() => setSelectedDeviceTypeKey(null)} className="ml-1 text-[#6B7EFF]/60 hover:text-[#6B7EFF]"><X size={12} /></button>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-500">{activePlan?.devices.length} devices · {activePlan?.connections.length} connections</span>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6B7EFF] text-white rounded-lg text-xs font-semibold hover:bg-[#5a6ee8] transition-colors" onClick={() => window.print()}>
              <Download size={12} /> Export PDF
            </button>
          </div>
        </div>

        {/* Canvas + Right Panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Canvas */}
          <div className="flex-1 relative overflow-hidden bg-[#F1F5F9] p-4">
            <div
              ref={canvasRef}
              className="relative w-full h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
              style={{
                minHeight: '600px',
                backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                cursor: mode === 'survey' && selectedDeviceTypeKey ? 'crosshair' : 'default',
              }}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
            >
              <div className="absolute top-3 left-3 text-xs font-mono text-gray-300 select-none">
                {activePlan?.name} — {activePlan?.level}
              </div>

              {/* SVG layer */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{zIndex: 1}}>
                <defs>
                  <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#6B7EFF" />
                  </marker>
                </defs>

                {activePlan?.connections.map(conn => {
                  const fromDev = activePlan.devices.find(d => d.id === conn.fromId);
                  const toDev = activePlan.devices.find(d => d.id === conn.toId);
                  if (!fromDev || !toDev) return null;
                  const color = CABLE_COLORS[conn.cableType] ?? '#94a3b8';
                  const mx = (fromDev.x + toDev.x) / 2;
                  const my = (fromDev.y + toDev.y) / 2;
                  return (
                    <g key={conn.id}>
                      <line
                        x1={`${fromDev.x}%`} y1={`${fromDev.y}%`}
                        x2={`${toDev.x}%`} y2={`${toDev.y}%`}
                        stroke={color} strokeWidth="2"
                        strokeDasharray={conn.cableType === '2wire' ? '6,3' : conn.cableType === 'fiber' ? '2,3' : 'none'}
                        opacity="0.8"
                      />
                      <rect x={`${mx - 2}%`} y={`${my - 1.5}%`} width="4%" height="3%" fill="white" rx="3" opacity="0.85" />
                      <text x={`${mx}%`} y={`${my + 0.5}%`} textAnchor="middle" dominantBaseline="middle"
                        fontSize="9" fill={color} fontWeight="600" fontFamily="monospace">
                        {conn.cableType} {conn.lengthFt > 0 ? `${conn.lengthFt}ft` : ''}
                      </text>
                    </g>
                  );
                })}

                {activePlan?.annotations.map(ann => ann.type === 'text' && (
                  <g key={ann.id}>
                    <text x={`${ann.x}%`} y={`${ann.y}%`} fill={ann.color} fontSize="11" fontWeight="600">{ann.text}</text>
                  </g>
                ))}
              </svg>

              {/* Device icons */}
              {activePlan?.devices.map(device => {
                const dt = getDeviceType(device.typeKey);
                const condColor = device.condition === 'good' ? '#10B981' : device.condition === 'fair' ? '#F59E0B' : device.condition === 'poor' ? '#EF4444' : '#6B7EFF';
                const isSelected = selectedDeviceId === device.id;
                const isConnecting = connectingFromId === device.id;
                return (
                  <div
                    key={device.id}
                    style={{ left: `${device.x}%`, top: `${device.y}%`, zIndex: 2, transform: 'translate(-50%, -50%)' }}
                    className="absolute"
                    onClick={(e) => handleDeviceClick(e, device.id)}
                    onMouseDown={(e) => handleDeviceMouseDown(e, device.id)}
                  >
                    <div className={`flex flex-col items-center gap-0.5 cursor-pointer group ${draggingDeviceId === device.id ? 'opacity-70' : ''}`}>
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-md border-2 transition-all select-none
                          ${isSelected ? 'border-[#6B7EFF] ring-2 ring-[#6B7EFF]/30 scale-110' : ''}
                          ${isConnecting ? 'border-blue-400 ring-2 ring-blue-400/40 scale-110' : ''}
                          ${!isSelected && !isConnecting ? 'border-white group-hover:border-gray-300' : ''}
                        `}
                        style={{ background: (dt?.color ?? '#6B7EFF') + '18', borderColor: isSelected ? '#6B7EFF' : isConnecting ? '#60A5FA' : condColor }}
                      >
                        <span className="leading-none">{dt?.icon ?? '⚙️'}</span>
                      </div>
                      <div className="bg-white rounded-md px-1.5 py-0.5 text-[9px] font-semibold text-gray-700 shadow-sm border border-gray-100 max-w-[80px] truncate text-center leading-tight">
                        {device.label}
                      </div>
                      <div className="w-2 h-2 rounded-full border border-white" style={{ background: condColor }} />
                    </div>
                  </div>
                );
              })}

              {activePlan?.devices.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <div className="text-4xl mb-3">🏗️</div>
                    <div className="text-sm font-semibold text-gray-400">Select a device from the library</div>
                    <div className="text-xs text-gray-300 mt-1">then click anywhere on the canvas to place it</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel */}
          <div className="w-64 bg-white border-l border-gray-200 flex flex-col overflow-hidden shrink-0">
            {selectedDevice && mode === 'survey' ? (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">{getDeviceType(selectedDevice.typeKey)?.icon}</span>
                  <div>
                    <div className="text-xs font-bold text-gray-900">{getDeviceType(selectedDevice.typeKey)?.label}</div>
                    <div className="text-[10px] text-gray-500">{selectedDevice.typeKey}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Label</label>
                    <input
                      value={selectedDevice.label}
                      onChange={e => updateActivePlan(p => ({ ...p, devices: p.devices.map(d => d.id === selectedDevice.id ? { ...d, label: e.target.value } : d) }))}
                      className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Condition</label>
                    <div className="grid grid-cols-2 gap-1">
                      {(['good','fair','poor','new_install'] as const).map(c => (
                        <button key={c} onClick={() => updateActivePlan(p => ({ ...p, devices: p.devices.map(d => d.id === selectedDevice.id ? { ...d, condition: c } : d) }))}
                          className={`py-1 rounded-lg text-[10px] font-semibold capitalize transition-colors ${selectedDevice.condition === c ? 'bg-[#6B7EFF] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                          {c === 'new_install' ? 'New' : c}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Action</label>
                    <div className="grid grid-cols-2 gap-1">
                      {(['keep','service','replace','new_install'] as const).map(a => (
                        <button key={a} onClick={() => updateActivePlan(p => ({ ...p, devices: p.devices.map(d => d.id === selectedDevice.id ? { ...d, action: a } : d) }))}
                          className={`py-1 rounded-lg text-[10px] font-semibold capitalize transition-colors ${selectedDevice.action === a ? 'bg-[#6B7EFF] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                          {a === 'new_install' ? 'New Install' : a}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Notes</label>
                    <textarea
                      value={selectedDevice.notes} rows={3}
                      onChange={e => updateActivePlan(p => ({ ...p, devices: p.devices.map(d => d.id === selectedDevice.id ? { ...d, notes: e.target.value } : d) }))}
                      className="w-full text-xs border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                    />
                  </div>

                  <button
                    onClick={() => {
                      updateActivePlan(p => ({
                        ...p,
                        devices: p.devices.filter(d => d.id !== selectedDevice.id),
                        connections: p.connections.filter(c => c.fromId !== selectedDevice.id && c.toId !== selectedDevice.id),
                      }));
                      setSelectedDeviceId(null);
                    }}
                    className="w-full py-1.5 rounded-lg text-xs text-red-600 bg-red-50 hover:bg-red-100 font-semibold transition-colors flex items-center justify-center gap-1"
                  >
                    <Trash2 size={11} /> Remove Device
                  </button>
                </div>
              </div>
            ) : mode === 'design' ? (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="text-xs font-bold text-gray-700 mb-3">Wire Schedule</div>
                <div className="space-y-2">
                  {activePlan.connections.map(conn => {
                    const from = activePlan.devices.find(d => d.id === conn.fromId);
                    const to = activePlan.devices.find(d => d.id === conn.toId);
                    const color = CABLE_COLORS[conn.cableType] ?? '#94a3b8';
                    return (
                      <div key={conn.id} className="p-2 bg-gray-50 rounded-lg border border-gray-100 text-[10px]">
                        <div className="flex items-center gap-1 mb-1">
                          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                          <span className="font-bold uppercase" style={{ color }}>{conn.cableType}</span>
                          {conn.lengthFt > 0 && <span className="text-gray-400">· {conn.lengthFt}ft</span>}
                          <button onClick={() => updateActivePlan(p => ({ ...p, connections: p.connections.filter(c => c.id !== conn.id) }))} className="ml-auto text-gray-300 hover:text-red-400"><X size={10} /></button>
                        </div>
                        <div className="text-gray-600 truncate">{from?.label} → {to?.label}</div>
                        {conn.fromTerminal && <div className="text-gray-400">{conn.fromTerminal} → {conn.toTerminal}</div>}
                      </div>
                    );
                  })}
                  {activePlan.connections.length === 0 && <div className="text-xs text-gray-400">Click devices on the canvas to draw connections</div>}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="text-xs font-bold text-gray-700 mb-3">Bill of Materials</div>
                {Object.entries(bom).length === 0 ? (
                  <div className="text-xs text-gray-400">Place devices to generate BOM</div>
                ) : (
                  <div className="space-y-1.5">
                    {Object.entries(bom).map(([label, qty]) => (
                      <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                        <span className="text-xs text-gray-700">{label}</span>
                        <span className="text-xs font-bold text-gray-900">×{qty}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="p-4 border-t border-gray-100 space-y-2">
              <button onClick={() => window.print()} className="w-full py-2 bg-[#6B7EFF] text-white rounded-lg text-xs font-semibold hover:bg-[#5a6ee8] transition-colors">
                Export As-Built PDF
              </button>
              <button className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-colors">
                Share Link
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Connection Form Modal */}
      {showConnectionForm && pendingConnection && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-5 w-80">
            <div className="text-sm font-bold text-gray-900 mb-4">Add Connection</div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Cable Type</label>
                <select value={connForm.cableType} onChange={e => setConnForm(f => ({...f, cableType: e.target.value}))}
                  className="w-full h-9 text-sm border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]">
                  {Object.keys(CABLE_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Estimated Length (ft)</label>
                <input type="number" value={connForm.lengthFt} onChange={e => setConnForm(f => ({...f, lengthFt: +e.target.value}))}
                  className="w-full h-9 text-sm border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">From Terminal</label>
                <input value={connForm.fromTerminal} onChange={e => setConnForm(f => ({...f, fromTerminal: e.target.value}))} placeholder="e.g. Relay 1 COM/NO"
                  className="w-full h-9 text-sm border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">To Terminal</label>
                <input value={connForm.toTerminal} onChange={e => setConnForm(f => ({...f, toTerminal: e.target.value}))} placeholder="e.g. Open/Common"
                  className="w-full h-9 text-sm border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowConnectionForm(false); setPendingConnection(null); }} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-200">Cancel</button>
              <button onClick={addConnection} className="flex-1 py-2 bg-[#6B7EFF] rounded-lg text-sm font-semibold text-white hover:bg-[#5a6ee8]">Add Connection</button>
            </div>
          </div>
        </div>
      )}

      {/* Annotation input */}
      {showAnnotationInput && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-4 w-64">
            <div className="text-sm font-bold mb-2">Add Annotation</div>
            <input
              autoFocus value={annotText} onChange={e => setAnnotText(e.target.value)} placeholder="Type annotation text..."
              onKeyDown={e => {
                if (e.key === 'Enter' && annotText) {
                  const ann: Annotation = { id: `ann-${Date.now()}`, type: 'text', x: annotPos.x, y: annotPos.y, text: annotText, color: '#EF4444' };
                  updateActivePlan(p => ({ ...p, annotations: [...p.annotations, ann] }));
                  setAnnotText(''); setShowAnnotationInput(false);
                }
              }}
              className="w-full h-9 text-sm border border-gray-200 rounded-lg px-2 mb-3 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowAnnotationInput(false); setAnnotText(''); }} className="flex-1 py-1.5 bg-gray-100 rounded-lg text-xs font-semibold text-gray-700">Cancel</button>
              <button onClick={() => {
                if (!annotText) return;
                const ann: Annotation = { id: `ann-${Date.now()}`, type: 'text', x: annotPos.x, y: annotPos.y, text: annotText, color: '#EF4444' };
                updateActivePlan(p => ({ ...p, annotations: [...p.annotations, ann] }));
                setAnnotText(''); setShowAnnotationInput(false);
              }} className="flex-1 py-1.5 bg-[#6B7EFF] rounded-lg text-xs font-semibold text-white">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* New Plan form */}
      {showNewPlanForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-5 w-72">
            <div className="text-sm font-bold mb-3">New Floor Plan</div>
            <div className="space-y-2 mb-4">
              <input placeholder="Property name (e.g. Oak Village)" value={newPlanName} onChange={e => setNewPlanName(e.target.value)}
                className="w-full h-9 text-sm border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]" />
              <input placeholder="Level / Area (e.g. Main Entrance)" value={newPlanLevel} onChange={e => setNewPlanLevel(e.target.value)}
                className="w-full h-9 text-sm border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNewPlanForm(false)} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm font-semibold text-gray-700">Cancel</button>
              <button onClick={() => {
                if (!newPlanName) return;
                const np: FloorPlanData = { id: `plan-${Date.now()}`, name: newPlanName, level: newPlanLevel || 'Level 1', devices: [], connections: [], annotations: [] };
                setPlans(p => [...p, np]); setActivePlanId(np.id); setNewPlanName(''); setNewPlanLevel(''); setShowNewPlanForm(false);
              }} className="flex-1 py-2 bg-[#6B7EFF] rounded-lg text-sm font-semibold text-white">Create</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@media print { body * { visibility: hidden; } .print-area, .print-area * { visibility: visible; } }`}</style>
    </div>
  );
}
