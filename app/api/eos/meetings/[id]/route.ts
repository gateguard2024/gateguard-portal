import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getCurrentUser()

    const { data, error } = await supabase
      .from('eos_meetings')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()

    if (error) {
      console.error('[/api/eos/meetings/[id] GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/eos/meetings/[id] GET] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getCurrentUser()
    const body = await req.json()

    const { data, error } = await supabase
      .from('eos_meetings')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('[/api/eos/meetings/[id] PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/eos/meetings/[id] PATCH] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getCurrentUser()

    const { error } = await supabase
      .from('eos_meetings')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('[/api/eos/meetings/[id] DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/eos/meetings/[id] DELETE] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
