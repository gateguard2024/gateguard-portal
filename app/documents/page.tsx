'use client'

import { useState, useEffect, useRef } from 'react'
import { FileText, Plus, Search, Download, Upload, X, ChevronRight } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'

const { FolderOpen, FilePlus, FileUp, LayoutTemplate, FileCheck } = require('lucide-react') as any

/* ─── Types ──────────────────────────────────────────────────── */
type DocCategory = 'all' | 'contract' | 'permit' | 'certificate' | 'insurance' | 'manual' | 'report' | 'legal' | 'other'
type ContractPath = null | 'upload' | 'scratch' | 'template'

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

const TEMPLATES = [
  {
    id: 'nda',
    name: 'Mutual Non-Disclosure Agreement',
    description: 'Standard GateGuard NDA — 9-section mutual NDA with non-solicitation and trade secret protection.',
    category: 'legal',
    badge: 'NDA',
    badgeColor: 'bg-red-100 text-red-700',
  },
  {
    id: 'dealer-agreement',
    name: 'Dealer & Reseller Agreement',
    description: 'Full authorized dealer agreement + Exhibit A (commission schedule) for new dealer onboarding.',
    category: 'contract',
    badge: 'DEALER',
    badgeColor: 'bg-brand-100 text-brand-700',
  },
  {
    id: 'blank-contract',
    name: 'Blank Contract',
    description: 'Empty contract shell — add your own sections, terms, and conditions.',
    category: 'contract',
    badge: 'BLANK',
    badgeColor: 'bg-slate-100 text-slate-700',
  },
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

/* ─── New Contract Modal ─────────────────────────────────────── */
function NewContractModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (doc: OrgDocument) => void
}) {
  const [path, setPath]           = useState<ContractPath>(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  // Upload path
  const fileRef                   = useRef<HTMLInputElement>(null)
  const [fileName, setFileName]   = useState('')
  const [uploadName, setUploadName] = useState('')
  const [uploadCategory, setUploadCategory] = useState('contract')
  const [uploadExpiry, setUploadExpiry]     = useState('')

  // Scratch path
  const [scratchName, setScratchName]       = useState('')
  const [scratchCategory, setScratchCategory] = useState('contract')
  const [scratchNotes, setScratchNotes]     = useState('')
  const [scratchExpiry, setScratchExpiry]   = useState('')

  // Template path
  const [chosenTemplate, setChosenTemplate] = useState('')
  const [tplName, setTplName]               = useState('')
  const [tplParty, setTplParty]             = useState('')
  const [tplExpiry, setTplExpiry]           = useState('')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFileName(f.name)
    if (!uploadName) setUploadName(f.name.replace(/\.[^.]+$/, ''))
  }

  async function submitUpload() {
    if (!uploadName.trim()) { setError('Document name is required'); return }
    setSaving(true); setError('')
    const body: Record<string, unknown> = {
      name:     uploadName.trim(),
      category: uploadCategory,
      expires_at: uploadExpiry || null,
    }
    if (fileName) body.uploaded_by = 'You'
    const res = await fetch('/api/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to save'); setSaving(false); return }
    onCreated(data.document)
  }

  async function submitScratch() {
    if (!scratchName.trim()) { setError('Document name is required'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:     scratchName.trim(),
        category: scratchCategory,
        expires_at: scratchExpiry || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to save'); setSaving(false); return }
    onCreated(data.document)
  }

  async function submitTemplate() {
    if (!chosenTemplate) { setError('Please choose a template'); return }
    if (!tplName.trim()) { setError('Document name is required'); return }
    setSaving(true); setError('')
    const tmpl = TEMPLATES.find(t => t.id === chosenTemplate)!
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:     tplName.trim(),
        category: tmpl.category,
        expires_at: tplExpiry || null,
        uploaded_by: `From template: ${tmpl.name}`,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to save'); setSaving(false); return }
    onCreated(data.document)
  }

  const PATHS = [
    {
      key: 'upload' as ContractPath,
      icon: FileUp,
      title: 'Upload Existing',
      desc: 'Upload a PDF or Word document you already have — contracts, signed agreements, vendor docs.',
      cta: 'Browse files',
      accent: 'border-sky-200 hover:border-sky-400 hover:bg-sky-50',
      iconBg: 'bg-sky-100 text-sky-600',
    },
    {
      key: 'scratch' as ContractPath,
      icon: FilePlus,
      title: 'Start from Scratch',
      desc: 'Create a blank contract record and fill in your own sections, terms, and conditions.',
      cta: 'Create blank',
      accent: 'border-violet-200 hover:border-violet-400 hover:bg-violet-50',
      iconBg: 'bg-violet-100 text-violet-600',
    },
    {
      key: 'template' as ContractPath,
      icon: LayoutTemplate,
      title: 'Use a Template',
      desc: 'Start from a GateGuard-approved template: Mutual NDA, Dealer Agreement, or a blank shell.',
      cta: 'Choose template',
      accent: 'border-brand-200 hover:border-brand-400 hover:bg-blue-50',
      iconBg: 'bg-brand-100 text-brand-600',
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <FileCheck size={20} className="text-brand-400" />
            <div>
              <h2 className="text-base font-bold text-slate-900">New Contract</h2>
              {path && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {path === 'upload' ? 'Upload existing document' : path === 'scratch' ? 'Start from scratch' : 'Use a template'}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-6">

          {/* ── Step 1: Pick a path ── */}
          {path === null && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 mb-4">How would you like to create this contract?</p>
              {PATHS.map(p => (
                <button
                  key={p.key}
                  onClick={() => setPath(p.key)}
                  className={`w-full flex items-center gap-4 p-4 border-2 rounded-xl transition-all text-left group ${p.accent}`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${p.iconBg}`}>
                    <p.icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-slate-900">{p.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{p.desc}</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* ── Step 2a: Upload ── */}
          {path === 'upload' && (
            <div className="space-y-4">
              {/* File drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  fileName ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-brand-400 hover:bg-blue-50'
                }`}
              >
                <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" className="hidden" onChange={handleFileChange} />
                {fileName ? (
                  <>
                    <FileCheck size={28} className="mx-auto text-emerald-500 mb-2" />
                    <p className="text-sm font-semibold text-emerald-700">{fileName}</p>
                    <p className="text-xs text-emerald-500 mt-0.5">Click to change file</p>
                  </>
                ) : (
                  <>
                    <Upload size={28} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-600">Click to upload a file</p>
                    <p className="text-xs text-slate-400 mt-0.5">PDF, DOCX, or DOC</p>
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Document Name <span className="text-red-400">*</span></label>
                <input
                  value={uploadName}
                  onChange={e => setUploadName(e.target.value)}
                  placeholder="e.g. Master Services Agreement — Acme Corp"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                  <select
                    value={uploadCategory}
                    onChange={e => setUploadCategory(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                  >
                    {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={uploadExpiry}
                    onChange={e => setUploadExpiry(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button onClick={() => { setPath(null); setError('') }} className="flex-1 h-9 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  Back
                </button>
                <button
                  onClick={submitUpload}
                  disabled={saving}
                  className="flex-1 h-9 bg-brand-400 text-white rounded-lg text-sm font-semibold hover:bg-brand-500 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Document'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2b: From scratch ── */}
          {path === 'scratch' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Document Name <span className="text-red-400">*</span></label>
                <input
                  value={scratchName}
                  onChange={e => setScratchName(e.target.value)}
                  placeholder="e.g. Service Agreement — Riverside Apartments"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                  <select
                    value={scratchCategory}
                    onChange={e => setScratchCategory(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                  >
                    {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={scratchExpiry}
                    onChange={e => setScratchExpiry(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                <textarea
                  value={scratchNotes}
                  onChange={e => setScratchNotes(e.target.value)}
                  placeholder="Optional — describe the purpose of this contract…"
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button onClick={() => { setPath(null); setError('') }} className="flex-1 h-9 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  Back
                </button>
                <button
                  onClick={submitScratch}
                  disabled={saving}
                  className="flex-1 h-9 bg-brand-400 text-white rounded-lg text-sm font-semibold hover:bg-brand-500 disabled:opacity-50"
                >
                  {saving ? 'Creating…' : 'Create Contract'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2c: Use template ── */}
          {path === 'template' && (
            <div className="space-y-4">
              {/* Template picker */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600 mb-2">Choose a template</p>
                {TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setChosenTemplate(t.id)
                      if (!tplName) setTplName(t.name)
                    }}
                    className={`w-full flex items-start gap-3 p-3 border-2 rounded-xl text-left transition-all ${
                      chosenTemplate === t.id
                        ? 'border-brand-400 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <LayoutTemplate size={18} className={chosenTemplate === t.id ? 'text-brand-400 mt-0.5 shrink-0' : 'text-slate-400 mt-0.5 shrink-0'} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{t.name}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${t.badgeColor}`}>{t.badge}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{t.description}</p>
                    </div>
                    {chosenTemplate === t.id && (
                      <div className="w-4 h-4 rounded-full bg-brand-400 flex items-center justify-center shrink-0 mt-0.5">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {chosenTemplate && (
                <>
                  <div className="border-t border-slate-100 pt-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Document Name <span className="text-red-400">*</span></label>
                      <input
                        value={tplName}
                        onChange={e => setTplName(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Counterparty</label>
                      <input
                        value={tplParty}
                        onChange={e => setTplParty(e.target.value)}
                        placeholder="e.g. Acme Security LLC"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Expiry Date</label>
                      <input
                        type="date"
                        value={tplExpiry}
                        onChange={e => setTplExpiry(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                      />
                    </div>
                  </div>
                </>
              )}

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button onClick={() => { setPath(null); setError(''); setChosenTemplate('') }} className="flex-1 h-9 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  Back
                </button>
                <button
                  onClick={submitTemplate}
                  disabled={saving || !chosenTemplate}
                  className="flex-1 h-9 bg-brand-400 text-white rounded-lg text-sm font-semibold hover:bg-brand-500 disabled:opacity-50"
                >
                  {saving ? 'Creating…' : 'Create from Template'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Upload Document Modal (general) ───────────────────────── */
function UploadModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (doc: OrgDocument) => void
}) {
  const fileRef                   = useRef<HTMLInputElement>(null)
  const [fileName, setFileName]   = useState('')
  const [docName, setDocName]     = useState('')
  const [category, setCategory]   = useState('other')
  const [expiry, setExpiry]       = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFileName(f.name)
    if (!docName) setDocName(f.name.replace(/\.[^.]+$/, ''))
  }

  async function submit() {
    if (!docName.trim()) { setError('Document name is required'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:     docName.trim(),
        category,
        expires_at:  expiry || null,
        uploaded_by: 'You',
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to save'); setSaving(false); return }
    onCreated(data.document)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Upload size={18} className="text-brand-400" />
            Upload Document
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
              fileName ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-brand-400 hover:bg-blue-50'
            }`}
          >
            <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.png,.jpg,.jpeg" className="hidden" onChange={handleFile} />
            {fileName ? (
              <>
                <FileCheck size={24} className="mx-auto text-emerald-500 mb-1" />
                <p className="text-sm font-semibold text-emerald-700">{fileName}</p>
                <p className="text-xs text-emerald-500 mt-0.5">Click to change</p>
              </>
            ) : (
              <>
                <Upload size={24} className="mx-auto text-slate-300 mb-1" />
                <p className="text-sm font-semibold text-slate-600">Click to upload</p>
                <p className="text-xs text-slate-400 mt-0.5">PDF, DOCX, DOC, or image</p>
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Document Name <span className="text-red-400">*</span></label>
            <input
              value={docName}
              onChange={e => setDocName(e.target.value)}
              placeholder="e.g. Property Insurance Certificate 2026"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
              >
                {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Expiry Date</label>
              <input
                type="date"
                value={expiry}
                onChange={e => setExpiry(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 h-9 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="flex-1 h-9 bg-brand-400 text-white rounded-lg text-sm font-semibold hover:bg-brand-500 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Document'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Main page ──────────────────────────────────────────────── */
export default function DocumentsPage() {
  const [activeTab, setActiveTab]         = useState<DocCategory>('all')
  const [q, setQ]                         = useState('')
  const [documents, setDocuments]         = useState<OrgDocument[]>([])
  const [loading, setLoading]             = useState(true)
  const [showNewContract, setShowNewContract] = useState(false)
  const [showUpload, setShowUpload]       = useState(false)

  useEffect(() => {
    fetch('/api/documents')
      .then(r => r.json())
      .then(d => setDocuments(d.documents ?? []))
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false))
  }, [])

  function handleDocCreated(doc: OrgDocument) {
    setDocuments(prev => [doc, ...prev])
    setShowNewContract(false)
    setShowUpload(false)
  }

  const filtered = documents.filter(d => {
    const catMatch = activeTab === 'all' || d.category === activeTab
    const qMatch   = !q.trim() || d.name.toLowerCase().includes(q.toLowerCase())
    return catMatch && qMatch
  })

  const tabCount = (key: DocCategory) =>
    key === 'all' ? documents.length : documents.filter(d => d.category === key).length

  return (
    <div className="flex flex-col min-h-full bg-[#F8FAFC]">
      <TopBar
        title="Documents"
        subtitle="Agreements, permits, certificates, insurance, manuals, and legal docs"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              <Upload size={14} /> Upload
            </button>
            <button
              onClick={() => setShowNewContract(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-400 text-white rounded-lg text-sm font-semibold hover:bg-brand-500 transition-colors"
            >
              <Plus size={15} /> New Contract
            </button>
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-5 max-w-screen-xl mx-auto w-full">

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
            <FolderOpen size={48} className="mb-4 opacity-20" />
            <p className="font-semibold text-slate-600 text-lg">No documents found</p>
            <p className="text-sm mt-1 text-slate-400">
              {q ? 'Try a different search term' : 'Add your first document to get started'}
            </p>
            {!q && (
              <div className="flex items-center gap-3 mt-5">
                <button
                  onClick={() => setShowUpload(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50"
                >
                  <Upload size={14} /> Upload Document
                </button>
                <button
                  onClick={() => setShowNewContract(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-400 text-white rounded-lg text-sm font-semibold hover:bg-brand-500"
                >
                  <Plus size={14} /> New Contract
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map(doc => <DocCard key={doc.id} doc={doc} />)}
          </div>
        )}
      </div>

      {showNewContract && (
        <NewContractModal
          onClose={() => setShowNewContract(false)}
          onCreated={handleDocCreated}
        />
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onCreated={handleDocCreated}
        />
      )}
    </div>
  )
}
