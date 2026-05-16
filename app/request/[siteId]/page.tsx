'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, AlertTriangle, ChevronDown, Shield } from 'lucide-react'

interface SiteInfo {
  id: string
  name: string
  address?: string
  city?: string
  state?: string
}

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: '🔴 Urgent — Safety issue or gate completely down' },
  { value: 'high',   label: '🟠 High — Major issue affecting daily operations' },
  { value: 'normal', label: '🔵 Normal — Needs attention within a few days' },
  { value: 'low',    label: '⚪ Low — Minor issue, no rush' },
]

export default function RequestPortalPage() {
  const { siteId } = useParams<{ siteId: string }>()

  const [site, setSite]       = useState<SiteInfo | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]     = useState('')

  const [form, setForm] = useState({
    title:              '',
    description:        '',
    area:               '',
    priority_requested: 'normal',
    contact_name:       '',
    contact_email:      '',
    contact_phone:      '',
  })

  // Load site info on mount
  useEffect(() => {
    fetch(`/api/sites/${siteId}`)
      .then(r => r.json())
      .then(json => {
        if (json.site) setSite(json.site)
        else setNotFound(true)
      })
      .catch(() => setNotFound(true))
  }, [siteId])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('Please enter a brief description of the issue.'); return }
    if (!form.contact_email.trim() && !form.contact_phone.trim()) {
      setError('Please provide at least one way to contact you (email or phone).')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res  = await fetch('/api/request', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ site_id: siteId, ...form }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Submit failed')
      setSubmitted(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submit failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────

  if (!site && !notFound) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#6B7EFF] border-t-transparent rounded-full" />
      </div>
    )
  }

  // ── Not found ────────────────────────────────────────────────────

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-200 flex items-center justify-center mb-4">
          <AlertTriangle size={28} className="text-slate-400" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Property Not Found</h1>
        <p className="text-slate-500 text-sm">This request portal link is no longer valid. Please contact your property manager for an updated link.</p>
      </div>
    )
  }

  // ── Submitted ────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={36} className="text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Request Submitted</h1>
          <p className="text-slate-500 mb-6">
            Your maintenance request for <strong>{site!.name}</strong> has been received.
            Our team will review it and follow up with you shortly.
          </p>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 text-left">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">What happens next</div>
            <div className="space-y-3">
              {[
                { step: '1', text: 'Your dealer receives a notification' },
                { step: '2', text: 'A work order is created and scheduled' },
                { step: '3', text: 'You\'ll receive email updates as the tech is en route and when work is complete' },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#6B7EFF]/10 text-[#6B7EFF] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{s.step}</div>
                  <p className="text-sm text-slate-600">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => { setSubmitted(false); setForm({ title: '', description: '', area: '', priority_requested: 'normal', contact_name: '', contact_email: '', contact_phone: '' }) }}
            className="mt-5 text-sm text-[#6B7EFF] hover:underline"
          >
            Submit another request
          </button>
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────

  const inp = 'w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-white placeholder:text-slate-300'
  const lbl = 'block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5'

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-[#0C111D] px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#6B7EFF]/20 flex items-center justify-center">
          <Shield size={15} className="text-[#6B7EFF]" />
        </div>
        <div>
          <span className="text-white font-bold text-sm">Gate<span className="text-[#6B7EFF]">Guard</span></span>
          <span className="text-slate-500 text-xs ml-2">Maintenance Request</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Property header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{site!.name}</h1>
          {(site!.city || site!.address) && (
            <p className="text-sm text-slate-400 mt-0.5">
              {[site!.address, site!.city, site!.state].filter(Boolean).join(', ')}
            </p>
          )}
          <p className="text-sm text-slate-500 mt-2">
            Use this form to submit a maintenance or service request. Our team will follow up promptly.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Issue title */}
          <div>
            <label className={lbl}>Issue Title *</label>
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Gate won't open, Camera offline, Intercom not working"
              className={inp}
            />
          </div>

          {/* Description */}
          <div>
            <label className={lbl}>Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
              placeholder="Describe what's happening in detail — any error messages, when it started, how often it occurs…"
              className={`${inp} resize-none`}
            />
          </div>

          {/* Area + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Area / Location</label>
              <input
                value={form.area}
                onChange={e => set('area', e.target.value)}
                placeholder="e.g. Main Gate, Bldg A"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Priority</label>
              <div className="relative">
                <select
                  value={form.priority_requested}
                  onChange={e => set('priority_requested', e.target.value)}
                  className={`${inp} appearance-none pr-8`}
                >
                  {PRIORITY_OPTIONS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="pt-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Your Contact Information</p>
          </div>

          <div>
            <label className={lbl}>Your Name</label>
            <input
              value={form.contact_name}
              onChange={e => set('contact_name', e.target.value)}
              placeholder="Full name"
              className={inp}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Email</label>
              <input
                type="email"
                value={form.contact_email}
                onChange={e => set('contact_email', e.target.value)}
                placeholder="you@example.com"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Phone</label>
              <input
                type="tel"
                value={form.contact_phone}
                onChange={e => set('contact_phone', e.target.value)}
                placeholder="(555) 000-0000"
                className={inp}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-[#6B7EFF] hover:bg-[#5a6de0] text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50 shadow-lg shadow-[#6B7EFF]/20"
          >
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>

          <p className="text-center text-xs text-slate-400">
            Powered by <span className="font-semibold text-slate-500">GateGuard</span>
          </p>
        </form>
      </div>
    </div>
  )
}
