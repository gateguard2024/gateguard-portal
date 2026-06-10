/**
 * POST /api/signatures/upload
 * Clerk-authenticated. Uploads a pre-signed NDA or Agreement document directly,
 * marking it as fully_executed without going through the email send/sign flow.
 *
 * Body: FormData
 *   file         — the signed document (PDF, HTML, DOCX, JPG/PNG)
 *   org_id       — organization this belongs to
 *   document_type — 'nda' | 'dealer_agreement' | 'service_agreement' | etc.
 *   signer_name  — (optional) name of the signer
 *   signer_email — (optional) email of the signer
 *   signer_company — (optional)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

const BUCKET = 'document-templates'

const AGREEMENT_TYPES = new Set([
  'dealer_agreement',
  'service_agreement',
  'install_partner_agreement',
  'sales_partner_agreement',
  'master_agent_agreement',
  'master_dealer_agreement',
])

export async function POST(req: NextRequest) {
  try {
    const caller = await getCurrentUser()

    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return NextResponse.json({ error: 'Could not parse form data. Send multipart/form-data.' }, { status: 400 })
    }

    const file = formData.get('file') as File | null
    const org_id = formData.get('org_id') as string | null
    const document_type = formData.get('document_type') as string | null
    const signer_name = (formData.get('signer_name') as string | null) || null
    const signer_email = (formData.get('signer_email') as string | null) || null
    const signer_company = (formData.get('signer_company') as string | null) || null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'File is too large. Maximum size is 20 MB.' }, { status: 400 })
    }
    if (!org_id?.trim()) {
      return NextResponse.json({ error: 'org_id is required.' }, { status: 400 })
    }
    if (!document_type?.trim()) {
      return NextResponse.json({ error: 'document_type is required.' }, { status: 400 })
    }

    // Derive file extension from the original filename or MIME type
    const originalName = file.name ?? 'upload'
    const ext = originalName.includes('.')
      ? originalName.split('.').pop()?.toLowerCase() ?? 'pdf'
      : file.type === 'application/pdf' ? 'pdf'
      : file.type?.includes('html') ? 'html'
      : file.type?.includes('word') ? 'docx'
      : 'pdf'

    const safeType = document_type.replace(/[^a-zA-Z0-9_-]/g, '_')
    const path = `executed/${org_id}/${Date.now()}_${safeType}_manual.${ext}`

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const contentType = file.type || 'application/pdf'

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType, upsert: false })

    if (uploadError) {
      return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

    const now = new Date().toISOString()
    const callerName = caller.email ?? 'GateGuard'

    // Look for an existing document_signatures record for this org + doc type
    // (check NDA as 'nda'; agreements as the full set — prefer finding any existing record so we update in-place)
    const isAgreement = AGREEMENT_TYPES.has(document_type)
    const lookupTypes = isAgreement ? Array.from(AGREEMENT_TYPES) : [document_type]

    const { data: existing } = await supabase
      .from('document_signatures')
      .select('id,status')
      .eq('org_id', org_id)
      .in('document_type', lookupTypes)
      .order('sent_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (existing?.id) {
      // Update existing record → fully_executed
      const { error: updateErr } = await supabase
        .from('document_signatures')
        .update({
          status: 'fully_executed',
          document_type,
          executed_cert_url: publicUrl,
          executed_at: now,
          signed_at: now,
          signed_name: signer_name ?? 'Uploaded (manual)',
          countersigned_name: 'Russel Feldman',
          countersigned_title: 'CEO',
          countersigned_at: now,
          countersigned_by: caller.id,
          updated_at: now,
        })
        .eq('id', existing.id)

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true, executed_cert_url: publicUrl, action: 'updated' })
    }

    // No existing record — insert a new fully_executed one
    const farFuture = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString()
    const { error: insertErr } = await supabase
      .from('document_signatures')
      .insert({
        org_id,
        document_type,
        status: 'fully_executed',
        token: crypto.randomUUID(), // placeholder — signing page not needed for uploads
        executed_cert_url: publicUrl,
        executed_at: now,
        signed_at: now,
        sent_at: now,
        signed_name: signer_name ?? 'Uploaded (manual)',
        signer_name: signer_name,
        signer_email: signer_email,
        signer_company: signer_company,
        countersigned_name: 'Russel Feldman',
        countersigned_title: 'CEO',
        countersigned_at: now,
        countersigned_by: caller.id,
        sent_by_name: callerName,
        expires_at: farFuture,
        updated_at: now,
      })

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, executed_cert_url: publicUrl, action: 'created' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
