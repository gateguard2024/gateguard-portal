import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recordInScope } from '@/lib/ops-scope'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await recordInScope('incidents', params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json()
  const caller = await getCurrentUser()

  // ---- Action: promote this fault to a service work order ----
  if (body.action === 'convert_to_wo') {
    const { data: inc } = await supabase.from('incidents').select('*').eq('id', params.id).single()
    if (!inc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { data: wo, error: woErr } = await supabase.from('work_orders').insert({
      title:       inc.title,
      description: inc.description ?? `${inc.category ?? ''} fault${inc.cause ? ` — ${inc.cause}` : ''}`.trim(),
      priority:    inc.severity === 'critical' || inc.severity === 'high' ? 'high' : 'normal',
      status:      'open',
      job_type:    'service',
      site_id:     inc.site_id ?? null,
      org_id:      inc.org_id ?? caller.org_id ?? null,
    }).select().single()
    if (woErr) return NextResponse.json({ error: woErr.message }, { status: 500 })
    const { data, error } = await supabase.from('incidents')
      .update({ work_order_id: wo.id, status: inc.status === 'open' ? 'investigating' : inc.status })
      .eq('id', params.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ incident: data, work_order: wo })
  }

  const fields = ['status', 'resolved_at', 'started_at', 'description', 'title', 'severity', 'reported_by', 'category', 'cause', 'asset_id', 'work_order_id', 'source']
  const updates: Record<string, unknown> = {}
  for (const f of fields) if (body[f] !== undefined) updates[f] = body[f]

  const resolving = updates.status === 'resolved' || updates.status === 'closed'
  if (resolving && !updates.resolved_at) updates.resolved_at = new Date().toISOString()
  // Reopening clears the resolution timestamp so downtime keeps counting.
  if ((updates.status === 'open' || updates.status === 'investigating') && body.resolved_at === undefined) updates.resolved_at = null

  // Corporate may transfer the record to another company.
  if (caller.isCorporate && body.org_id) updates.org_id = body.org_id

  const { data, error } = await supabase
    .from('incidents')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // When a fault is resolved, bring its device back online.
  if (resolving && data?.asset_id) {
    const { error: aErr } = await supabase.from('site_assets').update({ status: 'active' }).eq('id', data.asset_id)
    if (aErr) console.warn('[incidents] asset restore failed:', aErr.message)
  }

  return NextResponse.json({ incident: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await recordInScope('incidents', params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { error } = await supabase
    .from('incidents')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
