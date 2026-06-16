import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { leadInScope } from '@/lib/crm-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Tolerant strip of any legacy show_ prefix — leads use plain UUIDs now
function parseLeadId(id: string) {
  return { uuid: id.replace(/^show_/, '') }
}

// GET /api/crm/leads/[id]/activities
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await leadInScope(params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { uuid } = parseLeadId(params.id)

  const { data, error } = await supabase
    .from('crm_activities')
    .select('id, type, subject, body, due_at, completed_at, created_by_name, created_at, outcome, direction, email_status, to_email, sent_via_resend')
    .eq('lead_id', uuid)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ activities: data ?? [] })
}

// POST /api/crm/leads/[id]/activities — log a call, email, note, task, or meeting
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await leadInScope(params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { uuid } = parseLeadId(params.id)
  const body = await req.json()
  const { type, subject, body: actBody, due_at, outcome, direction, duration_min } = body

  if (!type || !subject) {
    return NextResponse.json({ error: 'type and subject are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('crm_activities')
    .insert({
      lead_id:         uuid,
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
