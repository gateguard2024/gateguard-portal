'use client'

import { useRouter } from 'next/navigation'

export const NEXUS_TABS = [
  { id: 'my-day',  label: 'My Day',           href: '/?tab=my-day' },
  { id: 'recent',  label: 'Recent Work',       href: '/?tab=recent' },
  { id: 'opps',    label: 'New Opps/Leads',    href: '/opps',        badge: 0 },
  { id: 'jobs',    label: 'Jobs',              href: '/?tab=jobs' },
  { id: 'field',   label: 'Field',             href: '/?tab=field' },
  { id: 'people',  label: 'People',            href: '/?tab=people' },
] as const

export type NexusTabId = typeof NEXUS_TABS[number]['id']

interface Props {
  activeTab: NexusTabId
  badge?: number // badge count for Opps tab
}

export function NexusBottomNav({ activeTab, badge }: Props) {
  const router = useRouter()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20"
      style={{
        background:
          'linear-gradient(to top, rgba(2,8,16,0.98) 0%, rgba(2,8,16,0.82) 100%)',
        backdropFilter: 'blur(16px)',
        borderTop: '0.5px solid rgba(107,126,255,0.1)',
      }}
    >
      <div className="flex justify-center gap-2 px-4 py-3 overflow-x-auto scrollbar-none">
        {NEXUS_TABS.map(tab => {
          const isActive = tab.id === activeTab
          const tabBadge = tab.id === 'opps' ? badge : undefined

          return (
            <button
              key={tab.id}
              onClick={() => router.push(tab.href)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all duration-200"
              style={
                isActive
                  ? {
                      background: 'rgba(107,126,255,0.2)',
                      border: '1px solid rgba(107,126,255,0.45)',
                      color: '#93a3ff',
                    }
                  : {
                      background: 'transparent',
                      border: '0.5px solid rgba(255,255,255,0.07)',
                      color: 'rgba(255,255,255,0.3)',
                    }
              }
            >
              {tab.label}
              {tabBadge != null && tabBadge > 0 && (
                <span
                  className="rounded-full font-medium leading-none"
                  style={{
                    background: '#6B7EFF',
                    color: 'white',
                    padding: '2px 6px',
                    fontSize: '10px',
                  }}
                >
                  {tabBadge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
