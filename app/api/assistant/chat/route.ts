import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Action tools for Claude tool_use ──────────────────────────────────────
const ACTION_TOOLS: Anthropic.Tool[] = [
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
]

// ─── Tool executor ──────────────────────────────────────────────────────────
async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<{ success: boolean; message?: string; error?: string; id?: string }> {
  switch (toolName) {
    case 'update_todo': {
      const { id, ...updates } = toolInput
      const { error } = await supabase.from('todos').update(updates).eq('id', id)
      if (error) return { success: false, error: error.message }
      return { success: true, message: 'To-do updated successfully' }
    }
    case 'create_todo': {
      const { data, error } = await supabase
        .from('todos')
        .insert({ ...toolInput, status: 'open' })
        .select()
        .single()
      if (error) return { success: false, error: error.message }
      return { success: true, id: (data as { id: string }).id, message: 'To-do created' }
    }
    case 'complete_todo': {
      const { error } = await supabase
        .from('todos')
        .update({ status: 'done' })
        .eq('id', toolInput.id)
      if (error) return { success: false, error: error.message }
      return { success: true, message: 'To-do marked complete' }
    }
    case 'reschedule_work_order': {
      const { id, scheduled_date } = toolInput
      const { error } = await supabase
        .from('work_orders')
        .update({ scheduled_date })
        .eq('id', id)
      if (error) return { success: false, error: error.message }
      return { success: true, message: `Work order rescheduled to ${scheduled_date}` }
    }
    case 'update_work_order_status': {
      const { id, status } = toolInput
      const { error } = await supabase
        .from('work_orders')
        .update({ status })
        .eq('id', id)
      if (error) return { success: false, error: error.message }
      return { success: true, message: `Work order status updated to ${status}` }
    }
    default:
      return { success: false, error: 'Unknown tool' }
  }
}

// ─── Portal navigation map (for deep links in responses) ───────────────────
const PORTAL_NAV = `
PORTAL ROUTES (always use these exact paths for deep links):
/                    Dashboard — KPIs, accounts, EOS heartbeat
/crm                 CRM — leads kanban, pipeline, My Leads panel
/crm/leads           Lead list
/crm/leads/[id]      Lead detail
/crm/opportunities   Opportunity kanban
/crm/opportunities/[id] Opportunity detail
/customers           Customer / org hierarchy viewer
/customers/[id]      Customer detail
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
/scorecard           Dealer scorecard
/training            Training & certification
/inventory           Inventory (warehouse, van stock, POs)
/reports             Roll-up reports
/billing             Invoices + MRR
/admin/dealers       Dealer management
`.trim()

// ─── Data tool — fetch live portal data ────────────────────────────────────
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
          .from('crm_leads')
          .select('id, name, company, stage, source, created_at')
          .not('stage', 'eq', 'closed_lost')
          .order('created_at', { ascending: false })
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

  // Check if last user message requests live data
  const lastMsg = messages[messages.length - 1]?.content ?? ''
  const lowerMsg = lastMsg.toLowerCase()

  let liveData: Record<string, unknown> | null = null
  let dataContext = ''

  if (lowerMsg.includes('todo') || lowerMsg.includes('task') || lowerMsg.includes('overdue') || lowerMsg.includes('due today')) {
    const data = await fetchPortalData('todos_overdue', user?.org_id ?? null)
    const today = await fetchPortalData('todos_today', user?.org_id ?? null)
    liveData = { overdue: data, due_today: today }
    dataContext = `\nLIVE DATA — To-Dos:\nOverdue: ${JSON.stringify(data)}\nDue today: ${JSON.stringify(today)}`
  } else if (lowerMsg.includes('quote')) {
    const data = await fetchPortalData('quotes_recent', user?.org_id ?? null)
    liveData = { quotes: data }
    dataContext = `\nLIVE DATA — Recent Quotes:\n${JSON.stringify(data)}`
  } else if (lowerMsg.includes('work order') || lowerMsg.includes('job') || lowerMsg.includes('wo')) {
    const data = await fetchPortalData('work_orders_open', user?.org_id ?? null)
    liveData = { work_orders: data }
    dataContext = `\nLIVE DATA — Open Work Orders:\n${JSON.stringify(data)}`
  } else if (lowerMsg.includes('lead') || lowerMsg.includes('pipeline') || lowerMsg.includes('crm')) {
    const data = await fetchPortalData('leads_open', user?.org_id ?? null)
    liveData = { leads: data }
    dataContext = `\nLIVE DATA — Open Leads:\n${JSON.stringify(data)}`
  } else if (lowerMsg.includes('briefing') || lowerMsg.includes('morning') || lowerMsg.includes('today') || lowerMsg.includes('day')) {
    const data = await fetchPortalData('daily_briefing', user?.org_id ?? null)
    liveData = data as Record<string, unknown>
    dataContext = `\nLIVE DATA — Daily Briefing:\n${JSON.stringify(data)}`
  }

  const systemPrompt = `You are NEXUS, the personal AI assistant built into the GateGuard dealer portal. You are concise, direct, and helpful. You know the portal inside-out and can answer questions, look up data, remind about tasks, navigate the user to the right page, and take actions directly in the portal.

USER: ${userName || user?.name || 'Dealer'} (${user?.role || 'dealer'})
CURRENT PAGE: ${currentPage || '/'}
TODAY: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

${PORTAL_NAV}
${dataContext}

ACTIONS YOU CAN TAKE:
- Update a to-do's due date, status, priority, or title
- Create a new to-do
- Mark a to-do as complete
- Reschedule a work order
- Update a work order status

When the user asks you to change something, DO IT using the available tools. Don't say you can't — act, then confirm what you did.
After taking an action, confirm in plain language: "Done — I've updated [item] to [new value]."
If you need to know which specific item (e.g. user says "that to-do" but there are multiple open items), ask for clarification first, then act once you have enough info.

RESPONSE RULES:
- Be concise. Max 3-4 sentences unless showing data lists.
- When referencing portal pages, format deep links as markdown: [Go to Quotes](/quotes)
- When showing data (To-Dos, quotes, WOs), use a brief bulleted list — max 5 items.
- If data shows 0 results, say so positively ("No overdue To-Dos — you're clear!").
- For data questions, show the data then offer a link to see more.
- Never make up data. If you don't have live data for a question, say "Let me pull that up — check [page link] for the latest."
- Tone: Professional but warm. Like a sharp EA who knows the business.
- Do NOT use markdown headers (##). Plain text + bullets only.
- For urgent items (overdue, expiring), lead with those first.`

  try {
    type MessageParam = Anthropic.MessageParam

    let currentMessages: MessageParam[] = messages.map(
      (m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })
    )

    let finalText = ''

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

        const toolResult = await executeTool(
          toolUseBlock.name,
          toolUseBlock.input as Record<string, unknown>
        )

        // Append assistant's tool_use turn and our tool_result turn
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

    return NextResponse.json({ response: finalText, liveData })
  } catch (err: unknown) {
    console.error('[assistant/chat]', err)
    return NextResponse.json({ error: 'Assistant unavailable' }, { status: 500 })
  }
}
