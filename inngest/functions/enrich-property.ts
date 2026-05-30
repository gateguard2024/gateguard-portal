/**
 * ARIA Background Enrichment — Inngest Function
 *
 * Triggered by event: "aria/property.enrich"
 * Runs the full ARIA deep engine in the background so the UI can
 * return a cached result instantly (SWR fast-path) and receive the
 * fresh enrichment via Supabase Realtime when this job completes.
 *
 * Event payload: { query: string; userId: string }
 */

import { inngest } from '../client'

export const enrichProperty = inngest.createFunction(
  {
    id: 'aria-enrich-property',
    name: 'ARIA: Background Property Enrichment',
    retries: 2,
    // Reasonable timeout — deep route takes 26-30s, add headroom
    timeouts: { finish: '90s' },
    triggers: [{ event: 'aria/property.enrich' }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { query } = event.data as { query: string; userId?: string }

    await step.run('run-deep-enrichment', async () => {
      // Build base URL — works on Vercel (VERCEL_URL) + local dev
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

      const res = await fetch(`${baseUrl}/api/aria/research/deep`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Service key allows bypass of Clerk auth for internal Inngest calls
          'x-service-key': process.env.ARIA_SERVICE_KEY ?? '',
        },
        body: JSON.stringify({ query }),
        // AbortSignal not needed — Inngest handles its own timeout
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`Deep route returned ${res.status}: ${errText.slice(0, 200)}`)
      }

      return { status: res.status, query }
    })

    return { enriched: true, query }
  }
)
