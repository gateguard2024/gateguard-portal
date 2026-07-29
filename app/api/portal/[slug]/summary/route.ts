import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPortal } from '@/lib/portal-auth'
import { getSiteEagleEyeAccess, listEagleEyeCameras } from '@/lib/eagle-eye'
import { getSiteBrivoToken, listBrivoDoors, listBrivoEvents } from '@/lib/brivo'
import { getQboAuth, qboApi } from '@/lib/qbo'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Lazily fetch a QBO invoice's "View and Pay" link (then cached on the invoice row).
async function fetchQboPayLink(qbInvoiceId: string): Promise<string | null> {
  try {
    const auth = await getQboAuth()
    if (!auth.ok) return null
    const res = await qboApi(auth, `/invoice/${qbInvoiceId}?include=invoiceLink&minorversion=73`)
    if (!res.ok) return null
    const body = await res.json()
    return body?.Invoice?.InvoiceLink ?? null
  } catch { return null }
}

// GET /api/portal/[slug]/summary — read-only site data for the customer portal.
// PIN-gated. Uses the SITE's stored vendor creds server-side (same feeds as the
// internal Systems page). Every feed is independent + failure-tolerant.
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })

  const siteId = v.portal.site_id
  if (!siteId) return NextResponse.json({ cameras: [], doors: [], activity: [], balanceDue: null })

  const camWhitelist = v.portal.camera_ids && v.portal.camera_ids.length ? new Set(v.portal.camera_ids) : null

  // ── Cameras (Eagle Eye) ──────────────────────────────────────────────────
  const cameras = await (async () => {
    try {
      const { token, baseHost } = await getSiteEagleEyeAccess(siteId)
      const all = await listEagleEyeCameras(token, baseHost)
      const scoped = camWhitelist ? all.filter(c => camWhitelist.has(c.id)) : all
      return scoped.map(c => ({ id: c.id, name: c.name, online: c.online !== false }))
    } catch { return [] }
  })()

  // ── Doors + recent access events (Brivo) ─────────────────────────────────
  let doors: { id: string; name: string }[] = []
  let activity: { id: string; label: string; where: string; time: string }[] = []
  try {
    const { token, apiKey, brivoSiteId } = await getSiteBrivoToken(siteId)
    try {
      doors = (await listBrivoDoors(token, apiKey, brivoSiteId)).map(d => ({ id: d.id, name: d.name }))
    } catch { /* doors optional */ }
    try {
      const events = await listBrivoEvents(token, apiKey, 12)
      activity = events.map(e => ({
        id: e.id,
        label: e.actor ? `${e.action} — ${e.actor}` : e.action,
        where: e.door || 'Site',
        time: e.occurred ? new Date(e.occurred).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '',
      }))
    } catch { /* events optional */ }
  } catch { /* Brivo not connected */ }

  // ── Open balance + QBO "View and Pay" links ──────────────────────────────
  let balanceDue: number | null = null
  const payables: { id: string; number: string; balance: number; link: string | null }[] = []
  try {
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, balance_due, status, qb_invoice_id, qbo_invoice_link')
      .eq('site_id', siteId)
    const open = (data ?? []).filter(i => i.status !== 'void' && Number(i.balance_due) > 0)
    balanceDue = open.reduce((s, i) => s + Number(i.balance_due || 0), 0)
    for (const inv of open) {
      let link = (inv.qbo_invoice_link as string | null) ?? null
      if (!link && inv.qb_invoice_id) {
        link = await fetchQboPayLink(String(inv.qb_invoice_id))
        if (link) await supabase.from('invoices').update({ qbo_invoice_link: link }).eq('id', inv.id)
      }
      payables.push({ id: inv.id, number: inv.invoice_number, balance: Number(inv.balance_due || 0), link })
    }
  } catch { /* billing optional */ }

  return NextResponse.json({ cameras, doors, activity, balanceDue, payables })
}
