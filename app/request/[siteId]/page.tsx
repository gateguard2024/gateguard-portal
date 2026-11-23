/**
 * /request/<siteId> — public service request form for a property (no login).
 * The property is read here on the server (service role, name + city only) and handed to
 * the form; the form posts to /api/request (public POST). Inactive / removed properties
 * show "not found".
 */
import { createClient } from '@supabase/supabase-js'
import RequestForm, { type SiteInfo } from './RequestForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Request service · Gate Guard', robots: { index: false, follow: false } }

export default async function RequestPage({ params }: { params: { siteId: string } }) {
  const id = String(params.siteId ?? '')
  let site: SiteInfo | null = null
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data } = await db.from('sites').select('id, name, address, city, state, status').eq('id', id).maybeSingle()
    const row = data as (SiteInfo & { status?: string | null }) | null
    if (row && !['inactive', 'decommissioned'].includes(String(row.status ?? ''))) site = { id: row.id, name: row.name, address: row.address, city: row.city, state: row.state }
  }
  return <RequestForm siteId={id} initialSite={site} />
}
