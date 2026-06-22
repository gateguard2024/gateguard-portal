import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { executeToolWithRevert, type RevertPayload } from '@/lib/assistant-executor'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Risk profiles ──────────────────────────────────────────────────────────
const TOOL_RISK_PROFILES: Record<string, 'low' | 'medium' | 'high'> = {
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
}

// ─── Action summary builder ─────────────────────────────────────────────────
function buildActionSummary(toolName: string, args: Record<string, unknown>): string {
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
]

const ACTION_TOOLS: Anthropic.Tool[] = BASE_TOOLS.map(withReasoning)

// ─── Portal navigation map ──────────────────────────────────────────────────
const PORTAL_NAV = `
PORTAL ROUTES (always use these exact paths for deep links):
/                    Dashboard — KPIs, accounts, EOS heartbeat
/crm                 CRM — leads kanban, pipeline, My Leads panel
/crm/leads           Lead list
/crm/leads/[id]      Lead detail
/crm/opportunities   Opportunity kanban
/crm/opportunities/[id] Opportunity detail
/customers           Customer / org hierarchy viewer
/quotes              Quote list (all statuses)
/quotes/new          New quote builder
/quotes/[id]         Quote editor
/survey              Site survey list + AI SOW generator
/maintenance         Work Orders list
/maintenance/[id]    Work Order detail
/dispatch            Dispatch board + tech roster
/sites               Properties / sites list
/sites/[id]          Site detail
/products            Equipment catalog
/kb                  Knowledge base + AI diagnostic
/tech                Field diagnostic tool (for techs)
/eos                 EOS operating system (Rocks, Scorecard, Issues, L10)
/todos               To-Dos
/reps                Rep hierarchy + commissions
/compliance          Permit tracker
/billing             Invoices + MRR
/admin/dealers       Dealer management
`.trim()

// ─── Data tool ──────────────────────────────────────────────────────────────
async function fetchPortalData(dataType: string, orgId: string | null) {
  try {
    switch (dataType) {
      case 'todos_overdue': {
        const today = new Date().toISOString().split('T')[0]
        const { data } = await supabase
          .from('todos')
          .select('id, title, priority, due_date, status')
          .in('status', ['open', 'in_progress'])
          .lte('due_date', today)
          .order('priority', { ascending: true })
          .limit(10)
        return data ?? []
      }
      case 'todos_today': {
        const today = new Date().toISOString().split('T')[0]
        const { data } = await supabase
          .from('todos')
          .select('id, title, priority, due_date, status')
          .in('status', ['open', 'in_progress'])
          .eq('due_date', today)
          .order('priority', { ascending: true })
          .limit(10)
        return data ?? []
      }
      case 'quotes_expiring': {
        const soon = new Date()
        soon.setDate(soon.getDate() + 7)
        const { data } = await supabase
          .from('quotes')
          .select('id, quote_number, title, valid_until, total_one_time, total_mrr, status')
          .in('status', ['sent', 'draft'])
          .lte('valid_until', soon.toISOString().split('T')[0])
          .order('valid_until', { ascending: true })
          .limit(10)
        return data ?? []
      }
      case 'work_orders_open': {
        const { data } = await supabase
          .from('work_orders')
          .select('id, title, status, priority, scheduled_date, property_name')
          .in('status', ['open', 'in_progress', 'scheduled'])
          .order('scheduled_date', { ascending: true })
          .limit(10)
        return data ?? []
      }
      case 'quotes_recent': {
        const { data } = await supabase
          .from('quotes')
          .select('id, quote_number, title, status, total_one_time, total_mrr, created_at')
          .order('created_at', { ascending: false })
          .limit(8)
        return data ?? []
      }
      case 'leads_open': {
        const { data } = await supabase
          .from('leads')
          .select('id, name:contact_name, company:company_name, stage, source, created_at')
          .not('stage', 'eq', 'lost')
          .order('created_at', { ascending: false })
          .limit(10)
        return data ?? []
      }
      case 'opportunities_open': {
        const { data } = await supabase
          .from('opportunities')
          .select('id, name, account_name, stage, value:amount, updated_at')
          .not('stage', 'in', '("won","lost")')
          .order('updated_at', { ascending: false })
          .limit(10)
        return data ?? []
      }
      case 'daily_briefing': {
        const today = new Date().toISOString().split('T')[0]
        const soon = new Date(); soon.setDate(soon.getDate() + 7)
        const [todosRes, wosRes, quotesRes] = await Promise.all([
          supabase.from('todos').select('id, title, priority, due_date').in('status', ['open', 'in_progress']).lte('due_date', today).limit(5),
          supabase.from('work_orders').select('id, title, status, priority').in('status', ['open', 'in_progress']).limit(5),
          supabase.from('quotes').select('id, quote_number, valid_until, status').in('status', ['sent']).lte('valid_until', soon.toISOString().split('T')[0]).limit(5),
        ])
        return {
          overdue_todos: todosRes.data ?? [],
          open_wos: wosRes.data ?? [],
          expiring_quotes: quotesRes.data ?? [],
        }
      }
      default:
        return null
    }
  } catch {
    return null
  }
}

