import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET /api/playbooks/templates
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') // 'site_job' | 'dev_rd'

    let query = supabase
      .from('playbook_templates')
      .select('id, type, name, description, category, steps, is_system')
      .order('name')

    if (type) query = query.eq('type', type)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ templates: data ?? [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ templates: [], error: msg }, { status: 500 })
  }
}
