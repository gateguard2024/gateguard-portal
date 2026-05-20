import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/customers/[id]/attachments
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('org_attachments')
    .select('*')
    .eq('org_id', params.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ attachments: data ?? [] })
}

// POST /api/customers/[id]/attachments — register after direct-to-Storage upload
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  const body = await req.json()
  const { name, file_url, file_size, mime_type, category, notes } = body

  if (!name || !file_url) {
    return NextResponse.json({ error: 'name and file_url are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('org_attachments')
    .insert({
      org_id: params.id,
      name,
      file_url,
      file_size: file_size ?? null,
      mime_type: mime_type ?? null,
      category: category ?? 'general',
      notes: notes ?? null,
      uploaded_by: user?.name ?? user?.email ?? 'Unknown',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ attachment: data })
}

// DELETE /api/customers/[id]/attachments?attachment_id=X
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url)
  const attachmentId = searchParams.get('attachment_id')
  if (!attachmentId) return NextResponse.json({ error: 'attachment_id required' }, { status: 400 })

  const { error } = await supabase
    .from('org_attachments')
    .delete()
    .eq('id', attachmentId)
    .eq('org_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
