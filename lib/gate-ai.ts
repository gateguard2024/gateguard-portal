/**
 * lib/gate-ai.ts — SERVER ONLY. Looks at one gate in one camera frame and says
 * open / closed / partial / unclear, built to cope with odd and far camera angles:
 *
 *  1. Zoom in — crop the gate's outline (plus margin) out of the full-resolution
 *     frame and enlarge it, so a small far-away gate is as readable as a near one.
 *  2. Compare with THIS gate — every check is judged against pictures of this
 *     exact gate open and closed from this exact camera (taught in setup, and
 *     added to whenever someone marks a call wrong). No guessing from words.
 *  3. Quick check first — a tiny grayscale fingerprint of the close-up is
 *     compared to the taught pictures. A clear match costs nothing and needs no AI.
 *  4. Fast AI, then strong AI — anything unclear goes to Claude Haiku with the
 *     taught pictures; low-confidence answers go to Claude Sonnet.
 */
import sharp from 'sharp'
import Anthropic from '@anthropic-ai/sdk'

export type Pt = { x: number; y: number }
export type GateType = 'swing' | 'slide' | 'barrier_arm' | 'vertical_lift' | 'other'
export type Verdict = 'open' | 'closed' | 'partial' | 'unclear'
export type Method = 'quick' | 'fast_ai' | 'strong_ai'
export interface Ref { state: 'open' | 'closed'; image: string; sig: number[] }
export interface GateInfo { label: string; gate_type: GateType; region: Pt[] | null; notes?: string | null }
export interface CheckResult { verdict: Verdict; confidence: number; vehicle: boolean; reason: string; method: Method; crop: Buffer; sig: number[]; ms: number }

const FAST_MODEL = process.env.GATE_AI_FAST_MODEL || 'claude-haiku-4-5-20251001'
const STRONG_MODEL = process.env.GATE_AI_STRONG_MODEL || 'claude-sonnet-4-6'
const SIG_W = 64, SIG_H = 36

// ── Image work ───────────────────────────────────────────────────────────────
/** Bounding box of the outline (0–1), padded 25% so the gate's swing room is in view. */
function box(region: Pt[] | null, W: number, H: number) {
  if (!region || region.length < 3) return { left: 0, top: 0, width: W, height: H }
  const xs = region.map(p => p.x), ys = region.map(p => p.y)
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const px = (x1 - x0) * 0.25 + 0.02, py = (y1 - y0) * 0.25 + 0.02
  x0 = Math.max(0, x0 - px); x1 = Math.min(1, x1 + px); y0 = Math.max(0, y0 - py); y1 = Math.min(1, y1 + py)
  const left = Math.floor(x0 * W), top = Math.floor(y0 * H)
  return { left, top, width: Math.max(16, Math.min(W - left, Math.ceil((x1 - x0) * W))), height: Math.max(16, Math.min(H - top, Math.ceil((y1 - y0) * H))) }
}

/** The gate close-up: cropped, enlarged to ~640 px on the long side, lightly sharpened. */
export async function cropGate(frame: Buffer, region: Pt[] | null): Promise<Buffer> {
  const img = sharp(frame).rotate()
  const m = await img.metadata()
  const W = m.width ?? 1280, H = m.height ?? 720
  return img.extract(box(region, W, H)).resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: false, kernel: 'lanczos3' }).sharpen().jpeg({ quality: 85 }).toBuffer()
}

