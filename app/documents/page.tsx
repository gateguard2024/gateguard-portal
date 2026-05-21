'use client'

import { useState } from 'react'
import { FileText, Plus, Search, Download, Upload, Filter } from 'lucide-react'

const { FolderOpen, FileCheck, FileX, FileBadge, BookOpen, Archive } = require('lucide-react') as any

/* ─── Types ──────────────────────────────────────────────────── */
type DocCategory = 'all' | 'agreements' | 'ndas' | 'permits' | 'certificates' | 'manuals' | 'templates'

interface GGDocument {
  id: string
  name: string
  category: Exclude<DocCategory, 'all'>
  fileType: 'pdf' | 'docx' | 'xlsx'
  date: string
  size: string
  description: string
}

/* ─── Config ─────────────────────────────────────────────────── */
const CATEGORY_CONFIG: Record<Exclude<DocCategory, 'all'>, { label: string; color: string; bg: string }> = {
  agreements:   { label: 'Agreement',    color: 'text-brand-700',   bg: 'bg-brand-100'   },
  ndas:         { label: 'NDA',          color: 'text-violet-700',  bg: 'bg-violet-100'  },
  permits:      { label: 'Permit',       color: 'text-amber-700',   bg: 'bg-amber-100'   },
  certificates: { label: 'Certificate',  color: 'text-emerald-700', bg: 'bg-emerald-100' },
  manuals:      { label: 'Manual',       color: 'text-sky-700',     bg: 'bg-sky-100'     },
  templates:    { label: 'Template',     color: 'text-slate-700',   bg: 'bg-slate-100'   },
}

const FILE_TYPE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  pdf:  { color: 'text-red-600',   bg: 'bg-red-50',   label: 'PDF'  },
  docx: { color: 'text-blue-600',  bg: 'bg-blue-50',  label: 'DOCX' },
  xlsx: { color: 'text-green-600', bg: 'bg-green-50', label: 'XLSX' },
}

const TABS: Array<{ key: DocCategory; label: string }> = [
  { key: 'all',          label: 'All'          },
  { key: 'agreements',   label: 'Agreements'   },
  { key: 'ndas',         label: 'NDAs'         },
  { key: 'permits',      label: 'Permits'      },
  { key: 'certificates', label: 'Certificates' },
  { key: 'manuals',      label: 'Manuals'      },
  { key: 'templates',    label: 'Templates'    },
]

/* ─── Demo data ──────────────────────────────────────────────── */
const DEMO_DOCS: GGDocument[] = [
  {
    id: '1',
    name: 'GateGuard Dealer Agreement v2.3',
    category: 'agreements',
    fileType: 'pdf',
    date: 'Apr 15, 2026',
    size: '284 KB',
    description: 'Standard dealer partnership agreement. Covers commissions, non-solicitation, and service standards.',
  },
  {
    id: '2',
    name: 'NDA-A — Master Agent Template',
    category: 'ndas',
    fileType: 'docx',
    date: 'Mar 2, 2026',
    size: '48 KB',
    description: 'Mutual NDA for Master Agent and MSO onboarding. Full bilateral confidentiality clauses.',
  },
  {
    id: '3',
    name: 'NDA-B — Dealer Template',
    category: 'ndas',
    fileType: 'docx',
    date: 'Mar 2, 2026',
    size: '41 KB',
    description: 'One-way NDA for dealer-level orgs. Protects dealer client lists and proprietary tech.',
  },
  {
    id: '4',
    name: 'Gate Permit — East Ponce Village',
    category: 'permits',
    fileType: 'pdf',
    date: 'Jan 20, 2026',
    size: '1.1 MB',
    description: 'Fulton County gate operator permit. Valid through Jan 2027.',
  },
  {
    id: '5',
    name: 'UL 325 Compliance Certificate',
    category: 'certificates',
    fileType: 'pdf',
    date: 'Feb 10, 2026',
    size: '512 KB',
    description: 'UL 325 gate operator safety standard certification for GateGuard-installed systems.',
  },
  {
    id: '6',
    name: 'DoorKing 6050 Operator Manual',
    category: 'manuals',
    fileType: 'pdf',
    date: 'Nov 5, 2025',
    size: '3.4 MB',
    description: 'Full installation, programming, and troubleshooting manual for DoorKing 6050.',
  },
  {
    id: '7',
    name: 'Quote Template — Residential Gate Package',
    category: 'templates',
    fileType: 'docx',
    date: 'May 1, 2026',
    size: '62 KB',
    description: 'Standard quote template for residential gate installations. Includes typical line items.',
  },
  {
    id: '8',
    name: 'Sales Partner Commission Agreement',
    category: 'agreements',
    fileType: 'pdf',
    date: 'Apr 22, 2026',
    size: '190 KB',
    description: 'Commission structure, payment terms, and territory rights for GateGuard Sales Partners.',
  },
]

/* ─── Document card ──────────────────────────────────────────── */
function DocCard({ doc }: { doc: GGDocument }) {
  const catCfg  = CATEGORY_CONFIG[doc.category]
  const fileCfg = FILE_TYPE_CONFIG[doc.fileType]

  return (
    <div className="border border-border rounded-xl bg-card p-4 hover:shadow-md transition-shadow group flex flex-col gap-3">
      {/* Icon + file type */}
      <div className="flex items-start justify-between gap-2">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${fileCfg.bg} shrink-0`}>
          <FileText size={20} className={fileCfg.color} />
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${fileCfg.bg} ${fileCfg.color} uppercase`}>
          {fileCfg.label}
        </span>
      </div>

      {/* Name + description */}
      <div className="flex-1">
        <h3 className="font-semibold text-slate-900 text-sm leading-snug group-hover:text-brand-400 transition-colors">
          {doc.name}
        </h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{doc.description}</p>
      </div>

      {/* Category + date */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${catCfg.bg} ${catCfg.color}`}>
          {catCfg.label}
        </span>
        <span className="text-xs text-slate-400">{doc.date}</span>
        <span className="text-xs text-slate-400 ml-auto">{doc.size}</span>
      </div>

      {/* Download button */}
      <button className="flex items-center justify-center gap-2 w-full h-8 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-brand-400 hover:text-brand-400 transition-colors mt-auto">
        <Download size={12} />
        Download
      </button>
    </div>
  )
}

/* ─── Main page ──────────────────────────────────────────────── */
export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState<DocCategory>('all')
  const [q, setQ]                 = useState('')

  const filtered = DEMO_DOCS.filter(d => {
    const catMatch = activeTab === 'all' || d.category === activeTab
    const qMatch   = !q.trim() || d.name.toLowerCase().includes(q.toLowerCase()) ||
      d.description.toLowerCase().includes(q.toLowerCase())
    return catMatch && qMatch
  })

  const tabCount = (key: DocCategory) =>
    key === 'all' ? DEMO_DOCS.length : DEMO_DOCS.filter(d => d.category === key).length

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
            Agreements, NDAs, permits, certificates, manuals, and templates
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
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <FileText size={40} className="mb-4 opacity-25" />
          <p className="font-semibold text-slate-600 text-lg">No documents found</p>
          <p className="text-sm mt-1">{q ? 'Try a different search term' : 'Upload your first document to get started'}</p>
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
