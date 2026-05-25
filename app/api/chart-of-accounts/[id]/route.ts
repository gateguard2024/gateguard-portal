import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getCurrentUser()
    const body = await req.json()
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getCurrentUser()
    // Soft-delete: mark inactive (system accounts can't be deleted)
    const { data: existing } = await supabase
      .from('chart_of_accounts').select('is_system').eq('id', params.id).single()

    if (existing?.is_system) {
      return NextResponse.json({ error: 'System accounts cannot be deleted. You can deactivate them instead.' }, { status: 400 })
    }

    const { error } = await supabase
      .from('chart_of_accounts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', params.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
