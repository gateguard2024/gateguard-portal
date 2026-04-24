'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  FileText, Plus, Search, Send, Eye, CheckCircle2,
  XCircle, Clock, Copy, MoreHorizontal, ArrowUpRight, ChevronRight,
} from 'lucide-react';
import { formatCurrency } from '@/lib/quote-calculator';
import { QuoteStatus } from '@/types/quote';

// ── Mock data ────────────────────────────────────────────────────────────────
const MOCK_QUOTES = [
  {
    id: 'q1', quoteNumber: 'GG-2026-0041', status: 'accepted' as QuoteStatus,
    property: { name: 'East Ponce Village', units: 312, city: 'Atlanta', state: 'GA' },
    totals: { setupTotal: 6250, monthlyTotal: 3820, dealerMRR: 625 },
    createdAt: '2026-04-10', sentAt: '2026-04-11', acceptedAt: '2026-04-14',
  },
  {
    id: 'q2', quoteNumber: 'GG-2026-0042', status: 'viewed' as QuoteStatus,
    property: { name: 'The Villages on Riverwalk', units: 248, city: 'Augusta', state: 'GA' },
    totals: { setupTotal: 4500, monthlyTotal: 2980, dealerMRR: 497 },
    createdAt: '2026-04-16', sentAt: '2026-04-17', acceptedAt: undefined,
  },
  {
    id: 'q3', quoteNumber: 'GG-2026-0043', status: 'sent' as QuoteStatus,
    property: { name: 'Columbia Residential — Kirk Edwards', units: 180, city: 'Columbia', state: 'SC' },
    totals: { setupTotal: 3750, monthlyTotal: 1900, dealerMRR: 375 },
    createdAt: '2026-04-19', sentAt: '2026-04-20', acceptedAt: undefined,
  },
  {
    id: 'q4', quoteNumber: 'GG-2026-0044', status: 'draft' as QuoteStatus,
    property: { name: '92W Paces — Camera Upgrade', units: 0, city: 'Atlanta', state: 'GA' },
    totals: { setupTotal: 8500, monthlyTotal: 1200, dealerMRR: 0 },
    createdAt: '2026-04-22', sentAt: undefined, acceptedAt: undefined,
  },
  {
    id: 'q5', quoteNumber: 'GG-2026-0045', status: 'draft' as QuoteStatus,
    property: { name: 'Stonegate Townhomes', units: 96, city: 'Savannah', state: 'GA' },
    totals: { setupTotal: 2250, monthlyTotal: 1200, dealerMRR: 200 },
    createdAt: '2026-04-23', sentAt: undefined, acceptedAt: undefined,
  },
  {
    id: 'q6', quoteNumber: 'GG-2026-0039', status: 'declined' as QuoteStatus,
    property: { name: 'Peachtree Commons', units: 220, city: 'Atlanta', state: 'GA' },
    totals: { setupTotal: 5000, monthlyTotal: 2400, dealerMRR: 440 },
    createdAt: '2026-04-02', sentAt: '2026-04-03', acceptedAt: undefined,
  },
];

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
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<QuoteStatus | 'all'>('all');

  const filtered = MOCK_QUOTES.filter(q =>
    (filter === 'all' || q.status === filter) &&
    (q.property.name.toLowerCase().includes(search.toLowerCase()) ||
     q.quoteNumber.toLowerCase().includes(search.toLowerCase()))
  );

  const totalMRR      = MOCK_QUOTES.filter(q => q.status === 'accepted').reduce((s, q) => s + q.totals.monthlyTotal, 0);
  const pipelineMRR   = MOCK_QUOTES.filter(q => ['sent','viewed'].includes(q.status)).reduce((s, q) => s + q.totals.monthlyTotal, 0);
  const totalDealer   = MOCK_QUOTES.filter(q => q.status === 'accepted').reduce((s, q) => s + q.totals.dealerMRR, 0);

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
          { label: 'Active MRR', value: formatCurrency(totalMRR), sub: `${MOCK_QUOTES.filter(q=>q.status==='accepted').length} contracts`, color: 'text-emerald-400' },
          { label: 'Pipeline MRR', value: formatCurrency(pipelineMRR), sub: `${MOCK_QUOTES.filter(q=>['sent','viewed'].includes(q.status)).length} proposals out`, color: 'text-brand-400' },
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
            const count = MOCK_QUOTES.filter(q => q.status === stage.status).length;
            const mrr = MOCK_QUOTES.filter(q => q.status === stage.status).reduce((s,q) => s + q.totals.monthlyTotal, 0);
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
                    <p className="text-xs text-muted-foreground">{q.property.city}, {q.property.state}{q.property.units > 0 && ` · ${q.property.units} units`}</p>
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
                      <Link href={`/quotes/${q.id}/proposal`} className="p-1.5 rounded hover:bg-brand-400/10 text-muted-foreground hover:text-brand-400 transition-colors" title="View Proposal">
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
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No quotes found</p>
            <p className="text-sm mt-1">Try adjusting your search or filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
