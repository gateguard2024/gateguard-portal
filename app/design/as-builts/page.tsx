"use client";
import { useState } from "react";
import { Download, FileText } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PlacedDevice = { id: string; typeKey: string; label: string; condition: string; action: string; notes: string; };
type Connection = { id: string; fromId: string; toId: string; cableType: string; lengthFt: number; fromTerminal: string; toTerminal: string; };
type FloorPlanData = { id: string; name: string; level: string; address: string; devices: PlacedDevice[]; connections: Connection[]; };

// ─── Demo Data ────────────────────────────────────────────────────────────────

const DEMO_PLANS: FloorPlanData[] = [
  {
    id: 'plan-1', name: 'Sunset Commons', level: 'Main Entrance',
    address: '4820 Sunset Blvd, Atlanta, GA 30305',
    devices: [
      { id: 'd1', typeKey: 'dk6050',     label: 'Entry Gate - North',  condition: 'Good',         action: 'Keep',    notes: 'DK 6050, installed 2023, serial #DK23-4421' },
      { id: 'd2', typeKey: 'dk6050',     label: 'Exit Gate - North',   condition: 'Fair',         action: 'Service', notes: 'Loop detector intermittent — recommend replace' },
      { id: 'd3', typeKey: 'dk1835',     label: 'Entry Callbox',       condition: 'Good',         action: 'Keep',    notes: 'DK1835 VoIP callbox' },
      { id: 'd4', typeKey: 'brivo_300',  label: 'Brivo ACS300',        condition: 'Good',         action: 'Keep',    notes: 'Controls all entry gates. Panel #A300-8812' },
      { id: 'd5', typeKey: 'camera_lpr', label: 'LPR Camera - Entry',  condition: 'Good',         action: 'Keep',    notes: 'Eagle Eye LPR, coverage: inbound lane' },
      { id: 'd6', typeKey: 'ucg_ultra',  label: 'UCG-Ultra',           condition: 'Good',         action: 'Keep',    notes: 'UniFi gateway. VLAN 10/20/30 configured' },
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
    address: '910 Riverview Dr, Marietta, GA 30067',
    devices: [
      { id: 'r1', typeKey: 'brivo_100',   label: 'Brivo ACS100',       condition: 'Good', action: 'Keep',    notes: '' },
      { id: 'r2', typeKey: 'reader',      label: 'Card Reader',         condition: 'Fair', action: 'Replace', notes: 'Intermittent in rain — quote submitted' },
      { id: 'r3', typeKey: 'mag_lock',    label: 'Pool Gate Mag Lock',  condition: 'Good', action: 'Keep',    notes: '600lb mag lock' },
      { id: 'r4', typeKey: 'camera_dome', label: 'Dome Camera',         condition: 'Good', action: 'Keep',    notes: '' },
    ],
    connections: [
      { id: 'rc1', fromId: 'r1', toId: 'r2', cableType: 'cat6',  lengthFt: 45, fromTerminal: 'Wiegand In', toTerminal: 'Data Out' },
      { id: 'rc2', fromId: 'r1', toId: 'r3', cableType: '2wire', lengthFt: 30, fromTerminal: 'Lock Relay',  toTerminal: '+12V/GND' },
    ],
  },
];

const CONDITION_COLOR: Record<string, string> = { Good: '#10B981', Fair: '#F59E0B', Poor: '#EF4444' };
const ACTION_COLOR: Record<string, string> = { Keep: '#10B981', Service: '#F59E0B', Replace: '#EF4444', 'New Install': '#6B7EFF' };

// ─── Component ────────────────────────────────────────────────────────────────

export default function AsBuiltsPage() {
  const [activePlanId, setActivePlanId] = useState('plan-1');
  const activePlan = DEMO_PLANS.find(p => p.id === activePlanId)!;

  const deviceMap = Object.fromEntries(activePlan.devices.map(d => [d.id, d]));
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const bom = activePlan.devices.reduce<Record<string, number>>((acc, d) => {
    acc[d.label] = (acc[d.label] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* Left panel */}
      <div className="w-52 bg-[#0C111D] flex flex-col h-full shrink-0 border-r border-white/10 p-4 no-print">
        <div className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Floor Plans</div>
        {DEMO_PLANS.map(plan => (
          <button key={plan.id} onClick={() => setActivePlanId(plan.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs mb-1 transition-colors ${activePlanId === plan.id ? 'bg-[#6B7EFF]/20 text-[#6B7EFF]' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
            <div className="font-semibold">{plan.name}</div>
            <div className="text-[10px] opacity-70">{plan.level}</div>
          </button>
        ))}

        <div className="mt-auto pt-4 border-t border-white/10">
          <button onClick={() => window.print()}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[#6B7EFF] text-white rounded-lg text-xs font-semibold hover:bg-[#5a6ee8] transition-colors">
            <Download size={12} /> Print As-Built
          </button>
        </div>
      </div>

      {/* Document preview */}
      <div className="flex-1 overflow-y-auto bg-gray-200 p-8">
        <div className="max-w-4xl mx-auto bg-white shadow-2xl rounded-xl overflow-hidden print-area">
          {/* Header */}
          <div className="bg-[#0B1728] px-8 py-6 flex items-center justify-between">
            <div>
              <div className="text-xl font-black tracking-[0.15em] uppercase text-[#6B7EFF]">NEXUS</div>
              <div className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white/40 mt-0.5">GateGuard As-Built Document</div>
            </div>
            <div className="text-right">
              <div className="text-white font-bold text-sm">{activePlan.name}</div>
              <div className="text-white/60 text-xs">{activePlan.level}</div>
            </div>
          </div>

          <div className="px-8 py-6 space-y-8">
            {/* Property Info */}
            <div>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Property Information</h2>
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 font-semibold text-gray-500 w-40 bg-gray-50">Property</td>
                    <td className="px-4 py-2 text-gray-900">{activePlan.name}</td>
                    <td className="px-4 py-2 font-semibold text-gray-500 w-40 bg-gray-50">Area / Level</td>
                    <td className="px-4 py-2 text-gray-900">{activePlan.level}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 font-semibold text-gray-500 bg-gray-50">Address</td>
                    <td className="px-4 py-2 text-gray-900" colSpan={3}>{activePlan.address}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 font-semibold text-gray-500 bg-gray-50">Date</td>
                    <td className="px-4 py-2 text-gray-900">{today}</td>
                    <td className="px-4 py-2 font-semibold text-gray-500 bg-gray-50">Technician</td>
                    <td className="px-4 py-2 text-gray-900">—</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-semibold text-gray-500 bg-gray-50">GateGuard Contact</td>
                    <td className="px-4 py-2 text-gray-900" colSpan={3}>rfeldman@gateguard.co · (404) 555-0100</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 1: Device Schedule */}
            <div>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Section 1 — Device Schedule</h2>
              <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">#</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Device</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Condition</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Action</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {activePlan.devices.map((dev, i) => (
                    <tr key={dev.id} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                      <td className="px-4 py-2 text-gray-400 font-mono">{String(i + 1).padStart(2, '0')}</td>
                      <td className="px-4 py-2 font-medium text-gray-900">{dev.label}</td>
                      <td className="px-4 py-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white"
                          style={{ background: CONDITION_COLOR[dev.condition] ?? '#94a3b8' }}>
                          {dev.condition}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white"
                          style={{ background: ACTION_COLOR[dev.action] ?? '#94a3b8' }}>
                          {dev.action}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-500">{dev.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Section 2: Wire Schedule */}
            <div>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Section 2 — Wire Schedule</h2>
              <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">#</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">From</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Terminal</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Cable</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Length</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Terminal</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">To</th>
                  </tr>
                </thead>
                <tbody>
                  {activePlan.connections.map((conn, i) => {
                    const from = deviceMap[conn.fromId];
                    const to = deviceMap[conn.toId];
                    return (
                      <tr key={conn.id} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                        <td className="px-4 py-2 text-gray-400 font-mono">{String(i + 1).padStart(2, '0')}</td>
                        <td className="px-4 py-2 font-medium text-gray-900">{from?.label ?? '—'}</td>
                        <td className="px-4 py-2 font-mono text-gray-500 text-[10px]">{conn.fromTerminal || '—'}</td>
                        <td className="px-4 py-2 font-semibold uppercase text-[10px]" style={{ color: '#3B82F6' }}>{conn.cableType}</td>
                        <td className="px-4 py-2 text-gray-500">{conn.lengthFt > 0 ? `${conn.lengthFt} ft` : '—'}</td>
                        <td className="px-4 py-2 font-mono text-gray-500 text-[10px]">{conn.toTerminal || '—'}</td>
                        <td className="px-4 py-2 font-medium text-gray-900">{to?.label ?? '—'}</td>
                      </tr>
                    );
                  })}
                  {activePlan.connections.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-4 text-center text-gray-400">No connections recorded</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Section 3: BOM */}
            <div>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Section 3 — Bill of Materials</h2>
              <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Item</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Qty</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(bom).map(([label, qty], i) => (
                    <tr key={label} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                      <td className="px-4 py-2 font-medium text-gray-900">{label}</td>
                      <td className="px-4 py-2 font-bold text-gray-900">{qty}</td>
                      <td className="px-4 py-2 text-gray-400">ea</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Section 4: Site Notes */}
            <div>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Section 4 — Site Notes</h2>
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 text-sm text-gray-400 italic min-h-[80px]">
                No additional site notes recorded.
              </div>
            </div>

            {/* Signature Block */}
            <div className="border-t border-gray-200 pt-6">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Authorization</h2>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-1">GateGuard Technician</div>
                  <div className="border-b-2 border-gray-300 pb-1 mb-1 h-10" />
                  <div className="text-[10px] text-gray-400">Signature · Date</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-1">Property Manager / Client</div>
                  <div className="border-b-2 border-gray-300 pb-1 mb-1 h-10" />
                  <div className="text-[10px] text-gray-400">Signature · Date</div>
                </div>
              </div>
              <div className="mt-6 text-center text-[10px] text-gray-300">
                GateGuard · portal.gateguard.co · rfeldman@gateguard.co
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-area { box-shadow: none; border-radius: 0; }
        }
      `}</style>
    </div>
  );
}
