/**
 * Two-way job texts over Gate Guard's Twilio number (table wo_texts, migration 212).
 *
 *   sendJobText()        send one text and save it on the job's thread (awaited, error-checked)
 *   logJobText()         save a text that was sent some other way (status texts)
 *   matchInbound()       which job a customer's reply belongs to
 *   verifyTwilio()       check the X-Twilio-Signature on the incoming-text webhook
 *
 * Server only (reads Twilio + Supabase service keys).
 */
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const OPEN_WO = ['open', 'scheduled', 'in_progress', 'procurement', 'stuck', 'on_hold', 'in_route', 'on_site']

export const toE164 = (raw: unknown): string | null => {
  const d = String(raw ?? '').replace(/\D/g, '')
  return d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith('1') ? `+${d}` : null
}
export const maskPhone = (p: string) => p.replace(/\d(?=\d{4})/g, '•')
const last10 = (p: string) => p.replace(/\D/g, '').slice(-10)

export type TextKind = 'manual' | 'update' | 'status' | 'inbound'

/** Raw Twilio send. Never throws. */
export async function twilioSend(to: string, body: string): Promise<{ ok: true; sid: string | null } | { ok: false; error: string }> {
  const SID = process.env.TWILIO_ACCOUNT_SID, TOKEN = process.env.TWILIO_AUTH_TOKEN, FROM = process.env.TWILIO_FROM_NUMBER
  if (!SID || !TOKEN || !FROM) return { ok: false, error: 'Texting isn’t set up yet (Twilio keys are missing).' }
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${SID}:${TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ From: FROM, To: to, Body: body }).toString(),
      signal: AbortSignal.timeout(10000),
    })
    const t = await res.text()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let j: any = {}; try { j = JSON.parse(t) } catch { /* not JSON */ }
    if (!res.ok) return { ok: false, error: j?.message ? String(j.message) : `Twilio said no (${res.status}).` }
    return { ok: true, sid: j?.sid ?? null }
  } catch { return { ok: false, error: 'Couldn’t reach Twilio.' } }
}

type JobRef = { work_order_id: string | null; site_id?: string | null; org_id?: string | null }

/** Save a text on the job thread. Returns an error message or null. */
export async function logJobText(row: JobRef & { direction: 'out' | 'in'; phone: string; body: string; kind: TextKind; status?: string; error?: string | null; twilio_sid?: string | null; author_name?: string | null }): Promise<string | null> {
  const { error } = await sb.from('wo_texts').insert({
    work_order_id: row.work_order_id, site_id: row.site_id ?? null, org_id: row.org_id ?? null,
    direction: row.direction, phone: row.phone, body: row.body.slice(0, 4000), kind: row.kind,
    status: row.status ?? null, error: row.error ?? null, twilio_sid: row.twilio_sid ?? null, author_name: row.author_name ?? null,
    read_at: row.direction === 'out' ? new Date().toISOString() : null,
  })
  if (!error) return null
  if (error.code === '23505') return null // same Twilio message already saved (webhook retry)
  return /wo_texts/.test(error.message) && /does not exist|schema cache/i.test(error.message) ? 'Job texts need migration 212.' : error.message
}

/** Send a text for a job and save it on the thread (also saved when it fails, so you can see it didn't go). */
export async function sendJobText(job: JobRef, phoneRaw: string, body: string, kind: TextKind, author: string | null): Promise<{ ok: boolean; error?: string; phone?: string; logError?: string | null }> {
  const phone = toE164(phoneRaw)
  if (!phone) return { ok: false, error: 'That phone number doesn’t look right.' }
  const text = body.trim().slice(0, 1500)
  if (!text) return { ok: false, error: 'Write the text first.' }
  const r = await twilioSend(phone, text)
  const logError = await logJobText({ ...job, direction: 'out', phone, body: text, kind, status: r.ok ? 'sent' : 'failed', error: r.ok ? null : r.error, twilio_sid: r.ok ? r.sid : null, author_name: author })
  return r.ok ? { ok: true, phone, logError } : { ok: false, error: r.error, phone, logError }
}

/**
 * Which job does a text from this number belong to?
 *  1. the job we last texted this number about (last 45 days)
 *  2. else: the newest open job at a site whose contact / property manager has this number
 */
export async function matchInbound(phone: string): Promise<{ work_order_id: string | null; site_id: string | null; org_id: string | null }> {
  const none = { work_order_id: null, site_id: null, org_id: null }
  const since = new Date(Date.now() - 45 * 86400000).toISOString()
  const { data: recent } = await sb.from('wo_texts').select('work_order_id, site_id, org_id').eq('phone', phone).eq('direction', 'out').not('work_order_id', 'is', null).gte('created_at', since).order('created_at', { ascending: false }).limit(1)
  if (recent?.[0]?.work_order_id) return { work_order_id: recent[0].work_order_id, site_id: recent[0].site_id ?? null, org_id: recent[0].org_id ?? null }
  const tail = last10(phone).slice(-4)
  if (!tail) return none
  const { data: sites } = await sb.from('sites').select('id, primary_contact_phone, pm_phone').or(`primary_contact_phone.ilike.%${tail},pm_phone.ilike.%${tail}`).limit(50)
  const ids = (sites ?? []).filter(s => [s.primary_contact_phone, s.pm_phone].some(p => p && last10(String(p)) === last10(phone))).map(s => s.id)
  if (!ids.length) return none
  const { data: wo } = await sb.from('work_orders').select('id, site_id, org_id').in('site_id', ids).in('status', OPEN_WO).order('created_at', { ascending: false }).limit(1)
  if (wo?.[0]) return { work_order_id: wo[0].id, site_id: wo[0].site_id ?? null, org_id: wo[0].org_id ?? null }
  return { work_order_id: null, site_id: ids[0], org_id: null }
}

/** Twilio request signature: base64(HMAC-SHA1(authToken, url + each POST param name+value sorted by name)). */
export function verifyTwilio(url: string, params: Record<string, string>, signature: string | null): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!token || !signature) return false
  const data = url + Object.keys(params).sort().map(k => k + params[k]).join('')
  const expected = crypto.createHmac('sha1', token).update(Buffer.from(data, 'utf-8')).digest('base64')
  const a = Buffer.from(expected), b = Buffer.from(signature)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
