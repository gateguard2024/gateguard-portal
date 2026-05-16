"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

// ─── Diagnostic engine types (shared with /tech) ──────────────────────────────
type StepType = "question" | "action" | "resolved" | "escalate";
interface DiagStep {
  type: StepType;
  text: string;
  detail: string | null;
  manual_ref: { url: string | null; page: number | null; section: string | null } | null;
  session_id: string;
}
interface DiagHistory { question: string; answer: string; }

const STEP_COLORS: Record<StepType, { bg: string; border: string; text: string; badge: string }> = {
  question: { bg: "bg-blue-50",   border: "border-blue-200",  text: "text-blue-800",  badge: "bg-blue-100 text-blue-700"  },
  action:   { bg: "bg-amber-50",  border: "border-amber-200", text: "text-amber-800", badge: "bg-amber-100 text-amber-700" },
  resolved: { bg: "bg-emerald-50",border: "border-emerald-200",text:"text-emerald-800",badge:"bg-emerald-100 text-emerald-700"},
  escalate: { bg: "bg-red-50",    border: "border-red-200",   text: "text-red-800",   badge: "bg-red-100 text-red-700"    },
};
import {
  Zap,
  Plus,
  Search,
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
  Globe,
  FileText,
  Package,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { BookOpen, Cpu, DoorOpen, Camera, Headphones, ThumbsUp } = require('lucide-react') as any;

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

  // ── Diagnostic state ────────────────────────────────────────────────────────
  const [diagActive,   setDiagActive]   = useState(false);
  const [diagLoading,  setDiagLoading]  = useState(false);
  const [diagHistory,  setDiagHistory]  = useState<DiagHistory[]>([]);
  const [diagCurrent,  setDiagCurrent]  = useState<DiagStep | null>(null);
  const [diagSession,  setDiagSession]  = useState<string | null>(null);
  const [diagFreeText, setDiagFreeText] = useState("");
  const diagBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { diagBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [diagHistory, diagCurrent]);

  async function runDiagnostic() {
    if (!symptom.trim()) return;
    setDiagActive(true);
    setDiagHistory([]);
    setDiagCurrent(null);
    setDiagSession(null);
    await fetchDiagStep([]);
  }

  async function fetchDiagStep(h: DiagHistory[]) {
    setDiagLoading(true);
    const res = await fetch("/api/kb/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symptom, product_id: undefined, error_code: errorCode || undefined, history: h, session_id: diagSession }),
    });
    const data = await res.json();
    setDiagLoading(false);
    if (data.error) { alert(data.error); return; }
    if (!diagSession && data.session_id) setDiagSession(data.session_id);
    setDiagCurrent(data as DiagStep);
  }

  async function diagAnswer(ans: string) {
    if (!diagCurrent) return;
    const newH: DiagHistory[] = [...diagHistory, { question: diagCurrent.text, answer: ans }];
    setDiagHistory(newH);
    setDiagCurrent(null);
    if (diagCurrent.type === "resolved" || diagCurrent.type === "escalate") return;
    await fetchDiagStep(newH);
  }

  function resetDiag() {
    setDiagActive(false); setDiagHistory([]); setDiagCurrent(null); setDiagSession(null); setDiagFreeText("");
  }

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
              onClick={runDiagnostic}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm",
                symptom || product
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              )}
            >
              <Zap size={14} /> {diagActive ? "Restart Diagnostic" : "Run Diagnostic →"}
            </button>

            {/* ── Live diagnostic results ─────────────────────────────────── */}
            {diagActive && (
              <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600">AI Diagnostic — "{symptom}"</span>
                  <div className="flex items-center gap-2">
                    {diagSession && (
                      <a href={`/tech?session=${diagSession}`} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-blue-500 hover:underline">
                        📱 Open on mobile
                      </a>
                    )}
                    <button onClick={resetDiag} className="text-[10px] text-gray-400 hover:text-gray-600">✕ Clear</button>
                  </div>
                </div>

                <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                  {/* History */}
                  {diagHistory.map((h, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3 bg-white">
                      <p className="text-xs text-gray-600 flex-1">Step {i+1}: {h.question}</p>
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full",
                        h.answer === "Yes" ? "bg-emerald-100 text-emerald-700" : h.answer === "No" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                      )}>{h.answer}</span>
                    </div>
                  ))}

                  {/* Loading */}
                  {diagLoading && (
                    <div className="px-4 py-3 flex items-center gap-2 bg-white">
                      <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                      <p className="text-xs text-gray-400">Searching manuals…</p>
                    </div>
                  )}

                  {/* Current step */}
                  {diagCurrent && !diagLoading && (() => {
                    const cfg = STEP_COLORS[diagCurrent.type];
                    return (
                      <div className={cn("px-4 py-3", cfg.bg)}>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className={cn("text-[10px] font-bold uppercase tracking-widest", cfg.text)}>
                            {diagCurrent.type}
                          </span>
                          {diagCurrent.manual_ref?.url && (
                            <a href={`${diagCurrent.manual_ref.url}${diagCurrent.manual_ref.page ? `#page=${diagCurrent.manual_ref.page}` : ""}`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-[10px] text-blue-500 hover:underline flex-shrink-0">
                              📄 p.{diagCurrent.manual_ref.page}
                            </a>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-gray-900 mb-1">{diagCurrent.text}</p>
                        {diagCurrent.detail && <p className="text-xs text-gray-600 mb-2">{diagCurrent.detail}</p>}

                        {diagCurrent.type === "question" && (
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => diagAnswer("Yes")} className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors">Yes</button>
                            <button onClick={() => diagAnswer("No")}  className="flex-1 py-1.5 rounded-lg bg-red-500    text-white text-xs font-semibold hover:bg-red-600    transition-colors">No</button>
                          </div>
                        )}
                        {diagCurrent.type === "action" && (
                          <div className="flex gap-2 mt-2">
                            <input type="text" value={diagFreeText} onChange={e => setDiagFreeText(e.target.value)}
                              placeholder="What do you observe?" className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-400" />
                            <button onClick={() => diagAnswer("Done")} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold">Done</button>
                            <button onClick={() => { if (diagFreeText.trim()) { diagAnswer(diagFreeText); setDiagFreeText(""); }}} className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-semibold">→</button>
                          </div>
                        )}
                        {(diagCurrent.type === "resolved" || diagCurrent.type === "escalate") && (
                          <div className="flex gap-2 mt-2">
                            <button onClick={resetDiag} className="flex-1 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-300">New Session</button>
                            {diagCurrent.type === "escalate" && <button onClick={() => diagAnswer("Continue")} className="flex-1 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs font-semibold">Keep Going</button>}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div ref={diagBottomRef} />
              </div>
            )}
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
