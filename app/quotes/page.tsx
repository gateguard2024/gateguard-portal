'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  FileText, Plus, Search, Send, Eye, CheckCircle2,
  XCircle, Clock, Copy, MoreHorizontal, ChevronRight, Loader2,
} from 'lucide-react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowUpRight } = require('lucide-react') as any;
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

// Map API shape to UI shape
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
  draft:    { label: 'Draft',    color: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',         Icon: FileText },
  sent:     { label: 'Sent',     color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',         Icon: Send },
  viewed:   { label: 'Viewed',   color: 'text-brand-400 bg-brand-400/10 border-brand-400/20',      Icon: Eye },
  accepted: { label: 'Accepted', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', Icon: CheckCircle2 },
  declined: { label: 'Declined', color: 'text-red-400 bg-red-400/10 border-red-400/20',            Icon: XCircle },
  expired:  { label: 'Expired',  color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',      Icon: Clock },
};

const PIPELINE: { status: QuoteStatus; label: string }[] = [
  { status: 'draft', label: 'Draft' },
  { status: 'sent', label: 'Sent' },
  { status: 'viewed', label: 'Viewed' },
  { status: 'accepted', label: 'Accepted' },
];

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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quotes & Proposals</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Build proposals, track pipeline, close deals</p>
        </div>
        <Link
          href="/quotes/new"
          className="flex items-center gap-2 bg-brand-400 hover:bg-brand-500 text-navy font-semibold px-4 py-2 rounded-lg transition-colors gg-glow text-sm"
        >
          <Plus className="w-4 h-4" />
          New Quote
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active MRR', value: formatCurrency(totalMRR), sub: `${quotes.filter(q=>q.status==='accepted').length} contracts`, color: 'text-emerald-400' },
          { label: 'Pipeline MRR', value: formatCurrency(pipelineMRR), sub: `${quotes.filter(q=>['sent','viewed'].includes(q.status)).length} proposals out`, color: 'text-brand-400' },
          { label: 'Dealer Override MRR', value: formatCurrency(totalDealer), sub: 'Up to $2.50/unit/mo', color: 'text-violet-400' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color} mt-1`}>{kpi.value}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Pipeline funnel */}
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-sm font-semibold text-foreground mb-4">Pipeline</p>
        <div className="grid grid-cols-4 gap-0">
          {PIPELINE.map((stage, i) => {
            const cfg = STATUS_CFG[stage.status];
            const Icon = cfg.Icon;
            const count = quotes.filter(q => q.status === stage.status).length;
            const mrr = quotes.filter(q => q.status === stage.status).reduce((s,q) => s + q.totals.monthlyTotal, 0);
            const active = filter === stage.status;
            return (
              <div key={stage.status} className="flex items-stretch">
                <button
                  onClick={() => setFilter(active ? 'all' : stage.status)}
                  className={`flex-1 p-4 border-y border-l last:border-r transition-all
                    ${i === 0 ? 'rounded-l-lg' : ''} ${i === 3 ? 'rounded-r-lg' : ''}
                    ${active ? 'border-brand-400/40 bg-brand-400/5' : 'border-border bg-background/40 hover:bg-card/80'}`}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon className={`w-3.5 h-3.5 ${cfg.color.split(' ')[0]}`} />
                    <span className="text-xs text-muted-foreground">{stage.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{count}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(mrr)}/mo</p>
                </button>
                {i < 3 && <div className="flex items-center"><ChevronRight className="w-4 h-4 text-border -mx-2 z-10" /></div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search property or quote number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>
        <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
          {(['all','draft','sent','viewed','accepted','declined'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${filter === s ? 'bg-brand-400 text-navy' : 'text-muted-foreground hover:text-foreground'}`}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <SkeletonRow rows={5} cols={7} />
        ) : error ? (
          <div className="flex items-center justify-center gap-2 py-16 text-red-400">
            <span className="text-sm">{error}</span>
          </div>
        ) : filtered.length > 0 ? (
          <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-background/50">
              {['Quote #','Property','Status','Setup','Monthly','Dealer MRR','Date',''].map((h,i) => (
                <th key={i} className={`text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 py-3 ${i >= 3 && i <= 5 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(q => {
              const cfg = STATUS_CFG[q.status];
              const Icon = cfg.Icon;
              return (
                <tr key={q.id} className="hover:bg-background/40 transition-colors group">
                  <td className="px-4 py-4"><p className="text-sm font-mono text-brand-400">{q.quoteNumber}</p></td>
                  <td className="px-4 py-4">
                    <p className="text-sm font-medium text-foreground">{q.property.name}</p>
                    {(q.property.city || q.property.state || q.property.units > 0) && (
                      <p className="text-xs text-muted-foreground">
                        {[q.property.city, q.property.state].filter(Boolean).join(', ')}
                        {q.property.units > 0 && `${q.property.city || q.property.state ? ' · ' : ''}${q.property.units} units`}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                      <Icon className="w-3 h-3" />{cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right"><p className="text-sm font-medium text-foreground">{formatCurrency(q.totals.setupTotal)}</p></td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-sm font-medium text-foreground">{formatCurrency(q.totals.monthlyTotal)}</p>
                    <p className="text-xs text-muted-foreground">/mo</p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-sm font-medium text-violet-400">{formatCurrency(q.totals.dealerMRR)}</p>
                    <p className="text-xs text-muted-foreground">/mo</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-xs text-muted-foreground">{q.createdAt}</p>
                    {q.acceptedAt && <p className="text-xs text-emerald-400">Accepted {q.acceptedAt}</p>}
                    {q.sentAt && !q.acceptedAt && <p className="text-xs text-blue-400">Sent {q.sentAt}</p>}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/quotes/${q.id}`} className="p-1.5 rounded hover:bg-brand-400/10 text-muted-foreground hover:text-brand-400 transition-colors" title="View Quote">
                        <ArrowUpRight className="w-4 h-4" />
                      </Link>
                      <button className="p-1.5 rounded hover:bg-border text-muted-foreground hover:text-foreground transition-colors" title="Copy link">
                        <Copy className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-border text-muted-foreground hover:text-foreground transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
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
            icon={<FileText size={32} className="text-muted-foreground" />}
            title="No quotes yet"
            description="Build your first proposal to start closing deals"
            action={{ label: 'New Quote', onClick: () => window.location.href = '/quotes/new' }}
          />
        )}
      </div>
    </div>
  );
}
