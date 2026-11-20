/**
 * /a/<code> — what a unit's QR label opens (migration 237). Public (middleware bypass):
 * anyone at the property can report a problem with THIS unit; the request is filed
 * with the unit attached (/api/request with `unit`). Staff get a link to the unit page.
 * Shows only the property name and the unit's label — nothing else about the site.
 */
import { createClient } from '@supabase/supabase-js'
import { cleanCode, unitLabel } from '@/lib/assets'
import { QrRequestForm } from './QrRequestForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Report a problem · Gate Guard', robots: { index: false, follow: false } }

export default async function UnitLabelPage({ params }: { params: { code: string } }) {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const code = cleanCode(params.code ?? '')
  const { data: u } = code ? await db.from('site_assets').select('id, site_id, product_name, location_note, opening_id, status').eq('qr_code', code).maybeSingle() : { data: null }
  const unit = u as { id: string; site_id: string; product_name: string; location_note: string | null; opening_id: string | null; status: string | null } | null
  let site: { id: string; name: string } | null = null
  let label = ''
  if (unit) {
    const [{ data: s }, { data: op }] = await Promise.all([
      db.from('sites').select('id, name').eq('id', unit.site_id).maybeSingle(),
      unit.opening_id ? db.from('site_openings').select('name').eq('id', unit.opening_id).maybeSingle() : Promise.resolve({ data: null }),
    ])
    site = s as { id: string; name: string } | null
    label = unitLabel(unit, (op as { name?: string } | null)?.name)
  }
  return (
    <main style={{ minHeight: '100dvh', background: '#F5F5F7', color: '#1D1D1F', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif', padding: '28px 16px 60px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6E73', letterSpacing: '.02em', marginBottom: 14 }}>GATE GUARD</div>
        {!unit || !site ? (
          <section style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 2px rgba(10,20,40,.06), 0 8px 24px rgba(10,20,40,.08)' }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px' }}>We don’t recognize this label</h1>
            <p style={{ margin: 0, fontSize: 15, color: '#6E6E73', lineHeight: 1.5 }}>The code may be damaged or the unit was removed. Please contact your property office to report a problem.</p>
          </section>
        ) : (
          <QrRequestForm siteId={site.id} siteName={site.name} unitCode={code} unitLabel={label} assetId={unit.id} gone={unit.status === 'removed' || unit.status === 'replaced'} />
        )}
      </div>
    </main>
  )
}
