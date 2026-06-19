/**
 * POST /api/kb/ingest-manual — vectorize a product's manual on demand.
 * Body: { product_id }  -> reads products.manual_url, fires the
 * kb/manual.ingest background job (same job product-add uses automatically).
 * Lets a user re-run / kick off ingest for a product that already exists.
 * Auth: Clerk session OR x-tech-code.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth }          from '@clerk/nextjs/server'
import { createClient }  from '@supabase/supabase-js'
import { isTechAuthed }  from '@/lib/tech-auth'
import { inngest }       from '@/inngest/client'

export const dynamic = 'force-dynamic'

function serviceDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(req: NextRequest) {
  if (!(await isTechAuthed(req))) {
    let userId: string | null = null
    try { const s = await auth(); userId = s.userId } catch { /* no clerk */ }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { product_id?: string; manual_url?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const product_id = body.product_id
  if (!product_id) return NextResponse.json({ error: 'product_id is required' }, { status: 400 })

  // Resolve the manual URL from the product (or accept an explicit override).
  let manual_url = body.manual_url ?? null
  if (!manual_url) {
    const { data } = await serviceDb().from('products').select('manual_url').eq('id', product_id).maybeSingle()
    manual_url = (data as { manual_url?: string } | null)?.manual_url ?? null
  }
  if (!manual_url) {
    return NextResponse.json({ error: 'This product has no manual URL yet. Add a manual PDF link first.' }, { status: 400 })
  }

  try {
    await inngest.send({ name: 'kb/manual.ingest', data: { product_id, manual_url } })
  } catch {
    return NextResponse.json({ error: 'Could not queue the manual ingest. Try again shortly.' }, { status: 502 })
  }
  return NextResponse.json({ queued: true, product_id })
}
