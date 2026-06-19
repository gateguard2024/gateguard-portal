/**
 * GET /api/kb/coverage — which products have AI manual coverage.
 * Returns a map keyed by product_id of { chunks, figures } counts, so the
 * Parts catalog can show an "AI ready" badge vs a "Vectorize" prompt.
 * Auth: Clerk session OR x-tech-code.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth }          from '@clerk/nextjs/server'
import { createClient }  from '@supabase/supabase-js'
import { isTechAuthed }  from '@/lib/tech-auth'

export const dynamic = 'force-dynamic'

function serviceDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: NextRequest) {
  if (!(await isTechAuthed(req))) {
    let userId: string | null = null
    try { const s = await auth(); userId = s.userId } catch { /* no clerk */ }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = serviceDb()
  const coverage: Record<string, { chunks: number; figures: number }> = {}
  const bump = (id: unknown, key: 'chunks' | 'figures') => {
    if (!id) return
    const k = String(id)
    if (!coverage[k]) coverage[k] = { chunks: 0, figures: 0 }
    coverage[k][key]++
  }

  // Count chunks + figures per product. Both tables are small enough to scan
  // the product_id column and aggregate client-side; tables may not exist on
  // older envs, so each query is independently guarded.
  try {
    const { data } = await db.from('manual_chunks').select('product_id').limit(20000)
    ;(data ?? []).forEach((r: { product_id?: string }) => bump(r.product_id, 'chunks'))
  } catch { /* table optional */ }
  try {
    const { data } = await db.from('manual_figures').select('product_id').limit(20000)
    ;(data ?? []).forEach((r: { product_id?: string }) => bump(r.product_id, 'figures'))
  } catch { /* table optional */ }

  return NextResponse.json({ coverage })
}
