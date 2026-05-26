import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    const orgId = user.org_id ?? '00000000-0000-0000-0000-000000000001'

    const { data, error } = await supabase
      .from('eos_todos')
      .select('*')
      .eq('org_id', orgId)
      .order('done', { ascending: true })
      .order('due_date', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[/api/eos/todos GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[/api/eos/todos GET] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const orgId = user.org_id ?? '00000000-0000-0000-0000-000000000001'
    const body = await req.json()

    const { text, owner, due_date, meeting } = body

    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('eos_todos')
      .insert({
        org_id: orgId,
        text,
        owner: owner ?? '',
        due_date: due_date ?? null,
        meeting: meeting ?? '',
        done: false,
      })
      .select()
      .single()

    if (error) {
      console.error('[/api/eos/todos POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Cross-post to main todos table (fire-and-forget)
    void (async () => {
      try {
        await supabase.from('todos').insert({
          org_id: orgId,
          title: text,
          assigned_to_name: owner ?? '',
          due_date: due_date ?? null,
          status: 'open',
          priority: 'medium',
          linked_type: 'eos_l10',
          linked_id: data.id,
          created_by: user.id ?? '',
        })
      } catch (_) { /* non-blocking */ }
    })()

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[/api/eos/todos POST] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
