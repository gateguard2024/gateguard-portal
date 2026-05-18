/**
 * POST /api/signatures/[token]/sign
 * Public endpoint — records the signature and optionally advances the opportunity stage.
 * No auth required; token IS the auth.
 *
 * Body: { signed_name, signed_title? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const body = await req.json()
    const { signed_name, signed_title } = body

    if (!signed_name?.trim()) {
      return NextResponse.json({ error: 'signed_name is required' }, { status: 400 })
    }

    // Fetch the signature record
    const { data: sig, error: fetchErr } = await supabase
      .from('document_signatures')
      .select('*')
      .eq('token', params.token)
      .single()

    if (fetchErr || !sig) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (new Date(sig.expires_at) < new Date()) {
      await supabase
        .from('document_signatures')
        .update({ status: 'expired' })
        .eq('token', params.token)
      return NextResponse.json({ error: 'This signing link has expired.' }, { status: 410 })
    }

    if (sig.status !== 'pending') {
      return NextResponse.json({ error: `Document is already ${sig.status}.` }, { status: 409 })
    }

    // Capture IP + User-Agent
    const headersList = headers()
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? 'unknown'
    const userAgent = req.headers.get('user-agent') ?? ''

    // Record the signature
    const { error: updateErr } = await supabase
      .from('document_signatures')
      .update({
        status:           'signed',
        signed_name:      signed_name.trim(),
        signed_title:     signed_title?.trim() ?? null,
        signed_ip:        ip,
        signed_user_agent: userAgent,
        signed_at:        new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      })
      .eq('token', params.token)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Advance opportunity stage if specified
    if (sig.advance_stage && sig.opportunity_id) {
      void (async () => {
        try {
          await supabase
            .from('opportunities')
            .update({ stage: sig.advance_stage, updated_at: new Date().toISOString() })
            .eq('id', sig.opportunity_id)
        } catch (_) {
          // non-blocking
        }
      })()
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
