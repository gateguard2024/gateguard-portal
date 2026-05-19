import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { scorecard_id, week_of, value } = body

    if (!scorecard_id || !week_of) {
      return NextResponse.json({ error: 'scorecard_id and week_of are required' }, { status: 400 })
    }

    // Upsert: ON CONFLICT (scorecard_id, week_of) DO UPDATE SET value = excluded.value
    const { data, error } = await supabase
      .from('eos_scorecard_entries')
      .upsert(
        { scorecard_id, week_of, value: value ?? '' },
        { onConflict: 'scorecard_id,week_of' }
      )
      .select()
      .single()

    if (error) {
      console.error('[/api/eos/scorecard/entries POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (err) {
    console.error('[/api/eos/scorecard/entries POST] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
