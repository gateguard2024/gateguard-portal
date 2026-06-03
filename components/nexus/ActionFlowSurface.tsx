'use client'

export type NexusTabId = 'my-day' | 'recent' | 'opps' | 'jobs' | 'field' | 'people'

export function ActionFlowSurface({ activeTab }: { activeTab: NexusTabId | null }) {
  return (
    <section className="mt-9 w-full max-w-4xl">
      <div className="rounded-[2rem] p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>
          Nexus action flow: {activeTab ?? 'opps'}
        </p>
      </div>
    </section>
  )
}
