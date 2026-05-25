/**
 * GET  /api/reps          — list reps (scoped by org)
 * POST /api/reps          — create a rep
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
  const caller = await getCurrentUser()
  if (!caller.org_id && !caller.isCorporate) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Corporate sees all reps
  if (caller.isCorporate) {
    const { data, error } = await supabase
      .from('sales_reps')
      .select('*')
      .eq('is_active', true)
      .order('tier', { ascending: true })
      .order('last_name', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ reps: data ?? [] })
  }

  // For sales_partner org_tier: scope to their rep record + downline only
  // For dealer tiers: show all reps in their org
  const dealerTiers = ['master_agent', 'master_dealer', 'full_dealer', 'service_dealer', 'install_contractor']
  const isDealerAdmin = caller.org_tier && dealerTiers.includes(caller.org_tier)

  if (isDealerAdmin && caller.org_id) {
    // Dealer admins see all reps in their org
    const { data, error } = await supabase
      .from('sales_reps')
      .select('*')
      .eq('is_active', true)
      .eq('org_id', caller.org_id)
      .order('tier', { ascending: true })
      .order('last_name', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ reps: data ?? [] })
  }

  // sales_partner or rep-level user: find their own rep record by clerk_user_id,
  // then return themselves + their direct reports + sub-reports (their level and below)
  if (caller.org_id) {
    // First: find the caller's own rep record
    const { data: callerRep } = await supabase
      .from('sales_reps')
      .select('id, tier')
      .eq('org_id', caller.org_id)
      .eq('clerk_user_id', caller.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!callerRep) {
      // No rep record found — fall back to showing org's reps
      const { data, error } = await supabase
        .from('sales_reps')
        .select('*')
        .eq('is_active', true)
        .eq('org_id', caller.org_id)
        .order('tier', { ascending: true })
        .order('last_name', { ascending: true })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ reps: data ?? [] })
    }

    // Get direct reports (reps whose parent_rep_id = caller's rep id)
    const { data: directReports } = await supabase
      .from('sales_reps')
      .select('id')
      .eq('parent_rep_id', callerRep.id)
      .eq('is_active', true)

    const directReportIds = (directReports ?? []).map((r: { id: string }) => r.id)

    // Get sub-reports (reps whose parent_rep_id is one of the direct reports)
    let subReportIds: string[] = []
    if (directReportIds.length > 0) {
      const { data: subReports } = await supabase
        .from('sales_reps')
        .select('id')
        .in('parent_rep_id', directReportIds)
        .eq('is_active', true)
      subReportIds = (subReports ?? []).map((r: { id: string }) => r.id)
    }

    const allVisibleIds = [callerRep.id, ...directReportIds, ...subReportIds]

    const { data, error } = await supabase
      .from('sales_reps')
      .select('*')
      .in('id', allVisibleIds)
      .eq('is_active', true)
      .order('tier', { ascending: true })
      .order('last_name', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ reps: data ?? [] })
  }

  return NextResponse.json({ reps: [] })
}

export async function POST(req: NextRequest) {
  const caller = await getCurrentUser()
  const allowed = caller.isCorporate ||
    caller.org_tier === 'master_dealer' ||
    caller.org_tier === 'full_dealer'

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden — dealer admin only' }, { status: 403 })
  }

  const body = await req.json()
  const { first_name, last_name, email, phone, tier, commission_rate, parent_rep_id } = body

  if (!first_name?.trim() || !last_name?.trim()) {
    return NextResponse.json({ error: 'first_name and last_name are required' }, { status: 400 })
  }

  const validTiers = ['senior_rep', 'rep', 'sub_rep']
  if (tier && !validTiers.includes(tier)) {
    return NextResponse.json({ error: `Invalid tier: ${tier}` }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sales_reps')
    .insert({
      org_id:          caller.org_id ?? null,
      first_name:      first_name.trim(),
      last_name:       last_name.trim(),
      email:           email ?? null,
      phone:           phone ?? null,
      tier:            tier ?? 'rep',
      commission_rate: commission_rate ?? 0.05,
      parent_rep_id:   parent_rep_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rep: data }, { status: 201 })
}
