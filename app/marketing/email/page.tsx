'use client'

import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import {
  Mail, Plus, Eye, Copy, Send, Search,
  FileText, Users, Zap, ChevronRight, Star,
} from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Edit2, Tag } = require('lucide-react') as any

// ─── Template Definitions ─────────────────────────────────────────────────────

interface EmailTemplate {
  id: string
  name: string
  category: 'outreach' | 'follow_up' | 'newsletter' | 'onboarding' | 'campaign'
  subject: string
  description: string
  tags: string[]
  lastUsed: string | null
  useCount: number
  status: 'active' | 'draft'
  preview: string  // short HTML or text snippet
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  outreach:   { label: 'Outreach',   color: 'text-blue-700',   bg: 'bg-blue-100',   icon: Send     },
  follow_up:  { label: 'Follow-Up',  color: 'text-violet-700', bg: 'bg-violet-100', icon: Zap      },
  newsletter: { label: 'Newsletter', color: 'text-emerald-700',bg: 'bg-emerald-100',icon: FileText },
  onboarding: { label: 'Onboarding', color: 'text-amber-700',  bg: 'bg-amber-100',  icon: Users    },
  campaign:   { label: 'Campaign',   color: 'text-rose-700',   bg: 'bg-rose-100',   icon: Star     },
}

const TEMPLATES: EmailTemplate[] = [
  {
    id: 'show-followup',
    name: 'Show Lead Follow-Up',
    category: 'campaign',
    subject: 'Great meeting you at the show — let\'s put real numbers together',
    description: 'Post-show outreach for Atlanta_2026 leads. Highlights the $150 move-in fee + $10/month model, NOI lift, and free site evaluation CTA.',
    tags: ['Atlanta 2026', 'Show Leads', 'Property Managers'],
    lastUsed: 'Today',
    useCount: 0,
    status: 'active',
    preview: 'Hi [First Name], It was great connecting with you at the show...',
  },
  {
    id: 'site-eval-confirm',
    name: 'Site Evaluation Confirmation',
    category: 'onboarding',
    subject: 'Confirmed: Your free GateGuard site evaluation',
    description: 'Sent after a PM books a site evaluation. Confirms date/time, sets expectations for the 30-min walkthrough, and provides your contact info.',
    tags: ['Site Eval', 'Confirmation'],
    lastUsed: null,
    useCount: 0,
    status: 'draft',
    preview: 'Hi [First Name], We\'re confirmed for your free site evaluation at [Property]...',
  },
  {
    id: 'proposal-sent',
    name: 'Proposal Follow-Up',
    category: 'follow_up',
    subject: 'Your GateGuard proposal for [Property Name]',
    description: 'Sent after delivering a quote. Summarizes key line items, links to the online approval page, and offers a quick call to answer questions.',
    tags: ['Proposal', 'Quote', 'CRM'],
    lastUsed: null,
    useCount: 0,
    status: 'draft',
    preview: 'Hi [First Name], I wanted to follow up on the proposal I sent over for [Property]...',
  },
  {
    id: 'no-response-7d',
    name: '7-Day No-Response Nudge',
    category: 'follow_up',
    subject: 'Still thinking it over? Happy to answer any questions',
    description: 'Friendly bump for leads or opportunities that haven\'t responded in 7 days. Short, no pressure, offers a 15-minute call.',
    tags: ['Follow-Up', 'Sequence', 'No Response'],
    lastUsed: null,
    useCount: 0,
    status: 'draft',
    preview: 'Hi [First Name], I know things get busy — just wanted to check in...',
  },
  {
    id: 'welcome-dealer',
    name: 'New Dealer Welcome',
    category: 'onboarding',
    subject: 'Welcome to the GateGuard dealer network',
    description: 'Sent when a dealer is onboarded. Links to the portal, tech tool, KB, and introduces the GateGuard support team.',
    tags: ['Dealer', 'Onboarding', 'Welcome'],
    lastUsed: null,
    useCount: 0,
    status: 'draft',
    preview: 'Welcome to GateGuard! We\'re excited to have you in the network...',
  },
  {
    id: 'monthly-newsletter',
    name: 'Monthly Property Manager Newsletter',
    category: 'newsletter',
    subject: '[Month] — GateGuard Property Digest',
    description: 'Monthly newsletter for installed property managers. Includes uptime stats, upcoming maintenance reminders, GateCard feature updates, and industry news.',
    tags: ['Newsletter', 'Property Managers', 'Monthly'],
    lastUsed: null,
    useCount: 0,
    status: 'draft',
    preview: 'Here\'s what\'s happening at your properties this month...',
  },
]

