"use client";
import { useState } from "react";
import { Download, FileText, Zap } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PlacedDevice = { id: string; typeKey: string; label: string; x: number; y: number; condition: string; action: string; notes: string; };
type Connection = { id: string; fromId: string; toId: string; cableType: string; lengthFt: number; fromTerminal: string; toTerminal: string; };
type FloorPlanData = { id: string; name: string; level: string; devices: PlacedDevice[]; connections: Connection[]; };

// ─── Demo Data ────────────────────────────────────────────────────────────────

const DEMO_PLANS: FloorPlanData[] = [
  {
    id: 'plan-1', name: 'Sunset Commons', level: 'Main Entrance',
    devices: [
      { id: 'd1', typeKey: 'dk6050',     label: 'Entry Gate - North',  x: 25, y: 45, condition: 'good', action: 'keep',    notes: 'DK 6050, installed 2023' },
      { id: 'd2', typeKey: 'dk6050',     label: 'Exit Gate - North',   x: 25, y: 60, condition: 'fair', action: 'service', notes: 'Loop detector intermittent' },
      { id: 'd3', typeKey: 'dk1835',     label: 'Entry Callbox',       x: 18, y: 45, condition: 'good', action: 'keep',    notes: '' },
      { id: 'd4', typeKey: 'brivo_300',  label: 'Brivo ACS300',        x: 75, y: 30, condition: 'good', action: 'keep',    notes: 'Controls all entry gates' },
      { id: 'd5', typeKey: 'camera_lpr', label: 'LPR Camera - Entry',  x: 12, y: 45, condition: 'good', action: 'keep',    notes: '' },
      { id: 'd6', typeKey: 'ucg_ultra',  label: 'UCG-Ultra',           x: 75, y: 55, condition: 'good', action: 'keep',    notes: 'UniFi gateway' },
    ],
    connections: [
      { id: 'c1', fromId: 'd4', toId: 'd1', cableType: '2wire',  lengthFt: 120, fromTerminal: 'Relay 1 COM/NO',  toTerminal: 'Open/Common' },
      { id: 'c2', fromId: 'd4', toId: 'd2', cableType: '2wire',  lengthFt: 140, fromTerminal: 'Relay 2 COM/NO',  toTerminal: 'Open/Common' },
      { id: 'c3', fromId: 'd3', toId: 'd4', cableType: 'cat6',   lengthFt: 180, fromTerminal: 'LAN Out',          toTerminal: 'Wiegand In' },
      { id: 'c4', fromId: 'd6', toId: 'd4', cableType: 'cat6',   lengthFt: 25,  fromTerminal: 'PoE Port 1',       toTerminal: 'LAN In' },
    ],
  },
  {
    id: 'plan-2', name: 'Riverview Apts', level: 'Pool Gate',
    devices: [
      { id: 'r1', typeKey: 'brivo_100',   label: 'Brivo ACS100',       x: 60, y: 35, condition: 'good', action: 'keep',    notes: '' },
      { id: 'r2', typeKey: 'reader',      label: 'Card Reader',         x: 45, y: 50, condition: 'fair', action: 'replace', notes: 'Intermittent in rain' },
      { id: 'r3', typeKey: 'mag_lock',    label: 'Pool Gate Mag Lock',  x: 45, y: 65, condition: 'good', action: 'keep',    notes: '600lb mag lock' },
      { id: 'r4', typeKey: 'camera_dome', label: 'Dome Camera',         x: 72, y: 25, condition: 'good', action: 'keep',    notes: '' },
    ],
    connections: [
      { id: 'rc1', fromId: 'r1', toId: 'r2', cableType: 'cat6',  lengthFt: 45, fromTerminal: 'Wiegand In', toTerminal: 'Data Out' },
      { id: 'rc2', fromId: 'r1', toId: 'r3', cableType: '2wire', lengthFt: 30, fromTerminal: 'Lock Relay',  toTerminal: '+12V/GND' },
    ],
  },
];

