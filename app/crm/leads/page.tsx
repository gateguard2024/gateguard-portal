'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Search, Plus, Building2, MapPin, Phone, Mail,
  Hash, Clock, TrendingUp, Filter, ChevronRight,
  Users, Star, AlertCircle, CheckCircle2, XCircle,
  Send, X, Loader2,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'

interface Lead {
  id: string
  name: string
  contact: string
  email: string
  phone: string | null
  propertyType: string
  units: number | null
  location: string
  stage: string
  source: string
  rep: string
  lastActivity: string
  assigned_dealer: string | null
}

interface CampaignPreview {
  total: number
  eligible: number
  skipped: number
  preview: {
    to: string
    subject: string
    html: string
  }
}

const STAGE_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  new:         { label: 'New',         color: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400'  },
  contacted:   { label: 'Contacted',   color: 'bg-blue-100 text-blue-700',      dot: 'bg-blue-500'   },
  qualifying:  { label: 'Qualifying',  color: 'bg-indigo-100 text-indigo-700',  dot: 'bg-indigo-500' },
  site_walk:   { label: 'Site Walk',   color: 'bg-amber-100 text-amber-700',    dot: 'bg-amber-500'  },
  proposal:    { label: 'Proposal',    color: 'bg-orange-100 text-orange-700',  dot: 'bg-orange-500' },
  negotiation: { label: 'Negotiation', color: 'bg-rose-100 text-rose-700',      dot: 'bg-rose-500'   },
  won:         { label: 'Won',         color: 'bg-emerald-100 text-emerald-700',dot: 'bg-emerald-500'},
  lost:        { label: 'Lost',        color: 'bg-red-100 text-red-600',        dot: 'bg-red-400'    },
}

const STAGES = Object.keys(STAGE_CONFIG)

