/**
 * lib/adobe-sign.ts — Adobe Acrobat Sign (v6) integration.
 *
 * Server-side only. Uses an Enterprise Integration Key (bearer token). The region
 * base URL is discovered from /baseUris unless ADOBE_SIGN_BASE_URL is set.
 *
 * Env:
 *   ADOBE_SIGN_INTEGRATION_KEY   — bearer token (Account → API → Integration Key)
 *   ADOBE_SIGN_BASE_URL          — optional, e.g. https://api.na4.adobesign.com
 *   ADOBE_SIGN_WEBHOOK_CLIENT_ID — client id echoed for the webhook handshake
 *
 * Flow: uploadTransientDocument → createAgreement → (getSigningUrl for iframe |
 * webhook status) → downloadSignedPdf.
 */

const KEY = () => process.env.ADOBE_SIGN_INTEGRATION_KEY || ''
export function adobeSignConfigured(): boolean { return !!KEY() }

let cachedBase: string | null = null
export async function adobeBaseUrl(): Promise<string> {
  if (process.env.ADOBE_SIGN_BASE_URL) return process.env.ADOBE_SIGN_BASE_URL.replace(/\/$/, '')
  if (cachedBase) return cachedBase
  const res = await fetch('https://api.adobesign.com/api/rest/v6/baseUris', {
    headers: { Authorization: `Bearer ${KEY()}`, Accept: 'application/json' }, signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Adobe baseUris failed (${res.status})`)
  const j = await res.json()
  const api = String(j.apiAccessPoint ?? '').replace(/\/$/, '')
  if (!api) throw new Error('Adobe did not return an apiAccessPoint')
  cachedBase = api
  return api
}

function authHeaders(extra?: Record<string, string>) {
  return { Authorization: `Bearer ${KEY()}`, Accept: 'application/json', ...(extra ?? {}) }
}

/** Upload a PDF as a transient document (valid 7 days). Returns transientDocumentId. */
export async function uploadTransientDocument(bytes: Buffer, filename: string, mime = 'application/pdf'): Promise<string> {
  const base = await adobeBaseUrl()
  const form = new FormData()
  form.append('File-Name', filename)
  form.append('Mime-Type', mime)
  form.append('File', new Blob([new Uint8Array(bytes)], { type: mime }), filename)
  const res = await fetch(`${base}/api/rest/v6/transientDocuments`, { method: 'POST', headers: authHeaders(), body: form, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`Adobe transientDocuments (${res.status}): ${(await res.text()).slice(0, 200)}`)
  const j = await res.json()
  return String(j.transientDocumentId)
}

/** Create + send an agreement for signature. Returns the agreementId. */
export async function createAgreement(opts: {
  name: string
  transientDocumentId?: string
  libraryDocumentId?: string
  signerEmail: string
  signerName?: string
  embedded?: boolean          // AUTHORING flow for embedded iframe
  frameParentDomain?: string  // your app domain, for iframe embedding
  message?: string
}): Promise<string> {
  const base = await adobeBaseUrl()
  const fileInfo = opts.libraryDocumentId ? { libraryDocumentId: opts.libraryDocumentId } : { transientDocumentId: opts.transientDocumentId }
  const body = {
    fileInfos: [fileInfo],
    name: opts.name,
    participantSetsInfo: [{
      order: 1, role: 'SIGNER',
      memberInfos: [{ email: opts.signerEmail, ...(opts.signerName ? { name: opts.signerName } : {}) }],
    }],
    signatureType: 'ESIGN',
    state: 'IN_PROCESS',
    message: opts.message ?? undefined,
  }
  const res = await fetch(`${base}/api/rest/v6/agreements`, {
    method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`Adobe createAgreement (${res.status}): ${(await res.text()).slice(0, 200)}`)
  const j = await res.json()
  return String(j.id)
}

/** Per-signer signing URL — embeddable in an iframe (needs frameParent config on
 * the account for cross-domain). Returns the first signer's URL. */
export async function getSigningUrl(agreementId: string): Promise<string | null> {
  const base = await adobeBaseUrl()
  const res = await fetch(`${base}/api/rest/v6/agreements/${agreementId}/signingUrls`, { headers: authHeaders(), signal: AbortSignal.timeout(12000) })
  if (!res.ok) return null
  const j = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sets = (j.signingUrlSetInfos ?? []) as any[]
  const url = sets[0]?.signingUrls?.[0]?.esignUrl ?? sets[0]?.signingUrls?.[0]?.signingUrl
  return url ? String(url) : null
}

/** Current agreement status. */
export async function getAgreementStatus(agreementId: string): Promise<string | null> {
  const base = await adobeBaseUrl()
  const res = await fetch(`${base}/api/rest/v6/agreements/${agreementId}`, { headers: authHeaders(), signal: AbortSignal.timeout(12000) })
  if (!res.ok) return null
  const j = await res.json()
  return j.status ? String(j.status) : null
}

/** Download the combined signed PDF once completed. */
export async function downloadSignedPdf(agreementId: string): Promise<Buffer | null> {
  const base = await adobeBaseUrl()
  const res = await fetch(`${base}/api/rest/v6/agreements/${agreementId}/combinedDocument`, { headers: authHeaders({ Accept: 'application/pdf' }), signal: AbortSignal.timeout(30000) })
  if (!res.ok) return null
  return Buffer.from(await res.arrayBuffer())
}

/** Map Adobe status → our simplified status. */
export function normalizeAdobeStatus(s: string | null | undefined): string {
  const v = String(s ?? '').toUpperCase()
  if (/SIGNED|APPROVED|ACCEPTED/.test(v)) return 'signed'
  if (/COMPLETED/.test(v)) return 'completed'
  if (/OUT_FOR|IN_PROCESS|WAITING/.test(v)) return 'out_for_signature'
  if (/CANCELLED|DECLINED|EXPIRED/.test(v)) return 'cancelled'
  return 'sent'
}
