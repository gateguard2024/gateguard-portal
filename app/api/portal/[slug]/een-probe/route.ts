/**
 * GET /api/portal/[slug]/een-probe?camera_id=&ts=<ISO>  — TEMPORARY diagnostic (Nov 2 2026).
 * PIN-gated like the rest of the portal. Tries every way of getting Eagle Eye's
 * live substream and a recorded clip, and reports what Eagle Eye answers, so we
 * can pick the one that works. No tokens or cookie values are returned; URLs are
 * shown as host + path + query KEYS only. Delete once live/playback are settled.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyPortal } from '@/lib/portal-auth'
import { portalCameraScope } from '@/lib/video'
import { getSiteEagleEyeAccess, eenTime } from '@/lib/eagle-eye'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

type Row = Record<string, unknown>
const shape = (u: string) => { try { const x = new URL(u); return `${x.host}${x.pathname}?${[...x.searchParams.keys()].join('&')}` } catch { return u ? 'unparseable' : '' } }
const cookiesOf = (r: Response) => (typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [r.headers.get('set-cookie') ?? '']).filter(Boolean)

/** Open a URL, wait up to `ms` for headers, then read up to 3 s / 400 KB. */
async function tryStream(url: string, headers: Record<string, string>, ms: number): Promise<Row> {
  const t0 = Date.now(); const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), ms)
  try {
    const r = await fetch(url, { headers, signal: ctl.signal })
    const out: Row = { status: r.status, type: r.headers.get('content-type'), length: r.headers.get('content-length'), headersAfterMs: Date.now() - t0 }
    if (!r.ok) { out.body = (await r.text().catch(() => '')).slice(0, 300); return out }
    const reader = r.body!.getReader(); let bytes = 0; let jpegs = 0; const stop = Date.now() + 3000
    while (Date.now() < stop && bytes < 400_000) {
      const { value, done } = await Promise.race([reader.read(), new Promise<{ value: undefined; done: true }>(res => setTimeout(() => res({ value: undefined, done: true }), Math.max(1, stop - Date.now())))])
      if (done || !value) break
      bytes += value.length
      for (let i = 0; i + 2 < value.length; i++) if (value[i] === 0xff && value[i + 1] === 0xd8 && value[i + 2] === 0xff) jpegs++
      if (!out.firstBytesAfterMs) out.firstBytesAfterMs = Date.now() - t0
    }
    ctl.abort()
    return { ...out, bytesIn3s: bytes, jpegStartsIn3s: jpegs }
  } catch (e) { return { error: e instanceof Error ? e.name : 'error', afterMs: Date.now() - t0 } }
  finally { clearTimeout(timer) }
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
  const cameraId = req.nextUrl.searchParams.get('camera_id') ?? ''
  if (!cameraId || !v.portal.site_id) return NextResponse.json({ error: 'camera_id required' }, { status: 400 })
  if (!portalCameraScope(v.portal.camera_ids).allow(`een:${cameraId}`)) return NextResponse.json({ error: 'Camera not on this portal.' }, { status: 403 })
  const ts = Date.parse(req.nextUrl.searchParams.get('ts') ?? '') || Date.now() - 20 * 60_000

  const out: Row = {}
  try {
    const { token, baseHost } = await getSiteEagleEyeAccess(v.portal.site_id)
    const bearer = { Authorization: `Bearer ${token}` }
    const api = (p: string) => fetch(`https://${baseHost}/api/v3.0${p}`, { headers: { ...bearer, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) })

    // 1. Camera status + settings Eagle Eye reports.
    const cam = await api(`/cameras/${encodeURIComponent(cameraId)}?include=status,deviceInfo,streamUrls`)
    const cj: Row = await cam.json().catch(() => ({}))
    out.camera = { http: cam.status, status: cj.status, deviceInfo: cj.deviceInfo, keys: Object.keys(cj) }

    // 2. Feeds (URLs shown by shape only).
    const f = await api(`/feeds?deviceId=${encodeURIComponent(cameraId)}&include=multipartUrl,hlsUrl,flvUrl,rtspUrl,webRtcUrl`)
    const fj: Row = await f.json().catch(() => ({}))
    const feeds = ((fj.results ?? fj.data ?? []) as Row[])
    out.feeds = { http: f.status, list: feeds.map(x => ({ type: x.type, mediaType: x.mediaType, multipart: shape(String(x.multipartUrl ?? '')), hls: shape(String(x.hlsUrl ?? '')), flv: shape(String(x.flvUrl ?? '')), webRtc: shape(String(x.webRtcUrl ?? '')) })) }
    const prev = String((feeds.find(x => x.type === 'preview' && x.multipartUrl) ?? {}).multipartUrl ?? '')
    const mainHls = String((feeds.find(x => x.type === 'main' && x.hlsUrl) ?? {}).hlsUrl ?? '')

    // 3. Media session: does the session URL work WITHOUT the token? (browser path)
    const s = await api('/media/session'); const sj: Row = await s.json().catch(() => ({}))
    const sessUrl = String(sj.url ?? '')
    out.session = { http: s.status, url: shape(sessUrl), keys: Object.keys(sj) }
    let cookie = ''
    if (sessUrl) {
      const noTok = await fetch(sessUrl, { redirect: 'manual', signal: AbortSignal.timeout(5000) })
      const withTok = await fetch(sessUrl, { headers: bearer, redirect: 'manual', signal: AbortSignal.timeout(5000) })
      const c2 = cookiesOf(withTok); const c1 = cookiesOf(noTok)
      cookie = (c2.length ? c2 : c1).map(x => x.split(';')[0]).join('; ')
      out.sessionCookie = {
        withoutToken: { status: noTok.status, cookies: c1.map(x => x.split('=')[0]), attrs: c1.map(x => x.split(';').slice(1).map(a => a.trim().split('=')[0]).join(',')) },
        withToken: { status: withTok.status, cookies: c2.map(x => x.split('=')[0]), attrs: c2.map(x => x.split(';').slice(1).map(a => a.trim()).join(',')) },
      }
    }

    // 4. Live substream (preview multipart) — cookie only, then token only (one at a
    // time: a 409 may mean "already streaming"), 10 s each to answer.
    if (prev) {
      const ck = await tryStream(prev, cookie ? { Cookie: cookie } : {}, 10000)
      const tk = await tryStream(prev, bearer, 10000)
      out.substream = { cookieOnly: ck, tokenOnly: tk }
    }
    // 5. Main HLS playlist (token, like EEN's hls.js example).
    if (mainHls) out.mainHls = await tryStream(mainHls, bearer, 8000)

    // 6. Recorded clip around ts: the mp4Url as given, and with a 60 s window.
    const qs = new URLSearchParams({ deviceId: cameraId, type: 'main', mediaType: 'video', startTimestamp__gte: eenTime(ts - 15 * 60_000), include: 'mp4Url', pageSize: '50' })
    const m = await api(`/media?${qs}`); const mj: Row = await m.json().catch(() => ({}))
    const rows = ((mj.results ?? mj.data ?? []) as Row[])
    const row = rows.find(r => Date.parse(String(r.startTimestamp)) <= ts && Date.parse(String(r.endTimestamp)) >= ts) ?? rows[0]
    const mp4 = String(row?.mp4Url ?? '')
    out.recording = { http: m.status, rows: rows.length, picked: row ? { start: row.startTimestamp, end: row.endTimestamp } : null, mp4: shape(mp4) }
    if (mp4) {
      const u = new URL(mp4); const keys = [...u.searchParams.keys()]
      const sk = keys.find(k => /start/i.test(k)); const ek = keys.find(k => /end/i.test(k))
      out.clipAsGiven = await tryStream(mp4, { ...bearer, ...(cookie ? { Cookie: cookie } : {}), Range: 'bytes=0-' }, 12000)
      if (sk && ek) {
        u.searchParams.set(sk, eenTime(ts)); u.searchParams.set(ek, eenTime(ts + 60_000))
        out.clip60s = { startKey: sk, endKey: ek, ...(await tryStream(u.toString(), { ...bearer, ...(cookie ? { Cookie: cookie } : {}) }, 12000)) }
      }
    }
  } catch (e) { out.error = e instanceof Error ? e.message : 'probe failed' }
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
