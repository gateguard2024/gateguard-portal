import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { executeToolWithRevert } from '@/lib/assistant-executor'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await getCurrentUser()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { toolName: string; toolArgs: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { toolName, toolArgs } = body

  if (!toolName || typeof toolName !== 'string') {
    return NextResponse.json({ error: 'toolName is required' }, { status: 400 })
  }
  if (!toolArgs || typeof toolArgs !== 'object' || Array.isArray(toolArgs)) {
    return NextResponse.json({ error: 'toolArgs must be an object' }, { status: 400 })
  }

  try {
    const result = await executeToolWithRevert(toolName, toolArgs)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[assistant/execute]', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
