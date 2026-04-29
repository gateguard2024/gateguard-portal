"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Zap,
  Plus,
  Search,
  BookOpen,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Star,
  ArrowRight,
  User,
  Hash,
  Activity,
  Wifi,
  Shield,
  Cpu,
  DoorOpen,
  Camera,
  Globe,
  Headphones,
  FileText,
  Package,
  ThumbsUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Article {
  id: string;
  title: string;
  description: string;
  product: string;
  difficulty: "Basic" | "Intermediate" | "Advanced" | "Installation";
  helpful: number;
}

interface Category {
  id: string;
  label: string;
  count: number;
  Icon: React.ElementType;
}

interface RecentSearch {
  query: string;
  tech: string;
  ago: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  { id: "gate",        label: "Gate Systems",            count: 34, Icon: Shield      },
  { id: "camera",      label: "Camera Systems",          count: 28, Icon: Camera      },
  { id: "access",      label: "Access Control",          count: 22, Icon: DoorOpen    },
  { id: "network",     label: "Networking & Connectivity", count: 18, Icon: Wifi      },
  { id: "power",       label: "Power & Wiring",          count: 16, Icon: Zap         },
  { id: "app",         label: "Mobile App & Cloud",      count: 14, Icon: Globe       },
  { id: "install",     label: "Installation Guides",     count: 12, Icon: Package     },
  { id: "warranty",    label: "Warranty & RMA",          count: 4,  Icon: FileText    },
];

const ARTICLES_BY_CATEGORY: Record<string, Article[]> = {
  gate: [
    {
      id: "a1",
      title: "BX-10 Controller: Gate won't open after power cycle",
      description: "Check capacitor bank and safety loop continuity",
      product: "BX-10",
      difficulty: "Intermediate",
      helpful: 47,
    },
    {
      id: "a2",
      title: "Diagnosing obstruction sensor faults on slide gates",
      description: "E3 error code step-by-step resolution with test points",
      product: "BX-20",
      difficulty: "Advanced",
      helpful: 38,
    },
    {
      id: "a3",
      title: "LiftMaster LA400 installation guide",
      description: "Full install from mounting to limit switch calibration",
      product: "LiftMaster",
      difficulty: "Installation",
      helpful: 29,
    },
    {
      id: "a4",
      title: "Gate opens but won't close — safety edge troubleshooting",
      description: "Identify and test pneumatic vs resistive safety edges",
      product: "All Gates",
      difficulty: "Intermediate",
      helpful: 24,
    },
    {
      id: "a5",
      title: "Setting gate open/close limits on BX-series controllers",
      description: "Limit switch adjustment procedure with expected travel times",
      product: "BX-10/BX-20",
      difficulty: "Basic",
      helpful: 31,
    },
    {
      id: "a6",
      title: "Emergency release and manual override procedures",
      description: "For lockouts and power failures",
      product: "All Gates",
      difficulty: "Basic",
      helpful: 56,
    },
    {
      id: "a7",
      title: "Gate intercom pairing with EagleEye camera",
      description: "Link the entry camera to the gate trigger for auto-recording on open",
      product: "BX-series + EagleEye",
      difficulty: "Intermediate",
      helpful: 19,
    },
    {
      id: "a8",
      title: "Annual preventive maintenance checklist — gate systems",
      description: "12-point PM inspection with sign-off fields",
      product: "All Gates",
      difficulty: "Basic",
      helpful: 44,
    },
  ],
  camera: [
    {
      id: "c1",
      title: "EagleEye 4MP Dome — initial setup and NVR pairing",
      description: "Network discovery, IP assignment, and stream configuration",
      product: "EagleEye 4MP",
      difficulty: "Basic",
      helpful: 62,
    },
    {
      id: "c2",
      title: "Camera offline after rain — moisture ingress checklist",
      description: "Diagnose connector sealing, conduit, and IP rating issues",
      product: "All Cameras",
      difficulty: "Intermediate",
      helpful: 41,
    },
  ],
};

const PRODUCTS = [
  "EagleEye 4MP Dome",
  "EagleEye 8MP Turret",
  "BX-10 Gate Controller",
  "BX-20 Slide Gate",
  "GG-NVR-8",
  "Brivo Door Reader",
  "HID Credential",
  "LiftMaster Gate Operator",
];

