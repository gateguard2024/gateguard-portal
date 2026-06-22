/**
 * POST /api/admin/create-draft-dealer
 *
 * Phase 1 of the 2-phase onboarding flow.
 * Creates the org record in Supabase as a DRAFT (is_active: false).
 * Does NOT send Clerk invites or documents — those come later.
 *
 * Body:
 *   org_name            string   required
 *   org_tier            OrgTier  required
 *   entity_type         string?
 *   parent_org_id       string?
 *   master_agent_id     string?
 *   master_dealer_id    string?
 *   license_number      string?
 *   service_area_states string[]
 *   tech_count          number?
 *   address, city, state, zip, phone, email, website  string?
 *   sales_partner_rate  number?  (only for full_dealer / master_dealer)
 *   service_dealer_rate number?
 *   commission_notes    string?
 *
 * Returns: { ok, org_id, org }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser, OrgTier } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

const VALID_DEALER_TIERS: OrgTier[] = [
  'master_agent', 'master_dealer', 'full_dealer',
  'service_dealer', 'install_contractor', 'sales_partner',
]

const TIER_LABELS: Record<string, string> = {
  master_agent:       'Master Agent',
  master_dealer:      'MSO',
  full_dealer:        'Full Dealership',
  service_dealer:     'Service Dealer',
  install_contractor: 'Install Contractor',
  sales_partner:      'Sales Partner',
}

const COMMISSION_TIERS = new Set(['full_dealer', 'master_dealer'])

export async function POST(req: NextRequest) {
  const caller = await getCurrentUser()
  if (!caller.isCorporate || caller.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — GateGuard admin only' }, { status: 403 })
  }

  const body = await req.json()
  const {
    org_name,
    org_tier,
    entity_type,
    parent_org_id,
    master_agent_id,
    master_dealer_id,
    license_number,
    service_area_states,
    tech_count,
    address, city, state, zip,
    phone, email: org_email, website,
    sales_partner_rate,
    service_dealer_rate,
    commission_notes,
  } = body

  if (!org_name?.trim()) {
    return NextResponse.json({ error: 'org_name is required' }, { status: 400 })
  }
  if (!VALID_DEALER_TIERS.includes(org_tier)) {
    return NextResponse.json({ error: `Invalid org_tier: ${org_tier}` }, { status: 400 })
  }

  // Create org as draft
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .insert({
      name:                org_name.trim(),
      org_tier,
      tier_label:          TIER_LABELS[org_tier] ?? org_tier,
      is_active:           false,
      parent_org_id:       parent_org_id ?? null,
      master_agent_id:     master_agent_id ?? null,
      master_dealer_id:    master_dealer_id ?? null,
      license_number:      license_number ?? null,
      service_area_states: service_area_states ?? [],
      tech_count:          tech_count ?? 0,
      entity_type:         entity_type ?? 'limited liability company',
      ...(phone     && { phone }),
      ...(org_email && { email: org_email }),
      ...(website   && { website }),
      ...(address   && { address }),
      ...(city      && { city }),
      ...(state     && { state }),
      ...(zip       && { zip }),
    })
    .select()
    .single()

  if (orgErr || !org) {
    return NextResponse.json(
      { error: `Failed to create org: ${orgErr?.message}` },
      { status: 500 }
    )
  }

  // Create commission config for tiers that need it
  if (COMMISSION_TIERS.has(org_tier)) {
    await supabase.from('commission_config').insert({
      org_id:               org.id,
      master_agent_rate:    0.50,
      master_dealer_rate:   0.50,
      sales_partner_rate:   sales_partner_rate  ?? 1.00,
      service_dealer_rate:  service_dealer_rate ?? 3.00,
      notes:                commission_notes ?? null,
    })
  }

  // Log draft creation (fire-and-forget, non-fatal)
  void (async () => {
    try {
      await supabase.from('sensitive_field_access_log').insert({
        user_id:    caller.id,
        org_id:     org.id,
        table_name: 'organizations',
        record_id:  org.id,
        fields:     ['draft_created'],
        ip_address: req.headers.get('x-forwarded-for') ?? null,
      })
    } catch (_) {}
  })()

  return NextResponse.json({
    ok:     true,
    org_id: org.id,
    org,
  }, { status: 201 })
}
