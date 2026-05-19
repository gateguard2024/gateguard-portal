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
    const orgId = user.org_id ?? 'corporate'

    const { data, error } = await supabase
      .from('eos_issues')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[/api/eos/issues GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[/api/eos/issues GET] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const orgId = user.org_id ?? 'corporate'
    const body = await req.json()

    const { description, type, owner, priority, status } = body

    if (!description) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('eos_issues')
      .insert({
        org_id: orgId,
        description,
        type: type ?? 'Company',
        owner: owner ?? '',
        priority: priority ?? 'Normal',
        status: status ?? 'Open',
      })
      .select()
      .single()

    if (error) {
      console.error('[/api/eos/issues POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[/api/eos/issues POST] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
