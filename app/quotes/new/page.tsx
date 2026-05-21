'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Building2, Shield, DollarSign, FileText,
  ChevronRight, ChevronLeft,
  Plus, Minus, Check,
  Camera, Network, Wifi, Trash2,
  Loader2, X, Search, MapPin, AlertTriangle,
} from 'lucide-react';
import {
  calculateLineItems, calculateTotals, generateQuoteNumber, formatCurrency,
} from '@/lib/quote-calculator';
import {
  QuoteProperty, SiteSurvey, AccessTier, BillingMode,
  NetworkSurvey, CustomSurveyItem,
} from '@/types/quote';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Layers, SlidersHorizontal, ClipboardList, ArrowUpRight } = require('lucide-react') as any;

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type AppMode = 'pick' | 'wizard' | 'line_item' | 'survey_import';

interface SurveyRecord {
  id: string;
  survey_number: string | null;
  property_name: string | null;
  property_address: string | null;
  surveyor_name: string | null;
  survey_date: string | null;
  status: string | null;
  devices: unknown[] | null;
  ai_bom: unknown[] | null;
  ai_sow: string | null;
  ai_summary: string | null;
  quote_id: string | null;
}

interface QuoteMeta {
  title: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  property_name: string;
  property_address: string;
  notes: string;
  tax_rate: number;
  discount_percent: number;
  deposit_percent: number;
  package_mode: boolean;
}

interface NewLineItem {
  _id: string;
  description: string;
  qty: number;
  unit_price: number;
  unit: string;
  is_recurring: boolean;
  section_name: string;
  item_type: string;
  is_optional: boolean;
  category: string;
  notes: string;
  product_id: string | null;
  image_url: string | null;
  model_number: string | null;
  sku: string | null;
  package_tier: string | null;
}

interface Product { id: string; name: string; sku?: string; model_number?: string; image_url?: string; unit_price?: number; }

/* ─── Constants ──────────────────────────────────────────────────────────────── */
const WIZARD_STEPS = [
  { id: 1, label: 'Property',    icon: Building2 },
  { id: 2, label: 'Site Survey', icon: Shield },
  { id: 3, label: 'Line Items',  icon: DollarSign },
  { id: 4, label: 'Review',      icon: FileText },
];
const LI_STEPS = [
  { id: 1, label: 'Client Info', icon: Building2 },
  { id: 2, label: 'Line Items',  icon: DollarSign },
  { id: 3, label: 'Review',      icon: FileText },
];

const defaultProperty: QuoteProperty = {
  name: '', address: '', city: '', state: 'GA', zip: '',
  units: 0, contactName: '', contactEmail: '', contactPhone: '',
  propertyManager: '', managementCompany: '',
};

function netItem(qty = 0, billing: BillingMode = 'included') { return { qty, billing }; }

const defaultSurvey: SiteSurvey = {
  accessTier: 'tier1_mobile',
  network: {
    router: netItem(1, 'included'), switch4port: netItem(), switch8port: netItem(),
    switch16port: netItem(), radioSmall: netItem(), radioMedium: netItem(),
    radioLarge: netItem(), enclosure: netItem(),
  },
  tier1: {
    primaryDoors:   { working: 1, nonWorking: 0 },
    secondaryDoors: { working: 0, nonWorking: 0 },
    guestGates:     { working: 0, nonWorking: 0 },
    residentGates:  { working: 0, nonWorking: 0 },
    callbox: true,
  },
  tier2: { accessPoints: { working: 0, nonWorking: 0 }, callbox: false },
  cameras: {
    existing: { monitored: 0, standalone: 0 },
    new: { monitored: { qty: 0, billing: 'included' }, standalone: 0 },
  },
  addOns: {
    lprCameras: { qty: 0 },
    gateMaintenance: { enabled: false, initialRepairCost: 0, initialRepairBilling: 'billable', entryGates: 1 },
    customItems: [],
  },
};

const defaultMeta: QuoteMeta = {
  title: '', client_name: '', client_email: '', client_phone: '',
  property_name: '', property_address: '',
  notes: '', tax_rate: 0, discount_percent: 0, deposit_percent: 50, package_mode: false,
};

function blankItem(): NewLineItem {
  return {
    _id: `li_${Date.now()}`,
    description: '', qty: 1, unit_price: 0, unit: 'each',
    is_recurring: false, section_name: 'Equipment',
    item_type: 'equipment', is_optional: false,
    category: 'General', notes: '',
    product_id: null, image_url: null, model_number: null, sku: null, package_tier: null,
  };
}

/* ─── Shared primitive components (module scope — avoids remount/focus loss) ─── */
function Counter({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
        className="w-7 h-7 rounded border border-border bg-background hover:bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
        <Minus className="w-3 h-3" />
      </button>
      <span className="w-7 text-center text-sm font-semibold text-foreground tabular-nums">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)}
        className="w-7 h-7 rounded border border-border bg-background hover:bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text', className: cx }: {
  value: string | number; onChange: (v: string) => void;
  placeholder?: string; type?: string; className?: string;
}) {
  return (
    <input type={type} defaultValue={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-400 ${cx ?? ''}`}
    />
  );
}

function BillingToggle({ value, onChange }: { value: BillingMode; onChange: (v: BillingMode) => void }) {
  return (
    <div className="flex gap-1">
      {(['included', 'billable'] as BillingMode[]).map(b => (
        <button key={b} type="button" onClick={() => onChange(b)}
          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${value === b ? (b === 'included' ? 'bg-brand-400/15 border border-brand-400/30 text-brand-400' : 'bg-violet-400/15 border border-violet-400/30 text-violet-400') : 'border border-border text-muted-foreground hover:text-foreground'}`}>
          {b === 'included' ? 'Included' : 'Billable'}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      className={`w-11 h-6 rounded-full border-2 transition-all relative shrink-0 ${checked ? 'bg-brand-400 border-brand-400' : 'bg-background border-border'}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'left-5' : 'left-0.5'}`} />
    </button>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon className="w-4 h-4 text-brand-400" />}
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      {children}
    </div>
  );
}

function DualCounter({ working, nonWorking, onWorking, onNonWorking, workingPrice, nonWorkingPrice }: {
  working: number; nonWorking: number;
  onWorking: (v: number) => void; onNonWorking: (v: number) => void;
  workingPrice: string; nonWorkingPrice: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-emerald-400 w-20">✓ Working</span>
        <Counter value={working} onChange={onWorking} />
        <span className="text-xs text-muted-foreground">{workingPrice}</span>
      </div>
      <div className="w-px h-6 bg-border" />
      <div className="flex items-center gap-2">
        <span className="text-xs text-amber-400 w-24">⚠ Non-Working</span>
        <Counter value={nonWorking} onChange={onNonWorking} />
        <span className="text-xs text-muted-foreground">{nonWorkingPrice}</span>
      </div>
    </div>
  );
}

