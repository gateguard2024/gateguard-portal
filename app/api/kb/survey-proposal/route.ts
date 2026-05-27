/**
 * POST /api/kb/survey-proposal
 *
 * Takes a tech's site walk inventory and generates a structured SOW proposal
 * using Claude. Returns three clear sections:
 *   - What Is There  (categorized inventory with counts)
 *   - What Needs Work (devices needing service or replacement)
 *   - What to Expect  (scope, timeline, deliverables, outcomes)
 *
 * Also returns legacy line items, recommendations, urgent items, install notes.
 *
 * Auth: x-tech-code header
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic                      from '@anthropic-ai/sdk'
import { isTechAuthed }               from '@/lib/tech-auth'

export const maxDuration = 60
export const dynamic     = 'force-dynamic'

export interface SurveyDevice {
  id:        string
  name:      string
  brand:     string
  model:     string
  location:  string
  condition: 'good' | 'fair' | 'poor'
  action:    'keep' | 'service' | 'replace' | 'new_install'
  notes:     string
}

export interface ProposalLineItem {
  description: string
  qty:         number
  note:        string
  priority:    'urgent' | 'recommended' | 'optional'
}

// ─── SOW types ────────────────────────────────────────────────────────────────

export interface SowCategoryItem {
  label:     string   // "DoorKing 6050 @ Main Gate"
  condition: 'good' | 'fair' | 'poor'
  action:    string
}

export interface SowCategory {
  category:  string           // "Gate Operators", "Access Controllers", etc.
  count:     number
  items:     SowCategoryItem[]
}

export interface SowWorkItem {
  name:     string
  location: string
  action:   'service' | 'replace' | 'new_install'
  issue:    string
  priority: 'urgent' | 'recommended' | 'optional'
}

export interface SowExpectation {
  scope:        string
  timeline:     string
  deliverables: string[]
  outcomes:     string[]
}

export interface SurveyProposal {
  // SOW sections
  whatIsThere:  {
    categories:  SowCategory[]
    totalGates:  number
    totalDoors:  number
    totalDevices: number
    summary:     string   // "12 devices across 4 categories — 3 gates, 6 doors, 2 cameras"
  }
  whatNeedsWork: SowWorkItem[]
  whatToExpect:  SowExpectation

  // Existing fields (kept for compatibility)
  summary:         string
  lineItems:       ProposalLineItem[]
  recommendations: string[]
  urgentItems:     string[]
  installNotes:    string[]
}

// ─── Category classifier ──────────────────────────────────────────────────────

type CategoryKey =
  | 'Gate Operators'
  | 'Door Hardware'
  | 'Access Controllers'
  | 'Callboxes & Intercoms'
  | 'Cameras'
  | 'Safety Devices'
  | 'Network Equipment'
  | 'Keypads & Readers'
  | 'Other'

const GATE_KEYWORDS   = ['gate operator', 'gate', 'slide gate', 'swing gate', 'barrier arm', 'overhead gate', 'liftmaster', 'linear sw', 'viking g5', 'dk6050', 'dk9050', 'dk1600', 'sl3000']
const DOOR_KEYWORDS   = ['door strike', 'mag lock', 'electric strike', 'door controller', 'door hardware', 'strike', 'malock', 'door', 'mortise', 'rex sensor', 'request to exit']
const ACCESS_KEYWORDS = ['access controller', 'access control', 'access reader', 'brivo', 'acs300', 'acs6100', 'acs100', 'hid', 'access hub', 'credential', 'controller']
const BOX_KEYWORDS    = ['callbox', 'call box', 'intercom', 'video intercom', 'entry station', 'doorking', 'doorbell', 'call station', 'dk1835', 'dk2334', 'voip', 'g4 doorbell', 'g3 intercom']
const CAMERA_KEYWORDS = ['camera', 'ip camera', 'ptz', 'cctv', 'nvr', 'dvr', 'eagle eye', 'hikvision', 'dahua', 'axis', 'ubiquiti cam', 'g4 instant', 'g4 pro']
const SAFETY_KEYWORDS = ['photobeam', 'photo beam', 'loop detector', 'vehicle detector', 'safety edge', 'inductive loop', 'dk9409', 'dk9410', 'entrapment']
const NET_KEYWORDS    = ['switch', 'router', 'access point', 'unifi', 'ubiquiti', 'ucg', 'usw', 'wifi', 'network', 'poe', 'rack', 'fiber', 'nvr']
const KEYPAD_KEYWORDS = ['keypad', 'reader', 'prox reader', 'fob reader', 'card reader', 'pin pad', 'numpad']

function classifyDevice(name: string): CategoryKey {
  const n = name.toLowerCase()
  if (GATE_KEYWORDS.some(k => n.includes(k)))   return 'Gate Operators'
  if (BOX_KEYWORDS.some(k => n.includes(k)))    return 'Callboxes & Intercoms'
  if (ACCESS_KEYWORDS.some(k => n.includes(k))) return 'Access Controllers'
  if (CAMERA_KEYWORDS.some(k => n.includes(k))) return 'Cameras'
  if (SAFETY_KEYWORDS.some(k => n.includes(k))) return 'Safety Devices'
  if (KEYPAD_KEYWORDS.some(k => n.includes(k))) return 'Keypads & Readers'
  if (NET_KEYWORDS.some(k => n.includes(k)))    return 'Network Equipment'
  if (DOOR_KEYWORDS.some(k => n.includes(k)))   return 'Door Hardware'
  return 'Other'
}

function buildInventorySections(devices: SurveyDevice[]): SurveyProposal['whatIsThere'] {
  const map = new Map<CategoryKey, SowCategoryItem[]>()

  for (const d of devices) {
    const cat = classifyDevice(d.name)
    if (!map.has(cat)) map.set(cat, [])
    const label = [d.brand, d.model].filter(Boolean).join(' ') || d.name
    map.get(cat)!.push({
      label:     `${label}${d.location ? ` @ ${d.location}` : ''}`,
      condition: d.condition,
      action:    d.action,
    })
  }

  // Order categories sensibly
  const ORDER: CategoryKey[] = [
    'Gate Operators', 'Callboxes & Intercoms', 'Access Controllers',
    'Door Hardware', 'Safety Devices', 'Keypads & Readers',
    'Cameras', 'Network Equipment', 'Other',
  ]

  const categories: SowCategory[] = ORDER
    .filter(cat => map.has(cat))
    .map(cat => ({
      category: cat,
      count:    map.get(cat)!.length,
      items:    map.get(cat)!,
    }))

  const totalGates  = (map.get('Gate Operators') ?? []).length
  const totalDoors  = (map.get('Door Hardware') ?? []).length +
                      (map.get('Access Controllers') ?? []).length +
                      (map.get('Keypads & Readers') ?? []).length

  const parts: string[] = []
  if (totalGates)  parts.push(`${totalGates} gate${totalGates !== 1 ? 's' : ''}`)
  if (totalDoors)  parts.push(`${totalDoors} door${totalDoors !== 1 ? ' entry point' : ' entry points'}`)
  const camCount = (map.get('Cameras') ?? []).length
  if (camCount)    parts.push(`${camCount} camera${camCount !== 1 ? 's' : ''}`)

  const summary = `${devices.length} device${devices.length !== 1 ? 's' : ''} across ${categories.length} ${categories.length !== 1 ? 'categories' : 'category'}${parts.length ? ' — ' + parts.join(', ') : ''}`

  return { categories, totalGates, totalDoors, totalDevices: devices.length, summary }
}

function buildWorkItems(devices: SurveyDevice[]): SowWorkItem[] {
  return devices
    .filter(d => d.action === 'service' || d.action === 'replace' || d.action === 'new_install')
    .map(d => {
      let priority: 'urgent' | 'recommended' | 'optional' = 'recommended'
      if (d.condition === 'poor' || d.action === 'replace') priority = 'urgent'
      if (d.action === 'new_install') priority = 'optional'
      if (d.action === 'service' && d.condition === 'fair') priority = 'recommended'

      const issue = d.notes?.trim()
        || (d.action === 'replace'     ? `Unit requires replacement — condition: ${d.condition}` :
            d.action === 'service'     ? `Service required — condition: ${d.condition}` :
                                         'New installation required')

      return {
        name:     [d.brand, d.model].filter(Boolean).join(' ') || d.name,
        location: d.location || 'location not specified',
        action:   d.action as 'service' | 'replace' | 'new_install',
        issue,
        priority,
      }
    })
    // Sort: urgent first
    .sort((a, b) => {
      const rank = { urgent: 0, recommended: 1, optional: 2 }
      return rank[a.priority] - rank[b.priority]
    })
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!await isTechAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { propertyName, devices } = await req.json() as {
      propertyName: string
      devices:      SurveyDevice[]
    }

    if (!devices?.length) {
      return NextResponse.json({ error: 'No devices provided' }, { status: 400 })
    }

    // Pre-process: classify and count before hitting Claude
    const whatIsThere  = buildInventorySections(devices)
    const whatNeedsWork = buildWorkItems(devices)

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    // Build structured inventory text for Claude
    const inventoryText = whatIsThere.categories.map(cat => {
      const lines = [`${cat.category} (${cat.count}):`]
      cat.items.forEach(item => {
        lines.push(`  - ${item.label} [${item.condition} / ${item.action}]`)
      })
      return lines.join('\n')
    }).join('\n\n')

    const workText = whatNeedsWork.length
      ? whatNeedsWork.map(w => `  - ${w.name} @ ${w.location}: ${w.issue} → ${w.action} [${w.priority}]`).join('\n')
      : '  None identified.'

    const systemPrompt = `You are a GateGuard field technician assistant generating a professional site assessment and Statement of Work (SOW) for a multifamily access control property.

Your job is to produce specific, professional content a dealer can present directly to a property manager. Be concrete — no filler.

Rules:
- Urgent = safety hazard or system failure affecting access/egress
- Recommended = will degrade soon or significantly limits functionality
- Optional = value-add improvements
- Timeline estimates should be realistic for multifamily access control work
- Deliverables are tangible things the property manager will receive
- Outcomes describe what residents/property will experience after work is complete`

    const userPrompt = `Property: ${propertyName || 'Site'}
Total devices: ${devices.length}
Devices needing work: ${whatNeedsWork.length}

CATEGORIZED INVENTORY:
${inventoryText}

WORK ITEMS IDENTIFIED:
${workText}

Generate a site SOW proposal JSON with this exact structure — only valid JSON, no markdown:
{
  "summary": "2-3 sentence professional executive summary of the site assessment",
  "whatToExpect": {
    "scope": "1-2 sentence description of total scope of work",
    "timeline": "realistic project timeline (e.g. '2-3 days of on-site work, 1-week parts lead time')",
    "deliverables": ["deliverable 1", "deliverable 2", "..."],
    "outcomes": ["outcome 1 from resident/property perspective", "..."]
  },
  "lineItems": [
    {
      "description": "Specific work item or equipment",
      "qty": 1,
      "note": "Why needed",
      "priority": "urgent|recommended|optional"
    }
  ],
  "recommendations": ["Short strategic recommendation 1", "..."],
  "urgentItems": ["Item needing immediate attention — only truly urgent items"],
  "installNotes": ["Technician guidance 1", "..."]
}

Base line items on the work items list. Generate 3-5 deliverables and 2-4 outcomes. Only include urgentItems if truly safety-critical.`

    const msg = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1400,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    })

    const raw  = (msg.content[0] as { text: string }).text.trim()
    const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const ai   = JSON.parse(json)

    const proposal: SurveyProposal = {
      whatIsThere,
      whatNeedsWork,
      whatToExpect: ai.whatToExpect ?? {
        scope:        ai.summary ?? '',
        timeline:     'To be confirmed',
        deliverables: [],
        outcomes:     [],
      },
      summary:         ai.summary         ?? '',
      lineItems:       ai.lineItems        ?? [],
      recommendations: ai.recommendations ?? [],
      urgentItems:     ai.urgentItems      ?? [],
      installNotes:    ai.installNotes     ?? [],
    }

    return NextResponse.json({ ok: true, proposal })

  } catch (err: any) {
    console.error('[survey-proposal]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
