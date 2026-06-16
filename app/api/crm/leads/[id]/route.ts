import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { leadInScope } from '@/lib/crm-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function formatAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const rawId = params.id
  if (!(await leadInScope(rawId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Tolerant strip of any legacy show_ prefix — leads use plain UUIDs now
  const uuid = rawId.replace(/^show_/, '')
  const { data, error } = await supabase
    .from('leads')
    .select('*, source, city, state, property_type, contact_title, unit_count, notes')
    .eq('id', uuid)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Check conversion via opportunities table
  const { data: existingOpp } = await supabase
    .from('opportunities')
    .select('id')
    .eq('lead_id', uuid)
    .maybeSingle()
  const isConverted = !!existingOpp

  const location = data.city && data.state
    ? `${data.city}, ${data.state}`
    : (data.city ?? 'Atlanta') + ', ' + (data.state ?? 'GA')

  return NextResponse.json({
    id: data.id,
    type: 'lead',
    name: data.property_name || data.contact_name,
    contact: data.contact_name,
    title: data.contact_title ?? 'Property Manager',
    email: data.email,
    phone: data.phone || '',
    company: '',
    propertyType: data.property_type ?? 'Multifamily',
    units: data.unit_count ?? null,
    location,
    address: location,
    stage: isConverted ? 'converted' : (data.stage ?? 'new'),
    source: data.source ?? 'show',
    rep: data.assigned_dealer || 'Russel Feldman',
    repInitials: (data.assigned_dealer || 'Russel Feldman').split(' ').map((n: string) => n[0]).join('').toUpperCase(),
    lockDaysLeft: null,
    lockExpires: null,
    estSetup: null,
    estMrr: null,
    notes: data.notes ?? '',
    createdAt: formatDate(data.created_at),
    lastActivity: formatAge(data.created_at),
  })
}

// PATCH /api/crm/leads/[id] — update stage, notes, estSetup, estMrr, etc.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const rawId = params.id
  if (!(await leadInScope(rawId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body  = await req.json()

  // Tolerant strip of any legacy show_ prefix — leads use plain UUIDs now.
  // If the client sends the field-mapped shape (name/contact/units/etc.), translate
  // it to leads columns; otherwise pass the body through directly.
  const uuid = rawId.replace(/^show_/, '')
  const usesMappedShape =
    body.name !== undefined || body.contact !== undefined || body.title !== undefined ||
    body.units !== undefined || body.assignedDealer !== undefined ||
    body.propertyType !== undefined || body.location !== undefined

  if (usesMappedShape) {
    const updateData: Record<string, unknown> = {}
    if (body.stage          !== undefined) updateData.stage          = body.stage
    if (body.notes          !== undefined) updateData.notes          = body.notes
    if (body.assignedDealer !== undefined) updateData.assigned_dealer = body.assignedDealer
    if (body.name           !== undefined) updateData.property_name  = body.name
    if (body.contact        !== undefined) updateData.contact_name   = body.contact
    if (body.title          !== undefined) updateData.contact_title  = body.title
    if (body.email          !== undefined) updateData.email          = body.email
    if (body.phone          !== undefined) updateData.phone          = body.phone
    if (body.units          !== undefined) updateData.unit_count     = body.units
    if (body.propertyType   !== undefined) updateData.property_type  = body.propertyType
    if (body.source         !== undefined) updateData.source         = body.source
    if (body.location       !== undefined) {
      const parts = String(body.location).split(',')
      updateData.city  = parts[0]?.trim() ?? ''
      updateData.state = parts[1]?.trim() ?? ''
    }

    const { data, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', uuid)
      .select()
      .single()

    if (error || !data) return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, id: data.id, ...updateData })
  }

  // Raw CRM lead update — body keys already match leads columns
  const { data, error } = await supabase
    .from('leads')
    .update(body)
    .eq('id', uuid)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ lead: data })
}

// DELETE /api/crm/leads/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const rawId = params.id
  if (!(await leadInScope(rawId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Tolerant strip of any legacy show_ prefix — leads use plain UUIDs now
  const uuid = rawId.replace(/^show_/, '')
  const { error } = await supabase.from('leads').delete().eq('id', uuid)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
