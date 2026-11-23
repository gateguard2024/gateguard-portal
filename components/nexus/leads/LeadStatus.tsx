'use client'

/**
 * Lead status — Open · Contacting · Stuck · Lost (+ Won, set automatically when the lead is made an opportunity). One control, used by the lead panel and
 * the full lead page. Stuck and Lost ask why (chips + optional note) before saving.
 *   Open        = not contacted yet
 *   Contacting  = talking to them (keeps "Info sent" if it got that far)
 *   Stuck       = blocked but still being worked — stays on the lists with a red tag
 *   Lost        = dead — leaves the lists (search still finds it; one tap brings it back)
 * Saves through POST /api/nexus/opps/lead-window/[id] { action: 'set_status', status, reason }.
 */
import React, { useState } from 'react'
import { Loader2, Check } from 'lucide-react'

/** 'won' is never picked here — a lead turns Won when it's made an opportunity. */
export type LeadStatusId = 'open' | 'contacting' | 'stuck' | 'lost' | 'won'

export const LEAD_STATUSES: { id: LeadStatusId; label: string; color: string; hint: string }[] = [
  { id: 'open', label: 'Open', color: '#0071E3', hint: 'Not contacted yet' },
  { id: 'contacting', label: 'Contacting', color: '#0A84A8', hint: 'Talking to them' },
  { id: 'stuck', label: 'Stuck', color: '#D70015', hint: 'Blocked — still working it' },
  { id: 'lost', label: 'Lost', color: '#6E6E73', hint: 'Dead — off the lists' },
]
export const WON_STATUS = { id: 'won' as LeadStatusId, label: 'Won', color: '#1A7F37', hint: 'Made an opportunity' }
export const STUCK_REASONS = ['No reply', 'Waiting on owner / decision maker', 'Can’t reach the right person', 'Under contract with someone', 'Budget not approved', 'Waiting on us']
export const LOST_REASONS = ['Went with someone else', 'Not interested', 'No budget', 'Property sold', 'Not a fit', 'Duplicate lead']

export const statusMeta = (s: LeadStatusId | undefined | null) => s === 'won' ? WON_STATUS : LEAD_STATUSES.find((x) => x.id === s) ?? LEAD_STATUSES[0]

/** Status from a lead row (works before the API sends `status`). */
export function leadStatusOf(l: { status?: LeadStatusId | null; bucket?: string; opportunity_id?: string | null }): LeadStatusId {
  if (l.opportunity_id) return 'won'
  return l.status ?? (l.bucket === 'identified' ? 'open' : 'contacting')
}

export function LeadStatusBar({ status, reason, onSet, size = 'md', dark = false }: {
  status: LeadStatusId; reason?: string | null
  onSet: (s: LeadStatusId, reason?: string) => Promise<boolean>
  size?: 'md' | 'lg'; dark?: boolean
}) {
  const [ask, setAsk] = useState<null | 'stuck' | 'lost'>(null)
  const [pick, setPick] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<LeadStatusId | null>(null)

  async function go(s: LeadStatusId, why?: string) {
    setBusy(s)
    try { if (await onSet(s, why)) { setAsk(null); setPick(''); setNote('') } } finally { setBusy(null) }
  }
  const h = size === 'lg' ? 40 : 32
  return (
    <div>
      <div role="group" aria-label="Lead status" style={{ display: 'flex', gap: 4 }}>
        {LEAD_STATUSES.map((s) => {
          const on = s.id === status
          return (
            <button key={s.id} type="button" title={s.hint} aria-pressed={on} disabled={!!busy}
              onClick={() => {
                if (s.id === 'stuck' || s.id === 'lost') { setAsk(ask === s.id ? null : s.id); setPick(on && reason ? reason : ''); return }
                if (!on) void go(s.id)
              }}
              style={{ flex: 1, height: h, borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: size === 'lg' ? 13.5 : 12.5, fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                border: `1px solid ${on ? s.color : dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.10)'}`,
                background: on ? s.color : dark ? 'rgba(255,255,255,.08)' : '#fff',
                color: on ? '#fff' : dark ? '#E5E9F0' : '#3A3A3C' }}>
              {busy === s.id ? <Loader2 size={13} className="animate-spin" /> : on ? <Check size={13} /> : null}{s.label}
            </button>
          )
        })}
      </div>
      {status === 'stuck' && reason && !ask && <div style={{ marginTop: 6, fontSize: 12.5, color: dark ? '#FFB3B8' : '#B4141E' }}>Stuck: {reason}</div>}
      {ask && (
        <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 11, background: '#fff', border: '1px solid rgba(0,0,0,.10)', color: '#1D1D1F' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 6 }}>{ask === 'stuck' ? 'Why is it stuck?' : 'Why was it lost?'}</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
            {(ask === 'stuck' ? STUCK_REASONS : LOST_REASONS).map((r) => (
              <button key={r} type="button" aria-pressed={pick === r} onClick={() => setPick(pick === r ? '' : r)}
                style={{ fontSize: 12, fontWeight: 600, padding: '4px 9px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${pick === r ? '#0071E3' : 'rgba(0,0,0,.14)'}`, background: pick === r ? 'rgba(0,113,227,.10)' : '#fff', color: pick === r ? '#0058B0' : '#3A3A3C' }}>{r}</button>
            ))}
          </div>
          <input aria-label="More detail" value={note} onChange={(e) => setNote(e.target.value)} placeholder="More detail (optional)"
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '7px 10px', borderRadius: 9, border: '1px solid rgba(0,0,0,.14)', fontFamily: 'inherit', outline: 'none' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
            <button type="button" onClick={() => setAsk(null)} style={btn('#F2F2F7', '#3A3A3C')}>Cancel</button>
            <button type="button" disabled={!!busy || (!pick && !note.trim())} onClick={() => void go(ask, [pick, note.trim()].filter(Boolean).join(' — '))}
              style={{ ...btn(ask === 'stuck' ? '#D70015' : '#3A3A3C', '#fff'), opacity: !pick && !note.trim() ? 0.5 : 1 }}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : null} {ask === 'stuck' ? 'Mark stuck' : 'Mark lost'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const btn = (bg: string, fg: string): React.CSSProperties => ({ fontSize: 12.5, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: 0, background: bg, color: fg, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 })
