import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const caller = await getCurrentUser()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  let query = supabase
    .from('invoices')
    .select(`
      id, invoice_number, title, status, is_recurring,
      amount, due_date, paid_at, notes,
      created_at, updated_at,
      org_id, client_org_id,
      client_org:organizations!invoices_client_org_id_fkey(id, name)
    `)
    .order('created_at', { ascending: false })

  if (!caller.isCorporate && caller.org_id) {
    query = query.eq('org_id', caller.org_id)
  }
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ invoices: data ?? [] })
}

export async function POST(req: NextRequest) {
  const caller = await getCurrentUser()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, client_org_id, amount, due_date, is_recurring, notes } = body as Record<string, unknown>

  if (!amount) {
    return NextResponse.json({ error: 'amount is required' }, { status: 400 })
  }

  const org_id = (body.org_id as string | null) ?? caller.org_id
  if (!org_id) {
    return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
  }

  // Auto-generate invoice_number INV-YYYY-NNN
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
  const seq = String((count ?? 0) + 1).padStart(4, '0')
  const invoice_number = `INV-${year}-${seq}`

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      org_id,
      client_org_id: client_org_id ?? null,
      invoice_number,
      title: title ?? `Invoice ${invoice_number}`,
      status: 'draft',
      amount,
      is_recurring: is_recurring ?? false,
      due_date: due_date ?? null,
      notes: notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoice: data }, { status: 201 })
}