// ─── Components ───────────────────────────────────────────────────────────────

function CategoryChip({ category }: { category: string }) {
  const cfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.outreach
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.color}`}>
      <Icon size={10} />
      {cfg.label}
    </span>
  )
}

function StatusDot({ status }: { status: 'active' | 'draft' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${status === 'active' ? 'text-emerald-600' : 'text-slate-400'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
      {status === 'active' ? 'Active' : 'Draft'}
    </span>
  )
}

// ─── Preview Modal ─────────────────────────────────────────────────────────────
function PreviewModal({ template, onClose }: { template: EmailTemplate; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card w-[720px] max-h-[90vh] rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <div className="font-semibold text-foreground">{template.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Subject: {template.subject}</div>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-accent transition-colors text-muted-foreground"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-xl border border-border p-4">
              <div className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Description</div>
              <p className="text-sm text-foreground">{template.description}</p>
            </div>
            <div className="bg-muted/50 rounded-xl border border-border p-4">
              <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Preview</div>
              <p className="text-sm text-muted-foreground italic">{template.preview}</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
              Full HTML preview and editing coming soon. Templates will be editable inline with live preview and variable substitution.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── New Template Modal ────────────────────────────────────────────────────────
function NewTemplateModal({ onClose }: { onClose: () => void }) {
  const [name, setName]         = useState('')
  const [category, setCategory] = useState('outreach')
  const [subject, setSubject]   = useState('')
  const [description, setDesc]  = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card w-[560px] rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-400/10 flex items-center justify-center">
              <Plus size={14} className="text-brand-400" />
            </div>
            <div>
              <div className="font-semibold text-foreground text-sm">New Email Template</div>
              <div className="text-xs text-muted-foreground">Add to your template library</div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Template Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. 30-Day Follow-Up"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-brand-400/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-brand-400/30"
            >
              {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Subject Line</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Following up on [Property Name]"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-brand-400/30"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Use [First Name], [Property], [Date] for personalization</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Description</label>
            <textarea
              value={description}
              onChange={e => setDesc(e.target.value)}
              rows={3}
              placeholder="What is this template for? When should it be used?"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-brand-400/30 resize-none"
            />
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            After creating, you'll be able to add the full HTML body, set up personalization variables, and build automated sequences.
          </div>
        </div>

        <div className="border-t border-border px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-accent transition-colors text-muted-foreground">
            Cancel
          </button>
          <button
            disabled={!name.trim() || !subject.trim()}
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold bg-brand-400 text-white rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Template
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function EmailTemplatesPage() {
  const [q, setQ]                   = useState('')
  const [filterCat, setFilterCat]   = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<EmailTemplate | null>(null)
  const [showNew, setShowNew]       = useState(false)

  const filtered = TEMPLATES.filter(t => {
    const matchQ = !q || [t.name, t.subject, t.description, ...t.tags]
      .some(v => v.toLowerCase().includes(q.toLowerCase()))
    const matchCat = !filterCat || t.category === filterCat
    return matchQ && matchCat
  })

  const active = TEMPLATES.filter(t => t.status === 'active').length
  const draft  = TEMPLATES.filter(t => t.status === 'draft').length

  return (
    <div className="flex flex-col min-h-full">
      {previewing && <PreviewModal template={previewing} onClose={() => setPreviewing(null)} />}
      {showNew && <NewTemplateModal onClose={() => setShowNew(false)} />}

      <TopBar
        title="Email Templates"
        subtitle={`${TEMPLATES.length} templates · ${active} active`}
        actions={
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-brand-400 text-white rounded-lg hover:bg-brand-500 transition-colors shadow-sm"
          >
            <Plus size={12} />
            New Template
          </button>
        }
      />

      <div className="flex-1 p-6 space-y-6">

        {/* Stat bar */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Templates', value: TEMPLATES.length, color: 'text-foreground', bg: 'bg-card border-border' },
            { label: 'Active',          value: active,           color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
            { label: 'Draft',           value: draft,            color: 'text-slate-500',   bg: 'bg-slate-50 border-slate-200' },
            { label: 'Emails Sent',     value: '—',              color: 'text-brand-400',   bg: 'bg-brand-400/5 border-brand-400/20' },
          ].map(stat => (
            <div key={stat.label} className={`rounded-xl border px-4 py-3 ${stat.bg}`}>
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search templates…"
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-brand-400/30"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilterCat(null)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${!filterCat ? 'bg-brand-400 text-white' : 'border border-border hover:bg-accent text-muted-foreground'}`}
            >
              All
            </button>
            {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setFilterCat(filterCat === key ? null : key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filterCat === key ? `${cfg.bg} ${cfg.color}` : 'border border-border hover:bg-accent text-muted-foreground'}`}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Template grid */}
        <div className="grid grid-cols-1 gap-3">
          {filtered.map(template => {
            const catCfg = CATEGORY_CONFIG[template.category]
            return (
              <div
                key={template.id}
                className="group bg-card border border-border rounded-xl p-5 hover:border-brand-400/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-2">
                      <CategoryChip category={template.category} />
                      <StatusDot status={template.status} />
                      {template.lastUsed && (
                        <span className="text-[11px] text-muted-foreground">Used {template.lastUsed}</span>
                      )}
                    </div>

                    <div className="font-semibold text-foreground text-sm mb-0.5">{template.name}</div>
                    <div className="text-xs text-muted-foreground mb-2">Subject: {template.subject}</div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {template.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-muted text-muted-foreground">
                          <Tag size={9} />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => setPreviewing(template)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-accent transition-colors text-muted-foreground"
                    >
                      <Eye size={12} />
                      Preview
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-accent transition-colors text-muted-foreground">
                      <Copy size={12} />
                      Duplicate
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand-400 text-white rounded-lg hover:bg-brand-500 transition-colors">
                      <Edit2 size={12} />
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Mail size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No templates found</p>
              <p className="text-sm mt-1">Try a different search or filter</p>
            </div>
          )}
        </div>

        {/* Roadmap callout */}
        <div className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-100 rounded-2xl p-5">
          <div className="font-semibold text-violet-900 mb-1">Coming soon: Campaigns & Sequences</div>
          <p className="text-sm text-violet-700 mb-4">
            Build automated follow-up sequences, schedule one-off campaign blasts to any lead segment, and track opens/replies — all wired to your CRM leads and opportunities.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Zap,      title: 'Drip Sequences',    desc: 'Automated multi-step follow-ups triggered by lead stage' },
              { icon: Users,    title: 'Audience Segments', desc: 'Target by source, stage, location, property type, or custom tag' },
              { icon: ChevronRight, title: 'Open & Reply Tracking', desc: 'See who opened, clicked, or replied — right in CRM' },
            ].map(item => (
              <div key={item.title} className="bg-white/70 rounded-xl p-3 border border-white">
                <item.icon size={14} className="text-violet-600 mb-1.5" />
                <div className="text-xs font-semibold text-violet-900">{item.title}</div>
                <div className="text-[11px] text-violet-600 mt-0.5">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
