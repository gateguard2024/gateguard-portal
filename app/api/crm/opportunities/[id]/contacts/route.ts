import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { opportunityInScope } from '@/lib/crm-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

/**
 * GET /api/crm/opportunities/[id]/contacts
 * Returns all contacts for this opportunity, primary contacts first.
 */
export async function GET(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await opportunityInScope(params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data, error } = await supabase
    .from('opportunity_contacts')
    .select('*')
    .eq('opportunity_id', params.id)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/**
 * POST /api/crm/opportunities/[id]/contacts
 * Creates a new contact linked to this opportunity.
 * Body: { name (required), title, phone, email, role, is_primary }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await opportunityInScope(params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = await req.json()
    const { name, title, phone, email, role, is_primary } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('opportunity_contacts')
      .insert({
        opportunity_id: params.id,
        contact_name: name,
        contact_title: title ?? null,
        contact_email: email ?? null,
        contact_phone: phone ?? null,
        role: role ?? 'Site Contact',
        is_primary: is_primary ?? false,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * PATCH /api/crm/opportunities/[id]/contacts
 * Update a contact. Body: { contactId (required), ...fields }.
 * Setting { is_primary: true } makes this the sole primary (clears the others).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await opportunityInScope(params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = await req.json()
    const { contactId, name, title, phone, email, role, is_primary } = body
    if (!contactId) return NextResponse.json({ error: 'contactId is required' }, { status: 400 })

    // Exactly one primary per opportunity — clear the others first.
    if (is_primary === true) {
      await supabase.from('opportunity_contacts').update({ is_primary: false }).eq('opportunity_id', params.id)
    }

    const patch: Record<string, unknown> = {}
    if (name !== undefined) patch.contact_name = name
    if (title !== undefined) patch.contact_title = title
    if (email !== undefined) patch.contact_email = email
    if (phone !== undefined) patch.contact_phone = phone
    if (role !== undefined) patch.role = role
    if (is_primary !== undefined) patch.is_primary = is_primary

    const { data, error } = await supabase
      .from('opportunity_contacts')
      .update(patch)
      .eq('id', contactId)
      .eq('opportunity_id', params.id) // scope to this opportunity for safety
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'update failed' }, { status: 500 })
  }
}

/**
 * DELETE /api/crm/opportunities/[id]/contacts?contactId=<uuid>
 * Deletes a contact, scoped to this opportunity for safety.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await opportunityInScope(params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { searchParams } = new URL(req.url)
  const contactId = searchParams.get('contactId')

  if (!contactId) {
    return NextResponse.json({ error: 'contactId query param is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('opportunity_contacts')
    .delete()
    .eq('id', contactId)
    .eq('opportunity_id', params.id) // scope to this opportunity for safety

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
