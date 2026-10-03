'use client'

/**
 * /survey/[id]/document — the client-facing Pre-Proposal Survey record, standalone
 * (no portal chrome) so it reads as a clean document and prints to PDF cleanly.
 */
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { SurveyRecord } from '@/components/public/SurveyRecord'

export default function SurveyDocumentPage() {
  const params = useParams()
  const id = String(params?.id ?? '')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [survey, setSurvey] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/surveys/${id}`).then(r => r.json()).then(j => {
      if (j?.error) { setErr(j.error); return }
      setSurvey(j.survey || {})
    }).catch(() => setErr('Could not load this survey.'))
  }, [id])

  if (err) return <div style={{ padding: 40, color: '#b91c1c' }}>{err}</div>
  if (!survey) return <div style={{ padding: 40, color: '#5a6c84' }}>Loading…</div>
  return (
    <div style={{ background: '#EEF3FA', minHeight: '100vh', padding: '24px 0' }}>
      <SurveyRecord survey={survey} cfg={survey.survey_doc || {}} />
    </div>
  )
}
