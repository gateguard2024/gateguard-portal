import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json() as { type: string; [key: string]: unknown }

    if (body.type === 'create_todo') {
      const { data, error } = await supabase
        .from('todos')
        .insert({
          org_id: user.org_id,
          title: body.title,
          priority: body.priority ?? 'medium',
          due_date: body.due_date ?? null,
          status: 'open',
          created_by: user.name ?? 'NEXUS',
        })
        .select().single()
      if (error) throw error
      return NextResponse.json({ success: true, type: 'todo', data })
    }

    if (body.type === 'complete_todo') {
      const { error } = await supabase
        .from('todos')
        .update({ status: 'done' })
        .eq('id', body.id)
      if (error) throw error
      return NextResponse.json({ success: true, type: 'todo_completed' })
    }

    if (body.type === 'create_work_order') {
      const { data, error } = await supabase
        .from('work_orders')
        .insert({
          org_id: user.org_id,
          title: body.title,
          priority: body.priority ?? 'normal',
          status: 'open',
        })
        .select().single()
      if (error) throw error
      return NextResponse.json({ success: true, type: 'work_order', data })
    }

    return NextResponse.json({ error: 'Unknown action type' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
