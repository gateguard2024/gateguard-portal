/**
 * Outside vendors on a job — staff side (migration 239, rules in lib/vendor-jobs.ts).
 *
 * GET  /api/maintenance/[id]/vendor → { rows, vendors, scheduled_date, ready }
 * POST /api/maintenance/[id]/vendor { action, … }
 *   send { vendor_id, via?: ['text','email'], message? }  → { url (shown once), sent, errors }
 *   resend { link_id, via? } · remove { link_id, tell? }
 *   approve_date { link_id } · keep_date { link_id }
 *   approve_invoice { link_id } · reject_invoice { link_id, reason }
 *   add_vendor { name, company?, phone?, email?, trade?, insurance_expiry?, w9_on_file?, rate_note? }
 *   update_vendor { vendor_id, …same fields }
 * Signed-in staff only, and only on a job they can reach (guardWorkOrder). The field app's
 * tech code can't use this route.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { guardWorkOrder } from '@/lib/ops-scope'
import { isTechAuthed } from '@/lib/tech-auth'
import { inngest } from '@/inngest/client'
import { isGateGuardVendor } from '@/lib/qbo-sync'
import {
  answerDateRequest, approveInvoice, rejectInvoice, removeVendor, sendJobToVendor, staffRow, vdb, vendorsFor, vendorWarnings, type Row,
} from '@/lib/vendor-jobs'

export const dynamic = 'force-dynamic'

const NEEDS_239 = /work_order_subcontractors\.|token_hash|invoice_status|status_at|w9_on_file|column .* does not exist|schema cache/i
const fail = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status })

async function staffGate(req: NextRequest, woId: string) {
  const user = await getCurrentUser()
  if (!user.id || user.id === 'anonymous' || user.id === 'system') return { error: fail('Sign in to manage vendors.', 401) }
  if (req.headers.get('x-tech-code') && (await isTechAuthed(req))) return { error: fail('Not available in the field app.', 403) }
  if (!(await guardWorkOrder(req, woId))) return { error: fail('Not found', 404) }
  const { data: wo, error } = await vdb().from('work_orders').select('*').eq('id', woId).maybeSingle()
  if (error || !wo) return { error: fail('Not found', 404) }
  return { user, wo: wo as Row }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await staffGate(req, params.id); if ('error' in g) return g.error
  const db = vdb()
  const { data: links, error } = await db.from('work_order_subcontractors').select('*').eq('work_order_id', params.id).order('assigned_at', { ascending: true })
  if (error) return fail(error.message, 500)
  const ids = [...new Set((links ?? []).map((l: Row) => l.subcontractor_id))]
  const { data: vs } = ids.length ? await db.from('subcontractors').select('*').in('id', ids) : { data: [] as Row[] }
  const byId = new Map(((vs ?? []) as Row[]).map((v) => [v.id, v]))
  const ready = !(links ?? []).length || 'token_hash' in ((links ?? [])[0] as Row)
  let vendors: Row[] = []
  try { vendors = await vendorsFor(g.user, g.wo.org_id ?? null) } catch (e) { return fail(e instanceof Error ? e.message : 'Couldn’t load vendors', 500) }
  return NextResponse.json({
    ready, scheduled_date: g.wo.scheduled_date ?? null,
    rows: ((links ?? []) as Row[]).filter((l) => l.status !== 'cancelled').map((l) => staffRow(l, byId.get(l.subcontractor_id) ?? null, g.wo.scheduled_date ?? null)),
    vendors: vendors.map((v) => ({ ...v, warnings: vendorWarnings(v) })),
  })
}

const VENDOR_FIELDS = ['name', 'company', 'phone', 'email', 'trade', 'insurance_expiry', 'license_expiry', 'w9_on_file', 'rate_note', 'notes'] as const
function vendorPatch(body: Row): Row | string {
  const p: Row = {}
  for (const k of VENDOR_FIELDS) if (k in body) {
    const v = body[k]
    if (k === 'w9_on_file') p[k] = !!v
    else if (k.endsWith('_expiry')) { if (v && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return 'Dates must be YYYY-MM-DD.'; p[k] = v || null }
    else p[k] = typeof v === 'string' && v.trim() ? v.trim().slice(0, 300) : null
  }
  if ('email' in p && p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) return 'That email doesn’t look right.'
  return p
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await staffGate(req, params.id); if ('error' in g) return g.error
  const { user, wo } = g
  const body = (await req.json().catch(() => ({}))) as Row
  const action = String(body.action ?? '')
  const db = vdb()
  const staff = { id: user.id, name: user.name ?? null, email: user.email ?? null }
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || req.nextUrl.origin
  const via = (Array.isArray(body.via) ? body.via : ['text', 'email']).filter((x: unknown) => x === 'text' || x === 'email') as ('text' | 'email')[]

  try {
    if (action === 'add_vendor' || action === 'update_vendor') {
      const p = vendorPatch(body); if (typeof p === 'string') return fail(p)
      if (action === 'add_vendor') {
        if (!p.name) return fail('Add the vendor’s name.')
        if (!p.phone && !p.email) return fail('Add a phone or an email, so we can send them jobs.')
        const { data, error } = await db.from('subcontractors').insert({ ...p, org_id: user.org_id ?? null, status: 'active' }).select('*').single()
        if (error) return fail(NEEDS_239.test(error.message) ? 'Run migration 239 first.' : error.message, 500)
        return NextResponse.json({ vendor: { ...data, warnings: vendorWarnings(data as Row) } }, { status: 201 })
      }
      const mine = (await vendorsFor(user, wo.org_id ?? null)).some((v) => v.id === body.vendor_id)
      if (!mine) return fail('Vendor not found', 404)
      const { data, error } = await db.from('subcontractors').update({ ...p, updated_at: new Date().toISOString() }).eq('id', body.vendor_id).select('*').single()
      if (error) return fail(error.message, 500)
      return NextResponse.json({ vendor: { ...data, warnings: vendorWarnings(data as Row) } })
    }

    if (action === 'send') {
      const vendor = (await vendorsFor(user, wo.org_id ?? null)).find((v) => v.id === body.vendor_id)
      if (!vendor) return fail('Pick one of your vendors.', 404)
      if (!via.length && !body.copy_only) return fail('Pick text and/or email.')
      if (['completed', 'cancelled', 'closed'].includes(String(wo.status ?? '').toLowerCase())) return fail('This job is closed.')
      const { data: site } = wo.site_id ? await db.from('sites').select('id, name, city').eq('id', wo.site_id).maybeSingle() : { data: null }
      const r = await sendJobToVendor({ wo, site: site as Row | null, vendor, staff, origin, via: body.copy_only ? [] : via, message: body.message })
      return NextResponse.json({ url: r.url, sent: r.sent, errors: r.errors, warnings: vendorWarnings(vendor) })
    }

    // Everything else acts on one of this job's vendor rows.
    const { data: link, error: lErr } = await db.from('work_order_subcontractors').select('*').eq('id', String(body.link_id ?? '')).eq('work_order_id', wo.id).maybeSingle()
    if (lErr) return fail(NEEDS_239.test(lErr.message) ? 'Run migration 239 first.' : lErr.message, 500)
    if (!link) return fail('Not found', 404)

    if (action === 'resend') {
      const { data: vendor } = await db.from('subcontractors').select('*').eq('id', link.subcontractor_id).maybeSingle()
      if (!vendor) return fail('Vendor not found', 404)
      const { data: site } = wo.site_id ? await db.from('sites').select('id, name, city').eq('id', wo.site_id).maybeSingle() : { data: null }
      const r = await sendJobToVendor({ wo, site: site as Row | null, vendor: vendor as Row, staff, origin, via: body.copy_only ? [] : via, message: body.message })
      return NextResponse.json({ url: r.url, sent: r.sent, errors: r.errors })
    }
    if (action === 'remove') return NextResponse.json({ ok: true, errors: await removeVendor(link, staff, body.tell !== false) })
    if (action === 'approve_date' || action === 'keep_date') {
      const r = await answerDateRequest(link, action === 'approve_date', staff)
      return NextResponse.json({ ok: true, scheduled_date: r.date, errors: r.errors })
    }
    if (action === 'approve_invoice') {
      const row = await approveInvoice(link, wo, staff)
      const { data: v } = await db.from('subcontractors').select('org_id').eq('id', link.subcontractor_id).maybeSingle()
      const toQb = await isGateGuardVendor((v as Row | null)?.org_id ?? null)
      let note = toQb ? 'Added to job costs. It goes to QuickBooks as a bill with the next sync (or press Sync now on the QuickBooks page).' : 'Added to job costs. Pay this vendor the way you normally do.'
      if (toQb) { try { await inngest.send({ name: 'qbo/sync.now', data: { vendor_link_id: link.id } }) } catch { note = 'Added to job costs. It goes to QuickBooks with the next sync.' } }
      return NextResponse.json({ ok: true, row: staffRow(row, null, wo.scheduled_date ?? null), note })
    }
    if (action === 'reject_invoice') return NextResponse.json({ ok: true, errors: await rejectInvoice(link, String(body.reason ?? ''), staff) })
    return fail('Unknown action')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Something went wrong'
    return fail(NEEDS_239.test(msg) ? 'Run migration 239 first.' : msg, NEEDS_239.test(msg) ? 409 : 400)
  }
}
