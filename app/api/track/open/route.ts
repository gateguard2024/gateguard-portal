import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// 1x1 transparent GIF (base64)
const PIXEL_B64 =
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const PIXEL = Buffer.from(PIXEL_B64, 'base64')

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (id) {
    // Non-blocking — fire and forget so pixel response is instant
    void (async () => {
      try {
        // Increment open_count, set opened_at on first open, update status
        const { data: existing } = await supabase
          .from('crm_activities')
          .select('open_count, opened_at')
          .eq('id', id)
          .single()

        if (existing) {
          const updates: Record<string, unknown> = {
            open_count:   (existing.open_count ?? 0) + 1,
            email_status: 'opened',
          }
          if (!existing.opened_at) {
            updates.opened_at = new Date().toISOString()
          }
          await supabase
            .from('crm_activities')
            .update(updates)
            .eq('id', id)
        }
      } catch (_) { /* silent — never break pixel response */ }
    })()
  }

  // Always return the pixel immediately
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type':  'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma':        'no-cache',
      'Expires':       '0',
    },
  })
}
