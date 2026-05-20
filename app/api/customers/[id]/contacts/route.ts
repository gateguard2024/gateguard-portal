import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/customers/[id]/contacts
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('org_contacts')
    .select('*')
    .eq('org_id', params.id)
    .order('is_primary', { ascending: false })
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contacts: data ?? [] })
}

// POST /api/customers/[id]/contacts
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { name, title, email, phone, is_primary, notes } = body

  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  // If setting this one as primary, clear others first
  if (is_primary) {
    await supabase
      .from('org_contacts')
      .update({ is_primary: false })
      .eq('org_id', params.id)
  }

  const { data, error } = await supabase
    .from('org_contacts')
    .insert({ org_id: params.id, name, title, email, phone, is_primary: !!is_primary, notes })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contact: data })
}
