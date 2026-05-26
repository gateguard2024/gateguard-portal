/**
 * seed-kb.mjs — GateGuard Knowledge Base Seeder
 *
 * Tasks (run in order):
 *   1. Import the GateGuard NEXUS User Manual as a searchable KB product
 *   2. Auto-find + embed manuals for DoorKing products (priority brand)
 *   3. Auto-find + embed manuals for all other products missing a manual
 *
 * Usage:
 *   npx dotenv -e .env.local -- node scripts/seed-kb.mjs
 *
 *   # Dry run (see what's missing without processing):
 *   npx dotenv -e .env.local -- node scripts/seed-kb.mjs --dry-run
 *
 *   # Only the user manual:
 *   npx dotenv -e .env.local -- node scripts/seed-kb.mjs --manual-only
 *
 *   # Only auto-find missing manuals:
 *   npx dotenv -e .env.local -- node scripts/seed-kb.mjs --auto-only
 *
 *   # Only DoorKing products:
 *   npx dotenv -e .env.local -- node scripts/seed-kb.mjs --brand DoorKing
 *
 * Prerequisites:
 *   - NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY in .env.local
 *   - GateGuard_NEXUS_User_Manual_v10.pdf in /tmp or adjust MANUAL_PDF_PATH below
 *   - npm install @supabase/supabase-js openai pdf-parse
 */

import fs       from 'fs'
import path     from 'path'
import { createClient } from '@supabase/supabase-js'

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_API_KEY   = process.env.OPENAI_API_KEY
const PORTAL_URL       = process.env.PORTAL_URL ?? 'https://portal.gateguard.co'

// Path to the compiled User Manual PDF (generate with LibreOffice from v10.docx)
// Fallback paths tried in order:
const MANUAL_PDF_CANDIDATES = [
  path.join(process.cwd(), 'tmp', 'GateGuard_NEXUS_User_Manual_v10.pdf'),
  path.join(process.env.HOME ?? '/tmp', 'Desktop', 'Claude', 'GateGuard_NEXUS_User_Manual_v10.pdf'),
  '/tmp/GateGuard_NEXUS_User_Manual_v10.pdf',
]

// CLI args
const args      = process.argv.slice(2)
const DRY_RUN   = args.includes('--dry-run')
const MANUAL_ONLY = args.includes('--manual-only')
const AUTO_ONLY = args.includes('--auto-only')
const BRAND_IDX = args.indexOf('--brand')
const BRAND_FILTER = BRAND_IDX >= 0 ? args[BRAND_IDX + 1] : null

// ─── Chunking + embedding helpers ────────────────────────────────────────────

const CHUNK_SIZE    = 400
const CHUNK_OVERLAP = 60
const EMBED_BATCH   = 20
const MAX_TOKENS    = 8000

function tokens(text) { return Math.ceil(text.length / 4) }

function splitLargeParagraph(para) {
  const sentences = para.split(/(?<=[.?!])\s+|\n/)
  const parts = []
  let current = '', currentTok = 0
  for (const s of sentences) {
    const st = tokens(s)
    if (currentTok + st > CHUNK_SIZE && current) {
      parts.push(current.trim())
      current = s; currentTok = st
    } else {
      current = current ? current + ' ' + s : s
      currentTok += st
    }
  }
  if (current.trim()) parts.push(current.trim())
  return parts.filter(p => p.length > 10)
}

