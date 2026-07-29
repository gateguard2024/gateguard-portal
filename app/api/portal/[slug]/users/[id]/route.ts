import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPortal } from '@/lib/portal-auth'
import {
  getSiteBrivoToken, getBrivoUser, updateBrivoUser, getBrivoUserGroups,
  getBrivoUserCredentialSummary, issueBrivoMobilePass, resendBrivoMobilePass, revokeBrivoMobilePass,
  setBrivoUserSuspended,
} from '@/lib/brivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function brivoEmailOf(u: Record<string, unknown>): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emails = (u as any).emails as any[] | undefined
  if (Array.isArray(emails) && emails.length) return emails[0].address ?? emails[0].email ?? null
  return null
}
function brivoPhoneOf(u: Record<string, unknown>): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nums = (u as any).phoneNumbers as any[] | undefined
  if (Array.isArray(nums) && nums.length) return nums[0].number ?? null
  return null
}

// GET /api/portal/[slug]/users/[id] — full user detail (name/email/phone + groups + credentials).
export async function GET(req: NextRequest, { params }: { params: { slug: string; id: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
  if (!v.portal.site_id) return NextResponse.json({ error: 'Portal not linked to a site.' }, { status: 400 })

  try {
    const { token, apiKey } = await getSiteBrivoToken(v.portal.site_id)
    const [raw, groups, credentials] = await Promise.all([
      getBrivoUser(token, apiKey, params.id),
      getBrivoUserGroups(token, apiKey, params.id).catch(() => []),
      getBrivoUserCredentialSummary(token, apiKey, params.id).catch(() => []),
    ])
    const user = {
      id: String(raw.id ?? params.id),
      firstName: raw.firstName ?? '',
      lastName: raw.lastName ?? '',
      email: brivoEmailOf(raw),
      phone: brivoPhoneOf(raw),
      active: raw.suspended !== true,
    }
    return NextResponse.json({ user, groups, credentials })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load user' }, { status: 502 })
  }
}

// PATCH /api/portal/[slug]/users/[id]  { action, ... }
//   action 'update'      { firstName, lastName, email?, phone? }
//   action 'issue_pass'  { email }        → revoke old + email a fresh mobile pass
//   action 'revoke_pass'                  → turn off all mobile passes
export async function PATCH(req: NextRequest, { params }: { params: { slug: string; id: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
  const siteId = v.portal.site_id
  if (!siteId) return NextResponse.json({ error: 'Portal not linked to a site.' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const action = String(body.action ?? '')

  try {
    const { token, apiKey } = await getSiteBrivoToken(siteId)

    if (action === 'update') {
      await updateBrivoUser(token, apiKey, params.id, {
        firstName: body.firstName ?? undefined,
        lastName: body.lastName ?? undefined,
        email: body.email !== undefined ? (body.email || null) : undefined,
        phone: body.phone !== undefined ? (body.phone || null) : undefined,
      })
    } else if (action === 'issue_pass') {
      const email = body.email ? String(body.email).trim() : null
      if (!email) return NextResponse.json({ error: 'An email is required to send the pass.' }, { status: 400 })
      // resend = revoke any existing pass then issue+email a fresh one
      await resendBrivoMobilePass(token, apiKey, params.id, email)
      audit(siteId, params.slug, `Mobile pass issued to user ${params.id}`)
    } else if (action === 'issue_pass_new') {
      const email = body.email ? String(body.email).trim() : null
      await issueBrivoMobilePass(token, apiKey, params.id, email)
    } else if (action === 'revoke_pass') {
      await revokeBrivoMobilePass(token, apiKey, params.id)
      audit(siteId, params.slug, `Mobile pass revoked for user ${params.id}`)
    } else if (action === 'suspend' || action === 'reactivate') {
      const suspend = action === 'suspend'
      await setBrivoUserSuspended(token, apiKey, params.id, suspend)
      audit(siteId, params.slug, `User ${params.id} ${suspend ? 'suspended' : 'reactivated'}`)
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Update failed' }, { status: 502 })
  }
}

function audit(siteId: string, slug: string, title: string) {
  supabase.from('site_events').insert({
    site_id: siteId, event_type: 'access_admin', event_source: 'brivo',
    title, description: `From the customer portal (${slug}) by the site manager`, summary: title,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: { via: 'customer_portal', portal_slug: slug } as any,
  }).then(() => {}, () => {})
}
