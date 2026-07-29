import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { getQboAuth, qboQuery } from '@/lib/qbo'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const dynamic = 'force-dynamic'

type QBCustomer = { Id: string; DisplayName: string }

// GET — QBO connection status + this site's linked customer + the customer list.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Corporate only.' }, { status: 403 })

  const { data: site } = await supabase
    .from('sites')
    .select('qbo_customer_id, qbo_customer_name')
    .eq('id', params.id)
    .maybeSingle()

  const auth = await getQboAuth()
  let customers: { id: string; name: string }[] = []
  if (auth.ok) {
    const q = await qboQuery<QBCustomer>(auth, 'select Id, DisplayName from Customer maxresults 1000')
    if (q.ok) customers = q.rows.map(c => ({ id: c.Id, name: c.DisplayName })).sort((a, b) => a.name.localeCompare(b.name))
  }

  return NextResponse.json({
    connected: auth.ok,
    current: site?.qbo_customer_id ? { id: site.qbo_customer_id, name: site.qbo_customer_name } : null,
    customers,
  })
}

// POST — link this site to a QBO customer (or clear it).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Corporate only.' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  const qbo_customer_id = b.qbo_customer_id ? String(b.qbo_customer_id) : null
  const qbo_customer_name = b.qbo_customer_name ? String(b.qbo_customer_name) : null

  const { error } = await supabase
    .from('sites')
    .update({ qbo_customer_id, qbo_customer_name, updated_at: new Date().toISOString() })
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
