'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Building2, Users, MapPin, Mail, Phone, Plus, FileText, Activity, Wrench, ChevronRight, ClipboardList } from 'lucide-react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowLeft, Camera, DoorOpen, Briefcase } = require('lucide-react') as any;

type Customer = {
  id: string; name: string; company?: string | null; email?: string | null; phone?: string | null;
  site_count: number; open_jobs: number; status: string;
  contacts: { name: string; role?: string; phone?: string }[];
  sites: { id: string; name: string; address?: string; units?: number }[];
};
type Property = {
  id: string; name: string; address?: string | null; management_company?: string | null;
  units?: number; gates?: number; cameras?: number; open_jobs: number; status: string; systems: string[];
};

// --- Mock data (Claude wires loadCustomers/loadProperties to real search APIs) ---
const loadCustomers = async (): Promise<Customer[]> => {
  await new Promise(r => setTimeout(r, 300));
  return [
    { id: 'cust-1', name: 'Sarah Jenkins', company: 'Avalon Management', email: 'sarah@avalon.example.com', phone: '(555) 123-4567', site_count: 3, open_jobs: 2, status: 'Active', contacts: [{ name: 'Sarah Jenkins', role: 'Regional Manager', phone: '(555) 123-4567' }, { name: 'Tom Hardy', role: 'Maintenance Lead', phone: '(555) 987-6543' }], sites: [{ id: 'prop-1', name: 'Avalon Heights', address: '123 Heights Blvd', units: 120 }, { id: 'prop-2', name: 'Avalon West', address: '456 West Ave', units: 85 }] },
    { id: 'cust-2', name: 'Michael Chen', company: 'Chen Real Estate', email: 'mchen@cre.example.com', phone: '(555) 222-3333', site_count: 1, open_jobs: 0, status: 'Active', contacts: [{ name: 'Michael Chen', role: 'Owner', phone: '(555) 222-3333' }], sites: [{ id: 'prop-3', name: 'The Beacon', address: '789 Harbor Drive', units: 45 }] },
    { id: 'cust-3', name: 'Amanda Torres', company: 'Sunrise HOA', email: 'board@sunrisehoa.example.com', phone: '(555) 444-5555', site_count: 1, open_jobs: 1, status: 'Active', contacts: [{ name: 'Amanda Torres', role: 'HOA President', phone: '(555) 444-5555' }], sites: [{ id: 'prop-4', name: 'Sunrise Estates', address: '100 Sunrise Way', units: 200 }] },
    { id: 'cust-4', name: 'David Kim', company: 'Kim Properties', email: 'david@kimprop.example.com', phone: '(555) 666-7777', site_count: 4, open_jobs: 5, status: 'Active', contacts: [{ name: 'David Kim', role: 'Owner', phone: '(555) 666-7777' }], sites: [{ id: 'prop-5', name: 'Kim Plaza', address: '500 Main St', units: 10 }] },
    { id: 'cust-5', name: 'Robert Smith', company: 'Smith Asset Mgmt', email: 'rsmith@smithasset.example.com', phone: '(555) 888-9999', site_count: 2, open_jobs: 0, status: 'Inactive', contacts: [{ name: 'Robert Smith', role: 'Director', phone: '(555) 888-9999' }], sites: [] },
    { id: 'cust-6', name: 'Elena Rodriguez', company: 'Nexus Co-op', email: 'elena@nexus.example.com', phone: '(555) 111-2222', site_count: 1, open_jobs: 1, status: 'Active', contacts: [{ name: 'Elena Rodriguez', role: 'Board Member', phone: '(555) 111-2222' }], sites: [{ id: 'prop-6', name: 'Nexus Lofts', address: '300 Artist Row', units: 60 }] },
    { id: 'cust-7', name: 'John Smith', company: 'Independent', email: 'john@example.com', phone: '(555) 777-8888', site_count: 1, open_jobs: 0, status: 'Active', contacts: [{ name: 'John Smith', role: 'Owner', phone: '(555) 777-8888' }], sites: [{ id: 'prop-7', name: 'Private Residence', address: '10 Gated Lane', units: 1 }] },
    { id: 'cust-8', name: 'Jessica Lee', company: 'Lee Corporate', email: 'jlee@leecorp.example.com', phone: '(555) 333-4444', site_count: 2, open_jobs: 3, status: 'Active', contacts: [{ name: 'Jessica Lee', role: 'Facilities Manager', phone: '(555) 333-4444' }], sites: [{ id: 'prop-8', name: 'Lee Tower', address: '800 Tech Park', units: 0 }] }
  ];
};
const loadProperties = async (): Promise<Property[]> => {
  await new Promise(r => setTimeout(r, 300));
  return [
    { id: 'prop-1', name: 'Avalon Heights', address: '123 Heights Blvd, Cityville', management_company: 'Avalon Management', units: 120, gates: 2, cameras: 8, open_jobs: 1, status: 'Active', systems: ['Doorking 1838', 'Hikvision NVR', 'Brivo Access'] },
    { id: 'prop-2', name: 'Avalon West', address: '456 West Ave, Cityville', management_company: 'Avalon Management', units: 85, gates: 1, cameras: 4, open_jobs: 1, status: 'Active', systems: ['CellGate Watchman', 'Ring Doorbell Elite'] },
    { id: 'prop-3', name: 'The Beacon', address: '789 Harbor Drive, Portside', management_company: 'Chen Real Estate', units: 45, gates: 1, cameras: 6, open_jobs: 0, status: 'Active', systems: ['ButterflyMX', 'Eagle Eye Networks'] },
    { id: 'prop-4', name: 'Sunrise Estates', address: '100 Sunrise Way, Suburbia', management_company: 'Sunrise HOA', units: 200, gates: 3, cameras: 12, open_jobs: 1, status: 'Active', systems: ['LiftMaster CAPXLV', 'Flock Safety'] },
    { id: 'prop-5', name: 'Kim Plaza', address: '500 Main St, Downtown', management_company: 'Kim Properties', units: 10, gates: 0, cameras: 16, open_jobs: 5, status: 'Critical', systems: ['Avigilon Alta', 'Salto Locks'] },
    { id: 'prop-6', name: 'Nexus Lofts', address: '300 Artist Row, Downtown', management_company: 'Nexus Co-op', units: 60, gates: 1, cameras: 5, open_jobs: 1, status: 'Active', systems: ['Latch', 'Verkada'] },
    { id: 'prop-7', name: 'Private Residence', address: '10 Gated Lane, Suburbia', management_company: null, units: 1, gates: 1, cameras: 2, open_jobs: 0, status: 'Active', systems: ['Viking Intercom'] },
    { id: 'prop-8', name: 'Lee Tower', address: '800 Tech Park, Business Dist', management_company: 'Lee Corporate', units: 0, gates: 4, cameras: 24, open_jobs: 3, status: 'Active', systems: ['LenelS2', 'Hanwha Techwin', 'Commend Intercom'] }
  ];
};

