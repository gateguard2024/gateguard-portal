'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import {
  FileText, Plus, Search, Send, Eye, CheckCircle2,
  XCircle, Clock, Copy, MoreHorizontal, Settings,
} from 'lucide-react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Edit2, TrendingUp, TrendingDown } = require('lucide-react') as any;
import { formatCurrency } from '@/lib/quote-calculator';
import { QuoteStatus } from '@/types/quote';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRow } from '@/components/ui/SkeletonRow';

// ── API quote shape ───────────────────────────────────────────────────────────
interface ApiQuote {
  id: string;
  quote_number: string;
  status: QuoteStatus;
  property_name: string | null;
  units: number | null;
  total_one_time: number;
  total_mrr: number;
  dealer_mrr: number;
  created_at: string;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
}

function toUiQuote(q: ApiQuote) {
  return {
    id:          q.id,
    quoteNumber: q.quote_number,
    status:      q.status,
    property: {
      name:  q.property_name ?? '(Untitled)',
      units: q.units ?? 0,
      city:  '',
      state: '',
    },
    totals: {
      setupTotal:   q.total_one_time,
      monthlyTotal: q.total_mrr,
      dealerMRR:    q.dealer_mrr,
    },
    createdAt:  q.created_at.slice(0, 10),
    sentAt:     q.sent_at?.slice(0, 10),
    acceptedAt: q.accepted_at?.slice(0, 10),
  };
}

const STATUS_CFG: Record<QuoteStatus, { label: string; color: string; Icon: React.ElementType }> = {
  draft:    { label: 'Draft',    color: 'text-zinc-500 bg-zinc-100 border-zinc-200',           Icon: FileText },
  sent:     { label: 'Sent',     color: 'text-blue-600 bg-blue-50 border-blue-200',            Icon: Send },
  viewed:   { label: 'Viewed',   color: 'text-violet-600 bg-violet-50 border-violet-200',      Icon: Eye },
  accepted: { label: 'Accepted', color: 'text-emerald-600 bg-emerald-50 border-emerald-200',   Icon: CheckCircle2 },
  declined: { label: 'Declined', color: 'text-red-600 bg-red-50 border-red-200',               Icon: XCircle },
  expired:  { label: 'Expired',  color: 'text-amber-600 bg-amber-50 border-amber-200',         Icon: Clock },
};

const PIPELINE_STAGES: QuoteStatus[] = ['draft', 'sent', 'viewed', 'accepted'];

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, color = '#6B7EFF', type = 'bar' }: {
  data: number[];
  color?: string;
  type?: 'bar' | 'line' | 'target';
}) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const w = 56;
  const h = 24;
  const barW = Math.floor(w / data.length) - 1;

  if (type === 'bar') {
    return (
      <svg width={w} height={h} className="shrink-0">
        {data.map((v, i) => {
          const bh = Math.max(2, Math.round((v / max) * h));
          return (
            <rect
              key={i}
              x={i * (barW + 1)}
              y={h - bh}
              width={barW}
              height={bh}
              rx={1}
              fill={color}
              opacity={0.7 + 0.3 * (i / (data.length - 1))}
            />
          );
        })}
      </svg>
    );
  }

  if (type === 'line') {
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - Math.round((v / max) * (h - 4)) - 2;
      return `${x},${y}`;
    });
    const area = `0,${h} ` + pts.join(' ') + ` ${w},${h}`;
    return (
      <svg width={w} height={h} className="shrink-0">
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#spark-fill)" />
        <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // target
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - Math.round((v / max) * (h - 4)) - 2;
    return `${x},${y}`;
  });
  const targetY = h - Math.round((0.8) * (h - 4)) - 2;
  return (
    <svg width={w} height={h} className="shrink-0">
      <line x1="0" y1={targetY} x2={w} y2={targetY} stroke="#10b981" strokeWidth="1" strokeDasharray="3,2" opacity={0.6} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3,2" />
    </svg>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, accent, sparkData, sparkColor, sparkType, delta, deltaUp,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
  sparkData?: number[];
  sparkColor?: string;
  sparkType?: 'bar' | 'line' | 'target';
  delta?: string;
  deltaUp?: boolean;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className={`text-2xl font-bold ${accent}`}>
            {value}
            <span className="text-sm font-normal text-slate-400">/mo</span>
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
        </div>
        {sparkData && (
          <Sparkline data={sparkData} color={sparkColor} type={sparkType} />
        )}
      </div>
      {delta !== undefined && (
        <div className="flex items-center gap-1">
          {deltaUp ? (
            <TrendingUp className="w-3 h-3 text-emerald-500" />
          ) : (
            <TrendingDown className="w-3 h-3 text-red-400" />
          )}
          <span className={`text-[10px] font-semibold ${deltaUp ? 'text-emerald-600' : 'text-red-500'}`}>
            {delta}
          </span>
          <span className="text-[10px] text-slate-400">vs last month</span>
        </div>
      )}
    </div>
  );
}

