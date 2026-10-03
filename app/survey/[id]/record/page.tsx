'use client'

/**
 * /survey/[id]/record — rep-facing editor for the Pre-Proposal Survey record.
 * Full-screen, steel left rail, live document on the right. No portal sidebar.
 */
import { useParams } from 'next/navigation'
import { SurveyEditor } from '@/components/surveys/SurveyEditor'

export default function SurveyRecordEditorPage() {
  const params = useParams()
  const id = String(params?.id ?? '')
  return <SurveyEditor id={id} />
}
