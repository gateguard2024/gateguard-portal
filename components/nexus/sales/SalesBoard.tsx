'use client'

/**
 * Sales board (Part 1 · Dealer) — the deal pipeline, Pipedrive-grade.
 * Open / Won / Lost tabs · Board / List / Forecast views · filters · summary numbers ·
 * deal panel with every CRM field · "What happened?" on every stage move.
 * Data: GET /api/sales/deals (scoped: admins see all / dealers see theirs / reps see their own).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { SALES_CSS as CSS } from './salesCss'
import { BoardView, ForecastView } from './BoardView'
import { ClosedView, ListView, type ClosedGroup } from './DealTables'
import { DealPanel } from './DealPanel'
import { DealPage } from './DealPage'
import { MoveDialog } from './MoveDialog'
import { localISO, money, needsAttention, stageLabel, type Deal, type Owner } from './salesShared'


type CloseFilter = 'any' | 'month' | 'quarter' | '90' | 'past'
type View = 'board' | 'list' | 'forecast'
type Tab = 'open' | 'won' | 'lost' | 'archived'

export function SalesBoard({ onClose, onNewDeal, onOpenFull }: { onClose: () => void; onNewDeal: () => void; onOpenFull: (id: string) => void }) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [me, setMe] = useState<string | null>(null)
  const [canTeam, setCanTeam] = useState(false)
  const [showMoney, setShowMoney] = useState(true)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [tab, setTab] = useState<Tab>('open')
  const [view, setView] = useState<View>(() => { try { return (localStorage.getItem('nexus.sales.view') as View) || 'board' } catch { return 'board' } })
  const [scope, setScope] = useState<'mine' | 'team'>('team')
  const [owner, setOwner] = useState('')
  const [close, setClose] = useState<CloseFilter>('any')
  const [type, setType] = useState('')
  const [attention, setAttention] = useState(false)
  const [q, setQ] = useState('')
  const [wonGroup, setWonGroup] = useState<ClosedGroup>('month')
  const [lostGroup, setLostGroup] = useState<ClosedGroup>('reason')

  const [openId, setOpenId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [moving, setMoving] = useState<{ deal: Deal; to: string } | null>(null)
  const [jobBusy, setJobBusy] = useState<string | null>(null)
  const [panelNonce, setPanelNonce] = useState(0) // bump to reload the open deal panel
  const [fullId, setFullId] = useState<string | null>(null) // full deal page

  useEffect(() => { try { localStorage.setItem('nexus.sales.view', view) } catch { /* ignore */ } }, [view])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t) }, [toast])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/sales/deals')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Could not load deals.')
      setDeals(data.deals ?? []); setOwners(data.owners ?? []); setMe(data.me ?? null)
      setCanTeam(!!data.canSeeTeam); setShowMoney(data.canViewFinancials !== false)
      if (!data.canSeeTeam) setScope('mine')
      setMsg(null)
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not load deals.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || moving || fullId) return
      const t = e.target as HTMLElement | null
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) { t.blur(); return }
      if (expanded) setExpanded(false)
      else if (openId) setOpenId(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moving, expanded, openId, onClose, fullId])

  const today = localISO()
  const types = useMemo(() => [...new Set(deals.map(d => d.type).filter(Boolean) as string[])].sort(), [deals])
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const now = new Date()
    const monthEnd = localISO(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    const qEnd = localISO(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0))
    const d90 = localISO(new Date(now.getTime() + 90 * 86400000))
    return deals.filter(d => {
      if (scope === 'mine' && d.owner_id !== me) return false
      if (owner && d.owner_id !== owner) return false
      if (type && d.type !== type) return false
      if (needle && !`${d.key} ${d.name} ${d.account ?? ''} ${d.owner_name ?? ''} ${(d.tags ?? []).join(' ')}`.toLowerCase().includes(needle)) return false
      if (d.tab === 'open') {
        if (attention && !needsAttention(d)) return false
        if (close === 'month' && !(d.close_date && d.close_date <= monthEnd && d.close_date >= today.slice(0, 8) + '01')) return false
        if (close === 'quarter' && !(d.close_date && d.close_date <= qEnd && d.close_date >= today)) return false
        if (close === '90' && !(d.close_date && d.close_date <= d90 && d.close_date >= today)) return false
        if (close === 'past' && !(d.close_date && d.close_date < today)) return false
      }
      return true
    })
  }, [deals, scope, me, owner, type, q, attention, close, today])

  const byTab = (t: Tab) => filtered.filter(d => d.tab === t)
  const open = byTab('open')
  const counts = { open: open.length, won: byTab('won').length, lost: byTab('lost').length, archived: byTab('archived').length }
  const monthKey = today.slice(0, 7)
  const stats = {
    tcv: open.reduce((n, d) => n + (d.tcv ?? 0), 0),
    weighted: open.reduce((n, d) => n + (d.weighted ?? 0), 0),
    mrr: open.reduce((n, d) => n + (d.mrr ?? 0), 0),
    closing: open.filter(d => d.close_date?.startsWith(monthKey)),
    attention: open.filter(needsAttention),
  }
  const overdueN = stats.attention.filter(d => d.overdue > 0).length

  const replaceCard = useCallback((card: Deal) => setDeals(prev => prev.map(d => (d.id === card.id ? { ...d, ...card } : d))), [])

  const requestMove = useCallback(async (d: Deal, to: string) => {
    if (to === 'archive') {
      setDeals(prev => prev.map(x => (x.id === d.id ? { ...x, tab: 'archived' } : x)))
      const res = await fetch(`/api/sales/deals/${d.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'archive' }) }).catch(() => null)
      if (!res?.ok) { setMsg('Could not archive the deal.'); void load() } else setToast(`Archived "${d.name}"`)
      return
    }
    setMoving({ deal: d, to })
  }, [load])

  const quickAdd = useCallback(async (stage: string, name: string) => {
    const res = await fetch('/api/crm/opportunities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, stage }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg(data?.error ?? data?.message ?? 'Could not create the deal.'); return }
    await load(); setOpenId(data.id)
  }, [load])

  const createJob = useCallback(async (d: Deal) => {
    setJobBusy(d.id)
    try {
      // One canonical job store = work_orders (Operations Hub, dispatch, calendar, tech app).
      const res = await fetch('/api/dispatch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: d.account || d.name, title: `${d.name} — Install`, job_type: 'Install', priority: 'normal', opportunity_id: d.id, description: `Install from won deal ${d.key}: ${d.name}`, notify: false }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Could not create the job.')
      setDeals(prev => prev.map(x => (x.id === d.id ? { ...x, has_job: true } : x)))
      setToast(`Job created for "${d.name}" — it's in Operations.`)
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not create the job.') }
    finally { setJobBusy(null) }
  }, [])

  const stat = (l: string, v: string, s: string, onClick?: () => void, red = false) => (
    <button type="button" className="sb-stat" onClick={onClick} disabled={!onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="l">{l}</div><div className="v">{v}</div><div className={`s${red ? ' r' : ''}`}>{s}</div>
    </button>
  )

  return createPortal(
    <div className={`sb-root${openId && !expanded ? ' panel-open' : ''}`} role="dialog" aria-modal="true" aria-label="Sales board">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sb-main">
        <div className="sb-hd">
          <div>
            <button type="button" className="sb-back" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>Sales
            </button>
            <h1>Sales board</h1>
          </div>
          <div className="sb-bar">
            <div className="sb-seg" role="tablist" aria-label="Open, won or lost">
              {(['open', 'won', 'lost'] as const).map(t => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} aria-pressed={tab === t} onClick={() => { setTab(t); setOpenId(null) }}>
                  {t === 'open' ? 'Open' : t === 'won' ? 'Won' : 'Lost'} <b>{counts[t]}</b>
                </button>
              ))}
            </div>
            {tab === 'open' && (
              <div className="sb-seg" role="group" aria-label="View">
                {(['board', 'list', 'forecast'] as const).map(v => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}
              </div>
            )}
            <button type="button" className="sb-btn pri" onClick={onNewDeal}>+ New deal</button>
          </div>
        </div>

        <div className="sb-bar" style={{ justifyContent: 'space-between' }}>
          <div className="sb-bar">
            {canTeam && <>
              <button type="button" className="sb-chip" aria-pressed={scope === 'mine'} onClick={() => { setScope('mine'); setOwner('') }}>Mine</button>
              <button type="button" className="sb-chip" aria-pressed={scope === 'team'} onClick={() => setScope('team')}>Team</button>
              {scope === 'team' && owners.length > 1 && (
                <select className="sb-in" value={owner} onChange={e => setOwner(e.target.value)} aria-label="Owner">
                  <option value="">Owner: All</option>{owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              )}
            </>}
            {tab === 'open' && (
              <select className="sb-in" value={close} onChange={e => setClose(e.target.value as CloseFilter)} aria-label="Close date">
                <option value="any">Close: Any time</option><option value="month">Close: This month</option><option value="quarter">Close: This quarter</option><option value="90">Close: Next 90 days</option><option value="past">Close date passed</option>
              </select>
            )}
            {types.length > 0 && (
              <select className="sb-in" value={type} onChange={e => setType(e.target.value)} aria-label="Type">
                <option value="">Type: All</option>{types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {tab === 'open' && (
              <button type="button" className="sb-chip" aria-pressed={attention} onClick={() => setAttention(a => !a)}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF3B30' }} />Needs attention <b>{stats.attention.length}</b>
              </button>
            )}
            {tab === 'open' && counts.archived > 0 && <button type="button" className="sb-chip" onClick={() => { setTab('archived'); setOpenId(null) }}>Archived <b>{counts.archived}</b></button>}
            {tab === 'won' && <><span className="sb-lbl">Group by</span>{(['month', 'owner', 'account'] as const).map(g => <button key={g} type="button" className="sb-chip" aria-pressed={wonGroup === g} onClick={() => setWonGroup(g)}>{g === 'month' ? 'Month won' : g[0].toUpperCase() + g.slice(1)}</button>)}</>}
            {tab === 'lost' && <><span className="sb-lbl">Group by</span>{(['reason', 'month', 'owner', 'competitor'] as const).map(g => <button key={g} type="button" className="sb-chip" aria-pressed={lostGroup === g} onClick={() => setLostGroup(g)}>{g === 'month' ? 'Month lost' : g[0].toUpperCase() + g.slice(1)}</button>)}</>}
          </div>
          <label><span className="sb-sr">Search deals</span><input type="search" className="sb-in" style={{ width: 240 }} placeholder="Search deals, accounts, D-numbers…" value={q} onChange={e => setQ(e.target.value)} /></label>
        </div>

        {tab === 'open' && (
          <div className="sb-stats">
            {showMoney && stat('Open pipeline (TCV)', money(stats.tcv), `${open.length} deal${open.length === 1 ? '' : 's'}`)}
            {showMoney && stat('Weighted forecast', money(stats.weighted), 'by stage win %', () => setView('forecast'))}
            {showMoney && stat('New MRR in pipeline', money(stats.mrr), 'per month')}
            {stat('Closing this month', showMoney ? money(stats.closing.reduce((n, d) => n + (d.tcv ?? 0), 0)) : String(stats.closing.length), `${stats.closing.length} deal${stats.closing.length === 1 ? '' : 's'}`, () => { setClose('month'); setView('list') })}
            {stat('Needs attention', String(stats.attention.length), stats.attention.length ? `${overdueN} overdue · ${stats.attention.length - overdueN} no next step` : 'All deals have a next step', () => setAttention(true), stats.attention.length > 0)}
          </div>
        )}

        {msg && <div className="sb-err" role="alert">{msg}</div>}

        {loading && !deals.length ? <div className="sb-empty">Loading deals…</div>
          : tab === 'open'
            ? (view === 'board' ? <BoardView deals={open} selectedId={openId} showMoney={showMoney} onOpen={setOpenId} onMove={(d, to) => void requestMove(d, to)} onQuickAdd={quickAdd} />
              : view === 'list' ? <ListView deals={open} selectedId={openId} showMoney={showMoney} onOpen={setOpenId} />
              : <ForecastView deals={open} showMoney={showMoney} onOpen={setOpenId} />)
          : tab === 'archived'
            ? <>
                <div className="sb-bar"><button type="button" className="sb-btn sm" onClick={() => setTab('open')}>← Back to open deals</button><span className="sb-lbl">Archived deals — open one and press Restore to put it back on the board.</span></div>
                <ListView deals={byTab('archived')} selectedId={openId} showMoney={showMoney} onOpen={setOpenId} />
              </>
            : <ClosedView deals={byTab(tab)} tab={tab} groupBy={tab === 'won' ? wonGroup : lostGroup} showMoney={showMoney} onOpen={setOpenId} onCreateJob={d => void createJob(d)} onReopen={d => setOpenId(d.id)} jobBusy={jobBusy} />}
      </div>

      {openId && (
        <DealPanel key={`${openId}-${panelNonce}`} dealId={openId}
          onClose={() => { setOpenId(null); setExpanded(false) }}
          onMoveRequest={(d, to) => void requestMove(d, to)}
          onChanged={card => { replaceCard(card); if (card.tab !== deals.find(x => x.id === card.id)?.tab) void load() }}
          onOpenFull={id => { setOpenId(null); setFullId(id) }}
          onRestored={() => { void load(); setTab('open'); setToast('Restored to the board') }} />
      )}

      {fullId && <DealPage dealId={fullId} onClose={() => { setFullId(null); void load() }} onChanged={replaceCard} />}

      {moving && (
        <MoveDialog deal={moving.deal} to={moving.to} onCancel={() => setMoving(null)}
          onDone={card => {
            const wasOpen = moving.deal.tab === 'open'
            setMoving(null)
            replaceCard(card)
            setPanelNonce(n => n + 1)
            setToast(card.tab === 'won' ? `"${card.name}" won — it's on the Won tab.` : card.tab === 'lost' ? `"${card.name}" moved to Lost.` : `Moved to ${stageLabel(card.stage)}.`)
            if (!wasOpen && card.tab === 'open') setTab('open')
            void load()
          }} />
      )}

      {toast && <div className="sb-toast" role="status">{toast}</div>}
    </div>,
    document.body,
  )
}

export default SalesBoard
