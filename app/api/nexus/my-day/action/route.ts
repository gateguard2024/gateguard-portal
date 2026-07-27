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

// Ownership columns per table — a caller may act only on their own/org records.
const OWN_COLS: Record<string, string[]> = {
  todos:          ['created_by', 'assigned_to', 'org_id'],
  tracker_items:  ['owner_user_id', 'org_id'],
  crm_activities: ['dealer_org_id'],
  work_orders:    ['org_id', 'assigned_to', 'assignee_id'],
}
const TABLE_FOR: Record<string, string> = { todo: 'todos', tracker_task: 'tracker_items', crm_activity: 'crm_activities', work_order: 'work_orders' }

async function canMutate(table: string, id: string, user: { id: string; org_id?: string | null; isCorporate?: boolean }): Promise<boolean> {
  if (user.isCorporate) return true
  const cols = OWN_COLS[table]
  if (!cols) return false
  const { data } = await supabase.from(table).select(cols.join(', ')).eq('id', id).maybeSingle()
  if (!data) return false
  const row = data as unknown as Record<string, unknown>
  return cols.some(c => {
    const v = row[c]
    if (!v) return false
    return (c === 'org_id' || c === 'dealer_org_id') ? v === user.org_id : v === user.id
  })
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

    // Ownership guard — reject acting on records the caller does not own.
    const ownerTable = TABLE_FOR[itemType]
    if (!ownerTable) return NextResponse.json({ success: false, message: 'This item type is not supported.' }, { status: 400 })
    if (!(await canMutate(ownerTable, itemId, user))) return NextResponse.json({ success: false, message: 'Not found.' }, { status: 404 })

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

    if (action === 'snooze') {
      // Push the item's date forward by N days (default 1).
      const rawDays = Number((body as Record<string, unknown>).days)
      const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.floor(rawDays) : 1

      // Table + date-column mapping per item type.
      const map: Record<string, { table: string; column: string; kind: 'date' | 'timestamptz' }> = {
        todo:         { table: 'todos',          column: 'due_date',       kind: 'date' },
        tracker_task: { table: 'tracker_items',  column: 'due_date',       kind: 'date' },
        crm_activity: { table: 'crm_activities', column: 'due_at',         kind: 'timestamptz' },
        work_order:   { table: 'work_orders',    column: 'scheduled_date', kind: 'date' },
      }
      const cfg = map[itemType]
      if (!cfg) return NextResponse.json({ success: false, message: 'This item cannot be snoozed yet.' }, { status: 400 })

      // Read the current date so we push from it (fall back to today).
      const { data: current, error: readErr } = await supabase
        .from(cfg.table)
        .select(`id, ${cfg.column}`)
        .eq('id', itemId)
        .maybeSingle()
      if (readErr) return NextResponse.json({ success: false, message: readErr.message }, { status: 500 })

      const existing = current ? (current as unknown as Record<string, unknown>)[cfg.column] : null
      const base = existing ? new Date(existing as string) : new Date()
      if (Number.isNaN(base.getTime())) base.setTime(Date.now())
      base.setDate(base.getDate() + days)

      const nextValue = cfg.kind === 'date'
        ? base.toISOString().slice(0, 10)          // YYYY-MM-DD
        : base.toISOString()                        // full timestamptz

      const patch: Record<string, unknown> = { [cfg.column]: nextValue }
      if (cfg.table !== 'crm_activities') patch.updated_at = new Date().toISOString()

      const { error } = await supabase.from(cfg.table).update(patch).eq('id', itemId)
      if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })
      return NextResponse.json({ success: true, message: days === 1 ? 'Snoozed to tomorrow.' : `Snoozed ${days} days.` })
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
