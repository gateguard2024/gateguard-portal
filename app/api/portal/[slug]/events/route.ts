import { NextRequest, NextResponse } from 'next/server'
import { verifyPortal } from '@/lib/portal-auth'
import { getSiteBrivoToken, listBrivoEvents } from '@/lib/brivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Categorize a Brivo action string into the portal's event buckets.
function categorize(action: string): { cat: 'access' | 'denied' | 'admin' | 'schedule'; tone: 'safe' | 'alert' | 'cyan' | 'warn' } {
  const a = (action || '').toLowerCase()
  if (/\b(deni|invalid|reject|fail|unauthor)/.test(a)) return { cat: 'denied', tone: 'alert' }
  if (/schedule/.test(a)) return { cat: 'schedule', tone: 'cyan' }
  if (/(administrator|admin|pulse|manager|remote|unlock early)/.test(a)) return { cat: 'admin', tone: 'warn' }
  return { cat: 'access', tone: 'safe' }
}

// GET /api/portal/[slug]/events?days=7 — PIN-gated. Categorized access events
// from the site's Brivo account (same source as the dashboard Event Tracker,
// just more of them + buckets for the filter chips).
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
  if (!v.portal.site_id) return NextResponse.json({ events: [] })

  const days = Math.min(30, Math.max(1, Number(req.nextUrl.searchParams.get('days') || 7)))

  try {
    const { token, apiKey } = await getSiteBrivoToken(v.portal.site_id)
    const raw = await listBrivoEvents(token, apiKey, 100, days)
    const events = raw.map(e => {
      const { cat, tone } = categorize(e.action)
      const d = e.occurred ? new Date(e.occurred) : null
      return {
        id: e.id,
        time: d ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : '',
        date: d ? d.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', year: 'numeric' }) : '',
        label: e.action || 'Access event',
        user: e.actor || '—',
        gate: e.door || '—',
        cat, tone,
      }
    })
    return NextResponse.json({ events })
  } catch {
    return NextResponse.json({ events: [] })
  }
}
