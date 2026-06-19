/**
 * POST /api/kb/procedure — generate a full guided INSTALL or SERVICE/PM
 * procedure for a device, from its manual passages + terminal map.
 * Reuses the same retrieval the diagnostic engine uses (no new data).
 *
 * Body: { product_id, mode: 'install' | 'service', device_name? }
 * Auth: x-tech-code (field tool) OR Clerk.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth }                     from '@clerk/nextjs/server'
import Anthropic                    from '@anthropic-ai/sdk'
import { isTechAuthed }             from '@/lib/tech-auth'
import { searchKnowledge, serviceDb } from '@/lib/vectorize'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (!(await isTechAuthed(req))) {
    let userId: string | null = null
    try { const s = await auth(); userId = s.userId } catch { /* no clerk */ }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { product_id, mode = 'install', device_name } = await req.json()
    const isInstall = mode !== 'service'
    const db = serviceDb()

    // Retrieval: terminal map + relevant manual passages (reuse the KB)
    const query = isInstall
      ? 'installation mounting wiring power connection configuration commissioning setup'
      : 'maintenance preventive service inspection lubrication testing safety device adjustment'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chunks: any[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let term: any = null
    try {
      const [c, t] = await Promise.all([
        product_id ? searchKnowledge(query, product_id, 8, 0.30) : Promise.resolve([]),
        product_id ? db.from('device_suggestions').select('device_def').eq('product_id', product_id).neq('status', 'rejected').maybeSingle() : Promise.resolve({ data: null }),
      ])
      chunks = c as any[]; term = (t as { data: unknown })?.data ?? null
    } catch { /* retrieval optional */ }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context = chunks.map((c: any) => `[p.${c.page_number} ${c.section_title ?? ''}] ${c.content}`).join('\n\n').slice(0, 9000)
    const terminalJson = term?.device_def ? JSON.stringify(term.device_def).slice(0, 2500) : 'none'

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const m = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      system: `You write field procedures for a security gate / access-control installer app, for NOVICE techs (about 5th-grade reading level). Use short, plain sentences and ONE action per step. The first time you use a technical word, add a plain meaning in parentheses. Use the EXACT terminal/LED labels from the terminal map when wiring.

Write a ${isInstall ? 'complete INSTALL (from box to commissioned)' : 'SERVICE / preventive-maintenance (PM)'} procedure.

Respond ONLY with valid JSON (no prose, no fences):
{
  "title": "string",
  "est_total_minutes": number,
  "tools": ["string"],
  "parts": ["string"],
  "ppe": ["string"],
  "grouped_safety": [ { "level":"DANGER"|"WARNING"|"CAUTION"|"NOTICE", "hazard":"", "consequence":"", "avoidance":"" } ],
  "steps": [ {
    "n": number, "title": "short", "instruction": "one action, plain words",
    "detail": "string or null — wiring/terminal notes",
    "spec_callouts": [ { "kind":"torque"|"gauge"|"voltage"|"distance"|"setting", "value":"", "unit":"" } ] or null,
    "safety": [ { "level":"DANGER"|"WARNING"|"CAUTION"|"NOTICE", "hazard":"", "consequence":"", "avoidance":"" } ] or null,
    "verification": "string — how to confirm this step is done right"
  } ],
  "definition_of_done": ["string"]
}
Rules:
- ${isInstall ? 'Order: prep → mount → wire → power → configure/commission → test. The LAST steps and definition_of_done MUST include the UL 325 safety test: trip the photo eye / safety edge while closing and confirm the gate stops or reverses within 2 seconds, and confirm two entrapment-protection means per zone.' : 'Include: visual inspection checklist, measurements with expected ranges, lubrication/cleaning, and a monthly safety-device test (break the photo-eye beam mid-close → must stop/reverse).'}
- Any step with live power or spring tension MUST carry a DANGER/WARNING safety item telling the tech to lock out power / restrain the spring FIRST.
- 8–16 steps. Be specific to this device when the manual content allows; otherwise give correct general gate/access practice.`,
      messages: [{ role: 'user', content: `Device: ${device_name || 'gate/access device'}\n\nTerminal map: ${terminalJson}\n\nManual passages:\n${context || 'none available — use correct general practice'}\n\nWrite the ${isInstall ? 'install' : 'service/PM'} procedure.` }],
    })

    const raw = m.content[0]?.type === 'text' ? m.content[0].text : '{}'
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in procedure response')
    const procedure = JSON.parse(match[0])
    procedure.mode = isInstall ? 'install' : 'service'
    return NextResponse.json({ procedure })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown' }, { status: 500 })
  }
}
