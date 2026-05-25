"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, ChevronUp, Check, Clock, X } from "lucide-react"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { BookOpen, AlertTriangle, Lightbulb, Code2, ChevronRight } = require("lucide-react") as any

// ─── Types ─────────────────────────────────────────────────────────────────────

type PlaybookStep = {
  step: number
  title: string
  content: string
  code?: string
  warning?: string
  tip?: string
}

type Playbook = {
  id: string
  title: string
  category: "integration" | "configuration" | "hardware" | "network"
  tags: string[]
  difficulty: "beginner" | "intermediate" | "advanced"
  estimated_time: string
  description: string
  steps: PlaybookStep[]
  last_updated: string
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  integration: "Integration",
  configuration: "Configuration",
  hardware: "Hardware",
  network: "Network",
}

const CATEGORY_COLORS: Record<string, string> = {
  integration: "bg-violet-100 text-violet-700 border-violet-200",
  configuration: "bg-sky-100 text-sky-700 border-sky-200",
  hardware: "bg-amber-100 text-amber-700 border-amber-200",
  network: "bg-emerald-100 text-emerald-700 border-emerald-200",
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-green-100 text-green-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced: "bg-red-100 text-red-700",
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getProgressKey(playbookId: string): string {
  return `gg_playbook_progress_${playbookId}`
}

function loadProgress(playbookId: string): Set<number> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(getProgressKey(playbookId))
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as number[])
  } catch {
    return new Set()
  }
}

function saveProgress(playbookId: string, completed: Set<number>): void {
  if (typeof window === "undefined") return
  localStorage.setItem(getProgressKey(playbookId), JSON.stringify(Array.from(completed)))
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [code])

  return (
    <div className="relative mt-3 rounded-lg overflow-hidden border border-slate-200">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800">
        <div className="flex items-center gap-1.5">
          <Code2 className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wide">code</span>
        </div>
        <button
          onClick={handleCopy}
          className="text-[11px] font-mono text-slate-400 hover:text-white transition-colors flex items-center gap-1"
        >
          {copied ? <><Check className="w-3 h-3" /> Copied</> : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 bg-slate-900 text-slate-100 text-[12px] font-mono leading-relaxed whitespace-pre">
        {code}
      </pre>
    </div>
  )
}

function WarningBox({ text }: { text: string }) {
  return (
    <div className="mt-3 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-amber-800">{text}</p>
    </div>
  )
}

function TipBox({ text }: { text: string }) {
  return (
    <div className="mt-3 flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
      <Lightbulb className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-blue-800">{text}</p>
    </div>
  )
}

