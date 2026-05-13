import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { data, error } = await supabase
    .from('show_leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const leads = (data || []).map((row: any) => ({
    id: `show_${row.id}`,
    type: 'lead' as const,
    name: row.property_name || row.name,
    company: '',
    contact: row.name,
    propertyType: 'Multifamily',
    location: 'Atlanta, GA',
    stage: 'new' as const,
    rep: 'R. Feldman',
    repInitials: 'RF',
    lastActivity: formatAge(row.created_at),
    source: 'Atlanta Show',
    phone: row.phone,
    email: row.email,
  }))

  return NextResponse.json(leads)
}

function formatAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
