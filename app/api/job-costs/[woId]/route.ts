import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

const DEFAULT_LABOR_RATE = 65 // $65/hr burdened rate

// GET /api/job-costs/[woId]
export async function GET(
  _req: NextRequest,
  { params }: { params: { woId: string } }
) {
  const { woId } = params

  // 1. Fetch manual cost entries
  const { data: manualCosts } = await supabase
    .from('job_costs')
    .select('*')
    .eq('work_order_id', woId)
    .order('created_at', { ascending: true })

  // 2. Auto-compute labor from time entries
  let autoLaborTotal = 0
  const { data: timeEntries } = await supabase
    .from('work_order_time_entries')
    .select('id, duration_minutes, tech_name')
    .eq('work_order_id', woId)

  if (timeEntries && timeEntries.length > 0) {
    const totalMins = timeEntries.reduce((sum, te) => sum + (te.duration_minutes ?? 0), 0)
    autoLaborTotal = (totalMins / 60) * DEFAULT_LABOR_RATE
  }

  // 3. Auto-compute parts from work_order_parts
  let autoPartsTotal = 0
  const { data: partsUsed } = await supabase
    .from('work_order_parts')
    .select('id, part_name, quantity, unit_cost')
    .eq('work_order_id', woId)

  if (partsUsed && partsUsed.length > 0) {
    autoPartsTotal = partsUsed.reduce(
      (sum, p) => sum + ((p.quantity ?? 1) * (p.unit_cost ?? 0)),
      0
    )
  }

  // 4. Get quoted total from linked quote (if any)
  let quotedTotal = 0
  const { data: wo } = await supabase
    .from('work_orders')
    .select('quote_id')
    .eq('id', woId)
    .maybeSingle()

  if (wo?.quote_id) {
    const { data: lineItems } = await supabase
      .from('quote_line_items')
      .select('quantity, unit_price')
      .eq('quote_id', wo.quote_id)
    if (lineItems) {
      quotedTotal = lineItems.reduce(
        (sum, li) => sum + ((li.quantity ?? 1) * (li.unit_price ?? 0)),
        0
      )
    }
  }

  // 5. Aggregate manual costs
  const costs = manualCosts ?? []
  const manualLaborTotal = costs
    .filter(c => c.cost_type === 'labor')
    .reduce((s, c) => s + (c.total_cost ?? 0), 0)
  const manualPartsTotal = costs
    .filter(c => c.cost_type === 'parts')
    .reduce((s, c) => s + (c.total_cost ?? 0), 0)
  const manualOtherTotal = costs
    .filter(c => !['labor', 'parts'].includes(c.cost_type))
    .reduce((s, c) => s + (c.total_cost ?? 0), 0)

  // Use manual entries if present, otherwise use auto-computed
  const hasManualLabor = costs.some(c => c.cost_type === 'labor')
  const hasManualParts = costs.some(c => c.cost_type === 'parts')

  const actualLabor = hasManualLabor ? manualLaborTotal : autoLaborTotal
  const actualParts = hasManualParts ? manualPartsTotal : autoPartsTotal
  const actualOther = manualOtherTotal
  const actualTotal = actualLabor + actualParts + actualOther

  const marginDollars = quotedTotal - actualTotal
  const marginPercent = quotedTotal > 0 ? (marginDollars / quotedTotal) * 100 : 0

  let status: 'on_budget' | 'over_budget' | 'under_budget' = 'on_budget'
  if (quotedTotal > 0) {
    if (actualTotal > quotedTotal * 1.05) status = 'over_budget'
    else if (actualTotal < quotedTotal * 0.95) status = 'under_budget'
  }

  // Build synthetic rows for auto-computed items (so UI can show them)
  const syntheticRows: Record<string, unknown>[] = []
  if (!hasManualLabor && autoLaborTotal > 0 && timeEntries && timeEntries.length > 0) {
    const totalMins = timeEntries.reduce((sum, te) => sum + (te.duration_minutes ?? 0), 0)
    syntheticRows.push({
      id: 'auto-labor',
      cost_type: 'labor',
      description: `Labor — ${timeEntries.length} time entr${timeEntries.length === 1 ? 'y' : 'ies'}`,
      quantity: Math.round((totalMins / 60) * 100) / 100,
      unit_cost: DEFAULT_LABOR_RATE,
      total_cost: autoLaborTotal,
      source: 'time_entry',
    })
  }
  if (!hasManualParts && autoPartsTotal > 0 && partsUsed && partsUsed.length > 0) {
    syntheticRows.push({
      id: 'auto-parts',
      cost_type: 'parts',
      description: `Parts — ${partsUsed.length} item${partsUsed.length === 1 ? '' : 's'}`,
      quantity: 1,
      unit_cost: autoPartsTotal,
      total_cost: autoPartsTotal,
      source: 'parts_used',
    })
  }

  return NextResponse.json({
    costs: [...costs, ...syntheticRows],
    summary: {
      quoted_total:    quotedTotal,
      actual_labor:    actualLabor,
      actual_parts:    actualParts,
      actual_other:    actualOther,
      actual_total:    actualTotal,
      margin_dollars:  marginDollars,
      margin_percent:  marginPercent,
      status,
    },
  })
}

// POST /api/job-costs/[woId]
export async function POST(
  req: NextRequest,
  { params }: { params: { woId: string } }
) {
  const { woId } = params
  const body = await req.json()
  const { cost_type, description, quantity = 1, unit_cost } = body

  if (!cost_type || unit_cost == null) {
    return NextResponse.json({ error: 'cost_type and unit_cost are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('job_costs')
    .insert({
      work_order_id: woId,
      cost_type,
      description: description ?? null,
      quantity: Number(quantity),
      unit_cost: Number(unit_cost),
      source: 'manual',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cost: data }, { status: 201 })
}
