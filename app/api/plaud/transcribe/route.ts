import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { currentUser } from '@clerk/nextjs/server'

const PLAUD_BASE = 'https://platform.plaud.ai/developer/api'
const POLL_INTERVAL_MS = 2500
const POLL_TIMEOUT_MS = 120_000 // 2 minutes max

// ─── Helper: get Plaud partner access token ──────────────────────────────────
async function getPlaudToken(): Promise<string> {
  const clientId = process.env.PLAUD_CLIENT_ID
  const secretKey = process.env.PLAUD_SECRET_KEY
  if (!clientId || !secretKey) {
    throw new Error('PLAUD_CLIENT_ID and PLAUD_SECRET_KEY env vars are required')
  }

  const credentials = Buffer.from(`${clientId}:${secretKey}`).toString('base64')
  const res = await fetch(`${PLAUD_BASE}/oauth/partner/access-token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}` },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Plaud auth failed (${res.status}): ${body}`)
  }
  const data = await res.json()
  return data.access_token as string
}

// ─── Helper: submit transcription job ────────────────────────────────────────
async function submitTranscription(token: string, fileUrl: string): Promise<string> {
  const res = await fetch(`${PLAUD_BASE}/open/partner/ai/transcriptions/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file_url: fileUrl,
      params: {
        transcribe: { language: 'auto', detection_level: 'segment' },
        diarization: { enabled: false },
        vad: { decode_silence: false },
      },
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Plaud transcription submit failed (${res.status}): ${body}`)
  }
  const data = await res.json()
  return data.transcription_id as string
}

// ─── Helper: poll for completion ──────────────────────────────────────────────
async function pollTranscription(
  token: string,
  transcriptionId: string,
): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    const res = await fetch(
      `${PLAUD_BASE}/open/partner/ai/transcriptions/${transcriptionId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!res.ok) throw new Error(`Plaud poll failed (${res.status})`)
    const data = await res.json()

    if (data.status === 'SUCCESS') {
      // Concatenate all segments into plain text
      const segments: Array<{ text: string; start: number }> =
        data.data?.results ?? []
      const transcript = segments
        .sort((a, b) => a.start - b.start)
        .map((s) => s.text.trim())
        .filter(Boolean)
        .join(' ')
      return transcript
    }

    if (data.status === 'FAILURE' || data.status === 'REVOKED') {
      throw new Error(`Plaud transcription ${data.status.toLowerCase()}`)
    }

    // Still RECEIVED or PROGRESS — wait and retry
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
  throw new Error('Plaud transcription timed out after 2 minutes')
}

// ─── Main route ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Auth: x-tech-code (field techs) OR Clerk session (portal users)
  const techCode = req.headers.get('x-tech-code') ?? ''
  const techOk   = !!(process.env.TECH_ACCESS_CODE && techCode === process.env.TECH_ACCESS_CODE)
  const portalOk = techOk ? false : !!(await currentUser().catch(() => null))
  if (!techOk && !portalOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('audio') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No audio file provided (field: audio)' }, { status: 400 })
    }

    // ── Step 1: Upload audio to Supabase Storage (plaud-recordings bucket) ──
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Auto-create the bucket if it doesn't exist (same pattern as manuals bucket)
    const { data: buckets } = await supabase.storage.listBuckets()
    const bucketName = 'plaud-recordings'
    if (!buckets?.find((b) => b.name === bucketName)) {
      await supabase.storage.createBucket(bucketName, { public: true })
    }

    const ext = file.name.split('.').pop() ?? 'm4a'
    const objectPath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(objectPath, arrayBuffer, {
        contentType: file.type || 'audio/mp4',
        upsert: false,
      })
    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

    // Get public URL
    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(objectPath)
    const publicUrl = urlData.publicUrl

    // ── Step 2: Transcribe via Plaud API ────────────────────────────────────
    const plaudToken = await getPlaudToken()
    const transcriptionId = await submitTranscription(plaudToken, publicUrl)
    const transcript = await pollTranscription(plaudToken, transcriptionId)

    // ── Step 3: Clean up storage (fire and forget) ───────────────────────────
    supabase.storage.from(bucketName).remove([objectPath]).catch(() => {})

    return NextResponse.json({ transcript, transcription_id: transcriptionId })
  } catch (err: any) {
    console.error('[plaud/transcribe]', err)
    return NextResponse.json({ error: err.message ?? 'Transcription failed' }, { status: 500 })
  }
}
