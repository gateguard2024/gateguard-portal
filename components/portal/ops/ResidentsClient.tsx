'use client'

/**
 * ResidentsClient — move-in compliance, concession code blocks, and site settings
 * from GateCard's move-in tables (via the residents adapter). Shows a "sample data"
 * badge until the live GateCard tables are wired in lib/portal-residents.ts.
 */
import { useEffect, useState } from 'react'
import { OpsShell, C } from '@/components/portal/ops/OpsShell'
import type { ResidentsData } from '@/lib/portal-residents'
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires
const { UserPlus, ClipboardCheck, Ticket, Settings } = require('lucide-react') as any

function card(): React.CSSProperties { return { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 } }
const chip = (bg: string, fg: string): React.CSSProperties => ({ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: bg, color: fg, whiteSpace: 'nowrap' })

function statusChip(s: string) {
  const map: Record<string, [string, string, string]> = {
    complete: ['Complete', 'rgba(16,185,129,0.14)', C.safe], ok: ['OK', 'rgba(16,185,129,0.14)', C.safe], active: ['Active', 'rgba(16,185,129,0.14)', C.safe],
    in_progress: ['In progress', 'rgba(0,163,224,0.14)', C.cyan], scheduled: ['Scheduled', 'rgba(0,163,224,0.14)', C.cyan],
    pending: ['Pending', 'rgba(245,158,11,0.14)', C.warn], depleted: ['Depleted', 'rgba(245,158,11,0.14)', C.warn],
    missing: ['Missing', 'rgba(239,68,68,0.14)', C.alert], expired: ['Expired', 'rgba(239,68,68,0.14)', C.alert],
  }
  const [lbl, bg, fg] = map[s] || [s, C.surface, C.ink2]
  return <span style={chip(bg, fg)}>{lbl}</span>
}

function Inner({ slug }: { slug: string }) {
  const [d, setD] = useState<ResidentsData | null>(null)
  useEffect(() => { fetch(`/api/portal/${slug}/residents`).then(r => r.json()).then(setD).catch(() => {}) }, [slug])
  if (!d) return <div style={{ color: C.ink2, fontSize: 13 }}>Loading…</div>

  const thtd: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 12.5, color: C.ink, borderBottom: `1px solid ${C.border}` }
  const th: React.CSSProperties = { ...thtd, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.ink2 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {d.source === 'mock' && <div style={{ fontSize: 11.5, color: C.warn, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '8px 12px' }}>Sample data — connect GateCard&rsquo;s move-in tables to go live (one-file swap in the residents adapter).</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Move-ins */}
        <div style={card()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><UserPlus size={16} color={C.cyan} /><span style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>Upcoming move-ins</span></div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Unit</th><th style={th}>Resident</th><th style={th}>Date</th><th style={th}>Status</th></tr></thead>
            <tbody>{d.moveIns.map(m => <tr key={m.id}><td style={{ ...thtd, fontWeight: 700 }}>{m.unit}</td><td style={thtd}>{m.resident}</td><td style={{ ...thtd, color: C.ink2 }}>{m.date}</td><td style={thtd}>{statusChip(m.status)}</td></tr>)}</tbody>
          </table>
        </div>

        {/* Site settings */}
        <div style={card()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><Settings size={16} color={C.cyan} /><span style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>Site settings</span></div>
          {d.siteSettings.map((st, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: i < d.siteSettings.length - 1 ? `1px solid ${C.border}` : 'none', fontSize: 12.5 }}><span style={{ color: C.ink2 }}>{st.label}</span><span style={{ color: C.ink, fontWeight: 600, textAlign: 'right' }}>{st.value}</span></div>)}
        </div>
      </div>

      {/* Compliance */}
      <div style={card()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><ClipboardCheck size={16} color={C.cyan} /><span style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>Move-in compliance</span></div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Unit</th><th style={th}>Resident</th><th style={th}>Requirement</th><th style={th}>Due</th><th style={th}>Status</th></tr></thead>
          <tbody>{d.compliance.map(c => <tr key={c.id}><td style={{ ...thtd, fontWeight: 700 }}>{c.unit}</td><td style={thtd}>{c.resident}</td><td style={thtd}>{c.item}</td><td style={{ ...thtd, color: C.ink2 }}>{c.due || '—'}</td><td style={thtd}>{statusChip(c.status)}</td></tr>)}</tbody>
        </table>
      </div>

      {/* Concession blocks */}
      <div style={card()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><Ticket size={16} color={C.cyan} /><span style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>Concession code blocks</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {d.concessionBlocks.map(b => (
            <div key={b.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}><span style={{ fontSize: 15, fontWeight: 800, color: C.ink, letterSpacing: '0.04em' }}>{b.code}</span>{statusChip(b.status)}</div>
              <div style={{ fontSize: 12, color: C.ink2 }}>{b.used} of {b.units} used · expires {b.expires}</div>
              <div style={{ height: 6, borderRadius: 999, background: C.canvas, marginTop: 8, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(100, Math.round((b.used / Math.max(1, b.units)) * 100))}%`, background: b.status === 'active' ? C.cyan : C.warn }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ResidentsClient({ slug, displayName }: { slug: string; displayName: string }) {
  return <OpsShell slug={slug} displayName={displayName} active="residents"><Inner slug={slug} /></OpsShell>
}
