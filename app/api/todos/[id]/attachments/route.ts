/**
 * POST /api/todos/[id]/attachments — upload a file attachment to a todo
 * Accepts multipart/form-data with a "file" field
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caller = await getCurrentUser()

    // Verify todo exists and caller has access
    const { data: todo } = await supabase
      .from('todos')
      .select('created_by, assigned_to')
      .eq('id', params.id)
      .single()

    if (!todo) return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
    if (todo.created_by !== caller.id && todo.assigned_to !== caller.id && !caller.isCorporate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const MAX_MB = 25
    if (file.size > MAX_MB * 1024 * 1024) {
      return NextResponse.json({ error: `File too large (max ${MAX_MB}MB)` }, { status: 400 })
    }

    const ext          = file.name.split('.').pop() ?? 'bin'
    const storagePath  = `${params.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const arrayBuffer  = await file.arrayBuffer()

    // Upload to Supabase Storage (bucket: todo-attachments)
    const { error: uploadError } = await supabase.storage
      .from('todo-attachments')
      .upload(storagePath, arrayBuffer, { contentType: file.type || 'application/octet-stream', upsert: false })

    if (uploadError) {
      // Bucket might not exist yet — try creating it then retry
      if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
        await supabase.storage.createBucket('todo-attachments', { public: false })
        const { error: retryError } = await supabase.storage
          .from('todo-attachments')
          .upload(storagePath, arrayBuffer, { contentType: file.type || 'application/octet-stream', upsert: false })
        if (retryError) return NextResponse.json({ error: retryError.message }, { status: 500 })
      } else {
        return NextResponse.json({ error: uploadError.message }, { status: 500 })
      }
    }

    // Get a signed URL (valid 1 year — long lived for usability)
    const { data: signed } = await supabase.storage
      .from('todo-attachments')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365)

    const url = signed?.signedUrl ?? ''

    // Save attachment record
    const { data, error } = await supabase
      .from('todo_attachments')
      .insert({
        todo_id:      params.id,
        name:         file.name,
        url,
        storage_path: storagePath,
        size_bytes:   file.size,
        mime_type:    file.type || `application/${ext}`,
        uploaded_by:  caller.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caller     = await getCurrentUser()
    const { searchParams } = new URL(req.url)
    const attachId   = searchParams.get('attachment_id')
    if (!attachId) return NextResponse.json({ error: 'attachment_id required' }, { status: 400 })

    const { data: attach } = await supabase
      .from('todo_attachments')
      .select('storage_path, uploaded_by')
      .eq('id', attachId)
      .eq('todo_id', params.id)
      .single()

    if (!attach) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (attach.uploaded_by !== caller.id && !caller.isCorporate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (attach.storage_path) {
      await supabase.storage.from('todo-attachments').remove([attach.storage_path])
    }

    const { error } = await supabase.from('todo_attachments').delete().eq('id', attachId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
