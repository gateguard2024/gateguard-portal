import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    await getCurrentUser()
    const { searchParams } = new URL(req.url)
    const type   = searchParams.get('type')
    const search = searchParams.get('q')

    let query = supabase
      .from('vendors')
      .select('*, vendor_bills(id,status,total,amount_paid)')
      .order('name', { ascending: true })

    if (type && type !== 'all') query = query.eq('type', type)
    if (search) query = query.ilike('name', `%${search}%`)

    const { data, error } = await query
    if (error) throw error

    // Compute AP balance per vendor
    const vendors = (data ?? []).map((v: any) => {
      const bills = v.vendor_bills ?? []
      const apBalance = bills.reduce((sum: number, b: any) =>
        b.status !== 'paid' && b.status !== 'void' ? sum + (b.total - b.amount_paid) : sum, 0)
      return { ...v, ap_balance: apBalance, bill_count: bills.length }
    })

    return NextResponse.json(vendors)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json()

    const { data, error } = await supabase
      .from('vendors')
      .insert({ ...body, created_by: user.name ?? user.id })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
