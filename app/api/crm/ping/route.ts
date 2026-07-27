import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

// Health check for the leads table. Corporate-only, and it returns a COUNT only —
// it used to leak a sample of lead names + emails to any caller.
export async function GET() {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return NextResponse.json({ ok: false, error: 'Missing env vars', url: !!url, key: !!key })
  }

  try {
    const supabase = createClient(url, key)
    const { error, count } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)              // hide soft-deleted (in Deleted Items)

    if (error) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code, hint: error.hint })
    }

    return NextResponse.json({ ok: true, count })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message })
  }
}
