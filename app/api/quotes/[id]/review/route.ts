/**
 * POST /api/quotes/[id]/review — dealer proposal review gate.
 *
 * Body: { action: 'submit' | 'approve' | 'request_changes', note? }
 *   submit          — the proposal owner (or corporate) sends it for review →
 *                     status 'pending', emails the GateGuard review team.
 *   approve         — CORPORATE only → status 'approved', unlocks the client
 *                     link + PDF, emails the creator that it's cleared to send.
 *   request_changes — CORPORATE only → status 'changes_requested' + note,
 *                     emails the creator.
 *
 * The client-facing proposal link and PDF stay locked until 'approved'
 * (enforced in /api/quotes/[id]/public and the editor).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'
// Who reviews dealer proposals. Comma-separated env override, else Russel.
const REVIEW_TEAM = (process.env.REVIEW_TEAM_EMAILS || 'rfeldman@gateguard.co')
  .split(',').map(s => s.trim()).filter(Boolean)

async function sendEmail(to: string[], subject: string, html: string) {
  const key = process.env.RESEND_API_KEY
  if (!key || to.length === 0) return
  const from = process.env.RESEND_DOCUMENTS_FROM_EMAIL || 'documents@nexus.gateguard.co'
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `Gate Guard <${from}>`, to, subject, html }),
    })
  } catch { /* notification is best-effort */ }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user?.id || user.id === 'system') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const action = String(body.action || '')
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  const id = params.id

  const { data: quote, error } = await supabase
    .from('quotes')
    .select('id, quote_number, property_name, client_name, created_by, created_by_name, review_status, total_one_time, total_mrr')
    .eq('id', id)
    .single()
  if (error || !quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const label = quote.property_name || quote.client_name || quote.quote_number || 'Proposal'
  const editorLink = `${APP_URL}/quotes/${id}/partnership`
  const clientLink = `${APP_URL}/quotes/${id}/proposal`
  const ts = new Date().toISOString()

  if (action === 'submit') {
    const { error: uErr } = await supabase.from('quotes')
      .update({ review_status: 'pending', review_submitted_at: ts, updated_at: ts })
      .eq('id', id)
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })
    await sendEmail(
      REVIEW_TEAM,
      `📝 Proposal needs review — ${label}`,
      `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#0f1722">
        <h2 style="margin:0 0 8px">Dealer proposal submitted for review</h2>
        <p><b>${label}</b>${quote.quote_number ? ` · ${quote.quote_number}` : ''}</p>
        <p>Submitted by <b>${quote.created_by_name || user.id}</b>.</p>
        <p><a href="${editorLink}">Open in the editor to review</a> · <a href="${clientLink}">View as the client sees it</a></p>
        <p style="color:#5a6c84;font-size:13px">Approve it there to unlock sending, or request changes.</p>
      </div>`
    )
    return NextResponse.json({ ok: true, review_status: 'pending' })
  }

  // approve / request_changes are corporate-only
  if (action === 'approve' || action === 'request_changes') {
    if (!user.isCorporate) {
      return NextResponse.json({ error: 'Only GateGuard corporate can approve proposals.' }, { status: 403 })
    }
    const status = action === 'approve' ? 'approved' : 'changes_requested'
    const { error: uErr } = await supabase.from('quotes')
      .update({ review_status: status, reviewed_by: user.id, reviewed_at: ts, review_note: note || null, updated_at: ts })
      .eq('id', id)
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })

    // Notify the creator (look up their email from profiles).
    let creatorEmail = ''
    if (quote.created_by) {
      const { data: prof } = await supabase.from('profiles').select('email').eq('id', quote.created_by).maybeSingle()
      creatorEmail = prof?.email || ''
    }
    if (creatorEmail) {
      await sendEmail(
        [creatorEmail],
        action === 'approve' ? `✅ Approved — ${label} is cleared to send` : `↩️ Changes requested — ${label}`,
        `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#0f1722">
          <h2 style="margin:0 0 8px">${action === 'approve' ? 'Your proposal is approved' : 'Changes requested on your proposal'}</h2>
          <p><b>${label}</b>${quote.quote_number ? ` · ${quote.quote_number}` : ''}</p>
          ${note ? `<p style="padding:10px 12px;background:#f4f7fb;border-radius:8px"><b>Reviewer note:</b> ${note}</p>` : ''}
          <p>${action === 'approve' ? 'The client link and PDF are now unlocked — you can send it.' : 'Make the requested updates and submit for review again.'}</p>
          <p><a href="${editorLink}">Open the proposal</a></p>
        </div>`
      )
    }
    return NextResponse.json({ ok: true, review_status: status })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
