import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

const STAGE_ORDER = [
  'meet_present', 'survey_request', 'propose', 'negotiate', 'won', 'lost', 'dead'
]
const STAGE_LABELS: Record<string, string> = {
  meet_present:   'Meet & Present',
  survey_request: 'Survey Request',
  propose:        'Propose',
  negotiate:      'Negotiate',
  won:            'Closed Won',
  lost:           'Lost',
  dead:           'Dead',
}
const STAGE_PROB: Record<string, number> = {
  meet_present: 20, survey_request: 35, propose: 50,
  negotiate: 75, won: 100, lost: 0, dead: 0,
}

export async function GET(req: NextRequest) {
  try {
    const user  = await getCurrentUser()
    const scope = await resolveOrgScope(user)

    const { searchParams } = new URL(req.url)
    const stage  = searchParams.get('stage')
    const search = searchParams.get('q')
    const type   = searchParams.get('type')

    let query = supabase
      .from('opportunities')
      .select('*')
      .not('stage', 'in', '("dead")')
      .order('created_at', { ascending: false })

    // ── Org isolation ──────────────────────────────────────────────
    query = applyOrgScope(query, scope, 'org_id')

    if (stage)  query = query.eq('stage', stage)
    if (type)   query = query.eq('opp_type', type)
    if (search) query = query.ilike('name', `%${search}%`)

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

    let pipelineTotal = 0
    records.forEach((opp: any) => {
      if (grouped[opp.stage]) {
        grouped[opp.stage].records.push(opp)
        grouped[opp.stage].total += Number(opp.amount || 0)
        if (!['won', 'lost', 'dead'].includes(opp.stage)) {
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
        open:  records.filter((o: any) => !['won','lost','dead'].includes(o.stage)).length,
        won:   records.filter((o: any) => o.stage === 'won').length,
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
    const org_id = canChooseOrg ? (body.org_id ?? user.org_id ?? null) : (user.org_id ?? null)

    const { data, error } = await supabase
      .from('opportunities')
      .insert({
        ...body,
        stage,
        probability:    body.probability ?? STAGE_PROB[stage],
        owner_name:     user.name,
        owner_initials: user.initials,
        org_id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
