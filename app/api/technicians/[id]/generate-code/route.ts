import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { generateTechCodeLocal } from '@/lib/tech-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

/**
 * POST /api/technicians/[id]/generate-code
 * Generates (or regenerates) a unique 8-char access code for a technician.
 * Returns { tech_code: string }
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await getCurrentUser() // auth check

    // Generate a code that doesn't already exist
    let code = ''
    let attempts = 0
    while (attempts < 10) {
      code = generateTechCodeLocal()
      const { data: existing } = await supabase
        .from('technicians')
        .select('id')
        .eq('tech_code', code)
        .maybeSingle()
      if (!existing) break
      attempts++
    }

    if (!code) {
      return NextResponse.json({ error: 'Could not generate unique code' }, { status: 500 })
    }

    const { data, error } = await supabase
      .from('technicians')
      .update({
        tech_code: code,
        tech_code_generated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select('id, name, tech_code')
      .single()

    if (error) {
      console.error('[generate-code]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tech_code: data.tech_code, name: data.name })
  } catch (err) {
    console.error('[generate-code] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
