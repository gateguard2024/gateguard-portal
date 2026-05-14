import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return NextResponse.json({ ok: false, error: 'Missing env vars', url: !!url, key: !!key })
  }

  try {
    const supabase = createClient(url, key)
    const { data, error, count } = await supabase
      .from('show_leads')
      .select('id, name, email, created_at', { count: 'exact' })
      .limit(3)

    if (error) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code, hint: error.hint })
    }

    return NextResponse.json({ ok: true, count, sample: data })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message })
  }
}
