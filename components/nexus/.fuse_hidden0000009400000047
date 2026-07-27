'use client'

import { useEffect, useState } from 'react'
import { JobGlassWindow } from '@/components/nexus/windows/JobGlassWindow'

export function MyDayRelatedJobGlass({
  jobId,
  onBack,
  onRefreshMyDay,
}: {
  jobId: string
  onBack: () => void
  onRefreshMyDay?: () => Promise<void> | void
}) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadJob() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/nexus/jobs/job-window/${jobId}`)
      const payload = await res.json().catch(() => ({}))
      if (!res.ok || payload.success === false) throw new Error(payload?.message ?? 'Could not open related job.')
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open related job.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadJob()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  async function refresh() {
    await loadJob()
    await onRefreshMyDay?.()
  }

  return (
    <section className="mt-9 w-full max-w-5xl">
      <div
        className="rounded-[2rem] p-5 sm:p-6"
        style={{
          background: 'linear-gradient(180deg, rgba(0,200,255,0.07), rgba(255,255,255,0.022))',
          border: '1px solid rgba(0,200,255,0.14)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.32), 0 0 38px rgba(0,200,255,0.07), inset 0 1px 0 rgba(255,255,255,0.06)',
          backdropFilter: 'blur(24px)',
        }}
      >
        {loading && (
          <div className="rounded-3xl p-5 text-sm" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.62)' }}>
            Opening related job…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-3xl p-5">
            <button type="button" onClick={onBack} className="mb-4 rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.58)' }}>← Back to Top 10</button>
            <div className="text-sm" style={{ color: 'rgba(255,255,255,0.72)' }}>{error}</div>
          </div>
        )}

        {!loading && data && (
          <JobGlassWindow
            data={data as Parameters<typeof JobGlassWindow>[0]['data']}
            onBack={onBack}
            onRefresh={refresh}
          />
        )}
      </div>
    </section>
  )
}
