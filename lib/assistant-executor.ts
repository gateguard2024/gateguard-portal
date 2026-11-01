import { createClient } from '@supabase/supabase-js'
import type { PortalUser } from '@/lib/current-user'
import { isInScope, type OrgScope } from '@/lib/org-scope'

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
  | { operation: 'delete'; table: string; id: string }
  | { operation: 'update'; table: string; id: string; data: Record<string, unknown> }

export interface ExecuteResult {
  success: boolean
  message?: string
  error?: string
  id?: string
  revertPayload?: RevertPayload
}

// ─── Main executor ───────────────────────────────────────────────────────────

async function runTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ExecuteResult> {
  switch (toolName) {

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
])

/** Is this row inside the caller's company scope? Corporate always yes. */
export async function rowInScope(table: string, id: string, ctx: ToolContext): Promise<boolean> {
  const col = ORG_COL[table]
  if (!col || !id) return false
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

  const result = await runTool(toolName, args, ctx)

  // Stamp new rows with the caller's company (corporate rows stay as before).
  if (result.success && result.revertPayload?.operation === 'delete' && ctx.user.org_id) {
    const col = ORG_COL[result.revertPayload.table]
    if (col) {
      const { error } = await supabase.from(result.revertPayload.table).update({ [col]: ctx.user.org_id }).eq('id', result.revertPayload.id)
      if (error) console.error('[assistant-executor] org stamp failed', result.revertPayload.table, error.message)
    }
  }
  return result
}

export async function revertAction(
  payload: RevertPayload,
  ctx: ToolContext
): Promise<{ success: boolean; error?: string }> {
  if (!isSignedIn(ctx.user)) return { success: false, error: 'Not signed in.' }
  if (!ORG_COL[payload.table]) return { success: false, error: 'That can’t be undone here.' }
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
