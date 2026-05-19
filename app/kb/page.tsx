"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
  X,
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

interface ArticleProduct {
  id: string;
  name: string;
  sku: string;
}

interface Article {
  id: string;
  title: string;
  description: string;
  content?: string;
  category: string;
  difficulty: "Basic" | "Intermediate" | "Advanced" | "Installation";
  helpful_count: number;
  author?: string;
  product_id?: string;
  created_at?: string;
  updated_at?: string;
  products?: ArticleProduct | null;
}

interface CategoryCount {
  category: string;
  count: number;
}

interface CategoryDef {
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

// ─── Category constants ───────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  'Gate Systems',
  'Camera Systems',
  'Access Control',
  'Networking & Connectivity',
  'Power & Wiring',
  'Mobile App & Cloud',
  'Installation Guides',
  'Warranty & RMA',
  'General',
]

// Map DB category labels → sidebar icon + id
const CATEGORY_ICON_MAP: Record<string, { id: string; Icon: React.ElementType }> = {
  'Gate Systems':             { id: 'gate',     Icon: Shield   },
  'Camera Systems':           { id: 'camera',   Icon: Camera   },
  'Access Control':           { id: 'access',   Icon: DoorOpen },
  'Networking & Connectivity':{ id: 'network',  Icon: Wifi     },
  'Power & Wiring':           { id: 'power',    Icon: Zap      },
  'Mobile App & Cloud':       { id: 'app',      Icon: Globe    },
  'Installation Guides':      { id: 'install',  Icon: Package  },
  'Warranty & RMA':           { id: 'warranty', Icon: FileText },
  'General':                  { id: 'general',  Icon: BookOpen },
}

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

function formatDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Static fallbacks ────────────────────────────────────────────────────────

const RECENT_SEARCHES: RecentSearch[] = [
  { query: "camera offline after rain",   tech: "Danny Cruz",  ago: "2h ago"   },
  { query: "gate E3 error",              tech: "Marcus Webb", ago: "4h ago"   },
  { query: "brivo reader flashing red",  tech: "Danny Cruz",  ago: "Yesterday" },
  { query: "nvr not recording motion",   tech: "RF",          ago: "Yesterday" },
  { query: "gate slows down before close", tech: "Danny Cruz", ago: "2d ago"  },
];

// ─── New Article Form ─────────────────────────────────────────────────────────

interface NewArticleFormProps {
  onClose: () => void;
  onCreated: (article: Article) => void;
}

