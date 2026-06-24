import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET  — list all time entries for this WO + summary
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getCurrentUser()

    const { data, error } = await supabase
      .from('work_order_time_entries')
      .select('*')
      .eq('work_order_id', params.id)
      .order('clock_in', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const entries    = data ?? []
    const totalMins  = entries.reduce((acc, e) => acc + (e.duration_mins ?? 0), 0)
    const activeEntry = entries.find(e => !e.clock_out) ?? null

    return NextResponse.json({ entries, totalMins, activeEntry })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — log labor. Two modes:
//   { duration_mins } or { hours }  → log a completed entry directly (Log Labor)
//   (none)                          → clock in (open entry)
// Works for portal (Clerk) AND /tech (passes technician_name/technician_id).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    // user is optional — the /tech field tool calls without a Clerk session
    let user: { id?: string; name?: string; org_id?: string | null } | null = null
    try { user = await getCurrentUser() } catch { user = null }
    const techName = body.technician_name ?? user?.name ?? 'Technician'
    const techId   = body.technician_id ?? user?.id ?? null
    const orgId    = user?.org_id ?? null

    // Direct-duration logging — insert a completed entry
    const directMins = body.duration_mins != null ? Math.round(Number(body.duration_mins))
      : body.hours != null ? Math.round(Number(body.hours) * 60) : null
    if (directMins && directMins > 0) {
      const clockOut = new Date()
      const clockIn  = new Date(clockOut.getTime() - directMins * 60000)
      const { data, error } = await supabase
        .from('work_order_time_entries')
        .insert({ work_order_id: params.id, phase_id: body.phase_id ?? null, org_id: orgId, technician_id: techId, technician_name: techName, clock_in: clockIn.toISOString(), clock_out: clockOut.toISOString(), duration_mins: directMins, notes: body.notes ?? null })
        .select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data, { status: 201 })
    }

    // Clock-in: reject if one already open for this tech
    const { data: existing } = await supabase
      .from('work_order_time_entries')
      .select('id, clock_in')
      .eq('work_order_id', params.id)
      .is('clock_out', null)
      .eq('technician_name', techName)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'already_clocked_in', entry_id: existing.id, clock_in: existing.clock_in }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('work_order_time_entries')
      .insert({ work_order_id: params.id, org_id: orgId, technician_id: techId, technician_name: techName, clock_in: new Date().toISOString(), notes: body.notes ?? null })
      .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH — clock out (set clock_out, compute duration_mins)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getCurrentUser()
    const body = await req.json()

    if (!body.entry_id) {
      return NextResponse.json({ error: 'entry_id required' }, { status: 400 })
    }

    // Fetch the open entry to compute duration
    const { data: entry, error: fetchErr } = await supabase
      .from('work_order_time_entries')
      .select('id, clock_in, clock_out')
      .eq('id', body.entry_id)
      .single()

    if (fetchErr || !entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    if (entry.clock_out)    return NextResponse.json({ error: 'Already clocked out' }, { status: 409 })

    const clockOut    = new Date()
    const clockIn     = new Date(entry.clock_in)
    const durationMins = Math.round((clockOut.getTime() - clockIn.getTime()) / 60000)

    const { data, error } = await supabase
      .from('work_order_time_entries')
      .update({
        clock_out:     clockOut.toISOString(),
        duration_mins: durationMins,
        notes:         body.notes ?? null,
      })
      .eq('id', body.entry_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
