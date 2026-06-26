import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'
import { STAGE_ORDER, STAGE_LABELS, STAGE_PROB, normalizeStage } from '@/lib/pipeline'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user  = await getCurrentUser()
    const scope = await resolveOrgScope(user)

    const { searchParams } = new URL(req.url)
    const stage   = searchParams.get('stage')
    const search  = searchParams.get('q')
    const type    = searchParams.get('type')
    const site_id = searchParams.get('site_id')

    let query = supabase
      .from('opportunities')
      .select('*')
      .not('stage', 'in', '("dead")')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // ── Org isolation ──────────────────────────────────────────────
    query = applyOrgScope(query, scope, 'dealer_org_id')

    if (stage)   query = query.eq('stage', stage)
    if (type)    query = query.eq('opp_type', type)
    if (search)  query = query.ilike('name', `%${search}%`)
    if (site_id) query = query.eq('site_id', site_id)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Apply financial gating — non-financial roles see amount as null
    const records = (data ?? []).map((opp: any) => ({
      ...opp,
      amount: user.canViewFinancials ? opp.amount : null,
    }))

    // Group by stage for kanban
    const grouped = STAGE_ORDER.reduce((acc, s) => {
      acc[s] = { label: STAGE_LABELS[s], records: [], total: 0 }
      return acc
    }, {} as Record<string, any>)

    // Bucket every opp into its canonical pipeline column. normalizeStage()
    // guarantees a column always exists, so lifecycle stages like
    // contract_invoice / sign / payment never drop off the board.
    let pipelineTotal = 0
    records.forEach((opp: any) => {
      const col = normalizeStage(opp.stage)
      if (grouped[col]) {
        grouped[col].records.push(opp)
        grouped[col].total += Number(opp.amount || 0)
        if (!['won', 'lost', 'dead'].includes(col)) {
          pipelineTotal += Number(opp.amount || 0)
        }
      }
    })

    return NextResponse.json({
      records,
      grouped,
      pipelineTotal: user.canViewFinancials ? pipelineTotal : null,
      counts: {
        total: records.length,
        open:  records.filter((o: any) => !['won','lost','dead'].includes(normalizeStage(o.stage))).length,
        won:   records.filter((o: any) => normalizeStage(o.stage) === 'won').length,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user  = await getCurrentUser()
    const body  = await req.json()
    const stage = body.stage || 'meet_present'

    // Determine org_id:
    // - Corporate, master_agent, master_dealer, full_dealer can pass a body.org_id
    //   to assign the opportunity to a specific org within their network.
    // - All others always get their own org_id stamped automatically.
    const canChooseOrg =
      user.isCorporate || user.isMasterAgent || user.isMasterDealer || user.isFullDealer
    // dealer_org_id is now nullable (migration 028) — corporate SO users have no org
    const dealer_org_id = canChooseOrg
      ? (body.dealer_org_id ?? body.org_id ?? user.org_id ?? null)
      : (user.org_id ?? null)

    // Strip any client-supplied fields that don't exist on the table
    const { org_id: _orgId, contact_name: _cn, lead_id, ...safeBody } = body

    // ── Duplicate detection ────────────────────────────────────────────────────
    // If this is a lead conversion, check if an opportunity already exists.
    if (lead_id) {
      const { data: existing } = await supabase
        .from('opportunities')
        .select('id, name, stage')
        .eq('lead_id', lead_id)
        .is('lost_at', null)
        .maybeSingle()

      if (existing) {
        return NextResponse.json(
          {
            error:      'duplicate',
            message:    `An opportunity already exists for this lead.`,
            existing_id: existing.id,
            existing_name: existing.name,
            existing_stage: existing.stage,
          },
          { status: 409 }
        )
      }
    }

    const { data, error } = await supabase
      .from('opportunities')
      .insert({
        ...safeBody,
        stage,
        probability:    body.probability ?? STAGE_PROB[normalizeStage(stage)],
        owner_name:     user.name,
        owner_initials: user.initials,
        dealer_org_id,
        ...(lead_id ? { lead_id } : {}),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // ── Lead conversion: mark the lead converted + carry its history forward ────
    if (lead_id && data?.id) {
      try {
        await supabase.from('leads')
          .update({ opportunity_id: data.id, converted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', lead_id)
        await Promise.all([
          supabase.from('crm_activities').update({ opportunity_id: data.id }).eq('lead_id', lead_id).is('opportunity_id', null),
          supabase.from('attachments').update({ opportunity_id: data.id }).eq('lead_id', lead_id).is('opportunity_id', null),
        ])
      } catch { /* conversion bookkeeping is best-effort */ }
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
