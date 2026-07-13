/**
 * POST /api/aria/candidates/import
 *
 * Lead-pool batch import. Takes an array of ARIA candidate cards (from an
 * area/criteria prospecting run) and creates a "thin" leads row for each —
 * enough to work the lead, research later, or hand to SCOUT. Dedupes by
 * property name, stamps the importing rep as owner with a 7-day temp hold.
 *
 * Body: { candidates: Candidate[] }
 *   Candidate = { name, address?, city?, state?, zip?, units?, year_built?,
 *     property_class?, management_company?, owner_entity?, phone?, website?,
 *     isp_signal?, bulk_detected?, gate_signal?, pain_brief?, buy_score_estimate? }
 *
 * Returns: { created, skipped, lead_ids }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

interface CandidateInput {
  name?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  units?: number
  year_built?: number
  property_class?: string
  management_company?: string
  owner_entity?: string
  phone?: string
  website?: string
  isp_signal?: string
  bulk_detected?: boolean
  gate_signal?: boolean
  pain_brief?: string
  buy_score_estimate?: number
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    // Must be a signed-in CRM user (not client/anon).
    if (!user?.id || user.id === 'anonymous' || !user.canViewCRM) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const candidates: CandidateInput[] = Array.isArray(body?.candidates) ? body.candidates : []
    if (candidates.length === 0) {
      return NextResponse.json({ error: 'candidates array required' }, { status: 400 })
    }

    // Only candidates with a usable property name.
    const named = candidates.filter(c => (c.name ?? '').trim().length > 1)
    const propertyNames = named.map(c => c.name!.trim())

    // Dedupe against existing (non-deleted) leads by property name.
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('property_name')
      .in('property_name', propertyNames)
      .is('deleted_at', null)

    const existingNames = new Set(
      (existingLeads ?? []).map((l: { property_name: string | null }) => l.property_name?.toLowerCase())
    )

    const tempHoldExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const now = new Date().toISOString()

    const rows = named
      .filter(c => !existingNames.has(c.name!.trim().toLowerCase()))
      .map(c => {
        const noteParts = [
          c.buy_score_estimate != null ? `ARIA Pool Score: ${c.buy_score_estimate}/10` : null,
          c.pain_brief ? `Issue signal: "${c.pain_brief}"` : null,
          c.gate_signal ? 'Gate/access issue detected' : null,
          c.isp_signal ? `ISP: ${c.isp_signal}` : null,
          c.bulk_detected ? 'Bulk agreement suspected' : null,
          c.management_company ? `Managed by: ${c.management_company}` : null,
          `Added from ARIA lead pool.`,
        ].filter(Boolean).join('\n')

        return {
          contact_name:  c.management_company ?? 'Unknown Contact',
          company_name:  c.management_company ?? null,
          phone:         c.phone ?? null,
          property_name: c.name!.trim(),
          source:        'aria_pool',
          city:          c.city ?? null,
          state:         c.state ?? null,
          property_type: c.property_class ?? 'Multifamily',
          unit_count:    c.units ?? null,
          location:      c.address ?? null,
          notes:         noteParts,
          property_intel: {
            address:            c.address ?? null,
            zip:                c.zip ?? null,
            year_built:         c.year_built ?? null,
            owner_entity:       c.owner_entity ?? null,
            website:            c.website ?? null,
            isp_signal:         c.isp_signal ?? null,
            bulk_detected:      c.bulk_detected ?? false,
            gate_signal:        c.gate_signal ?? false,
            pain_brief:         c.pain_brief ?? null,
            buy_score_estimate: c.buy_score_estimate ?? null,
            source:             'aria_pool',
            generated_at:       now,
          },
          property_intel_updated_at: now,
          property_intel_source: 'aria',
          assigned_to_user_id: user.id,
          assigned_to_name: user.name || user.email || user.id,
          temp_hold_expires_at: tempHoldExpiresAt,
        }
      })

    if (rows.length === 0) {
      return NextResponse.json({
        created: 0,
        skipped: named.length,
        lead_ids: [],
        message: 'All selected properties already exist as leads.',
      })
    }

    const { data: created, error: insertErr } = await supabase
      .from('leads')
      .insert(rows)
      .select('id')

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

    return NextResponse.json({
      created:  created?.length ?? 0,
      skipped:  named.length - rows.length,
      lead_ids: (created ?? []).map((r: { id: string }) => r.id),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Import failed'
    console.error('[aria/candidates/import]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
