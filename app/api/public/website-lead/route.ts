/**
 * POST /api/public/website-lead — PUBLIC lead intake for gateguard.co.
 *
 * gateguard.co forwards its forms here (server-to-server, through its own
 * /api/lead route), so every website lead lands in Nexus → Leads with
 * source = 'website'. No Clerk session: the route is bypassed in middleware.ts.
 *
 * Kinds:
 *   proposal  — owner / manager asking for a custom proposal (Proposal Builder)
 *   dealer    — installer / integrator applying to the dealer network
 *   contact   — general "talk to us"
 *
 * Abuse guards: optional shared key (WEBSITE_LEAD_KEY — when set, the request
 * must carry it in x-website-lead-key), a honeypot field, field length caps,
 * and a same-email-in-the-last-10-minutes duplicate check.
 * Optional alert email: set WEBSITE_LEAD_NOTIFY_EMAIL (+ RESEND_API_KEY).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GATEGUARD_ORG_ID = '00000000-0000-0000-0000-000000000001'
const KINDS = ['proposal', 'dealer', 'contact'] as const
type Kind = (typeof KINDS)[number]

const KIND_LABEL: Record<Kind, string> = {
  proposal: 'Proposal request',
  dealer: 'Dealer application',
  contact: 'Contact request',
}

function str(v: unknown, max = 200): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}
function int(v: unknown, max = 100000): number | null {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10)
  return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n) : null
}
function strList(v: unknown, maxItems = 10): string[] {
  return Array.isArray(v) ? v.map(x => str(x, 60)).filter(Boolean).slice(0, maxItems) : []
}

export async function POST(req: NextRequest) {
  try {
    const key = process.env.WEBSITE_LEAD_KEY
    if (key && req.headers.get('x-website-lead-key') !== key) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>

    // Honeypot: real visitors never fill this. Pretend success for bots.
    if (str(body.website)) return NextResponse.json({ ok: true })

    const kind = (KINDS as readonly string[]).includes(str(body.kind)) ? (str(body.kind) as Kind) : 'contact'
    const firstName = str(body.first_name, 40)
    const lastName = str(body.last_name, 80)
    const contactName = [firstName, lastName].filter(Boolean).join(' ')
    const email = str(body.email, 120).toLowerCase()
    const phone = str(body.phone, 40)
    const company = str(body.company, 120)
    const title = str(body.title, 80)
    const state = str(body.state, 2).toUpperCase()

    if (!contactName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: 'Name and a valid email are required.' }, { status: 400 })
    }

    // Proposal Builder facts (all optional).
    const units = int(body.units)
    const program = str(body.program, 40)
    const solutions = strList(body.solutions)
    const openings = (body.openings && typeof body.openings === 'object') ? body.openings as Record<string, unknown> : {}
    const o = {
      vehWorking: int(openings.vehicle_working, 500) ?? 0,
      vehRepair: int(openings.vehicle_repair, 500) ?? 0,
      pedWorking: int(openings.ped_working, 500) ?? 0,
      pedRepair: int(openings.ped_repair, 500) ?? 0,
      doorWorking: int(openings.door_working, 500) ?? 0,
      doorRepair: int(openings.door_repair, 500) ?? 0,
    }
    const entryPoints = o.vehWorking + o.vehRepair + o.pedWorking + o.pedRepair + o.doorWorking + o.doorRepair
    const needsRepair = o.vehRepair + o.pedRepair + o.doorRepair

    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // Duplicate guard: same email + kind within 10 minutes → treat as the same lead.
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data: recent } = await db
      .from('leads')
      .select('id')
      .eq('email', email)
      .eq('source', 'website')
      .gte('created_at', since)
      .limit(1)
    if (recent && recent.length > 0) return NextResponse.json({ ok: true, duplicate: true })

    const notes = [
      `${KIND_LABEL[kind]} from gateguard.co`,
      kind === 'proposal' && units != null ? `Units: ${units}` : null,
      kind === 'proposal' && program ? `Preferred program: ${program}` : null,
      kind === 'proposal' && entryPoints > 0
        ? `Entries: ${entryPoints} (${needsRepair} need repair) — vehicle gates ${o.vehWorking} working / ${o.vehRepair} repair; ped gates ${o.pedWorking} / ${o.pedRepair}; doors ${o.doorWorking} / ${o.doorRepair}`
        : null,
      kind === 'proposal' && solutions.length ? `Wants: ${solutions.join(', ')}` : null,
      str(body.message, 1000) ? `Message: ${str(body.message, 1000)}` : null,
    ].filter(Boolean).join('\n')

    const row: Record<string, unknown> = {
      org_id: GATEGUARD_ORG_ID,
      contact_name: contactName,
      contact_title: title || null,
      email,
      phone: phone || null,
      company_name: company || null,
      property_name: kind === 'dealer' ? null : (company || null),
      state: state || null,
      stage: 'prospect',
      source: 'website',
      lead_type: kind === 'dealer' ? 'dealer_applicant' : kind === 'proposal' ? 'website_proposal' : 'website_contact',
      notes,
    }
    if (units != null && kind === 'proposal') row.unit_count = units
    if (entryPoints > 0 && kind === 'proposal') row.entry_points = entryPoints
    if (solutions.length) row.interests = solutions

    const { data: lead, error } = await db.from('leads').insert(row).select('id').single()
    if (error) {
      console.error('website-lead insert error:', error)
      return NextResponse.json({ ok: false, error: 'Could not save your request.' }, { status: 500 })
    }

    // Best-effort timeline entries — never fail the request over these.
    try {
      await db.from('activity_log').insert({
        org_id: GATEGUARD_ORG_ID,
        entity_type: 'lead',
        entity_id: lead.id,
        action: 'created',
        description: `Website ${KIND_LABEL[kind].toLowerCase()}: ${contactName}${company ? ` at ${company}` : ''}`,
      })
    } catch { /* ignore */ }
    try {
      await db.from('crm_activities').insert({
        dealer_org_id: GATEGUARD_ORG_ID,
        type: 'note',
        subject: `Website: ${KIND_LABEL[kind]}`,
        body: notes,
        lead_id: lead.id,
      })
    } catch { /* ignore */ }

    // Optional alert email.
    const notifyTo = process.env.WEBSITE_LEAD_NOTIFY_EMAIL
    if (notifyTo && process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL ?? 'GateGuard <notifications@gateguard.co>',
            to: notifyTo.split(',').map(s => s.trim()).filter(Boolean),
            reply_to: email,
            subject: `New website lead — ${KIND_LABEL[kind]}: ${company || contactName}`,
            text: `${contactName}${title ? `, ${title}` : ''}\n${company}\n${email}${phone ? ` · ${phone}` : ''}\n\n${notes}\n\nOpen in Nexus: ${process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'}`,
          }),
        })
      } catch { /* ignore */ }
    }

    return NextResponse.json({ ok: true, id: lead.id })
  } catch (e) {
    console.error('website-lead error:', e)
    return NextResponse.json({ ok: false, error: 'server error' }, { status: 500 })
  }
}