/** Full frame scaled down with the gate outlined — context so the AI knows which gate it's looking at. */
export async function contextFrame(frame: Buffer, region: Pt[] | null): Promise<Buffer> {
  const base = sharp(frame).rotate().resize({ width: 960, height: 960, fit: 'inside' })
  const m = await base.clone().metadata()
  const out = await base.jpeg({ quality: 70 }).toBuffer()
  if (!region || region.length < 3) return out
  const om = await sharp(out).metadata()
  const W = om.width ?? m.width ?? 960, H = om.height ?? m.height ?? 540
  const pts = region.map(p => `${Math.round(p.x * W)},${Math.round(p.y * H)}`).join(' ')
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><polygon points="${pts}" fill="none" stroke="#FFD60A" stroke-width="4"/></svg>`)
  return sharp(out).composite([{ input: svg, top: 0, left: 0 }]).jpeg({ quality: 70 }).toBuffer()
}

/** Fingerprint of the gate's SHAPE: edge strength (where the bars, posts and panel lines are) on a
 * 64×36 grid, normalised. Edges ignore overall brightness, so dusk / night-grey still match,
 * and thin gate bars stand out instead of blurring away. */
export async function signature(img: Buffer): Promise<number[]> {
  const W = SIG_W, H = SIG_H
  const g = await sharp(img).greyscale().blur(0.6).resize(W, H, { fit: 'fill' }).normalise().raw().toBuffer()
  const v: number[] = new Array(W * H).fill(0)
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x
    const gx = g[i + 1] - g[i - 1], gy = g[i + W] - g[i - W]
    v[i] = Math.sqrt(gx * gx + gy * gy)
  }
  const mean = v.reduce((a, b) => a + b, 0) / v.length
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length) || 1
  return v.map(x => Math.round(((x - mean) / sd) * 1000) / 1000)
}
/** Correlation of two fingerprints: 1 = identical, ~0 = unrelated. */
export function similarity(a: number[], b: number[]): number {
  if (!a?.length || a.length !== b?.length) return 0
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s / a.length
}

/** Free check: a clear match to one taught state and a clear miss on the other. Null = ask the AI. */
export function quickVerdict(sig: number[], refs: Pick<Ref, 'state' | 'sig'>[]): { verdict: 'open' | 'closed'; confidence: number; closed: number; open: number } | null {
  const best = (s: 'open' | 'closed') => Math.max(-1, ...refs.filter(r => r.state === s).map(r => similarity(sig, r.sig)))
  const closed = best('closed'), open = best('open')
  if (closed <= -1 || open <= -1) return null                // needs both kinds taught
  const top = Math.max(closed, open), gap = Math.abs(closed - open)
  if (top < 0.9 || gap < 0.12) return null
  return { verdict: closed > open ? 'closed' : 'open', confidence: Math.min(97, Math.round(72 + gap * 120)), closed, open }
}

// ── AI ───────────────────────────────────────────────────────────────────────
const TYPE_HINT: Record<GateType, string> = {
  swing: 'Swing gate: panel(s) rotate on hinges. CLOSED = bars/panel span across the lane. OPEN = panel folded back to the side and the lane is clear.',
  slide: 'Slide gate: panel rolls sideways on a track. CLOSED = panel spans the full opening. OPEN = panel stacked to one side, opening clear.',
  barrier_arm: 'Barrier arm: a bar pivots at one end. CLOSED = arm lies across the lane (near horizontal). OPEN = arm raised (45–90°).',
  vertical_lift: 'Vertical lift: panel rises straight up. CLOSED = panel at ground level across the lane. OPEN = panel overhead, lane clear.',
  other: 'Judge by whether the lane is blocked (closed) or clear to drive through (open).',
}
const REPORT_TOOL: Anthropic.Tool = {
  name: 'report_gate',
  description: 'Report the state of the gate in the close-up.',
  input_schema: {
    type: 'object',
    properties: {
      state: { type: 'string', enum: ['open', 'closed', 'partial', 'unclear'], description: 'open = lane clear; closed = lane blocked; partial = part-way or moving; unclear = can’t tell (dark, glare, blocked view, camera moved).' },
      confidence: { type: 'integer', minimum: 0, maximum: 100 },
      vehicle_in_gate: { type: 'boolean', description: 'A vehicle or person is in the gate opening right now.' },
      reason: { type: 'string', description: 'One short sentence: what you see that decides it.' },
    },
    required: ['state', 'confidence', 'vehicle_in_gate', 'reason'],
  },
}

let client: Anthropic | null = null
const ai = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }))
const img = (b64: string): Anthropic.ImageBlockParam => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } })

/** Pick up to `n` taught pictures per state, preferring the most recent and feedback-corrected ones. */
export function pickRefs(refs: (Ref & { source?: string; created_at?: string })[], n = 2): Ref[] {
  const out: Ref[] = []
  for (const s of ['closed', 'open'] as const) {
    out.push(...refs.filter(r => r.state === s).sort((a, b) => (b.source === 'feedback' ? 1 : 0) - (a.source === 'feedback' ? 1 : 0) || String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))).slice(0, n))
  }
  return out
}

export async function askAI(model: string, gate: GateInfo, crop: Buffer, context: Buffer, refs: Ref[]): Promise<{ verdict: Verdict; confidence: number; vehicle: boolean; reason: string }> {
  const content: Anthropic.MessageParam['content'] = []
  const taught = refs.length > 0
  if (taught) {
    content.push({ type: 'text', text: `Reference pictures of "${gate.label}" from this same camera. They are the ground truth for what open and closed look like here:` })
    for (const r of refs) { content.push({ type: 'text', text: `Reference — ${r.state.toUpperCase()}:` }); content.push(img(r.image)) }
  }
  content.push({ type: 'text', text: 'Full camera view right now, with the gate outlined in yellow:' })
  content.push(img(context.toString('base64')))
  content.push({ type: 'text', text: 'Close-up of the gate right now — judge this one:' })
  content.push(img(crop.toString('base64')))
  content.push({ type: 'text', text: [
    `Is "${gate.label}" open or closed right now?`,
    TYPE_HINT[gate.gate_type] ?? TYPE_HINT.other,
    gate.notes ? `Installer's note about this gate: ${gate.notes}` : '',
    taught ? 'Compare the close-up with the reference pictures above — match the panel position, not lighting, weather, shadows or vehicles.' : 'No reference pictures yet — be conservative; say unclear rather than guess.',
    'A vehicle near the gate does not make it open. Night / infrared images are gray — still judge the panel position.',
    'Use the report_gate tool.',
  ].filter(Boolean).join('\n') })
  const msg = await ai().messages.create({
    model, max_tokens: 300, temperature: 0,
    system: 'You check whether one vehicle gate at an apartment community is open or closed from a security camera. Odd angles, fisheye lenses, glare and night infrared are common. Be precise; say unclear when you truly cannot tell.',
    tools: [REPORT_TOOL], tool_choice: { type: 'tool', name: 'report_gate' },
    messages: [{ role: 'user', content }],
  })
  const t = msg.content.find(c => c.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
  const r = (t?.input ?? {}) as { state?: string; confidence?: number; vehicle_in_gate?: boolean; reason?: string }
  const verdict = (['open', 'closed', 'partial', 'unclear'].includes(String(r.state)) ? r.state : 'unclear') as Verdict
  return { verdict, confidence: Math.max(0, Math.min(100, Math.round(Number(r.confidence) || 0))), vehicle: !!r.vehicle_in_gate, reason: String(r.reason ?? '').slice(0, 300) }
}

