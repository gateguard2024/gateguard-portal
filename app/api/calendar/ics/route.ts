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

// Extract X-WR-CALNAME from an iCal feed text (returns null if not found)
function extractCalName(text: string): string | null {
  const m = text.match(/X-WR-CALNAME[^:\r\n]*:(.+)/i)
  if (!m) return null
  return m[1].trim().replace(/\\n/g, '').substring(0, 80) || null
}

// POST /api/calendar/ics — add a new ICS subscription (or bulk: array of urls)
// Body: { url, name?, color? }  — name is OPTIONAL, auto-detected from feed
// Body: { urls: string[] }       — bulk add, name auto-detected per feed
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json() as { name?: string; url?: string; color?: string; urls?: string[] }

    // Bulk mode
    const rawUrls = body.urls?.length
      ? body.urls
      : body.url?.trim() ? [body.url.trim()] : []

    if (!rawUrls.length) {
      return NextResponse.json({ error: 'url or urls is required' }, { status: 400 })
    }

    const results = []
    for (const rawUrl of rawUrls) {
      // Normalise webcal:// → https://
      let url = rawUrl.trim()
      if (!url) continue
      if (url.startsWith('webcal://')) url = 'https://' + url.slice(9)

      // Auto-detect calendar name from the feed
      let name = body.name?.trim() ?? ''
      try {
        const feedRes = await fetch(url, { signal: AbortSignal.timeout(10000) })
        if (feedRes.ok) {
          const text = await feedRes.text()
          name = name || extractCalName(text) || ''
        }
      } catch { /* fall through */ }

      // Fallback: derive name from URL hostname
      if (!name) {
        try {
          const hostname = new URL(url).hostname.replace(/^www\./, '')
          name = hostname.split('.')[0].replace(/-/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase())
        } catch { name = 'Calendar' }
      }

      const { data, error } = await supabase
        .from('calendar_connections')
        .insert({
          user_id:   user.id,
          provider:  'ics',
          name,
          color:     body.color ?? '#22C55E',
          ics_url:   url,
          is_active: true,
        })
        .select()
        .single()

      if (!error && data) results.push({ connection: data, validated: true })
    }

    if (results.length === 1) {
      return NextResponse.json({ connection: results[0].connection, validated: true }, { status: 201 })
    }
    return NextResponse.json({ connections: results.map((r) => r.connection), count: results.length }, { status: 201 })
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
