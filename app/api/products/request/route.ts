/**
 * POST /api/products/request
 *
 * A rep on a site survey couldn't find a product in the catalog, so they asked
 * corporate to add it. We CAPTURE the request (product_requests) and NOTIFY
 * corporate by email. The survey line is saved separately as a one-time/custom
 * item by the client — this route only handles the "tell corporate" part.
 *
 * Body: { name, brand?, model?, category?, est_cost?, notes?, opportunity_id?, survey_id? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { getProfileId } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user.canViewCRM) {
      return NextResponse.json({ success: false, message: 'Access denied.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const name = clean(body.name)
    if (!name) return NextResponse.json({ success: false, message: 'A product name is required.' }, { status: 400 })

    const profileId = await getProfileId(user.id)
    const est_cost = body.est_cost != null && body.est_cost !== '' ? Number(body.est_cost) : null

    // ── Capture ──────────────────────────────────────────────────────────────
    const { data, error } = await supabase
      .from('product_requests')
      .insert({
        requested_by:   profileId,
        requester_name: user.name ?? null,
        org_id:         user.org_id ?? null,
        opportunity_id: clean(body.opportunity_id) || null,
        survey_id:      clean(body.survey_id) || null,
        name,
        brand:          clean(body.brand) || null,
        model:          clean(body.model) || null,
        category:       clean(body.category) || null,
        est_cost:       Number.isFinite(est_cost as number) ? est_cost : null,
        notes:          clean(body.notes) || null,
      })
      .select('id, name, brand, model, status, created_at')
      .single()

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })

    // ── Notify corporate (best-effort — never block the rep) ───────────────────
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: process.env.RESEND_DOCUMENTS_FROM_EMAIL ?? 'GateGuard Nexus <documents@nexus.gateguard.co>',
          to: 'rfeldman@gateguard.co',
          replyTo: 'rfeldman@gateguard.co',
          subject: `New product request: ${name}`,
          html: `
            <h2 style="font-family:sans-serif">New product request</h2>
            <p style="font-family:sans-serif">${user.name ?? 'A rep'} asked corporate to add a product while running a site survey.</p>
            <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
              <tr><td style="padding:4px 12px 4px 0;color:#666">Product</td><td><b>${name}</b></td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666">Brand</td><td>${clean(body.brand) || '—'}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666">Model</td><td>${clean(body.model) || '—'}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666">Category</td><td>${clean(body.category) || '—'}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666">Est. cost</td><td>${est_cost != null ? `$${est_cost}` : '—'}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666">Notes</td><td>${clean(body.notes) || '—'}</td></tr>
            </table>`,
        })
      } catch { /* notify is best-effort */ }
    }

    return NextResponse.json({ success: true, message: 'Sent to corporate.', request: data })
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : 'Request failed' }, { status: 500 })
  }
}
