import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

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

    const work_order_id = searchParams.get('work_order_id')
    const site_id       = searchParams.get('site_id')
    const status        = searchParams.get('status')

    let query = supabase
      .from('field_tickets')
      .select('*')
      .order('created_at', { ascending: false })

    query = applyOrgScope(query, scope, 'org_id')

    if (work_order_id) query = query.eq('work_order_id', work_order_id)
    if (site_id)       query = query.eq('site_id', site_id)
    if (status)        query = query.eq('status', status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ records: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json()

    const { data, error } = await supabase
      .from('field_tickets')
      .insert({
        work_order_id:    body.work_order_id,
        site_id:          body.site_id          ?? null,
        org_id:           user.org_id            ?? null,
        technician_id:    user.id,
        technician_name:  body.technician_name   ?? user.name ?? '',
        title:            body.title             ?? '',
        findings:         body.findings          ?? null,
        work_performed:   body.work_performed    ?? null,
        materials_used:   body.materials_used    ?? null,
        labor_hours:      body.labor_hours        != null ? parseFloat(body.labor_hours) : null,
        recommendations:  body.recommendations   ?? null,
        photos:           body.photos            ?? [],
        status:           body.status            ?? 'draft',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
