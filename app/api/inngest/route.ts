/**
 * POST /api/inngest
 *
 * Inngest webhook endpoint — serves registered functions to the
 * Inngest platform (event routing, step execution, retries).
 *
 * Required env vars:
 *   INNGEST_EVENT_KEY   — from Inngest dashboard → Event Keys
 *   INNGEST_SIGNING_KEY — from Inngest dashboard → Signing Key
 *
 * Add to Vercel env: Settings → Environment Variables
 * Sign in at https://app.inngest.com → Create App → grab both keys.
 */

import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { enrichProperty } from '@/inngest/functions/enrich-property'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [enrichProperty],
})
