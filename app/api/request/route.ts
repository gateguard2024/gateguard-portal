import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use anon key for public endpoint — RLS allows anon INSERT on wo_requests
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Also need service role for looking up site details
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/request — public: property manager submits a maintenance request
export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    site_id, title, description, area,
    priority_requested = 'normal',
    contact_name, contact_email, contact_phone,
  } = body

  if (!site_id || !title?.trim()) {
    return NextResponse.json({ error: 'site_id and title are required' }, { status: 400 })
  }

  // Verify site exists
  const { data: site } = await supabaseAdmin
    .from('sites')
    .select('id, name')
    .eq('id', site_id)
    .single()

  if (!site) {
    return NextResponse.json({ error: 'Property not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('wo_requests')
    .insert({
      site_id,
      title:              title.trim(),
      description:        description?.trim() ?? null,
      area:               area?.trim()        ?? null,
      priority_requested,
      contact_name:       contact_name?.trim()  ?? null,
      contact_email:      contact_email?.trim() ?? null,
      contact_phone:      contact_phone?.trim() ?? null,
      status:             'new',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify the dealer (via site's primary contact or pm_email — we send to them, not the submitter)
  // This is a fire-and-forget background notification to the dealer
  supabaseAdmin
    .from('sites')
    .select('primary_contact_email, pm_email')
    .eq('id', site_id)
    .single()
    .then(async ({ data: siteDetail }) => {
      // In future: send dealer an email that a new request came in
      // For now just log
      console.log(`[request] New request "${title}" for site ${site.name} from ${contact_email ?? 'unknown'}`)
    })
    .catch(console.error)

  return NextResponse.json({ success: true, request: data }, { status: 201 })
}

// PATCH /api/request — update request status (convert to WO, close, etc.)
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { request_id, status, converted_wo_id } = body

  if (!request_id) return NextResponse.json({ error: 'request_id required' }, { status: 400 })

  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (converted_wo_id) update.converted_wo_id = converted_wo_id

  const { data, error } = await supabaseAdmin
    .from('wo_requests')
    .update(update)
    .eq('id', request_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ request: data })
}

// GET /api/request?site_id=xxx — admin only, list requests for a site
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const site_id = searchParams.get('site_id')

  if (!site_id) return NextResponse.json({ error: 'site_id required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('wo_requests')
    .select('*')
    .eq('site_id', site_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ requests: data ?? [] })
}