function NewArticleForm({ onClose, onCreated }: NewArticleFormProps) {
  const [title, setTitle]           = useState('');
  const [description, setDesc]      = useState('');
  const [content, setContent]       = useState('');
  const [category, setCategory]     = useState(CATEGORY_OPTIONS[0]);
  const [difficulty, setDifficulty] = useState<Article['difficulty']>('Basic');
  const [author, setAuthor]         = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProductName, setSelectedProductName] = useState('');
  const [productResults, setProductResults] = useState<{ id: string; name: string; sku: string }[]>([]);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Product search debounce
  useEffect(() => {
    if (!productSearch.trim()) { setProductResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/kb/products`);
        if (!res.ok) return;
        const data = await res.json();
        const q = productSearch.toLowerCase();
        const matches = (data.products ?? []).filter(
          (p: { name: string; sku: string }) =>
            p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
        );
        setProductResults(matches.slice(0, 6));
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(t);
  }, [productSearch]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !content.trim()) {
      setError('Title, description, and content are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/kb/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          content: content.trim(),
          category,
          difficulty,
          author: author.trim() || undefined,
          product_id: selectedProductId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to create article'); return; }
      onCreated(data.article);
      onClose();
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      {/* Slide-over */}
      <div className="relative ml-auto w-full max-w-lg bg-white shadow-xl flex flex-col h-full">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">New KB Article</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Descriptive title for the article"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Short Description *</label>
            <input
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder="One-line summary shown in the article list"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
              >
                {CATEGORY_OPTIONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Difficulty</label>
              <select
                value={difficulty}
                onChange={e => setDifficulty(e.target.value as Article['difficulty'])}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
              >
                {['Basic', 'Intermediate', 'Advanced', 'Installation'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Product (optional)</label>
            <div className="relative">
              <input
                value={selectedProductName || productSearch}
                onChange={e => {
                  setSelectedProductId('');
                  setSelectedProductName('');
                  setProductSearch(e.target.value);
                }}
                placeholder="Search products..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
              {productResults.length > 0 && !selectedProductId && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
                  {productResults.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedProductId(p.id);
                        setSelectedProductName(p.name);
                        setProductSearch('');
                        setProductResults([]);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <span className="text-gray-900">{p.name}</span>
                      <span className="text-xs text-gray-400">{p.sku}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Author (optional)</label>
            <input
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="Your name or team"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Full Content *</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={8}
              placeholder="Full article content — troubleshooting steps, install procedures, etc."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-y font-mono"
            />
          </div>
        </form>

        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {saving ? (
              <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> Saving…</>
            ) : (
              <><Plus size={14} /> Create Article</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Article Detail Drawer ────────────────────────────────────────────────────

interface ArticleDrawerProps {
  article: Article;
  onClose: () => void;
  onHelpful: (id: string) => void;
}

function ArticleDrawer({ article, onClose, onHelpful }: ArticleDrawerProps) {
  const [voted, setVoted] = useState(false);

  function handleHelpful() {
    if (voted) return;
    setVoted(true);
    onHelpful(article.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-xl bg-white shadow-xl flex flex-col h-full">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 leading-snug">{article.title}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {article.products && (
                <span className="flex items-center gap-1 text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                  <Hash size={8} /> {article.products.name}
                </span>
              )}
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", difficultyBadge(article.difficulty))}>
                {article.difficulty}
              </span>
              <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                {article.category}
              </span>
              {article.author && (
                <span className="flex items-center gap-1 text-[10px] text-gray-400">
                  <User size={8} /> {article.author}
                </span>
              )}
              {article.created_at && (
                <span className="flex items-center gap-1 text-[10px] text-gray-400">
                  <Clock size={8} /> {formatDate(article.created_at)}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0 mt-0.5">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-sm text-gray-500 mb-4 leading-relaxed">{article.description}</p>
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
            {article.content ?? (
              <p className="text-gray-400 italic text-sm">No content available for this article.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <Star size={12} className="text-amber-400 fill-amber-400" />
            {article.helpful_count + (voted ? 1 : 0)} found this helpful
          </span>
          <button
            onClick={handleHelpful}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              voted
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "border-gray-200 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
            )}
          >
            <ThumbsUp size={12} />
            {voted ? "Marked helpful!" : "This helped me"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KBPage() {
  // ── Article library state ────────────────────────────────────────────────
  const [articles, setArticles]             = useState<Article[]>([]);
  const [categories, setCategories]         = useState<CategoryDef[]>([]);
  const [totalArticles, setTotalArticles]   = useState(0);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>(''); // '' = All
  const [articleSearch, setArticleSearch]   = useState('');
  const [openArticle, setOpenArticle]       = useState<Article | null>(null);
  const [showNewForm, setShowNewForm]        = useState(false);

  // ── Diagnostic state ────────────────────────────────────────────────────
  const [symptom, setSymptom]  = useState("");
  const [product, setProduct]  = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [diagActive,   setDiagActive]   = useState(false);
  const [diagLoading,  setDiagLoading]  = useState(false);
  const [diagHistory,  setDiagHistory]  = useState<DiagHistory[]>([]);
  const [diagCurrent,  setDiagCurrent]  = useState<DiagStep | null>(null);
  const [diagSession,  setDiagSession]  = useState<string | null>(null);
  const [diagFreeText, setDiagFreeText] = useState("");
  const diagBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { diagBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [diagHistory, diagCurrent]);

  // ── Fetch articles ───────────────────────────────────────────────────────
  const fetchArticles = useCallback(async (q: string, cat: string) => {
    setLoadingArticles(true);
    try {
      const params = new URLSearchParams();
      if (q)   params.set('q', q);
      if (cat) params.set('category', cat);
      const res = await fetch(`/api/kb/articles?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();

      setArticles(data.articles ?? []);
      setTotalArticles(data.total ?? 0);

      // Build sidebar categories from API counts + static icon map
      // Always use full (unfiltered) category counts for the sidebar
      const catCounts: CategoryCount[] = data.categories ?? [];
      const built: CategoryDef[] = catCounts
        .map((cc: CategoryCount) => {
          const meta = CATEGORY_ICON_MAP[cc.category] ?? { id: cc.category.toLowerCase().replace(/\s+/g, '-'), Icon: BookOpen };
          return { id: cc.category, label: cc.category, count: cc.count, Icon: meta.Icon };
        })
        .sort((a: CategoryDef, b: CategoryDef) => b.count - a.count);

      // Fill in any CATEGORY_OPTIONS entries that have 0 articles (so sidebar always shows all categories)
      const seenLabels = new Set(built.map((c: CategoryDef) => c.label));
      for (const label of CATEGORY_OPTIONS) {
        if (!seenLabels.has(label)) {
          const meta = CATEGORY_ICON_MAP[label] ?? { id: label.toLowerCase().replace(/\s+/g, '-'), Icon: BookOpen };
          built.push({ id: label, label, count: 0, Icon: meta.Icon });
        }
      }

      setCategories(built);
    } catch { /* silently ignore */ } finally {
      setLoadingArticles(false);
    }
  }, []);

  // Initial load
  useEffect(() => { fetchArticles('', ''); }, [fetchArticles]);

  // Debounced search — triggers on articleSearch or selectedCategory change
  useEffect(() => {
    const t = setTimeout(() => {
      fetchArticles(articleSearch, selectedCategory);
    }, 300);
    return () => clearTimeout(t);
  }, [articleSearch, selectedCategory, fetchArticles]);

  // ── Helpful handler ──────────────────────────────────────────────────────
  async function handleHelpful(articleId: string) {
    try {
      const res = await fetch(`/api/kb/articles/${articleId}/helpful`, { method: 'POST' });
      if (!res.ok) return;
      const data = await res.json();
      // Update in list
      setArticles(prev => prev.map(a =>
        a.id === articleId ? { ...a, helpful_count: data.article.helpful_count } : a
      ));
      // Update in open drawer if applicable
      if (openArticle?.id === articleId) {
        setOpenArticle(prev => prev ? { ...prev, helpful_count: data.article.helpful_count } : prev);
      }
    } catch { /* ignore */ }
  }

  // ── New article created ───────────────────────────────────────────────────
  function handleArticleCreated(article: Article) {
    // Optimistically prepend to list
    setArticles(prev => [article, ...prev]);
    setTotalArticles(prev => prev + 1);
    // Re-fetch to update category counts
    fetchArticles(articleSearch, selectedCategory);
  }

  // ── Open article detail (fetches full content) ────────────────────────────
  async function openArticleDetail(article: Article) {
    // If we already have content, open immediately
    if (article.content !== undefined) {
      setOpenArticle(article);
      return;
    }
    try {
      const res = await fetch(`/api/kb/articles/${article.id}`);
      if (!res.ok) { setOpenArticle(article); return; }
      const data = await res.json();
      setOpenArticle(data.article);
    } catch {
      setOpenArticle(article);
    }
  }

  // ── Diagnostic engine ────────────────────────────────────────────────────
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

  const handleChip = (chip: string) => {
    setSymptom(chip);
    setActiveChip(chip);
  };

  // Derive articles shown in the middle panel
  const displayedArticles = articles;
  const selectedCatLabel  = selectedCategory || 'All Articles';

  // Stats for the bar: total comes from API; compute distinct products
  const distinctProducts = new Set(articles.map(a => a.product_id).filter(Boolean)).size;

  return (
    <div className="flex flex-col min-h-full bg-gray-50">

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Knowledge Base</h1>
          <p className="text-sm text-gray-500 mt-0.5">Find answers fast. Guided diagnostics for every product.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
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
          { label: "Articles",            value: loadingArticles ? "…" : String(totalArticles), sub: "in library",           valueClass: "text-gray-900"   },
          { label: "Products Covered",    value: loadingArticles ? "…" : String(distinctProducts || 0), sub: "product lines", valueClass: "text-gray-900"   },
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
                  {Array.from(new Set(articles.filter(a => a.products).map(a => a.products!.name))).map(name => (
                    <option key={name} value={name}>{name}</option>
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
                {/* "All" option */}
                <button
                  onClick={() => setSelectedCategory('')}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors group",
                    selectedCategory === ''
                      ? "bg-blue-50 border-r-2 border-r-blue-600"
                      : "hover:bg-gray-50"
                  )}
                >
                  <BookOpen
                    size={14}
                    className={cn("shrink-0", selectedCategory === '' ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600")}
                  />
                  <span className={cn("flex-1 text-sm truncate", selectedCategory === '' ? "font-semibold text-blue-700" : "text-gray-700")}>
                    All Articles
                  </span>
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                    selectedCategory === '' ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                  )}>
                    {loadingArticles ? '…' : totalArticles}
                  </span>
                </button>

                {categories.map(({ id, label, count, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setSelectedCategory(id === selectedCategory ? '' : id)}
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
                  <h3 className="text-sm font-semibold text-gray-900">{selectedCatLabel}</h3>
                  <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
                    {loadingArticles ? '…' : `${displayedArticles.length} articles`}
                  </span>
                </div>
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={articleSearch}
                    onChange={e => setArticleSearch(e.target.value)}
                    placeholder="Search..."
                    className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50 w-36"
                  />
                </div>
              </div>

              {loadingArticles ? (
                <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
                  <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                  <p className="text-xs">Loading articles…</p>
                </div>
              ) : displayedArticles.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-gray-400">
                  <BookOpen size={32} className="mb-3 opacity-30" />
                  <p className="text-sm">No articles in this category yet</p>
                  <button
                    onClick={() => setShowNewForm(true)}
                    className="mt-3 text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Plus size={12} /> Add the first article
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {displayedArticles.map((article) => (
                    <div key={article.id} className="px-4 py-3.5 hover:bg-gray-50/50 transition-colors group">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700 transition-colors leading-snug">
                            {article.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{article.description}</p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {article.products ? (
                              <span className="flex items-center gap-1 text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                                <Hash size={8} /> {article.products.name}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
                                <Hash size={8} /> General
                              </span>
                            )}
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded font-medium",
                              difficultyBadge(article.difficulty)
                            )}>
                              {article.difficulty}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-gray-400 ml-1">
                              <Star size={9} className="text-amber-400 fill-amber-400" />
                              {article.helpful_count} helpful
                            </span>
                            {article.author && (
                              <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                <User size={8} /> {article.author}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 flex flex-col gap-1.5 items-end">
                          <button
                            onClick={() => openArticleDetail(article)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all"
                          >
                            Read <ArrowRight size={10} />
                          </button>
                          <button
                            onClick={() => handleHelpful(article.id)}
                            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-emerald-600 transition-colors"
                          >
                            <ThumbsUp size={9} /> {article.helpful_count}
                          </button>
                        </div>
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

      {/* ── New Article Slide-Over ────────────────────────────────────────────── */}
      {showNewForm && (
        <NewArticleForm
          onClose={() => setShowNewForm(false)}
          onCreated={handleArticleCreated}
        />
      )}

      {/* ── Article Detail Drawer ─────────────────────────────────────────────── */}
      {openArticle && (
        <ArticleDrawer
          article={openArticle}
          onClose={() => setOpenArticle(null)}
          onHelpful={handleHelpful}
        />
      )}
    </div>
  );
}
