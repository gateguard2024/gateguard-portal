import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'
import { notifyWOEvent } from '@/lib/email'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET /api/maintenance — list work orders scoped to the caller's org hierarchy
export async function GET(req: NextRequest) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  const { searchParams } = new URL(req.url)
  const status   = searchParams.get('status')
  const priority = searchParams.get('priority')
  const assignee = searchParams.get('assignee_id')
  const q        = searchParams.get('q')

  let query = supabase
    .from('work_orders')
    .select(`
      id, wo_number, title, description, customer_name,
      assignee_id, assignee_name, priority, status, job_type,
      scheduled_date, due_date, completed_at, notes, site_id,
      created_at, updated_at
    `)
    .order('created_at', { ascending: false })

  // ── Org isolation ──────────────────────────────────────────────────
  query = applyOrgScope(query, scope, 'org_id')

  if (status)   query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)
  if (assignee) query = query.eq('assignee_id', assignee)
  if (q)        query = query.or(`title.ilike.%${q}%,customer_name.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ work_orders: data ?? [] })
}

// POST /api/maintenance — create work order, auto-stamped with caller's org_id
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  const body = await req.json()

  const {
    title, description, customer_name, assignee_id, assignee_name,
    priority = 'normal', status = 'open', job_type = 'Repair',
    scheduled_date, due_date, notes, site_id,
  } = body

  if (!title || !customer_name) {
    return NextResponse.json({ error: 'title and customer_name are required' }, { status: 400 })
  }

  // Auto-stamp org_id from the authenticated user
  const org_id = user.isCorporate ? (body.org_id ?? null) : (user.org_id ?? null)

  const { data, error } = await supabase
    .from('work_orders')
    .insert({
      title, description, customer_name,
      assignee_id:    assignee_id ?? null,
      assignee_name:  assignee_name ?? null,
      priority, status, job_type,
      scheduled_date: scheduled_date ?? null,
      due_date:       due_date ?? null,
      notes:          notes ?? null,
      site_id:        site_id ?? null,
      org_id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire "created" notification if site has a contact email
  if (site_id && data) {
    supabase
      .from('sites')
      .select('primary_contact_email, pm_email, name')
      .eq('id', site_id)
      .single()
      .then(({ data: site }) => {
        const recipientEmail = site?.pm_email ?? site?.primary_contact_email ?? null
        if (recipientEmail) {
          notifyWOEvent({
            work_order_id:   data.id,
            wo_number:       data.wo_number,
            title:           data.title,
            customer_name:   data.customer_name,
            event:           'created',
            recipient_email: recipientEmail,
            assignee_name:   data.assignee_name ?? undefined,
          }).catch(console.error)
        }
      })
      .catch(console.error)
  }

  return NextResponse.json({ work_order: data }, { status: 201 })
}
