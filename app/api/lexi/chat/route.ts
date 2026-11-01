/**
 * POST /api/lexi/chat — Lexi, the Nexus AI assistant. Streams its reply.
 *
 * Body: { message: string, conversationId?: string, history?: {role, content}[] }
 * Response: newline-delimited JSON events —
 *   {type:'start', conversationId}        conversation id (null if history can't be saved yet)
 *   {type:'text', delta}                  reply text as it's written
 *   {type:'tool', name, label}            Lexi is looking something up
 *   {type:'cards', items}                 records found (deals, jobs, sites…) to show as cards
 *   {type:'did', ok, summary, message, revertPayload}   a low-risk action it already did (undoable)
 *   {type:'pending', action}              a medium/high-risk action waiting for the user's OK
 *   {type:'done', conversationId} | {type:'error', error}
 *
 * Reads go through lib/lexi/tools.ts (scoped to what the user can see).
 * Writes go through lib/assistant-executor.ts (scoped + undoable). Confirmed
 * actions run via /api/assistant/execute; undo via /api/assistant/revert.
 *
 * Phase 1: Gate Guard corporate only.
 * Phase 2: the Brain (company knowledge + personal memory, lib/lexi/brain.ts) is
 * added to the instructions on every message; remember / forget edit it.
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { executeToolWithRevert, isSignedIn, ALLOWED_TOOLS } from '@/lib/assistant-executor'
import { ACTION_TOOLS, TOOL_RISK_PROFILES, buildActionSummary } from '@/lib/assistant-tools'
import { READ_TOOLS, READ_TOOL_NAMES, TOOL_LABEL, lexiCtx, runReadTool, type LexiCard } from '@/lib/lexi/tools'
import { NEXUS_MAP } from '@/lib/lexi/nexus-guide'
import { BRAIN_TOOLS, BRAIN_TOOL_NAMES, brainPrompt, loadBrain, runBrainTool } from '@/lib/lexi/brain'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
// Sonnet does the thinking; Haiku does the cheap bits (conversation titles).
const MODEL = process.env.LEXI_MODEL || 'claude-sonnet-4-6'
const FAST_MODEL = process.env.LEXI_FAST_MODEL || 'claude-haiku-4-5-20251001'
const MAX_ROUNDS = 6
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function systemPrompt(name: string, role: string, brain: string) {
  const now = new Date()
  return `You are Lexi, the AI assistant inside Nexus — Gate Guard's operating system for a gate, access-control and camera company that sells to apartment communities.
You work for ${name} (${role}). Today is ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })}.

${NEXUS_MAP}

You are the expert on Nexus itself. For any "how do I / where is / what does this do" question about the software, call nexus_help and answer with clear steps (tab → button → what happens). Never guess at a button or screen that the guide doesn't mention.

How you work:
- Answer from real data. Use the read tools before answering anything about deals, jobs, sites, tasks, leads, customers, email, calendar or equipment. Never invent records, numbers or names. If a tool returns nothing, say so plainly.
- Do the work, don't just describe it. When the user asks you to create, update, assign, schedule or log something, call the action tool. Small things (tasks, notes, follow-ups) run right away and can be undone; bigger things (work orders, deals, leads, quotes, assigning techs, marking won/lost) wait for the user to tap Confirm — just say what you prepared.
- Always fill the "reasoning" field on actions with one short sentence.
- The records you find are shown to the user as cards under your reply, so don't repeat every field — summarize what matters and what to do next.
- Be brief and plain. Short paragraphs, a short list only when listing several things. No headings. End with the one most useful next step when there is one.
- Money: say "$12,400". Dates: say "Tue Nov 3", not ISO.
- Inbox: "who's waiting on me" → waiting_on_me. To reply, read the thread with get_thread, then write the draft in your answer under a line "Draft reply:" — short, in the user's own voice (match their style samples and any "voice" notes in the Brain). Offer to log it to the deal or set a follow-up.
- You can't yet send emails, text customers, place calls or open gates. If asked, say that's coming soon and offer what you can do now (draft the text, create a task).
- Memory: when the user states a lasting preference or fact, or says "remember…", save it with remember (one fact per call). Company-wide facts (pricing, policies, scripts) go to the shared Brain only when they clearly mean the whole team. When they correct a saved fact, forget the old one and remember the new one.
- Only discuss Gate Guard work. Be warm and confident, never chatty.

── The Brain ──
${brain}`
}

type Msg = Anthropic.MessageParam

// ── Prompt caching ───────────────────────────────────────────────────────────
// The tool list + instructions (~6.5k tokens) are identical on every round, and
// each round re-sends the whole conversation. Marking them cacheable makes the
// repeats ~10x cheaper (cache reads cost 10% of normal input). Max 4 marks per
// call: last tool, the instructions, and the newest message.
const EPHEMERAL = { type: 'ephemeral' } as const
function cachedTools(tools: Anthropic.Tool[]): Anthropic.Tool[] {
  return tools.map((t, i) => (i === tools.length - 1 ? ({ ...t, cache_control: EPHEMERAL } as Anthropic.Tool) : t))
}
function cachedMessages(msgs: Msg[]): Msg[] {
  if (!msgs.length) return msgs
  const last = msgs[msgs.length - 1]
  const blocks = typeof last.content === 'string' ? [{ type: 'text' as const, text: last.content }] : [...last.content]
  if (!blocks.length) return msgs
  blocks[blocks.length - 1] = { ...blocks[blocks.length - 1], cache_control: EPHEMERAL } as unknown as (typeof blocks)[number]
  return [...msgs.slice(0, -1), { ...last, content: blocks } as Msg]
}

async function makeTitle(text: string): Promise<string> {
  const fallback = text.replace(/\s+/g, ' ').trim().slice(0, 60)
  try {
    const r = await Promise.race([
      anthropic.messages.create({ model: FAST_MODEL, max_tokens: 24, messages: [{ role: 'user', content: `Write a 3-6 word title for a chat that starts with: "${text.slice(0, 400)}". Reply with the title only, no quotes.` }] }),
      new Promise<null>(res => setTimeout(() => res(null), 4000)),
    ])
    const t = r && 'content' in r ? r.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim().replace(/^["']|["']$/g, '') : ''
    return t ? t.slice(0, 80) : fallback
  } catch { return fallback }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!isSignedIn(user)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.isCorporate) return NextResponse.json({ error: 'Lexi is in early access for Gate Guard corporate.' }, { status: 403 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Lexi isn’t set up yet (missing ANTHROPIC_API_KEY).' }, { status: 503 })

  const body = await req.json().catch(() => ({}))
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 4000) : ''
  if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 })

  const [ctx, brain] = await Promise.all([lexiCtx(user), loadBrain(user)])
  if (brain.error) console.error('[lexi/chat] brain load failed:', brain.error)
  const brainText = brainPrompt(brain)
  const toolCtx = { user, scope: ctx.scope }

  // ── Conversation + history ────────────────────────────────────────────────
  let conversationId: string | null = typeof body?.conversationId === 'string' && UUID.test(body.conversationId) ? body.conversationId : null
  let history: Msg[] = []
  let isNew = false
  if (conversationId) {
    const { data: conv } = await sb.from('lexi_conversations').select('id').eq('id', conversationId).eq('user_id', user.id).maybeSingle()
    if (!conv) conversationId = null
    else {
      const { data: rows } = await sb.from('lexi_messages').select('role, content').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(20)
      history = ((rows ?? []) as { role: 'user' | 'assistant'; content: string }[]).reverse().filter(r => r.content).map(r => ({ role: r.role, content: r.content }))
    }
  }
  if (!conversationId) {
    const { data: conv, error } = await sb.from('lexi_conversations').insert({ user_id: user.id, org_id: user.org_id, title: null }).select('id').single()
    if (error) {
      // History can't be saved (e.g. migration 199 not run yet) — keep working with what the page sent.
      console.error('[lexi/chat] conversation insert failed:', error.message)
      const h = Array.isArray(body?.history) ? body.history : []
      history = h.slice(-12).filter((m: { role?: string; content?: unknown }) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content)
        .map((m: { role: 'user' | 'assistant'; content: string }) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    } else { conversationId = conv.id; isNew = true }
  }
  // Anthropic requires alternating roles starting with user.
  while (history.length && history[0].role !== 'user') history.shift()
  const merged: Msg[] = []
  for (const m of history) { if (merged.length && merged[merged.length - 1].role === m.role) merged[merged.length - 1] = m; else merged.push(m) }
  if (merged.length && merged[merged.length - 1].role === 'user') merged.pop()

  if (conversationId) {
    const { error } = await sb.from('lexi_messages').insert({ conversation_id: conversationId, role: 'user', content: message })
    if (error) console.error('[lexi/chat] save user message failed:', error.message)
  }

  const enc = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: Record<string, unknown>) => { try { controller.enqueue(enc.encode(JSON.stringify(o) + '\n')) } catch { /* client gone */ } }
      send({ type: 'start', conversationId })
      const messages: Msg[] = [...merged, { role: 'user', content: message }]
      let fullText = ''
      const cards: LexiCard[] = []
      const did: Record<string, unknown>[] = []
      let pending: Record<string, unknown> | null = null
      try {
        for (let round = 0; round < MAX_ROUNDS; round++) {
          const s = anthropic.messages.stream({
            model: MODEL,
            max_tokens: 1500,
            system: [{ type: 'text', text: systemPrompt(user.name, user.role, brainText), cache_control: EPHEMERAL }] as unknown as Anthropic.TextBlockParam[],
            tools: cachedTools([...READ_TOOLS, ...BRAIN_TOOLS, ...(pending ? [] : ACTION_TOOLS)]),
            messages: cachedMessages(messages),
          })
          s.on('text', (d: string) => { fullText += d; send({ type: 'text', delta: d }) })
          const final = await s.finalMessage()
          messages.push({ role: 'assistant', content: final.content })
          if (final.stop_reason !== 'tool_use') break

          const results: Anthropic.ToolResultBlockParam[] = []
          for (const block of final.content) {
            if (block.type !== 'tool_use') continue
            const args = (block.input ?? {}) as Record<string, unknown>
            if (READ_TOOL_NAMES.has(block.name)) {
              send({ type: 'tool', name: block.name, label: TOOL_LABEL[block.name] ?? 'Looking that up' })
              const out = await runReadTool(block.name, args, ctx)
              if (out.cards?.length) {
                const fresh = out.cards.filter(c => !cards.some(x => x.kind === c.kind && x.id === c.id))
                cards.push(...fresh)
                if (fresh.length) send({ type: 'cards', items: fresh })
              }
              results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(out.data).slice(0, 14000) })
            } else if (BRAIN_TOOL_NAMES.has(block.name)) {
              send({ type: 'tool', name: block.name, label: block.name === 'remember' ? 'Saving to the Brain' : 'Updating the Brain' })
              const r = await runBrainTool(block.name, args, user)
              const ev = { ok: r.ok, summary: r.summary, message: r.message, revertPayload: null }
              did.push(ev); send({ type: 'did', ...ev })
              results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(r), ...(r.ok ? {} : { is_error: true }) })
            } else if (ALLOWED_TOOLS.has(block.name)) {
              const risk = TOOL_RISK_PROFILES[block.name] ?? 'medium'
              const summary = buildActionSummary(block.name, args)
              if (risk === 'low' && !pending) {
                const r = await executeToolWithRevert(block.name, args, toolCtx)
                const ev = { ok: r.success, summary, message: r.message ?? r.error, revertPayload: r.revertPayload ?? null }
                did.push(ev); send({ type: 'did', ...ev })
                results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ success: r.success, message: r.message, error: r.error, id: r.id }) })
              } else if (!pending) {
                pending = { toolName: block.name, toolArgs: args, summary, reasoning: String(args.reasoning ?? ''), riskLevel: risk === 'low' ? 'medium' : risk }
                send({ type: 'pending', action: pending })
                results.push({ type: 'tool_result', tool_use_id: block.id, content: 'Prepared. It is waiting for the user to tap Confirm on screen — it has NOT happened yet. Tell them in one short sentence what you prepared.' })
              } else {
                results.push({ type: 'tool_result', tool_use_id: block.id, content: 'Only one action can wait for confirmation at a time. Ask the user to confirm the first one, then continue.', is_error: true })
              }
            } else {
              results.push({ type: 'tool_result', tool_use_id: block.id, content: `Unknown tool ${block.name}`, is_error: true })
            }
          }
          messages.push({ role: 'user', content: results })
        }

        if (conversationId) {
          const { error } = await sb.from('lexi_messages').insert({ conversation_id: conversationId, role: 'assistant', content: fullText, cards: { cards, did, pending } })
          if (error) console.error('[lexi/chat] save reply failed:', error.message)
          const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
          if (isNew) patch.title = await makeTitle(message)
          const { error: e2 } = await sb.from('lexi_conversations').update(patch).eq('id', conversationId).eq('user_id', user.id)
          if (e2) console.error('[lexi/chat] update conversation failed:', e2.message)
        }
        send({ type: 'done', conversationId })
      } catch (err) {
        const m = err instanceof Error ? err.message : 'Something went wrong.'
        console.error('[lexi/chat]', m)
        send({ type: 'error', error: /overloaded|529/i.test(m) ? 'Lexi is busy right now — try again in a moment.' : 'Lexi hit a problem answering that. Try again.' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' },
  })
}