// ── Deal Velocity Panel ───────────────────────────────────────────────────────
function DealVelocityPanel({ quotes }: { quotes: ReturnType<typeof toUiQuote>[] }) {
  const funnelData = [
    { label: 'Created', count: quotes.length, pct: 100, color: 'bg-[#6B7EFF]' },
    { label: 'Sent',    count: quotes.filter(q => ['sent','viewed','accepted'].includes(q.status)).length, pct: 70, color: 'bg-violet-400' },
    { label: 'Viewed',  count: quotes.filter(q => ['viewed','accepted'].includes(q.status)).length,        pct: 45, color: 'bg-amber-400' },
    { label: 'Accepted',count: quotes.filter(q => q.status === 'accepted').length,                         pct: 15, color: 'bg-emerald-500' },
  ];
  const maxCount = Math.max(1, quotes.length);

  const velocityMetrics = [
    { label: 'Avg. Time to Sent',   value: '12h' },
    { label: 'Avg. Time to View',   value: '2d'  },
    { label: 'Avg. Time to Accept', value: '5d'  },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">Quote Conversion</p>
        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Last 90d</span>
      </div>

      {/* Funnel bars */}
      <div className="space-y-2">
        {funnelData.map((row) => {
          const pct = Math.max(4, Math.round((row.count / maxCount) * 100));
          return (
            <div key={row.label} className="flex items-center gap-3">
              <span className="w-16 text-[11px] text-slate-500 font-medium shrink-0">{row.label}</span>
              <div className="flex-1 h-[6px] bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${row.color} opacity-80 transition-all duration-500`} style={{ width: `${pct}%` }} />
              </div>
              <span className="w-5 text-[11px] text-slate-500 font-mono text-right shrink-0">{row.count}</span>
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-slate-100" />

      {/* Velocity metrics */}
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest -mb-2">Deal Velocity</p>
      <div className="grid grid-cols-3 gap-2">
        {velocityMetrics.map(m => (
          <div key={m.label} className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex flex-col gap-0.5">
            <p className="text-[10px] text-slate-400 leading-tight">{m.label}</p>
            <p className="text-base font-bold text-slate-800">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Win rate */}
      <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
        <span className="text-xs text-slate-500">Win Rate</span>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full"
              style={{ width: `${quotes.length ? Math.round((quotes.filter(q=>q.status==='accepted').length / quotes.length) * 100) : 0}%` }}
            />
          </div>
          <span className="text-xs font-bold text-emerald-600">
            {quotes.length ? Math.round((quotes.filter(q=>q.status==='accepted').length / quotes.length) * 100) : 0}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function QuotesPage() {
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<QuoteStatus | 'all'>('all');
  const [quotes, setQuotes]   = useState<ReturnType<typeof toUiQuote>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/quotes');
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setQuotes((data.records ?? []).map(toUiQuote));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load quotes');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = quotes.filter(q =>
    (filter === 'all' || q.status === filter) &&
    (q.property.name.toLowerCase().includes(search.toLowerCase()) ||
     q.quoteNumber.toLowerCase().includes(search.toLowerCase()))
  );

  const totalMRR    = quotes.filter(q => q.status === 'accepted').reduce((s, q) => s + q.totals.monthlyTotal, 0);
  const pipelineMRR = quotes.filter(q => ['sent','viewed'].includes(q.status)).reduce((s, q) => s + q.totals.monthlyTotal, 0);
  const totalDealer = quotes.filter(q => q.status === 'accepted').reduce((s, q) => s + q.totals.dealerMRR, 0);

  // Mock sparkline data (replace with real trend data when available)
  const mrrSpark    = [420, 480, 510, 490, 560, 580, Math.max(totalMRR, 600)];
  const pipeSpark   = [900, 1100, 850, 1300, 1050, 1200, Math.max(pipelineMRR, 1250)];
  const dealerSpark = [80, 95, 88, 102, 110, 98, Math.max(totalDealer, 105)];

  // Pipeline funnel
  const maxPipeline = Math.max(1, ...PIPELINE_STAGES.map(s =>
    quotes.filter(q => q.status === s).reduce((sum, q) => sum + q.totals.monthlyTotal, 0)
  ));

  // Filter tabs with counts
  const tabFilters: { key: QuoteStatus | 'all'; label: string }[] = [
    { key: 'all',      label: 'All' },
    { key: 'draft',    label: 'Draft' },
    { key: 'sent',     label: 'Sent' },
    { key: 'viewed',   label: 'Viewed' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'declined', label: 'Declined' },
  ];

  const newQuoteAction = (
    <Link
      href="/quotes/new"
      className="flex items-center gap-2 bg-[#6B7EFF] hover:bg-[#5a6df0] text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
    >
      <Plus className="w-4 h-4" />
      New Quote
    </Link>
  );

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Quotes & Proposals"
        subtitle="Build proposals, track pipeline, close deals"
        actions={newQuoteAction}
      />
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto w-full">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Active MRR"
          value={formatCurrency(totalMRR)}
          sub={`${quotes.filter(q => q.status === 'accepted').length} active contracts`}
          accent="text-emerald-600"
          sparkData={mrrSpark}
          sparkColor="#10b981"
          sparkType="bar"
          delta="↑ 2%"
          deltaUp
        />
        <KpiCard
          label="Pipeline MRR"
          value={formatCurrency(pipelineMRR)}
          sub={`${quotes.filter(q => ['sent','viewed'].includes(q.status)).length} proposals out`}
          accent="text-[#6B7EFF]"
          sparkData={pipeSpark}
          sparkColor="#6B7EFF"
          sparkType="line"
          delta="↑ 12%"
          deltaUp
        />
        <KpiCard
          label="Dealer Override MRR"
          value={formatCurrency(totalDealer)}
          sub="Up to $2.50/unit/mo"
          accent="text-violet-600"
          sparkData={dealerSpark}
          sparkColor="#7c3aed"
          sparkType="target"
          delta="0% of Goal"
          deltaUp={false}
        />
      </div>

      {/* ── Pipeline Funnel ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-slate-800">Quotes Pipeline</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#6B7EFF]" />
            <span className="text-[10px] text-slate-400">Click stage to filter</span>
          </div>
        </div>
        <div className="space-y-1.5">
          {PIPELINE_STAGES.map((stage) => {
            const cfg = STATUS_CFG[stage];
            const Icon = cfg.Icon;
            const stageQuotes = quotes.filter(q => q.status === stage);
            const total = stageQuotes.reduce((s, q) => s + q.totals.monthlyTotal, 0);
            const pct   = Math.max(4, Math.round((total / maxPipeline) * 100));
            const barColors: Record<string, string> = {
              draft:    'bg-slate-400',
              sent:     'bg-[#6B7EFF]',
              viewed:   'bg-violet-400',
              accepted: 'bg-emerald-500',
            };
            const active = filter === stage;
            return (
              <button
                key={stage}
                onClick={() => setFilter(active ? 'all' : stage)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                  active ? 'bg-[#6B7EFF]/5 ring-1 ring-[#6B7EFF]/20' : 'hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${cfg.color.split(' ')[0]}`} />
                <span className="w-20 shrink-0 text-xs font-medium text-slate-600">{cfg.label}</span>
                <div className="flex-1 h-[6px] bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full opacity-80 transition-all duration-500 ${barColors[stage] ?? 'bg-slate-300'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-6 text-[11px] font-mono text-slate-400 text-right shrink-0">{stageQuotes.length}</span>
                <span className="w-20 text-xs font-semibold text-slate-700 text-right shrink-0">{formatCurrency(total)}/mo</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Bottom: Table + Velocity ── */}
      <div className="grid grid-cols-[1fr_280px] gap-4 items-start">

        {/* ── Left: Search + Filter + Table ── */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">

          {/* Search + tabs */}
          <div className="px-4 pt-4 pb-0 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search property or quote number..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] focus:border-[#6B7EFF]"
                />
              </div>
              <button className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-400 hover:text-slate-600 transition-colors">
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-0.5 border-b border-slate-100">
              {tabFilters.map(t => {
                const count = t.key === 'all' ? quotes.length : quotes.filter(q => q.status === t.key).length;
                const active = filter === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setFilter(t.key)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                      active
                        ? 'border-[#6B7EFF] text-[#6B7EFF]'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t.label}
                    <span className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                      active ? 'bg-[#6B7EFF]/10 text-[#6B7EFF]' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="p-4"><SkeletonRow rows={5} cols={6} /></div>
          ) : error ? (
            <div className="flex items-center justify-center gap-2 py-16 text-red-500">
              <span className="text-sm">{error}</span>
            </div>
          ) : filtered.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  {['Quote #', 'Property', 'Status', 'Setup', 'Monthly', 'Date', ''].map((h, i) => (
                    <th
                      key={i}
                      className={`text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-4 py-2.5 ${
                        i >= 3 && i <= 4 ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(q => {
                  const cfg = STATUS_CFG[q.status];
                  const Icon = cfg.Icon;
                  return (
                    <tr key={q.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="px-4 py-3">
                        <p className="text-xs font-mono text-[#6B7EFF] font-semibold">{q.quoteNumber}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-slate-800">{q.property.name}</p>
                        {q.property.units > 0 && (
                          <p className="text-[10px] text-slate-400">{q.property.units} units</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color}`}>
                          <Icon className="w-2.5 h-2.5" />{cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-xs font-medium text-slate-700">{formatCurrency(q.totals.setupTotal)}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-xs font-semibold text-slate-800">{formatCurrency(q.totals.monthlyTotal)}</p>
                        <p className="text-[10px] text-slate-400">/mo</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[10px] text-slate-400">{q.createdAt}</p>
                        {q.acceptedAt && <p className="text-[10px] text-emerald-600 font-medium">Signed {q.acceptedAt}</p>}
                        {q.sentAt && !q.acceptedAt && <p className="text-[10px] text-blue-500">Sent {q.sentAt}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                          <Link
                            href={`/quotes/${q.id}`}
                            className="p-1.5 rounded-md hover:bg-[#6B7EFF]/10 text-slate-400 hover:text-[#6B7EFF] transition-colors"
                            title="View Quote"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                          <Link
                            href={`/quotes/${q.id}`}
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                            title="Edit Quote"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                            title="Copy link"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState
              icon={<FileText size={32} className="text-slate-300" />}
              title="No quotes yet"
              description="Build your first proposal to start closing deals"
              action={{ label: 'New Quote', onClick: () => { window.location.href = '/quotes/new'; } }}
            />
          )}
        </div>

        {/* ── Right: Deal Velocity ── */}
        <DealVelocityPanel quotes={quotes} />
      </div>
      </div>
    </div>
  );
}
