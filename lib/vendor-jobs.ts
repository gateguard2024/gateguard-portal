/**
 * Outside vendors (subcontractors) on jobs — migration 239. Keep the rules here.
 *
 *   Vendor list  = `subcontractors` (080). `org_id` NULL or the corporate company = Gate Guard's
 *                  own vendor; otherwise that dealer's vendor (they only see their own).
 *   Per job      = `work_order_subcontractors`: one row per job + vendor. Sending makes a
 *                  private link `/v/<secret>`; only sha256(secret) is stored. Resending makes
 *                  a NEW secret (the old link stops working). Links last 60 days; removing the
 *                  vendor from the job kills the link at once.
 *   No login     = the secret IS the access, and it opens only that one job, with only what
 *                  the vendor needs: property, address, gate/door, problem, access notes, gate
 *                  code, on-site contact. Never prices, customer billing or other jobs.
 *
 * Rules (decided Nov 23 2026):
 *   - WE set the date. The vendor can only REQUEST another day; staff Approve (the job's
 *     date changes) or Keep.
 *   - Vendor steps: Accept / Decline (why) → On my way → Arrived → Done (note + sign-off).
 *     Notes and photos land on the job. "Done" does NOT complete our job — staff still
 *     finish it (Finish job), so nothing is billed or closed on a vendor's word alone.
 *   - Their invoice (amount, number, note, file) → staff Approve → a `job_costs` row
 *     (cost_type 'subcontractor') + on Gate Guard jobs a QuickBooks vendor bill
 *     (lib/qbo-sync pushVendorBill, sent by the next sync / Sync now). Paid in QuickBooks
 *     → shown paid here. Reject (why) → they can fix and send again.
 *   - Staff are emailed (the person who sent it) when a vendor declines, asks for another
 *     day, finishes or sends an invoice.
 */
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email-sender'
import { toE164, twilioSend } from '@/lib/wo-texts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>
export const vdb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const LINK_DAYS = 60
export const PHOTO_BUCKET = 'work-order-photos'
export const VENDOR_STATUSES = ['sent', 'accepted', 'declined', 'on_the_way', 'arrived', 'done', 'cancelled'] as const
export type VendorStatus = typeof VENDOR_STATUSES[number]
export const STATUS_LABEL: Record<string, string> = {
  sent: 'Sent — waiting for answer', accepted: 'Accepted', declined: 'Declined', on_the_way: 'On the way',
  arrived: 'On site', done: 'Done (by vendor)', cancelled: 'Removed',
}
const STEP_ORDER: Record<string, number> = { sent: 0, accepted: 1, on_the_way: 2, arrived: 3, done: 4 }

export const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex')
export function newToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(24).toString('base64url')   // 192 bits
  return { token, hash: hashToken(token) }
}
export const linkUrl = (origin: string, token: string) => `${origin.replace(/\/$/, '')}/v/${token}`
const clean = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const isoDate = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
const nice = (d: string | null | undefined) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'not set yet')
export const vendorName = (v: Row | null | undefined) => String(v?.company || v?.name || 'Vendor')
export const money2 = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100

/** Which vendors a staff member may pick for a job. */
export async function vendorsFor(user: { isCorporate?: boolean; org_id?: string | null }, jobOrgId: string | null): Promise<Row[]> {
  const db = vdb()
  let q = db.from('subcontractors').select('id, org_id, name, company, email, phone, trade, status, insurance_expiry, license_expiry, w9_on_file, rate_note, notes').neq('status', 'suspended').order('company').order('name').limit(500)
  if (user.isCorporate) {
    const ids = [user.org_id, jobOrgId].filter(Boolean) as string[]
    q = ids.length ? q.or(`org_id.is.null,org_id.in.(${ids.join(',')})`) : q.is('org_id', null)
  } else {
    if (!user.org_id) return []
    q = q.eq('org_id', user.org_id)
  }
  let { data, error } = await q
  if (error && /w9_on_file|rate_note|notes/.test(error.message)) {
    ({ data, error } = await db.from('subcontractors').select('*').neq('status', 'suspended').limit(500))
    if (!error) data = (data ?? []).filter((v: Row) => user.isCorporate ? (!v.org_id || v.org_id === user.org_id || v.org_id === jobOrgId) : v.org_id === user.org_id)
  }
  if (error) throw new Error(error.message)
  return (data ?? []) as Row[]
}

