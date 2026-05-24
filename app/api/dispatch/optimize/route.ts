import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/dispatch/optimize — AI route optimization
export async function POST(_req: NextRequest) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  // 1. Fetch open/in-progress work orders with site addresses
  let woQuery = supabase
    .from('work_orders')
    .select(`
      id, title, customer_name, assignee_id, assignee_name, priority, status, site_id,
      sites!work_orders_site_id_fkey (name, address, city, state)
    `)
    .in('status', ['open', 'in_progress', 'scheduled'])
    .order('priority', { ascending: false })
    .limit(30)

  woQuery = applyOrgScope(woQuery, scope, 'org_id') as typeof woQuery

  const { data: wos, error: woErr } = await woQuery
  if (woErr) {
    // Fallback without site join on error
    return NextResponse.json({ suggestions: [], note: 'Could not fetch work orders' }, { status: 200 })
  }

  // 2. Fetch techs
  let techQuery = supabase
    .from('technicians')
    .select('id, name, status, current_job_id, org_id')
    .in('status', ['available', 'on_site', 'driving'])
    .limit(20)

  if (!scope.all && scope.ids.length > 0) {
    const idList = scope.ids.join(',')
    techQuery = (techQuery as any).or(`org_id.in.(${idList}),org_id.is.null`) as typeof techQuery
  }

  const { data: techs } = await techQuery

  // 3. Fetch latest tech location pings (last 4 hours)
  const techIds = (techs ?? []).map(t => t.id)
  const cutoff  = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  const locationMap = new Map<string, { lat: number; lng: number }>()

  if (techIds.length > 0) {
    const { data: pings } = await supabase
      .from('tech_location_pings')
      .select('technician_id, lat, lng, created_at')
      .in('technician_id', techIds)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })

    for (const ping of (pings ?? [])) {
      if (!locationMap.has(ping.technician_id)) {
        locationMap.set(ping.technician_id, { lat: Number(ping.lat), lng: Number(ping.lng) })
      }
    }
  }

  // 4. Build prompt data
  const techList = (techs ?? []).map(t => ({
    id:       t.id,
    name:     t.name,
    status:   t.status,
    location: locationMap.get(t.id) ?? null,
    active_jobs: (wos ?? []).filter(w => w.assignee_id === t.id).length,
  }))

  const woList = (wos ?? []).map(w => {
    const site = w.sites as any
    return {
      id:       w.id,
      title:    w.title,
      address:  site ? `${site.address ?? ''}, ${site.city ?? ''}, ${site.state ?? ''}`.trim().replace(/^,\s*/, '') : 'No address',
      priority: w.priority,
      status:   w.status,
      currently_assigned_to: w.assignee_name ?? 'Unassigned',
    }
  })

  const noTechGPS = techList.every(t => !t.location)

  const systemPrompt = `You are a dispatch optimizer for a field service company. 
Given technicians and their current locations (if available) plus open work orders with addresses, 
suggest the optimal tech→job assignment to minimize total drive time and balance workload.

If no GPS data is available, optimize purely by workload balance (fewest active jobs per tech).

Return ONLY a valid JSON array. No markdown, no explanation. Format:
[{ "wo_id": "...", "wo_title": "...", "assigned_tech_id": "...", "assigned_tech_name": "...", "reason": "...", "estimated_drive_mins": 0 }]

Only include assignments that improve efficiency. Skip jobs already efficiently assigned.`

  const userPrompt = `Technicians:
${JSON.stringify(techList, null, 2)}

Open Work Orders:
${JSON.stringify(woList, null, 2)}

${noTechGPS ? 'NOTE: No GPS data available — optimize by workload balance only.' : 'GPS data is available for some techs — use it to minimize drive time.'}

Return the JSON assignment suggestions array.`

  try {
    const client    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const response  = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages:   [{ role: 'user', content: userPrompt }],
      system:     systemPrompt,
    })

    const text = (response.content[0] as { type: string; text: string }).text.trim()

    // Parse — strip markdown fences if present
    const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const suggestions = JSON.parse(jsonText) as unknown[]

    return NextResponse.json({ suggestions, no_gps: noTechGPS })
  } catch (e) {
    return NextResponse.json({ suggestions: [], error: 'AI optimization failed: ' + String(e) }, { status: 200 })
  }
}
