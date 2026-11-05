// lib/oauth-state.ts
// Signed OAuth "state" so the callback can trust who started the login. Without a
// signature anyone could send Google a state naming another user and attach their own
// mailbox (and its mail) to that person's Nexus account. Expires in 15 minutes.
import crypto from 'crypto'

const secret = () => process.env.OAUTH_STATE_SECRET || process.env.ASSISTANT_UNDO_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-oauth-state'
const TTL_MS = 15 * 60 * 1000

export function signOAuthState(data: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + TTL_MS, n: crypto.randomBytes(6).toString('base64url') })).toString('base64url')
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyOAuthState(state: string): Record<string, unknown> | null {
  const [body, sig] = String(state).split('.')
  if (!body || !sig) return null
  const want = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
  const a = Buffer.from(sig), b = Buffer.from(want)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString()) as Record<string, unknown>
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null
    return data
  } catch { return null }
}
