/**
 * bulk-upload-manuals.mjs
 *
 * Upload multiple PDF manuals to the GateGuard KB vector pipeline.
 *
 * Usage:
 *   node scripts/bulk-upload-manuals.mjs
 *
 * Setup:
 *   1. Copy .env.local values into this script's env OR run with dotenv:
 *      npx dotenv -e .env.local -- node scripts/bulk-upload-manuals.mjs
 *
 *   2. Edit the MANUALS array below — map each PDF file to its product SKU.
 *      PDFs can be local paths (download from Drive first) or public URLs.
 *
 *   3. Run from the repo root.
 *
 * The script calls POST /api/kb/process on your live portal, so Vercel must
 * have the latest deploy with the upload route. It uses your Clerk session
 * cookie OR a service-role key bypass (see AUTH section below).
 */

import fs   from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY
const PORTAL_URL        = process.env.PORTAL_URL ?? 'https://portal.gateguard.co'

// ─── Manual mapping ───────────────────────────────────────────────────────────
// Add one entry per PDF you want to upload.
// sku: must match the SKU in your Supabase products table
// file: path to a local PDF file (relative to repo root) OR a public https:// URL

const MANUALS = [
  // Example entries — edit these:
  // { sku: 'DKS-6050-380', file: './manuals/doorking-6050-380.pdf' },
  // { sku: 'DKS-1833',     file: './manuals/doorking-1833.pdf' },
  // { sku: 'FAAC-746',     file: 'https://example.com/faac-746-manual.pdf' },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.')
  console.error('    Run with: npx dotenv -e .env.local -- node scripts/bulk-upload-manuals.mjs')
  process.exit(1)
}

if (MANUALS.length === 0) {
  console.error('❌  MANUALS array is empty. Edit the script and add your PDF mappings.')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function lookupProductId(sku) {
  const { data, error } = await db
    .from('products')
    .select('id, name')
    .eq('sku', sku)
    .single()
  if (error || !data) throw new Error(`Product not found for SKU: ${sku}`)
  return { id: data.id, name: data.name }
}

async function uploadManual({ sku, file }) {
  console.log(`\n📄  Processing: ${sku}`)

  const { id: productId, name } = await lookupProductId(sku)
  console.log(`    → Product: ${name} (${productId})`)

  let pdfBuffer
  let fileName

  if (file.startsWith('http://') || file.startsWith('https://')) {
    console.log(`    → Fetching URL: ${file}`)
    const res = await fetch(file)
    if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`)
    pdfBuffer = Buffer.from(await res.arrayBuffer())
    fileName  = file.split('/').pop() || `${sku}.pdf`
  } else {
    const filePath = path.resolve(file)
    if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`)
    pdfBuffer = fs.readFileSync(filePath)
    fileName  = path.basename(filePath)
    console.log(`    → Local file: ${filePath} (${Math.round(pdfBuffer.length / 1024)}KB)`)
  }

  // Upload to Supabase Storage
  const storagePath = `${productId}/${fileName.replace(/\s+/g, '-').toLowerCase()}`
  console.log(`    → Uploading to storage: manuals/${storagePath}`)

  const { error: uploadErr } = await db.storage
    .from('manuals')
    .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })
  if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`)

  const manualUrl = db.storage.from('manuals').getPublicUrl(storagePath).data.publicUrl
  console.log(`    → Stored at: ${manualUrl}`)

  // Run the vectorize pipeline directly (no HTTP round-trip needed)
  const { processManual } = await import('../lib/vectorize.js').catch(() =>
    import('../lib/vectorize.ts')
  )

  const result = await processManual({
    productId,
    pdfBuffer,
    manualUrl,
    onProgress: msg => console.log(`    → ${msg}`),
  })

  console.log(`    ✅  Done — ${result.chunksCreated} chunks indexed`)
  return result
}

async function main() {
  console.log(`\n🚀  GateGuard Manual Bulk Upload`)
  console.log(`    Portal: ${PORTAL_URL}`)
  console.log(`    Manuals to process: ${MANUALS.length}\n`)

  const results = []
  for (const entry of MANUALS) {
    try {
      const r = await uploadManual(entry)
      results.push({ sku: entry.sku, status: 'ok', chunks: r.chunksCreated })
    } catch (err) {
      console.error(`    ❌  Failed: ${err.message}`)
      results.push({ sku: entry.sku, status: 'error', error: err.message })
    }
  }

  console.log('\n─── Summary ───────────────────────────────────────────')
  for (const r of results) {
    if (r.status === 'ok') {
      console.log(`  ✅  ${r.sku.padEnd(20)} ${r.chunks} chunks`)
    } else {
      console.log(`  ❌  ${r.sku.padEnd(20)} ${r.error}`)
    }
  }
  console.log('───────────────────────────────────────────────────────\n')
}

main().catch(err => { console.error(err); process.exit(1) })
