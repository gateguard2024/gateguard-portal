/**
 * GET /api/signatures/by-record
 * Returns all document signatures linked to a record, across the full lifecycle.
 * Accepts any combination of: ?opportunity_id=X&lead_id=Y&org_id=Z
 * Documents persist through: Lead → Opportunity → Org
 *
 * Clerk-authenticated.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await getCurrentUser()

    const { searchParams } = new URL(req.url)
    const opportunity_id = searchParams.get('opportunity_id')
    const lead_id        = searchParams.get('lead_id')
    const org_id         = searchParams.get('org_id')

    if (!opportunity_id && !lead_id && !org_id) {
      return NextResponse.json({ error: 'Provide at least one of: opportunity_id, lead_id, org_id' }, { status: 400 })
    }

    // Build OR filter across all linked record IDs
    const orParts: string[] = []
    if (opportunity_id) orParts.push(`opportunity_id.eq.${opportunity_id}`)
    if (lead_id)        orParts.push(`lead_id.eq.${lead_id}`)
    if (org_id)         orParts.push(`org_id.eq.${org_id}`)

    const { data, error } = await supabase
      .from('document_signatures')
      .select(`
        id, document_type, document_version, document_url,
        signer_name, signer_email, signer_title, signer_company,
        signed_name, signed_title, signed_at,
        countersigned_name, countersigned_title, countersigned_at,
        executed_at, executed_cert_url,
        status, sent_by_name, sent_at, expires_at,
        advance_stage, opportunity_id, lead_id, org_id,
        notification_sent_at
      `)
      .or(orParts.join(','))
      .order('sent_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ signatures: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