const RECENT_SEARCHES: RecentSearch[] = [
  { query: "camera offline after rain",   tech: "Danny Cruz",  ago: "2h ago"   },
  { query: "gate E3 error",              tech: "Marcus Webb", ago: "4h ago"   },
  { query: "brivo reader flashing red",  tech: "Danny Cruz",  ago: "Yesterday" },
  { query: "nvr not recording motion",   tech: "RF",          ago: "Yesterday" },
  { query: "gate slows down before close", tech: "Danny Cruz", ago: "2d ago"  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function difficultyBadge(difficulty: Article["difficulty"]) {
  const map: Record<Article["difficulty"], string> = {
    "Basic":        "bg-emerald-100 text-emerald-700",
    "Intermediate": "bg-amber-100   text-amber-700",
    "Advanced":     "bg-red-100     text-red-700",
    "Installation": "bg-purple-100  text-purple-700",
  };
  return map[difficulty];
}

function techInitials(name: string) {
  if (name === "RF") return "RF";
  const parts = name.split(" ");
  return parts.map((p) => p[0]).join("").toUpperCase();
}

function techColor(name: string) {
  const colors: Record<string, string> = {
    "Danny Cruz":  "bg-blue-100 text-blue-700",
    "Marcus Webb": "bg-purple-100 text-purple-700",
    "RF":          "bg-slate-100 text-slate-700",
  };
  return colors[name] ?? "bg-gray-100 text-gray-700";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KBPage() {
  const [selectedCategory, setSelectedCategory] = useState("gate");
  const [symptom, setSymptom]  = useState("");
  const [product, setProduct]  = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [activeChip, setActiveChip] = useState<string | null>(null);

  const QUICK_CHIPS = [
    "Gate won't open",
    "Camera offline",
    "No video feed",
    "Access denied",
    "Power issue",
    "App not connecting",
  ];

  const articles = ARTICLES_BY_CATEGORY[selectedCategory] ?? [];
  const selectedCat = CATEGORIES.find((c) => c.id === selectedCategory);

  const handleChip = (chip: string) => {
    setSymptom(chip);
    setActiveChip(chip);
  };

  return (
    <div className="flex flex-col min-h-full bg-gray-50">

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Knowledge Base</h1>
          <p className="text-sm text-gray-500 mt-0.5">Find answers fast. Guided diagnostics for every product.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Plus size={14} /> Add Article
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
            <Zap size={14} /> Ask AI
          </button>
        </div>
      </div>

      {/* ── Stats Row ────────────────────────────────────────────────────────── */}
      <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center gap-6">
        {[
          { label: "Articles",            value: "148", sub: "in library",           valueClass: "text-gray-900"   },
          { label: "Products Covered",    value: "24",  sub: "product lines",        valueClass: "text-gray-900"   },
          { label: "Avg Resolution Time", value: "8 min", sub: "with diagnostics",   valueClass: "text-emerald-600" },
          { label: "Open Issues",         value: "3",   sub: "pending resolution",   valueClass: "text-amber-600"  },
        ].map(({ label, value, sub, valueClass }, i) => (
          <div key={label} className="flex items-baseline gap-2">
            <span className={cn("text-2xl font-semibold tabular-nums", valueClass)}>{value}</span>
            <div>
              <p className="text-xs font-medium text-gray-700 leading-none">{label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
            </div>
            {i < 3 && <div className="h-6 w-px bg-gray-200 ml-2" />}
          </div>
        ))}
      </div>

      {/* ── Page Body ────────────────────────────────────────────────────────── */}
      <div className="flex-1 p-6 space-y-5 overflow-y-auto">

        {/* ── AI Diagnostic Card ───────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Start a Diagnostic</h2>
              <p className="text-xs text-gray-500">Three steps to a guided resolution path</p>
            </div>
          </div>

          <div className="p-5 space-y-5">

            {/* Step 1 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                <label className="text-sm font-medium text-gray-800">What's the symptom?</label>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={symptom}
                  onChange={(e) => { setSymptom(e.target.value); setActiveChip(null); }}
                  placeholder="e.g. Gate won't open, Camera offline, No video feed..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-gray-50"
                />
              </div>
              <div className="flex flex-wrap gap-2 mt-2.5">
                {QUICK_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleChip(chip)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                      activeChip === chip
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-gray-200 text-gray-600 bg-white hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50"
                    )}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Step 2 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                  <label className="text-sm font-medium text-gray-800">Select the product</label>
                </div>
                <select
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-gray-50 text-gray-700"
                >
                  <option value="">Select a product...</option>
                  {PRODUCTS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Step 3 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-gray-300 text-white text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                  <label className="text-sm font-medium text-gray-800">Any error codes? <span className="font-normal text-gray-400">(optional)</span></label>
                </div>
                <input
                  type="text"
                  value={errorCode}
                  onChange={(e) => setErrorCode(e.target.value)}
                  placeholder="e.g. E3, ERR-04, FAULT-12..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-gray-50"
                />
              </div>
            </div>

            <button
              className={cn(
                "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm",
                symptom || product
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              )}
            >
              <Zap size={14} /> Run Diagnostic →
            </button>
          </div>
        </div>

        {/* ── Article Library ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-12 gap-4">

          {/* Left — Categories */}
          <div className="col-span-3">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Categories</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {CATEGORIES.map(({ id, label, count, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setSelectedCategory(id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors group",
                      selectedCategory === id
                        ? "bg-blue-50 border-r-2 border-r-blue-600"
                        : "hover:bg-gray-50"
                    )}
                  >
                    <Icon
                      size={14}
                      className={cn(
                        "shrink-0",
                        selectedCategory === id ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
                      )}
                    />
                    <span className={cn(
                      "flex-1 text-sm truncate",
                      selectedCategory === id ? "font-semibold text-blue-700" : "text-gray-700"
                    )}>
                      {label}
                    </span>
                    <span className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                      selectedCategory === id ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                    )}>
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Middle — Articles */}
          <div className="col-span-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">{selectedCat?.label}</h3>
                  <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
                    {articles.length} articles
                  </span>
                </div>
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50 w-36"
                  />
                </div>
              </div>

              {articles.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-gray-400">
                  <BookOpen size={32} className="mb-3 opacity-30" />
                  <p className="text-sm">No articles in this category yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {articles.map((article) => (
                    <div key={article.id} className="px-4 py-3.5 hover:bg-gray-50/50 transition-colors group">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700 transition-colors leading-snug">
                            {article.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{article.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="flex items-center gap-1 text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                              <Hash size={8} /> {article.product}
                            </span>
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded font-medium",
                              difficultyBadge(article.difficulty)
                            )}>
                              {article.difficulty}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-gray-400 ml-1">
                              <Star size={9} className="text-amber-400 fill-amber-400" />
                              {article.helpful} helpful
                            </span>
                          </div>
                        </div>
                        <button className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all">
                          Read <ArrowRight size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right — Recent Searches */}
          <div className="col-span-3">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recent Searches</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {RECENT_SEARCHES.map((item, i) => (
                  <button
                    key={i}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors group"
                    onClick={() => setSymptom(item.query)}
                  >
                    <p className="text-xs font-medium text-gray-800 group-hover:text-blue-700 transition-colors leading-snug">
                      "{item.query}"
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={cn(
                        "inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold shrink-0",
                        techColor(item.tech)
                      )}>
                        {techInitials(item.tech)}
                      </span>
                      <span className="text-[10px] text-gray-500">{item.tech}</span>
                      <span className="text-[10px] text-gray-300">·</span>
                      <span className="text-[10px] text-gray-400">{item.ago}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Stats footer */}
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 space-y-2">
                <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">This Week</h3>
                {[
                  { label: "Diagnostics run",  value: "47", color: "text-blue-600"    },
                  { label: "Issues resolved",  value: "39", color: "text-emerald-600" },
                  { label: "Avg time to fix",  value: "8m", color: "text-gray-700"    },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{label}</span>
                    <span className={cn("text-xs font-semibold tabular-nums", color)}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
