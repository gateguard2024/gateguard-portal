import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// PATCH /api/customers/[id]/contacts/[contactId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; contactId: string } }
) {
  const body = await req.json()

  // If setting as primary, clear others first
  if (body.is_primary) {
    await supabase
      .from('org_contacts')
      .update({ is_primary: false })
      .eq('org_id', params.id)
  }

  const { data, error } = await supabase
    .from('org_contacts')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.contactId)
    .eq('org_id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contact: data })
}

// DELETE /api/customers/[id]/contacts/[contactId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; contactId: string } }
) {
  const { error } = await supabase
    .from('org_contacts')
    .delete()
    .eq('id', params.contactId)
    .eq('org_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
