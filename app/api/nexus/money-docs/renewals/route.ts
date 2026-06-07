import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type RenewalBucket = 'expiring_soon' | 'needs_followup' | 'active' | 'recently_renewed'

type CustomerRow = {
  id: string
  status?: string | null
  mrr?: number | string | null
  setup_total?: number | string | null
  contract_start?: string | null
  contract_end?: string | null
  notes?: string | null
  company_id?: string | null
  property_id?: string | null
}

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function daysTo(dateText?: string | null): number | null {
  if (!dateText) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(`${dateText}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return Math.round((date.getTime() - today.getTime()) / 86400000)
}

function bucketFor(row: CustomerRow): RenewalBucket {
  const endDays = daysTo(row.contract_end)
  const startDays = daysTo(row.contract_start)
  const active = String(row.status ?? '').toLowerCase() === 'active'

  if (active && startDays !== null && startDays <= 0 && startDays >= -30) return 'recently_renewed'
  if (endDays !== null && endDays < 0) return 'needs_followup'
  if (endDays !== null && endDays <= 90) return 'expiring_soon'
  if (!row.contract_end) return 'needs_followup'
  return 'active'
}

async function nameMap(table: 'companies' | 'properties', ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  const map = new Map<string, string>()
  if (uniqueIds.length === 0) return map
  const { data } = await supabase.from(table).select('id,name').in('id', uniqueIds)
  for (const row of data ?? []) map.set(row.id, row.name)
  return map
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    let query = supabase
      .from('customers')
      .select('id,status,mrr,setup_total,contract_start,contract_end,notes,company_id,property_id')
      .order('contract_end', { ascending: true, nullsFirst: false })
      .limit(80)

    if (!user.isCorporate && user.org_id) query = query.eq('dealer_org_id', user.org_id)

    const { data, error } = await query
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })

    const rows = (data ?? []) as CustomerRow[]
    const companies = await nameMap('companies', rows.map(row => row.company_id ?? ''))
    const properties = await nameMap('properties', rows.map(row => row.property_id ?? ''))

    const renewals = rows.map(row => {
      const bucket = bucketFor(row)
      const companyName = row.company_id ? companies.get(row.company_id) ?? null : null
      const propertyName = row.property_id ? properties.get(row.property_id) ?? null : null
      return {
        id: row.id,
        title: companyName || propertyName || 'Customer Renewal',
        status: row.status || 'active',
        mrr: toNumber(row.mrr),
        setup_total: toNumber(row.setup_total),
        contract_start: row.contract_start ?? null,
        contract_end: row.contract_end ?? null,
        company_name: companyName,
        property_name: propertyName,
        notes: row.notes ?? null,
        bucket,
        urgency: bucket === 'needs_followup' ? 'high' : bucket === 'expiring_soon' ? 'medium' : 'low',
      }
    })

    return NextResponse.json({ success: true, renewals })
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Could not load renewals.' }, { status: 500 })
  }
}
