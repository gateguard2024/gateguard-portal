/**
 * ARIA Background Enrichment — Inngest Function (v9 — Targeted Rehydration)
 *
 * Triggered by event: "aria/property.enrich"
 * Event payload: { query: string; propertyId?: string; userId?: string }
 *
 * v9 CHANGE — Two-path execution:
 *
 * Path A (targeted rehydration, ~$0.005):
 *   When propertyId is provided AND the property is in aria_properties,
 *   we fire 3 targeted Serper searches to refresh stale fields (ISP, contact,
 *   pain signals), run a Haiku micro-synthesis, then patch the DB row directly.
 *   Total cost: ~$0.005 (3 Serper searches × ~$0.001 + Haiku ~$0.002).
 *
 * Path B (full pipeline, ~$0.35):
 *   When propertyId is absent (new search) or targeted refresh fails,
 *   falls back to the full deep research pipeline via /api/aria/research/deep.
 *
 * The UI triggers targeted rehydration (Path A) when the cache returns is_stale=true.
 * Full pipeline runs only for new/uncached properties.
 *
 * On completion, Supabase Realtime UPDATE on aria_properties notifies the page.
 */

import { inngest } from '../client'
import { createClient } from '@supabase/supabase-js'

const TARGETED_SERPER_SEARCHES = 3
const TARGETED_TIMEOUT_MS = 25000

export const enrichProperty = inngest.createFunction(
  {
    id: 'aria-enrich-property',
    name: 'ARIA: Background Property Enrichment',
    retries: 2,
    timeouts: { finish: '90s' },
    triggers: [{ event: 'aria/property.enrich' }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { query, propertyId } = event.data as {
      query: string
      propertyId?: string
      userId?: string
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    const serviceKey = process.env.ARIA_SERVICE_KEY ?? ''

    // ── Path A: Targeted rehydration ──────────────────────────────────────────
    if (propertyId) {
      const refreshed = await step.run('targeted-rehydration', async () => {
        try {
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )

          // Load existing property data
          const { data: prop } = await supabase
            .from('aria_properties')
            .select('id, property_name, address, city, state, isp_providers, dm_name, dm_phone')
            .eq('id', propertyId)
            .maybeSingle()

          if (!prop) {
            console.log('[enrich] propertyId not found in DB, falling back to full pipeline')
            return { targeted_skipped: true }
          }

          const { property_name, city, state } = prop
          const serperKey = process.env.SERPER_API_KEY
          if (!serperKey) {
            return { targeted_skipped: true, reason: 'no_serper_key' }
          }

          // Fire targeted Serper searches in parallel (ISP, contact, pain signals)
          const searchQueries = [
            `"${property_name}" ${city} ${state} internet provider fiber`,
            `"${property_name}" ${city} ${state} property manager contact phone`,
            `"${property_name}" ${city} ${state} reviews gate internet complaints`,
          ]

          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), TARGETED_TIMEOUT_MS)

          const results = await Promise.allSettled(
            searchQueries.map(q =>
              fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ q, num: TARGETED_SERPER_SEARCHES }),
                signal: controller.signal,
              }).then(r => r.json())
            )
          ).finally(() => clearTimeout(timer))

          // Extract snippets for Haiku micro-synthesis
          const snippets: string[] = []
          for (const r of results) {
            if (r.status === 'fulfilled') {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const organic = (r.value as any)?.organic ?? []
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              for (const item of organic.slice(0, 3) as any[]) {
                if (item.snippet) snippets.push(item.snippet.slice(0, 300))
              }
            }
          }

          if (!snippets.length) {
            return { targeted_skipped: true, reason: 'no_snippets' }
          }

          // Haiku micro-synthesis — extract only updated facts
          const anthropicKey = process.env.ANTHROPIC_API_KEY
          if (!anthropicKey) return { targeted_skipped: true, reason: 'no_anthropic_key' }

          const haiku = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': anthropicKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 512,
              system: 'You extract updated ISP providers, contact name/phone, and pain signals from search snippets. Return ONLY valid JSON: { "isp_providers": string[], "dm_phone": string|null, "pain_keywords": string[] }. No markdown.',
              messages: [{
                role: 'user',
                content: `Property: ${property_name}, ${city}, ${state}\n\nSnippets:\n${snippets.join('\n---\n')}`,
              }],
            }),
          })

          const haikuJson = await haiku.json()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const haikuText = (haikuJson as any)?.content?.[0]?.text ?? ''

          let extracted: { isp_providers?: string[]; dm_phone?: string | null; pain_keywords?: string[] } = {}
          try {
            extracted = JSON.parse(haikuText.trim())
          } catch {
            return { targeted_skipped: true, reason: 'haiku_parse_error' }
          }

          // Patch only non-empty fields — smart merge, never overwrite with empty
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const patch: Record<string, any> = {
            last_researched_at: new Date().toISOString(),
          }

          if (extracted.isp_providers?.length) {
            // Union with existing providers — never shrink the list
            const existing = (prop.isp_providers as string[]) ?? []
            patch.isp_providers = [...new Set([...existing, ...extracted.isp_providers])]
          }
          if (extracted.dm_phone && !prop.dm_phone) {
            // Only fill in phone if we didn't have one (don't overwrite user-verified data)
            patch.dm_phone = extracted.dm_phone
          }

          await supabase
            .from('aria_properties')
            .update(patch)
            .eq('id', propertyId)

          console.log('[enrich] Targeted rehydration complete for:', property_name, {
            patched_fields: Object.keys(patch),
            snippets_used: snippets.length,
          })

          return { targeted_success: true, property_id: propertyId, patched: Object.keys(patch) }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'targeted_error'
          console.warn('[enrich] Targeted rehydration failed, falling back to full pipeline:', msg)
          return { targeted_skipped: true, reason: msg }
        }
      })

      // Targeted succeeded — Realtime notifies UI via aria_properties UPDATE
      if (refreshed.targeted_success) {
        return { enriched: true, path: 'targeted', query, property_id: propertyId }
      }

      // Targeted skipped or failed — fall through to full pipeline
      console.log('[enrich] Falling back to full pipeline:', query, refreshed)
    }

    // ── Path B: Full pipeline ─────────────────────────────────────────────────
    await step.run('run-deep-enrichment', async () => {
      const res = await fetch(`${baseUrl}/api/aria/research/deep`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': serviceKey,
        },
        body: JSON.stringify({ query }),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`Deep route returned ${res.status}: ${errText.slice(0, 200)}`)
      }

      return { status: res.status, query }
    })

    return { enriched: true, path: 'full_pipeline', query }
  }
)
