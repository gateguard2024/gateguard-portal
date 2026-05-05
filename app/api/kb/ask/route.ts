/**
 * POST /api/kb/ask
 *
 * AI diagnostic engine — vector search + Claude step generator.
 * Supports step types: question, action, measure, select, photo, resolved, escalate
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth }                       from '@clerk/nextjs/server'
import Anthropic                      from '@anthropic-ai/sdk'
import { searchKnowledge, serviceDb } from '@/lib/vectorize'

export const maxDuration = 60   // Vercel Pro: up to 60s. Prevents silent timeout at step 3-4.
export const dynamic     = 'force-dynamic'

function isTechAuthed(req: NextRequest): boolean {
  const code      = req.headers.get('x-tech-code')
  const validCode = process.env.TECH_ACCESS_CODE
  return !!(validCode && code && code === validCode)
}

export async function POST(req: NextRequest) {
  const techOk = isTechAuthed(req)
  let userId: string | null = null
  if (!techOk) {
    try { const s = await auth(); userId = s.userId } catch { /* no clerk session */ }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { symptom, product_id, error_code, history = [], session_id, connected_devices = [] } = await req.json()
    if (!symptom) return NextResponse.json({ error: 'symptom required' }, { status: 400 })

    const db  = serviceDb()
    const historyLen = (history as any[]).length

    // 1. Chunks — cached on step 2+, fresh search on step 1
    //    Step 1 embeds the symptom and runs pgvector search (slowest path).
    //    Steps 2+ pull the same chunks from DB by ID — no OpenAI embedding call,
    //    no pgvector scan, ~10x faster. This is what fixes the step-4 stall.
    let chunks: Awaited<ReturnType<typeof searchKnowledge>> = []

    if (session_id && historyLen > 0) {
      // Fast path: reuse cached chunks from this session
      const { data: sess } = await db
        .from('troubleshoot_sessions')
        .select('chunks_used')
        .eq('id', session_id)
        .single()

      const chunkIds: string[] = sess?.chunks_used ?? []
      if (chunkIds.length > 0) {
        const { data: rows } = await db
          .from('manual_chunks')
          .select('id, product_id, content, manual_url, page_number, section_title')
          .in('id', chunkIds.slice(0, 5))

        chunks = (rows ?? []).map((c: any) => ({
          source:        'manual' as const,
          id:            c.id,
          product_id:    c.product_id,
          product_name:  '',
          product_sku:   '',
          manual_url:    c.manual_url,
          page_number:   c.page_number,
          section_title: c.section_title,
          content:       c.content,
          similarity:    0.85,
        }))
      }

      // If session had no chunks (e.g. no manual), fall through to a lightweight search
      if (chunks.length === 0) {
        chunks = await searchKnowledge(symptom, product_id, 3, 0.40)
      }
    } else {
      // Step 1: full vector search
      const recentContext = (history as any[]).slice(-2)
        .map((h: any) => `${h.question} → ${h.answer}`).join('; ')
      const searchQuery = [symptom, error_code, recentContext].filter(Boolean).join('. ')
      chunks = await searchKnowledge(searchQuery, product_id, 6, 0.40)
    }

    // 2. Manual context string
    const context = chunks.length > 0
      ? chunks.map((c, i) =>
          `[${i + 1}] ${c.source === 'manual' ? `${c.product_name || 'Device'} manual` : 'KB article'}` +
          `${c.page_number ? ` p.${c.page_number}` : ''}` +
          `${c.section_title ? ` — ${c.section_title}` : ''}\n${c.content}`
        ).join('\n\n---\n\n')
      : 'No specific manual content found — use general field troubleshooting knowledge.'

    // 3. History text — only include last 6 steps to keep prompt tight on long sessions
    const recentHistory = (history as any[]).slice(-6)
    const historyText = recentHistory.length > 0
      ? '\n\nDiagnostic history:\n' +
        recentHistory.map((h: any, i: number) =>
          `Step ${(history as any[]).length - recentHistory.length + i + 1}: "${h.question}" → ${h.answer}`
        ).join('\n')
      : ''

    // 4. Claude — fewer tokens needed on later steps (step instructions are short)
    const maxTokens = historyLen >= 3 ? 450 : 600
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system: `You are GateGuard's field diagnostic AI for dealers and technicians servicing multifamily access control equipment.
You have real manual passages below. Use them for specific part names, terminal labels, LED colors, error codes, and voltage specs.

Respond ONLY with valid JSON — no prose, no markdown fences. Exact schema:
{
  "type": "question" | "action" | "measure" | "select" | "photo" | "resolved" | "escalate",
  "text": "string — the step instruction (max 120 chars, shown on mobile)",
  "detail": "string or null — extra context, wiring notes, what to look for",
  "unit": "string or null — measurement unit for measure steps (VAC, VDC, Ω, mA, ms)",
  "expected": "string or null — expected value/range for measure steps (e.g. '115±10', '>12', '0')",
  "choices": ["string"] or null,
  "manual_ref": { "url": "string or null", "page": number or null, "section": "string or null" }
}

Step types:
  question  → single yes/no check
  action    → specific physical action to perform
  measure   → record a measurement — always include unit + expected value/range
  select    → multiple choice (2-4 options) when yes/no is insufficient
  photo     → ask tech to photograph something specific for visual analysis
  resolved  → root cause found and fix confirmed
  escalate  → requires factory support, board replacement, or RMA

SYSTEM TOPOLOGY — devices in gate/access systems connect to each other. Reason about the full system, not just the reported device.

KNOWN TERMINAL MAPS — use these specific labels whenever the device is being diagnosed, regardless of whether the manual passages below mention them:

DoorKing 6050 Traffic Arm Operator:
  J1 (AC Power — ELECTRICIAN ONLY): L (Hot 120VAC), N (Neutral), G (Ground/Earth)
  J2 (Control Inputs — dry contact N.O. to COM): OPEN, COM, CLOSE, STOP, FE (Free Exit / Request to Exit)
  J3 (Accessory Power output): +12V (12VDC out), GND
  J4 (Gate Status Relay — closed when gate is open): S-COM, S-NO
  Key notes: OPEN and CLOSE trigger the arm direction; STOP halts mid-travel; FE triggers exit open without loop; bridge OPEN to COM via pushbutton or relay

DoorKing 9050 Vehicular Barrier:
  P3 (Control): OPEN, CLOSE, STOP, COMMON (dry contact N.O. to COMMON)
  P4 (Safety/Obstruction): SAFETY IN (+), SAFETY IN (-) — NC loop from photobeam
  P6 (Status Relay): STATUS COM, STATUS N.O., STATUS N.C.
  P7 (Accessory Power): 12VDC, GND

DoorKing 1835 Callbox:
  TB1 (Gate relay output): COM, N.O. — wires to operator OPEN/COM
  TB2 (Door strike relay): COM, N.O.
  TB3 (Power input): 16-26VAC or 12-24VDC

Brivo ACS300 / ACS6100 Access Controller:
  Reader port: D0, D1, LED, BUZ, GND, +12V (Wiegand 26-bit)
  Lock relay: COM, N.O., N.C.
  REX input: REX, GND (N.O. button to GND)
  Door contact: DOOR, GND (N.C. loop)
  Power: 12VDC in, GND

LiftMaster SL3000 Slide Gate Operator:
  J3 (Control): OPEN, CLOSE, STOP, COMMON
  J4 (Safety): EDGE (safety edge), SHADOW (loop), ENTRAP (entrapment loop)
  J5 (Accessories): +12V, GND

Gate Operators (swing, slide, barrier):
  Safety inputs: photobeams (obstruction), pneumatic/resistive safety edges, loop detectors
  Control inputs: push-button, keypad, access reader relay, callbox relay output
  KEY FAILURE PATTERN: photobeam broken/misaligned → safety input held open → gate won't move or reverses
  KEY FAILURE PATTERN: loop detector fault → constant trigger or no trigger on vehicle loop
  ISOLATION TEST: jumper the safety/obstruction input terminals → if gate now works, root cause is the safety device NOT the operator
  Always check safety inputs BEFORE suspecting the operator board

Photobeams / Safety Beams:
  Alignment: TX LED solid on, RX LED solid green = aligned. RX flashing = misaligned or blocked
  Power: 12VDC or 24VDC from operator AUX power terminals
  Output type: normally-closed (NC) dry contact — opens on beam break, closes when clear
  Isolation test: disconnect beam wires from operator, manually jumper obstruction terminals → gate should run
  Wiring: NC loop into the operator obstruction/safety terminal pair

Loop Detectors:
  Sensitivity too high → detects nearby parked cars → holds gate open continuously
  Loop shorted or open → detector fault LED → gate stuck open or won't trigger
  LEDs: solid = vehicle present, off = clear, flashing = loop fault
  Test loop: disconnect loop wires from detector, measure inductance (good loop = 50–500 µH)

Callboxes / Intercoms:
  Gate relay output wires to operator push-button terminals
  Stuck relay → gate self-triggers on every call or continuously
  Isolation test: disconnect callbox relay wires → verify self-triggering stops

Access Readers / Keypads:
  Relay output wires to operator push-button (trigger) terminals
  Stuck relay = gate triggers on every credential or continuously
  Isolation test: disconnect reader relay → gate should stop self-triggering

FUNDAMENTAL FIRST STEPS — MANDATORY ORDER:
When diagnostic history is empty (first step of a new session), ALWAYS follow this order before any device-specific testing:
  STEP 1 — POWER: "Does the device have power?" Verify supply voltage at the device terminals (measure step with expected range). No power = fix power before anything else. Do NOT skip this.
  STEP 2 — WIRING INTEGRITY: "Inspect all wiring connections at the device." Are any wires loose, disconnected, corroded, or damaged? Have the tech visually check every terminal on the device. Loose wires cause 40%+ of reported faults.
  STEP 3 — OBVIOUS PHYSICAL: Any visible damage, burnt smell, moisture, or indicator LEDs showing fault state?
  Only AFTER these three fundamentals are confirmed normal should you proceed to device-specific or system-level diagnosis.

DIAGNOSTIC STRATEGY for systems with connected_devices listed:
  1. ALWAYS start with the fundamentals above (power, wiring, physical) — even for complex symptoms
  2. Ask tech which other devices are in the system if not specified
  3. ISOLATE inputs one by one — jumper or disconnect each safety/control input to find which one is causing the fault
  4. Once the root-cause device is confirmed, shift the diagnostic to that device specifically
  5. Confirm fix by reconnecting and retesting the full system

EASY BEFORE COMPLEX — always progress in this order:
  1. Power present? (measure)
  2. Wiring secure and undamaged? (action/photo)
  3. Status LEDs — what are they showing? (question/select)
  4. Safety/obstruction inputs — are they clear? (question/action)
  5. Control inputs — are they triggering correctly? (question/measure)
  6. Configuration settings — DIP switches, limits, sensitivity (action)
  7. Mechanical — springs, tracks, limits, physical obstructions (action)
  8. Board/component failure — only after all above are ruled out (escalate)
  Never jump to step 4+ without confirming steps 1-2 first.

Rules:
  - ONE step at a time
  - NEVER start with a complex or specific test when a basic check (power, wiring) has not yet been confirmed
  - When history is empty: ALWAYS start with power verification
  - When history has 1 step: ALWAYS check wiring integrity next unless power was the problem
  - When connected_devices are present, check them as likely root causes before blaming the primary device
  - Always guide isolation testing (jumper/disconnect) when a safety circuit is suspect
  - Use exact terminal names, LED labels, and error codes from EITHER the manual passages OR the KNOWN TERMINAL MAPS in the SYSTEM TOPOLOGY section — always cite the specific label (e.g. "OPEN terminal", "FE terminal", "J2 pin 3") rather than saying "check the terminals"
  - Prefer measure when voltage/resistance would confirm or rule out a cause
  - Prefer select when there are distinct observable states (LED colors, switch positions)
  - Use photo when visual evidence (damage, alignment, display) would help
  - Keep "text" under 120 chars; put wiring detail in "detail"
  - Set manual_ref whenever citing a specific manual passage

CRITICAL — VOLTAGE AND MEASUREMENT ACCURACY:
  - This restriction applies ONLY to measurement values (voltage ranges, resistance values, current specs) in measure steps — NOT to terminal names, LED labels, or error codes.
  - For measure steps, voltage/resistance/current values MUST come from the manual content provided above.
  - The SYSTEM TOPOLOGY section gives generic guidance only — NEVER use its generic voltage values (e.g. "12VDC from AUX") as the expected range in a measure step unless no manual content exists for this device.
  - If the manual content above contains the spec (e.g. "24VDC", "115VAC ±10%", "12VDC"), use that exact value as the expected range.
  - If no manual content mentions the specific spec, set expected to null and use detail to tell the tech where to find it (e.g. "See nameplate on device or check spec sheet for rated input voltage").
  - HOWEVER: terminal labels from the KNOWN TERMINAL MAPS (J2: OPEN, COM, CLOSE, STOP, FE, etc.) MUST always be cited — never say "check terminals" when the label is in the map above.
  - Wrong voltage ranges in the field cause real damage — accuracy matters more than speed here.`,

      messages: [{
        role: 'user',
        content: `Problem: "${symptom}"${error_code ? `\nError code: ${error_code}` : ''}${
          (connected_devices as string[]).length > 0
            ? `\nConnected devices in this system: ${(connected_devices as string[]).join(', ')}`
            : ''
        }
Steps completed so far: ${(history as any[]).length === 0 ? 'NONE — this is step 1. You MUST start with power verification.' : (history as any[]).length === 1 ? '1 step done. If power was confirmed OK, your next step MUST be wiring inspection.' : `${(history as any[]).length} steps done.`}
${historyText}

Relevant manual/KB content:\n${context}\n\nWhat is the next diagnostic step?`
      }],
    })

    const raw   = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error(`No JSON in Claude response: ${raw.slice(0, 200)}`)

    const step = JSON.parse(match[0])

    // Fill manual_ref from top chunk if Claude didn't set one
    if (!step.manual_ref?.url && chunks[0]?.manual_url) {
      step.manual_ref = {
        url:     chunks[0].manual_url,
        page:    chunks[0].page_number,
        section: chunks[0].section_title,
      }
    }

    // 5. Log session
    let sid = session_id

    if (!sid) {
      const { data } = await db.from('troubleshoot_sessions')
        .insert({
          product_id:  product_id ?? null,
          user_id:     userId,
          symptom,
          error_code:  error_code ?? null,
          chunks_used: chunks.map(c => c.id),
        })
        .select('id').single()
      sid = data?.id
    }

    return NextResponse.json({ ...step, session_id: sid })

  } catch (err: any) {
    console.error('[kb/ask]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
