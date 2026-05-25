import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    await getCurrentUser()
    // Return system defaults (org_id null) + any org-specific accounts
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('is_active', true)
      .order('account_number', { ascending: true })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json()

    if (!body.account_number?.trim()) return NextResponse.json({ error: 'account_number is required' }, { status: 400 })
    if (!body.name?.trim())           return NextResponse.json({ error: 'name is required' }, { status: 400 })
    if (!body.type?.trim())           return NextResponse.json({ error: 'type is required' }, { status: 400 })

    const { data, error } = await supabase
      .from('chart_of_accounts')
      .insert({
        account_number: body.account_number.trim(),
        name:           body.name.trim(),
        description:    body.description?.trim() ?? null,
        type:           body.type,
        sub_type:       body.sub_type ?? null,
        parent_id:      body.parent_id ?? null,
        is_system:      false,
        is_active:      true,
        org_id:         user.org_id ?? null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
