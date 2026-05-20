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

  const systemPrompt = `You are NEXUS, the personal AI assistant built into the GateGuard dealer portal. You are concise, direct, and helpful. You know the portal inside-out and can answer questions, look up data, remind about tasks, and navigate the user to the right page.

USER: ${userName || user?.name || 'Dealer'} (${user?.role || 'dealer'})
CURRENT PAGE: ${currentPage || '/'}
TODAY: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

${PORTAL_NAV}
${dataContext}

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
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ response: text, liveData })
  } catch (err: unknown) {
    console.error('[assistant/chat]', err)
    return NextResponse.json({ error: 'Assistant unavailable' }, { status: 500 })
  }
}