const DEVICE_ICONS: Record<string, string> = {
  dk6050: '🚧', dk9050: '🚧', liftmaster: '🚧',
  camera_bullet: '📷', camera_dome: '🎥', camera_lpr: '🔭',
  brivo_300: '🔐', brivo_100: '🔐', reader: '💳', rex: '🔆',
  dk1835: '📞', g3_intercom: '🔔', keypad: '⌨️',
  ucg_ultra: '🌐', usw_flex: '🔌', ap: '📡',
  loop_det: '⭕', photobeam: '🔦', mag_lock: '🔒', strike: '⚡',
};

const CABLE_COLORS: Record<string, string> = {
  cat6: '#3B82F6', cat5e: '#60A5FA', '2wire': '#F59E0B',
  coax: '#EAB308', fiber: '#7C3AED', ac_power: '#EF4444',
  '4wire': '#10B981', '18gauge': '#F97316',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SystemDesignPage() {
  const [activePlanId, setActivePlanId] = useState('plan-1');
  const [tab, setTab] = useState<'wire'|'io'>('wire');

  const activePlan = DEMO_PLANS.find(p => p.id === activePlanId)!;

  // BOM
  const bom = activePlan.devices.reduce<Record<string, number>>((acc, d) => {
    acc[d.label] = (acc[d.label] ?? 0) + 1;
    return acc;
  }, {});

  // Auto-layout boxes for I/O diagram: 3 columns
  const BOX_W = 180;
  const BOX_H = 60;
  const COL_GAP = 80;
  const ROW_GAP = 30;
  const COLS = 3;

  const devicePositions = activePlan.devices.map((dev, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return {
      id: dev.id,
      label: dev.label,
      typeKey: dev.typeKey,
      cx: 40 + col * (BOX_W + COL_GAP) + BOX_W / 2,
      cy: 40 + row * (BOX_H + ROW_GAP) + BOX_H / 2,
      x: 40 + col * (BOX_W + COL_GAP),
      y: 40 + row * (BOX_H + ROW_GAP),
    };
  });

  const svgWidth = 40 + COLS * (BOX_W + COL_GAP);
  const svgHeight = 40 + Math.ceil(activePlan.devices.length / COLS) * (BOX_H + ROW_GAP) + 40;

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* Left panel */}
      <div className="w-52 bg-[#0C111D] flex flex-col h-full shrink-0 border-r border-white/10 p-4">
        <div className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Plans</div>
        {DEMO_PLANS.map(plan => (
          <button key={plan.id} onClick={() => setActivePlanId(plan.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs mb-1 transition-colors ${activePlanId === plan.id ? 'bg-[#6B7EFF]/20 text-[#6B7EFF]' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
            <div className="font-semibold">{plan.name}</div>
            <div className="text-[10px] opacity-70">{plan.level}</div>
          </button>
        ))}
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center gap-4 px-6 shrink-0">
          <div>
            <div className="text-sm font-bold text-gray-900">System Design</div>
            <div className="text-xs text-gray-500">{activePlan.name} — {activePlan.level}</div>
          </div>
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5 ml-4">
            <button onClick={() => setTab('wire')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${tab === 'wire' ? 'bg-white shadow text-[#6B7EFF]' : 'text-gray-500 hover:text-gray-700'}`}>
              Wire Schedule
            </button>
            <button onClick={() => setTab('io')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${tab === 'io' ? 'bg-white shadow text-[#6B7EFF]' : 'text-gray-500 hover:text-gray-700'}`}>
              I/O Diagram
            </button>
          </div>
          <div className="ml-auto">
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6B7EFF] text-white rounded-lg text-xs font-semibold hover:bg-[#5a6ee8] transition-colors">
              <Download size={12} /> Export PDF
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'wire' ? (
            <div className="space-y-6">
              {/* Wire Schedule Table */}
              <div>
                <h2 className="text-sm font-bold text-gray-900 mb-3">Wire Schedule</h2>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600">From Device</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600">From Terminal</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Cable</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Length</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600">To Terminal</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600">To Device</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePlan.connections.map((conn, i) => {
                        const from = activePlan.devices.find(d => d.id === conn.fromId);
                        const to = activePlan.devices.find(d => d.id === conn.toId);
                        const color = CABLE_COLORS[conn.cableType] ?? '#94a3b8';
                        return (
                          <tr key={conn.id} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                            <td className="px-4 py-2 font-medium text-gray-900">{from?.label ?? '—'}</td>
                            <td className="px-4 py-2 font-mono text-gray-600">{conn.fromTerminal || '—'}</td>
                            <td className="px-4 py-2">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                                <span className="font-semibold uppercase" style={{ color }}>{conn.cableType}</span>
                              </span>
                            </td>
                            <td className="px-4 py-2 font-mono text-gray-600">{conn.lengthFt > 0 ? `${conn.lengthFt} ft` : '—'}</td>
                            <td className="px-4 py-2 font-mono text-gray-600">{conn.toTerminal || '—'}</td>
                            <td className="px-4 py-2 font-medium text-gray-900">{to?.label ?? '—'}</td>
                          </tr>
                        );
                      })}
                      {activePlan.connections.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No connections defined</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* BOM */}
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
                      {Object.entries(bom).map(([label, qty], i) => (
                        <tr key={label} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                          <td className="px-4 py-2 font-medium text-gray-900">{label}</td>
                          <td className="px-4 py-2 font-bold text-gray-900">×{qty}</td>
                          <td className="px-4 py-2 text-gray-400">—</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* I/O Diagram */
            <div>
              <h2 className="text-sm font-bold text-gray-900 mb-3">I/O Block Diagram</h2>
              <div className="bg-white rounded-xl border border-gray-200 p-4 overflow-auto">
                <svg width={svgWidth} height={svgHeight} style={{ minWidth: svgWidth }}>
                  {/* Connection arrows */}
                  {activePlan.connections.map(conn => {
                    const fromPos = devicePositions.find(p => p.id === conn.fromId);
                    const toPos = devicePositions.find(p => p.id === conn.toId);
                    if (!fromPos || !toPos) return null;
                    const color = CABLE_COLORS[conn.cableType] ?? '#94a3b8';
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
                          x2={toPos.cx} y2={toPos.cy}
                          stroke={color} strokeWidth="2"
                          strokeDasharray={conn.cableType === '2wire' ? '6,3' : 'none'}
                          markerEnd={`url(#arr-${conn.id})`}
                          opacity="0.7"
                        />
                        <rect x={mx - 22} y={my - 9} width={44} height={18} rx={4} fill="white" stroke={color} strokeWidth="0.5" opacity="0.9" />
                        <text x={mx} y={my + 1} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill={color} fontWeight="700" fontFamily="monospace">
                          {conn.cableType}{conn.lengthFt > 0 ? ` ${conn.lengthFt}ft` : ''}
                        </text>
                      </g>
                    );
                  })}

                  {/* Device boxes */}
                  {devicePositions.map(pos => (
                    <g key={pos.id}>
                      <rect x={pos.x} y={pos.y} width={BOX_W} height={BOX_H} rx={8} fill="white" stroke="#E2E8F0" strokeWidth="1.5" />
                      <text x={pos.cx} y={pos.cy - 8} textAnchor="middle" fontSize="20" dominantBaseline="middle">
                        {DEVICE_ICONS[pos.typeKey] ?? '⚙️'}
                      </text>
                      <text x={pos.cx} y={pos.cy + 14} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600" fontFamily="sans-serif">
                        {pos.label.length > 22 ? pos.label.slice(0, 21) + '…' : pos.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>

              {/* BOM below */}
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
                        <tr key={label} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                          <td className="px-4 py-2 font-medium text-gray-900">{label}</td>
                          <td className="px-4 py-2 font-bold text-gray-900">×{qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@media print { .no-print { display: none; } }`}</style>
    </div>
  );
}
