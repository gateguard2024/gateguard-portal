/**
 * POST /api/kb/find-manual
 *
 * Given a product_id, automatically locates the installation manual PDF
 * from the manufacturer's website, downloads it, and runs the full
 * chunk + embed pipeline — no manual upload required.
 *
 * Strategy (in order):
 *   1. Known manufacturer URL patterns (fast, no search needed)
 *   2. Bing/DuckDuckGo search for "[brand] [model] installation manual filetype:pdf"
 *   3. Return found=false if nothing located
 */

import { NextRequest, NextResponse }  from 'next/server'
import { auth }                        from '@clerk/nextjs/server'
import { processManual, serviceDb }    from '@/lib/vectorize'
import Anthropic                       from '@anthropic-ai/sdk'

export const maxDuration = 60
export const dynamic     = 'force-dynamic'

// ─── Manufacturer URL patterns ────────────────────────────────────────────────
// Each entry produces candidate URLs to try in order.
function candidateUrls(brand: string, name: string, sku: string): string[] {
  const b   = brand.toLowerCase()
  const n   = name.toLowerCase().replace(/\s+/g, '-')
  const s   = sku.toLowerCase().replace(/\s+/g, '-')
  const urls: string[] = []

  // DoorKing — manuals at doorking.com
  if (b.includes('doorking') || b.includes('dks')) {
    const model = sku.replace(/[^0-9]/g, '') // extract numeric model
    urls.push(
      `https://www.doorking.com/sites/default/files/manuals/${s}.pdf`,
      `https://www.doorking.com/sites/default/files/manuals/${model}.pdf`,
    )
  }

  // LiftMaster
  if (b.includes('liftmaster')) {
    urls.push(
      `https://www.liftmaster.com/media/${s}-install-manual.pdf`,
      `https://www.liftmaster.com/content/dam/liftmaster/en-us/home/documents/manuals/${s}.pdf`,
    )
  }

  // Brivo — installation guides at brivo.com
  if (b.includes('brivo')) {
    urls.push(
      `https://www.brivo.com/app/uploads/manuals/${s}.pdf`,
      `https://www.brivo.com/app/uploads/manuals/${n}.pdf`,
    )
  }

  // Ubiquiti — dl.ui.com download server
  if (b.includes('ubiquiti') || b.includes('unifi')) {
    urls.push(
      `https://dl.ui.com/qsg/${sku}.pdf`,
      `https://dl.ui.com/guides/${sku}_QSG.pdf`,
      `https://dl.ui.com/manuals/${sku}.pdf`,
    )
  }

  // Linear / Linear OSCO
  if (b.includes('linear')) {
    urls.push(
      `https://www.linear-solutions.com/media/manuals/${s}.pdf`,
    )
  }

  // Viking Access
  if (b.includes('viking')) {
    urls.push(
      `https://www.vikingaccess.com/wp-content/uploads/${n}-installation-manual.pdf`,
    )
  }

  // Alarm Controls
  if (b.includes('alarm controls')) {
    urls.push(
      `https://www.alarm-controls.com/manuals/${s}.pdf`,
    )
  }

  // Securitron
  if (b.includes('securitron')) {
    urls.push(
      `https://www.securitron.com/files/${s}.pdf`,
    )
  }

  // Bosch
  if (b.includes('bosch')) {
    urls.push(
      `https://resources.boschsecurity.com/documents/${s}_Installation.pdf`,
    )
  }

  return urls
}

// ─── Try to download a PDF from a URL ────────────────────────────────────────
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

// ─── Claude-assisted web search for manual URL ───────────────────────────────
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

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { product_id } = await req.json()
    if (!product_id) return NextResponse.json({ error: 'product_id required' }, { status: 400 })

    const db      = serviceDb()
    const { data: product, error: pe } = await db
      .from('products')
      .select('id, name, brand, sku, manual_url')
      .eq('id', product_id)
      .single()

    if (pe || !product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    if (product.manual_url) {
      return NextResponse.json({ found: true, already: true, manualUrl: product.manual_url })
    }

    const { brand, name, sku } = product

    // ── Pass 1: known URL patterns ────────────────────────────────────────
    let pdfBuffer: Buffer | null = null
    let foundUrl: string | null  = null

    for (const url of candidateUrls(brand, name, sku)) {
      pdfBuffer = await tryFetchPdf(url)
      if (pdfBuffer) { foundUrl = url; break }
    }

    // ── Pass 2: Claude knowledge of manufacturer URLs ─────────────────────
    if (!pdfBuffer) {
      const aiUrl = await searchForManualUrl(brand, name, sku)
      if (aiUrl) {
        pdfBuffer = await tryFetchPdf(aiUrl)
        if (pdfBuffer) foundUrl = aiUrl
      }
    }

    if (!pdfBuffer || !foundUrl) {
      return NextResponse.json({ found: false, message: `No manual located for ${brand} ${name} (${sku})` })
    }

    // ── Upload to storage + process ───────────────────────────────────────
    const safeName    = `${sku.replace(/\s+/g, '-').toLowerCase()}-manual.pdf`
    const storagePath = `${product_id}/${safeName}`

    const { error: uploadErr } = await db.storage
      .from('manuals')
      .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })
    if (uploadErr) throw new Error(`Storage upload: ${uploadErr.message}`)

    const manualUrl = db.storage.from('manuals').getPublicUrl(storagePath).data.publicUrl
    const result    = await processManual({ productId: product_id, pdfBuffer, manualUrl })

    return NextResponse.json({ found: true, ...result })

  } catch (err: any) {
    console.error('[kb/find-manual]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
