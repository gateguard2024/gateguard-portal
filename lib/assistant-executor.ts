import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

export async function executeToolWithRevert(
  toolName: string,
  args: Record<string, unknown>
): Promise<ExecuteResult> {
  switch (toolName) {

    // ── Todos ──────────────────────────────────────────────────────────────

    case 'create_todo': {
      const { data, error } = await supabase
        .from('todos')
        .insert({
          title: args.title,
          due_date: args.due_date ?? null,
          priority: args.priority ?? 'medium',
          notes: args.notes ?? null,
          status: 'open',
        })
        .select('id')
        .single()

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
        .select('title, due_date, priority, notes, status')
        .eq('id', id)
        .single()

      if (fetchError) return { success: false, error: fetchError.message }

      const { id: _id, ...updates } = args
      void _id // consumed above

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
      const { error } = await supabase.from('todos').update({ status: 'done' }).eq('id', id)
      if (error) return { success: false, error: error.message }

      return {
        success: true,
        message: 'To-do marked complete.',
        id,
        revertPayload: {
          operation: 'update',
          table: 'todos',
          id,
          data: { status: prevStatus },
        },
      }
    }

    // ── Work Orders ────────────────────────────────────────────────────────

    case 'create_work_order': {
      const { data, error } = await supabase
        .from('work_orders')
        .insert({
          title: args.title,
          priority: args.priority ?? 'normal',
          status: 'open',
          ...(args.property_name ? { property_name: args.property_name } : {}),
          ...(args.scheduled_date ? { scheduled_date: args.scheduled_date } : {}),
        })
        .select('id')
        .single()

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

    // ── CRM Leads ──────────────────────────────────────────────────────────

    case 'create_lead': {
      const { data, error } = await supabase
        .from('crm_leads')
        .insert({
          name: args.name,
          company: args.company ?? null,
          email: args.email ?? null,
          phone: args.phone ?? null,
          stage: args.stage ?? 'new',
          source: 'nexus_ai',
          notes: args.notes ?? null,
        })
        .select('id')
        .single()

      if (error) return { success: false, error: error.message }
      const id = (data as { id: string }).id
      return {
        success: true,
        message: `Lead "${args.name}" created.`,
        id,
        revertPayload: { operation: 'delete', table: 'crm_leads', id },
      }
    }

    case 'update_lead_stage': {
      const id = args.id as string
      const { data: existing, error: fetchError } = await supabase
        .from('crm_leads')
        .select('stage')
        .eq('id', id)
        .single()

      if (fetchError) return { success: false, error: fetchError.message }

      const prevStage = (existing as { stage: string }).stage
      const { error } = await supabase
        .from('crm_leads')
        .update({ stage: args.stage })
        .eq('id', id)

      if (error) return { success: false, error: error.message }

      return {
        success: true,
        message: `Lead stage updated to ${args.stage}.`,
        id,
        revertPayload: {
          operation: 'update',
          table: 'crm_leads',
          id,
          data: { stage: prevStage },
        },
      }
    }

    case 'assign_lead': {
      const id = args.id as string
      const { data: existing, error: fetchError } = await supabase
        .from('crm_leads')
        .select('assigned_to, assigned_to_name')
        .eq('id', id)
        .single()

      if (fetchError) return { success: false, error: fetchError.message }

      const prev = existing as { assigned_to: string | null; assigned_to_name: string | null }
      const { error } = await supabase
        .from('crm_leads')
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
          table: 'crm_leads',
          id,
          data: { assigned_to: prev.assigned_to, assigned_to_name: prev.assigned_to_name },
        },
      }
    }

    // ── CRM Opportunities ──────────────────────────────────────────────────

    case 'create_opportunity': {
      const { data, error } = await supabase
        .from('crm_opportunities')
        .insert({
          name: args.name,
          account_name: args.account_name,
          stage: args.stage ?? 'prospect',
          ...(args.value !== undefined ? { value: args.value } : {}),
          ...(args.notes ? { notes: args.notes } : {}),
        })
        .select('id')
        .single()

      if (error) return { success: false, error: error.message }
      const id = (data as { id: string }).id
      return {
        success: true,
        message: `Opportunity "${args.name}" created.`,
        id,
        revertPayload: { operation: 'delete', table: 'crm_opportunities', id },
      }
    }

    case 'update_opportunity_stage': {
      const id = args.id as string
      const { data: existing, error: fetchError } = await supabase
        .from('crm_opportunities')
        .select('stage')
        .eq('id', id)
        .single()

      if (fetchError) return { success: false, error: fetchError.message }

      const prevStage = (existing as { stage: string }).stage
      const { error } = await supabase
        .from('crm_opportunities')
        .update({ stage: args.stage })
        .eq('id', id)

      if (error) return { success: false, error: error.message }

      return {
        success: true,
        message: `Opportunity stage updated to ${args.stage}.`,
        id,
        revertPayload: {
          operation: 'update',
          table: 'crm_opportunities',
          id,
          data: { stage: prevStage },
        },
      }
    }

    case 'mark_opportunity_won': {
      const id = args.id as string
      const { data: existing, error: fetchError } = await supabase
        .from('crm_opportunities')
        .select('stage')
        .eq('id', id)
        .single()

      if (fetchError) return { success: false, error: fetchError.message }

      const prevStage = (existing as { stage: string }).stage
      const { error } = await supabase
        .from('crm_opportunities')
        .update({ stage: 'won' })
        .eq('id', id)

      if (error) return { success: false, error: error.message }

      return {
        success: true,
        message: 'Opportunity marked as Won.',
        id,
        revertPayload: {
          operation: 'update',
          table: 'crm_opportunities',
          id,
          data: { stage: prevStage },
        },
      }
    }

    case 'mark_opportunity_lost': {
      const id = args.id as string
      const { data: existing, error: fetchError } = await supabase
        .from('crm_opportunities')
        .select('stage')
        .eq('id', id)
        .single()

      if (fetchError) return { success: false, error: fetchError.message }

      const prevStage = (existing as { stage: string }).stage
      const { error } = await supabase
        .from('crm_opportunities')
        .update({ stage: 'lost' })
        .eq('id', id)

      if (error) return { success: false, error: error.message }

      return {
        success: true,
        message: 'Opportunity marked as Lost.',
        id,
        revertPayload: {
          operation: 'update',
          table: 'crm_opportunities',
          id,
          data: { stage: prevStage },
        },
      }
    }

    // ── CRM Activities ─────────────────────────────────────────────────────

    case 'log_crm_activity': {
      const { data, error } = await supabase
        .from('crm_activities')
        .insert({
          subject: args.subject,
          body: args.body ?? null,
          type: args.type ?? 'note',
          ...(args.lead_id ? { lead_id: args.lead_id } : {}),
          ...(args.opportunity_id ? { opportunity_id: args.opportunity_id } : {}),
          ...(args.due_at ? { due_at: args.due_at } : {}),
        })
        .select('id')
        .single()

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
      const { data, error } = await supabase
        .from('crm_activities')
        .insert({
          subject: args.subject ?? 'Follow up',
          body: args.notes ?? null,
          type: 'task',
          ...(args.lead_id ? { lead_id: args.lead_id } : {}),
          ...(args.opportunity_id ? { opportunity_id: args.opportunity_id } : {}),
          ...(dueAt ? { due_at: dueAt } : {}),
        })
        .select('id')
        .single()

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
      const { data, error } = await supabase
        .from('quotes')
        .insert({
          title: args.title,
          account_name: args.account_name,
          status: 'draft',
        })
        .select('id, quote_number')
        .single()

      if (error) return { success: false, error: error.message }
      const row = data as { id: string; quote_number: string | null }
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

export async function revertAction(
  payload: RevertPayload
): Promise<{ success: boolean; error?: string }> {
  if (payload.operation === 'delete') {
    const { error } = await supabase
      .from(payload.table)
      .delete()
      .eq('id', payload.id)

    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  if (payload.operation === 'update') {
    const { error } = await supabase
      .from(payload.table)
      .update(payload.data)
      .eq('id', payload.id)

    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  return { success: false, error: 'Unknown revert operation' }
}
