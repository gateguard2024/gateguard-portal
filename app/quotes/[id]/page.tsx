'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText, Send, CheckCircle2, XCircle, Clock, Eye,
  Copy, ExternalLink, Plus, Trash2, Loader2, ChevronLeft,
  Check, AlertTriangle, Users, Building2, ChevronDown,
  Search, Hash, Layers, X, Download, Mail,
} from 'lucide-react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Edit2, ArrowUpRight, DollarSign, Package, SlidersHorizontal, Tag, FileDown, LinkIcon, ClipboardList, Unlink, Upload, Shield, ListChecks, Paperclip, UserCheck } = require('lucide-react') as any;
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
  opportunity_id:      string | null;
  // migration 091
  whats_included:        { label: string; included: boolean }[] | null;
  payment_schedule_json: { label: string; description?: string; amount: number; suffix?: string; color?: string }[] | null;
  sow_text:              string | null;
  agreement_type:        string | null;
  agreement_html:        string | null;
  attachments:           { name: string; url: string; size?: number }[] | null;
  signed_at:             string | null;
  signer_name:           string | null;
  signer_email:          string | null;
  accepted_by_rep:       boolean | null;
  accepted_by_rep_name:  string | null;
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
  const [saving, setSaving]               = useState(false);
  const [err,    setErr]                  = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts]           = useState<Array<{ id: string; name: string; sku: string; list_price: number }>>([]);
  const [showProducts, setShowProducts]   = useState(false);
  const [saveToProducts, setSaveToProducts] = useState(false);

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
      // If "save to catalog" is checked and this is a new custom item, create the product first
      let resolvedProductId = form.product_id;
      if (!isEdit && saveToProducts && !form.product_id) {
        const pRes = await fetch('/api/products', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            name:       form.description,
            sku:        form.sku       || undefined,
            sell_price: form.unit_price,
            list_price: form.unit_price,
            category:   form.section_name || 'Custom',
          }),
        });
        const pJson = await pRes.json();
        if (!pRes.ok) throw new Error(`Catalog save failed: ${pJson.error ?? 'unknown'}`);
        resolvedProductId = pJson.product?.id ?? null;
      }

      const url    = isEdit ? `/api/quotes/${quoteId}/items/${item!.id}` : `/api/quotes/${quoteId}/items`;
      const method = isEdit ? 'PATCH' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...form, product_id: resolvedProductId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      onSaved(json.item);
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally { setSaving(false); }
  }

  const SECTIONS   = ['Infrastructure', 'Cameras', 'Wireless & Networking', 'Labor', 'Software / MRR', 'Access Control', 'Materials', 'Equipment', 'Other'];
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
          <div className="flex gap-4 flex-wrap">
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

          {/* Save to Products catalog — only for new custom items not picked from catalog */}
          {!isEdit && !form.product_id && (
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none px-3 py-2.5 rounded-lg border border-dashed border-[#6B7EFF]/40 bg-[#6B7EFF]/5 hover:bg-[#6B7EFF]/10 transition-colors">
              <input
                type="checkbox"
                checked={saveToProducts}
                onChange={e => setSaveToProducts(e.target.checked)}
                className="rounded border-gray-300 accent-[#6B7EFF]"
              />
              <span className="text-[#4B5AE8] font-medium">Save to Products catalog</span>
              <span className="text-gray-400 text-xs">— reuse in future quotes &amp; invoices</span>
            </label>
          )}

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

// ── Inline Service Catalog ─────────────────────────────────────────────────────
interface SvcItem { id:string; name:string; provider:string; category:string; description?:string; emoji:string; color:string; billing_type:string; base_price:number; unit_label:string; dealer_commission_pct:number; }
const SVC_DATA: SvcItem[] = [
  { id:'tv-1',  name:'DIRECTV STREAM Bulk',        provider:'AT&T DIRECTV',      category:'TV',              emoji:'📺', color:'#00A8E0', billing_type:'per_unit',     base_price:12,  unit_label:'unit',     dealer_commission_pct:12 },
  { id:'tv-2',  name:'Spectrum TV Select',          provider:'Spectrum',          category:'TV',              emoji:'📡', color:'#0099D9', billing_type:'per_unit',     base_price:11,  unit_label:'unit',     dealer_commission_pct:8 },
  { id:'isp-1', name:'AT&T Fiber Bulk MDU',         provider:'AT&T',              category:'Internet',        emoji:'🌐', color:'#00A8E0', billing_type:'per_unit',     base_price:18,  unit_label:'unit',     dealer_commission_pct:10 },
  { id:'isp-2', name:'Comcast Business MDU',        provider:'Comcast/Xfinity',   category:'Internet',        emoji:'📶', color:'#E1251B', billing_type:'per_unit',     base_price:15,  unit_label:'unit',     dealer_commission_pct:8 },
  { id:'isp-3', name:'Starlink for MDU',            provider:'SpaceX Starlink',   category:'Internet',        emoji:'🚀', color:'#FF5733', billing_type:'per_property', base_price:500, unit_label:'property', dealer_commission_pct:5 },
  { id:'vm-1',  name:'Video Monitoring — Remote',   provider:'Keystone Security', category:'Video Monitoring',emoji:'👁️', color:'#7C3AED', billing_type:'per_property', base_price:395, unit_label:'property', dealer_commission_pct:15 },
  { id:'vm-2',  name:'Video Monitoring — AI',       provider:'Envision AI',       category:'Video Monitoring',emoji:'🤖', color:'#6B7EFF', billing_type:'per_camera',   base_price:18,  unit_label:'camera',   dealer_commission_pct:12 },
  { id:'pl-1',  name:'Package Lockers — Standard',  provider:'Luxer One',         category:'Package Lockers', emoji:'📦', color:'#FF6B35', billing_type:'flat_fee',     base_price:149, unit_label:'property', dealer_commission_pct:20 },
  { id:'pl-2',  name:'Amazon Hub Apartment',        provider:'Amazon',            category:'Package Lockers', emoji:'📬', color:'#FF9900', billing_type:'flat_fee',     base_price:0,   unit_label:'property', dealer_commission_pct:0 },
  { id:'ac-1',  name:'GateGuard Access + Gate Plan',provider:'GateGuard',         category:'Access Control',  emoji:'🔑', color:'#6B7EFF', billing_type:'per_unit',     base_price:5,   unit_label:'unit',     dealer_commission_pct:0 },
  { id:'ac-2',  name:'Brivo Cloud Access Control',  provider:'Brivo',             category:'Access Control',  emoji:'🚪', color:'#0069C0', billing_type:'per_unit',     base_price:3,   unit_label:'door',     dealer_commission_pct:8 },
  { id:'sl-1',  name:'Yale Smart Locks — Z-wave',   provider:'Yale',              category:'Smart Locks',     emoji:'🔐', color:'#003DA5', billing_type:'flat_fee',     base_price:12,  unit_label:'door',     dealer_commission_pct:18 },
  { id:'sl-2',  name:'Schlage Encode Plus',         provider:'Schlage',           category:'Smart Locks',     emoji:'🗝️', color:'#1C3D5A', billing_type:'flat_fee',     base_price:10,  unit_label:'door',     dealer_commission_pct:15 },
  { id:'sec-1', name:'ADT Commercial Security',     provider:'ADT',               category:'Security',        emoji:'🛡️', color:'#0066FF', billing_type:'per_property', base_price:89,  unit_label:'property', dealer_commission_pct:12 },
  { id:'sec-2', name:'Verkada Access + Security',   provider:'Verkada',           category:'Security',        emoji:'📷', color:'#1A1A2E', billing_type:'per_device',   base_price:20,  unit_label:'device',   dealer_commission_pct:10 },
  { id:'net-1', name:'GateGuard Network Mgmt',      provider:'GateGuard',         category:'Network Mgmt',    emoji:'🌐', color:'#6B7EFF', billing_type:'per_property', base_price:199, unit_label:'property', dealer_commission_pct:0 },
  { id:'net-2', name:'Comcast Business Ethernet',   provider:'Comcast Business',  category:'Network Mgmt',    emoji:'🔌', color:'#E1251B', billing_type:'per_property', base_price:299, unit_label:'property', dealer_commission_pct:8 },
  { id:'en-1',  name:'Solstice Energy Sharing',     provider:'Solstice Power',    category:'Energy',          emoji:'☀️', color:'#F59E0B', billing_type:'per_unit',     base_price:2,   unit_label:'unit',     dealer_commission_pct:8 },
];
const SVC_CATS = ['All','TV','Internet','Video Monitoring','Package Lockers','Access Control','Smart Locks','Security','Network Mgmt','Energy'];

function SvcPickerPanel({ quoteId, units, onAdded, onClose }: { quoteId:string; units:number; onAdded:(item:LineItem)=>void; onClose:()=>void }) {
  const [cat,   setCat]   = useState('All');
  const [q,     setQ]     = useState('');
  const [adding, setAdding] = useState<string|null>(null);

  const filtered = SVC_DATA.filter(s =>
    (cat === 'All' || s.category === cat) &&
    (!q.trim() || s.name.toLowerCase().includes(q.toLowerCase()) || s.provider.toLowerCase().includes(q.toLowerCase()))
  );

  async function addSvc(svc: SvcItem) {
    setAdding(svc.id);
    try {
      const qty = svc.billing_type === 'per_unit' ? (units || 1) : 1;
      const commNote = svc.dealer_commission_pct > 0
        ? `Dealer earns ${svc.dealer_commission_pct}% (~$${((svc.base_price * qty * svc.dealer_commission_pct)/100).toFixed(0)}/mo). Provider: ${svc.provider}.`
        : `GateGuard platform service. Provider: ${svc.provider}.`;
      const res = await fetch(`/api/quotes/${quoteId}/items`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description:  svc.name,
          qty,
          unit_price:   svc.base_price,
          unit:         svc.unit_label,
          is_recurring: true,
          section_name: 'Recurring Services',
          item_type:    'service',
          is_optional:  false,
          category:     svc.category,
          notes:        commNote,
          sku:          svc.id,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      onAdded(data.item);
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to add service'); }
    finally { setAdding(null); }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-white border-l border-gray-200 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-sm font-semibold text-gray-900">Browse Service Catalog</p>
            <p className="text-xs text-gray-500 mt-0.5">Add recurring revenue services to this quote</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 transition-colors"><X size={14} /></button>
        </div>
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search services…"
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]" />
          </div>
        </div>
        <div className="px-4 pb-2">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {SVC_CATS.map(c => (
              <button key={c} onClick={()=>setCat(c)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${cat===c ? 'bg-[#6B7EFF] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {filtered.map(svc => {
            const qty = svc.billing_type === 'per_unit' ? (units||1) : 1;
            const mrrEst = svc.base_price * qty;
            const commEst = mrrEst * svc.dealer_commission_pct / 100;
            const isAdding = adding === svc.id;
            return (
              <div key={svc.id} className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl hover:border-[#6B7EFF]/40 transition-colors">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0" style={{background:`${svc.color}20`}}>{svc.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900 leading-tight">{svc.name}</p>
                      <p className="text-xs text-gray-500">{svc.provider} · {svc.category}</p>
                    </div>
                    <button onClick={()=>addSvc(svc)} disabled={isAdding}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#6B7EFF] hover:bg-[#5a6de0] text-white text-xs font-semibold transition-colors disabled:opacity-60">
                      {isAdding ? <Loader2 size={10} className="animate-spin"/> : <Plus size={10}/>} Add
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs font-semibold text-gray-700">${svc.base_price}/{svc.unit_label}</span>
                    {svc.dealer_commission_pct > 0 && <span className="text-xs text-emerald-600 font-medium">~${commEst.toFixed(0)}/mo commission</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-5 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">Added as recurring line items · Section: Recurring Services · Estimates based on {units||1} unit{units!==1?'s':''}.</p>
        </div>
      </div>
    </div>
  );
}

// ── Agreement templates ────────────────────────────────────────────────────────

const AGREEMENT_TYPES = [
  { value: 'install_only',      label: 'Installation Only' },
  { value: 'install_service',   label: 'Install + Service Agreement' },
  { value: 'gate_maintenance',  label: 'Gate Maintenance Plan' },
  { value: 'full_service',      label: 'Full Service Agreement' },
];

const AGREEMENT_TEMPLATES: Record<string, string> = {
  install_only: `<h2>Installation Agreement</h2>
<p>This Installation Agreement ("Agreement") is entered into between GateGuard ("Company") and the client ("Client") named in the proposal above.</p>
<h3>1. Scope of Work</h3>
<p>Company agrees to furnish all labor, materials, and equipment necessary to complete the installation as described in the attached scope of work and line items.</p>
<h3>2. Payment Terms</h3>
<p>A deposit of the amount specified is due upon execution of this agreement. The remaining balance is due upon completion of installation.</p>
<h3>3. Warranty</h3>
<p>Company warrants all labor for a period of ninety (90) days from the date of installation. Equipment warranties are subject to manufacturer terms.</p>
<h3>4. Client Responsibilities</h3>
<p>Client shall provide access to the property, adequate power to the installation locations, and a designated point of contact for scheduling.</p>
<h3>5. Limitation of Liability</h3>
<p>Company's liability shall not exceed the total contract value. Company is not liable for damages resulting from equipment failure after the warranty period.</p>`,

  install_service: `<h2>Installation & Service Agreement</h2>
<p>This Agreement is entered into between GateGuard ("Company") and the client ("Client") named in the proposal above.</p>
<h3>1. Scope of Work</h3>
<p>Company agrees to furnish all labor, materials, and equipment necessary to complete the installation and provide ongoing service as described herein.</p>
<h3>2. Service Term</h3>
<p>The service term commences upon installation completion and continues for sixty (60) months ("Initial Term"). Service renews automatically on a month-to-month basis unless either party provides thirty (30) days written notice of cancellation.</p>
<h3>3. Early Termination</h3>
<p>If Client terminates this Agreement prior to the expiration of the Initial Term, Client agrees to pay an early termination fee equal to the remaining monthly service fees for the balance of the Initial Term.</p>
<h3>4. Payment Terms</h3>
<p>Installation costs are due as specified in the payment schedule. Monthly service fees are billed in advance on the first of each month.</p>
<h3>5. Service Coverage</h3>
<p>Monthly service fees cover: remote monitoring, software updates, and one (1) scheduled preventive maintenance visit per year. Emergency service calls are billed at the prevailing rate.</p>
<h3>6. Warranty</h3>
<p>All installed equipment is covered under manufacturer warranty. Labor warranty of ninety (90) days applies to installation work.</p>
<h3>7. Limitation of Liability</h3>
<p>Company's liability shall not exceed the total contract value paid in the preceding twelve (12) months.</p>`,

  gate_maintenance: `<h2>Gate Operator Maintenance Plan</h2>
<p>This Maintenance Plan Agreement is entered into between GateGuard ("Company") and the client ("Client") named in the proposal above.</p>
<h3>1. Coverage</h3>
<p>This plan covers the gate operator(s), control board, wiring, and related control equipment specified in the proposal. The gate operator coverage includes: parts, labor, and emergency service calls for covered failures.</p>
<h3>2. Exclusions</h3>
<p>This plan does NOT cover the physical gate structure, gate panels, hinges, tracks, rollers, or structural components. Damage caused by vehicle impact, vandalism, acts of God, or misuse is excluded. Coverage is void if unauthorized modifications are made.</p>
<h3>3. Response Time</h3>
<p>Emergency service calls will be responded to within four (4) business hours. Non-emergency service calls within two (2) business days.</p>
<h3>4. Plan Term</h3>
<p>This plan is billed monthly and may be cancelled with thirty (30) days written notice after the initial twelve (12) month commitment period.</p>
<h3>5. Preventive Maintenance</h3>
<p>Company will perform two (2) scheduled preventive maintenance visits per year, including lubrication, limit adjustments, safety reverse testing, and system inspection.</p>`,

  full_service: `<h2>Full Service Agreement</h2>
<p>This Full Service Agreement ("Agreement") is entered into between GateGuard ("Company") and the client ("Client") named in the proposal above.</p>
<h3>1. Scope of Services</h3>
<p>Company agrees to provide comprehensive installation, monitoring, and service coverage for all access control, gate operator, camera, and network equipment specified in the proposal.</p>
<h3>2. Service Term &amp; Commitment</h3>
<p>The Initial Term is sixty (60) months from the date of installation completion. Early termination fee equals the remaining monthly fees for the balance of the Initial Term.</p>
<h3>3. Service Level Agreement (SLA)</h3>
<p><strong>Emergency Response:</strong> On-site within 4 business hours for gate/access failures.<br/>
<strong>Standard Service:</strong> On-site within 2 business days for non-critical issues.<br/>
<strong>Preventive Maintenance:</strong> Two (2) scheduled visits per year per site.</p>
<h3>4. Coverage Inclusions</h3>
<p>All labor, parts, and emergency service calls for: gate operators and control equipment, access control hardware, camera systems, and network equipment covered under this plan.</p>
<h3>5. Gate Structure Coverage</h3>
<p>If Physical Gate Coverage is included in the line items, coverage extends to: gate panels, tracks, hinges, rollers, and structural components for normal wear and mechanical failure. Damage from impact, vandalism, or Acts of God is excluded.</p>
<h3>6. Payment Terms</h3>
<p>Installation costs per the payment schedule. Monthly recurring fees billed on the first of each month. Late payments incur a 1.5% monthly finance charge.</p>
<h3>7. Monitoring &amp; Reporting</h3>
<p>Company will provide monthly uptime reports and proactive notification of any system anomalies or offline equipment detected through remote monitoring.</p>
<h3>8. Limitation of Liability</h3>
<p>Company's aggregate liability shall not exceed twelve (12) months of fees paid under this Agreement. Neither party shall be liable for consequential, incidental, or punitive damages.</p>
<h3>9. Governing Law</h3>
<p>This Agreement shall be governed by the laws of the state in which the property is located.</p>`,
};

// Default What's Included checklist
const DEFAULT_WHATS_INCLUDED = [
  { label: 'Gate operator installation & programming', included: true },
  { label: 'Access control system configuration', included: true },
  { label: 'Camera system installation & setup', included: true },
  { label: 'Network infrastructure & VLAN setup', included: true },
  { label: 'Mobile app setup for residents', included: true },
  { label: '24/7 remote monitoring', included: true },
  { label: 'Annual preventive maintenance visits', included: true },
  { label: 'Dedicated tech support line', included: true },
  { label: 'Online portal access for property manager', included: true },
  { label: 'Training for on-site staff', included: true },
];

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

  // Draft Email state
  const [showEmailDraft,  setShowEmailDraft] = useState<boolean>(false);
  const [emailSubject,    setEmailSubject]   = useState<string>('');
  const [emailBody,       setEmailBody]      = useState<string>('');
  const [generatingEmail, setGeneratingEmail] = useState<boolean>(false);
  const [emailCopied,     setEmailCopied]    = useState<boolean>(false);

  // Global discount editing
  const [editingDiscount,   setEditingDiscount]   = useState<boolean>(false);
  const [discountDraft,     setDiscountDraft]      = useState<string>('');
  const [applyingDiscount,  setApplyingDiscount]   = useState<boolean>(false);

  // Notes & SOW state
  const [notes,           setNotes]          = useState<string>('');
  const [savingNotes,     setSavingNotes]    = useState<boolean>(false);

  // What's Included state
  const [whatsIncluded,   setWhatsIncluded]  = useState<{ label: string; included: boolean }[]>([]);
  const [newWiLabel,      setNewWiLabel]     = useState<string>('');
  const [savingWI,        setSavingWI]       = useState<boolean>(false);

  // Agreement state — when type changes, pre-fill template if html is empty/default
  const [agreementType,   setAgreementType]  = useState<string>('install_only');
  const [agreementHtml,   setAgreementHtml]  = useState<string>('');
  const [agreementOpen,   setAgreementOpen]  = useState<boolean>(false);
  const [savingAgreement, setSavingAgreement] = useState<boolean>(false);
  const [editAgreementHtml, setEditAgreementHtml] = useState<boolean>(false);

  // Attachments state
  const [attachments,     setAttachments]    = useState<{ name: string; url: string; size?: number }[]>([]);
  const [uploadingFile,   setUploadingFile]  = useState<boolean>(false);
  const [savingAttachments, setSavingAttachments] = useState<boolean>(false);

  // Accept on behalf
  const [repAcceptName,   setRepAcceptName]  = useState<string>('');
  const [repAccepting,    setRepAccepting]   = useState<boolean>(false);
  const [repAccepted,     setRepAccepted]    = useState<boolean>(false);

  const [surveys,         setSurveys]        = useState<SurveyOption[]>([]);
  const [showSurveyPicker, setShowSurveyPicker] = useState<boolean>(false);
  const [linkedSurvey,    setLinkedSurvey]   = useState<SurveyOption | null>(null);
  const [showSvcPicker,   setShowSvcPicker]  = useState<boolean>(false);

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
      // Sync migration 091 fields
      setWhatsIncluded(data.quote.whats_included?.length ? data.quote.whats_included : DEFAULT_WHATS_INCLUDED);
      setAgreementType(data.quote.agreement_type ?? 'install_only');
      setAgreementHtml(data.quote.agreement_html ?? AGREEMENT_TEMPLATES['install_only']);
      setAttachments(data.quote.attachments ?? []);
      setRepAccepted(!!data.quote.accepted_by_rep);
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
      // 'sent' uses the dedicated send endpoint which emails the client + CCs rfeldman@gateguard.co
      const endpoint = status === 'sent'
        ? `/api/quotes/${id}/send`
        : `/api/quotes/${id}`;
      const body     = status === 'sent'
        ? undefined
        : JSON.stringify({ status });
      const res = await fetch(endpoint, {
        method:  'POST',
        headers: status === 'sent' ? {} : { 'Content-Type': 'application/json' },
        body,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const updatedQuote = { ...quote, ...data.quote };
      setQuote(q => q ? { ...q, ...data.quote } : q);

      // Sync financial details to linked opportunity when quote is sent or accepted
      if ((status === 'sent' || status === 'accepted') && updatedQuote.opportunity_id) {
        const depositPct = updatedQuote.deposit_percent ?? 50;
        const depositDue = (updatedQuote.total_one_time * (depositPct / 100)) + (updatedQuote.total_mrr ?? 0);
        void fetch(`/api/crm/opportunities/${updatedQuote.opportunity_id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            est_deposit:   Math.round(depositDue),
            monthly_total: updatedQuote.total_mrr,
            est_mrr:       updatedQuote.total_mrr,
            ...(updatedQuote.units ? { units: updatedQuote.units } : {}),
          }),
        }).catch(() => { /* non-blocking — don't let this fail the quote action */ });
      }

      // Show email confirmation toast for 'sent'
      if (status === 'sent' && data.email_sent) {
        alert(`✓ Quote sent! Email delivered to ${data.email_to} (CC: ${data.email_cc})`);
      } else if (status === 'sent' && !data.email_sent && data.email_to) {
        alert(`Quote marked sent, but email failed: ${data.email_error}`);
      }
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

  async function saveWhatsIncluded() {
    setSavingWI(true);
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ whats_included: whatsIncluded }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setQuote(q => q ? { ...q, whats_included: data.quote.whats_included } : q);
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to save'); }
    finally { setSavingWI(false); }
  }

  async function saveAgreement() {
    setSavingAgreement(true);
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ agreement_type: agreementType, agreement_html: agreementHtml }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setQuote(q => q ? { ...q, agreement_type: data.quote.agreement_type, agreement_html: data.quote.agreement_html } : q);
      setEditAgreementHtml(false);
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to save agreement'); }
    finally { setSavingAgreement(false); }
  }

  async function saveAttachments(updated: { name: string; url: string; size?: number }[]) {
    setSavingAttachments(true);
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ attachments: updated }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAttachments(data.quote.attachments ?? []);
      setQuote(q => q ? { ...q, attachments: data.quote.attachments } : q);
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to save attachments'); }
    finally { setSavingAttachments(false); }
  }

  async function uploadAttachment(file: File) {
    setUploadingFile(true);
    try {
      // 1. Get signed upload URL from Supabase
      const urlRes = await fetch('/api/kb/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: `quote-attachments/${id}/${file.name}`, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error('Failed to get upload URL');
      const { signedUrl, publicUrl } = await urlRes.json();

      // 2. Upload directly to Supabase Storage
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!uploadRes.ok) throw new Error('Failed to upload file');

      // 3. Append to attachments list + save
      const newAttachment = { name: file.name, url: publicUrl ?? signedUrl.split('?')[0], size: file.size };
      const updated = [...attachments, newAttachment];
      setAttachments(updated);
      await saveAttachments(updated);
    } catch (e) { alert(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setUploadingFile(false); }
  }

  async function acceptOnBehalfOfClient() {
    if (!repAcceptName.trim()) return;
    setRepAccepting(true);
    try {
      const res = await fetch(`/api/quotes/${id}/public`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:      'approve',
          rep_accept:  true,
          signer_name: repAcceptName.trim(),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setRepAccepted(true);
      setQuote(q => q ? { ...q, status: 'accepted', accepted_at: new Date().toISOString(), accepted_by_rep: true, accepted_by_rep_name: repAcceptName.trim() } : q);
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to accept'); }
    finally { setRepAccepting(false); }
  }

  async function applyGlobalDiscount(pct: number) {
    if (!quote) return;
    setApplyingDiscount(true);
    try {
      // 1. Save the quote-level discount_percent
      await fetch(`/api/quotes/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ discount_percent: pct }),
      });
      // 2. Apply to every line item so the strikethrough per-line is visible
      const patchPromises = quote.quote_line_items.map(item =>
        fetch(`/api/quotes/${id}/items/${item.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ line_discount_percent: pct }),
        })
      );
      await Promise.all(patchPromises);
      await fetchQuote();
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to apply discount'); }
    finally { setApplyingDiscount(false); setEditingDiscount(false); }
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
    // Copy the proposal URL — this is the client-facing branded proposal page
    navigator.clipboard.writeText(`${window.location.origin}/quotes/${id}/proposal`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function openDraftEmail() {
    setShowEmailDraft(true);
    if (emailSubject) return; // already generated
    setGeneratingEmail(true);
    try {
      const proposalUrl = `${window.location.origin}/quotes/${id}/proposal`;
      const res  = await fetch(`/api/quotes/${id}/draft-email`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ proposalUrl }),
      });
      const json = await res.json();
      if (json.subject) setEmailSubject(json.subject);
      if (json.body)    setEmailBody(json.body);
    } catch {
      setEmailBody('Failed to generate email draft. Please try again.');
    } finally {
      setGeneratingEmail(false);
    }
  }

  function copyEmailToClipboard() {
    const full = `Subject: ${emailSubject}\n\n${emailBody}`;
    navigator.clipboard.writeText(full);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2500);
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
            href={`/quotes/${id}/proposal`}
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 hover:text-[#6B7EFF] hover:border-blue-200 transition-colors"
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
            onClick={() => window.open(`/quotes/${id}/proposal?print=1`, '_blank')}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
          >
            <FileDown size={13} /> Download PDF
          </button>
          <button
            onClick={openDraftEmail}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#6B7EFF] text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Mail size={13} /> Draft Email
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
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSvcPicker(true)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#6B7EFF] font-medium transition-colors border border-gray-200 rounded-lg px-2.5 py-1 hover:border-[#6B7EFF]/40"
                >
                  🏪 Browse Services
                </button>
                <button
                  onClick={() => { setEditingItemId(null); setShowAddItem(true); }}
                  className="flex items-center gap-1.5 text-xs text-[#6B7EFF] font-medium hover:text-blue-700 transition-colors"
                >
                  <Plus size={12} /> Add Item
                </button>
              </div>
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
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <DollarSign size={14} className="text-[#6B7EFF]" />
                <h2 className="text-sm font-semibold text-gray-900">Pricing</h2>
              </div>
              {!editingDiscount ? (
                <button
                  onClick={() => { setDiscountDraft(String(discPct)); setEditingDiscount(true); }}
                  className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-[#6B7EFF] border border-dashed border-gray-200 hover:border-[#6B7EFF]/40 rounded px-1.5 py-0.5 transition-colors"
                >
                  <Tag size={9} /> {discPct > 0 ? `${discPct}% disc` : '+ Discount'}
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <input
                    type="number" min={0} max={100} step={0.5}
                    value={discountDraft}
                    onChange={e => setDiscountDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') applyGlobalDiscount(parseFloat(discountDraft) || 0); if (e.key === 'Escape') setEditingDiscount(false); }}
                    placeholder="10"
                    className="w-16 border border-[#6B7EFF] rounded px-1.5 py-0.5 text-xs text-center focus:outline-none"
                    autoFocus
                  />
                  <span className="text-xs text-gray-400">%</span>
                  <button
                    onClick={() => applyGlobalDiscount(parseFloat(discountDraft) || 0)}
                    disabled={applyingDiscount}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 bg-[#6B7EFF] text-white text-[10px] font-medium rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {applyingDiscount ? <Loader2 size={9} className="animate-spin" /> : <Check size={9} />}
                    Apply all
                  </button>
                  <button onClick={() => setEditingDiscount(false)} className="p-0.5 text-gray-300 hover:text-gray-500">
                    <X size={12} />
                  </button>
                </div>
              )}
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

          {/* Proposal link */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Client Proposal</h2>
            <p className="text-xs text-gray-500">Share this link with the client to review, accept, or decline.</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={copyApprovalLink}
                className="flex items-center gap-1.5 text-xs border border-[#6B7EFF]/30 text-[#6B7EFF] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors"
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? 'Copied!' : 'Copy Proposal Link'}
              </button>
              <Link
                href={`/quotes/${id}/proposal`}
                target="_blank"
                className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
              >
                <ExternalLink size={11} /> Open
              </Link>
            </div>
            <button
              onClick={openDraftEmail}
              className="w-full flex items-center justify-center gap-1.5 text-xs bg-[#6B7EFF] text-white rounded-lg px-3 py-2 hover:bg-blue-700 transition-colors font-medium"
            >
              <Mail size={11} /> Draft Email to Client
            </button>
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

          {/* ── What's Included ────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ListChecks size={14} className="text-[#6B7EFF]" />
              <h2 className="text-sm font-semibold text-gray-900">What&apos;s Included</h2>
              <span className="ml-auto text-[10px] text-gray-400">shown on proposal</span>
            </div>
            <div className="space-y-1.5">
              {whatsIncluded.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 group">
                  <button
                    onClick={() => {
                      const updated = whatsIncluded.map((w, i) => i === idx ? { ...w, included: !w.included } : w);
                      setWhatsIncluded(updated);
                    }}
                    className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                      item.included ? 'bg-[#6B7EFF] border-[#6B7EFF]' : 'border-gray-300'
                    )}
                  >
                    {item.included && <Check size={10} className="text-white" />}
                  </button>
                  <span className={cn('text-xs flex-1', item.included ? 'text-gray-800' : 'text-gray-400 line-through')}>{item.label}</span>
                  <button
                    onClick={() => setWhatsIncluded(whatsIncluded.filter((_, i) => i !== idx))}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 transition-opacity"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
            {/* Add new item */}
            <div className="flex gap-2">
              <input
                value={newWiLabel}
                onChange={e => setNewWiLabel(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newWiLabel.trim()) {
                    setWhatsIncluded([...whatsIncluded, { label: newWiLabel.trim(), included: true }]);
                    setNewWiLabel('');
                  }
                }}
                placeholder="Add item…"
                className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
              />
              <button
                onClick={() => {
                  if (newWiLabel.trim()) {
                    setWhatsIncluded([...whatsIncluded, { label: newWiLabel.trim(), included: true }]);
                    setNewWiLabel('');
                  }
                }}
                className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs transition-colors"
              >
                <Plus size={11} />
              </button>
            </div>
            <button
              onClick={saveWhatsIncluded}
              disabled={savingWI}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#6B7EFF] hover:bg-[#5a6fd6] text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              {savingWI ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              Save
            </button>
          </div>

          {/* ── Agreement ─────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            <button
              onClick={() => setAgreementOpen(v => !v)}
              className="w-full flex items-center gap-2"
            >
              <Shield size={14} className="text-[#6B7EFF]" />
              <h2 className="text-sm font-semibold text-gray-900 flex-1 text-left">Agreement</h2>
              {quote?.signed_at && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                  <Check size={9} /> Signed by {quote.signer_name}
                </span>
              )}
              <ChevronDown size={13} className={cn('text-gray-400 transition-transform', agreementOpen && 'rotate-180')} />
            </button>

            {agreementOpen && (
              <div className="space-y-3 pt-1">
                {/* Type selector */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Agreement Type</label>
                  <select
                    value={agreementType}
                    onChange={e => {
                      setAgreementType(e.target.value);
                      // Pre-fill template if user hasn't customised yet
                      setAgreementHtml(AGREEMENT_TEMPLATES[e.target.value] ?? '');
                    }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-white"
                  >
                    {AGREEMENT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {/* HTML editor toggle */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-700">Agreement Text</label>
                    <button
                      onClick={() => setEditAgreementHtml(v => !v)}
                      className="text-[10px] text-[#6B7EFF] hover:underline"
                    >
                      {editAgreementHtml ? 'Preview' : 'Edit HTML'}
                    </button>
                  </div>
                  {editAgreementHtml ? (
                    <textarea
                      value={agreementHtml}
                      onChange={e => setAgreementHtml(e.target.value)}
                      rows={14}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] resize-none"
                      placeholder="Enter HTML agreement text…"
                    />
                  ) : (
                    <div
                      className="border border-gray-100 rounded-lg p-3 text-xs text-gray-700 leading-relaxed max-h-48 overflow-y-auto prose prose-xs"
                      dangerouslySetInnerHTML={{ __html: agreementHtml || AGREEMENT_TEMPLATES[agreementType] || '' }}
                    />
                  )}
                  <button
                    onClick={() => setAgreementHtml(AGREEMENT_TEMPLATES[agreementType] ?? '')}
                    className="mt-1 text-[10px] text-gray-400 hover:text-gray-600"
                  >
                    ↺ Reset to template
                  </button>
                </div>

                <button
                  onClick={saveAgreement}
                  disabled={savingAgreement}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#6B7EFF] hover:bg-[#5a6fd6] text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {savingAgreement ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                  Save Agreement
                </button>
              </div>
            )}
          </div>

          {/* ── Attachments ───────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Paperclip size={14} className="text-[#6B7EFF]" />
              <h2 className="text-sm font-semibold text-gray-900">Attachments</h2>
              <span className="ml-auto text-[10px] text-gray-400">{attachments.length} file{attachments.length !== 1 ? 's' : ''}</span>
            </div>

            {attachments.length > 0 && (
              <div className="space-y-1.5">
                {attachments.map((att, idx) => (
                  <div key={idx} className="flex items-center gap-2 group bg-gray-50 rounded-lg px-3 py-2">
                    <FileText size={12} className="text-gray-400 shrink-0" />
                    <a href={att.url} target="_blank" rel="noreferrer" className="text-xs text-[#6B7EFF] hover:underline truncate flex-1">
                      {att.name}
                    </a>
                    {att.size && <span className="text-[10px] text-gray-400">{(att.size / 1024).toFixed(0)} KB</span>}
                    <button
                      onClick={async () => {
                        const updated = attachments.filter((_, i) => i !== idx);
                        setAttachments(updated);
                        await saveAttachments(updated);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className={cn(
              'flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-lg px-4 py-3 cursor-pointer hover:border-[#6B7EFF]/40 hover:bg-blue-50/30 transition-colors',
              uploadingFile && 'opacity-50 pointer-events-none'
            )}>
              {uploadingFile ? (
                <><Loader2 size={13} className="animate-spin text-[#6B7EFF]" /><span className="text-xs text-gray-500">Uploading…</span></>
              ) : (
                <><Upload size={13} className="text-gray-400" /><span className="text-xs text-gray-500">Click to upload file</span></>
              )}
              <input
                type="file"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) uploadAttachment(file);
                  e.target.value = '';
                }}
              />
            </label>
            {savingAttachments && (
              <p className="text-[10px] text-gray-400 text-center flex items-center justify-center gap-1">
                <Loader2 size={10} className="animate-spin" /> Saving…
              </p>
            )}
          </div>

          {/* ── Accept on behalf of client ────────────────────────────── */}
          {quote && quote.status !== 'accepted' && quote.status !== 'declined' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <UserCheck size={14} className="text-amber-600" />
                <h2 className="text-sm font-semibold text-amber-900">Accept on Client&apos;s Behalf</h2>
              </div>
              <p className="text-xs text-amber-700">Use when the client has verbally agreed and you are recording their acceptance.</p>
              {repAccepted ? (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <Check size={12} className="text-emerald-600" />
                  <span className="text-xs text-emerald-700 font-medium">Accepted on behalf of client by {repAcceptName || quote.accepted_by_rep_name}</span>
                </div>
              ) : (
                <>
                  <input
                    value={repAcceptName}
                    onChange={e => setRepAcceptName(e.target.value)}
                    placeholder="Your name (rep recording acceptance)"
                    className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                  />
                  <button
                    onClick={acceptOnBehalfOfClient}
                    disabled={repAccepting || !repAcceptName.trim()}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {repAccepting ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />}
                    Mark as Accepted
                  </button>
                </>
              )}
            </div>
          )}
          {quote?.status === 'accepted' && quote.accepted_by_rep && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
              <UserCheck size={13} className="text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-700">Accepted on behalf of client by <strong>{quote.accepted_by_rep_name}</strong></p>
            </div>
          )}

        </div>
      </div>

      {/* Service picker panel */}
      {showSvcPicker && (
        <SvcPickerPanel
          quoteId={id}
          units={quote?.units ?? 1}
          onAdded={item => { onItemSaved(item); }}
          onClose={() => setShowSvcPicker(false)}
        />
      )}

      {/* Slide-over for adding/editing items */}
      {showAddItem && (
        <ItemForm
          quoteId={id}
          item={editingItem}
          onSaved={onItemSaved}
          onClose={() => { setShowAddItem(false); setEditingItemId(null); }}
        />
      )}

      {/* Draft Email slide-over */}
      {showEmailDraft && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setShowEmailDraft(false)} />
          <div className="w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Mail size={14} className="text-[#6B7EFF]" />
                  Proposal Email Draft
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">AI-generated · edit before sending</p>
              </div>
              <button onClick={() => setShowEmailDraft(false)} className="p-1 rounded hover:bg-gray-100">
                <X size={15} className="text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {generatingEmail ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 size={22} className="animate-spin text-[#6B7EFF]" />
                  <p className="text-sm text-gray-500">Drafting your email…</p>
                </div>
              ) : (
                <>
                  {/* Subject */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Subject Line</label>
                    <input
                      value={emailSubject}
                      onChange={e => setEmailSubject(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                    />
                  </div>

                  {/* Body */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email Body</label>
                    <textarea
                      value={emailBody}
                      onChange={e => setEmailBody(e.target.value)}
                      rows={14}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] resize-none font-mono text-xs leading-relaxed"
                    />
                  </div>

                  {/* Proposal link reminder */}
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <ExternalLink size={11} className="text-[#6B7EFF] shrink-0" />
                    <p className="text-xs text-blue-700">
                      Proposal link:{' '}
                      <span className="font-mono text-[10px]">
                        {typeof window !== 'undefined' ? window.location.origin : ''}/quotes/{id}/proposal
                      </span>
                    </p>
                  </div>
                </>
              )}
            </div>

            {!generatingEmail && (
              <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
                <button
                  onClick={copyEmailToClipboard}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-[#6B7EFF] text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {emailCopied ? <Check size={13} /> : <Copy size={13} />}
                  {emailCopied ? 'Copied to clipboard!' : 'Copy Email'}
                </button>
                <button
                  onClick={() => {
                    setEmailSubject('');
                    setEmailBody('');
                    openDraftEmail();
                  }}
                  className="px-3 py-2 border border-gray-200 text-xs text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Regenerate"
                >
                  ↺ Regenerate
                </button>
                <button onClick={() => setShowEmailDraft(false)} className="px-3 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
