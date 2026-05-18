/**
 * GET /api/document-templates
 * Returns all active document templates (authenticated portal users only).
 * Used by the "Send for Signature" form to show available docs + auto-fill version.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await getCurrentUser() // ensure authenticated
    const { data, error } = await supabase
      .from('document_templates')
      .select('id, document_type, applies_to, version, public_url, is_active, notes')
      .order('document_type')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ templates: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
