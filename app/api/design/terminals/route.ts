/**
 * Board terminal layouts (global, shared across all designs).
 *
 * GET  /api/design/terminals   → { layouts: { [deviceKey]: [{name,dx,dy}] } }
 * POST /api/design/terminals   { key, terminals: [{name,dx,dy}] }  → merge + save
 *
 * Lets a board's terminal dots be positioned onto the real screws of its product
 * image, once per board type, and reused everywhere. Stored as ONE JSON blob in
 * the public `design-plans` bucket (terminals/layouts.json) — no new table.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

const BUCKET = 'design-plans'
const PATH = 'terminals/layouts.json'

function serviceDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function readLayouts(): Promise<Record<string, unknown>> {
  try {
    const supabase = serviceDb()
    const { data, error } = await supabase.storage.from(BUCKET).download(PATH)
    if (error || !data) return {}
    const text = await data.text()
    return JSON.parse(text)
  } catch {
    return {}
  }
}

export async function GET() {
  const layouts = await readLayouts()
  return NextResponse.json({ layouts })
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const key = String((body as Record<string, unknown>).key ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    const terminals = (body as Record<string, unknown>).terminals
    if (!key) return NextResponse.json({ error: 'Missing device key' }, { status: 400 })
    if (!Array.isArray(terminals)) return NextResponse.json({ error: 'terminals[] required' }, { status: 400 })

    const layouts = await readLayouts()
    layouts[key] = terminals

    const supabase = serviceDb()
    await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {})
    const bytes = Buffer.from(JSON.stringify(layouts))
    const { error } = await supabase.storage.from(BUCKET).upload(PATH, bytes, {
      contentType: 'application/json',
      upsert: true,
    })
    if (error) return NextResponse.json({ error: `Storage: ${error.message}` }, { status: 500 })

    return NextResponse.json({ ok: true, key }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Save failed'
    console.error('[design terminals]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
