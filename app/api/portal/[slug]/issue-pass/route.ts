import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPortal } from '@/lib/portal-auth'
import { getSiteBrivoToken, createBrivoUser, resendBrivoMobilePass } from '@/lib/brivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// POST /api/portal/[slug]/issue-pass  { firstName, lastName, email, from?, to?, group_id? }
// Site-manager action from the customer portal. PIN-gated (verifyPortal). Reuses the
// exact internal flow: create the guest as a Brivo user (+ optional group), then
// issue a time-boxed Mobile Pass to their email. Records a site_event audit.
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })

  const siteId = v.portal.site_id
  if (!siteId) return NextResponse.json({ error: 'This portal is not linked to a site.' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const firstName = String(body.firstName ?? '').trim()
  const lastName = String(body.lastName ?? '').trim()
  const email = body.email ? String(body.email).trim() : null
  if (!firstName || !lastName) return NextResponse.json({ error: 'Guest first and last name are required.' }, { status: 400 })
  if (!email) return NextResponse.json({ error: 'A guest email is required to send the pass.' }, { status: 400 })

  try {
    const { token, apiKey } = await getSiteBrivoToken(siteId)
    const created = await createBrivoUser(token, apiKey, { firstName, lastName, email, groupId: body.group_id ? String(body.group_id) : null })
    await resendBrivoMobilePass(token, apiKey, created.id, email, { from: body.from ?? null, to: body.to ?? null })

    try {
      await supabase.from('site_events').insert({
        site_id: siteId, event_type: 'guest_pass', event_source: 'brivo',
        title: `Visitor pass issued: ${firstName} ${lastName}`,
        description: `Issued from the customer portal (${params.slug}) by the site manager${body.to ? ` (valid to ${body.to})` : ''}`,
        summary: `Guest pass via customer portal`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: { brivo_user_id: created.id, from: body.from ?? null, to: body.to ?? null, via: 'customer_portal', portal_slug: params.slug } as any,
      })
    } catch { /* audit best-effort */ }

    return NextResponse.json({ ok: true, guest_id: created.id })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Issue guest pass failed' }, { status: 502 })
  }
}
