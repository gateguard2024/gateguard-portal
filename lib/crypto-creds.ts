/**
 * lib/crypto-creds.ts — SERVER ONLY.
 *
 * AES-256-GCM encryption for per-site integration credentials (Brivo, Eagle Eye,
 * Shelly, UniFi). ONE master key (env CREDENTIALS_ENC_KEY) protects every site's
 * secrets, which live as encrypted rows in site_integrations — so there is never
 * a per-site env var, and it scales to unlimited sites.
 *
 * The key may be base64 (32 bytes), hex (64 chars), or any passphrase (we derive
 * a 32-byte key via SHA-256), so setup is forgiving. Never imported client-side.
 */
import crypto from 'crypto'

const ALG = 'aes-256-gcm'

function masterKey(): Buffer {
  const k = process.env.CREDENTIALS_ENC_KEY
  if (!k) throw new Error('CREDENTIALS_ENC_KEY env var is not set — required to store integration credentials.')
  // 32-byte base64?
  try { const b = Buffer.from(k, 'base64'); if (b.length === 32 && /^[A-Za-z0-9+/=]+$/.test(k)) return b } catch { /* fall through */ }
  // 64-char hex?
  if (/^[0-9a-fA-F]{64}$/.test(k)) return Buffer.from(k, 'hex')
  // any passphrase → derive 32 bytes
  return crypto.createHash('sha256').update(k, 'utf8').digest()
}

export function credsKeyConfigured(): boolean {
  return !!process.env.CREDENTIALS_ENC_KEY
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function encryptJson(obj: any): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALG, masterKey(), iv)
  const pt = Buffer.from(JSON.stringify(obj), 'utf8')
  const enc = Buffer.concat([cipher.update(pt), cipher.final()])
  const tag = cipher.getAuthTag()
  return ['v1', iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':')
}

export function decryptJson<T = Record<string, string>>(blob: string): T {
  const parts = String(blob).split(':')
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Malformed credential blob')
  const [, ivb, tagb, encb] = parts
  const decipher = crypto.createDecipheriv(ALG, masterKey(), Buffer.from(ivb, 'base64'))
  decipher.setAuthTag(Buffer.from(tagb, 'base64'))
  const dec = Buffer.concat([decipher.update(Buffer.from(encb, 'base64')), decipher.final()])
  return JSON.parse(dec.toString('utf8')) as T
}
