'use client'

/**
 * "What happened?" — asked on every stage move (drag, stage path, Mark won / lost).
 * Lost asks for a reason + optional competitor. Open stages offer to schedule the next step.
 */
import { useEffect, useState } from 'react'
import { ACT_TYPES, BACKWARD_REASONS, FORWARD_REASONS, LOST_REASONS, localISO, stageIndex, stageLabel, type Deal } from './salesShared'

export function MoveDialog({ deal, to, onCancel, onDone }: {
  deal: Pick<Deal, 'id' | 'name' | 'stage'>
  to: string
  onCancel: () => void
  onDone: (card: Deal) => void
}) {
  const lost = to === 'lost'
  const won = to === 'won'
  const backward = !lost && !won && stageIndex(to) < stageIndex(deal.stage) && stageIndex(deal.stage) >= 0
  const reasons = lost ? LOST_REASONS : backward ? BACKWARD_REASONS : FORWARD_REASONS[to] ?? []
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [competitor, setCompetitor] = useState('')
  const [nextOn, setNextOn] = useState(!lost && !won)
  const [nextType, setNextType] = useState('call')
  const [nextSubject, setNextSubject] = useState('')
  const [nextDate, setNextDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 2); return localISO(d) })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel() } }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [onCancel])

  const ready = lost ? !!reason : !!(reason || note.trim())

  async function submit() {
    if (!ready || busy) return
    setBusy(true); setErr(null)
    try {
      const body: Record<string, unknown> = { action: 'move', stage: to, note }
      if (lost) { body.lost_reason = reason; body.lost_competitor = competitor } else body.reason = reason
      if (nextOn && !lost && !won && nextSubject.trim()) body.next = { type: nextType, subject: nextSubject.trim(), due_at: `${nextDate}T09:00:00` }
      const res = await fetch(`/api/sales/deals/${deal.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Could not move the deal.')
      onDone(data.card as Deal)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not move the deal.'); setBusy(false) }
  }

  const title = lost ? `Mark "${deal.name}" as lost?` : won ? `Mark "${deal.name}" as won 🎉` : `Move to ${stageLabel(to)}`
  const sub = lost ? 'Pick a reason so we can learn from it. It moves to the Lost tab — you can reopen it any time.'
    : won ? 'What closed it? It moves to the Won tab, where you can create the job.'
    : backward ? `Moving back from ${stageLabel(deal.stage)}. What changed?`
    : `From ${stageLabel(deal.stage)}. What happened?`

  return (
    <div className="sb-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="sb-dlg">
        <h3>{title}</h3>
        <p className="sb-sub" style={{ margin: '4px 0 0' }}>{sub}</p>
        <div className="sb-reasons" role="group" aria-label="Reason">
          {reasons.map(r => <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(reason === r ? '' : r)}>{r}</button>)}
        </div>
        {lost && (
          <label className="sb-field"><span>Competitor (optional)</span>
            <input className="sb-in" value={competitor} onChange={e => setCompetitor(e.target.value)} placeholder="Who did they go with?" />
          </label>
        )}
        <label className="sb-field"><span>{lost || won ? 'Note (optional)' : reason ? 'Detail (optional)' : 'Detail'}</span>
          <textarea className="sb-in" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder={lost ? 'Anything worth remembering…' : 'What was said, agreed or decided…'} autoFocus={!reasons.length} />
        </label>
        {!lost && !won && (
          <div className="sb-next">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13 }}>
              <input type="checkbox" checked={nextOn} onChange={e => setNextOn(e.target.checked)} /> Schedule the next step
            </label>
            {nextOn && (
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 150px', gap: 8, marginTop: 8 }}>
                <select className="sb-in" value={nextType} onChange={e => setNextType(e.target.value)} aria-label="Step type">
                  {ACT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <input className="sb-in" value={nextSubject} onChange={e => setNextSubject(e.target.value)} placeholder="e.g. Call Dana about pricing" aria-label="Next step" />
                <input className="sb-in" type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} aria-label="Due date" />
              </div>
            )}
          </div>
        )}
        {err && <div className="sb-err" role="alert">{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="button" className="sb-btn" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
          <button type="button" className={`sb-btn ${lost ? 'red' : won ? 'green' : 'pri'}`} style={{ flex: 1 }} disabled={!ready || busy} onClick={() => void submit()}>
            {busy ? 'Saving…' : lost ? 'Mark lost' : won ? 'Mark won' : 'Move deal'}
          </button>
        </div>
      </div>
    </div>
  )
}