function StagePill({ stage }: { stage: string }) {
  const cfg = STAGE_CONFIG[stage] ?? STAGE_CONFIG.new
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ─── Campaign Modal ──────────────────────────────────────────────────────────
function CampaignModal({ onClose }: { onClose: () => void }) {
  const [step, setStep]       = useState<'loading' | 'preview' | 'sending' | 'done' | 'error'>('loading')
  const [preview, setPreview] = useState<CampaignPreview | null>(null)
  const [result, setResult]   = useState<{ sent: number; failed: number; skipped: number } | null>(null)
  const [errMsg, setErrMsg]   = useState('')
  const [showHtml, setShowHtml] = useState(false)

  useEffect(() => {
    fetch('/api/crm/leads/campaign')
      .then(r => r.json())
      .then(data => {
        if (data.error) { setErrMsg(data.error); setStep('error'); return }
        setPreview(data)
        setStep('preview')
      })
      .catch(e => { setErrMsg(e.message); setStep('error') })
  }, [])

  async function handleSend() {
    if (!preview) return
    setStep('sending')
    try {
      const res  = await fetch('/api/crm/leads/campaign', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({}),
      })
      const data = await res.json()
      if (data.error) { setErrMsg(data.error); setStep('error'); return }
      setResult(data)
      setStep('done')
    } catch (e: any) {
      setErrMsg(e.message)
      setStep('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card w-[680px] max-h-[90vh] rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <Send size={14} className="text-violet-600" />
            </div>
            <div>
              <div className="font-semibold text-foreground text-sm">Show Lead Campaign</div>
              <div className="text-xs text-muted-foreground">Post-show follow-up email</div>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Loading */}
          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Loader2 size={28} className="animate-spin text-brand-400" />
              <p className="text-sm">Loading campaign preview…</p>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertCircle size={36} className="text-red-400" />
              <p className="font-medium text-red-600">Something went wrong</p>
              <p className="text-xs text-muted-foreground max-w-xs text-center">{errMsg}</p>
            </div>
          )}

          {/* Preview */}
          {step === 'preview' && preview && (
            <div className="space-y-5">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-center">
                  <div className="text-2xl font-bold text-blue-700">{preview.eligible}</div>
                  <div className="text-xs text-blue-600 mt-0.5">Leads with email</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center">
                  <div className="text-2xl font-bold text-slate-600">{preview.total}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Total leads</div>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-center">
                  <div className="text-2xl font-bold text-amber-600">{preview.skipped}</div>
                  <div className="text-xs text-amber-600 mt-0.5">No email (skipped)</div>
                </div>
              </div>

              {/* Subject line */}
              <div className="bg-muted/50 rounded-xl border border-border p-4">
                <div className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Subject Line</div>
                <div className="text-sm font-medium text-foreground">{preview.preview.subject}</div>
                <div className="text-xs text-muted-foreground mt-1">From: Russel Feldman &lt;rfeldman@gateguard.co&gt;</div>
              </div>

              {/* Email preview toggle */}
              <div>
                <button
                  onClick={() => setShowHtml(v => !v)}
                  className="text-xs text-brand-400 hover:underline font-medium"
                >
                  {showHtml ? '▲ Hide' : '▼ Preview'} email template
                </button>

                {showHtml && (
                  <div className="mt-3 border border-border rounded-xl overflow-hidden" style={{ height: 360 }}>
                    <iframe
                      srcDoc={preview.preview.html}
                      className="w-full h-full"
                      title="Email preview"
                      sandbox="allow-same-origin"
                    />
                  </div>
                )}
              </div>

              {/* What's personalized */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                <div className="text-xs font-semibold text-emerald-700 mb-2 uppercase tracking-wide">Personalized per lead</div>
                <div className="text-xs text-emerald-800 space-y-1">
                  <div>• First name extracted from contact name</div>
                  <div>• Property name used in the NOI example and CTA link</div>
                  <div>• Reply-to: rfeldman@gateguard.co</div>
                </div>
              </div>

              {preview.eligible === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                  No leads have email addresses — nothing to send. Add emails to your leads first.
                </div>
              )}
            </div>
          )}

          {/* Sending */}
          {step === 'sending' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 size={36} className="animate-spin text-brand-400" />
              <div className="text-center">
                <p className="font-semibold text-foreground">Sending campaign…</p>
                <p className="text-sm text-muted-foreground mt-1">Delivering {preview?.eligible} personalized emails via Resend</p>
              </div>
            </div>
          )}

          {/* Done */}
          {step === 'done' && result && (
            <div className="space-y-5">
              <div className="flex flex-col items-center py-6 gap-3">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 size={32} className="text-emerald-600" />
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-foreground">{result.sent} emails sent</p>
                  <p className="text-sm text-muted-foreground mt-1">Campaign delivered successfully</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-center">
                  <div className="text-2xl font-bold text-emerald-700">{result.sent}</div>
                  <div className="text-xs text-emerald-600 mt-0.5">Delivered</div>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-center">
                  <div className="text-2xl font-bold text-red-600">{result.failed}</div>
                  <div className="text-xs text-red-500 mt-0.5">Failed</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center">
                  <div className="text-2xl font-bold text-slate-500">{result.skipped}</div>
                  <div className="text-xs text-slate-400 mt-0.5">Skipped (no email)</div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700">
                Replies will come directly to rfeldman@gateguard.co. Check your inbox — follow up with anyone who responds within 24 hours for best conversion.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 flex items-center justify-end gap-3">
          {(step === 'error' || step === 'done') && (
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium bg-brand-400 text-white rounded-lg hover:bg-brand-500 transition-colors">
              Close
            </button>
          )}
          {step === 'preview' && (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-accent transition-colors text-muted-foreground">
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!preview || preview.eligible === 0}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-brand-400 text-white rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={13} />
                Send to {preview?.eligible} leads
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const [leads, setLeads]         = useState<Lead[]>([])
  const [loading, setLoading]     = useState(true)
  const [q, setQ]                 = useState('')
  const [filterStage, setFilter]  = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [showCampaign, setShowCampaign] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/api/crm/leads')
      .then(r => r.json())
      .then(data => {
        const mapped = (Array.isArray(data) ? data : []).map((d: any) => ({
          id:              d.id,
          name:            d.name || d.property_name || d.contact_name || 'Unnamed Lead',
          contact:         d.contact || d.contact_name || '',
          email:           d.email || '',
          phone:           d.phone || null,
          propertyType:    d.propertyType || 'Multifamily',
          units:           d.units || null,
          location:        d.location || '',
          stage:           d.stage || 'new',
          source:          d.source || 'show',
          rep:             d.rep || 'R. Feldman',
          lastActivity:    d.lastActivity || '—',
          assigned_dealer: d.assigned_dealer || null,
        }))
        setLeads(mapped)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = leads.filter(l => {
    const matchQ = !q || [l.name, l.contact, l.location, l.email].some(
      v => v?.toLowerCase().includes(q.toLowerCase())
    )
    const matchStage = !filterStage || l.stage === filterStage
    return matchQ && matchStage
  })

  const counts = STAGES.reduce((acc, s) => {
    acc[s] = leads.filter(l => l.stage === s).length
    return acc
  }, {} as Record<string, number>)

  const showLeads = leads.filter(l => l.source === 'show')

  const statCards = [
    { label: 'Total Leads',  value: leads.length,                       icon: Users,        color: 'bg-slate-100 text-slate-600'   },
    { label: 'New',          value: counts.new || 0,                    icon: Star,         color: 'bg-blue-100 text-blue-600'     },
    { label: 'In Progress',  value: (counts.contacted || 0) + (counts.qualifying || 0) + (counts.site_walk || 0) + (counts.proposal || 0) + (counts.negotiation || 0),
                                                                         icon: TrendingUp,   color: 'bg-violet-100 text-violet-600' },
    { label: 'Won',          value: counts.won || 0,                    icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600'},
    { label: 'Lost',         value: counts.lost || 0,                   icon: XCircle,      color: 'bg-red-100 text-red-600'       },
  ]

  return (
    <div className="flex flex-col min-h-full">
      {showCampaign && <CampaignModal onClose={() => setShowCampaign(false)} />}

      <TopBar
        title="Leads"
        subtitle={`${leads.length} total leads`}
        actions={
          <div className="flex items-center gap-2">
            {showLeads.length > 0 && (
              <button
                onClick={() => setShowCampaign(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors shadow-sm"
              >
                <Send size={12} />
                Send Show Campaign ({showLeads.length})
              </button>
            )}
            <Link
              href="/crm"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-accent transition-colors text-muted-foreground"
            >
              ← Pipeline
            </Link>
          </div>
        }
      />

      <div className="flex-1 p-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
                <Icon size={16} />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">{value}</div>
                <div className="text-[11px] text-muted-foreground">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Search + Filter */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by property, contact, or location…"
              className="w-full pl-9 pr-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 bg-background"
            />
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-2 px-3 py-2.5 text-sm border rounded-lg transition-colors ${
              filterStage ? 'border-brand-400 bg-brand-50 text-brand-400' : 'border-border hover:bg-accent text-muted-foreground'
            }`}
          >
            <Filter size={14} />
            {filterStage ? STAGE_CONFIG[filterStage]?.label : 'Filter'}
          </button>
        </div>

        {/* Stage filter pills */}
        {showFilters && (
          <div className="flex flex-wrap gap-2 mb-4 p-3 bg-muted/40 rounded-xl border border-border">
            <button
              onClick={() => { setFilter(null); setShowFilters(false) }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                !filterStage ? 'bg-brand-400 text-white border-brand-400' : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              All ({leads.length})
            </button>
            {STAGES.map(s => {
              const cfg = STAGE_CONFIG[s]
              return (
                <button
                  key={s}
                  onClick={() => { setFilter(f => f === s ? null : s); setShowFilters(false) }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    filterStage === s ? cfg.color + ' border-transparent' : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {cfg.label} {counts[s] > 0 && `(${counts[s]})`}
                </button>
              )
            })}
          </div>
        )}

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <div className="animate-spin w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full mr-3" />
              Loading leads…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <AlertCircle size={36} className="mb-3 opacity-20" />
              <p className="font-medium">{q || filterStage ? 'No leads match your filters' : 'No leads yet'}</p>
              {(q || filterStage) && (
                <button onClick={() => { setQ(''); setFilter(null) }} className="mt-2 text-sm text-brand-400 hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Property / Contact</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Location</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Stage</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Source</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Contact Info</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Activity</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(lead => (
                  <tr key={lead.id} className="hover:bg-muted/30 group transition-colors">
                    {/* Property + Contact */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                          <Building2 size={14} className="text-blue-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{lead.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            {lead.contact}
                            {lead.units && (
                              <>
                                <span className="text-border">·</span>
                                <Hash size={9} />
                                <span>{lead.units} units</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3.5">
                      {lead.location ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin size={11} className="shrink-0" />
                          {lead.location}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </td>

                    {/* Stage */}
                    <td className="px-4 py-3.5">
                      <StagePill stage={lead.stage} />
                    </td>

                    {/* Source */}
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-600 rounded-full capitalize">
                        {lead.source}
                      </span>
                    </td>

                    {/* Contact Info */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-0.5">
                        {lead.email && (
                          <a href={`mailto:${lead.email}`} onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand-400 transition-colors">
                            <Mail size={10} />
                            {lead.email}
                          </a>
                        )}
                        {lead.phone && (
                          <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand-400 transition-colors">
                            <Phone size={10} />
                            {lead.phone}
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Last Activity */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock size={10} />
                        {lead.lastActivity}
                      </div>
                    </td>

                    {/* Arrow */}
                    <td className="px-4 py-3.5 text-right">
                      <Link href={`/crm/leads/${lead.id}`} className="inline-flex items-center gap-1 text-xs text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                        View <ChevronRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3 text-right">
            Showing {filtered.length} of {leads.length} leads
          </p>
        )}
      </div>
    </div>
  )
}
