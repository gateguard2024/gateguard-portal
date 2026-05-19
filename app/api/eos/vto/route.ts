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
      .from('eos_vto')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle()

    if (error) {
      console.error('[/api/eos/vto GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json(null, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/eos/vto GET] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const orgId = user.org_id ?? 'corporate'
    const body = await req.json()

    const { data, error } = await supabase
      .from('eos_vto')
      .upsert(
        { org_id: orgId, ...body, updated_at: new Date().toISOString() },
        { onConflict: 'org_id' }
      )
      .select()
      .single()

    if (error) {
      console.error('[/api/eos/vto PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/eos/vto PATCH] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