/* ─── Step header ─────────────────────────────────────────────────────────────── */
function StepBar({ steps, current, onGo }: { steps: typeof WIZARD_STEPS; current: number; onGo: (n: number) => void }) {
  return (
    <div className="flex items-center">
      {steps.map((s, i) => {
        const Icon   = s.icon;
        const done   = current > s.id;
        const active = current === s.id;
        return (
          <div key={s.id} className="flex items-center flex-1">
            <button type="button" onClick={() => done && onGo(s.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${active ? 'bg-brand-400/10 text-brand-400' : done ? 'text-emerald-400 cursor-pointer hover:bg-emerald-400/5' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${active ? 'border-brand-400 bg-brand-400 text-navy' : done ? 'border-emerald-400 bg-emerald-400/20 text-emerald-400' : 'border-border bg-background text-muted-foreground'}`}>
                {done ? <Check className="w-3.5 h-3.5" /> : s.id}
              </div>
              <span className="text-xs font-medium hidden sm:block">{s.label}</span>
            </button>
            {i < steps.length - 1 && <div className="flex-1 h-px bg-border mx-1" />}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Item form slide-over (line-item builder) ────────────────────────────────── */
function ItemFormPanel({
  initial, onSave, onClose,
}: {
  initial: NewLineItem;
  onSave: (item: NewLineItem) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<NewLineItem>(initial);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (patch: Partial<NewLineItem>) => setForm(f => ({ ...f, ...patch }));

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/products?q=${encodeURIComponent(query)}&limit=6`);
        const d = await r.json();
        setResults(d.products ?? []);
      } finally { setSearching(false); }
    }, 300);
  }, [query]);

  function pickProduct(p: Product) {
    set({
      description: p.name,
      product_id: p.id,
      sku: p.sku ?? null,
      model_number: p.model_number ?? null,
      image_url: p.image_url ?? null,
      unit_price: p.unit_price ?? 0,
    });
    setQuery('');
    setResults([]);
  }

  const SECTIONS = ['Equipment', 'Labor', 'Monitoring', 'Urgent Repairs', 'Recommended Work', 'Optional Upgrades'];
  const TYPES    = ['equipment', 'labor', 'monitoring', 'service', 'material'];
  const TIERS    = [{ v: null, l: 'Any Tier' }, { v: 'basic', l: 'Basic' }, { v: 'standard', l: 'Standard' }, { v: 'premium', l: 'Premium' }];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-end">
      <div className="w-full max-w-md bg-background border-l border-border flex flex-col overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="font-semibold text-foreground">{form._id === (blankItem())._id ? 'Add Item' : 'Edit Item'}</p>
          <button onClick={onClose} className="p-1 rounded hover:bg-card text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4">
          {/* Product search */}
          <Field label="Search Product Catalog">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search SKU, name…"
                className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-400" />
              {searching && <Loader2 className="absolute right-3 top-2.5 w-3.5 h-3.5 text-muted-foreground animate-spin" />}
            </div>
            {results.length > 0 && (
              <div className="mt-1 bg-card border border-border rounded-lg overflow-hidden divide-y divide-border">
                {results.map(p => (
                  <button key={p.id} type="button" onClick={() => pickProduct(p)}
                    className="w-full text-left px-3 py-2 hover:bg-background/60 transition-colors">
                    <p className="text-sm text-foreground">{p.name}</p>
                    {p.sku && <p className="text-xs text-muted-foreground">{p.sku}</p>}
                  </button>
                ))}
              </div>
            )}
          </Field>

          {/* Description */}
          <Field label="Description" required>
            <input value={form.description} onChange={e => set({ description: e.target.value })}
              placeholder="e.g. Brivo ACS300 Controller"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-400" />
          </Field>

          {/* Qty + Price + Unit */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Qty" required>
              <input type="number" value={form.qty} onChange={e => set({ qty: parseInt(e.target.value) || 1 })} min={1}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-400" />
            </Field>
            <Field label="Unit Price">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-sm">$</span>
                <input type="number" value={form.unit_price} onChange={e => set({ unit_price: parseFloat(e.target.value) || 0 })} min={0} step={0.01}
                  className="flex-1 px-2 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-400" />
              </div>
            </Field>
            <Field label="Unit">
              <select value={form.unit} onChange={e => set({ unit: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-400">
                {['each', '/mo', '/yr', 'hr', 'lot', 'ft'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
          </div>

          {/* Section + Type */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Section">
              <select value={form.section_name} onChange={e => set({ section_name: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-400">
                {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select value={form.item_type} onChange={e => set({ item_type: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-400">
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          {/* Package tier */}
          <Field label="Package Tier">
            <div className="flex gap-2">
              {TIERS.map(t => (
                <button key={String(t.v)} type="button" onClick={() => set({ package_tier: t.v })}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${form.package_tier === t.v ? 'border-brand-400 bg-brand-400/10 text-brand-400' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                  {t.l}
                </button>
              ))}
            </div>
          </Field>

          {/* Flags */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
              <div>
                <p className="text-xs font-medium text-foreground">Recurring</p>
                <p className="text-xs text-muted-foreground">Adds to MRR</p>
              </div>
              <Toggle checked={form.is_recurring} onChange={() => set({ is_recurring: !form.is_recurring })} />
            </div>
            <div className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
              <div>
                <p className="text-xs font-medium text-foreground">Optional</p>
                <p className="text-xs text-muted-foreground">Client can add/remove</p>
              </div>
              <Toggle checked={form.is_optional} onChange={() => set({ is_optional: !form.is_optional })} />
            </div>
          </div>

          {/* Notes */}
          <Field label="Notes">
            <textarea value={form.notes} onChange={e => set({ notes: e.target.value })} rows={2}
              placeholder="Internal notes…"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-brand-400" />
          </Field>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border">
          <button type="button" disabled={!form.description.trim()}
            onClick={() => { if (form.description.trim()) onSave(form); }}
            className="w-full py-2.5 rounded-lg bg-brand-400 hover:bg-brand-500 text-navy text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors gg-glow">
            Save Item
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════════ */
export default function NewQuotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledClientOrgId  = searchParams.get('client_org_id') ?? undefined;
  const prefilledOpportunityId = searchParams.get('opportunity_id') ?? undefined;

  // ── Mode selection ──────────────────────────────────────────────────────────
  const [appMode, setAppMode] = useState<AppMode>('pick');

  // ── Line-item builder state ─────────────────────────────────────────────────
  const [liStep, setLiStep]   = useState(1);
  const [meta, setMeta]       = useState<QuoteMeta>(defaultMeta);
  const [liItems, setLiItems] = useState<NewLineItem[]>([]);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<NewLineItem | null>(null);
  const [liSaving, setLiSaving]   = useState(false);

  // ── Survey wizard state ─────────────────────────────────────────────────────
  const [step, setStep]           = useState(1);
  const [property, setProperty]   = useState<QuoteProperty>(defaultProperty);
  const [survey, setSurvey]       = useState<SiteSurvey>(defaultSurvey);
  const [wzSaving, setWzSaving]   = useState(false);

  // ── Survey import state ──────────────────────────────────────────────────────
  const [surveyList, setSurveyList]               = useState<SurveyRecord[]>([]);
  const [surveySearch, setSurveySearch]           = useState('');
  const [surveyLoading, setSurveyLoading]         = useState(false);
  const [selectedSurveyId, setSelectedSurveyId]   = useState<string | null>(null);
  const [surveyImporting, setSurveyImporting]     = useState(false);
  const [surveyImportError, setSurveyImportError] = useState<string | null>(null);

  // Fetch surveys when survey_import mode is activated
  useEffect(() => {
    if (appMode !== 'survey_import') return;
    setSurveyLoading(true);
    fetch('/api/surveys?limit=100')
      .then(r => r.ok ? r.json() : { surveys: [] })
      .then(d => {
        const all: SurveyRecord[] = d.surveys ?? [];
        // Filter to surveys that have AI output
        setSurveyList(all.filter(s => (Array.isArray(s.ai_bom) && s.ai_bom.length > 0) || !!s.ai_sow));
      })
      .catch(() => setSurveyList([]))
      .finally(() => setSurveyLoading(false));
  }, [appMode]);

  // Auto-populate client info when coming from a customer page (?client_org_id=)
  const prefilledRef = useRef(false)
  useEffect(() => {
    if (!prefilledClientOrgId || prefilledRef.current) return
    prefilledRef.current = true
    fetch(`/api/customers/${prefilledClientOrgId}`)
      .then(r => r.ok ? r.json() : null)
      .then((org: { name?: string; primary_contact_name?: string; primary_contact_email?: string; primary_contact_phone?: string; address?: string; city?: string; state?: string } | null) => {
        if (!org) return
        setMeta(m => ({
          ...m,
          client_name:      org.name ?? m.client_name,
          client_email:     org.primary_contact_email ?? m.client_email,
          client_phone:     org.primary_contact_phone ?? m.client_phone,
          property_address: [org.address, org.city, org.state].filter(Boolean).join(', ') || m.property_address,
        }))
        setProperty(p => ({
          ...p,
          contactName:  org.primary_contact_name ?? p.contactName,
          contactEmail: org.primary_contact_email ?? p.contactEmail,
          contactPhone: org.primary_contact_phone ?? p.contactPhone,
          address:      org.address ?? p.address,
          city:         org.city ?? p.city,
          state:        org.state ?? p.state,
        }))
      })
      .catch(() => {})
  }, [prefilledClientOrgId])

  const setM = (patch: Partial<QuoteMeta>) => setMeta(m => ({ ...m, ...patch }));
  const setProp = (key: keyof QuoteProperty) => (val: string) =>
    setProperty(p => ({ ...p, [key]: key === 'units' ? parseInt(val) || 0 : val }));

  const lineItems = calculateLineItems(survey, property);
  const totals    = calculateTotals(lineItems, property, meta.discount_percent, meta.deposit_percent || 50);

  const setNet = (key: keyof NetworkSurvey, patch: Partial<{ qty: number; billing: BillingMode }>) =>
    setSurvey(s => ({ ...s, network: { ...s.network, [key]: { ...s.network[key], ...patch } } }));

  function addCustomItem() {
    const item: CustomSurveyItem = { id: `ci_${Date.now()}`, description: '', qty: 1, unitPrice: 0, billing: 'billable' };
    setSurvey(s => ({ ...s, addOns: { ...s.addOns, customItems: [...s.addOns.customItems, item] } }));
  }
  function updateCustomItem(id: string, patch: Partial<CustomSurveyItem>) {
    setSurvey(s => ({ ...s, addOns: { ...s.addOns, customItems: s.addOns.customItems.map(i => i.id === id ? { ...i, ...patch } : i) } }));
  }
  function removeCustomItem(id: string) {
    setSurvey(s => ({ ...s, addOns: { ...s.addOns, customItems: s.addOns.customItems.filter(i => i.id !== id) } }));
  }

  /* ── Line-item totals ─────────────────────────────────────────────────────── */
  const liSubtotal  = liItems.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const liDiscount  = liSubtotal * (meta.discount_percent / 100);
  const liAfterDisc = liSubtotal - liDiscount;
  const liTax       = liAfterDisc * (meta.tax_rate / 100);
  const liTotal     = liAfterDisc + liTax;
  const liMrr       = liItems.filter(i => i.is_recurring).reduce((s, i) => s + i.qty * i.unit_price, 0);
  const liDeposit   = liTotal * (meta.deposit_percent / 100);

  /* ── Create quote (line-item mode) ────────────────────────────────────────── */
  async function createLineItemQuote() {
    setLiSaving(true);
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:            meta.title || `Quote — ${meta.property_name || 'New Property'}`,
          quote_mode:       'line_item',
          package_mode:     meta.package_mode,
          client_name:      meta.client_name  || null,
          client_email:     meta.client_email || null,
          client_phone:     meta.client_phone || null,
          property_name:    meta.property_name || null,
          property_address: meta.property_address || null,
          notes:            meta.notes || null,
          tax_rate:         meta.tax_rate,
          discount_percent: meta.discount_percent,
          deposit_percent:  meta.deposit_percent,
          total_one_time:   liItems.filter(i => !i.is_recurring).reduce((s, i) => s + i.qty * i.unit_price, 0),
          total_mrr:        liMrr,
          client_org_id:    prefilledClientOrgId  || null,
          opportunity_id:   prefilledOpportunityId || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to create quote');
      const { quote } = await res.json();

      // Bulk-insert line items
      for (const item of liItems) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _id, ...rest } = item;
        await fetch(`/api/quotes/${quote.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rest),
        });
      }

      router.push(`/quotes/${quote.id}`);
    } catch {
      setLiSaving(false);
    }
  }

  /* ── Create quote (wizard mode) ───────────────────────────────────────────── */
  async function createWizardQuote() {
    setWzSaving(true);
    try {
      const _qn = generateQuoteNumber(); // eslint-disable-line @typescript-eslint/no-unused-vars
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:            property.name || 'New Quote',
          quote_mode:       'wizard',
          client_name:      property.contactName || null,
          client_email:     property.contactEmail || null,
          client_phone:     property.contactPhone || null,
          property_name:    property.name || null,
          property_address: [property.address, property.city, property.state, property.zip].filter(Boolean).join(', ') || null,
          units:            property.units,
          total_one_time:   totals.setupTotal,
          total_mrr:        totals.monthlyTotal,
          dealer_mrr:       totals.dealerMRR,
          client_org_id:    prefilledClientOrgId  || null,
          opportunity_id:   prefilledOpportunityId || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to create quote');
      const { quote } = await res.json();

      // Convert calculated line items to API records
      for (const item of lineItems) {
        await fetch(`/api/quotes/${quote.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description:  item.description,
            qty:          item.qty,
            unit_price:   item.unitPrice,
            is_recurring: item.recurring,
            section_name: item.recurring ? 'Monthly Recurring' : 'One-Time Setup',
            item_type:    'equipment',
            unit:         item.recurring ? '/mo' : 'each',
            is_optional:  false,
            is_included:  true,
          }),
        });
      }

      router.push(`/quotes/${quote.id}`);
    } catch {
      setWzSaving(false);
    }
  }

  /* ── Create quote (survey import mode) ────────────────────────────────────── */
  async function createSurveyImportQuote() {
    if (!selectedSurveyId) return;
    setSurveyImporting(true);
    setSurveyImportError(null);
    try {
      const res = await fetch(`/api/surveys/${selectedSurveyId}/create-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? 'Failed to create quote');
      }
      const result = await res.json();
      router.push(`/quotes/${result.quote_id}`);
    } catch (e) {
      setSurveyImportError(e instanceof Error ? e.message : 'Failed to create quote');
      setSurveyImporting(false);
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     MODE PICKER
  ══════════════════════════════════════════════════════════════════════════ */
  if (appMode === 'pick') {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">New Quote</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Choose how you want to build this proposal</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Line-item builder */}
          <button type="button" onClick={() => setAppMode('line_item')}
            className="text-left p-6 bg-card border-2 border-border hover:border-brand-400/50 rounded-2xl transition-all group">
            <div className="w-10 h-10 rounded-xl bg-brand-400/10 flex items-center justify-center mb-4 group-hover:bg-brand-400/20 transition-colors">
              <Layers className="w-5 h-5 text-brand-400" />
            </div>
            <p className="text-base font-semibold text-foreground mb-1">Line Item Builder</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Add items from the product catalog or manually. Full control over sections, packages, optional items, and pricing. Best for custom installs.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-brand-400 text-xs font-medium">
              <span>Start building</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* Survey wizard */}
          <button type="button" onClick={() => setAppMode('wizard')}
            className="text-left p-6 bg-card border-2 border-border hover:border-violet-400/50 rounded-2xl transition-all group">
            <div className="w-10 h-10 rounded-xl bg-violet-400/10 flex items-center justify-center mb-4 group-hover:bg-violet-400/20 transition-colors">
              <SlidersHorizontal className="w-5 h-5 text-violet-400" />
            </div>
            <p className="text-base font-semibold text-foreground mb-1">Survey Wizard</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Walk through access tier, network, cameras, and add-ons. Pricing auto-calculates from your survey inputs. Best for standard residential installs.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-violet-400 text-xs font-medium">
              <span>Start wizard</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* From Site Survey */}
          <button type="button" onClick={() => setAppMode('survey_import')}
            className="text-left p-6 bg-card border-2 border-border hover:border-emerald-400/50 rounded-2xl transition-all group sm:col-span-2">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-400/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-400/20 transition-colors">
                <ClipboardList className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-base font-semibold text-foreground">From Site Survey</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 font-medium">Recommended</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Import a completed survey — property info, SOW, and BOM auto-fill your quote. Fastest path to a sent quote.
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                  <span>Pick a survey</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════════
     FROM SITE SURVEY
  ══════════════════════════════════════════════════════════════════════════ */
  if (appMode === 'survey_import') {
    const filteredSurveys = surveyList.filter(s =>
      !surveySearch.trim() ||
      (s.property_name ?? '').toLowerCase().includes(surveySearch.toLowerCase())
    );
    const selected = surveyList.find(s => s.id === selectedSurveyId) ?? null;

    return (
      <div className="p-6 max-w-2xl mx-auto flex flex-col" style={{ minHeight: 'calc(100vh - 80px)' }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setAppMode('pick')} className="p-2 rounded-lg hover:bg-card text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">From Site Survey</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Select a completed survey to auto-fill your quote</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            value={surveySearch}
            onChange={e => setSurveySearch(e.target.value)}
            placeholder="Search by property name…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
          />
        </div>

        {/* Survey list */}
        <div className="flex-1 overflow-auto space-y-3 mb-4">
          {surveyLoading ? (
            // Skeleton
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-24 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-48 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-64" />
              </div>
            ))
          ) : filteredSurveys.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium text-foreground mb-1">No surveys with AI output found</p>
              <p className="text-xs text-muted-foreground">Run the AI Proposal generator on a survey first, then return here.</p>
            </div>
          ) : (
            filteredSurveys.map(s => {
              const isSelected = s.id === selectedSurveyId;
              const bomCount   = Array.isArray(s.ai_bom) ? s.ai_bom.length : 0;
              const devCount   = Array.isArray(s.devices) ? s.devices.length : 0;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSurveyId(isSelected ? null : s.id)}
                  className={`w-full text-left rounded-xl border p-4 shadow-sm transition-all ${
                    isSelected
                      ? 'border-[#6B7EFF] bg-indigo-50/30 ring-1 ring-[#6B7EFF]/20'
                      : 'border-gray-200 bg-white hover:border-[#6B7EFF]/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Survey number + date */}
                      <div className="flex items-center gap-2 mb-1">
                        {s.survey_number && (
                          <span className="font-mono text-xs text-gray-400">{s.survey_number}</span>
                        )}
                        {s.survey_date && (
                          <span className="text-xs text-gray-400">{new Date(s.survey_date).toLocaleDateString()}</span>
                        )}
                      </div>
                      {/* Property name */}
                      <p className="font-semibold text-foreground text-sm truncate">{s.property_name ?? 'Unnamed Property'}</p>
                      {/* Address */}
                      {s.property_address && (
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="text-xs text-gray-500 truncate">{s.property_address}</span>
                        </div>
                      )}
                      {/* Badges row */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {devCount > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                            {devCount} device{devCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {bomCount > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                            {bomCount} BOM item{bomCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {s.status && (
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                            s.status === 'quote_created'
                              ? 'bg-brand-400/10 text-brand-400 border-brand-400/20'
                              : s.status === 'complete'
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                              : 'bg-gray-100 text-gray-500 border-gray-200'
                          }`}>
                            {s.status.replace(/_/g, ' ')}
                          </span>
                        )}
                        {s.quote_id && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                            Quote exists
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Checkmark */}
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                      isSelected ? 'border-[#6B7EFF] bg-[#6B7EFF]' : 'border-gray-300'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Sticky action bar */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 -mx-6 px-6 py-4">
          {surveyImportError && (
            <div className="mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{surveyImportError}</span>
            </div>
          )}
          <div className="flex items-center gap-4">
            {selected && (
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Selected</p>
                <p className="text-sm font-medium text-foreground truncate">{selected.property_name ?? 'Survey'}</p>
              </div>
            )}
            <button
              type="button"
              onClick={createSurveyImportQuote}
              disabled={!selectedSurveyId || surveyImporting}
              className="flex items-center gap-2 bg-[#6B7EFF] hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors ml-auto"
            >
              {surveyImporting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                : <><ClipboardList className="w-4 h-4" /> Create Quote from Survey</>
              }
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════════
     LINE-ITEM BUILDER
  ══════════════════════════════════════════════════════════════════════════ */
  if (appMode === 'line_item') {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {showForm && (
          <ItemFormPanel
            initial={editing ?? blankItem()}
            onSave={item => {
              if (editing) setLiItems(prev => prev.map(i => i._id === item._id ? item : i));
              else setLiItems(prev => [...prev, { ...item, _id: `li_${Date.now()}` }]);
              setShowForm(false);
              setEditing(null);
            }}
            onClose={() => { setShowForm(false); setEditing(null); }}
          />
        )}

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setAppMode('pick')} className="p-2 rounded-lg hover:bg-card text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Line Item Builder</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Build a custom proposal item by item</p>
          </div>
        </div>

        <StepBar steps={LI_STEPS} current={liStep} onGo={setLiStep} />

        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-5">{LI_STEPS[liStep - 1].label}</h2>

          {/* ── Step 1: Client + Quote Info ────────────────────────────────── */}
          {liStep === 1 && (
            <div className="space-y-5">
              <Field label="Quote Title">
                <input value={meta.title} onChange={e => setM({ title: e.target.value })}
                  placeholder="e.g. East Ponce Village — Access Control + Cameras"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-400" />
              </Field>

              <div className="border-t border-border pt-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Property</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Field label="Property Name" required>
                      <input value={meta.property_name} onChange={e => setM({ property_name: e.target.value })}
                        placeholder="e.g. East Ponce Village"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-400" />
                    </Field>
                  </div>
                  <div className="col-span-2">
                    <Field label="Property Address">
                      <input value={meta.property_address} onChange={e => setM({ property_address: e.target.value })}
                        placeholder="123 Main Street, Atlanta, GA 30328"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-400" />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Client Contact</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Name">
                    <input value={meta.client_name} onChange={e => setM({ client_name: e.target.value })}
                      placeholder="Jane Smith"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-400" />
                  </Field>
                  <Field label="Email">
                    <input type="email" value={meta.client_email} onChange={e => setM({ client_email: e.target.value })}
                      placeholder="jane@property.com"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-400" />
                  </Field>
                  <Field label="Phone">
                    <input value={meta.client_phone} onChange={e => setM({ client_phone: e.target.value })}
                      placeholder="(404) 555-0100"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-400" />
                  </Field>
                </div>
              </div>

              <div className="border-t border-border pt-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Quote Settings</p>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Discount %">
                    <input type="number" value={meta.discount_percent} onChange={e => setM({ discount_percent: parseFloat(e.target.value) || 0 })} min={0} max={100} step={0.5}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-400" />
                  </Field>
                  <Field label="Tax %">
                    <input type="number" value={meta.tax_rate} onChange={e => setM({ tax_rate: parseFloat(e.target.value) || 0 })} min={0} max={30} step={0.1}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-400" />
                  </Field>
                  <Field label="Deposit %">
                    <input type="number" value={meta.deposit_percent} onChange={e => setM({ deposit_percent: parseFloat(e.target.value) || 0 })} min={0} max={100}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-400" />
                  </Field>
                </div>
                <div className="mt-4 flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Package Mode</p>
                    <p className="text-xs text-muted-foreground">Show Basic / Standard / Premium tiers instead of individual items</p>
                  </div>
                  <Toggle checked={meta.package_mode} onChange={() => setM({ package_mode: !meta.package_mode })} />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Line Items ─────────────────────────────────────────── */}
          {liStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{liItems.length} item{liItems.length !== 1 ? 's' : ''} · {formatCurrency(liSubtotal)} subtotal</p>
                <button onClick={() => { setEditing(null); setShowForm(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-400 hover:bg-brand-500 text-navy text-xs font-semibold transition-colors gg-glow">
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>

              {liItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <DollarSign className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No items yet. Click Add Item to get started.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Group by section */}
                  {Array.from(new Set(liItems.map(i => i.section_name))).map(section => (
                    <div key={section}>
                      <div className="flex items-center gap-2 mb-2 mt-3 first:mt-0">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{section}</span>
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground">{liItems.filter(i => i.section_name === section).length} items</span>
                      </div>
                      {liItems.filter(i => i.section_name === section).map(item => (
                        <div key={item._id} className="flex items-center gap-3 p-3 bg-background border border-border rounded-xl group hover:border-border/80 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground truncate">{item.description}</p>
                              {item.is_optional && <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">optional</span>}
                              {item.is_recurring && <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-brand-400/10 text-brand-400 border border-brand-400/20">recurring</span>}
                              {item.package_tier && <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-violet-400/10 text-violet-400 border border-violet-400/20">{item.package_tier}</span>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.qty} × {formatCurrency(item.unit_price)}/{item.unit === 'each' ? 'ea' : item.unit}</p>
                          </div>
                          <p className="text-sm font-semibold text-foreground tabular-nums">{formatCurrency(item.qty * item.unit_price)}</p>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditing(item); setShowForm(true); }}
                              className="p-1.5 rounded hover:bg-brand-400/10 text-muted-foreground hover:text-brand-400 transition-colors">
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setLiItems(prev => prev.filter(i => i._id !== item._id))}
                              className="p-1.5 rounded hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Review ─────────────────────────────────────────────── */}
          {liStep === 3 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Subtotal',         value: formatCurrency(liSubtotal),    color: 'text-foreground' },
                  { label: `Discount (${meta.discount_percent}%)`, value: meta.discount_percent > 0 ? `−${formatCurrency(liDiscount)}` : '—', color: 'text-amber-400' },
                  { label: `Tax (${meta.tax_rate}%)`,              value: meta.tax_rate > 0 ? formatCurrency(liTax) : '—', color: 'text-foreground' },
                  { label: 'Grand Total',      value: formatCurrency(liTotal),       color: 'text-foreground font-bold' },
                  { label: `Deposit (${meta.deposit_percent}%)`,   value: formatCurrency(liDeposit), color: 'text-violet-400' },
                  { label: 'MRR',              value: liMrr > 0 ? `${formatCurrency(liMrr)}/mo` : '—', color: 'text-brand-400' },
                ].map(r => (
                  <div key={r.label} className="bg-background border border-border rounded-xl p-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">{r.label}</p>
                    <p className={`text-lg font-semibold mt-0.5 ${r.color}`}>{r.value}</p>
                  </div>
                ))}
              </div>

              <div className="bg-card border border-border rounded-xl p-4 space-y-2 text-sm">
                <p className="font-semibold text-foreground mb-3">Quote Summary</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <span className="text-muted-foreground">Client</span><span className="text-foreground">{meta.client_name || '—'}</span>
                  <span className="text-muted-foreground">Property</span><span className="text-foreground">{meta.property_name || '—'}</span>
                  <span className="text-muted-foreground">Line items</span><span className="text-foreground">{liItems.length}</span>
                  <span className="text-muted-foreground">Package mode</span><span className="text-foreground">{meta.package_mode ? 'Yes' : 'No'}</span>
                </div>
              </div>

              <div className="bg-emerald-400/5 border border-emerald-400/20 rounded-xl p-4 flex gap-3">
                <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Ready to create</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Quote will be created as a draft. You can edit, add a cover message, and send a shareable approval link from the quote detail page.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between">
          <button onClick={() => liStep > 1 ? setLiStep(s => s - 1) : setAppMode('pick')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-card transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          {liStep < 3 ? (
            <button onClick={() => setLiStep(s => s + 1)}
              disabled={liStep === 1 && !meta.property_name.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-brand-400 hover:bg-brand-500 text-navy disabled:opacity-40 disabled:cursor-not-allowed transition-colors gg-glow">
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={createLineItemQuote} disabled={liSaving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-brand-400 hover:bg-brand-500 text-navy disabled:opacity-40 transition-colors gg-glow">
              {liSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : <><Check className="w-4 h-4" /> Create Quote</>}
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════════
     SURVEY WIZARD (existing steps, now wired to real API)
  ══════════════════════════════════════════════════════════════════════════ */
  function renderStep1() {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Property Name" required>
              <TextInput value={property.name} onChange={setProp('name')} placeholder="e.g. East Ponce Village" />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Street Address">
              <TextInput value={property.address} onChange={setProp('address')} placeholder="123 Main Street" />
            </Field>
          </div>
          <Field label="City">
            <TextInput value={property.city} onChange={setProp('city')} placeholder="Atlanta" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="State">
              <TextInput value={property.state} onChange={setProp('state')} placeholder="GA" />
            </Field>
            <Field label="ZIP">
              <TextInput value={property.zip} onChange={setProp('zip')} placeholder="30328" />
            </Field>
          </div>
          <Field label="Total Units" required>
            <TextInput value={property.units || ''} onChange={setProp('units')} placeholder="120" type="number" />
          </Field>
          <div />
        </div>
        <div className="border-t border-border pt-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Primary Contact</p>
            <p className="text-xs text-brand-400">CRM lookup coming soon</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact Name">
              <TextInput value={property.contactName} onChange={setProp('contactName')} placeholder="Jane Smith" />
            </Field>
            <Field label="Phone">
              <TextInput value={property.contactPhone} onChange={setProp('contactPhone')} placeholder="(404) 555-0100" />
            </Field>
            <Field label="Email">
              <TextInput value={property.contactEmail} onChange={setProp('contactEmail')} placeholder="jane@property.com" />
            </Field>
            <Field label="Property Manager">
              <TextInput value={property.propertyManager || ''} onChange={setProp('propertyManager')} placeholder="Jane Smith" />
            </Field>
            <div className="col-span-2">
              <Field label="Management Company">
                <TextInput value={property.managementCompany || ''} onChange={setProp('managementCompany')} placeholder="Columbia Residential" />
              </Field>
            </div>
          </div>
        </div>
        {property.units > 0 && (
          <div className="bg-brand-400/5 border border-brand-400/20 rounded-xl p-4">
            <p className="text-xs text-brand-400 font-semibold uppercase tracking-wide mb-1">Estimated Base Monthly Service</p>
            <p className="text-2xl font-bold text-foreground">
              {formatCurrency(Math.max(property.units * 10, 1200))}
              <span className="text-sm font-normal text-muted-foreground">/mo</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {property.units} units @ $10/unit{property.units * 10 < 1200 && ' — $1,200/mo minimum'} · GateGuard bills property directly
            </p>
          </div>
        )}
      </div>
    );
  }

  function renderStep2() {
    const t1 = survey.tier1; const t2 = survey.tier2; const net = survey.network; const gm = survey.addOns.gateMaintenance;
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          {([
            { tier: 'tier1_mobile' as AccessTier, label: 'Tier 1 — Mobile Pass', sub: 'Door-specific equipment. Primary doors get controller + reader; secondary/amenity doors get controller only; guest gates app-only; resident gates reader only.' },
            { tier: 'tier2_gg'     as AccessTier, label: 'Tier 2 — GateGuard Integrated', sub: 'Every access point gets a full reader + controller via the GateGuard integrated stack. Uniform setup, optional video callbox at entry.' },
          ]).map(({ tier, label, sub }) => (
            <button key={tier} type="button" onClick={() => setSurvey(s => ({ ...s, accessTier: tier }))}
              className={`text-left p-4 rounded-xl border transition-all ${survey.accessTier === tier ? 'border-brand-400/50 bg-brand-400/5' : 'border-border bg-background hover:bg-card'}`}>
              <div className="flex items-start gap-2">
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${survey.accessTier === tier ? 'border-brand-400' : 'border-border'}`}>
                  {survey.accessTier === tier && <div className="w-2 h-2 rounded-full bg-brand-400" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{sub}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {survey.accessTier === 'tier1_mobile' && (
          <SectionCard title="Access Points — Tier 1 (Mobile Pass)" icon={Shield}>
            <div className="space-y-4">
              {([
                { label: 'Resident Vehicle Gates', sub: 'Resident vehicle entry — reader', key: 'residentGates' as const, wp: '$500', nwp: '$750' },
                { label: 'Guest Vehicle Gates', sub: 'Guest entry — app-only controller', key: 'guestGates' as const, wp: '$500', nwp: '$750' },
                { label: 'Primary Common Doors', sub: 'Main pedestrian entries — controller + reader', key: 'primaryDoors' as const, wp: '$500', nwp: '$750' },
                { label: 'Secondary Common Doors', sub: 'Amenity rooms, utility doors — controller', key: 'secondaryDoors' as const, wp: '$500', nwp: '$750' },
              ]).map(({ label, sub, key, wp, nwp }, i) => (
                <div key={key} className={i > 0 ? 'pt-4 border-t border-border' : ''}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0"><p className="text-sm text-foreground">{label}</p><p className="text-xs text-muted-foreground">{sub}</p></div>
                    <DualCounter working={t1[key].working} nonWorking={t1[key].nonWorking}
                      onWorking={v => setSurvey(s => ({ ...s, tier1: { ...s.tier1, [key]: { ...s.tier1[key], working: v } } }))}
                      onNonWorking={v => setSurvey(s => ({ ...s, tier1: { ...s.tier1, [key]: { ...s.tier1[key], nonWorking: v } } }))}
                      workingPrice={wp} nonWorkingPrice={nwp} />
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div><p className="text-sm text-foreground">GateGuard Video Callbox</p><p className="text-xs text-muted-foreground">$2,500 installed</p></div>
                <Toggle checked={t1.callbox} onChange={() => setSurvey(s => ({ ...s, tier1: { ...s.tier1, callbox: !s.tier1.callbox } }))} />
              </div>
            </div>
          </SectionCard>
        )}

        {survey.accessTier === 'tier2_gg' && (
          <SectionCard title="Access Points — Tier 2 (GateGuard Integrated)" icon={Shield}>
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-sm text-foreground">Access Points</p><p className="text-xs text-muted-foreground">Every point gets full reader + controller</p></div>
                <DualCounter working={t2.accessPoints.working} nonWorking={t2.accessPoints.nonWorking}
                  onWorking={v => setSurvey(s => ({ ...s, tier2: { ...s.tier2, accessPoints: { ...s.tier2.accessPoints, working: v } } }))}
                  onNonWorking={v => setSurvey(s => ({ ...s, tier2: { ...s.tier2, accessPoints: { ...s.tier2.accessPoints, nonWorking: v } } }))}
                  workingPrice="$500" nonWorkingPrice="$750" />
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div><p className="text-sm text-foreground">GateGuard Video Callbox</p><p className="text-xs text-muted-foreground">$2,500 installed</p></div>
                <Toggle checked={t2.callbox} onChange={() => setSurvey(s => ({ ...s, tier2: { ...s.tier2, callbox: !s.tier2.callbox } }))} />
              </div>
            </div>
          </SectionCard>
        )}

        <SectionCard title="Network Infrastructure" icon={Network}>
          <p className="text-xs text-muted-foreground mb-3">Every install includes at least 1 router.</p>
          <div className="space-y-3">
            {([
              { key: 'router'       as keyof NetworkSurvey, label: 'Router',               sub: 'Required',                  price: '$350' },
              { key: 'switch4port'  as keyof NetworkSurvey, label: '4-Port PoE Switch',    sub: 'Up to 4 access points',     price: '$200' },
              { key: 'switch8port'  as keyof NetworkSurvey, label: '8-Port PoE Switch',    sub: 'Up to 8 access points',     price: '$350' },
              { key: 'switch16port' as keyof NetworkSurvey, label: '16-Port PoE Switch',   sub: 'Up to 16 access points',    price: '$600' },
              { key: 'radioSmall'   as keyof NetworkSurvey, label: 'PTP Radio — Small',    sub: 'Short-range bridge',        price: '$500' },
              { key: 'radioMedium'  as keyof NetworkSurvey, label: 'PTP Radio — Medium',   sub: 'Mid-range bridge',          price: '$800' },
              { key: 'radioLarge'   as keyof NetworkSurvey, label: 'PTP Radio — Large',    sub: 'Long-range bridge',         price: '$1,200' },
              { key: 'enclosure'    as keyof NetworkSurvey, label: 'Weatherproof Enclosure', sub: 'Outdoor panel housing',   price: '$250' },
            ]).map(({ key, label, sub, price }, i) => (
              <div key={key} className={`flex items-center gap-3 ${i > 0 ? 'pt-3 border-t border-border' : ''}`}>
                <div className="flex-1 min-w-0"><p className="text-sm text-foreground">{label}</p><p className="text-xs text-muted-foreground">{sub}</p></div>
                <BillingToggle value={net[key].billing} onChange={b => setNet(key, { billing: b })} />
                <Counter value={net[key].qty} onChange={v => setNet(key, { qty: v })} min={0} />
                <p className="text-xs text-muted-foreground w-14 text-right opacity-40">{price} ea.</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Cameras" icon={Camera}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Existing Cameras</p>
          <div className="space-y-3 mb-5">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-foreground">Monitored</p><p className="text-xs text-muted-foreground">$85/mo monitoring</p></div>
              <Counter value={survey.cameras.existing.monitored} onChange={v => setSurvey(s => ({ ...s, cameras: { ...s.cameras, existing: { ...s.cameras.existing, monitored: v } } }))} />
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div><p className="text-sm text-foreground">Standalone (no monitoring)</p><p className="text-xs text-muted-foreground">$150/camera reprogram</p></div>
              <Counter value={survey.cameras.existing.standalone} onChange={v => setSurvey(s => ({ ...s, cameras: { ...s.cameras, existing: { ...s.cameras.existing, standalone: v } } }))} />
            </div>
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 pt-4 border-t border-border">New Cameras</p>
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm text-foreground">Monitored</p>
                <p className="text-xs text-muted-foreground mb-2">{survey.cameras.new.monitored.billing === 'included' ? 'Hardware included · $100/mo' : 'Hardware $350/camera · $85/mo'}</p>
                <BillingToggle value={survey.cameras.new.monitored.billing} onChange={b => setSurvey(s => ({ ...s, cameras: { ...s.cameras, new: { ...s.cameras.new, monitored: { ...s.cameras.new.monitored, billing: b } } } }))} />
              </div>
              <Counter value={survey.cameras.new.monitored.qty} onChange={v => setSurvey(s => ({ ...s, cameras: { ...s.cameras, new: { ...s.cameras.new, monitored: { ...s.cameras.new.monitored, qty: v } } } }))} />
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div><p className="text-sm text-foreground">Standalone (billable)</p><p className="text-xs text-muted-foreground">$350/camera install</p></div>
              <Counter value={survey.cameras.new.standalone} onChange={v => setSurvey(s => ({ ...s, cameras: { ...s.cameras, new: { ...s.cameras.new, standalone: v } } }))} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Add-Ons & Optional Items" icon={Wifi}>
          <div className="flex items-center justify-between pb-4">
            <div><p className="text-sm text-foreground">LPR Cameras</p><p className="text-xs text-muted-foreground">$1,500 billable · $150/mo required</p></div>
            <Counter value={survey.addOns.lprCameras.qty} onChange={v => setSurvey(s => ({ ...s, addOns: { ...s.addOns, lprCameras: { qty: v } } }))} />
          </div>
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <div><p className="text-sm text-foreground">Entry Gate Repair Plan</p><p className="text-xs text-muted-foreground">Initial repair + $250/mo per entry gate</p></div>
              <Toggle checked={gm.enabled} onChange={() => setSurvey(s => ({ ...s, addOns: { ...s.addOns, gateMaintenance: { ...s.addOns.gateMaintenance, enabled: !s.addOns.gateMaintenance.enabled } } }))} />
            </div>
            {gm.enabled && (
              <div className="bg-background/60 border border-border rounded-lg p-4 space-y-4 mt-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-foreground">Initial Gate Repair Cost</p>
                    <BillingToggle value={gm.initialRepairBilling} onChange={b => setSurvey(s => ({ ...s, addOns: { ...s.addOns, gateMaintenance: { ...s.addOns.gateMaintenance, initialRepairBilling: b } } }))} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-muted-foreground">$</span>
                    <input type="number" value={gm.initialRepairCost || ''} onChange={e => setSurvey(s => ({ ...s, addOns: { ...s.addOns, gateMaintenance: { ...s.addOns.gateMaintenance, initialRepairCost: parseFloat(e.target.value) || 0 } } }))} placeholder="0"
                      className="w-24 px-2 py-1.5 bg-background border border-border rounded text-sm text-foreground text-right focus:outline-none focus:ring-1 focus:ring-brand-400" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div><p className="text-sm text-foreground">Entry Gates</p><p className="text-xs text-muted-foreground">{formatCurrency(250 * gm.entryGates)}/mo</p></div>
                  <Counter value={gm.entryGates} onChange={v => setSurvey(s => ({ ...s, addOns: { ...s.addOns, gateMaintenance: { ...s.addOns.gateMaintenance, entryGates: v } } }))} min={1} />
                </div>
              </div>
            )}
          </div>
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <div><p className="text-sm text-foreground">Custom Line Items</p><p className="text-xs text-muted-foreground">Missing equipment, special materials</p></div>
              <button type="button" onClick={addCustomItem}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-400/30 text-brand-400 hover:bg-brand-400/5 text-xs font-medium transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>
            <div className="space-y-3">
              {survey.addOns.customItems.map((item) => (
                <div key={item.id} className="bg-background/60 border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="text" value={item.description} onChange={e => updateCustomItem(item.id, { description: e.target.value })} placeholder="Item description…"
                      className="flex-1 px-2 py-1.5 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-400" />
                    <button type="button" onClick={() => removeCustomItem(item.id)} className="p-1.5 rounded hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <BillingToggle value={item.billing} onChange={b => updateCustomItem(item.id, { billing: b })} />
                    <Counter value={item.qty} onChange={v => updateCustomItem(item.id, { qty: v })} min={1} />
                    <div className="flex items-center gap-1 ml-auto">
                      <span className="text-xs text-muted-foreground">$</span>
                      <input type="number" value={item.unitPrice || ''} onChange={e => updateCustomItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })} placeholder="0.00"
                        className="w-24 px-2 py-1 bg-background border border-border rounded text-sm text-right text-foreground focus:outline-none focus:ring-1 focus:ring-brand-400" />
                      <span className="text-xs text-muted-foreground">ea.</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  function renderStep3() {
    const setupItems   = lineItems.filter(i => !i.recurring);
    const monthlyItems = lineItems.filter(i => i.recurring);
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Auto-calculated from your survey. INCLUDED items are $0 — value built into contract.</p>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-background/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">One-Time Setup Fees</p>
          </div>
          <table className="w-full">
            <thead><tr className="border-b border-border">
              <th className="text-left text-xs text-muted-foreground px-5 py-2">Description</th>
              <th className="text-right text-xs text-muted-foreground px-4 py-2">Qty</th>
              <th className="text-right text-xs text-muted-foreground px-4 py-2">Unit</th>
              <th className="text-right text-xs text-muted-foreground px-5 py-2">Total</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {setupItems.map(item => (
                <tr key={item.id} className={item.billing === 'included' ? 'opacity-50' : ''}>
                  <td className="px-5 py-3 text-sm text-foreground">{item.description}{item.billing === 'included' && <span className="ml-2 text-xs text-brand-400 font-medium">INCLUDED</span>}</td>
                  <td className="px-4 py-3 text-sm text-right text-muted-foreground">{item.qty}</td>
                  <td className="px-4 py-3 text-sm text-right text-muted-foreground">{item.total === 0 ? '—' : formatCurrency(item.unitPrice)}</td>
                  <td className="px-5 py-3 text-sm text-right font-medium text-foreground">{item.total === 0 ? '—' : formatCurrency(item.total)}</td>
                </tr>
              ))}
              <tr className="bg-background/50">
                <td colSpan={2} className="px-5 py-3 text-xs text-muted-foreground">Billable only: {formatCurrency(totals.billableSetupTotal)}</td>
                <td className="px-4 py-3 text-sm font-semibold text-foreground text-right">Setup Total</td>
                <td className="px-5 py-3 text-sm font-bold text-foreground text-right">{formatCurrency(totals.setupTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-background/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Monthly Recurring</p>
          </div>
          <table className="w-full">
            <thead><tr className="border-b border-border">
              <th className="text-left text-xs text-muted-foreground px-5 py-2">Description</th>
              <th className="text-right text-xs text-muted-foreground px-4 py-2">Qty</th>
              <th className="text-right text-xs text-muted-foreground px-4 py-2">Unit</th>
              <th className="text-right text-xs text-muted-foreground px-5 py-2">Monthly</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {monthlyItems.map(item => (
                <tr key={item.id}>
                  <td className="px-5 py-3 text-sm text-foreground">{item.description}</td>
                  <td className="px-4 py-3 text-sm text-right text-muted-foreground">{item.qty}</td>
                  <td className="px-4 py-3 text-sm text-right text-muted-foreground">{formatCurrency(item.unitPrice)}/mo</td>
                  <td className="px-5 py-3 text-sm text-right font-medium text-foreground">{formatCurrency(item.total)}/mo</td>
                </tr>
              ))}
              <tr className="bg-background/50">
                <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-foreground text-right">Monthly Total</td>
                <td className="px-5 py-3 text-sm font-bold text-brand-400 text-right">{formatCurrency(totals.monthlyTotal)}/mo</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderStep4() {
    const hasDiscount = meta.discount_percent > 0;
    return (
      <div className="space-y-5">

        {/* Pricing Adjustments */}
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm font-semibold text-foreground mb-4">Pricing Adjustments</p>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-foreground">Setup Fee Discount</p>
                <p className="text-xs text-muted-foreground">Applied to one-time billable setup fees only</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number" min="0" max="50" step="1"
                  value={meta.discount_percent || ''}
                  onChange={e => setMeta(m => ({ ...m, discount_percent: Math.min(50, Math.max(0, parseFloat(e.target.value) || 0)) }))}
                  placeholder="0"
                  className="w-20 px-2 py-1.5 bg-background border border-border rounded text-sm text-right text-foreground focus:outline-none focus:ring-1 focus:ring-brand-400 tabular-nums"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            {hasDiscount && (
              <div className="flex items-center justify-between bg-emerald-400/5 border border-emerald-400/20 rounded-lg px-4 py-2.5">
                <span className="text-sm text-emerald-400 font-medium">Discount savings</span>
                <span className="text-sm font-bold text-emerald-400">−{formatCurrency(totals.discountSavings)}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 pt-1">
              <div>
                <p className="text-sm text-foreground">Deposit %</p>
                <p className="text-xs text-muted-foreground">Percent of setup fee due at signing</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number" min="0" max="100" step="5"
                  value={meta.deposit_percent || ''}
                  onChange={e => setMeta(m => ({ ...m, deposit_percent: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) }))}
                  placeholder="50"
                  className="w-20 px-2 py-1.5 bg-background border border-border rounded text-sm text-right text-foreground focus:outline-none focus:ring-1 focus:ring-brand-400 tabular-nums"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              label: 'Setup Fees',
              value: formatCurrency(totals.discountedSetupTotal),
              sub: hasDiscount
                ? `${formatCurrency(totals.billableSetupTotal)} list · ${meta.discount_percent}% off`
                : `${formatCurrency(totals.billableSetupTotal)} billable`,
              color: 'text-foreground',
            },
            {
              label: 'GateGuard Direct Monthly',
              value: `${formatCurrency(totals.monthlyTotal)}/mo`,
              sub: `Billed to property · ${property.units} units @ $10/unit`,
              color: 'text-brand-400',
            },
            {
              label: `Deposit at Signing (${meta.deposit_percent || 50}%)`,
              value: formatCurrency(totals.depositDue),
              sub: `${meta.deposit_percent || 50}% setup + 1st month`,
              color: 'text-amber-400',
            },
            {
              label: 'Balance at Launch',
              value: formatCurrency(totals.goLivePayment),
              sub: `${100 - (meta.deposit_percent || 50)}% setup + 1st month`,
              color: 'text-blue-400',
            },
            {
              label: 'Contract Value (5 yr)',
              value: formatCurrency(totals.contractValue),
              sub: 'Setup + 60 months recurring',
              color: 'text-foreground',
            },
            {
              label: 'Dealer Override MRR',
              value: `${formatCurrency(totals.dealerMRR)}/mo`,
              sub: 'Up to $2.50/unit/mo',
              color: 'text-violet-400',
            },
          ].map(item => (
            <div key={item.label} className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{item.label}</p>
              <p className={`text-xl font-bold ${item.color} mt-1`}>{item.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
            </div>
          ))}
        </div>

        {/* Property Summary */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">Summary</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Property</span><span className="text-foreground font-medium">{property.name || '—'}</span>
            <span className="text-muted-foreground">Units</span><span className="text-foreground">{property.units}</span>
            <span className="text-muted-foreground">Location</span><span className="text-foreground">{property.city}, {property.state}</span>
            <span className="text-muted-foreground">Access Tier</span><span className="text-foreground">{survey.accessTier === 'tier1_mobile' ? 'Tier 1 — Mobile Pass' : 'Tier 2 — GG Integrated'}</span>
            <span className="text-muted-foreground">Contact</span><span className="text-foreground">{property.contactName || '—'}</span>
            <span className="text-muted-foreground">Resident Move-In Fee</span><span className="text-foreground">$150 (property bills residents)</span>
          </div>
        </div>

        <div className="bg-emerald-400/5 border border-emerald-400/20 rounded-xl p-4 flex gap-3">
          <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Ready to generate proposal</p>
            <p className="text-xs text-muted-foreground mt-0.5">Creates a draft quote. You can edit line items, add notes, and send to the client for approval.</p>
          </div>
        </div>
      </div>
    );
  }

  const canProceed = step === 1 ? property.name.trim().length > 0 && property.units > 0 : true;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => setAppMode('pick')} className="p-2 rounded-lg hover:bg-card text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Survey Wizard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Auto-calculate pricing from site survey inputs</p>
        </div>
      </div>

      <StepBar steps={WIZARD_STEPS} current={step} onGo={setStep} />

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-5">{WIZARD_STEPS[step - 1].label}</h2>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={() => step > 1 ? setStep(s => s - 1) : setAppMode('pick')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-card transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        {step < 4 ? (
          <button type="button" onClick={() => setStep(s => s + 1)} disabled={!canProceed}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${canProceed ? 'bg-brand-400 hover:bg-brand-500 text-navy gg-glow' : 'bg-border text-muted-foreground cursor-not-allowed'}`}>
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" onClick={createWizardQuote} disabled={wzSaving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-brand-400 hover:bg-brand-500 text-navy text-sm font-semibold transition-colors gg-glow">
            {wzSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : <><FileText className="w-4 h-4" /> Create Quote</>}
          </button>
        )}
      </div>
    </div>
  );
}
