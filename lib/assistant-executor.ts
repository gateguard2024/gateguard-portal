import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { PortalUser } from '@/lib/current-user'
import { isInScope, type OrgScope } from '@/lib/org-scope'
import { getSiteBrivoToken, listBrivoDoors, unlockBrivoDoor } from '@/lib/brivo'
import { getAllowedVaultBrivoSite } from '@/lib/brivo-scope'
import { controlSiteShellyRelay, listSiteShellyRelays } from '@/lib/shelly'
import { dealCtx, dealVisible } from '@/lib/sales-deals'
import { canOperate } from '@/lib/system-access'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)


// Insert a row; if PostgREST says a column doesn't exist, drop that column and
// retry (same safety net /api/dispatch uses). Never drops a company column —
// a row written without its owner would leak or vanish.
async function insertSafe(table: string, row: Record<string, unknown>): Promise<{ data: { id: string } | null; error: { message: string } | null }> {
  const r = { ...row }
  for (let i = 0; i < 8; i++) {
    const { data, error } = await supabase.from(table).insert(r).select('id').single()
    if (!error) return { data: data as { id: string }, error: null }
    const m = /Could not find the '(\w+)' column|column "?(\w+)"? .* does not exist/.exec(error.message)
    const bad = m?.[1] || m?.[2]
    if (bad && bad in r && !['org_id', 'dealer_org_id', 'created_by'].includes(bad) && (error.code === 'PGRST204' || error.code === '42703')) { delete r[bad]; continue }
    return { data: null, error }
  }
  return { data: null, error: { message: 'Could not save.' } }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type RevertPayload =
  | { operation: 'delete'; table: string; id: string; exp?: number; sig?: string }
  | { operation: 'update'; table: string; id: string; data: Record<string, unknown>; exp?: number; sig?: string }

// ── Undo tokens ──────────────────────────────────────────────────────────────
// The undo payload goes to the browser and comes back. It is signed for this
// user with a short expiry, so a caller can only undo what they just did —
// never hand-craft "delete deal X" or "set rep_id = me".
const UNDO_TTL_MS = 10 * 60 * 1000
const undoSecret = () => process.env.ASSISTANT_UNDO_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-undo-secret'
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().map(k => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`
  return JSON.stringify(v ?? null)
}
function undoSig(p: RevertPayload, userId: string, exp: number) {
  const body = stable({ op: p.operation, table: p.table, id: p.id, data: p.operation === 'update' ? p.data : null, uid: userId, exp })
  return crypto.createHmac('sha256', undoSecret()).update(body).digest('base64url')
}
export function signRevert(p: RevertPayload, userId: string): RevertPayload {
  const exp = Date.now() + UNDO_TTL_MS
  return { ...p, exp, sig: undoSig(p, userId, exp) }
}
function revertSigOk(p: RevertPayload, userId: string): boolean {
  if (!p.sig || !p.exp || p.exp < Date.now()) return false
  const want = Buffer.from(undoSig(p, userId, p.exp)), got = Buffer.from(String(p.sig))
  return want.length === got.length && crypto.timingSafeEqual(want, got)
}

export interface ExecuteResult {
  success: boolean
  message?: string
  error?: string
  id?: string
  revertPayload?: RevertPayload
}

// ─── Main executor ───────────────────────────────────────────────────────────

// Physical actions are always written to the site timeline (who did what, when).
async function auditSystem(siteId: string, eventType: string, source: string, title: string, description: string, metadata: Record<string, unknown>) {
  const { error } = await supabase.from('site_events').insert({ site_id: siteId, event_type: eventType, event_source: source, title, description, summary: title, metadata })
  if (error) console.error('[assistant-executor] audit failed', eventType, error.message)
}

async function runTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ExecuteResult> {
  switch (toolName) {
    // ── Live systems (physical) — corporate admins only, site must be in scope,
    //    and the caller must be allowed to operate that system. Audited. ──
    case 'open_gate': {
      if (!(ctx.user.isCorporate && ctx.user.role === 'admin')) return { success: false, error: 'Only Gate Guard admins can open gates through Lexi.' }
      const siteId = String(args.site_id ?? ''), doorId = String(args.door_id ?? '')
      if (!siteId || !doorId) return { success: false, error: 'Which site and door?' }
      const site = await getAllowedVaultBrivoSite(ctx.user, siteId)
      if (!site) return { success: false, error: 'That site has no Brivo connection, or it’s outside your access.' }
      if (!(await canOperate(ctx.user, siteId, 'doors'))) return { success: false, error: 'You don’t have door access for this site.' }
      let doorName = 'Door'
      try {
        const { token, apiKey } = await getSiteBrivoToken(siteId)
        // Use the site's real door list — never the name the model typed.
        const door = (await listBrivoDoors(token, apiKey)).find(d => String(d.id) === doorId)
        if (!door) return { success: false, error: 'That door isn’t on this site’s Brivo account.' }
        doorName = door.name || 'Door'
        await unlockBrivoDoor(token, apiKey, doorId)
      } catch (e) { return { success: false, error: e instanceof Error ? e.message : 'Brivo didn’t open the door.' } }
      await auditSystem(siteId, 'door_unlock', 'brivo', `Door unlocked: ${doorName}`, `Unlocked by ${ctx.user.name} via Lexi`, { door_id: doorId, door_name: doorName, by_user_id: ctx.user.id, by_name: ctx.user.name, via: 'lexi' })
      return { success: true, message: `${doorName} is opening.` }
    }
    case 'relay_action': {
      if (!(ctx.user.isCorporate && ctx.user.role === 'admin')) return { success: false, error: 'Only Gate Guard admins can control relays through Lexi.' }
      const siteId = String(args.site_id ?? ''), deviceId = String(args.device_id ?? '')
      const channel = Math.max(0, Math.round(Number(args.channel) || 0))
      if (!siteId || !deviceId) return { success: false, error: 'Which site and relay?' }
      if (!(await canOperate(ctx.user, siteId, 'relays'))) return { success: false, error: 'You don’t have relay access for this site.' }
      const pulse = args.mode === 'pulse'
      const secs = pulse ? Math.min(10, Math.max(1, Number(args.seconds) || 1)) : Math.min(120, Math.max(5, Number(args.seconds) || 10))
      let relayName = 'Relay'
      try {
        // Only relays tagged for THIS site (Shelly accounts are shared across properties).
        const relay = (await listSiteShellyRelays(siteId)).find(r => r.id === deviceId && r.channel === channel)
        if (!relay) return { success: false, error: 'That relay isn’t on this site.' }
        relayName = relay.name || 'Relay'
        // pulse = ON for a moment (gate trigger); power-cycle = OFF for N seconds.
        // Shelly's own flip-back timer restores it, so nothing waits here.
        await controlSiteShellyRelay(siteId, deviceId, channel, pulse, secs)
      } catch (e) { return { success: false, error: e instanceof Error ? e.message : 'The relay didn’t respond.' } }
      await auditSystem(siteId, pulse ? 'relay_pulse' : 'relay_power_cycle', 'shelly', `${pulse ? 'Relay pulsed' : 'Power-cycled'}: ${relayName}`, `By ${ctx.user.name} via Lexi${pulse ? ` (on ${secs}s)` : ` (off ${secs}s)`}`, { device_id: deviceId, channel, seconds: secs, by_user_id: ctx.user.id, by_name: ctx.user.name, via: 'lexi' })
      return { success: true, message: pulse ? `${relayName} pulsed for ${secs} second${secs === 1 ? '' : 's'}.` : `${relayName} is off now and turns itself back on in ${secs} seconds.` }
    }


    // ── Todos ──────────────────────────────────────────────────────────────

    case 'create_todo': {
      const { data, error } = await insertSafe('todos', {
          title: args.title,
          due_date: args.due_date ?? null,
          priority: args.priority ?? 'normal',
          body: args.notes ?? null,          // the column is "body" (was "notes", which doesn't exist)
          status: 'open',
          created_by: ctx.user.id,           // required — was missing, so every create failed
          created_by_name: ctx.user.name,
          assigned_to: ctx.user.id,
          assigned_to_name: ctx.user.name,
          org_id: ctx.user.org_id,
          // Optional link to the record it's about (e.g. tasks from a recording).
          ...(typeof args.linked_type === 'string' && /^(opportunity|site|work_order|lead|customer)$/.test(args.linked_type) && typeof args.linked_id === 'string' && /^[0-9a-f-]{36}$/i.test(args.linked_id)
            ? { linked_type: args.linked_type, linked_id: args.linked_id, linked_label: typeof args.linked_label === 'string' ? args.linked_label.slice(0, 200) : null }
            : {}),
        })

      if (error) return { success: false, error: error.message }
      const id = (data as { id: string }).id
      return {
        success: true,
        message: `To-do "${args.title}" created.`,
        id,
        revertPayload: { operation: 'delete', table: 'todos', id },
      }
    }

    case 'update_todo': {
      const id = args.id as string
      const { data: existing, error: fetchError } = await supabase
        .from('todos')
        .select('title, due_date, priority, body, status')
        .eq('id', id)
        .single()

      if (fetchError) return { success: false, error: fetchError.message }

      // Only real columns (args also carry "reasoning", and "notes" maps to body).
      const updates: Record<string, unknown> = {}
      for (const k of ['title', 'due_date', 'priority', 'status'] as const) if (args[k] !== undefined) updates[k] = args[k]
      if (args.notes !== undefined) updates.body = args.notes
      if (!Object.keys(updates).length) return { success: false, error: 'Nothing to change.' }

      const { error } = await supabase.from('todos').update(updates).eq('id', id)
      if (error) return { success: false, error: error.message }

      return {
        success: true,
        message: 'To-do updated.',
        id,
        revertPayload: {
          operation: 'update',
          table: 'todos',
          id,
          data: existing as Record<string, unknown>,
        },
      }
    }

    case 'complete_todo': {
      const id = args.id as string
      const { data: existing, error: fetchError } = await supabase
        .from('todos')
        .select('status')
        .eq('id', id)
        .single()

      if (fetchError) return { success: false, error: fetchError.message }

      const prevStatus = (existing as { status: string }).status
      const { error } = await supabase.from('todos').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', id)
      if (error) return { success: false, error: error.message }

      return {
        success: true,
        message: 'To-do marked complete.',
        id,
        revertPayload: {
          operation: 'update',
          table: 'todos',
          id,
          data: { status: prevStatus, completed_at: null },
        },
      }
    }

    // ── Work Orders ────────────────────────────────────────────────────────

    case 'create_work_order': {
      const { data, error } = await insertSafe('work_orders', {
          title: args.title,
          priority: args.priority ?? 'normal',
          status: 'open',
          ...(args.property_name ? { property_name: args.property_name } : {}),
          ...(args.scheduled_date ? { scheduled_date: args.scheduled_date } : {}),
        })

      if (error) return { success: false, error: error.message }
      const id = (data as { id: string }).id
      return {
        success: true,
        message: `Work order "${args.title}" created.`,
        id,
        revertPayload: { operation: 'delete', table: 'work_orders', id },
      }
    }

    case 'reschedule_work_order': {
      const id = args.id as string
      const { data: existing, error: fetchError } = await supabase
        .from('work_orders')
        .select('scheduled_date')
        .eq('id', id)
        .single()

      if (fetchError) return { success: false, error: fetchError.message }

      const prevDate = (existing as { scheduled_date: string | null }).scheduled_date
      const { error } = await supabase
        .from('work_orders')
        .update({ scheduled_date: args.scheduled_date })
        .eq('id', id)

      if (error) return { success: false, error: error.message }

      return {
        success: true,
        message: `Work order rescheduled to ${args.scheduled_date}.`,
        id,
        revertPayload: {
          operation: 'update',
          table: 'work_orders',
          id,
          data: { scheduled_date: prevDate },
        },
      }
    }

    case 'update_work_order_status': {
      const id = args.id as string
      const { data: existing, error: fetchError } = await supabase
        .from('work_orders')
        .select('status')
        .eq('id', id)
        .single()

      if (fetchError) return { success: false, error: fetchError.message }

      const prevStatus = (existing as { status: string }).status
      const { error } = await supabase
        .from('work_orders')
        .update({ status: args.status })
        .eq('id', id)

      if (error) return { success: false, error: error.message }

      return {
        success: true,
        message: `Work order status updated to ${args.status}.`,
        id,
        revertPayload: {
          operation: 'update',
          table: 'work_orders',
          id,
          data: { status: prevStatus },
        },
      }
    }

    // ── Dispatch: Assign Technician ────────────────────────────────────────

    case 'assign_technician': {
      const id       = args.work_order_id as string
      const techId   = args.technician_id as string
      const techName = args.technician_name as string

      const { data: existing, error: fetchError } = await supabase
        .from('work_orders')
        .select('assignee_id, assignee_name, status')
        .eq('id', id)
        .single()

      if (fetchError) return { success: false, error: fetchError.message }

      const prev = existing as { assignee_id: string | null; assignee_name: string | null; status: string }

      const { error } = await supabase
        .from('work_orders')
        .update({ assignee_id: techId, assignee_name: techName, status: 'scheduled' })
        .eq('id', id)

      if (error) return { success: false, error: error.message }

      return {
        success: true,
        message: `${techName} assigned to work order.`,
        id,
        revertPayload: {
          operation: 'update',
          table: 'work_orders',
          id,
          data: {
            assignee_id:   prev.assignee_id   ?? null,
            assignee_name: prev.assignee_name ?? null,
            status:        prev.status,
          },
        },
      }
    }

    // ── CRM Leads ──────────────────────────────────────────────────────────

    case 'create_lead': {
      // leads.stage is the lead_stage enum: prospect|qualified|proposal|negotiation|won|lost.
      // Map common synonyms and fall back to 'prospect' so an unknown value never breaks the insert.
      const LEAD_STAGES = ['prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost']
      const rawStage = String(args.stage ?? '').toLowerCase().trim()
      const stage = LEAD_STAGES.includes(rawStage)
        ? rawStage
        : (rawStage === 'new' || rawStage === '' ? 'prospect' : 'prospect')
      const { data, error } = await insertSafe('leads', {
          contact_name: args.name,
          company_name: args.company ?? null,
          email: args.email ?? null,
          phone: args.phone ?? null,
          stage,
          source: 'nexus_ai',
          notes: args.notes ?? null,
        })

      if (error) return { success: false, error: error.message }
      const id = (data as { id: string }).id
      return {
        success: true,
        message: `Lead "${args.name}" created.`,
        id,
        revertPayload: { operation: 'delete', table: 'leads', id },
      }
    }

    case 'update_lead_stage': {
      const id = args.id as string
      const { data: existing, error: fetchError } = await supabase
        .from('leads')
        .select('stage')
        .eq('id', id)
        .single()

      if (fetchError) return { success: false, error: fetchError.message }

      const prevStage = (existing as { stage: string }).stage
      const { error } = await supabase
        .from('leads')
        .update({ stage: args.stage })
        .eq('id', id)

      if (error) return { success: false, error: error.message }

      return {
        success: true,
        message: `Lead stage updated to ${args.stage}.`,
        id,
        revertPayload: {
          operation: 'update',
          table: 'leads',
          id,
          data: { stage: prevStage },
        },
      }
    }

    case 'assign_lead': {
      const id = args.id as string
      const { data: existing, error: fetchError } = await supabase
        .from('leads')
        .select('assigned_to, assigned_to_name')
        .eq('id', id)
        .single()

      if (fetchError) return { success: false, error: fetchError.message }

      const prev = existing as { assigned_to: string | null; assigned_to_name: string | null }
      const { error } = await supabase
        .from('leads')
        .update({
          assigned_to: args.assigned_to,
          ...(args.assigned_to_name ? { assigned_to_name: args.assigned_to_name } : {}),
        })
        .eq('id', id)

      if (error) return { success: false, error: error.message }

      return {
        success: true,
        message: `Lead assigned to ${args.assigned_to_name ?? args.assigned_to}.`,
        id,
        revertPayload: {
          operation: 'update',
          table: 'leads',
          id,
          data: { assigned_to: prev.assigned_to, assigned_to_name: prev.assigned_to_name },
        },
      }
    }

    // ── CRM Opportunities ──────────────────────────────────────────────────

    case 'create_opportunity': {
      const { data, error } = await insertSafe('opportunities', {
          name: args.name,
          account_name: args.account_name,
          stage: args.stage ?? 'meet_present',
          ...(args.value !== undefined ? { amount: args.value } : {}),
          ...(args.notes ? { notes: args.notes } : {}),
        })

      if (error) return { success: false, error: error.message }
      const id = (data as { id: string }).id
      return {
        success: true,
        message: `Opportunity "${args.name}" created.`,
        id,
        revertPayload: { operation: 'delete', table: 'opportunities', id },
      }
    }

    case 'update_opportunity_stage': {
      const id = args.id as string
      if (args.stage === 'won' || args.stage === 'lost') return { success: false, error: 'Use “mark won” or “mark lost” for that — they need a confirmation.' }
      const { data: existing, error: fetchError } = await supabase
        .from('opportunities')
        .select('stage')
        .eq('id', id)
        .single()

      if (fetchError) return { success: false, error: fetchError.message }

      const prevStage = (existing as { stage: string }).stage
      const { error } = await supabase
        .from('opportunities')
        .update({ stage: args.stage })
        .eq('id', id)

      if (error) return { success: false, error: error.message }

      return {
        success: true,
        message: `Opportunity stage updated to ${args.stage}.`,
        id,
        revertPayload: {
          operation: 'update',
          table: 'opportunities',
          id,
          data: { stage: prevStage },
        },
      }
    }

    case 'mark_opportunity_won': {
      const id = args.id as string
      const { data: existing, error: fetchError } = await supabase
        .from('opportunities')
        .select('stage')
        .eq('id', id)
        .single()

      if (fetchError) return { success: false, error: fetchError.message }

      const prevStage = (existing as { stage: string }).stage
      const { error } = await supabase
        .from('opportunities')
        .update({ stage: 'won' })
        .eq('id', id)

      if (error) return { success: false, error: error.message }

      return {
        success: true,
        message: 'Opportunity marked as Won.',
        id,
        revertPayload: {
          operation: 'update',
          table: 'opportunities',
          id,
          data: { stage: prevStage },
        },
      }
    }

    case 'mark_opportunity_lost': {
      const id = args.id as string
      const { data: existing, error: fetchError } = await supabase
        .from('opportunities')
        .select('stage')
        .eq('id', id)
        .single()

      if (fetchError) return { success: false, error: fetchError.message }

      const prevStage = (existing as { stage: string }).stage
      const { error } = await supabase
        .from('opportunities')
        .update({ stage: 'lost' })
        .eq('id', id)

      if (error) return { success: false, error: error.message }

      return {
        success: true,
        message: 'Opportunity marked as Lost.',
        id,
        revertPayload: {
          operation: 'update',
          table: 'opportunities',
          id,
          data: { stage: prevStage },
        },
      }
    }

    // ── CRM Activities ─────────────────────────────────────────────────────

    case 'log_crm_activity': {
      const { data, error } = await insertSafe('crm_activities', {
          subject: args.subject,
          body: args.body ?? null,
          type: args.type ?? 'note',
          ...(args.lead_id ? { lead_id: args.lead_id } : {}),
          ...(args.opportunity_id ? { opportunity_id: args.opportunity_id } : {}),
          ...(args.due_at ? { due_at: args.due_at } : {}),
        })

      if (error) return { success: false, error: error.message }
      const id = (data as { id: string }).id
      return {
        success: true,
        message: `Activity "${args.subject}" logged.`,
        id,
        revertPayload: { operation: 'delete', table: 'crm_activities', id },
      }
    }

    case 'schedule_followup': {
      const dueAt = args.due_date ? `${args.due_date}T09:00:00` : null
      const { data, error } = await insertSafe('crm_activities', {
          subject: args.subject ?? 'Follow up',
          body: args.notes ?? null,
          type: 'task',
          ...(args.lead_id ? { lead_id: args.lead_id } : {}),
          ...(args.opportunity_id ? { opportunity_id: args.opportunity_id } : {}),
          ...(dueAt ? { due_at: dueAt } : {}),
        })

      if (error) return { success: false, error: error.message }
      const id = (data as { id: string }).id
      return {
        success: true,
        message: `Follow-up scheduled${dueAt ? ` for ${args.due_date}` : ''}.`,
        id,
        revertPayload: { operation: 'delete', table: 'crm_activities', id },
      }
    }

    // ── Quotes ─────────────────────────────────────────────────────────────

    case 'create_quote': {
      // Gate Guard sends partnership proposals, not plain quotes.
      const { data: ins, error } = await insertSafe('quotes', {
        title: args.title,
        account_name: args.account_name,
        property_name: args.account_name ?? null,
        quote_mode: 'partnership',
        status: 'draft',
      })
      if (error || !ins) return { success: false, error: error?.message ?? 'Could not create the proposal.' }
      const { data: qn } = await supabase.from('quotes').select('id, quote_number').eq('id', ins.id).maybeSingle()
      const row = (qn ?? { id: ins.id, quote_number: null }) as { id: string; quote_number: string | null }
      return {
        success: true,
        message: `Quote "${args.title}" created${row.quote_number ? ` (#${row.quote_number})` : ''}.`,
        id: row.id,
        revertPayload: { operation: 'delete', table: 'quotes', id: row.id },
      }
    }

    default:
      return { success: false, error: `Unknown tool: ${toolName}` }
  }
}

// ─── Revert helper ────────────────────────────────────────────────────────────

// ─── Security guard (Nov 2026) ──────────────────────────────────────────────
// Every caller passes who is acting. Before this, any signed-in (or anonymous)
// caller could update or delete ANY row in ANY table by id: the executor and the
// revert route trusted the tool args / revert payload completely.
//
//   • Only these tables can be touched, each with the column that says which
//     company owns the row.
//   • Updates / deletes / reverts first check the row is in the caller's scope.
//   • New rows are stamped with the caller's company (non-corporate users).

export interface ToolContext {
  user: PortalUser
  scope: OrgScope
}

const ORG_COL: Record<string, string> = {
  todos: 'org_id',
  work_orders: 'org_id',
  leads: 'org_id',
  opportunities: 'dealer_org_id',
  crm_activities: 'dealer_org_id',
  quotes: 'org_id',
}

// Tool → [table, id arg] for tools that change an existing row.
const TOOL_TARGET: Record<string, [string, string]> = {
  update_todo: ['todos', 'id'],
  complete_todo: ['todos', 'id'],
  reschedule_work_order: ['work_orders', 'id'],
  update_work_order_status: ['work_orders', 'id'],
  assign_technician: ['work_orders', 'work_order_id'],
  update_lead_stage: ['leads', 'id'],
  assign_lead: ['leads', 'id'],
  update_opportunity_stage: ['opportunities', 'id'],
  mark_opportunity_won: ['opportunities', 'id'],
  mark_opportunity_lost: ['opportunities', 'id'],
}

export const ALLOWED_TOOLS = new Set<string>([
  'create_todo', 'update_todo', 'complete_todo',
  'create_work_order', 'reschedule_work_order', 'update_work_order_status', 'assign_technician',
  'create_lead', 'update_lead_stage', 'assign_lead',
  'create_opportunity', 'update_opportunity_stage', 'mark_opportunity_won', 'mark_opportunity_lost',
  'log_crm_activity', 'schedule_followup', 'create_quote',
  'open_gate', 'relay_action',
])

/** Is this row inside the caller's company scope? Corporate always yes. */
export async function rowInScope(table: string, id: string, ctx: ToolContext): Promise<boolean> {
  const col = ORG_COL[table]
  if (!col || !id || !/^[0-9a-f-]{36}$/i.test(id)) return false
  if (table === 'opportunities') {
    // Deals follow the Sales rules: company scope, plus "reps see only their own".
    const { data, error } = await supabase.from('opportunities').select('id, dealer_org_id, rep_id').eq('id', id).maybeSingle()
    if (error || !data) return false
    return dealVisible(data as { dealer_org_id: string | null; rep_id: string | null }, await dealCtx(ctx.user))
  }
  if (ctx.scope.all) {
    // Corporate: still confirm the row exists.
    const { data, error } = await supabase.from(table).select('id').eq('id', id).maybeSingle()
    return !error && !!data
  }
  const { data, error } = await supabase.from(table).select(`id, ${col}`).eq('id', id).maybeSingle()
  if (error || !data) return false
  return isInScope(ctx.scope, (data as unknown as Record<string, unknown>)[col] as string | null)
}

export function isSignedIn(user: PortalUser): boolean {
  return !!user.id && user.id !== 'anonymous'
}

export async function executeToolWithRevert(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ExecuteResult> {
  if (!isSignedIn(ctx.user)) return { success: false, error: 'Not signed in.' }
  if (!ALLOWED_TOOLS.has(toolName)) return { success: false, error: `Unknown action "${toolName}".` }
  if (!ctx.user.isCorporate && !ctx.user.org_id) return { success: false, error: 'Your account isn’t linked to a company yet.' }

  const target = TOOL_TARGET[toolName]
  if (target) {
    const id = String(args[target[1]] ?? '')
    if (!(await rowInScope(target[0], id, ctx))) return { success: false, error: 'That record wasn’t found or isn’t yours to change.' }
  }
  // Records an action links to must be the caller's too (no notes on another company's deal).
  for (const [arg, table] of LINKED_ARGS) {
    const v = args[arg]
    if (v == null || v === '') continue
    if (!(await rowInScope(table, String(v), ctx))) return { success: false, error: 'A linked record wasn’t found or isn’t yours.' }
  }
  if (toolName === 'create_todo' && typeof args.linked_id === 'string' && args.linked_id) {
    const table = LINK_TYPE_TABLE[String(args.linked_type ?? '')]
    if (table && !(await rowInScope(table, args.linked_id, ctx))) return { success: false, error: 'The record this task links to wasn’t found or isn’t yours.' }
  }
  if (toolName === 'assign_technician' && args.technician_id && !ctx.scope.all) {
    const { data: tech, error } = await supabase.from('technicians').select('id, org_id').eq('id', String(args.technician_id)).maybeSingle()
    if (error || !tech || !isInScope(ctx.scope, (tech as { org_id: string | null }).org_id)) return { success: false, error: 'That technician isn’t on your team.' }
  }

  const result = await runTool(toolName, args, ctx)

  // Stamp new rows with the caller's company (corporate rows stay as before). If
  // that fails, remove the row — a record with no company is invisible to its owner.
  if (result.success && result.revertPayload?.operation === 'delete') {
    const { table, id } = result.revertPayload
    const col = ORG_COL[table]
    const stamp: Record<string, unknown> = {}
    if (col && ctx.user.org_id) stamp[col] = ctx.user.org_id
    if (table === 'opportunities') {
      const deals = await dealCtx(ctx.user)
      if (deals.profileId) {
        const { error } = await supabase.from('opportunities').update({ rep_id: deals.profileId }).eq('id', id).is('rep_id', null)
        if (error) console.error('[assistant-executor] rep stamp failed', error.message)
      }
    }
    if (Object.keys(stamp).length) {
      const { error } = await supabase.from(table).update(stamp).eq('id', id)
      if (error) {
        await supabase.from(table).delete().eq('id', id)
        return { success: false, error: `Couldn’t save it to your company (${error.message}).` }
      }
    }
  }
  if (result.success && result.revertPayload) result.revertPayload = signRevert(result.revertPayload, ctx.user.id)
  return result
}

const LINKED_ARGS: [string, string][] = [['opportunity_id', 'opportunities'], ['lead_id', 'leads']]
const LINK_TYPE_TABLE: Record<string, string> = { opportunity: 'opportunities', work_order: 'work_orders', lead: 'leads' }

export async function revertAction(
  payload: RevertPayload,
  ctx: ToolContext
): Promise<{ success: boolean; error?: string }> {
  if (!isSignedIn(ctx.user)) return { success: false, error: 'Not signed in.' }
  if (!ORG_COL[payload.table]) return { success: false, error: 'That can’t be undone here.' }
  if (!revertSigOk(payload, ctx.user.id)) return { success: false, error: 'That undo has expired.' }
  if (!(await rowInScope(payload.table, payload.id, ctx))) return { success: false, error: 'That record wasn’t found or isn’t yours.' }
  if (payload.operation === 'delete') {
    const { error } = await supabase
      .from(payload.table)
      .delete()
      .eq('id', payload.id)

    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  if (payload.operation === 'update') {
    const data = { ...(payload.data ?? {}) }
    for (const k of ['id', 'org_id', 'dealer_org_id', 'client_org_id', 'partner_org_id']) delete data[k]
    if (!Object.keys(data).length) return { success: false, error: 'Nothing to undo.' }
    const { error } = await supabase
      .from(payload.table)
      .update(data)
      .eq('id', payload.id)

    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  return { success: false, error: 'Unknown revert operation' }
}
