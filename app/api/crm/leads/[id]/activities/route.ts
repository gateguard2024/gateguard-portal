import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Returns { isShow: boolean, uuid: string } for the raw param id
function parseLeadId(id: string) {
  const isShow = id.startsWith('show_')
  return { isShow, uuid: id.replace(/^show_/, '') }
}

// GET /api/crm/leads/[id]/activities
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { isShow, uuid } = parseLeadId(params.id)

  // Query by the correct FK column depending on whether it's a show lead
  let query = supabase
    .from('crm_activities')
    .select('id, type, subject, body, due_at, completed_at, created_by_name, created_at, outcome, direction, email_status, to_email, sent_via_resend')
    .order('created_at', { ascending: false })
    .limit(50)

  query = isShow
    ? query.eq('show_lead_id', uuid)
    : query.eq('lead_id', uuid)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ activities: data ?? [] })
}

// POST /api/crm/leads/[id]/activities — log a call, email, note, task, or meeting
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { isShow, uuid } = parseLeadId(params.id)
  const body = await req.json()
  const { type, subject, body: actBody, due_at, outcome, direction, duration_min } = body

  if (!type || !subject) {
    return NextResponse.json({ error: 'type and subject are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('crm_activities')
    .insert({
      // Use the correct FK column
      ...(isShow ? { show_lead_id: uuid } : { lead_id: uuid }),
      type:            type,
      subject:         subject,
      body:            actBody ?? null,
      due_at:          due_at ?? null,
      outcome:         outcome ?? null,
      direction:       direction ?? null,
      duration_min:    duration_min ?? null,
      created_by_name: 'Russel Feldman',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ activity: data }, { status: 201 })
}
