"use client";

// Design Studio — Phase 1 of the rebuilt design tool (see docs/design/DESIGN_TOOL_JOURNAL.md).
// Dark-glass System-Surveyor-class editor: background picker, categorized icon library,
// device placement on a Fabric.js canvas, inspector + live BOM. Wiring, coverage cones,
// scale calibration, map/PDF backgrounds and DB persistence land in follow-up passes.
// The legacy /design/floor-plans + background-image tools are left intact until this replaces them.

import { useState, useRef, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Search, X, Upload, Wifi, Camera, Shield, Key, Package, Loader2 } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Router, DoorOpen, Radio, Bolt, Cpu, LayoutGrid } = require("lucide-react") as any;

const BG = "#0B1728", PANEL = "#0F1830", CARD = "#131B2E", LINE = "rgba(255,255,255,0.1)", TXT = "#F8FAFC", MUT = "#94A3B8", BRAND = "#6B7EFF", CYAN = "#7DE5FF";

type DrawingType = "floor_plan" | "system_design" | "as_built" | "estimate";

interface DeviceDef { key: string; label: string; abbr: string; color: string; price: number; isCam?: boolean }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface LibCategory { name: string; icon: any; items: DeviceDef[] }

// Categorized library — mirrors System Surveyor's palette, tuned to GateGuard's kit.
const LIBRARY: LibCategory[] = [
  { name: "Network", icon: Router, items: [
    { key: "gateway", label: "UniFi Gateway", abbr: "GW", color: "#60A5FA", price: 380 },
    { key: "poe_switch", label: "PoE Switch", abbr: "SW", color: "#60A5FA", price: 300 },
    { key: "mesh", label: "Ext. Mesh AP", abbr: "AP", color: "#60A5FA", price: 180 },
    { key: "nanostation", label: "NanoStation", abbr: "NS", color: "#60A5FA", price: 90 },
  ]},
  { name: "Cameras", icon: Camera, items: [
    { key: "dome", label: "Dome Camera", abbr: "CAM", color: "#F59E0B", price: 220, isCam: true },
    { key: "bullet", label: "Bullet Camera", abbr: "CAM", color: "#F59E0B", price: 240, isCam: true },
    { key: "fisheye", label: "Fisheye 360°", abbr: "360", color: "#F59E0B", price: 320, isCam: true },
  ]},
  { name: "Access", icon: Key, items: [
    { key: "door_ctrl", label: "Door Controller", abbr: "DC", color: "#34D399", price: 260 },
    { key: "gate_board", label: "Gate Board", abbr: "GB", color: "#34D399", price: 340 },
    { key: "mag_lock", label: "Mag Lock", abbr: "ML", color: "#34D399", price: 90 },
    { key: "pte", label: "Push-to-Exit", abbr: "PTE", color: "#34D399", price: 40 },
    { key: "intercom", label: "Intercom", abbr: "INT", color: "#A78BFA", price: 900 },
  ]},
  { name: "Power", icon: Bolt, items: [
    { key: "poe_inj", label: "PoE Inserter", abbr: "PoE", color: "#F87171", price: 45 },
    { key: "psu_24v", label: "24V Power", abbr: "24V", color: "#F87171", price: 60 },
  ]},
];
const ALL_DEVICES: Record<string, DeviceDef> = Object.fromEntries(LIBRARY.flatMap(c => c.items).map(d => [d.key, d]));

const DRAWING_TABS: { key: DrawingType; label: string }[] = [
  { key: "floor_plan", label: "Floor plan" },
  { key: "system_design", label: "System design" },
  { key: "as_built", label: "As-built" },
  { key: "estimate", label: "Estimate" },
];

interface PlacedDevice { id: string; key: string; name: string; manufacturer: string; model: string; price: number; qty: number; status: string }

