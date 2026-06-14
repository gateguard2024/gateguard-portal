'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { NexusDocShell } from '@/components/public/NexusDocShell'
import type { DocView } from '@/lib/doc-status'

type DocData = {
  document_type: string
  type_label: string
  status: string
  recipient_name: string | null
  recipient_company: string | null
  sent_by_name: string
  document_html: string | null
  document_url: string | null
  executed_cert_url: string | null
  signed_at: string | null
  executed_at: string | null
}

const BRAND = '#6B7EFF'

function Steps({ steps, activeIndex }: { steps: string[]; activeIndex: number }) {
  if (!steps.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
              style={{ background: i <= activeIndex ? BRAND : '#e2e8f0', color: i <= activeIndex ? '#fff' : '#94a3b8' }}>{i + 1}</span>
            <span className="text-xs font-medium" style={{ color: i <= activeIndex ? '#334155' : '#94a3b8' }}>{s}</span>
          </div>
          {i < steps.length - 1 && <span className="text-slate-300">→</span>}
        </div>
      ))}
    </div>
  )
}

function DocFrame({ html, url }: { html: string | null; url: string | null }) {
  if (html) {
    return <iframe title="Document" srcDoc={html} className="w-full rounded-xl border border-slate-200 bg-white" style={{ minHeight: 560 }} />
  }
  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: BRAND }}>
        Open Document (PDF) ↗
      </a>
    )
  }
  return <p className="text-sm text-slate-400">Document content is being prepared.</p>
}

export default function PublicDocumentPage() {
  const { slug } = useParams<{ slug: string }>()
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [view, setView] = useState<DocView | null>(null)
  const [doc, setDoc] = useState<DocData | null>(null)

  // action state
  const [signedName, setSignedName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [panel, setPanel] = useState<'changes' | 'question' | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const res = await fetch(`/api/document/${slug}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) { setErr(data?.reason ?? 'unavailable'); setView(null); setDoc(null) }
      else { setView(data.view); setDoc(data.document) }
    } catch { setErr('unavailable') }
    finally { setLoading(false) }
  }, [slug])

  useEffect(() => { void load() }, [load])

  async function act(payload: Record<string, unknown>) {
    setBusy(true); setFlash(null)
    try {
      const res = await fetch(`/api/document/${slug}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) throw new Error(data?.message ?? 'Something went wrong.')
      setPanel(null); setMessage('')
      await load()
    } catch (e) { setFlash(e instanceof Error ? e.message : 'Something went wrong.') }
    finally { setBusy(false) }
  }

  // ── Loading / error frames ──
  if (loading) {
    return <NexusDocShell><div className="px-8 py-16 text-center text-sm text-slate-400">Loading document…</div></NexusDocShell>
  }
  if (err || !view || !doc) {
    const expired = err === 'expired'
    return (
      <NexusDocShell>
        <div className="px-8 py-16 text-center">
          <h1 className="text-xl font-bold text-slate-800">{expired ? 'This link has expired' : 'Document unavailable'}</h1>
          <p className="mt-2 text-sm text-slate-500">{expired ? 'Please contact GateGuard for a new link.' : 'This document link is not valid or is no longer available.'}</p>
          <p className="mt-4 text-xs text-slate-400">Questions? rfeldman@gateguard.co</p>
        </div>
      </NexusDocShell>
    )
  }

  const activeStep = view.stage === 'final' ? view.steps.length - 1 : view.stage === 'awaiting_counter' ? 1 : 0

  return (
    <NexusDocShell onDownload={doc.document_url ? () => window.open(doc.document_url!, '_blank') : undefined}>
      <div className="px-5 sm:px-8 py-8 space-y-6">

        {/* Main card */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND }}>{view.statusLabel}</p>
          <h1 className="text-2xl font-bold text-slate-900">{doc.type_label}</h1>
          <p className="text-sm text-slate-500">
            Prepared for <strong className="text-slate-700">{doc.recipient_company || doc.recipient_name || 'you'}</strong> · Sent by {doc.sent_by_name}
          </p>
          <div className="pt-2"><Steps steps={view.steps} activeIndex={activeStep} /></div>
        </div>

        {flash && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{flash}</div>}

        {/* Final / executed */}
        {view.stage === 'final' && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <p className="text-base font-semibold text-emerald-800">Document Complete</p>
            {doc.executed_cert_url
              ? <a href={doc.executed_cert_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ background: '#059669' }}>Open Final Copy ↗</a>
              : <p className="mt-2 text-sm text-emerald-700">Thank you — no further action is needed.</p>}
          </div>
        )}

        {/* Awaiting GateGuard countersignature */}
        {view.stage === 'awaiting_counter' && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            You’ve signed. This is now with GateGuard for countersignature — you’ll get the fully executed copy by email.
          </div>
        )}

        {view.stage === 'declined' && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">This document was declined. Contact GateGuard if this was a mistake.</div>}

        {/* Review document (always show the doc unless unavailable) */}
        {(view.stage === 'review' || view.stage === 'awaiting_counter' || view.stage === 'final') && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Document</h2>
            <DocFrame html={doc.document_html} url={doc.document_url} />
          </div>
        )}

        {/* Sign action (signature docs) */}
        {view.stage === 'review' && view.canSign && (
          <div className="rounded-2xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Sign &amp; Accept</h2>
            <input value={signedName} onChange={e => setSignedName(e.target.value)} placeholder="Type your full name"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
            <label className="flex items-start gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5" />
              <span>I have read and agree to the terms of this {doc.type_label}, and consent to signing electronically (legally binding under the ESIGN Act &amp; UETA).</span>
            </label>
            <button disabled={busy || !agreed || !signedName.trim()} onClick={() => act({ action: 'sign', signed_name: signedName })}
              className="rounded-xl px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{ background: BRAND }}>
              {busy ? 'Submitting…' : 'Sign Document'}
            </button>
          </div>
        )}

        {/* Proposal actions */}
        {view.stage === 'review' && view.canApprove && (
          <div className="rounded-2xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Your decision</h2>
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => act({ action: 'approve', signed_name: doc.recipient_name ?? '' })} className="rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{ background: '#059669' }}>Approve Proposal</button>
              <button disabled={busy} onClick={() => setPanel(panel === 'changes' ? null : 'changes')} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Request Changes</button>
              <button disabled={busy} onClick={() => setPanel(panel === 'question' ? null : 'question')} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Ask a Question</button>
            </div>
            {panel && (
              <div className="space-y-2">
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder={panel === 'changes' ? 'What would you like changed?' : 'What would you like to ask?'}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                <button disabled={busy || !message.trim()} onClick={() => act({ action: panel === 'changes' ? 'request_changes' : 'ask_question', message })}
                  className="rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BRAND }}>{busy ? 'Sending…' : 'Send'}</button>
              </div>
            )}
          </div>
        )}

      </div>
    </NexusDocShell>
  )
}
