'use client'
/**
 * Systems → a property → Setup tab.
 *
 * A checklist of everything a property can have (Brivo, cameras, Edge, Shelly,
 * UniFi, door cameras, Gate Guard Watch, the manager portal, Package Room) with a live
 * status for each line and simple numbered steps underneath. The steps come from
 * lib/setup-guides.ts — the same text the How-to button and Lexi use.
 *
 * 🔒 Vendor logins stay corporate-only: this tab never shows or edits a key. The
 * corporate status read (/api/sites/[id]/integrations) refuses everyone else
 * server-side; non-corporate users get a status worked out from what's live.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Card, Dot, DOT, MUTED, GREEN, ORANGE, RED, TEXT2, LINE, getJson, type Any, type SiteCtx } from '@/components/nexus/systems/shared'
import { SETUP_START, SETUP_GUIDES, type SetupGuide, type SetupCheck } from '@/lib/setup-guides'

type State = 'ok' | 'partial' | 'error' | 'off' | 'wait' | 'na' | 'soon'
type Status = { state: State; text: string }
type GoTab = 'live' | 'doors' | 'network' | 'controllers'
type Integration = { vendor: string; configured: boolean; status: string | null; last_error: string | null }

const TAB_LABEL: Record<GoTab, string> = { live: 'Live', doors: 'Doors & gates', network: 'Network', controllers: 'Controllers' }
const DOT_FOR: Record<State, string> = { ok: DOT.green, partial: DOT.orange, error: DOT.red, off: DOT.gray, wait: DOT.gray, na: DOT.gray, soon: DOT.gray }
const COLOR_FOR: Partial<Record<State, string>> = { ok: GREEN, partial: ORANGE, error: RED }

const CSS = `
.su-list{display:flex;flex-direction:column}
.su-row{border-top:1px solid ${LINE};padding:12px 0}
.su-row:first-child{border-top:0;padding-top:4px}
.su-top{display:flex;align-items:flex-start;gap:10px}
.su-top .main{flex:1;min-width:0}
.su-top .t{font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.su-top .m{font-size:12.5px;color:${MUTED};margin-top:2px;line-height:1.4}
.su-top .st{font-size:12.5px;font-weight:500;margin-top:4px}
.su-acts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;flex:none}
.su-dot{margin-top:5px}
.su-steps{margin:10px 0 0 18px;padding:12px 14px 12px 30px;background:#F5F5F7;border-radius:10px;font-size:13.5px;line-height:1.5;color:${TEXT2}}
.su-steps li{margin:0 0 6px}
.su-steps li:last-child{margin:0}
.su-tips{margin:8px 0 0 18px;font-size:12.5px;color:${MUTED};line-height:1.45}
.su-tips div{margin-top:4px}
.su-meta{margin:8px 0 0 18px;font-size:12px;color:${MUTED}}
.su-bar{height:6px;border-radius:3px;background:#E9ECF1;overflow:hidden;margin-top:10px}
.su-bar>div{height:100%;background:${DOT.green};border-radius:3px}
.su-pill{font-size:11px;font-weight:600;color:${MUTED};background:#F0F0F3;border-radius:6px;padding:1px 7px}
@media (max-width:640px){.su-top{flex-wrap:wrap}.su-acts{width:100%;justify-content:flex-start;padding-left:18px}}
`

export function SetupTab({ ctx, cams, doors, doorErr, relays, camMap, onGo }: {
  ctx: SiteCtx; cams: Any[] | null; doors: Any[] | null; doorErr: string | null; relays: Any[] | null
  camMap: Record<string, Any>; onGo: (t: GoTab) => void
}) {
  const { siteId, isCorporate, openSetup } = ctx
  const [ints, setInts] = useState<Integration[] | null>(null)
  const [edge, setEdge] = useState<{ on: boolean; err: string | null } | null>(null)
  const [net, setNet] = useState<{ on: boolean; err: string | null } | null>(null)
  const [gates, setGates] = useState<{ n: number; err: string | null } | null>(null)
  const [portal, setPortal] = useState<{ slug: string | null } | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let dead = false
    if (isCorporate) {
      void getJson(`/api/sites/${siteId}/integrations`).then(r => { if (!dead) setInts(r.ok && Array.isArray(r.data.integrations) ? r.data.integrations : []) })
      void getJson('/api/admin/portals').then(r => {
        if (dead) return
        const p = (Array.isArray(r.data.portals) ? r.data.portals : []).find((x: Any) => String(x.site_id) === siteId)
        setPortal({ slug: p ? String(p.slug) : null })
      })
    }
    void getJson(`/api/sites/${siteId}/video?view=cameras`).then(r => { if (!dead) setEdge({ on: !!r.data?.providers?.edge, err: r.data?.errors?.edge ?? null }) })
    void getJson(`/api/unifi/cloud/overview?site_id=${siteId}`).then(r => { if (!dead) setNet({ on: !!(r.ok && r.data?.connected), err: r.ok ? null : (r.data?.error ?? null) }) })
    void getJson(`/api/sites/${siteId}/gates`).then(r => { if (!dead) setGates({ n: Array.isArray(r.data.gates) ? r.data.gates.length : 0, err: r.ok ? null : (r.data.error ?? 'Couldn’t load Gate Watch.') }) })
    return () => { dead = true }
  }, [siteId, isCorporate, tick])

  const vault = (v: string) => ints?.find(i => i.vendor === v)

  // One status per checklist line.
  const statusOf = (c: SetupCheck): Status => {
    const keyed = (v: string, live: boolean | null, liveText: string, emptyText: string): Status => {
      const s = vault(v)
      if (live) return { state: 'ok', text: liveText }
      if (live == null) return { state: 'wait', text: 'Checking…' }
      if (s?.configured) return { state: 'error', text: s.last_error ? `Saved, but it isn’t working: ${s.last_error}` : emptyText }
      if (isCorporate && ints == null) return { state: 'wait', text: 'Checking…' }
      return { state: 'off', text: 'Not set up' }
    }
    switch (c) {
      case 'brivo': return keyed('brivo', doors == null ? null : doors.length > 0, `${doors?.length ?? 0} door${doors?.length === 1 ? '' : 's'} and gates`, doorErr || 'Saved, but no doors came back. Tap Test in Setup & keys.')
      case 'eagle_eye': return keyed('eagle_eye', cams == null ? null : cams.length > 0, `${cams?.length ?? 0} camera${cams?.length === 1 ? '' : 's'}`, 'Saved, but no cameras came back. Tap “Connect Eagle Eye” in Setup & keys.')
      case 'edge': {
        if (edge == null) return { state: 'wait', text: 'Checking…' }
        if (edge.on && !edge.err) return { state: 'ok', text: 'Edge box connected' }
        if (edge.on) return { state: 'error', text: `Saved, but the box isn’t answering: ${edge.err}` }
        return keyed('edge', false, '', 'Saved, but the box isn’t answering.')
      }
      case 'shelly': return keyed('shelly', relays == null ? null : relays.length > 0, `${relays?.length ?? 0} relay${relays?.length === 1 ? '' : 's'}`, 'Saved, but no relays have the property name in their name.')
      case 'unifi': return keyed('unifi', net == null ? null : net.on, 'Network connected', net?.err ? `Saved, but it isn’t working: ${net.err}` : 'Saved, but the network isn’t answering.')
      case 'door_cameras': {
        if (doors == null) return { state: 'wait', text: 'Checking…' }
        if (!doors.length) return { state: 'na', text: 'Connect Brivo first' }
        const linked = doors.filter(d => camMap[String(d.id)]).length
        if (linked === doors.length) return { state: 'ok', text: `All ${linked} linked` }
        if (linked) return { state: 'partial', text: `${linked} of ${doors.length} linked` }
        return { state: 'off', text: 'No cameras linked yet' }
      }
      case 'gate_watch': {
        if (gates == null) return { state: 'wait', text: 'Checking…' }
        if (gates.err) return { state: 'error', text: gates.err }
        return gates.n ? { state: 'ok', text: `Watching ${gates.n} gate${gates.n === 1 ? '' : 's'}` } : { state: 'off', text: 'No gates watched yet' }
      }
      case 'portal': {
        if (!isCorporate) return { state: 'na', text: 'Gate Guard sets this up' }
        if (portal == null) return { state: 'wait', text: 'Checking…' }
        return portal.slug ? { state: 'ok', text: `/portal/${portal.slug}` } : { state: 'off', text: 'No portal yet' }
      }
      default: return { state: 'na', text: '' }
    }
  }

  const rows = useMemo(() => SETUP_GUIDES.map(g => ({ g, s: g.soon ? { state: 'soon' as State, text: 'Coming soon' } : statusOf(g.check) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ints, edge, net, gates, portal, cams, doors, doorErr, relays, camMap, isCorporate])
  const counted = rows.filter(r => r.s.state !== 'soon' && r.s.state !== 'na')
  const done = counted.filter(r => r.s.state === 'ok').length
  const problems = rows.filter(r => r.s.state === 'error').length

  const actions = (g: SetupGuide, s: Status) => {
    const out: React.ReactNode[] = []
    if (g.needsKeys && isCorporate && s.state !== 'ok') out.push(<button key="k" type="button" className="sy-b pri sm" onClick={openSetup}>Open Setup &amp; keys</button>)
    if (g.check === 'portal' && isCorporate) out.push(<a key="p" className={`sy-b ${s.state === 'ok' ? 'line' : 'pri'} sm`} href="/admin/portals">Customer Portals</a>)
    if (g.tab && !(g.needsKeys && s.state !== 'ok')) out.push(<button key="t" type="button" className={`sy-b ${s.state === 'ok' ? 'line' : 'pri'} sm`} onClick={() => onGo(g.tab!)}>Go to {TAB_LABEL[g.tab]}</button>)
    if (!g.soon) out.push(<button key="s" type="button" className="sy-b line sm" aria-expanded={openId === g.id} onClick={() => setOpenId(openId === g.id ? null : g.id)}>{openId === g.id ? 'Hide steps' : 'Steps'}</button>)
    return out
  }

  const Steps = ({ g }: { g: SetupGuide }) => (
    <>
      <ol className="su-steps">{g.steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
      <div className="su-meta">Who: {g.who} · Where: {g.where}</div>
      {g.tips?.length ? <div className="su-tips">{g.tips.map((t, i) => <div key={i}>Tip: {t}</div>)}</div> : null}
      {g.needsKeys && !isCorporate && <div className="su-tips"><div>This step needs vendor logins, which only Gate Guard corporate can enter. Ask Gate Guard to do it.</div></div>}
    </>
  )

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <style>{CSS}</style>
      <Card title="Set up this property"
        sub={`${done} of ${counted.length} set up${problems ? ` · ${problems} need${problems === 1 ? 's' : ''} fixing` : ''} · skip anything this property doesn’t have`}
        right={<button type="button" className="sy-b line sm" onClick={() => setTick(n => n + 1)}>Check again</button>}>
        <div className="su-bar" aria-hidden><div style={{ width: `${counted.length ? Math.round((done / counted.length) * 100) : 0}%` }} /></div>
        <div className="su-row" style={{ borderTop: 0, marginTop: 6 }}>
          <div className="su-top">
            <span className="su-dot"><Dot c={DOT.blue} /></span>
            <div className="main">
              <div className="t">{SETUP_START.title}</div>
              <div className="m">{SETUP_START.what}</div>
            </div>
            <div className="su-acts"><button type="button" className="sy-b line sm" aria-expanded={openId === SETUP_START.id} onClick={() => setOpenId(openId === SETUP_START.id ? null : SETUP_START.id)}>{openId === SETUP_START.id ? 'Hide steps' : 'Steps'}</button></div>
          </div>
          {openId === SETUP_START.id && <Steps g={SETUP_START} />}
        </div>
      </Card>

      <Card title="Checklist" sub="Tap Steps on any line for simple instructions. The same steps are in the How-to button, and you can ask Lexi.">
        <div className="su-list">
          {rows.map(({ g, s }) => (
            <div key={g.id} className="su-row">
              <div className="su-top">
                <span className="su-dot"><Dot c={DOT_FOR[s.state]} /></span>
                <div className="main">
                  <div className="t">{g.title}{g.soon && <span className="su-pill">Soon</span>}</div>
                  <div className="m">{g.what}</div>
                  {s.text && <div className="st" style={{ color: COLOR_FOR[s.state] ?? MUTED }}>{s.state === 'ok' ? '✓ ' : ''}{s.text}</div>}
                </div>
                <div className="su-acts">{actions(g, s)}</div>
              </div>
              {openId === g.id && <Steps g={g} />}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