/** Insurance / W-9 warnings for a vendor (shown to staff before sending). */
export function vendorWarnings(v: Row, today = new Date().toISOString().slice(0, 10)): string[] {
  const out: string[] = []
  const soon = new Date(Date.parse(today) + 30 * 86400000).toISOString().slice(0, 10)
  if (v.insurance_expiry && v.insurance_expiry < today) out.push(`Insurance expired ${nice(v.insurance_expiry)}`)
  else if (v.insurance_expiry && v.insurance_expiry <= soon) out.push(`Insurance ends ${nice(v.insurance_expiry)}`)
  else if (!v.insurance_expiry) out.push('No insurance date on file')
  if (v.license_expiry && v.license_expiry < today) out.push(`License expired ${nice(v.license_expiry)}`)
  if (v.w9_on_file === false) out.push('No W-9 on file')
  return out
}

/** Put a line on the job's comments (the job timeline). */
export async function logOnJob(woId: string, text: string, author: string): Promise<void> {
  const initials = author.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || 'VN'
  const { error } = await vdb().from('wo_comments').insert({ work_order_id: woId, content: text.slice(0, 4000), author_name: author, author_initials: initials })
  if (error) console.error('[vendor-jobs] job note failed', error.message)
}

/** Text and/or email the vendor. Returns what went out. */
export async function tellVendor(v: Row, subject: string, text: string, html: string, via: ('text' | 'email')[] = ['text', 'email']): Promise<{ sent: string[]; errors: string[] }> {
  const sent: string[] = [], errors: string[] = []
  if (via.includes('text')) {
    const to = toE164(v.phone)
    if (!to) { if (v.phone) errors.push('The vendor’s phone number doesn’t look right.') }
    else { const r = await twilioSend(to, text); if (r.ok) sent.push('text'); else errors.push(`Text: ${r.error}`) }
  }
  if (via.includes('email')) {
    if (v.email) {
      const r = await sendEmail({ to: String(v.email), subject, html })
      if (r.success) sent.push('email'); else errors.push(`Email: ${r.error ?? 'not sent'}`)
    }
  }
  return { sent, errors }
}

