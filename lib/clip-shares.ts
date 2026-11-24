/**
 * lib/clip-shares.ts — "Share this clip" links from the property portal (Nov 24 2026),
 * for police / insurance: a private link /portal/<slug>/clip/<secret> that plays ONE
 * Eagle Eye recording (the one covering the chosen moment) — no PIN, no login.
 * Only sha256(secret) is stored. Links expire (default 7 days, max 30) and can be
 * turned off at once. Each share = one site_events row (event_type 'clip_share');
 * every view is counted on it. Edge cameras aren't shareable yet (they stream from
 * the device itself).
 */
import { createHash, randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const hash = (s: string) => createHash('sha256').update(`gg-clip:${s}`).digest('hex')

export type ClipShare = {
  id: string; site_id: string; slug: string; camera_id: string; camera_name: string; ts: string
  note: string | null; by: string; expires_at: string; revoked: boolean; views: number; created_at: string
}
type Meta = Omit<ClipShare, 'id' | 'site_id' | 'created_at'> & { token_hash: string }

export async function createShare(o: { siteId: string; slug: string; cameraId: string; cameraName: string; ts: string; note?: string | null; by: string; days?: number }): Promise<{ id: string; secret: string; expires_at: string }> {
  const secret = randomBytes(24).toString('base64url')
  const days = Math.min(30, Math.max(1, Math.round(o.days ?? 7)))
  const expires_at = new Date(Date.now() + days * 864e5).toISOString()
  const meta: Meta = { slug: o.slug, camera_id: o.cameraId, camera_name: o.cameraName, ts: o.ts, note: o.note ?? null, by: o.by, expires_at, revoked: false, views: 0, token_hash: hash(secret) }
  const { data, error } = await db().from('site_events').insert({
    site_id: o.siteId, event_type: 'clip_share', event_source: 'eagle_eye',
    title: `Clip shared: ${o.cameraName}`, description: `${o.by} shared a clip from ${o.cameraName} (${o.ts}), link good for ${days} day${days === 1 ? '' : 's'}${o.note ? ` — ${o.note}` : ''}`,
    summary: `Clip shared · ${o.by}`, metadata: meta,
  }).select('id').single()
  if (error || !data) throw new Error(error?.message ?? 'Could not create the link')
  return { id: String(data.id), secret, expires_at }
}

const toShare = (r: { id: string; site_id: string; created_at: string; metadata: Meta }): ClipShare => {
  const { token_hash: _t, ...m } = r.metadata // eslint-disable-line @typescript-eslint/no-unused-vars
  return { id: String(r.id), site_id: r.site_id, created_at: r.created_at, ...m }
}

/** Resolve a public link → the share, or a reason it doesn't work. */
export async function resolveShare(secret: string): Promise<{ share: ClipShare } | { error: 'not_found' | 'expired' | 'revoked' }> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(secret)) return { error: 'not_found' }
  const { data } = await db().from('site_events').select('id, site_id, created_at, metadata').eq('event_type', 'clip_share').eq('metadata->>token_hash', hash(secret)).maybeSingle()
  if (!data) return { error: 'not_found' }
  const s = toShare(data as { id: string; site_id: string; created_at: string; metadata: Meta })
  if (s.revoked) return { error: 'revoked' }
  if (Date.parse(s.expires_at) < Date.now()) return { error: 'expired' }
  return { share: s }
}

export async function countView(id: string) {
  const { data } = await db().from('site_events').select('metadata').eq('id', id).maybeSingle()
  if (!data) return
  const m = data.metadata as Meta
  const { error } = await db().from('site_events').update({ metadata: { ...m, views: (m.views ?? 0) + 1 } }).eq('id', id)
  if (error) console.error('[clip-share] view count failed:', error.message)
}

export async function listShares(siteId: string): Promise<ClipShare[]> {
  const { data } = await db().from('site_events').select('id, site_id, created_at, metadata').eq('site_id', siteId).eq('event_type', 'clip_share').order('created_at', { ascending: false }).limit(50)
  return ((data ?? []) as { id: string; site_id: string; created_at: string; metadata: Meta }[]).map(toShare)
}

export async function revokeShare(siteId: string, id: string, by: string): Promise<boolean> {
  const { data } = await db().from('site_events').select('metadata').eq('id', id).eq('site_id', siteId).eq('event_type', 'clip_share').maybeSingle()
  if (!data) return false
  const { error } = await db().from('site_events').update({ metadata: { ...(data.metadata as Meta), revoked: true, revoked_by: by } }).eq('id', id)
  return !error
}
