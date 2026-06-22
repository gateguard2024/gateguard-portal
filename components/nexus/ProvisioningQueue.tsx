'use client'

// Corporate "Sites to provision" queue — the list of controllers auto-created
// when deals are won. Clicking one opens that site straight to the Controllers
// tab so corporate can enter the serial + program Brivo.
import React, { useEffect, useState } from 'react'
import { SiteDetailDrawer } from '@/components/nexus/OperationsHub'

type QueueItem = { panel_id: string; site_id: string; site_name: string; location: string | null; dealer_name: string | null; doors: string[]; dealer_confirmed: boolean; created_at: string }

export function ProvisioningQueue() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [openSite, setOpenSite] = useState<string | null>(null)

  const load = React.useCallback(() => {
    setLoading(true)
    fetch('/api/admin/provisioning').then(r => r.json()).then(d => setItems(d.queue ?? [])).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Loading provisioning queue…</div>
  if (items.length === 0) return <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>Nothing waiting to provision. Won deals show up here automatically.</div>

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{items.length} site{items.length === 1 ? '' : 's'} won and waiting for a controller. Open one to enter the serial and program Brivo.</div>
      {items.map(it => (
        <button key={it.panel_id} onClick={() => setOpenSite(it.site_id)} style={{ textAlign: 'left', cursor: 'pointer', background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>{it.site_name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{[it.location, it.dealer_name].filter(Boolean).join(' · ') || '—'}</div>
              {it.doors.length > 0 && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>{it.doors.length} door{it.doors.length === 1 ? '' : 's'}: {it.doors.join(', ')}</div>}
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', color: it.dealer_confirmed ? '#6ee7b7' : '#fbbf24' }}>{it.dealer_confirmed ? 'Doors confirmed ✓' : 'Awaiting dealer'}</span>
          </div>
        </button>
      ))}
      {openSite && <SiteDetailDrawer id={openSite} systemsTab="controllers" onClose={() => { setOpenSite(null); load() }} />}
    </div>
  )
}