const glassPanel = { backgroundColor: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' };
const glassAction = { backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' };
const textPrimary = { color: 'rgba(255,255,255,0.9)' };
const textSecondary = { color: 'rgba(255,255,255,0.5)' };
const textFaint = { color: 'rgba(255,255,255,0.34)' };
const brandBlue = '#6B7EFF';
const brandCyan = '#00C8FF';
const brandViolet = '#8B5CF6';

export default function CustomerSiteFinder() {
  const [activeTab, setActiveTab] = useState<'Customers' | 'Properties'>('Customers');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadCustomers(), loadProperties()]).then(([cData, pData]) => { setCustomers(cData); setProperties(pData); setIsLoading(false); });
  }, []);

  const handleAction = (actionName: string, id: string) => { console.log(`Action: ${actionName} on ID: ${id}`); };

  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (activeTab === 'Customers') return customers.filter(c => c.name.toLowerCase().includes(q) || (c.company && c.company.toLowerCase().includes(q)));
    return properties.filter(p => p.name.toLowerCase().includes(q) || (p.address && p.address.toLowerCase().includes(q)) || (p.management_company && p.management_company.toLowerCase().includes(q)));
  }, [activeTab, searchQuery, customers, properties]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    if (selectedId.startsWith('cust-')) return customers.find(c => c.id === selectedId) ?? null;
    if (selectedId.startsWith('prop-')) return properties.find(p => p.id === selectedId) ?? null;
    return null;
  }, [selectedId, customers, properties]);

  const isCustomer = (item: Customer | Property): item is Customer => 'site_count' in item;

  const renderDetailPane = (item: Customer | Property) => {
    const isCust = isCustomer(item);
    return (
      <div className="flex flex-col lg:flex-row gap-6 p-4 md:p-6 w-full max-w-6xl mx-auto h-full">
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto pb-16">
          <div className="rounded-3xl p-6" style={glassPanel}>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide uppercase" style={{ backgroundColor: isCust ? 'rgba(107,126,255,0.1)' : 'rgba(0,200,255,0.1)', color: isCust ? brandBlue : brandCyan }}>{isCust ? 'Customer' : 'Property / Site'}</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgba(255,255,255,0.05)', ...textSecondary }}>{item.status}</span>
            </div>
            <h2 className="text-3xl font-semibold tracking-tight mb-2" style={textPrimary}>{item.name}</h2>
            <div className="flex items-center gap-2 text-sm" style={textSecondary}>
              {isCust ? (<><Briefcase size={16} /><span>{item.company || 'Independent'}</span></>) : (<><MapPin size={16} /><span>{item.address}</span>{item.management_company && (<><span className="mx-2" style={textFaint}>•</span><Building2 size={16} /><span>{item.management_company}</span></>)}</>)}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: isCust ? 'Properties' : 'Units', val: isCust ? item.site_count : item.units, icon: isCust ? <Building2 size={16} /> : <DoorOpen size={16} /> },
              { label: 'Open Jobs', val: item.open_jobs, icon: <Wrench size={16} /> },
              { label: isCust ? 'Contacts' : 'Gates / Doors', val: isCust ? item.contacts.length : item.gates, icon: isCust ? <Users size={16} /> : <MapPin size={16} /> },
              { label: isCust ? 'Status' : 'Cameras', val: isCust ? item.status : item.cameras, icon: isCust ? <Activity size={16} /> : <Camera size={16} /> }
            ].map((fact, i) => (
              <div key={i} className="rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-1" style={glassPanel}>
                <div style={textFaint}>{fact.icon}</div>
                <div className="text-2xl font-semibold mt-1" style={textPrimary}>{fact.val}</div>
                <div className="text-xs font-medium uppercase tracking-wider" style={textSecondary}>{fact.label}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl p-5" style={glassPanel}>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={textPrimary}>{isCust ? <Users size={16} style={{ color: brandBlue }} /> : <Wrench size={16} style={{ color: brandCyan }} />}{isCust ? 'Contacts' : 'Equipment / Systems'}</h3>
              <div className="flex flex-col gap-3">
                {isCust ? item.contacts.map((c, i) => (
                  <div key={i} className="flex justify-between items-center pb-3 border-b last:border-0 last:pb-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <div><div className="text-sm font-medium" style={textPrimary}>{c.name}</div><div className="text-xs mt-0.5" style={textSecondary}>{c.role || 'Contact'}</div></div>
                    {c.phone && <div className="text-xs" style={textSecondary}>{c.phone}</div>}
                  </div>
                )) : item.systems.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm pb-2 border-b last:border-0 last:pb-0" style={{ borderColor: 'rgba(255,255,255,0.05)', ...textSecondary }}><div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brandCyan }}></div>{s}</div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl p-5" style={glassPanel}>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={textPrimary}>{isCust ? <Building2 size={16} style={{ color: brandViolet }} /> : <ClipboardList size={16} style={{ color: brandViolet }} />}{isCust ? 'Properties / Sites' : 'Recent Activity'}</h3>
              <div className="flex flex-col gap-3">
                {isCust ? (item.sites.length > 0 ? item.sites.map((s, i) => (
                  <button key={i} onClick={() => setSelectedId(s.id)} className="flex items-center justify-between text-left pb-3 border-b last:border-0 last:pb-0 hover:opacity-80 transition-opacity" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <div><div className="text-sm font-medium" style={textPrimary}>{s.name}</div><div className="text-xs mt-0.5" style={textSecondary}>{s.address || `${s.units} units`}</div></div>
                    <ChevronRight size={14} style={textFaint} />
                  </button>
                )) : <div className="text-sm" style={textFaint}>No properties linked.</div>) : <div className="text-sm" style={textFaint}>Activity log would appear here…</div>}
              </div>
            </div>
          </div>
        </div>
        <div className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-3 pb-16">
          <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={textSecondary}>Actions</div>
          <button onClick={() => handleAction('Open Jobs', item.id)} className="w-full rounded-2xl p-3.5 flex items-center gap-3 text-sm font-medium transition-colors hover:bg-white/5" style={glassAction}><Wrench size={18} style={{ color: brandCyan }} /><span style={textPrimary}>Open Jobs</span></button>
          <button onClick={() => handleAction('New Quote', item.id)} className="w-full rounded-2xl p-3.5 flex items-center gap-3 text-sm font-medium transition-colors hover:bg-white/5" style={glassAction}><FileText size={18} style={{ color: brandViolet }} /><span style={textPrimary}>New Quote</span></button>
          <button onClick={() => handleAction(isCust ? 'Add Property' : 'Add Equipment', item.id)} className="w-full rounded-2xl p-3.5 flex items-center gap-3 text-sm font-medium transition-colors hover:bg-white/5" style={glassPanel}><Plus size={18} style={textSecondary} /><span style={textPrimary}>{isCust ? 'Add Property' : 'Add Equipment'}</span></button>
          <button onClick={() => handleAction('Add Note', item.id)} className="w-full rounded-2xl p-3.5 flex items-center gap-3 text-sm font-medium transition-colors hover:bg-white/5" style={glassPanel}><FileText size={18} style={textSecondary} /><span style={textPrimary}>Add Note</span></button>
          <button onClick={() => handleAction('Edit', item.id)} className="w-full rounded-2xl p-3.5 flex items-center gap-3 text-sm font-medium transition-colors hover:bg-white/5 mt-4" style={{ ...glassPanel, borderColor: 'rgba(255,255,255,0.04)', backgroundColor: 'transparent' }}><span className="w-full text-center" style={textSecondary}>Edit {isCust ? 'Customer' : 'Property'}</span></button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex w-full h-[78dvh] pb-4 font-sans overflow-hidden rounded-2xl" style={{ ...glassPanel }}>
      <div className={`w-full md:w-[380px] flex-shrink-0 flex-col border-r h-full ${selectedId ? 'hidden md:flex' : 'flex'}`} style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="p-5 flex flex-col gap-4 shrink-0">
          <h1 className="text-2xl font-semibold tracking-tight" style={textPrimary}>Directory</h1>
          <div className="flex items-center gap-1 p-1 rounded-2xl" style={glassPanel}>
            {(['Customers', 'Properties'] as const).map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab); setSelectedId(null); }} className="flex-1 py-1.5 text-sm font-medium rounded-xl transition-all" style={{ backgroundColor: activeTab === tab ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeTab === tab ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)' }}>{tab}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl" style={glassPanel}>
            <Search size={16} style={textSecondary} />
            <input type="text" placeholder={`Search ${activeTab.toLowerCase()}...`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full placeholder:text-white/30" style={textPrimary} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {isLoading ? (<div className="p-8 text-center text-sm" style={textSecondary}>Loading data…</div>) : filteredData.length === 0 ? (<div className="p-8 text-center text-sm" style={textSecondary}>No results found.</div>) : filteredData.map((item) => {
            const isCust = isCustomer(item);
            const isSelected = selectedId === item.id;
            return (
              <button key={item.id} onClick={() => setSelectedId(item.id)} className="w-full text-left p-4 rounded-2xl mb-2 flex items-start gap-4 transition-all" style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.06)' : glassPanel.backgroundColor, border: isSelected ? '1px solid rgba(255,255,255,0.15)' : glassPanel.border }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>{isCust ? <Users size={18} style={{ color: brandBlue }} /> : <Building2 size={18} style={{ color: brandCyan }} />}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-base truncate mb-0.5" style={textPrimary}>{item.name}</div>
                  <div className="text-xs truncate mb-2.5" style={textSecondary}>{isCust ? item.company || 'Independent' : (item as Property).address}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.open_jobs > 0 && (<div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: brandViolet }}>{item.open_jobs} Jobs</div>)}
                    {isCust ? (<div className="text-[11px]" style={textFaint}>{item.site_count} Sites</div>) : (<div className="text-[11px]" style={textFaint}>{(item as Property).units} Units</div>)}
                    {item.status === 'Critical' && (<div className="w-2 h-2 rounded-full bg-red-500 ml-auto" />)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className={`flex-1 flex-col h-full relative ${!selectedId ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
        {selectedId && (<div className="md:hidden flex items-center px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}><button onClick={() => setSelectedId(null)} className="flex items-center gap-2 text-sm font-medium" style={textPrimary}><ArrowLeft size={18} /> Back to list</button></div>)}
        {!selectedItem ? (
          <div className="text-center p-8 hidden md:block">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4" style={glassPanel}><Search size={24} style={textSecondary} /></div>
            <h3 className="text-lg font-medium mb-1" style={textPrimary}>Select a record</h3>
            <p className="text-sm" style={textSecondary}>Click a customer or property to view details.</p>
          </div>
        ) : renderDetailPane(selectedItem)}
      </div>
    </div>
  );
}
