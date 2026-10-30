'use client'

/** Sales board · List view (open deals, sortable) and the Won / Lost tabs (grouped tables). */
import { useMemo, useState } from 'react'
import { fmtDate, initials, money, nextChip, type Deal } from './salesShared'

type SortKey = 'name' | 'account' | 'stage' | 'mrr' | 'tcv' | 'probability' | 'close_date' | 'next' | 'owner' | 'days'
const STAGE_ORDER = ['meet_present', 'survey', 'propose', 'negotiate', 'contract', 'deposit']
const pillCls = (s: string) => (['contract', 'deposit'].includes(s) ? 'late-stage' : s === 'propose' ? 'mid' : 'early')

export function ListView({ deals, selectedId, showMoney, onOpen, groupByCompany = false }: { deals: Deal[]; selectedId: string | null; showMoney: boolean; onOpen: (id: string) => void; groupByCompany?: boolean }) {
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'close_date', dir: 1 })
  const rows = useMemo(() => {
    const v = (d: Deal): string | number => {
      switch (sort.k) {
        case 'name': return d.name.toLowerCase()
        case 'account': return (d.account ?? '~').toLowerCase()
        case 'stage': return STAGE_ORDER.indexOf(d.stage)
        case 'mrr': return d.mrr ?? -1
        case 'tcv': return d.tcv ?? -1
        case 'probability': return d.probability
        case 'close_date': return d.close_date ?? '9999'
        case 'next': return d.next?.due_at ?? '9999'
        case 'owner': return (d.owner_name ?? '~').toLowerCase()
        case 'days': return d.days_in_stage
      }
    }
    return [...deals].sort((a, b) => (v(a) < v(b) ? -1 : v(a) > v(b) ? 1 : 0) * sort.dir)
  }, [deals, sort])
  const th = (k: SortKey, label: string, num = false) => (
    <th className={num ? 'num' : undefined} aria-sort={sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="sb-sort" onClick={() => setSort(s => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : 1 }))}>
        {label}{sort.k === k ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )
  if (!rows.length) return <div className="sb-empty">No deals match these filters.</div>
  const head = <thead><tr>{th('name', 'Deal')}{th('account', 'Account')}{th('stage', 'Stage')}{showMoney && th('mrr', 'MRR', true)}{showMoney && th('tcv', 'TCV', true)}{th('probability', 'Prob.', true)}{th('close_date', 'Close')}{th('next', 'Next step')}{th('owner', 'Owner')}{th('days', 'In stage', true)}</tr></thead>
  const cols = showMoney ? 10 : 8
  const row = (d: Deal) => {
    const nx = nextChip(d)
    return (
      <tr key={d.id} className={selectedId === d.id ? 'sel' : undefined}>
        <td><button type="button" className="sb-link" onClick={() => onOpen(d.id)}>{d.name}</button><span className="sb-key">{d.key}</span></td>
        <td>{d.account ?? <span className="sb-sub">—</span>}</td>
        <td><span className={`sb-pill ${pillCls(d.stage)}`}>{d.stage_label}</span></td>
        {showMoney && <td className="num">{money(d.mrr)}</td>}
        {showMoney && <td className="num"><b>{money(d.tcv)}</b></td>}
        <td className="num">{d.probability}%</td>
        <td>{d.close_date ? fmtDate(d.close_date) : <span className="sb-sub">—</span>}</td>
        <td><span className={`sb-act ${nx.cls}`}>{nx.text}</span></td>
        <td><span className="sb-av" title={d.owner_name ?? ''}>{d.owner_name ? initials(d.owner_name) : '?'}</span> <span className="sb-sub">{d.owner_name ?? 'No rep assigned'}</span></td>
        <td className={`num${d.stalled ? ' sb-days r' : ''}`}>{d.days_in_stage}d</td>
      </tr>
    )
  }
  const sum = (xs: Deal[]) => `${xs.length} deal${xs.length === 1 ? '' : 's'}${showMoney ? ` · ${money(xs.reduce((n, d) => n + (d.tcv ?? 0), 0))}` : ''}`
  if (!groupByCompany) return <div className="sb-tbl"><div className="sb-tw"><table>{head}<tbody>{rows.map(row)}</tbody></table></div></div>

  // Team view: company → rep, each with totals.
  const byCo = new Map<string, Deal[]>()
  for (const d of rows) { const k = d.dealer_name ?? 'No company'; if (!byCo.has(k)) byCo.set(k, []); byCo.get(k)!.push(d) }
  const companies = [...byCo.entries()].sort((a, b) => Number(a[0] === 'No company') - Number(b[0] === 'No company') || a[0].localeCompare(b[0]))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {companies.map(([co, list]) => {
        const byRep = new Map<string, Deal[]>()
        for (const d of list) { const k = d.owner_name ?? 'No rep assigned'; if (!byRep.has(k)) byRep.set(k, []); byRep.get(k)!.push(d) }
        const reps = [...byRep.entries()].sort((a, b) => Number(a[0] === 'No rep assigned') - Number(b[0] === 'No rep assigned') || a[0].localeCompare(b[0]))
        return (
          <section key={co} className="sb-tbl" aria-label={co}>
            <div className="sb-gh" style={{ cursor: 'default' }}><b>{co}</b><span className="sb-sub">{sum(list)}</span></div>
            <div className="sb-tw"><table>{head}<tbody>
              {reps.map(([rep, ds]) => [
                <tr key={`h-${rep}`}><td colSpan={cols} className="sb-sub2">{rep} <span style={{ fontWeight: 400, color: '#6E6E73' }}>· {sum(ds)}</span></td></tr>,
                ...ds.map(row),
              ])}
            </tbody></table></div>
          </section>
        )
      })}
    </div>
  )
}

