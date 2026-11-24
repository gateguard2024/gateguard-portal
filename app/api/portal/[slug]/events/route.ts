import { NextRequest, NextResponse } from 'next/server'
import { verifyPortal } from '@/lib/portal-auth'
import { recentSiteEvents } from '@/lib/brivo-events-store'
import { memo } from '@/lib/memo'
import { getSiteBrivoToken, brivoRawEvents, mapBrivoEvent } from '@/lib/brivo'

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
// for the property: up to 30 days from the stored history (synced hourly from
// Brivo, migration 241) + a live top-up — buckets for the filter chips.
export const maxDuration = 60

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
  // ?raw=1 — what Brivo actually sends for events we can't put a name on (last 2 days,
  // up to 5). Same people the page already shows; for checking Brivo's field names.
  if (req.nextUrl.searchParams.get('raw') === '1' && v.portal.site_id) {
    try {
      const { token, apiKey } = await getSiteBrivoToken(v.portal.site_id)
      const raw = await brivoRawEvents(token, apiKey, Date.now() - 2 * 864e5, Date.now(), 100)
      const blank = raw.filter(e => !mapBrivoEvent(e).actor)
      return NextResponse.json({ checked: raw.length, without_name: blank.length, samples: blank.slice(0, 5), named_sample: raw.find(e => mapBrivoEvent(e).actor) ?? null })
    } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 502 }) }
  }
  if (!v.portal.site_id) return NextResponse.json({ events: [] })

  const days = Math.min(30, Math.max(1, Number(req.nextUrl.searchParams.get('days') || 7)))

  try {
    // One request per property at a time, kept 1 min: going Vision → Activity and back
    // used to start a second Brivo pull while the first was still running → blank page.
    const siteId = v.portal.site_id
    const raw = await memo(`portal-events:${siteId}:${days}`, 60_000, () => recentSiteEvents(siteId, { days, limit: days > 7 ? 1000 : 300 }))
    const events = raw.map(e => {
      const { cat, tone } = categorize(e.action)
      const d = e.occurred ? new Date(e.occurred) : null
      return {
        id: e.id,
        // Property time (Eastern) — the server runs in UTC, so 'undefined' showed times 5 h off.
        time: d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: 'America/New_York' }) : '',
        date: d ? d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'America/New_York' }) : '',
        label: e.action || 'Access event',
        user: e.actor || '—',
        gate: e.door || '—',
        cat, tone,
      }
    })
    return NextResponse.json({ events })
  } catch (e) {
    // Say what went wrong — an empty list looked like "no one came through".
    return NextResponse.json({ events: [], error: e instanceof Error ? e.message : 'Could not load door events' }, { status: 502 })
  }
}