/**
 * Judge one gate in one frame. `expect` = the gate's current settled state, used to
 * spend the strong model only where it matters (a low-confidence or state-changing call).
 */
export async function judgeGate(frame: Buffer, gate: GateInfo, refs: (Ref & { source?: string; created_at?: string })[], expect?: 'open' | 'closed' | null, opts?: { allowQuick?: boolean }): Promise<CheckResult> {
  const t0 = Date.now()
  const crop = await cropGate(frame, gate.region)
  const sig = await signature(crop)
  if (opts?.allowQuick !== false) {
    const q = quickVerdict(sig, refs)
    if (q) return { verdict: q.verdict, confidence: q.confidence, vehicle: false, reason: `Matches the taught ${q.verdict} picture (${Math.round(Math.max(q.closed, q.open) * 100)}% alike).`, method: 'quick', crop, sig, ms: Date.now() - t0 }
  }
  const context = await contextFrame(frame, gate.region)
  const chosen = pickRefs(refs)
  let r = await askAI(FAST_MODEL, gate, crop, context, chosen)
  let method: Method = 'fast_ai'
  const changing = !!expect && (r.verdict === 'open' || r.verdict === 'closed') && r.verdict !== expect
  if (r.confidence < 80 || r.verdict === 'unclear' || r.verdict === 'partial' || (changing && r.confidence < 92)) {
    try { r = await askAI(STRONG_MODEL, gate, crop, context, pickRefs(refs, 3)); method = 'strong_ai' } catch { /* keep the fast answer */ }
  }
  return { ...r, method, crop, sig, ms: Date.now() - t0 }
}
