import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveEosOrgId } from '@/lib/eos-org'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const scope = req.nextUrl.searchParams.get('scope')

    if (scope === 'global') {
      // Return the corporate org's V/TO — read-only for all non-corporate tiers
      const { data: corpOrg, error: orgErr } = await supabase
        .from('organizations')
        .select('id')
        .eq('org_tier', 'corporate')
        .maybeSingle()

      if (orgErr) {
        console.error('[/api/eos/vto GET global] org lookup error:', orgErr)
        return NextResponse.json({ error: orgErr.message }, { status: 500 })
      }

      if (!corpOrg?.id) {
        return NextResponse.json(null, { status: 404 })
      }

      const { data, error } = await supabase
        .from('eos_vto')
        .select('*')
        .eq('org_id', corpOrg.id)
        .maybeSingle()

      if (error) {
        console.error('[/api/eos/vto GET global]', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json(data ?? null, { status: data ? 200 : 404 })
    }

    // Local: current user's own org — use resolveEosOrgId to handle corporate users
    // whose Clerk metadata predates the org_id requirement
    const user = await getCurrentUser()
    const orgId = await resolveEosOrgId(user)

    const { data, error } = await supabase
      .from('eos_vto')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle()

    if (error) {
      console.error('[/api/eos/vto GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json(null, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/eos/vto GET] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const scope = req.nextUrl.searchParams.get('scope')
    if (scope === 'global') {
      return NextResponse.json({ error: 'Global V/TO is read-only for your organization' }, { status: 403 })
    }

    const user = await getCurrentUser()
    const orgId = await resolveEosOrgId(user)
    const body = await req.json()

    const { data, error } = await supabase
      .from('eos_vto')
      .upsert(
        { org_id: orgId, ...body, updated_at: new Date().toISOString() },
        { onConflict: 'org_id' }
      )
      .select()
      .single()

    if (error) {
      console.error('[/api/eos/vto PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/eos/vto PATCH] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
