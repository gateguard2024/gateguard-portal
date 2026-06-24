/**
 * POST /api/maintenance/[id]/notify-customer  { event, tech_eta? }
 * Sends a customer-facing SMS for this job (on-my-way / arrived / complete / review)
 * to the site's contact phone, using the shared Twilio templates. Logged on the job.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSMS, type SMSEvent } from '@/lib/sms'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALLOWED: SMSEvent[] = ['scheduled', 'in_route', 'on_site', 'completed', 'review_request']
const LABEL: Record<string, string> = { scheduled: 'Scheduled notice', in_route: 'On my way', on_site: 'Arrived', completed: 'Job complete', review_request: 'Review request' }

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    let user: { name?: string } | null = null
    try { user = await getCurrentUser() } catch { user = null }
    const body = await req.json().catch(() => ({}))
    const event = body.event as SMSEvent
    if (!ALLOWED.includes(event)) return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 })

    const { data: wo } = await supabase
      .from('work_orders')
      .select('wo_number, title, customer_name, assignee_name, site_id, scheduled_date')
      .eq('id', params.id).single()
    if (!wo) return NextResponse.json({ error: 'Work order not found' }, { status: 404 })

    let phone: string | null = null, propertyName: string | null = wo.customer_name ?? null
    if (wo.site_id) {
      const { data: s } = await supabase.from('sites').select('primary_contact_phone, pm_phone, name').eq('id', wo.site_id).maybeSingle()
      phone = (s?.primary_contact_phone ?? s?.pm_phone) as string | null
      propertyName = (s?.name as string) ?? propertyName
    }
    if (!phone) return NextResponse.json({ error: 'No customer phone on file for this site. Add a primary contact phone on the site.' }, { status: 400 })

    await sendSMS({
      event, to: phone,
      wo_number: wo.wo_number ?? '', title: wo.title ?? 'Service',
      customer_name: wo.customer_name ?? propertyName ?? 'Customer',
      tech_name: wo.assignee_name ?? undefined,
      tech_eta: body.tech_eta || undefined,
      scheduled_date: wo.scheduled_date ?? undefined,
      property_name: propertyName ?? undefined,
      review_url: process.env.GOOGLE_REVIEW_URL || undefined,
    })

    // Best-effort log on the job timeline.
    try {
      await supabase.from('wo_comments').insert({ work_order_id: params.id, author_name: user?.name ?? 'System', content: `📱 Texted customer: ${LABEL[event] ?? event}${body.tech_eta ? ` (ETA ${body.tech_eta})` : ''}` })
    } catch { /* non-blocking */ }

    return NextResponse.json({ ok: true, sent_to: phone.replace(/\d(?=\d{4})/g, '•') })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not send' }, { status: 500 })
  }
}
