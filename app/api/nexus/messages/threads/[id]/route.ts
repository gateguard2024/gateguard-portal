/**
 * PATCH /api/nexus/messages/threads/[id]   { linked_type, linked_id, linked_label }
 * Assigns (or clears) the CRM record an email thread belongs to. Scoped to the
 * thread's owner. Pass linked_type:null to unlink.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  const body = await req.json().catch(() => ({}))

  // Confirm the thread belongs to this user before mutating.
  const { data: thread } = await supabase
    .from('message_threads').select('id, user_id').eq('id', params.id).maybeSingle()
  if (!thread || thread.user_id !== user.id) {
    return NextResponse.json({ error: 'Thread not found.' }, { status: 404 })
  }

  // Mark-read (clears the unread dot when a conversation is opened).
  if (body.read === true) {
    await supabase.from('message_threads').update({ unread_count: 0, updated_at: new Date().toISOString() }).eq('id', params.id)
    return NextResponse.json({ ok: true })
  }

  // Otherwise: assign/clear the linked CRM record.
  const linkedType = clean(body.linked_type)
  const { error } = await supabase
    .from('message_threads')
    .update({
      linked_type:  linkedType || null,
      linked_id:    linkedType ? (clean(body.linked_id) || null) : null,
      linked_label: linkedType ? (clean(body.linked_label) || null) : null,
      updated_at:   new Date().toISOString(),
    })
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
