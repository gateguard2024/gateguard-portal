import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPortal } from '@/lib/portal-auth'
import { getSiteBrivoToken, unlockBrivoDoor } from '@/lib/brivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// POST /api/portal/[slug]/unlock  { door_id, door_name? }
// Site-manager action from the customer portal. PIN-gated (verifyPortal). Uses the
// site's stored Brivo creds server-side and the admin /activate unlock — same path
// the internal Systems page uses. Records a site_event audit tagged to the portal.
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })

  const siteId = v.portal.site_id
  if (!siteId) return NextResponse.json({ error: 'This portal is not linked to a site.' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const doorId = String(body.door_id ?? '')
  const doorName = String(body.door_name ?? 'Door')
  if (!doorId) return NextResponse.json({ error: 'door_id is required' }, { status: 400 })

  try {
    const { token, apiKey, credentialValue } = await getSiteBrivoToken(siteId)
    await unlockBrivoDoor(token, apiKey, doorId, credentialValue)

    // Audit — also surfaces in the site activity timeline. Actor is the portal
    // (site manager) rather than a Clerk user.
    try {
      await supabase.from('site_events').insert({
        site_id: siteId,
        event_type: 'door_unlock',
        event_source: 'brivo',
        title: `Door unlocked: ${doorName}`,
        description: `Unlocked from the customer portal (${params.slug}) by the site manager`,
        summary: `${doorName} unlocked via customer portal`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: { door_id: doorId, door_name: doorName, via: 'customer_portal', portal_slug: params.slug } as any,
      })
    } catch { /* audit best-effort — the unlock already happened */ }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Door unlock failed' }, { status: 502 })
  }
}
