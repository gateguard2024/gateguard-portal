/**
 * GET  /api/nexus/messages/signature  → { signature }
 * PUT  /api/nexus/messages/signature  { signature }  → save the user's email signature
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { MAX_SIGNATURE_BYTES, cleanSignatureHtml, isHtmlSignature } from '@/lib/mail-signature'

export const dynamic = 'force-dynamic'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const user = await getCurrentUser()
  const { data } = await supabase.from('user_settings').select('email_signature').eq('user_id', user.id).maybeSingle()
  return NextResponse.json({ signature: data?.email_signature ?? '' })
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser()
  const body = await req.json().catch(() => ({}))
  const raw = typeof body.signature === 'string' ? body.signature : ''
  if (raw.length > MAX_SIGNATURE_BYTES) return NextResponse.json({ error: 'That signature is too big — use a smaller picture (under about 400 KB).' }, { status: 413 })
  const signature = isHtmlSignature(raw) ? cleanSignatureHtml(raw) : raw
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: user.id, email_signature: signature }, { onConflict: 'user_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
