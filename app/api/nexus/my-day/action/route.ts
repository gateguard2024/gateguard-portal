import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'NX'
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json().catch(() => ({}))

    const action = clean(body.action)
    const itemType = clean(body.item_type ?? body.type)
    const itemId = clean(body.item_id ?? body.id)
    const note = clean(body.note)

    if (!action) return NextResponse.json({ success: false, message: 'Choose an action.' }, { status: 400 })
    if (!itemType || !itemId) return NextResponse.json({ success: false, message: 'Select an item first.' }, { status: 400 })

    if (action === 'mark_done') {
      if (itemType === 'todo') {
        const { error } = await supabase
          .from('todos')
          .update({ status: 'done', updated_at: new Date().toISOString() })
          .eq('id', itemId)
        if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })
        return NextResponse.json({ success: true, message: 'To-do marked done.' })
      }

      if (itemType === 'tracker_task') {
        const { error } = await supabase
          .from('tracker_items')
          .update({ status: 'done', updated_at: new Date().toISOString() })
          .eq('id', itemId)
        if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })
        return NextResponse.json({ success: true, message: 'Task marked done.' })
      }

      if (itemType === 'crm_activity') {
        const { error } = await supabase
          .from('crm_activities')
          .update({ completed_at: new Date().toISOString() })
          .eq('id', itemId)
        if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })
        return NextResponse.json({ success: true, message: 'Follow-up marked done.' })
      }

      if (itemType === 'work_order') {
        const { error } = await supabase
          .from('work_orders')
          .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', itemId)
        if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })
        return NextResponse.json({ success: true, message: 'Job marked complete.' })
      }

      return NextResponse.json({ success: false, message: 'This item cannot be marked done yet.' }, { status: 400 })
    }

    if (action === 'add_note') {
      if (!note) return NextResponse.json({ success: false, message: 'Write a note first.' }, { status: 400 })

      if (itemType === 'work_order') {
        const authorName = user.name || 'Nexus User'
        const { error } = await supabase
          .from('wo_comments')
          .insert({
            work_order_id: itemId,
            author_name: authorName,
            author_initials: initials(authorName),
            content: note,
          })
        if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })
        return NextResponse.json({ success: true, message: 'Note added to job.' })
      }

      return NextResponse.json({ success: false, message: 'Notes are not supported for this item type yet.' }, { status: 400 })
    }

    return NextResponse.json({ success: false, message: 'Unknown My Day action.' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Could not complete My Day action.',
    }, { status: 500 })
  }
}
