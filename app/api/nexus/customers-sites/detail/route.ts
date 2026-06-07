import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type DetailType = 'company' | 'contact' | 'customer' | 'property' | 'site'

type DetailResponse = {
  id: string
  type: DetailType
  title: string
  subtitle: string
  status?: string | null
  details: Array<{ label: string; value: string }>
  actions: Array<{ label: string; href: string }>
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function valueText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  return String(value).trim()
}

function compact(parts: unknown[]): string {
  return parts.map(valueText).filter(Boolean).join(' • ')
}

function money(value: unknown): string {
  const num = Number(value)
  if (!Number.isFinite(num)) return ''
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function address(row: Record<string, unknown>): string {
  return compact([row.address, row.billing_address, row.city, row.state, row.zip])
}

function fullName(row: Record<string, unknown>): string {
  return compact([row.first_name, row.last_name]).replace(' • ', ' ') || 'Unnamed Contact'
}

function detail(label: string, value: unknown): { label: string; value: string } | null {
  const text = valueText(value)
  return text ? { label, value: text } : null
}

function details(items: Array<{ label: string; value: unknown }>): Array<{ label: string; value: string }> {
  return items.map(item => detail(item.label, item.value)).filter(Boolean) as Array<{ label: string; value: string }>
}

function applyOrgFilter(query: any, column: string, orgId: string | null, isCorporate: boolean) {
  if (isCorporate || !orgId) return query
  return query.eq(column, orgId)
}

async function countRows(table: string, column: string, value: string) {
  const { count } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, value)
  return count ?? 0
}

async function fetchCompany(id: string, orgId: string | null, isCorporate: boolean): Promise<DetailResponse | null> {
  let query = supabase
    .from('companies')
    .select('id,name,type,website,billing_address,city,state,zip,notes')
    .eq('id', id)
    .maybeSingle()
  query = applyOrgFilter(query, 'dealer_org_id', orgId, isCorporate)
  const { data } = await query
  if (!data) return null

  return {
    id: data.id,
    type: 'company',
    title: data.name || 'Unnamed Company',
    subtitle: compact([data.type, address(data)]) || 'Customer / company record',
    status: data.type,
    details: details([
      { label: 'Type', value: data.type },
      { label: 'Website', value: data.website },
      { label: 'Address', value: address(data) },
      { label: 'Notes', value: data.notes },
    ]),
    actions: [
      { label: 'Open CRM', href: `/crm?company=${data.id}` },
      { label: 'Open Customers', href: '/customers' },
    ],
  }
}

async function fetchContact(id: string, orgId: string | null, isCorporate: boolean): Promise<DetailResponse | null> {
  let query = supabase
    .from('contacts')
    .select('id,first_name,last_name,email,phone,title,notes')
    .eq('id', id)
    .maybeSingle()
  query = applyOrgFilter(query, 'org_id', orgId, isCorporate)
  const { data } = await query
  if (!data) return null

  return {
    id: data.id,
    type: 'contact',
    title: fullName(data),
    subtitle: compact([data.title, data.email, data.phone]) || 'Contact record',
    details: details([
      { label: 'Title', value: data.title },
      { label: 'Email', value: data.email },
      { label: 'Phone', value: data.phone },
      { label: 'Notes', value: data.notes },
    ]),
    actions: [
      { label: 'Open CRM', href: `/crm?contact=${data.id}` },
      { label: 'Open Customers', href: '/customers' },
    ],
  }
}

async function fetchCustomer(id: string, orgId: string | null, isCorporate: boolean): Promise<DetailResponse | null> {
  let query = supabase
    .from('customers')
    .select('id,status,mrr,setup_total,contract_start,contract_end,notes,property_id,company_id,primary_contact_id')
    .eq('id', id)
    .maybeSingle()
  query = applyOrgFilter(query, 'dealer_org_id', orgId, isCorporate)
  const { data } = await query
  if (!data) return null

  return {
    id: data.id,
    type: 'customer',
    title: 'Customer Account',
    subtitle: compact([data.status, data.mrr != null ? `${money(data.mrr)} MRR` : null, data.contract_end ? `Ends ${data.contract_end}` : null]) || 'Customer account record',
    status: data.status,
    details: details([
      { label: 'Status', value: data.status },
      { label: 'MRR', value: money(data.mrr) },
      { label: 'Setup Total', value: money(data.setup_total) },
      { label: 'Contract Start', value: data.contract_start },
      { label: 'Contract End', value: data.contract_end },
      { label: 'Notes', value: data.notes },
    ]),
    actions: [
      { label: 'Open Customer', href: `/customers/${data.id}` },
      data.property_id ? { label: 'Open Property', href: `/properties/${data.property_id}` } : { label: 'Open Customers', href: '/customers' },
    ],
  }
}

