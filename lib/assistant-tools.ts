/**
 * Shared action-tool definitions for the Nexus assistants (the floating
 * assistant at /api/assistant/chat and Lexi at /api/lexi/chat).
 * Moved here unchanged from app/api/assistant/chat/route.ts so both use one
 * list. Writes go through lib/assistant-executor.ts (scoped + undoable).
 */
import type Anthropic from '@anthropic-ai/sdk'

export const TOOL_RISK_PROFILES: Record<string, 'low' | 'medium' | 'high'> = {
  // Low — auto-execute, show undo toast
  create_todo: 'low',
  update_todo: 'low',
  complete_todo: 'low',
  log_crm_activity: 'low',
  schedule_followup: 'low',
  // Medium — show confirmation card
  create_work_order: 'medium',
  reschedule_work_order: 'medium',
  update_work_order_status: 'medium',
  create_lead: 'medium',
  update_lead_stage: 'medium',
  assign_lead: 'medium',
  create_opportunity: 'medium',
  update_opportunity_stage: 'medium',
  create_quote: 'medium',
  // High — confirmation card with red/amber warning
  assign_technician: 'high',
  mark_opportunity_won: 'high',
  mark_opportunity_lost: 'high',
  open_gate: 'high',
  relay_action: 'high',
}

// ─── Action summary builder ─────────────────────────────────────────────────
export function buildActionSummary(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'create_todo':          return `Create to-do: "${args.title}"`
    case 'update_todo':          return `Update to-do`
    case 'complete_todo':        return `Mark to-do as done`
    case 'assign_technician':    return `Assign ${args.technician_name} to work order`
    case 'reschedule_work_order':return `Reschedule work order to ${args.scheduled_date}`
    case 'update_work_order_status': return `Set work order status → ${args.status}`
    case 'create_work_order':    return `Create work order: "${args.title}"`
    case 'create_lead':          return `Create lead: ${args.name}${args.company ? ` · ${args.company}` : ''}`
    case 'update_lead_stage':    return `Move lead to "${args.stage}" stage`
    case 'assign_lead':          return `Assign lead to ${args.assigned_to_name}`
    case 'create_opportunity':   return `Create opportunity: "${args.name}"`
    case 'update_opportunity_stage': return `Move opportunity to "${args.stage}" stage`
    case 'mark_opportunity_won': return `Mark opportunity as WON 🎉`
    case 'mark_opportunity_lost':return `Mark opportunity as LOST`
    case 'log_crm_activity':     return `Log ${args.type ?? 'activity'}: "${args.subject}"`
    case 'schedule_followup':    return `Schedule follow-up for ${args.due_date ?? 'open date'}`
    case 'create_quote':         return `Create quote: "${args.title}" for ${args.account_name}`
    case 'open_gate':            return `Open "${args.door_name ?? 'gate'}" now`
    case 'relay_action':         return args.mode === 'pulse' ? `Pulse relay "${args.relay_name ?? 'relay'}"` : `Power-cycle "${args.relay_name ?? 'relay'}" (off ${Number(args.seconds) || 10}s, then back on)`
    default:                     return toolName.replace(/_/g, ' ')
  }
}

// ─── Add reasoning param to every tool ─────────────────────────────────────
function withReasoning(tool: Anthropic.Tool): Anthropic.Tool {
  return {
    ...tool,
    input_schema: {
      ...tool.input_schema,
      properties: {
        reasoning: {
          type: 'string',
          description: 'ONE sentence explaining exactly WHY you are calling this tool right now, referencing the user\'s specific request',
        },
        ...(tool.input_schema.properties as Record<string, unknown>),
      },
      required: ['reasoning', ...((tool.input_schema.required as string[]) ?? [])],
    },
  }
}