// ─── ActionCards types (returned for operational read queries) ──────────────
interface ActionCardAction {
  label: string
  href?: string
  toolName?: string
  toolArgs?: Record<string, unknown>
}

interface ActionCard {
  hex: string
  tag: string
  urgent?: boolean
  headline: string
  sub?: string
  actions: ActionCardAction[]
}

interface ActionCardsResponse {
  type: 'action_cards'
  title?: string
  cards: ActionCard[]
  proactive?: ActionCard[]
}

// ─── Stage / priority color maps ────────────────────────────────────────────
const STAGE_HEX: Record<string, string> = {
  prospect:  '#6B7EFF', qualified: '#34d399', proposal:    '#fbbf24',
  negotiation: '#f97316', won: '#34d399',    lost:        '#6b7280',
  new: '#6B7EFF', contacted: '#a5b4ff',      aria_draft:  '#a855f7',
  survey_requested: '#fbbf24', proposal_sent: '#f97316',
}

const PRIORITY_HEX: Record<string, string> = {
  low: '#34d399', normal: '#6B7EFF', high: '#fbbf24',
  urgent: '#ef4444', critical: '#ef4444',
}

const QUOTE_STATUS_HEX: Record<string, string> = {
  draft: '#6b7280', sent: '#6B7EFF', viewed: '#fbbf24',
  accepted: '#34d399', rejected: '#ef4444',
}

// ─── Operational intent detection ───────────────────────────────────────────
type OperationalIntent =
  | 'find_opportunities'
  | 'find_leads'
  | 'find_work_orders'
  | 'find_quotes'
  | 'morning_briefing'
  | 'intake_lead'

function detectOperationalIntent(msg: string): OperationalIntent | null {
  const m = msg.toLowerCase()
  // Intake lead — must check BEFORE find_leads to avoid false match
  if (/\b(called about|interested in (our |the |a )?service|new (lead|property)|came in (about|asking))\b/.test(m)) {
    return 'intake_lead'
  }
  // Find queries
  if (/\b(opportunit|pipeline|open deal|new opp|show.*deal|find.*deal)\b/.test(m))  return 'find_opportunities'
  if (/\b(lead|prospect)\b/.test(m) && !/\b(create|add|new lead)\b/.test(m))        return 'find_leads'
  if (/\b(work order|open job|service call|\bwos?\b|dispatch job)\b/.test(m))        return 'find_work_orders'
  if (/\b(quote|proposal)\b/.test(m) && !/\b(create|new quote|new proposal)\b/.test(m)) return 'find_quotes'
  if (/\b(briefing|morning|today.s status|what do i have|what.s today|daily)\b/.test(m)) return 'morning_briefing'
  return null
}

// ─── Disambiguation pre-processor ────────────────────────────────────────────

