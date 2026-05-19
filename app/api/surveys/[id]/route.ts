import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET /api/surveys/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  const { data, error } = await supabase
    .from('surveys')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // Org scope check — deny cross-org reads for non-corporate users
  if (!user.isCorporate && scope.own_id && data.org_id !== scope.own_id && !scope.ids.includes(data.org_id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ survey: data })
}

// PATCH /api/surveys/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)
  const body  = await req.json()

  // Verify ownership first
  const { data: existing } = await supabase
    .from('surveys')
    .select('org_id')
    .eq('id', params.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!user.isCorporate && !scope.ids.includes(existing.org_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Whitelist updatable fields
  const allowed = [
    'property_name', 'property_address', 'site_id', 'opportunity_id',
    'surveyor_name', 'surveyor_type', 'survey_date',
    'voice_transcript', 'notes_raw', 'devices', 'photos', 'status', 'quote_id',
    // AI-generated fields — all editable
    'ai_summary', 'ai_sow', 'ai_bom', 'ai_recommendations',
    'ai_urgent_items', 'ai_install_notes', 'ai_timeline',
  ]

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  const { data, error } = await supabase
    .from('surveys')
    .update(patch)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ survey: data })
}

// DELETE /api/surveys/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  const { data: existing } = await supabase
    .from('surveys')
    .select('org_id, status')
    .eq('id', params.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!user.isCorporate && !scope.ids.includes(existing.org_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('surveys')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
