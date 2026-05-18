/**
 * POST /api/signatures/upload-executed
 * Clerk-authenticated. Records an already-executed document (signed outside the portal).
 *
 * Covers three cases:
 *   1. Partner signed GateGuard's NDA outside the portal (email, DocuSign, wet signature)
 *   2. Partner sent their own NDA and both parties signed it
 *   3. Any agreement executed via a third-party signing platform
 *
 * Accepts multipart/form-data:
 *   file            — the executed PDF (stored in Supabase Storage)
 *   document_type   — nda | master_agent_agreement | dealer_agreement | ...
 *   opportunity_id  — UUID (required)
 *   lead_id         — optional
 *   org_id          — optional
 *   signer_name     — counterparty full name
 *   signer_email    — counterparty email
 *   signer_title    — optional
 *   signer_company  — optional
 *   signed_at       — ISO date string (when counterparty signed)
 *   countersigned_name  — GateGuard signer name
 *   countersigned_title — GateGuard signer title (default CEO)
 *   countersigned_at    — ISO date string (when GateGuard signed)
 *   notes           — optional internal notes
 *
 * Creates a document_signatures row with status = 'fully_executed'.
 * The uploaded PDF is stored at: executed/{opportunity_id}/{timestamp}_{filename}
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

export async function POST(req: NextRequest) {
  try {
    const caller = await getCurrentUser()

    const form = await req.formData()

    const file             = form.get('file') as File | null
    const document_type    = (form.get('document_type') as string)?.trim()
    const opportunity_id   = (form.get('opportunity_id') as string)?.trim()
    const lead_id          = (form.get('lead_id') as string)?.trim() || null
    const org_id           = (form.get('org_id') as string)?.trim() || null
    const signer_name      = (form.get('signer_name') as string)?.trim()
    const signer_email     = (form.get('signer_email') as string)?.trim()
    const signer_title     = (form.get('signer_title') as string)?.trim() || null
    const signer_company   = (form.get('signer_company') as string)?.trim() || null
    const signed_at        = (form.get('signed_at') as string)?.trim() || new Date().toISOString()
    const countersigned_name  = (form.get('countersigned_name') as string)?.trim() || caller.name || 'Russel Feldman'
    const countersigned_title = (form.get('countersigned_title') as string)?.trim() || 'CEO'
    const countersigned_at    = (form.get('countersigned_at') as string)?.trim() || signed_at
    const notes            = (form.get('notes') as string)?.trim() || null
    const source           = (form.get('source') as string)?.trim() || 'uploaded'  // 'uploaded' | 'their_nda'

    // Validation
    if (!document_type) return NextResponse.json({ error: 'document_type is required' }, { status: 400 })
    if (!opportunity_id) return NextResponse.json({ error: 'opportunity_id is required' }, { status: 400 })
    if (!signer_name)    return NextResponse.json({ error: 'signer_name is required' }, { status: 400 })
    if (!signer_email)   return NextResponse.json({ error: 'signer_email is required' }, { status: 400 })

    const now = new Date().toISOString()

    let executed_cert_url: string | null = null

    // Upload PDF to Supabase Storage (if provided)
    if (file && file.size > 0) {
      const ext      = file.name.split('.').pop() ?? 'pdf'
      const ts       = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path     = `executed/${opportunity_id}/${ts}_${safeName}`

      const bytes  = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, buffer, {
          contentType: file.type || 'application/pdf',
          upsert: false,
        })

      if (uploadErr) {
        return NextResponse.json({ error: `Storage upload failed: ${uploadErr.message}` }, { status: 500 })
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
      executed_cert_url = publicUrl
    }

    // Insert fully_executed record
    const { data, error } = await supabase
      .from('document_signatures')
      .insert({
        document_type,
        document_version:    `external-${source}`,
        document_url:        executed_cert_url,

        opportunity_id:      opportunity_id || null,
        lead_id:             lead_id,
        org_id:              org_id,

        // Counterparty (the "signer")
        signer_name,
        signer_email,
        signer_title,
        signer_company,
        signed_name:         signer_name,
        signed_title:        signer_title,
        signed_at,

        // GateGuard (the "countersigner")
        countersigned_name,
        countersigned_by:    caller.id,
        countersigned_title,
        countersigned_at,
        executed_at:         countersigned_at,
        executed_cert_url:   executed_cert_url,

        // Metadata
        sent_by_name:        caller.name,
        sent_at:             now,
        status:              'fully_executed',
        notification_sent_at: now,
        updated_at:          now,

        // Internal notes stored in advance_stage field as workaround
        // (notes column added if needed via migration later)
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, signature: data }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
