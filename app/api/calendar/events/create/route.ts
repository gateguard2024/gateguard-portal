import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type CreateHostedEventPayload = {
  title?: string
  date?: string
  start_time?: string
  end_time?: string
  location?: string
  notes?: string
  related_type?: string
  related_id?: string
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isoFromLocal(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString()
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json().catch(() => ({})) as CreateHostedEventPayload

    const title = clean(body.title)
    const date = clean(body.date)
    const startTime = clean(body.start_time)
    const endTime = clean(body.end_time)
    const location = clean(body.location)
    const notes = clean(body.notes)
    const relatedType = clean(body.related_type) || null
    const relatedId = clean(body.related_id) || null

    if (!title) return NextResponse.json({ success: false, message: 'Title is required.' }, { status: 400 })
    if (!date) return NextResponse.json({ success: false, message: 'Date is required.' }, { status: 400 })
    if (!startTime) return NextResponse.json({ success: false, message: 'Start time is required.' }, { status: 400 })
    if (!endTime) return NextResponse.json({ success: false, message: 'End time is required.' }, { status: 400 })

    const startIso = isoFromLocal(date, startTime)
    const endIso = isoFromLocal(date, endTime)

    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      return NextResponse.json({ success: false, message: 'End time must be after start time.' }, { status: 400 })
    }

    const { data: event, error } = await supabase
      .from('calendar_events')
      .insert({
        org_id: user.org_id || null,
        user_id: user.id,
        created_by: user.id,
        title,
        description: notes || null,
        location: location || null,
        start_time: startIso,
        end_time: endIso,
        is_all_day: false,
        status: 'confirmed',
        source: 'nexus',
        related_type: relatedType,
        related_id: relatedId,
        sync_status: 'not_synced',
      })
      .select('id, title, description, location, start_time, end_time, status, source, sync_status')
      .single()

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Event added to Nexus Calendar.',
      event,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Could not create calendar event.',
    }, { status: 500 })
  }
}
