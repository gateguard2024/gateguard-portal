import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET() {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  let query = supabase
    .from('org_documents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  query = applyOrgScope(query, scope, 'org_id')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ documents: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  const body = await req.json()
  const { name, category, file_url, file_size_kb, uploaded_by, expires_at, site_id } = body

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const org_id = user.isCorporate ? (body.org_id ?? null) : (user.org_id ?? null)

  const { data, error } = await supabase
    .from('org_documents')
    .insert({
      org_id,
      site_id:      site_id ?? null,
      name,
      category:     category ?? 'other',
      file_url:     file_url ?? null,
      file_size_kb: file_size_kb ?? null,
      uploaded_by:  uploaded_by ?? null,
      expires_at:   expires_at ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ document: data }, { status: 201 })
}
