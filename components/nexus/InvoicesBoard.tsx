'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { FileText, CheckCircle2, Clock, X, Send, MessageSquare } from 'lucide-react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { AlertCircle } = require('lucide-react') as any;

type InvoiceStatus = 'open' | 'overdue' | 'paid' | 'draft' | 'void';
type Invoice = {
  id: string;
  invoice_number: string;
  customer_name: string | null;
  property_name?: string | null;
  amount: number;
  status: InvoiceStatus;
  due_date: string | null;
  sent_at?: string | null;
};

// Normalize the API's freeform status + bucket into the board's status set.
const normalizeStatus = (s: string | null | undefined, bucket: string | null | undefined, paidAt: string | null | undefined): InvoiceStatus => {
  const v = (s ?? '').toLowerCase();
  if (v === 'paid' || paidAt || bucket === 'recently_paid') return 'paid';
  if (v === 'void') return 'void';
  if (v === 'draft') return 'draft';
  if (v === 'overdue' || bucket === 'past_due') return 'overdue';
  return 'open';
};
// Real billing API (GET /api/nexus/money-docs/invoices → { invoices: InvoiceCard[] }),
// with a small preview fallback so the panel still renders if the call fails.
const loadInvoices = async (): Promise<Invoice[]> => {
  try {
    const res = await fetch('/api/nexus/money-docs/invoices', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.invoices)) {
        return data.invoices.map((c: any): Invoice => ({
          id: c.id,
          invoice_number: c.invoice_number ?? 'Invoice',
          customer_name: c.customer_name ?? null,
          property_name: null,
          amount: typeof c.amount === 'number' ? c.amount : Number(c.amount) || 0,
          status: normalizeStatus(c.status, c.bucket, c.paid_at),
          due_date: c.due_date ? String(c.due_date).slice(0, 10) : null,
          sent_at: c.paid_at ? String(c.paid_at).slice(0, 10) : null,
        }));
      }
    }
  } catch {
    /* fall through to preview */
  }
  const today = new Date();
  const pastDate = (days: number) => { const d = new Date(); d.setDate(today.getDate() - days); return d.toISOString().split('T')[0]; };
  const futureDate = (days: number) => { const d = new Date(); d.setDate(today.getDate() + days); return d.toISOString().split('T')[0]; };
  return [
    { id: 'inv-102', invoice_number: 'INV-2026-002', customer_name: 'Michael Chen', property_name: 'The Beacon', amount: 850.50, status: 'overdue', due_date: pastDate(2), sent_at: pastDate(16) },
    { id: 'inv-103', invoice_number: 'INV-2026-003', customer_name: 'Amanda Torres', property_name: 'Sunrise Estates', amount: 3200.00, status: 'open', due_date: futureDate(10), sent_at: pastDate(1) },
    { id: 'inv-105', invoice_number: 'INV-2026-005', customer_name: 'Robert Smith', property_name: null, amount: 150.00, status: 'paid', due_date: pastDate(10), sent_at: pastDate(25) },
  ];
};

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
const formatDate = (dateString: string | null) => { if (!dateString) return 'No date'; const [year, month, day] = dateString.split('-'); return `${month}/${day}/${year}`; };
const getStatusConfig = (status: InvoiceStatus) => {
  switch (status) {
    case 'paid': return { color: '#34D399', bg: 'rgba(52,211,153,0.1)', label: 'Paid', icon: CheckCircle2 };
    case 'open': return { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', label: 'Open', icon: Clock };
    case 'overdue': return { color: '#F87171', bg: 'rgba(248,113,113,0.1)', label: 'Overdue', icon: AlertCircle };
    default: return { color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.05)', label: status.charAt(0).toUpperCase() + status.slice(1), icon: FileText };
  }
};
const glassPanel = { backgroundColor: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' };
const textPrimary = { color: 'rgba(255,255,255,0.9)' };
const textSecondary = { color: 'rgba(255,255,255,0.5)' };
const textFaint = { color: 'rgba(255,255,255,0.34)' };
const brandBlue = '#6B7EFF';
const FILTERS = ['All', 'Open', 'Overdue', 'Paid'] as const;
type FilterType = typeof FILTERS[number];

export default function InvoicesBoard() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  useEffect(() => { loadInvoices().then(data => { setInvoices(data); setIsLoading(false); }); }, []);
  const handleAction = (actionName: string, id: string) => {
    console.log(`Action: ${actionName} on Invoice: ${id}`);
    if (actionName === 'Mark paid') setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'paid' } : inv));
  };
  const filteredInvoices = useMemo(() => activeFilter === 'All' ? invoices : invoices.filter(inv => inv.status === activeFilter.toLowerCase()), [invoices, activeFilter]);
  const stats = useMemo(() => invoices.reduce((acc, inv) => {
    acc.count += 1;
    if (inv.status === 'open') acc.openTotal += inv.amount;
    if (inv.status === 'overdue') acc.overdueTotal += inv.amount;
    if (inv.status === 'paid') acc.paidTotal += inv.amount;
    return acc;
  }, { openTotal: 0, overdueTotal: 0, paidTotal: 0, count: 0 }), [invoices]);
  const selectedInvoice = useMemo(() => invoices.find(inv => inv.id === selectedInvoiceId) || null, [invoices, selectedInvoiceId]);
  return (
    <div className="w-full pb-28 font-sans flex flex-col gap-6 relative">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Open Total', value: formatCurrency(stats.openTotal), color: '#F59E0B' },
          { label: 'Overdue Total', value: formatCurrency(stats.overdueTotal), color: '#F87171' },
          { label: 'Paid (This Month)', value: formatCurrency(stats.paidTotal), color: '#34D399' },
          { label: 'Total Invoices', value: stats.count.toString(), color: brandBlue }
        ].map((stat, idx) => (
          <div key={idx} className="rounded-2xl p-5 flex flex-col gap-1" style={glassPanel}>
            <div className="text-xs font-semibold uppercase tracking-wider" style={textSecondary}>{stat.label}</div>
            <div className="text-2xl md:text-3xl font-semibold mt-1" style={{ color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {FILTERS.map(filter => (
          <button key={filter} onClick={() => setActiveFilter(filter)} className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all" style={{ backgroundColor: activeFilter === filter ? 'rgba(255,255,255,0.1)' : glassPanel.backgroundColor, border: activeFilter === filter ? '1px solid rgba(255,255,255,0.15)' : glassPanel.border, color: activeFilter === filter ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)' }}>{filter}</button>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {isLoading ? (<div className="text-center p-8 text-sm" style={textSecondary}>Loading invoices…</div>) : filteredInvoices.length === 0 ? (
          <div className="text-center p-12 rounded-3xl" style={glassPanel}><FileText size={32} style={textFaint} className="mx-auto mb-3" /><h3 className="text-lg font-medium" style={textPrimary}>No invoices found</h3><p className="text-sm mt-1" style={textSecondary}>Try changing your filter.</p></div>
        ) : filteredInvoices.map((inv) => {
          const config = getStatusConfig(inv.status);
          return (
            <button key={inv.id} onClick={() => setSelectedInvoiceId(inv.id)} className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl text-left transition-all hover:bg-white/5 gap-4" style={glassPanel}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}><FileText size={18} style={textSecondary} /></div>
                <div>
                  <div className="text-sm font-medium tracking-wide mb-1" style={textPrimary}>{inv.invoice_number}</div>
                  <div className="text-base font-medium" style={textPrimary}>{inv.customer_name || 'Unknown Customer'}</div>
                  {inv.property_name && (<div className="text-xs mt-0.5" style={textSecondary}>{inv.property_name}</div>)}
                </div>
              </div>
              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pl-14 sm:pl-0 w-full sm:w-auto">
                <div className="text-lg font-semibold" style={textPrimary}>{formatCurrency(inv.amount)}</div>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={textFaint}>Due {formatDate(inv.due_date)}</span>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider" style={{ backgroundColor: config.bg, color: config.color }}><config.icon size={12} />{config.label}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 md:p-6 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl overflow-hidden flex flex-col relative" style={{ backgroundColor: 'rgba(8,18,34,0.92)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="p-5 flex justify-between items-start border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <div><div className="text-xs font-medium uppercase tracking-wider mb-1" style={textSecondary}>Invoice Details</div><div className="text-xl font-semibold" style={textPrimary}>{selectedInvoice.invoice_number}</div></div>
              <button onClick={() => setSelectedInvoiceId(null)} className="p-2 rounded-full hover:bg-white/10 transition-colors" style={textSecondary}><X size={20} /></button>
            </div>
            <div className="p-5 flex flex-col gap-5 overflow-y-auto max-h-[60vh]">
              <div className="flex items-center justify-between p-4 rounded-2xl" style={glassPanel}>
                <div><div className="text-xs mb-1" style={textSecondary}>Total Amount</div><div className="text-3xl font-semibold" style={textPrimary}>{formatCurrency(selectedInvoice.amount)}</div></div>
                <div className="flex flex-col items-end gap-1">
                  <div className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider" style={{ backgroundColor: getStatusConfig(selectedInvoice.status).bg, color: getStatusConfig(selectedInvoice.status).color }}>{getStatusConfig(selectedInvoice.status).label}</div>
                  <div className="text-xs" style={textFaint}>Due {formatDate(selectedInvoice.due_date)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1"><span className="text-xs" style={textFaint}>Customer</span><span className="text-sm font-medium" style={textPrimary}>{selectedInvoice.customer_name || 'N/A'}</span></div>
                <div className="flex flex-col gap-1"><span className="text-xs" style={textFaint}>Property / Site</span><span className="text-sm font-medium" style={textPrimary}>{selectedInvoice.property_name || 'N/A'}</span></div>
                <div className="flex flex-col gap-1"><span className="text-xs" style={textFaint}>Date Sent</span><span className="text-sm font-medium" style={textPrimary}>{selectedInvoice.sent_at ? formatDate(selectedInvoice.sent_at) : 'Not sent'}</span></div>
              </div>
            </div>
            <div className="p-5 border-t bg-black/20 flex flex-col gap-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <button onClick={() => { handleAction('Send invoice', selectedInvoice.id); setSelectedInvoiceId(null); }} className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold transition-opacity hover:opacity-90" style={{ backgroundColor: brandBlue, color: '#fff' }}><Send size={16} /> Send Invoice</button>
              <div className="flex gap-3">
                {selectedInvoice.status !== 'paid' && (<button onClick={() => { handleAction('Mark paid', selectedInvoice.id); setSelectedInvoiceId(null); }} className="flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 text-sm font-medium transition-colors hover:bg-white/10" style={{ ...glassPanel, color: '#34D399' }}><CheckCircle2 size={16} /> Mark Paid</button>)}
                <button onClick={() => handleAction('Add note', selectedInvoice.id)} className="flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 text-sm font-medium transition-colors hover:bg-white/10" style={glassPanel}><MessageSquare size={16} style={textSecondary} /><span style={textPrimary}>Add Note</span></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
