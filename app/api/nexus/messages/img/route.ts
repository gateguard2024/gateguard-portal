import { NextRequest, NextResponse } from 'next/server'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const IMAGE = /^image\/(png|jpe?g|gif|webp|bmp|x-icon|vnd\.microsoft\.icon)$/i
const MAX_BYTES = 5 * 1024 * 1024

// Addresses inside private networks / this machine — never fetched (no reaching internal services).
function privateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase()
    if (v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true
    const m = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    return m ? privateIp(m[1]) : false
  }
  const [a, b] = ip.split('.').map(Number)
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
}
async function safeUrl(raw: string): Promise<URL | null> {
  let u: URL
  try { u = new URL(raw) } catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  if (u.username || u.password) return null
  if (u.port && !['80', '443', ''].includes(u.port)) return null
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (/^localhost$|\.local$|\.internal$/i.test(host)) return null
  const ips = isIP(host) ? [host] : await lookup(host, { all: true }).then((r) => r.map((x) => x.address)).catch(() => [])
  if (!ips.length || ips.some(privateIp)) return null
  return u
}

// GET /api/nexus/messages/img?u=<http:// picture in an email>
// Pictures linked over plain http:// are blocked on a secure page. Nexus fetches them
// (signed-in users only, pictures only — no SVG, max 5 MB, public addresses only)
// and passes them on, like Gmail's image proxy.
export async function GET(req: NextRequest) {
  await getCurrentUser()
  let url = await safeUrl(new URL(req.url).searchParams.get('u') ?? '')
  if (!url) return NextResponse.json({ error: 'Bad picture link.' }, { status: 400 })
  let res: Response | null = null
  for (let hop = 0; hop < 4; hop++) {
    res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0 (Nexus Mail image proxy)', Accept: 'image/*' } }).catch(() => null)
    if (!res) return NextResponse.json({ error: 'Picture unavailable.' }, { status: 502 })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = await safeUrl(new URL(res.headers.get('location')!, url).toString())
      if (!url) return NextResponse.json({ error: 'Bad picture link.' }, { status: 400 })
      continue
    }
    break
  }
  if (!res || !res.ok) return NextResponse.json({ error: 'Picture unavailable.' }, { status: 502 })
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim()
  if (!IMAGE.test(type)) return NextResponse.json({ error: 'Not a picture.' }, { status: 415 })
  if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) return NextResponse.json({ error: 'Picture too big.' }, { status: 413 })
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > MAX_BYTES) return NextResponse.json({ error: 'Picture too big.' }, { status: 413 })
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': type,
      'Content-Security-Policy': "sandbox; default-src 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=86400',
    },
  })
}
