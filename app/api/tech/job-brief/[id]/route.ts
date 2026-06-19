/**
 * GET /api/tech/job-brief/[id]
 *
 * Pre-job brief for a technician: pulls the work order's site, the equipment
 * installed there, recent visits, and access notes — all from EXISTING tables
 * (work_orders, sites, site_assets, site_events) — and adds a short AI summary.
 *
 * Auth: x-tech-code (field tool) OR Clerk session.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth }          from '@clerk/nextjs/server'
import { createClient }  from '@supabase/supabase-js'
import { isTechAuthed }  from '@/lib/tech-auth'
import Anthropic         from '@anthropic-ai/sdk'

function serviceDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isTechAuthed(req))) {
    let userId: string | null = null
    try { const s = await auth(); userId = s.userId } catch { /* no clerk */ }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = serviceDb()
  const { data: wo } = await db.from('work_orders').select('id, wo_number, title, description, status, priority, scheduled_date, site_id, customer_name').eq('id', params.id).single()
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const siteId = wo.site_id as string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let site: any = null, equipment: any[] = [], recent: any[] = [], events: any[] = []
  if (siteId) {
    const [s, eq, rc, ev] = await Promise.all([
      db.from('sites').select('name, address, city, state, access_notes, pm_name, pm_phone, primary_contact_name, primary_contact_phone, units').eq('id', siteId).single(),
      db.from('site_assets').select('product_name, product_category, serial_number, status, location_note').eq('site_id', siteId).limit(40),
      db.from('work_orders').select('wo_number, title, status, completed_at, scheduled_date').eq('site_id', siteId).neq('id', params.id).order('created_at', { ascending: false }).limit(6),
      db.from('site_events').select('event_type, title, description, summary, created_at').eq('site_id', siteId).order('created_at', { ascending: false }).limit(6),
    ])
    site = s.data; equipment = eq.data ?? []; recent = rc.data ?? []; events = ev.data ?? []
  }

  // Short AI brief (non-fatal if it fails)
  let brief: string | null = null
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const ctx = {
      job: { title: wo.title, scope: wo.description, priority: wo.priority },
      site: site ? { name: site.name, units: site.units, access_notes: site.access_notes } : null,
      equipment: equipment.map(e => `${e.product_name}${e.serial_number ? ` (S/N ${e.serial_number})` : ''}${e.status === 'offline' ? ' [OFFLINE]' : ''}`),
      recent_visits: recent.map(r => `${r.wo_number || r.title}: ${r.status}`),
      site_notes: events.map(e => e.summary || e.description || e.title).filter(Boolean),
    }
    const m = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 220,
      messages: [{ role: 'user', content: `You are briefing a field technician before they arrive. In 2-4 short sentences, tell them what they need to know for THIS job: what's being done, key equipment on site (call out anything offline), any recurring issue from past visits, and the access/gate note if present. Be concrete and practical, no fluff. Data:\n${JSON.stringify(ctx)}` }],
    })
    const b = m.content.find(x => x.type === 'text')
    brief = b && b.type === 'text' ? b.text.trim() : null
  } catch { /* brief is optional */ }

  return NextResponse.json({ brief, equipment, recent, access_notes: site?.access_notes ?? null })
}
