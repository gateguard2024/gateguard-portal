'use client'
/**
 * Systems → Network: UniFi (cloud Site Manager, read-only) — internet status,
 * speed / latency / loss / uptime, client mix, gear health, every network device,
 * and the connected-client list on demand.
 */
import React, { useEffect, useState } from 'react'
import { type Any, BLUE, Card, Dot, DOT, GREEN, MUTED, NotConnected, RED, getJson, type SiteCtx } from './shared'

const upt = (s?: number | null) => s == null ? '' : s >= 86400 ? `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h` : s >= 3600 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 60)}m`
const r1 = (n: number) => n >= 100 ? Math.round(n) : Math.round(n * 10) / 10

function Spark({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null
  const w = 160, h = 40, max = Math.max(...data), min = Math.min(...data), rng = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / rng) * (h - 6) - 3}`)
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="Download speed, last hour" role="img"><polyline points={pts.join(' ')} fill="none" stroke={BLUE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /></svg>
}

export function NetworkTab({ ctx, ov }: { ctx: SiteCtx; ov: Any | null | undefined }) {
  const { siteId, isCorporate, openSetup } = ctx
  const [clients, setClients] = useState<Any[] | null>(null)
  const [showClients, setShowClients] = useState(false)
  useEffect(() => {
    if (!showClients || clients) return
    void getJson(`/api/unifi/clients?site_id=${siteId}`).then(r => setClients(Array.isArray(r.data.clients) ? r.data.clients : []))
  }, [showClients, clients, siteId])

  if (ov === undefined) return <Card title="Network"><div className="sy-empty">Loading network…</div></Card>
  if (!ov) return <Card title="Network"><NotConnected what="UniFi (network)" isCorporate={isCorporate} onSetup={openSetup} /></Card>

  const i = ov.internet ?? {}, cns = ov.console ?? {}, cl = ov.clients ?? {}, hl = ov.health ?? {}
  const devices: Any[] = Array.isArray(ov.devices) ? ov.devices : []
  const status = i.status === 'up' ? 'Online' : i.status === 'down' ? 'Offline' : 'Unknown'
  const sc = i.status === 'up' ? DOT.green : i.status === 'down' ? DOT.red : DOT.orange
  const tiles = [
    i.download_mbps != null && { l: 'Download', v: `${r1(i.download_mbps)}`, u: 'Mbps' },
    i.upload_mbps != null && { l: 'Upload', v: `${r1(i.upload_mbps)}`, u: 'Mbps' },
    i.latency_ms != null && { l: 'Latency', v: `${Math.round(i.latency_ms)}`, u: 'ms' },
    i.packet_loss_pct != null && { l: 'Packet loss', v: `${r1(i.packet_loss_pct)}`, u: '%', bad: i.packet_loss_pct > 1 },
    i.uptime_pct != null && { l: 'Uptime', v: `${r1(i.uptime_pct)}`, u: '%' },
    { l: 'Clients', v: String(cl.total ?? 0), u: '' },
  ].filter(Boolean) as { l: string; v: string; u: string; bad?: boolean }[]
  const mix = [{ k: 'Wi-Fi', v: cl.wifi ?? 0 }, { k: 'Wired', v: cl.wired ?? 0 }, { k: 'Guest', v: cl.guest ?? 0 }]
  const pct = hl.total ? Math.round((hl.online / hl.total) * 100) : 0

  return (
    <div className="sy-stack">
      <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Dot c={sc} />Internet {status}</span>}
        sub={[i.isp, i.public_ip || cns.public_ip, cns.model, cns.version ? `v${cns.version}` : null, upt(cns.uptime_s) ? `up ${upt(cns.uptime_s)}` : null].filter(Boolean).join(' · ')}
        right={Array.isArray(i.trend) && i.trend.length > 1 ? <div style={{ textAlign: 'right' }}><Spark data={i.trend} /><div style={{ fontSize: 11, color: MUTED }}>Download, last hour</div></div> : undefined}>
        <div className="sy-kpis" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(110px, 1fr))`, marginBottom: 0 }}>
          {tiles.map(t => <div key={t.l} className="sy-kpi" style={{ boxShadow: 'none', background: '#F5F5F7' }}><div className="l">{t.l}</div><div className="v" style={{ color: t.bad ? RED : undefined }}>{t.v}<span style={{ fontSize: 13, color: MUTED, fontWeight: 500, marginLeft: 3 }}>{t.u}</span></div></div>)}
        </div>
      </Card>

      <div className="sy-grid2">
        <Card title="Who’s connected" sub={`${cl.total ?? 0} clients`}>
          {mix.map(m => (
            <div key={m.k} className="sy-row"><div className="main"><div className="t" style={{ fontSize: 13 }}>{m.k}</div></div><span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>{m.v}</span></div>
          ))}
          <button type="button" className="sy-b line sm" style={{ marginTop: 8 }} onClick={() => setShowClients(v => !v)}>{showClients ? 'Hide the list' : 'Show every client'}</button>
          {showClients && (clients == null ? <div className="sy-empty">Loading…</div> : !clients.length ? <div className="sy-empty">No clients reported.</div> : (
            <div className="sy-feed" style={{ maxHeight: 280, marginTop: 6 }}>{clients.slice(0, 300).map((c, k) => (
              <div key={c.mac ?? k} className="sy-row"><div className="main"><div className="t" style={{ fontSize: 13 }}>{c.name || c.mac}</div><div className="m">{c.wired ? 'Wired' : 'Wi-Fi'}{c.ip ? ` · ${c.ip}` : ''}</div></div></div>
            ))}</div>
          ))}
        </Card>
        <Card title="Gear health" sub={`${hl.online ?? 0} of ${hl.total ?? 0} devices online`}>
          <div style={{ height: 6, borderRadius: 3, background: '#F2F2F7', marginBottom: 6 }}><div style={{ width: `${pct}%`, height: 6, borderRadius: 3, background: pct === 100 ? GREEN : '#B25000' }} /></div>
          <div style={{ fontSize: 13, color: hl.offline ? RED : MUTED }}>{hl.offline ? `${hl.offline} offline` : 'Everything is online'}</div>
        </Card>
      </div>

      <Card title={`Network devices${devices.length ? ` (${devices.length})` : ''}`} sub="Live from UniFi. Restarting a device needs a console key — coming next.">
        {!devices.length ? <div className="sy-empty">No devices reported.</div> : devices.map((d, k) => (
          <div key={d.mac ?? d.name ?? k} className="sy-row">
            <Dot c={d.online ? DOT.green : DOT.red} />
            <div className="main"><div className="t" style={{ fontSize: 13 }}>{d.name ?? d.model ?? 'Device'}</div><div className="m">{[d.model, d.ip, d.version ? `v${d.version}` : null, upt(d.uptime_s) ? `up ${upt(d.uptime_s)}` : null].filter(Boolean).join(' · ')}</div></div>
            {d.clients != null && <span style={{ fontSize: 12, color: MUTED, whiteSpace: 'nowrap' }}>{d.clients} clients</span>}
          </div>
        ))}
      </Card>
    </div>
  )
}
