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
      .from('eos_rocks')
      .select('*')
      .eq('org_id', orgId)
      .order('status', { ascending: true })
      .order('due_date', { ascending: true })

    if (error) {
      console.error('[/api/eos/rocks GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[/api/eos/rocks GET] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const orgId = user.org_id ?? '00000000-0000-0000-0000-000000000001'
    const body = await req.json()

    const { name, owner, quarter, status, progress, due_date, is_company_rock } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('eos_rocks')
      .insert({
        org_id: orgId,
        name,
        owner: owner ?? '',
        quarter: quarter ?? 'Q2-2026',
        status: status ?? 'On Track',
        progress: progress ?? 0,
        due_date: due_date ?? 'Jun 30',
        is_company_rock: is_company_rock ?? true,
      })
      .select()
      .single()

    if (error) {
      console.error('[/api/eos/rocks POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[/api/eos/rocks POST] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
