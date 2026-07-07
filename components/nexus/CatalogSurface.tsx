'use client';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, Plus, Loader2, X, Upload, Trash2 } from 'lucide-react';
// Vercel lucide cache quirk — load non-safe icons via require()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Package, PenTool, Layers } = require('lucide-react') as any;

// ── Theme (dark glass — matches DesignExplorer) ──────────────────────────────
const BG = '#0B1728';
const CARD = '#131B2E';
const PANEL = '#0F1830';
const BORDER = 'rgba(255,255,255,0.1)';
const TEXT = '#F8FAFC';
const MUTED = '#94A3B8';
const BRAND = '#6B7EFF';
const CYAN = '#7DE5FF';

// ── Catalog option sets (mirrors legacy ProductModal) ────────────────────────
const CATEGORIES = [
  'Camera', 'Access Control', 'Gate Operator', 'Callbox / Intercom',
  'Network', 'Wire & Hardware', 'Labor',
] as const;
const DESIGN_ROLES = ['', 'camera', 'board', 'gateway', 'reader', 'switch', 'power', 'intercom', 'gate', 'sensor', 'lock', 'network', 'other'];
const DESIGN_CABLES = ['', '110V 12/2', '240V 12/3', '16/2', '18/2', '18/6', '22/4', '22/2 shielded', 'CAT6', 'CAT5e'];
const DESIGN_COLORS = ['#6B7EFF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#0891B2', '#64748B', '#111827'];

const BRAND_COLORS: Record<string, string> = {
  'Eagle Eye Networks': '#1B4F72', 'LTS Security': '#1A5276', 'Ubiquiti': '#0559C9',
  'Brivo': '#0F4C81', 'Altronix': '#1F618D', 'Securitron (ASSA ABLOY)': '#117A65',
  'DITEK': '#1E8449', 'Optex': '#6C3483', 'DoorKing': '#784212', 'FAAC': '#943126',
  'Viking Electronics': '#7B241C', '2N': '#1A252F', 'Shelly': '#E67E22',
  'Belden': '#1C2833', 'ADI Pro': '#17202A', 'GateGuard': '#2563EB', 'Bosch': '#B03A2E',
};

// ── Types ────────────────────────────────────────────────────────────────────
interface Terminal { name: string; dx: number; dy: number; lx?: number; ly?: number }
interface DesignMeta {
  role?: string;
  abbr?: string;
  color?: string;
  isBoard?: boolean;
  placementImageUrl?: string;
  wiringImageUrl?: string;
  terminals?: Terminal[];
  defaultCable?: string;
}

// Raw DB row (snake_case, drift-tolerant).
interface ProductRow {
  id: string;
  name: string;
  sku?: string | null;
  brand?: string | null;
  category?: string | null;
  subcategory?: string | null;
  description?: string | null;
  specs?: string | null;
  msrp?: number | null;
  dealer_cost?: number | null;
  sell_price?: number | null;
  adi_sku?: string | null;
  image_url?: string | null;
  active?: boolean | null;
  field_service?: boolean | null;
  tags?: string[] | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  design_meta?: any;
}

