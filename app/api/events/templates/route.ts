import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Corporate starters (org_id NULL) + this org's own templates.
  const { data, error } = await supabase.from('event_templates').select('*')
    .or(`org_id.is.null,org_id.eq.${user.org_id ?? '00000000-0000-0000-0000-000000000000'}`)
    .order('is_starter', { ascending: false }).order('name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ templates: data ?? [] })
}
