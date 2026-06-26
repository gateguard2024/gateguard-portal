/**
 * Quick Log — triage a single capture.
 * PATCH /api/capture/[id]
 *   { action: 'edit',   body?, kind?, about? }      → edit the capture
 *   { action: 'done' | 'reopen' }                   → close / reopen
 *   { action: 'make_todo', due_date? }              → create a portal To-Do, mark triaged
 *   { action: 'attach', linked_type, linked_id, label } → log onto a lead/opp/job, mark triaged
 *   { action: 'attach', linked_type:'new_lead', label } → create a lead first, then log
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const clip = (s: string, n = 90) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const caller = await getCurrentUser()
    const body = await req.json().catch(() => ({}))
    const action = String(body.action ?? 'edit')
    const id = params.id

    // Confirm the capture is the caller's before any write.
    const { data: cap } = await supabase.from('capture_log').select('*').eq('id', id).eq('user_id', caller.id).maybeSingle()
    if (!cap) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

    const now = new Date().toISOString()

    if (action === 'edit') {
      const patch: Record<string, unknown> = { updated_at: now }
      if (typeof body.body === 'string' && body.body.trim()) patch.body = body.body.trim()
      if (typeof body.kind === 'string') patch.kind = body.kind
      if (typeof body.about === 'string') patch.about = body.about.trim() || null
      const { data, error } = await supabase.from('capture_log').update(patch).eq('id', id).select('*').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, capture: data })
    }

    if (action === 'done' || action === 'reopen') {
      const { data, error } = await supabase.from('capture_log').update({ status: action === 'done' ? 'done' : 'open', updated_at: now }).eq('id', id).select('*').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, capture: data })
    }

    if (action === 'make_todo') {
      const { data: todo, error: tErr } = await supabase.from('todos').insert({
        title: clip(cap.body),
        body: cap.body,
        priority: 'normal',
        status: 'open',
        due_date: typeof body.due_date === 'string' && body.due_date ? body.due_date : null,
        org_id: cap.org_id ?? caller.org_id ?? null,
        created_by: caller.id,
        created_by_name: caller.name,
        assigned_to: caller.id,
        assigned_to_name: caller.name,
        linked_type: cap.linked_type ?? null,
        linked_id: cap.linked_id ?? null,
        linked_label: 'From Quick Log',
      }).select('id').single()
      if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })
      const { data, error } = await supabase.from('capture_log').update({ status: 'triaged', promoted_todo_id: todo.id, kind: cap.kind === 'note' ? 'todo' : cap.kind, updated_at: now }).eq('id', id).select('*').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, capture: data, todo_id: todo.id })
    }

    if (action === 'attach') {
      let linkedType = String(body.linked_type ?? '')
      let linkedId = body.linked_id ? String(body.linked_id) : ''
      const label = String(body.label ?? '').trim()

      // Create a brand-new lead on the spot from a name, then attach to it.
      if (linkedType === 'new_lead') {
        if (!label) return NextResponse.json({ error: 'Enter a name for the new lead.' }, { status: 400 })
        const { data: lead, error: lErr } = await supabase.from('leads').insert({
          org_id: cap.org_id ?? caller.org_id ?? null,
          company_name: label,
          contact_name: label,
          stage: 'prospect',
          source: 'nexus_quicklog',
          notes: cap.body,
          assigned_to: caller.id,
        }).select('id').single()
        if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })
        linkedType = 'lead'; linkedId = lead.id
      }

      if (!['lead', 'opportunity', 'work_order'].includes(linkedType) || !linkedId) {
        return NextResponse.json({ error: 'Pick something to attach to.' }, { status: 400 })
      }

      const isCall = cap.kind === 'call'
      if (linkedType === 'work_order') {
        const { error: cErr } = await supabase.from('wo_comments').insert({
          work_order_id: linkedId,
          author_name: caller.name,
          content: `${isCall ? '📞 ' : ''}${cap.body}`,
        })
        if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
      } else {
        const { error: aErr } = await supabase.from('crm_activities').insert({
          dealer_org_id: cap.org_id ?? caller.org_id ?? null,
          created_by: caller.id,
          type: isCall ? 'call' : 'note',
          subject: isCall ? 'Call (from Quick Log)' : 'Note (from Quick Log)',
          body: cap.body,
          lead_id: linkedType === 'lead' ? linkedId : null,
          opportunity_id: linkedType === 'opportunity' ? linkedId : null,
        })
        if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })
      }

      const { data, error } = await supabase.from('capture_log').update({ status: 'triaged', linked_type: linkedType, linked_id: linkedId, about: label || cap.about, updated_at: now }).eq('id', id).select('*').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, capture: data, linked_type: linkedType, linked_id: linkedId })
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not update' }, { status: 500 })
  }
}
