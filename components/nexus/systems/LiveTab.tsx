'use client'
/**
 * Systems → Live: every Eagle Eye camera at the property (refreshing every 5s,
 * paged 9 at a time), plus "watch & unlock" tiles for doors that have a camera
 * linked. Tap a camera for its recent recording.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { type Any, Card, ClipSheet, Dot, DOT, LiveCam, MUTED, Note, NotConnected, previewUrl, send, getJson, fmtWhen, type SiteCtx } from './shared'

const PAGE = 9

export function LiveTab({ ctx, cams, camErr, doors, camMap, reloadDoors }: {
  ctx: SiteCtx
  cams: Any[] | null; camErr: string | null
  doors: Any[] | null; camMap: Record<string, Any>
  reloadDoors: () => void
}) {
  const { siteId, isCorporate, notify, openSetup } = ctx
  const [tick, setTick] = useState(0)
  const [page, setPage] = useState(0)
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

  const list = cams ?? []
  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const shown = list.slice(page * PAGE, page * PAGE + PAGE)
  const camDoors = (doors ?? []).filter(d => camMap[String(d.id)]?.camera_id)
  const offline = list.filter(c => c.online === false).length

  return (
    <div className="sy-stack">
      <Card
        title={`Cameras${list.length ? ` (${list.length})` : ''}`}
        sub={list.length ? (offline ? `${offline} offline · tap a camera for its recording` : 'All online · tap a camera for its recording') : 'Eagle Eye'}
        right={pages > 1 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="sy-b line sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} aria-label="Previous cameras">‹</button>
            <span style={{ fontSize: 12, color: MUTED }}>{page + 1} of {pages}</span>
            <button type="button" className="sy-b line sm" onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} aria-label="Next cameras">›</button>
          </div>
        ) : undefined}
      >
        {cams == null ? <div className="sy-empty">Loading cameras…</div>
          : !list.length ? (camErr && !/not connected|client id|secret|connect eagle|no eagle/i.test(camErr)
            ? <Note tone="orange">Eagle Eye is connected but the cameras didn’t load: {camErr}</Note>
            : <NotConnected what="Eagle Eye (cameras)" isCorporate={isCorporate} onSetup={openSetup} />)
          : (
            <div className="sy-cams">
              {shown.map((c, i) => {
                const camId = String(c.id ?? c.esn ?? '')
                const name = String(c.name ?? `Camera ${page * PAGE + i + 1}`)
                const live = !!camId && c.online !== false && !noPreview.current.has(camId)
                return (
                  <button key={camId || i} type="button" className="sy-cam" aria-label={`${name} — open recording`} onClick={() => camId && setClip({ camId, name, ts: new Date(Date.now() - 120000).toISOString() })}>
                    {live ? <LiveCam src={previewUrl(siteId, camId, tick)} alt={name} onError={() => markBad(camId)} />
                      : <div className="off">{c.online === false ? 'Offline' : 'No live preview'}</div>}
                    {live && <span className="lv"><Dot c={DOT.red} />Live</span>}
                    {c.online === false && <span className="lv"><Dot c={DOT.orange} />Offline</span>}
                    <span className="nm">{name}</span>
                  </button>
                )
              })}
            </div>
          )}
      </Card>

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
