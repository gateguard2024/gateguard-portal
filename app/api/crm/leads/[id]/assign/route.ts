import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rawId = params.id
    const body = await req.json()
    const { dealer } = body

    if (!dealer) {
      return NextResponse.json({ error: 'dealer is required' }, { status: 400 })
    }

    // show_ prefix → update show_leads table
    if (rawId.startsWith('show_')) {
      const uuid = rawId.replace('show_', '')

      const { error } = await supabase
        .from('show_leads')
        .update({ assigned_dealer: dealer })
        .eq('id', uuid)

      if (error) {
        console.error('[/api/crm/leads/[id]/assign] Supabase error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true })
    }

    // Future: handle other lead id types here
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (err) {
    console.error('[/api/crm/leads/[id]/assign] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
