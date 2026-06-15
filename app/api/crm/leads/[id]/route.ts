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

  // show_ prefix = from show_leads table
  if (rawId.startsWith('show_')) {
    const uuid = rawId.replace('show_', '')
    const { data, error } = await supabase
      .from('show_leads')
      .select('*, source, city, state, property_type, contact_title, units, notes')
      .eq('id', uuid)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // show_leads has no status column — check conversion via opportunities table
    const { data: existingOpp } = await supabase
      .from('opportunities')
      .select('id')
      .eq('show_lead_id', uuid)
      .maybeSingle()
    const isConverted = !!existingOpp

    const location = data.city && data.state
      ? `${data.city}, ${data.state}`
      : (data.city ?? 'Atlanta') + ', ' + (data.state ?? 'GA')

    return NextResponse.json({
      id: `show_${data.id}`,
      type: 'lead',
      name: data.property_name || data.name,
      contact: data.name,
      title: data.contact_title ?? 'Property Manager',
      email: data.email,
      phone: data.phone || '',
      company: '',
      propertyType: data.property_type ?? 'Multifamily',
      units: data.units ?? null,
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

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

// PATCH /api/crm/leads/[id] — update stage, notes, estSetup, estMrr, etc.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const rawId = params.id
  if (!(await leadInScope(rawId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body  = await req.json()

  // show_ prefix = from show_leads table
  if (rawId.startsWith('show_')) {
    const uuid = rawId.replace('show_', '')
    const updateData: Record<string, unknown> = {}
    // stage column added in migration 030 — save it directly
    if (body.stage          !== undefined) updateData.stage          = body.stage
    if (body.notes          !== undefined) updateData.notes          = body.notes
    if (body.assignedDealer !== undefined) updateData.assigned_dealer = body.assignedDealer
    if (body.name           !== undefined) updateData.property_name  = body.name
    if (body.contact        !== undefined) updateData.name           = body.contact
    if (body.title          !== undefined) updateData.contact_title  = body.title
    if (body.email          !== undefined) updateData.email          = body.email
    if (body.phone          !== undefined) updateData.phone          = body.phone
    if (body.units          !== undefined) updateData.units          = body.units
    if (body.propertyType   !== undefined) updateData.property_type  = body.propertyType
    if (body.source         !== undefined) updateData.source         = body.source
    if (body.location       !== undefined) {
      const parts = String(body.location).split(',')
      updateData.city  = parts[0]?.trim() ?? ''
      updateData.state = parts[1]?.trim() ?? ''
    }

    const { data, error } = await supabase
      .from('show_leads')
      .update(updateData)
      .eq('id', uuid)
      .select()
      .single()

    if (error || !data) return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, id: rawId, ...updateData })
  }

  // Regular CRM lead from leads table
  const { data, error } = await supabase
    .from('leads')
    .update(body)
    .eq('id', rawId)
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

  if (rawId.startsWith('show_')) {
    const uuid = rawId.replace('show_', '')
    const { error } = await supabase.from('show_leads').delete().eq('id', uuid)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  const { error } = await supabase.from('leads').delete().eq('id', rawId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
