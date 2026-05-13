import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function formatAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const rawId = params.id

  // show_ prefix = from show_leads table
  if (rawId.startsWith('show_')) {
    const uuid = rawId.replace('show_', '')
    const { data, error } = await supabase
      .from('show_leads')
      .select('*')
      .eq('id', uuid)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: `show_${data.id}`,
      type: 'lead',
      name: data.property_name || data.name,
      contact: data.name,
      title: 'Property Manager',
      email: data.email,
      phone: data.phone || '',
      company: '',
      propertyType: 'Multifamily',
      units: null,
      location: 'Atlanta, GA',
      address: 'Atlanta, GA',
      stage: 'new',
      source: 'Atlanta Show',
      rep: 'Russel Feldman',
      repInitials: 'RF',
      lockDaysLeft: null,
      lockExpires: null,
      estSetup: null,
      estMrr: null,
      notes: '',
      createdAt: formatDate(data.created_at),
      lastActivity: formatAge(data.created_at),
    })
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