export type ClosedGroup = 'month' | 'owner' | 'account' | 'reason' | 'competitor'

export function ClosedView({ deals, tab, groupBy, showMoney, onOpen, onCreateJob, onReopen, jobBusy }: {
  deals: Deal[]; tab: 'won' | 'lost'; groupBy: ClosedGroup; showMoney: boolean
  onOpen: (id: string) => void; onCreateJob: (d: Deal) => void; onReopen: (d: Deal) => void; jobBusy: string | null
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const groups = useMemo(() => {
    const when = (d: Deal) => (tab === 'won' ? d.won_at : d.lost_at) ?? d.created_at
    const map = new Map<string, { key: string; label: string; items: Deal[] }>()
    for (const d of deals) {
      let key: string, label: string
      if (groupBy === 'month') { const w = when(d); key = w ? w.slice(0, 7) : '0000'; label = w ? new Date(`${key}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'Date not recorded' }
      else if (groupBy === 'owner') { key = d.owner_name ?? '~'; label = d.owner_name ?? 'No owner' }
      else if (groupBy === 'account') { key = d.account ?? '~'; label = d.account ?? 'No account' }
      else if (groupBy === 'reason') { key = d.lost_reason ?? '~'; label = d.lost_reason ?? 'No reason given' }
      else { key = d.lost_competitor ?? '~'; label = d.lost_competitor ?? 'No competitor named' }
      if (!map.has(key)) map.set(key, { key, label, items: [] })
      map.get(key)!.items.push(d)
    }
    const list = [...map.values()].map(g => ({ ...g, items: g.items.sort((a, b) => (when(b) ?? '').localeCompare(when(a) ?? '')) }))
    return groupBy === 'month' ? list.sort((a, b) => b.key.localeCompare(a.key)) : list.sort((a, b) => Number(a.key === '~') - Number(b.key === '~') || b.items.length - a.items.length)
  }, [deals, groupBy, tab])

  if (!groups.length) return <div className="sb-empty">{tab === 'won' ? 'No won deals yet.' : 'No lost deals. Nice.'}</div>
  const cycle = (d: Deal) => (d.created_at && d.won_at ? `${Math.max(0, Math.round((new Date(d.won_at).getTime() - new Date(d.created_at).getTime()) / 86400000))}d` : '—')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {groups.map(g => {
        const ck = `${tab}:${groupBy}:${g.key}`
        const open = !collapsed[ck]
        const tcv = g.items.reduce((n, d) => n + (d.tcv ?? 0), 0)
        const mrr = g.items.reduce((n, d) => n + (d.mrr ?? 0), 0)
        return (
          <section key={g.key} className="sb-tbl" aria-label={g.label}>
            <button type="button" className="sb-gh" aria-expanded={open} onClick={() => setCollapsed(c => ({ ...c, [ck]: open }))}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true" style={{ transform: open ? undefined : 'rotate(-90deg)' }}><path d="M6 9l6 6 6-6" /></svg>
              <b>{g.label}</b>
              <span className="sb-sub">{g.items.length} {tab}{showMoney ? ` · ${money(tcv)} TCV${tab === 'won' ? ` · ${money(mrr)} new MRR` : ''}` : ''}</span>
            </button>
            {open && (
              <div className="sb-tw"><table>
                <thead><tr><th>Deal</th><th>Account</th>
                  {tab === 'lost' && <th>Reason</th>}{tab === 'lost' && <th>Competitor</th>}
                  {showMoney && tab === 'won' && <th className="num">MRR</th>}{showMoney && <th className="num">TCV</th>}
                  <th>{tab === 'won' ? 'Won' : 'Lost'}</th><th>Owner</th>{tab === 'won' && <th className="num">Cycle</th>}
                  {tab === 'lost' && <th>Note</th>}<th style={{ width: 130 }}><span className="sb-sr">Action</span></th></tr></thead>
                <tbody>{g.items.map(d => (
                  <tr key={d.id}>
                    <td><button type="button" className="sb-link" onClick={() => onOpen(d.id)}>{d.name}</button><span className="sb-key">{d.key}</span></td>
                    <td>{d.account ?? <span className="sb-sub">—</span>}</td>
                    {tab === 'lost' && <td>{d.lost_reason ?? <span className="sb-sub">—</span>}</td>}
                    {tab === 'lost' && <td>{d.lost_competitor ?? <span className="sb-sub">—</span>}</td>}
                    {showMoney && tab === 'won' && <td className="num">{money(d.mrr)}</td>}
                    {showMoney && <td className="num"><b>{money(d.tcv)}</b></td>}
                    <td>{fmtDate(tab === 'won' ? d.won_at : d.lost_at)}</td>
                    <td><span className="sb-av" title={d.owner_name ?? ''}>{initials(d.owner_name)}</span></td>
                    {tab === 'won' && <td className="num">{cycle(d)}</td>}
                    {tab === 'lost' && <td className="sb-sub" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.lost_note ?? ''}</td>}
                    <td>{tab === 'won'
                      ? (d.has_job ? <span className="sb-pill late-stage">✓ Job created</span>
                        : <button type="button" className="sb-btn pri sm" disabled={jobBusy === d.id} onClick={() => onCreateJob(d)}>{jobBusy === d.id ? 'Creating…' : 'Create job'}</button>)
                      : <button type="button" className="sb-btn sm" onClick={() => onReopen(d)}>Reopen</button>}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </section>
        )
      })}
    </div>
  )
}
