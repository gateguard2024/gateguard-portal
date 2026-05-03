/**
 * GET /api/kb/products
 *
 * Returns active products for the tech tool device picker.
 * Accepts either:
 *   - Clerk session (dealer logged into portal)
 *   - x-tech-code header matching TECH_ACCESS_CODE env var (field techs)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth }                      from '@clerk/nextjs/server'
import { createClient }              from '@supabase/supabase-js'

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function isTechAuthed(req: NextRequest): boolean {
  const code      = req.headers.get('x-tech-code')
  const validCode = process.env.TECH_ACCESS_CODE
  return !!(validCode && code && code === validCode)
}

export async function GET(req: NextRequest) {
  // Tech code checked first — if valid, skip Clerk entirely
  const techOk = isTechAuthed(req)
  if (!techOk) {
    // Clerk path — try auth(), fail gracefully if Clerk wasn't initialized
    let userId: string | null = null
    try { const s = await auth(); userId = s.userId } catch { /* no clerk session */ }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // field_service=true scopes the list to serviceable equipment only.
  // The full catalog (quotes, billing) is excluded from the tech tool.
  const { data, error } = await serviceDb()
    .from('products')
    .select('id, name, brand, category, sku, manual_url, description, specs, tags')
    .eq('active', true)
    .eq('field_service', true)
    .order('brand')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ products: data ?? [] })
}
