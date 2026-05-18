import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// Tier labels for display
const TIER_LABELS: Record<string, string> = {
  corporate:         'Corporate',
  master_agent:      'Master Agent',
  master_dealer:     'MSO',
  full_dealer:       'Full Dealer',
  service_dealer:    'Service Dealer',
  install_contractor:'Install Contractor',
  sales_partner:     'Sales Partner',
}

// Tier badge color class (for the frontend to use)
const TIER_COLORS: Record<string, string> = {
  corporate:          'bg-brand-100 text-brand-700',
  master_agent:       'bg-violet-100 text-violet-700',
  master_dealer:      'bg-sky-100 text-sky-700',
  full_dealer:        'bg-emerald-100 text-emerald-700',
  service_dealer:     'bg-teal-100 text-teal-700',
  install_contractor: 'bg-orange-100 text-orange-700',
  sales_partner:      'bg-amber-100 text-amber-700',
}

export async function GET() {
  try {
    const user = await getCurrentUser()

    // Tiers that can assign beyond themselves
    const canAssign =
      user.isCorporate ||
      user.isMasterAgent ||
      user.isMasterDealer ||
      user.isFullDealer

    if (!canAssign) {
      // They can only assign to themselves — return single entry (their own org)
      if (!user.org_id) return NextResponse.json({ orgs: [] })
      const { data } = await supabase
        .from('organizations')
        .select('id, name, org_tier')
        .eq('id', user.org_id)
        .single()
      return NextResponse.json({
        orgs: data ? [{ ...data, tier_label: TIER_LABELS[data.org_tier] ?? data.org_tier, tier_color: TIER_COLORS[data.org_tier] ?? '' }] : [],
        selfOnly: true,
      })
    }

    // Build the scoped query based on tier
    let query = supabase
      .from('organizations')
      .select('id, name, org_tier, master_agent_id, master_dealer_id, parent_org_id')
      .neq('org_tier', 'client')
      .eq('is_active', true)
      .order('org_tier')
      .order('name')

    if (user.isCorporate) {
      // Corporate sees everyone
      // (no additional filter needed)
    } else if (user.isMasterAgent) {
      // Master agent sees themselves + all orgs where master_agent_id = their org
      query = query.or(`id.eq.${user.org_id},master_agent_id.eq.${user.org_id}`)
    } else if (user.isMasterDealer) {
      // Master dealer sees themselves + all orgs where master_dealer_id = their org
      // (captures full_dealer, service_dealer, install_contractor, sales_partner under them)
      query = query.or(`id.eq.${user.org_id},master_dealer_id.eq.${user.org_id},parent_org_id.eq.${user.org_id}`)
    } else if (user.isFullDealer) {
      // Full dealer sees themselves + sales_partners with parent_org_id = their org
      query = query.or(`id.eq.${user.org_id},parent_org_id.eq.${user.org_id}`)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const orgs = (data ?? []).map((o: any) => ({
      id:          o.id,
      name:        o.name,
      org_tier:    o.org_tier,
      tier_label:  TIER_LABELS[o.org_tier] ?? o.org_tier,
      tier_color:  TIER_COLORS[o.org_tier] ?? '',
    }))

    return NextResponse.json({ orgs, selfOnly: false })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