// ─── Action tools ───────────────────────────────────────────────────────────
const BASE_TOOLS: Anthropic.Tool[] = [
  // ── Todos ──────────────────────────────────────────────────────────────
  {
    name: 'create_todo',
    description: 'Create a new to-do item.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Title of the to-do' },
        due_date: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        notes: { type: 'string', description: 'Additional notes' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_todo',
    description: 'Update a to-do item. Can change due_date, status, priority, or title.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'The to-do ID' },
        due_date: { type: 'string', description: 'New due date in YYYY-MM-DD format' },
        status: { type: 'string', enum: ['open', 'in_progress', 'done'], description: 'New status' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'New priority' },
        title: { type: 'string', description: 'New title if renaming' },
      },
      required: ['id'],
    },
  },
  {
    name: 'complete_todo',
    description: 'Mark a to-do as done.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'The to-do ID' },
      },
      required: ['id'],
    },
  },
  // ── Work Orders ────────────────────────────────────────────────────────
  {
    name: 'assign_technician',
    description: 'Assign a technician to a work order. HIGH RISK — always show ConfirmationCard before executing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        work_order_id:   { type: 'string', description: 'The work order ID' },
        technician_id:   { type: 'string', description: 'The technician ID to assign' },
        technician_name: { type: 'string', description: 'The technician name (for display)' },
      },
      required: ['work_order_id', 'technician_id', 'technician_name'],
    },
  },
  {
    name: 'create_work_order',
    description: 'Create a new work order.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Title / description of the work order' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], description: 'Priority level' },
        property_name: { type: 'string', description: 'Property or site name (optional)' },
        scheduled_date: { type: 'string', description: 'Scheduled date in YYYY-MM-DD format (optional)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'reschedule_work_order',
    description: 'Change the scheduled date of a work order.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'The work order ID' },
        scheduled_date: { type: 'string', description: 'New scheduled date in YYYY-MM-DD format' },
      },
      required: ['id', 'scheduled_date'],
    },
  },
  {
    name: 'update_work_order_status',
    description: 'Change the status of a work order.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'The work order ID' },
        status: { type: 'string', enum: ['open', 'assigned', 'in_progress', 'completed', 'cancelled'] },
      },
      required: ['id', 'status'],
    },
  },
  // ── CRM Leads ──────────────────────────────────────────────────────────
  {
    name: 'create_lead',
    description: 'Create a new CRM lead.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Contact name' },
        company: { type: 'string', description: 'Company or property name' },
        email: { type: 'string', description: 'Email address' },
        phone: { type: 'string', description: 'Phone number' },
        stage: { type: 'string', enum: ['new', 'contacted', 'qualified', 'proposal', 'negotiation'], description: 'Pipeline stage (default: new)' },
        source: { type: 'string', description: 'Lead source (e.g. referral, website)' },
        notes: { type: 'string', description: 'Initial notes' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_lead_stage',
    description: 'Move a CRM lead to a different pipeline stage.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'The lead ID' },
        stage: { type: 'string', enum: ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'], description: 'New stage' },
      },
      required: ['id', 'stage'],
    },
  },
  {
    name: 'assign_lead',
    description: 'Assign a CRM lead to a specific rep or team member.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'The lead ID' },
        assigned_to: { type: 'string', description: 'User ID of the rep' },
        assigned_to_name: { type: 'string', description: 'Display name of the rep' },
      },
      required: ['id', 'assigned_to_name'],
    },
  },
  // ── CRM Opportunities ──────────────────────────────────────────────────
  {
    name: 'create_opportunity',
    description: 'Create a new CRM opportunity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Opportunity name / title' },
        account_name: { type: 'string', description: 'Account or property name' },
        stage: { type: 'string', enum: ['prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost'], description: 'Pipeline stage (default: prospect)' },
        value: { type: 'number', description: 'Estimated deal value' },
        notes: { type: 'string', description: 'Initial notes' },
      },
      required: ['name', 'account_name'],
    },
  },
  {
    name: 'update_opportunity_stage',
    description: 'Move a CRM opportunity to a different pipeline stage.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'The opportunity ID' },
        stage: { type: 'string', enum: ['prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost'], description: 'New stage' },
      },
      required: ['id', 'stage'],
    },
  },
  {
    name: 'mark_opportunity_won',
    description: 'Mark an opportunity as Won and close it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'The opportunity ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'mark_opportunity_lost',
    description: 'Mark an opportunity as Lost and close it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'The opportunity ID' },
        lost_reason: { type: 'string', description: 'Why the deal was lost (optional)' },
      },
      required: ['id'],
    },
  },
  // ── CRM Activities ─────────────────────────────────────────────────────
  {
    name: 'log_crm_activity',
    description: 'Log a call, email, meeting, or note on a lead or opportunity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        subject: { type: 'string', description: 'Activity subject / summary' },
        body: { type: 'string', description: 'Detailed notes from the activity' },
        type: { type: 'string', enum: ['call', 'email', 'meeting', 'note', 'task'], description: 'Activity type' },
        lead_id: { type: 'string', description: 'Lead ID if linked to a lead' },
        opportunity_id: { type: 'string', description: 'Opportunity ID if linked to an opportunity' },
        due_at: { type: 'string', description: 'ISO datetime if this is a scheduled task' },
      },
      required: ['subject'],
    },
  },
  {
    name: 'schedule_followup',
    description: 'Schedule a follow-up task for a lead or opportunity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        subject: { type: 'string', description: 'Follow-up subject (e.g. "Call back about proposal")' },
        due_date: { type: 'string', description: 'Date for the follow-up in YYYY-MM-DD format' },
        notes: { type: 'string', description: 'Context notes for the follow-up' },
        lead_id: { type: 'string', description: 'Lead ID if linked to a lead' },
        opportunity_id: { type: 'string', description: 'Opportunity ID if linked to an opportunity' },
      },
      required: ['due_date'],
    },
  },
  // ── Quotes ─────────────────────────────────────────────────────────────
  {
    name: 'create_quote',
    description: 'Create a new draft quote for an account.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Quote title / project description' },
        account_name: { type: 'string', description: 'Account or property name' },
        notes: { type: 'string', description: 'Initial notes (optional)' },
      },
      required: ['title', 'account_name'],
    },
  },
  // ── Live systems (Lexi Systems co-pilot). Physical actions — HIGH RISK, always
  //    confirmed, Gate Guard corporate admins only (checked in the executor). ──
  {
    name: 'open_gate',
    description: 'Open (momentarily unlock) a gate or door at a site through Brivo. Get the site_id and door_id from live_systems first. HIGH RISK — physical action; the user must tap Confirm.',
    input_schema: {
      type: 'object' as const,
      properties: {
        site_id: { type: 'string', description: 'Site id (from live_systems)' },
        door_id: { type: 'string', description: 'Brivo door / access point id (from live_systems)' },
        door_name: { type: 'string', description: 'Door or gate name, for the record' },
      },
      required: ['site_id', 'door_id', 'door_name'],
    },
  },
  {
    name: 'relay_action',
    description: 'Control a Shelly relay at a site. mode "power_cycle" turns the relay OFF for `seconds` (default 10) and then back on — use to reboot a gate operator, controller or camera power. mode "pulse" turns it ON for `seconds` (default 1) — use for a gate trigger relay. Get site_id, device_id and channel from live_systems first. HIGH RISK — the user must tap Confirm.',
    input_schema: {
      type: 'object' as const,
      properties: {
        site_id: { type: 'string' },
        device_id: { type: 'string', description: 'Shelly device id (from live_systems)' },
        channel: { type: 'number', description: 'Relay channel, usually 0' },
        relay_name: { type: 'string' },
        mode: { type: 'string', enum: ['power_cycle', 'pulse'] },
        seconds: { type: 'number', description: 'power_cycle: off time (5–120, default 10). pulse: on time (1–10, default 1).' },
      },
      required: ['site_id', 'device_id', 'relay_name', 'mode'],
    },
  },
]

export const ACTION_TOOLS: Anthropic.Tool[] = BASE_TOOLS.map(withReasoning)

// ─── Portal navigation map ──────────────────────────────────────────────────
