'use client'
/**
 * Systems → Live: the camera wall (Eagle Eye + Gate Guard Edge, with timeline,
 * playback and event search — cameras/CamerasTab) plus "watch & unlock" tiles for
 * doors that have a camera linked.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { CamerasTab } from './cameras/CamerasTab'
import { type Any, Card, ClipSheet, Dot, DOT, LiveCam, MUTED, Note, NotConnected, previewUrl, send, getJson, fmtWhen, type SiteCtx } from './shared'


export function LiveTab({ ctx, cams, camErr, doors, camMap, reloadDoors }: {
  ctx: SiteCtx
  cams: Any[] | null; camErr: string | null
  doors: Any[] | null; camMap: Record<string, Any>
  reloadDoors: () => void
}) {
  const { siteId, isCorporate, notify, openSetup } = ctx
  const [tick, setTick] = useState(0)
  const [clip, setClip] = useState<{ camId: string; name: string; ts: string } | null>(null)
  const [unlocks, setUnlocks] = useState<Any[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const noPreview = useRef<Set<string>>(new Set())
  const [, force] = useState(0)

  // Refresh frames every 5s, but only while the page is visible.
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) setTick(n => n + 1) }, 5000)
    return () => clearInterval(t)
  }, [])
  // Recent unlocks (site events) → "clip" links under each door tile.
  useEffect(() => {
    void getJson(`/api/sites/${siteId}`).then(r => setUnlocks(((r.data.events ?? []) as Any[]).filter(e => e.event_type === 'door_unlock')))
  }, [siteId, reloadDoors])

  const markBad = useCallback((id: string) => { if (!noPreview.current.has(id)) { noPreview.current.add(id); force(n => n + 1) } }, [])

  async function unlock(d: Any) {
    if (!window.confirm(`Unlock “${d.name}” now? This physically unlocks it.`)) return
    setBusy(String(d.id))
    const r = await send(`/api/brivo/doors/${d.id}`, 'POST', { site_id: siteId, door_name: d.name, confirm: true })
    setBusy(null)
    notify(r.ok ? `${d.name} unlocked — logged.` : (r.data.error || 'Couldn’t unlock.'), r.ok)
  }

  const camDoors = (doors ?? []).filter(d => camMap[String(d.id)]?.camera_id)

  return (
    <div className="sy-stack">
      <CamerasTab ctx={ctx} fallbackCams={cams} fallbackErr={camErr} />

      <Card title="Doors with a camera" sub="Watch while you unlock. Link cameras to doors under Doors & gates.">
        {doors == null ? <div className="sy-empty">Loading doors…</div>
          : !camDoors.length ? <div className="sy-empty">No door has a camera linked yet.</div>
          : (
            <div className="sy-cams">
              {camDoors.map(d => {
                const m = camMap[String(d.id)]
                const camId = String(m.camera_id)
                const recent = unlocks.filter(e => e.metadata?.door_id === d.id).slice(0, 2)
                return (
                  <div key={d.id} style={{ display: 'grid', gap: 8 }}>
                    <button type="button" className="sy-cam" aria-label={`${d.name} camera — open recording`} onClick={() => setClip({ camId, name: m.camera_name || d.name, ts: new Date(Date.now() - 120000).toISOString() })}>
                      {!noPreview.current.has(camId) ? <LiveCam src={previewUrl(siteId, camId, tick)} alt={m.camera_name || d.name} onError={() => markBad(camId)} /> : <div className="off">No live preview</div>}
                      <span className="nm">{d.name}{m.camera_name ? ` · ${m.camera_name}` : ''}</span>
                    </button>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="sy-b pri sm" style={{ flex: 1 }} onClick={() => unlock(d)} disabled={busy === String(d.id)}>{busy === String(d.id) ? 'Unlocking…' : 'Unlock'}</button>
                    </div>
                    {recent.map(e => (
                      <button key={e.id} type="button" className="sy-b line sm" style={{ justifyContent: 'space-between' }} onClick={() => setClip({ camId, name: m.camera_name || d.name, ts: new Date(new Date(e.created_at).getTime() - 8000).toISOString() })}>
                        <span>Unlocked {fmtWhen(e.created_at)}</span><span style={{ color: '#0071E3' }}>Play</span>
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
      </Card>

      {clip && <ClipSheet siteId={siteId} clip={clip} onClose={() => setClip(null)} />}
    </div>
  )
}
