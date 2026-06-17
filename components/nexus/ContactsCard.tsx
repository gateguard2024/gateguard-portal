'use client'
// Reusable "Contacts" card — drop on any record (lead / opportunity / customer /
// dealer / job / site). Contacts are many-to-many, so this attaches/detaches via
// contact_links. Add an existing contact, create a new one, or remove — all here.
import { useCallback, useEffect, useState } from 'react'

type Linked = { link_id: string; contact_id: string; name: string; email: string | null; phone: string | null; title: string | null; role: string | null }
type Found = { id: string; name: string; email: string | null; title?: string | null }

const card = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16 } as const
const input = { background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.92)', borderRadius: 10, padding: '8px 10px', width: '100%', fontSize: 13 } as const

export function ContactsCard({ entityType, entityId, accent = '#6B7EFF' }: { entityType: string; entityId?: string; accent?: string }) {
  const [rows, setRows] = useState<Linked[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Found[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!entityId) { setLoading(false); return }
    const j = await fetch(`/api/crm/contact-links?entity_type=${entityType}&entity_id=${entityId}`).then(r => r.json()).catch(() => ({}))
    setRows(Array.isArray(j.contacts) ? j.contacts : [])
    setLoading(false)
  }, [entityType, entityId])
  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!adding) return
    let active = true
    const t = setTimeout(async () => {
      const j = await fetch(`/api/crm/contacts?q=${encodeURIComponent(q)}`).then(r => r.json()).catch(() => ({}))
      if (active) setResults(Array.isArray(j.contacts) ? j.contacts : [])
    }, 220)
    return () => { active = false; clearTimeout(t) }
  }, [q, adding])

  async function attach(contactId: string) {
    setBusy(true)
    try {
      await fetch('/api/crm/contact-links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: contactId, entity_type: entityType, entity_id: entityId }) })
      setAdding(false); setQ(''); setResults([]); await load()
    } finally { setBusy(false) }
  }
  async function createAndAttach() {
    if (!q.trim()) return
    setBusy(true)
    try {
      const c = await fetch('/api/crm/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: q.trim() }) }).then(r => r.json()).catch(() => ({}))
      if (c?.id) await fetch('/api/crm/contact-links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: c.id, entity_type: entityType, entity_id: entityId }) })
      setAdding(false); setQ(''); setResults([]); await load()
    } finally { setBusy(false) }
  }
  async function remove(linkId: string) {
    setRows(prev => prev.filter(r => r.link_id !== linkId))
    await fetch(`/api/crm/contact-links?id=${linkId}`, { method: 'DELETE' }).catch(() => {})
  }

  const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>Contacts</div>
        {!adding && entityId && <button onClick={() => setAdding(true)} style={{ fontSize: 12, color: accent, background: 'none', border: 'none', cursor: 'pointer' }}>+ Add</button>}
      </div>

      {loading ? <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading…</div> : (
        <div style={{ display: 'grid', gap: 6 }}>
          {rows.length === 0 && !adding && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>No contacts yet.</div>}
          {rows.map(r => (
            <div key={r.link_id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '8px 10px' }}>
              <div style={{ width: 30, height: 30, borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: `${accent}22`, color: accent }}>{initials(r.name)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}{r.title ? <span style={{ color: 'rgba(255,255,255,0.4)' }}> · {r.title}</span> : ''}</div>
                {r.email && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}</div>}
              </div>
              <button onClick={() => remove(r.link_id)} title="Remove" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div style={{ marginTop: 10 }}>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search a contact, or type a new name…" style={input} />
          <div style={{ display: 'grid', gap: 4, marginTop: 6, maxHeight: 200, overflowY: 'auto' }}>
            {results.map(c => (
              <button key={c.id} onClick={() => attach(c.id)} disabled={busy} style={{ textAlign: 'left', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>{c.name}</div>
                {c.email && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{c.email}</div>}
              </button>
            ))}
            {q.trim() && <button onClick={createAndAttach} disabled={busy} style={{ textAlign: 'left', background: `${accent}1a`, border: `1px solid ${accent}55`, borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: accent, fontSize: 13 }}>+ Create &amp; add “{q.trim()}”</button>}
          </div>
          <button onClick={() => { setAdding(false); setQ('') }} style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
        </div>
      )}
    </div>
  )
}
