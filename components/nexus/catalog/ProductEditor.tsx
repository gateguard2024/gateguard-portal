'use client'
/**
 * Catalog — product editor (add / edit) and the wiring terminal mapper.
 * Moved out of CatalogSurface and restyled to the light look; Phase "catalog pro"
 * adds labor hours, unit, warranty, accessories (kit), Gate Guard cost
 * (corporate only) and manuals (upload / auto-find).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Plus, Loader2, X, Upload, Trash2 } from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Layers } = require('lucide-react') as any
import {
  CARD, PANEL, BORDER, TEXT, MUTED, BRAND, CYAN, GREEN, ORANGE, RED,
  CATEGORIES, UNITS, DESIGN_ROLES, DESIGN_CABLES, DESIGN_COLORS,
  type Terminal, type DesignMeta, type ProductRow, type ProductForm, type Accessory,
  calcMargin, marginColor, priceAtMargin, Field, inputStyle, inputCls, clamp, ProductThumb,
} from '@/components/nexus/catalog/shared'

// ── Visual terminal/port mapper ───────────────────────────────────────────────
// Tap the image to drop a port, drag it into place, tap a dot to rename/remove.
// Positions are stored as dx/dy (canvas px offset from the device center) so the
// drawing tool overlays them on the exact same spots.
export function TerminalMapper({
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
          <button type="button" onClick={removeSel} className="p-1.5 rounded-lg" style={{ color: RED, border: `1px solid ${BORDER}` }}>
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Editor modal ──────────────────────────────────────────────────────────────
export function ProductEditor({
  initial, onClose, onSaved, isCorporate = false, catalog = [],
}: {
  initial: ProductForm;
  onClose: () => void;
  onSaved: (row: ProductRow) => void;
  isCorporate?: boolean;
  catalog?: ProductRow[];
}) {
  // Once a new product has been created, further saves update it (never create a second one).
  const [savedId, setSavedId] = useState<string | null>(initial.id ?? null);
  const isEdit = !!savedId;
  const [form, setForm] = useState<ProductForm>(initial);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const set = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) => setForm((p) => ({ ...p, [k]: v }));
  const design = form.designMeta;
  const setD = (k: keyof DesignMeta, v: string | boolean | Terminal[] | undefined) =>
    set('designMeta', { ...form.designMeta, [k]: v });
  const m = calcMargin(form.dealerCost, form.sellPrice);

  // ── Accessories (kit) ───────────────────────────────────────────────────────
  const [accQ, setAccQ] = useState('');
  const byId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);
  const accMatches = useMemo(() => {
    const q = accQ.trim().toLowerCase();
    if (q.length < 2) return [];
    return catalog.filter((p) => p.id !== form.id && !form.accessories.some((a) => a.product_id === p.id) &&
      `${p.name} ${p.sku ?? ''} ${p.brand ?? ''}`.toLowerCase().includes(q)).slice(0, 8);
  }, [accQ, catalog, form.accessories, form.id]);
  const setAcc = (i: number, patch: Partial<Accessory>) => set('accessories', form.accessories.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  // ── Manuals (upload a PDF or auto-find it online; indexed for AI Tech Support) ─
  const [manualMsg, setManualMsg] = useState<string | null>(null);
  const [manualBusy, setManualBusy] = useState(false);
  const pdfRef = useRef<HTMLInputElement>(null);
  async function uploadManual(file: File) {
    if (!form.id) { setManualMsg('Save the product first, then add its manual.'); return; }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { setManualMsg('❌ Choose a PDF.'); return; }
    if (file.size > 100 * 1048576) { setManualMsg('❌ That PDF is over 100 MB.'); return; }
    setManualBusy(true); setManualMsg('Uploading…');
    try {
      const u = await fetch('/api/kb/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: form.id, filename: file.name }) });
      const ud = await u.json().catch(() => ({}));
      if (!u.ok) throw new Error(ud.error ?? 'Couldn’t start the upload');
      const put = await fetch(ud.signedUrl, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: file });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      setManualMsg('Reading the manual for AI Tech Support…');
      const pr = await fetch('/api/kb/process', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: form.id, manual_url: ud.publicUrl }) });
      const pd = await pr.json().catch(() => ({}));
      if (!pr.ok) throw new Error(pd.error ?? 'Processing failed');
      setManualMsg(`✅ Manual added — ${pd.chunksCreated ?? 'all'} sections indexed.`);
    } catch (e) { setManualMsg(`❌ ${e instanceof Error ? e.message : 'Upload failed'}`); }
    setManualBusy(false);
  }
  async function findManual() {
    if (!form.id) { setManualMsg('Save the product first, then find its manual.'); return; }
    setManualBusy(true); setManualMsg('🔍 Searching manufacturer sites…');
    try {
      const r = await fetch('/api/kb/find-manual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: form.id }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? 'Search failed');
      setManualMsg(d.already ? '✅ This product already has a manual.' : !d.found ? '⚠️ Couldn’t find it online — upload the PDF instead.' : `✅ Found and indexed (${d.chunksCreated} sections).`);
    } catch (e) { setManualMsg(`❌ ${e instanceof Error ? e.message : 'Search failed'}`); }
    setManualBusy(false);
  }

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
        labor_hours: form.laborHours,
        unit: form.unit,
        warranty_months: form.warrantyMonths,
        accessories: form.accessories,
      };
      const res = await fetch('/api/products', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: savedId, ...payload } : payload),
      });
      const d = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      if (!res.ok) throw new Error(d.error ?? 'Save failed');
      // Gate Guard cost lives server-only (product_costs) — corporate only. Saving it
      // also sets the locked dealer cost (cost + 10%) on the product.
      let saved = d.product as ProductRow;
      if (saved?.id) { setSavedId(saved.id); setForm(f => ({ ...f, id: saved.id })); }
      if (isCorporate && saved?.id && form.ggCost !== initial.ggCost) {
        const c = await fetch('/api/admin/product-costs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: saved.id, gg_cost: form.ggCost }) });
        const cd = await c.json().catch(() => ({}));
        if (!c.ok) throw new Error(`Saved, but Gate Guard cost didn’t: ${cd.error ?? c.status}`);
        if (cd.dealer_cost != null) saved = { ...saved, dealer_cost: cd.dealer_cost };
      }
      onSaved(saved);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const swatchCls = 'w-5 h-5 rounded-full border-2 transition-transform hover:scale-110';

  return (
    <div
      className="fixed inset-0 z-[140] flex justify-center overflow-y-auto p-4"
      style={{ backgroundColor: 'rgba(15,23,42,0.42)', backdropFilter: 'blur(6px)' }}
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
            <Field label="Dealer cost ($)">
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
                  color: marginColor(m),
                }}
              >
                {m !== null ? `${m}%` : '—'}
              </div>
            </Field>
          </div>

          {isCorporate && (
            <div className="grid grid-cols-2 gap-4 items-end">
              <Field label="Gate Guard cost ($)" hint="corporate only · sets dealer cost = cost + 10%">
                <input type="number" min={0} step="0.01" value={form.ggCost ?? ''} onChange={(e) => { const v = e.target.value === '' ? null : Number(e.target.value); set('ggCost', v); if (v != null) set('dealerCost', Math.round(v * 1.1 * 100) / 100); }} className={inputCls} style={inputStyle} />
              </Field>
              <div className="text-[12px] pb-2" style={{ color: MUTED }}>Dealers never see this number.</div>
            </div>
          )}
          {form.dealerCost > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[12px]" style={{ color: MUTED }}>
              Set sell price for a margin of
              {[30, 40, 50].map((pct) => (
                <button key={pct} type="button" onClick={() => set('sellPrice', priceAtMargin(form.dealerCost, pct))} className="px-2.5 py-1 rounded-lg font-medium" style={{ border: `1px solid ${BORDER}`, color: TEXT, background: '#fff' }}>{pct}% → ${priceAtMargin(form.dealerCost, pct).toLocaleString()}</button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <Field label="Install labor" hint="hours per unit">
              <input type="number" min={0} step="0.25" value={form.laborHours ?? ''} onChange={(e) => set('laborHours', e.target.value === '' ? null : Number(e.target.value))} placeholder="e.g. 1.5" className={inputCls} style={inputStyle} />
            </Field>
            <Field label="Sold by">
              <select value={form.unit} onChange={(e) => set('unit', e.target.value)} className={inputCls} style={inputStyle}>
                {UNITS.map((u) => <option key={u} value={u}>{u === 'each' ? 'Each' : u === 'ft' ? 'Foot' : u[0].toUpperCase() + u.slice(1)}</option>)}
              </select>
            </Field>
            <Field label="Warranty" hint="months">
              <input type="number" min={0} step="1" value={form.warrantyMonths ?? ''} onChange={(e) => set('warrantyMonths', e.target.value === '' ? null : Number(e.target.value))} placeholder="e.g. 24" className={inputCls} style={inputStyle} />
            </Field>
          </div>

          {/* Accessories / kit */}
          <div className="rounded-xl p-3 space-y-2" style={{ border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold" style={{ color: TEXT }}>Goes with this item <span className="text-[12px] font-normal" style={{ color: MUTED }}>— accessories and kit parts added to quotes with it</span></span>
            </div>
            {form.accessories.length === 0 && <div className="text-[12px]" style={{ color: MUTED }}>Nothing yet. Example: a camera needs a mount and a PoE port.</div>}
            {form.accessories.map((a, i) => { const p = byId.get(a.product_id); return (
              <div key={a.product_id} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: PANEL }}>
                <ProductThumb url={p?.image_url} brand={p?.brand ?? ''} size={28} />
                <span className="flex-1 min-w-0 text-sm truncate" style={{ color: TEXT }}>{p?.name ?? 'Unknown item'}{p?.sku ? <span style={{ color: MUTED }}> · {p.sku}</span> : null}</span>
                <input type="number" min={1} value={a.qty} onChange={(e) => setAcc(i, { qty: Math.max(1, Number(e.target.value) || 1) })} aria-label="Quantity" className="w-14 px-2 py-1 rounded-lg text-sm" style={inputStyle} />
                <button type="button" onClick={() => setAcc(i, { required: !a.required })} className="px-2 py-1 rounded-lg text-[12px] font-medium" style={a.required ? { background: '#FFF4E5', color: ORANGE, border: '1px solid rgba(178,80,0,.25)' } : { background: '#fff', color: MUTED, border: `1px solid ${BORDER}` }}>{a.required ? 'Required' : 'Optional'}</button>
                <button type="button" onClick={() => set('accessories', form.accessories.filter((_, j) => j !== i))} className="p-1 rounded-lg" style={{ color: RED }} aria-label="Remove"><Trash2 size={14} /></button>
              </div>
            ); })}
            <div className="relative">
              <input value={accQ} onChange={(e) => setAccQ(e.target.value)} placeholder="Add an item — search name or SKU" className={inputCls} style={inputStyle} aria-label="Add accessory" />
              {accMatches.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 rounded-xl overflow-hidden z-10" style={{ background: '#fff', border: `1px solid ${BORDER}`, boxShadow: '0 8px 24px rgba(10,20,40,.12)' }}>
                  {accMatches.map((p) => (
                    <button key={p.id} type="button" onClick={() => { set('accessories', [...form.accessories, { product_id: p.id, qty: 1, required: false }]); setAccQ(''); }} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#F5F5F7]">
                      <ProductThumb url={p.image_url} brand={p.brand ?? ''} size={24} />
                      <span className="text-sm truncate" style={{ color: TEXT }}>{p.name}</span>
                      <span className="text-[12px] ml-auto" style={{ color: MUTED }}>{p.sku}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Manual */}
          <div className="rounded-xl p-3 space-y-2" style={{ border: `1px solid ${BORDER}` }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold" style={{ color: TEXT }}>Manual <span className="text-[12px] font-normal" style={{ color: MUTED }}>— powers AI Tech Support on jobs</span></span>
              <div className="flex gap-2">
                <input ref={pdfRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadManual(f); e.target.value = ''; }} />
                <button type="button" disabled={manualBusy || !form.id} onClick={() => pdfRef.current?.click()} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-50" style={{ background: BRAND, color: '#fff' }}>Upload PDF</button>
                <button type="button" disabled={manualBusy || !form.id} onClick={findManual} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-50" style={{ background: '#fff', color: TEXT, border: `1px solid ${BORDER}` }}>Find it online</button>
              </div>
            </div>
            {!form.id && <div className="text-[12px]" style={{ color: MUTED }}>Save the product first, then add its manual.</div>}
            {manualMsg && <div className="text-[12px] px-2 py-1 rounded-lg" style={{ background: manualMsg.startsWith('✅') ? '#E8F6EC' : manualMsg.startsWith('❌') ? '#FFECEC' : '#FFF4E5', color: manualMsg.startsWith('✅') ? GREEN : manualMsg.startsWith('❌') ? RED : ORANGE }}>{manualMsg}</div>}
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
                style={{ backgroundColor: form.active ? BRAND : '#D1D1D6' }}
              >
                <span className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform" style={{ transform: form.active ? 'translateX(24px)' : 'translateX(4px)' }} />
              </button>
              <span className="text-sm font-medium" style={{ color: TEXT }}>{form.active ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => set('fieldService', !form.fieldService)}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                style={{ backgroundColor: form.fieldService ? '#34C759' : '#D1D1D6' }}
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
              className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-[#F0F1F4]"
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
                        value={design.color ?? '#0071E3'}
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
                            style={{ background: c, borderColor: design.color === c ? TEXT : 'rgba(0,0,0,0.12)' }}
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
                    style={{ backgroundColor: design.isBoard ? BRAND : '#D1D1D6' }}
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
                            style={{ backgroundColor: BRAND, color: '#fff' }}
                          >
                            {imgBusy === slot.kind ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}Upload
                          </button>
                          <button
                            type="button"
                            onClick={() => findImage(slot.kind)}
                            disabled={imgBusy !== '' || !form.name}
                            className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg text-[10px] font-semibold disabled:opacity-50"
                            style={{ backgroundColor: '#fff', color: TEXT, border: `1px solid ${BORDER}` }}
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
                      backgroundColor: imgStatus.startsWith('✅') ? '#E8F6EC' : imgStatus.startsWith('❌') ? '#FFECEC' : '#FFF4E5',
                      color: imgStatus.startsWith('✅') ? GREEN : imgStatus.startsWith('❌') ? RED : ORANGE,
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
                            <button type="button" onClick={() => removeTerminal(i)} className="p-1 rounded-lg" style={{ color: RED }}><Trash2 size={13} /></button>
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
            <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: RED }}>{saveErr}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0" style={{ borderColor: BORDER }}>
          <button
            onClick={() => !saving && onClose()}
            className="px-4 py-2 rounded-xl text-sm transition-colors hover:bg-[#F0F1F4]"
            style={{ border: `1px solid ${BORDER}`, color: MUTED }}
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!form.name.trim() || saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 flex items-center gap-2"
            style={{ backgroundColor: BRAND, color: '#fff' }}
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </div>
    </div>
  );
}

