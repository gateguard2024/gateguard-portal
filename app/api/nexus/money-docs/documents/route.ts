import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type DocumentBucket = 'needs_signature' | 'waiting_on_customer' | 'recently_signed' | 'draft_not_sent'

type SignatureRow = {
  id: string
  document_type?: string | null
  document_version?: string | null
  document_url?: string | null
  signer_name?: string | null
  signer_email?: string | null
  signer_company?: string | null
  signed_at?: string | null
  status?: string | null
  sent_by_name?: string | null
  sent_at?: string | null
  expires_at?: string | null
}

function bucketFor(row: SignatureRow): DocumentBucket {
  const status = String(row.status ?? '').toLowerCase()
  if (row.signed_at || status === 'signed' || status === 'completed') return 'recently_signed'
  if (!row.sent_at || status === 'draft') return 'draft_not_sent'
  if (status === 'pending' || status === 'sent') return 'waiting_on_customer'
  return 'needs_signature'
}

export async function GET() {
  try {
    await getCurrentUser()
    const { data, error } = await supabase
      .from('document_signatures')
      .select('id,document_type,document_version,document_url,signer_name,signer_email,signer_company,signed_at,status,sent_by_name,sent_at,expires_at')
      .order('sent_at', { ascending: false, nullsFirst: false })
      .limit(80)

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })

    const documents = ((data ?? []) as SignatureRow[]).map(row => {
      const bucket = bucketFor(row)
      return {
        id: row.id,
        title: row.document_type || 'Document',
        version: row.document_version || null,
        status: row.status || 'pending',
        signer_name: row.signer_name || null,
        signer_email: row.signer_email || null,
        signer_company: row.signer_company || null,
        sent_by_name: row.sent_by_name || null,
        sent_at: row.sent_at || null,
        signed_at: row.signed_at || null,
        expires_at: row.expires_at || null,
        document_url: row.document_url || null,
        bucket,
        urgency: bucket === 'needs_signature' ? 'high' : bucket === 'waiting_on_customer' ? 'medium' : 'low',
      }
    })

    return NextResponse.json({ success: true, documents })
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Could not load documents.' }, { status: 500 })
  }
}
