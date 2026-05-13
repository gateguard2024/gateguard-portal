import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, property_name, email, phone } = body

    if (!name || !email) {
      return NextResponse.json({ error: 'name and email required' }, { status: 400 })
    }

    const { error } = await supabase.from('show_leads').insert({
      name,
      property_name: property_name || null,
      email,
      phone: phone || null,
      source: 'atlanta_2026',
    })

    if (error) {
      console.error('show-lead insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('show-lead error:', err)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
