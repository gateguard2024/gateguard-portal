import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/dispatch/technicians
export async function GET() {
  const { data, error } = await supabase
    .from('technicians')
    .select('*')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ technicians: data ?? [] })
}

// POST /api/dispatch/technicians — add a new tech
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, role = 'Tech', phone, email, employment_type = 'employee' } = body

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)

  const { data, error } = await supabase
    .from('technicians')
    .insert({ name, initials, role, phone, email, status: 'offline', employment_type })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ technician: data }, { status: 201 })
}
