/**
 * Manual Ingest — Inngest Function (Phase E: universal coverage)
 *
 * Triggered by: "kb/manual.ingest"  { product_id, manual_url }
 *
 * The moment a product is added (or updated) with a manual PDF, this downloads
 * it and runs the EXISTING pipeline (lib/vectorize.processManual): extract text →
 * chunk → embed (OpenAI) → insert manual_chunks → auto wiring/terminal extraction.
 * That instantly powers the /tech AI diagnostics, guided procedures, and step
 * citations for that device. Runs in the background so the portal stays snappy.
 *
 * Figure extraction (diagrams shown in steps) is a separate Python pass
 * (scripts/extract_manual_figures.py) since it needs PyMuPDF.
 */
import { inngest } from '../client'
import { processManual } from '@/lib/vectorize'

export const ingestManual = inngest.createFunction(
  {
    id: 'kb-ingest-manual',
    name: 'KB: Ingest + Vectorize Product Manual',
    retries: 2,
    timeouts: { finish: '300s' },
    triggers: [{ event: 'kb/manual.ingest' }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const productId: string | undefined = event.data?.product_id
    const manualUrl: string | undefined = event.data?.manual_url
    if (!productId || !manualUrl) return { ok: false, reason: 'missing product_id or manual_url' }

    // 1) download the PDF
    const buf = await step.run('download-pdf', async () => {
      const r = await fetch(manualUrl)
      if (!r.ok) throw new Error(`download failed: ${r.status}`)
      const ab = await r.arrayBuffer()
      return Buffer.from(ab).toString('base64')   // step results must be JSON-serializable
    })

    // 2) extract → chunk → embed → insert manual_chunks (+ auto wiring extraction)
    const result = await step.run('process-manual', async () => {
      const pdfBuffer = Buffer.from(buf as string, 'base64')
      return processManual({ productId, pdfBuffer, manualUrl })
    })

    return { ok: true, product_id: productId, result }
  }
)
