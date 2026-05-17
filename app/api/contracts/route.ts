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
    .from('contracts')
    .select(`
      id, contract_number, title, status,
      setup_amount, mrr, total_value, term_months,
      start_date, end_date, auto_renew, renewal_notice_days,
      terms_summary, document_url, notes, assigned_rep,
      is_active, created_at, updated_at,
      org_id, client_org_id, site_id, quote_id,
      client_org:organizations!contracts_client_org_id_fkey(id, name),
      site:sites!contracts_site_id_fkey(id, name),
      signatories:contract_signatories(id, role, name, email, signed, signed_at)
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (!caller.isCorporate && caller.org_id) {
    query = query.eq('org_id', caller.org_id)
  }
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ contracts: data ?? [] })
}

export async function POST(req: NextRequest) {
  const caller = await getCurrentUser()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    title, client_org_id, site_id, quote_id,
    setup_amount, mrr, total_value, term_months,
    start_date, end_date, auto_renew, renewal_notice_days,
    terms_summary, document_url, notes, assigned_rep,
  } = body as Record<string, unknown>

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const org_id = (body.org_id as string | null) ?? caller.org_id
  if (!org_id) {
    return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
  }

  // Auto-generate contract_number GGC-YYYY-NNN
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('contracts')
    .select('*', { count: 'exact', head: true })
  const seq = String((count ?? 0) + 1).padStart(4, '0')
  const contract_number = `GGC-${year}-${seq}`

  const { data, error } = await supabase
    .from('contracts')
    .insert({
      org_id,
      client_org_id: client_org_id ?? null,
      site_id: site_id ?? null,
      quote_id: quote_id ?? null,
      contract_number,
      title,
      status: 'draft',
      setup_amount: setup_amount ?? 0,
      mrr: mrr ?? 0,
      total_value: total_value ?? 0,
      term_months: term_months ?? 12,
      start_date: start_date ?? null,
      end_date: end_date ?? null,
      auto_renew: auto_renew ?? true,
      renewal_notice_days: renewal_notice_days ?? 60,
      terms_summary: terms_summary ?? null,
      document_url: document_url ?? null,
      notes: notes ?? null,
      assigned_rep: assigned_rep ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contract: data }, { status: 201 })
}
