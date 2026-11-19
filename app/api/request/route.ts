import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { guardSite } from '@/lib/ops-scope'
import { tagJobWithOpening } from '@/lib/openings'

// Use anon key for public endpoint — RLS allows anon INSERT on wo_requests
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Also need service role for looking up site details
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/request — public: property manager submits a maintenance request
export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    site_id, title, description, area,
    priority_requested = 'normal',
    contact_name, contact_email, contact_phone,
  } = body

  if (!site_id || !title?.trim()) {
    return NextResponse.json({ error: 'site_id and title are required' }, { status: 400 })
  }

  // Verify site exists
  const { data: site } = await supabaseAdmin
    .from('sites')
    .select('id, name')
    .eq('id', site_id)
    .single()

  if (!site) {
    return NextResponse.json({ error: 'Property not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('wo_requests')
    .insert({
      site_id,
      title:              title.trim(),
      description:        description?.trim() ?? null,
      area:               area?.trim()        ?? null,
      priority_requested,
      contact_name:       contact_name?.trim()  ?? null,
      contact_email:      contact_email?.trim() ?? null,
      contact_phone:      contact_phone?.trim() ?? null,
      status:             'new',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Email notifications (fire-and-forget) ────────────────────────────────────
  const refNumber  = data.id.slice(0, 8).toUpperCase()
  const portalBase = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'
  const portalLink = `${portalBase}/sites/${site_id}?tab=requests`

  void (async () => {
    try {
      const { sendRequestEmail, dealerAlertHtml, pmConfirmHtml } = await import('@/lib/email-request')

      // Look up dealer email via site → org
      const { data: siteOrg } = await supabaseAdmin
        .from('sites')
        .select('organizations!org_id ( primary_email )')
        .eq('id', site_id)
        .single()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dealerEmail = (siteOrg as any)?.organizations?.primary_email ?? null

      // 1. Alert the dealer
      if (dealerEmail) {
        await sendRequestEmail({
          to:      dealerEmail,
          subject: `New Property Request: ${title} — ${site.name}`,
          text:    `New maintenance request.\n\nProperty: ${site.name}\nTitle: ${title}\nPriority: ${priority_requested}\nFrom: ${contact_name ?? 'Unknown'} <${contact_email ?? 'no email'}>\n\nView: ${portalLink}`,
          html:    dealerAlertHtml(site.name, title, priority_requested, contact_name ?? '', contact_email ?? '', portalLink),
        })
      }

      // 2. Confirm to the property manager
      if (contact_email) {
        await sendRequestEmail({
          to:      contact_email,
          subject: `Request Received: ${title} (Ref: ${refNumber})`,
          text:    `Your request has been received.\n\nProperty: ${site.name}\nTitle: ${title}\nRef: ${refNumber}\n\nWe'll follow up with scheduling shortly.`,
          html:    pmConfirmHtml(site.name, title, refNumber),
        })
      }
    } catch (err) {
      console.error('[request] Email notification failed:', err)
    }
  })()

  return NextResponse.json({ success: true, request: data }, { status: 201 })
}

// PATCH /api/request — update request status (convert to WO, close, etc.)
// PATCH /api/request — staff only (Clerk): change a request's status / link the work order made from it.
// Converting tags the job with the request's gate/door (Openings, migration 233) when it names one.
const REQ_STATUSES = ['new', 'acknowledged', 'converted', 'closed', 'declined', 'cancelled']
export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const { request_id, status, converted_wo_id, note } = body as { request_id?: string; status?: string; converted_wo_id?: string; note?: string }
  if (!request_id) return NextResponse.json({ error: 'request_id required' }, { status: 400 })
  if (status && !REQ_STATUSES.includes(status)) return NextResponse.json({ error: 'Unknown status' }, { status: 400 })

  const user = await getCurrentUser()
  if (!user || user.id === 'anonymous') return NextResponse.json({ error: 'Sign in' }, { status: 401 })
  const { data: cur, error: cErr } = await supabaseAdmin.from('wo_requests').select('id, site_id, area, notes').eq('id', request_id).maybeSingle()
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
  if (!cur || !(await guardSite(req, cur.site_id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status) update.status = status
  // Closing note ("False alarm — …"), kept on the request with who + when.
  if (typeof note === 'string' && note.trim()) {
    const stamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    const line = `${status === 'closed' ? 'Closed' : 'Note'} by ${user.name ?? user.email ?? 'staff'} (${stamp}): ${note.trim().slice(0, 500)}`
    update.notes = cur.notes ? `${cur.notes}\n${line}` : line
  }
  if (converted_wo_id) {
    const { data: wo, error: wErr } = await supabaseAdmin.from('work_orders').select('id, site_id').eq('id', converted_wo_id).maybeSingle()
    if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 })
    if (!wo || (wo.site_id && wo.site_id !== cur.site_id)) return NextResponse.json({ error: 'That work order isn’t at this request’s property.' }, { status: 400 })
    update.converted_wo_id = converted_wo_id
  }

  const { data, error } = await supabaseAdmin
    .from('wo_requests')
    .update(update)
    .eq('id', request_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  let opening: string | null = null
  if (converted_wo_id) opening = await tagJobWithOpening(converted_wo_id, cur.site_id, cur.area)
  return NextResponse.json({ request: data, opening_id: opening })
}

// GET /api/request?site_id=xxx — staff only, list requests for a property they can see
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const site_id = searchParams.get('site_id')

  if (!site_id) return NextResponse.json({ error: 'site_id required' }, { status: 400 })
  const user = await getCurrentUser()
  if (!user || user.id === 'anonymous') return NextResponse.json({ error: 'Sign in' }, { status: 401 })
  if (!(await guardSite(req, site_id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('wo_requests')
    .select('*')
    .eq('site_id', site_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ requests: data ?? [] })
}
