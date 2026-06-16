// ════════════════════════════════════════════════════════════════════════════
// Two-way Google Calendar sync — reusable service (no request session required).
// Used by: the /api/calendar/google/sync route, the Inngest scheduled cron, and
// push-on-create hooks. Parameterized by userId so it works in any context.
//   PULL : Google Calendar events  → gcal_events
//   PUSH : todos + work_orders + calendar_events → Google Calendar (idempotent)
// ════════════════════════════════════════════════════════════════════════════
import { createClient, SupabaseClient } from '@supabase/supabase-js'

function db(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function getGcalAccessToken(refreshToken: string): Promise<{ token: string | null; error?: string }> {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET
  if (!clientId || !clientSecret) return { token: null, error: 'GOOGLE_CALENDAR_CLIENT_ID/SECRET not set' }
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }).toString(),
    })
    if (!res.ok) return { token: null, error: `token refresh failed (${res.status}): ${(await res.text()).slice(0, 120)}` }
    const data = await res.json() as { access_token?: string; error?: string }
    if (data.error) return { token: null, error: `oauth: ${data.error}` }
    return { token: data.access_token ?? null }
  } catch (e) { return { token: null, error: String(e) } }
}

const GCAL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

type SyncResult = { ok: boolean; pulled: number; pushed: number; pull_errors: number; push_errors: number; error?: string; diagnostics: string[] }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertGcalEvent(token: string, body: any, existingId?: string | null): Promise<string | null> {
  const res = await fetch(existingId ? `${GCAL}/${existingId}` : GCAL, {
    method: existingId ? 'PUT' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return null
  const j = await res.json().catch(() => ({})) as { id?: string }
  return existingId ?? j.id ?? null
}

export async function syncUserCalendar(userId: string): Promise<SyncResult> {
  const diagnostics: string[] = []
  const supabase = db()
  const res: SyncResult = { ok: false, pulled: 0, pushed: 0, pull_errors: 0, push_errors: 0, diagnostics }

  const { data: settings } = await supabase.from('user_settings').select('gcal_refresh_token').eq('user_id', userId).maybeSingle()
  if (!settings?.gcal_refresh_token) { res.error = 'not connected'; return res }

  const { token, error: tErr } = await getGcalAccessToken(settings.gcal_refresh_token)
  if (!token) { res.error = tErr ?? 'no access token'; return res }

  const now = new Date()
  const future = new Date(); future.setDate(future.getDate() + 30)
  const nowDate = now.toISOString().split('T')[0]
  const futureDate = future.toISOString().split('T')[0]

  // ── PULL ───────────────────────────────────────────────────────────────────
  try {
    const r = await fetch(`${GCAL}?` + new URLSearchParams({ timeMin: now.toISOString(), timeMax: future.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250' }), { headers: { Authorization: `Bearer ${token}` } })
    if (r.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: any[] = (await r.json()).items ?? []
      for (const item of items) {
        const isAllDay = !!item.start?.date && !item.start?.dateTime
        const startIso = item.start?.dateTime ?? (item.start?.date ? `${item.start.date}T00:00:00Z` : null)
        const endIso = item.end?.dateTime ?? (item.end?.date ? `${item.end.date}T00:00:00Z` : null)
        if (!startIso || !endIso) continue
        const { error: e } = await supabase.from('gcal_events').upsert({
          user_id: userId, gcal_event_id: item.id, gcal_calendar_id: 'primary',
          title: item.summary ?? '(No title)', description: item.description ?? null, location: item.location ?? null,
          start_time: startIso, end_time: endIso, is_all_day: isAllDay, status: item.status ?? 'confirmed',
          html_link: item.htmlLink ?? null, organizer_email: item.organizer?.email ?? null, attendees: item.attendees ?? null,
          synced_at: new Date().toISOString(),
        }, { onConflict: 'user_id,gcal_event_id' })
        if (e) res.pull_errors++; else res.pulled++
      }
      diagnostics.push(`pull: ${res.pulled} stored`)
    } else { diagnostics.push(`pull failed (${r.status})`) }
  } catch (e) { diagnostics.push(`pull exception: ${String(e).slice(0, 80)}`) }

  // ── PUSH: todos ──────────────────────────────────────────────────────────────
  const { data: todos } = await supabase.from('todos')
    .select('id, title, due_date, status, priority')
    .not('due_date', 'is', null).gte('due_date', nowDate).lte('due_date', futureDate)
    .in('status', ['open', 'in_progress']).or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
  for (const t of todos ?? []) {
    try {
      const { data: ex } = await supabase.from('gcal_events').select('gcal_event_id').eq('user_id', userId).eq('source_type', 'todo').eq('source_id', t.id).maybeSingle()
      const endEx = new Date(new Date(t.due_date).getTime() + 86400000).toISOString().split('T')[0]
      const id = await upsertGcalEvent(token, { summary: `[TODO] ${t.title}`, description: `GateGuard To-Do | Priority: ${t.priority ?? 'medium'} | Status: ${t.status}`, start: { date: t.due_date }, end: { date: endEx } }, ex?.gcal_event_id)
      if (!id) { res.push_errors++; continue }
      if (!ex?.gcal_event_id) await supabase.from('gcal_events').insert({ user_id: userId, gcal_event_id: id, gcal_calendar_id: 'primary', title: `[TODO] ${t.title}`, start_time: `${t.due_date}T00:00:00Z`, end_time: `${endEx}T00:00:00Z`, is_all_day: true, status: 'confirmed', source_type: 'todo', source_id: t.id, synced_at: new Date().toISOString() })
      res.pushed++
    } catch { res.push_errors++ }
  }

  // ── PUSH: work orders ────────────────────────────────────────────────────────
  const { data: wos } = await supabase.from('work_orders')
    .select('id, title, scheduled_date, scheduled_time, status')
    .not('scheduled_date', 'is', null).gte('scheduled_date', nowDate).lte('scheduled_date', futureDate)
    .in('status', ['open', 'assigned', 'in_progress'])
  for (const wo of wos ?? []) {
    try {
      const { data: ex } = await supabase.from('gcal_events').select('gcal_event_id').eq('user_id', userId).eq('source_type', 'work_order').eq('source_id', wo.id).maybeSingle()
      const allDay = !wo.scheduled_time
      const endEx = new Date(new Date(wo.scheduled_date).getTime() + 86400000).toISOString().split('T')[0]
      const body = allDay
        ? { summary: `[WO] ${wo.title}`, description: `GateGuard Work Order | Status: ${wo.status}`, start: { date: wo.scheduled_date }, end: { date: endEx } }
        : { summary: `[WO] ${wo.title}`, description: `GateGuard Work Order | Status: ${wo.status}`, start: { dateTime: new Date(`${wo.scheduled_date}T${wo.scheduled_time}:00`).toISOString(), timeZone: 'America/New_York' }, end: { dateTime: new Date(new Date(`${wo.scheduled_date}T${wo.scheduled_time}:00`).getTime() + 3600000).toISOString(), timeZone: 'America/New_York' } }
      const id = await upsertGcalEvent(token, body, ex?.gcal_event_id)
      if (!id) { res.push_errors++; continue }
      if (!ex?.gcal_event_id) {
        const startIso = allDay ? `${wo.scheduled_date}T00:00:00Z` : new Date(`${wo.scheduled_date}T${wo.scheduled_time}:00`).toISOString()
        const endIso = allDay ? `${endEx}T00:00:00Z` : new Date(new Date(`${wo.scheduled_date}T${wo.scheduled_time}:00`).getTime() + 3600000).toISOString()
        await supabase.from('gcal_events').insert({ user_id: userId, gcal_event_id: id, gcal_calendar_id: 'primary', title: `[WO] ${wo.title}`, start_time: startIso, end_time: endIso, is_all_day: allDay, status: 'confirmed', source_type: 'work_order', source_id: wo.id, synced_at: new Date().toISOString() })
      }
      res.pushed++
    } catch { res.push_errors++ }
  }

  // ── PUSH: native portal calendar_events (the events-sync gap) ─────────────────
  const { data: events } = await supabase.from('calendar_events')
    .select('id, title, description, location, start_time, end_time, is_all_day, external_event_id, source')
    .eq('user_id', userId).neq('source', 'google')   // don't echo pulled-from-Google events back
    .gte('start_time', now.toISOString()).lte('start_time', future.toISOString())
  for (const ev of events ?? []) {
    try {
      const body = ev.is_all_day
        ? { summary: ev.title, description: ev.description ?? '', location: ev.location ?? '', start: { date: String(ev.start_time).split('T')[0] }, end: { date: String(ev.end_time).split('T')[0] } }
        : { summary: ev.title, description: ev.description ?? '', location: ev.location ?? '', start: { dateTime: new Date(ev.start_time).toISOString() }, end: { dateTime: new Date(ev.end_time).toISOString() } }
      const id = await upsertGcalEvent(token, body, ev.external_event_id)
      if (!id) { res.push_errors++; continue }
      if (!ev.external_event_id) await supabase.from('calendar_events').update({ external_event_id: id, external_calendar_id: 'primary', sync_status: 'synced', updated_at: new Date().toISOString() }).eq('id', ev.id)
      res.pushed++
    } catch { res.push_errors++ }
  }

  diagnostics.push(`push: ${res.pushed} ok, ${res.push_errors} errors`)
  await supabase.from('user_settings').upsert({ user_id: userId, gcal_last_synced_at: new Date().toISOString() }, { onConflict: 'user_id' })
  res.ok = true
  return res
}

// Targeted single-todo push for instant "push-on-create" (no full pull).
export async function pushTodoToGcal(userId: string, todo: { id: string; title: string; due_date: string | null; status?: string; priority?: string }): Promise<void> {
  if (!todo.due_date) return
  const supabase = db()
  const { data: settings } = await supabase.from('user_settings').select('gcal_refresh_token').eq('user_id', userId).maybeSingle()
  if (!settings?.gcal_refresh_token) return
  const { token } = await getGcalAccessToken(settings.gcal_refresh_token)
  if (!token) return
  const { data: ex } = await supabase.from('gcal_events').select('gcal_event_id').eq('user_id', userId).eq('source_type', 'todo').eq('source_id', todo.id).maybeSingle()
  const endEx = new Date(new Date(todo.due_date).getTime() + 86400000).toISOString().split('T')[0]
  const id = await upsertGcalEvent(token, { summary: `[TODO] ${todo.title}`, description: `GateGuard To-Do | Priority: ${todo.priority ?? 'medium'} | Status: ${todo.status ?? 'open'}`, start: { date: todo.due_date }, end: { date: endEx } }, ex?.gcal_event_id)
  if (id && !ex?.gcal_event_id) await supabase.from('gcal_events').insert({ user_id: userId, gcal_event_id: id, gcal_calendar_id: 'primary', title: `[TODO] ${todo.title}`, start_time: `${todo.due_date}T00:00:00Z`, end_time: `${endEx}T00:00:00Z`, is_all_day: true, status: 'confirmed', source_type: 'todo', source_id: todo.id, synced_at: new Date().toISOString() })
}
