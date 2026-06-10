/**
 * GET /api/signatures/[id]/cert
 * Public (no auth). Serves the fully executed signing certificate HTML
 * for a document_signatures record.
 *
 * document_html is overwritten with the full executed certificate after countersigning,
 * so this route always returns the final copy.
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
  { params }: { params: { id: string } }
) {
  try {
    const { data: sig, error } = await supabase
      .from('document_signatures')
      .select('id,status,document_html,document_type,executed_at,signer_name,signer_email,signer_company')
      .eq('id', params.id)
      .maybeSingle()

    if (error || !sig) {
      return new NextResponse('<html><body><p>Document not found.</p></body></html>', {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    const status = String(sig.status ?? '').toLowerCase()
    if (status !== 'fully_executed') {
      return new NextResponse(
        '<html><body><p>This document has not been fully executed yet. Check back after both parties have signed.</p></body></html>',
        { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    }

    if (!sig.document_html) {
      return new NextResponse(
        '<html><body><p>Executed certificate is not available yet. Please contact rfeldman@gateguard.co.</p></body></html>',
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    }

    return new NextResponse(sig.document_html as string, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Frame-Options': 'SAMEORIGIN',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return new NextResponse(`<html><body><p>Error: ${msg}</p></body></html>`, {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}
