'use client'

import { useState, useEffect } from 'react'
import { FileText, Plus, Search, Download, Upload } from 'lucide-react'

const { FolderOpen } = require('lucide-react') as any

/* ─── Types ──────────────────────────────────────────────────── */
type DocCategory = 'all' | 'contract' | 'permit' | 'certificate' | 'insurance' | 'manual' | 'report' | 'legal' | 'other'

interface OrgDocument {
  id: string
  name: string
  category: string
  file_url: string | null
  file_size_kb: number | null
  uploaded_by: string | null
  expires_at: string | null
  created_at: string
}

/* ─── Config ─────────────────────────────────────────────────── */
const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  contract:    { label: 'Contract',    color: 'text-brand-700',   bg: 'bg-brand-100'   },
  permit:      { label: 'Permit',      color: 'text-amber-700',   bg: 'bg-amber-100'   },
  certificate: { label: 'Certificate', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  insurance:   { label: 'Insurance',   color: 'text-sky-700',     bg: 'bg-sky-100'     },
  manual:      { label: 'Manual',      color: 'text-violet-700',  bg: 'bg-violet-100'  },
  report:      { label: 'Report',      color: 'text-indigo-700',  bg: 'bg-indigo-100'  },
  legal:       { label: 'Legal',       color: 'text-red-700',     bg: 'bg-red-100'     },
  other:       { label: 'Other',       color: 'text-slate-700',   bg: 'bg-slate-100'   },
}

const TABS: Array<{ key: DocCategory; label: string }> = [
  { key: 'all',         label: 'All'          },
  { key: 'contract',    label: 'Contracts'    },
  { key: 'permit',      label: 'Permits'      },
  { key: 'certificate', label: 'Certificates' },
  { key: 'insurance',   label: 'Insurance'    },
  { key: 'manual',      label: 'Manuals'      },
  { key: 'legal',       label: 'Legal'        },
  { key: 'other',       label: 'Other'        },
]

function formatSize(kb: number | null) {
  if (!kb) return null
  if (kb < 1024) return `${kb} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/* ─── Document card ──────────────────────────────────────────── */
function DocCard({ doc }: { doc: OrgDocument }) {
  const catCfg = CATEGORY_CONFIG[doc.category] ?? CATEGORY_CONFIG.other
  const size   = formatSize(doc.file_size_kb)

  return (
    <div className="border border-border rounded-xl bg-card p-4 hover:shadow-md transition-shadow group flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-100 shrink-0">
          <FileText size={20} className="text-slate-500" />
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${catCfg.bg} ${catCfg.color} uppercase`}>
          {catCfg.label}
        </span>
      </div>

      <div className="flex-1">
        <h3 className="font-semibold text-slate-900 text-sm leading-snug group-hover:text-brand-400 transition-colors">
          {doc.name}
        </h3>
        {doc.uploaded_by && (
          <p className="text-xs text-slate-400 mt-1">Uploaded by {doc.uploaded_by}</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-400">{formatDate(doc.created_at)}</span>
        {size && <span className="text-xs text-slate-400 ml-auto">{size}</span>}
        {doc.expires_at && (
          <span className="text-xs text-amber-600 font-medium">Expires {formatDate(doc.expires_at)}</span>
        )}
      </div>

      {doc.file_url ? (
        <a
          href={doc.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full h-8 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-brand-400 hover:text-brand-400 transition-colors"
        >
          <Download size={12} />
          Download
        </a>
      ) : (
        <div className="flex items-center justify-center gap-2 w-full h-8 border border-slate-100 rounded-lg text-xs font-semibold text-slate-300">
          No file attached
        </div>
      )}
    </div>
  )
}

/* ─── Main page ──────────────────────────────────────────────── */
export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState<DocCategory>('all')
  const [q, setQ]                 = useState('')
  const [documents, setDocuments] = useState<OrgDocument[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    fetch('/api/documents')
      .then(r => r.json())
      .then(d => setDocuments(d.documents ?? []))
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = documents.filter(d => {
    const catMatch = activeTab === 'all' || d.category === activeTab
    const qMatch   = !q.trim() || d.name.toLowerCase().includes(q.toLowerCase())
    return catMatch && qMatch
  })

  const tabCount = (key: DocCategory) =>
    key === 'all' ? documents.length : documents.filter(d => d.category === key).length

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <FolderOpen size={24} className="text-brand-400" />
            Documents
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Agreements, permits, certificates, insurance, manuals, and legal docs
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-brand-400 text-white rounded-lg text-sm font-semibold hover:bg-brand-500 transition-colors shrink-0">
          <Upload size={15} /> Upload Document
        </button>
      </div>

      {/* ── Search ────────────────────────────────────────────── */}
      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search documents…"
          className="w-full pl-9 pr-4 py-2 h-9 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
        />
      </div>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div className="flex gap-0.5 border-b border-slate-200 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-brand-400 text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
              activeTab === tab.key ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-500'
            }`}>
              {tabCount(tab.key)}
            </span>
          </button>
        ))}
      </div>

      {/* ── Grid ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="border border-border rounded-xl bg-card p-4 space-y-3">
              <div className="h-10 bg-muted/50 rounded animate-pulse" />
              <div className="h-4 bg-muted/50 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-muted/50 rounded animate-pulse w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <FileText size={40} className="mb-4 opacity-25" />
          <p className="font-semibold text-slate-600 text-lg">No documents found</p>
          <p className="text-sm mt-1">
            {q ? 'Try a different search term' : 'Upload your first document to get started'}
          </p>
          {!q && (
            <button className="mt-4 flex items-center gap-2 px-4 py-2 bg-brand-400 text-white rounded-lg text-sm font-semibold hover:bg-brand-500 transition-colors">
              <Upload size={14} /> Upload Document
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(doc => <DocCard key={doc.id} doc={doc} />)}
        </div>
      )}
    </div>
  )
}
