import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const dynamic = 'force-dynamic'

// SHA-256 of the passcode. Slug-independent so renaming a portal keeps its PIN.
export function hashPortalPin(pin: string): string {
  return createHash('sha256').update(`gg-portal:${pin.trim()}`).digest('hex')
}

// POST /api/portal/[slug]/verify  { pin } — check the passcode, set a 12h cookie.
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const { pin } = await req.json().catch(() => ({}))
  if (!pin) return NextResponse.json({ error: 'Enter your access code.' }, { status: 400 })

  const { data: portal } = await supabase
    .from('client_portals')
    .select('access_pin, status')
    .ilike('slug', params.slug)
    .maybeSingle()

  if (!portal || portal.status === 'disabled') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!portal.access_pin) return NextResponse.json({ ok: true }) // no gate configured

  const h = hashPortalPin(String(pin))
  if (h !== portal.access_pin) return NextResponse.json({ error: 'That code isn’t right.' }, { status: 401 })

  const res = NextResponse.json({ ok: true })
  res.cookies.set(`pp_${params.slug}`, h, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12,
  })
  return res
}
