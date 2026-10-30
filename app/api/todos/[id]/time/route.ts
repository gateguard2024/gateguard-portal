/**
 * Time on a task (migration 194: todo_time_entries).
 * POST { action: 'start' }                        — start your timer (stops any other timer you have running)
 * POST { action: 'stop' }                         — stop your running timer on this task
 * POST { action: 'log', minutes, note? }          — add time by hand
 * DELETE ?entry_id=…                              — remove one of your entries
 * Needs edit rights on the task.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { supabaseAdmin as supabase, loadTodoFor, logActivity } from '@/lib/todo-activity'

export const dynamic = 'force-dynamic'

const minutesBetween = (start: string, end: Date) => Math.max(1, Math.round((end.getTime() - new Date(start).getTime()) / 60000))

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const caller = await getCurrentUser()
    const found = await loadTodoFor(params.id, caller, 'edit')
    if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status })
    const { action, minutes, note } = await req.json()
    const now = new Date()

    if (action === 'start') {
      // One running timer per person: close any other one first.
      const { data: running } = await supabase.from('todo_time_entries').select('id, started_at, todo_id').eq('user_id', caller.id).is('ended_at', null)
      for (const r of running ?? []) {
        if (r.todo_id === params.id) return NextResponse.json({ entry: r })
        const { error } = await supabase.from('todo_time_entries').update({ ended_at: now.toISOString(), minutes: minutesBetween(r.started_at, now) }).eq('id', r.id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }
      const { data, error } = await supabase.from('todo_time_entries')
        .insert({ todo_id: params.id, user_id: caller.id, user_name: caller.name, started_at: now.toISOString() })
        .select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ entry: data }, { status: 201 })
    }

    if (action === 'stop') {
      const { data: run } = await supabase.from('todo_time_entries').select('id, started_at')
        .eq('todo_id', params.id).eq('user_id', caller.id).is('ended_at', null).maybeSingle()
      if (!run) return NextResponse.json({ error: 'No timer is running on this task.' }, { status: 400 })
      const mins = minutesBetween(run.started_at, now)
      const { data, error } = await supabase.from('todo_time_entries').update({ ended_at: now.toISOString(), minutes: mins }).eq('id', run.id).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await logActivity(params.id, caller, [{ action: 'time', field_name: 'time logged', new_value: `${mins} min` }])
      return NextResponse.json({ entry: data })
    }

    if (action === 'log') {
      const mins = Math.round(Number(minutes))
      if (!Number.isFinite(mins) || mins <= 0 || mins > 24 * 60) return NextResponse.json({ error: 'Enter minutes between 1 and 1440.' }, { status: 400 })
      const { data, error } = await supabase.from('todo_time_entries')
        .insert({ todo_id: params.id, user_id: caller.id, user_name: caller.name, started_at: now.toISOString(), ended_at: now.toISOString(), minutes: mins, note: note ?? null })
        .select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await logActivity(params.id, caller, [{ action: 'time', field_name: 'time logged', new_value: `${mins} min` }])
      return NextResponse.json({ entry: data }, { status: 201 })
    }

    return NextResponse.json({ error: "action must be 'start', 'stop' or 'log'" }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const caller = await getCurrentUser()
    const found = await loadTodoFor(params.id, caller, 'edit')
    if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status })
    const entryId = new URL(req.url).searchParams.get('entry_id')
    if (!entryId) return NextResponse.json({ error: 'entry_id is required' }, { status: 400 })
    let q = supabase.from('todo_time_entries').delete().eq('id', entryId).eq('todo_id', params.id)
    if (!caller.isCorporate) q = q.eq('user_id', caller.id)
    const { error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