export default function DesignStudioPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [drawingType, setDrawingType] = useState<DrawingType>("system_design");
  const [bgChosen, setBgChosen] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);   // device selected in library to place
  const [query, setQuery] = useState("");
  const [placed, setPlaced] = useState<PlacedDevice[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fcRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricRef = useRef<any>(null);
  const activeKeyRef = useRef<string | null>(null);
  activeKeyRef.current = activeKey;

  const genId = () => `d_${Math.random().toString(36).slice(2, 9)}`;

  // ── Fabric init (SSR-safe, only after a background is chosen) ────────────────
  useEffect(() => {
    if (!mounted || !bgChosen || !canvasElRef.current || fcRef.current) return;
    let disposed = false;
    (async () => {
      const fabric = await import("fabric");
      if (disposed || !canvasElRef.current) return;
      fabricRef.current = fabric;
      const fc = new fabric.Canvas(canvasElRef.current, { backgroundColor: "#0A1020", selection: true, preserveObjectStacking: true });
      const wrap = canvasElRef.current.parentElement;
      fc.setDimensions({ width: wrap?.clientWidth ?? 900, height: wrap?.clientHeight ?? 560 });
      fcRef.current = fc;

      // Place a device where the user clicks when a library item is armed.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fc.on("mouse:down", (opt: any) => {
        const key = activeKeyRef.current;
        if (!key || opt.target) return;
        const p = typeof fc.getScenePoint === "function" ? fc.getScenePoint(opt.e) : (opt.pointer ?? { x: 120, y: 120 });
        placeDevice(key, p.x, p.y);
        setActiveKey(null);
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fc.on("selection:created", (e: any) => setSelectedId(e.selected?.[0]?.data?.id ?? null));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fc.on("selection:updated", (e: any) => setSelectedId(e.selected?.[0]?.data?.id ?? null));
      fc.on("selection:cleared", () => setSelectedId(null));
    })();
    return () => { disposed = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, bgChosen]);

  // ── Background sources ──────────────────────────────────────────────────────
  function startBlank() { setBgChosen(true); }
  async function uploadBackground(file: File) {
    if (!file) return;
    setBgUploading(true);
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file);
      });
      setBgChosen(true);
      // Apply once the canvas exists.
      const apply = () => {
        const fabric = fabricRef.current, fc = fcRef.current;
        if (!fabric || !fc) { setTimeout(apply, 150); return; }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fabric.Image.fromURL(dataUrl).then((img: any) => {
          img.scaleToWidth(fc.getWidth());
          fc.backgroundImage = img;
          fc.requestRenderAll();
        }).catch(() => {});
      };
      apply();
    } catch { /* ignore */ } finally { setBgUploading(false); }
  }

  // ── Place / update / delete devices ─────────────────────────────────────────
  const placeDevice = useCallback((key: string, x: number, y: number) => {
    const fabric = fabricRef.current, fc = fcRef.current, dt = ALL_DEVICES[key];
    if (!fabric || !fc || !dt) return;
    const id = genId();
    const circle = new fabric.Circle({ radius: 18, fill: dt.color + "22", stroke: dt.color, strokeWidth: 2, originX: "center", originY: "center" });
    const abbr = new fabric.Text(dt.abbr, { fontSize: 8, fontWeight: "700", fill: dt.color, originX: "center", originY: "center" });
    const label = new fabric.Text(dt.label, { fontSize: 9, fill: "#cbd5e1", originX: "center", originY: "center", top: 26, backgroundColor: "rgba(11,23,40,0.85)", padding: 2 });
    const group = new fabric.Group([circle, abbr, label], { left: x, top: y, originX: "center", originY: "center", data: { id, type: "device", key } });
    fc.add(group); fc.setActiveObject(group); fc.renderAll();
    setPlaced(prev => [...prev, { id, key, name: dt.label, manufacturer: "", model: "", price: dt.price, qty: 1, status: "proposed" }]);
    setSelectedId(id);
  }, []);

  function updateSelected(patch: Partial<PlacedDevice>) {
    if (!selectedId) return;
    setPlaced(prev => prev.map(d => d.id === selectedId ? { ...d, ...patch } : d));
  }
  function deleteSelected() {
    const fc = fcRef.current; if (!fc || !selectedId) return;
    const obj = fc.getObjects().find((o: { data?: { id?: string } }) => o.data?.id === selectedId);
    if (obj) { fc.remove(obj); fc.renderAll(); }
    setPlaced(prev => prev.filter(d => d.id !== selectedId));
    setSelectedId(null);
  }

  const selected = placed.find(d => d.id === selectedId) ?? null;
  const bomTotal = placed.reduce((s, d) => s + d.price * d.qty, 0);
  const itemCount = placed.reduce((s, d) => s + d.qty, 0);

  if (!mounted) return <div style={{ minHeight: "100dvh", background: BG }} />;

  const pill = (active: boolean) => ({
    fontSize: 11, padding: "4px 11px", borderRadius: 999, cursor: "pointer",
    background: active ? "rgba(107,126,255,0.18)" : "rgba(255,255,255,0.06)",
    color: active ? "#c7d0ff" : MUT, border: active ? "1px solid rgba(107,126,255,0.4)" : "1px solid transparent",
  });

  return (
    <div className="flex flex-col" style={{ height: "100dvh", background: BG, color: TXT }}>
      <TopBar title="Design Studio" subtitle="System diagrams, floor plans, as-builts & estimates" />

      <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: `1px solid ${LINE}`, flexWrap: "wrap" }}>
        <span style={{ color: BRAND }}><LayoutGrid size={15} /></span>
        {DRAWING_TABS.map(t => (
          <button key={t.key} onClick={() => setDrawingType(t.key)} style={pill(drawingType === t.key)}>{t.label}</button>
        ))}
        <span className="ml-auto text-[11px]" style={{ color: MUT }}>{itemCount} items · est. ${bomTotal.toLocaleString()}</span>
      </div>

      {!bgChosen ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 14, padding: 20, width: "min(560px,92vw)" }}>
            <div className="text-sm font-medium mb-1">Start a drawing — pick a background</div>
            <div className="text-[12px] mb-4" style={{ color: MUT }}>You can swap the background later; devices stay put.</div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={startBlank} style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 10, padding: 16, textAlign: "left", cursor: "pointer", color: TXT }}>
                <LayoutGrid size={20} style={{ color: BRAND }} />
                <div className="mt-2 text-sm">Blank canvas</div>
                <div className="text-[11px]" style={{ color: MUT }}>System diagram (Flint River style)</div>
              </button>
              <label style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 10, padding: 16, cursor: "pointer", display: "block" }}>
                {bgUploading ? <Loader2 size={20} className="animate-spin" style={{ color: "#6EE7B7" }} /> : <Upload size={20} style={{ color: "#6EE7B7" }} />}
                <div className="mt-2 text-sm">Upload floor plan</div>
                <div className="text-[11px]" style={{ color: MUT }}>PNG / JPG image</div>
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadBackground(f); e.currentTarget.value = ""; }} />
              </label>
            </div>
            <div className="text-[11px] mt-3" style={{ color: "#64748B" }}>Satellite map & PDF import land in the next pass.</div>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid" style={{ gridTemplateColumns: "180px minmax(0,1fr) 190px", gap: 1, background: LINE, overflow: "hidden" }}>

          {/* Library */}
          <div style={{ background: BG, overflowY: "auto", padding: 10 }}>
            <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 mb-3" style={{ background: CARD, border: `1px solid ${LINE}` }}>
              <Search size={13} style={{ color: MUT }} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find device…" className="bg-transparent text-[12px] outline-none w-full" style={{ color: TXT }} />
            </div>
            {LIBRARY.map(cat => {
              const Icon = cat.icon;
              const items = cat.items.filter(d => d.label.toLowerCase().includes(query.toLowerCase()));
              if (!items.length) return null;
              return (
                <div key={cat.name} className="mb-3">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider mb-1.5" style={{ color: CYAN }}><Icon size={12} /> {cat.name}</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map(d => (
                      <button key={d.key} onClick={() => setActiveKey(activeKey === d.key ? null : d.key)}
                        style={{ background: activeKey === d.key ? "rgba(107,126,255,0.18)" : CARD, border: `1px solid ${activeKey === d.key ? "rgba(107,126,255,0.5)" : LINE}`, borderRadius: 8, padding: "7px 4px", textAlign: "center", cursor: "pointer", color: TXT }}>
                        <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: d.color }} />
                        <div className="text-[10px] mt-1" style={{ color: MUT }}>{d.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Canvas */}
          <div style={{ background: "#0A1020", position: "relative" }}>
            {activeKey && <div className="absolute top-2 left-2 z-10 text-[11px] px-2 py-1 rounded-md" style={{ background: "rgba(107,126,255,0.18)", color: "#c7d0ff", border: "1px solid rgba(107,126,255,0.4)" }}>Click canvas to place: {ALL_DEVICES[activeKey]?.label} · Esc to cancel</div>}
            <canvas ref={canvasElRef} />
          </div>

          {/* Inspector + BOM */}
          <div style={{ background: BG, overflowY: "auto", padding: 10 }}>
            <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: MUT }}>Inspector</div>
            {selected ? (
              <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 10, padding: 8 }}>
                <input value={selected.name} onChange={e => updateSelected({ name: e.target.value })} className="bg-transparent text-[13px] font-medium outline-none w-full mb-2" style={{ color: "#c7d0ff" }} />
                <label className="text-[10px]" style={{ color: MUT }}>Manufacturer</label>
                <input value={selected.manufacturer} onChange={e => updateSelected({ manufacturer: e.target.value })} placeholder="e.g. Eagle Eye" className="w-full text-[12px] rounded px-2 py-1 mb-2 outline-none" style={{ background: PANEL, border: `1px solid ${LINE}`, color: TXT }} />
                <label className="text-[10px]" style={{ color: MUT }}>Model</label>
                <input value={selected.model} onChange={e => updateSelected({ model: e.target.value })} placeholder="e.g. DX01" className="w-full text-[12px] rounded px-2 py-1 mb-2 outline-none" style={{ background: PANEL, border: `1px solid ${LINE}`, color: TXT }} />
                <div className="flex gap-2 mb-2">
                  <div className="flex-1"><label className="text-[10px]" style={{ color: MUT }}>Price</label>
                    <input type="number" value={selected.price} onChange={e => updateSelected({ price: Number(e.target.value) || 0 })} className="w-full text-[12px] rounded px-2 py-1 outline-none" style={{ background: PANEL, border: `1px solid ${LINE}`, color: TXT }} /></div>
                  <div style={{ width: 56 }}><label className="text-[10px]" style={{ color: MUT }}>Qty</label>
                    <input type="number" min={1} value={selected.qty} onChange={e => updateSelected({ qty: Math.max(1, Number(e.target.value) || 1) })} className="w-full text-[12px] rounded px-2 py-1 outline-none" style={{ background: PANEL, border: `1px solid ${LINE}`, color: TXT }} /></div>
                </div>
                <label className="text-[10px]" style={{ color: MUT }}>Status</label>
                <select value={selected.status} onChange={e => updateSelected({ status: e.target.value })} className="w-full text-[12px] rounded px-2 py-1 outline-none capitalize" style={{ background: PANEL, border: `1px solid ${LINE}`, color: TXT }}>
                  <option value="proposed">Proposed</option><option value="installed">Installed</option><option value="existing">Existing</option>
                </select>
                <button onClick={deleteSelected} className="mt-2 text-[11px]" style={{ color: "#FCA5A5" }}><X size={11} className="inline" /> Remove</button>
              </div>
            ) : (
              <div className="text-[12px]" style={{ color: "#64748B" }}>Select a device to edit its details, or pick one from the library and click the canvas.</div>
            )}

            <div className="text-[10px] uppercase tracking-wider mt-4 mb-2" style={{ color: MUT }}>Bill of materials</div>
            {placed.length === 0 ? <div className="text-[12px]" style={{ color: "#64748B" }}>No devices yet.</div> : (
              <>
                {placed.map(d => (
                  <div key={d.id} className="flex justify-between text-[11px]" style={{ color: "#cbd5e1" }}>
                    <span className="truncate">{d.qty}× {d.name}</span><span>${(d.price * d.qty).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between text-[12px] mt-2 pt-2" style={{ borderTop: `1px solid ${LINE}`, color: "#6EE7B7" }}>
                  <span>Est. total</span><span>${bomTotal.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
