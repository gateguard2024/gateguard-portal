/**
 * POST /api/crm/contacts — create a standalone contact (a person).
 * Contacts are M:N with sites/companies, so they aren't owned by one org.
 * Body: { name? | first_name?, last_name?, email?, phone?, title?, notes? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

// GET /api/crm/contacts?q=  → search contacts (for the attach-existing picker)
export async function GET(req: NextRequest) {
  await getCurrentUser()
  const q = clean(new URL(req.url).searchParams.get('q'))
  let query = supabase.from('contacts').select('id, first_name, last_name, email, phone, title').order('created_at', { ascending: false }).limit(20)
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = (data ?? []).map(c => ({ id: c.id, name: [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.email || 'Contact', email: c.email, phone: c.phone, title: c.title }))
  return NextResponse.json({ contacts: rows })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  const body = await req.json().catch(() => ({}))

  // Accept a full "name" and split it, or explicit first/last.
  let first = clean(body.first_name)
  let last = clean(body.last_name)
  if (!first && !last && clean(body.name)) {
    const parts = clean(body.name).split(/\s+/)
    first = parts[0] ?? ''
    last = parts.slice(1).join(' ')
  }
  if (!first && !last && !clean(body.email)) {
    return NextResponse.json({ error: 'A name or email is required.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      org_id: user.org_id ?? null,
      first_name: first || null,
      last_name: last || null,
      email: clean(body.email) || null,
      phone: clean(body.phone) || null,
      title: clean(body.title) || null,
      notes: clean(body.notes) || null,
    })
    .select('id, first_name, last_name, email, phone, title')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