/** Email the staff member who sent the job (and nothing else) — e.g. "Vendor asked for another day". */
async function tellStaff(link: Row, subject: string, line: string, origin: string): Promise<void> {
  const to = String(link.sent_by ?? '')
  if (!/@/.test(to)) return
  const r = await sendEmail({ to, subject, html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#1d1d1f">
    <p>${esc(line)}</p><p><a href="${esc(origin)}/?tab=jobs&job=${esc(link.work_order_id)}" style="color:#0071e3">Open the job in Nexus</a></p></div>` })
  if (!r.success) console.error('[vendor-jobs] staff email failed', r.error)
}

// ── Staff side ────────────────────────────────────────────────────────────────

type Staff = { id: string; name?: string | null; email?: string | null }

/** Send (or resend) a job to a vendor. Makes a new private link every time. */
export async function sendJobToVendor(opts: {
  wo: Row; site: Row | null; vendor: Row; staff: Staff; origin: string; via: ('text' | 'email')[]; message?: string
}): Promise<{ link: Row; url: string; sent: string[]; errors: string[] }> {
  const { wo, site, vendor, staff, origin, via } = opts
  const db = vdb()
  const { token, hash } = newToken()
  const now = new Date()
  const { data: existing, error: exErr } = await db.from('work_order_subcontractors').select('*').eq('work_order_id', wo.id).eq('subcontractor_id', vendor.id).maybeSingle()
  if (exErr) throw new Error(exErr.message)
  const fresh = !existing || ['declined', 'cancelled'].includes(String(existing.status))
  const patch: Row = {
    token_hash: hash, link_expires_at: new Date(now.getTime() + LINK_DAYS * 86400000).toISOString(), revoked_at: null,
    sent_at: now.toISOString(), sent_by: staff.email || staff.id, sent_via: via, updated_at: now.toISOString(),
    ...(fresh ? { status: 'sent', status_at: now.toISOString(), decline_reason: null, requested_date: null, request_note: null, request_status: null } : {}),
  }
  let link: Row
  if (existing) {
    const { data, error } = await db.from('work_order_subcontractors').update(patch).eq('id', existing.id).select('*').single()
    if (error) throw new Error(error.message)
    link = data as Row
  } else {
    const { data, error } = await db.from('work_order_subcontractors').insert({ work_order_id: wo.id, subcontractor_id: vendor.id, notes: clean(opts.message, 1000) || null, ...patch }).select('*').single()
    if (error) throw new Error(error.message)
    link = data as Row
  }
  const url = linkUrl(origin, token)
  const where = [site?.name, site?.city].filter(Boolean).join(', ')
  const job = [wo.wo_number, wo.title].filter(Boolean).join(' · ') || 'Service job'
  const note = clean(opts.message, 600)
  const text = `Gate Guard job for ${vendorName(vendor)}: ${job}${where ? ` at ${where}` : ''}. Date: ${nice(wo.scheduled_date)}.${note ? ` ${note}` : ''} Open it here (no login): ${url}`
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#1d1d1f;max-width:560px">
    <p>Hi ${esc(vendor.name || vendorName(vendor))},</p>
    <p>Gate Guard has a job for you:</p>
    <p style="font-size:17px;font-weight:600;margin:6px 0">${esc(job)}</p>
    <p style="margin:0;color:#3a3a3c">${esc(where)}<br>Date: <b>${esc(nice(wo.scheduled_date))}</b></p>
    ${note ? `<p style="background:#f5f5f7;border-radius:10px;padding:10px 12px">${esc(note)}</p>` : ''}
    <p><a href="${esc(url)}" style="display:inline-block;background:#0071e3;color:#fff;text-decoration:none;font-weight:600;padding:11px 18px;border-radius:10px">Open the job</a></p>
    <p style="font-size:13px;color:#6e6e73">No login needed — this link is just for you and this job. Accept it, ask for a different day if you need to, send updates and photos, and send your invoice when you’re done.</p></div>`
  const r = await tellVendor(vendor, `Gate Guard job: ${job}`, text, html, via)
  await logOnJob(wo.id, `Sent to vendor ${vendorName(vendor)}${r.sent.length ? ` by ${r.sent.join(' + ')}` : ' (link copied — nothing sent automatically)'}.${existing && !fresh ? ' New link — the old one no longer works.' : ''}`, staff.name || 'Gate Guard')
  return { link, url, sent: r.sent, errors: r.errors }
}

/** Take the job away from a vendor — the link stops working at once. */
export async function removeVendor(link: Row, staff: Staff, tell: boolean): Promise<string[]> {
  const now = new Date().toISOString()
  const { error } = await vdb().from('work_order_subcontractors').update({ revoked_at: now, status: 'cancelled', status_at: now, updated_at: now }).eq('id', link.id)
  if (error) throw new Error(error.message)
  const { data: v } = await vdb().from('subcontractors').select('*').eq('id', link.subcontractor_id).maybeSingle()
  await logOnJob(link.work_order_id, `Removed vendor ${vendorName(v)} from this job (their link no longer works).`, staff.name || 'Gate Guard')
  if (tell && v) { const r = await tellVendor(v, 'Gate Guard job cancelled', 'Gate Guard: the job we sent you has been cancelled or moved — no need to go. Thank you.', '<p>The job Gate Guard sent you has been cancelled or moved — no need to go. Thank you.</p>'); return r.errors }
  return []
}

/** Staff answer to a "different day" request. approve = the job's date changes. */
export async function answerDateRequest(link: Row, approve: boolean, staff: Staff): Promise<{ date: string | null; errors: string[] }> {
  if (link.request_status !== 'pending' || !link.requested_date) throw new Error('There’s no date request waiting.')
  const db = vdb()
  const now = new Date().toISOString()
  if (approve) {
    const { error } = await db.from('work_orders').update({ scheduled_date: link.requested_date, updated_at: now }).eq('id', link.work_order_id)
    if (error) throw new Error(error.message)
  }
  const { error } = await db.from('work_order_subcontractors').update({ request_status: approve ? 'approved' : 'kept', updated_at: now }).eq('id', link.id)
  if (error) throw new Error(error.message)
  const { data: wo } = await db.from('work_orders').select('scheduled_date, wo_number, title').eq('id', link.work_order_id).maybeSingle()
  const { data: v } = await db.from('subcontractors').select('*').eq('id', link.subcontractor_id).maybeSingle()
  const date = (wo?.scheduled_date as string | null) ?? null
  await logOnJob(link.work_order_id, approve ? `Approved ${vendorName(v)}’s request — job moved to ${nice(date)}.` : `Kept the date (${nice(date)}) — ${vendorName(v)} asked for ${nice(link.requested_date)}.`, staff.name || 'Gate Guard')
  const msg = approve ? `Gate Guard: OK — the job is now ${nice(date)}.` : `Gate Guard: we need to keep the job on ${nice(date)}. Please let us know if you can’t make it.`
  const r = v ? await tellVendor(v, approve ? 'Gate Guard: new date confirmed' : 'Gate Guard: job date stays the same', msg, `<p>${esc(msg.replace(/^Gate Guard: /, ''))}</p>`) : { errors: [] as string[] }
  return { date, errors: r.errors }
}

/** Approve the vendor's invoice → job cost (+ QuickBooks bill on Gate Guard jobs, by the sync). */
export async function approveInvoice(link: Row, wo: Row, staff: Staff): Promise<Row> {
  if (link.invoice_status !== 'submitted') throw new Error('There’s no invoice waiting for approval.')
  const db = vdb()
  const { data: v } = await db.from('subcontractors').select('*').eq('id', link.subcontractor_id).maybeSingle()
  const amount = money2(link.invoice_amount)
  const { data: cost, error: cErr } = await db.from('job_costs').insert({
    work_order_id: wo.id, org_id: wo.org_id ?? null, cost_type: 'subcontractor',
    description: `Vendor: ${vendorName(v)}${link.invoice_number ? ` — invoice ${link.invoice_number}` : ''}`.slice(0, 500),
    quantity: 1, unit_cost: amount, source: 'auto', source_id: link.id,
  }).select('id').single()
  if (cErr) throw new Error(`Couldn’t add it to job costs: ${cErr.message}`)
  const now = new Date().toISOString()
  const { data, error } = await db.from('work_order_subcontractors').update({ invoice_status: 'approved', invoice_approved_at: now, invoice_approved_by: staff.email || staff.id, invoice_reject_reason: null, job_cost_id: cost!.id, updated_at: now }).eq('id', link.id).eq('invoice_status', 'submitted').select('*').maybeSingle()
  if (error || !data) {
    await db.from('job_costs').delete().eq('id', cost!.id)   // someone else answered first — undo our cost row
    throw new Error(error?.message ?? 'That invoice was already answered.')
  }
  await logOnJob(wo.id, `Approved ${vendorName(v)}’s invoice${link.invoice_number ? ` ${link.invoice_number}` : ''}: $${amount.toFixed(2)} — added to job costs.`, staff.name || 'Gate Guard')
  return data as Row
}

export async function rejectInvoice(link: Row, reason: string, staff: Staff): Promise<string[]> {
  if (link.invoice_status !== 'submitted') throw new Error('There’s no invoice waiting for approval.')
  const why = clean(reason, 500)
  if (!why) throw new Error('Say why, so the vendor can fix it.')
  const now = new Date().toISOString()
  const { error } = await vdb().from('work_order_subcontractors').update({ invoice_status: 'rejected', invoice_reject_reason: why, updated_at: now }).eq('id', link.id)
  if (error) throw new Error(error.message)
  const { data: v } = await vdb().from('subcontractors').select('*').eq('id', link.subcontractor_id).maybeSingle()
  await logOnJob(link.work_order_id, `Sent back ${vendorName(v)}’s invoice: ${why}`, staff.name || 'Gate Guard')
  const msg = `Gate Guard needs a change to your invoice: ${why}. Open the job link we sent to fix and resend it.`
  return v ? (await tellVendor(v, 'Gate Guard: please update your invoice', msg, `<p>${esc(msg)}</p>`)).errors : []
}

// ── Vendor side (the private link) ────────────────────────────────────────────

export type Resolved = { link: Row; vendor: Row; wo: Row; site: Row | null }

/** Find the job for a link secret. null = no such link; { gone } = expired / removed. */
export async function resolveToken(token: string): Promise<Resolved | { gone: string } | null> {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return null
  const db = vdb()
  const { data: link, error } = await db.from('work_order_subcontractors').select('*').eq('token_hash', hashToken(token)).maybeSingle()
  if (error || !link) return null
  if (link.revoked_at || link.status === 'cancelled') return { gone: 'This job was taken off your list. If you think that’s a mistake, call Gate Guard.' }
  if (link.link_expires_at && Date.parse(link.link_expires_at) < Date.now()) return { gone: 'This link has expired. Ask Gate Guard to send it again.' }
  const [{ data: vendor }, { data: wo }] = await Promise.all([
    db.from('subcontractors').select('*').eq('id', link.subcontractor_id).maybeSingle(),
    db.from('work_orders').select('*').eq('id', link.work_order_id).maybeSingle(),
  ])
  if (!vendor || !wo) return null
  if (vendor.status === 'suspended') return { gone: 'Your vendor account is on hold. Please call Gate Guard.' }
  const { data: site } = wo.site_id ? await db.from('sites').select('*').eq('id', wo.site_id).maybeSingle() : { data: null }
  return { link, vendor, wo, site: (site as Row) ?? null }
}

/** Only what the vendor needs. Never prices, customer billing, internal notes or other jobs. */
export async function vendorView(r: Resolved): Promise<Row> {
  const { link, vendor, wo, site } = r
  const db = vdb()
  const [{ data: op }, { data: photos }] = await Promise.all([
    wo.opening_id ? db.from('site_openings').select('name').eq('id', wo.opening_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from('work_order_photos').select('id, file_url, file_name, created_at, uploaded_by').eq('work_order_id', wo.id).order('created_at', { ascending: false }).limit(60),
  ])
  const mine = `Vendor · ${vendorName(vendor)}`
  return {
    vendor: { name: vendor.name, company: vendor.company },
    job: {
      number: wo.wo_number ?? null, title: wo.title ?? 'Service job', problem: wo.description ?? null,
      priority: wo.priority ?? null, date: wo.scheduled_date ? String(wo.scheduled_date).slice(0, 10) : null,
      gate: (op as Row | null)?.name ?? wo.area ?? null, closed: ['completed', 'cancelled', 'closed'].includes(String(wo.status ?? '').toLowerCase()),
    },
    site: site ? {
      name: site.name ?? null, address: [site.address, [site.city, site.state].filter(Boolean).join(', '), site.zip].filter(Boolean).join(' · ') || null,
      maps: site.address ? `https://maps.google.com/?q=${encodeURIComponent([site.address, site.city, site.state, site.zip].filter(Boolean).join(' '))}` : null,
      gate_code: site.gate_code ?? null, access_notes: site.access_notes ?? null,
      contact: site.pm_name || site.primary_contact_name || null, contact_phone: site.pm_phone || site.primary_contact_phone || null,
    } : null,
    link: {
      status: link.status ?? 'sent', decline_reason: link.decline_reason ?? null,
      requested_date: link.requested_date ?? null, request_note: link.request_note ?? null, request_status: link.request_status ?? null,
      done_note: link.done_note ?? null, signoff_name: link.signoff_name ?? null,
      invoice: link.invoice_status ? { status: link.invoice_status, amount: link.invoice_amount != null ? Number(link.invoice_amount) : null, number: link.invoice_number ?? null, note: link.invoice_note ?? null, file_url: link.invoice_file_url ?? null, reject_reason: link.invoice_reject_reason ?? null, paid_at: link.paid_at ?? null } : null,
    },
    photos: ((photos ?? []) as Row[]).filter((p) => p.uploaded_by === mine).map((p) => ({ id: p.id, url: p.file_url, name: p.file_name, at: p.created_at })),
  }
}

/** One vendor action. Returns a short message for the screen. */
export async function vendorAct(r: Resolved, body: Row, origin: string): Promise<{ message: string; signedUrl?: string; publicUrl?: string }> {
  const { link, vendor, wo } = r
  const db = vdb()
  const action = clean(body.action, 40)
  const who = vendorName(vendor)
  const now = new Date().toISOString()
  const status = String(link.status ?? 'sent')
  const save = async (patch: Row) => {
    const { error } = await db.from('work_order_subcontractors').update({ ...patch, updated_at: now }).eq('id', link.id)
    if (error) throw new Error(error.message)
  }
  if (status === 'declined' && action !== 'accept') throw new Error('You declined this job. If that changed, tap Accept.')
  const closed = ['completed', 'cancelled', 'closed'].includes(String(wo.status ?? '').toLowerCase())
  if (closed && !['invoice', 'invoice_upload_url'].includes(action)) throw new Error('This job is closed — you can still send your invoice.')

  switch (action) {
    case 'accept': {
      if (status !== 'sent' && status !== 'declined') return { message: 'Already accepted.' }
      await save({ status: 'accepted', status_at: now, decline_reason: null })
      await logOnJob(wo.id, `${who} accepted the job.`, who)
      return { message: 'Thanks — you’re booked.' }
    }
    case 'decline': {
      const why = clean(body.reason, 500)
      if (!why) throw new Error('Tell us why, so we can find someone else.')
      if (STEP_ORDER[status] >= 2) throw new Error('You already started this job — call Gate Guard to hand it back.')
      await save({ status: 'declined', status_at: now, decline_reason: why })
      await logOnJob(wo.id, `${who} declined the job: ${why}`, who)
      await tellStaff(link, `Vendor declined: ${[wo.wo_number, wo.title].filter(Boolean).join(' · ')}`, `${who} declined the job — “${why}”. Send it to someone else.`, origin)
      return { message: 'Got it — we’ll find someone else. Thank you.' }
    }
    case 'request_date': {
      const date = isoDate(body.date)
      if (!date) throw new Error('Pick a day.')
      if (date < new Date().toISOString().slice(0, 10)) throw new Error('Pick a day from today on.')
      const note = clean(body.note, 500)
      await save({ requested_date: date, request_note: note || null, request_status: 'pending' })
      await logOnJob(wo.id, `${who} asked to do it ${nice(date)} instead of ${nice(wo.scheduled_date)}${note ? ` — ${note}` : ''}. Waiting on Gate Guard.`, who)
      await tellStaff(link, `Vendor asked for another day: ${[wo.wo_number, wo.title].filter(Boolean).join(' · ')}`, `${who} asked to do it ${nice(date)} instead of ${nice(wo.scheduled_date)}${note ? ` (“${note}”)` : ''}. Approve or keep the date in the job.`, origin)
      return { message: 'Sent — Gate Guard will confirm. Until then the job stays on the current date.' }
    }
    case 'on_the_way': case 'arrived': {
      if (STEP_ORDER[status] >= STEP_ORDER[action]) return { message: 'Already marked.' }
      if (status === 'done') return { message: 'Already done.' }
      await save({ status: action, status_at: now })
      const eta = clean(body.eta, 40)
      await logOnJob(wo.id, action === 'on_the_way' ? `${who} is on the way${eta ? ` (ETA ${eta})` : ''}.` : `${who} arrived on site.`, who)
      return { message: action === 'on_the_way' ? 'Marked on the way.' : 'Marked on site.' }
    }
    case 'note': {
      const text = clean(body.text, 2000)
      if (!text) throw new Error('Write a note first.')
      await logOnJob(wo.id, `${who}: ${text}`, who)
      return { message: 'Note added to the job.' }
    }
    case 'photo_upload_url': case 'invoice_upload_url': {
      const isInv = action === 'invoice_upload_url'
      const raw = String(body.filename ?? 'file').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
      const dot = raw.lastIndexOf('.')
      const ext = (dot > 0 ? raw.slice(dot + 1) : 'jpg').replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg'
      const okExt = isInv ? ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'webp'] : ['jpg', 'jpeg', 'png', 'heic', 'webp', 'gif']
      if (!okExt.includes(ext)) throw new Error(isInv ? 'Send a PDF or a picture of the invoice.' : 'That isn’t a picture.')
      const path = `${wo.id}/vendor-${link.id.slice(0, 8)}${isInv ? '-invoice' : ''}-${Date.now()}.${ext}`
      const st = db.storage.from(PHOTO_BUCKET)
      const { data, error } = await st.createSignedUploadUrl(path, { upsert: true })
      if (error || !data) throw new Error('Couldn’t start the upload — try again.')
      return { message: 'ok', signedUrl: data.signedUrl, publicUrl: st.getPublicUrl(path).data.publicUrl }
    }
    case 'photo': {
      const url = clean(body.url, 1000)
      if (!vendorFileOk(url, wo.id, link.id, false)) throw new Error('That photo didn’t upload — try again.')
      const { error } = await db.from('work_order_photos').insert({ work_order_id: wo.id, org_id: wo.org_id ?? null, file_url: url, file_name: clean(body.caption, 200) || 'Vendor photo', uploaded_by: `Vendor · ${who}` })
      if (error) throw new Error(error.message)
      return { message: 'Photo added.' }
    }
    case 'done': {
      if (STEP_ORDER[status] === undefined) throw new Error('Accept the job first.')
      if (status === 'done') return { message: 'Already marked done.' }
      const note = clean(body.note, 2000)
      if (!note) throw new Error('Tell us what you did.')
      const sign = clean(body.signoff_name, 120)
      const img = typeof body.signoff_image === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(body.signoff_image) && body.signoff_image.length < 300000 ? body.signoff_image : null
      await save({ status: 'done', status_at: now, done_note: note, signoff_name: sign || null, signoff_image: img })
      await logOnJob(wo.id, `${who} finished: ${note}${sign ? ` — signed off by ${sign}` : ''}. (Gate Guard still finishes the job.)`, who)
      await tellStaff(link, `Vendor finished: ${[wo.wo_number, wo.title].filter(Boolean).join(' · ')}`, `${who} says the job is done: “${note}”. Check it and finish the job in Nexus.`, origin)
      return { message: 'Thanks — marked done. Send your invoice below.' }
    }
    case 'invoice': {
      if (link.invoice_status === 'approved' || link.invoice_status === 'paid') throw new Error('Your invoice is already approved.')
      if (STEP_ORDER[status] === undefined) throw new Error('Accept the job first.')
      const amount = money2(String(body.amount ?? '').replace(/[$,\s]/g, ''))
      if (!(amount > 0) || amount > 1_000_000) throw new Error('Enter the invoice total.')
      const file = clean(body.file_url, 1000)
      if (file && !vendorFileOk(file, wo.id, link.id, true)) throw new Error('That file didn’t upload — try again.')
      await save({ invoice_amount: amount, invoice_number: clean(body.number, 40) || null, invoice_note: clean(body.note, 1000) || null, invoice_file_url: file || link.invoice_file_url || null, invoice_submitted_at: now, invoice_status: 'submitted', invoice_reject_reason: null })
      await logOnJob(wo.id, `${who} sent an invoice: $${amount.toFixed(2)}${body.number ? ` (#${clean(body.number, 40)})` : ''}. Waiting for approval.`, who)
      await tellStaff(link, `Vendor invoice to approve: ${[wo.wo_number, wo.title].filter(Boolean).join(' · ')}`, `${who} sent an invoice for $${amount.toFixed(2)}. Approve it in the job.`, origin)
      return { message: 'Invoice sent — we’ll let you know when it’s approved.' }
    }
  }
  throw new Error('Unknown action.')
}

/** A file URL the vendor may attach: in our bucket, under this job, made by this link. */
function vendorFileOk(url: string, woId: string, linkId: string, invoice: boolean): boolean {
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${woId}/vendor-${linkId.slice(0, 8)}${invoice ? '-invoice' : ''}-`
  return !!url && url.startsWith(base) && !url.includes('..')
}

/** Staff-facing summary of a job's vendor rows (no secrets). */
export function staffRow(l: Row, v: Row | null, scheduled: string | null): Row {
  const today = new Date().toISOString().slice(0, 10)
  const late = !!scheduled && String(scheduled).slice(0, 10) < today && ['sent', 'accepted'].includes(String(l.status))
  return {
    id: l.id, vendor_id: l.subcontractor_id, vendor: v ? { id: v.id, name: v.name, company: v.company, phone: v.phone, email: v.email, trade: v.trade } : null,
    status: l.status ?? (l.token_hash ? 'sent' : 'assigned'), status_label: STATUS_LABEL[String(l.status)] ?? 'Assigned (no link yet)', status_at: l.status_at ?? null,
    sent_at: l.sent_at ?? null, sent_via: l.sent_via ?? [], viewed_at: l.last_viewed_at ?? null, link_live: !!l.token_hash && !l.revoked_at && (!l.link_expires_at || Date.parse(l.link_expires_at) > Date.now()),
    link_expires_at: l.link_expires_at ?? null, late,
    decline_reason: l.decline_reason ?? null, requested_date: l.requested_date ?? null, request_note: l.request_note ?? null, request_status: l.request_status ?? null,
    done_note: l.done_note ?? null, signoff_name: l.signoff_name ?? null, signoff_image: l.signoff_image ?? null,
    invoice: l.invoice_status ? { status: l.invoice_status, amount: l.invoice_amount != null ? Number(l.invoice_amount) : null, number: l.invoice_number, note: l.invoice_note, file_url: l.invoice_file_url, submitted_at: l.invoice_submitted_at, reject_reason: l.invoice_reject_reason, approved_at: l.invoice_approved_at, qb_bill_id: l.qb_bill_id, qb_sync_error: l.qb_sync_error, paid_at: l.paid_at } : null,
  }
}