// Form shape used inside the editor (all coerced to non-null).
interface ProductForm {
  id?: string;
  sku: string;
  brand: string;
  name: string;
  category: string;
  subcategory: string;
  description: string;
  specs: string;
  msrp: number;
  dealerCost: number;
  sellPrice: number;
  adiSku: string;
  imageUrl: string;
  active: boolean;
  fieldService: boolean;
  tags: string[];
  designMeta: DesignMeta;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const brandInitials = (brand: string) =>
  (brand || '?').split(/[\s/]+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
const fmt$ = (n: number) => (n > 0 ? `$${n.toLocaleString()}` : '—');
const calcMargin = (cost: number, sell: number) =>
  sell > 0 && cost > 0 ? Math.round(((sell - cost) / sell) * 100) : null;

const rowToForm = (r: ProductRow): ProductForm => ({
  id: r.id,
  sku: r.sku ?? '',
  brand: r.brand ?? '',
  name: r.name ?? '',
  category: r.category ?? 'Camera',
  subcategory: r.subcategory ?? '',
  description: r.description ?? '',
  specs: r.specs ?? '',
  msrp: Number(r.msrp) || 0,
  dealerCost: Number(r.dealer_cost) || 0,
  sellPrice: Number(r.sell_price) || 0,
  adiSku: r.adi_sku ?? '',
  imageUrl: r.image_url ?? '',
  active: r.active ?? true,
  fieldService: r.field_service ?? false,
  tags: Array.isArray(r.tags) ? r.tags : [],
  designMeta: (r.design_meta && typeof r.design_meta === 'object') ? r.design_meta : {},
});

const emptyForm = (): ProductForm => ({
  sku: '', brand: 'GateGuard', name: '', category: 'Camera', subcategory: '',
  description: '', specs: '', msrp: 0, dealerCost: 0, sellPrice: 0,
  adiSku: '', imageUrl: '', active: true, fieldService: false, tags: [], designMeta: {},
});

// ── Product thumbnail (image w/ brand-initials fallback) ─────────────────────
function ProductThumb({ url, brand, size = 40 }: { url?: string | null; brand: string; size?: number }) {
  const [err, setErr] = useState(false);
  const color = BRAND_COLORS[brand] ?? '#334155';
  if (url && !err) {
    return (
      <img
        src={url}
        alt={brand}
        onError={() => setErr(true)}
        className="object-contain rounded-lg bg-white shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-lg flex items-center justify-center shrink-0 font-bold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.3 }}
    >
      {brandInitials(brand)}
    </div>
  );
}

// ── Small glass field wrapper ─────────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium block" style={{ color: MUTED }}>
        {label}{required && <span className="ml-0.5" style={{ color: '#F87171' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: TEXT };
const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ── Visual terminal/port mapper ───────────────────────────────────────────────
// Tap the image to drop a port, drag it into place, tap a dot to rename/remove.
// Positions are stored as dx/dy (canvas px offset from the device center) so the
// drawing tool overlays them on the exact same spots.
function TerminalMapper({
  imageUrl, terminals, onChange,
}: {
  imageUrl?: string;
  terminals: Terminal[];
  onChange: (t: Terminal[]) => void;
}) {
  const CANVAS = 160; // detail-sheet symbol size the design tool renders at
  const LBL_DY = -30; // default label offset (canvas px) — sits above the dot
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 240, h: 160 });
  const [drag, setDrag] = useState<{ i: number; mode: 'dot' | 'label' } | null>(null);
  const [selIdx, setSelIdx] = useState<number | null>(null);

  const measure = () => {
    const el = boxRef.current;
    if (el) { const r = el.getBoundingClientRect(); if (r.width && r.height) setBox({ w: r.width, h: r.height }); }
  };
  useEffect(() => { measure(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [imageUrl]);

  const scale = CANVAS / Math.max(box.w, box.h); // dx/dy per on-screen px
  const toScreen = (dx: number, dy: number) => ({ x: box.w / 2 + dx / scale, y: box.h / 2 + dy / scale });
  const fromScreen = (x: number, y: number) => ({ dx: Math.round((x - box.w / 2) * scale), dy: Math.round((y - box.h / 2) * scale) });
  const lblOff = (t: Terminal) => ({ lx: t.lx ?? 0, ly: t.ly ?? LBL_DY });

  const ptFromEvent = (e: { clientX: number; clientY: number }) => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: clamp(e.clientX - r.left, 0, r.width), y: clamp(e.clientY - r.top, 0, r.height) };
  };

  const onBgClick = (e: React.MouseEvent) => {
    if (drag) return;
    if ((e.target as HTMLElement).dataset.dot) return;
    const { x, y } = ptFromEvent(e);
    const { dx, dy } = fromScreen(x, y);
    const next = [...terminals, { name: `P${terminals.length + 1}`, dx, dy }];
    onChange(next);
    setSelIdx(next.length - 1);
  };

  const onDown = (i: number, mode: 'dot' | 'label', e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ i, mode }); setSelIdx(i);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const { x, y } = ptFromEvent(e);
    const p = fromScreen(x, y);
    onChange(terminals.map((t, idx) => {
      if (idx !== drag.i) return t;
      if (drag.mode === 'dot') return { ...t, dx: p.dx, dy: p.dy };
      return { ...t, lx: p.dx - t.dx, ly: p.dy - t.dy }; // label offset from dot
    }));
  };
  const endDrag = () => setDrag(null);

  const rename = (name: string) => { if (selIdx === null) return; onChange(terminals.map((t, i) => (i === selIdx ? { ...t, name } : t))); };
  const removeSel = () => { if (selIdx === null) return; onChange(terminals.filter((_, i) => i !== selIdx)); setSelIdx(null); };

  return (
    <div className="space-y-2">
      <p className="text-[11px]" style={{ color: MUTED }}>
        Tap the image to drop a port · drag the <span style={{ color: CYAN }}>ring</span> onto the jack · drag the label out of the way · tap either to rename/remove.
      </p>
      <div
        ref={boxRef}
        onClick={onBgClick}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        className="relative inline-block select-none rounded-lg overflow-hidden"
        style={{ cursor: 'crosshair', border: `1px solid ${BORDER}`, backgroundColor: '#fff', touchAction: 'none', maxWidth: 260 }}
      >
        {imageUrl ? (
          <img src={imageUrl} onLoad={measure} draggable={false} alt="terminal map" style={{ display: 'block', maxWidth: 260, maxHeight: 260 }} />
        ) : (
          <div className="flex items-center justify-center text-center text-[11px] px-4" style={{ width: 240, height: 160, backgroundColor: PANEL, color: MUTED }}>
            No line drawing yet — tap to drop ports, or add a Line drawing above for exact placement.
          </div>
        )}
        {/* connector lines from each dot to its label */}
        <svg width={box.w} height={box.h} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
          {terminals.map((t, i) => {
            const { lx, ly } = lblOff(t);
            const d = toScreen(t.dx, t.dy);
            const l = toScreen(t.dx + lx, t.dy + ly);
            return <line key={i} x1={d.x} y1={d.y} x2={l.x} y2={l.y} stroke="rgba(0,150,200,0.55)" strokeWidth="1" strokeDasharray="2 2" />;
          })}
        </svg>
        {terminals.map((t, i) => {
          const { lx, ly } = lblOff(t);
          const d = toScreen(t.dx, t.dy);
          const l = toScreen(t.dx + lx, t.dy + ly);
          const sel = selIdx === i;
          return (
            <React.Fragment key={i}>
              {/* connection point — the ring sits on the jack */}
              <div
                data-dot="1"
                onPointerDown={(e) => onDown(i, 'dot', e)}
                className="absolute"
                style={{ left: d.x, top: d.y, transform: 'translate(-50%, -50%)', cursor: 'grab' }}
              >
                <span
                  data-dot="1"
                  className="block rounded-full"
                  style={{ width: 13, height: 13, background: 'transparent', border: `3px solid ${CYAN}`, boxShadow: sel ? `0 0 0 2px ${CYAN}` : '0 0 0 1px rgba(0,0,0,0.5)' }}
                />
              </div>
              {/* label — drag it anywhere so it doesn't cover a jack */}
              <div
                data-dot="1"
                onPointerDown={(e) => onDown(i, 'label', e)}
                className="absolute"
                style={{ left: l.x, top: l.y, transform: 'translate(-50%, -50%)', cursor: 'grab' }}
              >
                <span
                  data-dot="1"
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
                  style={{ background: 'rgba(11,23,40,0.92)', color: '#fff', border: `1px solid ${sel ? CYAN : BORDER}` }}
                >
                  {t.name || '·'}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Selected port — rename / remove */}
      {selIdx !== null && terminals[selIdx] && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={terminals[selIdx].name}
            onChange={(e) => rename(e.target.value)}
            placeholder="Port name (e.g. WAN, LAN1, PWR)"
            className="flex-1 px-2 py-1.5 text-xs rounded-lg outline-none"
            style={inputStyle}
          />
          <button type="button" onClick={removeSel} className="p-1.5 rounded-lg" style={{ color: '#F87171', border: `1px solid ${BORDER}` }}>
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Editor modal ──────────────────────────────────────────────────────────────
function ProductEditor({
  initial, onClose, onSaved,
}: {
  initial: ProductForm;
  onClose: () => void;
  onSaved: (row: ProductRow) => void;
}) {
  const isEdit = !!initial.id;
  const [form, setForm] = useState<ProductForm>(initial);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const set = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) => setForm((p) => ({ ...p, [k]: v }));
  const design = form.designMeta;
  const setD = (k: keyof DesignMeta, v: string | boolean | Terminal[] | undefined) =>
    set('designMeta', { ...form.designMeta, [k]: v });
  const m = calcMargin(form.dealerCost, form.sellPrice);

  const [showDesign, setShowDesign] = useState<boolean>(
    !!(initial.designMeta && (initial.designMeta.role || initial.designMeta.isBoard || initial.designMeta.wiringImageUrl)),
  );

  // ── Image slots ────────────────────────────────────────────────────────────
  type ImgKind = 'general' | 'placement' | 'wiring';
  const IMG_LABEL: Record<ImgKind, string> = { general: 'Icon', placement: 'Placement symbol', wiring: 'Line drawing' };
  const [imgBusy, setImgBusy] = useState<'' | ImgKind | `find-${ImgKind}`>('');
  const [imgStatus, setImgStatus] = useState<string | null>(null);
  const genRef = useRef<HTMLInputElement>(null);
  const placeRef = useRef<HTMLInputElement>(null);
  const wireRef = useRef<HTMLInputElement>(null);

  const applyImg = (kind: ImgKind, url: string) => {
    if (kind === 'general') set('imageUrl', url);
    else if (kind === 'placement') setD('placementImageUrl', url);
    else setD('wiringImageUrl', url);
  };

  const uploadImage = async (file: File, kind: ImgKind) => {
    setImgBusy(kind);
    setImgStatus(`Uploading ${IMG_LABEL[kind].toLowerCase()}…`);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', kind);
      if (form.id) fd.append('id', form.id);
      fd.append('name', `${form.brand} ${form.name}`.trim());
      const res = await fetch('/api/products/upload-image', { method: 'POST', body: fd });
      const d = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      if (!res.ok) throw new Error(d.error ?? 'Upload failed');
      applyImg(kind, d.url as string);
      setImgStatus(`✅ ${IMG_LABEL[kind]} uploaded`);
    } catch (e) {
      setImgStatus(`❌ ${e instanceof Error ? e.message : 'Upload failed'}`);
    } finally {
      setImgBusy('');
    }
  };

  const findImage = async (kind: ImgKind) => {
    setImgBusy(`find-${kind}`);
    setImgStatus(`🔍 Searching for ${IMG_LABEL[kind].toLowerCase()}…`);
    try {
      const searchName =
        kind === 'wiring' ? `${form.name} wiring diagram terminals`
          : kind === 'placement' ? `${form.name} line drawing symbol`
            : form.name;
      const res = await fetch('/api/products/find-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: searchName,
          brand: form.brand,
          id: (kind === 'general' && form.id) ? form.id : undefined,
        }),
      });
      const d = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      if (!res.ok) throw new Error(d.error ?? 'Search failed');
      applyImg(kind, d.url as string);
      setImgStatus(`✅ Found ${IMG_LABEL[kind].toLowerCase()}`);
    } catch (e) {
      setImgStatus(`❌ ${e instanceof Error ? e.message : 'Search failed'}`);
    } finally {
      setImgBusy('');
    }
  };

  // ── Terminal map ─────────────────────────────────────────────────────────────
  const terminals = design.terminals ?? [];
  const addTerminal = () =>
    setD('terminals', [...terminals, { name: '', dx: -30, dy: terminals.length * 16 - terminals.length * 8 }]);
  const setTerminal = (i: number, patch: Partial<Terminal>) =>
    setD('terminals', terminals.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const removeTerminal = (i: number) =>
    setD('terminals', terminals.filter((_, idx) => idx !== i));

  // ── Save ─────────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!form.name.trim()) { setSaveErr('Product name is required'); return; }
    setSaving(true);
    setSaveErr(null);
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || undefined,
        brand: form.brand,
        category: form.category,
        subcategory: form.subcategory,
        description: form.description,
        specs: form.specs,
        msrp: form.msrp,
        dealer_cost: form.dealerCost,
        sell_price: form.sellPrice,
        adi_sku: form.adiSku,
        image_url: form.imageUrl,
        active: form.active,
        field_service: form.fieldService,
        tags: form.tags,
        design_meta: form.designMeta,
      };
      const res = await fetch('/api/products', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: form.id, ...payload } : payload),
      });
      const d = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      if (!res.ok) throw new Error(d.error ?? 'Save failed');
      onSaved(d.product as ProductRow);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const swatchCls = 'w-5 h-5 rounded-full border-2 transition-transform hover:scale-110';

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center overflow-y-auto p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={() => !saving && onClose()}
    >
      <div
        className="w-full max-w-2xl rounded-2xl flex flex-col my-auto"
        style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, maxHeight: 'calc(100vh - 2rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: BORDER }}>
          <h2 className="text-sm font-semibold" style={{ color: TEXT }}>
            {isEdit ? 'Edit Product' : 'Add Product'}
          </h2>
          <button onClick={() => !saving && onClose()} style={{ color: MUTED }}><X size={18} /></button>
        </div>

        {/* Scrollable body — flex-1 + min-h-0 so the footer (Save) always stays
            pinned & visible; modal-scroll containment (known app bug). */}
        <div
          className="px-6 py-5 space-y-4 flex-1"
          style={{
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Identity */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="SKU / Model #">
              <input value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="e.g. CMIP3CD42WI-28" className={inputCls} style={inputStyle} />
            </Field>
            <Field label="Brand">
              <input value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="e.g. LTS Security" className={inputCls} style={inputStyle} />
            </Field>
          </div>
          <Field label="Product Name" required>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Full product name" className={inputCls} style={inputStyle} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <select value={form.category} onChange={(e) => set('category', e.target.value)} className={inputCls} style={inputStyle}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Subcategory">
              <input value={form.subcategory} onChange={(e) => set('subcategory', e.target.value)} placeholder="e.g. IP Dome, Barrier, Switch" className={inputCls} style={inputStyle} />
            </Field>
          </div>
          <Field label="Description">
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} className={`${inputCls} resize-none`} style={inputStyle} />
          </Field>
          <Field label="Key Specs">
            <textarea value={form.specs} onChange={(e) => set('specs', e.target.value)} rows={2} className={`${inputCls} resize-none`} style={inputStyle} />
          </Field>

          {/* Pricing */}
          <div className="grid grid-cols-4 gap-3">
            <Field label="MSRP ($)">
              <input type="number" value={form.msrp || ''} onChange={(e) => set('msrp', Number(e.target.value))} className={inputCls} style={inputStyle} />
            </Field>
            <Field label="Your Cost ($)">
              <input type="number" value={form.dealerCost || ''} onChange={(e) => set('dealerCost', Number(e.target.value))} className={inputCls} style={{ ...inputStyle, borderColor: 'rgba(245,158,11,0.5)' }} />
            </Field>
            <Field label="Sell Price ($)">
              <input type="number" value={form.sellPrice || ''} onChange={(e) => set('sellPrice', Number(e.target.value))} className={inputCls} style={{ ...inputStyle, borderColor: `${BRAND}88` }} />
            </Field>
            <Field label="Margin">
              <div
                className="px-3 py-2 rounded-lg text-sm font-bold text-center"
                style={{
                  border: `1px solid ${BORDER}`,
                  backgroundColor: PANEL,
                  color: m === null ? MUTED : m >= 40 ? '#34D399' : m >= 25 ? '#FBBF24' : '#F87171',
                }}
              >
                {m !== null ? `${m}%` : '—'}
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="ADI SKU">
              <input value={form.adiSku} onChange={(e) => set('adiSku', e.target.value)} placeholder="ADI part #" className={inputCls} style={inputStyle} />
            </Field>
            <Field label="Icon Image URL">
              <input value={form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} placeholder="Paste image URL, or use the slots below" className={inputCls} style={inputStyle} />
            </Field>
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-8 pt-1">
            <div className="flex items-center gap-3">
              <button
                onClick={() => set('active', !form.active)}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                style={{ backgroundColor: form.active ? BRAND : '#334155' }}
              >
                <span className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform" style={{ transform: form.active ? 'translateX(24px)' : 'translateX(4px)' }} />
              </button>
              <span className="text-sm font-medium" style={{ color: TEXT }}>{form.active ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => set('fieldService', !form.fieldService)}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                style={{ backgroundColor: form.fieldService ? '#10B981' : '#334155' }}
              >
                <span className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform" style={{ transform: form.fieldService ? 'translateX(24px)' : 'translateX(4px)' }} />
              </button>
              <span className="text-sm font-medium" style={{ color: TEXT }}>Field Service</span>
              <span className="text-[10px]" style={{ color: MUTED }}>(shows in /tech tool)</span>
            </div>
          </div>

          {/* ── Design & Wiring ─────────────────────────────────────────────── */}
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
            <button
              type="button"
              onClick={() => setShowDesign((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:brightness-125"
              style={{ backgroundColor: PANEL }}
            >
              <div className="flex items-center gap-2">
                <Layers size={15} style={{ color: BRAND }} />
                <span className="text-sm font-semibold" style={{ color: TEXT }}>Design &amp; Wiring</span>
                <span className="text-[10px]" style={{ color: MUTED }}>— how this shows on system drawings</span>
              </div>
              <span className="text-xs" style={{ color: MUTED }}>{showDesign ? 'Hide' : 'Set up'}</span>
            </button>

            {showDesign && (
              <div className="p-4 space-y-4" style={{ backgroundColor: CARD }}>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Drawing Role">
                    <select value={design.role ?? ''} onChange={(e) => setD('role', e.target.value)} className={inputCls} style={inputStyle}>
                      {DESIGN_ROLES.map((r) => <option key={r} value={r}>{r === '' ? '— none —' : r}</option>)}
                    </select>
                  </Field>
                  <Field label="Badge / Abbreviation">
                    <input value={design.abbr ?? ''} onChange={(e) => setD('abbr', e.target.value)} placeholder="e.g. SDC, CAM, GW" className={inputCls} style={inputStyle} />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Marker Color">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={design.color ?? '#6B7EFF'}
                        onChange={(e) => setD('color', e.target.value)}
                        className="h-9 w-10 rounded-lg cursor-pointer p-0.5"
                        style={{ border: `1px solid ${BORDER}`, backgroundColor: PANEL }}
                      />
                      <div className="flex flex-wrap gap-1">
                        {DESIGN_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setD('color', c)}
                            className={swatchCls}
                            style={{ background: c, borderColor: design.color === c ? TEXT : 'rgba(255,255,255,0.25)' }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>
                  </Field>
                  <Field label="Default Cable">
                    <select value={design.defaultCable ?? ''} onChange={(e) => setD('defaultCable', e.target.value)} className={inputCls} style={inputStyle}>
                      {DESIGN_CABLES.map((c) => <option key={c} value={c}>{c === '' ? '— none —' : c}</option>)}
                    </select>
                  </Field>
                </div>

                {/* Ports / terminals toggle → design_meta.isBoard */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setD('isBoard', !design.isBoard)}
                    className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                    style={{ backgroundColor: design.isBoard ? BRAND : '#334155' }}
                  >
                    <span className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform" style={{ transform: design.isBoard ? 'translateX(24px)' : 'translateX(4px)' }} />
                  </button>
                  <span className="text-sm font-medium" style={{ color: TEXT }}>Has ports / terminals to map</span>
                  <span className="text-[10px]" style={{ color: MUTED }}>(shows a terminal strip in detail drawings)</span>
                </div>

                {/* Three image slots */}
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { kind: 'general' as ImgKind, title: 'Icon', hint: 'catalog · invoice · proposal', ref: genRef, url: form.imageUrl },
                    { kind: 'placement' as ImgKind, title: 'Placement symbol', hint: 'basic / overview drawings', ref: placeRef, url: design.placementImageUrl },
                    { kind: 'wiring' as ImgKind, title: 'Line drawing', hint: 'device + terminals (detail)', ref: wireRef, url: design.wiringImageUrl },
                  ]).map((slot) => (
                    <div key={slot.kind} className="space-y-1.5">
                      <label className="text-[11px] font-medium block leading-tight" style={{ color: TEXT }}>
                        {slot.title}<br />
                        <span className="text-[10px] font-normal" style={{ color: MUTED }}>{slot.hint}</span>
                      </label>
                      <div className="rounded-lg p-2 flex flex-col items-center gap-2" style={{ border: `1px solid ${BORDER}`, backgroundColor: PANEL }}>
                        {slot.url
                          ? <img src={slot.url} alt={slot.title} className="w-16 h-16 object-contain rounded bg-white" style={{ border: `1px solid ${BORDER}` }} />
                          : <div className="w-16 h-16 rounded flex items-center justify-center text-[10px]" style={{ border: `1px dashed ${BORDER}`, color: MUTED }}>none</div>}
                        <div className="flex gap-1 w-full">
                          <input ref={slot.ref} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, slot.kind); }} />
                          <button
                            type="button"
                            onClick={() => slot.ref.current?.click()}
                            disabled={imgBusy !== ''}
                            className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg text-[10px] font-semibold disabled:opacity-50"
                            style={{ backgroundColor: BRAND, color: '#0B1728' }}
                          >
                            {imgBusy === slot.kind ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}Upload
                          </button>
                          <button
                            type="button"
                            onClick={() => findImage(slot.kind)}
                            disabled={imgBusy !== '' || !form.name}
                            className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg text-[10px] font-semibold disabled:opacity-50"
                            style={{ backgroundColor: '#8B5CF6', color: TEXT }}
                          >
                            {imgBusy === `find-${slot.kind}` ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}Find
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {imgStatus && (
                  <p
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{
                      backgroundColor: imgStatus.startsWith('✅') ? 'rgba(16,185,129,0.12)' : imgStatus.startsWith('❌') ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                      color: imgStatus.startsWith('✅') ? '#34D399' : imgStatus.startsWith('❌') ? '#F87171' : '#FBBF24',
                    }}
                  >
                    {imgStatus}
                  </p>
                )}

                {/* Terminal map — only when ports toggle is ON */}
                {design.isBoard && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-medium" style={{ color: TEXT }}>
                        Terminal Map <span className="text-[10px]" style={{ color: MUTED }}>(screws wires land on)</span>
                      </label>
                      <button
                        type="button"
                        onClick={addTerminal}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold"
                        style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: TEXT }}
                      >
                        <Plus size={11} />Add terminal
                      </button>
                    </div>

                    {/* Visual mapper — drop & drag ports onto the drawing */}
                    <TerminalMapper
                      imageUrl={design.wiringImageUrl || design.placementImageUrl || form.imageUrl}
                      terminals={terminals}
                      onChange={(t) => setD('terminals', t)}
                    />

                    {terminals.length > 0 && (
                      <details>
                        <summary className="text-[10px] cursor-pointer" style={{ color: MUTED }}>Fine-tune positions (numbers)</summary>
                        <div className="mt-2">
                    {terminals.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-[1fr_64px_64px_28px] gap-2 px-1 text-[10px] font-medium" style={{ color: MUTED }}>
                          <span>Name</span><span>X offset</span><span>Y offset</span><span />
                        </div>
                        {terminals.map((t, i) => (
                          <div key={i} className="grid grid-cols-[1fr_64px_64px_28px] gap-2 items-center">
                            <input value={t.name} onChange={(e) => setTerminal(i, { name: e.target.value })} placeholder="LOCK+" className="px-2 py-1 text-xs rounded-lg outline-none" style={inputStyle} />
                            <input type="number" value={t.dx} onChange={(e) => setTerminal(i, { dx: Number(e.target.value) })} className="px-2 py-1 text-xs rounded-lg outline-none" style={inputStyle} />
                            <input type="number" value={t.dy} onChange={(e) => setTerminal(i, { dy: Number(e.target.value) })} className="px-2 py-1 text-xs rounded-lg outline-none" style={inputStyle} />
                            <button type="button" onClick={() => removeTerminal(i)} className="p-1 rounded-lg" style={{ color: '#F87171' }}><Trash2 size={13} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {saveErr && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#F87171' }}>{saveErr}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0" style={{ borderColor: BORDER }}>
          <button
            onClick={() => !saving && onClose()}
            className="px-4 py-2 rounded-xl text-sm transition-colors hover:brightness-125"
            style={{ border: `1px solid ${BORDER}`, color: MUTED }}
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!form.name.trim() || saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 flex items-center gap-2"
            style={{ backgroundColor: BRAND, color: '#0B1728' }}
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main surface ──────────────────────────────────────────────────────────────
export default function CatalogSurface() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string>('All');
  const [editing, setEditing] = useState<ProductForm | null>(null);

  const catOf = (p: ProductRow) => (p.category && p.category.trim()) ? p.category : 'Other';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/products?limit=300', { cache: 'no-store' });
      const json = res.ok ? await res.json() : { products: [] };
      setProducts(Array.isArray(json.products) ? json.products : []);
    } catch {
      /* leave empty — never fake demo data */
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Category chips: known categories first (in a fixed order), then any extras
  // actually present, each with a live count. "All" always leads.
  const catChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) counts.set(catOf(p), (counts.get(catOf(p)) ?? 0) + 1);
    const ordered: string[] = [];
    for (const c of CATEGORIES) if (counts.has(c)) ordered.push(c);
    for (const c of Array.from(counts.keys()).sort()) if (!ordered.includes(c)) ordered.push(c);
    return [{ label: 'All', count: products.length }, ...ordered.map((c) => ({ label: c, count: counts.get(c) ?? 0 }))];
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (catFilter !== 'All' && catOf(p) !== catFilter) return false;
      if (!q) return true;
      return (p.name ?? '').toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        (p.brand ?? '').toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q);
    });
  }, [products, query, catFilter]);

  // When browsing "All" with no search, group cards under category headers so a
  // long catalog stays scannable. Otherwise show a flat grid of the filtered set.
  const groups = useMemo(() => {
    if (catFilter !== 'All' || query.trim()) return null;
    const m = new Map<string, ProductRow[]>();
    for (const p of filtered) { const c = catOf(p); if (!m.has(c)) m.set(c, []); m.get(c)!.push(p); }
    const order = catChips.filter((c) => c.label !== 'All').map((c) => c.label);
    return order.filter((c) => m.has(c)).map((c) => ({ cat: c, items: m.get(c)! }));
  }, [filtered, catFilter, query, catChips]);

  // On save: replace or prepend the returned row, then close the editor.
  const handleSaved = (row: ProductRow) => {
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === row.id);
      if (idx >= 0) { const next = prev.slice(); next[idx] = row; return next; }
      return [row, ...prev];
    });
    setEditing(null);
  };

  const renderCard = (p: ProductRow) => {
    const sell = Number(p.sell_price) || 0;
    const cost = Number(p.dealer_cost) || 0;
    const margin = calcMargin(cost, sell);
    return (
      <button
        key={p.id}
        onClick={() => setEditing(rowToForm(p))}
        className="w-full text-left rounded-2xl p-4 flex items-center gap-3 transition-colors hover:brightness-125"
        style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, opacity: p.active === false ? 0.55 : 1 }}
      >
        <ProductThumb url={p.image_url} brand={p.brand ?? ''} size={48} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate" style={{ color: TEXT }}>{p.name}</div>
          <div className="text-[11px] truncate" style={{ color: MUTED }}>
            {[p.brand, p.category].filter(Boolean).join(' · ') || '—'}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {p.sku && (
              <span className="text-[10px] font-mono truncate" style={{ color: MUTED }}>{p.sku}</span>
            )}
            {p.active === false && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide" style={{ backgroundColor: 'rgba(148,163,184,0.16)', color: MUTED }}>Inactive</span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold" style={{ color: sell > 0 ? CYAN : MUTED }}>{fmt$(sell)}</div>
          {margin !== null && (
            <div
              className="text-[10px] font-medium mt-0.5"
              style={{ color: margin >= 40 ? '#34D399' : margin >= 25 ? '#FBBF24' : '#F87171' }}
            >
              {margin}% margin
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: BG, color: TEXT }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b shrink-0" style={{ borderColor: BORDER }}>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `linear-gradient(135deg, ${BRAND}, ${CYAN})` }}
        >
          <PenTool size={18} color="#0B1728" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: TEXT }}>Catalog</h1>
          <p className="text-xs" style={{ color: MUTED }}>
            Products — one source for drawings, quotes, invoices &amp; BOM
          </p>
        </div>
        <div className="relative hidden sm:block">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="pl-9 pr-3 py-2 rounded-xl text-sm outline-none w-56"
            style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: TEXT }}
          />
        </div>
        <button
          onClick={() => setEditing(emptyForm())}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shrink-0"
          style={{ backgroundColor: BRAND, color: '#0B1728' }}
        >
          <Plus size={16} /> New Product
        </button>
      </div>

      {/* Category chips */}
      {!loading && products.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-6 py-3 border-b shrink-0" style={{ borderColor: BORDER }}>
          {catChips.map((c) => {
            const active = catFilter === c.label;
            return (
              <button
                key={c.label}
                onClick={() => setCatFilter(c.label)}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors shrink-0"
                style={active
                  ? { background: `linear-gradient(135deg, ${BRAND}, rgba(0,200,255,0.2))`, border: `1px solid ${CYAN}88`, color: '#fff' }
                  : { backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: MUTED }}
              >
                {c.label}
                <span className="text-[10px] font-bold px-1.5 rounded-full" style={{ backgroundColor: active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)', color: active ? '#fff' : MUTED }}>{c.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24" style={{ color: MUTED }}>
            <Loader2 size={22} className="animate-spin mr-2" /> Loading catalog…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
              <Package size={24} style={{ color: MUTED }} />
            </div>
            <p className="text-sm font-medium" style={{ color: TEXT }}>
              {query ? 'No products match your search' : 'No products yet'}
            </p>
            <p className="text-xs mt-1 mb-5" style={{ color: MUTED }}>
              {query ? 'Try a different name, SKU, brand, or category.' : 'Add your first product to power drawings, quotes and invoices.'}
            </p>
            {!query && (
              <button
                onClick={() => setEditing(emptyForm())}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: BRAND, color: '#0B1728' }}
              >
                <Plus size={16} /> New Product
              </button>
            )}
          </div>
        ) : groups ? (
          <div className="max-w-7xl mx-auto space-y-8">
            {groups.map((g) => (
              <div key={g.cat}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: TEXT }}>{g.cat}</h2>
                  <span className="text-[11px]" style={{ color: MUTED }}>{g.items.length}</span>
                  <div className="flex-1 h-px" style={{ backgroundColor: BORDER }} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {g.items.map(renderCard)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 max-w-7xl mx-auto">
            {filtered.map(renderCard)}
          </div>
        )}
      </div>

      {editing && (
        <ProductEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
