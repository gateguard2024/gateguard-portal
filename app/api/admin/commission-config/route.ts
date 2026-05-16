import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/* ─────────────────────────────────────────────────────────────────────────────
 * GET /api/admin/commission-config?org_id=<uuid>
 * Returns the commission config for an org. If none exists, returns the
 * default rates.
 * ───────────────────────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org_id')
  if (!orgId) {
    return NextResponse.json({ error: 'org_id required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('commission_config')
    .select('*')
    .eq('org_id', orgId)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = row not found, all other errors are real
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    // Return defaults — no row in DB yet
    return NextResponse.json({
      org_id:              orgId,
      master_agent_rate:   0.50,
      master_dealer_rate:  0.50,
      sales_partner_rate:  1.00,
      service_dealer_rate: 3.00,
      notes:               null,
      _default:            true,
    })
  }

  return NextResponse.json(data)
}

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /api/admin/commission-config
 * Body: { org_id, sales_partner_rate, service_dealer_rate, notes? }
 *
 * Creates or updates (upserts) commission config for an org.
 * master_agent_rate and master_dealer_rate are always locked at $0.50.
 * Validates that sales_partner_rate + service_dealer_rate ≤ 4.00.
 * ───────────────────────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  let body: {
    org_id: string
    sales_partner_rate: number
    service_dealer_rate: number
    notes?: string | null
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { org_id, sales_partner_rate, service_dealer_rate, notes } = body

  // Required field check
  if (!org_id) {
    return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
  }

  const salesRate   = Number(sales_partner_rate)
  const serviceRate = Number(service_dealer_rate)

  if (isNaN(salesRate) || isNaN(serviceRate)) {
    return NextResponse.json(
      { error: 'sales_partner_rate and service_dealer_rate must be numbers' },
      { status: 400 }
    )
  }

  if (salesRate < 0 || serviceRate < 0) {
    return NextResponse.json(
      { error: 'Rates cannot be negative' },
      { status: 400 }
    )
  }

  const configurable_total = salesRate + serviceRate
  if (configurable_total > 4.00) {
    return NextResponse.json(
      {
        error: `sales_partner_rate + service_dealer_rate cannot exceed $4.00 (got $${configurable_total.toFixed(2)})`,
        configurable_total,
      },
      { status: 422 }
    )
  }

  // Verify the org exists
  const { data: orgExists, error: orgErr } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', org_id)
    .single()

  if (orgErr || !orgExists) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  // Upsert — master_agent_rate and master_dealer_rate are always locked at $0.50
  const { data, error } = await supabase
    .from('commission_config')
    .upsert(
      {
        org_id,
        master_agent_rate:   0.50,
        master_dealer_rate:  0.50,
        sales_partner_rate:  salesRate,
        service_dealer_rate: serviceRate,
        notes:               notes ?? null,
      },
      { onConflict: 'org_id' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, config: data }, { status: 200 })
}

/* ─────────────────────────────────────────────────────────────────────────────
 * PATCH /api/admin/commission-config
 * Same behavior as POST — alias for clarity.
 * ───────────────────────────────────────────────────────────────────────────── */
export const PATCH = POST
