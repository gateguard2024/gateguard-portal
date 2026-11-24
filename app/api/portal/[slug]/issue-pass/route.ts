import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPortal } from '@/lib/portal-auth'
import { getSiteBrivoToken, createBrivoUser, resendBrivoMobilePass, listBrivoSiteGroupIds } from '@/lib/brivo'
import { getPortalManager } from '@/lib/portal-manager'

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

  // Issuing a pass needs a signed-in manager (the shared code is look-only).
  const manager = await getPortalManager(req, params.slug)
  if (!manager) return NextResponse.json({ error: 'Sign in with your personal PIN to issue passes.', need_manager: true }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const firstName = String(body.firstName ?? '').trim()
  const lastName = String(body.lastName ?? '').trim()
  const email = body.email ? String(body.email).trim() : null
  if (!firstName || !lastName) return NextResponse.json({ error: 'Guest first and last name are required.' }, { status: 400 })
  if (!email) return NextResponse.json({ error: 'A guest email is required to send the pass.' }, { status: 400 })

  try {
    const { token, apiKey, brivoSiteId } = await getSiteBrivoToken(siteId)
    // A group, if given, must be one of THIS property's Brivo groups.
    let groupId: string | null = body.group_id ? String(body.group_id) : null
    if (groupId && !(await listBrivoSiteGroupIds(token, apiKey, brivoSiteId)).map(String).includes(groupId)) {
      return NextResponse.json({ error: 'That access group isn’t at this property.' }, { status: 403 })
    }
    const created = await createBrivoUser(token, apiKey, { firstName, lastName, email, groupId })
    await resendBrivoMobilePass(token, apiKey, created.id, email, { from: body.from ?? null, to: body.to ?? null })

    const { error: aErr } = await supabase.from('site_events').insert({
      site_id: siteId, event_type: 'guest_pass', event_source: 'brivo',
      title: `Visitor pass issued: ${firstName} ${lastName}`,
      description: `Issued from the property portal (${params.slug}) by ${manager.name}${body.to ? ` (valid to ${body.to})` : ''}`,
      summary: `Guest pass · ${manager.name}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: { brivo_user_id: created.id, from: body.from ?? null, to: body.to ?? null, actor: manager.name, actor_id: manager.id, via: 'customer_portal', portal_slug: params.slug } as any,
    })
    if (aErr) console.error('[portal issue-pass] audit failed:', aErr.message)

    return NextResponse.json({ ok: true, guest_id: created.id })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Issue guest pass failed' }, { status: 502 })
  }
}
