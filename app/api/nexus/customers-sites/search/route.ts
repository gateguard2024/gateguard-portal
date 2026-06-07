import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type ResultType = 'company' | 'contact' | 'customer' | 'property' | 'site'

type SearchResult = {
  id: string
  type: ResultType
  title: string
  subtitle: string
  meta?: string
  href?: string
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function compact(parts: Array<string | null | undefined>): string {
  return parts.map(part => clean(part)).filter(Boolean).join(' • ')
}

function fullName(first?: string | null, last?: string | null): string {
  return compact([first, last]).replace(' • ', ' ') || 'Unnamed Contact'
}

function siteAddress(row: Record<string, any>): string {
  return compact([row.address, row.city, row.state, row.zip])
}

function applyOrgFilter(query: any, column: string, orgId: string | null, isCorporate: boolean) {
  if (isCorporate || !orgId) return query
  return query.eq(column, orgId)
}

async function searchCompanies(q: string, orgId: string | null, isCorporate: boolean): Promise<SearchResult[]> {
  let query = supabase
    .from('companies')
    .select('id,name,type,website,billing_address,city,state,zip,created_at')
    .or(`name.ilike.%${q}%,website.ilike.%${q}%,billing_address.ilike.%${q}%,city.ilike.%${q}%,state.ilike.%${q}%`)
    .order('updated_at', { ascending: false })
    .limit(8)
  query = applyOrgFilter(query, 'dealer_org_id', orgId, isCorporate)
  const { data, error } = await query
  if (error) return []
  return (data ?? []).map((row: any) => ({
    id: row.id,
    type: 'company' as const,
    title: row.name || 'Unnamed Company',
    subtitle: compact([row.type, siteAddress(row)]) || 'Company record',
    meta: row.website || undefined,
    href: `/crm?company=${row.id}`,
  }))
}

async function searchContacts(q: string, orgId: string | null, isCorporate: boolean): Promise<SearchResult[]> {
  let query = supabase
    .from('contacts')
    .select('id,first_name,last_name,email,phone,title,created_at')
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,title.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(8)
  query = applyOrgFilter(query, 'org_id', orgId, isCorporate)
  const { data, error } = await query
  if (error) return []
  return (data ?? []).map((row: any) => ({
    id: row.id,
    type: 'contact' as const,
    title: fullName(row.first_name, row.last_name),
    subtitle: compact([row.title, row.email, row.phone]) || 'Contact record',
    meta: row.email || row.phone || undefined,
    href: `/crm?contact=${row.id}`,
  }))
}

async function searchCustomers(q: string, orgId: string | null, isCorporate: boolean): Promise<SearchResult[]> {
  let query = supabase
    .from('customers')
    .select('id,status,mrr,contract_start,contract_end,notes,property_id,company_id,created_at')
    .or(`status.ilike.%${q}%,notes.ilike.%${q}%`)
    .order('updated_at', { ascending: false })
    .limit(5)
  query = applyOrgFilter(query, 'dealer_org_id', orgId, isCorporate)
  const { data, error } = await query
  if (error) return []
  return (data ?? []).map((row: any) => ({
    id: row.id,
    type: 'customer' as const,
    title: `Customer ${row.status ? `(${row.status})` : ''}`.trim(),
    subtitle: compact([
      row.mrr != null ? `MRR $${Number(row.mrr).toFixed(0)}` : null,
      row.contract_end ? `Ends ${row.contract_end}` : null,
      row.notes,
    ]) || 'Customer account record',
    href: `/customers/${row.id}`,
  }))
}

async function searchProperties(q: string, orgId: string | null, isCorporate: boolean): Promise<SearchResult[]> {
  let query = supabase
    .from('properties')
    .select('id,name,address,city,state,zip,property_type,unit_count,status,created_at')
    .or(`name.ilike.%${q}%,address.ilike.%${q}%,city.ilike.%${q}%,state.ilike.%${q}%,property_type.ilike.%${q}%`)
    .order('updated_at', { ascending: false })
    .limit(10)
  query = applyOrgFilter(query, 'org_id', orgId, isCorporate)
  const { data, error } = await query
  if (error) return []
  return (data ?? []).map((row: any) => ({
    id: row.id,
    type: 'property' as const,
    title: row.name || 'Unnamed Property',
    subtitle: compact([row.property_type, row.unit_count ? `${row.unit_count} units` : null, siteAddress(row)]) || 'Property record',
    meta: row.status || undefined,
    href: `/properties/${row.id}`,
  }))
}

async function searchSites(q: string, orgId: string | null, isCorporate: boolean): Promise<SearchResult[]> {
  let query = supabase
    .from('sites')
    .select('id,name,address,city,state,zip,property_type,units,status,primary_contact_name,pm_name,created_at')
    .or(`name.ilike.%${q}%,address.ilike.%${q}%,city.ilike.%${q}%,state.ilike.%${q}%,primary_contact_name.ilike.%${q}%,pm_name.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(10)
  query = applyOrgFilter(query, 'org_id', orgId, isCorporate)
  const { data, error } = await query
  if (error) return []
  return (data ?? []).map((row: any) => ({
    id: row.id,
    type: 'site' as const,
    title: row.name || 'Unnamed Site',
    subtitle: compact([row.property_type, row.units ? `${row.units} units` : null, siteAddress(row)]) || 'Site record',
    meta: compact([row.status, row.primary_contact_name || row.pm_name]) || undefined,
    href: `/sites/${row.id}`,
  }))
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const { searchParams } = new URL(req.url)
    const q = clean(searchParams.get('q'))
    const mode = clean(searchParams.get('mode')) || 'all'

    if (q.length < 2) {
      return NextResponse.json({ success: true, results: [], message: 'Type at least 2 characters.' })
    }

    const wantsCustomers = mode === 'all' || mode === 'customer'
    const wantsProperties = mode === 'all' || mode === 'property'

    const groups = await Promise.all([
      wantsCustomers ? searchCompanies(q, user.org_id, user.isCorporate) : Promise.resolve([]),
      wantsCustomers ? searchContacts(q, user.org_id, user.isCorporate) : Promise.resolve([]),
      wantsCustomers ? searchCustomers(q, user.org_id, user.isCorporate) : Promise.resolve([]),
      wantsProperties ? searchProperties(q, user.org_id, user.isCorporate) : Promise.resolve([]),
      wantsProperties ? searchSites(q, user.org_id, user.isCorporate) : Promise.resolve([]),
    ])

    const seen = new Set<string>()
    const results = groups.flat().filter(result => {
      const key = `${result.type}:${result.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 18)

    return NextResponse.json({ success: true, results })
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Could not search customers/sites.',
    }, { status: 500 })
  }
}
