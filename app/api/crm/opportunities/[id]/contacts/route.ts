import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
 * DELETE /api/crm/opportunities/[id]/contacts?contactId=<uuid>
 * Deletes a contact, scoped to this opportunity for safety.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
