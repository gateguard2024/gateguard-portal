'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText, Send, CheckCircle2, XCircle, Clock, Eye,
  Copy, ExternalLink, Plus, Trash2, Loader2, ChevronLeft,
  Check, AlertTriangle, Users, Building2, ChevronDown,
  Search, Hash, Layers, X, Download,
} from 'lucide-react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Edit2, ArrowUpRight, DollarSign, Package, SlidersHorizontal, Tag, FileDown, LinkIcon, ClipboardList, Unlink } = require('lucide-react') as any;
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';

interface LineItem {
  id:                   string;
  sort_order:           number;
  category:             string;
  description:          string;
  qty:                  number;
  unit_price:           number;
  unit:                 string;
  is_recurring:         boolean;
  section_name:         string;
  product_id:           string | null;
  item_type:            string;
  is_optional:          boolean;
  is_included:          boolean;
  package_tier:         string | null;
  image_url:            string | null;
  model_number:         string | null;
  notes:                string | null;
  sku:                  string | null;
  created_at:           string;
  line_discount_percent: number;
}

interface QuoteDetail {
  id:               string;
  quote_number:     string;
  org_id:           string;
  client_org_id:    string | null;
  site_id:          string | null;
  title:            string;
  status:           QuoteStatus;
  property_name:    string | null;
  units:            number | null;
  total_one_time:   number;
  total_mrr:        number;
  dealer_mrr:       number;
  valid_until:      string | null;
  accepted_at:      string | null;
  sent_at:          string | null;
  declined_at:      string | null;
  notes:            string | null;
  pdf_url:          string | null;
  share_token:      string | null;
  work_order_id:    string | null;
  created_at:       string;
  updated_at:       string;
  quote_line_items: LineItem[];
  client_org_name:  string | null;
  site_name:        string | null;
  // migration 042
  quote_mode:       string | null;
  client_name:      string | null;
  client_email:     string | null;
  client_phone:     string | null;
  property_address: string | null;
  cover_message:    string | null;
  terms_text:       string | null;
  tax_rate:         number | null;
  discount_percent: number | null;
  deposit_percent:  number | null;
  survey_id:        string | null;
  package_mode:     boolean | null;
  selected_package: string | null;
  created_by_name:  string | null;
  expiry_date:      string | null;
  // migration 055
  payment_plan:        string | null;
  ramp_up_start_pct:   number | null;
  ramp_up_step_pct:    number | null;
  ramp_up_full_month:  number | null;
}

// ── Survey type ────────────────────────────────────────────────────────────────

interface SurveyOption {
  id:            string;
  survey_number: string;
  property_name: string | null;
  ai_sow:        string | null;
  ai_summary:    string | null;
}

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<QuoteStatus, { label: string; color: string; Icon: React.ElementType }> = {
  draft:    { label: 'Draft',    color: 'text-zinc-500 bg-zinc-100   border-zinc-200',          Icon: FileText    },
  sent:     { label: 'Sent',     color: 'text-blue-600 bg-blue-50    border-blue-200',           Icon: Send        },
  viewed:   { label: 'Viewed',   color: 'text-purple-600 bg-purple-50 border-purple-200',        Icon: Eye         },
  accepted: { label: 'Accepted', color: 'text-emerald-600 bg-emerald-50 border-emerald-200',     Icon: CheckCircle2},
  declined: { label: 'Declined', color: 'text-red-600 bg-red-50     border-red-200',             Icon: XCircle     },
  expired:  { label: 'Expired',  color: 'text-amber-600 bg-amber-50  border-amber-200',          Icon: Clock       },
};

