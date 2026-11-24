/**
 * /api/portal/[slug]/activity-summary — a manager's own emailed summary setting
 * (lib/activity-summary.ts). GET → { freq, email } · POST { freq: off|daily|weekly }.
 * POST { preview: true } emails the signed-in manager a summary right now.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPortal } from '@/lib/portal-auth'
import { getPortalManager } from '@/lib/portal-manager'
import { subsOf, buildSummary, type Freq } from '@/lib/activity-summary'
import { sendEmail } from '@/lib/email-sender'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function ctx(req: NextRequest, slug: string) {
  const v = await verifyPortal(req, slug)
  if (!v.ok) return { res: NextResponse.json({ error: v.error }, { status: v.status }) }
  const m = await getPortalManager(req, slug)
  if (!m) return { res: NextResponse.json({ error: 'Sign in with your personal PIN.', need_manager: true }, { status: 403 }) }
  return { v, m }
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const c = await ctx(req, params.slug); if ('res' in c) return c.res
  return NextResponse.json({ freq: subsOf(c.v.portal.branding)[c.m.id] ?? 'off', email: c.m.email })
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const c = await ctx(req, params.slug); if ('res' in c) return c.res
  const b = await req.json().catch(() => ({}))
  if (!c.m.email) return NextResponse.json({ error: 'Your manager profile has no email — ask another manager (Settings) to add one.' }, { status: 400 })
  if (b.preview) {
    if (!c.v.portal.site_id) return NextResponse.json({ error: 'Not linked to a site.' }, { status: 400 })
    const s = await buildSummary(c.v.portal.site_id, 7)
    const r = s ? await sendEmail({ to: c.m.email, subject: `[Preview] ${s.subject}`, html: s.html }) : { success: false, error: 'Nothing to send' }
    return r.success ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error || 'Email failed' }, { status: 502 })
  }
  const freq = String(b.freq) as Freq
  if (!['off', 'daily', 'weekly'].includes(freq)) return NextResponse.json({ error: 'Pick off, daily or weekly.' }, { status: 400 })
  const { data: row, error } = await db().from('client_portals').select('id, branding').ilike('slug', c.v.portal.slug).maybeSingle()
  if (error || !row) return NextResponse.json({ error: error?.message ?? 'Portal not found' }, { status: 500 })
  const branding = { ...(row.branding && typeof row.branding === 'object' ? row.branding : {}) } as Record<string, unknown>
  const subs = { ...subsOf(branding) }
  if (freq === 'off') delete subs[c.m.id]; else subs[c.m.id] = freq
  const { error: uErr } = await db().from('client_portals').update({ branding: { ...branding, summary_subs: subs }, updated_at: new Date().toISOString() }).eq('id', row.id)
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })
  return NextResponse.json({ freq })
}
