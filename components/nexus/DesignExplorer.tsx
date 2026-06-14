'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Check,
  Plus,
  FileText,
  Download,
  Layers,
  ChevronRight,
  MapPin,
  Clock,
  Activity,
} from 'lucide-react';
// Vercel lucide cache quirk — load these via require()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowLeft, History, Camera, PenTool } = require('lucide-react') as any;
// --- Data Types ---
type Stage = 'floor_plan' | 'system_design' | 'as_built';
type StageStatus = 'done' | 'in_progress' | 'not_started';
type StageState = {
  stage: Stage;
  status: StageStatus;
  version: number;
  updated_by?: string;
  updated_at?: string;
};
type DesignRecord = {
  id: string;
  property_name: string;
  address?: string | null;
  current_stage: Stage;
  stages: StageState[]; // always 3, in order: floor_plan, system_design, as_built
  device_counts: { type: string; count: number }[];
  bom: { name: string; qty: number }[];
  device_total: number;
  plan_versions: number;
  last_updated: string;
  activity: { at: string; text: string }[];
};
// --- Data: real API with mock fallback ---
const loadDesigns = async (): Promise<DesignRecord[]> => {
  try {
    const res = await fetch('/api/nexus/design', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.records)) return json.records as DesignRecord[];
    }
  } catch {
    /* fall through to preview */
  }
  return mockDesigns();
};
const mockDesigns = async (): Promise<DesignRecord[]> => {
  const now = Date.now();
  const minsAgo = (m: number) => new Date(now - m * 60000).toISOString();
  const daysAgo = (d: number) => new Date(now - d * 86400000).toISOString();
  return [
    {
      id: 'des-1', property_name: 'Avalon Heights', address: '123 Heights Blvd, Cityville', current_stage: 'as_built',
      stages: [
        { stage: 'floor_plan', status: 'done', version: 3, updated_by: 'Sarah J.', updated_at: daysAgo(30) },
        { stage: 'system_design', status: 'done', version: 5, updated_by: 'Mike T.', updated_at: daysAgo(15) },
        { stage: 'as_built', status: 'done', version: 1, updated_by: 'Alex R.', updated_at: daysAgo(2) },
      ],
      device_counts: [{ type: 'Cameras', count: 12 }, { type: 'Readers', count: 8 }, { type: 'Intercoms', count: 2 }, { type: 'NVR/Switches', count: 3 }],
      bom: [{ name: 'Hikvision 4K Dome Camera', qty: 12 }, { name: 'HID Signo Reader 40', qty: 8 }, { name: 'ButterflyMX 8" Surface Mount', qty: 2 }, { name: 'UniFi 24-Port PoE Switch', qty: 2 }, { name: 'NVR 16-Channel 8TB', qty: 1 }],
      device_total: 25, plan_versions: 9, last_updated: daysAgo(2),
      activity: [{ at: daysAgo(2), text: 'As-Built v1 approved by Alex R.' }, { at: daysAgo(4), text: 'System Design promoted to As-Built' }, { at: daysAgo(15), text: 'System Design v5 saved by Mike T.' }],
    },
    {
      id: 'des-2', property_name: 'The Beacon', address: '789 Harbor Drive, Portside', current_stage: 'system_design',
      stages: [
        { stage: 'floor_plan', status: 'done', version: 2, updated_by: 'Sarah J.', updated_at: daysAgo(10) },
        { stage: 'system_design', status: 'in_progress', version: 2, updated_by: 'Mike T.', updated_at: minsAgo(45) },
        { stage: 'as_built', status: 'not_started', version: 0 },
      ],
      device_counts: [{ type: 'Cameras', count: 6 }, { type: 'Gates', count: 1 }],
      bom: [{ name: 'Verkada Dome Camera', qty: 6 }, { name: 'LiftMaster Gate Operator', qty: 1 }, { name: 'CellGate Watchman', qty: 1 }],
      device_total: 8, plan_versions: 4, last_updated: minsAgo(45),
      activity: [{ at: minsAgo(45), text: 'System Design v2 saved by Mike T.' }, { at: daysAgo(1), text: 'Devices placed on North Gate' }, { at: daysAgo(10), text: 'Floor Plan v2 approved' }],
    },
    {
      id: 'des-3', property_name: 'Sunrise Estates', address: '100 Sunrise Way, Suburbia', current_stage: 'floor_plan',
      stages: [
        { stage: 'floor_plan', status: 'in_progress', version: 1, updated_by: 'Dana W.', updated_at: daysAgo(1) },
        { stage: 'system_design', status: 'not_started', version: 0 },
        { stage: 'as_built', status: 'not_started', version: 0 },
      ],
      device_counts: [], bom: [], device_total: 0, plan_versions: 1, last_updated: daysAgo(1),
      activity: [{ at: daysAgo(1), text: 'Floor plan v1 uploaded by Dana W.' }, { at: daysAgo(2), text: 'Design record created' }],
    },
  ];
};
// --- Theme & Styles ---
const glassPanel = { backgroundColor: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' };
const glassAction = { backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' };
const textPrimary = { color: 'rgba(255,255,255,0.9)' };
const textSecondary = { color: 'rgba(255,255,255,0.5)' };
const textFaint = { color: 'rgba(255,255,255,0.34)' };
const brandBlue = '#6B7EFF';
const brandCyan = '#00C8FF';
const brandViolet = '#8B5CF6';
const brandEmerald = '#34D399';
// --- Helpers ---
const formatStageName = (stage: Stage) => {
  switch (stage) {
    case 'floor_plan': return 'Floor Plan';
    case 'system_design': return 'System Design';
    case 'as_built': return 'As-Built';
  }
};
const getStageColor = (stage: Stage) => {
  switch (stage) {
    case 'floor_plan': return brandBlue;
    case 'system_design': return brandCyan;
    case 'as_built': return brandEmerald;
  }
};
const formatRelativeTime = (isoString: string) => {
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
// --- Components ---
export default function DesignExplorer() {
  const router = useRouter();
  const [records, setRecords] = useState<DesignRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    loadDesigns().then(data => {
      setRecords(data);
      setIsLoading(false);
    });
  }, []);
  const handleAction = (actionName: string, id: string) => {
    if (actionName === 'open_drawing' || actionName.startsWith('open_')) {
      router.push(`/design/floor-plans?plan=${id}`);
      return;
    }
    console.log(`Action: ${actionName} on ID: ${id}`);
  };
  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return records.filter(r =>
      r.property_name.toLowerCase().includes(q) ||
      (r.address && r.address.toLowerCase().includes(q))
    );
  }, [searchQuery, records]);
  const selectedRecord = useMemo(() => {
    return records.find(r => r.id === selectedId) || null;
  }, [selectedId, records]);
  // --- Detail Pane Renderer ---
  const renderDetailPane = (record: DesignRecord) => {
    const activeColor = getStageColor(record.current_stage);
    return (
      <div className="flex flex-col lg:flex-row gap-6 p-4 md:p-6 w-full max-w-6xl mx-auto h-full">

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto hide-scrollbar pb-16">

          {/* 1. Big Top Card */}
          <div className="rounded-3xl p-6 relative overflow-hidden" style={glassPanel}>
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-10 pointer-events-none" style={{ backgroundColor: activeColor, transform: 'translate(30%, -30%)' }} />

            <div className="flex items-center gap-2 mb-3 relative z-10">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: textSecondary.color }}>
                Design
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase flex items-center gap-1.5" style={{ backgroundColor: `${activeColor}1A`, color: activeColor }}>
                <Layers size={12} />
                {formatStageName(record.current_stage)}
              </span>
            </div>

            <h2 className="text-3xl font-semibold tracking-tight mb-2 relative z-10" style={textPrimary}>
              {record.property_name}
            </h2>

            <div className="flex items-center gap-2 text-sm relative z-10" style={textSecondary}>
              <MapPin size={16} />
              <span>{record.address || 'No address provided'}</span>
            </div>
          </div>
          {/* 2. Four Quick Facts Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Current Stage', val: formatStageName(record.current_stage), icon: <Layers size={16} /> },
              { label: 'Devices Placed', val: record.device_total, icon: <Camera size={16} /> },
              { label: 'Total Versions', val: record.plan_versions, icon: <History size={16} /> },
              { label: 'Last Updated', val: formatRelativeTime(record.last_updated), icon: <Clock size={16} /> }
            ].map((fact, i) => (
              <div key={i} className="rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-1" style={glassPanel}>
                <div style={textFaint}>{fact.icon}</div>
                <div className="text-xl md:text-2xl font-semibold mt-1" style={textPrimary}>{fact.val}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={textSecondary}>{fact.label}</div>
              </div>
            ))}
          </div>
          {/* 3. Human Detail Blocks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Stages Block */}
            <div className="rounded-2xl p-5 md:col-span-2" style={glassPanel}>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={textPrimary}>
                <Layers size={16} style={{ color: brandViolet }} /> Design Stages
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {record.stages.map((st, i) => {
                  const isDone = st.status === 'done';
                  const isProg = st.status === 'in_progress';
                  const stageColor = getStageColor(st.stage);

                  return (
                    <div key={i} className="rounded-xl p-4 flex flex-col justify-between min-h-[120px] transition-all" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <div className="font-medium text-sm" style={textPrimary}>{formatStageName(st.stage)}</div>
                          <div
                            className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                            style={{
                              backgroundColor: isDone ? `${brandEmerald}1A` : isProg ? `${brandBlue}1A` : 'rgba(255,255,255,0.05)',
                              color: isDone ? brandEmerald : isProg ? brandBlue : textSecondary.color
                            }}
                          >
                            {isDone ? 'Done' : isProg ? 'In Progress' : 'Not Started'}
                          </div>
                        </div>
                        {st.version > 0 ? (
                          <div className="text-xs mt-3 flex flex-col gap-1" style={textSecondary}>
                            <div>Version {st.version}</div>
                            {st.updated_by && <div>By {st.updated_by}</div>}
                          </div>
                        ) : (
                          <div className="text-xs mt-3 italic" style={textFaint}>Awaiting first draft...</div>
                        )}
                      </div>

                      {st.version > 0 && (
                        <button
                          onClick={() => handleAction(`open_${st.stage}`, record.id)}
                          className="mt-4 text-xs font-medium self-start flex items-center gap-1 transition-colors hover:opacity-80"
                          style={{ color: stageColor }}
                        >
                          Open in tool <ChevronRight size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Devices Block */}
            <div className="rounded-2xl p-5" style={glassPanel}>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={textPrimary}>
                <Camera size={16} style={{ color: brandCyan }} /> Devices on Plan
              </h3>
              {record.device_counts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {record.device_counts.map((dc, i) => (
                    <div key={i} className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                      <span style={textSecondary}>{dc.type}</span>
                      <span className="font-semibold" style={textPrimary}>{dc.count}</span>
                    </div>
                  ))}
                  <div className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm w-full mt-2" style={{ backgroundColor: 'rgba(0,200,255,0.05)' }}>
                    <span style={{ color: brandCyan }}>Total Devices</span>
                    <span className="font-bold ml-auto" style={textPrimary}>{record.device_total}</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm" style={textFaint}>No devices placed yet.</div>
              )}
            </div>
            {/* BOM Block */}
            <div className="rounded-2xl p-5" style={glassPanel}>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={textPrimary}>
                <FileText size={16} style={{ color: brandBlue }} /> Bill of Materials
              </h3>
              {record.bom.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {record.bom.slice(0, 4).map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-sm pb-2 border-b last:border-0 last:pb-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                      <span className="truncate pr-4" style={textSecondary}>{item.name}</span>
                      <span className="font-medium flex-shrink-0" style={textPrimary}>x{item.qty}</span>
                    </div>
                  ))}
                  {record.bom.length > 4 && (
                    <div className="text-xs mt-1" style={{ color: brandBlue }}>
                      + {record.bom.length - 4} more items...
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm" style={textFaint}>BOM is empty. Add devices to the design.</div>
              )}
            </div>
            {/* Activity Block */}
            <div className="rounded-2xl p-5 md:col-span-2" style={glassPanel}>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={textPrimary}>
                <Activity size={16} style={textSecondary} /> Recent Activity
              </h3>
              <div className="flex flex-col gap-3">
                {record.activity.map((act, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
                    <div>
                      <div className="text-sm" style={textPrimary}>{act.text}</div>
                      <div className="text-xs mt-0.5" style={textFaint}>{formatRelativeTime(act.at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* 4. Right Action Rail */}
        <div className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-3 pb-16">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={textSecondary}>Actions</div>

          <button onClick={() => handleAction('open_drawing', record.id)} className="w-full rounded-2xl p-3.5 flex items-center gap-3 text-sm font-medium transition-colors hover:bg-white/5" style={glassAction}>
            <PenTool size={18} style={{ color: brandBlue }} />
            <span style={textPrimary}>Open Drawing Tool</span>
          </button>

          <button onClick={() => handleAction('promote_as_built', record.id)} className="w-full rounded-2xl p-3.5 flex items-center gap-3 text-sm font-medium transition-colors hover:bg-white/5" style={glassAction}>
            <Check size={18} style={{ color: brandEmerald }} />
            <span style={textPrimary}>Promote to As-Built</span>
          </button>
          <button onClick={() => handleAction('export_bom', record.id)} className="w-full rounded-2xl p-3.5 flex items-center gap-3 text-sm font-medium transition-colors hover:bg-white/5" style={glassPanel}>
            <Download size={18} style={textSecondary} />
            <span style={textPrimary}>Export BOM</span>
          </button>
          <button onClick={() => handleAction('new_version', record.id)} className="w-full rounded-2xl p-3.5 flex items-center gap-3 text-sm font-medium transition-colors hover:bg-white/5" style={glassPanel}>
            <Plus size={18} style={textSecondary} />
            <span style={textPrimary}>New Version</span>
          </button>
          <button onClick={() => handleAction('add_note', record.id)} className="w-full rounded-2xl p-3.5 flex items-center gap-3 text-sm font-medium transition-colors hover:bg-white/5" style={glassPanel}>
            <FileText size={18} style={textSecondary} />
            <span style={textPrimary}>Add Note</span>
          </button>
        </div>
      </div>
    );
  };
  return (
    <div className="flex w-full max-w-5xl mt-9 h-[78dvh] font-sans overflow-hidden rounded-3xl" style={glassPanel}>

      {/* LEFT PANE: Search & List */}
      <div
        className={`w-full md:w-[420px] flex-shrink-0 flex-col border-r h-full ${selectedId ? 'hidden md:flex' : 'flex'}`}
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
      >
        {/* Header Area */}
        <div className="p-5 flex flex-col gap-4 shrink-0">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight mb-1" style={textPrimary}>Design</h1>
            <p className="text-xs leading-relaxed" style={textSecondary}>
              Floor plans, system designs, and as-builts for every property.
            </p>
          </div>
          {/* Search Box */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl" style={glassPanel}>
            <Search size={16} style={textSecondary} />
            <input
              type="text"
              placeholder="Search properties..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm w-full placeholder:text-white/30"
              style={textPrimary}
            />
          </div>
        </div>
        {/* Results List */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 hide-scrollbar">
          {isLoading ? (
            <div className="p-8 text-center text-sm" style={textSecondary}>Loading designs...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-8 text-center text-sm" style={textSecondary}>No records found.</div>
          ) : (
            filteredRecords.map((record) => {
              const isSelected = selectedId === record.id;

              return (
                <button
                  key={record.id}
                  onClick={() => setSelectedId(record.id)}
                  className="w-full text-left p-4 rounded-2xl mb-2 flex flex-col gap-3 transition-all"
                  style={{
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.06)' : glassPanel.backgroundColor,
                    border: isSelected ? '1px solid rgba(255,255,255,0.15)' : glassPanel.border,
                  }}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-base truncate mb-0.5" style={textPrimary}>{record.property_name}</div>
                      <div className="text-xs truncate" style={textSecondary}>{record.address || 'No address'}</div>
                    </div>
                    <div className="text-[10px] whitespace-nowrap pt-1" style={textFaint}>
                      {formatRelativeTime(record.last_updated)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    {/* Stage Tracker Dots */}
                    <div className="flex items-center gap-1">
                      {record.stages.map((st, i) => {
                        const isDone = st.status === 'done';
                        const isProg = st.status === 'in_progress';
                        const stageColor = getStageColor(st.stage);

                        return (
                          <div key={i} className="flex items-center gap-1">
                            <div
                              className="w-3 h-3 rounded-full transition-colors"
                              style={{
                                backgroundColor: isDone ? stageColor : 'transparent',
                                border: `1px solid ${isDone || isProg ? stageColor : 'rgba(255,255,255,0.2)'}`,
                                opacity: isProg ? 1 : isDone ? 1 : 0.5,
                                boxShadow: isProg ? `0 0 8px ${stageColor}66` : 'none'
                              }}
                              title={`${formatStageName(st.stage)} - ${st.status}`}
                            />
                            {i < 2 && <div className="w-3 h-[1px]" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />}
                          </div>
                        );
                      })}
                    </div>

                    {/* Devices Mini Chip */}
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 text-[11px] font-medium" style={textSecondary}>
                      <Camera size={10} />
                      {record.device_total}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
      {/* RIGHT PANE: Detail View */}
      <div className={`flex-1 flex-col h-full relative ${!selectedId ? 'hidden md:flex items-center justify-center' : 'flex'}`}>

        {/* Mobile Back Header */}
        {selectedId && (
          <div className="md:hidden flex items-center px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <button onClick={() => setSelectedId(null)} className="flex items-center gap-2 text-sm font-medium" style={textPrimary}>
              <ArrowLeft size={18} /> Back to list
            </button>
          </div>
        )}
        {!selectedRecord ? (
          <div className="text-center p-8 hidden md:block">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4" style={glassPanel}>
              <Layers size={24} style={textSecondary} />
            </div>
            <h3 className="text-lg font-medium mb-1" style={textPrimary}>Select a property</h3>
            <p className="text-sm" style={textSecondary}>View floor plans, designs, and as-builts.</p>
          </div>
        ) : (
          renderDetailPane(selectedRecord)
        )}
      </div>
    </div>
  );
}
