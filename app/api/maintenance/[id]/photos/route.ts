import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data, error } = await supabase
    .from('work_order_photos')
    .select('*')
    .eq('work_order_id', params.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ photos: data ?? [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  const body = await req.json()
  const { file_url, file_name } = body

  if (!file_url) {
    return NextResponse.json({ error: 'file_url is required' }, { status: 400 })
  }

  const org_id = user.org_id ?? null

  const { data, error } = await supabase
    .from('work_order_photos')
    .insert({
      work_order_id: params.id,
      org_id,
      file_url,
      file_name:     file_name ?? null,
      uploaded_by:   user.name ?? user.email ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ photo: data }, { status: 201 })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url)
  const photoId = searchParams.get('photo_id')
  if (!photoId) return NextResponse.json({ error: 'photo_id required' }, { status: 400 })

  const { error } = await supabase
    .from('work_order_photos')
    .delete()
    .eq('id', photoId)
    .eq('work_order_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
