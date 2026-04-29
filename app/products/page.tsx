"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TopBar } from "@/components/layout/TopBar";
import {
  Plus,
  Search,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Filter,
  Eye,
  Download,
  Edit2,
  Package,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Camera,
  Shield,
  Wifi,
  DoorOpen,
  Cpu,
  Zap,
  Grid3X3,
  Star,
  ExternalLink,
  ArrowUpRight,
  Circle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Distributor = "ADI Global" | "Anixter" | "GG Direct" | "Custom";
type CategoryKey = string;

interface Product {
  id: string;
  manufacturer: string;
  model: string;
  partNumber: string;
  description: string;
  distributor: Distributor;
  cost: number;
  sellPrice: number;
  msrp: number;
  specs: {
    resolution: string;
    lens: string;
    irRange: string;
    ipRating: string;
  };
  category: string;
}

interface CategoryNode {
  label: string;
  icon?: React.ElementType;
  children?: CategoryNode[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const PRODUCTS: Product[] = [
  {
    id: "p01",
    manufacturer: "EagleEye",
    model: "4MP Dome Camera",
    partNumber: "EE-4MP-DOME",
    description: "Indoor/outdoor 4MP dome with true WDR and IR night vision up to 30m.",
    distributor: "ADI Global",
    cost: 187,
    sellPrice: 349,
    msrp: 399,
    specs: { resolution: "4MP (2688×1520)", lens: "2.8mm fixed", irRange: "30m", ipRating: "IP67" },
    category: "Dome Cameras",
  },
  {
    id: "p02",
    manufacturer: "EagleEye",
    model: "8MP Turret",
    partNumber: "EE-8MP-TURRET",
    description: "8MP turret/eyeball camera, H.265+, smart motion detection, PoE.",
    distributor: "ADI Global",
    cost: 245,
    sellPrice: 449,
    msrp: 499,
    specs: { resolution: "8MP (3840×2160)", lens: "2.8mm fixed", irRange: "40m", ipRating: "IP67" },
    category: "Dome Cameras",
  },
  {
    id: "p03",
    manufacturer: "Hikvision",
    model: "4MP AcuSense Dome",
    partNumber: "DS-2CD2143G2-I",
    description: "AcuSense false-alarm reduction with deep learning, strobe alarm, 4MP.",
    distributor: "Anixter",
    cost: 98,
    sellPrice: 199,
    msrp: 249,
    specs: { resolution: "4MP (2688×1520)", lens: "2.8mm fixed", irRange: "40m", ipRating: "IP67" },
    category: "Dome Cameras",
  },
  {
    id: "p04",
    manufacturer: "Avigilon",
    model: "5MP H6SL Dome",
    partNumber: "H6SL-DO1-IR",
    description: "Avigilon H6SL 5MP self-learning analytics dome, tamper detection.",
    distributor: "ADI Global",
    cost: 312,
    sellPrice: 549,
    msrp: 629,
    specs: { resolution: "5MP (2592×1944)", lens: "3–9mm varifocal", irRange: "35m", ipRating: "IP66" },
    category: "Dome Cameras",
  },
  {
    id: "p05",
    manufacturer: "Hanwha",
    model: "5MP IR Dome",
    partNumber: "QNV-8080R",
    description: "5MP outdoor vandal dome, WDR 120dB, H.265, IR 30m.",
    distributor: "ADI Global",
    cost: 178,
    sellPrice: 289,
    msrp: 329,
    specs: { resolution: "5MP (2560×1920)", lens: "2.8mm fixed", irRange: "30m", ipRating: "IP66" },
    category: "Dome Cameras",
  },
  {
    id: "p06",
    manufacturer: "Bosch",
    model: "5MP Dome",
    partNumber: "NDE-5503-AL",
    description: "Bosch FLEXIDOME 5MP starlight, built-in IVA, Essential Video Analytics.",
    distributor: "Anixter",
    cost: 267,
    sellPrice: 399,
    msrp: 459,
    specs: { resolution: "5MP (2592×1944)", lens: "3–10mm motorized", irRange: "40m", ipRating: "IP66" },
    category: "Dome Cameras",
  },
  {
    id: "p07",
    manufacturer: "Axis",
    model: "M3106-L Mk II",
    partNumber: "01756-001",
    description: "AXIS M3106-L Mk II 4MP multi-view fixed mini dome, 360° view.",
    distributor: "ADI Global",
    cost: 345,
    sellPrice: 499,
    msrp: 569,
    specs: { resolution: "4MP (2304×1536)", lens: "2.8mm fixed", irRange: "15m", ipRating: "IP42" },
    category: "Dome Cameras",
  },
  {
    id: "p08",
    manufacturer: "Dahua",
    model: "4MP WizSense Dome",
    partNumber: "IPC-HDW2849H-S-IL",
    description: "WizSense dual-light IR+warm light, SMD 3.0, H.265+, IP67.",
    distributor: "GG Direct",
    cost: 67,
    sellPrice: 169,
    msrp: 199,
    specs: { resolution: "4MP (2688×1520)", lens: "2.8mm fixed", irRange: "30m", ipRating: "IP67" },
    category: "Dome Cameras",
  },
  {
    id: "p09",
    manufacturer: "GeoVision",
    model: "4MP IR Dome",
    partNumber: "GV-EFD4700-0F",
    description: "GeoVision 4MP H.265 IR fixed dome, 2.8mm lens, IK10 vandal-proof.",
    distributor: "Custom",
    cost: 124,
    sellPrice: 179,
    msrp: 219,
    specs: { resolution: "4MP (2688×1520)", lens: "2.8mm fixed", irRange: "30m", ipRating: "IP66" },
    category: "Dome Cameras",
  },
  {
    id: "p10",
    manufacturer: "Uniview",
    model: "4MP LightHunter Dome",
    partNumber: "IPC3614SB-ADF28KM",
    description: "LightHunter ultra-low light, smart detection, H.265, motorized lens.",
    distributor: "Anixter",
    cost: 145,
    sellPrice: 249,
    msrp: 299,
    specs: { resolution: "4MP (2688×1520)", lens: "2.8–12mm motorized", irRange: "50m", ipRating: "IP67" },
    category: "Dome Cameras",
  },
  {
    id: "p11",
    manufacturer: "Sony",
    model: "4K Dome",
    partNumber: "SNC-EM641",
    description: "Sony 4K IPELA EP indoor mini dome, XDNR noise reduction, exmor sensor.",
    distributor: "ADI Global",
    cost: 489,
    sellPrice: 749,
    msrp: 849,
    specs: { resolution: "4K (3840×2160)", lens: "2.8mm fixed", irRange: "—", ipRating: "IP40" },
    category: "Dome Cameras",
  },
  {
    id: "p12",
    manufacturer: "EagleEye",
    model: "4MP Mini Dome",
    partNumber: "EE-4MP-MINI",
    description: "Compact 4MP mini dome, perfect for tight corridors, PoE, H.265+.",
    distributor: "GG Direct",
    cost: 156,
    sellPrice: 299,
    msrp: 349,
    specs: { resolution: "4MP (2688×1520)", lens: "1.68mm fixed", irRange: "20m", ipRating: "IP66" },
    category: "Dome Cameras",
  },
];

const RELATED: Product[] = [PRODUCTS[1], PRODUCTS[2], PRODUCTS[4]];

const CATEGORIES: CategoryNode[] = [
  { label: "All Products", icon: Grid3X3 },
  {
    label: "Cameras", icon: Camera, children: [
      { label: "Dome Cameras" },
      { label: "Turret / Eyeball" },
      { label: "Bullet Cameras" },
      { label: "PTZ Cameras" },
      { label: "Fisheye / 360°" },
    ],
  },
  {
    label: "Access Control", icon: Shield, children: [
      { label: "Door Controllers" },
      { label: "Card Readers" },
      { label: "Credentials" },
      { label: "REX Devices" },
    ],
  },
  {
    label: "Gate Systems", icon: DoorOpen, children: [
      { label: "Slide Gate Operators" },
      { label: "Swing Gate Operators" },
      { label: "Gate Controllers" },
      { label: "Safety Edges & Loops" },
    ],
  },
  {
    label: "Networking", icon: Wifi, children: [
      { label: "Managed Switches" },
      { label: "PoE Switches" },
      { label: "Wireless APs" },
      { label: "Firewalls / Routers" },
      { label: "Fiber & Cabling" },
    ],
  },
  {
    label: "Power", icon: Zap, children: [
      { label: "UPS / Battery Backup" },
      { label: "Power Supplies" },
      { label: "Surge Protection" },
    ],
  },
  {
    label: "Labor", icon: Cpu, children: [
      { label: "Standard Install Labor" },
      { label: "Premium Labor" },
      { label: "Travel / Mileage" },
    ],
  },
  { label: "Custom", icon: Star },
];

const DISTRIBUTORS = ["All Distributors", "ADI Global", "Anixter", "GG Direct", "Custom"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcMargin(cost: number, sell: number): number {
  return Math.round(((sell - cost) / sell) * 100);
}

function marginColor(pct: number): string {
  if (pct < 20) return "text-red-600 bg-red-50";
  if (pct < 35) return "text-amber-600 bg-amber-50";
  return "text-emerald-600 bg-emerald-50";
}

function distributorBadge(d: Distributor): string {
  const map: Record<Distributor, string> = {
    "ADI Global": "bg-blue-50 text-blue-700",
    "Anixter": "bg-violet-50 text-violet-700",
    "GG Direct": "bg-teal-50 text-teal-700",
    "Custom": "bg-slate-100 text-slate-600",
  };
  return map[d];
}

function formatDollar(n: number) {
  return `$${n.toLocaleString()}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  accent: "default" | "green" | "blue" | "amber";
  icon: React.ElementType;
}) {
  const iconColor = {
    default: "text-slate-500 bg-slate-100",
    green: "text-emerald-600 bg-emerald-50",
    blue: "text-blue-600 bg-blue-50",
    amber: "text-amber-600 bg-amber-50",
  }[accent];
  const valueColor = {
    default: "text-foreground",
    green: "text-emerald-600",
    blue: "text-blue-600",
    amber: "text-amber-600",
  }[accent];
  return (
    <div className="bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-3 flex-1">
      <div className={cn("p-2 rounded-lg", iconColor)}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-lg font-bold leading-tight", valueColor)}>{value}</p>
      </div>
    </div>
  );
}

// ─── Left Sidebar — Category Tree ─────────────────────────────────────────────

function CategoryTree({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (label: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["Cameras"]));

  function toggle(label: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  return (
    <nav className="space-y-0.5">
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const isExpanded = expanded.has(cat.label);
        const hasChildren = !!cat.children?.length;

        return (
          <div key={cat.label}>
            <button
              onClick={() => {
                if (hasChildren) toggle(cat.label);
                onSelect(cat.label);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                selected === cat.label
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-slate-50"
              )}
            >
              {Icon && <Icon size={14} className="shrink-0" />}
              <span className="flex-1 truncate">{cat.label}</span>
              {hasChildren && (
                isExpanded
                  ? <ChevronDown size={12} className="shrink-0" />
                  : <ChevronRight size={12} className="shrink-0" />
              )}
            </button>

            {hasChildren && isExpanded && (
              <div className="ml-5 mt-0.5 space-y-0.5">
                {cat.children!.map((child) => (
                  <button
                    key={child.label}
                    onClick={() => onSelect(child.label)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors text-left",
                      selected === child.label
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-slate-50"
                    )}
                  >
                    <Circle size={5} className="shrink-0 fill-current" />
                    {child.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ─── Middle — Product List ────────────────────────────────────────────────────

function ProductList({
  products,
  selected,
  onSelect,
}: {
  products: Product[];
  selected: Product | null;
  onSelect: (p: Product) => void;
}) {
  const [search, setSearch] = useState("");
  const [distributor, setDistributor] = useState("All Distributors");
  const [editingPrice, setEditingPrice] = useState<Record<string, string>>({});

  const filtered = products.filter((p) => {
    const matchSearch =
      search === "" ||
      p.model.toLowerCase().includes(search.toLowerCase()) ||
      p.partNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.manufacturer.toLowerCase().includes(search.toLowerCase());
    const matchDist = distributor === "All Distributors" || p.distributor === distributor;
    return matchSearch && matchDist;
  });

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="text"
            placeholder="Search products, model, part #..."
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        <div className="relative">
          <select
            value={distributor}
            onChange={(e) => setDistributor(e.target.value)}
            className="appearance-none pl-3 pr-7 py-1.5 text-sm bg-slate-50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
          >
            {DISTRIBUTORS.map((d) => <option key={d}>{d}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-slate-50 transition-colors">
          <Filter size={12} /> Filter
        </button>
      </div>

      {/* Category label */}
      <div className="px-4 py-2 border-b border-border bg-slate-50/50">
        <p className="text-xs text-muted-foreground">
          Cameras &rsaquo; Dome Cameras
          <span className="ml-2 font-medium text-foreground">{filtered.length} products</span>
        </p>
      </div>

      {/* Product rows */}
      <div className="overflow-y-auto flex-1 divide-y divide-border">
        {filtered.map((p) => {
          const margin = calcMargin(p.cost, p.sellPrice);
          const currentSell = editingPrice[p.id] ?? String(p.sellPrice);
          const isSelected = selected?.id === p.id;

          return (
            <div
              key={p.id}
              onClick={() => onSelect(p)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
                isSelected ? "bg-blue-50 border-l-2 border-l-blue-600" : "hover:bg-slate-50/70 border-l-2 border-l-transparent"
              )}
            >
              {/* Image placeholder */}
              <div className="w-10 h-10 rounded-lg bg-slate-100 border border-border flex items-center justify-center shrink-0">
                <Camera size={16} className="text-slate-400" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-foreground truncate">{p.manufacturer} {p.model}</span>
                  <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", distributorBadge(p.distributor))}>
                    {p.distributor}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{p.partNumber} · {p.description}</p>
              </div>

              {/* Pricing */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Cost</p>
                  <p className="text-sm font-medium text-foreground">{formatDollar(p.cost)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Sell</p>
                  <input
                    value={currentSell}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setEditingPrice((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    className="w-16 text-right text-sm font-semibold text-foreground border border-border rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  />
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">Margin</p>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold", marginColor(margin))}>
                    {margin}%
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); }}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  Add to Quote
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); }}
                  className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors"
                >
                  <Eye size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Right Sidebar — Product Detail ──────────────────────────────────────────

function ProductDetail({ product }: { product: Product }) {
  const [sellPrice, setSellPrice] = useState(String(product.sellPrice));
  const margin = calcMargin(product.cost, Number(sellPrice) || product.sellPrice);

  // Price history mock data (last 6 months)
  const priceHistory = [187, 192, 185, 190, 188, 187];
  const maxPrice = Math.max(...priceHistory);
  const minPrice = Math.min(...priceHistory);
  const months = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        {/* Product image */}
        <div className="w-full aspect-video bg-slate-100 rounded-xl flex items-center justify-center mb-3 border border-border">
          <Camera size={40} className="text-slate-300" />
        </div>
        <h3 className="text-sm font-bold text-foreground leading-tight mb-1">
          {product.manufacturer} {product.model}
        </h3>
        <p className="text-xs text-muted-foreground font-mono">{product.partNumber}</p>
      </div>

      <div className="overflow-y-auto flex-1 p-4 space-y-4">
        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed">{product.description}</p>

        {/* Key Specs */}
        <div>
          <p className="text-xs font-semibold text-foreground mb-2">Key Specifications</p>
          <div className="space-y-1.5">
            {[
              { label: "Resolution", value: product.specs.resolution },
              { label: "Lens", value: product.specs.lens },
              { label: "IR Range", value: product.specs.irRange },
              { label: "IP Rating", value: product.specs.ipRating },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-xs font-medium text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-slate-50 rounded-xl p-3 border border-border">
          <p className="text-xs font-semibold text-foreground mb-2.5">Pricing</p>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Distributor Cost</span>
              <div className="text-right">
                <span className="text-sm font-bold text-foreground">{formatDollar(product.cost)}</span>
                <p className="text-[10px] text-muted-foreground">Updated Apr 27</p>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Your Sell Price</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">$</span>
                <input
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  className="w-16 text-right text-sm font-bold text-foreground border border-border rounded-md px-1.5 py-0.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Margin</span>
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold", marginColor(margin))}>
                {margin}%
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">MSRP</span>
              <span className="text-xs font-medium text-muted-foreground line-through">{formatDollar(product.msrp)}</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
          Add to Quote
        </button>

        <button className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-slate-50 transition-colors">
          <ExternalLink size={13} /> View Full Specs PDF
        </button>

        {/* Price history */}
        <div>
          <p className="text-xs font-semibold text-foreground mb-2">Dealer Cost — Last 6 Months</p>
          <div className="bg-slate-50 border border-border rounded-xl p-3">
            <div className="flex items-end justify-between gap-1 h-12">
              {priceHistory.map((price, i) => {
                const heightPct = ((price - minPrice) / (maxPrice - minPrice + 1)) * 100;
                const barH = Math.max(20, heightPct);
                return (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className="w-full rounded-t-sm bg-blue-200"
                      style={{ height: `${barH}%` }}
                    />
                    <span className="text-[9px] text-muted-foreground">{months[i]}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-muted-foreground">Low: {formatDollar(minPrice)}</span>
              <span className="text-[10px] text-muted-foreground">High: {formatDollar(maxPrice)}</span>
            </div>
          </div>
        </div>

        {/* Related products */}
        <div>
          <p className="text-xs font-semibold text-foreground mb-2">Related Products</p>
          <div className="space-y-2">
            {RELATED.filter((r) => r.id !== product.id).slice(0, 3).map((r) => {
              const m = calcMargin(r.cost, r.sellPrice);
              return (
                <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-slate-50 cursor-pointer transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Camera size={12} className="text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{r.manufacturer} {r.model}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDollar(r.cost)} cost</p>
                  </div>
                  <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-bold", marginColor(m))}>
                    {m}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [selectedCategory, setSelectedCategory] = useState("Dome Cameras");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(PRODUCTS[0]);

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Product Catalog"
        actions={
          <>
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-slate-50 transition-colors">
              <RefreshCw size={14} /> Sync Pricing
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
              <Plus size={15} /> Add Custom Product
            </button>
          </>
        }
      />

      <div className="flex-1 p-6 space-y-5 flex flex-col min-h-0">
        {/* Stats */}
        <div className="flex gap-3">
          <StatCard label="Total Products" value="2,847" accent="default" icon={Package} />
          <StatCard label="Custom Products" value="34" accent="blue" icon={Star} />
          <StatCard label="Last Sync" value="2h ago" accent="green" icon={RefreshCw} />
          <StatCard label="Pending Price Updates" value="12" accent="amber" icon={AlertTriangle} />
        </div>

        {/* 3-column layout */}
        <div className="flex gap-4 flex-1 min-h-0" style={{ height: "calc(100vh - 260px)" }}>
          {/* Left — category tree */}
          <div className="w-48 shrink-0 bg-white border border-border rounded-xl p-3 overflow-y-auto">
            <CategoryTree selected={selectedCategory} onSelect={setSelectedCategory} />
          </div>

          {/* Middle — product list */}
          <div className="flex-[55] min-w-0">
            <ProductList
              products={PRODUCTS}
              selected={selectedProduct}
              onSelect={setSelectedProduct}
            />
          </div>

          {/* Right — detail panel */}
          <div className="w-64 shrink-0">
            {selectedProduct ? (
              <ProductDetail product={selectedProduct} />
            ) : (
              <div className="bg-white border border-border rounded-xl h-full flex flex-col items-center justify-center gap-3 text-center p-6">
                <Camera size={32} className="text-slate-300" />
                <p className="text-sm text-muted-foreground">Select a product to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
