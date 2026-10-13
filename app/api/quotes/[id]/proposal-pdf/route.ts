/**
 * GET /api/quotes/[id]/proposal-pdf — download the partnership proposal as a PDF.
 * Generates the same PDF that gets attached to the client email (proposalPdfBuffer),
 * enriched with the rep signature (dealer org + creator phone/email), and returns
 * it as a file download. Reflects the last SAVED proposal config.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { proposalPdfBuffer } from '@/lib/partnership-proposal-pdf'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  await getCurrentUser() // require an authenticated internal user

  const { data: quote } = await supabase.from('quotes').select('*').eq('id', params.id).maybeSingle()
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Signature enrichment — dealer org + the rep's phone/email (same as the letter).
  let org_name: string | null = null
  let created_by_phone: string | null = null
  let created_by_email: string | null = null
  if (quote.org_id) {
    const { data: o } = await supabase.from('organizations').select('name').eq('id', quote.org_id).maybeSingle()
    org_name = o?.name ?? null
  }
  if (quote.created_by) {
    const { data: p } = await supabase.from('profiles').select('phone, email').eq('id', quote.created_by).maybeSingle()
    created_by_phone = p?.phone ?? null
    created_by_email = p?.email ?? null
  }

  const cfg = (quote.partnership && typeof quote.partnership === 'object') ? quote.partnership : {}
  let buf: Buffer
  try {
    buf = await proposalPdfBuffer({ ...quote, org_name, created_by_phone, created_by_email }, cfg)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'PDF generation failed' }, { status: 500 })
  }

  const safe = String(quote.property_name || quote.quote_number || 'Proposal').replace(/[^a-z0-9]+/gi, '_')
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safe}_Proposal.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
