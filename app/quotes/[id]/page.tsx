'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText, Send, CheckCircle2, XCircle, Clock, Eye,
  Copy, ExternalLink, Plus, Trash2, Loader2, ChevronLeft,
  Check, AlertTriangle, Users, Building2,
} from 'lucide-react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Edit2, ArrowUpRight, DollarSign } = require('lucide-react') as any;
import { formatCurrency } from '@/lib/quote-calculator';
import { QuoteStatus } from '@/types/quote';

// ── Types ──────────────────────────────────────────────────────────────────────
interface LineItem {
  id: string;
  sort_order: number;
  category: string;
  description: string;
  qty: number;
  unit_price: number;
  is_recurring: boolean;
  created_at: string;
}

interface QuoteDetail {
  id: string;
  quote_number: string;
  org_id: string;
  client_org_id: string | null;
  site_id: string | null;
  title: string;
  status: QuoteStatus;
  property_name: string | null;
  units: number | null;
  total_one_time: number;
  total_mrr: number;
  dealer_mrr: number;
  valid_until: string | null;
  accepted_at: string | null;
  sent_at: string | null;
  declined_at: string | null;
  notes: string | null;
  pdf_url: string | null;
  share_token: string | null;
  work_order_id: string | null;
  created_at: string;
  updated_at: string;
  quote_line_items: LineItem[];
  client_org_name: string | null;
  site_name: string | null;
}

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CFG: Record<QuoteStatus, { label: string; color: string; Icon: React.ElementType }> = {
  draft:    { label: 'Draft',    color: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',          Icon: FileText },
  sent:     { label: 'Sent',     color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',          Icon: Send },
  viewed:   { label: 'Viewed',   color: 'text-brand-400 bg-brand-400/10 border-brand-400/20',       Icon: Eye },
  accepted: { label: 'Accepted', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', Icon: CheckCircle2 },
  declined: { label: 'Declined', color: 'text-red-400 bg-red-400/10 border-red-400/20',             Icon: XCircle },
  expired:  { label: 'Expired',  color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',       Icon: Clock },
};

// ── Add line item form ─────────────────────────────────────────────────────────
function AddItemRow({ quoteId, onAdded }: { quoteId: string; onAdded: (item: LineItem) => void }) {
  const [open, setOpen]       = useState(false);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState({
    category: 'General', description: '', qty: '1', unit_price: '0', is_recurring: false,
  });
  const [err, setErr] = useState<string | null>(null);

  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.description.trim()) { setErr('Description is required'); return; }
    setSaving(true); setErr(null);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category:     form.category,
          description:  form.description.trim(),
          qty:          parseFloat(form.qty) || 1,
          unit_price:   parseFloat(form.unit_price) || 0,
          is_recurring: form.is_recurring,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to save');
      onAdded(json.item);
      setOpen(false);
      setForm({ category: 'General', description: '', qty: '1', unit_price: '0', is_recurring: false });
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-500 transition-colors mt-2"
      >
        <Plus className="w-3.5 h-3.5" /> Add Line Item
      </button>
    );
  }

  const CATEGORIES = ['General','Hardware','Labor','Access Control','Camera','Network','Maintenance','Other'];

  return (
    <div className="mt-3 border border-brand-400/20 rounded-xl p-4 bg-brand-400/5 space-y-3">
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Category</label>
          <select
            value={form.category}
            onChange={e => set('category', e.target.value)}
            className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-400"
          >
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 pt-5">
          <input
            type="checkbox"
            id="is_recurring"
            checked={form.is_recurring}
            onChange={e => set('is_recurring', e.target.checked)}
            className="rounded border-border text-brand-400"
          />
          <label htmlFor="is_recurring" className="text-sm text-muted-foreground">Recurring (MRR)</label>
        </div>
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Description *</label>
        <input
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="e.g. DoorKing 6050 Gate Operator Installation"
          className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Qty</label>
          <input
            type="number"
            min="1"
            value={form.qty}
            onChange={e => set('qty', e.target.value)}
            className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Unit Price ($)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.unit_price}
            onChange={e => set('unit_price', e.target.value)}
            className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-400 hover:bg-brand-500 text-navy font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {saving ? 'Saving…' : 'Add Item'}
        </button>
        <button
          onClick={() => { setOpen(false); setErr(null); }}
          className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [quote, setQuote]       = useState<QuoteDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  async function fetchQuote() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/quotes/${id}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setQuote(data.quote);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load quote');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchQuote(); }, [id]);

  async function patchStatus(status: QuoteStatus) {
    if (!quote) return;
    setActioning(status);
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setQuote(q => q ? { ...q, ...data.quote } : q);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActioning(null);
    }
  }

  async function createWorkOrder() {
    if (!quote) return;
    setActioning('work_order');
    try {
      // Create a work order linked to this quote
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:         `Install — ${quote.property_name ?? quote.title}`,
          customer_name: quote.client_org_name ?? quote.property_name ?? quote.title,
          job_type:      'Installation',
          status:        'open',
          priority:      'normal',
          site_id:       quote.site_id ?? undefined,
          notes:         `Created from Quote ${quote.quote_number}`,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { work_order } = await res.json();

      // Link work order back to quote
      await fetch(`/api/quotes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_order_id: work_order.id }),
      });

      setQuote(q => q ? { ...q, work_order_id: work_order.id } : q);
      router.push(`/maintenance/${work_order.id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create work order');
    } finally {
      setActioning(null);
    }
  }

  async function deleteItem(itemId: string) {
    if (!confirm('Remove this line item?')) return;
    setDeletingItemId(itemId);
    try {
      const res = await fetch(`/api/quotes/${id}/items/${itemId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      // Refresh quote to get updated totals
      await fetchQuote();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete item');
    } finally {
      setDeletingItemId(null);
    }
  }

  function copyApprovalLink() {
    const url = `${window.location.origin}/quotes/${id}/approve`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading quote…</span>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertTriangle className="w-10 h-10 text-amber-400" />
        <p className="text-muted-foreground text-sm">{error ?? 'Quote not found.'}</p>
        <Link href="/quotes" className="text-brand-400 hover:underline text-sm flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Back to Quotes
        </Link>
      </div>
    );
  }

  const cfg  = STATUS_CFG[quote.status];
  const Icon = cfg.Icon;
  const items = quote.quote_line_items ?? [];
  const oneTimeItems = items.filter(i => !i.is_recurring);
  const recurringItems = items.filter(i => i.is_recurring);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Back */}
      <Link href="/quotes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Quotes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-foreground font-mono">{quote.quote_number}</h1>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
              <Icon className="w-3.5 h-3.5" />{cfg.label}
            </span>
          </div>
          <p className="text-muted-foreground text-sm">
            {quote.property_name ?? quote.title}
            {quote.units ? ` · ${quote.units} units` : ''}
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span>Created {new Date(quote.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            {quote.sent_at && <span className="text-blue-400">Sent {new Date(quote.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
            {quote.accepted_at && <span className="text-emerald-400">Accepted {new Date(quote.accepted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
            {quote.valid_until && <span>Valid until {new Date(quote.valid_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {quote.status === 'draft' && (
            <button
              onClick={() => patchStatus('sent')}
              disabled={actioning === 'sent'}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm disabled:opacity-50"
            >
              {actioning === 'sent'
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
              Send Quote
            </button>
          )}
          {(quote.status === 'sent' || quote.status === 'viewed') && (
            <>
              <button
                onClick={() => patchStatus('accepted')}
                disabled={!!actioning}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm disabled:opacity-50"
              >
                {actioning === 'accepted'
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <CheckCircle2 className="w-4 h-4" />}
                Mark Accepted
              </button>
              <button
                onClick={() => patchStatus('declined')}
                disabled={!!actioning}
                className="flex items-center gap-2 border border-border text-muted-foreground hover:text-red-400 hover:border-red-400/40 px-4 py-2 rounded-lg transition-colors text-sm disabled:opacity-50"
              >
                {actioning === 'declined'
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <XCircle className="w-4 h-4" />}
                Mark Declined
              </button>
            </>
          )}
          {quote.status === 'accepted' && !quote.work_order_id && (
            <button
              onClick={createWorkOrder}
              disabled={actioning === 'work_order'}
              className="flex items-center gap-2 bg-brand-400 hover:bg-brand-500 text-navy font-semibold px-4 py-2 rounded-lg transition-colors text-sm disabled:opacity-50"
            >
              {actioning === 'work_order'
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Plus className="w-4 h-4" />}
              Create Work Order
            </button>
          )}
          {quote.status === 'accepted' && quote.work_order_id && (
            <Link
              href={`/maintenance/${quote.work_order_id}`}
              className="flex items-center gap-2 border border-border text-muted-foreground hover:text-brand-400 hover:border-brand-400/40 px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <ExternalLink className="w-4 h-4" /> View Work Order
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">

        {/* Left: Line Items */}
        <div className="col-span-2 space-y-5">

          {/* Line Items table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Line Items</h2>
              <span className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? 's' : ''}</span>
            </div>

            {items.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No line items yet</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-background/50 border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 py-2.5">Description</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 py-2.5">Category</th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 py-2.5">Qty</th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 py-2.5">Unit</th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 py-2.5">Subtotal</th>
                    <th className="text-xs font-medium text-muted-foreground px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-background/40 transition-colors group">
                      <td className="px-4 py-3">
                        <p className="text-sm text-foreground">{item.description}</p>
                        {item.is_recurring && (
                          <span className="text-[10px] font-medium text-violet-400 bg-violet-400/10 border border-violet-400/20 px-1.5 py-0.5 rounded-full">MRR</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">{item.category}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-foreground">{item.qty}</td>
                      <td className="px-4 py-3 text-right text-sm text-foreground">{formatCurrency(item.unit_price)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-medium ${item.is_recurring ? 'text-violet-400' : 'text-foreground'}`}>
                          {formatCurrency(item.qty * item.unit_price)}
                          {item.is_recurring ? '/mo' : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteItem(item.id)}
                          disabled={deletingItemId === item.id}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition-all"
                        >
                          {deletingItemId === item.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="px-5 pb-4">
              <AddItemRow
                quoteId={id}
                onAdded={item => setQuote(q => q ? {
                  ...q,
                  quote_line_items: [...q.quote_line_items, item],
                  total_one_time: q.total_one_time + (item.is_recurring ? 0 : item.qty * item.unit_price),
                  total_mrr: q.total_mrr + (item.is_recurring ? item.qty * item.unit_price : 0),
                } : q)}
              />
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-2">Notes</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-4">

          {/* Totals */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Totals</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Setup (One-Time)</span>
                <span className="text-sm font-semibold text-foreground">{formatCurrency(quote.total_one_time)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Monthly MRR</span>
                <span className="text-sm font-semibold text-violet-400">{formatCurrency(quote.total_mrr)}<span className="text-xs font-normal text-muted-foreground">/mo</span></span>
              </div>
              {quote.dealer_mrr > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-sm text-muted-foreground">Dealer Override</span>
                  <span className="text-sm font-semibold text-emerald-400">{formatCurrency(quote.dealer_mrr)}<span className="text-xs font-normal text-muted-foreground">/mo</span></span>
                </div>
              )}
            </div>
          </div>

          {/* Client / Site */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Details</h2>
            {quote.client_org_name && (
              <div className="flex items-start gap-2">
                <Users className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Client</p>
                  <p className="text-sm text-foreground">{quote.client_org_name}</p>
                </div>
              </div>
            )}
            {(quote.site_name || quote.property_name) && (
              <div className="flex items-start gap-2">
                <Building2 className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Property</p>
                  <p className="text-sm text-foreground">{quote.site_name ?? quote.property_name}</p>
                  {quote.units ? <p className="text-xs text-muted-foreground">{quote.units} units</p> : null}
                </div>
              </div>
            )}
            {quote.site_id && (
              <Link href={`/sites/${quote.site_id}`} className="flex items-center gap-1.5 text-xs text-brand-400 hover:underline">
                <ExternalLink className="w-3 h-3" /> View Site
              </Link>
            )}
          </div>

          {/* Approval link */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Client Approval Link</h2>
            <p className="text-xs text-muted-foreground">Share this link with the client to let them review and approve the proposal.</p>
            <div className="flex gap-2">
              <button
                onClick={copyApprovalLink}
                className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-500 border border-brand-400/30 rounded-lg px-3 py-1.5 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <Link
                href={`/quotes/${id}/approve`}
                target="_blank"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Preview
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
