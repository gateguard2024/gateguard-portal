import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

function isTechAuthed(req: NextRequest): boolean {
  const code = req.headers.get('x-tech-code')
  return !!code && !!process.env.TECH_ACCESS_CODE && code === process.env.TECH_ACCESS_CODE
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET /api/surveys
export async function GET(req: NextRequest) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)
  const { searchParams } = new URL(req.url)
  const status   = searchParams.get('status')
  const site_id  = searchParams.get('site_id')
  const opportunity_id = searchParams.get('opportunity_id')
  const q        = searchParams.get('q')
  const limit    = parseInt(searchParams.get('limit') ?? '50')

  let query = supabase
    .from('surveys')
    .select('id, survey_number, property_name, property_address, surveyor_name, surveyor_type, survey_date, status, devices, ai_summary, ai_sow, ai_bom, quote_id, site_id, opportunity_id, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  query = applyOrgScope(query, scope, 'org_id')
  if (status)  query = query.eq('status', status)
  if (site_id) query = query.eq('site_id', site_id)
  if (opportunity_id) query = query.eq('opportunity_id', opportunity_id)
  if (q)       query = query.ilike('property_name', `%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ surveys: data ?? [] })
}

// POST /api/surveys
// Accepts Clerk auth (portal users) OR x-tech-code header (field techs)
export async function POST(req: NextRequest) {
  const techAuth = isTechAuthed(req)
  const body = await req.json()

  // Tech code path — no Clerk, org_id comes from body or is null
  if (techAuth) {
    const {
      property_name = '',
      property_address,
      site_id,
      opportunity_id,
      surveyor_name,
      surveyor_type = 'sales',
      survey_date,
      voice_transcript,
      notes_raw,
      devices  = [],
      photos   = [],
      org_id   = null,
    } = body

    const { data, error } = await supabase
      .from('surveys')
      .insert({
        org_id:           org_id   ?? null,
        property_name,
        property_address: property_address ?? null,
        site_id:          site_id          ?? null,
        opportunity_id:   opportunity_id   ?? null,
        surveyor_name:    surveyor_name    ?? null,
        surveyor_type,
        survey_date:      survey_date      ?? new Date().toISOString().slice(0, 10),
        voice_transcript: voice_transcript ?? null,
        notes_raw:        notes_raw        ?? null,
        devices,
        photos,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ survey: data }, { status: 201 })
  }

  // Clerk auth path
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  const {
    property_name = '',
    property_address,
    site_id,
    opportunity_id,
    surveyor_name,
    surveyor_type = 'sales',
    survey_date,
    voice_transcript,
    notes_raw,
    devices = [],
    photos  = [],
  } = body

  const org_id = user.isCorporate ? (body.org_id ?? null) : (scope.own_id ?? null)

  const { data, error } = await supabase
    .from('surveys')
    .insert({
      org_id,
      property_name,
      property_address: property_address ?? null,
      site_id:          site_id          ?? null,
      opportunity_id:   opportunity_id   ?? null,
      surveyor_name:    surveyor_name    ?? user.name ?? null,
      surveyor_type,
      survey_date:      survey_date      ?? new Date().toISOString().slice(0, 10),
      voice_transcript: voice_transcript ?? null,
      notes_raw:        notes_raw        ?? null,
      devices,
      photos,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ survey: data }, { status: 201 })
}