function chunkText(text) {
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
  const chunks = []
  let current = '', currentTok = 0

  for (const para of paragraphs) {
    const paraTokens = tokens(para)
    if (paraTokens > CHUNK_SIZE) {
      if (current.trim()) { chunks.push(current.trim()); current = ''; currentTok = 0 }
      chunks.push(...splitLargeParagraph(para))
      continue
    }
    if (currentTok + paraTokens > CHUNK_SIZE && current) {
      chunks.push(current.trim())
      // Keep overlap
      const words = current.split(' ')
      const overlapWords = words.slice(-Math.floor(CHUNK_OVERLAP / 4))
      current = overlapWords.join(' ') + '\n' + para
      currentTok = tokens(current)
    } else {
      current = current ? current + '\n\n' + para : para
      currentTok += paraTokens
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks.filter(c => c.length > 40)
}

async function embedBatch(texts, openai) {
  const safeBatch = []
  for (const t of texts) {
    if (tokens(t) > MAX_TOKENS) safeBatch.push(t.slice(0, MAX_TOKENS * 4))
    else safeBatch.push(t)
  }
  const res = await openai.embeddings.create({ model: 'text-embedding-3-small', input: safeBatch })
  return res.data.map(d => d.embedding)
}

async function extractPdfText(buffer) {
  // Dynamic import to avoid top-level require issues
  const pdfParse = (await import('pdf-parse')).default
  const data = await pdfParse(buffer)
  return data.text
}

// ─── Core: process a PDF buffer into KB chunks ────────────────────────────────

async function processManualLocally(db, openai, { productId, pdfBuffer, manualUrl }) {
  const text = await extractPdfText(pdfBuffer)
  const chunks = chunkText(text)
  console.log(`      ${chunks.length} chunks to embed`)

  // Delete existing chunks for this product
  await db.from('manual_chunks').delete().eq('product_id', productId)

  let inserted = 0
  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    const batch     = chunks.slice(i, i + EMBED_BATCH)
    const vectors   = await embedBatch(batch, openai)
    const rows      = batch.map((text, j) => ({
      product_id: productId,
      content:    text,
      embedding:  vectors[j],
      chunk_index: i + j,
      manual_url: manualUrl,
    }))
    const { error } = await db.from('manual_chunks').insert(rows)
    if (error) throw new Error(`Insert chunks: ${error.message}`)
    inserted += batch.length
    process.stdout.write(`\r      Embedded ${inserted}/${chunks.length} chunks`)
  }
  console.log('')

  // Update product manual_url
  await db.from('products').update({ manual_url: manualUrl }).eq('id', productId)

  return { chunksCreated: chunks.length }
}

// ─── Manufacturer URL candidates ─────────────────────────────────────────────

function candidateUrls(brand, name, sku) {
  const b = (brand ?? '').toLowerCase()
  const n = (name ?? '').toLowerCase().replace(/\s+/g, '-')
  const s = (sku ?? '').toLowerCase().replace(/\s+/g, '-')
  const urls = []

  if (b.includes('doorking') || b.includes('dks')) {
    const model = (sku ?? '').replace(/[^0-9]/g, '')
    urls.push(
      `https://www.doorking.com/sites/default/files/manuals/${s}.pdf`,
      `https://www.doorking.com/sites/default/files/manuals/${model}.pdf`,
    )
  }
  if (b.includes('liftmaster')) {
    urls.push(
      `https://www.liftmaster.com/media/${s}-install-manual.pdf`,
      `https://www.liftmaster.com/content/dam/liftmaster/en-us/home/documents/manuals/${s}.pdf`,
    )
  }
  if (b.includes('brivo')) {
    urls.push(
      `https://www.brivo.com/app/uploads/manuals/${s}.pdf`,
      `https://www.brivo.com/app/uploads/manuals/${n}.pdf`,
    )
  }
  if (b.includes('ubiquiti') || b.includes('unifi')) {
    urls.push(
      `https://dl.ui.com/qsg/${sku}.pdf`,
      `https://dl.ui.com/guides/${sku}_QSG.pdf`,
      `https://dl.ui.com/manuals/${sku}.pdf`,
    )
  }
  if (b.includes('linear')) {
    urls.push(`https://www.linear-solutions.com/media/manuals/${s}.pdf`)
  }
  if (b.includes('viking')) {
    urls.push(`https://www.vikingaccess.com/wp-content/uploads/${n}-installation-manual.pdf`)
  }
  if (b.includes('alarm controls')) {
    urls.push(`https://www.alarm-controls.com/manuals/${s}.pdf`)
  }
  if (b.includes('securitron')) {
    urls.push(`https://www.securitron.com/files/${s}.pdf`)
  }
  if (b.includes('bosch')) {
    urls.push(`https://resources.boschsecurity.com/documents/${s}_Installation.pdf`)
  }
  return urls
}

async function tryFetchPdf(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'GateGuard-Portal/1.0 (manual-finder)' },
      signal:  AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('pdf') && !ct.includes('octet')) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