const PKG_COLORS: Record<string, string> = {
  basic:    'text-slate-600  bg-slate-100  border-slate-200',
  standard: 'text-blue-600   bg-blue-50    border-blue-200',
  premium:  'text-purple-600 bg-purple-50  border-purple-200',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function groupBySection(items: LineItem[]): Map<string, LineItem[]> {
  const map = new Map<string, LineItem[]>();
  for (const item of items) {
    const key = item.section_name || 'Equipment';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}

// ── Add / Edit item slide-over ─────────────────────────────────────────────────

interface ItemFormProps {
  quoteId:   string;
  item?:     LineItem | null;
  onSaved:   (item: LineItem) => void;
  onClose:   () => void;
}

// ── Ramp-up schedule helpers ────────────────────────────────────────────────

interface RampRow { month: number; pct: number; amount: number }

function buildRampSchedule(mrr: number, startPct: number, stepPct: number, fullMonth: number): RampRow[] {
  const rows: RampRow[] = []
  for (let m = 2; m <= fullMonth; m++) {
    const pct = m === fullMonth ? 100 : Math.min(100, startPct + (m - 2) * stepPct)
    rows.push({ month: m, pct, amount: mrr * (pct / 100) })
  }
  return rows
}

function ItemForm({ quoteId, item, onSaved, onClose }: ItemFormProps) {
  const isEdit = !!item;
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts]           = useState<Array<{ id: string; name: string; sku: string; list_price: number }>>([]);
  const [showProducts, setShowProducts]   = useState(false);

  const [form, setForm] = useState({
    description:          item?.description          ?? '',
    qty:                  item?.qty                  ?? 1,
    unit_price:           item?.unit_price           ?? 0,
    unit:                 item?.unit                 ?? 'each',
    section_name:         item?.section_name         ?? 'Equipment',
    item_type:            item?.item_type            ?? 'equipment',
    is_optional:          item?.is_optional          ?? false,
    is_included:          item?.is_included          ?? true,
    package_tier:         item?.package_tier         ?? '',
    model_number:         item?.model_number         ?? '',
    sku:                  item?.sku                  ?? '',
    notes:                item?.notes                ?? '',
    is_recurring:         item?.is_recurring         ?? false,
    product_id:           item?.product_id           ?? null as string | null,
    line_discount_percent: item?.line_discount_percent ?? 0,
  });

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!productSearch.trim()) { setProducts([]); return; }
    const t = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/products?q=${encodeURIComponent(productSearch)}&limit=8`);
        const json = await res.json();
        setProducts(json.products ?? json.records ?? []);
      } catch { setProducts([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [productSearch]);

  async function save() {
    if (!form.description.trim()) { setErr('Description is required'); return; }
    setSaving(true); setErr('');
    try {
      const url    = isEdit ? `/api/quotes/${quoteId}/items/${item!.id}` : `/api/quotes/${quoteId}/items`;
      const method = isEdit ? 'PATCH' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      onSaved(isEdit ? json.item : json.item);
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally { setSaving(false); }
  }

  const SECTIONS   = ['Equipment', 'Labor', 'Software / MRR', 'Cameras', 'Access Control', 'Network', 'Materials', 'Other'];
  const ITEM_TYPES = [
    { v: 'equipment', l: 'Equipment' },
    { v: 'labor',     l: 'Labor'     },
    { v: 'service',   l: 'Service'   },
    { v: 'custom',    l: 'Custom'    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{isEdit ? 'Edit Line Item' : 'Add Line Item'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={15} className="text-gray-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

          {/* Product search */}
          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Search Product Catalog</label>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setShowProducts(true); }}
                  onFocus={() => setShowProducts(true)}
                  placeholder="Search by name or SKU..."
                  className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50"
                />
              </div>
              {showProducts && products.length > 0 && (
                <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-40 overflow-y-auto">
                  {products.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        set('description', p.name);
                        set('sku', p.sku ?? '');
                        set('unit_price', p.list_price ?? 0);
                        set('product_id', p.id);
                        setProductSearch(p.name);
                        setShowProducts(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors flex items-center justify-between"
                    >
                      <span className="text-xs font-medium text-gray-800">{p.name}</span>
                      <span className="text-xs text-gray-400 font-mono">${fmt(p.list_price ?? 0)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description *</label>
            <input
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="DoorKing 9050 Gate Operator"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">SKU</label>
              <input
                value={form.sku}
                onChange={e => set('sku', e.target.value)}
                placeholder="DK-9050"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Model</label>
              <input
                value={form.model_number}
                onChange={e => set('model_number', e.target.value)}
                placeholder="9050-XL"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Qty</label>
              <input
                type="number"
                min={1}
                value={form.qty}
                onChange={e => set('qty', parseFloat(e.target.value) || 1)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
              <select
                value={form.unit}
                onChange={e => set('unit', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
              >
                {['each', 'hr', 'ft', 'lot', 'mo', 'day'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Unit Price ($)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.unit_price}
                onChange={e => set('unit_price', parseFloat(e.target.value) || 0)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
              />
              {form.line_discount_percent > 0 && (
                <p className="text-[11px] text-emerald-600 mt-1">
                  Effective: ${(form.unit_price * (1 - form.line_discount_percent / 100)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              )}
            </div>
          </div>

          {/* Line Discount */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Line Discount % <span className="text-gray-400">(0 = none)</span></label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={form.line_discount_percent}
              onChange={e => set('line_discount_percent', Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Section</label>
              <select
                value={form.section_name}
                onChange={e => set('section_name', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                {SECTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <select
                value={form.item_type}
                onChange={e => set('item_type', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                {ITEM_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
          </div>

          {/* Package tier */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Package Tier <span className="text-gray-400">(optional)</span></label>
            <div className="flex gap-2">
              {['', 'basic', 'standard', 'premium'].map(tier => (
                <button
                  key={tier}
                  onClick={() => set('package_tier', tier || null)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    (form.package_tier ?? '') === tier
                      ? 'bg-[#6B7EFF] text-white border-[#6B7EFF]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  )}
                >
                  {tier || 'Any'}
                </button>
              ))}
            </div>
          </div>

          {/* Optional / Recurring flags */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_optional}
                onChange={e => set('is_optional', e.target.checked)}
                className="rounded border-gray-300"
              />
              Optional item
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_recurring}
                onChange={e => set('is_recurring', e.target.checked)}
                className="rounded border-gray-300"
              />
              Recurring (MRR)
            </label>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Internal Notes</label>
            <textarea
              value={form.notes ?? ''}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              placeholder="Notes visible to dealer only..."
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-[#6B7EFF] text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {isEdit ? 'Save Changes' : 'Add Item'}
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Item Row ───────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item:       LineItem;
  onEdit:     () => void;
  onDelete:   () => void;
  onToggle:   () => void;  // toggle is_included
  deleting:   boolean;
}

function ItemRow({ item, onEdit, onDelete, onToggle, deleting }: ItemRowProps) {
  const disc        = item.line_discount_percent ?? 0;
  const effectiveAmt = item.qty * item.unit_price * (1 - disc / 100);
  const subtotal    = effectiveAmt;
  const dimmed      = item.is_optional && !item.is_included;

  return (
    <tr className={cn('group transition-colors hover:bg-gray-50/60', dimmed && 'opacity-50')}>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {item.is_optional && (
            <button
              onClick={onToggle}
              title={item.is_included ? 'Remove from quote' : 'Include in quote'}
              className={cn(
                'shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                item.is_included
                  ? 'bg-[#6B7EFF] border-[#6B7EFF]'
                  : 'bg-white border-gray-300 hover:border-blue-400'
              )}
            >
              {item.is_included && <Check size={8} className="text-white" />}
            </button>
          )}
          <div className="min-w-0">
            <p className={cn('text-sm text-gray-800', !item.is_optional && 'font-medium')}>{item.description}</p>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              {item.sku && <span className="text-[10px] font-mono text-gray-400">{item.sku}</span>}
              {item.model_number && <span className="text-[10px] text-gray-400">{item.model_number}</span>}
              {item.is_optional && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                  optional
                </span>
              )}
              {item.is_recurring && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-full">
                  MRR
                </span>
              )}
              {item.package_tier && (
                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full border capitalize', PKG_COLORS[item.package_tier] ?? PKG_COLORS.basic)}>
                  {item.package_tier}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-500 tabular-nums">{item.qty} {item.unit}</td>
      <td className="px-4 py-2.5 text-xs text-right tabular-nums">
        {disc > 0 ? (
          <div className="flex flex-col items-end gap-0.5">
            <span className="line-through text-gray-400">${fmt(item.unit_price)}</span>
            <span className="text-emerald-600 font-medium">${fmt(item.unit_price * (1 - disc / 100))}</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">-{disc}%</span>
          </div>
        ) : (
          <span className="text-gray-600">${fmt(item.unit_price)}</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-sm font-medium text-right tabular-nums text-gray-900">${fmt(subtotal)}{item.is_recurring ? <span className="text-xs font-normal text-gray-400">/mo</span> : ''}</td>
      <td className="px-4 py-2.5 w-16">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
            <Edit2 size={12} />
          </button>
          <button onClick={onDelete} disabled={deleting} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function QuoteDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const [quote,           setQuote]          = useState<QuoteDetail | null>(null);
  const [loading,         setLoading]        = useState(true);
  const [error,           setError]          = useState<string | null>(null);
  const [actioning,       setActioning]      = useState<string | null>(null);
  const [copied,          setCopied]         = useState(false);
  const [editingItemId,   setEditingItemId]  = useState<string | null>(null);
  const [showAddItem,     setShowAddItem]    = useState(false);
  const [deletingId,      setDeletingId]     = useState<string | null>(null);
  const [packageFilter,   setPackageFilter]  = useState<string>('all');
  const [paymentPlan,     setPaymentPlan]    = useState<string>('standard');
  const [rampStartPct,    setRampStartPct]   = useState<number>(10);
  const [rampStepPct,     setRampStepPct]    = useState<number>(7.5);
  const [rampFullMonth,   setRampFullMonth]  = useState<number>(14);
  const [rampExpanded,    setRampExpanded]   = useState<boolean>(false);
  const [savingPlan,      setSavingPlan]     = useState<boolean>(false);

  // Notes & SOW state
  const [notes,           setNotes]          = useState<string>('');
  const [savingNotes,     setSavingNotes]    = useState<boolean>(false);
  const [surveys,         setSurveys]        = useState<SurveyOption[]>([]);
  const [showSurveyPicker, setShowSurveyPicker] = useState<boolean>(false);
  const [linkedSurvey,    setLinkedSurvey]   = useState<SurveyOption | null>(null);

  const fetchQuote = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/quotes/${id}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setQuote(data.quote);
      // Sync payment plan state from loaded quote
      setPaymentPlan(data.quote.payment_plan ?? 'standard');
      setRampStartPct(data.quote.ramp_up_start_pct ?? 10);
      setRampStepPct(data.quote.ramp_up_step_pct ?? 7.5);
      setRampFullMonth(data.quote.ramp_up_full_month ?? 14);
      // Sync notes state
      setNotes(data.quote.notes ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load quote');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchQuote(); }, [fetchQuote]);

  // Fetch available surveys once on mount
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch('/api/surveys');
        const json = await res.json();
        setSurveys(json.surveys ?? json.records ?? []);
      } catch { /* non-blocking */ }
    })();
  }, []);

  // Sync linked survey when quote or surveys list changes
  useEffect(() => {
    if (!quote?.survey_id || surveys.length === 0) {
      if (!quote?.survey_id) setLinkedSurvey(null);
      return;
    }
    const found = surveys.find(s => s.id === quote.survey_id) ?? null;
    setLinkedSurvey(found);
  }, [quote?.survey_id, surveys]);

  async function patchStatus(status: QuoteStatus) {
    if (!quote) return;
    setActioning(status);
    try {
      const res  = await fetch(`/api/quotes/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setQuote(q => q ? { ...q, ...data.quote } : q);
    } catch (e) { alert(e instanceof Error ? e.message : 'Action failed'); }
    finally { setActioning(null); }
  }

  async function toggleIncluded(item: LineItem) {
    const updated = { ...item, is_included: !item.is_included };
    setQuote(q => q ? {
      ...q,
      quote_line_items: q.quote_line_items.map(i => i.id === item.id ? updated : i),
    } : q);
    await fetch(`/api/quotes/${id}/items/${item.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ is_included: !item.is_included }),
    });
  }

  async function deleteItem(itemId: string) {
    if (!confirm('Remove this line item?')) return;
    setDeletingId(itemId);
    try {
      const res = await fetch(`/api/quotes/${id}/items/${itemId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      setQuote(q => q ? {
        ...q,
        quote_line_items: q.quote_line_items.filter(i => i.id !== itemId),
      } : q);
      await fetchQuote(); // refresh totals
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to delete item'); }
    finally { setDeletingId(null); }
  }

  function onItemSaved(saved: LineItem) {
    setQuote(q => {
      if (!q) return q;
      const existing = q.quote_line_items.find(i => i.id === saved.id);
      const updated  = existing
        ? q.quote_line_items.map(i => i.id === saved.id ? saved : i)
        : [...q.quote_line_items, saved];
      return { ...q, quote_line_items: updated };
    });
    fetchQuote();
  }

  async function saveNotes() {
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setQuote(q => q ? { ...q, ...data.quote } : q);
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to save notes'); }
    finally { setSavingNotes(false); }
  }

  async function linkSurvey(survey: SurveyOption) {
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ survey_id: survey.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      setQuote(q => q ? { ...q, survey_id: survey.id } : q);
      setLinkedSurvey(survey);
      setShowSurveyPicker(false);
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to link survey'); }
  }

  async function unlinkSurvey() {
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ survey_id: null }),
      });
      if (!res.ok) throw new Error(await res.text());
      setQuote(q => q ? { ...q, survey_id: null } : q);
      setLinkedSurvey(null);
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to unlink survey'); }
  }

  async function createWorkOrder() {
    if (!quote) return;
    setActioning('work_order');
    try {
      const res = await fetch('/api/maintenance', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
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
      await fetch(`/api/quotes/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ work_order_id: work_order.id }),
      });
      setQuote(q => q ? { ...q, work_order_id: work_order.id } : q);
      router.push(`/maintenance/${work_order.id}`);
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to create work order'); }
    finally { setActioning(null); }
  }

  function copyApprovalLink() {
    navigator.clipboard.writeText(`${window.location.origin}/quotes/${id}/approve`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const items = quote?.quote_line_items ?? [];

  const visibleItems = packageFilter === 'all'
    ? items
    : items.filter(i => !i.package_tier || i.package_tier === packageFilter);

  const includedItems = visibleItems.filter(i => !i.is_optional || i.is_included);
  const sections      = groupBySection(visibleItems);

  const effAmt    = (i: LineItem) => i.qty * i.unit_price * (1 - (i.line_discount_percent ?? 0) / 100);
  const subtotal  = includedItems.reduce((s, i) => s + (i.is_recurring ? 0 : effAmt(i)), 0);
  const mrrTotal  = includedItems.reduce((s, i) => s + (i.is_recurring ? effAmt(i) : 0), 0);
  const taxRate   = quote?.tax_rate         ?? 0;
  const discPct   = quote?.discount_percent ?? 0;
  const depPct    = quote?.deposit_percent  ?? 30;
  const discAmt   = subtotal * (discPct / 100);
  const taxAmt    = (subtotal - discAmt) * taxRate;
  const grandTotal= subtotal - discAmt + taxAmt;
  const deposit   = grandTotal * (depPct / 100);

  async function savePaymentPlan() {
    setSavingPlan(true);
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          payment_plan:       paymentPlan,
          ramp_up_start_pct:  rampStartPct,
          ramp_up_step_pct:   rampStepPct,
          ramp_up_full_month: rampFullMonth,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setQuote(q => q ? { ...q, ...data.quote } : q);
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to save payment plan'); }
    finally { setSavingPlan(false); }
  }

  // ── States ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] gap-2 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading quote…</span>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="w-10 h-10 text-amber-400" />
        <p className="text-gray-500 text-sm">{error ?? 'Quote not found.'}</p>
        <Link href="/quotes" className="text-[#6B7EFF] hover:underline text-sm flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Back to Quotes
        </Link>
      </div>
    );
  }

  const cfg  = STATUS_CFG[quote.status];
  const Icon = cfg.Icon;
  const editingItem = editingItemId ? items.find(i => i.id === editingItemId) ?? null : null;

  return (
    <div className="bg-[#F8FAFC] min-h-full">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <Link href="/quotes" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <ChevronLeft size={15} /> Quotes
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-900 font-mono">{quote.quote_number}</span>
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', cfg.color)}>
          <Icon size={11} /> {cfg.label}
        </span>
        {quote.survey_id && (
          <Link href={`/survey`} className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors">
            <ArrowUpRight size={11} /> From Survey
          </Link>
        )}

        <div className="flex-1" />

        {/* Action bar */}
        <div className="flex items-center gap-2">
          {quote.status === 'draft' && (
            <button
              onClick={() => patchStatus('sent')}
              disabled={actioning === 'sent'}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {actioning === 'sent' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Send to Client
            </button>
          )}
          {(quote.status === 'sent' || quote.status === 'viewed') && (
            <>
              <button
                onClick={() => patchStatus('accepted')}
                disabled={!!actioning}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {actioning === 'accepted' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                Mark Accepted
              </button>
              <button
                onClick={() => patchStatus('declined')}
                disabled={!!actioning}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50"
              >
                {actioning === 'declined' ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                Declined
              </button>
            </>
          )}
          {quote.status === 'accepted' && !quote.work_order_id && (
            <button
              onClick={createWorkOrder}
              disabled={actioning === 'work_order'}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#6B7EFF] text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {actioning === 'work_order' ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Create Work Order
            </button>
          )}
          {quote.status === 'accepted' && quote.work_order_id && (
            <Link href={`/maintenance/${quote.work_order_id}`}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:text-[#6B7EFF] hover:border-blue-200 transition-colors"
            >
              <ExternalLink size={13} /> Work Order
            </Link>
          )}
          <Link
            href={`/quotes/${id}/approve`}
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Eye size={13} /> Preview
          </Link>
          <button
            onClick={copyApprovalLink}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-sm rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button
            onClick={() => window.open(`/quotes/${id}/approve?print=1`, '_blank')}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-sm rounded-lg hover:bg-muted text-foreground transition-colors"
          >
            <FileDown size={13} /> Download PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-5 p-6 items-start">

        {/* ── Left: Line Items ── */}
        <div className="space-y-4">

          {/* Quote title + info */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{quote.property_name ?? quote.title}</h1>
                <div className="flex items-center flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
                  {quote.client_name && <span className="flex items-center gap-1"><Users size={11} />{quote.client_name}</span>}
                  {quote.property_address && <span>{quote.property_address}</span>}
                  {quote.units && <span>{quote.units} units</span>}
                  {quote.created_by_name && <span>By {quote.created_by_name}</span>}
                  <span className="font-mono text-gray-400">{quote.quote_number}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 text-xs text-gray-400">
                <span>Created {new Date(quote.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                {quote.expiry_date && <span className="text-amber-600">Expires {new Date(quote.expiry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                {quote.sent_at && <span className="text-blue-600">Sent {new Date(quote.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                {quote.accepted_at && <span className="text-emerald-600">Accepted {new Date(quote.accepted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
              </div>
            </div>

            {/* Cover message */}
            {quote.cover_message && (
              <p className="mt-3 text-sm text-gray-600 bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
                {quote.cover_message}
              </p>
            )}
          </div>

          {/* Package filter */}
          {quote.package_mode && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Package size={14} className="text-[#6B7EFF]" />
                <h3 className="text-sm font-semibold text-gray-900">Package View</h3>
              </div>
              <div className="flex gap-2">
                {[
                  { v: 'all',      l: 'All Tiers'  },
                  { v: 'basic',    l: 'Basic'       },
                  { v: 'standard', l: 'Standard'    },
                  { v: 'premium',  l: 'Premium'     },
                ].map(({ v, l }) => (
                  <button
                    key={v}
                    onClick={() => setPackageFilter(v)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                      packageFilter === v
                        ? 'bg-[#6B7EFF] text-white border-[#6B7EFF]'
                        : cn('bg-white text-gray-600 border-gray-200 hover:border-gray-300', v !== 'all' && PKG_COLORS[v])
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Line items by section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-900">Line Items</h2>
                <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{items.length}</span>
              </div>
              <button
                onClick={() => { setEditingItemId(null); setShowAddItem(true); }}
                className="flex items-center gap-1.5 text-xs text-[#6B7EFF] font-medium hover:text-blue-700 transition-colors"
              >
                <Plus size={12} /> Add Item
              </button>
            </div>

            {items.length === 0 ? (
              <div className="py-12 text-center">
                <FileText size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No line items yet</p>
                <button
                  onClick={() => { setEditingItemId(null); setShowAddItem(true); }}
                  className="mt-3 flex items-center gap-1.5 mx-auto text-xs text-[#6B7EFF] font-medium"
                >
                  <Plus size={12} /> Add first item
                </button>
              </div>
            ) : (
              <div>
                {Array.from(sections.entries()).map(([section, sectionItems]) => (
                  <div key={section}>
                    {/* Section header */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-y border-gray-100">
                      <Hash size={11} className="text-gray-400" />
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{section}</span>
                      <span className="text-[10px] text-gray-400">({sectionItems.length})</span>
                    </div>
                    <table className="w-full">
                      <tbody className="divide-y divide-gray-50">
                        {sectionItems.map(item => (
                          <ItemRow
                            key={item.id}
                            item={item}
                            onEdit={() => { setEditingItemId(item.id); setShowAddItem(true); }}
                            onDelete={() => deleteItem(item.id)}
                            onToggle={() => toggleIncluded(item)}
                            deleting={deletingId === item.id}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

                {/* Section totals */}
                <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {items.filter(i => i.is_optional).length} optional items
                    · {items.filter(i => i.is_optional && i.is_included).length} selected
                  </span>
                  <div className="flex items-center gap-4">
                    {mrrTotal > 0 && (
                      <span className="text-xs text-violet-700">
                        ${fmt(mrrTotal)}<span className="font-normal text-gray-400">/mo MRR</span>
                      </span>
                    )}
                    <span className="text-sm font-semibold text-gray-900">${fmt(subtotal)} one-time</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Terms */}
          {quote.terms_text && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Terms & Conditions</h2>
              <p className="text-xs text-gray-500 whitespace-pre-wrap">{quote.terms_text}</p>
            </div>
          )}
        </div>

        {/* ── Right: Sidebar ── */}
        <div className="space-y-4 sticky top-4">

          {/* Totals */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign size={14} className="text-[#6B7EFF]" />
              <h2 className="text-sm font-semibold text-gray-900">Pricing</h2>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-medium text-gray-900">${fmt(subtotal)}</span>
              </div>
              {discPct > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount ({discPct}%)</span>
                  <span>-${fmt(discAmt)}</span>
                </div>
              )}
              {taxRate > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Tax ({(taxRate * 100).toFixed(1)}%)</span>
                  <span>${fmt(taxAmt)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2.5 border-t border-gray-200 text-base font-bold text-gray-900">
                <span>Total</span>
                <span>${fmt(grandTotal)}</span>
              </div>
              {depPct > 0 && (
                <div className="flex justify-between text-[#6B7EFF] font-medium">
                  <span>Deposit Due ({depPct}%)</span>
                  <span>${fmt(deposit)}</span>
                </div>
              )}
              {mrrTotal > 0 && (
                <div className="flex justify-between pt-2 border-t border-gray-200 text-violet-600 font-medium">
                  <span>Monthly MRR</span>
                  <span>${fmt(mrrTotal)}<span className="text-xs font-normal text-gray-400">/mo</span></span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Plan */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-[#6B7EFF]" />
              <h2 className="text-sm font-semibold text-gray-900">Payment Plan</h2>
            </div>

            {/* Radio buttons */}
            <div className="space-y-2">
              {[
                { v: 'standard', l: 'Standard',       sub: 'Full rate from month 1' },
                { v: 'ramp_up',  l: 'Ramp-Up',        sub: 'Recommended for new properties' },
              ].map(opt => (
                <label
                  key={opt.v}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    paymentPlan === opt.v
                      ? 'border-[#6B7EFF] bg-blue-50/50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <input
                    type="radio"
                    name="payment_plan"
                    value={opt.v}
                    checked={paymentPlan === opt.v}
                    onChange={() => { setPaymentPlan(opt.v); if (opt.v === 'ramp_up') setRampExpanded(true); }}
                    className="mt-0.5 accent-[#6B7EFF]"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{opt.l}</p>
                    <p className="text-xs text-gray-500">{opt.sub}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Ramp-up schedule */}
            {paymentPlan === 'ramp_up' && (
              <div className="space-y-3">
                {/* Config inputs */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-1">Start % (mo 2)</label>
                    <input
                      type="number" min={1} max={100} step={0.5}
                      value={rampStartPct}
                      onChange={e => setRampStartPct(parseFloat(e.target.value) || 10)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-1">Step %/mo</label>
                    <input
                      type="number" min={0.5} max={50} step={0.5}
                      value={rampStepPct}
                      onChange={e => setRampStepPct(parseFloat(e.target.value) || 7.5)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-1">Full rate mo</label>
                    <input
                      type="number" min={3} max={36} step={1}
                      value={rampFullMonth}
                      onChange={e => setRampFullMonth(parseInt(e.target.value) || 14)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                    />
                  </div>
                </div>

                {/* Deposit breakdown */}
                {mrrTotal > 0 && (() => {
                  const setupFee     = subtotal;
                  const mo1          = mrrTotal;
                  const lastMo       = mrrTotal;
                  const totalDeposit = setupFee + mo1 + lastMo;
                  return (
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 space-y-1 text-xs">
                      <p className="font-semibold text-gray-800 text-[11px] uppercase tracking-wider mb-2">Deposit (due at signing)</p>
                      <div className="flex justify-between text-gray-600">
                        <span>Setup fee (one-time)</span>
                        <span className="font-medium text-gray-900">${fmt(setupFee)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Month 1 (MRR)</span>
                        <span className="font-medium text-gray-900">${fmt(mo1)}/mo</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Last month (MRR)</span>
                        <span className="font-medium text-gray-900">${fmt(lastMo)}/mo</span>
                      </div>
                      <div className="flex justify-between pt-1.5 border-t border-blue-200 font-bold text-gray-900">
                        <span>Total deposit</span>
                        <span>${fmt(totalDeposit)}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Schedule table toggle */}
                <button
                  onClick={() => setRampExpanded(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-[#6B7EFF] font-medium w-full"
                >
                  <ChevronDown size={12} className={cn('transition-transform', rampExpanded && 'rotate-180')} />
                  {rampExpanded ? 'Hide' : 'Show'} ramp-up schedule
                </button>

                {rampExpanded && mrrTotal > 0 && (() => {
                  const rows   = buildRampSchedule(mrrTotal, rampStartPct, rampStepPct, rampFullMonth);
                  const savings = rows.slice(0, -1).reduce((s, r) => s + (mrrTotal - r.amount), 0);
                  return (
                    <div className="space-y-2">
                      <div className="overflow-hidden rounded-lg border border-gray-200">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-gray-600">Mo</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-600">Rate</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-600">Bill</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            <tr className="bg-blue-50/30">
                              <td className="px-3 py-1.5 font-medium text-gray-700">1</td>
                              <td className="px-3 py-1.5 text-right text-gray-600">100%</td>
                              <td className="px-3 py-1.5 text-right font-medium text-gray-900">${fmt(mrrTotal)}</td>
                            </tr>
                            {rows.map(r => (
                              <tr key={r.month} className={r.pct === 100 ? 'bg-emerald-50/30' : ''}>
                                <td className="px-3 py-1.5 font-medium text-gray-700">{r.month}{r.pct === 100 ? '+' : ''}</td>
                                <td className="px-3 py-1.5 text-right text-gray-600">{r.pct.toFixed(1)}%</td>
                                <td className="px-3 py-1.5 text-right font-medium text-gray-900">${fmt(r.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {savings > 0 && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-800">
                          <span className="font-semibold">Client saves ${fmt(savings)}</span>
                          <span className="text-emerald-600"> during ramp-up period</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            <button
              onClick={savePaymentPlan}
              disabled={savingPlan}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-[#6B7EFF] text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {savingPlan ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Save Payment Plan
            </button>
          </div>

          {/* Client + Site */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Details</h2>
            {(quote.client_org_name || quote.client_name) && (
              <div className="flex items-start gap-2">
                <Users size={13} className="text-[#6B7EFF] shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] text-gray-400">Client</p>
                  <p className="text-sm text-gray-800">{quote.client_org_name ?? quote.client_name}</p>
                  {quote.client_email && <p className="text-xs text-gray-500">{quote.client_email}</p>}
                  {quote.client_phone && <p className="text-xs text-gray-500">{quote.client_phone}</p>}
                </div>
              </div>
            )}
            {(quote.site_name || quote.property_name) && (
              <div className="flex items-start gap-2">
                <Building2 size={13} className="text-[#6B7EFF] shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] text-gray-400">Property</p>
                  <p className="text-sm text-gray-800">{quote.site_name ?? quote.property_name}</p>
                  {quote.property_address && <p className="text-xs text-gray-500">{quote.property_address}</p>}
                </div>
              </div>
            )}
            {quote.site_id && (
              <Link href={`/sites/${quote.site_id}`} className="flex items-center gap-1 text-xs text-[#6B7EFF] hover:underline">
                <ExternalLink size={11} /> View Site
              </Link>
            )}
          </div>

          {/* Approval link */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Client Approval</h2>
            <p className="text-xs text-gray-500">Share with the client to let them review and approve.</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={copyApprovalLink}
                className="flex items-center gap-1.5 text-xs border border-[#6B7EFF]/30 text-[#6B7EFF] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors"
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <Link
                href={`/quotes/${id}/approve`}
                target="_blank"
                className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
              >
                <ExternalLink size={11} /> Preview
              </Link>
            </div>
          </div>

          {/* Notes & Scope of Work */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ClipboardList size={14} className="text-[#6B7EFF]" />
              <h2 className="text-sm font-semibold text-gray-900">Notes &amp; Scope of Work</h2>
            </div>

            {/* Linked survey row */}
            {linkedSurvey ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-blue-800 truncate">
                      {linkedSurvey.survey_number}
                      {linkedSurvey.property_name ? ` — ${linkedSurvey.property_name}` : ''}
                    </p>
                    <p className="text-[10px] text-blue-600 mt-0.5">Survey linked</p>
                  </div>
                  <button
                    onClick={unlinkSurvey}
                    title="Unlink survey"
                    className="shrink-0 flex items-center gap-1 text-[10px] text-gray-500 hover:text-red-500 border border-gray-200 hover:border-red-200 rounded px-2 py-1 transition-colors"
                  >
                    <Unlink size={10} /> Unlink
                  </button>
                </div>
                {linkedSurvey.ai_summary && (
                  <p className="text-xs text-gray-500 italic leading-relaxed">
                    {linkedSurvey.ai_summary}
                  </p>
                )}
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowSurveyPicker(v => !v)}
                  className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg px-3 py-1.5 transition-colors w-full justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <LinkIcon size={11} /> Link Survey
                  </span>
                  <ChevronDown size={11} className={cn('transition-transform', showSurveyPicker && 'rotate-180')} />
                </button>
                {showSurveyPicker && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {surveys.length === 0 ? (
                      <p className="text-xs text-gray-400 px-3 py-3 text-center">No surveys found</p>
                    ) : (
                      surveys.map(s => (
                        <button
                          key={s.id}
                          onClick={() => linkSurvey(s)}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
                        >
                          <p className="text-xs font-medium text-gray-800">{s.survey_number}</p>
                          {s.property_name && <p className="text-[10px] text-gray-500">{s.property_name}</p>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Import SOW button — only shown when survey has ai_sow */}
            {linkedSurvey?.ai_sow && (
              <button
                onClick={() => { setNotes(linkedSurvey.ai_sow!); }}
                className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg px-3 py-1.5 transition-colors w-full"
              >
                <ClipboardList size={11} /> Import SOW from survey
              </button>
            )}

            {/* Notes textarea */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes / SOW</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={8}
                placeholder="Scope of work, internal notes, special conditions..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] resize-none"
              />
            </div>

            <button
              onClick={saveNotes}
              disabled={savingNotes}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#6B7EFF] hover:bg-[#5a6fd6] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {savingNotes ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Save Notes
            </button>
          </div>
        </div>
      </div>

      {/* Slide-over for adding/editing items */}
      {showAddItem && (
        <ItemForm
          quoteId={id}
          item={editingItem}
          onSaved={onItemSaved}
          onClose={() => { setShowAddItem(false); setEditingItemId(null); }}
        />
      )}
    </div>
  );
}