async function fetchProperty(id: string, orgId: string | null, isCorporate: boolean): Promise<DetailResponse | null> {
  let query = supabase
    .from('properties')
    .select('id,name,address,city,state,zip,property_type,unit_count,status')
    .eq('id', id)
    .maybeSingle()
  query = applyOrgFilter(query, 'org_id', orgId, isCorporate)
  const { data } = await query
  if (!data) return null

  const openJobs = await countRows('work_orders', 'property_id', data.id)
  const devices = await countRows('devices', 'property_id', data.id)

  return {
    id: data.id,
    type: 'property',
    title: data.name || 'Unnamed Property',
    subtitle: compact([data.property_type, data.unit_count ? `${data.unit_count} units` : null, address(data)]) || 'Property record',
    status: data.status,
    details: details([
      { label: 'Type', value: data.property_type },
      { label: 'Units', value: data.unit_count },
      { label: 'Address', value: address(data) },
      { label: 'Status', value: data.status },
      { label: 'Related Jobs', value: openJobs ? `${openJobs}` : '' },
      { label: 'Devices', value: devices ? `${devices}` : '' },
    ]),
    actions: [
      { label: 'Open Property', href: `/properties/${data.id}` },
      { label: 'Open Jobs', href: '/maintenance' },
      { label: 'Open Systems', href: '/access' },
    ],
  }
}

async function fetchSite(id: string, orgId: string | null, isCorporate: boolean): Promise<DetailResponse | null> {
  let query = supabase
    .from('sites')
    .select('id,name,address,city,state,zip,property_type,units,status,primary_contact_name,primary_contact_email,primary_contact_phone,pm_name,pm_email,pm_phone,notes')
    .eq('id', id)
    .maybeSingle()
  query = applyOrgFilter(query, 'org_id', orgId, isCorporate)
  const { data } = await query
  if (!data) return null

  const assets = await countRows('site_assets', 'site_id', data.id)
  const events = await countRows('site_events', 'site_id', data.id)

  return {
    id: data.id,
    type: 'site',
    title: data.name || 'Unnamed Site',
    subtitle: compact([data.property_type, data.units ? `${data.units} units` : null, address(data)]) || 'Site record',
    status: data.status,
    details: details([
      { label: 'Type', value: data.property_type },
      { label: 'Units', value: data.units },
      { label: 'Address', value: address(data) },
      { label: 'Status', value: data.status },
      { label: 'Primary Contact', value: compact([data.primary_contact_name, data.primary_contact_email, data.primary_contact_phone]) },
      { label: 'Property Manager', value: compact([data.pm_name, data.pm_email, data.pm_phone]) },
      { label: 'Assets', value: assets ? `${assets}` : '' },
      { label: 'Events', value: events ? `${events}` : '' },
      { label: 'Notes', value: data.notes },
    ]),
    actions: [
      { label: 'Open Site', href: `/sites/${data.id}` },
      { label: 'Open Systems', href: '/access' },
      { label: 'Open Jobs', href: '/maintenance' },
    ],
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const { searchParams } = new URL(req.url)
    const type = clean(searchParams.get('type')) as DetailType
    const id = clean(searchParams.get('id'))

    if (!id || !type) {
      return NextResponse.json({ success: false, message: 'Select a result first.' }, { status: 400 })
    }

    let detailData: DetailResponse | null = null
    if (type === 'company') detailData = await fetchCompany(id, user.org_id, user.isCorporate)
    if (type === 'contact') detailData = await fetchContact(id, user.org_id, user.isCorporate)
    if (type === 'customer') detailData = await fetchCustomer(id, user.org_id, user.isCorporate)
    if (type === 'property') detailData = await fetchProperty(id, user.org_id, user.isCorporate)
    if (type === 'site') detailData = await fetchSite(id, user.org_id, user.isCorporate)

    if (!detailData) {
      return NextResponse.json({ success: false, message: 'Could not find that record.' }, { status: 404 })
    }

    return NextResponse.json({ success: true, detail: detailData })
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Could not load overview.',
    }, { status: 500 })
  }
}
