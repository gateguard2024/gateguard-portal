'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Building2,
  User,
  MapPin,
  ChevronRight,
  Plus,
  FileText
} from 'lucide-react';
// Vercel lucide cache quirk — load these via require()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowLeft, Briefcase } = require('lucide-react') as any;
// --- Data Contracts ---
type ResultType = 'company' | 'contact' | 'customer' | 'property' | 'site';
type SearchResult = {
  id: string;
  type: ResultType;
  title: string;
  subtitle: string;
  meta?: string;
  href?: string;
};
type DetailResponse = {
  type: ResultType;
  id: string;
  title: string;
  subtitle: string;
  details: { label: string; value: string }[];
};
// --- Preview fallback data (used only if the API is unreachable) ---
const MOCK_RESULTS: SearchResult[] = [
  { id: 'c1', type: 'customer', title: 'Avalon Management', subtitle: 'Regional Property Management', meta: '12 Properties' },
  { id: 'p1', type: 'property', title: 'Avalon Heights', subtitle: '123 Heights Blvd, Cityville', meta: '120 Units' },
  { id: 's1', type: 'site', title: 'Avalon Heights - North Gate', subtitle: 'Primary entrance', meta: 'Online' },
  { id: 'co1', type: 'company', title: 'Kim Landscaping', subtitle: 'Vendor', meta: 'Active' },
  { id: 'ct1', type: 'contact', title: 'Sarah Jenkins', subtitle: 'Regional Manager • Avalon', meta: '(555) 123-4567' },
];
// --- Real API: search-as-you-type + detail (preview fallback on error) ---
const searchAll = async (query: string): Promise<SearchResult[]> => {
  try {
    const res = await fetch(`/api/nexus/customers-sites/search?q=${encodeURIComponent(query)}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results)) return data.results as SearchResult[];
    }
  } catch {
    /* fall through to preview */
  }
  const q = query.toLowerCase();
  return MOCK_RESULTS.filter(r => r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q));
};
const loadDetail = async (type: ResultType, id: string): Promise<DetailResponse> => {
  try {
    const res = await fetch(`/api/nexus/customers-sites/detail?type=${type}&id=${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.detail) return data.detail as DetailResponse;
    }
  } catch {
    /* fall through to preview */
  }
  const base = MOCK_RESULTS.find(r => r.id === id && r.type === type);
  return {
    type,
    id,
    title: base?.title ?? 'Record',
    subtitle: base?.subtitle ?? '',
    details: [{ label: 'Status', value: 'No live data available' }],
  };
};
// --- Theme Styles ---
const glassPanel = { backgroundColor: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' };
const glassAction = { backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' };
const textPrimary = { color: 'rgba(255,255,255,0.9)' };
const textSecondary = { color: 'rgba(255,255,255,0.5)' };
const textFaint = { color: 'rgba(255,255,255,0.34)' };
const brandBlue = '#6B7EFF';
const brandCyan = '#00C8FF';
const FILTERS = ['All', 'Customers', 'Properties', 'Companies', 'Contacts', 'Sites'] as const;
type FilterType = typeof FILTERS[number];
const getTypeIcon = (type: ResultType) => {
  switch (type) {
    case 'customer': return <Building2 size={16} />;
    case 'property': return <Building2 size={16} />;
    case 'company': return <Briefcase size={16} />;
    case 'contact': return <User size={16} />;
    case 'site': return <MapPin size={16} />;
  }
};
const getTypeColor = (type: ResultType) => {
  switch (type) {
    case 'customer': return brandBlue;
    case 'property': return brandCyan;
    case 'company': return '#F59E0B'; // Amber
    case 'contact': return '#8B5CF6'; // Violet
    case 'site': return '#34D399'; // Emerald
  }
};
export default function CustomerSiteFinder() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [selectedItem, setSelectedItem] = useState<{ type: ResultType, id: string } | null>(null);
  const [detailData, setDetailData] = useState<DetailResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  // Debounce input
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedQuery(query); }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  // Execute search
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      setIsSearching(true);
      searchAll(debouncedQuery).then(res => { setResults(res); setIsSearching(false); });
    } else {
      setResults([]);
      setIsSearching(false);
    }
  }, [debouncedQuery]);
  // Load detail pane
  useEffect(() => {
    if (selectedItem) {
      setIsLoadingDetail(true);
      setDetailData(null);
      loadDetail(selectedItem.type, selectedItem.id).then(data => { setDetailData(data); setIsLoadingDetail(false); });
    } else {
      setDetailData(null);
    }
  }, [selectedItem]);
  const handleAction = (name: string, ref: { type: ResultType, id: string }) => {
    console.log(`Action: ${name} on`, ref);
  };
  const filteredResults = useMemo(() => {
    if (activeFilter === 'All') return results;
    const mappedFilter = activeFilter.toLowerCase().slice(0, -1); // 'Customers' -> 'customer'
    return results.filter(r => r.type.includes(mappedFilter) || (activeFilter === 'Companies' && r.type === 'company') || (activeFilter === 'Properties' && r.type === 'property'));
  }, [results, activeFilter]);
  // Render detail right pane
  const renderDetailPane = () => {
    if (!selectedItem) {
      return (
        <div className="flex-1 flex-col items-center justify-center p-8 text-center hidden md:flex">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4" style={glassPanel}>
            <Search size={24} style={textSecondary} />
          </div>
          <h3 className="text-lg font-medium mb-1" style={textPrimary}>Search Directory</h3>
          <p className="text-sm max-w-[250px]" style={textSecondary}>
            Search a customer, property, company, or contact to view their details.
          </p>
        </div>
      );
    }
    if (isLoadingDetail || !detailData) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" style={textSecondary}>
          Loading details...
        </div>
      );
    }
    const typeColor = getTypeColor(detailData.type);
    return (
      <div className="flex-1 flex flex-col h-full overflow-y-auto hide-scrollbar">
        {/* Mobile Back Button */}
        <div className="md:hidden flex items-center px-4 py-3 border-b flex-shrink-0 sticky top-0 z-10 bg-black/40 backdrop-blur-md" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <button onClick={() => setSelectedItem(null)} className="flex items-center gap-2 text-sm font-medium" style={textPrimary}>
            <ArrowLeft size={18} /> Back to results
          </button>
        </div>
        <div className="flex flex-col lg:flex-row gap-6 p-4 md:p-6 pb-20">

          {/* Main Content */}
          <div className="flex-1 flex flex-col gap-6">

            {/* 1. Big top card */}
            <div className="rounded-3xl p-6" style={glassPanel}>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5" style={{ backgroundColor: `${typeColor}1A`, color: typeColor }}>
                  {getTypeIcon(detailData.type)} {detailData.type}
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-1" style={textPrimary}>
                {detailData.title}
              </h2>
              <div className="text-sm font-medium" style={textSecondary}>
                {detailData.subtitle}
              </div>
            </div>
            {/* 2. Details Rows */}
            <div className="rounded-2xl p-2" style={glassPanel}>
              <h3 className="px-4 pt-3 pb-2 text-xs font-semibold tracking-wider uppercase" style={textSecondary}>
                Record Details
              </h3>
              <div className="flex flex-col">
                {detailData.details.map((row, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <span className="text-sm font-medium" style={textSecondary}>{row.label}</span>
                    <span className="text-sm mt-1 sm:mt-0 text-right" style={textPrimary}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* 3. Action Rail */}
          <div className="w-full lg:w-56 flex-shrink-0 flex flex-col gap-3">
            <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={textSecondary}>Actions</div>

            <button onClick={() => handleAction('open_record', selectedItem)} className="w-full rounded-2xl p-3.5 flex items-center gap-3 text-sm font-medium transition-colors hover:bg-white/5" style={glassAction}>
              <ChevronRight size={18} style={{ color: brandBlue }} />
              <span style={textPrimary}>Open Record</span>
            </button>

            <button onClick={() => handleAction('new_quote', selectedItem)} className="w-full rounded-2xl p-3.5 flex items-center gap-3 text-sm font-medium transition-colors hover:bg-white/5" style={glassPanel}>
              <FileText size={18} style={textSecondary} />
              <span style={textPrimary}>New Quote</span>
            </button>
            <button onClick={() => handleAction('new_job', selectedItem)} className="w-full rounded-2xl p-3.5 flex items-center gap-3 text-sm font-medium transition-colors hover:bg-white/5" style={glassPanel}>
              <Plus size={18} style={textSecondary} />
              <span style={textPrimary}>New Job</span>
            </button>
            <button onClick={() => handleAction('add_note', selectedItem)} className="w-full rounded-2xl p-3.5 flex items-center gap-3 text-sm font-medium transition-colors hover:bg-white/5" style={glassPanel}>
              <FileText size={18} style={textSecondary} />
              <span style={textPrimary}>Add Note</span>
            </button>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="flex w-full h-[70dvh] overflow-hidden rounded-3xl font-sans" style={glassPanel}>

      {/* LEFT PANE: Search & List */}
      <div
        className={`w-full md:w-[380px] flex-shrink-0 flex-col border-r h-full bg-black/20 ${selectedItem ? 'hidden md:flex' : 'flex'}`}
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
      >
        {/* Search Header */}
        <div className="p-4 flex flex-col gap-4 flex-shrink-0 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl" style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Search size={16} style={textSecondary} />
            <input
              type="text"
              placeholder="Search anything..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm w-full placeholder:text-white/30 font-medium"
              style={textPrimary}
            />
          </div>
          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-1">
            {FILTERS.map(filter => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wide whitespace-nowrap transition-colors"
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
        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 hide-scrollbar">
          {debouncedQuery.length < 2 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4 opacity-70">
              <Search size={24} style={textFaint} className="mb-3" />
              <p className="text-sm font-medium" style={textSecondary}>Type to search</p>
              <p className="text-xs mt-1" style={textFaint}>Find customers, properties, or contacts.</p>
            </div>
          ) : isSearching ? (
            <div className="text-center p-8 text-sm" style={textSecondary}>Searching...</div>
          ) : filteredResults.length === 0 ? (
            <div className="text-center p-8 text-sm" style={textSecondary}>No matches yet.</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filteredResults.map(res => {
                const isSelected = selectedItem?.id === res.id && selectedItem?.type === res.type;
                const typeColor = getTypeColor(res.type);

                return (
                  <button
                    key={`${res.type}-${res.id}`}
                    onClick={() => setSelectedItem({ type: res.type, id: res.id })}
                    className="w-full text-left p-3 rounded-2xl flex items-center gap-3 transition-all group"
                    style={{
                      backgroundColor: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                      border: isSelected ? `1px solid rgba(255,255,255,0.1)` : '1px solid transparent'
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-white/5"
                      style={{ backgroundColor: isSelected ? `${typeColor}1A` : 'rgba(255,255,255,0.03)', color: isSelected ? typeColor : textSecondary.color }}
                    >
                      {getTypeIcon(res.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate" style={textPrimary}>{res.title}</div>
                      <div className="text-xs truncate mt-0.5" style={textSecondary}>{res.subtitle}</div>
                    </div>
                    {res.meta && (
                      <div className="text-[10px] font-medium px-2 py-1 rounded-md bg-white/5 flex-shrink-0" style={textFaint}>
                        {res.meta}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {/* RIGHT PANE: Detail View */}
      <div className={`flex-1 bg-black/40 relative ${!selectedItem ? 'hidden md:flex' : 'flex'}`}>
        {renderDetailPane()}
      </div>
    </div>
  );
}
