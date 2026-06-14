'use client'

import { useEffect, useState } from 'react'
import { UserGlassWindow, type UserWindowData } from '@/components/nexus/windows/UserGlassWindow'

type Bucket = 'platform_users' | 'feature_settings' | 'dealer_access' | 'needs_review'

type AdminItem = {
  id: string
  bucket: Bucket
  title: string
  subtitle: string
  status: string
  meta?: string | null
}

const buckets: Bucket[] = ['platform_users', 'feature_settings', 'dealer_access', 'needs_review']

function label(bucket: Bucket) {
  if (bucket === 'platform_users') return 'Platform Users'
  if (bucket === 'feature_settings') return 'Feature Settings'
  if (bucket === 'dealer_access') return 'Dealer Access'
  return 'Needs Review'
}

function color(bucket: Bucket) {
  if (bucket === 'needs_review') return '#F87171'
  if (bucket === 'dealer_access') return '#34D399'
  if (bucket === 'feature_settings') return '#8B5CF6'
  return '#00C8FF'
}

export function InternalUsersFeaturesBoard() {
  const [items, setItems] = useState<AdminItem[]>([])
  const [bucket, setBucket] = useState<Bucket>('platform_users')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [userWindow, setUserWindow] = useState<UserWindowData | null>(null)
  const [openUserId, setOpenUserId] = useState<string | null>(null)
  const [userBusy, setUserBusy] = useState(false)

  async function openUser(profileId: string) {
    setUserBusy(true); setMessage(null); setOpenUserId(profileId)
    try {
      const res = await fetch(`/api/nexus/internal/user-window/${profileId}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error(data?.message ?? 'Could not open user.')
      setUserWindow(data as UserWindowData)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not open user.')
      setOpenUserId(null)
    } finally {
      setUserBusy(false)
    }
  }

  function handleRowClick(itemId: string) {
    if (itemId.startsWith('user-')) {
      void openUser(itemId.slice('user-'.length))
    } else {
      setSelectedId(itemId)
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/nexus/internal/users-features')
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data.success === false) throw new Error(data?.message ?? 'Could not load users/features.')
        const next = Array.isArray(data.items) ? data.items as AdminItem[] : []
        setItems(next)
        if (next.length === 0) setMessage('No users or feature settings found yet.')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not load users/features.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const shown = items.filter(item => item.bucket === bucket)
  const selected = items.find(item => item.id === selectedId) ?? null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {buckets.map(nextBucket => {
          const c = color(nextBucket)
          const count = items.filter(item => item.bucket === nextBucket).length
          const active = bucket === nextBucket
          return (
            <button key={nextBucket} type="button" onClick={() => { setBucket(nextBucket); setSelectedId(null) }} className="rounded-2xl px-3 py-3 text-left" style={{ background: active ? `${c}1f` : 'rgba(0,0,0,0.18)', border: active ? `1px solid ${c}66` : '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: c }}>{label(nextBucket)}</div>
              <div className="mt-1 text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>{count}</div>
            </button>
          )
        })}
      </div>

      {loading && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)' }}>Loading users and features…</div>}
      {message && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)' }}>{message}</div>}
      {!loading && shown.length === 0 && !message && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)' }}>No {label(bucket).toLowerCase()} items right now.</div>}

      <div className="space-y-2">
        {shown.map(item => {
          const c = color(item.bucket)
          const active = selectedId === item.id
          const isUser = item.id.startsWith('user-')
          const opening = isUser && userBusy && openUserId === item.id.slice('user-'.length)
          return (
            <button key={item.id} type="button" onClick={() => handleRowClick(item.id)} className="w-full rounded-2xl px-3 py-3 text-left" style={{ background: active ? `${c}1f` : 'rgba(0,0,0,0.18)', border: active ? `1px solid ${c}66` : '1px solid rgba(255,255,255,0.06)', opacity: opening ? 0.6 : 1 }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{item.title}</div>
                  <div className="mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.48)' }}>{item.subtitle}</div>
                  {item.meta && <div className="mt-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.34)' }}>{item.meta}</div>}
                </div>
                <div className="rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ background: `${c}1f`, border: `1px solid ${c}44`, color: c }}>{item.status}</div>
              </div>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="rounded-3xl p-4" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)' }}>
          <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#ddd6fe' }}>Selected Admin Item</div>
          <div className="mt-1 text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>{selected.title}</div>
          <div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.54)' }}>{selected.subtitle}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'linear-gradient(135deg, #8B5CF6, #007CFF)', color: 'white' }}>Review</button>
            <button type="button" className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.62)' }}>Open Admin Page</button>
          </div>
        </div>
      )}

      {userWindow && (
        <UserGlassWindow
          data={userWindow}
          onBack={() => { setUserWindow(null); setOpenUserId(null) }}
          onRefresh={async () => { if (openUserId) await openUser(openUserId) }}
        />
      )}
    </div>
  )
}
