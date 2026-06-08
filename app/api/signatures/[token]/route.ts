/**
 * GET /api/signatures/[token]
 * Public endpoint — returns document metadata for the signing page.
 * No auth required; token IS the auth.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { data: sig, error } = await supabase
    .from('document_signatures')
    .select(
      'id, document_type, document_version, document_url, document_html, signer_name, signer_email, signer_title, signer_company, signed_name, signed_title, signed_at, countersigned_name, countersigned_title, countersigned_at, executed_at, executed_cert_url, status, expires_at, sent_by_name'
    )
    .eq('token', params.token)
    .single()

  if (error || !sig) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (new Date(sig.expires_at) < new Date()) {
    if (sig.status === 'pending') {
      await supabase
        .from('document_signatures')
        .update({ status: 'expired' })
        .eq('token', params.token)
    }
    return NextResponse.json({ error: 'This signing link has expired.' }, { status: 410 })
  }

  if (['signed', 'counterparty_signed', 'fully_executed'].includes(sig.status)) {
    return NextResponse.json({ error: 'already_signed', sig }, { status: 409 })
  }

  if (sig.status === 'declined') {
    return NextResponse.json({ error: 'This document was declined.' }, { status: 410 })
  }

  if (sig.status === 'cancelled') {
    return NextResponse.json({ error: 'This document was cancelled.' }, { status: 410 })
  }

  return NextResponse.json({ sig })
}
