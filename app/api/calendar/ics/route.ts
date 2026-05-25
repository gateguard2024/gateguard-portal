import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/calendar/ics — list user's ICS subscriptions
export async function GET() {
  try {
    const user = await getCurrentUser()
    const { data, error } = await supabase
      .from('calendar_connections')
      .select('id,name,color,ics_url,last_synced_at,is_active')
      .eq('user_id', user.id)
      .eq('provider', 'ics')
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json({ connections: data ?? [] })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// POST /api/calendar/ics — add a new ICS subscription
// Body: { name, url, color? }
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json() as { name?: string; url?: string; color?: string }

    if (!body.url?.trim()) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    // Normalise webcal:// → https://
    let url = body.url.trim()
    if (url.startsWith('webcal://')) url = 'https://' + url.slice(9)

    // Quick validation — try to fetch the URL
    let validated = false
    try {
      const testRes = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) })
      validated = testRes.ok
    } catch { /* fall through — still save; might be a timing issue */ }

    const { data, error } = await supabase
      .from('calendar_connections')
      .insert({
        user_id:  user.id,
        provider: 'ics',
        name:     body.name.trim(),
        color:    body.color ?? '#6B7EFF',
        ics_url:  url,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ connection: data, validated }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// DELETE /api/calendar/ics?id=<uuid> — remove an ICS subscription
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const id   = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const { error } = await supabase
      .from('calendar_connections')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
