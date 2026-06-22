import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Canonical model only: organizations (accounts) + contacts (people) + sites (properties).
// The old companies/customers/properties tables were retired in the June 2026 audit.
type ResultType = 'customer' | 'contact' | 'site'

type SearchResult = {
  id: string
  type: ResultType
  title: string
  subtitle: string
  meta?: string
  href?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function compact(parts: Array<string | null | undefined>): string {
  return parts.map(part => clean(part)).filter(Boolean).join(' • ')
}

function fullName(first?: string | null, last?: string | null): string {
  return compact([first, last]).replace(' • ', ' ') || 'Unnamed Contact'
}

function addr(row: Row): string {
  return compact([row.address, row.city, row.state, row.zip])
}

// Account search = the organization hierarchy (the real customer/account record).
async function searchOrganizations(q: string, orgId: string | null, isCorporate: boolean): Promise<SearchResult[]> {
  const query = supabase
    .from('organizations')
    .select('id,name,tier,status,address,city,state,zip,primary_email,primary_phone')
    .or(`name.ilike.%${q}%,primary_email.ilike.%${q}%,primary_phone.ilike.%${q}%,city.ilike.%${q}%,state.ilike.%${q}%`)
    .order('name', { ascending: true })
    .limit(10)
  // Org scope: a non-corporate user sees their own org + can't peek across the tree here.
  const scoped = isCorporate || !orgId ? query : query.eq('id', orgId)
  const { data, error } = await scoped
  if (error) return []
  return (data ?? []).map((row: Row) => ({
    id: row.id,
    type: 'customer' as const,
    title: row.name || 'Unnamed Account',
    subtitle: compact([row.tier, addr(row)]) || 'Account record',
    meta: row.primary_email || row.primary_phone || undefined,
    href: `/operations?org=${row.id}`,
  }))
}

async function searchContacts(q: string, orgId: string | null, isCorporate: boolean): Promise<SearchResult[]> {
  const query = supabase
    .from('contacts')
    .select('id,first_name,last_name,email,phone,title,created_at')
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,title.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(8)
  const scoped = isCorporate || !orgId ? query : query.eq('org_id', orgId)
  const { data, error } = await scoped
  if (error) return []
  return (data ?? []).map((row: Row) => ({
    id: row.id,
    type: 'contact' as const,
    title: fullName(row.first_name, row.last_name),
    subtitle: compact([row.title, row.email, row.phone]) || 'Contact record',
    meta: row.email || row.phone || undefined,
    href: `/crm?contact=${row.id}`,
  }))
}

async function searchSites(q: string, orgId: string | null, isCorporate: boolean): Promise<SearchResult[]> {
  const query = supabase
    .from('sites')
    .select('id,name,address,city,state,zip,property_type,units,status,primary_contact_name,pm_name,created_at')
    .or(`name.ilike.%${q}%,address.ilike.%${q}%,city.ilike.%${q}%,state.ilike.%${q}%,primary_contact_name.ilike.%${q}%,pm_name.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(10)
  const scoped = isCorporate || !orgId ? query : query.eq('org_id', orgId)
  const { data, error } = await scoped
  if (error) return []
  return (data ?? []).map((row: Row) => ({
    id: row.id,
    type: 'site' as const,
    title: row.name || 'Unnamed Site',
    subtitle: compact([row.property_type, row.units ? `${row.units} units` : null, addr(row)]) || 'Site record',
    meta: compact([row.status, row.primary_contact_name || row.pm_name]) || undefined,
    href: `/sites/${row.id}`,
  }))
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const { searchParams } = new URL(req.url)
    // Strip PostgREST .or() control chars (, ( )) + ilike wildcards to prevent filter injection.
    const q = clean(searchParams.get('q')).replace(/[,()%*\\]/g, ' ').replace(/\s+/g, ' ').trim()
    const mode = clean(searchParams.get('mode')) || 'all'

    if (q.length < 2) {
      return NextResponse.json({ success: true, results: [], message: 'Type at least 2 characters.' })
    }

    const wantsCustomers = mode === 'all' || mode === 'customer'
    const wantsProperties = mode === 'all' || mode === 'property'

    const groups = await Promise.all([
      wantsCustomers ? searchOrganizations(q, user.org_id, user.isCorporate) : Promise.resolve([]),
      wantsCustomers ? searchContacts(q, user.org_id, user.isCorporate) : Promise.resolve([]),
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
