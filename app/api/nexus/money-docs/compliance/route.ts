import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type ComplianceBucket = 'expired' | 'missing' | 'needs_review' | 'ok'

type ComplianceItem = {
  id: string
  title: string
  subtitle: string
  status: string
  source: string
  date: string | null
  bucket: ComplianceBucket
  urgency: 'high' | 'medium' | 'low'
}

function todayMs() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function isPast(dateText?: string | null) {
  if (!dateText) return false
  const d = new Date(dateText)
  return Number.isFinite(d.getTime()) && d.getTime() < todayMs()
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    const items: ComplianceItem[] = []

    const docs = await supabase
      .from('document_signatures')
      .select('id,document_type,signer_email,status,expires_at,signed_at')
      .limit(80)

    for (const row of docs.data ?? []) {
      const expired = isPast(row.expires_at) && !row.signed_at
      const pending = !row.signed_at && String(row.status ?? '').toLowerCase() !== 'signed'
      if (!expired && !pending) continue
      items.push({
        id: `doc-${row.id}`,
        title: row.document_type || 'Signature Document',
        subtitle: row.signer_email || 'No signer email',
        status: row.status || 'pending',
        source: 'Document Signature',
        date: row.expires_at || null,
        bucket: expired ? 'expired' : 'needs_review',
        urgency: expired ? 'high' : 'medium',
      })
    }

    let customers = supabase
      .from('customers')
      .select('id,status,contract_end,notes')
      .limit(80)
    if (!user.isCorporate && user.org_id) customers = customers.eq('dealer_org_id', user.org_id)
    const customerRows = await customers
    for (const row of customerRows.data ?? []) {
      if (row.contract_end) continue
      items.push({
        id: `customer-${row.id}`,
        title: 'Missing Contract End Date',
        subtitle: row.notes || 'Customer record needs contract date review',
        status: row.status || 'active',
        source: 'Customer Contract',
        date: null,
        bucket: 'missing',
        urgency: 'medium',
      })
    }

    let properties = supabase
      .from('properties')
      .select('id,name,status')
      .limit(80)
    if (!user.isCorporate && user.org_id) properties = properties.eq('org_id', user.org_id)
    const propertyRows = await properties
    for (const row of propertyRows.data ?? []) {
      if (String(row.status ?? '').toLowerCase() !== 'unknown') continue
      items.push({
        id: `property-${row.id}`,
        title: row.name || 'Property Status Unknown',
        subtitle: 'Property needs status review',
        status: row.status || 'unknown',
        source: 'Property',
        date: null,
        bucket: 'needs_review',
        urgency: 'low',
      })
    }

    return NextResponse.json({ success: true, items })
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Could not load compliance.' }, { status: 500 })
  }
}
