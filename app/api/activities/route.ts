/**
 * GET  /api/activities?record_type=lead|opportunity|site|work_order|customer&record_id=UUID
 *   — fetch activities for a record, ordered by created_at DESC
 *
 * POST /api/activities
 *   — create a new activity linked to any record type
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type RecordType = 'lead' | 'opportunity' | 'site' | 'work_order' | 'customer'

/** Maps record_type to the correct FK column in crm_activities */
function fkColumn(recordType: RecordType): string {
  switch (recordType) {
    case 'lead':         return 'lead_id'
    case 'opportunity':  return 'opportunity_id'
    case 'site':         return 'site_id'
    case 'work_order':   return 'work_order_id'
    case 'customer':     return 'org_id'
    default:             return 'lead_id'
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const recordType = searchParams.get('record_type') as RecordType | null
    const recordId   = searchParams.get('record_id')

    if (!recordType || !recordId) {
      return NextResponse.json({ error: 'record_type and record_id are required' }, { status: 400 })
    }

    const col = fkColumn(recordType)

    const { data, error } = await supabase
      .from('crm_activities')
      .select('id, type, subject, body, outcome, direction, created_by_name, created_at')
      .eq(col, recordId)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ activities: data ?? [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getCurrentUser()
    const body   = await req.json()
    const {
      record_type,
      record_id,
      type,
      subject,
      body: actBody,
      outcome,
      direction,
    } = body

    if (!record_type || !record_id) {
      return NextResponse.json({ error: 'record_type and record_id are required' }, { status: 400 })
    }
    if (!type || !subject) {
      return NextResponse.json({ error: 'type and subject are required' }, { status: 400 })
    }

    const col = fkColumn(record_type as RecordType)

    const { data, error } = await supabase
      .from('crm_activities')
      .insert({
        [col]:           record_id,
        type:            type.toLowerCase(),
        subject:         subject.trim(),
        body:            actBody?.trim() || null,
        outcome:         outcome?.trim() || null,
        direction:       direction || null,
        created_by_name: caller.name,
        created_at:      new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ activity: data }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
