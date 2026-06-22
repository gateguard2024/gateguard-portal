import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Canonical model only: organizations (accounts) + contacts (people) + sites (properties).
// Legacy 'company'/'customer' types resolve to the organization; 'property' to the site.
type DetailType = 'customer' | 'company' | 'contact' | 'property' | 'site'

type DetailResponse = {
  id: string
  type: 'customer' | 'contact' | 'site'
  title: string
  subtitle: string
  status?: string | null
  details: Array<{ label: string; value: string }>
  actions: Array<{ label: string; href: string }>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

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

function address(row: Row): string {
  return compact([row.address, row.city, row.state, row.zip])
}

function fullName(row: Row): string {
  return compact([row.first_name, row.last_name]).replace(' • ', ' ') || 'Unnamed Contact'
}

function detail(label: string, value: unknown): { label: string; value: string } | null {
  const text = valueText(value)
  return text ? { label, value: text } : null
}

function details(items: Array<{ label: string; value: unknown }>): Array<{ label: string; value: string }> {
  return items.map(item => detail(item.label, item.value)).filter(Boolean) as Array<{ label: string; value: string }>
}

async function countRows(table: string, column: string, value: string) {
  const { count } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, value)
  return count ?? 0
}

async function fetchOrganization(id: string, orgId: string | null, isCorporate: boolean): Promise<DetailResponse | null> {
  const query = supabase
    .from('organizations')
    .select('id,name,tier,status,address,city,state,zip,primary_email,primary_phone,notes')
    .eq('id', id)
    .maybeSingle()
  const { data } = isCorporate || !orgId ? await query : await supabase
    .from('organizations').select('id,name,tier,status,address,city,state,zip,primary_email,primary_phone,notes')
    .eq('id', id).eq('id', orgId).maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    type: 'customer',
    title: data.name || 'Unnamed Account',
    subtitle: compact([data.tier, address(data)]) || 'Account record',
    status: data.status,
    details: details([
      { label: 'Tier', value: data.tier },
      { label: 'Status', value: data.status },
      { label: 'Email', value: data.primary_email },
      { label: 'Phone', value: data.primary_phone },
      { label: 'Address', value: address(data) },
      { label: 'Notes', value: data.notes },
    ]),
    actions: [
      { label: 'Open Operations', href: `/operations?org=${data.id}` },
      { label: 'Open CRM', href: '/crm' },
    ],
  }
}

async function fetchContact(id: string, orgId: string | null, isCorporate: boolean): Promise<DetailResponse | null> {
  const base = supabase
    .from('contacts')
    .select('id,first_name,last_name,email,phone,title,notes')
    .eq('id', id)
  const { data } = isCorporate || !orgId ? await base.maybeSingle() : await base.eq('org_id', orgId).maybeSingle()
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
    actions: [{ label: 'Open CRM', href: `/crm?contact=${data.id}` }],
  }
}

async function fetchSite(id: string, orgId: string | null, isCorporate: boolean): Promise<DetailResponse | null> {
  const base = supabase
    .from('sites')
    .select('id,name,address,city,state,zip,property_type,units,status,primary_contact_name,primary_contact_email,primary_contact_phone,pm_name,pm_email,pm_phone,notes')
    .eq('id', id)
  const { data } = isCorporate || !orgId ? await base.maybeSingle() : await base.eq('org_id', orgId).maybeSingle()
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
    // 'customer'/'company' → organization · 'property' → site · 'contact' → contact
    if (type === 'customer' || type === 'company') detailData = await fetchOrganization(id, user.org_id, user.isCorporate)
    else if (type === 'contact') detailData = await fetchContact(id, user.org_id, user.isCorporate)
    else if (type === 'site' || type === 'property') detailData = await fetchSite(id, user.org_id, user.isCorporate)

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
