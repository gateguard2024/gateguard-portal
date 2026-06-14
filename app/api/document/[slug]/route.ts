/**
 * /api/document/[slug] — public resolver + actions for the Nexus Document Portal.
 *
 * GET  → resolves public_slug → document_signatures record; returns ONLY
 *        public-safe review fields shaped by status. The token is NEVER returned.
 * POST → { action: 'sign' | 'approve' | 'decline' | 'request_changes' | 'ask_question' }
 *        Server finds the record by slug and performs the action server-side, so
 *        the secret token never leaves the server. The slug (random + exact
 *        company/date prefix) + rate-limiting (Phase 5) is the link credential.
 *
 * No Clerk auth (middleware-bypassed) — the link is the credential.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { resolveDocView, docKind, docTypeLabel } from '@/lib/doc-status'

export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const resend = new Resend(process.env.RESEND_API_KEY)
const NOTIFY_TO = 'rfeldman@gateguard.co'
const NOTIFY_FROM = process.env.RESEND_DOCUMENTS_FROM_EMAIL ?? 'GateGuard Nexus <documents@nexus.gateguard.co>'

const PUBLIC_FIELDS =
  'id, document_type, status, public_slug, signer_name, signer_company, sent_by_name, ' +
  'document_html, document_url, executed_cert_url, signed_at, countersigned_at, executed_at, expires_at'

async function findBySlug(slug: string) {
  const { data } = await supabase
    .from('document_signatures')
    .select('*')
    .eq('public_slug', slug)
    .maybeSingle()
  return data
}

function isExpired(sig: any): boolean {
  return !!sig.expires_at && new Date(sig.expires_at) < new Date() && sig.status === 'pending'
}

async function notify(subject: string, lines: string[]) {
  if (!process.env.RESEND_API_KEY) return
  try {
    await resend.emails.send({
      from: NOTIFY_FROM, to: NOTIFY_TO, replyTo: NOTIFY_TO, subject,
      html: `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:14px;color:#0f172a;">${lines.map(l => `<p style="margin:0 0 8px;">${l}</p>`).join('')}</div>`,
    })
  } catch { /* non-blocking */ }
}

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const sig = await findBySlug(params.slug)
  if (!sig) {
    return NextResponse.json({ ok: false, reason: 'unavailable', message: 'This document link is not available.' }, { status: 404 })
  }

  // Lazily mark expired pending docs.
  if (isExpired(sig)) {
    await supabase.from('document_signatures').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', sig.id)
    sig.status = 'expired'
  }

  const view = resolveDocView(sig.document_type, sig.status, { expired: sig.status === 'expired' })

  return NextResponse.json({
    ok: true,
    view,
    document: {
      document_type: sig.document_type,
      type_label: docTypeLabel(sig.document_type),
      status: sig.status,
      recipient_name: sig.signer_name ?? null,
      recipient_company: sig.signer_company ?? null,
      sent_by_name: sig.sent_by_name ?? 'GateGuard',
      document_html: sig.document_html ?? null,
      document_url: sig.document_url ?? null,
      executed_cert_url: sig.executed_cert_url ?? null,
      signed_at: sig.signed_at ?? null,
      executed_at: sig.executed_at ?? null,
    },
  })
}

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const sig = await findBySlug(params.slug)
  if (!sig) return NextResponse.json({ ok: false, message: 'Document not available.' }, { status: 404 })
  if (isExpired(sig)) {
    await supabase.from('document_signatures').update({ status: 'expired' }).eq('id', sig.id)
    return NextResponse.json({ ok: false, message: 'This link has expired.' }, { status: 410 })
  }

  const body = await req.json().catch(() => ({}))
  const action = body.action as string
  const now = new Date().toISOString()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown'
  const ua = req.headers.get('user-agent') ?? ''
  const label = docTypeLabel(sig.document_type)
  const who = sig.signer_company || sig.signer_name || 'A recipient'

  // ── Signature documents: sign ──
  if (action === 'sign') {
    if (docKind(sig.document_type) !== 'signature') return NextResponse.json({ ok: false, message: 'Not a signable document.' }, { status: 400 })
    if (sig.status !== 'pending') return NextResponse.json({ ok: false, message: `Already ${sig.status}.` }, { status: 409 })
    const signedName = (body.signed_name ?? '').trim()
    if (!signedName) return NextResponse.json({ ok: false, message: 'Your full name is required.' }, { status: 400 })

    const { error } = await supabase.from('document_signatures').update({
      status: 'counterparty_signed',
      signed_name: signedName,
      signed_title: (body.signed_title ?? '').trim() || null,
      signed_ip: ip, signed_user_agent: ua, signed_at: now, notification_sent_at: now, updated_at: now,
    }).eq('id', sig.id)
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 })

    await notify(`ACTION REQUIRED: Countersign ${label} — ${who}`, [
      `<strong>${signedName}</strong> signed the ${label} for <strong>${who}</strong>.`,
      'It now needs GateGuard countersignature to be fully executed.',
    ])
    return NextResponse.json({ ok: true, status: 'counterparty_signed' })
  }

  // ── Proposals: approve / decline / request changes / ask a question ──
  if (action === 'approve') {
    if (docKind(sig.document_type) !== 'proposal') return NextResponse.json({ ok: false, message: 'Not a proposal.' }, { status: 400 })
    if (sig.status !== 'pending') return NextResponse.json({ ok: false, message: `Already ${sig.status}.` }, { status: 409 })
    const { error } = await supabase.from('document_signatures').update({
      status: 'fully_executed',
      signed_name: (body.signed_name ?? sig.signer_name ?? '').trim() || null,
      signed_ip: ip, signed_user_agent: ua, signed_at: now, executed_at: now, updated_at: now,
    }).eq('id', sig.id)
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
    // Sync the linked quote into the sales path.
    if (sig.quote_id) {
      await supabase.from('quotes').update({ status: 'accepted', accepted_at: now, updated_at: now }).eq('id', sig.quote_id)
    }
    await notify(`Proposal APPROVED — ${who}`, [`<strong>${who}</strong> approved the proposal.`])
    return NextResponse.json({ ok: true, status: 'fully_executed' })
  }

  if (action === 'decline') {
    if (sig.status !== 'pending') return NextResponse.json({ ok: false, message: `Already ${sig.status}.` }, { status: 409 })
    const { error } = await supabase.from('document_signatures').update({ status: 'declined', updated_at: now }).eq('id', sig.id)
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
    await notify(`Declined: ${label} — ${who}`, [`<strong>${who}</strong> declined the ${label}.`, body.message ? `Note: ${String(body.message)}` : ''])
    return NextResponse.json({ ok: true, status: 'declined' })
  }

  if (action === 'request_changes' || action === 'ask_question') {
    const msg = (body.message ?? '').trim()
    if (!msg) return NextResponse.json({ ok: false, message: 'Please include a message.' }, { status: 400 })
    const verb = action === 'request_changes' ? 'requested changes to' : 'asked a question about'
    await notify(`${action === 'request_changes' ? 'Changes requested' : 'Question'}: ${label} — ${who}`, [
      `<strong>${who}</strong> ${verb} the ${label}.`,
      `Message: ${msg}`,
    ])
    return NextResponse.json({ ok: true, status: sig.status })
  }

  return NextResponse.json({ ok: false, message: 'Unknown action.' }, { status: 400 })
}