async function aiSearchManualUrl(openaiClient, brand, name, sku) {
  // Use Claude via the portal API to search for a manual URL
  // (This version uses OpenAI chat as a fallback since we're in a script context)
  try {
    const res = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Find the direct PDF download URL for the installation/service manual for:
Brand: ${brand}
Model: ${name}
SKU: ${sku}

Reply with ONLY the URL — no explanation, no markdown. If you cannot find a reliable direct PDF URL, reply with exactly: NOT_FOUND`,
      }],
    })
    const text = res.choices[0]?.message?.content?.trim() ?? ''
    if (text === 'NOT_FOUND' || !text.startsWith('http') || !text.includes('.pdf')) return null
    return text
  } catch {
    return null
  }
}

// ─── Task 1: Import GateGuard NEXUS User Manual ───────────────────────────────

async function importUserManual(db, openaiClient) {
  console.log('\n═══════════════════════════════════════════════')
  console.log('  Task 1: Import GateGuard NEXUS User Manual')
  console.log('═══════════════════════════════════════════════\n')

  // Find or create the "GateGuard NEXUS Portal" product
  const productName = 'GateGuard NEXUS Portal'
  const productSku  = 'GG-NEXUS-PORTAL'

  let { data: existing } = await db
    .from('products')
    .select('id, name, manual_url')
    .eq('sku', productSku)
    .single()

  let productId
  if (existing) {
    productId = existing.id
    console.log(`  ✓ Found existing product: ${existing.name} (${productId})`)
    if (existing.manual_url && !DRY_RUN) {
      console.log(`  ↻ Refreshing existing manual at ${existing.manual_url}`)
    }
  } else {
    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would create product: ${productName} (${productSku})`)
      return
    }
    const { data: created, error } = await db
      .from('products')
      .insert({
        name:          productName,
        sku:           productSku,
        brand:         'GateGuard',
        description:   'GateGuard NEXUS Dealer Portal — complete user manual covering all portal features, field tech tool, AI agents, EOS, dispatch, quotes, and billing.',
        field_service: false,
        tags:          ['portal', 'nexus', 'user-manual', 'documentation'],
      })
      .select('id')
      .single()
    if (error) throw new Error(`Create product: ${error.message}`)
    productId = created.id
    console.log(`  ✓ Created product: ${productName} (${productId})`)
  }

  // Find the PDF
  let manualPdfPath = null
  for (const p of MANUAL_PDF_CANDIDATES) {
    if (fs.existsSync(p)) { manualPdfPath = p; break }
  }

  if (!manualPdfPath) {
    console.log(`  ⚠️  User Manual PDF not found. Tried:`)
    MANUAL_PDF_CANDIDATES.forEach(p => console.log(`      ${p}`))
    console.log(`\n  To generate it, run from the repo root:`)
    console.log(`    soffice --headless --convert-to pdf \\`)
    console.log(`      ~/Desktop/Claude/GateGuard_NEXUS_User_Manual_v10.docx \\`)
    console.log(`      --outdir /tmp/`)
    console.log(`    cp /tmp/GateGuard_NEXUS_User_Manual_v10.pdf ./tmp/`)
    return
  }

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would process PDF: ${manualPdfPath}`)
    return
  }

  const pdfBuffer = fs.readFileSync(manualPdfPath)
  console.log(`  → PDF: ${manualPdfPath} (${Math.round(pdfBuffer.length / 1024)}KB)`)

  // Upload to Supabase Storage
  const storagePath = `${productId}/gateguard-nexus-portal-manual-v10.pdf`
  console.log(`  → Uploading to storage: manuals/${storagePath}`)

  const { error: uploadErr } = await db.storage
    .from('manuals')
    .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })
  if (uploadErr) throw new Error(`Storage upload: ${uploadErr.message}`)

  const manualUrl = db.storage.from('manuals').getPublicUrl(storagePath).data.publicUrl
  console.log(`  → Stored at: ${manualUrl}`)
  console.log('  → Processing chunks + embeddings...')

  const result = await processManualLocally(db, openaiClient, { productId, pdfBuffer, manualUrl })
  console.log(`  ✅  Done — ${result.chunksCreated} chunks indexed\n`)
}

// ─── Task 2/3: Auto-find manuals for products ─────────────────────────────────

async function autoFindManuals(db, openaiClient, { brand, priority } = {}) {
  const label = brand ? `${brand} products` : 'all products'
  console.log(`\n═══════════════════════════════════════════════`)
  console.log(`  ${priority ? 'Task 2' : 'Task 3'}: Auto-find manuals for ${label}`)
  console.log(`═══════════════════════════════════════════════\n`)

  let query = db
    .from('products')
    .select('id, name, brand, sku')
    .is('manual_url', null)
    .order('brand', { ascending: true })
    .order('name', { ascending: true })

  if (brand) query = query.ilike('brand', `%${brand}%`)

  const { data: products, error } = await query
  if (error) throw new Error(`Fetch products: ${error.message}`)

  if (!products || products.length === 0) {
    console.log(`  ✓ No products missing manuals${brand ? ` for brand "${brand}"` : ''}.\n`)
    return { found: 0, notFound: 0, errors: 0 }
  }

  console.log(`  Found ${products.length} product(s) missing manuals:\n`)
  products.forEach(p => console.log(`    • ${p.brand ?? '?'}: ${p.name} (${p.sku ?? 'no sku'})`))

  if (DRY_RUN) {
    console.log('\n  [DRY RUN] Would attempt to auto-find + embed each manual.\n')
    return { found: 0, notFound: products.length, errors: 0 }
  }

  console.log('')

  let found = 0, notFound = 0, errors = 0

  for (const product of products) {
    const { id: productId, name, brand: b, sku } = product
    const brandStr = b ?? ''
    process.stdout.write(`  → ${brandStr}: ${name} (${sku ?? 'no sku'}) ... `)

    let pdfBuffer = null
    let foundUrl  = null

    // Pass 1: known URL patterns
    for (const url of candidateUrls(brandStr, name, sku ?? '')) {
      pdfBuffer = await tryFetchPdf(url)
      if (pdfBuffer) { foundUrl = url; break }
    }

    // Pass 2: AI search
    if (!pdfBuffer) {
      const aiUrl = await aiSearchManualUrl(openaiClient, brandStr, name, sku ?? '')
      if (aiUrl) {
        pdfBuffer = await tryFetchPdf(aiUrl)
        if (pdfBuffer) foundUrl = aiUrl
      }
    }

    if (!pdfBuffer || !foundUrl) {
      console.log('not found')
      notFound++
      continue
    }

    console.log(`found (${Math.round(pdfBuffer.length / 1024)}KB)`)

    try {
      const safeName    = `${(sku ?? name).replace(/\s+/g, '-').toLowerCase()}-manual.pdf`
      const storagePath = `${productId}/${safeName}`

      const { error: uploadErr } = await db.storage
        .from('manuals')
        .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })
      if (uploadErr) throw new Error(`Storage: ${uploadErr.message}`)

      const manualUrl = db.storage.from('manuals').getPublicUrl(storagePath).data.publicUrl
      const result    = await processManualLocally(db, openaiClient, { productId, pdfBuffer, manualUrl })
      console.log(`      ✅  ${result.chunksCreated} chunks indexed`)
      found++
    } catch (err) {
      console.log(`      ❌  ${err.message}`)
      errors++
    }
  }

  return { found, notFound, errors }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
    console.error('\n❌  Missing required env vars.')
    console.error('    Run with: npx dotenv -e .env.local -- node scripts/seed-kb.mjs\n')
    process.exit(1)
  }

  const OpenAI = (await import('openai')).default
  const db     = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

  console.log('\n🧠  GateGuard Knowledge Base Seeder')
  console.log(`    Portal: ${PORTAL_URL}`)
  if (DRY_RUN) console.log('    Mode: DRY RUN (no changes will be made)')
  console.log('')

  const summary = { tasks: [] }

  // Task 1: User Manual
  if (!AUTO_ONLY && !BRAND_FILTER) {
    try {
      await importUserManual(db, openai)
      summary.tasks.push({ name: 'User Manual', status: 'ok' })
    } catch (err) {
      console.error(`  ❌  User Manual import failed: ${err.message}`)
      summary.tasks.push({ name: 'User Manual', status: 'error', error: err.message })
    }
  }

  // Task 2: DoorKing (priority brand)
  if (!MANUAL_ONLY && (!BRAND_FILTER || BRAND_FILTER.toLowerCase().includes('doorking'))) {
    try {
      const r = await autoFindManuals(db, openai, { brand: 'DoorKing', priority: true })
      summary.tasks.push({ name: 'DoorKing auto-find', ...r })
    } catch (err) {
      console.error(`  ❌  DoorKing auto-find failed: ${err.message}`)
      summary.tasks.push({ name: 'DoorKing auto-find', status: 'error', error: err.message })
    }
  }

  // Task 3: All other brands missing manuals
  if (!MANUAL_ONLY && !BRAND_FILTER) {
    try {
      const r = await autoFindManuals(db, openai, {})
      summary.tasks.push({ name: 'All brands auto-find', ...r })
    } catch (err) {
      console.error(`  ❌  All-brands auto-find failed: ${err.message}`)
      summary.tasks.push({ name: 'All brands auto-find', status: 'error', error: err.message })
    }
  } else if (BRAND_FILTER && !BRAND_FILTER.toLowerCase().includes('doorking')) {
    try {
      const r = await autoFindManuals(db, openai, { brand: BRAND_FILTER })
      summary.tasks.push({ name: `${BRAND_FILTER} auto-find`, ...r })
    } catch (err) {
      console.error(`  ❌  ${BRAND_FILTER} auto-find failed: ${err.message}`)
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════')
  console.log('  Summary')
  console.log('═══════════════════════════════════════════════')
  for (const t of summary.tasks) {
    if (t.status === 'error') {
      console.log(`  ❌  ${t.name}: ${t.error}`)
    } else {
      const parts = []
      if (t.found    !== undefined) parts.push(`${t.found} found`)
      if (t.notFound !== undefined) parts.push(`${t.notFound} not found`)
      if (t.errors   !== undefined && t.errors > 0) parts.push(`${t.errors} errors`)
      console.log(`  ✅  ${t.name}${parts.length ? ': ' + parts.join(', ') : ''}`)
    }
  }
  console.log('')
}

main().catch(err => { console.error(err); process.exit(1) })
