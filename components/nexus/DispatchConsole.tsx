'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Check,
  Clock,
  User,
  Users,
  MapPin,
  Wrench,
  ChevronRight,
} from 'lucide-react';
// Vercel lucide cache quirk — load these via require()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Truck, Circle } = require('lucide-react') as any;
// --- Types ---
type DispatchStatus = 'Pending' | 'Assigned' | 'In Progress' | 'Completed';
type Priority = 'urgent' | 'normal' | 'scheduled';
type TechStatus = 'Available' | 'On Site' | 'Driving' | 'Offline';
type Job = {
  id: string;
  title: string | null;
  property: string | null;
  jobType?: string | null;
  assignedTech: string | null;
  assignedTechId: string | null;
  eta: string;
  priority: Priority;
  status: DispatchStatus;
  woNumber?: string | null;
  site_id?: string | null;
};
type Tech = {
  id: string;
  name: string;
  initials: string;
  role: string;
  status: TechStatus;
  currentJobId: string | null;
};
// Map UI tech status → DB enum for PATCH.
const DB_STATUS: Record<TechStatus, string> = {
  Available: 'available',
  'On Site': 'on_site',
  Driving: 'driving',
  Offline: 'offline',
};
// --- Data: real API with mock fallback ---
const loadDispatch = async (): Promise<{ jobs: Job[]; techs: Tech[] }> => {
  try {
    const res = await fetch('/api/dispatch', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.jobs) && Array.isArray(data.techs)) {
        return {
          jobs: data.jobs.map((j: any) => ({
            id: j.id,
            title: j.title ?? null,
            property: j.property ?? null,
            jobType: j.jobType ?? null,
            assignedTech: j.assignedTech ?? null,
            assignedTechId: j.assignedTechId ?? null,
            eta: j.eta ?? 'TBD',
            priority: (j.priority ?? 'normal') as Priority,
            status: (j.status ?? 'Pending') as DispatchStatus,
            woNumber: j.woNumber ?? null,
            site_id: j.site_id ?? null,
          })),
          techs: data.techs.map((t: any) => ({
            id: t.id,
            name: t.name,
            initials: t.initials ?? (t.name ?? '?').slice(0, 2).toUpperCase(),
            role: t.role ?? 'Tech',
            status: (t.status ?? 'Offline') as TechStatus,
            currentJobId: t.currentJobId ?? null,
          })),
        };
      }
    }
  } catch {
    /* fall through to preview */
  }
  return mockDispatch();
};
const mockDispatch = async (): Promise<{ jobs: Job[]; techs: Tech[] }> => {
  const today = new Date();
  const dateStr = (h: number, m: number) => { const d = new Date(today); d.setHours(h, m, 0); return d.toISOString(); };
  return {
    jobs: [
      { id: 'j1', title: 'Front Gate not opening', property: 'Avalon Heights', jobType: 'Repair', assignedTech: null, assignedTechId: null, eta: 'TBD', priority: 'urgent', status: 'Pending', woNumber: 'WO-1042' },
      { id: 'j2', title: 'Install 4 new readers', property: 'The Beacon', jobType: 'Install', assignedTech: 'Mike T.', assignedTechId: 't1', eta: dateStr(10, 0), priority: 'normal', status: 'In Progress', woNumber: 'WO-1043' },
      { id: 'j3', title: 'Quarterly maintenance', property: 'Sunrise Estates', jobType: 'Maintenance', assignedTech: null, assignedTechId: null, eta: dateStr(14, 30), priority: 'scheduled', status: 'Pending', woNumber: 'WO-1044' },
      { id: 'j4', title: 'NVR offline, please check', property: 'Kim Plaza', jobType: 'Service Call', assignedTech: 'Sarah J.', assignedTechId: 't2', eta: dateStr(11, 15), priority: 'urgent', status: 'Assigned', woNumber: 'WO-1045' },
      { id: 'j5', title: 'Replace lobby intercom', property: 'Nexus Lofts', jobType: 'Repair', assignedTech: 'Alex R.', assignedTechId: 't3', eta: dateStr(9, 0), priority: 'normal', status: 'In Progress', woNumber: 'WO-1046' },
      { id: 'j6', title: 'Keypad programming', property: 'Private Residence', jobType: 'Config', assignedTech: null, assignedTechId: null, eta: 'TBD', priority: 'normal', status: 'Pending', woNumber: 'WO-1047' },
    ],
    techs: [
      { id: 't1', name: 'Mike Thompson', initials: 'MT', role: 'Lead Tech', status: 'On Site', currentJobId: 'j2' },
      { id: 't2', name: 'Sarah Jenkins', initials: 'SJ', role: 'Service Tech', status: 'Driving', currentJobId: 'j4' },
      { id: 't3', name: 'Alex Rodriguez', initials: 'AR', role: 'Installer', status: 'On Site', currentJobId: 'j5' },
      { id: 't4', name: 'Dana White', initials: 'DW', role: 'Service Tech', status: 'Available', currentJobId: null },
      { id: 't5', name: 'John Davis', initials: 'JD', role: 'Installer', status: 'Available', currentJobId: null },
      { id: 't6', name: 'Emma Lee', initials: 'EL', role: 'Apprentice', status: 'Offline', currentJobId: null },
    ],
  };
};
// --- Theme & Helpers ---
const glassPanel = { backgroundColor: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' };
const textPrimary = { color: 'rgba(255,255,255,0.9)' };
const textSecondary = { color: 'rgba(255,255,255,0.5)' };
const textFaint = { color: 'rgba(255,255,255,0.34)' };
const brandBlue = '#6B7EFF';
const brandCyan = '#00C8FF';
const colorEmerald = '#34D399';
const colorAmber = '#FBBF24';
const colorViolet = '#8B5CF6';
const colorRed = '#F87171';
const getPriorityColor = (p: Priority) => {
  if (p === 'urgent') return colorRed;
  if (p === 'scheduled') return textSecondary.color;
  return brandCyan;
};
const getStatusColor = (s: DispatchStatus) => {
  if (s === 'Pending') return textFaint.color;
  if (s === 'Assigned') return brandBlue;
  if (s === 'In Progress') return colorViolet;
  return colorEmerald;
};
const getTechStatusColor = (s: TechStatus) => {
  if (s === 'Available') return colorEmerald;
  if (s === 'Driving') return colorAmber;
  if (s === 'On Site') return colorViolet;
  return textFaint.color;
};
const getTechStatusIcon = (s: TechStatus) => {
  if (s === 'Available') return <Check size={12} />;
  if (s === 'Driving') return <Truck size={12} />;
  if (s === 'On Site') return <Wrench size={12} />;
  return <Circle size={12} />;
};
const formatTime = (isoString: string) => {
  if (isoString === 'TBD') return 'TBD';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'TBD';
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return 'TBD';
  }
};
const FILTERS = ['All', 'Urgent', 'Unassigned', 'In Progress'] as const;
type FilterType = typeof FILTERS[number];
// --- Main Component ---
export default function DispatchConsole() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  useEffect(() => {
    loadDispatch().then(data => {
      setJobs(data.jobs);
      setTechs(data.techs);
      setIsLoading(false);
    });
  }, []);
  // --- Actions ---
  const handleAssign = (jobId: string, techId: string) => {
    const tech = techs.find(t => t.id === techId);
    if (!tech) return;
    // Optimistic UI
    setJobs(prev => prev.map(j => j.id === jobId
      ? { ...j, assignedTechId: techId, assignedTech: tech.name, status: j.status === 'Pending' ? 'Assigned' : j.status }
      : j));
    setTechs(prev => prev.map(t => {
      if (t.id === techId) return { ...t, currentJobId: jobId };
      if (t.currentJobId === jobId) return { ...t, currentJobId: null };
      return t;
    }));
    setSelectedJobId(null);
    // Persist: stamp the work order's assignee + the tech's current job.
    void fetch(`/api/maintenance/${jobId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignee_id: techId, assignee_name: tech.name }),
    }).catch(() => {});
    void fetch(`/api/dispatch/technicians/${techId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_job_id: jobId }),
    }).catch(() => {});
  };
  const handleSetTechStatus = (techId: string, status: TechStatus) => {
    setTechs(prev => prev.map(t => t.id === techId ? { ...t, status } : t));
    void fetch(`/api/dispatch/technicians/${techId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: DB_STATUS[status] }),
    }).catch(() => {});
  };
  const handleOpenJob = (jobId: string) => { router.push(`/maintenance/${jobId}`); };
  // --- Derived State ---
  const filteredJobs = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let result = jobs.filter(j =>
      (j.title && j.title.toLowerCase().includes(q)) ||
      (j.property && j.property.toLowerCase().includes(q)) ||
      (j.woNumber && j.woNumber.toLowerCase().includes(q))
    );
    if (activeFilter === 'Urgent') result = result.filter(j => j.priority === 'urgent');
    if (activeFilter === 'Unassigned') result = result.filter(j => !j.assignedTechId);
    if (activeFilter === 'In Progress') result = result.filter(j => j.status === 'In Progress');
    return result;
  }, [jobs, activeFilter, searchQuery]);
  const stats = useMemo(() => {
    const unassigned = jobs.filter(j => !j.assignedTechId && j.status !== 'Completed').length;
    const assignedToday = jobs.filter(j => j.assignedTechId && j.status !== 'Completed').length;
    const availableTechs = techs.filter(t => t.status === 'Available').length;
    const onSiteTechs = techs.filter(t => t.status === 'On Site').length;
    return { unassigned, assignedToday, availableTechs, onSiteTechs };
  }, [jobs, techs]);
  const techGroups = useMemo(() => ({
    available: techs.filter(t => t.status === 'Available'),
    onSite: techs.filter(t => t.status === 'On Site'),
    driving: techs.filter(t => t.status === 'Driving'),
    offline: techs.filter(t => t.status === 'Offline'),
  }), [techs]);
  const scheduledJobs = useMemo(() => jobs
    .filter(j => j.assignedTechId && j.eta !== 'TBD')
    .sort((a, b) => new Date(a.eta).getTime() - new Date(b.eta).getTime()), [jobs]);
  if (isLoading) {
    return (
      <div className="flex w-full max-w-5xl mt-9 h-[78dvh] items-center justify-center rounded-3xl" style={{ ...glassPanel, ...textSecondary }}>
        Loading Dispatch...
      </div>
    );
  }
  return (
    <div className="flex flex-col w-full max-w-5xl mt-9 h-[78dvh] font-sans overflow-hidden rounded-3xl" style={glassPanel}>

      {/* 1. Header & Live Stats */}
      <div className="p-4 md:p-6 flex-shrink-0 border-b flex flex-col md:flex-row md:items-end justify-between gap-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-1" style={textPrimary}>Dispatch</h1>
          <p className="text-sm" style={textSecondary}>Assign jobs to techs and see who&apos;s available right now.</p>
        </div>

        {/* Stat Row */}
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1 md:pb-0">
          <div className="px-4 py-2 rounded-2xl flex flex-col items-center min-w-[100px]" style={glassPanel}>
            <div className="text-xl font-bold" style={{ color: stats.unassigned > 0 ? colorAmber : textPrimary.color }}>{stats.unassigned}</div>
            <div className="text-[10px] uppercase tracking-wider font-semibold" style={textSecondary}>Unassigned</div>
          </div>
          <div className="px-4 py-2 rounded-2xl flex flex-col items-center min-w-[100px]" style={glassPanel}>
            <div className="text-xl font-bold" style={textPrimary}>{stats.assignedToday}</div>
            <div className="text-[10px] uppercase tracking-wider font-semibold" style={textSecondary}>Assigned</div>
          </div>
          <div className="px-4 py-2 rounded-2xl flex flex-col items-center min-w-[100px]" style={glassPanel}>
            <div className="text-xl font-bold" style={{ color: colorEmerald }}>{stats.availableTechs}</div>
            <div className="text-[10px] uppercase tracking-wider font-semibold" style={textSecondary}>Avail Techs</div>
          </div>
          <div className="px-4 py-2 rounded-2xl flex flex-col items-center min-w-[100px]" style={glassPanel}>
            <div className="text-xl font-bold" style={{ color: colorViolet }}>{stats.onSiteTechs}</div>
            <div className="text-[10px] uppercase tracking-wider font-semibold" style={textSecondary}>On Site</div>
          </div>
        </div>
      </div>
      {/* 2. Two-Column Body */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* LEFT COLUMN: Jobs */}
        <div className="w-full md:w-1/2 lg:w-3/5 flex flex-col border-r h-1/2 md:h-full" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>

          <div className="p-4 flex flex-col gap-3 flex-shrink-0" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl" style={glassPanel}>
              <Search size={16} style={textSecondary} />
              <input
                type="text"
                placeholder="Search jobs, properties, WO#..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-sm w-full placeholder:text-white/30"
                style={textPrimary}
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
              {FILTERS.map(filter => (
                <button
                  key={filter}
                  onClick={() => { setActiveFilter(filter); setSelectedJobId(null); }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
                  style={{
                    backgroundColor: activeFilter === filter ? 'rgba(255,255,255,0.1)' : 'transparent',
                    border: activeFilter === filter ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
                    color: activeFilter === filter ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)'
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {filteredJobs.length === 0 ? (
              <div className="text-center p-8 text-sm" style={textSecondary}>No jobs found matching criteria.</div>
            ) : (
              filteredJobs.map(job => {
                const isSelected = selectedJobId === job.id;
                const pColor = getPriorityColor(job.priority);
                const sColor = getStatusColor(job.status);

                return (
                  <div
                    key={job.id}
                    className="rounded-3xl flex flex-col overflow-hidden transition-all duration-200"
                    style={{
                      ...glassPanel,
                      border: isSelected ? `1px solid ${brandBlue}` : glassPanel.border,
                      boxShadow: isSelected ? `0 0 0 1px ${brandBlue}40` : 'none'
                    }}
                  >
                    <button
                      onClick={() => setSelectedJobId(isSelected ? null : job.id)}
                      className="w-full text-left p-4 hover:bg-white/5 transition-colors flex flex-col sm:flex-row gap-3 sm:items-start"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium" style={{ color: pColor }}>{job.priority.toUpperCase()}</span>
                          <span className="text-[10px]" style={textFaint}>•</span>
                          <span className="text-xs tracking-wider uppercase font-semibold" style={textSecondary}>{job.woNumber || 'NO WO'}</span>
                        </div>
                        <div className="font-semibold text-base truncate mb-0.5" style={textPrimary}>{job.title || 'Untitled Job'}</div>
                        <div className="text-sm truncate flex items-center gap-1.5" style={textSecondary}>
                          <MapPin size={12} /> {job.property || 'No location'}
                        </div>
                      </div>
                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 sm:gap-1.5 flex-shrink-0 mt-2 sm:mt-0">
                        <div className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${sColor}1A`, color: sColor }}>{job.status}</div>
                        <div className="text-xs flex items-center gap-1" style={textPrimary}><Clock size={12} style={textFaint} /> {formatTime(job.eta)}</div>
                        <div className="text-xs font-medium mt-1 flex items-center gap-1.5" style={textSecondary}>
                          <User size={12} />
                          {job.assignedTech ? <span style={textPrimary}>{job.assignedTech}</span> : <span style={{ color: colorAmber }}>Unassigned</span>}
                        </div>
                      </div>
                    </button>
                    {isSelected && (
                      <div className="border-t bg-black/20 p-4" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                          {[
                            { label: 'Priority', val: job.priority, color: pColor },
                            { label: 'Status', val: job.status, color: sColor },
                            { label: 'ETA', val: formatTime(job.eta), color: textPrimary.color },
                            { label: 'WO Number', val: job.woNumber || 'N/A', color: textPrimary.color }
                          ].map((fact, i) => (
                            <div key={i} className="rounded-xl p-2.5 flex flex-col items-center justify-center text-center gap-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <div className="text-sm font-semibold capitalize" style={{ color: fact.color }}>{fact.val}</div>
                              <div className="text-[9px] uppercase tracking-wider font-bold" style={textSecondary}>{fact.label}</div>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="text-xs uppercase tracking-wider font-semibold" style={textSecondary}>Assign to Tech:</div>
                          <div className="flex flex-wrap gap-2">
                            {techs.filter(t => t.status !== 'Offline').map(tech => (
                              <button
                                key={tech.id}
                                onClick={() => handleAssign(job.id, tech.id)}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors hover:bg-white/10"
                                style={{ ...glassPanel, border: job.assignedTechId === tech.id ? `1px solid ${brandBlue}` : glassPanel.border }}
                              >
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getTechStatusColor(tech.status) }} />
                                <span style={textPrimary}>{tech.name}</span>
                                {job.assignedTechId === tech.id && <Check size={14} style={{ color: brandBlue }} />}
                              </button>
                            ))}
                          </div>
                        </div>
                        <button onClick={() => handleOpenJob(job.id)} className="mt-4 text-xs font-medium flex items-center gap-1 transition-colors hover:opacity-80" style={{ color: brandBlue }}>
                          Open full job details <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
        {/* RIGHT COLUMN: Tech Roster */}
        <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col h-1/2 md:h-full bg-black/10">
          <div className="p-4 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
            <h2 className="text-lg font-medium flex items-center gap-2" style={textPrimary}>
              <Users size={18} style={textSecondary} /> Tech Roster
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
            {(['available', 'onSite', 'driving', 'offline'] as const).map(groupKey => {
              const groupTechs = techGroups[groupKey];
              if (groupTechs.length === 0) return null;
              const groupTitle = groupKey === 'available' ? 'Available' : groupKey === 'onSite' ? 'On Site' : groupKey === 'driving' ? 'Driving' : 'Offline';
              const groupColor = getTechStatusColor(groupTitle as TechStatus);
              return (
                <div key={groupKey} className="flex flex-col gap-3">
                  <h3 className="text-xs uppercase tracking-wider font-semibold flex items-center gap-2" style={{ color: groupColor }}>
                    {getTechStatusIcon(groupTitle as TechStatus)} {groupTitle} ({groupTechs.length})
                  </h3>

                  <div className="flex flex-col gap-2">
                    {groupTechs.map(tech => {
                      const techJob = jobs.find(j => j.id === tech.currentJobId);
                      return (
                        <div key={tech.id} className="p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={glassPanel}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: textPrimary.color }}>
                              {tech.initials}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-sm text-white truncate">{tech.name}</div>
                              <div className="text-xs truncate flex items-center gap-1.5 mt-0.5" style={textSecondary}>
                                {tech.role}
                                {techJob && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate flex items-center gap-1" style={{ color: brandBlue }}>
                                      <Wrench size={10} /> {techJob.woNumber || 'Job'}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 bg-black/20 p-1 rounded-xl">
                            {(['Available', 'On Site', 'Driving', 'Offline'] as TechStatus[]).map(status => (
                              <button
                                key={status}
                                onClick={() => handleSetTechStatus(tech.id, status)}
                                title={status}
                                className="p-1.5 rounded-lg transition-all"
                                style={{ backgroundColor: tech.status === status ? 'rgba(255,255,255,0.1)' : 'transparent', opacity: tech.status === status ? 1 : 0.5 }}
                              >
                                <div style={{ color: tech.status === status ? getTechStatusColor(status) : textSecondary.color }}>
                                  {getTechStatusIcon(status)}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* 3. Bottom: Schedule Strip */}
      <div className="h-16 flex-shrink-0 border-t flex flex-col justify-center px-4" style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <div className="text-[10px] uppercase tracking-widest font-bold mb-1" style={textFaint}>Today&apos;s Assigned Schedule</div>
        <div className="flex items-center gap-4 overflow-x-auto hide-scrollbar">
          {scheduledJobs.length === 0 ? (
            <span className="text-xs italic" style={textSecondary}>No jobs scheduled with ETAs.</span>
          ) : (
            scheduledJobs.map(job => (
              <div key={job.id} className="flex items-center gap-2 flex-shrink-0 bg-white/5 px-2.5 py-1 rounded-lg">
                <span className="text-xs font-semibold" style={textPrimary}>{formatTime(job.eta)}</span>
                <div className="w-[1px] h-3 bg-white/20" />
                <span className="text-xs truncate max-w-[120px]" style={textSecondary}>{job.property}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30" style={{ color: brandBlue }}>{job.assignedTech?.split(' ')[0]}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