type DisambiguationEntity = 'aria' | 'leads' | 'work_orders' | 'quotes' | 'opportunities' | 'field'

interface DisambiguationOptionData {
  label:     string
  sub:       string
  hex:       string
  requery?:  string
  href?:     string
  toolName?: string
}

function detectDisambiguationIntent(msg: string): DisambiguationEntity | null {
  const m = msg.trim()
  if (m.length > 28) return null
  if (/^aria$/i.test(m))                                                         return 'aria'
  if (/^(leads?|prospects?)$/i.test(m))                                          return 'leads'
  if (/^(work[\s-]?orders?|wo#?\d*|jobs?|dispatch|field\s?service)$/i.test(m))  return 'work_orders'
  if (/^(quotes?|proposals?)$/i.test(m))                                         return 'quotes'
  if (/^(opps?|opportunit(ies|y)?|pipeline|deals?)$/i.test(m))                  return 'opportunities'
  if (/^(field|techs?|technicians?)$/i.test(m))                                 return 'field'
  return null
}

const DISAMBIG_OPTIONS: Record<DisambiguationEntity, { prompt: string; options: DisambiguationOptionData[] }> = {
  aria: {
    prompt: 'What would you like to do with ARIA?',
    options: [
      { label: 'ARIA Search',    sub: 'Research a property or prospect', hex: '#6B7EFF', href: '/aria' },
      { label: 'New Lead',       sub: 'Add a prospect to the pipeline',  hex: '#34d399', requery: 'create a new lead' },
      { label: 'Intel Database', sub: 'Browse saved ARIA research',      hex: '#a5b4ff', href: '/aria' },
    ],
  },
  leads: {
    prompt: 'What would you like to do with leads?',
    options: [
      { label: 'Show All Leads',    sub: 'View your open lead pipeline', hex: '#6B7EFF', requery: 'show me all leads' },
      { label: 'Add New Lead',      sub: 'Create a prospect manually',   hex: '#34d399', requery: 'create a new lead' },
      { label: 'Run ARIA Research', sub: 'Deep intel on a property',     hex: '#a5b4ff', href: '/aria' },
    ],
  },
  work_orders: {
    prompt: 'What would you like to do with work orders?',
    options: [
      { label: 'Open Work Orders',  sub: 'View jobs in the queue',      hex: '#6B7EFF', requery: 'show me open work orders' },
      { label: 'Create Work Order', sub: 'Schedule a new service job',  hex: '#34d399', requery: 'create a new work order' },
      { label: 'Go to Dispatch',    sub: 'Full dispatch board',         hex: '#fbbf24', href: '/dispatch' },
    ],
  },
  quotes: {
    prompt: 'What would you like to do with quotes?',
    options: [
      { label: 'Recent Quotes', sub: 'View active proposals', hex: '#6B7EFF', requery: 'show me recent quotes' },
      { label: 'New Quote',     sub: 'Build a new proposal',  hex: '#34d399', href: '/quotes/new' },
      { label: 'All Quotes',    sub: 'Full quote management', hex: '#a5b4ff', href: '/quotes' },
    ],
  },
  opportunities: {
    prompt: 'What would you like to do with opportunities?',
    options: [
      { label: 'Open Deals',      sub: 'View pipeline deals', hex: '#6B7EFF', requery: 'show me open opportunities' },
      { label: 'New Opportunity', sub: 'Add to pipeline',     hex: '#34d399', requery: 'create a new opportunity' },
      { label: 'Full Pipeline',   sub: 'CRM pipeline board',  hex: '#a5b4ff', href: '/crm/opportunities' },
    ],
  },
  field: {
    prompt: 'What would you like to do with the field team?',
    options: [
      { label: 'Open Work Orders', sub: 'Jobs in the queue',       hex: '#6B7EFF', requery: 'show me open work orders' },
      { label: 'Tech Roster',      sub: 'View field technicians',  hex: '#34d399', href: '/dispatch' },
      { label: 'Dispatch Board',   sub: 'Schedule & assign jobs',  hex: '#fbbf24', href: '/dispatch' },
    ],
  },
}

function buildDisambiguationResponse(entity: DisambiguationEntity): Record<string, unknown> {
  const cfg = DISAMBIG_OPTIONS[entity]
  return { type: 'disambiguation', entity, prompt: cfg.prompt, options: cfg.options }
}

// ─── Format helpers ──────────────────────────────────────────────────────────
function fmtDollar(v: number | undefined | null): string {
  return v ? `$${Number(v).toLocaleString()}` : ''
}

function timeAgoShort(iso?: string): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  const h = Math.floor(diff / 3600000)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  return 'just now'
}

// ─── Build ActionCards response for each intent ──────────────────────────────
async function buildActionCardsResponse(
  intent: OperationalIntent,
  rawMsg: string,
  orgId: string | null,
): Promise<ActionCardsResponse | null> {

  switch (intent) {

    case 'find_opportunities': {
      const opps = (await fetchPortalData('opportunities_open', orgId) as Array<{
        id: string; name?: string; account_name?: string; stage?: string; value?: number; updated_at?: string
      }>) ?? []

      if (!opps.length) {
        return {
          type: 'action_cards', title: 'No open opportunities',
          cards: [],
          proactive: [{
            hex: '#6B7EFF', tag: 'GET STARTED',
            headline: 'No open opportunities — ready to build your pipeline?',
            sub: 'Create your first opportunity or explore existing leads.',
            actions: [
              { label: 'New Opportunity', href: '/crm/opportunities' },
              { label: 'View All Leads',  href: '/crm/leads' },
            ],
          }],
        }
      }
      return {
        type: 'action_cards',
        title: `Open Opportunities (${opps.length})`,
        cards: opps.slice(0, 6).map(opp => ({
          hex: STAGE_HEX[opp.stage ?? ''] ?? '#6B7EFF',
          tag: (opp.stage ?? 'OPPORTUNITY').toUpperCase().replace(/_/g, ' '),
          headline: [opp.name, opp.account_name].filter(Boolean).join(' · '),
          sub: [fmtDollar(opp.value), timeAgoShort(opp.updated_at)].filter(Boolean).join(' · '),
          actions: [{ label: 'View Details', href: `/crm/opportunities/${opp.id}` }],
        })),
      }
    }

    case 'find_leads': {
      const leads = (await fetchPortalData('leads_open', orgId) as Array<{
        id: string; name?: string; company?: string; stage?: string; source?: string; created_at?: string
      }>) ?? []

      if (!leads.length) {
        return {
          type: 'action_cards', title: 'No open leads',
          cards: [],
          proactive: [{
            hex: '#34d399', tag: 'GET STARTED',
            headline: 'Pipeline is clear — no open leads right now.',
            sub: 'Add a new lead or run ARIA to find prospects.',
            actions: [
              { label: 'Add Lead',        href: '/crm/leads' },
              { label: 'Run ARIA Intel',  href: '/aria' },
            ],
          }],
        }
      }
      return {
        type: 'action_cards',
        title: `Open Leads (${leads.length})`,
        cards: leads.slice(0, 6).map(lead => ({
          hex: STAGE_HEX[lead.stage ?? ''] ?? '#6B7EFF',
          tag: (lead.stage ?? 'LEAD').toUpperCase().replace(/_/g, ' '),
          headline: [lead.name, lead.company].filter(Boolean).join(' · '),
          sub: [lead.source, timeAgoShort(lead.created_at)].filter(Boolean).join(' · '),
          actions: [{ label: 'View Details', href: `/crm/leads/${lead.id}` }],
        })),
      }
    }

    case 'find_work_orders': {
      const wos = (await fetchPortalData('work_orders_open', orgId) as Array<{
        id: string; title?: string; status?: string; priority?: string; scheduled_date?: string; property_name?: string
      }>) ?? []

      if (!wos.length) {
        return {
          type: 'action_cards', title: 'No open work orders',
          cards: [],
          proactive: [{
            hex: '#fbbf24', tag: 'ALL CLEAR',
            headline: 'No open work orders — field ops are clear.',
            sub: 'Create a new work order or check the dispatch board.',
            actions: [
              { label: 'New Work Order', href: '/maintenance' },
              { label: 'Dispatch Board', href: '/dispatch' },
            ],
          }],
        }
      }
      return {
        type: 'action_cards',
        title: `Open Work Orders (${wos.length})`,
        cards: wos.slice(0, 6).map(wo => ({
          hex: PRIORITY_HEX[wo.priority ?? 'normal'] ?? '#6B7EFF',
          tag: (wo.priority ?? 'NORMAL').toUpperCase(),
          urgent: wo.priority === 'urgent' || wo.priority === 'critical',
          headline: [wo.title, wo.property_name].filter(Boolean).join(' · '),
          sub: [
            wo.status?.replace(/_/g, ' '),
            wo.scheduled_date ? `Scheduled ${wo.scheduled_date}` : '',
          ].filter(Boolean).join(' · '),
          actions: [
            { label: 'View Details', href: `/maintenance/${wo.id}` },
            { label: 'Dispatch',     href: '/dispatch' },
          ],
        })),
      }
    }

    case 'find_quotes': {
      const quotes = (await fetchPortalData('quotes_recent', orgId) as Array<{
        id: string; quote_number?: string; title?: string; status?: string;
        total_one_time?: number; total_mrr?: number; created_at?: string
      }>) ?? []

      if (!quotes.length) {
        return {
          type: 'action_cards', title: 'No recent quotes',
          cards: [],
          proactive: [{
            hex: '#6B7EFF', tag: 'GET STARTED',
            headline: 'No quotes in your pipeline — ready to build one?',
            sub: 'Start with a scenario template or build from scratch.',
            actions: [
              { label: 'New Quote',       href: '/quotes/new' },
              { label: 'View All Quotes', href: '/quotes' },
            ],
          }],
        }
      }
      return {
        type: 'action_cards',
        title: `Recent Quotes (${quotes.length})`,
        cards: quotes.slice(0, 6).map(q => ({
          hex: QUOTE_STATUS_HEX[q.status ?? 'draft'] ?? '#6B7EFF',
          tag: (q.status ?? 'DRAFT').toUpperCase(),
          headline: q.title ?? q.quote_number ?? 'Quote',
          sub: [
            fmtDollar(q.total_one_time),
            q.total_mrr ? `${fmtDollar(q.total_mrr)}/mo MRR` : '',
            timeAgoShort(q.created_at),
          ].filter(Boolean).join(' · '),
          actions: [{ label: 'View Quote', href: `/quotes/${q.id}` }],
        })),
      }
    }

    case 'morning_briefing': {
      const briefing = await fetchPortalData('daily_briefing', orgId) as {
        overdue_todos: Array<{ id: string; title?: string; priority?: string; due_date?: string }>
        open_wos:      Array<{ id: string; title?: string; status?: string;  priority?: string }>
        expiring_quotes: Array<{ id: string; quote_number?: string; title?: string; valid_until?: string }>
      }
      const cards: ActionCard[] = []
      for (const t of (briefing?.overdue_todos ?? []).slice(0, 2)) {
        cards.push({
          hex: PRIORITY_HEX[t.priority ?? 'normal'], tag: 'OVERDUE TODO', urgent: true,
          headline: t.title ?? 'To-Do',
          sub: t.due_date ? `Was due ${t.due_date}` : undefined,
          actions: [{ label: 'View Todos', href: '/todos' }],
        })
      }
      for (const wo of (briefing?.open_wos ?? []).slice(0, 2)) {
        cards.push({
          hex: '#fbbf24', tag: 'OPEN JOB', urgent: wo.priority === 'urgent',
          headline: wo.title ?? 'Work Order',
          sub: wo.status?.replace(/_/g, ' '),
          actions: [{ label: 'View', href: `/maintenance/${wo.id}` }],
        })
      }
      for (const q of (briefing?.expiring_quotes ?? []).slice(0, 2)) {
        cards.push({
          hex: '#f97316', tag: 'EXPIRING QUOTE', urgent: true,
          headline: q.title ?? q.quote_number ?? 'Quote',
          sub: q.valid_until ? `Expires ${q.valid_until}` : undefined,
          actions: [{ label: 'View Quote', href: `/quotes/${q.id}` }],
        })
      }
      if (!cards.length) {
        return {
          type: 'action_cards', title: "All clear — nothing urgent today",
          cards: [],
          proactive: [{
            hex: '#34d399', tag: 'ALL CLEAR',
            headline: "Nothing overdue, no open jobs, no expiring quotes.",
            sub: "You're up to date. Great work!",
            actions: [
              { label: 'Check Pipeline', href: '/crm' },
              { label: 'View Dispatch',  href: '/dispatch' },
            ],
          }],
        }
      }
      return {
        type: 'action_cards',
        title: `Today's Briefing — ${cards.length} item${cards.length !== 1 ? 's' : ''} need attention`,
        cards,
      }
    }

    case 'intake_lead': {
      // Extract property/company name from message
      const nameMatch =
        rawMsg.match(/^(.+?)\s+called about/i)?.[1]?.trim() ??
        rawMsg.match(/^(.+?)\s+interested in/i)?.[1]?.trim() ??
        rawMsg.match(/new (?:lead|property)[:\s]+(.+)/i)?.[1]?.trim() ??
        rawMsg.match(/^(.+?)\s+came in asking/i)?.[1]?.trim()

      if (!nameMatch || nameMatch.split(' ').length > 6) return null  // Too ambiguous — fall through to Claude

      const name = nameMatch.charAt(0).toUpperCase() + nameMatch.slice(1)
      return {
        type: 'action_cards',
        title: `New Lead: ${name}`,
        cards: [{
          hex: '#34d399', tag: 'NEW LEAD',
          headline: `Add "${name}" as a new lead?`,
          sub: 'This will create a CRM lead record and add it to your pipeline.',
          actions: [
            { label: 'Yes, Create Lead', toolName: 'create_lead', toolArgs: { name, stage: 'new' } },
            { label: 'Open CRM',         href: '/crm/leads' },
          ],
        }],
      }
    }

    default:
      return null
  }
}

// ─── PendingAction type (returned when medium/high risk tool is triggered) ──
interface PendingAction {
  toolName: string
  toolArgs: Record<string, unknown>
  reasoning: string
  riskLevel: 'medium' | 'high'
  summary: string
}

interface LastLowRiskAction {
  toolName: string
  summary: string
  reasoning: string
  revertPayload?: RevertPayload
}

// ─── Main route ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messages, currentPage, userName } = await req.json()

  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: 'messages array required' }, { status: 400 })
  }

  // Fetch live data based on message content
  const lastMsg = messages[messages.length - 1]?.content ?? ''
  const lowerMsg = lastMsg.toLowerCase()

  let liveData: Record<string, unknown> | null = null
  let dataContext = ''

  if (lowerMsg.includes('todo') || lowerMsg.includes('task') || lowerMsg.includes('overdue') || lowerMsg.includes('due today')) {
    const data = await fetchPortalData('todos_overdue', user?.org_id ?? null)
    const today = await fetchPortalData('todos_today', user?.org_id ?? null)
    liveData = { overdue: data, due_today: today }
    dataContext = `\nLIVE DATA — To-Dos:\nOverdue: ${JSON.stringify(data)}\nDue today: ${JSON.stringify(today)}`
  } else if (lowerMsg.includes('opportunit')) {
    const data = await fetchPortalData('opportunities_open', user?.org_id ?? null)
    liveData = { opportunities: data }
    dataContext = `\nLIVE DATA — Open Opportunities:\n${JSON.stringify(data)}`
  } else if (lowerMsg.includes('lead') || lowerMsg.includes('pipeline') || lowerMsg.includes('crm')) {
    const [leads, opps] = await Promise.all([
      fetchPortalData('leads_open', user?.org_id ?? null),
      fetchPortalData('opportunities_open', user?.org_id ?? null),
    ])
    liveData = { leads, opportunities: opps }
    dataContext = `\nLIVE DATA — Leads:\n${JSON.stringify(leads)}\nOpportunities:\n${JSON.stringify(opps)}`
  } else if (lowerMsg.includes('quote')) {
    const data = await fetchPortalData('quotes_recent', user?.org_id ?? null)
    liveData = { quotes: data }
    dataContext = `\nLIVE DATA — Recent Quotes:\n${JSON.stringify(data)}`
  } else if (lowerMsg.includes('work order') || lowerMsg.includes('job') || lowerMsg.includes('wo')) {
    const data = await fetchPortalData('work_orders_open', user?.org_id ?? null)
    liveData = { work_orders: data }
    dataContext = `\nLIVE DATA — Open Work Orders:\n${JSON.stringify(data)}`
  } else if (lowerMsg.includes('briefing') || lowerMsg.includes('morning') || lowerMsg.includes('today') || lowerMsg.includes('day')) {
    const data = await fetchPortalData('daily_briefing', user?.org_id ?? null)
    liveData = data as Record<string, unknown>
    dataContext = `\nLIVE DATA — Daily Briefing:\n${JSON.stringify(data)}`
  }

  // ─── Disambiguation pre-processor ──────────────────────────────────────────
  // Single-word / very short entity names (e.g. "ARIA", "leads", "quotes") get
  // glass option buttons instead of a text response. Runs first so "leads"
  // doesn't also fall through to the find_leads operational intent.
  const disambigEntity = detectDisambiguationIntent(lastMsg)
  if (disambigEntity) {
    return NextResponse.json(buildDisambiguationResponse(disambigEntity))
  }

  // ─── Operational intent pre-processor ───────────────────────────────────────
  // For known read/find queries, skip the agentic loop entirely and return
  // structured ActionCards so the frontend renders glass UI, not a text bubble.
  const operationalIntent = detectOperationalIntent(lowerMsg)
  if (operationalIntent) {
    const actionCardsResult = await buildActionCardsResponse(operationalIntent, lastMsg, user?.org_id ?? null)
    if (actionCardsResult) return NextResponse.json(actionCardsResult)
  }

  const systemPrompt = `You are NEXUS, the personal AI assistant built into the GateGuard dealer portal. You are concise, direct, and helpful. You know the portal inside-out and can answer questions, look up data, remind about tasks, navigate the user to the right page, and take actions directly in the portal.

USER: ${userName || user?.name || 'Dealer'} (${user?.role || 'dealer'})
CURRENT PAGE: ${currentPage || '/'}
TODAY: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

${PORTAL_NAV}
${dataContext}

ACTIONS YOU CAN TAKE (Sales & Marketing):
- Create a new CRM lead (create_lead)
- Move a lead to a different stage (update_lead_stage)
- Assign a lead to a rep (assign_lead)
- Create a new CRM opportunity (create_opportunity)
- Move an opportunity to a different stage (update_opportunity_stage)
- Mark an opportunity as Won (mark_opportunity_won) — HIGH RISK, requires confirmation
- Mark an opportunity as Lost (mark_opportunity_lost) — HIGH RISK, requires confirmation
- Log a call, email, or meeting (log_crm_activity)
- Schedule a follow-up task (schedule_followup)
- Create a draft quote (create_quote)

ACTIONS YOU CAN TAKE (Operations):
- Create a new to-do (create_todo)
- Update a to-do (update_todo)
- Mark a to-do as done (complete_todo)
- Create a new work order (create_work_order)
- Reschedule a work order (reschedule_work_order)
- Update work order status (update_work_order_status)

IMPORTANT: Every tool call requires a "reasoning" field — ONE sentence explaining exactly WHY you're calling it, referencing the user's actual words.

When the user asks you to change something, USE THE TOOLS — don't say you can't. After an action, confirm in plain language what you did.
If you need to know which specific item (e.g. "that lead" when there are several), ask for clarification first.

RESPONSE RULES:
- Be concise. Max 3–4 sentences unless showing data lists.
- Format deep links as markdown: [Go to CRM](/crm)
- When showing data, use a brief bulleted list — max 5 items.
- If data shows 0 results, say so positively.
- For urgent items (overdue, expiring), lead with those first.
- Never make up data. If you don't have live data, say so and link to the page.
- Tone: Professional but warm. Like a sharp EA who knows the business.
- Do NOT use markdown headers (##). Plain text + bullets only.`

  try {
    type MessageParam = Anthropic.MessageParam

    let currentMessages: MessageParam[] = messages.map(
      (m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })
    )

    let finalText = ''
    const actionsExecuted: string[] = []
    let lastLowRiskAction: LastLowRiskAction | null = null

    // Agentic loop — handles tool_use up to 5 iterations
    for (let iteration = 0; iteration < 5; iteration++) {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        tools: ACTION_TOOLS,
        messages: currentMessages,
      })

      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find(b => b.type === 'text')
        finalText = textBlock?.type === 'text' ? textBlock.text : ''
        break
      }

      if (response.stop_reason === 'tool_use') {
        const toolUseBlock = response.content.find(b => b.type === 'tool_use')
        if (!toolUseBlock || toolUseBlock.type !== 'tool_use') break

        const toolArgs = toolUseBlock.input as Record<string, unknown>
        const reasoning = typeof toolArgs.reasoning === 'string' ? toolArgs.reasoning : ''
        const riskLevel = TOOL_RISK_PROFILES[toolUseBlock.name] ?? 'medium'

        // Medium / High risk — return pending action for user confirmation
        if (riskLevel !== 'low') {
          const preTextBlock = response.content.find(b => b.type === 'text')
          const preText = preTextBlock?.type === 'text' ? preTextBlock.text : ''
          const pendingAction: PendingAction = {
            toolName: toolUseBlock.name,
            toolArgs,
            reasoning,
            riskLevel,
            summary: buildActionSummary(toolUseBlock.name, toolArgs),
          }
          return NextResponse.json({
            response: preText || null,
            pendingAction,
            liveData,
            actionsExecuted: [],
          })
        }

        // Low risk — execute inline via shared executor
        actionsExecuted.push(toolUseBlock.name)
        const toolResult = await executeToolWithRevert(toolUseBlock.name, toolArgs)

        if (toolResult.success && toolResult.revertPayload) {
          lastLowRiskAction = {
            toolName: toolUseBlock.name,
            summary: buildActionSummary(toolUseBlock.name, toolArgs),
            reasoning,
            revertPayload: toolResult.revertPayload,
          }
        }

        // Feed result back to Claude for next turn
        currentMessages = [
          ...currentMessages,
          { role: 'assistant' as const, content: response.content },
          {
            role: 'user' as const,
            content: [
              {
                type: 'tool_result' as const,
                tool_use_id: toolUseBlock.id,
                content: JSON.stringify(toolResult),
              },
            ],
          },
        ]
        continue
      }

      // Unexpected stop reason — extract any text and bail
      const textBlock = response.content.find(b => b.type === 'text')
      finalText = textBlock?.type === 'text' ? textBlock.text : ''
      break
    }

    return NextResponse.json({
      response: finalText,
      liveData,
      actionsExecuted,
      lastLowRiskAction,
    })
  } catch (err: unknown) {
    console.error('[assistant/chat]', err)
    return NextResponse.json({ error: 'Assistant unavailable' }, { status: 500 })
  }
}
