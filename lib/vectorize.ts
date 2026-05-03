/**
 * lib/vectorize.ts
 *
 * PDF manual → searchable vector chunks pipeline.
 *
 * Flow:
 *   1. Accept a PDF buffer (from upload or Storage URL)
 *   2. Extract text page-by-page
 *   3. Chunk into ~400-token overlapping passages
 *   4. Embed with OpenAI text-embedding-3-small (1536 dims)
 *   5. Upsert into manual_chunks, keyed to a product row
 *
 * Add deps:  npm install openai pdf-parse
 *            npm install --save-dev @types/pdf-parse
 */

import OpenAI         from 'openai'
import { createClient } from '@supabase/supabase-js'

// ─── Config ───────────────────────────────────────────────────────────────────
const CHUNK_SIZE    = 400   // target tokens (~4 chars each)
const CHUNK_OVERLAP = 60
const EMBED_MODEL   = 'text-embedding-3-small'
const EMBED_BATCH   = 20   // chunks per OpenAI call

// ─── Clients ──────────────────────────────────────────────────────────────────
const openai = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export const serviceDb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

// ─── Chunking ─────────────────────────────────────────────────────────────────
function tokens(text: string) { return Math.ceil(text.length / 4) }

export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  const paragraphs = normalized.split(/\n\n+/)
  const chunks: string[] = []
  let current = ''
  let currentTok = 0

  for (const para of paragraphs) {
    const pt = tokens(para)
    if (currentTok + pt > CHUNK_SIZE && current) {
      chunks.push(current.trim())
      const overlapWords = current.split(' ').slice(-Math.floor(CHUNK_OVERLAP * 0.75))
      current    = overlapWords.join(' ') + '\n\n' + para
      currentTok = tokens(current)
    } else {
      current    = current ? current + '\n\n' + para : para
      currentTok += pt
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks.filter(c => c.length > 40)
}

export function extractSectionTitle(chunk: string): string | null {
  const first = chunk.split('\n')[0].trim()
  if (first.length < 80 && (first === first.toUpperCase() || /^[A-Z]/.test(first)))
    return first
  return null
}

// ─── PDF extraction ───────────────────────────────────────────────────────────
export async function extractPdfText(buf: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default
  const data = await pdfParse(buf)
  return data.text
}

// ─── Embedding ────────────────────────────────────────────────────────────────
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await openai().embeddings.create({ model: EMBED_MODEL, input: texts })
  return res.data.map((d: { embedding: number[] }) => d.embedding)
}

// ─── Main pipeline ────────────────────────────────────────────────────────────
export interface ProcessManualResult {
  chunksCreated:  number
  manualUrl:      string
}

export async function processManual(opts: {
  productId:  string
  pdfBuffer:  Buffer
  manualUrl:  string
  onProgress?: (msg: string) => void
}): Promise<ProcessManualResult> {
  const { productId, pdfBuffer, manualUrl, onProgress } = opts
  const log  = onProgress ?? ((m: string) => console.log('[vectorize]', m))
  const db   = serviceDb()

  log('Extracting text…')
  const text   = await extractPdfText(pdfBuffer)
  const chunks = chunkText(text)
  log(`${chunks.length} chunks from PDF`)

  // Remove old chunks for this product+manual (re-upload)
  await db.from('manual_chunks').delete()
    .eq('product_id', productId).eq('manual_url', manualUrl)

  let created = 0
  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    const batch  = chunks.slice(i, i + EMBED_BATCH)
    log(`Embedding ${i + 1}–${Math.min(i + EMBED_BATCH, chunks.length)} / ${chunks.length}…`)
    const embeds = await embedBatch(batch)
    const rows   = batch.map((content, j) => ({
      product_id:    productId,
      manual_url:    manualUrl,
      chunk_index:   i + j,
      section_title: extractSectionTitle(content),
      content,
      embedding:     JSON.stringify(embeds[j]),
      token_count:   tokens(content),
    }))
    const { error } = await db.from('manual_chunks').insert(rows)
    if (error) throw new Error(`Insert failed at batch ${i}: ${error.message}`)
    created += batch.length
  }

  // Update product manual_url
  await db.from('products').update({ manual_url: manualUrl }).eq('id', productId)

  log(`✅ ${created} chunks stored`)
  return { chunksCreated: created, manualUrl }
}

// ─── Semantic search ──────────────────────────────────────────────────────────
export interface KnowledgeResult {
  source:        'manual' | 'article'
  id:            string
  product_id:    string
  product_name:  string
  product_sku:   string
  manual_url:    string | null
  page_number:   number | null
  section_title: string | null
  content:       string
  similarity:    number
}

export async function searchKnowledge(
  query:         string,
  productId?:    string,
  matchCount  =  8,
  threshold   =  0.42
): Promise<KnowledgeResult[]> {
  const db  = serviceDb()
  const [embedding] = await embedBatch([query])
  const { data, error } = await db.rpc('match_knowledge', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count:     matchCount,
    filter_product:  productId ?? null,
  })
  if (error) throw new Error(`Vector search failed: ${error.message}`)
  return (data ?? []) as KnowledgeResult[]
}
