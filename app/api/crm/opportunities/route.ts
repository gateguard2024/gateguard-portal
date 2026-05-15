import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

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
    const { searchParams } = new URL(req.url)
    const stage  = searchParams.get('stage')
    const search = searchParams.get('q')
    const type   = searchParams.get('type')

    let query = supabase
      .from('opportunities')
      .select('*')
      .not('stage', 'in', '("dead")')
      .order('created_at', { ascending: false })

    if (stage) query = query.eq('stage', stage)
    if (type)  query = query.eq('opp_type', type)
    if (search) query = query.ilike('name', `%${search}%`)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Group by stage for kanban
    const grouped = STAGE_ORDER.reduce((acc, s) => {
      acc[s] = { label: STAGE_LABELS[s], records: [], total: 0 }
      return acc
    }, {} as Record<string, any>)

    let pipelineTotal = 0
    ;(data || []).forEach((opp: any) => {
      if (grouped[opp.stage]) {
        grouped[opp.stage].records.push(opp)
        grouped[opp.stage].total += Number(opp.amount || 0)
        if (opp.stage !== 'won' && opp.stage !== 'lost') {
          pipelineTotal += Number(opp.amount || 0)
        }
      }
    })

    return NextResponse.json({
      records: data || [],
      grouped,
      pipelineTotal,
      counts: {
        total: data?.length || 0,
        open: data?.filter((o: any) => !['won','lost','dead'].includes(o.stage)).length || 0,
        won:  data?.filter((o: any) => o.stage === 'won').length || 0,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const stage = body.stage || 'meet_present'
    const user = await getCurrentUser()

    const { data, error } = await supabase
      .from('opportunities')
      .insert({
        ...body,
        stage,
        probability: body.probability ?? STAGE_PROB[stage],
        owner_name: user.name,
        owner_initials: user.initials,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
