import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveEosOrgId } from '@/lib/eos-org'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

const DEFAULT_L10_AGENDA = [
  { label: 'Segue (Good News)', duration: 5, description: 'Each person shares personal and professional good news', highlight: false },
  { label: 'Scorecard Review', duration: 5, description: 'Review each measurable — red means issues, drop to issues list', highlight: false },
  { label: 'Rock Review', duration: 5, description: 'On track or off track — no discussion, just status', highlight: false },
  { label: 'Customer / Employee Headlines', duration: 5, description: 'Headlines only — customer praise, employee news', highlight: false },
  { label: 'To-Do List Review', duration: 5, description: 'Done or not done — 7-day actions, 90% completion rate is the goal', highlight: false },
  { label: 'IDS (Issues)', duration: 60, description: 'Identify-Discuss-Solve. The most important 60 minutes.', highlight: true },
  { label: 'Conclude', duration: 5, description: 'Recap To-Dos, cascade messages to the team, rate the meeting 1-10', highlight: false },
]

export async function GET() {
  try {
    const user = await getCurrentUser()
    const orgId = await resolveEosOrgId(user)

    const { data, error } = await supabase
      .from('eos_meetings')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[/api/eos/meetings GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[/api/eos/meetings GET] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const orgId = await resolveEosOrgId(user)
    const body = await req.json()

    const {
      name,
      meeting_type = 'l10',
      day_of_week,
      time_of_day,
      duration_minutes = 90,
      attendees = [],
      agenda,
      recurrence = 'weekly',
      next_meeting_at,
      notes,
    } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const defaultAgenda = meeting_type === 'l10' ? DEFAULT_L10_AGENDA : []

    const { data, error } = await supabase
      .from('eos_meetings')
      .insert({
        org_id: orgId,
        name,
        meeting_type,
        day_of_week: day_of_week ?? null,
        time_of_day: time_of_day ?? null,
        duration_minutes,
        attendees,
        agenda: agenda ?? defaultAgenda,
        recurrence,
        next_meeting_at: next_meeting_at ?? null,
        notes: notes ?? null,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('[/api/eos/meetings POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[/api/eos/meetings POST] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
