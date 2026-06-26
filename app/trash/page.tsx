'use client'
// Deleted Items — safe recycle bin. Restore, or permanently delete (corporate only).
import { useCallback, useEffect, useState } from 'react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Trash2, RotateCcw, ArrowLeft, Loader2 } = require('lucide-react') as any

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type Tab = 'leads' | 'opportunities' | 'dealers'

const BG = '#0B1728', PANEL = '#131B2E', LINE = '#1E2A45', TXT = '#F8FAFC', MUT = '#94A3B8', BRAND = '#6B7EFF', RED = '#F87171', GREEN = '#34D399'
const TABS: { v: Tab; label: string }[] = [{ v: 'leads', label: 'Leads' }, { v: 'opportunities', label: 'Opportunities' }, { v: 'dealers', label: 'Dealers' }]

function labelOf(tab: Tab, r: Row) {
  if (tab === 'leads') return r.company_name || r.contact_name || 'Lead'
  if (tab === 'opportunities') return r.name || r.account_name || 'Opportunity'
  return r.name || 'Dealer'
}
function subOf(tab: Tab, r: Row) {
  if (tab === 'leads') return r.location || r.contact_name || ''
  if (tab === 'opportunities') return [r.account_name, r.stage].filter(Boolean).join(' · ')
  return r.org_tier || ''
}

export default function TrashPage() {
  const [tab, setTab] = useState<Tab>('leads')
  const [data, setData] = useState<{ leads: Row[]; opportunities: Row[]; dealers: Row[] }>({ leads: [], opportunities: [], dealers: [] })
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch('/api/trash').then(x => x.json()); setData({ leads: r.leads ?? [], opportunities: r.opportunities ?? [], dealers: r.dealers ?? [] }) }
    catch { /* keep */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => { setSel(new Set()) }, [tab])

  const rows: Row[] = data[tab] ?? []
  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allSel = rows.length > 0 && rows.every(r => sel.has(r.id))

  async function act(action: 'restore' | 'purge') {
    const ids = [...sel]
    if (!ids.length) return
    if (action === 'purge' && !confirm(`Permanently delete ${ids.length} item(s)? This cannot be undone.`)) return
    setBusy(true); setMsg(null)
    try {
      const r = await fetch('/api/trash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table: tab, ids, action }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || d.error) throw new Error(d.error || 'Failed')
      setMsg(action === 'restore' ? `Restored ${ids.length}.` : `Permanently deleted ${ids.length}.`)
      setSel(new Set()); await load()
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed') } finally { setBusy(false); setTimeout(() => setMsg(null), 3000) }
  }

  return (
    <div style={{ minHeight: '100dvh', background: BG, color: TXT, padding: '20px 18px 60px', maxWidth: 760, margin: '0 auto', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: MUT, fontSize: 12, textDecoration: 'none', marginBottom: 14 }}><ArrowLeft size={14} /> Back to dashboard</a>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(248,113,113,0.16)', border: '1px solid rgba(248,113,113,0.4)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: RED }}><Trash2 size={16} /></span>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Deleted Items</h1>
      </div>
      <p style={{ fontSize: 13, color: MUT, margin: '0 0 16px' }}>Restore anything by mistake, or permanently remove it. Permanent delete is corporate-only and can’t be undone.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.v} onClick={() => setTab(t.v)} style={{ fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${tab === t.v ? 'rgba(107,126,255,0.5)' : LINE}`, background: tab === t.v ? 'rgba(107,126,255,0.16)' : PANEL, color: tab === t.v ? '#C7D0FF' : MUT }}>
            {t.label}{(data[t.v]?.length ?? 0) > 0 ? ` · ${data[t.v].length}` : ''}
          </button>
        ))}
      </div>

      {msg && <div style={{ marginBottom: 12, fontSize: 13, padding: '9px 12px', borderRadius: 10, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', color: '#6EE7B7' }}>{msg}</div>}

      {sel.size > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: MUT }}>{sel.size} selected</span>
          <button disabled={busy} onClick={() => act('restore')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 10, cursor: 'pointer', background: 'rgba(52,211,153,0.16)', border: '1px solid rgba(52,211,153,0.4)', color: '#6EE7B7' }}>{busy ? <Loader2 size={13} /> : <RotateCcw size={13} />} Restore</button>
          <button disabled={busy} onClick={() => act('purge')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 10, cursor: 'pointer', background: 'rgba(248,113,113,0.16)', border: '1px solid rgba(248,113,113,0.4)', color: RED }}><Trash2 size={13} /> Permanently delete</button>
        </div>
      )}

      {loading ? (
        <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, color: MUT, fontSize: 14 }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, textAlign: 'center', color: MUT, fontSize: 14 }}>Nothing deleted here.</div>
      ) : (
        <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 14, overflow: 'hidden' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${LINE}`, cursor: 'pointer', fontSize: 12, color: MUT }}>
            <input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(rows.map(r => r.id)))} style={{ width: 16, height: 16 }} /> Select all
          </label>
          {rows.map((r, i) => (
            <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: i < rows.length - 1 ? `1px solid ${LINE}` : 'none', cursor: 'pointer', background: sel.has(r.id) ? 'rgba(107,126,255,0.08)' : 'transparent' }}>
              <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} style={{ width: 16, height: 16 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14 }}>{labelOf(tab, r)}</div>
                {subOf(tab, r) && <div style={{ fontSize: 12, color: MUT, marginTop: 2 }}>{subOf(tab, r)}</div>}
              </div>
              {r.deleted_at && <span style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>{new Date(r.deleted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
