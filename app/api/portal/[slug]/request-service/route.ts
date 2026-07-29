import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPortal } from '@/lib/portal-auth'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const dynamic = 'force-dynamic'

// POST /api/portal/[slug]/request-service — a safe write action for the customer
// portal. PIN-gated. Files a wo_request for the site (same table as the public
// request form), status 'new' — Gate Guard triages it into a work order.
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
  if (!v.portal.site_id) return NextResponse.json({ error: 'This portal has no site linked.' }, { status: 400 })

  const b = await req.json().catch(() => ({}))
  const title = String(b.title ?? '').trim()
  if (!title) return NextResponse.json({ error: 'Describe the issue.' }, { status: 400 })

  const { data, error } = await supabase
    .from('wo_requests')
    .insert({
      site_id: v.portal.site_id,
      title,
      description: b.description ? String(b.description).trim() : null,
      priority_requested: ['urgent', 'high', 'normal', 'low'].includes(b.priority) ? b.priority : 'normal',
      contact_name: b.contact_name ? String(b.contact_name).trim() : null,
      contact_phone: b.contact_phone ? String(b.contact_phone).trim() : null,
      status: 'new',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data?.id })
}
