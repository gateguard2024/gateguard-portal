'use client'

import { useEffect, useState } from 'react'

type DocumentBucket = 'needs_signature' | 'waiting_on_customer' | 'recently_signed' | 'draft_not_sent'

type DocumentCard = {
  id: string
  title: string
  version: string | null
  status: string
  signer_name: string | null
  signer_email: string | null
  signer_company: string | null
  sent_by_name: string | null
  sent_at: string | null
  signed_at: string | null
  expires_at: string | null
  document_url: string | null
  bucket: DocumentBucket
  urgency: 'high' | 'medium' | 'low'
}

function bucketLabel(bucket: DocumentBucket): string {
  if (bucket === 'needs_signature') return 'Needs Signature'
  if (bucket === 'waiting_on_customer') return 'Waiting on Customer'
  if (bucket === 'recently_signed') return 'Recently Signed'
  return 'Draft / Not Sent'
}

function bucketColor(bucket: DocumentBucket): string {
  if (bucket === 'needs_signature') return '#F87171'
  if (bucket === 'waiting_on_customer') return '#FBBF24'
  if (bucket === 'recently_signed') return '#34D399'
  return '#00C8FF'
}

function shortDate(value?: string | null): string {
  return value ? value.slice(0, 10) : ''
}

export function MoneyDocsDocumentsBoard() {
  const [documents, setDocuments] = useState<DocumentCard[]>([])
  const [selectedBucket, setSelectedBucket] = useState<DocumentBucket>('needs_signature')
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  async function loadDocuments() {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/nexus/money-docs/documents')
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error(data?.message ?? 'Could not load documents.')
      const nextDocuments = Array.isArray(data.documents) ? data.documents as DocumentCard[] : []
      setDocuments(nextDocuments)
      if (nextDocuments.length === 0) setMessage('No signature documents found yet.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load documents.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDocuments()
  }, [])

  const buckets: DocumentBucket[] = ['needs_signature', 'waiting_on_customer', 'recently_signed', 'draft_not_sent']
  const shownDocuments = documents.filter(document => document.bucket === selectedBucket)
  const selectedDocument = documents.find(document => document.id === selectedDocumentId) ?? null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {buckets.map(bucket => {
          const color = bucketColor(bucket)
          const count = documents.filter(document => document.bucket === bucket).length
          const active = selectedBucket === bucket
          return (
            <button key={bucket} type="button" onClick={() => { setSelectedBucket(bucket); setSelectedDocumentId(null) }} className="rounded-2xl px-3 py-3 text-left transition-all hover:-translate-y-0.5" style={{ background: active ? `${color}1f` : 'rgba(0,0,0,0.18)', border: active ? `1px solid ${color}66` : '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color }}>{bucketLabel(bucket)}</div>
              <div className="mt-1 text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>{count}</div>
            </button>
          )
        })}
      </div>

      {loading && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)' }}>Loading documents…</div>}
      {message && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)' }}>{message}</div>}

      {!loading && shownDocuments.length === 0 && !message && (
        <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)' }}>
          No {bucketLabel(selectedBucket).toLowerCase()} documents right now.
        </div>
      )}

      {shownDocuments.length > 0 && (
        <div className="space-y-2">
          {shownDocuments.map(document => {
            const selected = selectedDocumentId === document.id
            const color = bucketColor(document.bucket)
            return (
              <button key={document.id} type="button" onClick={() => setSelectedDocumentId(document.id)} className="w-full rounded-2xl px-3 py-3 text-left transition-all hover:-translate-y-0.5" style={{ background: selected ? `${color}1f` : 'rgba(0,0,0,0.18)', border: selected ? `1px solid ${color}66` : '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{document.title}</div>
                    <div className="mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.48)' }}>{document.signer_name || document.signer_email || document.signer_company || 'No signer name'}</div>
                    <div className="mt-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.34)' }}>{document.signed_at ? `Signed ${shortDate(document.signed_at)}` : document.sent_at ? `Sent ${shortDate(document.sent_at)}` : 'Not sent yet'}</div>
                  </div>
                  <div className="text-right">
                    <div className="rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ background: `${color}1f`, border: `1px solid ${color}44`, color }}>{document.status}</div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selectedDocument && (
        <div className="rounded-3xl p-4" style={{ background: 'rgba(0,124,255,0.08)', border: '1px solid rgba(0,200,255,0.18)' }}>
          <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#7dd3fc' }}>Selected Document</div>
          <div className="mt-1 text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>{selectedDocument.title}</div>
          <div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.54)' }}>{selectedDocument.signer_company || selectedDocument.signer_email || 'Signer not set'}</div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-2xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)' }}>Signer</div><div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.78)' }}>{selectedDocument.signer_name || selectedDocument.signer_email || 'Not set'}</div></div>
            <div className="rounded-2xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)' }}>Sent</div><div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.78)' }}>{shortDate(selectedDocument.sent_at) || 'Not sent'}</div></div>
            <div className="rounded-2xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)' }}>Expires</div><div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.78)' }}>{shortDate(selectedDocument.expires_at) || 'No date'}</div></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedDocument.document_url && <a href={selectedDocument.document_url} target="_blank" rel="noreferrer" className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'linear-gradient(135deg, #00C8FF, #007CFF)', color: 'white' }}>Open Document</a>}
            <button type="button" className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.62)' }}>Send Reminder</button>
          </div>
        </div>
      )}
    </div>
  )
}
