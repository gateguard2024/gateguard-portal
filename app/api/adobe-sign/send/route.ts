/**
 * POST /api/adobe-sign/send  { document_id, signer_email, signer_name?, message? }
 * Sends a Document Library file out for signature via Acrobat Sign and tracks it
 * in esign_agreements. Returns { agreement_id, signing_url } (url embeddable in an
 * iframe for in-app signing). Corporate/admin or the doc's org.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { adobeSignConfigured, uploadTransientDocument, createAgreement, getSigningUrl } from '@/lib/adobe-sign'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!adobeSignConfigured()) return NextResponse.json({ error: 'Acrobat Sign isn’t configured yet (ADOBE_SIGN_INTEGRATION_KEY missing).' }, { status: 503 })

  const body = await req.json().catch(() => ({}))
  const documentId = String(body.document_id ?? '')
  const signerEmail = String(body.signer_email ?? '').trim()
  const signerName = body.signer_name ? String(body.signer_name).trim() : undefined
  if (!documentId || !signerEmail) return NextResponse.json({ error: 'document_id and signer_email are required' }, { status: 400 })

  // Load the document + resolve a downloadable URL.
  const { data: doc } = await supabase.from('org_documents').select('*').eq('id', documentId).maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  if (!user.isCorporate && doc.org_id && doc.org_id !== user.org_id && doc.visibility !== 'shared') {
    return NextResponse.json({ error: 'That document is outside your access.' }, { status: 403 })
  }
  let fileUrl: string | null = doc.file_url ?? null
  if (!fileUrl && doc.storage_path) {
    const { data: pub } = supabase.storage.from('documents').getPublicUrl(doc.storage_path)
    fileUrl = pub?.publicUrl ?? null
  }
  if (!fileUrl) return NextResponse.json({ error: 'This document has no file to send.' }, { status: 400 })

  try {
    const fileRes = await fetch(fileUrl, { signal: AbortSignal.timeout(20000) })
    if (!fileRes.ok) throw new Error(`Could not fetch the document file (${fileRes.status}).`)
    const bytes = Buffer.from(await fileRes.arrayBuffer())
    const filename = `${String(doc.name ?? 'document').replace(/[^\w.-]+/g, '-')}.pdf`

    const transientDocumentId = await uploadTransientDocument(bytes, filename)
    const agreementId = await createAgreement({
      name: doc.name ?? 'Document', transientDocumentId, signerEmail, signerName,
      message: body.message ? String(body.message) : undefined,
      frameParentDomain: process.env.NEXT_PUBLIC_APP_DOMAIN,
    })
    const signingUrl = await getSigningUrl(agreementId).catch(() => null)

    const { data: row } = await supabase.from('esign_agreements').insert({
      org_id: user.org_id ?? null, document_id: documentId, provider: 'adobe_sign',
      agreement_id: agreementId, name: doc.name ?? 'Document',
      signer_email: signerEmail, signer_name: signerName ?? null,
      status: 'out_for_signature', created_by: user.name ?? user.id,
    }).select().single()

    return NextResponse.json({ ok: true, agreement_id: agreementId, signing_url: signingUrl, tracking_id: row?.id ?? null })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Send for signature failed' }, { status: 502 })
  }
}
