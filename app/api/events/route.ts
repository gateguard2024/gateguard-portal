import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function addDays(dateStr: string | null | undefined, days: number): string | null {
  if (!dateStr) return null
  const d = new Date(`${dateStr}T00:00:00`)
  if (isNaN(d.getTime())) return null
  d.setDate(d.getDate() + (days || 0))
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let q = supabase.from('property_events').select('*').order('event_date', { ascending: true, nullsFirst: false })
  if (!user.isCorporate) q = q.eq('org_id', user.org_id)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ events: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body.title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const { data: evt, error } = await supabase.from('property_events').insert({
    org_id: user.org_id ?? null,
    created_by: user.id,
    host_user_id: body.host_user_id ?? user.id,
    host_name: body.host_name ?? user.name ?? null,
    title: body.title.trim(),
    event_type: body.event_type ?? 'lunch_learn',
    site_id: body.site_id ?? null,
    aria_property_id: body.aria_property_id ?? null,
    property_name: body.property_name ?? null,
    status: 'planning',
    event_date: body.event_date ?? null,
    start_time: body.start_time ?? null,
    end_time: body.end_time ?? null,
    venue: body.venue ?? null,
    goal: body.goal ?? null,
    expected_attendance: body.expected_attendance ?? null,
    budget: body.budget ?? null,
    template_id: body.template_id ?? null,
  }).select().single()
  if (error || !evt) return NextResponse.json({ error: error?.message ?? 'Create failed' }, { status: 500 })

  // Clone template children (checklist, supplies, campaign) with computed dates.
  if (body.template_id) {
    const [{ data: tTasks }, { data: tSupplies }, { data: tCampaign }] = await Promise.all([
      supabase.from('event_template_tasks').select('*').eq('template_id', body.template_id),
      supabase.from('event_template_supplies').select('*').eq('template_id', body.template_id),
      supabase.from('event_template_campaign').select('*').eq('template_id', body.template_id),
    ])
    if (tTasks?.length) await supabase.from('event_checklist_items').insert(tTasks.map(t => ({
      event_id: evt.id, category: t.category, title: t.title, due_date: addDays(evt.event_date, t.offset_days), status: 'open',
    })))
    if (tSupplies?.length) await supabase.from('event_supplies').insert(tSupplies.map(sp => ({
      event_id: evt.id, item: sp.item, qty: sp.qty, vendor: sp.vendor, status: 'needed',
    })))
    if (tCampaign?.length) await supabase.from('event_campaign_steps').insert(tCampaign.map(c => ({
      event_id: evt.id, step: c.step, send_at: addDays(evt.event_date, c.offset_days),
      email_subject: c.email_subject, email_html: c.email_html, status: 'draft', sort_order: c.sort_order,
    })))
  }

  return NextResponse.json({ event: evt })
}
