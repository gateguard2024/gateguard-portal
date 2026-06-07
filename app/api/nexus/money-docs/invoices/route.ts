import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type InvoiceRow = {
  id: string
  invoice_number?: string | null
  title?: string | null
  status?: string | null
  amount?: number | string | null
  due_date?: string | null
  paid_at?: string | null
  client_org_id?: string | null
  notes?: string | null
  created_at?: string | null
}

type InvoiceCard = {
  id: string
  invoice_number: string
  title: string
  status: string
  amount: number
  due_date: string | null
  paid_at: string | null
  customer_name: string | null
  notes: string | null
  bucket: 'past_due' | 'due_soon' | 'open' | 'recently_paid'
  urgency: 'high' | 'medium' | 'low'
}

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function daysBetweenToday(dateText?: string | null): number | null {
  if (!dateText) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(`${dateText}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return Math.round((date.getTime() - today.getTime()) / 86400000)
}

function invoiceBucket(row: InvoiceRow): InvoiceCard['bucket'] {
  const status = String(row.status ?? '').toLowerCase()
  if (row.paid_at || status === 'paid') return 'recently_paid'
  const dueIn = daysBetweenToday(row.due_date)
  if (dueIn !== null && dueIn < 0) return 'past_due'
  if (dueIn !== null && dueIn <= 14) return 'due_soon'
  return 'open'
}

function bucketUrgency(bucket: InvoiceCard['bucket']): InvoiceCard['urgency'] {
  if (bucket === 'past_due') return 'high'
  if (bucket === 'due_soon') return 'medium'
  return 'low'
}

async function clientOrgNames(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) return new Map<string, string>()
  const { data } = await supabase
    .from('organizations')
    .select('id,name')
    .in('id', uniqueIds)
  const map = new Map<string, string>()
  for (const row of data ?? []) map.set(row.id, row.name)
  return map
}

export async function GET() {
  try {
    const user = await getCurrentUser()

    let query = supabase
      .from('invoices')
      .select('id,invoice_number,title,status,amount,due_date,paid_at,client_org_id,notes,created_at')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(80)

    if (!user.isCorporate && user.org_id) query = query.eq('org_id', user.org_id)

    const { data, error } = await query
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })

    const rows = (data ?? []) as InvoiceRow[]
    const orgNames = await clientOrgNames(rows.map(row => row.client_org_id ?? '').filter(Boolean))

    const invoices: InvoiceCard[] = rows.map(row => {
      const bucket = invoiceBucket(row)
      return {
        id: row.id,
        invoice_number: row.invoice_number || 'Invoice',
        title: row.title || row.invoice_number || 'Untitled invoice',
        status: row.status || 'open',
        amount: toNumber(row.amount),
        due_date: row.due_date ?? null,
        paid_at: row.paid_at ?? null,
        customer_name: row.client_org_id ? orgNames.get(row.client_org_id) ?? null : null,
        notes: row.notes ?? null,
        bucket,
        urgency: bucketUrgency(bucket),
      }
    })

    const counts = invoices.reduce((acc, invoice) => {
      acc[invoice.bucket] = (acc[invoice.bucket] ?? 0) + 1
      return acc
    }, {} as Record<InvoiceCard['bucket'], number>)

    return NextResponse.json({ success: true, invoices, counts })
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Could not load invoices.',
    }, { status: 500 })
  }
}
