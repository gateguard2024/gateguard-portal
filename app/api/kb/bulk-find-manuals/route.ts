/**
 * POST /api/kb/bulk-find-manuals
 *
 * Iterates over all products where manual_url IS NULL and attempts to
 * auto-find + process each one via the same logic as /api/kb/find-manual.
 *
 * Returns a streaming-friendly JSON response with per-product results.
 *
 * Optional body:
 *   { brand?: string }   — filter to a specific brand (e.g. "DoorKing")
 *   { limit?: number }   — max products to process in this run (default 50)
 *   { dry_run?: boolean } — if true, only list products that need manuals, don't process
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth }                       from '@clerk/nextjs/server'
import { processManual, serviceDb }   from '@/lib/vectorize'
import Anthropic                      from '@anthropic-ai/sdk'

export const maxDuration = 300   // 5 min — batch job
export const dynamic     = 'force-dynamic'

// ─── Manufacturer URL patterns (mirrors find-manual) ─────────────────────────
function candidateUrls(brand: string, name: string, sku: string): string[] {
  const b   = brand.toLowerCase()
  const n   = name.toLowerCase().replace(/\s+/g, '-')
  const s   = sku.toLowerCase().replace(/\s+/g, '-')
  const urls: string[] = []

  if (b.includes('doorking') || b.includes('dks')) {
    const model = sku.replace(/[^0-9]/g, '')
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

async function tryFetchPdf(url: string): Promise<Buffer | null> {
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

async function searchForManualUrl(brand: string, name: string, sku: string): Promise<string | null> {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const msg = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role:    'user',
        content: `Find the direct PDF download URL for the installation/service manual for:
Brand: ${brand}
Model: ${name}
SKU: ${sku}

Reply with ONLY the URL — no explanation, no markdown. If you cannot find a reliable direct PDF URL, reply with exactly: NOT_FOUND`,
      }],
    })
    const text = (msg.content[0] as { text: string }).text.trim()
    if (text === 'NOT_FOUND' || !text.startsWith('http') || !text.includes('.pdf')) return null
    return text
  } catch {
    return null
  }
}

// ─── Process a single product ─────────────────────────────────────────────────
async function processProduct(product: {
  id: string; name: string; brand: string; sku: string
}): Promise<{
  status: 'found' | 'not_found' | 'error'
  manualUrl?: string
  message?: string
}> {
  const db = serviceDb()
  const { brand, name, sku, id: product_id } = product

  let pdfBuffer: Buffer | null = null
  let foundUrl: string | null  = null

  // Pass 1: known patterns
  for (const url of candidateUrls(brand ?? '', name, sku ?? '')) {
    pdfBuffer = await tryFetchPdf(url)
    if (pdfBuffer) { foundUrl = url; break }
  }

  // Pass 2: Claude AI search
  if (!pdfBuffer) {
    const aiUrl = await searchForManualUrl(brand ?? '', name, sku ?? '')
    if (aiUrl) {
      pdfBuffer = await tryFetchPdf(aiUrl)
      if (pdfBuffer) foundUrl = aiUrl
    }
  }

  if (!pdfBuffer || !foundUrl) {
    return { status: 'not_found', message: `No manual located for ${brand} ${name} (${sku})` }
  }

  try {
    const safeName    = `${(sku ?? name).replace(/\s+/g, '-').toLowerCase()}-manual.pdf`
    const storagePath = `${product_id}/${safeName}`

    const { error: uploadErr } = await db.storage
      .from('manuals')
      .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })
    if (uploadErr) throw new Error(`Storage upload: ${uploadErr.message}`)

    const manualUrl = db.storage.from('manuals').getPublicUrl(storagePath).data.publicUrl
    await processManual({ productId: product_id, pdfBuffer, manualUrl })

    return { status: 'found', manualUrl }
  } catch (err: any) {
    return { status: 'error', message: err.message }
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { brand, limit = 50, dry_run = false } = body as {
    brand?: string
    limit?: number
    dry_run?: boolean
  }

  const db = serviceDb()

  let query = db
    .from('products')
    .select('id, name, brand, sku')
    .is('manual_url', null)
    .order('name')
    .limit(limit)

  if (brand) {
    query = query.ilike('brand', `%${brand}%`)
  }

  const { data: products, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!products || products.length === 0) {
    return NextResponse.json({ message: 'All products already have manuals', results: [] })
  }

  if (dry_run) {
    return NextResponse.json({
      dry_run: true,
      count: products.length,
      products: products.map(p => ({ id: p.id, name: p.name, brand: p.brand, sku: p.sku })),
    })
  }

  const results: Array<{
    id: string
    name: string
    brand: string
    sku: string
    status: string
    manualUrl?: string
    message?: string
  }> = []

  for (const product of products) {
    const result = await processProduct(product)
    results.push({
      id:       product.id,
      name:     product.name,
      brand:    product.brand,
      sku:      product.sku,
      ...result,
    })
  }

  const found    = results.filter(r => r.status === 'found').length
  const notFound = results.filter(r => r.status === 'not_found').length
  const errors   = results.filter(r => r.status === 'error').length

  return NextResponse.json({
    processed: results.length,
    found,
    not_found: notFound,
    errors,
    results,
  })
}
