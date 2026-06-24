/**
 * lib/site-integrations.ts — SERVER ONLY.
 *
 * Unified accessor for per-site, per-vendor integration credentials (Brivo,
 * Eagle Eye, Shelly, UniFi). Every feature asks the same way:
 *   const creds = await getSiteVendorCreds(siteId, 'brivo')
 * Secrets are decrypted here and NEVER returned by status/list calls.
 */
import { createClient } from '@supabase/supabase-js'
import { encryptJson, decryptJson } from '@/lib/crypto-creds'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export const SITE_VENDORS = ['brivo', 'eagle_eye', 'shelly', 'unifi'] as const
export type SiteVendor = typeof SITE_VENDORS[number]

export interface VendorField { key: string; label: string; secret?: boolean; placeholder?: string }

// What each vendor needs. `secret` fields are masked in the UI and never echoed back.
export const VENDOR_FIELDS: Record<SiteVendor, { label: string; fields: VendorField[] }> = {
  brivo:     { label: 'Brivo (Access Control)', fields: [
    { key: 'username', label: 'Brivo username' },
    { key: 'password', label: 'Brivo password', secret: true },
    { key: 'api_key', label: 'Brivo API key', secret: true },
    { key: 'client_id', label: 'Brivo client ID' },
    { key: 'client_secret', label: 'Brivo client secret', secret: true },
    { key: 'site_id', label: 'Brivo site ID', placeholder: 'e.g. 123456' },
  ] },
  eagle_eye: { label: 'Eagle Eye (Cameras)', fields: [
    { key: 'client_id', label: 'EEN client ID' },
    { key: 'client_secret', label: 'EEN client secret', secret: true },
  ] },
  shelly:    { label: 'Shelly (Relays / Power)', fields: [
    { key: 'auth_key', label: 'Cloud auth key', secret: true },
    { key: 'server', label: 'Cloud server', placeholder: 'e.g. shelly-12-eu.shelly.cloud' },
    { key: 'device_tag', label: 'Property tag in device names', placeholder: 'defaults to the site name, e.g. Elevate Greene' },
  ] },
  unifi:     { label: 'UniFi (Network + Access)', fields: [
    // Cloud (recommended for remote sites — reaches the console via Ubiquiti's cloud, no public IP)
    { key: 'cloud_api_key', label: 'Cloud API key (unifi.ui.com)', secret: true },
    { key: 'cloud_site_id', label: 'Cloud site ID', placeholder: 'pick from the site list after saving the key' },
    { key: 'cloud_host_id', label: 'Cloud host ID (optional)' },
    // Local (only if the console is reachable from the internet / VPN)
    { key: 'host', label: 'Local controller URL', placeholder: 'https://192.168.1.1' },
    { key: 'api_key', label: 'Local Network API key', secret: true },
    { key: 'site', label: 'Local network site', placeholder: 'default' },
    { key: 'access_host', label: 'Access controller URL', placeholder: 'https://<ip>:12445' },
    { key: 'access_token', label: 'Access API token', secret: true },
  ] },
}

export interface IntegrationStatus { vendor: SiteVendor; configured: boolean; status: string | null; last_verified_at: string | null; last_error: string | null }

/** Status for all vendors at a site — NO secrets. */
export async function listSiteIntegrationStatus(siteId: string): Promise<IntegrationStatus[]> {
  const { data } = await db().from('site_integrations').select('vendor, credentials_enc, status, last_verified_at, last_error').eq('site_id', siteId)
  const byVendor = new Map((data ?? []).map((r: Record<string, unknown>) => [String(r.vendor), r]))
  return SITE_VENDORS.map(v => {
    const r = byVendor.get(v) as Record<string, unknown> | undefined
    return {
      vendor: v,
      configured: !!(r && r.credentials_enc),
      status: (r?.status as string) ?? null,
      last_verified_at: (r?.last_verified_at as string) ?? null,
      last_error: (r?.last_error as string) ?? null,
    }
  })
}

/** Decrypt a site's credentials for one vendor (or null if not configured). */
export async function getSiteVendorCreds(siteId: string, vendor: SiteVendor): Promise<Record<string, string> | null> {
  const { data } = await db().from('site_integrations').select('credentials_enc').eq('site_id', siteId).eq('vendor', vendor).maybeSingle()
  const blob = (data as { credentials_enc?: string } | null)?.credentials_enc
  if (!blob) return null
  try { return decryptJson<Record<string, string>>(blob) } catch { return null }
}

/** Encrypt + upsert a site's credentials for one vendor. */
export async function setSiteVendorCreds(siteId: string, vendor: SiteVendor, credentials: Record<string, string>): Promise<{ error: string | null }> {
  const credentials_enc = encryptJson(credentials)
  const { error } = await db().from('site_integrations').upsert(
    { site_id: siteId, vendor, credentials_enc, status: 'configured', last_error: null, updated_at: new Date().toISOString() },
    { onConflict: 'site_id,vendor' },
  )
  return { error: error?.message ?? null }
}

/** Merge new keys into a site's existing vendor creds (e.g. add OAuth tokens
 * without losing the client id/secret). */
export async function mergeSiteVendorCreds(siteId: string, vendor: SiteVendor, patch: Record<string, string>): Promise<{ error: string | null }> {
  const existing = (await getSiteVendorCreds(siteId, vendor)) ?? {}
  return setSiteVendorCreds(siteId, vendor, { ...existing, ...patch })
}

/** Remove a site's credentials for one vendor entirely. */
export async function deleteSiteVendorCreds(siteId: string, vendor: SiteVendor): Promise<{ error: string | null }> {
  const { error } = await db().from('site_integrations').delete().eq('site_id', siteId).eq('vendor', vendor)
  return { error: error?.message ?? null }
}

/** Record the result of a connection test. */
export async function markIntegrationTest(siteId: string, vendor: SiteVendor, ok: boolean, error?: string) {
  await db().from('site_integrations').update({
    status: ok ? 'verified' : 'error',
    last_verified_at: ok ? new Date().toISOString() : null,
    last_error: ok ? null : (error ?? 'Test failed'),
    updated_at: new Date().toISOString(),
  }).eq('site_id', siteId).eq('vendor', vendor)
}
