/**
 * POST /api/surveys/[id]/generate-record — AI drafts the Pre-Proposal Survey record
 * from a short description + the uploaded site photos (the cowork workflow).
 *
 * Claude Sonnet (vision) reasons over the photos and the rep's blurb to produce:
 *   - devices[]  (so openings / area records / scope schedule populate), with each
 *                photo assigned to the device it shows
 *   - exec summary, scope/method/hardware/head-end/video notes
 *   - ranked priority findings, open items, and recommendations
 * The result is merged into surveys.devices + surveys.survey_doc (EXIF photo_meta,
 * cover + aerial preserved). Body: { description? }.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const MAX_PHOTOS = 10

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function imageBlock(url: string): Promise<any | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || 'image/jpeg'
    const media = /png/.test(ct) ? 'image/png' : /webp/.test(ct) ? 'image/webp' : 'image/jpeg'
    const b64 = Buffer.from(await res.arrayBuffer()).toString('base64')
    return { type: 'image', source: { type: 'base64', media_type: media, data: b64 } }
  } catch { return null }
}

function extractJson(text: string): Record<string, unknown> | null {
  const a = text.indexOf('{'); const b = text.lastIndexOf('}')
  if (a < 0 || b <= a) return null
  try { return JSON.parse(text.slice(a, b + 1)) } catch { return null }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  const scope = await resolveOrgScope(user)
  const body = await req.json().catch(() => ({}))

  const { data: survey } = await supabase.from('surveys').select('*').eq('id', params.id).single()
  if (!survey) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!user.isCorporate && !scope.ids.includes(survey.org_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI not configured (ANTHROPIC_API_KEY).' }, { status: 503 })

  const doc = (survey.survey_doc && typeof survey.survey_doc === 'object') ? survey.survey_doc : {}
  const description = String(body.description || survey.notes_raw || '').trim()
  // Site photos: editor-uploaded site photos + any existing device photos.
  const sitePhotos: string[] = Array.isArray(doc.site_photos) ? doc.site_photos : []
  const devicePhotos: string[] = (Array.isArray(survey.devices) ? survey.devices : []).flatMap((d: { photos?: string[] }) => Array.isArray(d.photos) ? d.photos : [])
  const photos = Array.from(new Set([...sitePhotos, ...devicePhotos])).slice(0, MAX_PHOTOS)

  if (!description && photos.length === 0) {
    return NextResponse.json({ error: 'Add a description or upload site photos first.' }, { status: 400 })
  }

  const blocks = (await Promise.all(photos.map(imageBlock))).filter(Boolean)

  const prompt = `You are a GateGuard field surveyor writing a Pre-Proposal Survey for an apartment community's gate, access-control and amenity openings. Use the rep's notes and the attached site photos (PHOTO 1..${photos.length}, in order) to document conditions AS FOUND — factual, specific, no sales language.

PROPERTY: ${survey.property_name || ''} ${survey.property_address ? '· ' + survey.property_address : ''}
REP NOTES:
${description || '(none)'}

Return STRICT JSON only (no prose, no markdown) with this exact shape:
{
  "devices": [ { "name": "Gate A operator", "brand": "DoorKing", "model": "", "location": "Gate A", "condition": "Good|Fair|Poor|", "action": "Keep|Service|Replace|New Install|", "notes": "what you see", "photo_indexes": [1,2] } ],
  "exec_summary": "2-4 sentence plain summary of what's working and what isn't",
  "scope_note": "", "method_note": "", "hardware_note": "", "headend_note": "", "video_note": "",
  "facts": [ { "label": "Vehicle entrances", "value": "3" }, { "label": "Working entrances", "value": "0" } ],
  "priority_findings": [ { "title": "", "detail": "", "priority": "HIGH|MEDIUM|LOW" } ],
  "open_items": [ { "item": "", "why": "", "owner": "Property|GateGuard|Property · GateGuard" } ],
  "recommendations": [ { "title": "", "detail": "", "owner": "GateGuard", "priority": "HIGH|MEDIUM|LOW" } ]
}

Rules:
- Create one device per real opening/piece of equipment implied by the notes or visible in the photos (gates, operators, barrier arms, callboxes, readers, pool gate, gym door, cameras). Group by a clear "location" (e.g. "Gate A", "Pool", "Gym").
- "photo_indexes" are the 1-based PHOTO numbers that show that device. Omit if none.
- condition Poor / action Replace or New Install => that opening is non-working.
- Only state what the notes or photos support. If unknown, leave blank or note "not verified". Do not invent brands or counts you can't see.`

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  let parsed: Record<string, unknown> | null = null
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3200,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, ...blocks] }],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textOut = (msg.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n')
    parsed = extractJson(textOut)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'AI generation failed.' }, { status: 502 })
  }
  if (!parsed) return NextResponse.json({ error: 'AI returned no usable result.' }, { status: 502 })

  // Map AI devices → our device shape, assigning photo URLs from photo_indexes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aiDevices: any[] = Array.isArray(parsed.devices) ? parsed.devices : []
  const devices = aiDevices.map((d, i) => ({
    id: `ai-${Date.now()}-${i}`,
    name: String(d.name || 'Device'),
    brand: String(d.brand || ''),
    model: String(d.model || ''),
    location: String(d.location || ''),
    condition: ['Good', 'Fair', 'Poor'].includes(d.condition) ? d.condition : '',
    action: ['Keep', 'Service', 'Replace', 'New Install'].includes(d.action) ? d.action : '',
    notes: String(d.notes || ''),
    photos: (Array.isArray(d.photo_indexes) ? d.photo_indexes : []).map((n: number) => photos[Number(n) - 1]).filter(Boolean),
  }))

  // Merge narrative fields into survey_doc; keep cover/aerial/photo_meta/site_photos.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pick = (k: string): any => parsed![k]
  const newDoc = {
    ...doc,
    exec_summary: pick('exec_summary') || doc.exec_summary || '',
    scope_note: pick('scope_note') || doc.scope_note,
    method_note: pick('method_note') || doc.method_note,
    hardware_note: pick('hardware_note') || doc.hardware_note,
    headend_note: pick('headend_note') || doc.headend_note,
    video_note: pick('video_note') || doc.video_note,
    facts: Array.isArray(pick('facts')) && pick('facts').length ? pick('facts') : doc.facts,
    priority_findings: Array.isArray(pick('priority_findings')) ? pick('priority_findings').map((f: Record<string, unknown>, i: number) => ({ ref: `F${i + 1}`, title: f.title, detail: f.detail, priority: String(f.priority || 'MEDIUM').toUpperCase() })) : doc.priority_findings,
    open_items: Array.isArray(pick('open_items')) ? pick('open_items').map((o: Record<string, unknown>, i: number) => ({ ref: `O${String(i + 1).padStart(2, '0')}`, item: o.item, why: o.why, owner: o.owner })) : doc.open_items,
    recommendations: Array.isArray(pick('recommendations')) ? pick('recommendations').map((r: Record<string, unknown>, i: number) => ({ ref: `R${i + 1}`, title: r.title, detail: r.detail, owner: r.owner, priority: String(r.priority || 'MEDIUM').toUpperCase() })) : doc.recommendations,
  }

  const patch: Record<string, unknown> = { survey_doc: newDoc, updated_at: new Date().toISOString() }
  if (devices.length) patch.devices = devices

  const { data: updated, error } = await supabase.from('surveys').update(patch).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ survey: updated, devices_created: devices.length })
}