function PlaybookDetail({ playbook, onClose }: { playbook: Playbook; onClose: () => void }) {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => loadProgress(playbook.id))
  const [expandedStep, setExpandedStep] = useState<number | null>(1)

  const toggleStep = useCallback((stepNum: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(stepNum)) {
        next.delete(stepNum)
      } else {
        next.add(stepNum)
      }
      saveProgress(playbook.id, next)
      return next
    })
  }, [playbook.id])

  const pct = Math.round((completedSteps.size / playbook.steps.length) * 100)

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto h-full w-full max-w-3xl bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wide ${CATEGORY_COLORS[playbook.category]}`}>
                  {CATEGORY_LABELS[playbook.category]}
                </span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded capitalize ${DIFFICULTY_COLORS[playbook.difficulty]}`}>
                  {playbook.difficulty}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Clock className="w-3 h-3" />
                  {playbook.estimated_time}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">{playbook.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{playbook.description}</p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-slate-500">
                {completedSteps.size} of {playbook.steps.length} steps complete
              </span>
              <span className="text-[11px] font-semibold text-[#6B7EFF]">{pct}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[#6B7EFF] transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {playbook.steps.map((step) => {
            const done = completedSteps.has(step.step)
            const isOpen = expandedStep === step.step

            return (
              <div
                key={step.step}
                className={`border rounded-xl overflow-hidden transition-colors ${done ? "border-green-200 bg-green-50/30" : "border-border bg-white"}`}
              >
                {/* Step header */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedStep(isOpen ? null : step.step)}
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleStep(step.step)
                    }}
                    className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      done
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-slate-300 hover:border-[#6B7EFF]"
                    }`}
                  >
                    {done && <Check className="w-3.5 h-3.5" />}
                  </button>

                  {/* Step number */}
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold flex items-center justify-center">
                    {step.step}
                  </span>

                  {/* Title */}
                  <span className={`flex-1 text-sm font-semibold ${done ? "text-green-700 line-through decoration-green-400" : "text-slate-800"}`}>
                    {step.title}
                  </span>

                  {/* Expand icon */}
                  <span className="flex-shrink-0 text-slate-400">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </span>
                </button>

                {/* Step content */}
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-border/60">
                    <p className="mt-3 text-sm text-slate-700 leading-relaxed">{step.content}</p>
                    {step.warning && <WarningBox text={step.warning} />}
                    {step.code && <CodeBlock code={step.code} />}
                    {step.tip && <TipBox text={step.tip} />}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border px-6 py-3 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">Last updated {formatDate(playbook.last_updated)}</span>
          {completedSteps.size === playbook.steps.length ? (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
              <Check className="w-4 h-4" /> Playbook complete
            </span>
          ) : (
            <button
              onClick={() => {
                const next = playbook.steps.find((s) => !completedSteps.has(s.step))
                if (next) setExpandedStep(next.step)
              }}
              className="text-sm font-semibold text-[#6B7EFF] hover:underline"
            >
              Continue →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function PlaybookCard({ playbook, onClick }: { playbook: Playbook; onClick: () => void }) {
  const completed = loadProgress(playbook.id)
  const pct = Math.round((completed.size / playbook.steps.length) * 100)

  return (
    <div className="border border-border rounded-xl bg-white hover:shadow-md transition-shadow flex flex-col">
      {/* Card header */}
      <div className="p-5 flex-1">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-wrap gap-1.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${CATEGORY_COLORS[playbook.category]}`}>
              {CATEGORY_LABELS[playbook.category]}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${DIFFICULTY_COLORS[playbook.difficulty]}`}>
              {playbook.difficulty}
            </span>
          </div>
          <span className="flex items-center gap-1 text-[11px] text-slate-500 flex-shrink-0">
            <Clock className="w-3 h-3" />
            {playbook.estimated_time}
          </span>
        </div>

        <h3 className="font-bold text-slate-900 text-base leading-snug mb-2">{playbook.title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed line-clamp-3">{playbook.description}</p>

        {/* Tags */}
        <div className="mt-3 flex flex-wrap gap-1">
          {playbook.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Progress + action */}
      <div className="border-t border-border px-5 py-3 flex items-center justify-between gap-3">
        <div className="flex-1">
          {pct > 0 ? (
            <div>
              <div className="text-[10px] text-slate-500 mb-1">{pct}% complete</div>
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#6B7EFF] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400">{playbook.steps.length} steps</span>
          )}
        </div>
        <button
          onClick={onClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#6B7EFF] text-white text-sm font-semibold hover:bg-[#5a6de0] transition-colors flex-shrink-0"
        >
          {pct > 0 ? "Continue" : "Open Playbook"}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<string>("all")
  const [activeDifficulty, setActiveDifficulty] = useState<string>("all")
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null)

  useEffect(() => {
    fetch("/api/playbooks")
      .then((r) => r.json())
      .then((d) => {
        setPlaybooks(d.playbooks ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = playbooks.filter((p) => {
    if (activeCategory !== "all" && p.category !== activeCategory) return false
    if (activeDifficulty !== "all" && p.difficulty !== activeDifficulty) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.includes(q))
      )
    }
    return true
  })

  const categories = ["all", "integration", "configuration", "hardware", "network"]
  const difficulties = ["all", "beginner", "intermediate", "advanced"]

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Page header */}
      <div className="border-b border-border bg-white px-8 py-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-[#6B7EFF]/10 flex items-center justify-center">
            <BookOpen className="w-4.5 h-4.5 text-[#6B7EFF]" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Playbooks</h1>
        </div>
        <p className="text-sm text-slate-500 ml-11">Step-by-step integration and configuration guides for GateGuard dealers</p>
      </div>

      <div className="flex h-[calc(100vh-105px)]">
        {/* Left sidebar */}
        <aside className="w-56 flex-shrink-0 border-r border-border bg-white overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search playbooks..."
                className="w-full h-8 pl-8 pr-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 focus:border-[#6B7EFF]"
              />
            </div>

            {/* Category filter */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Category</p>
              <div className="space-y-0.5">
                {categories.map((cat) => {
                  const count = cat === "all"
                    ? playbooks.length
                    : playbooks.filter((p) => p.category === cat).length
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                        activeCategory === cat
                          ? "bg-[#6B7EFF]/10 text-[#6B7EFF] font-semibold"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span>{CATEGORY_LABELS[cat]}</span>
                      <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold ${
                        activeCategory === cat ? "bg-[#6B7EFF]/20 text-[#6B7EFF]" : "bg-slate-100 text-slate-500"
                      }`}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Difficulty filter */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Difficulty</p>
              <div className="space-y-0.5">
                {difficulties.map((d) => (
                  <button
                    key={d}
                    onClick={() => setActiveDifficulty(d)}
                    className={`w-full flex items-center px-2.5 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                      activeDifficulty === d
                        ? "bg-[#6B7EFF]/10 text-[#6B7EFF] font-semibold"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {d === "all" ? "All Levels" : d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-border rounded-xl bg-white p-5 animate-pulse">
                  <div className="flex gap-2 mb-3">
                    <div className="h-5 w-20 bg-slate-100 rounded" />
                    <div className="h-5 w-16 bg-slate-100 rounded" />
                  </div>
                  <div className="h-5 w-3/4 bg-slate-100 rounded mb-2" />
                  <div className="h-4 w-full bg-slate-50 rounded mb-1" />
                  <div className="h-4 w-2/3 bg-slate-50 rounded" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <BookOpen className="w-12 h-12 text-slate-300 mb-3" />
              <h3 className="text-base font-semibold text-slate-600 mb-1">No playbooks found</h3>
              <p className="text-sm text-slate-400">
                {search ? `No results for "${search}"` : "No playbooks in this category yet"}
              </p>
              {(search || activeCategory !== "all" || activeDifficulty !== "all") && (
                <button
                  onClick={() => { setSearch(""); setActiveCategory("all"); setActiveDifficulty("all") }}
                  className="mt-3 text-sm text-[#6B7EFF] hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-500">
                  {filtered.length} playbook{filtered.length !== 1 ? "s" : ""}
                  {search && <> matching <span className="font-semibold text-slate-700">"{search}"</span></>}
                </p>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filtered.map((p) => (
                  <PlaybookCard
                    key={p.id}
                    playbook={p}
                    onClick={() => setSelectedPlaybook(p)}
                  />
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Playbook detail SlideOver */}
      {selectedPlaybook && (
        <PlaybookDetail
          playbook={selectedPlaybook}
          onClose={() => setSelectedPlaybook(null)}
        />
      )}
    </div>
  )
}
